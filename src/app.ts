import * as express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as dir from 'node-dir';
import * as fs from 'fs';

import * as webpack from 'webpack';
import * as config from '../webpack.config.js';

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server);
const rootDir = __dirname;
const compiler = webpack(config());

app.set('port', process.env.PORT || 3000);
app.set('view options', { layout: false, pretty: true });
app.use(express.static(rootDir + '/client/'));

/**
 * Routes
 */

app.get('/', (req, res) => {
    res.redirect('/host');
});

app.get('/rules', (req, res) => {
    res.sendFile(rootDir + '/rules/rules.js');
});

app.get('/host', (req, res) => {
    res.sendFile(rootDir + '/client/static/host.html');
});

app.get('/join', (req, res) => {
    res.sendFile(rootDir + '/client/static/join.html');
});

// Temp for local testing

app.get('/theoddone', (req, res) => {
    res.sendFile(rootDir + '/client/static/theoddone.html');
});

app.get('/coup', (req, res) => {
    res.sendFile(rootDir + '/client/static/coup.html');
});

app.get('/avalon', (req, res) => {
    res.sendFile(rootDir + '/client/static/avalon.html');
});

app.get('/decrypto', (req, res) => {
    res.sendFile(rootDir + '/client/static/decrypto.html');
});

// app.get('/rockscissorspaper', (req, res) => {
//     res.sendFile(rootDir + '/tests/v2.html');
// });

// app.get('/theoddone', (req, res) => {
//     res.sendFile(rootDir + '/tests/oddone.html');
// });

//
// Set up socket.io connections
//

import { SocketTransport } from './server/socket.transport';

io.sockets.on('connection', (socket) => {

    const transport = new SocketTransport(socket);

});

server.listen(app.get('port'), () => {
    console.log('multiplayr server listening on port ' + app.get('port'));
});
