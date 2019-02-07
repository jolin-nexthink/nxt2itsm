// Definition of the constant
const request = require('request');
const express = require('express');
const fs = require('fs');
const https = require('https');
const libxmljs = require('libxmljs');
const app = express();
// To add timestamp to logs. Need the installation of console-stamp with the command: npm install -g console-stamp
require('console-stamp')(console, { pattern: 'isoDateTime' });

console.info('============== Starting nxt2itsm Script ==============');

// Definition of the different paths
// __dirname gives the path of the currently running file
// Note: using jquery later on with CDN, local version can be downloaded at https://ajax.aspnetcdn.com/ajax/jQuery/jquery-3.3.1.min.js
const cert_path = __dirname + '/keys/cert.pem';
const key_path = __dirname + '/keys/key.pem';
const ca_path = __dirname + '/keys/ca.pem';
const settings_path = __dirname + '/settings.json';
const clientList_path = __dirname + '/clientList.json';

// Write the different paths to log as information
console.info('======= Paths =======');
console.info('Path of the CA: ' + ca_path);
console.info('Path of the certificate: ' + cert_path);
console.info('Path of the key: ' + key_path);
console.info('Path of the settings.json file: ' + settings_path);
console.info('Path of the clientList.json file: ' + clientList_path);
console.info('Path of the jquery.js file: ' + jquery_path);

// Definition of the default fields to be selected in the query
const default_fields = 'device_uid last_seen';

// Definition of the variables
var scoreArray = [];
var clientList = JSON.parse(fs.readFileSync(clientList_path), {encoding: 'utf-8'});
var settings = JSON.parse(fs.readFileSync(settings_path), {encoding: 'utf-8'});
var engine_options;
var portal;
var api_port;
var finder_link;
var device_info;
var act_enabled;
var jquery_path;
var certificates_type;
var online;
var xmlscoreFiles = [];
var httpsoptions;

reloadStuff();

// Options for the https server
if (certificates_type == "trusted") {
    httpsoptions = {
      key: fs.readFileSync(key_path, 'utf8'),
      cert: fs.readFileSync(cert_path, 'utf8'),
      ca: fs.readFileSync(ca_path, 'utf8')
    };
} else {
    httpsoptions = {
      key: fs.readFileSync(key_path, 'utf8'),
      cert: fs.readFileSync(cert_path, 'utf8')
    };
}

// Define jquery path depending if Appliance have internet access or not
if (online) {
    jquery_path = 'https://ajax.aspnetcdn.com/ajax/jQuery/jquery-3.3.1.min.js';
} else {
    jquery_path = '/scripts/jquery-3.3.1.min.js';
}

// Creation of the https server with the https options
var httpsServer = https.createServer(httpsoptions, app);
httpsServer.listen(443);
app.use(express.static('public'));
app.get('/', function(req, res) {
	writeConfiguration(res);
});

app.get('/device/:deviceId', function(req, res){
    try {
        if (isEmpty(clientList)) {
            throw "No client in the list!";
        }

        var device_ID = req.params.deviceId;

        if (typeof clientList[device_ID] === 'undefined') {
            throw "Device not found in the list!";
        }

        getScores(req, res);
    } catch(e) {
        if (typeof e == 'string' || e instanceof String) {
            console.error(e);
            res.write(e);
            res.end();
        } else {
            console.error(e.toString());
            res.write(e.toString());
            res.end();
        }
    }
});

app.get('/score/:scoreId/:deviceId', function(req, res){
    try {
        if (isEmpty(clientList)) {
            throw "No client in the list!";
        }

        var device_ID = req.params.deviceId;

        if (typeof clientList[device_ID] === 'undefined') {
            throw "Device not found in the list!";
        }

        getScore(req, res, req.params.scoreId);
    } catch(e) {
        if (typeof e == 'string' || e instanceof String) {
            console.error(e);
            res.write(e);
            res.end();
        } else {
            console.error(e.toString());
            res.write(e.toString());
            res.end();
        }
    }
});

app.get('/reload', function(req, res) {
	reloadStuff();
	res.write('Done');
	res.end();
});

app.get('/act/:deviceId/:actId', function(req, res){
	var portalOptions = {};
	portalOptions.baseUrl = 'https://' + portal;
	portalOptions.uri =  '/api/remoteaction/v1/run';
	portalOptions.method = 'POST';
	portalOptions.agentOptions = {'rejectUnauthorized': false, 'Content-type': 'application/json', json: true};
	portalOptions.headers = {'Content-type': 'application/json'};
	portalOptions.auth = settings.portalOptions.auth;
	portalOptions.body = JSON.stringify({'RemoteActionUid': req.params.actId ,'DeviceUids':[ req.params.deviceId]});
	request(portalOptions, function(error, response, body){
		res.write(body);
		res.end();
	});
});

setInterval(reloadStuff, 300000);

// ========================================= Function Definitions ================================

// Function to reload the different settings
function reloadStuff() {
    console.info('======= Reloading settings =======');

    clientList = JSON.parse(fs.readFileSync(clientList_path), {encoding: 'utf-8'});

	settings = JSON.parse(fs.readFileSync(settings_path), {encoding: 'utf-8'});
    engine_options = settings.engineOptions;
    engine_options.rejectUnauthorized = false;
    portal = settings.portal;
    if (typeof settings.APIport === 'undefined') {
        api_port = '1671';
    } else {
        api_port = settings.APIport;
    }
    if (typeof settings.Online === 'undefined') {
        online = true;
    } else {
        online = settings.Online;
    }
    if (typeof settings.certificates === 'undefined') {
        certificates_type = 'selfsigned';
    } else {
        certificates_type = settings.certificates;
    }
    if (typeof settings.Finderlink === 'undefined') {
        finder_link = true;
    } else {
        finder_link = settings.Finderlink;
    }
    if (typeof settings.DeviceInfo === 'undefined') {
        device_info = true;
    } else {
        device_info = settings.DeviceInfo;
    }
    if (typeof settings.ActEnabled === 'undefined') {
        act_enabled = false;
    } else {
        act_enabled = settings.ActEnabled;
    }
    if (typeof settings.scoreFiles === 'undefined') {
        xmlscoreFiles = [];
        xmlscoreFiles.push( settings.scoreFile );
    } else {
        xmlscoreFiles = settings.scoreFiles;
    }
    logSettings();

	readXMLs();
	console.info('======= Settings reloaded =======');
}

