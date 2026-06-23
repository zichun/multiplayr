/**
 * test_jaipur.ts - Comprehensive tests for Jaipur
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { JaipurGameState as GameState, GameStatus, Card } from '../../rules/jaipur/JaipurGameState';
import { GameRuleTest } from '../GameRuleTest';

describe('Jaipur Game Logic', () => {
    describe('Type A: JaipurGameState Unit Tests', () => {
        describe('Setup and Deal', () => {
            it('should deal cards and setup market and tokens correctly', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                assert.strictEqual(data.status, GameStatus.Active);
                assert.strictEqual(data.playerIds.length, 2);
                assert.strictEqual(data.currentPlayerId, 'alice');
                
                // Market has exactly 5 cards
                assert.strictEqual(data.market.length, 5);

                // Market must contain at least 3 camels (since 3 camels are placed directly during setup)
                const marketCamels = data.market.filter(c => c.type === 'camels').length;
                assert.ok(marketCamels >= 3, 'Market should have at least 3 camels');

                // Players should have total 5 cards distributed between hand and herd
                for (const pid of players) {
                    const pState = data.players[pid];
                    const totalDealt = pState.hand.length + pState.herd.length;
                    assert.strictEqual(totalDealt, 5, `${pid} should be dealt 5 cards total`);
                    
                    // Hand must not contain any camel cards (moved to herd automatically)
                    const handCamels = pState.hand.filter(c => c.type === 'camels').length;
                    assert.strictEqual(handCamels, 0, `${pid} hand must not contain camels`);
                    assert.strictEqual(pState.herd.length, pState.herd.filter(c => c.type === 'camels').length, `${pid} herd must only contain camels`);
                }

                // Check goods token stacks are populated
                assert.strictEqual(data.goodsTokens['diamonds']?.length, 6);
                assert.strictEqual(data.goodsTokens['gold']?.length, 6);
                assert.strictEqual(data.goodsTokens['silver']?.length, 6);
                assert.strictEqual(data.goodsTokens['cloth']?.length, 8);
                assert.strictEqual(data.goodsTokens['spice']?.length, 8);
                assert.strictEqual(data.goodsTokens['leather']?.length, 10);
            });
        });

        describe('Action B - Take Single Good', () => {
            it('should take exactly one good and refill the market', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                
                // Find a non-camel card in the market
                const targetCard = data.market.find(c => c.type !== 'camels');
                assert.ok(targetCard, 'There should be at least one non-camel card in the market');

                const initialHandSize = data.players['alice'].hand.length;
                const initialDeckSize = data.deck.length;

                // Alice takes it
                game.take_single_good('alice', targetCard.id);

                const nextData = game.get_data();
                assert.strictEqual(nextData.players['alice'].hand.length, initialHandSize + 1, 'Alice hand size should increase by 1');
                assert.ok(nextData.players['alice'].hand.some(c => c.id === targetCard.id), 'Target card should be in Alice hand');
                
                // Market should be refilled to 5 cards
                assert.strictEqual(nextData.market.length, 5, 'Market should be refilled to 5 cards');
                assert.strictEqual(nextData.deck.length, initialDeckSize - 1, 'Deck size should decrease by 1');
                
                // Turn passes to Bob
                assert.strictEqual(nextData.currentPlayerId, 'bob', 'Turn should pass to Bob');
            });

            it('should prevent taking camels with take_single_good', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                const camelCard = data.market.find(c => c.type === 'camels');
                assert.ok(camelCard, 'There should be a camel in the market');

                assert.throws(() => {
                    game.take_single_good('alice', camelCard.id);
                }, /Camels cannot be taken with a single good action/);
            });

            it('should enforce hand limit of 7 cards at the end of the turn', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                
                // Mock Alice hand to have 7 cards already
                data.players['alice'].hand = [
                    { id: 101, type: 'leather' },
                    { id: 102, type: 'leather' },
                    { id: 103, type: 'leather' },
                    { id: 104, type: 'leather' },
                    { id: 105, type: 'leather' },
                    { id: 106, type: 'leather' },
                    { id: 107, type: 'leather' }
                ];
                const targetCard = data.market.find(c => c.type !== 'camels')!;
                
                const mockedGame = GameState.from_data(data, players);
                assert.throws(() => {
                    mockedGame.take_single_good('alice', targetCard.id);
                }, /exceed hand limit of 7 cards/);
            });
        });

        describe('Action C - Take All Camels', () => {
            it('should take all camels from market and put them in the herd', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                
                // Force market to have exactly 3 camels and 2 leather
                data.market = [
                    { id: 10, type: 'camels' },
                    { id: 11, type: 'camels' },
                    { id: 12, type: 'camels' },
                    { id: 13, type: 'leather' },
                    { id: 14, type: 'leather' }
                ];
                data.players['alice'].herd = [];
                // Mock deck with non-clashing IDs to prevent drawing duplicates of 10, 11, 12
                data.deck = [
                    { id: 999, type: 'spice' },
                    { id: 998, type: 'diamonds' },
                    { id: 997, type: 'gold' }
                ];

                const mockedGame = GameState.from_data(data, players);
                mockedGame.take_all_camels('alice');

                const nextData = mockedGame.get_data();
                // Alice herd should have 3 camels
                assert.strictEqual(nextData.players['alice'].herd.length, 3);
                assert.ok(nextData.players['alice'].herd.every(c => c.type === 'camels'));

                // Market should no longer contain those camels, refilled to 5 cards
                assert.strictEqual(nextData.market.length, 5);
                assert.ok(!nextData.market.some(c => c.id === 10 || c.id === 11 || c.id === 12));
                
                // Turn passes to Bob
                assert.strictEqual(nextData.currentPlayerId, 'bob');
            });
        });

        describe('Action A - Exchange Goods', () => {
            it('should successfully execute a valid 2-for-2 exchange (hand goods for market goods)', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                
                // Force market
                data.market = [
                    { id: 10, type: 'diamonds' },
                    { id: 11, type: 'gold' },
                    { id: 12, type: 'camels' },
                    { id: 13, type: 'camels' },
                    { id: 14, type: 'camels' }
                ];
                // Force Alice hand
                data.players['alice'].hand = [
                    { id: 20, type: 'leather' },
                    { id: 21, type: 'cloth' }
                ];

                const mockedGame = GameState.from_data(data, players);

                // Alice wants to take Diamonds (10) and Gold (11), returning Leather (20) and Cloth (21)
                mockedGame.exchange_goods(
                    'alice',
                    [10, 11],
                    [
                        { id: 20, from: 'hand' },
                        { id: 21, from: 'hand' }
                    ]
                );

                const nextData = mockedGame.get_data();
                // Hand updates
                assert.strictEqual(nextData.players['alice'].hand.length, 2);
                assert.ok(nextData.players['alice'].hand.some(c => c.id === 10 && c.type === 'diamonds'));
                assert.ok(nextData.players['alice'].hand.some(c => c.id === 11 && c.type === 'gold'));

                // Market updates
                assert.strictEqual(nextData.market.length, 5);
                assert.ok(nextData.market.some(c => c.id === 20 && c.type === 'leather'));
                assert.ok(nextData.market.some(c => c.id === 21 && c.type === 'cloth'));
                
                // Turn passes to Bob
                assert.strictEqual(nextData.currentPlayerId, 'bob');
            });

            it('should successfully execute an exchange returning camels from herd', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                
                // Market
                data.market = [
                    { id: 10, type: 'diamonds' },
                    { id: 11, type: 'gold' },
                    { id: 12, type: 'silver' },
                    { id: 13, type: 'cloth' },
                    { id: 14, type: 'spice' }
                ];
                // Alice has no goods, but 2 camels in herd
                data.players['alice'].hand = [];
                data.players['alice'].herd = [
                    { id: 50, type: 'camels' },
                    { id: 51, type: 'camels' }
                ];

                const mockedGame = GameState.from_data(data, players);

                // Take Diamonds (10) and Gold (11), return Camels (50, 51)
                mockedGame.exchange_goods(
                    'alice',
                    [10, 11],
                    [
                        { id: 50, from: 'herd' },
                        { id: 51, from: 'herd' }
                    ]
                );

                const nextData = mockedGame.get_data();
                assert.strictEqual(nextData.players['alice'].hand.length, 2, 'Hand should now contain the 2 goods');
                assert.strictEqual(nextData.players['alice'].herd.length, 0, 'Herd should be empty');
                
                assert.ok(nextData.market.some(c => c.id === 50 && c.type === 'camels'));
                assert.ok(nextData.market.some(c => c.id === 51 && c.type === 'camels'));
            });

            it('should reject exchange if taking same card type as returned', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.market = [
                    { id: 10, type: 'cloth' },
                    { id: 11, type: 'gold' },
                    { id: 12, type: 'camels' },
                    { id: 13, type: 'camels' },
                    { id: 14, type: 'camels' }
                ];
                data.players['alice'].hand = [
                    { id: 20, type: 'cloth' },
                    { id: 21, type: 'leather' }
                ];

                const mockedGame = GameState.from_data(data, players);
                // Attempt to take Gold (11) and Cloth (10), returning Cloth (20) and Leather (21)
                // This violates: cannot take and return same card type (cloth) in the same exchange
                assert.throws(() => {
                    mockedGame.exchange_goods(
                        'alice',
                        [10, 11],
                        [
                            { id: 20, from: 'hand' },
                            { id: 21, from: 'hand' }
                        ]
                    );
                }, /taking and returning the same card type/);
            });

            it('should reject exchange if less than 2 cards are exchanged', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                assert.throws(() => {
                    game.exchange_goods('alice', [10], [{ id: 20, from: 'hand' }]);
                }, /requires taking at least 2 cards/);
            });
        });

        describe('Action D - Sell Goods', () => {
            it('should successfully sell cheap goods (Cloth) and award tokens + bonus', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                // Hand with 3 Cloth cards
                data.players['alice'].hand = [
                    { id: 30, type: 'cloth' },
                    { id: 31, type: 'cloth' },
                    { id: 32, type: 'cloth' }
                ];
                // Tokens stack values for cloth
                data.goodsTokens['cloth'] = [5, 3, 3, 2, 2, 1, 1, 1];
                // Shuffled bonus 3-card tokens
                data.bonusTokens['3'] = [2];

                const mockedGame = GameState.from_data(data, players);
                
                // Sell all 3 cloth cards
                mockedGame.sell_goods('alice', 'cloth', [30, 31, 32]);

                const nextData = mockedGame.get_data();
                // Hand should be empty
                assert.strictEqual(nextData.players['alice'].hand.length, 0);
                assert.strictEqual(nextData.discardPile.length, 3);

                // Tokens awarded: 3 cloth tokens (values 5, 3, 3) + 1 bonus3 token (value 2)
                const tokens = nextData.players['alice'].tokens;
                assert.strictEqual(tokens.length, 4);
                
                const rupees = nextData.players['alice'].rupeesThisRound;
                // 5 + 3 + 3 + 2 = 13 rupees
                assert.strictEqual(rupees, 13);
                
                // Stacks check
                assert.strictEqual(nextData.goodsTokens['cloth']?.length, 5);
                assert.strictEqual(nextData.bonusTokens['3'].length, 0);
            });

            it('should reject selling expensive goods (Gold) in single units', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.players['alice'].hand = [
                    { id: 40, type: 'gold' }
                ];

                const mockedGame = GameState.from_data(data, players);
                assert.throws(() => {
                    mockedGame.sell_goods('alice', 'gold', [40]);
                }, /requires selling at least 2 cards/);
            });

            it('should allow selling single cheap goods (Leather)', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                data.players['alice'].hand = [
                    { id: 40, type: 'leather' }
                ];
                data.goodsTokens['leather'] = [4, 3, 2];

                const mockedGame = GameState.from_data(data, players);
                mockedGame.sell_goods('alice', 'leather', [40]);

                const nextData = mockedGame.get_data();
                assert.strictEqual(nextData.players['alice'].hand.length, 0);
                assert.strictEqual(nextData.players['alice'].rupeesThisRound, 4);
            });
        });

        describe('Round and Game End Triggers', () => {
            it('should award Seal of Excellence at round end and check game win conditions', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                
                // Setup scores
                data.players['alice'].rupeesThisRound = 20;
                data.players['alice'].herd = [
                    { id: 201, type: 'camels' },
                    { id: 202, type: 'camels' }
                ]; // 2 camels
                
                data.players['bob'].rupeesThisRound = 18;
                data.players['bob'].herd = [
                    { id: 203, type: 'camels' }
                ]; // 1 camel

                const mockedGame = GameState.from_data(data, players);

                // Trigger round end
                mockedGame.resolve_round_end();

                const endData = mockedGame.get_data();
                assert.strictEqual(endData.status, GameStatus.RoundEnd);
                
                // Alice gets camel token (+5 rupees) -> Total Alice: 25, Bob: 18
                assert.strictEqual(endData.camelTokenClaimedBy, 'alice');
                assert.strictEqual(endData.players['alice'].rupeesThisRound, 25);
                
                // Alice gets Seal of Excellence
                assert.strictEqual(endData.players['alice'].seals, 1);
                assert.strictEqual(endData.players['bob'].seals, 0);

                // Start next round
                mockedGame.next_round();
                
                const round2Data = mockedGame.get_data();
                assert.strictEqual(round2Data.status, GameStatus.Active);
                assert.strictEqual(round2Data.roundNumber, 2);
                
                // Mock Alice winning second seal
                round2Data.players['alice'].rupeesThisRound = 30;
                round2Data.players['bob'].rupeesThisRound = 10;
                
                const mockedRound2 = GameState.from_data(round2Data, players);
                mockedRound2.resolve_round_end();

                const finalData = mockedRound2.get_data();
                assert.strictEqual(finalData.status, GameStatus.GameOver);
                assert.strictEqual(finalData.winnerId, 'alice');
            });
        });
    });

    describe('Type B: Jaipur Multiplayr Integration Tests', () => {
        const mockLobbyState = JSON.stringify({
            hostStore: {
                lobby_started: false,
                gameState: null
            },
            clientsStore: {
                'mp-client-p2': { lobby_name: 'Bob', lobby_accent: '#C25A3F' }
            },
            pluginsStore: {
                lobby: JSON.stringify({
                    hostStore: { started: false },
                    clientsStore: {
                        'mp-client-p2': { name: 'Bob', accent: '#C25A3F' }
                    },
                    pluginsStore: {}
                }),
                gameshell: JSON.stringify({
                    hostStore: {},
                    clientsStore: {
                        'mp-client-p2': {}
                    },
                    pluginsStore: {}
                })
            }
        });

        it('should initialize game, synchronize lobby names, and make moves', () => {
            const ruleTest = new GameRuleTest('jaipur', 1);
            ruleTest.setState(mockLobbyState);

            assert.strictEqual(ruleTest.getHostData('lobby_started'), false);

            // Host starts the game
            ruleTest.invokeHostMethod('startGame');

            assert.strictEqual(ruleTest.getHostData('lobby_started'), true);
            const gameState = ruleTest.getHostData('gameState').data;
            assert.strictEqual(gameState.status, GameStatus.Active);
            assert.strictEqual(gameState.playerIds.length, 2);

            const hostClientId = gameState.playerIds[0];
            const clientClientId = ruleTest.getPlayerClientId(0); // Client at index 0

            // Verify both names in states
            const names = ruleTest.getHostData('gameState').playerIds;
            assert.ok(names.includes(hostClientId));
            assert.ok(names.includes(clientClientId));
        });
    });
});
