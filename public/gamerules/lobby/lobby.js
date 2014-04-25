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

Lobby.methods = {
    setName: function(playerId, name) {
        var gameObj = this;
        gameObj.setPlayerData(playerId, 'name', name);
    }
}

Lobby.onDataChange = function() {
    with(this) {
        var names = getPlayersData('name');
        var orderedNames = [];

        playersForEach(function(client) {
            orderedNames.push(names[client]);
        });

        playersForEach(function(client, ind) {
            setViewProps(client, 'name', names[client]);
            setViewProps(client, 'playerNum', ind);
            setViewProps(client, 'playerCount', playersCount);
            setViewProps(client, 'names', orderedNames);
        });

        setViewProps(clientId, 'names', orderedNames);
        setViewProps(clientId, 'playerCount', playersCount);

        return true;
    };
};

Lobby.views = {
    Lobby: React.createClass({
        displayName: 'Lobby',
        startGame: function() {
            var gameObj = this.props.MP;
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
            this.props.MP.setName(e.target.value);
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
