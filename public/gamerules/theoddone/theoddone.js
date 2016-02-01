/*global  */
var TheOddOneRule = {};

TheOddOneRule.name = "TheOddOne";
TheOddOneRule.css = ['theoddone.less'];

TheOddOneRule.cards = [
    ['Chicken', 'KFC'],
    ['Justin Bieber', 'Barbie Doll'],
    ['Charcoal', 'Shadow'],
    ['apple', 'microsoft'],
    ['Bush', 'Obama'],
    ['Laptop', 'Notebook'],
    ['Adult','Child'],
    ['Butter','Jam'],
    ['Break','Mend'],
    ['Clean','Dirty'],
    ['Cops','robbers'],
    ['Cup','saucer'],
    ['Dance','sing'],
    ['Dead','alive'],
    ['Doctor','nurse'],
    ['Dog','bone'],
    ['Duke','duchess'],
    ['Fast','slow'],
    ['Soda','Tap water'],
    ['Fish','chips'],
    ['Float','sink'],
    ['Food','drink'],
    ['Freeze','Cold'],
    ['Freeze','Ice'],
    ['Cold','Ice'],
    ['Flame','Candle'],
    ['Flame','Hot'],
    ['Singer','Actor'],
    ['Magician','Comedian'],
    ['Fresh','stale'],
    ['Power','Wisdom'],
    ['Grow','Big'],
    ['Horse','Cart'],
    ['Rap Music','Death Metal'],
    ['Jelly','Ice-cream'],
    ['King','President'],
    ['Knife','Sword'],
    ['Laugh','Comedy'],
    ['Letters','Numbers'],
    ['Moon','stars'],
    ['Noise','silence'],
    ['Open','close'],
    ['Paint','Brush'],
    ['Paper','pen'],
    ['Peaches','cream'],
    ['Pen','Ink'],
    ['Business','Work'],
    ['Magazine','Newspaper'],
    ['Rich','Spendthrift'],
    ['Poor','Thrifty'],
    ['Human Rights','Justice'],
    ['Snow','Ice'],
    ['Assets','Bank account'],
    ['Spongecake','Custard'],
    ['Strawberries','Ice-cream'],
    ['Wind','Blow'],
    ['Moon','Star'],
    ['Furry','Warm and Fuzzy'],
    ['Cookie','Biscuit'],
    ['Tea','Coffee'],
    ['Coffeebean','Cocoa'],
    ['Thunder','Lightning'],
    ['Together','apart'],
    ['Tongue','groove'],
    ['Toothpaste','toothbrush'],
    ['War','Riot'],
    ['Fan','Aircon'],
    ['Under','Over'],
    ['Up','down'],
    ['Walk','run'],
    ['Wet','Slippery'],
    ['Wine','Cheese'],
    ['Witchcraft','Magic'],
    ['Magician','Clown'],
    ['Musical', 'Movie'],
    ['Comedy', 'Cartoon'],
    ['moonlight', 'twilight'],
    ['table', 'chair'],
    ['lamp', 'fire'],
    ['darkness', 'void'],
    ['worship', 'celebrate'],
    ['noisy', 'exuberant'],
    ['drummer', 'guitarist'],
    ['kettle', 'pot'],
    ['watch', 'clock'],
    ['dumbbell', 'bench press machine'],
    ['tail', 'butt'],
    ['hopeful', 'genuine'],
    ['genuine', 'hopeful'],
    ['last', 'first'],
    ['coat', 'sweater'],
    ['dry', 'heated'],
    ['stand', 'sit'],
    ['smooth', 'slippery'],
    ['electric', 'analog'],
    ['bag', 'purse'],
    ['cushion', 'bolster'],
    ['bedsheet', 'pillowcase'],
    ['clean', 'dirty'],
    ['bridge', 'poker'],
    ['crazy', 'calm'],
    ['joy', 'sadness'],
    ['rude', 'clueless'],
    ['old', 'experienced'],
    ['towel', 'toilet paper'],
    ['moisture', 'dew'],
    ['speed', 'dexterity'],
    ['reflection', 'refraction'],
    ['polka dot', 'hearts'],
    ['guitar', 'violin'],
    ['quarter', 'dime'],
    ['chilli', 'wasabi'],
    ['movement', 'stationary'],
    ['dull', 'sharp'],
    ['control', 'treatment'],
    ['tie', 'bow'],
    ['will', 'force'],
    ['twilight', 'dusk'],
    ['chair', 'bench'],
    ['fire', 'flame'],
    ['void', 'blank'],
    ['celebrate', 'parade'],
    ['exuberant', 'happy'],
    ['guitarist', 'violinist'],
    ['pot', 'pan'],
    ['clock', 'watch'],
    ['bench press machine', 'treadmill'],
    ['butt', 'chair'],
    ['genuine', 'real'],
    ['hopeful', 'wishful'],
    ['first', 'top'],
    ['sweater', 'jacket'],
    ['heated', 'warmed'],
    ['sit', 'stand'],
    ['slippery', 'smooth'],
    ['analog', 'digital'],
    ['purse', 'wallet'],
    ['bolster', 'pillow'],
    ['pillowcase', 'blanket'],
    ['dirty', 'filthy'],
    ['poker', 'bridge'],
    ['calm', 'peaceful'],
    ['sadness', 'despair'],
    ['clueless', 'lost'],
    ['experienced', 'professional'],
    ['toilet paper', 'toilet bowl'],
    ['dew', 'mist'],
    ['dexterity', 'ambidextrous'],
    ['refraction', 'reflection'],
    ['hearts', 'spades'],
    ['violin', 'guitar'],
    ['dime', 'quarter'],
    ['wasabi', 'mustard'],
    ['stationary', 'still'],
    ['sharp', 'pointed'],
    ['treatment', 'care'],
    ['bow', 'kneel'],
    ['force', 'coerce'],
    ['dusk', 'dirt'],
    ['bench', 'benchmark'],
    ['flame', 'fire'],
    ['blank', 'space'],
    ['parade', 'celebration'],
    ['happy', 'joy'],
    ['violinist', 'yoyo ma'],
    ['pan', 'pot'],
    ['watch', 'clock'],
    ['treadmill', 'kettle bell'],
    ['chair', 'desk'],
    ['real', 'fake'],
    ['wishful', 'hopeful'],
    ['top', 'first'],
    ['jacket', 'vest'],
    ['warmed', 'chilled'],
    ['stand', 'walk'],
    ['smooth', 'smoothy'],
    ['digital', 'manual'],
    ['wallet', 'bank'],
    ['pillow', 'pillow case'],
    ['blanket', 'pillow'],
    ['filthy', 'wealthy'],
    ['bridge', 'connection'],
    ['peaceful', 'quiet'],
    ['despair', 'desperate'],
    ['lost', 'found'],
    ['professional', 'skillful'],
    ['toilet bowl', 'basin'],
    ['mist', 'fog'],
    ['ambidextrous', 'right-handed'],
    ['reflection', 'water'],
    ['spades', 'hearts'],
    ['guitar', 'strings'],
    ['quarter', 'penny'],
    ['mustard', 'yellow'],
    ['still', 'quiet'],
    ['pointed', 'round'],
    ['care', 'detergent'],
    ['kneel', 'crawl'],
    ['coerce', 'persuade']
];

