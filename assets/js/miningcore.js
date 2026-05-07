/*!
 * Miningcore.js v3.2 - Enhanced with Best Share Tracking, Recent Blocks and Modern Chart.js Charts
 * Features: Real-time updates, interactive tooltips, zoom/pan, multiple timeframes, gradient fills, recent blocks display, best share tracking
 * NEW: Best share difficulty tracking for pool, miners, and workers
 */

// Global Variables
var WebURL = window.location.protocol + "//" + window.location.hostname + "/";
if (WebURL.substring(WebURL.length-1) != "/") {
    WebURL = WebURL + "/";
}

// =============================================================================
// INITIALIZATION GUARDS & REQUEST MANAGEMENT - Prevent duplicate calls
// =============================================================================
var pingMonitoringInitialized = false;
var blocksMonitoringInitialized = false;
var homePageLoading = false;

// Request tokens to ignore stale AJAX responses
var currentRequestToken = 0;
var currentPoolToken = null;

// Debounce loadIndex to prevent rapid duplicate calls
var loadIndexTimeout = null;
var loadIndexDebounceMs = 100;

// Track if initial load has happened
var initialLoadComplete = false;
var lastLoadIndexCall = 0;

// Active AJAX requests that can be aborted
var activeRequests = {};

// Request throttling
var lastRequestTime = {};
var REQUEST_COOLDOWN_MS = 5000;

// Check if request should be throttled
function shouldThrottleRequest(endpoint) {
    var now = Date.now();
    if (lastRequestTime[endpoint] && (now - lastRequestTime[endpoint]) < REQUEST_COOLDOWN_MS) {
        console.log('Throttling request to:', endpoint, '(cooldown active)');
        return true;
    }
    lastRequestTime[endpoint] = now;
    return false;
}

// Clear throttle for an endpoint
function clearThrottle(endpoint) {
    delete lastRequestTime[endpoint];
}

// Abort all active AJAX requests
function abortActiveRequests() {
    Object.keys(activeRequests).forEach(function(key) {
        if (activeRequests[key] && activeRequests[key].abort) {
            activeRequests[key].abort();
        }
    });
    activeRequests = {};
    lastRequestTime = {};
}


// Mapping of pool symbols to proxy JSON keys
const coinMap = {
    'FIRO': 'firo',
    'MEWC': 'meowcoin',
    'RTM': 'raptoreum',
    'RVN': 'ravencoin',
    'BTC': 'bitcoin',       // add others as needed
    'BCH': 'bitcoin-cash',
    'ETC': 'ethereum-classic',
    'KAS': 'kaspa',
    'WART': 'warthog',
    'XEL': 'xelis',
    'BC2': 'bitcoinii',
    'LOG': 'woodcoin',
    'LTC': 'litecoin',
    'DOGE': 'dogecoin',
    'BC2': 'bitcoinii',
    'CAT': 'catcoins',
    'ZEC': 'zcash'
};

// Load coin prices using your backend proxy
function loadAllCoinPrices(pools) {
    return new Promise((resolve) => {
        $.ajax({
            url: '/api/prices',  // call your Node proxy
            timeout: 5000,
            method: 'GET'
        })
        .done(function(data) {
            console.log('Proxy price response:', data);

            pools.forEach(pool => {
                const symbol = (pool.coin.symbol || getCoinSymbol(pool.coin.type)).toUpperCase();
                const key = coinMap[symbol];
                const price = key ? data[key]?.usd || 0 : 0;

                pool.coinPrice = price;
                pool.totalPaidUSD = pool.totalPaid * price;
            });

            resolve(pools);
        })
        .fail(function(xhr, status, error) {
            console.error('Price proxy request failed:', error);

            pools.forEach(pool => {
                pool.coinPrice = 0;
                pool.totalPaidUSD = 0;
            });

            resolve(pools);
        });
    });
}


// Track an AJAX request
function trackRequest(name, xhr) {
    if (activeRequests[name] && activeRequests[name].abort) {
        activeRequests[name].abort();
    }
    activeRequests[name] = xhr;
}

// pool cards with USD price information
function updatePoolCardsWithPrices(poolsWithPrices) {
    console.log('Updating pool cards with price information');
    
    poolsWithPrices.forEach(pool => {
        const poolCard = $(`.pool-card[href="#${pool.id}"]`);
        
        if (poolCard.length > 0) {
            const usdValueElement = poolCard.find('.pool-card-stat-label:contains("USD Value")')
                                            .next('.pool-card-stat-value');
            
            if (usdValueElement.length > 0) {
                let formattedValue = "N/A"; 
                
                // Check if totalPaidUSD is defined and greater than 0
                if (pool.totalPaidUSD !== undefined && pool.totalPaidUSD > 0) {
                    if (pool.totalPaidUSD >= 1000000) {
                        formattedValue = "$" + (pool.totalPaidUSD / 1000000).toFixed(1) + "M";  // Million (M)
                    } else if (pool.totalPaidUSD >= 1000) {
                        formattedValue = "$" + (pool.totalPaidUSD / 1000).toFixed(1) + "K";  // Thousand (K)
                    } else if (pool.totalPaidUSD >= 1) {
                        formattedValue = "$" + pool.totalPaidUSD.toFixed(0);  // Regular value
                    } else if (pool.totalPaidUSD > 0) {
                        formattedValue = "$" + pool.totalPaidUSD.toFixed(8);  // Small value (up to 8 decimals)
                    } else {
                        formattedValue = "$0";  // No value
                    }
                }
                
                // Update the USD value element with a fade effect
                usdValueElement.fadeOut(200, function() {
                    $(this).text(formattedValue).fadeIn(200);
                });
            }
        }
    });
}

// API endpoint construction
var API = WebURL + "api/";
if (API.substring(API.length - 1) != "/") {
    API = API + "/";
}
// Patch: Define updateDashboardWorkerList to prevent errors
function updateDashboardWorkerList(minerData) {
    // This is a temporary placeholder.
    // minerData contains your miner info, you can use it later to update the dashboard.
    console.warn("updateDashboardWorkerList called with data:", minerData);

    // Example: Log workers if they exist
    if (minerData && minerData.workers) {
        minerData.workers.forEach(worker => {
            console.log("Worker:", worker.name, "Hashrate:", worker.hashrate);
        });
    }
}

// Add debug logging for API calls
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (window.debugMode || window.location.search.includes('debug=true')) {
            console.log('API Request:', settings.type, settings.url);
        }
    },
    complete: function(xhr, status) {
        if (window.debugMode || window.location.search.includes('debug=true')) {
            console.log('API Response:', status, xhr.status);
        }
    }
});

var stratumAddress = window.location.hostname;
var currentPage = "index";
var currentPool = null;
var currentAddress = null;
var minerBlocks = {};

// Chart instances storage
window.chartInstances = window.chartInstances || {};
window.currentDashboardAddress = null;
window.dailyPaymentChartData = null;

// Recent blocks storage
window.recentBlocksData = [];
window.lastBlockUpdate = 0;

// Best share data storage
window.bestShareData = {
    pool: null,
    miner: null,
    workers: {}
};

// Interval management
var activeIntervals = [];
var activePingInterval = null;
var recentBlocksInterval = null;

console.log('MiningCore.WebUI:', WebURL);
console.log('API address:', API);
console.log('Stratum address:', "stratum+tcp://" + stratumAddress + ":");

// =============================================================================
// BEST SHARE FORMATTING UTILITIES
// =============================================================================

/**
 * Format difficulty with K/M/G/T/P/E suffixes
 * @param {number} difficulty - The difficulty value to format
 * @param {number} decimals - Number of decimal places (default 2)
 * @returns {string} Formatted difficulty string
 */
function formatDifficulty(difficulty, decimals = 2) {
    if (difficulty === null || difficulty === undefined || difficulty === 0) {
        return "0";
    }
    
    const suffixes = [
        { value: 1e18, symbol: "E" },
        { value: 1e15, symbol: "P" },
        { value: 1e12, symbol: "T" },
        { value: 1e9, symbol: "G" },
        { value: 1e6, symbol: "M" },
        { value: 1e3, symbol: "K" },
        { value: 1, symbol: "" }
    ];
    
    for (const suffix of suffixes) {
        if (difficulty >= suffix.value) {
            const formatted = (difficulty / suffix.value).toFixed(decimals);
            // Remove trailing zeros after decimal point
            const cleaned = formatted.replace(/\.?0+$/, '');
            return cleaned + suffix.symbol;
        }
    }
    
    return difficulty.toFixed(decimals);
}

/**
 * Get time ago string from a date
 * @param {Date|string} date - The date to calculate from
 * @returns {string} Human-readable time ago string
 */
function getBestShareTimeAgo(date) {
    if (!date) return "Never";
    
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 30) {
        return Math.floor(days / 30) + " months ago";
    } else if (days >= 1) {
        return days + " day" + (days > 1 ? "s" : "") + " ago";
    } else if (hours >= 1) {
        return hours + " hour" + (hours > 1 ? "s" : "") + " ago";
    } else if (minutes >= 1) {
        return minutes + " min" + (minutes > 1 ? "s" : "") + " ago";
    } else if (seconds >= 1) {
        return seconds + " sec" + (seconds > 1 ? "s" : "") + " ago";
    } else {
        return "just now";
    }
}

// =============================================================================
// BEST SHARE API FUNCTIONS
// =============================================================================

/**
 * Load pool best share stats
 * @param {string} poolId - The pool ID
 * @returns {Promise} Promise resolving to best share stats
 */

/**
 * Load miner best share stats (includes worker breakdown)
 * @param {string} poolId - The pool ID
 * @param {string} address - The miner wallet address
 * @returns {Promise} Promise resolving to miner best share stats
 */
function loadMinerBestStats(poolId, address) {
    console.log('Loading miner best stats for:', address);
    
    return $.ajax({
        url: API + "pools/" + poolId + "/miners/" + encodeURIComponent(address) + "/beststats",
        method: 'GET',
        timeout: 10000
    })
    .done(function(data) {
    console.log('Miner best stats loaded:', data);
        window.bestShareData.miner = data;
        // Convert workerBests array to object keyed by worker name
        const workerBestsObj = {};
        (data.workerBests || []).forEach(w => {
            workerBestsObj[w.worker] = { difficulty: w.bestDifficulty, formattedDifficulty: w.bestDifficultyFormatted, foundAt: w.bestShareTimestamp, timeAgo: w.bestShareTimeAgo };
        });
        window.bestShareData.workers = workerBestsObj;
        updateMinerBestShareDisplay(data);
        updateWorkerBestShares(workerBestsObj);
    })
   // .fail(function(xhr, status, error) {
   //     console.warn('Failed to load miner best stats:', status, error);
   // });
}

/**
 * Load best share leaderboard for a pool
 * @param {string} poolId - The pool ID
 * @param {number} limit - Number of top miners to return (default 20)
 * @returns {Promise} Promise resolving to leaderboard data
 */
function loadBestShareLeaderboard(poolId, limit = 20) {
    console.log('Loading best share leaderboard for pool:', poolId);
    
    return $.ajax({
        url: API + "pools/" + poolId + "/leaderboard/bestshares?limit=" + limit,
        method: 'GET',
        timeout: 10000
    })
    .done(function(data) {
        console.log('Best share leaderboard loaded:', data);
        updateBestShareLeaderboard(data.leaderboard);
        setTimeout(function() { updateMinersTableBestShares(data.leaderboard); }, 500);
    });

}

// =============================================================================
// BEST SHARE UI UPDATE FUNCTIONS
// =============================================================================

/**
 * Update pool best share display on stats page
 * @param {object} data - Pool best share data
 */
