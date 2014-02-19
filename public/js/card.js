var Card = (function() {

Card.DIAMOND = 0;
Card.CLUB = 1;
Card.HEART = 2;
Card.SPADE = 3;

var _Suit = [Card.DIAMOND, Card.CLUB, Card.HEART, Card.SPADE];

function Card(suit, value) {
    var self = this;

    if (_Suit.indexOf(suit) === -1) {
        throw(new Error("Invalid suit"));
    }
    if (typeof value !== 'number' || value < 1 || value > 13) {
        throw(new Error("Invalid card value"));
    }

    self.suit = suit;
    self.value = value;

    return self;
}

Card.Inherits(DataChannelObject);

Card.prototype.toJSON = function() {
    var self = this;
    return {
        suit: self.suit,
        value: self.value
    };
};

Card.fromJSON = function(json) {
    return new Card(json.suit, json.value);
};

return Card;

})();


var Hand = (function() {

function Hand() {
    var self = this;

    DataChannelCollection.call(self);

    return self;
}

Hand.Inherits(DataChannelCollection);

Hand.prototype.addCard =
    function HandAddCard(card) {
        var self = this;
        if (!(card instanceof Card)) {
            throw(new Error("Invalid card type"));
        }
        DataChannelCollection.prototype.push.call(self, card);
    };

Hand.prototype.resetDeck =
    function HandResetDeck() {
        var self = this;
        var _Suit = [Card.DIAMOND, Card.CLUB, Card.HEART, Card.SPADE];

        _Suit.forEach(function(suit) {
            for (var i=1;i<=13;++i) {
                self.addCard(new Card(suit, i));
            }
        });

        return self;
    };

Hand.prototype.shuffle =
    function HandShuffle() {
        var self = this;
        // todo: implement
        return self;
    };

Hand.prototype.draw =
    function HandDraw() {
        // pop
        var self = this;
        return self.pop();
    };

Hand.prototype.sortBySuit =
    function HandSortBySuit() {
        // todo: implement
    };

Hand.prototype.sortByValue =
    function HandSortByValue() {
        // todo: implement
    };

Hand.fromJSON = function(json) {
    var tr = new Hand();
    for (var i=0;i<json.length;++i) {
        tr.addCard(dataChannelUnserialize(json[i]));
    }
    return tr;
};

return Hand;

})();