function flatten(mp, value) {
    var tr = [];

    mp.playersForEach(function(pid, i) {
        tr[i] = value[pid];
    });

    return tr;
}

TheOddOneRule.methods = {
    startGame: function() {
        var mp = this;
        if (mp.playersCount() < 3) {
            alert("We need at least 3 players to play this game");
        } else {
            mp.setData('lobby_started', true)
              .setData('state', 'play');

            mp.newGame();
        }
    },
    vote: function(clientId, c) {
        var mp = this;
        mp.setPlayerData(clientId, 'vote', c);
    },
    commitVote: function(clientId) {
        var mp = this;
        var votes = mp.getVotes();
        var major = 0;

        for (i = 0; i < mp.playersCount(); ++i) {
            if (votes[i] > votes[major]) {
                major = i;
            }
        }

        mp.killPlayer(major);
    },
    leftAlive: function() {
        // number of players left alive
        var mp = this;
        var cnt = 0;
        mp.playersForEach(function(pid, i) {
            cnt += (mp.getPlayerData(pid, 'isDead') ? 0 : 1);
        });
        return cnt;
    },
    killPlayer: function(clientId, toKill) {
        var mp = this;
        var leftAlive = 0;
        var gameEnd = false;
        var oddOne = 0;
        var score = 0;

        mp.playersForEach(function(pid, i) {
            var isOdd = mp.getPlayerData(pid, 'isOdd');

            if (i === toKill) {
                mp.setPlayerData(pid, 'isDead', true);

                if (!isOdd) {
                } else {
                    gameEnd = true;
                }
            }

            var isDead = mp.getPlayerData(pid, 'isDead');

            if (isOdd) {
                oddOne = pid;
            }

            if (isDead && !isOdd) {
                ++score;
            }

            leftAlive += isDead ? 0 : 1;

            mp.setPlayerData(pid, 'vote', -1);
        });

        if (leftAlive <= 2) {
            gameEnd = true;
        }

        if (gameEnd === true) {
            mp.setData('state', 'gameEnd');
            mp.setPlayerData(oddOne, 'score', mp.getPlayerData(oddOne, 'score') + score);
        }

        var otherScore = mp.playersCount() - 2 - score;
        mp.playersForEach(function(pid, i) {
            var isOdd = mp.getPlayerData(pid, 'isOdd');
            if (!isOdd) {
                mp.setPlayerData(pid, 'score', mp.getPlayerData(pid, 'score') + otherScore);
            }
        });
    },
    getDead: function() {
        var mp = this;
        var dead = [];
        mp.playersForEach(function(pid, i) {
            dead[i] = mp.getPlayerData(pid, 'isDead');
        });
        return dead;
    },
    getVotes: function() {
        var mp = this;
        var i = 0;

        var votesMap = mp.getPlayersData('vote');
        var votes = [];

        for (i = 0; i < mp.playersCount(); ++i) {
            votes[i] = 0;
        }
        for (i = 0; i < mp.playersCount(); ++i) {
            votes[votesMap[i]]++;
        }
        return votes;
    },
    newGame: function() {
        var mp = this;
        var playersCount = mp.playersCount();
        var oddOne = Math.floor(Math.random() * playersCount);
        var cardSel = Math.floor(Math.random() * TheOddOneRule.cards.length);
        var oddCard = Math.floor(Math.random() * 2);

        mp.playersForEach(function(pid, i) {
            if (i === oddOne) {
                mp.setPlayerData(pid, 'card', oddCard);
                mp.setPlayerData(pid, 'isOdd', true);
            } else {
                mp.setPlayerData(pid, 'card', 1 - oddCard);
                mp.setPlayerData(pid, 'isOdd', false);
            }
            mp.setPlayerData(pid, 'vote', -1);
            mp.setPlayerData(pid, 'isDead', false);
        });


        mp.setData('currentCard', cardSel);
        mp.setData('state', 'play');
    },
    getPlayerSummary: function() {
        var mp = this;
        var tr = [];
        return ;

    }
};