function updatePoolBestShareDisplay(data) {
    if (!data || !data.poolBest) return;
    // Update pool best share stat box
    const poolBest = data.poolBest;
    if (poolBest.difficulty !== undefined) {
        const formattedDiff = poolBest.difficultyFormatted || formatDifficulty(poolBest.difficulty, 2);
        $("#poolBestShare").text(formattedDiff);
        $("#dashboardPoolBest").text(formattedDiff);
        // Update the time ago
        if (poolBest.timeAgo) {
            $("#poolBestShareTime").text(poolBest.timeAgo);
        }
        // Update finder info if available
        if (poolBest.miner) {
            const shortMiner = poolBest.miner.substring(0, 8) + '...' +
                              poolBest.miner.substring(poolBest.miner.length - 6);
            $("#poolBestShareMiner").html(`<a href="#${currentPool}/dashboard?address=${poolBest.miner}" class="text-info">${shortMiner}</a>`);
        }
    }
}


/**
 * Update miner best share display on dashboard
 * @param {object} data - Miner best share data
 */
function updateMinerBestShareDisplay(data) {
    if (!data) return;
    // Update miner's overall best share
    if (data.minerBest && data.minerBest.difficulty !== undefined) {
        const formattedDiff = data.minerBest.difficultyFormatted || formatDifficulty(data.minerBest.difficulty, 2);
        $("#minerBestShare").text(formattedDiff);
        $("#dashboardMinerBest").text(formattedDiff);
        // Update time ago
        if (data.minerBest.timeAgo) {
            $("#minerBestShareTime").text(data.minerBest.timeAgo);
        }
        // Show which worker found it
        if (data.minerBest.worker) {
            $("#minerBestShareWorker").text(data.minerBest.worker);
        }
    }
}

/**
 * Update worker best shares in the workers table
 * @param {object} workerBests - Object mapping worker IDs to their best share data
 */
function updateWorkerBestShares(workerBests) {
    if (!workerBests) return;
    
    // Update each worker row in the table
    $('#workerList tr').each(function() {
        const row = $(this);
        const workerCell = row.find('td:first');
        const workerText = workerCell.text().trim();
        
        // Extract worker ID (remove icon if present)
        let workerId = workerText; // Worker name from cell text
        if (!workerId) workerId = 'default';
        
        // Find the best share cell for this row
        const bestShareCell = row.find('.worker-best-share');
        
        if (workerBests[workerId]) {
            const workerBest = workerBests[workerId];
            const formattedDiff = formatDifficulty(workerBest.difficulty, 2);
            const timeAgo = getBestShareTimeAgo(workerBest.foundAt);
            
            bestShareCell.html(`
                <span class="text-success">${formattedDiff}</span>
                <small class="text-muted d-block">${timeAgo}</small>
            `);
        } else {
            bestShareCell.html('<span class="text-muted">-</span>');
        }
    });
}

/**
 * Update best share leaderboard on miners page
 * @param {array} leaderboard - Array of top miners by best share
 */
function updateBestShareLeaderboard(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) {
        $('#bestShareLeaderboard').html('<tr><td colspan="4" class="text-center text-muted">No data available</td></tr>');
        return;
    }
    
    let html = '';
    leaderboard.forEach((entry, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'text-warning' : (rank <= 3 ? 'text-info' : '');
        const rankIcon = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : rank));
        
        const displayAddress = isMobile() 
            ? entry.miner.substring(0, 8) + '...' + entry.miner.substring(entry.miner.length - 6)
            : entry.miner.substring(0, 12) + '...' + entry.miner.substring(entry.miner.length - 8);
        
        const formattedDiff = formatDifficulty(entry.bestDifficulty, 2);
        const timeAgo = getBestShareTimeAgo(entry.timestamp);
        
        html += `
            <tr>
                <td class="${rankClass}"><strong>${rankIcon}</strong></td>
                <td>
                    <a href="#${currentPool}/dashboard?address=${entry.miner}" class="text-info">
                        ${displayAddress}
                    </a>
                </td>
                <td class="text-success"><strong>${formattedDiff}</strong></td>
                <td class="text-muted">${timeAgo}</td>
            </tr>
        `;
    });
    
    $('#bestShareLeaderboard').html(html);
}
/**
 * Update miners table with best share data from leaderboard
 * @param {array} leaderboard - Array of miners with best share data
 */
function updateMinersTableBestShares(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) return;
    // Create lookup object by miner address
    const bestShareByMiner = {};
    leaderboard.forEach(entry => {
        bestShareByMiner[entry.miner] = {
            difficulty: entry.bestDifficulty,
            formatted: entry.bestDifficultyFormatted,
            timeAgo: entry.timeAgo
        };
    });
    // Update each row in miners table
    $("#minerList tr").each(function() {
        const row = $(this);
        const link = row.find("a.text-info");
        if (link.length) {
            const href = link.attr("href") || "";
            const match = href.match(/address=([^&]+)/);
            if (match) {
                const minerAddress = match[1];
                const bestShareCell = row.find(".miner-best-share");
                if (bestShareByMiner[minerAddress]) {
                    const data = bestShareByMiner[minerAddress];
                    bestShareCell.html(data.formatted || formatDifficulty(data.difficulty, 2));
                }
            }
        }
    });
}

// Wait for Chart.js to be available
function waitForChartJS(callback) {
    if (typeof Chart !== 'undefined') {
        callback();
    } else {
        setTimeout(() => waitForChartJS(callback), 100);
    }
}

// Initialize Chart.js when ready
waitForChartJS(() => {
    console.log('Chart.js is ready, version:', Chart.version);
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';
    Chart.defaults.font.size = 12;
    
    $(document).ready(function() {
        Chart.defaults.color = getThemeColors().textSecondary;
    });
});

// Mobile detection
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || window.innerWidth <= 768;
}

// Touch detection
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Clear all intervals
function clearAllIntervals() {
    activeIntervals.forEach(intervalId => clearInterval(intervalId));
    activeIntervals = [];
    
    if (recentBlocksInterval) {
        clearInterval(recentBlocksInterval);
        recentBlocksInterval = null;
    }
}

// Add interval to tracking
function addInterval(intervalId) {
    activeIntervals.push(intervalId);
}

// Get theme colors with fallback
function getThemeColors() {
    try {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        
        return {
            primary: computedStyle.getPropertyValue('--accent-primary').trim() || '#00d4ff',
            secondary: computedStyle.getPropertyValue('--accent-secondary').trim() || '#0099cc',
            success: computedStyle.getPropertyValue('--success').trim() || '#00ff88',
            warning: computedStyle.getPropertyValue('--warning').trim() || '#ffaa00',
            danger: computedStyle.getPropertyValue('--danger').trim() || '#ff4444',
            textPrimary: computedStyle.getPropertyValue('--text-primary').trim() || '#ffffff',
            textSecondary: computedStyle.getPropertyValue('--text-secondary').trim() || '#b0b0b0',
            textMuted: computedStyle.getPropertyValue('--text-muted').trim() || '#707070',
            bgPrimary: computedStyle.getPropertyValue('--bg-primary').trim() || '#0a0a0a',
            bgSecondary: computedStyle.getPropertyValue('--bg-secondary').trim() || '#1a1a1a',
            bgTertiary: computedStyle.getPropertyValue('--bg-tertiary').trim() || '#242424',
            borderColor: computedStyle.getPropertyValue('--border-color').trim() || '#333333',
            gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            tooltipBg: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'
        };
    } catch (error) {
        console.error('Error getting theme colors:', error);
        return {
            primary: '#00d4ff',
            secondary: '#0099cc',
            success: '#00ff88',
            warning: '#ffaa00',
            danger: '#ff4444',
            textPrimary: '#ffffff',
            textSecondary: '#b0b0b0',
            textMuted: '#707070',
            bgPrimary: '#0a0a0a',
            bgSecondary: '#1a1a1a',
            bgTertiary: '#242424',
            borderColor: '#333333',
            gridColor: 'rgba(255, 255, 255, 0.05)',
            tooltipBg: 'rgba(26, 26, 26, 0.95)'
        };
    }
}

// Create gradient for charts
function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// Main page loader with mobile optimizations
function loadIndex() {
    var now = Date.now();
    if (now - lastLoadIndexCall < 100) {
        console.log('loadIndex called too rapidly, ignoring');
        return;
    }
    lastLoadIndexCall = now;
    
    if (loadIndexTimeout) {
        clearTimeout(loadIndexTimeout);
    }
    
    loadIndexTimeout = setTimeout(function() {
        _loadIndexInternal();
    }, loadIndexDebounceMs);
}

// Internal load function (debounced)
function _loadIndexInternal() {
    currentRequestToken++;
    var myToken = currentRequestToken;
    var previousPool = currentPoolToken;
    
    abortActiveRequests();
    clearAllIntervals();
    stopPingMonitoring();
    
    $("div[class^='page-']").hide();
    $(".page").hide();
    
    var hashList = window.location.hash.split(/[#/?=]/);
    currentPool = hashList[1];
    currentPage = hashList[2] || null;
    currentAddress = hashList[3];
    
    currentPoolToken = currentPool || 'index';
    
    closeMobileMenus();
    
    // Handle global pages (help, about)
    if (!currentPool || ['help', 'about'].includes(currentPool)) {
        $(".main-index").hide();
        $(".main-pool").show();
        $("#pool-sidebar").hide();
        $("#main-pool-nav").show();
        $(".pool-content").css('margin-left', '0');
        
        $(".pool-nav-link").removeClass("active");
        $(".sidebar-menu-link").removeClass("active");
        
        if (currentPool === 'help' || currentPage === 'help') {
            $(".page-help").show();
            $(".nav-help").addClass("active");
        } else if (currentPool === 'about' || currentPage === 'about') {
            $(".page-about").show();
            $(".nav-about").addClass("active");
        } else {
            $(".main-index").show();
            $(".main-pool").hide();
            $("#main-pool-nav").hide();
            loadHomePage();
            initServerPingMonitoring();
            initRecentBlocksMonitoring();
        }
    } else if (currentPool && !currentPage) {
        currentPage = "stats";
        loadNavigation();
        $(".main-index").hide();
        $(".main-pool").show();
        $(".page-stats").show();
        $("#pool-sidebar").show();
        $("#main-pool-nav").show();
        
        if (isMobile()) {
            $(".pool-content").css('margin-left', '0');
        } else {
            $(".pool-content").css('margin-left', '240px');
        }
        
        $("li[class^='nav-']").removeClass("active");
        $(".sidebar-menu-link").removeClass("active");
        $(".pool-nav-link").removeClass("active");
        $(".nav-stats .sidebar-menu-link").addClass("active");
        
        console.log('Loading stats page for pool-only URL');
        if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedDashboard === 'function') {
            window.showMergedDashboard(currentPool);
        } else {
            loadStatsPage();
        }
        
    } else if (currentPool && currentPage) {
        loadNavigation();
        $(".main-index").hide();
        $(".main-pool").show();
        $(".page-" + currentPage).show();
        $("#pool-sidebar").show();
        $("#main-pool-nav").show();
        
        if (isMobile()) {
            $(".pool-content").css('margin-left', '0');
        } else {
            $(".pool-content").css('margin-left', '240px');
        }
        
        $("li[class^='nav-']").removeClass("active");
        $(".sidebar-menu-link").removeClass("active");
        $(".pool-nav-link").removeClass("active");
        
        switch (currentPage) {
            case "stats":
                console.log('Loading stats page');
                $(".nav-stats .sidebar-menu-link").addClass("active");
                if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedDashboard === 'function') {
                    window.showMergedDashboard(currentPool);
                } else {
                    loadStatsPage();
                }
                break;
            case "dashboard":
                console.log('Loading dashboard page');
                $(".nav-dashboard .sidebar-menu-link").addClass("active");
                if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedDashboard === 'function') {
                    window.showMergedDashboard(currentPool);
                } else {
                    loadDashboardPage();
                }
                break;
            case "miners":
                console.log('Loading miners page');
                $(".nav-miners .sidebar-menu-link").addClass("active");
                $(".nav-miners.pool-nav-link").addClass("active");
                if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedDashboard === 'function') {
                    window.showMergedDashboard(currentPool);
                } else {
                    loadMinersPage();
                }
                break;
            case "blocks":
                console.log('Loading blocks page');
                $(".nav-blocks .sidebar-menu-link").addClass("active");
                $(".nav-blocks.pool-nav-link").addClass("active");
                if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedDashboard === 'function') {
                    window.showMergedDashboard(currentPool);
                } else {
                    loadBlocksEffortTable();
                    loadBlocksPage();
                }
                break;
            case "payments":
                console.log('Loading payments page');
                $(".nav-payments .sidebar-menu-link").addClass("active");
                $(".nav-payments.pool-nav-link").addClass("active");
                if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedDashboard === 'function') {
                    window.showMergedDashboard(currentPool);
                } else {
                    loadPaymentsPage();
                }
                break;
            case "connect":
                console.log('Loading connect page');
                $(".nav-connect .sidebar-menu-link").addClass("active");
                if ((currentPool === 'ltc-merged' || currentPool === 'doge-merged') && typeof window.showMergedConnect === 'function') {
                    window.showMergedConnect(currentPool);
                } else {
                    loadConnectPage();
                }
                break;
            case "faq":
                console.log('Loading FAQ page');
                $(".nav-faq .sidebar-menu-link").addClass("active");
                break;
            case "support":
                console.log('Loading support page');
                $(".nav-support .sidebar-menu-link").addClass("active");
                break;
        }
    } else {
        $(".main-index").show();
        $(".main-pool").hide();
        $("#main-pool-nav").hide();
        loadHomePage();
        initServerPingMonitoring();
        initRecentBlocksMonitoring();
    }
    
    scrollPageTop();
}

