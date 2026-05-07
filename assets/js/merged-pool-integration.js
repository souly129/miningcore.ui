/*!
 * Merged Mining Pool Enhancements for MiningCore WebUI
 * Adds visual styling and custom connect page for LTC+DOGE merged mining
 * Data is served by the API Gateway - this just enhances the display
 * Version 4.0
 */

// ============================================================
// CONFIGURATION
// ============================================================
var MERGED_PORT = 3643;
var MERGED_HOST = window.location.hostname;

var MERGED_POOLS = {
    'ltc-merged': {
        id: 'ltc-merged',
        coin: 'Litecoin',
        symbol: 'LTC',
        type: 'litecoin',
        algorithm: 'Scrypt',
        mergedWith: 'DOGE',
        minPayout: 0.01,
        fee: 1.0
    },
    'doge-merged': {
        id: 'doge-merged',
        coin: 'Dogecoin',
        symbol: 'DOGE',
        type: 'dogecoin',
        algorithm: 'Scrypt',
        mergedWith: 'LTC',
        minPayout: 50,
        fee: 1.0
    }
};

window.isMergedPool = function(id) { 
    return id === 'ltc-merged' || id === 'doge-merged'; 
};

// ============================================================
// INJECT CSS - Glow effect and MERGED badge
// ============================================================
var mergedStyles = `
<style>
/* MERGED Badge - positioned below the PPLNS/SOLO tag */
.merged-mining-badge {
    position: absolute;
    top: 40px;
    right: 12px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    animation: pulse-merged 2s infinite;
}

.merged-mining-badge i {
    font-size: 10px;
}

@keyframes pulse-merged {
    0%, 100% { box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4); }
    50% { box-shadow: 0 2px 15px rgba(102, 126, 234, 0.7); }
}

/* Glowing border for merged pool cards */
.pool-card.merged-pool-card {
    position: relative;
    border: 2px solid transparent;
    background: linear-gradient(var(--card-bg, #1a1a2e), var(--card-bg, #1a1a2e)) padding-box,
                linear-gradient(135deg, #667eea 0%, #764ba2 100%) border-box;
}

.pool-card.merged-pool-card:hover {
    box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);
    transform: translateY(-5px) scale(1.02);
}

.pool-card.merged-pool-card .pool-card-header {
    padding-right: 90px;
}

/* Connect page styles */
.merged-connect-page {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.merged-connect-page .connect-header {
    text-align: center;
    margin-bottom: 30px;
}

.merged-connect-page .connect-header h2 {
    color: var(--accent-primary, #667eea);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
}

.merged-connect-page h3, 
.merged-connect-page h4 {
    color: var(--accent-primary, #667eea);
    margin-top: 20px;
    margin-bottom: 12px;
}

.merged-connect-page code {
    background: var(--bg-primary, #0f0f1a);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--accent-primary, #667eea);
}

.merged-connect-page .command-box {
    background: var(--bg-primary, #0f0f1a);
    border: 1px solid var(--border-color, #2a2a4a);
    border-radius: 8px;
    padding: 12px 15px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    color: var(--text-primary, #e0e0e0);
    margin: 10px 0;
    word-break: break-all;
    position: relative;
}

.merged-connect-page .info-box {
    background: rgba(102, 126, 234, 0.1);
    border: 1px solid rgba(102, 126, 234, 0.3);
    border-radius: 8px;
    padding: 15px;
    margin: 15px 0;
}

.merged-connect-page .info-box ul {
    margin: 10px 0 0 0;
    padding-left: 20px;
}

.merged-connect-page .info-box li {
    margin: 5px 0;
    color: var(--text-secondary, #a0a0a0);
}
</style>
`;

// Inject styles
if (document.head) {
    document.head.insertAdjacentHTML('beforeend', mergedStyles);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        document.head.insertAdjacentHTML('beforeend', mergedStyles);
    });
}

