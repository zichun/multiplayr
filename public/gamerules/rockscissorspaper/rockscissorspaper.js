var RockScissorsPaperRule = {};

RockScissorsPaperRule.name = "rockscissorspaper";
RockScissorsPaperRule.css = ['rcs.css'];

RockScissorsPaperRule.choiceEnum = {
    0: "Rock",
    1: "Scissors",
    2: "Paper",
    3: "Lizard",
    4: "Spock"
};

// set win map
(function() {
    var winMap = {
        0: {},
        1: {},
        2: {},
        3: {},
        4: {}
    };

    winMap[0][1] = true;
    winMap[1][2] = true;
    winMap[2][0] = true;
    winMap[0][3] = true;
    winMap[3][4] = true;
    winMap[4][1] = true;
    winMap[1][3] = true;
    winMap[3][2] = true;
    winMap[2][4] = true;
    winMap[4][0] = true;

    RockScissorsPaperRule.winMap = winMap;
})();

RockScissorsPaperRule.methods = {
    startGame: function() {
        var gameObj = this;
        if (gameObj.playersCount() != 2) {
            alert("We need exactly 2 players to play this game");
        } else {
            gameObj.setData('lobby_started', true)
                   .setData('state', 'play');

            gameObj.playersForEach(function(client) {
                gameObj.setPlayerData(client, 'choice', -1);
            });
        }
    },
    move: function(clientId, c) {
        var mp = this;
        var choice = mp.getPlayerData(clientId, 'choice');
        if (choice === -1) {
            mp.setPlayerData(clientId, 'choice', c);

            var _choices = mp.getPlayersData('choice');
            var done = true, p1 = null, p2 = null;
            mp.playersForEach(function(pid) {
                if (_choices[pid] === -1) {
                    done = false;
                }

                if (!p1) p1 = pid;
                else p2 = pid;
            });

            if (!done) return;

            // tabulate results
            var wm = RockScissorsPaperRule.winMap;

            function inc(pid, variable) {
                var value = mp.getPlayerData(pid, variable);
                mp.setPlayerData(pid, variable, value + 1);
            }
            if (_choices[p1] === _choices[p2]) {
                // draw
                inc(p1, 'draw');
                inc(p2, 'draw');
            } else if (wm[_choices[p1]][_choices[p2]]) {
                inc(p1, 'win');
                inc(p2, 'lose');
            } else {
                inc(p1, 'lose');
                inc(p2, 'win');
            }

            // copy move into prev move and restart game
            mp.setPlayerData(p1, 'opPrevChoice', mp.getPlayerData(p2, 'choice'));
            mp.setPlayerData(p2, 'opPrevChoice', mp.getPlayerData(p1, 'choice'));
            mp.playersForEach(function(pid) {
                mp.setPlayerData(pid, 'prevChoice', mp.getPlayerData(pid, 'choice'));
                mp.setPlayerData(pid, 'choice', -1);
            });
        } else {
            // probably a race condition. ignore
        }
    }
};

RockScissorsPaperRule.globalData = {
    state: {
        value: 'play'
    }
};

RockScissorsPaperRule.playerData = {
    win: { value: 0 },
    lose: { value: 0 },
    draw: { value: 0 },
    choice: { value: -1 },
    prevChoice: {value: -1},
    opPrevChoice: { value: -1 }
}

RockScissorsPaperRule.onDataChange = function() {
    var mp = this;
    var started = mp.getData('lobby_started');
    var state = mp.getData('state');

    var _choices = mp.getPlayersData('choice');

    if (started) {
        gameLogic();
    } else {
        showLobby();
    }

    function showLobby(cb) {
        mp.setView(mp.clientId, 'lobby_Lobby');
        mp.playersForEach(function(client) {
            mp.setView(client, 'lobby_SetName');
        });

        return true;
    }

    function flatten(value) {
        var tr = [];
        mp.playersForEach(function(pid, i) {
            tr[i] = value[pid];
        });
        return tr;
    }

    function gameLogic() {
        if (state === 'play') {
            // some player has not made his move
            mp.playersForEach(function(client) {

                // todo: option for variable to auto map to props
                mp.setViewProps(client, 'opPrevChoice', mp.getPlayerData(client, 'opPrevChoice'));
                mp.setViewProps(client, 'prevChoice', mp.getPlayerData(client, 'prevChoice'));

                mp.setViewProps(client, 'name', mp.getPlayerData(client, 'lobby_name'));
                mp.setViewProps(client, 'win', mp.getPlayerData(client, 'win'));
                mp.setViewProps(client, 'lose', mp.getPlayerData(client, 'lose'));
                mp.setViewProps(client, 'draw', mp.getPlayerData(client, 'draw'));

                mp.setViewProps(client, 'choice', _choices[client]);
                mp.setView(client, 'chooseMove');
            });

            ['win','lose','draw'].forEach(function(v) {
                var value = mp.getPlayersData(v);
                mp.setViewProps(mp.clientId, v, flatten(value));
            });
            mp.setView(mp.clientId, 'hostScoreTable');
        } else {

        }
    }
};