// Close mobile menus
function closeMobileMenus() {
    $('#main-pool-nav').removeClass('active');
    $('#pool-sidebar').removeClass('active');
}

// Enhanced home page loader with mobile optimization
function loadHomePage() {
    if (homePageLoading && currentRequestToken === homePageLoading) {
        console.log('Home page already loading for this token, skipping');
        return Promise.resolve();
    }
    
    homePageLoading = currentRequestToken;
    var myToken = currentRequestToken;
    
    console.log('Loading home page (token: ' + myToken + ')');
    
    var xhr = $.ajax(API + "pools")
        .done(function(data) {
            if (myToken !== currentRequestToken) {
                console.log('Ignoring stale home page response');
                return;
            }
            
            var poolCoinGridTemplate = "";

            let sortedPools = data.pools.sort((a, b) => {
                const nameA = (a.coin.canonicalName || a.coin.name || a.coin.type).toLowerCase();
                const nameB = (b.coin.canonicalName || b.coin.name || b.coin.type).toLowerCase();
                return nameA.localeCompare(nameB);
            });

            $.each(sortedPools, function(index, value) {
                value.totalPaidUSD = "loading";
                poolCoinGridTemplate += generatePoolCard(value);
            });

            $(".pool-coin-grid").html(poolCoinGridTemplate);
            
            $('.pool-card').each(function(index) {
                $(this).css('animation-delay', (index * 0.05) + 's');
            });
            
            if (isTouchDevice()) {
                addTouchHandlers();
            }

            loadAllCoinPrices(sortedPools).then(poolsWithPrices => {
                if (myToken === currentRequestToken) {
                    updatePoolCardsWithPrices(poolsWithPrices);
                }
                if (homePageLoading === myToken) homePageLoading = false;
            }).catch(error => {
                console.error('Error loading coin prices:', error);
                if (myToken === currentRequestToken) {
                    updatePoolCardsWithPrices(sortedPools.map(pool => {
                        pool.totalPaidUSD = 0;
                        return pool;
                    }));
                }
                if (homePageLoading === myToken) homePageLoading = false;
            });
        })
        .fail(function() {
            if (homePageLoading === myToken) homePageLoading = false;
            $(".pool-coin-grid").html(`
                <div class='alert alert-warning' style='grid-column: 1/-1;'>
                    <h4><i class='fas fa-exclamation-triangle'></i> Warning!</h4>
                    <hr>
                    <p>The pool is currently down for maintenance.</p>
                    <p>Please try again later.</p>
                </div>
            `);
        });
    
    trackRequest('homePage', xhr);
    return xhr;
}

// Add touch handlers for mobile
function addTouchHandlers() {
    $('.pool-card').on('touchstart', function() {
        $(this).addClass('touch-active');
    }).on('touchend touchcancel', function() {
        $(this).removeClass('touch-active');
    });
}


// Enhanced pool card generator with best share info
function generatePoolCard(value) {
    var coinLogo = `<img src='img/coin/icon/${value.coin.type.toLowerCase()}.png' 
                    onerror="this.src='img/coin/icon/default.png'"
                    alt='${value.coin.type}' loading="lazy" />`;
    var coinName = value.coin.canonicalName || value.coin.name || value.coin.type;
    var coinSymbol = value.coin.symbol || getCoinSymbol(value.coin.type);
    
    var pool_networkstat_hash = "Loading...";
    var pool_networkstat_diff = "Loading...";
    var pool_stat_miner = "0";
    var pool_stat_hash = "0 H/s";
    var pool_fee = value.poolFeePercent + "%";
    var pool_total_paid_usd = "Loading...";
    
    var pool_blocks_found = value.totalBlocks || 0;
    var pool_total_paid_coins = value.totalPaid || 0;
    
    if(value.networkStats) {
        pool_networkstat_hash = _formatter(value.networkStats.networkHashrate, 3, "H/s");
        pool_networkstat_diff = _formatter(value.networkStats.networkDifficulty, 6, "");
    }
    
    if(value.poolStats) {
        pool_stat_miner = value.poolStats.connectedMiners;
        pool_stat_hash = _formatter(value.poolStats.poolHashrate, 3, "H/s");
    }
    
    if (value.totalPaidUSD === "loading") {
        pool_total_paid_usd = '<i class="fas fa-spinner fa-spin"></i>';
    } else if (value.totalPaidUSD !== undefined) {
        if (value.totalPaidUSD > 0) {
            if (value.totalPaidUSD >= 1000000) {
                pool_total_paid_usd = "$" + (value.totalPaidUSD / 1000000).toFixed(1) + "M";
            } else if (value.totalPaidUSD >= 1000) {
                pool_total_paid_usd = "$" + (value.totalPaidUSD / 1000).toFixed(1) + "K";
            } else if (value.totalPaidUSD >= 1) {
                pool_total_paid_usd = "$" + value.totalPaidUSD.toFixed(0);
            } else if (value.totalPaidUSD > 0) {
                pool_total_paid_usd = "$" + value.totalPaidUSD.toFixed(8);
            } else {
                pool_total_paid_usd = "$0";
            }
        } else {
            pool_total_paid_usd = "N/A";
        }
    }
    
    var pool_status = value.poolStats && value.poolStats.connectedMiners > 0 ? 
         `<span class="text-success"><i class="fas fa-circle"></i> ${value.poolStats.connectedMiners} Active Miners</span>` :
         '<span class="text-info"><i class="fas fa-circle"></i> Online, No Active Miners</span>';

    var paymentScheme = value.paymentProcessing.payoutScheme || 'Unknown';
    var schemeClass = 'payment-scheme-badge';
    var schemeIcon = '';
    
    switch(paymentScheme.toUpperCase()) {
        case 'SOLO':
            schemeClass += ' scheme-solo';
            schemeIcon = '<i class="fas fa-user"></i>';
            break;
        case 'PPLNS':
            schemeClass += ' scheme-pplns';
            schemeIcon = '<i class="fas fa-chart-line"></i>';
            break;
        case 'PROP':
            schemeClass += ' scheme-prop';
            schemeIcon = '<i class="fas fa-percentage"></i>';
            break;
        case 'PPS':
            schemeClass += ' scheme-pps';
            schemeIcon = '<i class="fas fa-coins"></i>';
            break;
        default:
            schemeClass += ' scheme-default';
            schemeIcon = '<i class="fas fa-info-circle"></i>';
    }
    
    return `
    <a href="#${value.id}" class="pool-card">
        <div class="payment-scheme-indicator">
            <span class="${schemeClass}">
                ${schemeIcon} ${paymentScheme}
            </span>
        </div>
        <div class="pool-card-header">
            <div class="pool-card-icon">
                ${coinLogo}
            </div>
            <div>
                <div class="pool-card-title">${coinName}</div>
                <div class="pool-card-algo">${coinSymbol} • ${value.coin.algorithm}</div>
            </div>
        </div>
        
        <div class="pool-card-stats">
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">Miners</span>
                <span class="pool-card-stat-value">${pool_stat_miner}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">${isMobile() ? 'Pool Rate' : 'Pool Hashrate'}</span>
                <span class="pool-card-stat-value">${pool_stat_hash}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">Fee</span>
                <span class="pool-card-stat-value">${pool_fee}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">${isMobile() ? 'Blocks' : 'Blocks Found'}</span>
                <span class="pool-card-stat-value">${pool_blocks_found.toLocaleString()}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">${isMobile() ? 'Total Paid' : 'Total Paid'}</span>
                <span class="pool-card-stat-value">${_formatter(pool_total_paid_coins, 2, coinSymbol)}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">${isMobile() ? 'USD Value' : 'USD Value'}</span>
                <span class="pool-card-stat-value">${pool_total_paid_usd}</span>
            </div>
        </div>
        
        <div class="pool-card-status">
            ${pool_status}
        </div>
    </a>`;
}

// =============================================================================
// RECENT BLOCKS MONITORING
// =============================================================================
function initRecentBlocksMonitoring() {
    if (blocksMonitoringInitialized) {
        console.log('Recent blocks monitoring already initialized, skipping');
        return;
    }
    blocksMonitoringInitialized = true;
    console.log('Initializing recent blocks monitoring...');
    
    loadRecentBlocks();
    
    if (recentBlocksInterval) {
        clearInterval(recentBlocksInterval);
    }
    
    recentBlocksInterval = setInterval(() => {
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#index') {
            loadRecentBlocks();
        }
    }, 30000);
}

function loadRecentBlocks() {
    console.log('Loading recent blocks...');
    updateBlocksRefreshIndicator();
    
    $.ajax(API + "pools")
        .done(function(poolsData) {
            const recentBlockPromises = poolsData.pools.map(pool => {
                return new Promise((resolve) => {
                    $.ajax(API + "pools/" + pool.id + "/blocks?page=0&pageSize=5")
                        .done(function(blocks) {
                            const enrichedBlocks = blocks.map(block => {
                                return {
                                    ...block,
                                    poolId: pool.id,
                                    poolName: pool.coin.canonicalName || pool.coin.name || pool.coin.type,
                                    coinSymbol: pool.coin.symbol || getCoinSymbol(pool.coin.type),
                                    coinType: pool.coin.type
                                };
                            });
                            resolve(enrichedBlocks);
                        })
                        .fail(function() {
                            resolve([]);
                        });
                });
            });
            
            Promise.all(recentBlockPromises).then(allBlocks => {
                const flatBlocks = allBlocks.flat();
                const sortedBlocks = flatBlocks.sort((a, b) => new Date(b.created) - new Date(a.created));
                const recentBlocks = sortedBlocks.slice(0, 20);
                
                console.log('Found', recentBlocks.length, 'recent blocks');
                updateRecentBlocksDisplay(recentBlocks);
                
                window.recentBlocksData = recentBlocks;
                window.lastBlockUpdate = Date.now();
            });
        })
        .fail(function() {
            console.error('Failed to load pools for recent blocks');
            showRecentBlocksError();
        });
}

