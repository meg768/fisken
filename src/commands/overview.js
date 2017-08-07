var sprintf  = require('yow/sprintf');
var isArray  = require('yow/is').isArray;
var Avanza   = require('../js/avanza.js');


var Module = new function() {

	function defineArgs(args) {

		args.help('help').alias('help', 'h');

		args.usage('Usage: $0 overview [id] <options>');

		args.option('debug',      {alias:'d', describe:'debug mode', default:false});

		args.wrap(null);

		args.check(function(argv, foo) {

			return true;

		});

	}

	function run(argv) {

		try {
			var avanza = new Avanza();

			avanza.login().then(function() {
				var options = {};
				options.method = 'GET';
				options.url = sprintf('https://www.avanza.se/_mobile/account/%s/overview', argv.id);
				console.log(options);
				return avanza.request(options);
			})
			.then(function(json) {
				console.log(json);
			})
			.catch(function(error) {
				console.log(error.message);

			});
		}
		catch(error) {
			console.log(error);
		}
	}

	module.exports.command  = 'overview <id>';
	module.exports.describe = 'Overview';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
