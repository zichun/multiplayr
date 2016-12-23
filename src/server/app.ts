import * as express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as lessMiddleware from 'less-middleware';

const app = express();
const server = http.createServer(app);
const io = socketio.listen(server);

app.set('port', process.env.PORT || 3000);
app.set('view options', { layout: false, pretty: true });
app.use(lessMiddleware('public'));
app.use(express.static(__dirname + '/public'));

/**
 * Routes
 */

app.get('/rules', (req, res) => {
    res.sendFile(__dirname + '/rules.js');
});

app.get('/host', (req, res) => {
    res.sendFile(__dirname + '/public/static/host.html');
});

app.get('/join', (req, res) => {
    res.sendFile(__dirname + '/public/static/join.html');
});

// Temp for local testing

app.get('/rockscissorspaper', (req, res) => {
    res.sendFile(__dirname + '/tests/v2.html');
});

app.get('/theoddone', (req, res) => {
    res.sendFile(__dirname + '/tests/oddone.html');
});

import * as transport from './lib/socket.transport.js';
transport.init(io);

server.listen(app.get('port'), () => {
    console.log('multiplayr server listening on port ' + app.get('port'));
});
