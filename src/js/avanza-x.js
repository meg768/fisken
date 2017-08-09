#!/usr/bin/env node

var WebSocket    = require('ws');
var util         = require('util');
var EventEmitter = require('events');
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
		this._socket.send(JSON.stringify([message]));
	};


	open() {

		var self = this;

		if (self._subscriptionId == undefined)
			return Promise.reject(new Error('The socket requires a subscription ID to work.'));

		self._socket = new WebSocket(SOCKET_URL);

		self._socket.on('message', function(data, flags) {

			var response = JSON.parse(data);

			if (isArray(response))
				response = response[0];

			console.log('Response:', response);

			if (response.channel == '/meta/handshake') {
				self._clientId = response.clientId;

				self.send({
					advice         : {timeout:0},
					channel        : '/meta/connect',
					clientId       : self._clientId,
					connectionType : 'websocket',
					id             : self._id++
				});
			}

			else if (response.channel == '/meta/connect') {

				function sendReply() {
					self.send({
						channel        : '/meta/connect',
						clientId       : self._clientId,
						connectionType : 'websocket',
						id             : self._id++

					});
				}
				setTimeout(sendReply, 100);
			}
			else {
				self.emit(response.channel, response.data);
			}

		});

		self._socket.on('error', function(error) {
			console.log('WebSocket error', error);
			self.emit('error', error);
		});


		return new Promise(function(resolve, reject) {

			function sendHandshake() {

				return new Promise(function(resolve, reject) {

					var iterations = 10;

					function loop() {

						if (self._socket.readyState === self._socket.OPEN) {
							self.send({
								ext                      : {subscriptionId:self._subscriptionId},
								supportedConnectionTypes : ['websocket', 'long-polling', 'callback-polling'],
								channel                  : '/meta/handshake',
								id                       : self._id++,
								version                  : '1.0'
							});

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

			function waitForReply() {

				return new Promise(function(resolve, reject) {

					var iterations = 10;

					function loop() {

						if (isString(self._clientId)) {
							resolve();
						}
						else {
							if (iterations-- <= 0)
								reject(new Error('Socket timed out. No connection.'))
							else
								setTimeout(loop, 500);
						}
					}
					loop();
				});
			};

			sendHandshake().then(function() {
				return waitForReply();
			})

			.then(function() {
				resolve();
			})
			.catch(function(error) {
				reject(error);
			});

		});

	}

	close() {
		if (this._socket != undefined)
			this._socket.close();

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

		self.send({
			channel        : '/meta/subscribe',
			connectionType : 'websocket',
			clientId       : self._clientId,
			id             : self._id++,
			subscription   : subscription

		});

		self.on(subscription, function(data) {
			callback(data);
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
			return Promise.resolve();

		return new Promise(function(resolve, reject) {

			try {
				var socket = new AvanzaSocket(self.session.pushSubscriptionId);

				socket.open().then(function() {
					resolve(self.socket = socket);
				})
				.catch(function(error) {
					throw error;
				})

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
			return Promise.reject('Need to call enableSubscriptions() first.');

		return self.socket.subscribe(channel, id, callback);
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
}


module.exports = Avanza;
