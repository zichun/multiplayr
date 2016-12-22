/***

This plugin adds view handling related stuff.

Views is built on top of Facebook react

***/
function MPView(_opt) {
    _opt = _opt || {};

    extendObj(_opt,
              {
                  touch: false
              });

    return function() {
        var self = this;

        React.initializeTouchEvents(_opt.touch);

        self.defineHost(function() {

        });
    };
}