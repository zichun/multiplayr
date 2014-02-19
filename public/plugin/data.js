/***

This plugin adds a data channel layer

Data is always stored on host, with proper encapsulation for each client. Setting data is done as follows

    hostObj.setData([clientId], 'someDataName', {someData: 'value'})

Clients can request for data using the .getData method as such:

    clientObj.getData('someDataName', function(data) {
        // data eq {someData: 'value'}
    });

Data stored must either be a valid JSON object or serializable to a JSON object by extending DataChannelObject
implementing the toJSON method (see serialize)

***/
function DataChannel(_opt) {
    _opt = _opt || {};

    extendObj(_opt,
              {
                  notifyOnSet: false
              });

    return function() {
        var self = this;

        function setUpData(hostObj, player) {
            hostObj._data = hostObj._data || {};
            hostObj._data[player] = hostObj._data[player] || {};
        }

        // todo: proper GC when client leave. GC to be set as a _opt
        self.defineHost(function(hostRule) {
            hostRule.onMessage('datachannel-getdata', function(from, message, fn) {
                var hostObj = this;

                setUpData(hostObj, from);
                fn(dataChannelSerialize(hostObj._data[from][message]));
            });

            hostRule.methods.getDataSync = function(player, dataName) {
                var hostObj = this;
                return hostObj._data && hostObj._data[player] && hostObj._data[player][dataName];
            };

            hostRule.methods.getData = function(player, dataName, cb) {
                var hostObj = this;
                var data = hostObj.getDataSync(player, dataName);
                cb(data);
            };

            hostRule.methods.setData = function(player, dataName, data) {
                var hostObj = this;
                setUpData(hostObj, player);
                hostObj._data[player][dataName] = data;

                if (_opt.notifyOnset) {
                    hostObj.sendMessage('datachannel-setdata', {
                        dataName: dataName,
                        data: dataChannelSerialize(data)
                    });
                }
            };
        });

        self.defineClient(function(clientRule) {
            clientRule.methods.getData = function(dataName, cb) {
                var clientObj = this;
                clientObj.sendMessage('datachannel-getdata', dataName, function(data) {
                    cb(dataChannelUnserialize(data));
                });
            };
        });
    };
}

function dataChannelSerialize(data) {
    if (data instanceof DataChannelObject) {
        return {
            type: 'object',
            className: data.getClass(),
            value: data.toJSON()
        };
    } else {
        return {
            type: 'json',
            value: data
        };
    }
}

function dataChannelUnserialize(data) {
    if (typeof data !== 'object') {
        throw(new Error("Invalid data"));
    } else if (data.type === 'json') {
        return data.value;
    } else if (data.type === 'object') {
        var clss = eval(data.className);
        return clss.fromJSON(data.value);
    } else {
        throw(new Error("Invalid data"));
    }
}

function DataChannelObject() {
}


DataChannelObject.prototype.toJSON =
    function DataChannelObjectToJSON() {
        throw(new Error("Unimplemented method"));
    };

// Collection of DataChannelObject
function DataChannelCollection() {
    var self = this;
    self._collection = [];
    return self;
}

DataChannelCollection.Inherits(DataChannelObject);

DataChannelCollection.prototype.push =
    function DataChannelCollectionPush(obj) {
        var self = this;
        self._collection.push(obj);
    };

DataChannelCollection.prototype.pop =
    function DataChannelCollectionPop() {
        var self = this;
        if (self._collection.length === 0) {
            return null;
        }
        return self._collection.splice(self._collection.length-1, 1)[0];
    };

DataChannelCollection.prototype.toJSON =
    function DataChannelCollectionToJSON() {
        var tr= [], self = this;
        for (var i=0;i<self._collection.length;++i) {
            tr.push(dataChannelSerialize(self._collection[i]));
        }
        return tr;
    };


