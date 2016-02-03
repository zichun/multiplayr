var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.set('port', process.env.PORT || 3000);
app.set("view options", { layout: false, pretty: true });
app.use(require('less-middleware')('public'));
app.use(express.static(__dirname + '/public'));

/**
 * Routes
 */

// Temp for local testing

app.get('/rockscissorspaper', function (req, res) {
    res.sendFile(__dirname + '/tests/v2.html');
});

app.get('/theoddone', function (req, res) {
    res.sendFile(__dirname + '/tests/oddone.html');
});

app.get('/rules', function (req, res) {
	res.sendFile(__dirname + '/inc/rules.js');
});

app.get('/host', function(req, res) {
    res.sendFile(__dirname + '/public/static/host.html');
});

app.get('/join', function(req, res) {
    res.sendFile(__dirname + '/public/static/join.html');
});

var transport = require('./inc/transport');
transport.init(io);

server.listen(app.get('port'), function() {
    console.log("https server listening on port " + app.get('port'));
});