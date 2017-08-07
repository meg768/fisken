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

				avanza.getAccounts().then(function(accounts) {

					if (argv.debug)
						console.log(accounts);
					else {

						var table = require('text-table');

						var list = [];
						var header = [];

						header.push(['ID', 'Name', 'Type', 'Balance', 'Capital', 'Buying power']);

						accounts.forEach(function(account) {

							list.push([account.id, account.name, account.type, Math.floor(account.totalBalance), Math.floor(account.ownCapital), Math.floor(account.buyingPower)]);
						});

						console.log(table(header.concat(list), {align:['l','l', 'l', 'r', 'r', 'r']}));

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

	module.exports.command  = 'accounts';
	module.exports.describe = 'List all accounts';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