// Function to display the different settings from the settings.json file in the log
function logSettings(){
    console.info('======= settings.json used content =======');
    console.info(`Portal Address: ${portal}`);
    if (typeof settings.scoreFiles === 'undefined') {
		console.info(`Score file: ${settings.scoreFile}`);
	} else {
        console.info(`List of score files: ${settings.scoreFiles}`);
    }
    console.info(`NXQL API port: ${api_port}`);
    console.info(`Act Enabled: ${act_enabled}`);
    console.info(`Display Device Info: ${device_info}`);
    console.info(`Display Finder Link: ${finder_link}`);
    console.info("Credentials aren't shown in logs");
}

// Function to read the different score files
function readXMLs(){
    console.info('======= Reading the score files =======');
	for (xmlCount in xmlscoreFiles) {
		var xmlfile = __dirname + '/' + xmlscoreFiles[xmlCount];
        console.info(`======= Reading file: ${xmlfile}`);
        var main_score = {};
        var scoredef_name = '';
		var limits = [];
		var scores = [];
        var leaf_scores_array = [];
		var doc_Sections = [];
		var select_string = '';
		var data = fs.readFileSync(xmlfile, {encoding: 'utf-8'});

        // Parsing the xml
        try {
			var xmlDoc = libxmljs.parseXml(data);
		}
		catch(e) {
			console.error("Couldn't parse xml content of file: " + xmlfile);
			console.error(e.toString());
		}

        // Getting the xml under the main composite score
		try {
			var main_score_xml = xmlDoc.get('//CompositeScore');
            if (main_score_xml == null){
                throw 'Error getting the main composite score xml part';
            }
            var main_score_name = main_score_xml.attr('Name').value();
        }
        catch(e) {
			console.error(e);
		}
        main_score.scorename = main_score_name;

        // Getting the score def name
        try {
			var scoredef_attr = xmlDoc.get('//ScoreDef').attr('Name');
            if (scoredef_attr == null) {
                throw 'Error with the name attribute of the score definition: no attribute';
            }
            scoredef_name = scoredef_attr.value();
            if (scoredef_name === "") {
                throw 'Error with the name attribute of the score definition: no value';
            }
        }
        catch(e) {
			console.error(e);
		}
        main_score.scoredefname = scoredef_name;

        // Getting the thresholds
        limits = readThresholds(xmlDoc);
        main_score.limits = limits;

        // Getting documentation section of the main score
        readDocumentation(main_score_xml, main_score_name, doc_Sections);

        // Getting the different composite/leaf scores
        readCompositeScore(main_score_xml, main_score_name, scores, leaf_scores_array, doc_Sections, true);
        main_score.scores = scores;

        // Adding the different leaf scores to the select_string
        for (var index in leaf_scores_array){
            select_string += `#"score:${scoredef_name}/${leaf_scores_array[index]}" #"score:${scoredef_name}/${leaf_scores_array[index]}/payload" `;
		}
        main_score.selectstring = select_string;

		main_score.doc_sections = doc_Sections;
		scoreArray[xmlCount] = main_score;
	}
}

// Read the composite scores
// If there are no composite score under the current node, add the current composite score and read the leaf scores
// If there are composite score under the current node, read the composite scores, but also check for leaf scores
function readCompositeScore(score_xml, score_name, scores, leaf_scores_array, doc_Sections, first_loop){
    var composite_scores = score_xml.find('./CompositeScore');
    if (!Array.isArray(composite_scores) || !composite_scores.length) {
        console.info('No more composite score under the node: ' + score_name);
        console.info('Adding current node as composite score');
        var score = {};
        var score_description = score_xml.attr('Description').value();

        Object.assign(score, {'type':'Composite'});
        Object.assign(score, {'name': score_name});
        Object.assign(score, {'description': score_description});

        scores.push(score);

        console.info('Reading leaf scores under node: ' + score_name);
        readLeafScore(score_xml, score_name, scores, leaf_scores_array, doc_Sections);

    } else {
        var displayed_score_name = score_name;
        // First read the leaf score before going to the next node, otherwise the leaf will be stored after the composite and won't be displayed at the right place
        console.info('Reading leaf scores under node: ' + score_name);
        readLeafScore(score_xml, score_name, scores, leaf_scores_array, doc_Sections);

        for (var composite_index in composite_scores) {
            var composite_xml = composite_scores[composite_index];
            var composite_score_name = composite_xml.attr('Name').value();
            if (first_loop) {
                displayed_score_name = composite_score_name;
            } else {
                displayed_score_name = score_name + ' - ' + composite_score_name;
            }
            readCompositeScore(composite_xml, displayed_score_name, scores, leaf_scores_array, doc_Sections, false);
        }

    }
}

