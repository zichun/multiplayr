$(function() {
    $("#join-button").click(function() {
        var $joinButton = $(this);
        var roomId = $("#roomId").val().trim();
        var commHost = new MPProtocol(io, location.protocol + '//' + location.host, document.body);

        $joinButton.attr('disabled', 'disabled');
        $joinButton.text('Connecting...');

        commHost.join(roomId, function(err, x) {
            if (!x) {
                $("#error").text(err);
                $joinButton.attr('disabled', null);
                $joinButton.text('Join Game');
            }
        });
    });
});