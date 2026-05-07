/*!
  * Miningcore.js v1.02
  * Copyright 2020 Authors (https://github.com/minernl/Miningcore)
  */

// --------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------
// Current running domain (or ip address) url will be read from the browser url bar.
// You can check the result in you browser development view -> F12 -> Console 
// -->> !! no need to change anything below here !! <<--
// --------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------

// read WebURL from current browser
var WebURL = window.location.protocol + "//" + window.location.hostname + "/";  // Website URL is:  https://domain.com/
// WebURL correction if not ends with /
if (WebURL.substring(WebURL.length-1) != "/")
{
	WebURL = WebURL + "/";
	console.log('Corrected WebURL, does not end with / -> New WebURL : ', WebURL);
}
var API = "https://meowpool.net/api/";   						// API address is:  https://domain.com/api/
// API correction if not ends with /
if (API.substring(API.length-1) != "/")
{
	API = API + "/";
	console.log('Corrected API, does not end with / -> New API : ', API);
} 
var stratumAddress = window.location.hostname;           				// Stratum address is:  domain.com


// Coin symbol → API key mapping (initialized once safely)
(function () {
    if (window.coinMap) return; // prevents redefinition if script loads twice

    window.coinMap = {
        FIRO: 'firo',
        MEWC: 'meowcoin',
        RTM: 'raptoreum',
        RVN: 'ravencoin',
        BTC: 'bitcoin',
        BCH: 'bitcoin-cash',
        ETC: 'ethereum-classic',
        KAS: 'kaspa',
        WART: 'warthog',
        XEL: 'xelis',
        LOG: 'woodcoin',
        LTC: 'litecoin',
        DOGE: 'dogecoin',
        BC2: 'bitcoinii',
        CAT: 'catcoins',
        ZEC: 'zcash'
    };
})();

function loadAllCoinPrices(pools) {
    return new Promise((resolve) => {
        $.ajax({
            url: '/api/prices',
            timeout: 5000,
            method: 'GET'
        })
        .done(function (data) {

            pools.forEach(pool => {
                const symbol = (
                    pool.coin.symbol ||
                    getCoinSymbol(pool.coin.type)
                ).toUpperCase();

                const key = window.coinMap?.[symbol]; // safe access
                const price = key ? (data[key]?.usd || 0) : 0;

                pool.coinPrice = price;
                pool.totalPaidUSD = pool.totalPaid * price;
            });

            resolve(pools);
        })
        .fail(function (xhr, status, error) {

            console.error('Price proxy request failed:', error);

            pools.forEach(pool => {
                pool.coinPrice = 0;
                pool.totalPaidUSD = 0;
            });

            resolve(pools);
        });
    });
}


// --------------------------------------------------------------------------------------------
// no need to change anything below here
// --------------------------------------------------------------------------------------------
console.log('MiningCore.WebUI : ', WebURL);		                      // Returns website URL
console.log('API address used : ', API);                                      // Returns API URL
console.log('Stratum address  : ', "stratum+tcp://" + stratumAddress + ":");  // Returns Stratum URL
console.log('Page Load        : ', window.location.href);                     // Returns full URL

currentPage = "index"

// check browser compatibility
var nua = navigator.userAgent;
//var is_android = ((nua.indexOf('Mozilla/5.0') > -1 && nua.indexOf('Android ') > -1 && nua.indexOf('AppleWebKit') > -1) && !(nua.indexOf('Chrome') > -1));
var is_IE = ((nua.indexOf('Mozilla/5.0') > -1 && nua.indexOf('Trident') > -1) && !(nua.indexOf('Chrome') > -1));
if(is_IE) {
	console.log('Running in IE browser is not supported - ', nua);
}

