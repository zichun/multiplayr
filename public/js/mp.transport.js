function Room(io, uri) {
    this.socket = io.connect(uri);

}

var socket = io.connect('http://localhost');
socket.on('news', function (data) {
    alert(data);
    socket.emit('my other event', { my: 'data' });
});
