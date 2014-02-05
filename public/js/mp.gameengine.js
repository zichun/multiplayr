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

    self.mesh = new Mesh(io, uri);
    self.container = container;
    self.playerObj = null;
    self.ruleObj = ruleObj;
    self.viewObjs = {};

    return self;
}

MPGameEngine.prototype.host =
    function MPGameEngineHost(cb) {
        var self = this;
        self.mesh.create(function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

            self.mesh.on('message', function(data) {
                var from = data.from;
                var message = data.message;

                self.ruleObj.hostRule.emit('message', {
                    from: from,
                    type: message.type,
                    message: message.message
                }, self.playerObj);
            });

            self.mesh.on('join-room', function(data) {
                self.ruleObj.hostRule.emit('client-join', {
                    // todo: unify API naming to be more consistent
                    client: data.message
                }, self.playerObj);
            });

            self.mesh.on('leave-room', function() {
                self.ruleObj.hostRule.emit('client-leave', {
                    // todo: unify API naming to be more consistent
                    client: data.message
                }, self.playerObj);
            });

            self.playerObj = new MPPlayer(self, self.ruleObj.hostRule, self.ruleObj);
            self.playerObj.init();

            if (isFunction(cb)) {
                cb(null, self.playerObj);
            }
        });
    };

MPGameEngine.prototype.sendToHost =
    function MPGameEngineSendToHost(type, message, cb) {
        var self = this;

        // todo: check if object is properly initialized
        // todo: need a proper protocol layer that cognizes the notion of a "host"
        self.mesh.send(
            self.mesh.peers[0],
            {
                type: type,
                message: message
            },
            cb);
    };

MPGameEngine.prototype.send =
    function MPGameEngineSend(player, type, message) {
        // todo: implement
    };


MPGameEngine.prototype.join =
    function MPGameEngineJoin(roomId, cb) {
        var self = this;
        self.mesh.join(roomId, function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }
//            self.mesh.on('message', function(data) {
//                alert(data);
//            });

            self.playerObj = new MPPlayer(self, self.ruleObj.clientRule, self.ruleObj);
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