// Load INDEX Page content
function loadIndex() {
  $("div[class^='page-").hide();
  
  $(".page").hide();
  //$(".page-header").show();
  $(".page-wrapper").show();
  $(".page-footer").show();
  
  var hashList = window.location.hash.split(/[#/?=]/);
  //var fullHash = document.URL.substr(document.URL.indexOf('#')+1);   //IE
  // example: #vtc/dashboard?address=VttsC2.....LXk9NJU
  currentPool    = hashList[1];
  currentPage    = hashList[2];
  currentAddress = hashList[3];
  
  if (currentPool && !currentPage)
  {
    currentPage ="stats"
  }
  else if(!currentPool && !currentPage)
  {
    currentPage ="index";
  }
  if (currentPool && currentPage) {
    loadNavigation();
    $(".main-index").hide();
	$(".main-pool").show();
	$(".page-" + currentPage).show();
	$(".main-sidebar").show();
  } else {
    $(".main-index").show();
	$(".main-pool").hide();
	$(".page-index").show();
    $(".main-sidebar").hide();
  }
  
  if (currentPool) {
	$("li[class^='nav-']").removeClass("active");
    
	switch (currentPage) {
      case "stats":
	    console.log('Loading stats page content');
	    $(".nav-stats").addClass("active");
        loadStatsPage();
        break;
      case "dashboard":
	    console.log('Loading dashboard page content');
        $(".nav-dashboard").addClass("active");
		loadDashboardPage();
        break;
	  case "miners":
	    console.log('Loading miners page content');
        $(".nav-miners").addClass("active");
		loadMinersPage();
        break;
      case "blocks":
	    console.log('Loading blocks page content');
	    $(".nav-blocks").addClass("active");
        loadBlocksEffortTable();
        loadBlocksPage();
        break;
      case "payments":
	    console.log('Loading payments page content');
	    $(".nav-payments").addClass("active");
        loadPaymentsPage();
        break;
      case "connect":
	    console.log('Loading connect page content');
        $(".nav-connect").addClass("active");
		loadConnectPage();
        break;
	  case "faq":
	    console.log('Loading faq page content');
        $(".nav-faq").addClass("active");
        break;
      case "support":
	    console.log('Loading support page content');
        $(".nav-support").addClass("active");
        break;
      default:
      // default if nothing above fits
    }
  } else {
    loadHomePage();
  }
  scrollPageTop();
}

// Factory function to create getTotalWorkersForAllPools instance
function createTotalWorkersCalculator() {
  return async function getTotalWorkersForAllPools(filteredData) {
    try {
      // Display loading indicator with three dots animation
      $('#loadingIndicator').html('<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>');

      // Define a variable to track the animation
      let animationIndex = 0;
      const animationFrames = ['.', '..', '...'];

      let totalWorkers = 0;

      // Batch requests for all miners in each pool
      const batchedRequests = filteredData.map(async pool => {
        const poolName = pool.id;
        const minersData = await $.ajax(API + "pools/" + poolName + "/miners");
        const miners = minersData.map(miner => miner.miner);
        const workersPromises = miners.map(miner =>
          $.ajax(API + "pools/" + poolName + "/miners/" + miner)
        );
        const workersDataArray = await Promise.all(workersPromises);

        // Reset totalWorkers for each pool
        let poolTotalWorkers = 0;

        workersDataArray.forEach(workersData => {
          if (workersData.performance && workersData.performance.workers) {
            poolTotalWorkers += Object.keys(workersData.performance.workers).length;
          }
        });

        // Add poolTotalWorkers to totalWorkers
        totalWorkers += poolTotalWorkers;
      });

      await Promise.all(batchedRequests);

      // Hide loading indicator
      $('#loadingIndicator').text('');

      return totalWorkers;
    } catch (error) {
      // Hide loading indicator on error
      $('#loadingIndicator').text('');

      $.notify({
        message: "Error: No response from API.<br>(getTotalWorkersForAllPools)"
      }, {
        type: "danger",
        timer: 3000
      });
      console.error("AJAX Error:", error.statusText); // Log AJAX error
      throw new Error("Error: No response from API");
    }
  };
}

// Load HOME page content 
function loadHomePage() {
    console.log('Loading home page content');
    return $.ajax(API + "pools")
        .done(function (data) {
		var uniqueAlgorithms = new Set();
		var poolCoinGridTemplate = "";
		var poolTotalMiners = 0;
		var poolTotalHashrate = 0;
		var poolActiveCount = 0;
     		var algorithmFilterTemplate = "";

            let sortedAlgorithms = data.pools.sort((a, b) => a.coin.algorithm.localeCompare(b.coin.algorithm));
            // Collect unique algorithms
            $.each(sortedAlgorithms, function (index, value) {
                uniqueAlgorithms.add(value.coin.algorithm);
            });

            // Create filter buttons based on unique algorithms, including "All Coins"
//            algorithmFilterTemplate += `<div class='col-lg-3 col-sm-3 col-md-3 col-xl-2 btn bg-gray filter-btn active' data-algorithm='all'>All Coins</div>`;
//            uniqueAlgorithms.forEach(function (algorithm) {
//                algorithmFilterTemplate += `<div class='col-lg-3 col-sm-3 col-md-3 col-xl-2 btn bg-gray filter-btn' data-algorithm='${algorithm}'>${algorithm}</div>`;
//            });

            // Add filter buttons to the page
            $("#algorithmFilters").html(algorithmFilterTemplate);

            // Event listener for filter buttons
            $(".filter-btn").click(function () {
                var selectedAlgorithm = $(this).data('algorithm');
                filterCoins(selectedAlgorithm);
                $(".filter-btn").removeClass("active");
                $(this).addClass("active");
                // Reset the grid layout to ensure consistent alignment
                resetGridLayout();
            });
            let sortedPools = data.pools.sort((a, b) => a.coin.name.localeCompare(b.coin.name));
            // Create cards for each coin
            $.each(sortedPools, function (index, value) {
			var coinLogo = "<img class='coinimg' src='img/coin/icon/" + value.coin.type.toLowerCase() + ".png'  style='width:32px;'/>";
			var coinName = (value.coin.canonicalName) ? value.coin.canonicalName : value.coin.name;
			if (typeof coinName === "undefined" || coinName === null) coinName = value.coin.type;

			var pool_mined = true;
			var pool_networkstat_hash = "<div class='progress-bar progress-bar-striped progress-bar-animated bg-warning wp-100'>&nbsp;processing...&nbsp;</div>";
			var pool_networkstat_diff = "<div class='progress-bar progress-bar-striped progress-bar-animated bg-warning wp-100'>&nbsp;processing...&nbsp;</div>";
			if(value.hasOwnProperty('networkStats'))
			{
				pool_networkstat_hash = _formatter(value.networkStats.networkHashrate, 3, "H/s");
				pool_networkstat_diff = _formatter(value.networkStats.networkDifficulty, 6, "");
				pool_mined = false;
			}
		
			var LastPoolBlockTime = new Date(value.lastPoolBlockTime);
			var styledTimeAgo = renderTimeAgoBox(LastPoolBlockTime);
			var pool_stat_miner = "<div class='progress-bar progress-bar-striped progress-bar-animated bg-warning wp-100'>&nbsp;processing...&nbsp;</div>";
			var pool_stat_hash = "<div class='progress-bar progress-bar-striped progress-bar-animated bg-warning wp-100'>&nbsp;processing...&nbsp;</div>";
			var pool_netWorkShare = "<div class='progress net-progress'><div class='progress-bar progress-bar-striped progress-bar-animated' style='width:100%'></div><span class='progress-pct'>loading…</span></div>";
			if(value.hasOwnProperty('networkStats'))
			{
				var netWorkShare = (value.poolStats.poolHashrate / value.networkStats.networkHashrate * 100).toFixed(2);
				pool_stat_miner = value.poolStats.connectedMiners;
				pool_stat_hash = _formatter(value.poolStats.poolHashrate, 3, "H/s");
				pool_netWorkShare = "<div class='progress net-progress'><div class='progress-bar bg-green' role='progressbar' style='width: " + netWorkShare + "%;' aria-valuenow='" + netWorkShare + "' aria-valuemin='0' aria-valuemax='100'></div><span class='progress-pct'>" + netWorkShare + "%</span></div>";
				poolTotalMiners += pool_stat_miner;
				poolTotalHashrate += value.poolStats.poolHashrate;
				poolActiveCount++;
				pool_mined = false;
			}
		
			var isOnline = !pool_mined;
			var statusDot = isOnline
				? "<span class='coin-status-dot online'></span>"
				: "<span class='coin-status-dot offline'></span>";
			var pool_connected = isOnline
				? "<a href='#" + value.id + "' class='btn btn-connect'>Connection</a>"
				: "<button type='button' class='btn btn-connect-loading' disabled>Loading...</button>";

			var scheme = value.paymentProcessing.payoutScheme;
			var cardMode = (scheme === "SOLO") ? "solo" : (scheme === "PPLNS") ? "pool" : "pool";
			poolCoinGridTemplate += "<div class='col-lg-6 col-sm-12 col-md-6 col-xl-3 pool-coin-card' data-algorithm='"+ value.coin.algorithm +"' data-mode='" + cardMode + "'>";
			poolCoinGridTemplate += "<div class='card'>";

			// Header — icon left, name center, status dot right (WoolyPooly style)
			poolCoinGridTemplate += "<div class='card-header coin-card-header'>";
			poolCoinGridTemplate += "<div class='coin-card-icon'>" + coinLogo + "</div>";
			poolCoinGridTemplate += "<div class='coin-card-name'>" + coinName + "</div>";
			poolCoinGridTemplate += "<div class='coin-card-status'>" + statusDot + "</div>";
			poolCoinGridTemplate += "</div>";

			// Body — clean label / value rows
			poolCoinGridTemplate += "<div class='card-body coin-card-body'>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Algorithm</span><span class='stat-value'>" + value.coin.algorithm + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Payout</span><span class='stat-value'>" + value.paymentProcessing.payoutScheme + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Online</span><span class='stat-value'>" + pool_stat_miner + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Hashrate</span><span class='stat-value'>" + pool_stat_hash + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Network %</span><span class='stat-value stat-value--progress'>" + pool_netWorkShare + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Net Hashrate</span><span class='stat-value'>" + pool_networkstat_hash + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Difficulty</span><span class='stat-value'>" + pool_networkstat_diff + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Pool Fee</span><span class='stat-value'>" + value.poolFeePercent + "%</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Last Block</span><span class='stat-value'>" + styledTimeAgo + "</span></div>";
			poolCoinGridTemplate += "<div class='coin-stat-row'><span class='stat-label'>Price</span><span class='stat-value coin-price' data-symbol='"+ value.coin.symbol +"'>—</span></div>";
			poolCoinGridTemplate += "</div>"; // close card-body

			// Footer — connect button row
			poolCoinGridTemplate += "<div class='card-footer coin-card-footer'>" + pool_connected + "</div>";
			poolCoinGridTemplate += "</div></div>"; // close card + col
            });

            $(".pool-coin-grid").html(poolCoinGridTemplate); // Insert cards

            // Default: show pool cards only
            $(".pool-coin-card").each(function() {
                if ($(this).data("mode") !== "pool") $(this).hide();
            });

            resetGridLayout();

            // Populate stats banner
            $("#banner-miners").text(poolTotalMiners.toLocaleString());
            $("#banner-pools").text(poolActiveCount.toLocaleString());
            $("#banner-hashrate").text(_formatter(poolTotalHashrate, 2, "H/s"));

            // POOL/SOLO toggle
            $("#modeToggle .mode-btn").click(function() {
                var mode = $(this).data("mode");
                $("#modeToggle .mode-btn").removeClass("active");
                $(this).addClass("active");
                $(".pool-coin-card").each(function() {
                    if ($(this).data("mode") === mode) {
                        $(this).show();
                    } else {
                        $(this).hide();
                    }
                });
            });

            // Load all coin prices and update the placeholders
            loadAllCoinPrices(data.pools).then(updatedPools => {
                updatedPools.forEach(pool => {
                    const price = pool.coinPrice || 0;
                    $(".coin-price[data-symbol='" + pool.coin.symbol + "']").text('$' + price.toFixed(10));
                });
            });
        })
        .fail(function () {
            $(".pool-coin-grid").html("<div class='alert alert-warning'>" +
                "<h4><i class='fas fa-exclamation-triangle'></i> Warning!</h4>" +
                "<hr>" +
                "<p>The pool is currently down for maintenance.</p>" +
                "<p>Please try again later.</p>" +
                "</div>");
        });
}

 // Function to filter coins based on algorithm
function filterCoins(algorithm) {
    $(".pool-coin-card").show(); // Show all cards initially

    if (algorithm !== "all") {
        $(".pool-coin-card").not("[data-algorithm='" + algorithm + "']").hide(); // Hide cards not matching the selected algorithm
    }
}

// Function to reset the grid layout for consistent alignment
function resetGridLayout() {
    $(".pool-coin-card").each(function () {
        var tallest = 0;
        $(this).find('.card').each(function () {
            var cardHeight = $(this).outerHeight();
            if (cardHeight > tallest) {
                tallest = cardHeight;
            }
        });
        $(this).find('.card').css('height', tallest + 'px');
    });
}

// Load STATS page content
function loadStatsPage() {
  //clearInterval();
  setInterval(
    (function load() {
      loadStatsData();
      return load;
    })(),
    60000 // Changed to 1 minute (60000 milliseconds)
  );
  setInterval(
    (function load() {
      loadStatsChart();
      return load;
    })(),
    60000 // Changed to 1 minute (60000 milliseconds)
  );
  setInterval(
    (function load() {
      loadWorkerTTFBlocks();
      return load;
    })(),
    60000 // Changed to 1 minute (60000 milliseconds)
  );
}

// Load DASHBOARD page content
function loadDashboardPage() {
  function render() {
    //clearInterval();
    setInterval(
      (function load() {
		loadDashboardData($("#walletAddress").val());
		loadDashboardWorkerList($("#walletAddress").val());
		loadDashboardChart($("#walletAddress").val());
        	loadUserBalanceData($("#walletAddress").val());
		loadWorkerTTFBlocks($("#walletAddress").val());
		loadBlocksMinerPage($("#walletAddress").val());
		loadPaymentsMinerPage($("#walletAddress").val());
		loadEarningsMinerPage($("#walletAddress").val());
		return load;
      })(),
      60000
    );
  }
  var walletQueryString = window.location.hash.split(/[#/?]/)[3];
  if (walletQueryString) {
    var wallet = window.location.hash.split(/[#/?]/)[3].replace("address=", "");
    if (wallet) {
      $(walletAddress).val(wallet);
      localStorage.setItem(currentPool + "-walletAddress", wallet);
      render();
    }
  }
  if (localStorage[currentPool + "-walletAddress"]) {
    $("#walletAddress").val(localStorage[currentPool + "-walletAddress"]);
  }
}


// Load MINERS page content
function loadMinersPage() {
  return $.ajax(API + "pools/" + currentPool + "/miners?page=0&pagesize=20")
    .done(function(data) {
      var minerList = "";
      if (data.length > 0) {
        $.each(data, function(index, value) {
        minerList += "<tr>";
        minerList += '<td><a onClick="window.location=\'' + WebURL + '#' + currentPool + '/dashboard?address=' + value.miner + '\'">' + value.miner + '</a></td>';
        minerList += "<td>" + _formatter(value.hashrate, 2, "H/s") + "</td>";
        minerList += "<td>" + _formatter(value.sharesPerSecond, 2, "S/s") + "</td>";
        minerList += "</tr>";
        });
      } else {
        minerList += '<tr><td colspan="4">No miner connected</td></tr>';
      }
      $("#minerList").html(minerList);
    })
    .fail(function() {
      $.notify(
        {
          message: "Error: No response from API.<br>(loadMinersList)"
        },
        {
          type: "danger",
          timer: 3000
        }
      );
    });
}

async function loadBlocksEffortTable()
{
	console.log("loadBlocksEffortTable");

	try
	{
		const data = await $.ajax(API + "pools");
		const poolsResponse = data.pools.find(pool => currentPool === pool.id);

		if (!poolsResponse) 
		{
			throw new Error("Pool not found");
		}

		var totalBlocks = poolsResponse.totalBlocks;
		var poolEffort = (poolsResponse.poolEffort * 100).toFixed(2);

		const PoolblocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=" + totalBlocks);

		var effortsum = 0;
		var uncleblocks = 0;
		var orphanedblocks = 0;

		let BlocksEffortList = "";

		for (let i = 0; i < PoolblocksResponse.length; i++)
		{
			const currentBlock = PoolblocksResponse[i];

			if (typeof currentBlock.effort !== "undefined") 
			{
				effortsum += Math.round(currentBlock.effort * 100);
			}

			if (currentBlock.status === "orphaned") 
			{
				orphanedblocks++;
			}

			if (currentBlock.type === "uncle") 
			{
				uncleblocks++;
			}

			BlocksEffortList += `
				<tr>
					<td>${currentBlock.blockHeight ?? ""}</td>
					<td>${currentBlock.effort ? (currentBlock.effort * 100).toFixed(2) : ""}</td>
					<td>${currentBlock.status ?? ""}</td>
				</tr>`;
		}

		effortsum = Math.round(effortsum / totalBlocks);
		uncleblocks = (uncleblocks / totalBlocks).toFixed(2);
		orphanedblocks = (orphanedblocks / totalBlocks).toFixed(2);

		$("#CurrentEffort").html(poolEffort + " %");
		$("#AverageEffort").html(effortsum + " %");
		$("#AverageUncleRate").html(uncleblocks + " %");
		$("#AverageOrphanedRate").html(orphanedblocks + " %");

		$("#BlocksEffortList").html(BlocksEffortList);
	}
	catch (error) 
	{
		console.error(error);
	}
}

// Load BLOCKS page content
function loadBlocksPage() 
{
	//console.log("loadBlocksPage");
	return $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=100")
    .done(function (data) {
		var blockList = "";
		var newBlockList = "";
		var newBlockCount = 0;
		var pendingBlockList = "";
		var pendingBlockCount = 0;
		var confirmedBlockCount = 0;
		// Reset minerBlocks before populating again
		minerBlocks = {};
		if (data.length > 0) 
		{
			$.each(data, function (index, value) 
			{
				var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
				var effort = Math.round(value.effort * 100);
				var effortClass = "";
				var ServerFlag = "<img class='serverimg small-server-image' src='img/coin/" + value.source + ".png' />";

				if (effort < 100) 
				{
					effortClass = "effort1";
				} 
				else if (effort < 200) 
				{
					effortClass = "effort2";
				} 
				else  
				{
					effortClass = "effort3";
				} 

				var status = value.status;
				var blockTable = (status === "pending" && value.confirmationProgress === 0) ? newBlockList : pendingBlockList && (status === "pending") ? pendingBlockList : blockList;
				var timeAgo = getTimeAgo(createDate); // Calculate the time difference

				blockTable += "<tr>";
				blockTable += "<td><div title='"+ createDate +"'>" + timeAgo + "</div></td>";
				blockTable += "<td>" + value.miner.substring(0, 8) + " &hellip; " + value.miner.substring(value.miner.length - 8) + "</td>";
				blockTable += "<td><a href='" + value.infoLink + "' target='_blank'>" + Intl.NumberFormat().format(value.blockHeight) + "</a></td>";
	
				blockTable += "<td>" + _formatter(value.networkDifficulty, 6, "") + "</td>";
				if (typeof value.effort !== "undefined") 
				{
					blockTable += "<td class='" + effortClass + "'>" + effort + "%</td>";
				} 
				else 
				{
					blockTable += "<td>Calculating...</td>";
				}
				blockTable += "<td>";
				// Block object for each block
				var block = {
					timeAgo: timeAgo,
					blockHeight: value.blockHeight,
					miner: value.miner,
					networkDifficulty: value.networkDifficulty.toFixed(8),
					effortClass: effortClass,
					status: value.status,
					progressValue: progressValue,
				};
				if (status === "pending") 
				{
					if (value.confirmationProgress === 0) 
					{
						blockTable += "New Block";
						block.reward = "Waiting...";
						blockTable += "<td>Waiting...</td>";
						blockTable += "<td>Waiting...</td>";
						newBlockCount++;
					} 
					else 
					{
						blockTable += "Pending";
						block.reward = Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.reward);
						blockTable += "<td>" + Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.reward) + "</td>";
						if (value.type =="uncle") blockTable += "<td>" + "Uncle" + "</td>";
						else if (status === "orphaned") blockTable += "<td>" + "Orphaned" + "</td>";
						else blockTable += "<td>" + "Block" + "</td>";
						pendingBlockCount++;
					}
				} 
				else if (status === "confirmed") 
				{
					blockTable += "Confirmed";
					block.reward = Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.reward);
					blockTable += "<td>" + Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.reward) + "</td>";
					if (value.type =="uncle") blockTable += "<td>" + "Uncle" + "</td>";
					else blockTable += "<td>" + "Block" + "</td>";
					confirmedBlockCount++;
				} 
				else if (status === "orphaned") 
				{
					blockTable += "Orphaned";
					block.reward = Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.reward);
					blockTable += "<td>" + Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.reward) + "</td>";
					blockTable += "<td>" + "Orphaned" + "</td>";
				} 
				else 
				{
					blockTable += status;
				}
				// Populate minerBlocks based on the miner value
				if (!minerBlocks[value.miner]) 
				{
					minerBlocks[value.miner] = [];
				}
				minerBlocks[value.miner].push(block);
				blockTable += "</td>";
				var progressValue = (currentPool.includes("woodcoin")) ? Math.min(Math.round(value.confirmationProgress * 6 * 100), 100) : Math.round(value.confirmationProgress * 100);
				blockTable += '<td><div class="progress"><div class="progress-bar bg-green progress-bar-striped progress-bar-animated" role="progressbar" style="width: ' + progressValue + '%;" aria-valuenow="' + progressValue + '" aria-valuemin="0" aria-valuemax="100">' + progressValue + '%</div></div></td>';
				blockTable += "</tr>";

				if (status === "pending") 
				{
					if (value.confirmationProgress === 0) 
					{
						newBlockList = blockTable;
					}
					else 
					{
						pendingBlockList = blockTable;
					}
				} 
				else 
				{
					blockList = blockTable ;
				}
			});
		} 
		else 
		{
			blockList += '<tr><td colspan="9">No blocks found yet</td></tr>';
		}
		$("#blockList").html(blockList);
		$("#newBlockList").html(newBlockList);
		$("#newBlockCount").text(newBlockCount);
		$("#pendingBlockList").html(pendingBlockList);
		$("#pendingBlockCount").text(pendingBlockCount);
		$("#confirmedBlockCount").text(confirmedBlockCount);
		loadStatsData();
	})
	.fail(function () {
		$.notify(
			{
				message: "Error: No response from API.<br>(loadBlocksList)"
			},
			{
				type: "danger",
				timer: 3000
			}
		);
	});
}

