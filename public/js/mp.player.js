var MPPlayer = (function(){

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

    return self;
}

MPPlayer.prototype.init =
    function MPPlayerInit() {
        var self = this;
        self.playerRule.emit('load', {}, self);
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

    return MPPlayer;
})();

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
