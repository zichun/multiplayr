import * as express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as lessMiddleware from 'less-middleware';
import * as dir from 'node-dir';
import MPRULES from './rules/rules';

const app = express();
const server = http.createServer(app);
const io = socketio.listen(server);
const rootDir = __dirname + '/';

app.set('port', process.env.PORT || 3000);
app.set('view options', { layout: false, pretty: true });
app.use(lessMiddleware('public'));
app.use(express.static(rootDir + 'client/'));

/**
 * Routes
 */

app.get('/rules', (req, res) => {
    res.sendFile(rootDir + 'rules/rules.js');
});

app.get('/host', (req, res) => {
    res.sendFile(rootDir + 'client/static/host.html');
});

app.get('/join', (req, res) => {
    res.sendFile(rootDir + 'client/static/join.html');
});

//
// Set up gamerules path
//

dir.subdirs(rootDir + 'rules/gamerules/', (err, subdirs) => {
    const hostRule = (ruleName) => {
        const ruleFolder = rootDir + 'rules/gamerules/' + ruleName + '/';
        dir.files(ruleFolder, (err, files) => {
            if (err) {
                throw err;
            }

            files.forEach((file) => {
                const fileS = file.split(/[\/\\]/);

                app.get('/gamerules/' + ruleName + '/' + fileS[fileS.length - 1], (req, res) => {
                    res.sendFile(file);
                });
            });

        });
    }

    subdirs.forEach((subdir) => {
        const subdirS = subdir.split(/[\/\\]/);
        const ruleName = subdirS[subdirS.length - 1];

        console.log('Hosting rule ' + ruleName);
        hostRule(ruleName);
    });
});

// Temp for local testing

app.get('/theoddone', (req, res) => {
    res.sendFile(rootDir + 'client/static/theoddone.html');
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

import SocketTransport from './server/socket.transport.js';

io.sockets.on('connection', (socket) => {

    const transport = new SocketTransport(socket);

});

server.listen(app.get('port'), () => {
    console.log('multiplayr server listening on port ' + app.get('port'));
});
