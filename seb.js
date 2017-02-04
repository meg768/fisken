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

	function addCookiesFromResponse(response) {

		var cookies = response.headers['set-cookie'];

		cookies.forEach(function(cookie) {
			var match = cookie.match(/([^=]+)=([^\;]+);\s?/);

			if (match && match.length == 3) {
				_cookies[match[1]] = match[2];
			}
		});
	}

	function buildCookie() {

		var cookie = '';

		for (var key in _cookies)
			cookie += sprintf('%s=%s;', key, _cookies[key]);

		return cookie;
	}

	function getDefaultHeaders() {

		var headers = {};
		headers['Cookie']           = buildCookie();
		headers['x-iam-version']    = '3';
		headers['User-Agent']       = 'Dalvik/2.1.0 (Linux; U; Android 6.0.1; SM-J510FN Build/MMB29M) SEBapp/1.0 (os=android/6.0.1; app=se.seb.privatkund/7.5.3)';
		headers['Host']             = 'mp.seb.se';
		headers['Connection']       = 'Keep-Alive';
		headers['Accept-Encoding']  = 'gzip';

		return headers;
	}


	function initiateLogin(ssid) {
		return new Promise(function(resolve, reject) {
			var options = {};

			options.url       = 'https://129.178.54.199/1000/ServiceFactory/_pts/LoginMbidStart.aspx';
			options.strictSSL = false;
			options.jar       = true;
			options.body      = sprintf('A1=%s', ssid);

			options.headers                     = getDefaultHeaders();
			options.headers['Content-Type']     = 'application/x-www-form-urlencoded';

			request.post(options, function (error, response, body) {

				try {
					if (error)
						throw error;

					if (response.statusCode != 200)
						throw new Error(sprintf('Invalid status code: %d', response.statusCode));

					var statusCode = response.headers['sebstatus'];

					if (statusCode != 200)
						throw new Error(sprintf('Invalid sebstatus code: %s', statusCode));

					if (!isArray(response.headers['set-cookie']))
						throw new Error('No cookies returned');

					addCookiesFromResponse(response);

					resolve();
				}
				catch (error) {
					reject(error);
				}

			});
		});

	}

	function waitForResponse() {
		var self = this;

		return new Promise(function(resolve, reject) {
			var options = {};

			options.strictSSL = false;
			options.jar       = true;
			options.url       = 'https://129.178.54.199/1000/ServiceFactory/_pts/LoginMbidStatus.aspx';

			options.headers                     = getDefaultHeaders();
			options.headers['Content-Type']     = 'application/x-www-form-urlencoded';


			request.post(options, function (error, response, body) {

				try {

					if (error)
						throw error;

					if (response.headers['sebstatus'] != 200)
						throw new Error('Invalid status sebstatus code');

					var statusMessage = response.headers['sebstatusmessage'];

					switch (statusMessage) {

						case 'COMPLETE': {
							addCookiesFromResponse(response);
							resolve();

							break;
						}

						case 'OUTSTANDING_TRANSACTION':
						case 'USER_SIGN': {
							console.log('Waiting for BankID...');

							setTimeout(function() {
								waitForResponse().then(function() {
									resolve();
								})
								.catch(function(error) {
									reject(error);
								});
							}, 3000);

							break;
						}

						default: {
							throw new Error(sprintf('BankID returned code %s', statusMessage));
						}
					}

				}
				catch (error) {
					reject(error);
				}

			});
		});

	}


	function authenticate() {
		return new Promise(function(resolve, reject) {
			var options = {};

			options.url       = 'https://129.178.54.199/nauth2/Authentication/Auth?SEB_Referer=/priv/ServiceFactory-mbid';
			options.strictSSL = false;
			options.jar       = true;

			options.headers                     = getDefaultHeaders();
			options.headers['Content-Type']     = 'application/x-www-form-urlencoded';

			console.log('Authenticating.');

			request.post(options, function (error, response, body) {

				try {
					if (error)
						throw error;

					if (response.statusCode != 302)
						throw new Error('Excecting redirect');

					addCookiesFromResponse(response);
					resolve();

				}
				catch (error) {
					reject(error);
				}

			});
		});

	}

	function activateSession() {
		return new Promise(function(resolve, reject) {


			var json = {
				"request": {
					"ServiceInput": [{
						"VariableName": "CUSTOMERTYPE",
						"VariableNamePossibleValues": [],
						"Condition": "EQ",
						"VariableValue": "P"
					}],
					"UserCredentials": {
						"UserId": "6606223995",
						"Password": "",
						"LoggedOnUser": "Mobile",
						"WorkstationID": "",
						"ApplicationName": "RFO",
						"AuthMethod": "6"
					},
					"VODB": {
						"DBZV170": [],
						"DBZV160": [],
						"HWINFO01": {
							"COUNTRY_PREFIX": 0,
							"LATITUDE_DECIMAL": 0,
							"LONGITUDE_DECIMAL": 0
						},
						"DEVID01": {
							"APPLICATION_NAME": "MASP",
							"APPLICATION_VERSION": "7.5.3",
							"MANUFACTURER": "samsung",
							"MODEL": "API_VERSION=2",
							"OS_NAME": "Android",
							"OS_VERSION": "6.0.1"
						},
						"CBEW501": [],
						"CBEW502": [],
						"PCBWC011": [],
						"MESSAGE_INFO": []
					}
				}
			};

			try {
				var options = {};

				options.url       = 'https://129.178.54.199/1000/ServiceFactory/PC_BANK/PC_BankAktivera01Session01.asmx/Execute';
				options.strictSSL = false;
				options.jar       = true;
				options.gzip      = true;
				options.body      = JSON.stringify(json);

				options.headers                     = getDefaultHeaders();
				options.headers['Accept']           = 'application/json';
				options.headers['logfileid']        = 'MAS-iOS-PoC';
				options.headers['Content-Type']     = 'application/json;charset=UTF-8';

				request.post(options, function (error, response, body) {

					try {
						if (error)
							throw error;

						if (response.statusCode != 200)
							throw new Error('Invalid status code');

						if (response.headers['sebstatus'] != 200)
							throw new Error('Invalid status sebstatus code');

						addCookiesFromResponse(response);

						// Convert to JSON
						var json = JSON.parse(response.body);

						// And fetch the 'd' object
						resolve(json.d ? json.d : {});
					}
					catch (error) {
						reject(error);
					}

				});

			}
			catch(error) {
				reject(error);
			}
		});


	}



	function login(ssid) {
		return new Promise(function(resolve, reject) {

			initiateLogin(ssid)

			.then(function() {
				return waitForResponse();
			})
			.then(function() {
				return authenticate();
			})
			.then(function() {
				return activateSession();
			})
			.then(function(response) {
				resolve(response);
			})
			.catch(function(error) {
				reject(error);
			});
		});
	};



	function getAccounts(session) {
		return new Promise(function(resolve, reject) {

			var json = {
				"request": {
					"ServiceInput": [{
						"VariableName": "KUND_ID",
						"VariableNamePossibleValues": [],
						"Condition": "EQ",
						"VariableValue": session.VODB.USRINF01.SEB_KUND_NR
					}]
				}
			};
			try {
				var options = {};

				options.url       = 'https://129.178.54.199/1000/ServiceFactory/PC_BANK/PC_BankLista01Konton_privat01.asmx/Execute';
				options.strictSSL = false;
				options.jar       = true;
				options.gzip      = true;
				options.body      = JSON.stringify(json);

				options.headers                 = getDefaultHeaders();
				options.headers['Accept']       = 'application/json';
				options.headers['logfileid']    = 'MAS-iOS-PoC';
				options.headers['Content-Type'] = 'application/json;charset=UTF-8';

				request.post(options, function (error, response, body) {

					try {
						if (error)
							throw error;

						if (response.statusCode != 200)
							throw new Error(sprintf('Invalid status code: %d', response.statusCode));

						if (response.headers['sebstatus'] != 200)
							throw new Error(sprintf('Invalid status sebstatus code: %d', response.headers['sebstatus']));

						// Convert to JSON
						var json = JSON.parse(response.body);

						// And fetch the 'd' object
						resolve(json.d ? json.d : {});
					}
					catch (error) {
						reject(error);
					}

				});

			}
			catch(error) {
				reject(error);
			}
		});


	}


	function fetch(session, url) {
		return new Promise(function(resolve, reject) {

			var json = {
				"request": {
					"ServiceInput": [{
						"VariableName": "KUND_ID",
						"VariableNamePossibleValues": [],
						"Condition": "EQ",
						"VariableValue": session.VODB.USRINF01.SEB_KUND_NR
					}]
				}
			};
			try {
				var options = {};

				options.url       = url;
				options.strictSSL = false;
				options.jar       = true;
				options.gzip      = true;
				options.body      = JSON.stringify(json);

				options.headers                 = getDefaultHeaders();
				options.headers['Accept']       = 'application/json';
				options.headers['logfileid']    = 'MAS-iOS-PoC';
				options.headers['Content-Type'] = 'application/json;charset=UTF-8';

				request.post(options, function (error, response, body) {

					try {
						if (error)
							throw error;

						if (response.statusCode != 200)
							throw new Error(sprintf('Invalid status code: %d', response.statusCode));

						if (response.headers['sebstatus'] != 200)
							throw new Error(sprintf('Invalid status sebstatus code: %d', response.headers['sebstatus']));

						// Convert to JSON
						var json = JSON.parse(response.body);

						// And fetch the 'd' object
						resolve(json.d ? json.d : {});
					}
					catch (error) {
						reject(error);
					}

				});

			}
			catch(error) {
				reject(error);
			}
		});


	}


	function run() {

		login('6606223995').then(function(session) {
			console.log(JSON.stringify(session, null, '\t'));

			var data = {};

			getAccounts(session).then(function(result) {
				console.log(JSON.stringify(result, null, '\t'));
			})
			.catch(function(error) {
				console.log(error);
			});
		})
		.catch(function(error) {
			console.log(error);
		});

	};


	run();
}


var app = new Module();