// ============================================================
// ENHANCE POOL CARDS - Add badge and glow to merged pools
// ============================================================
function enhanceMergedPoolCards() {
    document.querySelectorAll('.pool-card').forEach(function(card) {
        var href = card.getAttribute('href') || '';
        var poolId = href.replace('#', '').split('/')[0];
        
        if (isMergedPool(poolId) && !card.classList.contains('merged-pool-card')) {
            // Add glow class
            card.classList.add('merged-pool-card');
            
            // Add MERGED badge if not already present
            if (!card.querySelector('.merged-mining-badge')) {
                var badge = document.createElement('div');
                badge.className = 'merged-mining-badge';
                badge.innerHTML = '<i class="fas fa-link"></i> MERGED';
                card.insertBefore(badge, card.firstChild);
            }
        }
    });
}

// ============================================================
// CUSTOM CONNECT PAGE FOR MERGED POOLS
// ============================================================
function showMergedConnectPage(poolId) {
    var pool = MERGED_POOLS[poolId];
    if (!pool) return false;
    
    var $content = document.querySelector('.pool-content, #pool-stats-content, .pool-stats-content, #main-content, .main-content, main, .content-wrapper');
    if (!$content) return false;
    
    var html = `
    <div class="merged-connect-page">
        <div class="connect-header">
            <h2>
                <img src="img/coin/icon/${pool.type}.png" onerror="this.src='img/coin/icon/default.png'" style="width:48px;height:48px;">
                ${pool.coin} + ${pool.mergedWith} Merged Mining
            </h2>
            <p style="color:var(--text-secondary);margin-top:10px;">Mine both coins simultaneously with a single connection</p>
        </div>
        
        <!-- Connection Info -->
        <div class="stats-grid" style="margin-bottom:25px;">
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-server"></i> Stratum URL</div>
                <div class="stat-value" style="font-size:14px;word-break:break-all;">stratum+tcp://${MERGED_HOST}:${MERGED_PORT}</div>
                <button class="btn btn-primary" style="margin-top:10px;font-size:12px;" onclick="navigator.clipboard.writeText('stratum+tcp://${MERGED_HOST}:${MERGED_PORT}');this.textContent='Copied!';">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-microchip"></i> Algorithm</div>
                <div class="stat-value">${pool.algorithm}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-percentage"></i> Pool Fee</div>
                <div class="stat-value green">${pool.fee}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-coins"></i> Min Payout LTC</div>
                <div class="stat-value">${MERGED_POOLS['ltc-merged'].minPayout} LTC</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-dog"></i> Min Payout DOGE</div>
                <div class="stat-value">${MERGED_POOLS['doge-merged'].minPayout} DOGE</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-clock"></i> Payout Scheme</div>
                <div class="stat-value">PPLNS</div>
            </div>
        </div>
        
        <!-- Worker Format -->
        <div class="help-card">
            <h3><i class="fas fa-key"></i> Worker Username Format</h3>
            <div class="info-box">
                <p><strong>Important:</strong> You must provide BOTH addresses separated by a dash (-)</p>
                <p>Worker name is optional but recommended for tracking multiple rigs.</p>
            </div>
            <p><strong>Format:</strong></p>
            <div class="command-box">LTC_ADDRESS-DOGE_ADDRESS.WORKER_NAME</div>
            <p><strong>Example:</strong></p>
            <div class="command-box">LUKrq9Mg1PsU65aG5ZTEXKEbXRBzkzviTY-D9sxBWHdujQoACSDBTLuuDPkcBwe9TFtXr.rig1</div>
        </div>
        
        <!-- Miner Configs -->
        <div class="help-card">
            <h3><i class="fas fa-cog"></i> Miner Configuration Examples</h3>
            
            <h4>BZMiner</h4>
            <div class="command-box">bzminer -a scrypt -w LTC_ADDRESS-DOGE_ADDRESS.rig1 -p stratum+tcp://${MERGED_HOST}:${MERGED_PORT}</div>
            
            <h4>lolMiner</h4>
            <div class="command-box">lolminer --algo SCRYPT --pool ${MERGED_HOST}:${MERGED_PORT} --user LTC_ADDRESS-DOGE_ADDRESS.rig1</div>
            
            <h4>SRBMiner-Multi</h4>
            <div class="command-box">SRBMiner-MULTI --algorithm scrypt --pool stratum+tcp://${MERGED_HOST}:${MERGED_PORT} --wallet LTC_ADDRESS-DOGE_ADDRESS.rig1</div>
            
            <h4>Antminer L7 / L9</h4>
            <div class="data-table" style="margin:15px 0;">
                <table>
                    <tr><td style="width:120px;font-weight:700;color:var(--text-secondary);">URL:</td><td>stratum+tcp://${MERGED_HOST}:${MERGED_PORT}</td></tr>
                    <tr><td style="font-weight:700;color:var(--text-secondary);">Worker:</td><td>LTC_ADDRESS-DOGE_ADDRESS.rig1</td></tr>
                    <tr><td style="font-weight:700;color:var(--text-secondary);">Password:</td><td>x</td></tr>
                </table>
            </div>
            
            <h4>NiceHash / ASIC Hub</h4>
            <div class="data-table" style="margin:15px 0;">
                <table>
                    <tr><td style="width:120px;font-weight:700;color:var(--text-secondary);">Pool Address:</td><td>${MERGED_HOST}</td></tr>
                    <tr><td style="font-weight:700;color:var(--text-secondary);">Port:</td><td>${MERGED_PORT}</td></tr>
                    <tr><td style="font-weight:700;color:var(--text-secondary);">Username:</td><td>LTC_ADDRESS-DOGE_ADDRESS</td></tr>
                    <tr><td style="font-weight:700;color:var(--text-secondary);">Password:</td><td>x</td></tr>
                </table>
            </div>
        </div>
        
        <!-- Notes -->
        <div class="info-box">
            <h4 style="margin:0 0 10px 0;"><i class="fas fa-lightbulb"></i> Notes</h4>
            <ul>
                <li>Both LTC and DOGE addresses are <strong>required</strong> for merged mining.</li>
                <li>You will receive payouts in <strong>both</strong> LTC and DOGE simultaneously.</li>
                <li>Worker name is optional but recommended for tracking multiple rigs.</li>
                <li>Password can be anything (commonly <code>x</code>).</li>
                <li>Difficulty adjustment is automatic - vardiff enabled.</li>
            </ul>
        </div>
    </div>
    `;
    
    $content.innerHTML = html;
    $content.style.display = 'block';
    return true;
}

