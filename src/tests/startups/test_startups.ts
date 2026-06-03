/**
 * test_startups.ts - Comprehensive unit tests for Startups game logic
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { StartupsGameState as GameState, GameStatus, Company } from '../../rules/startups/StartupsGameState';

describe('Startups Game Logic', () => {
    describe('Initialization & Setup', () => {
        it('should initialize a 3-player game correctly', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const data = game.get_data();
            assert.equal(data.status, GameStatus.ActionPhase);
            assert.equal(data.currentPlayerIndex, 0);
            assert.equal(data.deck.length, 45 - (3 * 3) - 5); // 45 - 9 - 5 = 31 cards
            assert.equal(data.removedCards.length, 5);
            assert.equal(data.market.length, 0);

            for (const id of players) {
                const pState = data.players[id];
                assert.equal(pState.id, id);
                assert.equal(pState.hand.length, 3);
                assert.equal(pState.coins1, 10);
                assert.equal(pState.coins3, 0);
                assert.equal(Object.keys(pState.portfolio).length, 0);
            }
        });
    });

    describe('Core Turn Actions', () => {
        it('should draw a card and increase hand size to 4', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const deckCountBefore = game.get_data().deck.length;
            game.draw_from_deck('alice');

            const data = game.get_data();
            assert.equal(data.status, GameStatus.DiscardOrInvestPhase);
            assert.equal(data.players['alice'].hand.length, 4);
            assert.equal(data.deck.length, deckCountBefore - 1);
        });

        it('should fail if a player tries to play out of turn', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            assert.throws(() => game.draw_from_deck('bob'), /It is not bob's turn/);
        });

        it('should invest a card and return hand size to 3', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            game.draw_from_deck('alice');
            const hand = game.get_data().players['alice'].hand;
            const investCompany = hand[0];

            game.invest_card('alice', investCompany);

            const data = game.get_data();
            assert.equal(data.status, GameStatus.ActionPhase);
            assert.equal(data.currentPlayerIndex, 1); // Bob's turn
            assert.equal(data.players['alice'].hand.length, 3);
            assert.equal(data.players['alice'].portfolio[investCompany], 1);
        });

        it('should discard a card and add it to the market', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            game.draw_from_deck('alice');
            const hand = game.get_data().players['alice'].hand;
            const discardCompany = hand[0];

            game.discard_card('alice', discardCompany);

            const data = game.get_data();
            assert.equal(data.status, GameStatus.ActionPhase);
            assert.equal(data.players['alice'].hand.length, 3);
            assert.equal(data.market.length, 1);
            assert.equal(data.market[0].company, discardCompany);
            assert.equal(data.market[0].coins, 0);
        });
    });

    describe('Anti-Monopoly and Market Restrictions', () => {
        it('should assign Anti-Monopoly token to player with strict majority', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            // Setup a custom portfolio where Alice has majority of Giraffe
            const data = game.get_data();
            data.players['alice'].portfolio[Company.Giraffe] = 2;
            data.players['bob'].portfolio[Company.Giraffe] = 1;
            data.players['alice'].hand = [Company.Bowwow]; // Give Alice a card to invest
            data.status = GameStatus.DiscardOrInvestPhase;
            data.currentPlayerIndex = 0; // Alice's turn

            const customGame = GameState.from_data(data, players);
            // Trigger invest_card which runs reassignment
            customGame.invest_card('alice', Company.Bowwow);

            assert.equal(customGame.get_data().antiMonopolyTokens[Company.Giraffe], 'alice');
        });

        it('should return Anti-Monopoly token to center if there is a tie', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            // Setup a custom portfolio where Alice has Giraffe=2, Bob has Giraffe=1 (Alice has token)
            // Then it is Bob's turn to invest Giraffe to tie Alice
            const data = game.get_data();
            data.players['alice'].portfolio[Company.Giraffe] = 2;
            data.players['bob'].portfolio[Company.Giraffe] = 1;
            data.antiMonopolyTokens[Company.Giraffe] = 'alice';
            data.players['bob'].hand = [Company.Giraffe];
            data.status = GameStatus.DiscardOrInvestPhase;
            data.currentPlayerIndex = 1; // Bob's turn!

            const customGame = GameState.from_data(data, players);
            customGame.invest_card('bob', Company.Giraffe);

            assert.equal(customGame.get_data().antiMonopolyTokens[Company.Giraffe], null);
        });

        it('should prevent token holder from taking company cards from market', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            // Alice holds the Giraffe token
            const data = game.get_data();
            data.players['alice'].portfolio[Company.Giraffe] = 2;
            data.antiMonopolyTokens[Company.Giraffe] = 'alice';
            data.market.push({ id: 'card1', company: Company.Giraffe, coins: 0 });
            data.status = GameStatus.ActionPhase;
            data.currentPlayerIndex = 0; // Alice's turn

            const customGame = GameState.from_data(data, players);

            assert.throws(() => customGame.take_from_market('alice', 'card1'), /Cannot take card from company you hold Anti-Monopoly token for/);
        });

        it('should exempt token holder from paying into market when drawing', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            // Alice holds the Giraffe token
            const data = game.get_data();
            data.players['alice'].portfolio[Company.Giraffe] = 2;
            data.antiMonopolyTokens[Company.Giraffe] = 'alice';
            data.players['alice'].coins1 = 10;
            data.market.push({ id: 'card1', company: Company.Giraffe, coins: 0 });
            data.market.push({ id: 'card2', company: Company.Bowwow, coins: 0 });
            data.status = GameStatus.ActionPhase;
            data.currentPlayerIndex = 0; // Alice's turn

            const customGame = GameState.from_data(data, players);

            // Alice draws. She should only pay for Bowwow, not Giraffe
            customGame.draw_from_deck('alice');

            const updatedData = customGame.get_data();
            assert.equal(updatedData.players['alice'].coins1, 9); // paid only 1 coin instead of 2
            assert.equal(updatedData.market.find(c => c.id === 'card1')!.coins, 0); // giraffe card received 0 coins
            assert.equal(updatedData.market.find(c => c.id === 'card2')!.coins, 1); // bowwow card received 1 coin
        });
    });

    describe('Same-Company Discard Restriction', () => {
        it('should prevent discarding the same company just taken from market', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const data = game.get_data();
            data.market.push({ id: 'card1', company: Company.Giraffe, coins: 2 });
            const customGame = GameState.from_data(data, players);

            // Alice takes Giraffe card
            customGame.take_from_market('alice', 'card1');

            // Trying to immediately discard Giraffe should fail
            assert.throws(() => customGame.discard_card('alice', Company.Giraffe), /Illegal move: Cannot immediately discard/);

            // Investing it or discarding a different card is allowed
            const differentCompany = customGame.get_data().players['alice'].hand.find(c => c !== Company.Giraffe)!;
            customGame.discard_card('alice', differentCompany); // should pass
        });
    });

    describe('Scoring & Payout Algorithms', () => {
        it('should skip payout if there is a tie for company majority', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const data = game.get_data();
            data.status = GameStatus.ScoringPhase;
            data.scoringCompanyIndex = 0; // Giraffe Beer
            data.players['alice'].portfolio[Company.Giraffe] = 2;
            data.players['bob'].portfolio[Company.Giraffe] = 2;
            data.players['charlie'].portfolio[Company.Giraffe] = 1;

            const customGame = GameState.from_data(data, players);
            customGame.next_scoring_company();

            const updatedData = customGame.get_data();
            // Coins should remain unchanged (setup has 10 coins each)
            assert.equal(updatedData.players['alice'].coins1, 10);
            assert.equal(updatedData.players['bob'].coins1, 10);
            assert.equal(updatedData.players['charlie'].coins1, 10);
            assert(updatedData.scoringLogs[0].includes('Tie for majority'));
        });

        it('should pay majority shareholder correctly (simple coins1 transfer)', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const data = game.get_data();
            data.status = GameStatus.ScoringPhase;
            data.scoringCompanyIndex = 0; // Giraffe
            data.players['alice'].portfolio[Company.Giraffe] = 3; // Majority
            data.players['bob'].portfolio[Company.Giraffe] = 2;   // Owes 2
            data.players['charlie'].portfolio[Company.Giraffe] = 1; // Owes 1

            const customGame = GameState.from_data(data, players);
            customGame.next_scoring_company();

            const updatedData = customGame.get_data();
            // Alice receives: 2 (from Bob) + 1 (from Charlie) = 3 coins showing "3" side
            assert.equal(updatedData.players['alice'].coins3, 3);
            assert.equal(updatedData.players['alice'].coins1, 10); // retains original 10

            // Bob pays 2
            assert.equal(updatedData.players['bob'].coins1, 8);
            assert.equal(updatedData.players['bob'].coins3, 0);

            // Charlie pays 1
            assert.equal(updatedData.players['charlie'].coins1, 9);
        });

        it('should resolve bank backup when payer runs out of coins1 but has coins3', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const data = game.get_data();
            data.status = GameStatus.ScoringPhase;
            data.scoringCompanyIndex = 0; // Giraffe
            data.players['alice'].portfolio[Company.Giraffe] = 3; // Majority
            
            // Bob has no coins1 but has 5 coins3 (flipped from some other majority payout earlier)
            data.players['bob'].coins1 = 0;
            data.players['bob'].coins3 = 5;
            data.players['bob'].portfolio[Company.Giraffe] = 2; // Owes 2

            const customGame = GameState.from_data(data, players);
            customGame.next_scoring_company();

            const updatedData = customGame.get_data();
            // Bob should lose NO coins3
            assert.equal(updatedData.players['bob'].coins1, 0);
            assert.equal(updatedData.players['bob'].coins3, 5);

            // Alice (majority shareholder) should still get paid 2 coins directly from the bank (flipped to "3"-side)
            assert.equal(updatedData.players['alice'].coins3, 2);
        });

        it('should allow bank backup to cover remainder without debt penalty if payer has absolutely zero coins', () => {
            const players = ['alice', 'bob', 'charlie'];
            const game = new GameState(players);
            game.start_game();

            const data = game.get_data();
            data.status = GameStatus.ScoringPhase;
            data.scoringCompanyIndex = 0; // Giraffe
            data.players['alice'].portfolio[Company.Giraffe] = 3; // Majority

            // Bob has absolutely 0 coins
            data.players['bob'].coins1 = 0;
            data.players['bob'].coins3 = 0;
            data.players['bob'].portfolio[Company.Giraffe] = 2; // Owes 2

            const customGame = GameState.from_data(data, players);
            customGame.next_scoring_company();

            const updatedData = customGame.get_data();
            // Bob remains with 0 coins
            assert.equal(updatedData.players['bob'].coins1, 0);
            assert.equal(updatedData.players['bob'].coins3, 0);
            assert.equal((updatedData.players['bob'] as any).debt, undefined);

            // Alice still receives 2 "3"-side coins from the bank
            assert.equal(updatedData.players['alice'].coins3, 2);
        });
    });
});
