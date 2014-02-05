var MPGameEngine = (function(){

function MPGameEngine(ruleObj, container, io, uri) {
    var self = this;

    self.mesh = new Mesh(io, uri);
    self.container = container;
    self.playerObj = null;
    self.ruleObj = ruleObj;

    return self;
}

MPGameEngine.prototype.host =
    function MPGameEngineHost() {
        self.mesh.host();

        self.playerObj = new MPPlayer(ruleObj.hostRule);
        self.playerObj.init();
    };


MPGameEngine.prototype.join =
    function MPGameEngineJoin(roomId) {
        self.mesh.join(roomId);
    };


    return GameEngine;
})();
