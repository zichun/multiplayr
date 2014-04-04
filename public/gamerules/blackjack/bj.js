var BJRule = Multiplayr.createRule(
    {
        methods: {
            hit: {
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
                exec: function(player, gameObj, cb) {
                    gameObject.getData('turn', function() {

                    })
                }

            }
        },

        globalData: {
            turn: {
                onchange: function(data, gameObj) {
                },
                value: 1,
                const: false
            },
            state: {
                type: Multiplayr.PrimitiveType,
                onchange: function(data, gameObj) {
                    gameObj.renderView(data);
                },
                initial: 1,
                const: false
            }
        },

        playerData: {
            hand: {
            }
        }

    });
