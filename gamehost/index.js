function init(app) {
    app.get('/multiplayr/', function(req, res) {
        res.sendfile(__dirname + '/lobby.html');
    });

    app.get('/multiplayr/host', function(req, res) {
        res.sendfile(__dirname + '/host.html');
    });

    app.get('/multiplayr/client', function(req, res) {
        res.sendfile(__dirname + '/client.html');
    });
}

module.export = app;
