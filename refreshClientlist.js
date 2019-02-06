const request = require('request');
const async = require('async');
const fs = require('fs');

// To add timestamp to logs. Need the installation of console-stamp with the command: npm install -g console-stamp
require('console-stamp')(console, { pattern: 'isoDateTime' });

var filePath = __dirname +'/clientList.json';
var settings = JSON.parse(fs.readFileSync(__dirname + '/settings.json'), {encoding: 'utf-8'});
var options = settings.engineOptions;
var engines = settings.engines;
var api_port = settings.APIport;
var nxtquery = 'query?platform=windows&query=select (name device_type) (from device)&format=json';

console.info('======= settings.json used content =======');
console.info(`List of Engines: ${engines}`);
console.info(`NXQL API port: ${api_port}`);
console.info("Credentials aren't shown in logs");


getClientList();

function getClientList(){
	var clientArray = {};
	options = settings.engineOptions;
	async.each( engines, function listClients(engine, callback1){
		options.baseUrl = 'https://' + engine + ':' + api_port + '/2/';
		options.uri = nxtquery ;
		options.rejectUnauthorized=false;
		//console.log("Engine Index is: " + engine);
		request(options, function(error,response,body){
			try {
				if (error) {
					throw "Error: unable to contact Nexthink Engine " + engine;
				}

				var status_code = response.statusCode;
				if (status_code != "200") {
					throw "Error: issue with the query on engine " + engine + ". Status Code: " + status_code + ". Response: " + body;
				}

				var jsonOutput = JSON.parse(body);
				for (clientIndex in jsonOutput){
					var name = jsonOutput[clientIndex].name;
					var device_type = jsonOutput[clientIndex].device_type;
					clientArray[name] = [engine, device_type];
				}
			}
			catch(e) {
                console.error(e);
			}
			callback1();
		});
	}, function (err){
		//saveClientList();
		fs.writeFileSync(filePath,JSON.stringify(clientArray, null,2),{"encoding":"utf-8","flag" : "w"});
	});
}


function saveClientList(){
	fs.writeFileSync(filePath,JSON.stringify(clientArray, null,2),{"encoding":"utf-8","flag" : "w"});
}

setInterval(getClientList, 600000);
