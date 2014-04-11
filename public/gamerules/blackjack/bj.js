var Lobby = {};

Lobby.globalData = {
    started: {
        value: false,
        const: false
    }
};

Lobby.playerData = {
    // Players' names
    name: {
        value: 'player',
        const: false
    }
};

Lobby.onDataChange = function(cb) {
    with(this) {
        QgetPlayersData('name')
            .then(function(names) {

                var orderedNames = [];
                for (var i=0;i<clients.length;++i) {
                    orderedNames.push(names[clients[i]]);
                }

                clients.forEach(function(client, ind) {
                    setViewProps(client, 'name', names[client]);
                    setViewProps(client, 'playerNum', ind);
                    setViewProps(client, 'playerCount', clients.length);
                    setViewProps(client, 'names', orderedNames);
                });

                setViewProps(clientId, 'names', orderedNames);
                setViewProps(clientId, 'playerCount', clients.length);

                cb(true);
            }).fail(console.error);
    };
};

Lobby.views = {
    Lobby: React.createClass({
        displayName: 'Lobby',
        startGame: function() {
            var gameObj = this.props.MPGameObject;
            gameObj.__parent.startGame();
        },
        render: function() {
            function createHello(names) {
                var tr = [];
                for (var i=0;i<names.length;++i) {
                    tr.push( Lobby.views.HelloMessage({name: names[i]}) );
                }

                return tr;
            }

            return React.DOM.div(
                null,
                React.DOM.h3(null, "Lobby"),
                React.DOM.ul(null, createHello(this.props.names)),
                React.DOM.button({onClick: this.startGame}, 'Start game')
            );
        }
    }),
    HelloMessage: React.createClass({
        displayName: 'HelloMessage',
        render: function() {
            return React.DOM.div(null, "Hello ", this.props.name);
        }
    }),
    SetName: React.createClass({
        displayName: 'SetName',
        onChange: function(e) {
            var gameObj = this.props.MPGameObject;
            gameObj.setPlayerData(gameObj.clientId, 'name', e.target.value);
            return true;
        },
        render: function() {
            return (
                React.DOM.div(
                    null,
                    React.DOM.form(
                        {
                            onSubmit:this.handleSubmit
                        },
                        React.DOM.div(null, 'Name: '),
                        React.DOM.input( {onChange:this.onChange} )
                    )
                )
            );
        }
    })
};

var BJRule = //Multiplayr.createRule(
    {
        methods: {
            startGame: function() {
                var gameObj = this;
                if (gameObj.clients.length < 2) {
                    alert("We need at least 2 players to play this game");
                } else {
                    // todo: surpress datachange (being able to stage multiple setData)
                    gameObj.setData('lobby_started', true);
                    gameObj.setData('turn', 0);
                    for (var i=0;i<gameObj.clients.length;++i) {
                        // todo: clients foreach
                        gameObj.setPlayerData(gameObj.clients[i], 'rollValue', 0, function() {});
                    }
                }
            },
            roll: function() {
                var roll = Math.floor(1000 * Math.random() + 1);
                this.setPlayerData(this.clientId, 'rollValue', roll, function() {});
                this.nextTurn();
            },
            nextTurn: function() {
                var self = this;
                self.QgetData('turn')
                    .then(function(turn) {
                        return self.setData('turn', turn+1);
                    }).fail(console.error);
            }
        },

        onDataChange: function(cb) {
            var gameObj = this;
            with(gameObj) {

                QgetData('lobby_started')
                    .then(function(started) {
                        if (started) {
                            showGame(cb);
                        } else {
                            showLobby(cb);
                        }
                    })
                    .fail(console.error);

                function showGame(cb) {
                    Q.all([
                        QgetData('turn'),
                        QgetPlayersData('rollValue')
                    ]).spread(function(turn, rollsD) {
                        var rolls = [];
                        for (var i=0;i<clients.length;++i) {
                            rolls.push(rollsD[clients[i]]);
                        }

                        setViewProps(clientId, 'turn', turn);
                        setViewProps(clientId, 'rolls', rolls);

                        if (turn >= clients.length) {
                            showSummary(turn, rolls, cb);
                            return;
                        }

                        clients.forEach(function(client, i) {
                            if (i !== turn) {
                                setViewProps(client, 'turn', turn);
                                setView(client, 'WaitingPage');
                            } else {
                                setView(client, 'RollPage', {});
                            }
                        });

                        setView(clientId, 'StatusPage');

                        cb(true);
                    }).fail(console.error);
                }

                function showSummary(turn, rolls, cb) {
                    var largest = 0;

                    rolls.forEach(function(roll, i) {
                        if (roll > rolls[largest]) {
                            largest = i;
                        }
                    });
                    clients.forEach(function(client, i) {
                        setViewProps(client, 'winner', largest);
                        setView(client, 'WinPage');
                    });
                    setView(clientId, 'StatusPage');
                    cb(true);
                }

                function showLobby(cb) {
                    setView(clientId, 'lobby_Lobby');
                    clients.forEach(function(client) {
                        setView(client, 'lobby_SetName');
                    });

                    cb(true);
                }
            }
        },

        globalData: {
            turn: {
                value: 0,
                const: false
            }
        },

        playerData: {
            draw: {
                value: 0,
                const: false
            },
            rollValue: {
                value: 0,
                const: false
            }
        }

    };

BJRule.plugins = {
    "lobby": Lobby
};
BJRule.views = {
    RollsResults: React.createClass({
        displayName: 'RollsResults',
        render: function() {
            var rolls = this.props.rolls;
            var names = this.props.lobby.names;
            var res = [];

            for (var i=0;i<rolls.length;++i) {
                res.push(React.DOM.li(null, names[i], ': ', rolls[i]));
            }

            return React.DOM.ul(null, res);
        }
    }),
    StatusPage: React.createClass({
        displayName: 'StatusPage',
        render: function() {
            var t = this.props.turn;
            var names = this.props.lobby.names;

            function turn() {
                if (t < this.props.lobby.playerCount) {
                    return React.DOM.div("It's ", names[t], "'s turn now");
                } else {
                    return React.DOM.button({onClick: this.props.MPGameObject.startGame}, 'Start new game');
                }
            }
            return React.DOM.div(null,
                                 turn.call(this),
                                 BJRule.views.RollsResults(this.props));
        }
    }),

    WinPage: React.createClass({
        displayName: 'WinPage',
        render: function() {
            var winner = this.props.winner;
            var names = this.props.lobby.names;
            return React.DOM.div(null, "The winner is " + names[winner]);
        }
    }),


    RollPage: React.createClass({
        displayName: 'RollPage',
        render: function() {
            return React.DOM.button({onClick: this.props.MPGameObject.roll}, "Roll! - I'm feeling lucky");
        }
    }),

    WaitingPage: React.createClass({
        displayName: 'WaitingPage',
        render: function() {
            var t = this.props.turn;
            var names = this.props.lobby.names;

            return React.DOM.div(
                null,
                React.DOM.div(null, 'Waiting for ', names[t], ' to roll')
            );
        }
    })
};
