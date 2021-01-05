import {
    TicTacToePokerGameState,
    TicTacToePokerGameStatus,
    Board,
    Card,
    CardType,
    Suit,
    SkipMove,
    PlayNormalCard,
    PlayJoker,
    PlayThief,
} from '../../rules/tictactoepoker/tictactoepoker';
import * as assert from 'assert';

describe('ticatctoepoker_gamestate', () => {
    const ec = {type: CardType.Empty};
    const empty_boards = [
        [[ec, ec, ec], [ec, ec, ec], [ec, ec, ec]],
        [[ec, ec, ec], [ec, ec, ec], [ec, ec, ec]]
    ];

    describe('tictactoepoker play cards', () => {

        it('play normal cards', () => {
            const obj = {
                deck: [
                    {type: CardType.Normal, suit: Suit.Hearts, value: 7},
                    {type: CardType.Normal, suit: Suit.Hearts, value: 8},
                    {type: CardType.Normal, suit: Suit.Hearts, value: 9},
                ],
                table_cards: [
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 2},
                    {type: CardType.Normal, suit: Suit.Clubs, value: 3},
                    {type: CardType.Normal, suit: Suit.Hearts, value: 4},
                    {type: CardType.Normal, suit: Suit.Hearts, value: 5},
                    {type: CardType.Normal, suit: Suit.Diamonds, value: Card.AceValue},
                ],
                current_player: 0,
                boards: empty_boards,
                num_players: 2,
            };
            let state = TicTacToePokerGameState.from_object(obj);

            // Player 0
            // Deck: h7 h8 h9
            // Table: d2 c3 h4 h5 dA
            // Move: play d2 from the table onto (0, 0)
            assert.equal(state.get_current_player(), 0);
            assert.equal(state.apply_move(new PlayNormalCard(0, 0, 0, 0)), "");
            assert.deepEqual(state.get_board(0).get_card(0, 0),
                             Card.create_normal(Suit.Diamonds, 2));
            // Check table card was replaced
            assert.deepEqual(state.get_table_cards()[0],
                             Card.create_normal(Suit.Hearts, 7));
            assert.equal(state.get_score(0), 0);


            // Player 1
            // Deck: h8 h9
            // Table: h7 c3 h4 h5 dA
            // Move: play h7 from the table onto (0, 0)
            assert.equal(state.get_current_player(), 1);
            assert.equal(state.apply_move(new PlayNormalCard(1, 0, 0, 0)), "");
            assert.deepEqual(state.get_board(1).get_card(0, 0),
                             Card.create_normal(Suit.Hearts, 7));
            // Check table card was replaced
            assert.deepEqual(state.get_table_cards()[0],
                             Card.create_normal(Suit.Hearts, 8));
             assert.equal(state.get_score(1), 0);

            // Player 0
            // Deck: h9
            // Table: h8 c3 h4 h5 dA
            // Illegal move: attempt to play h4 from the table onto (0, 0)
            assert.equal(state.get_current_player(), 0);
            // Should fail, since (0, 0) is occupied.
            assert.notEqual(state.apply_move(new PlayNormalCard(0, 2, 0, 0)), "");
            // Move: play h4 from the table onto (0, 2)
            assert.equal(state.apply_move(new PlayNormalCard(0, 2, 0, 2)), "");
            assert.deepEqual(state.get_board(0).get_card(0, 2),
                             Card.create_normal(Suit.Hearts, 4));
            // Check table card was replaced
            assert.deepEqual(state.get_table_cards()[2],
                             Card.create_normal(Suit.Hearts, 9));
            assert.equal(state.get_score(0), 0);

            // Player 1
            // Deck: ()
            // Table: h8 c3 h9 h5 dA
            // Move: play h8 from table onto (0, 1)
            assert.equal(state.get_current_player(), 1);
            assert.equal(state.apply_move(new PlayNormalCard(1, 0, 0, 1)), "");
            assert.deepEqual(state.get_board(1).get_card(0, 1),
                             Card.create_normal(Suit.Hearts, 8));
            // Check table card is empty (no more cards in deck)
            assert.deepEqual(state.get_table_cards()[0], Card.EMPTY);
            assert.equal(state.get_score(1), 0);

            // Player 0
            // Deck: ()
            // Table: () c3 h9 h5 dA
            // Move: play c3 from the table onto (0, 1)
            assert.equal(state.get_current_player(), 0);
            assert.equal(state.apply_move(new PlayNormalCard(0, 1, 0, 1)), "");
            assert.deepEqual(state.get_board(0).get_card(0, 1),
                             Card.create_normal(Suit.Clubs, 3));
            // Check table card is empty (no more cards in deck)
            assert.deepEqual(state.get_table_cards()[1], Card.EMPTY);
            // Player 0 now has a straight: d2 c3 h4
            assert.equal(state.get_score(0), 540);

            // Player 1
            // Deck: ()
            // Table: () () h9 h5 dA
            // Illegal move: attempt to play h9 from the table onto (0, 1)
            assert.equal(state.get_current_player(), 1);
            // Should fail, since (0, 1) is occupied.
            assert.notEqual(state.apply_move(new PlayNormalCard(1, 2, 0, 1)), "");
            // Move: play h9 from the table onto (0, 2)
            assert.equal(state.apply_move(new PlayNormalCard(1, 2, 0, 2)), "");
            assert.deepEqual(state.get_board(1).get_card(0, 2),
                             Card.create_normal(Suit.Hearts, 9));
            // Check table card is empty (no more cards in deck)
            assert.deepEqual(state.get_table_cards()[2], Card.EMPTY);
            // Player 1 has a straight flush: h7 h8 h9
            assert.equal(state.get_score(1), 1270);

        });

        it('play special cards', () => {
            const obj = {
                deck: [
                    {type: CardType.Joker},
                    {type: CardType.Thief},
                ],
                table_cards: [
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 10},
                    {type: CardType.Normal, suit: Suit.Clubs, value: 11},
                    {type: CardType.Normal, suit: Suit.Hearts, value: 12},
                    {type: CardType.Normal, suit: Suit.Hearts, value: Card.AceValue},
                    {type: CardType.Normal, suit: Suit.Diamonds, value: Card.AceValue},
                ],
                current_player: 0,
                boards: empty_boards,
                num_players: 2,
            };
            let state = TicTacToePokerGameState.from_object(obj);

            // Player 0
            // Deck: J T
            // Table: dJ cQ hK hA dA
            // Move: play hA from the table onto (1, 1)
            assert.equal(state.get_current_player(), 0);
            assert.equal(state.apply_move(new PlayNormalCard(0, 3, 1, 1)), "");
            assert.deepEqual(state.get_board(0).get_card(1, 1),
                             Card.create_normal(Suit.Hearts, Card.AceValue));
            // Check table card was replaced
            assert.deepEqual(state.get_table_cards()[3], Card.create_special(CardType.Joker));
            assert.equal(state.get_score(0), 0);

            // Player 1
            // Deck: T
            // Table: dJ cQ hK J dA
            // Move: play J from the table as hA onto (2, 2)
            assert.equal(state.get_current_player(), 1);
            assert.equal(state.apply_move(
                new PlayJoker(1, 3, 2, 2, Card.create_normal(Suit.Hearts, Card.AceValue))), "");
            assert.deepEqual(state.get_board(1).get_card(2, 2),
                             Card.create_normal(Suit.Hearts, Card.AceValue));
            // Check table card was replaced
            assert.deepEqual(state.get_table_cards()[3],
                             Card.create_special(CardType.Thief));
            assert.equal(state.get_score(1), 0);

            // Player 0
            // Deck: ()
            // Table: dJ cQ hK T dA
            // Illegal move: play T from the table, stealing from player 1 at (1, 1) onto (0, 0)
            assert.equal(state.get_current_player(), 0);
            // Move is illegal since there is no card at (1, 1) on player 1's board
            assert.notEqual(state.apply_move(new PlayThief(0, 3, 0, 0, 1, 1, 1)), "");
            // Illegal move: play T from the table, stealing hA from player 1 at (2, 2) onto (1, 1)
            // Move is illegal since there is already a card at (2, 2) on player 0's board
            assert.notEqual(state.apply_move(new PlayThief(0, 3, 1, 1, 1, 2, 2)), "");
            // Check that the card wasn't stolen
            assert.deepEqual(state.get_board(1).get_card(2, 2),
                             Card.create_normal(Suit.Hearts, Card.AceValue));
            // Move: play T from the table, stealing hA from player 1 at (2, 2) onto (0, 0)
            assert.equal(state.apply_move(new PlayThief(0, 3, 0, 0, 1, 2, 2)), "");
            assert.deepEqual(state.get_board(0).get_card(0, 0),
                             Card.create_normal(Suit.Hearts, Card.AceValue));
            // Check table card is empty (no more cards in deck)
            assert.deepEqual(state.get_table_cards()[3], Card.EMPTY);
            // Player 0 has a pair now: hA hA at (0, 0) and (1, 1)
            assert.equal(state.get_score(0), 113);
        });

        it('no more table cards means game over', () => {
            const obj = {
                deck: [],
                table_cards: [
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 3},
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 4},
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 5},
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 6},
                    {type: CardType.Normal, suit: Suit.Diamonds, value: 7},
                ],
                current_player: 0,
                boards: empty_boards,
                num_players: 2,
            };
            let state = TicTacToePokerGameState.from_object(obj);

            // Play all the cards
            for (let i = 0; i < 5; i++) {
                const row = Math.floor(i/2);
                const col = Math.floor(i/2);
                assert.equal(state.apply_move(
                    new PlayNormalCard(state.get_current_player(), i, row, col)), "");
            }

            // Check that the game is over.
            assert.equal(state.get_status(), TicTacToePokerGameStatus.GameOver);
        });

        it('play normal cards until boards full', () => {
            let state = new TicTacToePokerGameState(2);
            state.start_new_game();

            for (let i = 0; i < 9; i++) {
                for (let p = 0; p < 2; p++) {
                    const row = Math.floor(i / 3);
                    const col = i % 3;

                    // Find a normal card to play
                    for (let t = 0; t < state.get_table_cards().length; t++) {
                        if (!state.get_table_cards()[t].is_normal()) {
                            continue;
                        }
                        assert.equal(state.apply_move(
                            new PlayNormalCard(state.get_current_player(), t, row, col)), "");
                        break;
                    }
                }
            }

            // Check that the game is over.
            assert.equal(state.get_status(), TicTacToePokerGameStatus.GameOver);
        });

        it('skip move', () => {
            const d2 = {type: CardType.Normal, suit: Suit.Diamonds, value: 2};
            const obj = {
                deck: [],
                table_cards: [d2, d2, d2, d2, d2],
                current_player: 0,
                boards: [
                    [[d2, d2, d2], [d2, d2, d2], [d2, ec, ec]],
                    [[d2, d2, d2], [d2, d2, d2], [d2, d2, d2]]
                ],
                num_players: 2,
            };
            let state = TicTacToePokerGameState.from_object(obj);

            // Player 0
            assert.equal(state.get_current_player(), 0);
            assert.equal(state.apply_move(new SkipMove(0)), "");

            // Player 1
            assert.equal(state.get_current_player(), 1);
            assert.equal(state.apply_move(new SkipMove(1)), "");

            // Player 0
            assert.equal(state.get_current_player(), 0);
            assert.equal(state.apply_move(new PlayNormalCard(0, 0, 2, 1)), "");

            // Player 1
            assert.equal(state.get_current_player(), 1);
            assert.equal(state.apply_move(new SkipMove(1)), "");

            // Player 0
            assert.equal(state.get_current_player(), 0);
            assert.equal(state.apply_move(new PlayNormalCard(0, 1, 2, 2)), "");

            // Game should be over now.
            assert.equal(state.get_status(), TicTacToePokerGameStatus.GameOver);
        });


    });
});