// DASHBOARD Load BLOCKS data for miner
async function loadBlocksMinerPage(walletAddress) 
{
	console.log("loadBlocksMinerPage");
	try
	{
		const data = await $.ajax(API + "pools");
		const poolsResponse = data.pools.find(pool => currentPool === pool.id);
		if (!poolsResponse) 
		{
			throw new Error("Pool not found");
		}
		var totalBlocks = poolsResponse.totalBlocks;
		var poolEffort = poolsResponse.poolEffort * 100;
		const PoolblocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=" + totalBlocks);
		const blocksResponse = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress +"/blocks?page=0&pageSize=" + totalBlocks);
		const MinerResponse = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress);
		var MinerEffort = MinerResponse.minerEffort * 100;
		var DashboardBlockList = "";
		var allblocks = 0;
		var pooluncleblocks = 0;
		var poolorphanedblocks = 0;
		var uncleblocks = 0;
		var orphanedblocks = 0;
		var effortsum = 0;
		var minerEffortsum = 0;
		if (blocksResponse.length > 0) {
			$.each(blocksResponse, function(index, value) {
				var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
       			var timeAgo = getTimeAgo(createDate); // Calculate the time difference
				var effort = Math.round(value.effort * 100);
				var minerEffort = Math.round(value.minerEffort * 100);
				var effortClass = "";
				var minerEffortClass = "";
				if (effort < 100) 
				{
					effortClass = "effort1";
				} 
				else if (effort < 200) 
				{
					effortClass = "effort2";
				} 
				else 
				{
					effortClass = "effort3";
				}
				
				if (minerEffort < 100) 
				{
					minerEffortClass = "effort1";
				} 
				else if (minerEffort < 200) 
				{
					minerEffortClass = "effort2";
				} 
				else 
				{
					minerEffortClass = "effort3";
				} 
				
				DashboardBlockList += "<tr>";
				DashboardBlockList += "<td>" + timeAgo + "</td>";
				DashboardBlockList += "<td><a href='" + value.infoLink + "' target='_blank'>" + value.blockHeight + "</a></td>";
				if (typeof value.effort !== "undefined") 
				{
					DashboardBlockList += "<td class='" + effortClass + "'><b>" + effort + "%</b></td>";
				} else {
					DashboardBlockList += "<td>n/a</td>";
				}
					
				if (typeof value.minerEffort !== "undefined") 
				{
					DashboardBlockList += "<td class='" + minerEffortClass + "'><b>" + minerEffort + "%</b></td>";
				} else {
					DashboardBlockList += "<td>n/a</td>";
				}
				var status = value.status;
				DashboardBlockList += "<td>" + _formatter(value.reward, 5, "") + "</td>";
				if (value.type =="uncle") DashboardBlockList += "<td>" + "Uncle" + "</td>";
				else DashboardBlockList += "<td>" + "Block" + "</td>";
				DashboardBlockList += "<td>" + status + "</td>";
				var progressValue = (currentPool.includes("woodcoin")) ? Math.min(Math.round(value.confirmationProgress * 6 * 100), 100) : Math.round(value.confirmationProgress * 100);
				DashboardBlockList += "<td><div class='progress-bar bg-green progress-bar-striped progress-bar-animated' role='progressbar' aria-valuenow='" + progressValue + "' aria-valuemin='0' aria-valuemax='100' style='width: " + progressValue + "%'><span>" + progressValue + "% Completed</span></div></td>";
				DashboardBlockList += "</tr>";
		  
			});
		} 
		else 
		{
			DashboardBlockList += '<tr><td colspan="6">No blocks found yet</td></tr>';
		}

		for (let i = 0; i < blocksResponse.length; i++)
		{
			const currentBlock = blocksResponse[i];
			if (typeof currentBlock.minerEffort !== "undefined") 
			{
				minerEffortsum = minerEffortsum + (currentBlock.minerEffort * 100);
			}
			if (currentBlock.status === "orphaned") 
			{
				orphanedblocks = orphanedblocks + 1;
			}
			if (currentBlock.type === "uncle") 
			{
				uncleblocks = uncleblocks + 1;
			}
			allblocks = allblocks + 1;
		}
		for (let i = 0; i < PoolblocksResponse.length; i++)
		{
			const currentBlock = PoolblocksResponse[i];
			if (typeof currentBlock.effort !== "undefined") 
			{
				effortsum = effortsum + (currentBlock.effort * 100);
			}
			if (currentBlock.status === "orphaned") 
			{
				poolorphanedblocks = poolorphanedblocks + 1;
			}
			if (currentBlock.type === "uncle") 
			{
				pooluncleblocks = pooluncleblocks + 1;
			}
		}
		effortsum = (effortsum / totalBlocks).toFixed(2);
		pooluncleblocks = (pooluncleblocks / totalBlocks).toFixed(2);
		poolorphanedblocks = (poolorphanedblocks / totalBlocks).toFixed(2);
		minerEffortsum = (minerEffortsum / allblocks).toFixed(2);
		orphanedblocks = (orphanedblocks / allblocks).toFixed(2);
		uncleblocks = (uncleblocks / allblocks).toFixed(2);
		console.log('pooluncleblocks: ',pooluncleblocks);
		console.log('poolorphanedblocks: ',poolorphanedblocks);
		console.log('uncleblocks: ',uncleblocks);
		console.log('orphanedblocks: ',orphanedblocks);

		$("#BlocksEffort").html("Current Effort: " + poolEffort.toFixed(2) +" %" + "<br>Average Effort: " + effortsum + " %");
		$("#MinerEffort").html("Current Effort: " + MinerEffort.toFixed(2) +" %" + "<br>Average Effort: " + minerEffortsum + " %");
		$("#AvgUncleRate").html("Your Rate: " + uncleblocks +" %" + "<br>Pool Rate: " + pooluncleblocks + " %");
		$("#AvgOrphanedRate").html("Your Rate: " + orphanedblocks +" %" + "<br>Pool Rate: " + poolorphanedblocks + " %");

		$("#DashboardBlockList").html(DashboardBlockList);
		
		dataBlockEffort         = [];
		dataMinerEffort         = [];
		dataBlockLabel          = [];
		dataBlockTargetSeries1  = [];
		dataBlockTargetSeries2  = [];
		dataMinerTargetSeries1  = [];
		dataMinerTargetSeries2  = [];
		dataBlockAvgSeries1     = [];
		dataBlockAvgSeries2     = [];
		dataMinerAvgSeries1     = [];
		dataMinerAvgSeries2     = [];
		blocksSeries1           = 10;
		blocksSeries2           = 50;
		dataLength              = 100;
        		    
		var i=1;
		$.each(blocksResponse, function(index2, value2) 
		{
			if (value2.status === "confirmed" || value2.status === "pending") 
			{
				dataBlockEffort.push(value2.effort * 100);
				dataMinerEffort.push(value2.minerEffort * 100);
				if (i>=blocksSeries1) 
				{
					dataBlockTargetSeries1.push(100);
					dataBlockAvgSeries1.push(dataBlockEffort.slice(-blocksSeries1).reduce((a, b) => a + b, 0)/blocksSeries1);
					dataMinerTargetSeries1.push(100);
					dataMinerAvgSeries1.push(dataMinerEffort.slice(-blocksSeries1).reduce((a, b) => a + b, 0)/blocksSeries1);
				}
				if (i>=blocksSeries2) 
				{
					dataBlockTargetSeries2.push(100);
					dataBlockAvgSeries2.push(dataBlockEffort.slice(-blocksSeries2).reduce((a, b) => a + b, 0)/blocksSeries2);
					dataMinerTargetSeries2.push(100);
					dataMinerAvgSeries2.push(dataMinerEffort.slice(-blocksSeries2).reduce((a, b) => a + b, 0)/blocksSeries2);
				}
				i++;
			}
		})
    
		dataBlockAvgSeries1    = dataBlockAvgSeries1.slice(0,(dataBlockAvgSeries2.length<dataLength?dataBlockAvgSeries2.length:dataLength));
		dataBlockAvgSeries2  = dataBlockAvgSeries2.slice(0,(dataBlockAvgSeries2.length<dataLength?dataBlockAvgSeries2.length:dataLength));
		
		dataMinerAvgSeries1    = dataMinerAvgSeries1.slice(0,(dataMinerAvgSeries2.length<dataLength?dataMinerAvgSeries2.length:dataLength));
		dataMinerAvgSeries2  = dataMinerAvgSeries2.slice(0,(dataMinerAvgSeries2.length<dataLength?dataMinerAvgSeries2.length:dataLength));
		
		dataBlockTargetSeries1 = dataBlockTargetSeries1.slice(0,(dataBlockAvgSeries2.length<dataLength?dataBlockAvgSeries2.length:dataLength));
		dataMinerTargetSeries1 = dataMinerTargetSeries1.slice(0,(dataMinerAvgSeries2.length<dataLength?dataMinerAvgSeries2.length:dataLength));
                    
		var y=1;
		do 
		{
			if (dataBlockLabel.length === 0 || (dataBlockLabel.length + 1) % 10 === 0) 
			{
				dataBlockLabel.push((y===1?"Now":y));
			} 
			else 
			{
				dataBlockLabel.push("");
			}
			y++;
		} 
		while (y<=dataBlockAvgSeries1.length);	
                    
		var dataRecentBlocks        = {labels: dataBlockLabel.reverse(),series: [dataBlockAvgSeries1.reverse(),dataBlockAvgSeries2.reverse(),dataBlockTargetSeries1.reverse(),dataMinerAvgSeries1.reverse(),dataMinerAvgSeries2.reverse(),dataMinerTargetSeries1.reverse()]};
		var options		            = {height: "250px",showArea: true,showPoint: false,seriesBarDistance: 1,axisX: {showGrid: true}, axisY: {offset: 43,scale: "logcc",labelInterpolationFnc: function(value) {return _formatter(value, 1, "%");}}, lineSmooth: Chartist.Interpolation.simple({divisor: 3})};
		var responsiveOptions 	  = [["screen and (max-width: 100%)",{axisX: {labelInterpolationFnc: function(value) {return value[1];}}}]];
		Chartist.Line("#chartDashboardBlockEffort",dataRecentBlocks,options,responsiveOptions);
	}
	catch (error) 
	{
		console.error(error);
	}
}