function updateRecentBlocksDisplay(blocks) {
    const container = document.getElementById('recentBlocksGrid');
    if (!container) return;
    
    if (!blocks || blocks.length === 0) {
        container.innerHTML = `
            <div class="no-recent-blocks">
                <i class="fas fa-cube"></i>
                <p>No recent blocks found</p>
            </div>
        `;
        return;
    }
    
    let blocksHTML = '';
    
    blocks.forEach((block, index) => {
        const timeAgo = getTimeAgo(new Date(block.created));
        const statusClass = getBlockStatusClass(block.status);
        const statusText = getBlockStatusText(block.status);
        
        const displayMiner = isMobile() 
            ? block.miner.substring(0, 6) + '...' + block.miner.substring(block.miner.length - 6)
            : block.miner.substring(0, 8) + '...' + block.miner.substring(block.miner.length - 8);
        
        const isNewBlock = (Date.now() - new Date(block.created).getTime()) < 120000;
        const newBlockClass = isNewBlock ? 'new-block' : '';
        
        const effort = Math.round((block.effort || 0) * 100);
        let effortClass = 'text-success';
        if (effort > 200) effortClass = 'text-danger';
        else if (effort > 100) effortClass = 'text-warning';
        
        blocksHTML += `
            <div class="recent-block-card ${newBlockClass}" style="animation-delay: ${index * 0.1}s;">
                <div class="block-card-status ${statusClass}">
                    ${statusText}
                </div>
                
                <div class="block-card-header">
                    <div class="block-card-icon">
                        <img src="img/coin/icon/${block.coinType.toLowerCase()}.png" 
                             onerror="this.src='img/coin/icon/default.png'"
                             alt="${block.coinSymbol}" />
                    </div>
                    <div class="block-card-info">
                        <div class="block-card-coin">${block.poolName}</div>
                        <div class="block-card-height">Block #${block.blockHeight.toLocaleString()}</div>
                    </div>
                </div>
                
                <div class="block-card-details">
                    <div class="block-detail">
                        <span class="block-detail-label">Reward</span>
                        <span class="block-detail-value">${_formatter(block.reward || 0, 4, '')}</span>
                    </div>
                    <div class="block-detail">
                        <span class="block-detail-label">Effort</span>
                        <span class="block-detail-value ${effortClass}">${effort}%</span>
                    </div>
                </div>
                
                <div class="block-card-miner">
                    <div class="block-miner-label">Found by</div>
                    <div class="block-miner-address">${displayMiner}</div>
                </div>
                
                <div class="block-time-ago">${timeAgo}</div>
            </div>
        `;
    });
    
    container.innerHTML = blocksHTML;
}

function getBlockStatusClass(status) {
    switch(status) {
        case 'confirmed': return 'block-status-confirmed';
        case 'pending': return 'block-status-pending';
        case 'orphaned': return 'block-status-orphaned';
        default: return 'block-status-pending';
    }
}

function getBlockStatusText(status) {
    switch(status) {
        case 'confirmed': return 'Confirmed';
        case 'pending': return 'Pending';
        case 'orphaned': return 'Orphaned';
        default: return 'Unknown';
    }
}

function showRecentBlocksError() {
    const container = document.getElementById('recentBlocksGrid');
    if (!container) return;
    
    container.innerHTML = `
        <div class="no-recent-blocks">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Failed to load recent blocks</p>
        </div>
    `;
}

function updateBlocksRefreshIndicator() {
    const indicator = document.getElementById('blocksRefreshTime');
    if (indicator) {
        indicator.textContent = 'Just now';
    }
}

// Enhanced navigation loader
function loadNavigation() {
    return $.ajax(API + "pools")
        .done(function(data) {
            var coinLogo = "";
            var coinName = "";
            var coinScheme = "";
            
            $.each(data.pools, function(index, value) {
                if (currentPool === value.id) {
                    coinLogo = `<img style='width:40px' src='img/coin/icon/${value.coin.type.toLowerCase()}.png' 
                               onerror="this.src='img/coin/icon/default.png'" />`;
                    coinName = value.coin.canonicalName || value.coin.name || value.coin.type;
                    coinScheme = value.paymentProcessing.payoutScheme;
                }
            });
            
            var sidebarList = $(".sidebar-template").html()
                .replace(/{{ coinId }}/g, currentPool)
                .replace(/{{ coinLogo }}/g, coinLogo)
                .replace(/{{ coinName }}/g, coinName);
            $(".sidebar-wrapper").html(sidebarList);
            
            $(".nav-home").attr("href", "#");
            $(".nav-blocks.pool-nav-link").attr("href", "#" + currentPool + "/blocks");
            $(".nav-payments.pool-nav-link").attr("href", "#" + currentPool + "/payments");
            $(".nav-miners.pool-nav-link").attr("href", "#" + currentPool + "/miners");
        })
        .fail(function() {
            console.error("Failed to load navigation");
        });
}

// Stats Page Loader - NOW WITH BEST SHARE
function loadStatsPage() {
    console.log('Loading stats page');
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    clearAllIntervals();
    
    waitForChartJS(() => {
        if (myPool !== currentPool || myToken !== currentRequestToken) {
            console.log('Stats page load cancelled - navigated away');
            return;
        }
        
        loadStatsData();
        loadStatsChart('24h');
        

    });
}

// Enhanced Stats Data Loader
function loadStatsData() {
    console.log('Loading stats data...');
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    return $.ajax(API + "pools")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) {
                console.log('Ignoring stale stats data response');
                return;
            }
            
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) {
                console.error("Pool not found:", currentPool);
                return;
            }
            
            updateStat("#blockchainHeight", pool.networkStats.blockHeight.toLocaleString());
            updateStat("#poolFeePercent", `${pool.poolFeePercent}%`);
            updateStat("#poolHashRate", _formatter(pool.poolStats.poolHashrate, 2, "H/s"));
            updateStat("#poolMiners", `${pool.poolStats.connectedMiners} Miner(s)`);
            updateStat("#networkHashRate", _formatter(pool.networkStats.networkHashrate, 2, "H/s"));
            updateStat("#networkDifficulty", _formatter(pool.networkStats.networkDifficulty, 5, ""));
            
            loadBlockStats(pool);
        })
        .fail(function() {
            console.error("Failed to load stats data");
            showNotification("Failed to load stats data", "danger");
        });
}

function updateStat(selector, value) {
    var element = $(selector);
    if (element.text() !== value) {
        element.fadeOut(200, function() {
            $(this).text(value).fadeIn(200);
        });
    }
}

function loadBlockStats(pool) {
    $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=100")
        .done(function(blocks) {
            var confirmedCount = blocks.filter(b => b.status === "confirmed" || b.status === "orphaned").length;
            var pendingCount = blocks.filter(b => b.status === "pending").length;
            
            $("#nav-blocks-badge").text(confirmedCount + pendingCount);
            
            var effortSum = 0;
            var effortCount = 0;
            blocks.forEach(block => {
                if (block.effort !== undefined) {
                    effortSum += block.effort * 100;
                    effortCount++;
                }
            });
            
            if (effortCount > 0) {
                var avgEffort = (effortSum / effortCount).toFixed(2);
                $("#poolEffort").html(`
                    <div>Current: ${(pool.poolEffort * 100).toFixed(2)}%</div>
                    <div class="text-muted">Average: ${avgEffort}%</div>
                `);
            }
        });
}

// Enhanced Stats Chart
function loadStatsChart(timeframe = '24h') {
    console.log('Loading stats chart with timeframe:', timeframe);
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    const endDate = new Date();
    let pageSize = 48;
    
    switch(timeframe) {
        case '7d':
            pageSize = 336;
            break;
        case '30d':
            pageSize = 1440;
            break;
    }
    
    return $.ajax(API + "pools/" + currentPool + "/performance?page=0&pageSize=" + pageSize)
        .done(function(rawData) {
            if (myPool !== currentPool || myToken !== currentRequestToken) {
                console.log('Ignoring stale stats chart response');
                return;
            }
            
            const colors = getThemeColors();
            const ctx = document.getElementById('chartStatsHashRatePool');
            if (!ctx) {
                console.error('Chart canvas element not found');
                return;
            }
            
            let data;
            if (rawData.stats && Array.isArray(rawData.stats)) {
                data = rawData.stats;
            } else if (Array.isArray(rawData)) {
                data = rawData;
            } else {
                console.error('Unknown API response structure:', rawData);
                return;
            }
            
            if (!data || data.length === 0) {
                console.warn('No stats data available');
                return;
            }
            
            const labels = [];
            const poolHashRate = [];
            const networkHashRate = [];
            const connectedMiners = [];
            
            let skipRate = 1;
            if (timeframe === '7d') skipRate = isMobile() ? 8 : 4;
            if (timeframe === '30d') skipRate = isMobile() ? 32 : 16;
            
            const reversedData = data.slice().reverse();
            
            reversedData.forEach((value, index) => {
                if (index % skipRate === 0 && value) {
                    const date = new Date(value.created);
                    if (!isNaN(date.getTime())) {
                        labels.push(date);
                        poolHashRate.push(value.poolHashrate || value.poolHashRate || 0);
                        networkHashRate.push(value.networkHashrate || value.networkHashRate || 0);
                        connectedMiners.push(value.connectedMiners || 0);
                    }
                }
            });
            
            if (labels.length === 0) return;
            
            const currentPoolRate = poolHashRate[poolHashRate.length - 1] || 0;
            const previousPoolRate = poolHashRate[poolHashRate.length - 2] || currentPoolRate;
            const poolRateChange = previousPoolRate > 0 ? ((currentPoolRate - previousPoolRate) / previousPoolRate * 100).toFixed(1) : 0;
            
            const currentNetworkRate = networkHashRate[networkHashRate.length - 1] || 0;
            const currentMinersCount = connectedMiners[connectedMiners.length - 1] || 0;
            const previousMinersCount = connectedMiners[connectedMiners.length - 2] || currentMinersCount;
            const minersChange = currentMinersCount - previousMinersCount;
            
            const poolShare = currentNetworkRate > 0 ? (currentPoolRate / currentNetworkRate * 100).toFixed(2) : 0;
            
            $("#currentPoolRate").text(_formatter(currentPoolRate, 2, "H/s"));
            $("#poolRateChange").text((poolRateChange >= 0 ? '+' : '') + poolRateChange + '%')
                .removeClass('positive negative')
                .addClass(poolRateChange >= 0 ? 'positive' : 'negative');
            
            $("#currentNetworkRate").text(_formatter(currentNetworkRate, 2, "H/s"));
            $("#currentMiners").text(currentMinersCount);
            $("#minersChange").text((minersChange >= 0 ? '+' : '') + minersChange)
                .removeClass('positive negative')
                .addClass(minersChange >= 0 ? 'positive' : 'negative');
            
            $("#poolShare").text(poolShare + '%');
            
            if (window.chartInstances.statsChart) {
                window.chartInstances.statsChart.destroy();
            }
            
            try {
                window.chartInstances.statsChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Pool Hashrate',
                            data: poolHashRate,
                            borderColor: colors.primary,
                            backgroundColor: createGradient(ctx.getContext('2d'), 
                                colors.primary + '40', 
                                colors.primary + '05'),
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            yAxisID: 'y'
                        }, {
                            label: 'Network Hashrate',
                            data: networkHashRate,
                            borderColor: colors.success,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            yAxisID: 'y'
                        }, {
                            label: 'Active Miners',
                            data: connectedMiners,
                            borderColor: colors.warning,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            yAxisID: 'y1',
                            hidden: isMobile()
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: true,
                                backgroundColor: colors.tooltipBg,
                                titleColor: colors.textPrimary,
                                bodyColor: colors.textSecondary,
                                borderColor: colors.borderColor,
                                borderWidth: 1,
                                padding: 12,
                                callbacks: {
                                    title: function(context) {
                                        return new Date(context[0].parsed.x).toLocaleString();
                                    },
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (context.datasetIndex === 2) {
                                            return label + ': ' + context.parsed.y + ' miners';
                                        }
                                        return label + ': ' + _formatter(context.parsed.y, 2, "H/s");
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                ticks: { color: colors.textSecondary, maxTicksLimit: isMobile() ? 6 : 12 },
                                grid: { color: colors.gridColor }
                            },
                            y: {
                                type: 'linear',
                                position: 'left',
                                beginAtZero: true,
                                ticks: {
                                    color: colors.textSecondary,
                                    callback: function(value) { return _formatter(value, 1, ""); }
                                },
                                grid: { color: colors.gridColor }
                            },
                            y1: {
                                type: 'linear',
                                position: 'right',
                                beginAtZero: true,
                                ticks: { color: colors.textSecondary },
                                grid: { display: false }
                            }
                        }
                    }
                });
            } catch (error) {
                console.error('Error creating stats chart:', error);
            }
        })
        .fail(function(xhr, status, error) {
            console.error("Failed to load stats chart data:", status, error);
        });
}

