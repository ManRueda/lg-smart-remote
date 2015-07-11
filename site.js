var express = require('express');
var app = express();
var LGControl = require('./lib/control');
var session = require('express-session');
var bodyParser = require('body-parser');

app.set('view engine', 'jade');
app.use(session({
  secret: 'LGControl'
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/bower_components'));

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

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});
