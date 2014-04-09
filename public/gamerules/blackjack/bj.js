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

var BJRule = //Multiplayr.createRule(
    {
        methods: {
            startGame: function() {
                var gameObj = this;
                if (gameObj.clients.length < 2) {
                    alert("We need at least 2 players to play this game");
                } else {
                    // todo: surpress datachange (being able to stage multiple setData)
                    gameObj.setData('started', true);
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
                        return self.setData('turn', turn+1, function() {});
                    });
            }
        },

        onDataChange: function(gameObj) {
            with(gameObj) {

                QgetData('started')
                    .then(function(started) {
                        if (started) {
                            showGame();
                        } else {
                            showLobby();
                        }
                    });

                function showGame() {
                    Q.all([
                        QgetData('turn'),
                        QgetPlayersData('name'),
                        QgetPlayersData('rollValue')
                    ]).spread(function(turn, names, rolls) {
                        if (turn >= clients.length) {
                            showSummary(turn, names, rolls);
                            return;
                        }

                        clients.forEach(function(client, i) {
                            if (i !== turn) {
                                setView(client, 'WaitingPage', {name: names[clients[turn]].data});
                            } else {
                                setView(client, 'RollPage', {});
                            }
                        });

                        setView(clientId, 'StatusPage', {name: names[clients[turn]].data, names: names, rolls:rolls});
                    }).fail(function(err) {
                        alert(err);
                    });
                }

                function showSummary(turn, names, rolls) {
                    var largest = 0;

                    clients.forEach(function(client, i) {
                        if (rolls[client].data > rolls[clients[largest]].data) {
                            largest = i;
                        }
                    });
                    clients.forEach(function(client, i) {
                        setView(client, 'WinPage', {name: names[clients[largest]].data});
                    });
                    setView(clientId, 'StatusPage', {name: false, names: names, rolls:rolls});
                }


                function showLobby() {
                    QgetPlayersData('name')
                        .then(function(names) {
                            clients.forEach(function(client) {
                                setView(client, 'SetName', {name: names[client].data});
                            });
                            setView(clientId, 'Lobby', {names: names});
                        });
                }
            }
        },

        globalData: {
            started: {
                value: false,
                const: false
            },
            turn: {
                value: 0,
                const: false
            }
        },

        playerData: {
            name: {
                value: 'player',
                const: false
            },
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


var Lobby = React.createClass({
    displayName: 'Lobby',
    render: function() {
        function createHello(names) {
            var tr = [];
            for (var clientId in names) {
                if (names.hasOwnProperty(clientId)) {
                    tr.push( HelloMessage({name: names[clientId].data}) );
                }
            }
            return tr;
        }

        return React.DOM.div(
            null,
            React.DOM.h3(null, "Lobby"),
            React.DOM.ul(null, createHello(this.props.names)),
            React.DOM.button({onClick: this.props.MPGameObject.startGame}, 'Start game')
        );
    }
});

var RollsResults = React.createClass({
    displayName: 'RollsResults',
    render: function() {
        var rolls = this.props.rolls;
        var names = this.props.names;
        var res = [];
        for (var cid in rolls) {
            if (rolls.hasOwnProperty(cid)) {
                res.push( React.DOM.li(null, names[cid].data, ': ', rolls[cid].data));
            }
        }
        return React.DOM.ul(null,
                            res);
    }
});
var StatusPage = React.createClass({
    displayName: 'StatusPage',
    render: function() {

        function turn() {
            if (this.props.name) {
                return React.DOM.div("It's ", this.props.name, "'s turn now");
            } else {
                return React.DOM.button({onClick: this.props.MPGameObject.startGame}, 'Start new game');
            }
        }
        return React.DOM.div(null,
                             turn.call(this),
                             RollsResults({names: this.props.names, rolls: this.props.rolls, MPGameObject: this.props.MPGameObject}));
    }
});

var WinPage = React.createClass({
    displayName: 'WinPage',
    render: function() {
        return React.DOM.div(null, "The winner is " + this.props.name);
    }
});

var HelloMessage = React.createClass({
    displayName: 'HelloMessage',
    render: function() {
        return React.DOM.div(null, "Hello ", this.props.name);
    }
});

var RollPage = React.createClass({
    displayName: 'RollPage',
    render: function() {
        return React.DOM.button({onClick: this.props.MPGameObject.roll}, "Roll! - I'm feeling lucky");
    }
});

var WaitingPage = React.createClass({
    displayName: 'WaitingPage',
    render: function() {
        return React.DOM.div(
            null,
            React.DOM.div(null, 'Waiting for ', this.props.name, ' to roll')
        );
    }
});
var SetName = React.createClass({
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
});
