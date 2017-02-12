#!/usr/bin/env node

var sprintf  = require('yow/sprintf');
var extend   = require('yow/extend');
var isArray  = require('yow/is').isArray;
var isString = require('yow/is').isString;
var config   = require('../../config.js');

var Module = module.exports = function(credentials) {

	var _session = {};

	function request(options) {

		function getDefaultOptions() {

			function getDefaultHeaders() {

				var headers = {};

				headers['Connection']       = 'Keep-Alive';
				headers['Accept-Encoding']  = 'gzip';
				headers['User-Agent']       = 'Avanza/se.avanzabank.androidapplikation (3.8.0 (541); Android 6.0.1)';
				headers['Host']             = 'www.avanza.se';

				if (isString(_session.authenticationSession))
					headers['X-AuthenticationSession'] = _session.authenticationSession;

				if (isString(_session.securityToken))
					headers['X-SecurityToken'] = _session.securityToken;

				return headers;
			}

			var options = {};

			options.method    = 'GET';
			options.strictSSL = false;
			options.gzip      = true;
			options.headers   = getDefaultHeaders();

			return options;
		}

		return new Promise(function(resolve, reject) {
			var request  = require('request');

			var opts = {};
			extend(true, opts, getDefaultOptions(), options);

			//console.log(opts);

			request(opts, function(error, response, body) {

				try {
					if (error)
						throw error;

					if (response.statusCode < 200 || response.statusCode > 299) {
						console.log(response.body);
						throw new Error('The request returned an error: ' + response.statusCode + ' ' + response.statusMessage);
					}

					resolve(response);
				}
				catch (error) {
					reject(error);
				}

			});

		});
	}

	function requestJSON(options) {
		return new Promise(function(resolve, reject) {

			function getDefaultOptions() {
				return {
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json'
					}
				};

			}

			var opts = {};
			extend(true, opts, getDefaultOptions(), options);

			request(opts).then(function(response) {
				try {
					resolve(JSON.parse(response.body));
				}
				catch(error) {
					reject(error);
				}
			})
			.catch(function(error) {
				reject(error);
			});
		});
	}


	this.getAccounts = function getAccounts() {

		return requestJSON({
			method: 'GET',
			url: sprintf('https://www.avanza.se/_mobile/account/list?onlyTradable=false')
		});
	}



	this.deleteOrder = function deleteOrder(accountId, orderbookId) {
		return requestJSON({
			method: 'DELETE',
			url: sprintf('https://www.avanza.se/_api/order?accountId=%s&orderId=%s', accountId, orderbookId)
		});
	}

	this.getOrders = function getOrders() {
		return requestJSON({
			method: 'GET',
			url: sprintf('https://www.avanza.se/_mobile/account/dealsandorders')
		});
	}


	this.buy = function buy(accountId, orderbookId, volume) {
		return new Promise(function(resolve, reject) {

			Promise.resolve().then(function() {
				return requestJSON({
					method: 'GET',
					url: sprintf('https://www.avanza.se/_mobile/order?accountId=%s&orderbookId=%s', accountId, orderbookId)
				});
			})

			.then(function(json) {

				try {
					var now = new Date();
					var payload = {};

					payload.accountId   = accountId.toString();
					payload.orderType   = 'BUY';
					payload.orderbookId = orderbookId.toString();
					payload.price       = json.orderbook.sellPrice != undefined ? json.orderbook.sellPrice : json.orderbook.lastPrice;
					payload.volume      = volume;
					payload.validUntil  = sprintf('%04d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate());

					if (payload.volume * payload.price > json.account.buyingPower)
						throw new Error(sprintf('Missing buying power'));

					return requestJSON( {
						method: 'POST',
						url: 'https://www.avanza.se/_api/order',
						body: JSON.stringify(payload)
					});
				}
				catch (error) {
					reject(error);
				}

			})
			.then(function(json) {
				resolve(json);
			})
			.catch (function(error) {
				reject(error);
			})
		});

	}


	this.sell = function sell(accountId, orderbookId) {
		return new Promise(function(resolve, reject) {

			Promise.resolve().then(function() {
				return getJSON(sprintf('https://www.avanza.se/_mobile/order?accountId=%s&orderbookId=%s', accountId, orderbookId));

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

		return requestJSON({
			method: 'GET',
			url: sprintf('https://www.avanza.se/_mobile/account/%s/positions', accountId)
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

					var options = {};

					options.method = 'POST';
					options.url    = sprintf('https://www.avanza.se/_api/authentication/sessions/username');
					options.body   = JSON.stringify(payload);

					options.headers = {};
					options.headers['Accept']        = 'application/json';
					options.headers['Content-Type']  = 'application/json; charset=UTF-8';

					request(options).then(function(response) {

						var json = JSON.parse(response.body);

						_session = {
							authenticationSession: json.authenticationSession,
							customerId: json.customerId,
							username: username,
							securityToken: response.headers['x-securitytoken'],
							pushSubscriptionId: json.pushSubscriptionId
						};

						resolve(_session);
					})
					.catch(function(error) {
						reject(error);

					})

				}
				catch (error) {
					reject(error);
				}
			});

		}


		function loginWithBankID(ssid) {

			function initialize() {

				return new Promise(function(resolve, reject) {
					var options = {};

					if (!isString(ssid))
						throw new Error('Must specify personal number');

					var payload = {};
					payload.identificationNumber = ssid;

					options.method    = 'POST';
					options.url       = 'https://www.avanza.se/_api/authentication/sessions/bankid';
					options.body      = JSON.stringify(payload);

					options.headers = {};
					options.headers['Accept']        = 'application/json';
					options.headers['Content-Type']  = 'application/json; charset=UTF-8';

					requestJSON(options).then(function(json) {
						try {
							if (!json.transactionId)
								throw new Error('No transactionID present in response.');

							resolve({transactionId: json.transactionId});


						}
						catch (error) {
							reject(error);
						}

					})
					.catch(function(error) {
						reject(error);
					});
				});

			}

			function poll(session) {
				return new Promise(function(resolve, reject) {
					var options = {};

					options.method = 'GET';
					options.url    = sprintf('https://www.avanza.se/_api/authentication/sessions/bankid/%s', session.transactionId);

					requestJSON(options).then(function(json) {
						try {
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

					})
					.catch(function(error) {
						reject(error);
					});
				});

			}


			function finalize(session) {
				return new Promise(function(resolve, reject) {

					options.method = 'GET';
					options.url    = sprintf('https://www.avanza.se%s?maxInactiveMinutes=240', session.loginPath);

					request(options).then(function(response) {


						try {
							var json = JSON.parse(response.body);

							resolve({
								authenticationSession: json.authenticationSession,
								customerId: json.customerId,
								username: session.username,
								securityToken: response.headers['x-securitytoken'],
								pushSubscriptionId: json.pushSubscriptionId
							});

						}
						catch(error) {
							reject(error);

						}
					})
					.catch(function(error) {
						reject(error);
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
