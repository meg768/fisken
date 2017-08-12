var sprintf  = require('yow/sprintf');
var Gopher   = require('yow/request');


var Module = new function() {

	var _argv = {};
	var _avanza = null;

	function defineArgs(args) {

		args.usage('Usage: $0 sell <options>');


		args.help('help').alias('help', 'h');

		args.wrap(null);

		args.check(function(argv, foo) {

			return true;

		});
	}


	function example2() {

		var Request = require('yow/request');
		var request = new Request('http://app-o.se', {
			headers: {'Content-Type': 'application/json'}
		});

		var options = {
			body:{
				user: "root",
				password: "XXX",
				query: "select symbol from stocks"

			}
		};

		request.get('/mysql/munch', options).then(function(response) {

			console.log(response);

		})

		.catch (function(error) {
			console.log(error);

		});


	}
	function example() {

		var Request = require('yow/request');
		var yahoo = new Request('https://query.yahooapis.com');

		function getQuote(ticker) {
			var query = {};

			query.q        = 'select * from yahoo.finance.quotes where symbol =  "' + ticker + '"';
			query.format   = 'json';
			query.env      = 'store://datatables.org/alltableswithkeys';
			query.callback = '';

			yahoo.get('/v1/public/yql', {query:query}).then(function(response) {
				var quotes = response.body.query.results.quote;

				if (typeof qoutes != 'Array')
					quotes = [quotes];

				console.log(ticker, '=', quotes[0].LastTradePriceOnly);

			})

			.catch (function(error) {
				console.log(error);

			});

		}

		getQuote('AAPL');

	};

	function run(argv) {

		try {

			example2();


		}
		catch(error) {
			console.log(error);
		}
	}

	module.exports.command  = 'test';
	module.exports.describe = 'Test';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