// Read the leaf scores
function readLeafScore(score_xml, score_name, scores, leaf_scores_array, doc_Sections){
    var leaf_scores = score_xml.find('./LeafScore');
    if (!Array.isArray(leaf_scores) || !leaf_scores.length) {
        console.info('No leaf score under the node: ' + score_name);
    } else {
        for (leafindex in leaf_scores){
            var score = {};
            var leaf_xml = leaf_scores[leafindex];
            var leaf_score_name = leaf_xml.attr('Name').value();
            var score_description = leaf_xml.attr('Description').value().replace(/(\r\n|\n|\r)/gm,'<br>');
            var strFormat = leaf_xml.find('./Input')[0].attr('Format');
            var score_norm = leaf_xml.get('./Normalization');

            Object.assign(score, {'type': 'Leaf'});
            Object.assign(score, {'name': leaf_score_name});
            Object.assign(score, {'description': score_description});

            if (strFormat != null){
                Object.assign(score, {'format': strFormat.value()});
            }
            else {
                Object.assign(score, {'format': ''});
                console.info(`No format tag found for leaf score ${leaf_score_name}`);
            }

            var normalization = readNormalization(score_norm);
            Object.assign(score, {'normalization': normalization});

            readDocumentation(leaf_xml, leaf_score_name, doc_Sections);

            scores.push(score);
            leaf_scores_array.push(leaf_score_name);
        }
    }
}

// Getting the document section of the score
// a doc_section should have a score name, a header and sections
// each section can have a title, a description, remote actions and http links
// reading each child node of a section and checking for the type, then assigning this as an element
function readDocumentation(score_xml, score_name, doc_Sections){
    var doc_section = {};
    console.info('Reading document section of score: ' + score_name);
    var doc_xml = score_xml.get('./Document');
    if (doc_xml == null) {
        console.info('No document section for score: ' + score_name);
    } else {

        Object.assign(doc_section, {'score': score_name});

        var header = '';
        var header_xml = doc_xml.get('./Header');
        if (header_xml == null) {
            console.info('No Header for document of score: ' + score_name);
            console.info('Using score name as header');
            header = score_name;
        } else {
            header = header_xml.text();
        }
        Object.assign(doc_section, {'header': header});

        var sections = [];
        var sections_xml = doc_xml.find('./Sections/Section');
        for (section in sections_xml) {
            var current_section = sections_xml[section];
            var elements = [];
            var childs = current_section.find('*');

            for (child in childs) {
                var current_child = childs[child];
                var current_name = current_child.name();
                var element = {};

                if (current_name == 'Title') {
                    var title = current_child.text();
                    Object.assign(element, {'type': 'Title'});
                    Object.assign(element, {'content': title});

                } else if (current_name == 'Description') {
                    // Replace line return with br tag and remove the first one (before the text)
                    var description = current_child.text().replace(/(?:\r\n|\r|\n)/g, '<br>');
                    description = description.replace("<br>", "");

                    Object.assign(element, {'type': 'Description'});
                    Object.assign(element, {'content': description});

                } else if (current_name == 'RemoteAction') {
                    var remote_action = {};
                    var action_uid = current_child.attr('UID').value();
                    var action_name_tag = current_child.attr('Name');
                    if (action_name_tag == null) {
                        console.warn('No name attribute for the remote action, using UID as name instead.');
                        var action_name = action_uid;
                    } else {
                        var action_name = action_name_tag.value();
                    }

                    Object.assign(remote_action, {'name': action_name});
                    Object.assign(remote_action, {'UID': action_uid});

                    Object.assign(element, {'type': 'RemoteAction'});
                    Object.assign(element, {'content': remote_action});

                } else if (current_name == 'HTTP') {
                    var httpLink = {};
                    var link_text = current_child.text();
                    var link_url = current_child.attr('href').value();

                    Object.assign(httpLink, {'text': link_text});
                    Object.assign(httpLink, {'url': link_url});

                    Object.assign(element, {'type': 'HTTP'});
                    Object.assign(element, {'content': httpLink});
                }
                elements.push(element);
            }

            sections.push(elements);
        }
        Object.assign(doc_section, {'sections': sections});
    }
    doc_Sections.push(doc_section);
}

// Getting the different thresholds
function readThresholds(xmlDoc){
    var limits = [];
    try {
        var thresholds = xmlDoc.get('//Thresholds').find('./Threshold');
        if (!Array.isArray(thresholds) || !thresholds.length) {
            throw 'Error finding Thresholds: no thresholds found';
        }

        for (var threshold_index in thresholds){
            var threshold_xml = thresholds[threshold_index];
            try {
                var keywords = threshold_xml.find('./Keyword');
                if (!Array.isArray(keywords) || !keywords.length) {
                    throw 'Error finding Keywords: no keywords found';
                }
            }
            catch(e) {
                console.error(e);
            }
            try {
                var color_attr = threshold_xml.attr('Color');
                if (color_attr == null) {
                    throw 'Error with the color attribute of the threshold: no attribute';
                }
                var color_value = color_attr.value();
                if (color_value === '') {
                    throw 'Error with the color attribute of the threshold: no value';
                }
            }
            catch(e) {
                console.error(e);
            }

            for (var keywordindex in keywords ){
                try {
                    var from_attr = keywords[keywordindex].attr('From');
                    if (from_attr == null) {
                        throw 'Error with the from attribute of the keyword: no attribute';
                    }
                    var from_value = from_attr.value();
                    if (from_value === "") {
                        throw 'Error with the from attribute of the keyword: no value';
                    }
                }
                catch(e) {
                    console.error(e);
                }

                try {
                    var label_attr = keywords[keywordindex].attr('Label');
                    if (label_attr == null) {
                        throw 'Error with the label attribute of the keyword: no attribute';
                    }
                    var label_value = label_attr.value();
                    if (label_value === "") {
                        throw 'Error with the label attribute of the keyword: no value';
                    }
                }
                catch(e) {
                    console.error(e);
                }

                var limit = [from_value, label_value, color_value];
                limits.push(limit);
            }
        }
    }
    catch(e) {
        console.error(e);
    }
    return limits;
}