// Load PAYMENTS page content
function loadPaymentsPage() {
  console.log("loadPaymentsPage");
  return $.ajax(API + "pools/" + currentPool + "/payments?page=0&pageSize=500")
    .done(function (data) {
      var paymentList = "";
      if (data.length > 0) {
        $.each(data, function (index, value) {
          var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
          var timeAgo = getTimeAgo(createDate); // Calculate the time difference
          paymentList += '<tr>';
          //paymentList += "<td>" + createDate.toLocaleString('en-US', { hour12: false, timeZoneName: 'short' }) + "</td>";
          paymentList += "<td>" + createDate.toLocaleString('en-US', { hour12: false, timeZoneName: 'short' }) + " (" + timeAgo + ")" + "</td>";
          //paymentList += "<td>" + timeAgo + "</td>";
          //paymentList += '<td><a href="' + value.addressInfoLink + '" target="_blank">' + value.address + '</td>';
          paymentList += '<td><a href="' + value.addressInfoLink + '" target="_blank">' + value.address.substring(0, 12) + ' &hellip; ' + value.address.substring(value.address.length - 12) + '</td>';
          paymentList += '<td>' + Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(value.amount) + '</td>';
          paymentList += '<td colspan="2"><a href="' + value.transactionInfoLink + '" target="_blank">' + value.transactionConfirmationData.substring(0, 16) + ' &hellip; ' + value.transactionConfirmationData.substring(value.transactionConfirmationData.length - 16) + ' </a></td>';
          paymentList += '</tr>';
        });
      } else {
        paymentList += '<tr><td colspan="4">No payments found yet</td></tr>';
      }
      $("#paymentList").html(paymentList);
    })
    .fail(function () {
      $.notify(
        {
          message: "Error: No response from API.<br>(loadPaymentsList)"
        },
        {
          type: "danger",
          timer: 3000
        }
      );
    });
}

// Load Payments Miner page content
function loadPaymentsMinerPage(walletAddress) {
	return $.ajax(API + "pools/" + currentPool + "/miners/"+ walletAddress + "/payments?page=0&pageSize=500")
	.done(function(data) {
	var lastPaymentList = "";
	if (data.length > 0) {
	$.each(data, function(index, value) {
	var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
	var timeAgo = getTimeAgo(createDate); // Calculate the time difference
        lastPaymentList += '<tr>';
	lastPaymentList += "<td>" + timeAgo + "</td>";
	lastPaymentList += '<td><a href="' + value.addressInfoLink + '" target="_blank">' + value.address.substring(0, 12) + ' &hellip; ' + value.address.substring(value.address.length - 12) + '</td>';
	lastPaymentList += '<td>' + _formatter(value.amount, 5, "") + '</td>';
	lastPaymentList += '<td colspan="2"><a href="' + value.transactionInfoLink + '" target="_blank">' + value.transactionConfirmationData.substring(0, 16) + ' &hellip; ' + value.transactionConfirmationData.substring(value.transactionConfirmationData.length - 16) + ' </a></td>';
	lastPaymentList += '</tr>';
	});
	} else {
		lastPaymentList += '<tr><td colspan="4">No Payments Made Yet</td></tr>';
	}
	$("#lastPaymentList").html(lastPaymentList);
	})
	.fail(function() {
	$.notify(
	{message: "Error: No response from API.<br>(loadPaymentsList)"},
	{type: "danger",timer: 3000}
	);
	});
}

// Load Earnings Miner page content
async function loadEarningsMinerPage(walletAddress)
{
	console.log('Loading Earnings data...');
	try
	{
		const data = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/balancechanges?pagesize=999999");
		const data1 = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/earnings/daily");
		var transactionList     = "";
		var dailyCreditList     = "";
		        
        var j = 0;
		// BEGIIN Transactions last 30
        if (data.length>0) {
            $.each(data, function(index, value) {
		var createDate = dateConvertor(new Date(value.created),false);
                if (j<=30) {
                    transactionList += "<tr>";
                    transactionList += "<td>" + createDate + "</td>";
                    transactionList += "<td>" + (value.amount>0?value.usage:(value.usage=="Balance expired"?"Balance expired":"Payment sent to <font class='small op-3'>" + value.address.substring(0, 8) + " &hellip; " + value.address.substring(value.address.length-8)) + "</font>") + "</td>";
            		if (value.amount>0) {
            		    outinClass = "effort1";
            		}
            		else {
            		    outinClass = "effort3";
            		}
            		val = (value.amount<0?"":"+") + value.amount.toFixed(6);
            		transactionList += "<td><span class='" + outinClass + "'>" + val + "</span></td>";
            		transactionList += "</tr>";
                }
                j++;
            });
        }
		if (data1.length > 0) 
		{
			$.each(data1, function(index, value) 
			{
				var createDate = dateConvertor(new Date(value.date),false);
				dailyCreditList += '<tr>';
				dailyCreditList += "<td>" + createDate.toLocaleString('en-US', { hour12: false, timeZoneName: 'short' }) + "</td>";
				dailyCreditList += '<td>' + _formatter(value.amount, 5, "") + '</td>';
				dailyCreditList += '</tr>';
			});
       }
	   else 
	   {
		    transactionList += '<tr><td colspan="3">No Transactions Yet</td></tr>';
		    dailyCreditList += '<tr><td colspan="3">No Transactions Yet</td></tr>';
	   }
        $("#EarningsList").html(transactionList);
        $("#minerCreditList").html(dailyCreditList);
	}
	catch (error) 
	{
		console.error(error);
	}
}

function loadConnectPage() {

    const now = Date.now();

    // -----------------------------
    // anti-spam / anti-loop guard
    // -----------------------------
    if (window.connectPageRunning) return;
    if (now - window.connectPageLastRun < 5000) return;

    window.connectPageRunning = true;
    window.connectPageLastRun = now;

    $.ajax(API + "pools")

        .done(function (data) {

            let html = "";

            $.each(data.pools, function (_, value) {

                if (currentPool !== value.id) return;

                defaultPort = Object.keys(value.ports)[0];
                NicehashPort = Object.keys(value.ports)[1] || defaultPort;

                coinName = value.coin.canonicalName || value.coin.name;
                coinType = value.coin.type.toLowerCase();
                coinSite = value.coin.website;
                coinGithub = value.coin.github;
                coinExplorer = value.coin.explorer;
                PoolWallet = value.address;
                algorithm = value.coin.algorithm;

                const stratum = (value.coin.family === "ethereum")
                    ? "stratum2"
                    : "stratum";

                html += "<tr><td>Coin</td><td>" + coinName + " (" + value.coin.type + ")</td></tr>";
                html += "<tr><td>Algorithm</td><td>" + algorithm + "</td></tr>";

                if (coinSite) {
                    html += '<tr><td>Website</td><td><a href="' + coinSite + '" target="_blank">' + coinSite + "</a></td></tr>";
                }

                if (coinGithub) {
                    html += '<tr><td>Github</td><td><a href="' + coinGithub + '" target="_blank">' + coinGithub + "</a></td></tr>";
                }

                if (coinExplorer) {
                    html += '<tr><td>Explorer</td><td><a href="' + coinExplorer + '" target="_blank">' + coinExplorer + "</a></td></tr>";
                }

                html += '<tr><td>Pool Wallet</td><td><a href="' + value.addressInfoLink + '" target="_blank">' +
                    PoolWallet.substring(0, 12) + " … " +
                    PoolWallet.slice(-12) +
                    "</a></td></tr>";

                html += "<tr><td>Payout Scheme</td><td>" + value.paymentProcessing.payoutScheme + "</td></tr>";
                html += "<tr><td>Minimum Payment</td><td>" + value.paymentProcessing.minimumPayment + " " + value.coin.type + "</td></tr>";

                if (value.paymentProcessing.minimumPaymentToPaymentId !== undefined) {
                    html += "<tr><td>Minimum Payout</td><td>" +
                        value.paymentProcessing.minimumPaymentToPaymentId + "</td></tr>";
                }

                html += "<tr><td>Pool Fee</td><td>" + value.poolFeePercent + "%</td></tr>";

                $.each(value.ports, function (port, options) {

                    html += "<tr><td>";

                    if (options.tls && !options.tlsAuto) {
                        html += stratum + "+ssl://" + stratumAddress + ":" + port;

                    } else if (options.tls && options.tlsAuto) {
                        html += stratum + "+tcp://" + stratumAddress + ":" + port +
                            "<br>" + stratum + "+ssl://" + stratumAddress + ":" + port;

                    } else {
                        html += "stratum+tcp://" + stratumAddress + ":" + port;
                    }

                    html += "</td><td>";

                    html += (options.varDiff != null)
                        ? "Start diff: " + options.difficulty + ", varDiff [" + options.name + "]"
                        : "Start diff: " + options.difficulty + ", Static";

                    html += "</td></tr>";
                });
            });

            $("#connectPoolConfig").html(html);

            // -----------------------------------------
            // SAFE CALL: prevents "not defined" crash
            // -----------------------------------------
            if (typeof window.loadMinerConfig === "function") {
                window.loadMinerConfig();
            } else {
                console.warn("loadMinerConfig not ready yet — skipping call");
            }

        })

        .fail(function () {
            $.notify({
                message: "Error: No response from API"
            }, {
                type: "danger",
                timer: 3000
            });
        })

        .always(function () {
            window.connectPageRunning = false;
        });
}


