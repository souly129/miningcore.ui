/**
 * API Request Manager for MiningCore WebUI
 * 
 * Provides:
 * - Request deduplication (prevents same endpoint from being called twice simultaneously)
 * - Request batching for dashboard data
 * - Rate limiting / throttling
 * - Intelligent caching with TTL
 * - Proper interval management
 */

(function(window) {
    'use strict';

    // ============================================================================
    // API REQUEST MANAGER
    // ============================================================================
    
    const APIRequestManager = {
        // Track in-flight requests to prevent duplicates
        inFlightRequests: new Map(),
        
        // Cache for API responses with TTL
        cache: new Map(),
        
        // Default cache TTL (5 seconds for real-time data)
        defaultCacheTTL: 5000,
        
        // Rate limiting: max requests per second
        requestsPerSecond: 10,
        requestTimestamps: [],
        
        // Request queue for rate limiting
        requestQueue: [],
        isProcessingQueue: false,

        /**
         * Make an API request with deduplication and caching
         * @param {string} url - The API endpoint URL
         * @param {object} options - Additional options (method, cacheTTL, bypassCache)
         * @returns {Promise} - The AJAX promise
         */
        request: function(url, options = {}) {
            const self = this;
            const cacheKey = url + (options.method || 'GET');
            const cacheTTL = options.cacheTTL !== undefined ? options.cacheTTL : this.defaultCacheTTL;
            
            // Check cache first (unless bypassed)
            if (!options.bypassCache && cacheTTL > 0) {
                const cached = this.cache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < cacheTTL) {
                    console.log('[APIManager] Cache hit:', url);
                    return Promise.resolve(cached.data);
                }
            }
            
            // Check if request is already in-flight (deduplication)
            if (this.inFlightRequests.has(cacheKey)) {
                console.log('[APIManager] Deduplicating request:', url);
                return this.inFlightRequests.get(cacheKey);
            }
            
            // Create the request promise
            const requestPromise = new Promise((resolve, reject) => {
                // Add to rate limiting queue
                this.requestQueue.push({
                    url: url,
                    options: options,
                    cacheKey: cacheKey,
                    cacheTTL: cacheTTL,
                    resolve: resolve,
                    reject: reject
                });
                
                // Process queue
                this.processQueue();
            });
            
            // Track in-flight request
            this.inFlightRequests.set(cacheKey, requestPromise);
            
            // Clean up after request completes
            requestPromise.finally(() => {
                this.inFlightRequests.delete(cacheKey);
            });
            
            return requestPromise;
        },

        /**
         * Process the request queue with rate limiting
         */
        processQueue: function() {
            if (this.isProcessingQueue || this.requestQueue.length === 0) {
                return;
            }
            
            this.isProcessingQueue = true;
            
            const processNext = () => {
                if (this.requestQueue.length === 0) {
                    this.isProcessingQueue = false;
                    return;
                }
                
                // Check rate limit
                const now = Date.now();
                this.requestTimestamps = this.requestTimestamps.filter(ts => now - ts < 1000);
                
                if (this.requestTimestamps.length >= this.requestsPerSecond) {
                    // Wait and retry
                    setTimeout(processNext, 100);
                    return;
                }
                
                // Process next request
                const { url, options, cacheKey, cacheTTL, resolve, reject } = this.requestQueue.shift();
                this.requestTimestamps.push(now);
                
                console.log('[APIManager] Executing request:', url);
                
                $.ajax({
                    url: url,
                    method: options.method || 'GET',
                    timeout: options.timeout || 30000,
                    ...options.ajaxOptions
                })
                .done((data) => {
                    // Cache the response
                    if (cacheTTL > 0) {
                        this.cache.set(cacheKey, {
                            data: data,
                            timestamp: Date.now()
                        });
                    }
                    resolve(data);
                })
                .fail((xhr, status, error) => {
                    console.error('[APIManager] Request failed:', url, status, error);
                    reject({ xhr, status, error });
                })
                .always(() => {
                    // Process next in queue
                    setTimeout(processNext, 50);
                });
            };
            
            processNext();
        },

        /**
         * Clear the cache
         */
        clearCache: function() {
            this.cache.clear();
            console.log('[APIManager] Cache cleared');
        },

        /**
         * Clear cache for a specific endpoint pattern
         */
        invalidateCache: function(pattern) {
            for (const [key] of this.cache) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        },

        /**
         * Cancel all pending requests
         */
        cancelAll: function() {
            this.requestQueue = [];
            console.log('[APIManager] All pending requests cancelled');
        }
    };

    // ============================================================================
    // DASHBOARD DATA BATCHER
    // ============================================================================
    
    const DashboardDataBatcher = {
        /**
         * Load all dashboard data for a miner in a coordinated way
         * This replaces the scatter-gun approach with sequential batching
         */
        loadMinerDashboard: async function(poolId, walletAddress, callbacks = {}) {
            console.log('[DashboardBatcher] Loading dashboard data for:', walletAddress);
            
            const baseUrl = window.API || 'https://meowpool.net/api/';
            
            try {
                // Phase 1: Load primary miner data (this is the most important)
                const minerData = await APIRequestManager.request(
                    `${baseUrl}pools/${poolId}/miners/${walletAddress}`,
                    { cacheTTL: 10000 }
                );
                
                if (callbacks.onMinerData) {
                    callbacks.onMinerData(minerData);
                }
                
                // Phase 2: Load secondary data in parallel (but controlled)
                const secondaryPromises = [];
                
                // Performance data (for charts)
                secondaryPromises.push(
                    APIRequestManager.request(
                        `${baseUrl}pools/${poolId}/miners/${walletAddress}/performance?page=0&pageSize=48`,
                        { cacheTTL: 30000 }
                    ).then(data => {
                        if (callbacks.onPerformanceData) callbacks.onPerformanceData(data);
                    }).catch(err => console.error('Performance data failed:', err))
                );
                
                // Payments data
                secondaryPromises.push(
                    APIRequestManager.request(
                        `${baseUrl}pools/${poolId}/miners/${walletAddress}/payments?page=0&pageSize=500`,
                        { cacheTTL: 30000 }
                    ).then(data => {
                        if (callbacks.onPaymentsData) callbacks.onPaymentsData(data);
                    }).catch(err => console.error('Payments data failed:', err))
                );
                
                // Blocks data
                secondaryPromises.push(
                    APIRequestManager.request(
                        `${baseUrl}pools/${poolId}/miners/${walletAddress}/blocks?page=0&pageSize=50`,
                        { cacheTTL: 30000 }
                    ).then(data => {
                        if (callbacks.onBlocksData) callbacks.onBlocksData(data);
                    }).catch(err => console.error('Blocks data failed:', err))
                );
                
                // Balance changes (earnings)
                secondaryPromises.push(
                    APIRequestManager.request(
                        `${baseUrl}pools/${poolId}/miners/${walletAddress}/balancechanges?page=0&pageSize=999`,
                        { cacheTTL: 30000 }
                    ).then(data => {
                        if (callbacks.onBalanceChangesData) callbacks.onBalanceChangesData(data);
                    }).catch(err => console.error('Balance changes failed:', err))
                );
                
                // Wait for all secondary data (with a timeout)
                await Promise.race([
                    Promise.all(secondaryPromises),
                    new Promise((_, reject) => setTimeout(() => reject('Timeout'), 15000))
                ]).catch(err => console.warn('[DashboardBatcher] Secondary data timeout:', err));
                
                console.log('[DashboardBatcher] Dashboard data load complete');
                
                if (callbacks.onComplete) {
                    callbacks.onComplete();
                }
                
                return minerData;
                
            } catch (error) {
                console.error('[DashboardBatcher] Failed to load dashboard:', error);
                if (callbacks.onError) {
                    callbacks.onError(error);
                }
                throw error;
            }
        }
    };

    // ============================================================================
    // INTERVAL MANAGER
    // ============================================================================
    
    const IntervalManager = {
        intervals: new Map(),
        
        /**
         * Set an interval with a unique identifier
         * Automatically clears any existing interval with the same ID
         */
        setInterval: function(id, callback, delay) {
            // Clear existing interval with same ID
            if (this.intervals.has(id)) {
                clearInterval(this.intervals.get(id));
                console.log('[IntervalManager] Cleared existing interval:', id);
            }
            
            const intervalId = setInterval(callback, delay);
            this.intervals.set(id, intervalId);
            console.log('[IntervalManager] Created interval:', id, 'every', delay, 'ms');
            
            return intervalId;
        },
        
        /**
         * Clear a specific interval
         */
        clearInterval: function(id) {
            if (this.intervals.has(id)) {
                clearInterval(this.intervals.get(id));
                this.intervals.delete(id);
                console.log('[IntervalManager] Cleared interval:', id);
            }
        },
        
        /**
         * Clear all intervals (for page cleanup)
         */
        clearAll: function() {
            for (const [id, intervalId] of this.intervals) {
                clearInterval(intervalId);
            }
            this.intervals.clear();
            console.log('[IntervalManager] All intervals cleared');
        },
        
        /**
         * Clear all intervals matching a pattern
         */
        clearByPattern: function(pattern) {
            for (const [id, intervalId] of this.intervals) {
                if (id.includes(pattern)) {
                    clearInterval(intervalId);
                    this.intervals.delete(id);
                }
            }
            console.log('[IntervalManager] Cleared intervals matching:', pattern);
        }
    };

    // ============================================================================
    // DEBOUNCE / THROTTLE UTILITIES
    // ============================================================================
    
    /**
     * Debounce a function - only execute after delay with no new calls
     */
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    /**
     * Throttle a function - execute at most once per delay
     */
    function throttle(func, delay) {
        let lastCall = 0;
        let timeoutId;
        return function(...args) {
            const now = Date.now();
            const remaining = delay - (now - lastCall);
            
            if (remaining <= 0) {
                lastCall = now;
                func.apply(this, args);
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    lastCall = Date.now();
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    // ============================================================================
    // EXPORT TO WINDOW
    // ============================================================================
    
    window.APIRequestManager = APIRequestManager;
    window.DashboardDataBatcher = DashboardDataBatcher;
    window.IntervalManager = IntervalManager;
    window.debounce = debounce;
    window.throttle = throttle;

    console.log('[API Request Manager] Module loaded successfully');

})(window);
