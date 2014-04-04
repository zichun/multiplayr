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
                data: rule.playerData,
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
        function methodWrapper(checker, exec) {
            return function() {
                // todo: check checker
                exec.apply(gameObj, arguments);
            };
        }
        for (var method in methods) {
            gameObj[method] = methodWrapper(methods[method].callee, methods[method].exec);
        }
    }

    return Multiplayr;
})();