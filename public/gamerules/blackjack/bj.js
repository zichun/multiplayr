var BJRule = Multiplayr.createRule(
    {
        clientStates: {
            lobby: function(client, player) {

            },
            play: function(client, players) {

            },
            wait: {
            }
        },

        methods: {
            hit: {
                states: ['play'],
                callee: function(player, gameObject, cb) {
                    gameObject.getData('turn', function(val) {
                        if (val === player) {
                            cb(true);
                        } else {
                            cb(false);
                        }
                    });
                },
                exec: function(player, gameObj, cb) {
                    gameObject.getData('deck', function(deck) {
                        gameObject.getPlayer(player).getData('hand', function(hand) {
                            deck.popCard(function(err, card){
                                hand.push(card);
                            });
                        });
                    });
                }
            },

            stand: {
                states: ['play'],
                exec: function(player, gameObj, cb) {
                    gameObject.getData('turn', function() {

                    })
            }


        },

        globalData: {
            turn: {
                type: Multiplayr.PrimitiveType.Int,
                onchange: function(value, gameObj) {
                },
                initial: 1
            },
            state: {
                type: Multiplayr.PrimitiveType.String,
                onchange: function(value, gameObj) {

                },
                initial: 1
            },
            score: 0,
            handOfPlayers: []
        },

        playerData: {
        }

    }
);