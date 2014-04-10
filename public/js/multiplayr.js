var Multiplayr = (function() {
    var Multiplayr = {
        extendRule: ExtendRule,
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

            var gameObj = new MPGameObject(rule,
                                           data.roomId,
                                           data.clientId,
                                           true,
                                           container);

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


            var gameObj = new MPGameObject(rule,
                                           roomId,
                                           data.clientId,
                                           false,
                                           container);
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

    // Extends given baseRule with another rule. Note that this method mutates the given baseRule
    // returns the extended baseRule
    function ExtendRule(baseRule, extendedRule, namespace) {
        // if we are given a namespace, variables  will be prefixed with [namespace].variableName
        var prefix = namespace ? namespace + '.' : '';

        function checkConflict(baseObj, extendedObj, prefix) {
            for (var key in extendedObj) {
                var prefixedKey = prefix + key;
                if (extendedObj.hasOwnProperty(key)) {
                    if (baseObj.hasOwnProperty(prefixedKey)) {
                        throw("Conflicting key: " + prefixedKey);
                    }
                    // temp
                    baseObj[prefixedKey] = extendedObj[key];
                }
            }
        }

        ['methods', 'globalData', 'playerData', 'views'].forEach(function(key) {
            try {
                checkConflict(baseRule[key], extendedRule[key], prefix);
            } catch(e) {
                throw(new Error("ExtendRule['+key+'] - " + e));
            }
        });

        baseRule.plugins = baseRule.plugins || [];
        baseRule.plugins.push(extendedRule);

        return baseRule;
    }

    return Multiplayr;
})();
