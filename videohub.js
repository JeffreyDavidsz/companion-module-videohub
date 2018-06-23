var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// Request id counter
	self.request_id = 0;
	self.stash = [];
	self.command = null;

	self.input_labels = {};
	self.output_labels = {};
	self.routing = {};

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.updateRouting = function(labeltype, object) {
	var self = this;

	for (var key in object) {

		var parsethis = object[key];
		var a = parsethis.split(/ /);
		var dest = a.shift();
		var src = a.join(" ");

		// TODO: update feedback with info from here.

		self.routing[dest] = src;

	}

};

instance.prototype.updateLabels = function(labeltype, object) {
	var self = this;

	if (labeltype == 'INPUT LABELS') {
		for (var key in object) {
			var parsethis = object[key];
			var a = parsethis.split(/ /);
			var num = a.shift();
			var label = a.join(" ");
			self.input_labels[num] = label;
		}
	}

	else if (labeltype == 'OUTPUT LABELS') {
		for (var key in object) {
			var parsethis = object[key];
			var a = parsethis.split(/ /);
			var num = a.shift();
			var label = a.join(" ");
			self.output_labels[num] = label;
		}
	}

	self.actions();
	// TODO: update labels in action selection!

};

instance.prototype.videohubInformation = function(key,data) {
	var self = this;

	if (key.match(/(INPUT|OUTPUT) LABELS/)) {
		self.updateLabels(key,data);
	}

	else if (key == 'VIDEO OUTPUT ROUTING') {
		self.updateRouting(key,data);
	}

	else {
		// TODO: find out more about the video hub from stuff that comes in here
	}

};

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.config = config;
	self.init_tcp();
};

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;
	var receivebuffer = '';

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.port === undefined) {
		self.config.port = 9990;
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			debug("Connected");
		});

		// separate buffered stream into lines with responses
		self.socket.on('data', function (chunk) {
			var i = 0, line = '', offset = 0;
			receivebuffer += chunk;
			while ( (i = receivebuffer.indexOf('\n', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset);
				offset = i + 1;
				self.socket.emit('receiveline', line.toString());
			}
			receivebuffer = receivebuffer.substr(offset);
		});

		self.socket.on('receiveline', function (line) {

			if (self.command === null && line.match(/:/) ) {
				self.command = line;
			}

			else if (self.command !== null && line.length > 0) {
				self.stash.push(line.trim());
			}

			else if (line.length === 0 && self.command !== null) {
				var cmd = self.command.trim().split(/:/)[0];

				// TODO: clone object here?!
				self.videohubInformation(cmd, self.stash);

				self.stash = [];
				self.command = null;
			}

			else {
				debug("weird response from videohub", line, line.length);
			}

		});

	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Videohub IP',
			width: 6,
			default: '192.168.0.1',
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	debug("destroy", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;

	var videohub_sources = [];
	var videohub_destinations = [];

	for (var input_index in self.input_labels) {
		var inp = parseInt(input_index)+1;
		videohub_sources.push({ id: input_index, label: inp + ": " + self.input_labels[input_index] });
	}

	for (var output_index in self.output_labels) {
		var outp = parseInt(output_index)+1;
		videohub_destinations.push({ id: output_index, label: outp + ": " + self.output_labels[output_index] });
	}

	console.log("videohub_destinations", videohub_destinations);

	self.system.emit('instance_actions', self.id, {

		'rename_destination': {
			label: 'Rename destination',
			options: [
				{
					type: 'textinput',
					label: 'New label',
					id: 'label',
					default: "Dest name"
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					default: '0',
					choices: videohub_destinations
				}
			]
		},

		'rename_source': {
			label: 'Rename source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: '0',
					choices: videohub_sources
				},
				{
					type: 'textinput',
					label: 'New label',
					id: 'label',
					default: "Src name"
				},
			]
		},

		'route': {
			label: 'Route',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: '0',
					choices: videohub_sources
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					default: '0',
					choices: videohub_destinations
				}
			]
		}

	});
}
/*
Sending some action { id: 'Sk3_KFjW7',
	label: 'S14IRPq-X:rename_destination',
	instance: 'S14IRPq-X',
	action: 'rename_destination',
	options: { label: 'Dest name', destination: '0' } }
	lib/tcp sending 27 bytes to 10.40.101.3 9990 +15h
Sending some action { id: 'By0dYKjbQ',
	label: 'S14IRPq-X:rename_source',
	instance: 'S14IRPq-X',
	action: 'rename_source',
	options: { source: '0', label: 'Src name' } }
	lib/tcp sending 27 bytes to 10.40.101.3 9990 +0ms
Sending some action { id: 'SkbYKtsWm',
	label: 'S14IRPq-X:route',
	instance: 'S14IRPq-X',
	action: 'route',
	options: { source: '1', destination: '0' } }
	lib/tcp sending 27 bytes to 10.40.101.3 9990 +1ms

*/
instance.prototype.action = function(action) {

	var self = this;
	console.log("Sending some action", action);
	var cmd;

	if (action.action === 'route') {
		cmd = "VIDEO OUTPUT ROUTING:\n"+action.options.destination+" "+action.options.source+"\n\n";
	}
	else if (action.action === 'rename_source') {
		cmd = "INPUT LABELS:\n"+action.options.source+" "+action.options.label+"\n\n";
	}
	else if (action.action === 'rename_destination') {
		cmd = "OUTPUT LABELS:\n"+action.options.destination+" "+action.options.label+"\n\n";
	}

	if (cmd !== undefined) {
		console.log("SENDING TO VIDEOHUB:\n" + cmd);
		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(cmd);
		} else {
			debug('Socket not connected :(');
		}

	}
};

instance.module_info = {
	label: 'BMD VideoHub',
	id: 'videohub',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