// ============================================================
// INTERCEPT NAVIGATION FOR MERGED POOL CONNECT PAGES
// ============================================================
function handleMergedNavigation() {
    var hash = window.location.hash.replace('#', '');
    var parts = hash.split('/');
    var poolId = parts[0];
    var page = parts[1] || '';
    
    // Only intercept connect page for merged pools
    if (isMergedPool(poolId) && page === 'connect') {
        // Small delay to let miningcore.js do its thing first, then override
        setTimeout(function() {
            showMergedConnectPage(poolId);
        }, 100);
        return true;
    }
    return false;
}

// ============================================================
// INITIALIZATION
// ============================================================
(function() {
    // Run on DOM ready
    function init() {
        console.log('[MergedPool] Enhancement script loaded v4.0');
        
        // Initial enhancement
        setTimeout(enhanceMergedPoolCards, 500);
        
        // Watch for dynamic content changes (MutationObserver)
        var observer = new MutationObserver(function(mutations) {
            var shouldEnhance = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.classList && (node.classList.contains('pool-card') || node.classList.contains('pool-coin-grid'))) {
                            shouldEnhance = true;
                        }
                        if (node.querySelectorAll) {
                            var cards = node.querySelectorAll('.pool-card');
                            if (cards.length > 0) shouldEnhance = true;
                        }
                    });
                }
            });
            if (shouldEnhance) {
                setTimeout(enhanceMergedPoolCards, 100);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Handle hash changes
        window.addEventListener('hashchange', function() {
            handleMergedNavigation();
            // Re-enhance cards when returning to homepage
            var hash = window.location.hash;
            if (!hash || hash === '#' || hash === '#/') {
                setTimeout(enhanceMergedPoolCards, 500);
            }
        });
        
        // Check initial hash
        if (window.location.hash) {
            handleMergedNavigation();
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Export for debugging
window.MergedPoolEnhance = {
    enhance: enhanceMergedPoolCards,
    showConnect: showMergedConnectPage,
    POOLS: MERGED_POOLS,
    PORT: MERGED_PORT
};

// ============================================================
// BEST SHARE INTEGRATION FOR MERGED POOL
// ============================================================

function loadMergedBestShares(poolId) {
    if (!poolId) poolId = "ltc-merged";
    console.log("[MergedPool] Loading best shares for:", poolId);
    
    return $.ajax({
        url: API + "pools/" + poolId + "/beststats",
        method: "GET",
        timeout: 10000
    })
    .done(function(data) {
        console.log("[MergedPool] Best shares loaded:", data);
        updateMergedBestShareDisplay(data, poolId);
    })
    .fail(function(xhr, status, error) {
        console.warn("[MergedPool] Failed to load best shares:", status, error);
    });
}

function updateMergedBestShareDisplay(data, poolId) {
    var multiplier = 65536;
    
    if (data.poolBest && data.poolBest.difficulty > 0) {
        var poolDiff = data.poolBest.difficulty * multiplier;
        var formatted = formatMergedDifficulty(poolDiff);
        
        $("#poolBestShare").text(formatted);
        $("#dashboardPoolBest").text(formatted);
        
        if (data.poolBest.miner) {
            var shortMiner = data.poolBest.miner.substring(0, 8) + "..." + 
                            data.poolBest.miner.substring(data.poolBest.miner.length - 6);
            $("#poolBestShareMiner").html('<a href="#' + poolId + '/dashboard?address=' + encodeURIComponent(data.poolBest.miner) + '" class="text-info">' + shortMiner + '</a>');
        }
        
        if (data.poolBest.worker) {
            $("#poolBestShareMiner").append(' <span class="text-muted">(' + data.poolBest.worker + ')</span>');
        }
        
        $("#poolBestShareTime").text("This session");
    }
    
    var currentAddress = window.walletAddress || "";
    if (currentAddress && data.minerBests) {
        var minerBest = null;
        
        data.minerBests.forEach(function(mb) {
            if (mb.miner && mb.miner.indexOf(currentAddress) !== -1) {
                if (!minerBest || mb.difficulty > minerBest.difficulty) {
                    minerBest = mb;
                }
            }
        });
        
        if (minerBest) {
            var minerDiff = minerBest.difficulty * multiplier;
            var formatted = formatMergedDifficulty(minerDiff);
            $("#minerBestShare").text(formatted);
            
            if (minerBest.worker) {
                $("#minerBestShareWorker").text(minerBest.worker);
            }
            $("#minerBestShareTime").text("This session");
        }
    }
}

function formatMergedDifficulty(diff) {
    if (diff >= 1e15) return (diff / 1e15).toFixed(2) + " P";
    if (diff >= 1e12) return (diff / 1e12).toFixed(2) + " T";
    if (diff >= 1e9) return (diff / 1e9).toFixed(2) + " G";
    if (diff >= 1e6) return (diff / 1e6).toFixed(2) + " M";
    if (diff >= 1e3) return (diff / 1e3).toFixed(2) + " K";
    return diff.toFixed(2);
}

(function() {
    window.addEventListener("hashchange", function() {
        var hash = window.location.hash.replace("#", "");
        var poolId = hash.split("/")[0];
        if (isMergedPool(poolId)) {
            setTimeout(function() { loadMergedBestShares(poolId); }, 500);
        }
    });
    
    setInterval(function() {
        var hash = window.location.hash.replace("#", "");
        var poolId = hash.split("/")[0];
        if (isMergedPool(poolId)) {
            loadMergedBestShares(poolId);
        }
    }, 30000);
    
    setTimeout(function() {
        var hash = window.location.hash.replace("#", "");
        var poolId = hash.split("/")[0];
        if (isMergedPool(poolId)) {
            loadMergedBestShares(poolId);
        }
    }, 1000);
})();

console.log("[MergedPool] Best share integration loaded");
