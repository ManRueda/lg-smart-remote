var xml = require('xml2js');
var xmlBuilder = new xml.Builder();
var http = require('http');
var dgram = require('dgram');
var request = require('request');

function LGRemote(ip) {
  this.ip = ip;
  this.COMMANDS = LGRemote.COMMANDS;

  this.requestCode = function(cb) {
    var _this = this;
    return makeRequest(this, {
      method: 'POST',
      path: '/roap/api/auth',
      body:{
        auth: {type: 'AuthKeyReq'}
      }
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        if (cb)
          cb.call(_this, result);
      });
    });

  };

  this.auth = function(code, cb) {
    var _this = this;
    return makeRequest(this, {
      method: 'POST',
      path: '/roap/api/auth',
      body:{auth: {
        type: 'AuthReq',
        value: code
      }}
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        _this.session = result.envelope.session[0];
        if (cb)
          cb.call(_this, result);
      });
    });
  };

  this.sendCommand = function(cmd, cb) {
    var _this = this;
    return makeRequest(this, {
      method: 'POST',
      path: '/roap/api/command',
      body:{command: {
        name: 'HandleKeyInput',
        value: cmd
      }}
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        if (cb)
          cb.call(_this, result);
      });
    });
  };

  this.getData = function(id, cb) {
    var _this = this;
    return makeRequest(this, {
      method: 'GET',
      path: '/udap/api/data?target=' + id,
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        if (cb)
          cb.call(_this, result.envelope.data);
      });
    });
  };

  this.channelList = function(cb){
    var _this = this;
    return makeRequest(_this, {
      method: 'GET',
      path: '/udap/api/data?target=channel_list'
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        _this.channels = result;
        if (cb)
          cb.call(_this, result);
      });
    });
  };

  this.apps = function(cb){
    var _this = this;
    return makeRequest(_this, {
      method: 'GET',
      path: '/udap/api/data?target=applist_get&type=1&index=1&number=1024'
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        _this.apps = [];
        for(var i = 0; i < result.envelope.data.length; i++){
          _this.apps.push({
            auid: result.envelope.data[i].auid[0],
            name: result.envelope.data[i].name[0],
            type: Number(result.envelope.data[i].type[0]),
            cpid: result.envelope.data[i].cpid[0],
            adult: result.envelope.data[i].adult[0] === 'true',
            icon_name: result.envelope.data[i].icon_name[0]
          });
        }

        if (cb)
          cb.call(_this, _this.apps);
      });
    });
  };

  this.appIcon = function(auid, name, cb){
    var _this = this;
    return makeRequest(_this, {
      method: 'GET',
      path: '/udap/api/data?target=appicon_get&auid=' + auid + '&appname=' + name,
      type: 'image/png'
    }, function(resp){
      if (cb)
        cb.call(_this, resp);
    });
  };

  this.changeChannel = function(channel, cb){
    var _this = this;
    return makeRequest(_this, {
      method: 'POST',
      path: '/roap/api/command',
      body:{command: {
        name: 'HandleChannelChange',
        major: channel.major,
        minor: channel.minor,
        sourceIndex: channel.sourceIndex,
        physicalNum: channel.physicalNum,
      }}
    }, function(resp){
      xml.parseString(resp, function (err, result) {
        if (cb)
          cb.call(_this, result);
      });
    });
  };

  this.printScreen = function(cb){
    var _this = this;
    return makeRequest(_this, {
      method: 'GET',
      path: '/udap/api/data?target=screen_image',
      type: 'image/jpeg'
    }, function(resp){
      if (cb)
        cb.call(_this, resp);
    });
  };

  function makeRequest(control, opts, cb){
    var _xml;
    var response = '';
    if (opts.body){
      _xml = xmlBuilder.buildObject(opts.body);
    }

    var req = request({
      url: 'http://' + control.ip + ':' + 8080 + opts.path,
      method: opts.method,
      body: _xml,
      headers: {
        'Content-Type': opts.type || 'application/atom+xml',
        'Connection': 'keep-alive'
      }
    }, function(err, resp, body){
      if (cb)
        cb(body);
    });
    return req;
  }
}
LGRemote.findTV = function(cb){
  var response = [];
  var message = new Buffer(
		"M-SEARCH * HTTP/1.1\r\n" +
		"HOST:239.255.255.250:1900\r\n" +
		"MAN:\"ssdp:discover\"\r\n" +
		"ST: urn:schemas-udap:service:netrcu:1\r\n" +
		"MX:2\r\n" +
		"\r\n"
	);
  var client = dgram.createSocket("udp4");
	client.bind(); // So that we get a port so we can listen before sending


	client.send(message, 0, message.length, 1900, "239.255.255.250", function(){

    var server = dgram.createSocket("udp4");

  	server.on("message", function (msg, rinfo) {
      if (response.indexOf(rinfo.address) == -1)
  		  response.push(rinfo.address);
  	});

  	server.bind(client.address().port); // Bind to the random port we were given when sending the message, not 1900

  	// Give it a while for responses to come in
    var waiting = 0;
    function waitLoop() {
      setTimeout(function(){
        waiting++;
        if (response.length == 0 && waiting < 25){
          waitLoop();
        }else{
          server.close();
          cb(response);
        }
    	},1000);
    }
  	waitLoop();


    client.close();
  });

};
LGRemote.INFO = {
  TV_INFO_CURRENT_CHANNEL: 'cur_channel',
  TV_INFO_CHANNEL_LIST: 'channel_list',
  TV_INFO_CONTEXT_UI: 'context_ui',
  TV_INFO_VOLUME: 'volume_info',
  TV_INFO_SCREEN: 'screen_image',
  TV_INFO_3D: 'is_3d',
  TV_INFO_APP_LIST: 'applist_get',
  TV_INFO_APP_NUM: 'appnum_get',
  TV_INFO_APP_ICON: 'appicon_get'
};
LGRemote.COMMANDS = {
  TV_CMD_POWER: 1,
  TV_CMD_NUMBER_0: 2,
  TV_CMD_NUMBER_1: 3,
  TV_CMD_NUMBER_2: 4,
  TV_CMD_NUMBER_3: 5,
  TV_CMD_NUMBER_4: 6,
  TV_CMD_NUMBER_5: 7,
  TV_CMD_NUMBER_6: 8,
  TV_CMD_NUMBER_7: 9,
  TV_CMD_NUMBER_8: 10,
  TV_CMD_NUMBER_9: 11,
  TV_CMD_UP: 12,
  TV_CMD_DOWN: 13,
  TV_CMD_LEFT: 14,
  TV_CMD_RIGHT: 15,
  TV_CMD_OK: 20,
  TV_CMD_HOME_MENU: 21,
  TV_CMD_BACK: 23,
  TV_CMD_VOLUME_UP: 24,
  TV_CMD_VOLUME_DOWN: 25,
  TV_CMD_MUTE_TOGGLE: 26,
  TV_CMD_CHANNEL_UP: 27,
  TV_CMD_CHANNEL_DOWN: 28,
  TV_CMD_BLUE: 29,
  TV_CMD_GREEN: 30,
  TV_CMD_RED: 31,
  TV_CMD_YELLOW: 32,
  TV_CMD_PLAY: 33,
  TV_CMD_PAUSE: 34,
  TV_CMD_STOP: 35,
  TV_CMD_FAST_FORWARD: 36,
  TV_CMD_REWIND: 37,
  TV_CMD_SKIP_FORWARD: 38,
  TV_CMD_SKIP_BACKWARD: 39,
  TV_CMD_RECORD: 40,
  TV_CMD_RECORDING_LIST: 41,
  TV_CMD_REPEAT: 42,
  TV_CMD_LIVE_TV: 43,
  TV_CMD_EPG: 44,
  TV_CMD_PROGRAM_INFORMATION: 45,
  TV_CMD_ASPECT_RATIO: 46,
  TV_CMD_EXTERNAL_INPUT: 47,
  TV_CMD_PIP_SECONDARY_VIDEO: 48,
  TV_CMD_SHOW_SUBTITLE: 49,
  TV_CMD_PROGRAM_LIST: 50,
  TV_CMD_TELE_TEXT: 51,
  TV_CMD_MARK: 52,
  TV_CMD_3D_VIDEO: 400,
  TV_CMD_3D_LR: 401,
  TV_CMD_DASH: 402,
  TV_CMD_PREVIOUS_CHANNEL: 403,
  TV_CMD_FAVORITE_CHANNEL: 404,
  TV_CMD_QUICK_MENU: 405,
  TV_CMD_TEXT_OPTION: 406,
  TV_CMD_AUDIO_DESCRIPTION: 407,
  TV_CMD_ENERGY_SAVING: 409,
  TV_CMD_AV_MODE: 410,
  TV_CMD_SIMPLINK: 411,
  TV_CMD_EXIT: 412,
  TV_CMD_RESERVATION_PROGRAM_LIST: 413,
  TV_CMD_PIP_CHANNEL_UP: 414,
  TV_CMD_PIP_CHANNEL_DOWN: 415,
  TV_CMD_SWITCH_VIDEO: 416,
  TV_CMD_APPS: 417,
  TV_CMD_MOUSE_MOVE: 'HandleTouchMove',
  TV_CMD_MOUSE_CLICK: 'HandleTouchClick',
  TV_CMD_TOUCH_WHEEL: 'HandleTouchWheel',
  TV_CMD_CHANGE_CHANNEL: 'HandleChannelChange',
  TV_CMD_SCROLL_UP: 'up',
  TV_CMD_SCROLL_DOWN: 'down',
  TV_LAUNCH_APP: 'AppExecute',
  TV_TERMINATE_APP: 'AppTerminate'
};

module.exports = LGRemote;
