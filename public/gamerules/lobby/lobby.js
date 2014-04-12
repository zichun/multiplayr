var Lobby = {};

Lobby.name = 'lobby';
Lobby.css = ['lobby.css'];

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
