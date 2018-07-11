'use strict';

var path = require('path');
var exec = require('child_process').exec;

var cache = {};

module.exports = function (context) {

	var hooks = context.hooks;
	var userHome = context.environment.userHome;
	var fs = context.fileSystemJetpack;
	var notifier = context.notifier;
	var React = context.React;

	var getIP = function getIP() {
		var machineName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'local-by-flywheel';

		return new Promise(function (resolve, reject) {
			var cmd = 'docker-machine ip';

			if (process.env.DOCKER_MACHINE_DNS_RESOLVER) {
				cmd = process.env.DOCKER_MACHINE_DNS_RESOLVER;
			}

			exec(cmd + ' ' + machineName, function (err, stdout) {
				if (err && cache[machineName]) {
					resolve(cache[machineName]);
				} else if (err) {
					console.error(err.message);
					reject(err);
					return;
				}

				cache[machineName] = stdout.trim();
				resolve(cache[machineName]);
			});
		});
	};

	var configureWPCLI = function configureWPCLI(event, site) {

		var sitePath = site.path.replace('~/', userHome + '/').replace(/\/+$/, '') + '/';
		var publicCWD = fs.cwd(path.join(sitePath, './'));

		// @todo get IP from Docker.
		var IP = getIP();

		console.log('ip: %O', IP);
		console.log('ip??: %O', getIP('default'));
		console.log(exec('docker-machine ip local-by-flywheel'));
		console.log(exec('dockerp-machine ip'));

		var wpcliPHP = '<?php\ndefine(\'DB_HOST\', \'' + IP + ':' + site.ports.MYSQL + '\');\ndefine(\'DB_USER\', \'' + site.mysql.user + '\');\ndefine(\'DB_PASSWORD\', \'' + site.mysql.password + '\');\n\nerror_reporting(0);\n@ini_set(\'display_errors\', 0);\ndefine( \'WP_DEBUG\', false );';

		var wpcliYML = '\npath: app/public\nurl: http://' + site.domain + '\nrequire:\n  - wp-cli.local.php\n';

		// Debugging.
		console.log('site: %O', site);
		publicCWD.file('site.json', { content: site });

		publicCWD.file('wp-cli.local.php', { content: wpcliPHP });

		publicCWD.write('wp-cli.local.yml', wpcliYML);

		if ('apache' === site.webServer) {
			var apache = 'apache_modules:\n  - mod_rewrite';
			publicCWD.append('wp-cli.local.yml', apache);
		}

		event.target.setAttribute('disabled', 'true');

		notifier.notify({
			title: 'WP-CLI',
			message: 'WP-CLI has been configured for this site.'
		});
	};

	// Add button to the Utilities section in the site management UI.
	hooks.addContent('siteInfoUtilities', function (site) {

		return React.createElement(
			'li',
			{ key: 'wp-cli-local-integration' },
			React.createElement(
				'strong',
				null,
				'WP-CLI'
			),
			React.createElement(
				'p',
				null,
				React.createElement(
					'button',
					{ className: '--GrayOutline --Inline', onClick: function onClick(event) {
							configureWPCLI(event, site);
						}, ref: 'configure-wp-cli' },
					'Configure WP-CLI'
				)
			)
		);
	});
};