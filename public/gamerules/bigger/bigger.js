var BiggerRule = {};

BiggerRule.name = "bigger";

BiggerRule.methods = {
    startGame: function() {
        var gameObj = this;
        if (gameObj.playersCount() < 2) {
            alert("We need at least 2 players to play this game");
        } else {
            gameObj.setData('lobby_started', true)
                   .setData('turn', 0);

            gameObj.playersForEach(function(client) {
                gameObj.setPlayerData(client, 'rollValue', 0);
            });

        }
    },
    roll: function(clientId) {
        var roll = Math.floor(1000 * Math.random() + 1);
        this.setPlayerData(clientId, 'rollValue', roll);
        this.nextTurn();
    },
    nextTurn: function() {
        var self = this;
        var turn = self.getData('turn')
        self.setData('turn', turn+1);
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

BiggerRule.onDataChange = function() {
    var gameObj = this;
    with(gameObj) {

        var started = getData('lobby_started')

        if (started) {
            return showGame();
        } else {
            return showLobby();
        }


        function showGame() {
            var turn = getData('turn');
            var rollsD = getPlayersData('rollValue');

            var rolls = [];
            playersForEach(function(client) {
                rolls.push(rollsD[client]);
            });

            setViewProps(clientId, 'turn', turn);
            setViewProps(clientId, 'rolls', rolls);

            if (turn >= playersCount()) {
                return showSummary(turn, rolls);
            }

            playersForEach(function(client, i) {
                if (i !== turn) {
                    setViewProps(client, 'turn', turn);
                    setView(client, 'WaitingPage');
                } else {
                    setView(client, 'RollPage', {});
                }
            });

            setView(clientId, 'StatusPage');

            return true;
        }

        function showSummary(turn, rolls, cb) {
            var largest = 0;

            rolls.forEach(function(roll, i) {
                if (roll > rolls[largest]) {
                    largest = i;
                }
            });
            playersForEach(function(client, i) {
                setViewProps(client, 'winner', largest);
                setView(client, 'WinPage');
            });
            setView(clientId, 'StatusPage');

            return true;
        }

        function showLobby(cb) {
            var mp = this;
            mp.setView(clientId, 'lobby_Lobby');
            playersForEach(function(client) {
                mp.setView(client, 'lobby_SetName');
            });

            return true;
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
        startGame: function() {
            this.props.MP.startGame();
        },
        render: function() {
            var t = this.props.turn;
            var names = this.props.lobby.names;

            function turn() {
                if (t < this.props.lobby.playerCount) {
                    return React.DOM.div(null, "It's ", names[t], "'s turn now");
                } else {
                    return React.DOM.button({onClick: this.startGame}, 'Start new game');
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
        roll: function() {
            this.props.MP.roll();
        },
        render: function() {
            return React.DOM.button({onClick: this.roll}, "Roll! - I'm feeling lucky");
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
