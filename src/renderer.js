'use strict';

const path = require('path');
const exec = require('child_process').exec;


module.exports = function(context) {

	const { hooks, notifier, React, environment: {userHome, dockerMachinePath, dockerEnv}, fileSystemJetpack:fs } = context;
	let cache = {};

	/**
	 * Get the IP address of Flywheel's Docker instance.
	 *
	 * @param {String} machineName The Docker machine name. Default 'local-by-flywheel'.
	 * @returns {Promise}
	 */
	const getIP = (machineName = 'local-by-flywheel') => {
		return new Promise(function(resolve, reject) {
			let dmp = dockerMachinePath.replace(/\s/gm,`\\ `);
				let cmd = `${dmp} ip local-by-flywheel`;

				exec(cmd, (err, stdout) => {
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
	const configureWPCLI = (event, site) => {

		let sitePath = site.path.replace('~/', userHome + '/').replace(/\/+$/,'') + '/';
		let publicCWD = fs.cwd(path.join(sitePath, './'));

		getIP().then(
			(data) => {
				IP = data.toString();

				let wpcliPHP = `<?php
define('DB_HOST', '${IP}:${site.ports.MYSQL}');
define('DB_USER', '${site.mysql.user}');
define('DB_PASSWORD', '${site.mysql.password}');

error_reporting(0);
@ini_set('display_errors', 0);
define( 'WP_DEBUG', false );`;

		publicCWD.file('wp-cli.local.php', {content: wpcliPHP});
			},
			(err) => {
				console.error(err);
			});

		// Debugging.
		console.log('site: %O', site);
		publicCWD.file( 'site.json', {content: site} );
		publicCWD.file('context.json', {content: context.environment});

		publicCWD.write('wp-cli.local.yml', wpcliYML);

		if('apache' === site.webServer) {
			let apache = `apache_modules:
  - mod_rewrite`;
			publicCWD.append( 'wp-cli.local.yml', apache );
		}

		event.target.setAttribute('disabled', 'true');

		notifier.notify({
			title: 'WP-CLI',
			message: 'WP-CLI has been configured for this site.'
		});

	};

	// Add button to the Utilities section in the site management UI.
	hooks.addContent('siteInfoUtilities', (site) => {

		return (
			<li key="wp-cli-local-integration"><strong>WP-CLI</strong>
				<p>
					<button className="--GrayOutline --Inline" onClick={(event) => {configureWPCLI(event, site)}} ref="configure-wp-cli">
						Configure WP-CLI
					</button>
				</p>
			</li>
		);

	});

};