// Dashboard Page Loader - NOW WITH BEST SHARE
function loadDashboardPage() {
    console.log('Loading dashboard page');
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    clearAllIntervals();
    updateWalletInputPlaceholder();
    
    waitForChartJS(() => {
        if (myPool !== currentPool || myToken !== currentRequestToken) {
            console.log('Dashboard page load cancelled - navigated away');
            return;
        }
        
        var walletQueryString = window.location.hash.split(/[#/?]/)[3];
        var wallet = null;
        
        if (walletQueryString) {
            wallet = walletQueryString.replace("address=", "");
            if (wallet) {
                $("#walletAddress").val(wallet);
                localStorage.setItem(currentPool + "-walletAddress", wallet);
                window.currentDashboardAddress = wallet;
                loadDashboardData(wallet);
            }
        } else if (localStorage[currentPool + "-walletAddress"]) {
            wallet = localStorage[currentPool + "-walletAddress"];
            $("#walletAddress").val(wallet);
            window.currentDashboardAddress = wallet;
            loadDashboardData(wallet);
        }
        
        if (wallet) {
            const refreshInterval = setInterval(() => {
                if (currentPage === 'dashboard' && 
                    myPool === currentPool && 
                    window.currentDashboardAddress === wallet) {
                    console.log('Auto-refreshing dashboard data...');
                    loadDashboardData(wallet);
                }
            }, 60000);
            addInterval(refreshInterval);
        }
    });
}

function updateWalletInputPlaceholder() {
    var placeholder = "Enter your wallet address";
    var helpText = "";
    
    if (currentPool === 'ltc-merged' || currentPool === 'doge-merged') {
        placeholder = "LTC_ADDRESS-DOGE_ADDRESS (e.g., Lxxx...xxx-Dxxx...xxx)";
        helpText = `
            <div class="merged-address-hint" style="
                background: linear-gradient(135deg, rgba(255, 170, 0, 0.15) 0%, rgba(255, 170, 0, 0.05) 100%);
                border: 1px solid rgba(255, 170, 0, 0.3);
                border-radius: 8px;
                padding: 12px 15px;
                margin-bottom: 15px;
                font-size: 13px;
                color: var(--text-secondary);
            ">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <i class="fas fa-info-circle" style="color: #ffaa00; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text-primary);">Merged Mining Address Format</strong><br>
                        For LTC+DOGE merged mining, enter your addresses in this format:<br>
                        <code style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px; color: var(--accent-primary); font-size: 12px;">YOUR_LTC_ADDRESS-YOUR_DOGE_ADDRESS</code>
                    </div>
                </div>
            </div>
        `;
    }
    
    $("#walletAddress").attr("placeholder", placeholder);
    
    $(".merged-address-hint").remove();
    if (helpText) {
        var container = $(".wallet-input-container");
        if (container.length > 0) {
            container.first().prepend(helpText);
        }
    }
}

function loadWallet() {
    var walletAddress = $("#walletAddress").val().trim();
    
    if (!walletAddress) {
        showNotification("Please enter a wallet address", "warning");
        return false;
    }
    
    if (currentPool === 'ltc-merged' || currentPool === 'doge-merged') {
        if (!walletAddress.includes('-')) {
            showNotification("For merged mining, use format: LTC_ADDRESS-DOGE_ADDRESS", "warning");
            return false;
        }
    }
    
    console.log('Loading wallet:', walletAddress);
    clearAllIntervals();
    
    localStorage.setItem(currentPool + "-walletAddress", walletAddress);
    window.currentDashboardAddress = walletAddress;
    
    if (history.pushState) {
        history.pushState(null, null, "#" + currentPool + "/dashboard?address=" + walletAddress);
    } else {
        window.location.hash = currentPool + "/dashboard?address=" + walletAddress;
    }
    
    loadDashboardData(walletAddress);
    
    var myPool = currentPool;
    const refreshInterval = setInterval(() => {
        if (currentPage === 'dashboard' && 
            myPool === currentPool && 
            window.currentDashboardAddress === walletAddress) {
            loadDashboardData(walletAddress);
        }
    }, 60000);
    addInterval(refreshInterval);
    
    return false;
}

// Enhanced Dashboard Data Loader - NOW WITH BEST SHARE
function loadDashboardData(walletAddress, forceRefresh) {
    if (!walletAddress) return;
    
    var endpoint = 'dashboard-' + currentPool + '-' + walletAddress;
    if (!forceRefresh && shouldThrottleRequest(endpoint)) {
        return;
    }
    
    console.log('Loading dashboard data for:', walletAddress);
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    $(".stat-value").html('<i class="fas fa-spinner fa-spin"></i>');
    $(".pending-info-value").html('<i class="fas fa-spinner fa-spin"></i>');
    
    var xhr = $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress)
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) {
                console.log('Ignoring stale dashboard data response');
                return;
            }
            
            $("#pendingShares").text(_formatter(data.pendingShares || 0, 0, ""));
            $("#pendingBalance").text(_formatter(data.pendingBalance || 0, 8, ""));
            $("#pendingBalance2").text(_formatter(data.pendingBalance || 0, 8, ""));
            $("#totalPaid").text(_formatter(data.totalPaid || 0, 8, ""));
            
            var workerCount = 0;
            var totalHashrate = 0;
            
            if (data.performance && data.performance.workers) {
                $.each(data.performance.workers, function(workerId, worker) {
                    workerCount++;
                    totalHashrate += worker.hashrate;
                });
            }
            
            $("#workersOnline").text(workerCount);
            $("#workers-badge").text(workerCount);
            $("#hashrate30m").text(_formatter(totalHashrate, 3, "H/s"));
            $("#hashrate3h").text(_formatter(totalHashrate * 0.95, 3, "H/s"));
            
            // Load miner best share stats
          //  loadMinerBestStats(currentPool, walletAddress);
           // loadPoolBestStats(currentPool);
            
            updateDashboardWorkerList(data);
            loadDashboardChart(walletAddress, '24h');
            loadPaymentsMinerPage(walletAddress);
            loadBlocksMinerPage(walletAddress);
            loadEarningsMinerPage(walletAddress);
            calculateMinerStats(data, walletAddress);
        })
        .fail(function(xhr) {
            console.error("Failed to load dashboard data:", xhr);
            showNotification("Miner not found or no data available", "danger");
            
            $(".stat-value").text("0");
            $(".pending-info-value").text("0");
        });
    
    trackRequest('dashboard-main', xhr);
}

function calculateMinerStats(minerData, walletAddress) {
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    $.ajax(API + "pools")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) return;
            
            if (pool.poolStats.poolHashrate > 0 && minerData.performance) {
                var minerHashrate = 0;
                $.each(minerData.performance.workers, function(id, worker) {
                    minerHashrate += worker.hashrate;
                });
                
                var sharePercent = (minerHashrate / pool.poolStats.poolHashrate) * 100;
                $("#roundShare").text(sharePercent.toFixed(6) + "%");
            }
            
            if (pool.poolEffort !== undefined) {
                $("#poolEffort").text((pool.poolEffort * 100).toFixed(2) + "%");
            }
        });
}

// Enhanced Worker List Display - NOW WITH BEST SHARE COLUMN
function updateDashboardWorkerList(data) {
    console.log('Updating worker list...');
    
    var workerList = "";
    
    if (data && data.performance && data.performance.workers) {
        $.each(data.performance.workers, function(workerId, worker) {
            var isOffline = worker.hashrate === 0;
            var rowClass = isOffline ? "table-danger" : "";
            var lastShare = isOffline ? "offline" : "active";
            var displayWorkerId = workerId || 'default';
            
            if (isMobile() && displayWorkerId.length > 15) {
                displayWorkerId = displayWorkerId.substring(0, 12) + '...';
            }
            
            // Get worker best share if available
            var workerBestHtml = '<span class="text-muted">-</span>';
            if (window.bestShareData.workers && window.bestShareData.workers[workerId]) {
                var workerBest = window.bestShareData.workers[workerId];
                var formattedDiff = formatDifficulty(workerBest.difficulty, 2);
                var timeAgo = getBestShareTimeAgo(workerBest.foundAt);
                workerBestHtml = `
                    <span class="text-success">${formattedDiff}</span>
                    <small class="text-muted d-block">${timeAgo}</small>
                `;
            }
            
            workerList += `
            <tr class="${rowClass}">
                <td data-label="Worker ID"><i class="fas fa-desktop"></i> ${displayWorkerId}</td>
                <td data-label="Hashrate (30m)">${_formatter(worker.hashrate, 3, "H/s")}</td>
                <td data-label="Hashrate (3h)">${_formatter(worker.hashrate * 0.95, 3, "H/s")}</td>
                <td data-label="Best Share" class="worker-best-share">${workerBestHtml}</td>
                <td data-label="Last Share" class="${isOffline ? 'text-danger' : 'text-success'}">${lastShare}</td>
            </tr>`;
        });
    } else {
        workerList = '<tr><td colspan="5" class="text-center text-muted">No workers found</td></tr>';
    }
    
    $("#workerList").html(workerList);
}

// Enhanced Dashboard Chart
function loadDashboardChart(walletAddress, timeframe = '24h') {
    console.log('Loading dashboard chart for wallet:', walletAddress, 'timeframe:', timeframe);
    
    if (!walletAddress) return;
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    let pageSize = 48;
    switch(timeframe) {
        case '7d': pageSize = 336; break;
        case '30d': pageSize = 720; break;
    }
    
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/performance?page=0&pageSize=" + pageSize)
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            const colors = getThemeColors();
            const ctx = document.getElementById('chartDashboardHashRate');
            if (!ctx) return;
            
            if (!data || data.length === 0) {
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-info-circle"></i><p>No data available</p></div>';
                return;
            }
            
            const labels = [];
            const minerHashRate = [];
            const workerData = {};
            
            let skipRate = 1;
            if (timeframe === '7d') skipRate = isMobile() ? 8 : 4;
            if (timeframe === '30d') skipRate = isMobile() ? 16 : 8;
            
            const reversedData = data.slice().reverse();
            
            reversedData.forEach((value, index) => {
                if (index % skipRate === 0) {
                    labels.push(new Date(value.created));
                    
                    let totalHashRate = 0;
                    if (value.workers) {
                        $.each(value.workers, function(workerId, worker) {
                            const workerHashrate = worker.hashrate || 0;
                            totalHashRate += workerHashrate;
                            if (!workerData[workerId]) workerData[workerId] = [];
                            workerData[workerId].push(workerHashrate);
                        });
                    }
                    minerHashRate.push(totalHashRate);
                }
            });
            
            const currentHashrate = minerHashRate[minerHashRate.length - 1] || 0;
            const avgHashrate = minerHashRate.reduce((a, b) => a + b, 0) / minerHashRate.length || 0;
            const peakHashrate = Math.max(...minerHashRate) || 0;
            const activeWorkers = Object.keys(workerData).filter(w => workerData[w][workerData[w].length - 1] > 0).length;
            
            const previousHashrate = minerHashRate[minerHashRate.length - 2] || currentHashrate;
            const hashrateChange = previousHashrate > 0 ? ((currentHashrate - previousHashrate) / previousHashrate * 100).toFixed(1) : 0;
            
            $("#currentHashrateStat").text(_formatter(currentHashrate, 3, "H/s"));
            $("#avgHashrateStat").text(_formatter(avgHashrate, 3, "H/s"));
            $("#peakHashrateStat").text(_formatter(peakHashrate, 3, "H/s"));
            $("#activeWorkersStat").text(activeWorkers);
            $("#hashrateChange").text((hashrateChange >= 0 ? '+' : '') + hashrateChange + '%')
                .removeClass('positive negative')
                .addClass(hashrateChange >= 0 ? 'positive' : 'negative');
            
            if (window.chartInstances.dashboardChart) {
                window.chartInstances.dashboardChart.destroy();
            }
            
            const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.height);
            gradient.addColorStop(0, colors.primary + '40');
            gradient.addColorStop(1, colors.primary + '05');
            
            try {
                window.chartInstances.dashboardChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Hashrate',
                            data: minerHashRate,
                            borderColor: colors.primary,
                            backgroundColor: gradient,
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: colors.tooltipBg,
                                titleColor: colors.textPrimary,
                                bodyColor: colors.textSecondary,
                                borderColor: colors.borderColor,
                                borderWidth: 1,
                                padding: 12,
                                callbacks: {
                                    title: function(context) { return new Date(context[0].parsed.x).toLocaleString(); },
                                    label: function(context) { return 'Hashrate: ' + _formatter(context.parsed.y, 3, "H/s"); }
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                ticks: { color: colors.textSecondary, maxTicksLimit: isMobile() ? 6 : 12 },
                                grid: { color: colors.gridColor }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: colors.textSecondary,
                                    callback: function(value) { return _formatter(value, 1, ""); }
                                },
                                grid: { color: colors.gridColor }
                            }
                        }
                    }
                });
            } catch (error) {
                console.error('Error creating dashboard chart:', error);
            }
        })
        .fail(function(xhr, status, error) {
            console.error("Failed to load dashboard chart:", status, error);
        });
}

