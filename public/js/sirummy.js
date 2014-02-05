var sirummyrules = new MPRule();

//MPRule.addPlugin()

sirummyrules.defineHost(function(hostRule) {

    hostRule.data.playerName = {};

    hostRule.on('load', function(data) {
        var hostObj = this;

        hostObj.setView('lobby', {});
    });

    hostRule.on('new-player', function(data) {
        
    });

    hostRule.on('message', function(player, data) {
        var hostObj = this;

        switch(data.type) {
            case 'set-name':
                hostObj.data.playerName[player] = data.message;

                if (hostObj.getView().getName() === 'lobby') {
                    hostObj.getView().emit('set-name', {
                        player: player,
                        name: name
                    });
                }

                break;
            }
    });
});

sirummyrules.addView('lobby',
    '<div id="asdf"></div>',
    function(view) {
        view.on('set-name', function() {
            
        });
    }
);

sirummyrules.definePlayer(function(player) {
    player.on('load', function() {
        player.setView('lobby');
    });
});
