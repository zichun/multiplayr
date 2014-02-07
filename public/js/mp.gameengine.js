var MPGameEngine = (function(){

function MPView(name, viewRule, playerObj, container) {
    var self = this;

    self.name = name;
    self.viewRule = viewRule;
    self.playerObj = playerObj;
    self.eventBindings = {};
    self.container = container;

    return self;
}

MPView.prototype.emit =
    function MPViewEmit(evt, data, selfObj) {
        var self = this;
        selfObj = selfObj || self.container;
        if (typeof self.eventBindings[evt] === 'undefined') {
            return;
        }
        self.eventBindings[evt].forEach(function(cb) {
            cb.call(selfObj, data);
        });
    };

MPView.prototype.on =
    function MPViewOn(evt, cb) {
        var self = this;
        if (typeof self.eventBindings[evt] === 'undefined') {
            self.eventBindings[evt] = [];
        }
        self.eventBindings[evt].push(cb);
    };

MPView.prototype.off =
    function MPPlayerRuleOff(evt, callback) {
        var self = this;
        var ind = self.eventBindings[evt].indexOf(callback);
        if (ind >= 0) {
            self.eventBindings[evt].splice(ind, 1);
        }
    };

MPView.prototype.getPlayerObj =
    function MPViewGetPlayerObj() {
        var self = this;
        return self.playerObj;
    };

MPView.prototype.render =
    function MPViewRender(data, playerObj) {
        var self = this;

        // todo: consider having a ViewRule and a ViewObj ala Player.
        // player object should not be bound at rule level

        $(self.container).html(
            js_tmpl(self.viewRule.markup, data));

        self.emit('load', {}, $(self.container));
    };

MPView.prototype.getName =
    function MPViewGetName() {
        var self = this;
        return self.name;
    };



function MPGameEngine(ruleObj, container, io, uri) {
    var self = this;

    self.comm = new MPProtocol(io, uri);
    self.container = container;
    self.playerObj = null;
    self.ruleObj = ruleObj;
    self.viewObjs = {};

    return self;
}

function initialize(playerRule, playerObj) {
    var self = this;

    // todo: use a proper getter
    for (var evt in playerRule.eventBindings) {
        playerRule.eventBindings[evt].forEach(function(cb) {
            playerObj.on(evt, cb);
        });
    }

    self.comm.on('message', function(data) {
        var from = data.from;
        var message = data.message;

        playerObj.emit('message', {
            from: from,
            type: message.type,
            message: message.message
        }, self.playerObj);
    });

    self.comm.on('join-room', function(data) {
        playerObj.emit('client-join', {
            // todo: unify API naming to be more consistent
            client: data.message
        }, self.playerObj);
    });

    self.comm.on('leave-room', function() {
        playerObj.emit('client-leave', {
            // todo: unify API naming to be more consistent
            client: data.message
        }, self.playerObj);
    });

    for (var method in playerRule.methods) {
        playerObj[method] = playerRule.methods[method];
    }
}

MPGameEngine.prototype.host =
    function MPGameEngineHost(cb) {
        var self = this;
        self.comm.create(function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

            self.roomId = data.roomId;
            self.playerObj = new MPPlayer(self, self.ruleObj.hostRule, self.ruleObj);

            initialize.call(self, self.ruleObj.hostRule, self.playerObj);

            self.playerObj.init();


            if (isFunction(cb)) {
                cb(null, self.playerObj);
            }
        });
    };

MPGameEngine.prototype.sendToHost =
    function MPGameEngineSendToHost(data, cb) {
        var self = this;
        // todo: to decide whether type is necessary
        self.comm.sendToHost(data, cb);
    };

MPGameEngine.prototype.send =
    function MPGameEngineSend(player, data, cb) {
        self.comm.send(player, data, cb);
    };


MPGameEngine.prototype.join =
    function MPGameEngineJoin(roomId, cb) {
        var self = this;
        self.comm.join(roomId, function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

            self.playerObj = new MPPlayer(self, self.ruleObj.clientRule, self.ruleObj);

            initialize.call(self, self.ruleObj.clientRule, self.playerObj);

            self.playerObj.init();

            if (isFunction(cb)) {
                cb(null, self.playerObj);
            }
        });
    };

MPGameEngine.prototype.getView =
    function MPGameEngineGetView(view) {
        var self = this;
        if (typeof self.viewObjs[view] === 'undefined') {
            var viewRule = self.ruleObj.getView(view);

            self.viewObjs[view] = new MPView(view, viewRule, self.playerObj, self.container);
            viewRule.initFunc.call(viewRule, self.viewObjs[view]);
        }
        return self.viewObjs[view];
    };

    return MPGameEngine;
})();