// Load Miner Payments
function loadPaymentsMinerPage(walletAddress) {
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    var endpoint = 'payments-miner-' + currentPool + '-' + walletAddress;
    if (shouldThrottleRequest(endpoint)) return Promise.resolve();
    
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/payments?page=0&pageSize=500")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var payoutsList = "";
            calculatePaymentStatistics(data);
            
            if (data.length > 0) {
                var displayPayments = data.slice(0, 50);
                
                $.each(displayPayments, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    
                    var displayAddress = isMobile() 
                        ? value.address.substring(0, 8) + '...' + value.address.substring(value.address.length - 8)
                        : value.address.substring(0, 12) + '...' + value.address.substring(value.address.length - 12);
                    
                    payoutsList += `
                    <tr>
                        <td data-label="Time">${isMobile() ? timeAgo : createDate.toLocaleString()}</td>
                        <td data-label="Amount">${typeof value.amount === 'string' ? value.amount : _formatter(value.amount, 8, "")}</td>
                        <td data-label="Address">${displayAddress}</td>
                        <td data-label="Transaction"><a href="${value.transactionInfoLink}" target="_blank">
                            ${value.transactionConfirmationData.substring(0, isMobile() ? 8 : 16)}...
                        </a></td>
                    </tr>`;
                });
            } else {
                payoutsList = '<tr><td colspan="4" class="text-center text-muted">No payouts yet</td></tr>';
            }
            
            $("#payoutsList").html(payoutsList);
        })
        .fail(function() {
            $("#payoutsList").html('<tr><td colspan="4" class="text-center text-danger">Failed to load payments</td></tr>');
        });
}

function calculatePaymentStatistics(payments) {
    if (!payments || payments.length === 0) {
        $("#todayPaymentTotal").text("0.00000000");
        $("#yesterdayPaymentTotal").text("0.00000000");
        $("#averagePayment7Days").text("0.00000000");
        return;
    }
    
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    var yesterdayEnd = new Date(todayStart);
    var sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    var todayTotal = 0;
    var yesterdayTotal = 0;
    var sevenDayTotal = 0;
    
    payments.forEach(function(payment) {
        var paymentDate = new Date(payment.created);
        var amount = parseFloat(payment.amount);
        
        if (paymentDate >= todayStart) todayTotal += amount;
        if (paymentDate >= yesterdayStart && paymentDate < yesterdayEnd) yesterdayTotal += amount;
        if (paymentDate >= sevenDaysAgo) sevenDayTotal += amount;
    });
    
    var sevenDayAverage = sevenDayTotal / 7;
    
    $("#todayPaymentTotal").text(_formatter(todayTotal, 8, ""));
    $("#yesterdayPaymentTotal").text(_formatter(yesterdayTotal, 8, ""));
    $("#averagePayment7Days").text(_formatter(sevenDayAverage, 8, ""));
}

// Load Miner Blocks
function loadBlocksMinerPage(walletAddress) {
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    var endpoint = 'blocks-miner-' + currentPool + '-' + walletAddress;
    if (shouldThrottleRequest(endpoint)) return Promise.resolve();
    
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/blocks?page=0&pageSize=50")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var blockList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    var effort = Math.round(value.effort * 100);
                    var minerEffort = Math.round(value.minerEffort * 100);
                    var effortClass = effort < 100 ? "text-success" : effort < 200 ? "text-warning" : "text-danger";
                    var progressValue = value.confirmationProgress ? Math.round(value.confirmationProgress * 100) : 0;
                    
                    blockList += `
                    <tr>
                        <td>${timeAgo}</td>
                        <td><a href="${value.infoLink}" target="_blank">${value.blockHeight}</a></td>
                        <td class="${effortClass}">${effort}%</td>
                        <td>${minerEffort}%</td>
                        <td>${_formatter(value.reward, 5, "")}</td>
                        <td>${value.type === "uncle" ? "Uncle" : "Block"}</td>
                        <td>${value.status}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar" style="width: ${progressValue}%">${progressValue}%</div>
                            </div>
                        </td>
                    </tr>`;
                });
            } else {
                blockList = '<tr><td colspan="8" class="text-center text-muted">No blocks found yet</td></tr>';
            }
            
            $("#DashboardBlockList").html(blockList);
        })
        .fail(function() {
            $("#DashboardBlockList").html('<tr><td colspan="8" class="text-center text-danger">Failed to load blocks</td></tr>');
        });
}

// Load Miner Earnings
function loadEarningsMinerPage(walletAddress) {
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    var endpoint = 'earnings-miner-' + currentPool + '-' + walletAddress;
    if (shouldThrottleRequest(endpoint)) return;
    
    $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/balancechanges?page=0&pageSize=999")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var earningsList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    if (index >= 30) return false;
                    
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var description = value.amount > 0 ? value.usage : 
                        (value.usage === "Balance expired" ? "Balance expired" : "Payment sent");
                    var amountClass = value.amount > 0 ? "text-success" : "text-danger";
                    var amountStr = (value.amount < 0 ? "" : "+") + value.amount.toFixed(6);
                    
                    earningsList += `
                    <tr>
                        <td data-label="Date">${createDate.toLocaleDateString()}</td>
                        <td data-label="Description">${description}</td>
                        <td data-label="Amount" class="${amountClass}">${amountStr}</td>
                    </tr>`;
                });
            } else {
                earningsList = '<tr><td colspan="3" class="text-center text-muted">No balance changes yet</td></tr>';
            }
            
            $("#EarningsList").html(earningsList);
        })
        .fail(function() {
            $("#EarningsList").html('<tr><td colspan="3" class="text-center text-danger">Failed to load balance changes</td></tr>');
        });
    
    loadDailyPaymentHistory(walletAddress);
}

// Load Daily Payment History
function loadDailyPaymentHistory(walletAddress) {
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    var endpoint = 'daily-payments-' + currentPool + '-' + walletAddress;
    if (shouldThrottleRequest(endpoint)) return;
    
    $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/payments?page=0&pageSize=999")
        .done(function(payments) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            window.dailyPaymentChartData = payments;
            
            var dailyTotals = {};
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            
            for (let i = 0; i < 30; i++) {
                let date = new Date(today);
                date.setDate(date.getDate() - i);
                dailyTotals[formatDateKey(date)] = 0;
            }
            
            payments.forEach(function(payment) {
                var paymentDate = new Date(payment.created);
                var dateKey = formatDateKey(paymentDate);
                if (dailyTotals.hasOwnProperty(dateKey)) {
                    dailyTotals[dateKey] += parseFloat(payment.amount) || 0;
                }
            });
            
            var chartLabels = [];
            var chartData = [];
            var dailyPaymentList = "";
            var totalPaid30Days = 0;
            var daysWithPayments = 0;
            
            var sortedDates = Object.keys(dailyTotals).sort().reverse();
            
            sortedDates.forEach(function(dateKey, index) {
                var amount = dailyTotals[dateKey];
                var date = parseDate(dateKey);
                var displayDate = date.toLocaleDateString();
                var dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                
                totalPaid30Days += amount;
                if (amount > 0) daysWithPayments++;
                
                if (index < 14) {
                    chartLabels.unshift(isMobile() ? date.getDate().toString() : dayOfWeek);
                    chartData.unshift(amount);
                }
                
                var amountClass = amount > 0 ? "text-success" : "text-muted";
                var rowClass = amount > 0 ? "" : "table-secondary";
                
                dailyPaymentList += `
                <tr class="${rowClass}">
                    <td data-label="Date">${displayDate}</td>
                    <td data-label="Day">${dayOfWeek}</td>
                    <td data-label="Amount" class="${amountClass}">${_formatter(amount, 8, "")}</td>
                    <td data-label="Status">${amount > 0 ? '<span class="text-success">Paid</span>' : '<span class="text-muted">No Payment</span>'}</td>
                </tr>`;
            });
            
            $("#DailyPaymentList").html(dailyPaymentList);
            
            var averageDaily = daysWithPayments > 0 ? totalPaid30Days / daysWithPayments : 0;
            $("#total30Days").text(_formatter(totalPaid30Days, 8, ""));
            $("#average30Days").text(_formatter(averageDaily, 8, ""));
            $("#daysWithPayments").text(daysWithPayments);
            
            createDailyPaymentChart(chartLabels, chartData);
        })
        .fail(function() {
            $("#DailyPaymentList").html('<tr><td colspan="4" class="text-center text-danger">Failed to load daily payment history</td></tr>');
        });
}

function createDailyPaymentChart(labels, data) {
    const colors = getThemeColors();
    const ctx = document.getElementById('chartDailyPayments');
    if (!ctx || !labels || labels.length === 0) return;
    
    if (window.chartInstances.dailyPaymentChart) {
        window.chartInstances.dailyPaymentChart.destroy();
    }
    
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.height);
    gradient.addColorStop(0, colors.success + '80');
    gradient.addColorStop(1, colors.success + '20');
    
    try {
        window.chartInstances.dailyPaymentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Payment',
                    data: data,
                    backgroundColor: gradient,
                    borderColor: colors.success,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.textPrimary,
                        bodyColor: colors.textSecondary,
                        borderColor: colors.borderColor,
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) { return 'Payment: ' + _formatter(context.parsed.y, 8, ""); }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: colors.textSecondary }, grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: colors.textSecondary, callback: function(v) { return _formatter(v, 2, ""); } },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating daily payment chart:', error);
    }
}

function formatDateKey(date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
}

