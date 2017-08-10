#!/usr/bin/env node

var WebSocket    = require('ws');
var EventEmitter = require('events');
var querystring  = require('querystring');
var Path         = require('path');

var sprintf     = require('yow/sprintf');
var isArray     = require('yow/is').isArray;
var isString    = require('yow/is').isString;

const BASE_URL   = 'www.avanza.se';
const SOCKET_URL = 'wss://www.avanza.se/_push/cometd';


class AvanzaSocket extends EventEmitter {

	constructor(subscriptionId) {
		super();

		var self = this;

		self._socket = undefined;
		self._id = 1;
		self._clientId = undefined;
		self._subscriptionId = subscriptionId;
	}

	send(message) {
		console.log('Sending:', message);
		this._socket.send(JSON.stringify([message]));
	};

	open() {
		var self = this;
		var socket = new WebSocket(SOCKET_URL);

		socket.on('message', function(data, flags) {

			if (self._socket != undefined) {
				var response = JSON.parse(data);

				if (isArray(response))
					response = response[0];

				console.log('Response:', response);

				switch(response.channel) {
					case '/meta/handshake': {
						self._clientId = response.clientId;

						self.send({
							advice         : {timeout:0},
							channel        : '/meta/connect',
							clientId       : self._clientId,
							connectionType : 'websocket',
							id             : self._id++
						});

						break;
					}

					case '/meta/connect': {

						function reply() {
							self.send({
								advice         : {timeout:30000},
								channel        : '/meta/connect',
								clientId       : self._clientId,
								connectionType : 'websocket',
								id             : self._id++
							});
						}

						//setTimeout(reply, 100);
						reply();
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
			}
		});

		return new Promise(function(resolve, reject) {

			var iterations = 50;

			function poll() {
				if (socket.readyState === socket.OPEN) {
					resolve(self._socket = socket);
				}
				else {
					if (iterations-- <= 0)
						reject(new Error('Socket timed out. The socket did not open.'));
					else
						setTimeout(poll, 100);
				}

			}


			poll();
		});

	}


	handshake() {
		var self = this;
		var socket = self._socket;

		self.send({
			ext                      : {subscriptionId:self._subscriptionId},
			supportedConnectionTypes : ['websocket', 'long-polling', 'callback-polling'],
			channel                  : '/meta/handshake',
			id                       : self._id++,
			version                  : '1.0'
		});

		return new Promise(function(resolve, reject) {

			var iterations = 50;

			function poll() {
				if (isString(self._clientId))
					resolve();
				else {
					if (iterations-- <= 0)
						reject(new Error('Socket timed out. No handshake.'));
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
			throw new Error('The socket is not yet initialized. You must initialize() before subscribing to channels.');

		if (!isString(self._clientId))
			throw new Error('The socket requires a client ID to work.');

		if (isArray(id))
			id = id.join(',');

		var subscription = sprintf('/%s/%s', channel, id);

		self.on(subscription, function(data) {
			//console.log(data);
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
		this.socket = undefined;
	}


	enableSubscriptions() {
		var self = this;

		if (self.socket != undefined)
			return Promise.resolve(self.socket);

		return new Promise(function(resolve, reject) {

			try {
				var socket = new AvanzaSocket(self.session.pushSubscriptionId);

				socket.open().then(function() {
					console.log('OPen OK');
					return socket.handshake();
				})
				.then(function() {
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

	request(options) {

		var self = this;

		function getDefaultOptions() {

			function getDefaultHeaders() {

				var headers = {};

				headers['Connection']       = 'Keep-Alive';
				headers['Accept-Encoding']  = 'gzip';
				headers['User-Agent']       = 'Avanza/se.avanzabank.androidapplikation (3.8.0 (541); Android 6.0.1)';
				headers['Host']             = BASE_URL;

				if (isString(self.session.authenticationSession))
					headers['X-AuthenticationSession'] = self.session.authenticationSession;

				if (isString(self.session.securityToken))
					headers['X-SecurityToken'] = self.session.securityToken;

				return headers;
			}


			var options = {};

			options.method    = 'GET';
			options.strictSSL = false;
			options.gzip      = true;
			options.json      = true;
			options.headers   = getDefaultHeaders();

			return options;
		}

		return new Promise(function(resolve, reject) {
			var request = require('request');

			var opts = getDefaultOptions();

			if (options.method != undefined)
				opts.method = options.method;

			if (options.url != undefined)
				opts.url = options.url;

			if (options.path != undefined)
				opts.url = sprintf('https://%s', Path.join(BASE_URL, options.path));

			request(opts, function(error, response) {

				try {
					if (error)
						throw error;

					if (response.statusCode < 200 || response.statusCode > 299) {
						console.log(response.body);
						throw new Error('The request returned an error: ' + response.statusCode + ' ' + response.statusMessage);
					}

					resolve(response.body);
				}
				catch (error) {
					reject(error);
				}

			});

		});
	}


	get() {
		return this.request({
			method: 'GET',
			path: sprintf.apply(this, arguments)
		})
	}


	login(credentials) {

		var self = this;

		if (credentials == undefined) {
			credentials = {username: process.env.AVANZA_USERNAME, password:process.env.AVANZA_PASSWORD};
		}

		function loginWithUserName(username, password) {
			return new Promise(function(resolve, reject) {

				try {
					var request = require('request');

					if (!isString(username) || !isString(password))
						throw new Error('Must specify username and password');

					var payload = {};
					payload.maxInactiveMinutes = 240;
					payload.username = username;
					payload.password = password;

					var options = {};
					options.method = 'POST';
					options.url    = sprintf('https://%s/_api/authentication/sessions/username', BASE_URL);
					options.body   = payload;
					options.json   = true;

					request(options, function(error, response) {

						if (error)
							reject(error);
						else {
							var session = {
								authenticationSession: response.body.authenticationSession,
								customerId: response.body.customerId,
								username: username,
								securityToken: response.headers['x-securitytoken'],
								pushSubscriptionId: response.body.pushSubscriptionId
							};

							resolve(self.session = session);
						}

					});

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

		var options = {};
		options.method = 'GET';

		if (type)
			options.path = sprintf('_mobile/market/search/%s?%s', type.toUpperCase(), querystring.stringify({limit:limit, query:query}))
		else
			options.path = sprintf('_mobile/market/search?%s', querystring.stringify({limit:limit, query:query}))

		return this.request(options);
	}

}


module.exports = Avanza;
