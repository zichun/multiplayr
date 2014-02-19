var MPView = (function() {


var UUID = 0;

function generateUUID() {
    return "MPSubView-" + UUID++;
};

function MPView(name, viewRule, playerObj, container) {
    var self = this;

    self.name = name;
    self.viewRule = viewRule;
    self.playerObj = playerObj;
    self.eventBindings = {};
    // todo: MPView should be independent from container. container given through render
    self.container = container;
    self.childViews = {};
    for (var i in viewRule.childViews) {
        var childViewRule = viewRule.childViews[i];
        self.childViews[i] = new MPView(childViewRule.name, childViewRule, playerObj, container);
    }

    viewRule.initFunc.call(viewRule, self);

    return self;
}

// getChildViews returns a JSON object containing the views
MPView.prototype.getChildViews =
    function MPViewGetChildViews() {
        var self = this;
        return self.childViews;
    };

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

        for (var i in self.childViews) {
            self.childViews[i].emit(evt, data);
        }
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


        $(self.container).html(self.generateHTML(data, playerObj));

        self.emit('load', {}, $(self.container));
    };

MPView.prototype.generateHTML =
    function MPViewGenerateHTML(data, playerObj) {

        var self = this;

        var markupData = {};
        for (var i in data) {
            markupData[i] = data[i];
        }
        for (var i in self.childViews) {
            markupData[i] = self.childViews[i].generateHTML({}, {});
        }

        return js_tmpl(self.viewRule.markup, markupData);
    };

MPView.prototype.getName =
    function MPViewGetName() {
        var self = this;
        return self.name;
    };


    return MPView;

})();
