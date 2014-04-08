var BJRule = //Multiplayr.createRule(
    {
        methods: {
            startGame: function() {
                var gameObj = this;
                if (gameObj.clients.length < 2) {
                    alert("We need at least 2 players to play this game");
                } else {
                    gameObj.setData('started', true);
                }
            }
        },

        onDataChange: function(gameObj) {
            var tmp = {};

            gameObj
                .QgetData('started')
                .then(function(started) {
                    if (started) {
                        showGame();
                    } else {
                        showLobby();
                    }
                });

            function showGame() {
                gameObj
                .getData('turn')
                .then(function(turn) {
                    
                });
            }

            function showLobby() {
                gameObj
                    .QgetPlayersData('name')
                    .then(function(names) {

                        var tr = [];
                        for (var clientId in names) {
                            if (names.hasOwnProperty(clientId)) {
                                gameObj.setView(clientId, 'SetName', {name: names[clientId].data});
                                tr.push(names[clientId].data);
                            }
                        }
                        gameObj.setView(gameObj.clientId, 'Lobby', {names: tr});
                    });
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
                value: 'player'
            }
        }
    }


var Lobby = React.createClass({
    displayName: 'Lobby',
    render: function() {
        function createHello(name) {
            return HelloMessage({name: name});
        }
        return React.DOM.div(
            null,
            React.DOM.h3(null, "Lobby"),
            React.DOM.ul(null, this.props.names.map(createHello)),
            React.DOM.button({onClick: this.props.MPGameObject.startGame}, 'Start game')
        );
    }
});

var HelloMessage = React.createClass({
    displayName: 'HelloMessage',
    render: function() {
        return React.DOM.div(null, "Hello ", this.props.name);
    }
});

var WaitingPage = React.createClass({
    displayName: 'WaitingPage',
    render: function() {
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
