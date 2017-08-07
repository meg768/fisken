#!/usr/bin/env node

var WebSocket    = require('ws');
var util         = require('util');
var querystring  = require('querystring');
var EventEmitter = require('events');

var sprintf     = require('yow/sprintf');
var extend      = require('yow/extend');
var isArray     = require('yow/is').isArray;
var isString    = require('yow/is').isString;


var Socket = function() {

	var _this      = this;
	var _ws        = undefined;
	var _id        = 1;
	var _clientId  = undefined;
	var _events    = new EventEmitter();

	this.on = function on(event, callback) {
		return _events.on(event, callback);
	}

	this.once = function once(event, callback) {
		return _events.on(event, callback);
	}

	function send(ws, message) {
		ws.send(JSON.stringify([message]));
	}

	function listen(ws) {
		ws.on('message', function(data, flags) {

			var response = JSON.parse(data);

			if (isArray(response))
				response = response[0];

			if (response.channel.indexOf('/quotes/') !== -1) {
				_events.emit('quotes', response.data);
			}

			else if (response.channel == '/meta/handshake') {
				_clientId = response.clientId;

				var reply = {};
				reply.advice         = {};
				reply.advice.timeout = 0;
				reply.channel        = '/meta/connect';
				reply.clientId       = _clientId;
				reply.connectionType = 'websocket';
				reply.id             = _id++;

				send(ws, reply);
			}

			else if (response.channel == '/meta/connect') {

				function sendReply() {
					var reply = {};
					reply.channel        = '/meta/connect';
					reply.clientId       = _clientId;
					reply.connectionType = 'websocket';
					reply.id             = _id++;

					send(ws, reply);

				}
				setTimeout(sendReply, 100);
			}
			else if (response.channel == '/meta/subscribe') {

			}
			else {
				console.log('Unknown socket message!');
				console.log(JSON.stringify(response, null, '\t'));
			}

		});

		ws.on('error', function(error) {
			console.log('WebSocket error', error);
			_events.emit('error', error);
		});
	}

	this.initialize = function(subscriptionId) {

		function waitForHandshakeComplete(ws) {

			return new Promise(function(resolve, reject) {

				var iterations = 3;

				function loop() {

					if (isString(_clientId)) {
						resolve();
					}
					else {
						if (iterations-- <= 0)
							reject(new Error('Socket timed out. No connection.'))
						else
							setTimeout(loop, 1000);
					}
				}
				loop();
			});
		};


		function waitForHandshake(ws) {

			return new Promise(function(resolve, reject) {

				var iterations = 3;

				function loop() {
					if (ws.readyState === ws.OPEN) {
						var reply = {};
						reply.ext                      = {};
						reply.ext.subscriptionId       = subscriptionId;
						reply.supportedConnectionTypes = ['websocket', 'long-polling', 'callback-polling'];
						reply.channel                  = '/meta/handshake';
						reply.id                       = _id++;
						reply.version                  = '1.0';

						send(ws, reply);
						resolve();
					}
					else {
						if (iterations-- <= 0)
							reject(new Error('Socket timed out. The socket did not open.'));
						else
							setTimeout(loop, 500);
					}

				}

				loop();

			});
		}

		if (_ws != undefined)
			return Promise.resolve();

		if (subscriptionId == undefined)
			return Promise.reject(new Error('The socket requires a subscription ID to work.'));

		return new Promise(function(resolve, reject) {

			var ws = new WebSocket('wss://www.avanza.se/_push/cometd');

			listen(ws);

			waitForHandshake(ws).then(function() {
				return waitForHandshakeComplete(ws);
			})

			.then(function() {

				// Save WebSocket connection
				_ws = ws;

				// Send connect
				_events.emit('connect');

				resolve();
			})
			.catch(function(error) {
				console.log(error);
				ws.close();
				reject(error);
			});

		});

	}

	this.terminate = function() {
		if (_ws != undefined)
			_ws.close();

		_ws = undefined;
		_clientId = undefined;
	}

	this.subscribe = function (id, channels) {

		if (_ws == undefined)
			throw new Error('The socket is not yet initialized. You must initialize() before subscribing to channels.');

		if (!isString(_clientId))
			throw new Error('The socket requires a client ID to work.');

		if (channels == undefined)
			channels = ['quotes'];

		if (!isArray(channels))
			channels = [channels];

		channels.forEach(function(channel) {
			var message = {};
			message.connectionType = 'websocket';
			message.channel        = '/meta/subscribe';
			message.clientId       = _clientId;
			message.id             = _id++;
			message.subscription   = sprintf('/%s/%s', channel, id);

			send(_ws, message);

		});
	};

}

var Module = module.exports = function(credentials) {

	var _this = this;
	var _session = {};

	if (credentials == undefined) {
		credentials = {username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD};
	}

	this.socket = new Socket();

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

	this.request = requestJSON;


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

					//console.log(JSON.stringify(payload, null, '  '));
					//return Promise.resolve(payload);

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


	this.sell = function sell(accountId, orderbookId, volume) {
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
					payload.orderType   = 'SELL';
					payload.orderbookId = orderbookId.toString();
					payload.price       = json.orderbook.buyPrice != undefined ? json.orderbook.buyPrice : json.orderbook.lastPrice;
					payload.volume      = volume != undefined ? volume : json.orderbook.positionVolume;
					payload.validUntil  = sprintf('%04d-%02d-%02d', now.getFullYear(), now.getMonth() + 1, now.getDate());

					if (json.orderbook.positionVolume <= 0)
						throw new Error(sprintf('No position in orderbookId %s', orderbookId));

					console.log(JSON.stringify(json, null, '    '));
					return Promise.resolve(payload);

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
				if (json.status == 'ERROR') {
					reject(new Error(json.messages[0]));
				}
				else
					resolve(json);
			})
			.catch (function(error) {
				reject(error);
			})
		});
	}
/*
	this.uniqueSearch = function(name) {


		return new Promise(function(resolve, reject) {

			search(name).then(function(json) {
				if (json.totalNumberOfHits == 0)
					return reject(new Error(sprintf('No match for "%s"', name)));
				if (json.totalNumberOfHits == 0)
					return reject(new Error(sprintf('Multiple matches for "%s"', name)));

				resolve()
			})
			Promise.resolve().then(function() {

				var options = {};
				options.method = 'GET';
				options.url = sprintf('https://www.avanza.se/_mobile/market/search?%s', querystring.stringify({limit:1, query:name}));

				requestJSON(options);

			})
			.then(function() {

			});

		});
	}

	*/
	this.search = function search(query, type, limit) {

		if (limit == undefined)
			limit = 10;

		var options = {};
		options.method = 'GET';

		if (type)
			options.url = sprintf('https://www.avanza.se/_mobile/market/search/%s?%s', type.toUpperCase(), querystring.stringify({limit:limit, query:query}))
		else
			options.url = sprintf('https://www.avanza.se/_mobile/market/search?%s', querystring.stringify({limit:limit, query:query}))

		return requestJSON(options);
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

						// Bind the subscription ID to the initialize() method
						_this.socket.initialize = _this.socket.initialize.bind(_this.socket, _session.pushSubscriptionId);


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
										"name": "XXX",
										"logins": [{
											"customerId": "XXX",
											"username": "XXX",
											"accounts": [{
												"accountName": "XXX",
												"accountType": "Kapitalförsäkring Barn"
											}, {
												"accountName": "XXX",
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

					// Bind the subscription ID to the initialize() method
					_this.socket.initialize = _this.socket.initialize.bind(_this.socket, _session.pushSubscriptionId);

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