// Dashboard - load wallet stats
function loadWallet() {
	console.log( 'Loading wallet address:',$("#walletAddress").val() );
	if ($("#walletAddress").val().length > 0) {
		localStorage.setItem(currentPool + "-walletAddress", $("#walletAddress").val() );
	}
	var coin = window.location.hash.split(/[#/?]/)[1];
	var currentPage = window.location.hash.split(/[#/?]/)[2] || "stats";
	window.location.href = "#" + currentPool + "/" + currentPage + "?address=" + $("#walletAddress").val();
}

// General formatter function
function _formatter(value, decimal, unit) {
  if (value === 0) {
    return "0 " + unit;
  } else {
    var si = [
      { value: 1, symbol: "" },
      { value: 1e3, symbol: "k" },
      { value: 1e6, symbol: "M" },
      { value: 1e9, symbol: "G" },
      { value: 1e12, symbol: "T" },
      { value: 1e15, symbol: "P" },
      { value: 1e18, symbol: "E" },
      { value: 1e21, symbol: "Z" },
      { value: 1e24, symbol: "Y" }
    ];
    for (var i = si.length - 1; i > 0; i--) {
      if (value >= si[i].value) {
        break;
      }
    }
    return ((value / si[i].value).toFixed(decimal).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + " " + si[i].symbol + unit);
  }
}


// Time convert Local -> UTC
function convertLocalDateToUTCDate(date, toUTC) {
  date = new Date(date);
  //Local time converted to UTC
  var localOffset = date.getTimezoneOffset() * 60000;
  var localTime = date.getTime();
  if (toUTC) {
    date = localTime + localOffset;
  } else {
    date = localTime - localOffset;
  }
  newDate = new Date(date);
  return newDate;
}


// Time convert UTC -> Local
function convertUTCDateToLocalDate(date) {
    var newDate = new Date(date.getTime()+date.getTimezoneOffset()*60*1000);
    var localOffset = date.getTimezoneOffset() / 60;
    var hours = date.getUTCHours();
    newDate.setHours(hours - localOffset);
    return newDate;
}

// Function to calculate the time difference between now and a given date
function getTimeAgo(date) {
  var now = new Date();
  var diff = now.getTime() - date.getTime();
  var seconds = Math.floor(diff / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  var days = Math.floor(hours / 24);
  var months = Math.floor(days / 30);

  if (days >= 30) {
    return months + " month" + (months > 1 ? "s" : "") + " ago";
  } else if (days >= 1 && days <= 30) {
    return days + " day" + (days > 1 ? "s" : "") + " ago";
  } else if (hours >= 1) {
    return hours + " hour" + (hours > 1 ? "s" : "") + " ago";
  } else if (minutes >= 1) {
    return minutes + " mins ago";
  } else if (seconds >= 1 ){
    return seconds + " secs ago";
  } else {
    return "Unavailable";
  }
}

// String convert -> Date
function dateConvertor(date){
   var options = {  
     year: "numeric",  
     month: "numeric",  
     day: "numeric"
   };  

   var newDateFormat = new Date(date).toLocaleDateString("en-US", options); 
   var newTimeFormat = new Date(date).toLocaleTimeString();  
   var dateAndTime = newDateFormat +' '+ newTimeFormat        
   return dateAndTime
}

// Function to calculate the time difference between now and a given date
function renderTimeAgoBox(date) {
    var textColor = 'white';
    var borderRadius = '.25em';
    var bgColor = '';
    function getTimeAgoAdmin(date) {
        if (!date || isNaN(date.getTime())) {
            return "NEVER";
        }
        var now = new Date();
        var diff = now.getTime() - date.getTime();
        var seconds = Math.floor(diff / 1000);
        if (seconds < 60) {
            return "NOW";
        }
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        var months = Math.floor(days / 30);
        if (months >= 1) {
            return months + " month" + (months > 1 ? "s" : "");
        } else if (days >= 2) {
            return days + " day" + (days > 1 ? "s" : "");
        } else if (hours >= 48) {
            return "2 days";
        } else if (hours >= 1) {
            return hours + " hours";
        } else if (minutes >= 1) {
            return minutes + " min" + (minutes > 1 ? "s" : "");
        } else {
            return "NOW";
        }
    }
    var timeAgo = getTimeAgoAdmin(date);
    if (timeAgo === "NEVER" || timeAgo === "NOW") {
        bgColor = (timeAgo === "NEVER") ? '#5e3f20' : '#d4721e';
    } else if (timeAgo.includes("month")) {
        bgColor = '#d1941f'; // Orange for months
    } else if (timeAgo.includes("day")) {
        bgColor = '#c0c000'; // Yellow for days
    } else if (timeAgo.includes("hour")) {
        bgColor = '#008000'; // Dark green for hours
    } else if (timeAgo.includes("min")) {
        bgColor = '#00c000'; // Bright green for minutes
    }
    return "<div class='d-flex align-items-center justify-content-center' style='background-color:" + bgColor + "; color: " + textColor + "; border-radius: " + borderRadius + "; width: 100%; padding: 2px; font-size: 85%; font-weight: 700; text-align: center; height: 20px;'>" + timeAgo + "</div>";
}

// String Convert -> Seconds
function readableSeconds(t) {
	var seconds = Math.floor(t % 3600 % 60);
	var minutes = Math.floor(t % 3600 / 60);
	var hours = Math.floor(t % 86400 / 3600);
	var days = Math.floor(t % 604800 / 86400);	
	var weeks = Math.floor(t % 2629799.8272 / 604800);
	var months = Math.floor(t % 31557597.9264 / 2629799.8272);
	var years = Math.floor(t / 31557597.9264);

	var sYears = years > 0 ? years + ((years== 1) ? "y" : "y") : "";
	var sMonths = months > 0 ? ((years > 0) ? " " : "") + months + ((months== 1) ? "mo" : "mo") : "";
	var sWeeks = weeks > 0 ? ((years > 0 || months > 0) ? " " : "") + weeks + ((weeks== 1) ? "w" : "w") : "";
	var sDays = days > 0 ? ((years > 0 || months > 0 || weeks > 0) ? " " : "") + days + ((days== 1) ? "d" : "d") : "";
	var sHours = hours > 0 ? ((years > 0 || months > 0 || weeks > 0 || days > 0) ? " " : "") + hours + (hours== 1 ? "h" : "h") : "";
	var sMinutes = minutes > 0 ? ((years > 0 || months > 0 || weeks > 0 || days > 0 || hours > 0) ? " " : "") + minutes + (minutes == 1 ? "m" : "m") : "";
	var sSeconds = seconds > 0 ? ((years > 0 || months > 0 || weeks > 0 || days > 0 || hours > 0 || minutes > 0) ? " " : "") + seconds + (seconds == 1 ? "s" : "s") : ((years < 1 && months < 1 && weeks < 1 && days < 1 && hours < 1 && minutes < 1 ) ? " Few milliseconds" : "");
	if (seconds > 0) return sYears + sMonths + sWeeks + sDays + sHours + sMinutes + sSeconds;
	else return "&#8734;";
}

// Time Different Calculation
function timeDiff(tstart, tend) {
  var diff = Math.floor((tend - tstart) / 1000),
    units = [
      { d: 60, l: "s" },
      { d: 60, l: "m" },
      { d: 24, l: "h" },
      { d: 7, l: "d" },
    ];
  var s = "";
  for (var i = 0; i < units.length; ++i) {
    s = (diff % units[i].d) + units[i].l + " " + s;
    diff = Math.floor(diff / units[i].d);
  }
  return s;
}

// Time Different Calculation To Seconds
function timeDiffSec(tstart, tend) {
  var diff = Math.floor((tend - tstart) / 1000),
    units = [{ d: 60, l: " seconds" }];
  var s = "";
  for (var i = 0; i < units.length; ++i) {
    s = (diff % units[i].d) + units[i].l + " " + s;
    diff = Math.floor(diff / units[i].d);
  }
  return s;
}

// Scroll to top off page
function scrollPageTop() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  var elmnt = document.getElementById("page-scroll-top");
  elmnt.scrollIntoView();
}


// Check if file exits
function doesFileExist(urlToFile) {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', urlToFile, false);
    xhr.send();
     
    if (xhr.status == "404") {
        return false;
    } else {
        return true;
    }
}

async function loadStatsData() 
{
	console.log('Loading stats data...');

	try 
	{
		// ✅ load everything in parallel (stable timing)
		const [data, priceData] = await Promise.all([
			$.ajax(API + "pools"),
			$.ajax("/api/prices").catch(() => null) // fail-safe
		]);

		const value = data.pools.find(pool => currentPool === pool.id);
		if (!value) throw new Error("Pool not found");

		var getcoin_price = 0;

		// ✅ safe price extraction
		try
		{
			var symbol = (value.coin.symbol || value.coin.type || "").toUpperCase();
			var key = window.coinMap ? window.coinMap[symbol] : null;

			if (priceData && key && priceData[key] && priceData[key].usd)
			{
				getcoin_price = priceData[key].usd;
			}
		}
		catch(e)
		{
			console.error("Price error:", e);
			getcoin_price = 0;
		}

		// =========================
		// ORIGINAL CODE (unchanged)
		// =========================

		var totalBlocks = value.totalBlocks;
		var poolEffort = value.poolEffort * 100;

		$("#blockchainHeight").text(value.networkStats.blockHeight.toLocaleString());
		$("#poolBlocks2").text(totalBlocks.toLocaleString()); 
		$("#connectedPeers").text(value.networkStats.connectedPeers);

		$("#minimumPayment").html(
			Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value.paymentProcessing.minimumPayment) + 
			" " + value.coin.type + "<br>(" + value.paymentProcessing.payoutScheme + ")"
		);

		$("#totalPaid").html(value.totalPaid.toLocaleString() + " " + value.coin.type );
		$("#totalPaid2").html(value.totalPaid.toLocaleString() + " " + value.coin.type );

		$("#poolFeePercent").text(`${value.poolFeePercent} %`);
		$("#poolHashRate").text(_formatter(value.poolStats.poolHashrate, 2, "H/s"));
		$("#poolMiners").text(`${value.poolStats.connectedMiners} Miner(s)`);

		$("#networkHashRate").text(_formatter(value.networkStats.networkHashrate, 2, "H/s"));
		$("#networkDifficulty").text(_formatter(value.networkStats.networkDifficulty, 5, ""));

		const blocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=50000");

		let pendingCount = 0;
		let confirmedCount = 0;
		let reward = 0;
		let effortsum = 0;
		let allblocks = 0;

		for (let i = 0; i < blocksResponse.length; i++) 
		{
			const b = blocksResponse[i];

			if (b.status === "pending") pendingCount++;
			if (b.status === "confirmed")
			{
				confirmedCount++;
				if (!reward) reward = b.reward;
			}

			if (typeof b.effort !== "undefined")
			{
				effortsum += (b.effort * 100);
				allblocks++;
			}
		}

		effortsum = allblocks > 0 ? (effortsum / allblocks).toFixed(2) : 0;

		if (allblocks > 0)
		{
			$("#poolEffort").html(
				"Current Effort:" + poolEffort.toFixed(2) +" %" +
				"<br>Average Effort: " + effortsum + " %"
			);
		}
		else
		{
			$("#poolEffort").html("Current Effort:" + poolEffort.toFixed(2) +" %");
		}

		var networkHashRate = value.networkStats.networkHashrate;
		var poolHashRate = value.poolStats.poolHashrate;

		var blockTime;

		if (confirmedCount >= 2)
		{
			var ancient = blocksResponse[blocksResponse.length - 1];
			var recent = blocksResponse[0];

			blockTime =
				(new Date(recent.created) - new Date(ancient.created)) / 1000 /
				(recent.blockHeight - ancient.blockHeight);
		}
		else
		{
			blockTime = value.blockRefreshInterval;
		}

		var ttf_blocks = (networkHashRate / poolHashRate) * blockTime;

		var NetworkBlocks24hrs = (86400 / blockTime);
		var PoolBlocks24hrs = (86400 / ttf_blocks);

		var NetworkEmissionsPerDay = NetworkBlocks24hrs * reward;
		var PoolEmissionsPerDay = PoolBlocks24hrs * reward;

		$("#text_TTFBlocks").html(
			"Net. Blocktime: " + formatTime(blockTime) +
			"<br>Pool TTF: " + readableSeconds(ttf_blocks)
		);

		$("#text_BlockReward, #blockreward").text(
			Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(reward) +
			" (" + value.coin.type + ")"
		);

		$("#text_BlocksPending").text(pendingCount.toLocaleString());
		$("#poolBlocks").text(confirmedCount.toLocaleString());

		// =========================
		// PRICE OUTPUT (clean)
		// =========================

		var NetworkUSD = NetworkEmissionsPerDay * getcoin_price;
		var PoolUSD = PoolEmissionsPerDay * getcoin_price;

		$("#value, #coinvalue").html(
			"Coin Price: " +
			Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 9 }).format(getcoin_price) +
			"<br>Block Value: " +
			Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(getcoin_price * reward)
		);

		$("#Emissions").html(
			"Network: " + _formatter(NetworkEmissionsPerDay, 3, "") + " " + value.coin.type +
			" (" + Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(NetworkUSD) + ")<br>" +
			"Pool: " + _formatter(PoolEmissionsPerDay, 2, "") + " " + value.coin.type +
			" (" + Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(PoolUSD) + ")"
		);

		loadWorkerTTFBlocks();
	}
	catch (error) 
	{
		console.error(error);
	}
}

// STATS page charts
function loadStatsChart() {
  return $.ajax(API + "pools/" + currentPool + "/performance")
    .done(function(data) {
      labels = [];
	  
      poolHashRate = [];
      networkHashRate = [];
      networkDifficulty = [];
      connectedMiners = [];
      connectedWorkers = [];
      
      $.each(data.stats, function(index, value) {
        if (labels.length === 0 || (labels.length + 1) % 2 === 1) {
          var createDate = convertUTCDateToLocalDate(new Date(value.created),false);
          labels.push(createDate.getHours() + ":00");
        } else {
          labels.push("");
        }
		poolHashRate.push(value.poolHashrate);
        networkHashRate.push(value.networkHashrate);
		networkDifficulty.push(value.networkDifficulty);
        connectedMiners.push(value.connectedMiners);
        connectedWorkers.push(value.connectedWorkers);
      });
	  
      var dataPoolHash          = {labels: labels,series: [poolHashRate]};
      var dataNetworkHash       = {labels: labels,series: [networkHashRate]};
      var dataNetworkDifficulty = {labels: labels,series: [networkDifficulty]};
      var dataMiners            = {labels: labels,series: [connectedMiners,connectedWorkers]};
	  
	  var options = {
		height: "200px",
        showArea: false,
        seriesBarDistance: 1,
        // low:Math.min.apply(null,networkHashRate)/1.1,
        axisX: {
          showGrid: false
        },
        axisY: {
          offset: 47,
          scale: "logcc",
          labelInterpolationFnc: function(value) {
            return _formatter(value, 1, "");
          }
        },
        lineSmooth: Chartist.Interpolation.simple({
          divisor: 2
        })
      };
	  
      var responsiveOptions = [
        [
          "screen and (max-width: 320px)",
          {
            axisX: {
              labelInterpolationFnc: function(value) {
                return value[1];
              }
            }
          }
        ]
      ];
      Chartist.Line("#chartStatsHashRate", dataNetworkHash, options, responsiveOptions);
      Chartist.Line("#chartStatsHashRatePool",dataPoolHash,options,responsiveOptions);
      Chartist.Line("#chartStatsDiff", dataNetworkDifficulty, options, responsiveOptions);
      Chartist.Line("#chartStatsMiners", dataMiners, options, responsiveOptions);
 
    })
    .fail(function() {
      $.notify(
        {
          message: "Error: No response from API.<br>(loadStatsChart)"
        },
        {
          type: "danger",
          timer: 3000
        }
      );
    });
}

// Seconds to Days/hours/minutes/seconds
function formatTime(timeInSeconds) 
{
	var days = Math.floor(timeInSeconds / (3600 * 24));
	timeInSeconds = timeInSeconds % (3600 * 24);
	var hours = Math.floor(timeInSeconds / 3600);
	timeInSeconds = timeInSeconds % 3600;
	var minutes = Math.floor(timeInSeconds / 60);
	var seconds = Math.floor(timeInSeconds % 60);
	var result = "";
	if (days > 0) 
	{
		result += days + "d ";
	}
	if (hours > 0 || result.length > 0) {
		result += hours + "h ";
	}
	if (minutes > 0 || result.length > 0) {
		result += minutes + "m ";
	}
	result += seconds + "s";
	return result;
}

// Milliseconds to Days/hours/minutes/seconds
function formatMilliseconds(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000) % 60;
  let minutes = Math.floor(milliseconds / (1000 * 60)) % 60;
  let hours = Math.floor(milliseconds / (1000 * 60 * 60)) % 24;
  let days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  let result = "";
  if (days > 0) result += days + "d ";
  if (hours > 0) result += hours + "h ";
  if (minutes > 0) result += minutes + "m ";
  result += seconds + "s";
  return result;
}