RockScissorsPaperRule.views = {
    chooseMove: React.createClass({
        displayName: 'chooseMove',
        render: function() {
            return React.DOM.div(null,
                                 RockScissorsPaperRule.views.choices(this.props),
                                 RockScissorsPaperRule.views.prevMove(this.props),
                                 RockScissorsPaperRule.views.clientScoreTable(this.props)
                                );
        }
    }),
    choices: React.createClass({
        render: function() {
            var choice = this.props.choice;
            var choices = RockScissorsPaperRule.choiceEnum;

            var reactChoices = [];
            for (var c in choices) {
                if (!choices.hasOwnProperty(c)) continue;

                if (choice === c) {
                    reactChoices.push(React.DOM.div({className: "choice selected"},
                                                    choices[c]));
                } else {
                    var oc = null;
                    if (choice === -1) {
                        var mp = this.props.MP;
                        oc = (function(c) {
                            return function() {
                                mp.move(c);
                            };
                        })(c);
                    }
                    reactChoices.push(React.DOM.div({className: "choice", onClick: oc},
                                                    choices[c]));
                }
            }

            var cn = choice === -1 ? 'unselected' : 'selected';

            reactChoices.push(React.DOM.div({className: "clearer"}));
            return React.DOM.div({id: 'choices', className: cn}, reactChoices);
        }
    }),
    prevMove: React.createClass({
        render: function() {
            var pMove = this.props.prevChoice;
            var opMove = this.props.opPrevChoice;
            var choices = RockScissorsPaperRule.choiceEnum;

            if (pMove === -1 || opMove === -1) {
                return React.DOM.div();
            }

            var result = '';
            var wm = RockScissorsPaperRule.winMap;
            if (pMove === opMove) {
                result = 'Draw!';
            } else if (wm[pMove][opMove]) {
                result = 'Win!';
            } else {
                result = 'Lose!';
            }

            return React.DOM.div(null,
                                 React.DOM.div(null, 'You: ' + choices[pMove]),
                                 React.DOM.div(null, 'Opponent: ' + choices[opMove]),
                                 React.DOM.div(null, result));
        }
    }),

    scoreHeader: React.createClass({
        render: function() {
            return React.DOM.tr(
                null,
                React.DOM.th(null, 'Player'),
                React.DOM.th(null, 'Win'),
                React.DOM.th(null, 'Draw'),
                React.DOM.th(null, 'Lose'));
        }
    }),
    clientScoreTable: React.createClass({
        render: function() {
            return React.DOM.table(null,
                                   RockScissorsPaperRule.views.scoreHeader(),
                                   RockScissorsPaperRule.views.score(this.props));
        }
    }),
    hostScoreTable: React.createClass({
        render: function() {
            var scores = [];
            for (var i=0;i<this.props.lobby.names.length;++i) {
                scores.push(RockScissorsPaperRule.views.score({
                    name: this.props.lobby.names[i],
                    win: this.props.win[i],
                    draw: this.props.draw[i],
                    lose: this.props.lose[i]
                }));
            }
            return React.DOM.table(null,
                                   RockScissorsPaperRule.views.scoreHeader(),
                                   scores);

        }
    }),
    score: React.createClass({
        render: function() {
            return React.DOM.tr(null,
                                React.DOM.td(null, this.props.name),
                                React.DOM.td(null, this.props.win),
                                React.DOM.td(null, this.props.draw),
                                React.DOM.td(null, this.props.lose));
        }
    })
};

RockScissorsPaperRule.plugins = {
    "lobby": Lobby
};