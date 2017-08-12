#!/usr/bin/env node

var WebSocket    = require('ws');
var EventEmitter = require('events');
var querystring  = require('querystring');
var Path         = require('path');

var sprintf     = require('yow/sprintf');
var extend      = require('yow/extend');
var isArray     = require('yow/is').isArray;
var isString    = require('yow/is').isString;
var isObject    = require('yow/is').isObject;
var Request     = require('yow/request');

const BASE_URL   = 'www.avanza.se';
const SOCKET_URL = 'wss://www.avanza.se/_push/cometd';
const USER_AGENT = 'Avanza/se.avanzabank.androidapplikation (3.8.0 (541); Android 6.0.1)';



class AvanzaSocket extends EventEmitter {

	constructor(subscriptionId) {
		super();

		var self = this;

		self._socket = undefined;
		self._id = 1;
		self._clientId = undefined;
		self._subscriptionId = subscriptionId;
		self._messages = {};
	}

	send(message) {
		console.log('Sending:', message);
		this._socket.send(JSON.stringify([message]));
	};

	open() {
		var self = this;
		var socket = new WebSocket(SOCKET_URL);

		function send(message) {
			console.log('Sending:', message);
			socket.send(JSON.stringify([message]));
		};

		socket.on('open', function() {
			send({
				ext                      : {subscriptionId:self._subscriptionId},
				supportedConnectionTypes : ['websocket', 'long-polling', 'callback-polling'],
				channel                  : '/meta/handshake',
				id                       : self._id++,
				version                  : '1.0'
			});

		});


		socket.on('message', function(data, flags) {

			var response = JSON.parse(data);

			if (isArray(response))
				response = response[0];

			//console.log('Response:', response);

			switch(response.channel) {
				case '/meta/handshake': {
					self._socket = socket;
					self._clientId = response.clientId;

					send({
						advice         : {timeout:0},
						channel        : '/meta/connect',
						clientId       : self._clientId,
						connectionType : 'websocket',
						id             : self._id++
					});

					break;
				}

				case '/meta/connect': {

					send({
						advice         : {timeout:30000},
						channel        : '/meta/connect',
						clientId       : self._clientId,
						connectionType : 'websocket',
						id             : self._id++
					});

					break;
				}

				case '/meta/subscribe': {
					break;
				}

				default: {
					self.emit(response.channel, response.data);
					break;
				}

			}
		});

		return new Promise(function(resolve, reject) {

			var iterations = 50;

			function poll() {
				if (isString(self._clientId))
					resolve();
				else {
					if (iterations-- <= 0) {
						socket.close();
						reject(new Error('Socket timed out. No handshake.'));

					}
					else
						setTimeout(poll, 100);
				}
			}

			poll();

		});


	}


	close() {
		if (this._socket != undefined) {
			this._socket.close();
		}

		this._socket = undefined;
		this._clientId = undefined;
	}

	subscribe(channel, id, callback) {

		var self = this;

		if (self._socket == undefined)
			throw new Error('The socket is not yet open. You must open() before subscribing to channels.');

		if (!isString(self._clientId))
			throw new Error('The socket requires a client ID to work.');

		if (isArray(id))
			id = id.join(',');

		var subscription = sprintf('/%s/%s', channel, id);

		self.on(subscription, function(data) {
			callback(data);
		});

		self.send({
			channel        : '/meta/subscribe',
			connectionType : 'websocket',
			clientId       : self._clientId,
			id             : self._id++,
			subscription   : subscription

		});

	};

}


class Avanza {


	constructor() {
		this.session = {};
		this.socket  = undefined;

		this.gopher = new Request('https://www.avanza.se', {
			headers  : {
				'Accept'         : '*/*',
				'Content-Type'   : 'application/json',
				'User-Agent'     : USER_AGENT
			}
		});
	}


	enableSubscriptions() {
		var self = this;

		if (self.socket != undefined)
			return Promise.resolve(self.socket);

		return new Promise(function(resolve, reject) {

			try {
				var socket = new AvanzaSocket(self.session.pushSubscriptionId);

				socket.open().then(function() {
					resolve(self.socket = socket);
				})
				.catch(function(error) {
					socket.close();
					reject(error);
				});
			}
			catch(error) {
				reject(error);
			}
		});
	}

	disableSubscriptions() {
		var self = this;

		if (self.socket != undefined) {
			self.socket.close();
			self.socket = undefined;
		}
	}

	subscribe(channel, id, callback) {
		var self = this;

		if (self.socket == undefined)
			throw new Error('Need to call enableSubscriptions() first.');

		self.socket.subscribe(channel, id, callback);
	}

	request(method, path, query, body) {

		var self = this;

		return new Promise(function(resolve, reject) {

			var options = {
				method   : method,
				path     : path,
				body     : body,
				query    : query,
				headers  : {
					'X-AuthenticationSession' : self.session.authenticationSession,
					'X-SecurityToken'         : self.session.securityToken
				}
			};

			self.gopher.request(options).then(function(response) {
				resolve(response.body);
			})
			.catch(function(error) {
				reject(error);
			})
		});
	}



	login(credentials) {

		var self = this;

		if (credentials == undefined) {
			credentials = {username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD};
		}

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
					options.path   = '/_api/authentication/sessions/username';
					options.body   = payload;

					self.gopher.post(options).then(function(response) {

						var session = {
							authenticationSession : response.body.authenticationSession,
							customerId            : response.body.customerId,
							username              : username,
							securityToken         : response.headers['x-securitytoken'],
							pushSubscriptionId    : response.body.pushSubscriptionId
						};

						resolve(self.session = session);
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

		return loginWithUserName(credentials.username, credentials.password);

	}

	search(query, type, limit) {

		if (limit == undefined)
			limit = 10;

		var path = '';

		if (type)
			path = sprintf('/_mobile/market/search/%s', type.toUpperCase());
		else
			path = sprintf('/_mobile/market/search');

		return this.request('GET', path, {limit:limit, query:query});
	}

	getAccounts() {

		return this.request('GET', '/_mobile/account/list?onlyTradable=false');
	}

}


module.exports = Avanza;