// DASHBOARD page data
function loadUserBalanceData(walletAddress) {
	console.log('Loading user balance data...');
	return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/payments")
	.done(function (data) {
		if (data.length > 0)
		{
			var datetime = data[0].created;
			var date = datetime.split("T")[0];
			var time = datetime.split("T")[1].split(".")[0];
			var currentTime = new Date();
			var createdTime = new Date(datetime);
			var timeDifference = currentTime - createdTime;
			$("#lastPayment").html(formatMilliseconds(timeDifference) + " ago" + "<br>" + "Amount: " + _formatter(data[0].amount, 5, ""));
		}
		else 
		{
			$("#lastPayment").html("No payments received");
		}
    })
    .fail(function () {
      $.notify({
        message: "Error: No response from API.<br>(UserBalanceData)"
      },
        {
          type: "danger",
          timer: 3000
        }
      );
    }
  );
}

// Worker TTF Blocks
async function loadWorkerTTFBlocks(walletAddress) {
	console.log("Loading worker TTF Blocks");
	try 
	{
		const response = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress);
		var workerHashRate = 0;
		var workerSharesPerSecond = 0;
		var pendingShares = response.pendingShares
		if (response.performance) 
		{
			$.each(response.performance.workers, function (index, value) 
			{
				workerHashRate += value.hashrate;
				workerSharesPerSecond += value.sharesPerSecond
			});
			// console.log("Worker Shares Per Second: " + workerSharesPerSecond);

			const minersResponse = await $.ajax(API + "pools/" + currentPool + "/miners?page=0&pagesize=50");
			const sharesPerSecond = minersResponse.map(miner => miner.sharesPerSecond);
			var totalPoolSharesPerSecond = sharesPerSecond.reduce((sum, value) => sum + value, 0);
			var minersShareRatio = workerSharesPerSecond / totalPoolSharesPerSecond;
			// console.log("Miners Share Ratio: " + minersShareRatio);
			// console.log("Total Pool Shares Per Second: " + totalPoolSharesPerSecond);
			// console.log("Miners Shares Per Second: " + workerSharesPerSecond);

			const poolsResponse = await $.ajax(API + "pools");
			var blockHeights = [];
			var blockTimes = [];
			$.each(poolsResponse.pools, async function (index, value) 
			{
				if (currentPool === value.id) 
				{
					var networkHashRate = value.networkStats.networkHashrate;
					var poolHashRate = value.poolStats.poolHashrate;
					var poolFeePercentage = value.poolFeePercent;
					var currentBlockheight = value.networkStats.blockHeight;
					var currentBlockheightTime = value.networkStats.lastNetworkBlockTime;
					blockHeights.push(currentBlockheight);
					blockTimes.push(currentBlockheightTime);
					if (blockHeights.length > 1000) 
					{
						blockHeights.shift();
						blockTimes.shift();
					}
					var totalTime = 0;
					for (var i = 1; i < blockHeights.length; i++) 
					{
						var timeDifference = blockTimes[i] - blockTimes[i - 1];
						totalTime += timeDifference;
					}
					var averageTime = totalTime / (blockHeights.length - 1);
					// console.log("Average block time: " + averageTime + " ms");
					
					const blocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=1000");
					let pendingCount = 0;
					for (let i = 0; i < blocksResponse.length; i++) 
					{
						const currentBlock = blocksResponse[i];
						if (currentBlock.status === "pending") 
						{
							pendingCount++;
						}
					}
					let confirmedCount = 0;
					for (let i = 0; i < blocksResponse.length; i++) 
					{
						const currentBlock = blocksResponse[i];
						if (currentBlock.status === "confirmed") 
						{
							confirmedCount++;
						}
					}
					// console.log("Total Pending Blocks:", pendingCount);

					let reward = 0;
					for (let i = 0; i < blocksResponse.length; i++) 
					{
						const currentBlock = blocksResponse[i];
						if (currentBlock.status === "confirmed") 
						{
							reward = currentBlock.reward;
							break;
						}
					}

					const blocks2Response = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress+ "/blocks?page=0&pageSize=1000");
					var blocksConfirmedByMiner = 0;
					for (let i = 0; i < blocks2Response.length; i++) 
					{
						const currentBlock = blocks2Response[i];
						if (currentBlock.status === "confirmed") 
						{
							blocksConfirmedByMiner++;
						}
					}
					var blocksPendingByMiner = 0;
					for (let i = 0; i < blocks2Response.length; i++) 
					{
						const currentBlock = blocks2Response[i];
						if (currentBlock.status === "pending") 
						{
							blocksPendingByMiner++;
						}
					} 
					var totalCoinsPending = Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(pendingCount * reward)
					var poolFeePercentage = (poolFeePercentage / 100);
					var workersPoolSharePercent = (workerHashRate / poolHashRate);
					var workersNetSharePercent = (workerHashRate / networkHashRate);
					var immatureWorkerBalance = ((totalCoinsPending * poolFeePercentage) * minersShareRatio) * 100;
					var immatureWorkerBalance2 = ((totalCoinsPending * poolFeePercentage) * workersPoolSharePercent) * 100;
					if (confirmedCount >= 2)
					{
						var ancientBlock = blocksResponse[blocksResponse.length - 1];
						var recentBlock = blocksResponse[0];
						var MostRecentBlockTime = recentBlock.created;
						var MostRecentBlockHeight = recentBlock.blockHeight;
						var MostAncientBlockTime = ancientBlock.created;
						var MostAncientBlockHeight = ancientBlock.blockHeight;
						var MostRecentBlockTimeInSeconds = new Date(MostRecentBlockTime).getTime() / 1000;
						var MostAncientBlockTimeInSeconds = new Date(MostAncientBlockTime).getTime() / 1000;
						var blockTime = (MostRecentBlockTimeInSeconds - MostAncientBlockTimeInSeconds) / (MostRecentBlockHeight - MostAncientBlockHeight);
						var ttf_blocks = (networkHashRate / workerHashRate) * blockTime;
						var blocksPer24Hrs = (86400 / ttf_blocks);
						var MinersCoin = (reward) * (86400 / blockTime) * (workerHashRate / networkHashRate);
						$("#MinersCoins").html("Coins: " + MinersCoin.toLocaleString() + "<br>" + "Blocks: " + blocksPer24Hrs.toFixed(2));
						$("#MinersShare").html("Pool Share: " + _formatter((workersPoolSharePercent) * 100, 2, "%") + "<br>" + "Net. Share: " + _formatter((workersNetSharePercent) * 100, 2, "%"));
						$("#BlocksByMiner").html("Pending: " + blocksPendingByMiner + "<br>" + "Confirmed: " + blocksConfirmedByMiner);
						$("#TTF_Blocks").html(readableSeconds(ttf_blocks));
						$("#Blocktime").html(formatTime(blockTime));
						$("#pendingBalance").html(("Shares: " + _formatter(pendingShares, 2, "") + "<br>" + "Coins: " + Intl.NumberFormat().format(immatureWorkerBalance2)));
						$("#ConfirmedBlocks").text(confirmedCount.toLocaleString());
					}
					else
					{
						var blockTime = value.blockRefreshInterval;
						var ttf_blocks = (networkHashRate / workerHashRate) * blockTime;
						var blocksPer24Hrs = (86400 / ttf_blocks);
						var MinersCoin = (reward) * (86400 / blockTime) * (workerHashRate / networkHashRate);
						$("#MinersCoins").html("Coins: " + MinersCoin.toLocaleString() + "<br>" + "Blocks: " + blocksPer24Hrs.toFixed(2));
						$("#MinersShare").html("Pool Share: " + _formatter((workersPoolSharePercent) * 100, 2, "%") + "<br>" + "Net. Share: " + _formatter((workersNetSharePercent) * 100, 2, "%"));
						$("#BlocksByMiner").html("Pending: " + blocksPendingByMiner + "<br>" + "Confirmed: " + blocksConfirmedByMiner);
						$("#TTF_Blocks").html(readableSeconds(ttf_blocks));
						$("#Blocktime").html(formatTime(blockTime));
						$("#pendingBalance").html(("Shares: " + _formatter(pendingShares, 2, "") + "<br>" + "Coins: " + Intl.NumberFormat().format(immatureWorkerBalance2)));
						$("#ConfirmedBlocks").text(confirmedCount.toLocaleString());
					}
					var minimumPayment = value.paymentProcessing.minimumPayment;
					$.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/settings").done(function(data){
						var paymentThreshold = data['paymentThreshold'];
						$("#minPayment").html(Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(paymentThreshold) + " " + value.coin.type + "<br>" + "(" + value.paymentProcessing.payoutScheme + ")");
						console.log("Minimum Payment:", paymentThreshold);
					})
					.fail(function() 
					{
						$("#minPayment").html(Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0}).format(minimumPayment) + " " +  value.coin.type + "<br>" + "(" + value.paymentProcessing.payoutScheme + ")");
						console.log("Minimum Payment:", minimumPayment);
					});
				}
			});
		}
	} catch (error) {
		console.error(error);
	}
}

