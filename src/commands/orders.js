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

				avanza.getOrders().then(function(json) {

					if (argv.debug)
						console.log(JSON.stringify(json, null, '    '));
					else {

						var table = require('text-table');

						var list = [];
						var header = [];

						header.push(['Order ID', 'Type', 'Instrument', 'Price', 'Volume', 'Status']);

						json.orders.forEach(function(order) {

							list.push([order.orderId, order.type, sprintf('%s (%d)', order.orderbook.name, order.orderbook.id), order.price, order.volume, order.status]);
						});

						console.log(table(header.concat(list), {align:['l','l', 'l', 'r', 'r', 'l']}));

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

	module.exports.command  = 'orders';
	module.exports.describe = 'Lists orders';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