describe('tictactoepoker_board', () => {
    it('place_card and remove_card', () => {
        let board = Board.create_empty();

        let d2 = Card.create_normal(Suit.Diamonds, 2);
        let c3 = Card.create_normal(Suit.Clubs, 3);
        let h4 = Card.create_normal(Suit.Hearts, 4);
        let s5 = Card.create_normal(Suit.Spades, 5);
        assert.equal(board.place_card(0, 0, d2), true);
        assert.equal(board.place_card(0, 1, c3), true);
        assert.equal(board.place_card(0, 1, h4), false);
        assert.equal(board.place_card(0, 0, h4), false);

        assert.equal(board.remove_card(2, 2), Card.EMPTY);
        assert.equal(board.remove_card(0, 0), d2);
        assert.equal(board.remove_card(0, 0), Card.EMPTY);
        assert.equal(board.remove_card(0, 1), c3);
        assert.equal(board.remove_card(0, 1), Card.EMPTY);

        assert.equal(board.place_card(0, 0, h4), true);
        assert.equal(board.place_card(0, 0, s5), false);
        assert.equal(board.remove_card(0, 0), h4);
    });


    it('compute_score row', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, 2));
        assert.strictEqual(board.compute_score(), 0);

        // Pair
        board.place_card(0, 1, Card.create_normal(Suit.Hearts, 2));
        assert.strictEqual(board.compute_score(), 102);

        // Three of a kind
        board.place_card(0, 2, Card.create_normal(Suit.Clubs, 2));
        assert.strictEqual(board.compute_score(), 260);
    });

    it('compute_score column', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, 2));
        assert.strictEqual(board.compute_score(), 0);

        // Pair
        board.place_card(1, 0, Card.create_normal(Suit.Hearts, 2));
        assert.strictEqual(board.compute_score(), 102);

        // Three of a kind
        board.place_card(2, 0, Card.create_normal(Suit.Clubs, 2));
        assert.strictEqual(board.compute_score(), 260);
    });

    it('compute_score four corners', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, 2));
        assert.strictEqual(board.compute_score(), 0);
        assert.equal(board.compute_score_with_explanations().explanations.length, 0);

        // One pair: diagonal
        board.place_card(2, 2, Card.create_normal(Suit.Spades, 2));
        assert.strictEqual(board.compute_score(), 102);
        assert.equal(board.compute_score_with_explanations().explanations.length, 1);

        // 3 pairs: row, column, diagonal
        board.place_card(0, 2, Card.create_normal(Suit.Clubs, 2));
        assert.strictEqual(board.compute_score(), 306);
        assert.equal(board.compute_score_with_explanations().explanations.length, 3);

        // 6 pairs: top and bottom row, left and right column, both diagonals
        board.place_card(2, 0, Card.create_normal(Suit.Hearts, 2));
        assert.strictEqual(board.compute_score(), 612);
        assert.equal(board.compute_score_with_explanations().explanations.length, 6);
    });

    it('compute_score straight flush', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, Card.AceValue));
        board.place_card(1, 0, Card.create_normal(Suit.Diamonds, 12));
        board.place_card(2, 0, Card.create_normal(Suit.Diamonds, 11));
        assert.equal(board.compute_score_with_explanations().explanations.length, 1);
        assert.strictEqual(board.compute_score(), 1390);
    });

    it('compute_score flush', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, 3));
        board.place_card(1, 0, Card.create_normal(Suit.Diamonds, 10));
        board.place_card(2, 0, Card.create_normal(Suit.Diamonds, 7));
        assert.equal(board.compute_score_with_explanations().explanations.length, 1);
        assert.strictEqual(board.compute_score(), 900);
    });

    it('compute_score straight ascending', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, 2));
        board.place_card(1, 0, Card.create_normal(Suit.Spades, 3));
        board.place_card(2, 0, Card.create_normal(Suit.Diamonds, 4));
        assert.equal(board.compute_score_with_explanations().explanations.length, 1);
        assert.strictEqual(board.compute_score(), 540);
    });

    it('compute_score straight descending', () => {
        let board = Board.create_empty();

        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, 4));
        board.place_card(1, 0, Card.create_normal(Suit.Spades, 3));
        board.place_card(2, 0, Card.create_normal(Suit.Diamonds, 2));
        assert.equal(board.compute_score_with_explanations().explanations.length, 1);
        assert.strictEqual(board.compute_score(), 540);
    });


    it('compute_score with aces', () => {
        let board = Board.create_empty();

        // Straight: A23
        board.place_card(0, 0, Card.create_normal(Suit.Diamonds, Card.AceValue));
        board.place_card(0, 1, Card.create_normal(Suit.Spades, 2));
        board.place_card(0, 2, Card.create_normal(Suit.Diamonds, 3));
        assert.equal(board.compute_score_with_explanations().explanations.length, 1);
        assert.strictEqual(board.compute_score(), 530);

        // Another straight: AKQ down the column
        board.place_card(1, 0, Card.create_normal(Suit.Spades, 12));
        board.place_card(2, 0, Card.create_normal(Suit.Diamonds, 11));
        assert.equal(board.compute_score_with_explanations().explanations.length, 2);
        assert.strictEqual(board.compute_score(), 530 + 630);

        // Another straight: A23 across the diagonal
        // This also makes two pairs.
        // A23
        // K2
        // Q 3
        board.place_card(1, 1, Card.create_normal(Suit.Hearts, 2));
        board.place_card(2, 2, Card.create_normal(Suit.Clubs, 3));
        assert.equal(board.compute_score_with_explanations().explanations.length, 5);
        assert.strictEqual(board.compute_score(), 530 + 630 + 530 + 102 + 103);
    });

});
