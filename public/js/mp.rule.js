var MPRule = (function() {


var PlayerEvents = ['message', 'client-join', 'client-leave', 'load'];

function MPPlayerRule() {
    var self = this;

    self.eventBindings = {};
    PlayerEvents.forEach(function(evt) {
        self.eventBindings[evt] = [];
    });

    return self;
}


// todo: proper inheritance for code reuse. on/off/emit

MPPlayerRule.prototype.on =
    function MPPlayerRuleOn(evt, callback) {
        var self = this;
        if (PlayerEvents.indexOf(evt) === -1) {
            throw(new Error("Invalid event: " + evt));
        } else {
            self.eventBindings[evt].push(callback);
        }
    };

MPPlayerRule.prototype.off =
    function MPPlayerRuleOff(evt, callback) {
        var self = this;
        if (PlayerEvents.indexOf(evt) === -1) {
            throw(new Error("Invalid event: " + evt));
        } else {
            var ind = self.eventBindings[evt].indexOf(callback);
            if (ind >= 0) {
                self.eventBindings[evt].splice(ind, 1);
            }
        }
    };

MPPlayerRule.prototype.emit =
    function MPPlayerRuleEmit(evt, data, selfObj) {
        var self = this;

        if (PlayerEvents.indexOf(evt) === -1) {
            throw(new Error("Invalid event: " + evt));
        } else {
            selfObj = selfObj || self;

            self.eventBindings[evt].forEach(function(cb) {
                cb.call(selfObj, data);
            });
        }
    };



function MPRule() {
    var self = this;

    self.views = {};

    self.hostRule = new MPPlayerRule();
    self.clientRule = new MPPlayerRule();

    return self;
}

MPRule.prototype.defineHost =
    function MPRuleDefineHost(fn) {
        var self = this;
        fn.call(self, self.hostRule);
    };

MPRule.prototype.defineClient =
    function MPRuleDefineClient(fn) {
        var self = this;
        fn.call(self, self.clientRule);
    };

MPRule.prototype.addView =
    function MPRuleAddView(viewName, viewMarkup, initFunc) {
        var self = this;
        if (typeof self.views[viewName] !== 'undefined') {
            throw(new Error("View:" + viewName + " alredy exists!"));
        }

        self.views[viewName] = new MPViewRule(viewName, viewMarkup, initFunc);
//        initFunc.call(self, self.views[viewName]);
    };

    return MPRule;
})();

MPRule.prototype.getView =
    function MPRuleGetView(viewName) {
        var self = this;
        if (typeof self.views[viewName] === 'undefined') {
            throw(new Error("View:" + viewName + " does not exist"));
        }

        return self.views[viewName];
    };
