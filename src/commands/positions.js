var sprintf  = require('yow/sprintf');
var Avanza   = require('../classes/avanza.js');
var config   = require('../../config.js');

var Module = new function() {

	function defineArgs(args) {

		args.help('h').alias('h', 'help');
		args.option('d', {alias:'debug', describe:'Debug mode', default:false});
		args.wrap(null);

	}

	function run(argv) {

		try {
			var avanza = new Avanza(config.credentials);

			avanza.login().then(function() {

				avanza.getPositions(argv.account).then(function(positions) {

					if (argv.debug) {
						console.log(JSON.stringify(positions, null, '\t'));

					}
					else {

						var table = require('text-table');

						var list = [];
						var header = [];

						header.push(['Name', 'ID', 'Volume', 'Value', 'Ccy', 'Type']);

						positions.instrumentPositions.forEach(function(instrumentPosition) {
							instrumentPosition.positions.forEach(function(position) {
								//console.log(position.name);
								list.push([position.name, position.orderbookId, Math.round(position.volume), Math.round(position.value), position.currency, instrumentPosition.instrumentType]);

							});
						});

						console.log(table(header.concat(list), {align:['l', 'r', 'r', 'r']}));

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
