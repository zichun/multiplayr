var BiggerRule = {};

BiggerRule.methods = {
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
};

BiggerRule.globalData = {
    turn: {
        value: 0,
        const: false
    }
};

BiggerRule.playerData = {
    draw: {
        value: 0,
        const: false
    },
    rollValue: {
        value: 0,
        const: false
    }
}

BiggerRule.onDataChange = function(cb) {
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
};


BiggerRule.views = {
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
                                 BiggerRule.views.RollsResults(this.props));
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

BiggerRule.plugins = {
    "lobby": Lobby
};
