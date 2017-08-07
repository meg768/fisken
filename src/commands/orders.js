var sprintf  = require('yow/sprintf');
var Avanza   = require('../js/avanza.js');

var Module = new function() {

	var _argv = {};
	var _avanza = null;

	function defineArgs(args) {

		args.help('h').alias('h', 'help');

		args.option('d', {alias:'debug', describe:'Debug mode', default:false});
		args.option('x', {alias:'delete', describe:'Delete order', default:false});
		args.option('l', {alias:'list', describe:'List orders', default:false});
		args.option('i', {alias:'order', describe:'Order ID'});
		args.option('a', {alias:'account', describe:'Account ID'});

		args.wrap(null);

	}


	function deleteOrder() {
		return new Promise(function(resolve, reject) {
			try {
				if (!_argv.order)
					throw new Error('Order ID required');

				if (!_argv.account)
					throw new Error('Account ID required');

				_avanza.deleteOrder(_argv.account, _argv.order).then(function(json) {


					if (_argv.debug) {
						console.log(JSON.stringify(json, null, '    '));
					}
					else {
					}
					resolve();


				})
				.catch(function(error) {
					reject(error);
				});


			}
			catch(error) {
				reject(error);

			}
		});
	}

	function listOrders() {
		return new Promise(function(resolve, reject) {
			_avanza.getOrders().then(function(json) {

				if (_argv.debug) {
					console.log(JSON.stringify(json, null, '    '));
				}
				else {

					var table = require('text-table');

					var list = [];
					var header = [];

					header.push(['ID', 'Account', 'Type', 'Instrument', 'Price', 'Volume', 'Status']);

					json.orders.forEach(function(order) {

						list.push([order.orderId, sprintf('%s (%s)', order.account.name, order.account.id), order.type, sprintf('%s (%d)', order.orderbook.name, order.orderbook.id), order.price, order.volume, order.status]);
					});

					if (list.length > 0)
						console.log(table(header.concat(list), {align:['l','l', 'l', 'l', 'r', 'r', 'l']}));

				}
				resolve();


			})
			.catch(function(error) {
				reject(error);
			});

		});

	}

	function run(argv) {

		try {
			_avanza = new Avanza({username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD});
			_argv = argv;

			_avanza.login().then(function() {
				if (_argv.list)
					return listOrders();
				if (_argv.delete)
					return deleteOrder();

				return Promise.reject(new Error('Nothing to do'));

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
