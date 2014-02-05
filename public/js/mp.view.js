var MPView = (function() {

function MPView(name, markup) {
    var self = this;

    self.name = name;
    self.markup = markup;
    self.eventBindings = {};
    self.playerObj = {};
    self.container = document.body;

    return self;
}

MPView.prototype.getName =
    function MPViewGetName() {
        return this.name;
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
    function MPViewRender(data, container, playerObj) {
        var self = this;

        // todo: consider having a ViewRule and a ViewObj ala Player.
        // player object should not be bound at rule level
        self.playerObj = playerObj;

        self.container = container || document.body;
        
        $(self.container).html(
            js_tmpl(self.markup, data));

        self.emit('load', {}, $(self.container));
    };

    return MPView;
})();






// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(){
  var cache = {};
  this.js_tmpl = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !/\W/.test(str) ?
      cache[str] = cache[str] ||
        tmpl(document.getElementById(str).innerHTML) :
      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      new Function("obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};" +
        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +
        // Convert the template into pure JavaScript
        str
          .replace(/[\r\t\n]/g, " ")
          .split("<%").join("\t")
          .replace(/((^|%>)[^\t]*)'/g, "$1\r")
          .replace(/\t=(.*?)%>/g, "',$1,'")
          .split("\t").join("');")
          .split("%>").join("p.push('")
          .split("\r").join("\\'")
      + "');}return p.join('');");

    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
})();
