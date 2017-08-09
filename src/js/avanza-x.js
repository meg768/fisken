#!/usr/bin/env node

var WebSocket    = require('ws');
var util         = require('util');
var querystring  = require('querystring');
var EventEmitter = require('events');
var Path         = require('path');

var sprintf     = require('yow/sprintf');
var extend      = require('yow/extend');
var isArray     = require('yow/is').isArray;
var isString    = require('yow/is').isString;


const BASE_URL = 'www.avanza.se';


class AvanzaSocket extends EventEmitter {

	constructor() {
		super();

		this._ws = undefined;
		this._id = 1;
		this._clientId = undefined;
	}



	open(subscriptionId) {

		var self = this;

		function listen(ws) {
			ws.on('message', function(data, flags) {

				var response = JSON.parse(data);

				if (isArray(response))
					response = response[0];

				if (response.channel.indexOf('/quotes/') !== -1) {
					self.emit('quotes', response.data);
				}

				else if (response.channel == '/meta/handshake') {
					self._clientId = response.clientId;

					var reply = {};
					reply.advice         = {};
					reply.advice.timeout = 0;
					reply.channel        = '/meta/connect';
					reply.clientId       = self._clientId;
					reply.connectionType = 'websocket';
					reply.id             = self._id++;

					ws.send(JSON.stringify([reply]));
				}

				else if (response.channel == '/meta/connect') {

					function sendReply() {
						var reply = {};
						reply.channel        = '/meta/connect';
						reply.clientId       = self._clientId;
						reply.connectionType = 'websocket';
						reply.id             = self._id++;

						ws.send(JSON.stringify([reply]));

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
				self.emit('error', error);
			});
		}

		function waitForHandshakeComplete(ws) {

			return new Promise(function(resolve, reject) {

				var iterations = 3;

				function loop() {

					if (isString(self._clientId)) {
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
						reply.id                       = self._id++;
						reply.version                  = '1.0';

						ws.send(JSON.stringify([reply]));
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

		if (self._ws != undefined)
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
				self._ws = ws;

				// Send connect
				self.emit('connect');

				resolve();
			})
			.catch(function(error) {
				console.log(error);
				ws.close();
				reject(error);
			});

		});

	}

	close() {
		if (this._ws != undefined)
			this._ws.close();

		this._ws = undefined;
		this._clientId = undefined;
	}

	subscribe(id, channels) {

		var self = this;

		if (self._ws == undefined)
			throw new Error('The socket is not yet initialized. You must initialize() before subscribing to channels.');

		if (!isString(self._clientId))
			throw new Error('The socket requires a client ID to work.');

		if (channels == undefined)
			channels = ['quotes'];

		if (!isArray(channels))
			channels = [channels];

		channels.forEach(function(channel) {
			var message = {};
			message.connectionType = 'websocket';
			message.channel        = '/meta/subscribe';
			message.clientId       = self._clientId;
			message.id             = self._id++;
			message.subscription   = sprintf('/%s/%s', channel, id);

			self._ws.send(JSON.stringify([message]));
		});
	};

}


class Avanza {


	constructor() {
		this.session = {};
	}

	openSocket() {

		var self = this;

		return new Promise(function(resolve, reject) {

			var socket = new AvanzaSocket();

			socket.open(self.session.pushSubscriptionId).then(function() {
				resolve(socket);
			})
			.catch(function(error) {
				reject(error);
			})

		});
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

							self.session = session;
							resolve(self.session);

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
