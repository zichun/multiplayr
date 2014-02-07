var MPPlayer = (function(){


var MPPlayerEvents = ['client-leave', 'client-join', 'message', 'load'];

// todo: better constructor with options etc.
function MPPlayer(gameEngine, playerRule, gameRule) {
    var self = this;

    // todo: proper identification of host
    self.isHost = true;

    self.gameEngine = gameEngine;
    self.playerRule = playerRule;
    self.gameRule = gameRule;
    self.view = null;
    self.data = {};
    self.onMessageBindings = {};

    return self;
}

MPPlayer.prototype.init =
    function MPPlayerInit() {
        var self = this;
        self.emit('load', {});
    };

MPPlayer.prototype.setView =
    function MPPlayerSetView(view, data) {
        var self = this;
        self.view = self.gameEngine.getView(view);
        self.view.render(data, self);
    };

MPPlayer.prototype.getView =
    function MPPlayerGetView() {
        var self = this;
        return self.view;
    };

MPPlayer.prototype.sendToHost =
    function MPPlayerSendToHost(type, message, cb) {
        var self = this;

        self.gameEngine.sendToHost(type, message, cb);
    };

MPPlayer.prototype.send =
    function MPPlayerSend(player, type, message) {
        if (!self.isHost) {
            throw(new Error("Only host can send stuff to players"));
        }

        self.gameEngine.send(player, type, message);
    };

setupEventSystem(MPPlayer, MPPlayerEvents);


// todo: temp. this should be sugar-ized
MPPlayer.prototype.onMessage =
    function MPPlayerOnMessage(type, cb) {
        var self = this;
        if (typeof self.onMessageBindings[type] === 'undefined') {
            self.onMessageBindings[type] = [];
        }
        self.onMessageBindings[type].push(cb);
    };

MPPlayer.prototype.emitMessage =
    function MPPlayerEmitMessage(type, from, message) {
        var self = this;
        if (typeof self.onMessageBindings[type] !== 'undefined') {
            self.onMessageBindings[type].forEach(function(cb) {
                cb.call(self, from, message);
            });
        }
    };

    return MPPlayer;
})();

