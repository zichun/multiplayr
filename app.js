var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.set("view options", { layout: false, pretty: true });
    app.use(express.favicon());
    app.use(express.static(__dirname + '/public'));
});

server.listen(app.get('port'));


/**
 * Routes
 */

// Temp for local testing

app.get('/v2test', function (req, res) {
    res.sendfile(__dirname + '/tests/v2.html');
});


app.get('/rules', function (req, res) {
	res.sendfile(__dirname + '/inc/rules.js');
});

app.get('/host', function(req, res) {
    res.sendfile(__dirname + '/public/static/host.html');
});

app.get('/join', function(req, res) {
    res.sendfile(__dirname + '/public/static/join.html');
});

var transport = require('./inc/transport');
transport.init(io);
