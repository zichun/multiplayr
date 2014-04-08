var Multiplayr = (function() {
    var Multiplayr = {
        createRule: function(rule) { throw new Error("Not implemented"); },
        host: Host,
        join: Join,
        createDataType: CreateDataType,
        PrimitiveType: CreateDataType(_primitiveType)
    };

    /**
     * Multiplayr class creation function
     */
    function CreateDataType(classDef) {
        return classDef;
    }
    var _primitiveType = {
        constructor: function(v) {
            this.value = v;
        },
        setter: function(v) {
            this.value = v;
        },
        getter: function() {
            return this.value
        }
    };

    function Host(rule, container, io, uri, cb) {
        var comm = new MPProtocol(io, uri);

        // Create a new room
        comm.create(function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

            var gameObj = new MPGameObject({
                data: rule.globalData,
                playerData: rule.playerData,
                onDataChange: rule.onDataChange,
                roomId: data.roomId,
                clientId: data.clientId,
                container: container,
                isHost: true
            });

            var dxc = new MPDataExchange(comm, gameObj);

            setUpMethods(gameObj, rule.methods);

            if (isFunction(cb)) {
                cb(null, gameObj);
            }
        });
    }

    function Join(roomId, rule, container, io, uri, cb) {
        var comm = new MPProtocol(io, uri);

        // Join a room
        comm.join(roomId, function(err, data) {
            if (err) {
                if (isFunction(cb)) {
                    cb(err, false);
                } else {
                    throw new Error(err);
                }
            }

            var gameObj = new MPGameObject({
                roomId: roomId,
                clientId: data.clientId,
                container: container,
                isHost: false
            });

            var dxc = new MPDataExchange(comm, gameObj);

            setUpMethods(gameObj, rule.methods);

            if (isFunction(cb)) {
                cb(null, gameObj);
            }
        });
    }

    function setUpMethods(gameObj, methods) {
        function methodWrapper(exec) {
            return function() {
                exec.apply(gameObj, arguments);
            };
        }
        for (var method in methods) {
            gameObj[method] = methodWrapper(methods[method]);
        }
    }

    return Multiplayr;
})();



(function() {
    /**
     * Wrapper around React.createClass to memoize all created react classes
     */
    var orig = React.createClass;
    var _memo = {};
    React.createClass = function(spec) {
        var tr = orig.call(React, spec);

        // memoize by displayName
        if (spec.displayName) {
            _memo[spec.displayName] = tr;
        }
        return tr;
    };

    React.getClassByDisplayName = function(displayName) {
        return _memo[displayName];
    };

})();
