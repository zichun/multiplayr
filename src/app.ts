import * as express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as lessMiddleware from 'less-middleware';
import * as dir from 'node-dir';
import MPRULES from './rules/rules';

const app = express();
const server = http.createServer(app);
const io = socketio.listen(server);
const rootDir = __dirname;

app.set('port', process.env.PORT || 3000);
app.set('view options', { layout: false, pretty: true });
app.use(lessMiddleware('public'));
app.use(express.static(rootDir + '/client/'));

/**
 * Routes
 */

app.get('/rules', (req, res) => {
    res.sendFile(rootDir + '/rules/rules.js');
});

app.get('/host', (req, res) => {
    res.sendFile(rootDir + '/client/static/host.html');
});

app.get('/join', (req, res) => {
    res.sendFile(rootDir + '/client/static/join.html');
});

//
// Set up gamerules path
//

dir.subdirs(rootDir + '/rules/', (err, subdirs) => {
    const hostRule = (ruleName, subdir, subdirS) => {
        dir.files(subdir, (err, files) => {
            if (err) {
                throw err;
            }

            let relativeDir = '/gamerules/';
            for (let i = 2; i < subdirS.length; i = i + 1) {
                relativeDir += subdirS[i] + '/';
            }

            files.forEach((file) => {
                const fileS = file.split(/[\/\\]/);
                const route = relativeDir + fileS[fileS.length - 1];
                console.log('Setting route ' + route + ' => ' + file);
                app.get(route, (req, res) => {
                    res.sendFile(file);
                });
            });

        });
    }

    subdirs.forEach((subdir) => {
        const relativeDir = subdir.replace(rootDir, '');

        const subdirS = relativeDir.split(/[\/\\]/);
        const ruleName = subdirS[2];

        console.log('Hosting rule ' + ruleName + ' path:' + relativeDir);
        hostRule(ruleName, subdir, subdirS);
    });
});

// Temp for local testing

app.get('/theoddone', (req, res) => {
    res.sendFile(rootDir + '/client/static/theoddone.html');
});

app.get('/coup', (req, res) => {
    res.sendFile(rootDir + '/client/static/coup.html');
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
