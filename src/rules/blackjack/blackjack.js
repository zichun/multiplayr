var lobby = new MPRule();


function BJHand() {
    var self = this;
    Hand.call(self);
    return self;
}

BJHand.Inherits(Hand);

BJHand.prototype.getValue = function() {
    var self = this;
    var tr = 0, ace = 0;
    self.forEach(function(card) {
        var v = card.getValue();
        if (v === 1) {
            ace++;
        } else if (v >= 10) {
            tr += 10;
        } else {
            tr += v;
        }
    });

    if (ace) {
        if (self.size() === 2) {
            return tr + 11;
        } else if(self.size() === 3) {
            if (tr + 10 > 21) {
                return tr + 1;
            } else {
                return [tr + 1, tr + 10];
            }
        } else {
            return tr + 1;
        }
    } else {
        return tr;
    }
};
BJHand.prototype.canHit = function() {
    var val = this.getValue();
    return ((typeof val === 'number' ? val : val[0]) < 21 && this.size() < 5);

};
BJHand.prototype.canStand = function() {
    var val = this.getValue();
    return ((typeof val === 'number' ? val : val[1]) >= 16);
};

BJHand.fromJSON = function(json) {
    return Hand.fromJSON.apply(this, arguments);
};

lobby.addPlugin(Sugar());
lobby.addPlugin(DataChannel());
lobby.addPlugin(Player());

lobby.defineHost(function(hostRule) {

    hostRule.on('load', function(data) {
        var hostObj = this;
        hostObj.setView('lobby', {});
    });

    hostRule.on('client-join', function(data) {
        var hostObj = this;


        hostObj.getView().emit('client-join', {
            client: data.client
        });

        hostObj.player(data.client)
                .data('name', data.client)
                .setView('lobby-client', {name: data.client});
    });

    hostRule.on('client-leave', function(data) {
        var hostObj = this;

        hostObj.getView().emit('client-leave', {
            client: data.client
        });
    });

    hostRule.onMessage('set-name', function(from, name, fn) {
        var hostObj = this;

        hostObj.player(from).data('name', name);

        if (hostObj.getView().getName() === 'lobby') {
            hostObj.getView().emit('set-name', {
                client: from,
                name: name
            });
        }
    });

    function clearAndDistribute() {
        var hostObj = this;

        hostObj.data.cards = new BJHand();
        hostObj.data.cards.resetDeck().shuffle();

        hostObj.playerForEach(function(playerId) {
            var hand = new BJHand();

            hostObj.player(playerId)
                    .data('banker', false)
                    .data('turn', false)  // whether it's the player's turn
                    .data('stand', false) // whether the player has stand (completed his round)
                    .data('hand', hand);

            hand.addCard(hostObj.data.cards.draw());
            hand.addCard(hostObj.data.cards.draw());
        });
    }

    function startGame() {
        // for now, assume client 0 is the banker
        var hostObj = this;
        hostObj.player(0).data('banker', true);
        hostObj.player().setView('hand'); // todo: wait till view is set before calling setTurn. depends on proper async on player plugin

        hostObj.data.turn = 1;
        setTurn.call(hostObj);
    }

    function setTurn() {
        var hostObj = this;
        var player = hostObj.player(hostObj.data.turn);
        if (player.data('stand') === false) {
            player.data('turn', true)
                    .emitView('turn', true);
        }
    }

    hostRule.onMessage('hit', function(playerId, data, fn) {
        var hostObj = this;
        var player = hostObj.player(playerId);

        if (player.data('turn') === false) {
            // ignore request
        } else {
            var hand = player.data('hand');
            if (hand.canHit()) {
                var card = hostObj.data.cards.draw();
                hand.addCard(card);
                fn(card.toJSON());
            } else {
                fn(false);
            }
        }
    });

    hostRule.onMessage('stand', function(playerId, data, fn) {
        var hostObj = this;
        var player = hostObj.player(playerId);

        if (player.data('turn') === false) {
            // ignore request
        } else {
            var hand = player.data('hand');
            if (hand.canStand()) {
                player.data('turn', false).data('stand', true);
                hostObj.data.turn = (hostObj.data.turn + 1) % hostObj.playerCount();
                setTurn.call(hostObj);
                fn(true);
            } else {
                fn(false);
            }
        }

    });

    hostRule.methods.startGame = function() {
        var hostObj = this;
        if (hostObj.playerCount() < 2) {
            alert('we need more than 2 players to start the game');
        } else {
            clearAndDistribute.call(hostObj);
            startGame.call(hostObj);
        }
    };

});

lobby.defineClient(function(client) {
    client.on('load', function() {
        var clientObj = this;
//        clientObj.setView('lobby-client', {name: ''});
    });
});

lobby.addView('hand',
    '<div class="status">Total: <span class="total"></span></div>' +
    '<div class="hand"></div>' +
    '<div class="control"></div>',
    function(view) {
        function suitToText(s) {
            var _s = ['\u2662', '\u2663', '\u2661', '\u2660'];
            return _s[s];
        }

        function addCard(card) {
            var $con = $(view.getContainer());
            $con.find('.hand').append('<div class="card">' + card.getValue() + suitToText(card.getSuit()) + '</div>');
        }

        function updateMoves(hand) {
            var v = hand.getValue();
            var $con = $(view.getContainer());
            var $control = $con.find('.control');

            $control.empty();

            if (hand.canHit()) {
                $('<button>Hit</button>').click(hit).appendTo($control);
            }
            if (hand.canStand()) {
                $('<button>Stand</button>').click(stand).appendTo($control);
            }
            $con.find('.total').html(typeof v === 'number' ? v : v[0] + ', ' + v[1]);
        }

        function stand() {
            var $con = $(view.getContainer());
            view.getPlayer().sendMessage('stand', {}, function() {
                $con.find('.control').empty();
            });
        }

        function hit() {
            view.getPlayer().sendMessage('hit', {}, function() {
                view.getPlayer().getData('hand', function(hand) {
                    addCard(hand.peek());
                    updateMoves(hand);
                });
            });
        }

        view.on('load', function() {
            var $con = $(this);
            view.getPlayer().getData('hand', function(hand) {
                view.getPlayer().hand = hand;
                hand.forEach(addCard);
            });
        });

        view.on('turn', function() {
            view.getPlayer().getData('hand', function(hand) {
                updateMoves(hand);
            });
        });
    });

lobby.addView('lobby',
    'Connected Clients: <ul id="lobby"></ul> <button id="startgame">Start Game</button>',
    function(view) {
        view.on('load', function() {
            $("#startgame").click(function() {
                view.getPlayer().startGame();
            });
        });

        view.on('client-join', function(data) {
            $("#lobby").append('<li player="'+data.client+'">' + data.client +'</li>');
        });

        view.on('client-leave', function(data) {
            $('#lobby li').each(function() {
                if ($(this).attr('player') === data.client) {
                    $(this).remove();
                }
            });
        });

        view.on('set-name', function(data) {
            $('#lobby li').each(function() {
                if ($(this).attr('player') === data.client) {
                    $(this).html(data.name);
                }
            });
        });
    }
);

lobby.addView('lobby-client',
    'Welcome. Name: <input type="text" class="name" value="<%=name%>" /><br /><button class="disconnect">Disconnect</button>',
    function(view) {
        view.on('load', function(playerObj) {
            $(this).find(".name").bind('keyup', function() {
                view.getPlayer().sendMessage('set-name', this.value);
            });
        });
    });

