var sprintf  = require('yow/sprintf');
var Avanza   = require('../js/avanza.js');

var Module = new function() {

	function defineArgs(args) {

		args.help('h').alias('h', 'help');
		args.option('d', {alias:'debug', describe:'Debug mode', default:false});
		args.wrap(null);

	}

	function run(argv) {

		try {
			var avanza = new Avanza({username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD});

			avanza.login().then(function() {

				avanza.getPositions(argv.account).then(function(positions) {

					if (argv.debug) {
						console.log(JSON.stringify(positions, null, '\t'));

					}
					else {

						var table = require('text-table');

						var list = [];
						var header = [];

						header.push(['ID', 'Name', 'Volume', 'Value', 'Ccy', 'Profit', 'Profit (%)', 'Type']);

						positions.instrumentPositions.forEach(function(instrumentPosition) {
							instrumentPosition.positions.forEach(function(position) {
								console.log(position);
								list.push([position.orderbookId, position.name, Math.round(position.volume), Math.round(position.value), position.currency, Math.round(position.profit), sprintf('%.1f', position.profitPercent), instrumentPosition.instrumentType]);

							});
						});

						console.log(table(header.concat(list), {align:['l', 'l', 'r', 'r', 'l', 'r', 'r', 'l']}));

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

	module.exports.command  = 'positions <account>';
	module.exports.describe = 'List all positions for a specific account';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
