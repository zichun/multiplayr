var lobby = new MPRule();


lobby.addPlugin(Sugar());
lobby.addPlugin(DataChannel());
lobby.addPlugin(Player());

lobby.defineHost(function(hostRule) {

    hostRule.on('load', function(data) {
        var hostObj = this;
        hostObj.setView('lobby', {});
    });

    hostRule.on('client-join', function(data) {
        var hostObj = this;


        hostObj.getView().emit('client-join', {
            client: data.client
        });

        hostObj.player(data.client)
                .data('name', data.client)
                .setView('lobby-client', {name: data.client});
    });

    hostRule.on('client-leave', function(data) {
        var hostObj = this;

        hostObj.getView().emit('client-leave', {
            client: data.client
        });
    });

    hostRule.onMessage('set-name', function(from, name, fn) {
        var hostObj = this;

        hostObj.player(from).data('name', name);

        if (hostObj.getView().getName() === 'lobby') {
            hostObj.getView().emit('set-name', {
                client: from,
                name: name
            });
        }
    });

    function clearAndDistribute() {
        var hostObj = this;

        hostObj.data.cards = new Hand();
        hostObj.data.cards.resetDeck().shuffle();

        hostObj.playerForEach(function(playerId) {
            var hand = new Hand();

            hostObj.player(playerId)
                    .data('banker', false)
                    .data('hand', hand);

            hand.addCard(hostObj.data.cards.draw());
            hand.addCard(hostObj.data.cards.draw());
        });
    }

    function startGame() {
        // for now, assume client 0 is the banker
        var hostObj = this;
        hostObj.player(0).data('banker', true);

        hostObj.data.turn = 1;
        setTurn.call(hostObj);
    }
    function setTurn() {
        var hostObj = this;
        hostObj.player(hostObj.data.turn).sendMessage('turn', true);
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