// Function to read the normalization
function readNormalization(score_norm) {
    var normalization = {};
    try {
        if (score_norm == null) {
            throw 'Error with normalization: no normalization section';
        }
        var normType = score_norm.child(1);
        var normType_name = normType.name();
        if (normType_name == null) {
            throw 'Error with normalization: nothing under the normalization tags';
        }
		switch (normType_name){
			case 'Enums':
				var enums = normType.find('./Enum');
				if (!Array.isArray(enums) || !enums.length) {
                    throw 'Error with normalization: no "Enum" tag found in "Enums"';
                }
				Object.assign(normalization, {'type': 'enum'});

                var elements = [];
				for (enumindex in enums) {
                    var enum_xml = enums[enumindex];
					var value = enum_xml.attr('Value').value();
                    var label_attr = enum_xml.attr('Label');
					if ( label_attr == null){
						var label = '';
					}
					else {
                        var label = label_attr.value();
					}
                    var element = [value, label];
                    elements.push(element);
				}

                Object.assign(normalization, {'enums': elements});
				break;

			case 'Strings':
				var stringz = normType.find('./String');
                if (!Array.isArray(stringz) || !stringz.length) {
                    throw 'Error with normalization: no "String" tag found in "Strings"';
                }
				Object.assign(normalization, {'type': 'string'});

                var elements = [];
				for (stringindex in stringz) {
                    var string_xml = stringz[stringindex];
					var value = string_xml.attr('Value').value();
                    var label_attr = string_xml.attr('Label');
					if ( label_attr == null){
						var label = '';
					}
					else {
                        var label = label_attr.value();
					}
                    var element = [value, label];
                    elements.push(element);
				}

                Object.assign(normalization, {'strings': elements});
				break;

			case 'Ranges':
				var rangez = normType.find("./Range");
                if (!Array.isArray(rangez) || !rangez.length) {
                    throw 'Error with normalization: no "Range" tag found in "Ranges"';
                }
				Object.assign(normalization, {'type': 'range'});

                var elements = [];
				for (rangeindex in rangez) {
                    var range_xml = rangez[rangeindex];
					var from_value = range_xml.get("./From").attr('Value').value();
                    var to_attr = range_xml.get("./To");
                    if ( to_attr == null) {
                        var to_value = '';
                    } else {
                        var to_value = to_attr.attr('Value').value();
                    }

                    var label_attr = range_xml.attr('Label');
					if ( label_attr == null){
						var label = '';
					}
					else {
                        var label = label_attr.value();
					}
                    var element = [from_value, to_value, label];
                    elements.push(element);
				}

                Object.assign(normalization, {'ranges': elements});
				break;

			default:
				throw 'Error with normalization: "Ranges", "Enums" or "Strings" not found';
				break;
		}
	}
    catch(e) {
        console.error(e);
        Object.assign(normalization, {'type': '-'});
    }
    return normalization;
}

// Function to calculate the colors of the cell depending on the limits of the score
function calcColor(score, scoreId){
	var result = {'Label': 'good', 'Color': 'green'};
	for (var cnt in scoreArray[scoreId].limits) {
        var limit_from = scoreArray[scoreId].limits[cnt][0];
        var limit_label = scoreArray[scoreId].limits[cnt][1];
        var limit_color = scoreArray[scoreId].limits[cnt][2];
		if (score >= limit_from){
			result = {'Label': limit_label, 'Color': limit_color};
		}
	}
	return result;
}

// Function to transform a payload to the value that will be displayed
function payloadToLabel(payload, normalization, format) {
    var norm_type = normalization.type;
    var displayed_payload = payload;
    switch (norm_type) {
        case 'enum':
            for (index in normalization.enums) {
                var enum_string = normalization.enums[index][0];
                var label = normalization.enums[index][1];
                if (payload == enum_string) {
                    if (label === '') {
                        displayed_payload = payload;
                    } else {
                        displayed_payload = label;
                    }
                }
            }
            break;
        case 'string':
            if (payload){
                for (index in normalization.strings) {
                    var string_pattern = normalization.strings[index][0];
                    var label = normalization.strings[index][1];
                    var exp = string_pattern.replace(/[\-\[\]\/\{\}\(\)\+\.\\\^\$\|]/g, "\\$&");
                    var exp = exp.replace(/\*/g, '.*').replace(/\?/g, '\\w');
                    var regexp = new RegExp(exp);
                    if (regexp.test(payload)) {
                        if (label === '') {
                            displayed_payload = payload;
                        } else {
                            displayed_payload = label;
                        }
                    }
                }
            }
            else{
                displayed_payload = '-';
            }
            break;
        case 'range':
            if (payload) {
                displayed_payload = transform(payload, format);
                for (index in normalization.ranges) {
                    var from_value = normalization.ranges[index][0];
                    var to_value = normalization.ranges[index][1];
                    var label = normalization.ranges[index][2];
                    switch (to_value) {
                        case '':
                            if (payload >= from_value) {
                                if (label !== '') {
                                    displayed_payload = label;
                                }
                            }
                            break;

                        default:
                            if (payload >= from_value && payload <= to_value) {
                                if (label !== '') {
                                    displayed_payload = label;
                                }
                                return displayed_payload;
                            }
                            break;
                    }
                }
            }
            else{
                displayed_payload = '-';
            }
            break;
        default:
            if (payload) {
                displayed_payload = payload;
            } else {
                displayed_payload = '-';
            }
            break;
    }
    return displayed_payload;
}

