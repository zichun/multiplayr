var lobby = new MPRule();

//MPRule.addPlugin()

lobby.addPlugin(Sugar());
lobby.addPlugin(DataChannel());

lobby.defineHost(function(hostRule) {

    hostRule.on('load', function(data) {
        var hostObj = this;

        hostObj.data.playerName = {};
        hostObj.setView('lobby', {});
    });

    hostRule.on('client-join', function(data) {
        var hostObj = this;
        hostObj.data.playerName[data.client] = data.client;

        hostObj.getView().emit('client-join', {
            client: data.client
        });

        hostObj.clientSetView(data.client, 'lobby-client', {name: data.client}, function(data) {
        });
    });

    hostRule.on('client-leave', function(data) {
        var hostObj = this;
        hostObj.getView().emit('client-leave', {
            client:data.client
        });
    });

    hostRule.onMessage('set-name', function(from, data, fn) {
        var hostObj = this;
        hostObj.data.playerName[from] = data;

        if (hostObj.getView().getName() === 'lobby') {
            hostObj.getView().emit('set-name', {
                client: from,
                name: data
            });
        }
    });


    hostRule.methods.playerCount = function() {
        var hostObj = this;
        var cnt = 0;
        hostObj.playerForEach(function() {
            ++cnt;
        });
        return cnt;
    };

    hostRule.methods.playerForEach = function(fn) {
        var hostObj = this;
        for (var i in hostObj.data.playerName) {
            if (hostObj.data.playerName.hasOwnProperty(i)) {
                fn.call(hostObj.data.playerName, i);
            }
        }
    };


    function clearAndDistribute() {
        var hostObj = this;
        hostObj.data.cards = new Hand();
        hostObj.data.cards.resetDeck().shuffle();

        hostObj.playerForEach(function(playerId) {
            var hand = new Hand();
            hostObj.setData(playerId, 'banker', false);
            hostObj.setData(playerId, 'hand', hand);

            hand.addCard(hostObj.data.cards.draw());
            hand.addCard(hostObj.data.cards.draw());
        });
    }

    hostRule.methods.startGame = function() {
        var hostObj = this;
        if (hostObj.playerCount() < 2) {
            alert('we need more than 2 players to start the game');
        } else {
            clearAndDistribute.call(hostObj);
        }
    };

});

lobby.defineClient(function(client) {
    client.on('load', function() {
        var clientObj = this;
//        clientObj.setView('lobby-client', {name: ''});
    });
});

lobby.addView('hand',
    'adsf',
    function(view) {
    });

lobby.addView('lobby',
    'Connected Clients: <ul id="lobby"></ul> <button id="startgame">Start Game</button>',
    function(view) {
        view.on('load', function() {
            $("#startgame").click(function() {
                view.getPlayerObj().startGame();
            });
        });

        view.on('client-join', function(data) {
            $("#lobby").append('<li player="'+data.client+'">' + data.client +'</li>');
        });

        view.on('client-leave', function(data) {
            $('#lobby li').each(function() {
                if ($(this).attr('player') === data.client) {
                    $(this).remove();
                }
            });
        });

        view.on('set-name', function(data) {
            $('#lobby li').each(function() {
                if ($(this).attr('player') === data.client) {
                    $(this).html(data.name);
                }
            });
        });
    }
);

lobby.addView('lobby-client',
    'Welcome. Name: <input type="text" class="name" value="<%=name%>" /><br /><button class="disconnect">Disconnect</button>',
    function(view) {
        view.on('load', function(playerObj) {
            $(this).find(".name").bind('keyup', function() {
                view.getPlayerObj().sendMessage('set-name', this.value);
            });
        });
    });