TheOddOneRule.globalData = {
    state: { value: 'play' },
    turn: { value: 0 },
    currentCard: { value: 0 }
};

TheOddOneRule.playerData = {
    card: { value: 0 },
    score: { value: 0 },
    isDead: { value: false },
    isOdd: { value: false },
    vote: { value: -1 }
};

TheOddOneRule.onDataChange = function() {
    var mp = this;
    var started = mp.getData('lobby_started');
    var state = mp.getData('state');

    if (started) {
        return gameLogic();
    } else {
        return showLobby();
    }

    function showLobby(cb) {
        mp.setView(mp.clientId, 'host-lobby');

        mp.playersForEach(function(client) {
            mp.setView(client, 'lobby_SetName');
        });

        return true;
    }

    function gameLogic() {
        var currentCard = mp.getData('currentCard');
        mp.setViewProps(mp.clientId, 'currentCard', currentCard);

        mp.playersForEach(function(client, i) {
            var playerCard = mp.getPlayerData(client, 'card');
            var word = TheOddOneRule.cards[currentCard][playerCard];

            mp.setViewProps(client, 'score', mp.getPlayerData(client, 'score'));
            mp.setViewProps(client, 'vote', mp.getPlayerData(client, 'vote'));
            mp.setViewProps(client, 'dead', mp.getDead());
            mp.setViewProps(client, 'word', word);

            mp.setView(client, 'client-voting');
        });

        if (state === 'play') {

            mp.setViewProps(mp.clientId, 'votes', mp.getVotes());
            mp.setView(mp.clientId, 'host-voteTable');

        } else if (state === 'gameEnd') {

            mp.setViewProps(mp.clientId,
                            'playerSummary',
                            mp.getPlayersData(['score', 'isDead', 'isOdd', 'card']));

            mp.setView(mp.clientId, 'host-summary');

        }

        return true;
    }

    return true;
};

