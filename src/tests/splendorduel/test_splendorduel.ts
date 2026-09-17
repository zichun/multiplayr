/**
 * test_splendorduel.ts - Comprehensive tests for Splendor Duel
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { SplendorDuelGameState as GameState, GameStatus, TokenColor, Card, RoyalCard } from '../../rules/splendorduel/SplendorDuelGameState';
import { GameRuleTest } from '../GameRuleTest';

describe('Splendor Duel Game Logic', () => {
    describe('Type A: SplendorDuelGameState Unit Tests', () => {
        describe('Setup and Deal', () => {
            it('should initialize player hands, privileges, deal pyramid, and fill the board', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                assert.strictEqual(data.status, GameStatus.Active);
                assert.strictEqual(data.currentPlayerId, 'alice');
                
                // Privilege asymmetry: opponent Bob starts with 1 scroll
                assert.strictEqual(data.players['alice'].privileges, 0);
                assert.strictEqual(data.players['bob'].privileges, 1);
                assert.strictEqual(data.privilegesAboveBoard, 2);

                // Board must be fully filled with 25 tokens, bag is empty
                let boardTokenCount = 0;
                let boardGoldCount = 0;
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        const t = data.board[r][c];
                        if (t) {
                            boardTokenCount++;
                            if (t === 'gold') boardGoldCount++;
                        }
                    }
                }
                assert.strictEqual(boardTokenCount, 25);
                assert.strictEqual(boardGoldCount, 3);
                assert.strictEqual(data.bag.length, 0);

                // Pyramid has correct number of cards dealt
                assert.strictEqual(data.pyramid[1].length, 5);
                assert.strictEqual(data.pyramid[2].length, 4);
                assert.strictEqual(data.pyramid[3].length, 3);

                // Royals pool has 4 cards
                assert.strictEqual(data.royalsPool.length, 4);
            });
        });

        describe('Action A - Take Tokens and Line Adjacency', () => {
            it('should allow taking 1 token, or 2-3 adjacent tokens in a straight line', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Force board state for testing
                const data = game.get_data();
                // (0,0) is blue, (0,1) is white, (0,2) is green, (0,3) is red, (0,4) is black
                data.board[0][0] = 'blue';
                data.board[0][1] = 'white';
                data.board[0][2] = 'green';
                data.board[0][3] = 'red';
                data.board[0][4] = 'gold'; // Gold breaks a line!
                
                data.board[1][1] = 'pearl';
                data.board[2][2] = 'pearl'; // Diagonal line: (0,0), (1,1), (2,2)

                const mockedGame = GameState.from_data(data, players);

                // 1. Take a single token (0,0)
                mockedGame.take_tokens('alice', [[0, 0]]);
                let nextData = mockedGame.get_data();
                assert.strictEqual(nextData.players['alice'].tokens.blue, 1);
                assert.strictEqual(nextData.board[0][0], null);
                assert.strictEqual(nextData.currentPlayerId, 'bob', 'Turn should pass to Bob');

                // Pass turn back to Alice (Bob takes (0,3) to pass)
                mockedGame.take_tokens('bob', [[0, 3]]);
                
                // 2. Alice takes a horizontal line of 2 tokens: (0,1), (0,2)
                mockedGame.take_tokens('alice', [[0, 1], [0, 2]]);
                nextData = mockedGame.get_data();
                assert.strictEqual(nextData.players['alice'].tokens.white, 1);
                assert.strictEqual(nextData.players['alice'].tokens.green, 1);
                assert.strictEqual(nextData.board[0][1], null);
                assert.strictEqual(nextData.board[0][2], null);
            });

            it('should enforce line validation: prevent non-adjacent and gold takes', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.board[0][0] = 'blue';
                data.board[0][1] = 'white';
                data.board[0][2] = null; // empty cell
                data.board[0][3] = 'green';
                data.board[0][4] = 'gold';

                const mockedGame = GameState.from_data(data, players);

                // Cannot take a line containing empty cell (gap)
                assert.throws(() => {
                    mockedGame.take_tokens('alice', [[0, 0], [0, 1], [0, 3]]);
                }, /Tokens must be adjacent|straight line/);

                // Cannot take Gold token
                assert.throws(() => {
                    mockedGame.take_tokens('alice', [[0, 4]]);
                }, /Cannot take Gold/);
            });

            it('should trigger opponent-privilege when taking 3 same-colored or 2 pearls', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.board[0][0] = 'pearl';
                data.board[0][1] = 'pearl';
                data.board[1][0] = 'blue';
                data.board[1][1] = 'blue';
                data.board[1][2] = 'blue';
                data.board[2][0] = 'green';
                data.players['bob'].privileges = 0;
                data.privilegesAboveBoard = 3;

                const mockedGame = GameState.from_data(data, players);

                // Alice takes 2 pearls -> Bob gets a Privilege
                mockedGame.take_tokens('alice', [[0, 0], [0, 1]]);
                let nextData = mockedGame.get_data();
                assert.strictEqual(nextData.players['bob'].privileges, 1, 'Bob should get 1 privilege penalty');
                assert.strictEqual(nextData.privilegesAboveBoard, 2);

                // Pass turn back to Alice
                mockedGame.take_tokens('bob', [[2, 0]]);

                // Alice takes 3 same-colored blue gems -> Bob gets another Privilege
                mockedGame.take_tokens('alice', [[1, 0], [1, 1], [1, 2]]);
                nextData = mockedGame.get_data();
                assert.strictEqual(nextData.players['bob'].privileges, 2, 'Bob should get another privilege penalty');
            });
        });

        describe('Action C - Purchase Card, Cost Discounts & Gold Auto-spending', () => {
            it('should calculate cost correctly and auto-spend Gold for deficits', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Setup Alice hand
                data.players['alice'].tokens = {
                    blue: 1, white: 1, green: 0, black: 0, red: 0, pearl: 1, gold: 2
                };
                
                // Add cards to Alice for discount: 1 blue card providing 1 blue bonus
                const blueBonusCard: Card = {
                    id: 'MOCK-BLUE-BONUS',
                    level: 1,
                    color: 'blue',
                    points: 0,
                    crowns: 0,
                    bonus_color: 'blue',
                    bonus_count: 1,
                    ability: null,
                    cost: {}
                };
                data.players['alice'].cards.push(blueBonusCard);

                // Jewel card cost: 2 blue, 1 white, 1 pearl
                const targetCard: Card = {
                    id: 'TARGET-CARD',
                    level: 1,
                    color: 'red',
                    points: 1,
                    crowns: 0,
                    bonus_color: 'red',
                    bonus_count: 1,
                    ability: null,
                    cost: { blue: 2, white: 1, pearl: 1 }
                };
                data.pyramid[1][0] = targetCard;

                const mockedGame = GameState.from_data(data, players);

                // Purchase!
                // Cost breakdown:
                // - blue: 2 required, 1 discount = 1 effective. Alice has 1 blue -> pays 1 blue. Deficit = 0.
                // - white: 1 required, 0 discount = 1 effective. Alice has 1 white -> pays 1 white. Deficit = 0.
                // - pearl: 1 required, 0 discount = 1 effective. Alice has 1 pearl -> pays 1 pearl. Deficit = 0.
                // - gold used = 0. Alice has enough tokens!
                mockedGame.purchase_card('alice', 'TARGET-CARD');

                const nextData = mockedGame.get_data();
                const pState = nextData.players['alice'];
                assert.strictEqual(pState.tokens.blue, 0);
                assert.strictEqual(pState.tokens.white, 0);
                assert.strictEqual(pState.tokens.pearl, 0);
                assert.strictEqual(pState.tokens.gold, 2, 'Gold tokens should not be spent');
                assert.strictEqual(pState.cards.length, 2, 'Alice should own 2 cards now');
                assert.ok(pState.cards.some(c => c.id === 'TARGET-CARD'));
            });

            it('should return the correct NUMBER of spent tokens to the bag (regression)', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Alice holds exactly 3 white (diamond) tokens, nothing else
                data.players['alice'].tokens = {
                    blue: 0, white: 3, green: 0, black: 0, red: 0, pearl: 0, gold: 0
                };

                // Card costs 3 white with no matching discount
                const targetCard: Card = {
                    id: 'DIAMOND-3',
                    level: 1,
                    color: 'red',
                    points: 1,
                    crowns: 0,
                    bonus_color: 'red',
                    bonus_count: 1,
                    ability: null,
                    cost: { white: 3 }
                };
                data.pyramid[1][0] = targetCard;

                const bagBefore = data.bag.length;
                const whiteInBagBefore = data.bag.filter((c: TokenColor) => c === 'white').length;

                const mockedGame = GameState.from_data(data, players);
                mockedGame.purchase_card('alice', 'DIAMOND-3');

                const nextData = mockedGame.get_data();
                const whiteInBagAfter = nextData.bag.filter((c: TokenColor) => c === 'white').length;

                assert.strictEqual(nextData.players['alice'].tokens.white, 0, 'All 3 white tokens spent');
                assert.strictEqual(nextData.bag.length, bagBefore + 3, 'Exactly 3 tokens returned to the bag');
                assert.strictEqual(whiteInBagAfter, whiteInBagBefore + 3, 'All 3 spent whites returned to the bag');
            });

            it('should auto-spend Gold when player has deficit', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Setup Alice hand: only has 1 Gold, 0 gems!
                data.players['alice'].tokens = {
                    blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 1
                };

                // Jewel card cost: 1 red
                const targetCard: Card = {
                    id: 'TARGET-CARD',
                    level: 1,
                    color: 'red',
                    points: 1,
                    crowns: 0,
                    bonus_color: 'red',
                    bonus_count: 1,
                    ability: null,
                    cost: { red: 1 }
                };
                data.pyramid[1][0] = targetCard;

                const mockedGame = GameState.from_data(data, players);

                // Purchase using Gold!
                mockedGame.purchase_card('alice', 'TARGET-CARD');

                const nextData = mockedGame.get_data();
                const pState = nextData.players['alice'];
                assert.strictEqual(pState.tokens.gold, 0, 'Gold should be spent');
                assert.strictEqual(pState.tokens.red, 0);
                assert.strictEqual(pState.cards.length, 1);
            });

            it('should block purchase if player cannot afford it', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.players['alice'].tokens = {
                    blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 0
                };
                const targetCard: Card = {
                    id: 'TARGET-CARD',
                    level: 1,
                    color: 'red',
                    points: 1,
                    crowns: 0,
                    bonus_color: 'red',
                    bonus_count: 1,
                    ability: null,
                    cost: { red: 1 }
                };
                data.pyramid[1][0] = targetCard;

                const mockedGame = GameState.from_data(data, players);

                assert.throws(() => {
                    mockedGame.purchase_card('alice', 'TARGET-CARD');
                }, /cannot afford/);
            });
        });

        describe('Card Abilities & Milestones', () => {
            it('should trigger Extra Turn ability', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.players['alice'].tokens = { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 1 };
                const extraTurnCard: Card = {
                    id: 'EXTRA-TURN-CARD',
                    level: 1,
                    color: 'blue',
                    points: 0,
                    crowns: 0,
                    bonus_color: 'blue',
                    bonus_count: 1,
                    ability: 'extra_turn',
                    cost: { gold: 1 } // cheap mock
                };
                data.pyramid[1][0] = extraTurnCard;

                const mockedGame = GameState.from_data(data, players);
                mockedGame.purchase_card('alice', 'EXTRA-TURN-CARD');

                const nextData = mockedGame.get_data();
                // Turn should NOT pass to Bob because of extra turn!
                assert.strictEqual(nextData.currentPlayerId, 'alice');
            });

            it('should trigger crown crossings milestone and allow claiming a Royal card', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Setup Alice: 2 crowns already, has 1 Gold
                data.players['alice'].tokens = { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 1 };
                const c1: Card = {
                    id: 'C1', level: 1, color: 'blue', points: 0, crowns: 1, bonus_color: 'blue', bonus_count: 1, ability: null, cost: {}
                };
                const c2: Card = {
                    id: 'C2', level: 1, color: 'blue', points: 0, crowns: 1, bonus_color: 'blue', bonus_count: 1, ability: null, cost: {}
                };
                data.players['alice'].cards = [c1, c2]; // 2 crowns total

                // Buy a card that has 1 crown (total -> 3 crowns!)
                const crown3Card: Card = {
                    id: 'CROWN-3',
                    level: 1,
                    color: 'red',
                    points: 0,
                    crowns: 1,
                    bonus_color: 'red',
                    bonus_count: 1,
                    ability: null,
                    cost: { gold: 1 }
                };
                data.pyramid[1][0] = crown3Card;
                // Mock royalsPool to be deterministic (use R-4 which has no ability)
                data.royalsPool = [{ id: 'R-4', points: 3, ability: null }];

                const mockedGame = GameState.from_data(data, players);
                mockedGame.purchase_card('alice', 'CROWN-3');

                let nextData = mockedGame.get_data();
                // Alice crossed 3rd crown milestone! Phase should become PendingRoyal
                assert.strictEqual(nextData.status, GameStatus.PendingRoyal);
                assert.strictEqual(nextData.actionPhase, 'SelectRoyal');
                assert.strictEqual(nextData.pendingRoyalCount, 1);
                assert.strictEqual(nextData.players['alice'].crossed3rd, true);

                // Alice chooses the first Royal card from the pool
                const targetRoyalId = nextData.royalsPool[0].id;
                mockedGame.select_royal('alice', targetRoyalId);

                nextData = mockedGame.get_data();
                // Royal selection finished, status returns to active, turn passes to Bob
                assert.strictEqual(nextData.status, GameStatus.Active);
                assert.strictEqual(nextData.actionPhase, 'Normal');
                assert.strictEqual(nextData.players['alice'].royals.length, 1);
                assert.strictEqual(nextData.players['alice'].royals[0].id, targetRoyalId);
                assert.strictEqual(nextData.currentPlayerId, 'bob');
            });
        });

        describe('Victory Conditions', () => {
            it('should detect 20+ prestige points victory', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Mock Alice with 20 points card
                const megaCard: Card = {
                    id: 'MEGA', level: 3, color: 'blue', points: 20, crowns: 0, bonus_color: 'blue', bonus_count: 1, ability: null, cost: {}
                };
                data.players['alice'].cards = [megaCard];
                data.players['alice'].tokens = { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 1 };
                
                // Alice buys a cheap card to trigger end of turn victory check
                const cheap: Card = {
                    id: 'CHEAP', level: 1, color: 'red', points: 0, crowns: 0, bonus_color: 'red', bonus_count: 1, ability: null, cost: { gold: 1 }
                };
                data.pyramid[1][0] = cheap;

                const mockedGame = GameState.from_data(data, players);
                mockedGame.purchase_card('alice', 'CHEAP');

                const nextData = mockedGame.get_data();
                assert.strictEqual(nextData.status, GameStatus.GameOver);
                assert.strictEqual(nextData.winnerId, 'alice');
            });

            it('should detect 10+ crowns victory', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Alice has 9 crowns
                data.players['alice'].crossed3rd = true;
                data.players['alice'].crossed6th = true;
                data.players['alice'].tokens = { blue: 0, white: 0, green: 0, black: 0, red: 0, pearl: 0, gold: 1 };
                const crownCard: Card = {
                    id: 'CROWNS-9', level: 3, color: 'blue', points: 0, crowns: 9, bonus_color: 'blue', bonus_count: 1, ability: null, cost: {}
                };
                data.players['alice'].cards = [crownCard];

                // Alice buys card with 1 crown -> total 10 crowns
                const cheap: Card = {
                    id: 'CHEAP', level: 1, color: 'red', points: 0, crowns: 1, bonus_color: 'red', bonus_count: 1, ability: null, cost: { gold: 1 }
                };
                data.pyramid[1][0] = cheap;

                const mockedGame = GameState.from_data(data, players);
                mockedGame.purchase_card('alice', 'CHEAP');

                const nextData = mockedGame.get_data();
                assert.strictEqual(nextData.status, GameStatus.GameOver);
                assert.strictEqual(nextData.winnerId, 'alice');
            });
        });
    });

    describe('Type B: SplendorDuel Integration Tests (Multiplayr Room Simulation)', () => {
        it('should execute full turn cycle: take tokens, reserve, buy', () => {
            const dueltest = new GameRuleTest('splendorduel', 1); // 2 players total: Host (0) and Client (1)

            // 1. Start Game
            dueltest.invokeHostMethod('startGame');
            
            const state = dueltest.getHostData('gameState');
            const p0 = state.playerIds[0]; // Host ID
            const p1 = dueltest.getPlayerClientId(0); // Client ID

            // Active player at start
            const activeId = state.data.currentPlayerId;
            const passiveId = activeId === p0 ? p1 : p0;

            // Find a valid cell containing a token
            const board = state.data.board;
            let validCoord: [number, number] | null = null;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (board[r][c] && board[r][c] !== 'gold') {
                        validCoord = [r, c];
                        break;
                    }
                }
                if (validCoord) break;
            }

            assert.ok(validCoord, 'Should find at least one valid token on the board');

            // 2. Active player takes a token
            if (activeId === p0) {
                dueltest.invokeHostMethod('takeTokens', [validCoord]);
            } else {
                dueltest.invokeClientMethod(0, 'takeTokens', [validCoord]);
            }

            // Turn should swap to the other player
            const nextState = dueltest.getHostData('gameState');
            assert.strictEqual(nextState.data.currentPlayerId, passiveId, 'Turn should pass to the other player');
        });
    });
});
