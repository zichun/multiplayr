$(function() {
    $("#join-button").click(function() {
        var roomId = $("#roomId").val().trim();
        var commHost = new MPProtocol(io, location.protocol + '//' + location.host, document.body);
        commHost.join(roomId);
    });
});