// Function that will convert a payload depending on the format
function transform(payload, format){
	var temp = parseFloat(payload);
	var strreturn = '';
	switch (format) {
		case 'percent':
			temp = temp*100;
            if (temp == 0) {
                strreturn = '0%'
            } else {
                strreturn = temp.toFixed(1) + '%';
            }
			break;
		case 'permill':
			temp = temp*1000;
            if (temp == 0) {
                strreturn = '0%'
            } else {
                strreturn = temp.toFixed(1) + '%';
            }
			break;
		case 'byte':
			if (temp > 1099511627776){
				temp = temp /1099511627776;
				strreturn = temp.toFixed(2) + ' TB';
				break;
			}
			if (temp > 1073741824){
				temp = temp /1073741824;
				strreturn = temp.toFixed(2) + ' GB';
				break;
			}
			if (temp > 1048576){
				temp = temp /1048576;
				strreturn = temp.toFixed(2) + ' MB';
				break;
			}
			if (temp > 1024){
				temp = temp /1024;
				strreturn = temp.toFixed(2) + ' KB';
			}
			strreturn = temp + 'bytes';
			break;
		case 'second':
		case 'millisecond':
		case 'microsecond':
			strreturn = convert_time(temp, format);
			break;
		case 'mhz':
			strreturn = temp.toFixed(2) +' MHz';
			break;
		case 'bps':
			strreturn = temp.toFixed(2) + ' bps';
			break;
		default:
            strreturn = payload;
			break;
	}
	return strreturn;
}

// Function to convert a time value to a string (in second, millisecond or microsecond)
function convert_time(value, format){
    var micro;
    var milli;
    var sec;
    var min;
    var hour;
    var day;
    var day_divided;
    var scientific_notation = /(e-[0-9])/;
    var return_time_value = '';
    console.info(`Converting duration ${value}`);
    switch (format) {
        case 'second':
            sec = value % 60;
            min = parseInt((value / 60) % 60);
            hour = parseInt((value / (60 * 60)) % 24);
            day_divided = value / (60 * 60 * 24);
            if (scientific_notation.test(day_divided)) {
                day = 0;
            } else {
                day = parseInt(day_divided);
            }
            console.info(`Sec: ${sec}, Min: ${min}, Hour: ${hour}, Day: ${day}`);
			break;
		case 'millisecond':
            milli = value % 1000;
            sec = parseInt((value / 1000) % 60);
            min = parseInt((value / (1000 * 60)) % 60);
            hour = parseInt((value / (1000 * 60 * 60)) % 24);
            day_divided = value / (1000 * 60 * 60 * 24);
            if (scientific_notation.test(day_divided)) {
                day = 0;
            } else {
                day = parseInt(day_divided);
            }
            console.info(`Milli: ${milli}, Sec: ${sec}, Min: ${min}, Hour: ${hour}, Day: ${day}`);
            break;
		case 'microsecond':
            micro = value % 1000;
            milli = parseInt((value / 1000) % 1000);
            sec = parseInt((value / (1000 * 1000)) % 60);
            min = parseInt((value / (1000 * 1000 * 60)) % 60);
            hour = parseInt((value / (1000 * 1000 * 60 * 60)) % 24);
            day_divided = value / (1000 * 1000 * 60 * 60 * 24);
            if (scientific_notation.test(day_divided)) {
                day = 0;
            } else {
                day = parseInt(day_divided);
            }
            console.info(`Micro: ${micro}, Milli: ${milli}, Sec: ${sec}, Min: ${min}, Hour: ${hour}, Day: ${day}`);
            break;
    }

    var milli_comma = parseInt(milli / 1000);
    var micro_comma = parseInt(((micro / 1000).toFixed(2)) * 100);

    if (day > 0 && hour > 0 && min > 0 && sec > 0) {
        return_time_value = `${day}d ${hour}h ${min}min ${sec}s`;
    } else if (day > 0 && hour > 0 && min > 0) {
        return_time_value = `${day}d ${hour}h ${min}min`;
    } else if (day > 0 && hour > 0 && sec > 0) {
        return_time_value = `${day}d ${hour}h ${sec}s`;
    } else if (day > 0 && hour > 0) {
        return_time_value = `${day}d ${hour}h`;
    } else if (day > 0 && min > 0 && sec > 0) {
        return_time_value = `${day}d ${min}min ${sec}s`;
    } else if (day > 0 && min > 0) {
        return_time_value = `${day}d ${min}min`;
    } else if (day > 0 && sec > 0) {
        return_time_value = `${day}d ${sec}s`;
    } else if (day > 0) {
        return_time_value = `${day}d`;
    } else if (hour > 0 && min > 0 && sec > 0) {
        return_time_value = `${hour}h ${min}min ${sec}s`;
    } else if (hour > 0 && min > 0) {
        return_time_value = `${hour}h ${min}min`;
    } else if (hour > 0 && sec > 0) {
        return_time_value = `${hour}h ${sec}s`;
    } else if (hour > 0) {
        return_time_value = `${hour}h`;
    } else if (min > 0 && sec > 0) {
        return_time_value = `${min}min ${sec}s`;
    } else if (sec > 0 && milli_comma > 0) {
        return_time_value = `${sec}.${milli_comma}s`;
    } else if (sec > 0) {
        return_time_value = `${sec}s`;
    } else if (milli > 0 && micro_comma > 0) {
        return_time_value = `${milli}.${micro_comma}ms`;
    } else if (milli > 0) {
        return_time_value = `${milli}ms`;
    } else {
        return_time_value = `${micro}μs`;
    }

    return return_time_value;
}

