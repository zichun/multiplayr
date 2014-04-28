$(function() {
    $("#join-button").click(function() {
        var roomId = $("#roomId").val().trim();
        var commHost = new MPProtocol(io, 'http://localhost:3000', document.body);
        commHost.join(roomId);
    });
});