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
    function MPPlayerSendToHost(data, cb) {
        var self = this;

        self.gameEngine.sendToHost(data, cb);
    };

MPPlayer.prototype.send =
    function MPPlayerSend(player, message, cb) {
        if (!self.isHost) {
            throw(new Error("Only host can send stuff to players"));
        }

        self.gameEngine.send(player, message, cb);
    };

setupEventSystem(MPPlayer, MPPlayerEvents);

    return MPPlayer;
})();