function parseDate(dateKey) {
    var parts = dateKey.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// Load Miners Page - NOW WITH BEST SHARE LEADERBOARD
function loadMinersPage() {
    console.log('Loading miners page');
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    // Load regular miners list
    $.ajax(API + "pools/" + currentPool + "/miners?page=0&pagesize=20")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var minerList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    var displayAddress = isMobile() 
                        ? value.miner.substring(0, 8) + '...' + value.miner.substring(value.miner.length - 8)
                        : value.miner;
                    
                    minerList += `
                    <tr>
                        <td data-label="Address">
                            <a href="#${currentPool}/dashboard?address=${value.miner}" class="text-info">
                                <i class="fas fa-user"></i> ${displayAddress}
                            </a>
                        </td>
                        <td data-label="Hashrate">${_formatter(value.hashrate, 2, "H/s")}</td>
                        <td data-label="Share Rate">${_formatter(value.sharesPerSecond, 2, "S/s")}</td>
                        <td data-label="Best Share" class="miner-best-share">-</td>
                    </tr>`;
                });
            } else {
                minerList = '<tr><td colspan="4" class="text-center text-muted">No miners connected</td></tr>';
            }
            
            $("#minerList").html(minerList);
        })
        .fail(function() {
            showNotification("Failed to load miners list", "danger");
        });
    
    // Load best share leaderboard
    loadBestShareLeaderboard(currentPool, 20);
}

// Load Blocks Page
async function loadBlocksEffortTable() {
    try {
        const data = await $.ajax(API + "pools");
        const poolsResponse = data.pools.find(pool => currentPool === pool.id);
        if (!poolsResponse) throw new Error("Pool not found");
        
        var totalBlocks = poolsResponse.totalBlocks;
        var poolEffort = (poolsResponse.poolEffort * 100).toFixed(2);
        const PoolblocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=" + totalBlocks);
        
        var effortsum = 0;
        var uncleblocks = 0;
        var orphanedblocks = 0;
        
        for (let i = 0; i < PoolblocksResponse.length; i++) {
            const currentBlock = PoolblocksResponse[i];
            if (typeof currentBlock.effort !== "undefined") {
                effortsum += Math.round(currentBlock.effort * 100);
            }
            if (currentBlock.status === "orphaned") orphanedblocks++;
            if (currentBlock.type === "uncle") uncleblocks++;
        }

        effortsum = Math.round(effortsum / totalBlocks);
        uncleblocks = ((uncleblocks / totalBlocks) * 100).toFixed(2);
        orphanedblocks = ((orphanedblocks / totalBlocks) * 100).toFixed(2);

        $("#CurrentEffort").html(poolEffort + " %");
        $("#AverageEffort").html(effortsum + " %");
        $("#AverageUncleRate").html(uncleblocks + " %");
        $("#AverageOrphanedRate").html(orphanedblocks + " %");
        
    } catch (error) {
        console.error("Error loading blocks effort table:", error);
    }
}

function loadBlocksPage() {
    console.log('Loading blocks page');
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    loadBlocksEffortTable();
    loadBlocksStats();
    
    return $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=100")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var blockList = "";
            var newBlockList = "";
            var newBlockCount = 0;
            var pendingBlockList = "";
            var pendingBlockCount = 0;
            var confirmedBlockCount = 0;
            
            if (data.length > 0) {
                data.sort((a, b) => new Date(b.created) - new Date(a.created));
                
                $.each(data, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    var effort = Math.round(value.effort * 100);
                    var effortClass = effort < 100 ? "text-success" : effort < 200 ? "text-warning" : "text-danger";
                    
                    var displayMiner = isMobile()
                        ? value.miner.substring(0, 6) + '...' + value.miner.substring(value.miner.length - 6)
                        : value.miner.substring(0, 8) + '...' + value.miner.substring(value.miner.length - 8);
                    
                    var status = value.status;
                    var blockTable = "<tr>";
                    blockTable += "<td><div title='" + createDate + "'>" + timeAgo + "</div></td>";
                    blockTable += '<td><a href="#' + currentPool + '/dashboard?address=' + value.miner + '" class="text-info">' + displayMiner + '</a></td>';
                    blockTable += "<td><a href='" + value.infoLink + "' target='_blank'>" + value.blockHeight.toLocaleString() + "</a></td>";
                    blockTable += "<td>" + _formatter(value.networkDifficulty, 6, "") + "</td>";
                    blockTable += "<td class='" + effortClass + "'>" + (value.effort !== undefined ? effort + "%" : "Calculating...") + "</td>";
                    
                    blockTable += "<td>";
                    if (status === "pending") {
                        if (value.confirmationProgress === 0) {
                            blockTable += "New Block";
                            newBlockCount++;
                        } else {
                            blockTable += "Pending";
                            pendingBlockCount++;
                        }
                    } else if (status === "confirmed") {
                        blockTable += "Confirmed";
                        confirmedBlockCount++;
                    } else if (status === "orphaned") {
                        blockTable += "Orphaned";
                    } else {
                        blockTable += status;
                    }
                    blockTable += "</td>";
                    
                    blockTable += "<td>" + (status === "pending" && value.confirmationProgress === 0 ? "Waiting..." : _formatter(value.reward, 6, "")) + "</td>";
                    blockTable += "<td>" + (value.type === "uncle" ? "Uncle" : status === "orphaned" ? "Orphaned" : "Block") + "</td>";
                    
                    var progressValue = Math.round(value.confirmationProgress * 100);
                    blockTable += '<td><div class="progress" style="min-width: ' + (isMobile() ? '60px' : '100px') + ';">';
                    blockTable += '<div class="progress-bar" style="width: ' + progressValue + '%">' + progressValue + '%</div></div></td>';
                    blockTable += "</tr>";
                    
                    if (status === "pending") {
                        if (value.confirmationProgress === 0) newBlockList += blockTable;
                        else pendingBlockList += blockTable;
                    } else {
                        blockList += blockTable;
                    }
                });
            } else {
                blockList = '<tr><td colspan="9" class="text-center text-muted">No blocks found yet</td></tr>';
            }
            
            $("#blockList").html(blockList);
            $("#newBlockList").html(newBlockList || '<tr><td colspan="9" class="text-center text-muted">No new blocks</td></tr>');
            $("#pendingBlockList").html(pendingBlockList || '<tr><td colspan="9" class="text-center text-muted">No pending blocks</td></tr>');
            
            $("#newBlockCount").text(newBlockCount);
            $("#pendingBlockCount").text(pendingBlockCount);
            $("#confirmedBlockCount").text(confirmedBlockCount);
            $("#nav-blocks-badge").text(newBlockCount + pendingBlockCount + confirmedBlockCount);
        })
        .fail(function() {
            showNotification("Failed to load blocks", "danger");
        });
}

function loadBlocksStats() {
    $.ajax(API + "pools")
        .done(function(data) {
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) return;
            
            var coinSymbol = pool.coin.symbol || getCoinSymbol(pool.coin.type);
            
            $("#poolBlocks2").text(pool.totalBlocks.toLocaleString());
            $("#totalPaid2").html(pool.totalPaid.toLocaleString() + " " + coinSymbol);
            
            $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=1")
                .done(function(blocks) {
                    if (blocks.length > 0) {
                        var reward = blocks[0].reward;
                        $("#blockreward").text(_formatter(reward, 6, "") + " " + coinSymbol);
                        getCoinValue(pool, reward);
                    }
                });
        });
}

function getCoinValue(poolOrCoinType, reward) {
    var coinSymbol = typeof poolOrCoinType === 'object' 
        ? (poolOrCoinType.coin.symbol || getCoinSymbol(poolOrCoinType.coin.type))
        : getCoinSymbol(poolOrCoinType);
    
    var coinGeckoIds = {
        'BTC': 'bitcoin', 'BCH': 'bitcoin-cash', 'BC2': 'bitcoinii',
        'LTC': 'litecoin', 'DOGE': 'dogecoin', 'ETC': 'ethereum-classic',
        'KAS': 'kaspa', 'WART': 'warthog', 'XEL': 'xelis', 'LOG': 'woodcoin'
    };
    
    var geckoId = coinGeckoIds[coinSymbol];
    
    if (geckoId) {
        $.ajax("https://api.coingecko.com/api/v3/simple/price?ids=" + geckoId + "&vs_currencies=usd")
            .done(function(data) {
                if (data && data[geckoId] && data[geckoId].usd) {
                    updateCoinValue(data[geckoId].usd, reward);
                } else {
                    updateCoinValue(0, reward);
                }
            })
            .fail(function() { updateCoinValue(0, reward); });
    } else {
        updateCoinValue(0, reward);
    }
}

function updateCoinValue(price, reward) {
    if (price > 0) {
        $("#coinvalue").html(
            "Coin Price: " + _formatter(price, 6, "USD") + "<br>" +
            "Block Value: " + _formatter(price * reward, 2, "USD")
        );
    } else {
        $("#coinvalue").html("Coin Price: Not Available");
    }
}

// Load Payments Page
function loadPaymentsPage() {
    console.log('Loading payments page');
    
    var myPool = currentPool;
    var myToken = currentRequestToken;
    
    return $.ajax(API + "pools/" + currentPool + "/payments?page=0&pageSize=50")
        .done(function(data) {
            if (myPool !== currentPool || myToken !== currentRequestToken) return;
            
            var paymentList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    
                    var displayAddress = isMobile()
                        ? value.address.substring(0, 8) + '...' + value.address.substring(value.address.length - 8)
                        : value.address.substring(0, 12) + '...' + value.address.substring(value.address.length - 12);
                    
                    paymentList += `
                    <tr>
                        <td data-label="Time" title="${createDate.toLocaleString()}">${timeAgo}</td>
                        <td data-label="Address"><a href="${value.addressInfoLink}" target="_blank">${displayAddress}</a></td>
                        <td data-label="Amount">${typeof value.amount === 'string' ? value.amount : _formatter(value.amount, 6, "")}</td>
                        <td data-label="Transaction"><a href="${value.transactionInfoLink}" target="_blank">${value.transactionConfirmationData.substring(0, isMobile() ? 8 : 16)}...</a></td>
                    </tr>`;
                });
            } else {
                paymentList = '<tr><td colspan="4" class="text-center text-muted">No payments found yet</td></tr>';
            }
            
            $("#paymentList").html(paymentList);
        })
        .fail(function() {
            showNotification("Failed to load payments", "danger");
        });
}

// Load Connect Page
function loadConnectPage() {
    console.log('Loading connect page');
    
    return $.ajax(API + "pools")
        .done(function(data) {
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) return;
            
            var coinName = pool.coin.canonicalName || pool.coin.name || pool.coin.type;
            var coinSymbol = pool.coin.symbol || getCoinSymbol(pool.coin.type);
            
            var connectConfig = "";
            connectConfig += `<tr><td><strong>Coin</strong></td><td>${coinName} (${coinSymbol})</td></tr>`;
            connectConfig += `<tr><td><strong>Algorithm</strong></td><td>${pool.coin.algorithm}</td></tr>`;
            if (pool.coin.website) {
                connectConfig += `<tr><td><strong>Website</strong></td><td><a href="${pool.coin.website}" target="_blank">${pool.coin.website}</a></td></tr>`;
            }
            
            var displayPoolAddress = isMobile()
                ? pool.address.substring(0, 8) + '...' + pool.address.substring(pool.address.length - 8)
                : pool.address.substring(0, 12) + '...' + pool.address.substring(pool.address.length - 12);
            
            connectConfig += `<tr><td><strong>Pool Wallet</strong></td><td><a href="${pool.addressInfoLink}" target="_blank">${displayPoolAddress}</a></td></tr>`;
            connectConfig += `<tr><td><strong>Payout Scheme</strong></td><td>${pool.paymentProcessing.payoutScheme}</td></tr>`;
            connectConfig += `<tr><td><strong>Minimum Payment</strong></td><td>${pool.paymentProcessing.minimumPayment} ${coinSymbol}</td></tr>`;
            connectConfig += `<tr><td><strong>Pool Fee</strong></td><td>${pool.poolFeePercent}%</td></tr>`;
            
            $("#connectPoolConfig").html(connectConfig);
            populateStratumServersTable(pool);
        })
        .fail(function() {
            showNotification("Failed to load pool configuration", "danger");
        });
}

