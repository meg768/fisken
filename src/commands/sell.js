var sprintf  = require('yow/sprintf');
var Avanza   = require('../js/avanza.js');


var Module = new function() {

	var _argv = {};
	var _avanza = null;

	function defineArgs(args) {

		args.usage('Usage: $0 sell <options>');


		args.help('help').alias('help', 'h');

		args.option('account',    {alias:'a', describe:'Account ID', demand:true});
		args.option('instrument', {alias:'i', describe:'Instrument ID', demand:true});
		args.option('volume',     {alias:'v', describe:'Volume', demand:false});
		args.option('debug',      {alias:'d', describe:'Debug mode', default:false});

		args.wrap(null);

		args.check(function(argv, foo) {

			return true;

		});
	}

	function run(argv) {

		try {
			_avanza = new Avanza({username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD});
			_argv = argv;

			_avanza.login().then(function() {
				return _avanza.sell(argv.account, argv.instrument, argv.volume);
			})
			.then(function(json) {
				console.log(JSON.stringify(json, null, '    '));
			})
			.catch(function(error) {
				console.log(error);
			});


		}
		catch(error) {
			console.log(error);
		}
	}

	module.exports.command  = 'sell';
	module.exports.describe = 'Sell instrument';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
