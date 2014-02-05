var sirummyrules = new MPRule();

//MPRule.addPlugin()

sirummyrules.defineHost(function(hostRule) {

    hostRule.on('load', function(data) {
        var hostObj = this;

        hostObj.data.playerName = {};
        hostObj.setView('lobby', {});
    });

    hostRule.on('client-join', function(data) {
        var hostObj = this;
        hostObj.getView().emit('client-join', {
            client: data.client
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


sirummyrules.defineClient(function(client) {
    client.on('load', function() {
        var clientObj = this;
        clientObj.setView('lobby-client', {name: ''});
    });
});


sirummyrules.addView('lobby',
    'Connected Clients: <ul id="lobby"></ul>',
    function(view) {
        view.on('load', function() {
        });

        view.on('client-join', function(data) {
            $("#lobby").append('<li player="'+data.client+'">' + data.client +'</li>');
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

sirummyrules.addView('lobby-client',
    'Welcome. Name: <input type="text" id="name" value="<%=name%>" />',
    function(view) {
        view.on('load', function(playerObj) {
            $("#name").bind('keyup', function() {
                view.getPlayerObj().sendToHost('set-name', this.value);
            });
        });
    });

