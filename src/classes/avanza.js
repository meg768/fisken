#!/usr/bin/env node

var request  = require('request');
var sprintf  = require('yow/sprintf');
var extend   = require('yow/extend');
var isArray  = require('yow/is').isArray;
var isString = require('yow/is').isString;
var config   = require('../../config.js');

var Module = module.exports = function(credentials) {

	var _session = {};


	function getDefaultHeaders() {

		var headers = {};

		headers['Connection']       = 'Keep-Alive';
		headers['Accept-Encoding']  = 'gzip';
		headers['User-Agent']       = 'Avanza/se.avanzabank.androidapplikation (3.8.0 (541); Android 6.0.1)';
		headers['Host']             = 'www.avanza.se';

		if (isString(_session.authenticationSession))
			headers['X-AuthenticationSession'] = _session.authenticationSession;

		return headers;
	}

	function getDefaultRequestOptions() {

		var options = {};

		options.method    = 'GET';
		options.strictSSL = false;
		options.jar       = request.jar();
		options.gzip      = true;
		options.headers   = getDefaultHeaders();

		return options;
	}


	function getAccountsOverview() {

		/*

		GET /_mobile/account/overview HTTP/1.1
		Host: www.avanza.se
		Connection: Keep-Alive
		Accept-Encoding: gzip
		User-Agent: Avanza/se.avanzabank.androidapplikation (3.8.0 (541); Android 6.0.1)
		X-SecurityToken: xxx (?)
		X-AuthenticationSession: xxx


		{
			"accounts": [{
				"accountType": "AktieFondkonto",
				"interestRate": 0.00,
				"depositable": true,
				"active": true,
				"name": "Depå",
				"accountId": "1367341",
				"performance": -887156.7000000002,
				"totalBalance": 655.28,
				"tradable": true,
				"accountPartlyOwned": false,
				"totalBalanceDue": 0.00,
				"ownCapital": 7188670.76,
				"buyingPower": 655.26,
				"totalProfitPercent": 122.66,
				"totalProfit": 3959726.64,
				"performancePercent": -10.943884889501987,
				"attorney": false
			}, {
				"accountType": "SparkontoPlus",
				"interestRate": 0.15,
				"depositable": true,
				"active": true,
				"name": "Konto",
				"accountId": "6878232",
				"performance": 711.0200000004843,
				"totalBalance": 4767095.14,
				"tradable": false,
				"accountPartlyOwned": false,
				"totalBalanceDue": 0.00,
				"ownCapital": 4767314.31,
				"buyingPower": 0.00,
				"totalProfitPercent": 0.00,
				"totalProfit": 0.00,
				"performancePercent": 0.012431019689795875,
				"sparkontoPlusType": "Klarna",
				"attorney": false
			}],
			"numberOfOrders": 2,
			"numberOfDeals": 0,
			"totalPerformancePercent": -5.234317269080224,
			"totalBalance": 4795728.24,
			"totalOwnCapital": 15098070.09,
			"totalBuyingPower": 28633.08,
			"numberOfTransfers": 0,
			"numberOfIntradayTransfers": 0,
			"totalPerformance": -835449.1599999983
		}
		*/

		return getJSON(sprintf('https://www.avanza.se/_mobile/account/overview'));
	}

	this.getAccounts = function getAccounts() {

		/*
		[{
			"name": "Depå",
			"id": "1367341",
			"type": "AktieFondkonto",
			"totalBalance": 655.28,
			"ownCapital": 7066321.56,
			"buyingPower": 655.26
		}]
		*/

		return getJSON(sprintf('https://www.avanza.se/_mobile/account/list?onlyTradable=false'));
	}
/*
	function makeRequest(options) {
		return new Promise(function(resolve, reject) {

			var requestOptions = {};
			extend(requestOptions, getDefaultRequestOptions(), options);

			console.log(requestOptions.url);

			request(requestOptions, function (error, response, body) {

				try {

					if (error)
						throw error;

					if (response.statusCode != 200)
						throw new Error(sprintf('Invalid status code %d', response.statusCode));

					// Convert to JSON
					var json = JSON.parse(response.body);

					resolve(json);

				}
				catch (error) {
					reject(error);
				}

			});
		});

	}
	*/
	function getJSON(url) {
		return new Promise(function(resolve, reject) {
			var options = getDefaultRequestOptions();

			options.method = 'GET';
			options.url    = url;
			options.headers['X-AuthenticationSession'] = _session.authenticationSession;

			console.log(options.url);
			request(options, function (error, response, body) {

				try {

					if (error)
						throw error;

					if (response.statusCode != 200)
						throw new Error(sprintf('Invalid status code %d', response.statusCode));

					// Convert to JSON
					var json = JSON.parse(response.body);

					resolve(json);

				}
				catch (error) {
					reject(error);
				}

			});
		});
	}

/*
	this.deleteOrder = function deleteOrder(accountId, orderbookId) {
		return makeRequest({});
	}
*/
	this.getOrders = function getOrders() {
		return getJSON(sprintf('https://www.avanza.se/_mobile/account/dealsandorders'));
	}

	function getStock(id) {
		return getJSON(sprintf('https://www.avanza.se/_mobile/market/stock/%s', id));
	}

	this.buy = function buy(accountId, orderbookId, volume) {
		return new Promise(function(resolve, reject) {

			Promise.resolve().then(function() {
				return getJSON(sprintf('https://www.avanza.se/_mobile/order?accountId=%s&orderbookId=%s', accountId, orderbookId));
			})

			.then(function(json) {

				try {
					var now = new Date();
					var payload = {};

					payload.accountId   = accountId;
					payload.orderType   = 'BUY';
					payload.orderbookId = orderbookId;
					payload.price       = json.orderbook.sellPrice;
					payload.volume      = volume;
					payload.validUntil  = sprintf('%04d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate());

					if (payload.volume * payload.price > json.account.buyingPower)
						throw new Error(sprintf('Missing buying power'));

					console.log('-------------------------------------');
					console.log('Buy payload');
					console.log(payload);

					return Promise.resolve();
					//return postJSON(session, 'https://www.avanza.se/_api/order', payload);


				}
				catch (error) {
					reject(error);
				}

			})
			.catch (function(error) {
				reject(error);
			})
		});

	}


	this.sell = function sell(accountId, orderbookId) {
		return new Promise(function(resolve, reject) {

			Promise.resolve().then(function() {
				return getJSON(session, sprintf('https://www.avanza.se/_mobile/order?accountId=%s&orderbookId=%s', accountId, orderbookId));

			})

			.then(function(json) {

				try {
					var now = new Date();
					var payload = {};

					console.log('-------------------------------------');
					console.log(json);

					payload.accountId   = accountId;
					payload.orderType   = 'SELL';
					payload.orderbookId = orderbookId;
					payload.price       = json.orderbook.buyPrice;
					payload.volume      = json.orderbook.positionVolume;
					payload.validUntil  = sprintf('%04d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate());

					console.log('-------------------------------------');
					console.log('Sell payload');
					console.log(payload);

					if (json.orderbook.positionVolume <= 0)
						throw new Error(sprintf('No position in orderbookId %s', orderbookId));

					return Promise.resolve();

				}
				catch (error) {
					reject(error);
				}

			})
			.catch (function(error) {
				reject(error);
			})
		});
	}

	this.getPositions = function getPositions(accountId) {

		/*

		{
			"accountName": "Depå",
			"accountType": "AktieFondkonto",
			"depositable": true,
			"accountId": "1367341",
			"instrumentPositions": [{
				"instrumentType": "STOCK",
				"positions": [{
					"value": 7096253.60,
					"volume": 305873,
					"profit": 3867964.74,
					"averageAcquiredPrice": 10.55434400,
					"profitPercent": 119.81,
					"acquiredValue": 3228288.86231200,
					"currency": "SEK",
					"name": "Phase Holographic",
					"orderbookId": "455636",
					"lastPrice": 23.20,
					"lastPriceUpdated": "2017-02-10T10:47:09.000+0100",
					"change": -0.40,
					"changePercent": -1.69,
					"tradable": true,
					"flagCode": "SE"
				}],
				"totalValue": 7096253.6000,
				"totalProfitValue": 3867964.74,
				"totalProfitPercent": 119.81,
				"todaysProfitPercent": -1.69
			}],
			"totalBalance": 655.28,
			"totalProfitPercent": 119.81,
			"totalOwnCapital": 7096908.86,
			"totalBuyingPower": 655.26,
			"totalProfit": 3867964.74
		}

		*/

		return getJSON(sprintf('https://www.avanza.se/_mobile/account/%s/positions', accountId));

	}

	function postJSON(url, payload) {
		return new Promise(function(resolve, reject) {

			try {
				var options = getDefaultRequestOptions();

				options.method = 'POST';
				options.url    = url;
				options.body   = JSON.stringify(payload);

				options.headers['Accept']                  = 'application/json';
				options.headers['Content-Type']            = 'application/json; charset=UTF-8';
				options.headers['X-AuthenticationSession'] = _session.authenticationSession;

				request(options, function (error, response, body) {

					try {
						if (error)
							throw error;

						if (response.statusCode != 200)
							throw new Error(sprintf('Invalid status code %d', response.statusCode));

						// Convert to JSON
						var json = JSON.parse(response.body);

						resolve(json);
					}
					catch (error) {
						reject(error);
					}

				});

			}
			catch (error) {
				reject(error);
			}
		});
	}


	this.login = function login() {
		function loginWithUserName(username, password) {
			return new Promise(function(resolve, reject) {

				try {
					if (!isString(username) || !isString(password))
						throw new Error('Must specify username and password');

					var payload = {};
					payload.maxInactiveMinutes = 240;
					payload.username = username;
					payload.password = password;

					var options = getDefaultRequestOptions();

					options.method = 'POST';
					options.url    = sprintf('https://www.avanza.se/_api/authentication/sessions/username');
					options.body   = JSON.stringify(payload);

					options.headers['Accept']        = 'application/json';
					options.headers['Content-Type']  = 'application/json; charset=UTF-8';

					request(options, function (error, response, body) {

						try {
							if (error)
								throw error;

							if (response.statusCode != 200)
								throw new Error(sprintf('Invalid status code %d', response.statusCode));

							// Convert to JSON
							var json = JSON.parse(response.body);

							_session = {
								authenticationSession: json.authenticationSession,
								customerId: json.customerId,
								username: username,
								pushSubscriptionId: json.pushSubscriptionId
							};

							resolve(_session);

						}
						catch (error) {
							reject(error);
						}

					});

				}
				catch (error) {
					reject(error);
				}
			});

		}


		function loginWithBankID(ssid) {

			function initialize() {

				return new Promise(function(resolve, reject) {
					var options = getDefaultRequestOptions();

					if (!isString(ssid))
						throw new Error('Must specify personal number');

					var payload = {};
					payload.identificationNumber = ssid;

					options.method    = 'POST';
					options.url       = 'https://www.avanza.se/_api/authentication/sessions/bankid';
					options.body      = JSON.stringify(payload);

					options.headers['Accept']        = 'application/json';
					options.headers['Content-Type']  = 'application/json; charset=UTF-8';

					request(options, function (error, response, body) {

						try {

							if (error)
								throw error;

							if (response.statusCode != 202)
								throw new Error(sprintf('Invalid status code %d.', response.statusCode));

							// Convert to JSON
							var json = JSON.parse(response.body);

							if (!json.transactionId)
								throw new Error('No transactionID present in response.');

							resolve({transactionId: json.transactionId});


						}
						catch (error) {
							reject(error);
						}

					});
				});

			}

			function poll(session) {
				return new Promise(function(resolve, reject) {
					var options = getDefaultRequestOptions();

					options.method = 'GET';
					options.url    = sprintf('https://www.avanza.se/_api/authentication/sessions/bankid/%s', session.transactionId);

					request(options, function (error, response, body) {

						try {

							if (error)
								throw error;

							if (response.statusCode != 200)
								throw new Error(sprintf('Invalid status code %d', response.statusCode));

							// Convert to JSON
							var json = JSON.parse(response.body);

							if (!json.transactionId)
								throw new Error('No transactionID');

							switch (json.state) {

								case 'COMPLETE': {

									/*
									{
										"name": "Magnus",
										"logins": [{
											"customerId": "155165",
											"username": "1367341",
											"accounts": [{
												"accountName": "Sara",
												"accountType": "Kapitalförsäkring Barn"
											}, {
												"accountName": "Depå",
												"accountType": "Aktie- & fondkonto"
											}],
											"loginPath": "/_api/authentication/sessions/bankid/c48e2067-0580-4c3e-ab03-38eaea87bbed/155165"
										}],
										"transactionId": "c48e2067-0580-4c3e-ab03-38eaea87bbed",
										"recommendedTargetCustomers": [],
										"state": "COMPLETE"
									}
									*/

									resolve({
										loginPath: json.logins[0].loginPath,
										username: json.logins[0].username
									});
									break;
								}

								case 'OUTSTANDING_TRANSACTION':
								case 'USER_SIGN': {
									console.log('Waiting for BankID...');

									setTimeout(function() {
										poll(session).then(function(json) {
											resolve(json);
										})
										.catch(function(error) {
											throw error;
										});
									}, 3000);

									break;
								}

								default: {
									throw new Error(sprintf('BankID returned code %s', json.state));
								}
							}

						}
						catch (error) {
							reject(error);
						}

					});
				});

			}


			function finalize(session) {
				return new Promise(function(resolve, reject) {
					var options = getDefaultRequestOptions();

					options.method = 'GET';
					options.url    = sprintf('https://www.avanza.se%s?maxInactiveMinutes=240', session.loginPath);

					request(options, function (error, response, body) {

						try {
							if (error)
								throw error;

							if (response.statusCode != 200)
								throw new Error(sprintf('Invalid status code %d', response.statusCode));

							// Convert to JSON
							var json = JSON.parse(response.body);

							resolve({
								authenticationSession: json.authenticationSession,
								customerId: json.customerId,
								username: session.username,
								pushSubscriptionId: json.pushSubscriptionId
							});

						}
						catch (error) {
							reject(error);
						}

					});
				});

			}


			return new Promise(function(resolve, reject) {

				initialize(ssid).then(function(json) {
					return poll(json);
				})
				.then(function(json) {
					return finalize(json)
				})
				.then(function(json) {
					_session = json;
					resolve(json)
				})
				.catch(function(error) {
					reject(error);
				});
			});
		};

		if (isString(credentials.ssid))
			return loginWithBankID(credentials.ssid);
		else
			return loginWithUserName(credentials.username, credentials.password);

	}



}
