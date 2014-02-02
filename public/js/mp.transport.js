function Mesh(io, uri) {
    var socket = this.socket = io.connect(uri);

    socket.on('client-sendmessage', function(data) {
    });

    socket.on('room-broadcast', function(data) {
    });
}

Mesh.prototype.create =
    function MeshCreate() {
        /// todo: implement
    };

Mesh.prototype.join =
    function MeshJoin(id) {
        /// todo: implement
    };

Mesh.prototype.sendMessage =
    function MeshSendMessage(clientId, message) {
        /// todo: implement
    };

Mesh.prototype.on =
    function MeshOn(evt, callback) {
        /// todo: implement
    };
