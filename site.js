var express = require('express');
var app = express();
var http = require('http').Server(app);
var LGControl = require('./lib/control');
var session = require("express-session")({
    secret: "LGControl",
    resave: true,
    saveUninitialized: true
});
var bodyParser = require('body-parser');
var io = require('socket.io')(http);
var sharedsession = require("express-socket.io-session");
var stream = require('stream');



app.set('view engine', 'jade');
app.use(session);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/lib'));

function sessionProtection(req, res, next) {
  if (req.session.control !== undefined){
    req.session.control = new LGControl(req.session.control.ip);
    next();
  }else{
    return res.redirect('/connect');
  }
}

app.get('/', sessionProtection, function (req, res) {
  res.render('index', {cmds: LGControl.COMMANDS, session: req.session.control.session, response: req.session.lastResponse});
  delete req.session.lastResponse;
});

app.get('/connect', function (req, res) {
  LGControl.findTV(function(tvs){
    res.render('connect', {tvs: tvs});
  });
});

app.post('/connect', function (req, res) {
  req.session.control = new LGControl(req.body.ip);
  req.session.control.requestCode(function() {
    res.redirect('/auth');
  });
});

app.get('/auth', sessionProtection, function (req, res) {
  res.render('auth', {cmds: LGControl.COMMANDS});
});

app.post('/auth', sessionProtection, function (req, res) {
  req.session.control.auth(req.body.authCode, function(){
    return res.redirect('/');
  });
});

app.get('/run/:cmd', sessionProtection, function (req, res) {
  req.session.control.sendCommand(req.params.cmd, function(a){
    res.json(a);
  });
});

app.get('/info', sessionProtection, function (req, res) {
  var response = {};
  req.session.control.getData(LGControl.INFO.TV_INFO_CURRENT_CHANNEL, function(a){
    response.channel = a;
    req.session.control.getData(LGControl.INFO.TV_INFO_CONTEXT_UI, function(a){
      response.UI = a;
      req.session.control.getData(LGControl.INFO.TV_INFO_VOLUME, function(a){
        response.volume = a;
        req.session.control.getData(LGControl.INFO.TV_INFO_3D, function(a){
          response.is3d = a;
          res.json(response);
        });
      });
    });
  });
});

app.get('/channels', sessionProtection, function (req, res) {
  req.session.control.channelList(function(a){
    res.json(a);
  });
});

app.post('/channels', sessionProtection, function (req, res) {
  req.session.control.changeChannel(req.body, function(a){
    res.json(a);
  });
});

app.get('/printScreen', sessionProtection, function (req, res) {
  req.session.control.printScreen().pipe(res);
});



//live stream socket
io.use(sharedsession(session, {
    autoSave:true
}));

io.on('connect', function(socket){

  socket.on('disconnect', function(){
    clearInterval(this.timer);
  });
  socket.timer = [];
  socket.on('play', function(){
    var sock = this;
    sock.handshake.session.control = new LGControl(this.handshake.session.control.ip);
    sock.timer.push(setInterval(function(){
      var resp = new Buffer([]);
      readStream = sock.handshake.session.control.printScreen();
      readStream.on('data', function(chunk){
        resp = Buffer.concat([resp, chunk]);
      });
      readStream.on('end', function(){
        sock.emit('canvas',resp.toString('base64'));
      });
    }, 16));
  });

  socket.on('stop', function(){
    for(var i = 0; i < this.timer.length; i++){
      clearInterval(this.timer[i]);
    }
  });
});



var server = http.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});
