#!/usr/bin/env node

var request = require('request');
var sprintf = require('yow/sprintf');

/*
curl
	-H 'Host: sso.skatteverket.se'
	-H 'Origin: https://www3.skatteverket.se'
	-H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0.1; SM-J510FN Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36 (SKVMob Version 7)'
	-H 'Referer: https://www3.skatteverket.se/ef/mobil_webapp/index.jsp'
	-H 'Accept-Language: en-US'
	-H 'X-Requested-With: se.rsv.ef.mobil.android'
	--compressed 'https://137.61.235.104/ef/mobil_webapp_backend/secure/reachable'
*/

/*
curl
	-H 'Host: m09-mg-local.idp.funktionstjanster.se'
	-H 'Accept: text/html, * / *; q=0.01'
	-H 'Origin: https://www3.skatteverket.se'
	-H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0.1; SM-J510FN Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36 (SKVMob Version 7)'
	-H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8'
	-H 'Referer: https://www3.skatteverket.se/ef/mobil_webapp/index.jsp'
	-H 'Accept-Language: en-US'
	-H 'Cookie: logicaidpVHNAME=6; logicaidpSID=09f2409a7c0f5c24a42fe0c075f446bd78'
	-H 'X-Requested-With: se.rsv.ef.mobil.android'
	--data-binary "ssn=196606223995"
	--compressed 'https://217.150.168.181/mg-local/auth/ccp11/grp/other/ssn'
*/

var Module = module.exports = function() {

	function step1() {
		return new Promise(function(resolve, reject) {
			var options = {};
			var headers = {};

			options.url = 'https://137.61.235.104/ef/mobil_webapp_backend/secure/reachable';
			options.strictSSL = false;
			options.jar = true;
			options.headers                     = {};
			options.headers['Host']             = 'sso.skatteverket.se';
			options.headers['Origin']           = 'https://www3.skatteverket.se';
			options.headers['Accept']           = 'application/json, text/javascript, */*; q=0.01';
			options.headers['Accept-Encoding']  = 'gzip, deflate';
			options.headers['Referer']          = 'https://www3.skatteverket.se/ef/mobil_webapp/index.jsp';
			options.headers['Accept-Language']  = 'en-US';
			options.headers['X-Requested-With'] = 'se.rsv.ef.mobil.android';
			options.headers['User-Agent']       = 'Mozilla/5.0 (Linux; Android 6.0.1; SM-J510FN Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36 (SKVMob Version 7)';


			request(options, function (error, response, body) {
				if (!error) {
					//console.log(body);
					resolve(response.request.headers);
				}
				else {
					reject(error);
				}

			});
		});
	}

	function login(cookie) {
		return new Promise(function(resolve, reject) {
			var options = {};
			var headers = {};

			options.url = 'https://217.150.168.181/mg-local/auth/ccp11/grp/other/ssn';
			options.strictSSL = false;
			options.jar = true;
			options.headers                     = {};
			options.headers['Host']             = 'm09-mg-local.idp.funktionstjanster.se';
			options.headers['Connection']       = 'keep-alive';
			options.headers['Accept']           = 'text/html, */*; q=0.01';
			options.headers['Origin']           = 'https://www3.skatteverket.se';
			options.headers['Content-Type']     = 'application/x-www-form-urlencoded; charset=UTF-8';
			options.headers['Referer']          = 'https://www3.skatteverket.se/ef/mobil_webapp/index.jsp';
			options.headers['Accept-Encoding']  = 'gzip, deflate';
			options.headers['Accept-Language']  = 'en-US';
			options.headers['X-Requested-With'] = 'se.rsv.ef.mobil.android';
			options.headers['User-Agent']       = 'Mozilla/5.0 (Linux; Android 6.0.1; SM-J510FN Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36 (SKVMob Version 7)';
			options.headers['Cookie']           = cookie;

			options.formData                    = {};
			options.formData.ssid               = '196606223995';

			request.post(options, function (error, response, body) {
				if (!error) {
					console.log(response.request.headers);
					resolve(response.request.headers);
				}
				else {
					reject(error);
				}

			});
		});

	}

	function run() {
		console.log('HEJ %s', 'A$');
		step1().then(function(headers) {
			console.log('Logging in', headers.cookie);
			login(headers.cookie).then(function() {
				console.log('Loggat in, typ...');

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
