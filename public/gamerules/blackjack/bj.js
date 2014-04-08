var BJRule = //Multiplayr.createRule(
    {
        methods: {
            hit: {
                callee: function(player, gameObject, cb) {
                    gameObject.getData('turn', function(val) {
                        if (val === player) {
                            cb(true);
                        } else {
                            cb(false);
                        }
                    });
                },
                exec: function(player, gameObj, cb) {
                    gameObject.getData('deck', function(deck) {
                        gameObject.getPlayer(player).getData('hand', function(hand) {
                            deck.popCard(function(err, card){
                                hand.push(card);
                            });
                        });
                    });
                }
            },

            stand: {
                exec: function(player, gameObj, cb) {
                    gameObject.getData('turn', function() {

                    })
                }
            }
        },

        onDataChange: function(gameObj) {
            var tmp = {};

            for (var clientId in gameObj.clients) {
                if (!gameObj.clients.hasOwnProperty(clientId)) continue;
                tmp[clientId] = false;
                (function(clientId) {
                    if (gameObj.clients.hasOwnProperty(clientId)) {
                        gameObj.getPlayerData(clientId, 'name', function(err, name) {
                            gameObj.setView(clientId, 'SetName', {name: name});
                            tmp[clientId] = name;
                            tryRender();
                        });
                    }
                })(clientId);
            }
            tryRender();

            function tryRender() {
                var tr = [];
                for (var cid in tmp) {
                    if (tmp.hasOwnProperty(cid) && tmp[cid] === false) {
                        return;
                    } else if (tmp.hasOwnProperty(cid)) {
                        tr.push(tmp[cid]);
                    }
                }

//                gameObj._renderReactView('Lobby', {});
                gameObj.setView(gameObj.clientId, 'Lobby', {names: tr});
            }
        },

        globalData: {
            turn: {
                value: 1,
                const: false
            },
            stack: {
                type: Stack,
                const: true
            },
            state: {
                type: Multiplayr.PrimitiveType,
                initial: 1,
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
            React.DOM.ul(null, this.props.names.map(createHello))
        );
    }
});
var HelloMessage = React.createClass({
    displayName: 'HelloMessage',
    render: function() {
        return React.DOM.div(null, "Hello ", this.props.name);
    }
});

var SetName = React.createClass({
    displayName: 'SetName',
    onChange: function(e) {
        var gameObj = this.props._MP_gameObj;
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
                    React.DOM.input( {onChange:this.onChange, value:this.props.name} )
                )
            )
        );
    }
});