// Load Dashboard page data
function loadDashboardData(walletAddress) {
	console.log('Loading dashboard data...');
	return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress)
	.done(function (data) 
	{
		$("#pendingShares").text("Shares: " + _formatter(data.pendingShares, 3, ""));
		var workerHashRate = 0;
		var bestWorker = null;
		if (data.performance) 
		{
			$.each(data.performance.workers, function (index, value) 
			{
				workerHashRate += value.hashrate;
				if (!bestWorker || value.hashrate > bestWorker.hashrate) 
				{
					bestWorker = { name: index, hashrate: value.hashrate };
				}
			});
		}
		$("#minerHashRate").text(_formatter(workerHashRate, 3, "H/s"));
		$("#pendingBalance2").text(_formatter(data.pendingBalance, 2, ""));
		$("#paidBalance").html("24hr Paid: " + _formatter(data.todayPaid, 2, "") + "<br>" + "Lifetime Paid: " + _formatter(data.pendingBalance + data.totalPaid, 2, ""));
		$("#lifetimeBalance").text(_formatter(data.pendingBalance + data.totalPaid, 2, ""));
		if (bestWorker && bestWorker.name) 
		{
			$("#BestminerHashRate").text(bestWorker.name + ": " + _formatter(bestWorker.hashrate, 2, "H/s"));
		} 
		else 
		{
			$("#BestminerHashRate").text("N/A");
		}
		if (data.totalPaid === 0) 
		{
			$("#lastPaymentLink").html("No payments received");
		} 
		else 
		{
			$("#lastPaymentLink").html("Explorer: <a href='" + data.lastPaymentLink + "' target='_blank'>" + "Click Here" + "</a>");
		}
		loadHomePage();
    })
    .fail(function () {
      $.notify(
        {
          message: "Error: No response from API.<br>(loadDashboardData)"
        },
        {
          type: "danger",
          timer: 3000
        }
      );
    });
}

