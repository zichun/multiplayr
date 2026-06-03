/**
 * test_durian.ts - Comprehensive tests for Durian game logic
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { DurianGameState as GameState, GameStatus, Card } from '../../rules/durian/DurianGameState';

describe('Durian Game Logic', () => {
    describe('DurianGameState class', () => {
        describe('initialization', () => {
            it('should create a game with valid player count', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);

                assert.equal(game.get_data().status, GameStatus.PlayerTurn);
                assert.equal(game.get_data().round, 0);
                assert.equal(game.get_data().players['alice'].points, 0);
                assert.equal(game.get_data().players['bob'].points, 0);
                assert.equal(game.get_data().players['charlie'].points, 0);
                assert.equal(game.get_data().currentPlayerId, 'alice');
            });
        });

        describe('game flow - start game & draw fruit card & place order', () => {
            it('should start game, deal cards, allow drawing and placing fruit orders', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);

                game.start_game();

                const data = game.get_data();
                assert.equal(data.status, GameStatus.PlayerTurn);
                assert.ok(data.players['alice'].inventoryCard);
                assert.ok(data.players['bob'].inventoryCard);
                assert.ok(data.players['charlie'].inventoryCard);
                assert.equal(data.deck.length, 25); // 28 total minus 3 dealt to players

                // Alice draws a card
                game.draw_card('alice');
                assert.equal(game.get_data().status, GameStatus.CardDrawn);
                assert.ok(game.get_data().drawnCard);

                // Set drawn card to a known fruit card manually to test order placement
                const mockFruitCard: Card = {
                    id: 99,
                    type: 'fruit',
                    sideA: { fruit: 'banana', count: 2 },
                    sideB: { fruit: 'grape', count: 1 }
                };
                game.get_data().drawnCard = mockFruitCard;

                // Alice chooses side A (2 bananas)
                game.submit_order('alice', 'A');

                const postOrderData = game.get_data();
                assert.equal(postOrderData.status, GameStatus.PlayerTurn);
                assert.equal(postOrderData.currentPlayerId, 'bob', 'Turn should advance to bob');
                assert.equal(postOrderData.orders.length, 1);
                assert.equal(postOrderData.orders[0].fruit, 'banana');
                assert.equal(postOrderData.orders[0].count, 2);
                assert.equal(postOrderData.lastPlayerId, 'alice', 'Alice was the last to place an order');
            });
        });

        describe('game flow - turn-1 bell protection', () => {
            it('should not allow ringing the bell on the first turn of the round (when orders.length === 0)', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game();

                assert.equal(game.get_data().orders.length, 0);

                // Ringing the bell should throw an error
                assert.throws(() => {
                    game.ring_bell('alice');
                }, /Cannot ring bell on the first turn of the round/);
            });
        });

        describe('manager resolution - successful bell ring (orders exceed inventory)', () => {
            it('should penalize previous player if orders exceed double-sided inventory when bell is rung', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game();

                // Force specific inventory cards
                // Alice: 1 banana, 2 grapes
                // Bob: 1 grape, 2 bananas
                // Charlie: 1 strawberry, 2 durians
                game.get_data().players['alice'].inventoryCard = {
                    id: 1,
                    type: 'fruit',
                    sideA: { fruit: 'banana', count: 1 },
                    sideB: { fruit: 'grape', count: 2 }
                };
                game.get_data().players['bob'].inventoryCard = {
                    id: 2,
                    type: 'fruit',
                    sideA: { fruit: 'grape', count: 1 },
                    sideB: { fruit: 'banana', count: 2 }
                };
                game.get_data().players['charlie'].inventoryCard = {
                    id: 3,
                    type: 'fruit',
                    sideA: { fruit: 'strawberry', count: 1 },
                    sideB: { fruit: 'durian', count: 2 }
                };

                // Place order of 4 Grapes (last placed by Alice)
                // Grapes in stock: Alice (2) + Bob (1) + Charlie (0) = 3 Grapes.
                // Orders (4 Grapes) > Stock (3 Grapes), so orders exceed inventory.
                game.get_data().orders = [
                    {
                        cardId: 10,
                        fruit: 'grape',
                        count: 4,
                        flipped: false
                    }
                ];
                game.get_data().lastPlayerId = 'alice';
                game.get_data().currentPlayerId = 'bob';

                // Bob rings the bell
                game.ring_bell('bob');

                const data = game.get_data();
                assert.equal(data.status, GameStatus.ManagerResolution);
                assert.ok(data.resolutionDetails);
                assert.equal(data.resolutionDetails.success, false, 'Orders exceed inventory, so success is false');
                assert.equal(data.resolutionDetails.penalizedPlayerId, 'alice', 'Previous player Alice should be penalized');
                assert.equal(data.resolutionDetails.penaltyAmount, 1);
                assert.equal(data.players['alice'].points, 1);
            });
        });

        describe('manager resolution - unsuccessful bell ring (orders do NOT exceed)', () => {
            it('should penalize bell ringer if orders do not exceed double-sided inventory', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game();

                // Force specific inventory cards
                // Alice: 1 banana, 2 grapes
                // Bob: 1 grape, 2 bananas
                // Charlie: 1 strawberry, 2 durians
                game.get_data().players['alice'].inventoryCard = {
                    id: 1,
                    type: 'fruit',
                    sideA: { fruit: 'banana', count: 1 },
                    sideB: { fruit: 'grape', count: 2 }
                };
                game.get_data().players['bob'].inventoryCard = {
                    id: 2,
                    type: 'fruit',
                    sideA: { fruit: 'grape', count: 1 },
                    sideB: { fruit: 'banana', count: 2 }
                };
                game.get_data().players['charlie'].inventoryCard = {
                    id: 3,
                    type: 'fruit',
                    sideA: { fruit: 'strawberry', count: 1 },
                    sideB: { fruit: 'durian', count: 2 }
                };

                // Place order of 3 Bananas (last placed by Alice)
                // Bananas in stock: Alice (1) + Bob (2) + Charlie (0) = 3 Bananas.
                // Orders (3 Bananas) == Stock (3 Bananas), so orders do NOT exceed.
                game.get_data().orders = [
                    {
                        cardId: 10,
                        fruit: 'banana',
                        count: 3,
                        flipped: false
                    }
                ];
                game.get_data().lastPlayerId = 'alice';
                game.get_data().currentPlayerId = 'bob';

                // Bob rings the bell
                game.ring_bell('bob');

                const data = game.get_data();
                assert.equal(data.status, GameStatus.ManagerResolution);
                assert.ok(data.resolutionDetails);
                assert.equal(data.resolutionDetails.success, true, 'Orders do NOT exceed inventory');
                assert.equal(data.resolutionDetails.penalizedPlayerId, 'bob', 'Bell ringer Bob should be penalized');
                assert.equal(data.players['bob'].points, 1);
            });
        });

        describe('double-sided inventory stock tallying', () => {
            it('should sum up both sides of every player stand card during verification', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game();

                // Set inventory cards
                // Alice: Side A (banana: 1), Side B (durian: 3)
                // Bob: Side A (durian: 1), Side B (banana: 2)
                game.get_data().players['alice'].inventoryCard = {
                    id: 1,
                    type: 'fruit',
                    sideA: { fruit: 'banana', count: 1 },
                    sideB: { fruit: 'durian', count: 3 }
                };
                game.get_data().players['bob'].inventoryCard = {
                    id: 2,
                    type: 'fruit',
                    sideA: { fruit: 'durian', count: 1 },
                    sideB: { fruit: 'banana', count: 2 }
                };

                // Orders: 3 durians
                game.get_data().orders = [
                    { cardId: 100, fruit: 'durian', count: 3, flipped: false }
                ];
                game.get_data().lastPlayerId = 'alice';
                game.get_data().currentPlayerId = 'bob';

                // Bob rings the bell
                game.ring_bell('bob');

                const data = game.get_data();
                assert.ok(data.resolutionDetails);
                // Total durian: Alice's Side B (3) + Bob's Side A (1) = 4
                assert.equal(data.resolutionDetails.inventoryTotal['durian'], 4);
                // Total banana: Alice's Side A (1) + Bob's Side B (2) = 3
                assert.equal(data.resolutionDetails.inventoryTotal['banana'], 3);
                
                // 3 durians ordered <= 4 durians in stock, so it's a successful verification (bell ringer penalized)
                assert.equal(data.resolutionDetails.success, true);
                assert.equal(data.resolutionDetails.penalizedPlayerId, 'bob');
            });
        });

        describe('game end removal', () => {
            it('should NOT transition status to GameOver when a player reaches 7 points', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game();

                // Bob is at 6 points
                game.get_data().players['bob'].points = 6;

                // Force empty inventory and exceed order to trigger Bob getting penalty
                game.get_data().players['alice'].inventoryCard = {
                    id: 1,
                    type: 'fruit',
                    sideA: { fruit: 'durian', count: 1 },
                    sideB: { fruit: 'banana', count: 2 }
                };
                game.get_data().players['bob'].inventoryCard = {
                    id: 2,
                    type: 'fruit',
                    sideA: { fruit: 'durian', count: 1 },
                    sideB: { fruit: 'banana', count: 2 }
                };
                
                // Orders: 3 durians. Stock: Alice (1) + Bob (1) = 2 durians.
                game.get_data().orders = [{ cardId: 10, fruit: 'durian', count: 3, flipped: false }];
                game.get_data().lastPlayerId = 'bob';
                game.get_data().currentPlayerId = 'alice';

                // Alice rings the bell. Bob gets penalized (last order) with 1 point.
                game.ring_bell('alice');

                const data = game.get_data();
                assert.equal(data.status, GameStatus.ManagerResolution, 'Game should stay in ManagerResolution, not GameOver');
                assert.equal(data.players['bob'].points, 7, 'Bob should reach exactly 7 points');
            });
        });

        describe('starting player rotation', () => {
            it('should rotate starting player between rounds', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                
                // Round 0
                game.start_game();
                assert.equal(game.get_data().round, 0);
                assert.equal(game.get_data().currentPlayerId, 'alice', 'Round 0 should start with alice');

                // Advance to round 1
                game.get_data().status = GameStatus.ManagerResolution; // Mock resolution phase to allow next round
                game.next_round();
                assert.equal(game.get_data().round, 1);
                assert.equal(game.get_data().currentPlayerId, 'bob', 'Round 1 should start with bob');

                // Advance to round 2
                game.get_data().status = GameStatus.ManagerResolution;
                game.next_round();
                assert.equal(game.get_data().round, 2);
                assert.equal(game.get_data().currentPlayerId, 'charlie', 'Round 2 should start with charlie');

                // Advance to round 3 (loops back to alice)
                game.get_data().status = GameStatus.ManagerResolution;
                game.next_round();
                assert.equal(game.get_data().round, 3);
                assert.equal(game.get_data().currentPlayerId, 'alice', 'Round 3 should wrap around to alice');
            });
        });
    });
});
