$(function() {
    var commHost = new MPProtocol(io, location.protocol + '//' + location.host, document.body);

    $("#join-button").click(function() {
        var $joinButton = $(this);
        var roomId = $("#roomId").val().trim();
        var clientId = $("#clientId").val().trim();

        if (clientId === '') {
            clientId = null;
        }

        $joinButton.attr('disabled', 'disabled');
        $joinButton.text('Connecting...');

        commHost.join(roomId, clientId, function(err, data) {
            if (err || !data) {
                $("#error").text(err);
                $joinButton.attr('disabled', null);
                $joinButton.text('Join Game');
            } else {

                window.location.hash = 'roomId=' + data.roomId + '&clientId=' + data.clientId;

            }
        });
    });

    function parseHash() {
        var dict = {};

        function extractFromHash(string, key, dictionary) {
            var str = string.split('=');

            if (str.length !== 2 || str[0].indexOf(key) === -1) {
                return false;
            }

            return (dictionary[key] = str[1]);
        }

        var hash = window.location.hash.split('&');

        if (hash.length !== 2) {
            return false;
        }

        for (var i = 0; i < hash.length; ++i) {
            extractFromHash(hash[i], 'roomId', dict);
            extractFromHash(hash[i], 'clientId', dict);
        }

        return dict;
    }

    var hash = parseHash();
    if (hash['roomId'] && hash['clientId']) {
        commHost.hasRoom(hash['roomId'],
                         function(err, roomExists) {
                             if (err) {
                                 console.error(err);
                             }

                             if (roomExists === true) {
                                 $("#roomId").val(hash['roomId']);
                                 $("#clientId").attr('disabled', '').val(hash['clientId']);
                             } else {
                                 $("#roomId").val('');
                                 $("#clientId").attr('disabled', '').val('');
                             }
                         });
    }
});