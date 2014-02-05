var MPPlayer = (function(){

function MPPlayer(playerRule, gameRule) {
    var self = this;

    self.playerRule = playerRule;
    self.gameRule = gameRule;
    self.view = null;

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
        self.view = self.gameRule.getView(view);
        self.view.render(data);
    };

MPPlayer.prototype.getView =
    function MPPlayerGetView() {
        var self = this;
        return self.view;
    };

    return MPPlayer;
})();
