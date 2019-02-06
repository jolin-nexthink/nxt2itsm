# nxt2itsm
Nexthink score to ITSM solutions (reworked with Arie Joose and Alain Bernard)

Displays Nexthink scores per device in HTML.

The purpose of this package is to provide a connector between Nexthink engines and ITSM tooling, like TOPdesk. It is not limited to this ITSM platform, but the initial version is targeted for TOPdesk.

# Usage 

Create a new tab in the ITSM tool and have it display the following link: "https://appliance_fqdn/device/device_name"

Where device_name is a Windows PC name in Nexthink. This must be configured in the ITSM tool.

The pattern in red, yellow and green colors will be derived from a score.xml file that must be available in all Nexthink engines and must be placed in the same folder as the js scripts. There is an example in this package.

The score.xml may contain Nexthink act links.

# Installation

This installation is based upon a clean install of CentOS. 

If you are not familiar with CentOS firewalls, switch it off:

	sudo systemctl disable firewalld
	sudo systemctl stop firewalld

Edit this file: /etc/selinux/config, and set: selinux disabled

Install the different necessary components:

	sudo yum install epel-release -y
	sudo yum install nodejs -y
	sudo yum install mod_ssl openssl -y
	sudo yum install git -y
	sudo yum update -y 
  sudo systemctl reboot

Install pm2 and also download the different files from the git repository:

	npm -g install pm2
	npm -g install https://github.com/nexthink-stuff/nxt2itsm/

Make sure pm2 will autostart after a reboot:

	pm2 startup systemd

The solution is now installed in /usr/lib/node_modules/nxt2itsm.

# Configuration

Most of the configuration will be done in the settings.json file. You can find how the file is structured by accessing the following link: "https://appliance_fqdn/"

Note that to access the https page, some certificates need to be put in place in a subfolder "keys". You can have 3 potential files in there depending if you are using trusted certificates or self-signed one: 

	cert.pem -> the certificate file
	key.pem -> the associated key
	ca.pem -> the root certificate (in case of trusted certificates)

Set either "selfsigned" or "trusted" for the "certificates" option in the settings.json depending if you are using self-signed certificates or certificates signed by a trusted Authority.

Once the configuration is done, start the scripts from the /usr/lib/node_modules/nxt2itsm folder with the two following commands:

	sudo pm2 start refreshClientlist.js
	sudo pm2 start nxt2itsm.js
	sudo pm2 save

The following commands can help for troubleshooting too:

	pm2 list -> show the list of application running under pm2
	pm2 show id -> replace "id" by the id from the list command to see the details of the specific application
	pm2 restart id -> to restart a specific application
