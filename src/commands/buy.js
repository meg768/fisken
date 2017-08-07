var sprintf  = require('yow/sprintf');
var Avanza   = require('../js/avanza.js');

var Module = new function() {

	var _argv = {};
	var _avanza = null;

	function defineArgs(args) {

		args.help('help').alias('help', 'h');

		args.option('debug',      {alias:'d', describe:'debug mode', default:false});
		args.option('instrument', {alias:'i', describe:'instrument ID', demand:true});
		args.option('account',    {alias:'a', describe:'account ID', demand:true});
		args.option('volume',     {alias:'v', describe:'volume', demand:true});

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
				return _avanza.buy(argv.account, argv.instrument, argv.volume);
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

	module.exports.command  = 'buy';
	module.exports.describe = 'Buy instrument';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
