var sprintf  = require('yow/sprintf');
var isArray  = require('yow/is').isArray;
var Avanza   = require('../js/avanza.js');


var Module = new function() {

	function defineArgs(args) {

		args.help('help').alias('help', 'h');

		args.usage('Usage: $0 search [query] <options>');

		args.option('debug',      {alias:'d', describe:'debug mode', default:false});
		args.option('type',       {alias:'t', describe:'Type of search', default:false, demand:false, choices:['all', 'stock', 'fund', 'bond', 'index', 'certificate'], default:'all'});

		args.wrap(null);

		args.check(function(argv, foo) {

			return true;

		});

	}

	function run(argv) {

		try {
			var avanza = new Avanza({username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD});

			avanza.login().then(function() {

				avanza.search(argv.query, argv.type == 'all' ? undefined : argv.type).then(function(json) {

					if (argv.debug)
						console.log(JSON.stringify(json, null, '    '));
					else {

						var table = require('text-table');

						var list = [];
						var header = [];
						var additionalHits = 0;

						header.push(['Type', 'ID', 'Name', 'Ticker', 'Price', 'Change %', 'Currency']);

						json.hits.forEach(function(hit) {

							if (isArray(hit.topHits)) {
								hit.topHits.forEach(function(topHit) {
									list.push([hit.instrumentType, topHit.id, topHit.name, topHit.tickerSymbol, topHit.lastPrice == null ? '-' : topHit.lastPrice, topHit.changePercent == null ? '-' : topHit.changePercent, topHit.currency == null ? '-' : topHit.currency]);
								});

							}
							else {
								additionalHits += hit.numberOfHits;
							}
						});

						if (list.length > 0) {
							console.log(table(header.concat(list), {align:['l', 'l', 'l', 'l', 'r', 'r', 'l']}));

							if (additionalHits > 0) {
								console.log(sprintf('%d additional hits found.', additionalHits));
							}

						}

					}


				})
				.catch(function(error) {
					console.log(error);
				});
			})
			.catch(function(error) {
				console.log(error);

			});
		}
		catch(error) {
			console.log(error);
		}
	}

	module.exports.command  = 'search <query>';
	module.exports.describe = 'Search';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
