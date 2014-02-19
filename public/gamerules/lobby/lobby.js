var lobby = new MPRule();

//MPRule.addPlugin()

lobby.addPlugin(Sugar());

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

        hostObj.clientSetView(data.client, 'lobby-client', {name: data.client}, function() {
        });
    });

    hostRule.on('client-leave', function(data) {
        hostObj.getView().emit('client-leave', {
            client:data.client
        });
    });

    hostRule.onMessage('set-name', function(from, data) {
        var hostObj = this;
        hostObj.data.playerName[from] = data;

        if (hostObj.getView().getName() === 'lobby') {
            hostObj.getView().emit('set-name', {
                client: from,
                name: data
            });
        }
    });
});


lobby.defineClient(function(client) {
    client.on('load', function() {
        var clientObj = this;
//        clientObj.setView('lobby-client', {name: ''});
    });
});

lobby.addView('testSubView', 
    '<div id="yolo">YOLO</div>',
    function (view) {
        view.on('load', function () {
            console.log('YOLO');
        });
    }
);

lobby.addView('lobby',
    'Connected Clients: <ul id="lobby"></ul><%=testSubView%>',
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
    },
    ['testSubView']
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

