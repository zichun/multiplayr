var MPView = (function() {

function MPView(name, viewRule, playerObj, container) {
    var self = this;

    self.name = name;
    self.viewRule = viewRule;
    self.playerObj = playerObj;
    self.eventBindings = {};
    // todo: MPView should be independent from container. container given through render
    self.container = container;

    self.childViews = [];

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

        // todo: bubble childViews downwards
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


    return MPView;

})();