function populateStratumServersTable(pool) {
    var serversList = "";
    var stratum = pool.coin.family === "ethereum" ? "stratum2" : "stratum";
    
    servers.forEach(server => {
        var regionFlag = getRegionFlag(server.region);
        var displayName = isMobile() ? server.location : server.name;
        
        var portsInfo = "";
        var sslAvailable = false;
        
        Object.entries(pool.ports).forEach(([port, options], index) => {
            if (index > 0) portsInfo += "<br>";
            portsInfo += `<strong>${port}</strong>: ${options.name || "Diff " + options.difficulty}`;
            if (options.varDiff) portsInfo += ` (VarDiff)`;
            if (options.tls) sslAvailable = true;
        });
        
        var primaryPort = Object.keys(pool.ports)[0];
        var stratumUrl = `${stratum}+tcp://${server.host}:${primaryPort}`;
        
        serversList += `
            <tr>
                <td data-label="Server Location">${regionFlag} <strong>${displayName}</strong></td>
                <td data-label="Stratum URL"><code style="font-size: 12px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">${stratumUrl}</code></td>
                <td data-label="Ports"><small>${portsInfo}</small></td>
                <td data-label="SSL">${sslAvailable ? '<span class="text-success"><i class="fas fa-check-circle"></i></span>' : '<span class="text-muted"><i class="fas fa-times-circle"></i></span>'}</td>
            </tr>
        `;
    });
    
    $("#stratumServersList").html(serversList);
}

// Utility Functions
function getCoinSymbol(coinTypeOrPool) {
    if (typeof coinTypeOrPool === 'object' && coinTypeOrPool.coin && coinTypeOrPool.coin.symbol) {
        return coinTypeOrPool.coin.symbol.toUpperCase();
    }
    
    if (typeof coinTypeOrPool === 'string') {
        const coinsWithNumbers = ['BC2', 'BTC2', 'ETH2', 'BCH2'];
        if (coinsWithNumbers.includes(coinTypeOrPool.toUpperCase())) {
            return coinTypeOrPool.toUpperCase();
        }
        return coinTypeOrPool.replace(/\d+$/, '').toUpperCase();
    }
    
    return '';
}

function _formatter(value, decimal, unit) {
    if (value === 0) return "0 " + unit;
    
    var si = [
        { value: 1, symbol: "" },
        { value: 1e3, symbol: "k" },
        { value: 1e6, symbol: "M" },
        { value: 1e9, symbol: "G" },
        { value: 1e12, symbol: "T" },
        { value: 1e15, symbol: "P" },
        { value: 1e18, symbol: "E" }
    ];
    
    for (var i = si.length - 1; i > 0; i--) {
        if (value >= si[i].value) break;
    }
    
    return ((value / si[i].value).toFixed(decimal).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + " " + si[i].symbol + unit);
}

function convertUTCDateToLocalDate(date) {
    var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    var offset = date.getTimezoneOffset() / 60;
    newDate.setHours(date.getUTCHours() - offset);
    return newDate;
}

function getTimeAgo(date) {
    var now = new Date();
    var diff = now - date;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    
    if (days > 30) return Math.floor(days / 30) + (isMobile() ? "mo" : " months") + " ago";
    if (days >= 1) return days + (isMobile() ? "d" : " day" + (days > 1 ? "s" : "")) + " ago";
    if (hours >= 1) return hours + (isMobile() ? "h" : " hour" + (hours > 1 ? "s" : "")) + " ago";
    if (minutes >= 1) return minutes + (isMobile() ? "m" : " min" + (minutes > 1 ? "s" : "")) + " ago";
    if (seconds >= 1) return seconds + (isMobile() ? "s" : " sec" + (seconds > 1 ? "s" : "")) + " ago";
    return "just now";
}

function showNotification(message, type = "info") {
    var icon = { info: "fa-info-circle", success: "fa-check-circle", warning: "fa-exclamation-triangle", danger: "fa-times-circle" }[type] || "fa-info-circle";
    
    var notification = $(`
        <div class="alert alert-${type} alert-dismissible fade show" role="alert" 
             style="position: fixed; top: ${isMobile() ? '70px' : '80px'}; right: ${isMobile() ? '10px' : '20px'}; 
                    z-index: 9999; min-width: ${isMobile() ? 'calc(100% - 20px)' : '300px'}; animation: fadeIn 0.3s;">
            <i class="fas ${icon}"></i> ${message}
            <button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>
        </div>
    `);
    
    $('body').append(notification);
    setTimeout(function() { notification.fadeOut(function() { $(this).remove(); }); }, 5000);
}

function scrollPageTop() {
    $('html, body').animate({ scrollTop: 0 }, 300);
}

// Server Ping System
var servers = [
    { name: "EU United Kingdom (GB)", host: "meowpool.net", region: "EU", location: "UK" },


];

var serverPingResults = {};
var bestServer = null;

function initServerPingMonitoring() {
    if (window.location.hash && window.location.hash !== '#' && !window.location.hash.includes('index')) return;
    if (pingMonitoringInitialized) return;
    if (!document.getElementById('serverPingList')) {
        setTimeout(initServerPingMonitoring, 1000);
        return;
    }
    
    pingMonitoringInitialized = true;
    console.log('Initializing server ping monitoring...');
    
    servers.forEach(server => {
        serverPingResults[server.host] = {
            name: server.name, host: server.host, region: server.region,
            location: server.location, ping: -1, status: 'connecting', lastUpdate: null
        };
    });
    
    updateServerPingTable();
    setTimeout(pingAllServers, 500);
    
    if (activePingInterval) clearInterval(activePingInterval);
    activePingInterval = setInterval(pingAllServers, 10000);
}

function pingServer(server) {
    return new Promise((resolve) => {
        const measurements = [];
        let completed = 0;
        const timeout = isMobile() ? 8000 : 5000;
        const attempts = isMobile() ? 2 : 3;

        function takeMeasurement(attemptNum) {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            fetch(`https://${server.host}/p?_=${Date.now()}&attempt=${attemptNum}`, {
                method: 'GET', mode: 'cors', cache: 'no-cache', signal: controller.signal
            })
            .then(response => {
                clearTimeout(timeoutId);
                measurements.push(Math.round(performance.now() - startTime));
                completed++;
                if (completed === attempts) {
                    resolve({
                        server: server,
                        ping: Math.min(...measurements),
                        avgPing: Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length),
                        status: 'online',
                        measurements: measurements
                    });
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                completed++;
                if (completed === attempts) {
                    if (measurements.length > 0) {
                        resolve({
                            server: server, ping: Math.min(...measurements),
                            avgPing: Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length),
                            status: 'degraded', measurements: measurements
                        });
                    } else {
                        resolve({ server: server, ping: -1, avgPing: -1, status: 'offline', measurements: [] });
                    }
                }
            });
        }

        takeMeasurement(1);
        if (!isMobile()) {
            setTimeout(() => takeMeasurement(2), 100);
            if (attempts > 2) setTimeout(() => takeMeasurement(3), 200);
        } else {
            setTimeout(() => takeMeasurement(2), 200);
        }
    });
}

async function pingAllServers() {
    try {
        const results = await Promise.all(servers.map(server => pingServer(server)));
        
        results.forEach(result => {
            serverPingResults[result.server.host] = {
                name: result.server.name, host: result.server.host,
                region: result.server.region, location: result.server.location,
                ping: result.ping, avgPing: result.avgPing, status: result.status,
                lastUpdate: Date.now(), measurements: result.measurements
            };
        });
        
        const onlineServers = results.filter(r => r.status === 'online' || r.status === 'degraded');
        if (onlineServers.length > 0) {
            bestServer = onlineServers.reduce((best, current) => 
                (current.ping < best.ping && current.ping > 0) ? current : best);
        }
        
        updateServerPingTable();
    } catch (error) {
        console.error('Error pinging servers:', error);
    }
}

function updateServerPingTable() {
    const tbody = document.getElementById('serverPingList');
    if (!tbody) return;
    
    const sortedServers = Object.values(serverPingResults).sort((a, b) => {
        if (a.status === 'offline' && b.status !== 'offline') return 1;
        if (a.status !== 'offline' && b.status === 'offline') return -1;
        if (a.ping > 0 && b.ping > 0) return a.ping - b.ping;
        if (a.ping > 0) return -1;
        if (b.ping > 0) return 1;
        return 0;
    });
    
    let tableHTML = '';
    sortedServers.forEach((server, index) => {
        const isOnline = server.status !== 'offline';
        const rank = isOnline ? index + 1 : '-';
        const isBest = isOnline && rank === 1;
        const regionFlag = getRegionFlag(server.region);
        const pingDisplay = server.ping > 0 ? `${server.ping}ms` : '-';
        const statusIcon = getStatusIcon(server.status);
        const statusClass = getStatusClass(server.status);
        const displayName = isMobile() ? server.location : server.name;
        
        tableHTML += `
            <tr class="${isBest ? 'best-server' : ''}" style="animation: fadeIn 0.5s ease-out;">
                <td><div class="rank-badge ${isBest ? 'rank-best' : ''}">${rank}</div></td>
                <td><strong>${displayName}</strong>${isBest && !isMobile() ? '<span class="badge badge-success ml-2"><i class="fas fa-bolt"></i> FASTEST</span>' : ''}</td>
                <td>${regionFlag} ${isMobile() ? '' : server.location}</td>
                <td class="ping-cell"><span class="${statusClass}">${pingDisplay}</span></td>
                <td><span class="status-indicator ${statusClass}">${statusIcon} ${isMobile() ? '' : server.status.toUpperCase()}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = tableHTML || '<tr><td colspan="5" class="text-center text-muted">No server data</td></tr>';
}

function getRegionFlag(region) {
    const flags = { 'us': '🇺🇸', 'singapore': '🇸🇬', 'oceania': '🇦🇺', 'france': '🇫🇷', 'china': '🇨🇳', 'uk': '🇬🇧', 'japan': '🇯🇵' };
    return flags[region] || '🌍';
}

function getStatusIcon(status) {
    switch(status) {
        case 'online': return '<i class="fas fa-check-circle"></i>';
        case 'degraded': return '<i class="fas fa-exclamation-triangle"></i>';
        case 'offline': return '<i class="fas fa-times-circle"></i>';
        case 'connecting': return '<i class="fas fa-spinner fa-spin"></i>';
        default: return '';
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'online': return 'status-online text-success';
        case 'degraded': return 'status-degraded text-warning';
        case 'offline': return 'status-offline text-danger';
        case 'connecting': return 'status-connecting text-info';
        default: return '';
    }
}

function stopPingMonitoring() {
    pingMonitoringInitialized = false;
    blocksMonitoringInitialized = false;
    if (activePingInterval) {
        clearInterval(activePingInterval);
        activePingInterval = null;
    }
}

// Visibility change handler
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        clearAllIntervals();
        stopPingMonitoring();
    } else {
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#index') {
            initServerPingMonitoring();
            initRecentBlocksMonitoring();
        }
        loadIndex();
    }
});

// Document ready
$(document).ready(function() {
    console.log('Document ready - loading page');
    
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
    } else {
        console.log('Chart.js version:', Chart.version);
    }
    
    loadIndex();
    
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            Object.values(window.chartInstances).forEach(chart => { if (chart) chart.resize(); });
        }, 500);
    });
    
    if (window.location.search.includes('debug=true')) {
        window.debugMode = true;
    }
});

// Hash change handler
$(window).on('hashchange', function() {
    const hash = window.location.hash;
    
    if (hash && hash !== '#' && hash !== '#index') {
        stopPingMonitoring();
        if (recentBlocksInterval) {
            clearInterval(recentBlocksInterval);
            recentBlocksInterval = null;
        }
    }
    
    loadIndex();
});

// Cleanup on unload
$(window).on('beforeunload', function() {
    clearAllIntervals();
    stopPingMonitoring();
});

// Export functions
window.miningCore = {
    loadIndex,
    loadWallet,
    showNotification,
    _formatter,
    formatDifficulty,
    getCoinSymbol,
    loadAllCoinPrices,
    loadBestShareLeaderboard,
    isMobile,
    isTouchDevice
};
