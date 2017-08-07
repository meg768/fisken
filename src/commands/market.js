var sprintf  = require('yow/sprintf');
var isArray  = require('yow/is').isArray;
var Avanza   = require('../js/avanza.js');


var Module = new function() {

	function defineArgs(args) {

		args.help('help').alias('help', 'h');

		args.usage('Usage: $0 market [id] <options>');

		args.option('debug',      {alias:'d', describe:'debug mode', default:false});
		args.option('type',       {alias:'t', describe:'Type of X', default:false, demand:true, choices:['stock', 'fund', 'bond', 'index', 'certificate'], default:'stock'});

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
				options.path   = sprintf('_mobile/market/%s/%s', argv.type, argv.id);
				console.log(options);
				return avanza.request(options);
			})
			.then(function(json) {
				console.log(json);
			})
			.catch(function(error) {
				console.log(error);

			});
		}
		catch(error) {
			console.log(error);
		}
	}

	module.exports.command  = 'market <id>';
	module.exports.describe = 'Market';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