// Function called when https://hostname/score/scoreindex/device_name is called
// Handle the query to the Engine and the display of the specific score
function getScore(req, res, scoreId) {
    console.info(`======= Displaying score ID: ${scoreId} =======`);
    try {
        var selected_main_score = scoreArray[scoreId];
        if (typeof selected_main_score === 'undefined'){
            throw "Score number out of bounds";
        }

        var device_ID = req.params.deviceId.toUpperCase();
        var engine = clientList[device_ID][0];
        var device_type = clientList[device_ID][1];
        if (typeof engine === 'undefined'){
            throw "No valid device found";
        }

        var score_fields = selected_main_score.selectstring;
        var select_string = `${default_fields} ${score_fields}`;
        var encoded_fields = encodeURIComponent(select_string);

        engine_options.baseUrl = `https://${engine}:${api_port}/2/`;
        var query = `query?platform=windows&query=select (${encoded_fields})(from device (where device (eq name (string "${device_ID}"))))&format=json`;
        engine_options.uri = query;
        // Write test query to file
        fs.writeFile(__dirname + `/test_query_${scoreId}.txt`, engine_options.baseUrl + engine_options.uri, function(err) {
            if(err) {
                return console.error(err);
            }
        });

        request(engine_options, function(error, response, body){
            try {
                if (error) {
                    throw "Error: unable to contact Nexthink Engine";
                }

                var status_code = response.statusCode;
                if (status_code != "200") {
                    throw "Error: issue with the query. Status Code: " + status_code + ". Response: " + body;
                }

                var output = JSON.parse(body);
                var last_seen = output[0]['last_seen'];
                writeBeginning(res);
                writeInfo(device_ID, device_type, last_seen, engine, res);
                writeContent(selected_main_score, output, scoreId, res);
                writeEnd(res);
            }
            catch(e) {
                if (typeof e == 'string' || e instanceof String) {
                    console.error(e);
                    res.write(e);
                } else {
                    console.error(e.toString());
                    res.write(e.toString());
                }
                res.end();
            }
        });
    }
    catch(e) {
        if (typeof e == 'string' || e instanceof String) {
            console.error(e);
            res.write(e);
        } else {
            console.error(e.toString());
            res.write(e.toString());
        }
        res.end();
    }
}

// Function called when https://hostname/device/device_name is called
// Handle the query to the Engine and the display of the scores
// Calls getScore in case there is only one score
function getScores(req, res) {
    if (scoreArray.length == '1') {
        getScore(req, res, 0);
    } else {
        console.info(`======= Displaying all scores =======`);
        try {
            var device_ID = req.params.deviceId.toUpperCase();
            var engine = clientList[device_ID][0];
            var device_type = clientList[device_ID][1];
            if (typeof engine === 'undefined'){
                throw "No valid device found";
            }

            var score_fields = '';
            for (scoreindex in scoreArray) {
                var selected_score = scoreArray[scoreindex];
                score_fields += selected_score.selectstring;
            }
            var select_string = `${default_fields} ${score_fields}`;
            var encoded_fields = encodeURIComponent(select_string);

            engine_options.baseUrl = `https://${engine}:${api_port}/2/`;
            var query = `query?platform=windows&query=select (${encoded_fields})(from device (where device (eq name (string "${device_ID}"))))&format=json`;
            engine_options.uri = query;
            // Write test query to file
            fs.writeFile(__dirname + "/test_query_all.txt", engine_options.baseUrl + engine_options.uri, function(err) {
                if(err) {
                    return console.error(err);
                }
            });

            request(engine_options, function(error, response, body){
                try {
                    if (error) {
                        throw "Error: unable to contact Nexthink Engine";
                    }

                    var status_code = response.statusCode;
                    if (status_code != "200") {
                        throw "Error: issue with the query. Status Code: " + status_code + ". Response: " + body;
                    }

                    var output = JSON.parse(body);
                    var last_seen = output[0]['last_seen'];
                    writeBeginning(res);
                    writeInfo(device_ID, device_type, last_seen, engine, res);
                    writeMenu(scoreArray, res);
                    for (scoreindex in scoreArray) {
                        var selected_score = scoreArray[scoreindex];
                        writeContent(selected_score, output, scoreindex, res);
                    }
                    writeEnd(res);
                }
                catch(e) {
                    if (typeof e == 'string' || e instanceof String) {
                        console.error(e);
                        res.write(e);
                    } else {
                        console.error(e.toString());
                        res.write(e.toString());
                    }
                    res.end();
                }
            });
        }
        catch(e) {
            if (typeof e == 'string' || e instanceof String) {
                console.error(e);
                res.write(e);
            } else {
                console.error(e.toString());
                res.write(e.toString());
            }
            res.end();
        }
    }
}

// Function to verify if an object is empty or not (used for the documentation display part)
function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}

