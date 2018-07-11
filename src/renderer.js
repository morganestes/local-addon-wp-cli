'use strict';

const path = require('path');
const exec = require('child_process').exec;

let cache = {};

module.exports = function(context) {

	const hooks = context.hooks;
	const userHome = context.environment.userHome;
	const fs = context.fileSystemJetpack;
	const notifier = context.notifier;
	const React = context.React;

	const getIP = (machineName = 'local-by-flywheel') => {
	    return new Promise(function(resolve, reject) {
	        let cmd = 'docker-machine ip';

	        if (process.env.DOCKER_MACHINE_DNS_RESOLVER) {
	            cmd = process.env.DOCKER_MACHINE_DNS_RESOLVER;
	        }

	        exec(cmd + ' ' + machineName, (err, stdout) => {
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

	const configureWPCLI = (event, site) => {

		let sitePath = site.path.replace('~/', userHome + '/').replace(/\/+$/,'') + '/';
		let publicCWD = fs.cwd(path.join(sitePath, './'));

		// @todo get IP from Docker.
		let IP = getIP();


		console.log( 'ip: %O', IP );
		console.log('ip??: %O', getIP( 'default' ) );
		console.log( exec('docker-machine ip local-by-flywheel' ) );
		console.log( exec('dockerp-machine ip'));

		let wpcliPHP = `<?php
define('DB_HOST', '${IP}:${site.ports.MYSQL}');
define('DB_USER', '${site.mysql.user}');
define('DB_PASSWORD', '${site.mysql.password}');

error_reporting(0);
@ini_set('display_errors', 0);
define( 'WP_DEBUG', false );`;

		let wpcliYML = `
path: app/public
url: http://${site.domain}
require:
  - wp-cli.local.php
`;

		// Debugging.
		console.log('site: %O', site);
		publicCWD.file( 'site.json', {content: site} );

		publicCWD.file('wp-cli.local.php', {content: wpcliPHP});

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