TheOddOneRule.views = {

    //
    // Host Rules
    //

    "host-lobby": React.createClass({
        render: function() {
            var mp = this.props.MP;

            return mp.getPluginView('gameshell',
                                    'HostShellChild',
                                    {
                                        'view': mp.getPluginView('lobby', 'Lobby')
                                    });
        }
    }),

    "host-voteTable": React.createClass({
        render: function() {
            var mp = this.props.MP;
            var scores = [];
            var votes = this.props.votes;
            var major = -1, lsofar = 0;
            var submitButton;
            var i;

            if (votes[0] > 0) major = 0;
            for (i = 1; i < this.props.lobby.names.length; ++i) {
                if (votes[i] > votes[lsofar]) {
                    lsofar = i;
                    major = i;
                } else if (votes[i] === votes[lsofar]) {
                    major = -1;
                }
            }

            for (i = 0; i < this.props.lobby.names.length; ++i) {
                var cn = (major === i ? 'major' : '');
                scores.push(React.DOM.li({className: cn}, this.props.lobby.names[i] + ' - Votes: ' + votes[i]));
            }

            if (major === -1) {
                submitButton = null;
            } else {
                submitButton = React.DOM.button({id: 'theoddone-vote-submit', onClick: this.commitVote }, 'Commit!');
            }

            return mp.getPluginView('gameshell',
                                    'HostShellChild',
                                    {
                                        'view': React.DOM.div(null,
                                                              React.DOM.ol({id: 'theoddone-votetable'}, scores),
                                                              submitButton)
                                    });
        },
        commitVote: function() {
            var gameObj = this.props.MP;
            gameObj.commitVote();
        }
    }),

    "host-summary": React.createClass({
        render: function() {
            var mp = this.props.MP;
            var button = React.DOM.button({onClick: function() { mp.newGame(); } },
                                          'New Game');
            return mp.getPluginView('gameshell',
                                    'HostShellChild',
                                    {
                                        'view': React.DOM.div(null,
                                                              TheOddOneRule.views['host-summaryTable'](this.props),
                                                              button)
                                    });
        },
        newGame: function() {
            var mp = this.props.MP;
            mp.newGame();
        }
    }),

    "host-summaryTable": React.createClass({
        render: function() {
            var scores = [];
            var currentCard = this.props.currentCard;

            for (var i=0;i<this.props.lobby.names.length;++i) {
                var word = TheOddOneRule.cards[currentCard][this.props.playerSummary[i].card];
                scores.push(TheOddOneRule.views['host-summaryTable-scoreRow']({
                    name: this.props.lobby.names[i],
                    word: word,
                    score: this.props.playerSummary[i].score,
                    isOdd: this.props.playerSummary[i].isOdd,
                    isDead: this.props.playerSummary[i].isDead
                }));
            }

            return React.DOM.table({id: 'theoddone-summary-table', cellSpacing: '1px'},
                                   TheOddOneRule.views['host-summaryTable-scoreHeader'](),
                                   scores);
        }
    }),

    "host-summaryTable-scoreHeader": React.createClass({
        render: function() {
            return React.DOM.tr(
                null,
                React.DOM.th(null, 'Player'),
                React.DOM.th(null, 'Word'),
                React.DOM.th(null, 'Score')
            );
        }
    }),

    "host-summaryTable-scoreRow": React.createClass({
        render: function() {
            var cn = [];
            if (this.props.isOdd) cn.push('odd');
            if (this.props.isDead) cn.push('dead');
            return React.DOM.tr({className: cn.join(' ')},
                                React.DOM.td({className: 'name'}, this.props.name),
                                React.DOM.td(null, this.props.word),
                                React.DOM.td(null, this.props.score));
        }
    }),

    //
    // Client Views
    //

    "client-voting": React.createClass({
        displayName: 'voting',
        render: function() {
            return React.DOM.div({id: 'theoddone-voting'},
                                 TheOddOneRule.views['client-word'](this.props),
                                 TheOddOneRule.views['client-voting-choices'](this.props)
                                );
        }
    }),

    "client-word": React.createClass({
        render: function() {
            var word = this.props.word;
            return React.DOM.div({id: 'theoddone-word'}, word);
        }
    }),

    "client-voting-choices": React.createClass({
        render: function() {
            var reactChoices = [];
            var vote = this.props.vote;
            var dead = this.props.dead;

            for (var i=0;i<this.props.lobby.names.length;++i) {
                var player = this.props.lobby.names[i];

                if (vote === i) {
                    reactChoices.push(React.DOM.div({className: "choice selected"},
                                                    player));
                } else {
                    var mp = this.props.MP;
                    var oc = null;

                    if (dead[i] === false) {
                        oc = (function(i) {
                            return function() {
                                mp.vote(i);
                            };
                        })(i);
                    }

                    var deadClass = dead[i] ? ' dead' : '';

                    reactChoices.push(React.DOM.div({className: "choice" + deadClass, onClick: oc},
                                                    player));
                }
            }

            var cn = vote === -1 ? 'unselected' : 'selected';

            reactChoices.push(React.DOM.div({className: "clearer"}));
            return React.DOM.div({id: 'choices', className: cn}, reactChoices);
        }
    })
};

TheOddOneRule.plugins = {
    "lobby": Lobby,
    "gameshell": Shell
};