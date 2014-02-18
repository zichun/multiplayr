function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function extendObj(ori, extend) {
    for (var i in extend) {
        if (extend.hasOwnProperty(i) && !ori.hasOwnProperty(i)) {
            ori[i] = extend[i];
        }
    }
}

Object.prototype.Inherits = function(Class) {
    this.prototype = new Class;
    this.prototype.constructor = this;
};

Object.prototype.getClass = function() {
   var funcNameRegex = /function (.{1,})\(/;
   var results = (funcNameRegex).exec((this).constructor.toString());
   return (results && results.length > 1) ? results[1] : "";
};

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

function setupEventSystem(Class, restrictedEvents) {
    function initialize() {
        var self = this;
        self._EventInit = true;

        self.eventBindings = {};
        restrictedEvents.forEach(function(evt) {
            self.eventBindings[evt] = [];
        });
    }

    Class.prototype.on =
        function MeshOn(evt, callback) {
            var self = this;

            self._EventInit || initialize.call(this);

            if (restrictedEvents.indexOf(evt) === -1) {
                throw(new Error("Invalid event: " + evt));
            } else if (!isFunction(callback)) {
                throw(new Error("Invalid callback argument"));
            } else {
                self.eventBindings[evt].push(callback);
            }
        };

    Class.prototype.off =
        function MeshOff(evt, callback) {
            var self = this;

            self._EventInit || initialize.call(this);

            if (restrictedEvents.indexOf(evt) === -1) {
                throw(new Error("Invalid event: " + evt));
            } else {
                var ind = self.eventBindings[evt].indexOf(callback);
                if (ind >= 0) {
                    self.eventBindings[evt].splice(ind, 1);
                }
            }
        };

    Class.prototype.emit =
        function MeshEmit(evt, data) {
            var self = this;

            self._EventInit || initialize.call(this);

            if (restrictedEvents.indexOf(evt) === -1) {
                throw(new Error("Invalid event: " + evt));
            } else {
                self.eventBindings[evt].forEach(function(cb) {
                    cb.call(self, data);
                });
            }
        };
}
