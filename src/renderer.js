'use strict';

const path = require('path');
const exec = require('child_process').execSync;

module.exports = function(context) {

	const { hooks, notifier, React,
		docker: { docker },
		environment: {userHome, dockerMachinePath, dockerEnv},
		fileSystemJetpack: fs,
	} = context;
	let cache = {};

	/**
	 * Get the IP address of Flywheel's Docker instance.
	 *
	 * @param {String} machineName The Docker machine name. Default 'local-by-flywheel'.
	 * @returns {String} The Docker machine IP.
	 */
	const getMachineIP = () => {
		let dmp = dockerMachinePath.replace(/\s/gm,`\\ `);
		let cmd = `${dmp} ip local-by-flywheel`;

		let IP = exec(cmd, (err, stdout) => {
			console.log(`stdout: ${stdout}`);
			console.error(`err: ${err}`);
		});

		return IP.toString().trim();
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

		let ipAddress = getMachineIP();

		let wpcliPHP = `<?php
define('DB_HOST', '${ipAddress}:${site.ports.MYSQL}');
define('DB_USER', '${site.mysql.user}');
define('DB_PASSWORD', '${site.mysql.password}');

error_reporting(0);
@ini_set('display_errors', 0);
define( 'WP_DEBUG', false );`;

		publicCWD.file('wp-cli.local.php', {content: wpcliPHP});

		// Debugging.
		console.log('site: %O', site);
		publicCWD.file('site.json', {content: site});
		publicCWD.file('context.json', {content: context.environment});

		let wpcliYML = `path: app/public
url: http://${site.domain}
require:
  - wp-cli.local.php
`;
		publicCWD.file('wp-cli.local.yml', {content: wpcliYML});

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