// DASHBOARD page Miner table
async function loadDashboardWorkerList(walletAddress)
{
	console.log('Loading Worker List...');
	try
	{
		const response = await $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress);
		const data = await $.ajax(API + "pools");
		const poolsResponse = data.pools.find(pool => currentPool === pool.id);
		const blocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=50000");
		if (!poolsResponse) 
		{
			throw new Error("Pool not found");
		}
		
		var workerList = "";
		if (response.performance) 
		{
			var workerCount = 0;
			var minerTotalHashRep   = 0;
			var minerTotalHash      = 0;
			var minerTotalHash2     = 0;
			var minerTotalHash3     = 0;
			var minerTotalEarn      = 0;
			var workerHashRate = 0;
			var workerSharesPerSecond = 0;
			var minerTotalSharesPerSecond = 0;
			var coinsymbol = poolsResponse.coin.type;
				
			$.each(response.performance.workers, function(index, value) 
			{
				var hashSum         = 0;
				var hashSum2        = 0;
				var hashSum3        = 0;
				var newDate         = new Date().getTime();
				var periodHours     = 6;
				var periodHours2    = 12;
				var periodHours3    = 24; 
				
				workerHashRate = value.hashrate;
				workerSharesPerSecond = value.sharesPerSecond;
				minerTotalSharesPerSecond += value.sharesPerSecond;
				
				$.each(response.performanceSamples, function(index2, value2) 
				{
					var dateJson = convertUTCDateToLocalDate(new Date(value2.created),false).getTime();
					if (newDate-dateJson < (periodHours * 1.5 * 3600000) && index2 >= response.performanceSamples.length -periodHours) 
					{
						$.each(value2.workers, function(index3, value3) 
						{
							if (index3 === index) 
							{
								hashSum += value3.hashrate;
							}
						});
					}
					if (newDate-dateJson < (periodHours2 * 1.5 * 3600000) && index2 >= response.performanceSamples.length -periodHours2) 
					{
						$.each(value2.workers, function(index3, value3) 
						{
							if (index3 === index) 
							{
								hashSum2 += value3.hashrate;
							}
						});
					}
					$.each(value2.workers, function(index3, value3) 
					{
						if (index3 === index) 
						{
							hashSum3 += value3.hashrate;
						}
					});
				}); 
			
				var hashAvg         = hashSum/periodHours;
				var hashAvg2        = hashSum2/periodHours2;
				var hashAvg3        = hashSum3/periodHours3;
				minerTotalHash      += hashAvg;
				minerTotalHash2     += hashAvg2;
				minerTotalHash3     += hashAvg3;
				minerTotalHashRep   += value.hashrate;
			
				if (hashSum     === 0) { hashAvg    = "" }
				if (hashSum2    === 0) { hashAvg2   = "" }
				if (hashSum2    === 0) { hashAvg3   = "" }
			
				var blockHeights = [];
				var blockTimes = [];
				var networkHashRate = poolsResponse.networkStats.networkHashrate;
				let reward = 0;
				for (let i = 0; i < blocksResponse.length; i++) 
				{
					const currentBlock = blocksResponse[i];
					if (currentBlock.status === "confirmed") 
					{
						reward = currentBlock.reward;
						break;
					}
				}

				let confirmedCount = 0;
				for (let i = 0; i < blocksResponse.length; i++) 
				{
					const currentBlock = blocksResponse[i];
					if (currentBlock.status === "confirmed") 
					{
						confirmedCount++;
					}
				}

				if (confirmedCount >= 2)
				{
					var ancientBlock = blocksResponse[blocksResponse.length - 1];
					var recentBlock = blocksResponse[0];
					var MostRecentBlockTime = recentBlock.created;
					var MostRecentBlockHeight = recentBlock.blockHeight;
					var MostAncientBlockTime = ancientBlock.created;
					var MostAncientBlockHeight = ancientBlock.blockHeight;
					var MostRecentBlockTimeInSeconds = new Date(MostRecentBlockTime).getTime() / 1000;
					var MostAncientBlockTimeInSeconds = new Date(MostAncientBlockTime).getTime() / 1000;
					var blockTime = (MostRecentBlockTimeInSeconds - MostAncientBlockTimeInSeconds) / (MostRecentBlockHeight - MostAncientBlockHeight);
				}
				else
				{
					var blockTime = poolsResponse.blockRefreshInterval;
				}
				var earnPerDay  = reward * (hashAvg/networkHashRate) * (86400/blockTime);
				minerTotalEarn  += earnPerDay;
				workerCount++;
				workerList += "<tr>";
				workerList += "<td>" + workerCount + "</td>";
				if (index.length === 0) 
				{
					workerList += "<td>Unnamed</td>";
				} 
				else 
				{
					workerList += "<td>" + index + "</td>";
				}
				workerList += "<td>" + _formatter(workerHashRate, 3, "H/s") + "</td>";
				workerList += "<td>" + _formatter(hashAvg, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(hashAvg2, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(hashAvg3, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(workerSharesPerSecond, 3, "S/s") + "</td>";
				workerList += "<td>" + _formatter(earnPerDay, 5, " " + coinsymbol) + "</td>";
			});
			if (workerCount > 1)
			{
				workerList += "<tr>";
				workerList += "<td>Total</td>";
				workerList += "<td>"+workerCount+" Worker</td>";
				workerList += "<td>" + _formatter(minerTotalHashRep, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(minerTotalHash, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(minerTotalHash2, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(minerTotalHash3, 2, "H/s") + "</td>";
				workerList += "<td>" + _formatter(minerTotalSharesPerSecond, 3, "S/s") + "</td>";
				workerList += "<td>" + _formatter(minerTotalEarn, 5, " " + coinsymbol) + "</td>";
				workerList += "</tr>";
			}
		} 
		else 
		{
			workerList += '<tr><td colspan="4">None</td></tr>';
		}
		$("#workerCount").text(workerCount);
		$("#workerList").html(workerList);
	}
	catch (error) 
	{
		console.error(error);
	}
}

// DASHBOARD page chart
function loadDashboardChart(walletAddress) {
  return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/performance")
    .done(function(data) {

		labels = [];
        minerHashRate = [];
		
        $.each(data, function(index, value) {
          if (labels.length === 0 || (labels.length + 1) % 2 === 1) {
            var createDate = convertUTCDateToLocalDate(
              new Date(value.created),
              false
            );
            labels.push(createDate.getHours() + ":00");
          } else {
            labels.push("");
          }
          var workerHashRate = 0;
          $.each(value.workers, function(index2, value2) {workerHashRate += value2.hashrate;});
          minerHashRate.push(workerHashRate);
        });
        var data = {labels: labels,series: [minerHashRate]};
        var options = {
          height: "200px",
		  showArea: true,
		  seriesBarDistance: 1,
          axisX: {
            showGrid: false
          },
          axisY: {
            offset: 47,
            labelInterpolationFnc: function(value) {
              return _formatter(value, 1, "");
            }
          },
          lineSmooth: Chartist.Interpolation.simple({
            divisor: 2
          })
        };
        var responsiveOptions = [
          [
          "screen and (max-width: 320px)",
          {
            axisX: {
              labelInterpolationFnc: function(value) {
                return value[0];
              }
            }
          }
        ]
        ];
        Chartist.Line("#chartDashboardHashRate", data, options, responsiveOptions);

    })
    .fail(function() {
      $.notify(
        {
          message: "Error: No response from API.<br>(loadDashboardChart)"
        },
        {
          type: "danger",
          timer: 3000
        }
      );
    });
}

// Generate Coin based sidebar
function loadNavigation() {
  return $.ajax(API + "pools")
    .done(function(data) {
	  var coinLogo = "";
	  var coinName = "";
	  var poolList = "<ul class='navbar-nav '>";
      $.each(data.pools, function(index, value) {
		poolList += "<li class='nav-item'>";
        poolList += "  <a href='#" + value.id.toLowerCase() + "' class='nav-link coin-header" + (currentPool == value.id.toLowerCase() ? " coin-header-active" : "") + "'>"
		poolList += "  <img  src='img/coin/icon/" + value.coin.type.toLowerCase() + ".png' /> " + value.coin.type;
        poolList += "  </a>";
		poolList += "</li>";
		if (currentPool === value.id) {
			coinLogo = "<img style='width:40px' src='img/coin/icon/" + value.coin.type.toLowerCase() + ".png' />";
			coinName = (value.coin.canonicalName) ? value.coin.canonicalName : value.coin.name;
			if (typeof coinName === "undefined" || coinName === null) {
				coinName = value.coin.type;
			}
		coinScheme = value.paymentProcessing.payoutScheme; 
		}
      });
      poolList += "</ul>";
	  
      if (poolList.length > 0) {
        $(".coin-list-header").html(poolList);
      }
	  
	var sidebarList = "";
	const sidebarTemplate = $(".sidebar-template").html();
      	sidebarList += sidebarTemplate
		.replace(/{{ coinId }}/g, currentPool)
		.replace(/{{ coinLogo }}/g, coinLogo)
		.replace(/{{ coinName }}/g, coinName)
      	$(".sidebar-wrapper").html(sidebarList);
	$("a.link").each(function() {
	if (localStorage[currentPool + "-walletAddress"] && this.href.indexOf("/dashboard") > 0)
	{
		this.href = "#" + currentPool + "/dashboard?address=" + localStorage[currentPool + "-walletAddress"];
	} 
      });

    })
    .fail(function() {
      $.notify(
        {
          message: "Error: No response from API.<br>(loadNavigation)"
        },
        {
          type: "danger",
          timer: 3000
        }
      );
    });
}

// Dashboard - load wallet stats
function submitSettings() {
  return $.ajax({
    url: API + "pools/" + currentPool + "/miners/" + localStorage[currentPool + "-walletAddress"] + "/settings",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      ipAddress: $("#ipAddress").val(),
      settings: {
        paymentThreshold: $("#minimumPayout").val()
      }
    })
  })
    .done(function (data) {
      $('#updateSuccess').show();
      $("#minimumPayout").val(data.paymentThreshold);

      setTimeout(function () {
        $('#updateSuccess').hide();
      }, 5000);
    })
    .fail(function () {
      $('#updateFailed').show();

      setTimeout(function () {
        $('#updateFailed').hide();
      }, 5000);
    });
}

// --------------------------------------------------------------------------------------------
// ULTRA-FAST SERVER PING MONITORING SYSTEM
// --------------------------------------------------------------------------------------------

// Server configuration - UPDATED with your actual servers
var servers = [
    { name: "Europe (UK)", host: "meowpool.net", region: "europe", location: "United Kingdom" }
];

// Store ping results
var serverPingResults = {};
var bestServer = null;
var pingInterval = null;

// Ultra-fast ping implementation using Nginx endpoint
function pingServer(server) {
    return new Promise((resolve) => {
        // Take 3 measurements and use the best one for accuracy
        const measurements = [];
        let completed = 0;
        const timeout = 5000; // 5 second timeout

        function takeMeasurement(attemptNum) {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            // Use the ultra-fast /p endpoint (204 No Content response)
            fetch(`https://${server.host}/p?_=${Date.now()}&attempt=${attemptNum}`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                signal: controller.signal,
                // Keep connection alive for better performance
                keepalive: true
            })
            .then(response => {
                clearTimeout(timeoutId);
                const ping = Math.round(performance.now() - startTime);
                measurements.push(ping);
                completed++;
                
                if (completed === 3) {
                    // Use the minimum (best) measurement
                    const bestPing = Math.min(...measurements);
                    const avgPing = Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length);
                    resolve({
                        server: server,
                        ping: bestPing,
                        avgPing: avgPing,
                        status: 'online',
                        measurements: measurements
                    });
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.log(`Ping attempt ${attemptNum} failed for ${server.host}:`, error.message);
                completed++;
                
                if (completed === 3) {
                    if (measurements.length > 0) {
                        const bestPing = Math.min(...measurements);
                        const avgPing = Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length);
                        resolve({
                            server: server,
                            ping: bestPing,
                            avgPing: avgPing,
                            status: 'degraded',
                            measurements: measurements
                        });
                    } else {
                        resolve({
                            server: server,
                            ping: -1,
                            avgPing: -1,
                            status: 'offline',
                            measurements: []
                        });
                    }
                }
            });
        }

        // Take 3 measurements with slight delays to avoid congestion
        takeMeasurement(1);
        setTimeout(() => takeMeasurement(2), 100);
        setTimeout(() => takeMeasurement(3), 200);
    });
}

// Ping all servers simultaneously
async function pingAllServers() {
    console.log('Pinging all servers...');
    
    try {
        // Ping all servers in parallel for maximum speed
        const pingPromises = servers.map(server => pingServer(server));
        const results = await Promise.all(pingPromises);
        
        // Process results
        results.forEach(result => {
            serverPingResults[result.server.host] = {
                name: result.server.name,
                host: result.server.host,
                region: result.server.region,
                location: result.server.location,
                ping: result.ping,
                avgPing: result.avgPing,
                status: result.status,
                lastUpdate: Date.now(),
                measurements: result.measurements
            };
        });
        
        // Find the best server (lowest ping among online servers)
        const onlineServers = results.filter(r => r.status === 'online' || r.status === 'degraded');
        if (onlineServers.length > 0) {
            bestServer = onlineServers.reduce((best, current) => 
                (current.ping < best.ping && current.ping > 0) ? current : best
            );
            console.log('Best server:', bestServer.server.host, bestServer.ping + 'ms');
        }
        
        // Update the display
        updateServerPingTable();
        
    } catch (error) {
        console.error('Error pinging servers:', error);
    }
}

// Initialize server ping monitoring
function initServerPingMonitoring() {
    // Only run on the main index page
    if (currentPage !== "index") return;
    
    console.log('Initializing ultra-fast server ping monitoring...');
    
    // Initialize results for each server
    servers.forEach(server => {
        serverPingResults[server.host] = {
            name: server.name,
            host: server.host,
            region: server.region,
            location: server.location,
            ping: -1,
            status: 'connecting',
            lastUpdate: null
        };
    });
    
    // Start pinging servers
    pingAllServers();
    
    // Update every 10 seconds for faster updates
    if (pingInterval) {
        clearInterval(pingInterval);
    }
    
    pingInterval = setInterval(() => {
        pingAllServers();
    }, 10000);
}

// Update the server ping table
function updateServerPingTable() {
    const tbody = document.getElementById('serverPingList');
    if (!tbody) return;
    
    // Convert results to array and sort by ping (lowest first)
    const sortedServers = Object.values(serverPingResults)
        .sort((a, b) => {
            // Online servers with valid pings come first
            if (a.ping > 0 && b.ping > 0) return a.ping - b.ping;
            if (a.ping > 0) return -1;
            if (b.ping > 0) return 1;
            return 0;
        });
    
    // Build table HTML
    let tableHTML = '';
    sortedServers.forEach((server, index) => {
        const rank = server.ping > 0 ? index + 1 : '-';
        const regionFlag = getRegionFlag(server.region);
        const statusClass = getStatusClass(server.status);
        const pingDisplay = server.ping > 0 ? `${server.ping}ms` : '-';
        const statusIcon = getStatusIcon(server.status);
        const isBest = server.ping > 0 && index === 0;
        
        tableHTML += `
            <tr class="${isBest ? 'best-server' : ''}">
                <td>
                    <div class="rank-badge ${isBest ? 'rank-best' : ''}">
                        ${rank}
                    </div>
                </td>
                <td>
                    <strong>${server.name}</strong>
                    ${isBest ? '<span class="badge badge-success ml-2">⚡ FASTEST</span>' : ''}
                </td>
                <td>${regionFlag} ${server.location}</td>
                <td class="ping-cell">
                    <span class="${statusClass}">
                        ${pingDisplay}
                    </span>
                    ${server.ping > 0 ? getPingQualityBar(server.ping) : ''}
                </td>
                <td>
                    <span class="status-indicator ${statusClass}">
                        ${statusIcon} ${server.status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = tableHTML;
}

// Connect to a specific server
function connectToServer(serverHost) {
    console.log(`Connecting to server: ${serverHost}`);
    
    // Update API to use selected server
    API = `https://${serverHost}/api/`;
    console.log('Updated API address:', API);
    
    // Store the selected server
    localStorage.setItem('selectedServer', serverHost);
    
    // Show success message
    $.notify({
        message: `Connected to ${serverHost}! 🚀`
    }, {
        type: "success",
        timer: 3000
    });
    
    // Reload current page with new server
    loadIndex();
}

// Get region flag emoji
function getRegionFlag(region) {
    const flags = {
        'us': '🇺🇸',
        'asia': '🌏',
        'oceania': '🇦🇺',
        'europe': '🇪🇺'
    };
    return flags[region] || '🌍';
}

// Get status class for styling
function getStatusClass(status) {
    switch(status) {
        case 'online': return 'status-online text-success';
        case 'degraded': return 'status-degraded text-warning';
        case 'offline': return 'status-offline text-danger';
        case 'connecting': return 'status-connecting text-info';
        default: return '';
    }
}

// Get status icon
function getStatusIcon(status) {
    switch(status) {
        case 'online': return '✓';
        case 'degraded': return '⚠';
        case 'offline': return '✗';
        case 'connecting': return '⟳';
        default: return '';
    }
}

// Get ping quality bar
function getPingQualityBar(ping) {
    let quality = 'excellent';
    let width = '100%';
    let color = '#28a745'; // Green
    
    if (ping > 200) {
        quality = 'poor';
        width = '25%';
        color = '#dc3545'; // Red
    } else if (ping > 100) {
        quality = 'fair';
        width = '50%';
        color = '#ffc107'; // Yellow
    } else if (ping > 50) {
        quality = 'good';
        width = '75%';
        color = '#17a2b8'; // Blue
    }
    
    return `<div class="ping-quality-bar" style="width: 30px; height: 4px; background: #e9ecef; border-radius: 2px; display: inline-block; margin-left: 8px;"><div style="width: ${width}; height: 100%; background: ${color}; border-radius: 2px;"></div></div>`;
}

// Stop ping monitoring
function stopPingMonitoring() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
        console.log('Stopped ping monitoring');
    }
}

// Auto-select best server on page load
function autoSelectBestServer() {
    const savedServer = localStorage.getItem('selectedServer');
    if (savedServer && servers.find(s => s.host === savedServer)) {
        // Use saved server
        API = `https://${savedServer}/api/`;
        console.log('Using saved server:', savedServer);
    } else if (bestServer && bestServer.server) {
        // Use best performing server
        API = `https://${bestServer.server.host}/api/`;
        console.log('Auto-selected best server:', bestServer.server.host);
        localStorage.setItem('selectedServer', bestServer.server.host);
    }
}

// Initialize on document ready
$(document).ready(function() {
    console.log('Document ready - initializing ping system...');
    
    // Initialize ping monitoring when on index page
    if (window.location.hash === '' || window.location.hash === '#' || window.location.hash === '#index') {
        setTimeout(initServerPingMonitoring, 1000);
    }
    
    // Auto-select best server after initial ping results
    setTimeout(autoSelectBestServer, 8000);
});

// Reinitialize when navigating back to index
$(window).on('hashchange', function() {
    const hash = window.location.hash;
    if (hash === '' || hash === '#' || hash === '#index') {
        setTimeout(initServerPingMonitoring, 500);
    } else {
        // Stop ping monitoring when not on index page
        stopPingMonitoring();
    }
});

// Stop ping system when page unloads
$(window).on('beforeunload', function() {
    stopPingMonitoring();
});
