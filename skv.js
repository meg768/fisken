#!/usr/bin/env node

var request  = require('request');
var sprintf  = require('yow/sprintf');
var extend   = require('yow/extend');
var isArray  = require('yow/is').isArray;
var isString = require('yow/is').isString;

/*
curl
	-H 'x-iam-version: 3'
	-H 'User-Agent: Dalvik/2.1.0 (Linux; U; Android 6.0.1; SM-J510FN Build/MMB29M) SEBapp/1.0 (os=android/6.0.1; app=se.seb.privatkund/7.5.3)'
	-H 'Host: mp.seb.se'
	--data "A1=6606223995"
	--compressed
	'https://129.178.54.199/1000/ServiceFactory/_pts/LoginMbidStart.aspx'
*/

var Module = module.exports = function() {


	var _cookies = {};
	var _ssid = '6606223995';

	function getCookiesFromResponse(response) {

		var setCookie = response.headers['set-cookie'];
		var cookies = [];

		setCookie.forEach(function(cookie) {
			var match = cookie.match(/([^=]+)=([^\;]+);\s?/);

			if (match && match.length == 3) {
				cookies[match[1]] = match[2];
			}
		});

		return cookies;
	}

	function buildCookie() {

		var cookie = '';

		for (var key in _cookies)
			cookie += sprintf('%s=%s;', key, _cookies[key]);

		return cookie;
	}

	function getDefaultHeaders() {

		var headers = {};
		headers['Connection']       = 'Keep-Alive';
		headers['Accept-Encoding']  = 'gzip';

		return headers;
	}



	function initiate() {
		var self = this;

		return new Promise(function(resolve, reject) {
			var options = {};

			options.method    = 'GET';
			options.strictSSL = false;
			options.jar       = request.jar();
			options.gzip      = true;
			options.url       = 'http://www.skatteverket.se';
//			options.followRedirect = false;
			options.headers                     = getDefaultHeaders();
			options.headers['Content-Type']     = 'application/xml';
			options.headers['Connection']       = 'Keep-Alive';
			options.headers['Accept-Encoding']  = 'gzip, deflate';
			options.headers['User-Agent']       = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/601.4.4 (KHTML, like Gecko) Version/9.0.3 Safari/601.4.4';



			request(options, function (error, response, body) {

				try {

					if (error)
						throw error;

					console.log(options.jar.getCookieString(options.url));

					console.log(response.headers);
//					console.log(getCookiesFromResponse(response));
					//console.log(body);

				}
				catch (error) {
					reject(error);
				}

			});
		});

	}



	function run() {

		initiate().then(function() {


		})
		.catch(function(error) {
			console.log(error);
		});

	};


	run();
}


var app = new Module();
