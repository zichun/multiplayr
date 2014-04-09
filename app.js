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

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/tests/v2.html');
});

app.get('/test.html', function (req, res) {
	res.sendfile(__dirname + '/tests/test.html');
});



var transport = require('./inc/transport');
transport.init(io);