// Function to write the main explanation on how the settings.json file is done
// And also how the different URLs work
function writeConfiguration(res){
    res.write("<!DOCTYPE html>");
	res.write("<html>");
	res.write("<head><meta charset='utf-8'>");
	res.write("<link rel='stylesheet' type='text/css' href='/style/mystyle.css'>");
	res.write("<title>Nexthink integration</title>");
	res.write("</head>");
	res.write("<body>");
    res.write("<div class='col-12 docpagesection row'>");
    res.write("<p>There are two different usage of the integration:</p>");
    res.write("<ul>");
    res.write(`<li> https://FQDN_OR_IP/device/device_name </li>`);
    res.write(`<li> https://FQDN_OR_IP/score/score_id/device_name </li>`);
    res.write("</ul>");
    res.write("<p>The first one will provide a view with the different score files, as in the Finder</p>");
    res.write("<p>The second will provide a view with only the specific score.</p>");
    res.write("<p>In both cases, replace the device_name with an actual name of a device reporting to a Nexthink Engine. Find below the id to score mapping:</p>");
    res.write("<p> To know which score id to use, find below the id to score mapping:</p>");
    res.write("</div>");
    res.write("<div class='col-12 row'>");
    res.write("<div class='col-2'></div>");
    res.write("<div class='col-10'>");
    res.write("<table class='settings'>");
    res.write("<tr>");
    res.write("<th>Score ID</th>");
    res.write("<th>Score Name</th>");
    res.write("</tr>");
    for (scoreid in xmlscoreFiles) {
        var score_name = xmlscoreFiles[scoreid];
        res.write("<tr>");
        res.write(`<td>${scoreid}</td>`);
        res.write(`<td>${score_name}</td>`);
        res.write("</tr>");
    }
    res.write("</table>");
    res.write("</div>");
    res.write("</div>");
    res.write("<div class='col-12 docpagesection row'><p>Find below the list of settings that should be defined in the settings.json file:</p></div>");
    res.write("<div class='col-12 row'>");
    res.write("<div class='col-2'></div>");
    res.write("<div class='col-10'>");
    res.write("<table class='settings'>");
    res.write("<tr>");
    res.write("<th>Setting Name</th>");
    res.write("<th>Description</th>");
    res.write(`<th>Example</th>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>engineOptions</td>");
    res.write("<td>an Object containing the credentials for the nxql query</td>");
    res.write(`<td>"engineOptions": {"auth": {"user": "nxql_user", "pass": "nxql_password"}}</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>engines</td>");
    res.write("<td>an Array of Engine</td>");
    res.write(`<td>"engines": [engine01_IP_OR_FQDN, engine02_IP_OR_FQDN]</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>portalOptions</td>");
    res.write("<td>an Object containing the credentials for running Remote Actions</td>");
    res.write(`<td>"portalOptions": {"auth": {"user": "ra_user", "pass": "ra_password"}}</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>portal</td>");
    res.write("<td>IP or FQDN of the Portal</td>");
    res.write(`<td>"portal": "portal_IP_OR_FQDN"</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>APIport</td>");
    res.write("<td>Port used for NXQL queries. Default is 1671.</td>");
    res.write(`<td>"APIport": "1671"</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>ActEnabled</td>");
    res.write("<td>Boolean value used to determine if Remote Action links are displayed or not. Default is false.</td>");
    res.write(`<td>"ActEnabled": true</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>DeviceInfo</td>");
    res.write("<td>Boolean value used to determine if the device information should be displayed at the top or not. Default is true.</td>");
    res.write(`<td>"DeviceInfo": true</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>Finderlink</td>");
    res.write("<td>Boolean value used to determine if a Finder button is displayed or not. Default is true.</td>");
    res.write(`<td>"Finderlink": true</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>Online</td>");
    res.write("<td>Boolean value used to determine if the appliance has internet access or not. Default is true.</td>");
    res.write(`<td>"Online": true</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>Certificates</td>");
    res.write("<td>Boolean value used to determine if a Finder button is displayed or not. Default is 'selfsigned'.</td>");
    res.write(`<td>"certificates": "trusted"</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>scoreFile*</td>");
    res.write("<td>Name of a score file.</td>");
    res.write(`<td>"scoreFile": "L1_Checklist.xml"</td>`);
    res.write("</tr>");
    res.write("<tr>");
    res.write("<td>scoreFiles*</td>");
    res.write("<td>Array of score file names.</td>");
    res.write(`<td>"scoreFiles": ["L1_Checklist.xml", "Compliance.xml"]</td>`);
    res.write("</tr>");
    res.write("</table>");
    res.write("</div>");
    res.write("</div>");
    res.write("<div class='col-12 docpagesection row'><span>* scoreFiles is used when you wish to display multiple score. Only one of those two options should be set in the file. If both are set, scoreFiles takes precedence</span></div>");
	res.write("</body>");
    res.write("</html>");
	res.end();
}

// Function to write the header of the html page
function writeBeginning(res){
    res.write("<!DOCTYPE html>");
    res.write("<html>");
    res.write("<head><meta charset='utf-8'>");
    res.write("<link rel='stylesheet' type='text/css' href='/style/mystyle.css'>");
    res.write("<link rel='shortcut icon' type='image/x-icon' href='/images/favicon.png'>");
    res.write("<title>Nexthink integration</title>");
    res.write(`<script type='text/javascript' src='${jquery_path}'></script>`);
    res.write("<script type='text/javascript' src='/scripts/nxtscripts.js'></script>");
    res.write("</head>");
    res.write("<body>");
}

// Function to write the end of the html page
function writeEnd(res){
    res.write("</body></html>");
    res.end();
}

// Function to write the beginning of the body section (depending on some settings in the settings.json file)
function writeInfo(device_ID, device_type, last_seen, engine, res){
    switch(device_type) {
        case 'laptop':
            var device_path = '/images/laptop.png';
            break;
        case 'desktop':
            var device_path = '/images/desktop.png';
            break;
        case 'server':
            var device_path = '/images/server.png';
            break;
        default:
            var device_path = '/images/desktop.png';
    }
    res.write("<div class='row'>");
    res.write("<div class='col-7'>");
    res.write("<div class='col-10 info'>");
    if ( device_info ) {
        res.write("<table class='information'>");
        res.write("<tr>");
        res.write(`<img class='deviceimg' src='${device_path}'>`);
        res.write("</tr>");
        res.write("<tr>");
        res.write("<th>Device Name: </th>");
        res.write(`<th>${device_ID}</th>`);
        res.write("</tr>");
        res.write("<tr>");
        res.write("<th>Last Seen:</th>");
        res.write(`<th>${last_seen}</th>`);
        res.write("</tr>");
        res.write("</table>");
    }
    if ( finder_link ) {
        res.write(`<a class='finder' href='nxt://Show-NxSource?Name=${device_ID}&Host=${portal}&Port=443&EngineName=${engine}'>Nexthink Finder</a>`);
    }
    res.write("</div>");
    res.write("</div>");
    res.write("</div>");
}

// Function to write the navigation menu (in case there are more than one score to display)
function writeMenu(scoreArray, res){
    res.write("<div class='col-10 row scoremenu'>");
    for (scoreindex in scoreArray) {
        var selected_scoredef = scoreArray[scoreindex].scoredefname;
        var selected_score = scoreArray[scoreindex].scorename;
        res.write(`<div class='col-2 scoreitem' name='${selected_score}'>${selected_scoredef}</div>`);
    }
    res.write("</div>");

}

// Function to write the main content (score and their documentation)
function writeContent(selected_score, output, scoreId, res){
    var main_score_name = selected_score.scorename;
    res.write(`<div class='col-12 row content' name='${main_score_name}_content'>`);

    writeScore(selected_score, output, scoreId, res);
    writeDoc(selected_score, output, res);

    res.write("</div>");
}

// Function to write the scores
function writeScore(selected_score, output, scoreId, res){
    res.write("<div name='score' class='col-7 scorepane'>");
    var main_score_name = selected_score.scoredefname;

    for (scoreindex in selected_score.scores){
        var current_score = selected_score.scores[scoreindex];
        var score_type = current_score.type;
        var sub_score_name = current_score.name;
        try {
            if ( score_type === "Composite"){
                res.write(`<div id='${sub_score_name}' class='col-10 composite'> ${sub_score_name} </div>`);
            }
            else {
                var scorestring = `score:${main_score_name}/${sub_score_name}`;
                var payloadstring = scorestring + "/payload";
                var score_description = current_score.description;
                if (typeof output[0][scorestring] == 'number') {
                    var score_value = output[0][scorestring];
                    if (score_value % 1 == 0) {
                        var score_display = score_value;
                    } else {
                        var score_display = score_value.toFixed(2);
                    }
                    var score_color = calcColor(score_value, scoreId).Color;
                } else {
                    var score_display = '-';
                    var score_color = '';
                }
                var score_payload = output[0][payloadstring];
                console.info(`Value of score ${sub_score_name}: ${score_value}`);
                console.info(`Payload of score ${sub_score_name}: ${score_payload}`);
                var leaf_value = payloadToLabel(score_payload, current_score.normalization, current_score.format);
                console.info(`Transformed Payload of score ${sub_score_name}: ${leaf_value}`);
                res.write(`<div class='col-12 line'>`);
                res.write(`<div class='col-2 scorevalue ${score_color}'> ${score_display} </div>`);
                res.write(`<div class='col-3 leaf'> ${sub_score_name} </div>`);
                res.write(`<div class='col-6 payload tooltip'>${leaf_value}<span class='tooltiptext'> ${score_description} </span></div>`);
                res.write("</div>");
            }
        }
        catch(e) {
            console.error(e.toString());
            res.write(`<div class='col-12 line'>Issue displaying score ${sub_score_name}</div>`);
        }
    }
    //Closing scorepane div
    res.write("</div>");
}

// Function to write the documentation
function writeDoc(selected_score, output, res){
    res.write("<div name='document' class='col-4 docpane'>");
    for (doc in selected_score.doc_sections){
        var current_doc = selected_score.doc_sections[doc];
        if (!isEmpty(current_doc)) {
            var div_name = current_doc.score;
            var doc_header = current_doc.header;
            res.write(`<div name='${div_name}_doc' class='col-12 docsection'>`);
            res.write(`<div class='col-12 docheader'>${doc_header}</div>`);
            for (section in current_doc.sections) {
                var current_section = current_doc.sections[section];
                for (element in current_section) {
                    var current_element = current_section[element];

                    if (current_element.type == 'Title') {
                        var section_title = current_element.content;
                        res.write(`<div class='col-12 sectiontitle'>${section_title}</div>`);
                    } else if (current_element.type == 'Description') {
                        var section_description = current_element.content;
                        res.write(`<div class='col-12 sectiontext'>${section_description}</div>`);
                    } else if (current_element.type == 'RemoteAction' && act_enabled) {
                        var device_uid = output[0]['device_uid'];
                        var remote_uid = current_element.content.UID;
                        var remote_name = current_element.content.name;
                        var act_param = `'${device_uid}', '${remote_uid}'`;
                        res.write(`<div class='col-10 actremote' device_uid=${device_uid} remote_uid=${remote_uid}>`);
                        res.write(`<div class='col-2 acticon'><img class='actimg' src='/images/nexthink-act.png'></div>`);
                        res.write(`<div class='col-10 actname'> ${remote_name} </div>`);
                        res.write("</div>");
                    } else if (current_element.type == 'HTTP') {
                        var link_url = current_element.content.url;
                        var link_text = current_element.content.text;
                        res.write("<div class='col-10 link'>");
                        res.write("<div class='col-2 linkicon'><img class='linkimg' src='/images/link-symbol.png'></div>");
                        res.write(`<div class='col-10 linkname'><a class='linkname' href='${link_url}' target='_blank'> ${link_text} </a></div>`);
                        res.write("</div>");
                    }
                }
            }
            //Closing docsection div
            res.write("</div>");
        }
    }
    //Closing document div
    res.write("</div>");
}
