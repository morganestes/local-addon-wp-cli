'use strict';

var path = require('path');
var exec = require('child_process').exec;

module.exports = function (context) {
	var hooks = context.hooks,
	    notifier = context.notifier,
	    React = context.React,
	    _context$environment = context.environment,
	    userHome = _context$environment.userHome,
	    dockerMachinePath = _context$environment.dockerMachinePath,
	    dockerEnv = _context$environment.dockerEnv,
	    fs = context.fileSystemJetpack;

	var cache = {};

	/**
  * Get the IP address of Flywheel's Docker instance.
  *
  * @param {String} machineName The Docker machine name. Default 'local-by-flywheel'.
  * @returns {Promise}
  */
	var getIP = function getIP() {
		var machineName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'local-by-flywheel';

		return new Promise(function (resolve, reject) {
			var dmp = dockerMachinePath.replace(/\s/gm, '\\ ');
			var cmd = dmp + ' ip local-by-flywheel';

			exec(cmd, function (err, stdout) {
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

	/**
  * Generate the files needed for the WP-CLI tunnel.
  *
  * @param {DOMEvent} event The event that triggered the function.
  * @param {Object} site Data for the current Flywheel site.
  */
	var configureWPCLI = function configureWPCLI(event, site) {

		var sitePath = site.path.replace('~/', userHome + '/').replace(/\/+$/, '') + '/';
		var publicCWD = fs.cwd(path.join(sitePath, './'));

		getIP().then(function (data) {
			IP = data.toString();

			var wpcliPHP = '<?php\ndefine(\'DB_HOST\', \'' + IP + ':' + site.ports.MYSQL + '\');\ndefine(\'DB_USER\', \'' + site.mysql.user + '\');\ndefine(\'DB_PASSWORD\', \'' + site.mysql.password + '\');\n\nerror_reporting(0);\n@ini_set(\'display_errors\', 0);\ndefine( \'WP_DEBUG\', false );';

			publicCWD.file('wp-cli.local.php', { content: wpcliPHP });
		}, function (err) {
			console.error(err);
		});

		// Debugging.
		console.log('site: %O', site);
		publicCWD.file('site.json', { content: site });
		publicCWD.file('context.json', { content: context.environment });

		var wpcliYML = 'path: app/public\nurl: http://' + site.domain + '\nrequire:\n  - wp-cli.local.php\n';
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