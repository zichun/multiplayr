var lobby = new MPRule();

//MPRule.addPlugin()

lobby.defineHost(function(hostRule) {

    hostRule.on('load', function(data) {
        var hostObj = this;

        hostObj.data.playerName = {};
        hostObj.setView('lobby', {});
    });

    hostRule.on('client-join', function(data) {
        var hostObj = this;
        hostObj.data.playerName[data.from] = data.from;

        hostObj.getView().emit('client-join', {
            client: data.client
        });
    });

    hostRule.on('client-leave', function(data) {
        hostObj.getView().emit('client-leave', {
            client:data.client
        });
    });

    hostRule.on('message', function(data) {
        var hostObj = this;

        switch(data.type) {
            case 'set-name':
                hostObj.data.playerName[data.from] = data.message;

                if (hostObj.getView().getName() === 'lobby') {
                    hostObj.getView().emit('set-name', {
                        client: data.from,
                        name: data.message
                    });
                }

                break;
            }
    });
});


lobby.defineClient(function(client) {
    client.on('load', function() {
        var clientObj = this;
        clientObj.setView('lobby-client', {name: ''});
    });
});


lobby.addView('lobby',
    'Connected Clients: <ul id="lobby"></ul>',
    function(view) {
        view.on('load', function() {
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
                view.getPlayerObj().sendToHost('set-name', this.value);
            });

        });
    });

