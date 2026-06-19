/**
 * test_maskmen.ts - Comprehensive tests for Maskmen game logic and network integration
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { MaskmenGameState as GameState, GameStatus, WrestlerColor } from '../../rules/maskmen/MaskmenGameState';
import { GameRuleTest } from '../GameRuleTest';
import { findMaximalChains } from '../../rules/maskmen/views/MaskmenViews';

describe('Maskmen Game Logic', () => {
    describe('Type A: MaskmenGameState Unit Tests', () => {
        describe('initialization and dealing', () => {
            it('should deal correct hand sizes for 3 players', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                assert.equal(data.status, GameStatus.Playing);
                assert.equal(data.season, 1);
                assert.equal(data.players['alice'].hand.length, 15);
                assert.equal(data.players['bob'].hand.length, 15);
                assert.equal(data.players['charlie'].hand.length, 15);
            });

            it('should deal correct hand sizes for 5 players', () => {
                const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                assert.equal(data.players['p1'].hand.length, 12);
            });

            it('should deal correct hand sizes for 6 players', () => {
                const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                assert.equal(data.players['p1'].hand.length, 10);
            });
        });

        describe('transitive closure and strength ranking', () => {
            it('should correctly calculate transitive reachability', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game();

                // Mock comparison edges: Pink > Green, Green > Blue
                const data = game.get_data();
                data.comparisonEdges = [
                    [WrestlerColor.Pink, WrestlerColor.Green],
                    [WrestlerColor.Green, WrestlerColor.Blue]
                ];
                // Set counts so Pink > Green > Blue (needs count(Pink) > count(Green) > count(Blue))
                data.cumulativeCounts[WrestlerColor.Pink] = 3;
                data.cumulativeCounts[WrestlerColor.Green] = 2;
                data.cumulativeCounts[WrestlerColor.Blue] = 1;

                const mockGame = GameState.from_data(data, players);

                // Direct check
                assert.equal(mockGame.is_stronger(WrestlerColor.Pink, WrestlerColor.Green), true);
                assert.equal(mockGame.is_stronger(WrestlerColor.Green, WrestlerColor.Blue), true);
                // Transitive check
                assert.equal(mockGame.is_stronger(WrestlerColor.Pink, WrestlerColor.Blue), true);
                // Inverse check
                assert.equal(mockGame.is_stronger(WrestlerColor.Blue, WrestlerColor.Pink), false);
            });

            it('should treat ties in cumulative counts as parallel/equal rank', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                data.comparisonEdges = [
                    [WrestlerColor.Pink, WrestlerColor.Green]
                ];
                // Same cumulative counts
                data.cumulativeCounts[WrestlerColor.Pink] = 2;
                data.cumulativeCounts[WrestlerColor.Green] = 2;

                const mockGame = GameState.from_data(data, players);

                // Even though Pink > Green is an edge, equal counts make them parallel/equal rank
                assert.equal(mockGame.is_stronger(WrestlerColor.Pink, WrestlerColor.Green), false);
                assert.equal(mockGame.is_stronger(WrestlerColor.Green, WrestlerColor.Pink), false);
            });
        });

        describe('maximal chains path condensation', () => {
            it('should correctly condense simple linear chains', () => {
                const edges: Array<[WrestlerColor, WrestlerColor]> = [
                    [WrestlerColor.Pink, WrestlerColor.Green],
                    [WrestlerColor.Green, WrestlerColor.Blue]
                ];
                const chains = findMaximalChains(edges);
                assert.equal(chains.length, 1);
                assert.deepEqual(chains[0], [WrestlerColor.Blue, WrestlerColor.Green, WrestlerColor.Pink]);
            });

            it('should correctly handle multiple branches in the DAG', () => {
                const edges: Array<[WrestlerColor, WrestlerColor]> = [
                    [WrestlerColor.Pink, WrestlerColor.Green],
                    [WrestlerColor.Pink, WrestlerColor.Blue]
                ];
                const chains = findMaximalChains(edges);
                assert.equal(chains.length, 2);
                
                const sortedChains = chains.slice().sort((a, b) => a[0].localeCompare(b[0]));
                assert.deepEqual(sortedChains[0], [WrestlerColor.Blue, WrestlerColor.Pink]);
                assert.deepEqual(sortedChains[1], [WrestlerColor.Green, WrestlerColor.Pink]);
            });
        });

        describe('card play validations', () => {
            it('should enforce first trick of a season starts with exactly 1 card', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game();

                // Mock Alice's hand to ensure she has wrestlers
                const data = game.get_data();
                data.players['alice'].hand = [WrestlerColor.Pink, WrestlerColor.Pink];
                data.currentPlayerIndex = 0; // Alice goes first

                const mockGame = GameState.from_data(data, players);

                // Playing 2 Pink cards to lead first trick of season should throw
                assert.throws(() => mockGame.play_cards('alice', WrestlerColor.Pink, 2), /First trick of a season must be led with exactly 1 card/);
                
                // Playing 1 Pink card should succeed
                mockGame.play_cards('alice', WrestlerColor.Pink, 1);
                assert.equal(mockGame.get_data().currentTrick.plays.length, 1);
            });

            it('should validate Option A (introduce) and Option B (known-stronger) plays', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                data.players['alice'].hand = [WrestlerColor.Pink, WrestlerColor.Pink, WrestlerColor.Pink];
                data.players['bob'].hand = [WrestlerColor.Green, WrestlerColor.Green, WrestlerColor.Green];
                data.currentPlayerIndex = 0;

                // Setup: cumulative counts are non-zero to bypass first trick of season constraint
                data.cumulativeCounts[WrestlerColor.Pink] = 1;
                
                // Alice leads with 1 Pink card
                let mockGame = GameState.from_data(data, players);
                mockGame.play_cards('alice', WrestlerColor.Pink, 1);

                // Bob plays Green. Green and Pink are unranked.
                // Playing 1 Green card should fail (Option A requires X+1, i.e., 2 cards)
                assert.throws(() => mockGame.play_cards('bob', WrestlerColor.Green, 1), /Must play at least 2 cards to introduce/);

                // Playing 2 Green cards should succeed
                mockGame.play_cards('bob', WrestlerColor.Green, 2);

                // End trick to lock in relationships (Green > Pink is now added to edges)
                // Now, cumulative counts: Pink has +1 (total 2), Green has +2 (total 2).
                // Wait! Since counts are Pink=2 and Green=2, they are tied.
                // Let's force Green count to be higher:
                const postTrickData = mockGame.get_data();
                postTrickData.cumulativeCounts[WrestlerColor.Green] = 5;
                postTrickData.cumulativeCounts[WrestlerColor.Pink] = 2;
                postTrickData.comparisonEdges = [[WrestlerColor.Green, WrestlerColor.Pink]];
                postTrickData.players['alice'].hand = [WrestlerColor.Green, WrestlerColor.Green, WrestlerColor.Green];
                postTrickData.players['bob'].hand = [WrestlerColor.Pink, WrestlerColor.Pink];
                postTrickData.currentPlayerIndex = 0; // Alice turn
                postTrickData.currentTrick.plays = []; // Clear previous trick plays

                mockGame = GameState.from_data(postTrickData, players);

                // Alice leads with 2 Green cards (Green is known-stronger than Pink)
                mockGame.play_cards('alice', WrestlerColor.Green, 2);

                // Bob's turn. Bob tries to play Pink. Pink is weaker than Green.
                // Playing Pink on top of Green should be blocked
                assert.throws(() => mockGame.play_cards('bob', WrestlerColor.Pink, 2), /Pink is weaker than Green/);
            });

            it('should enforce absolute 3-card play maximum', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                data.players['alice'].hand = [WrestlerColor.Pink, WrestlerColor.Pink, WrestlerColor.Pink, WrestlerColor.Pink];
                data.currentPlayerIndex = 0;

                const mockGame = GameState.from_data(data, players);
                assert.throws(() => mockGame.play_cards('alice', WrestlerColor.Pink, 4), /Must play between 1 and 3 cards/);
            });
        });

        describe('season end and scoring', () => {
            it('should score season correctly on hand emptying', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game();

                const data = game.get_data();
                data.players['alice'].hand = [WrestlerColor.Pink];
                data.players['bob'].hand = [WrestlerColor.Green, WrestlerColor.Green];
                data.players['charlie'].hand = [WrestlerColor.Yellow, WrestlerColor.Yellow, WrestlerColor.Yellow, WrestlerColor.Yellow];
                data.currentPlayerIndex = 0; // Alice's turn
                // Bypass first-season constraint
                data.cumulativeCounts[WrestlerColor.Blue] = 5;

                const mockGame = GameState.from_data(data, players);
                // Alice plays her last card. She goes OUT (1st out).
                // Trick ends, Alice is out.
                // There are still Bob and Charlie (activeCount = 2). Game continues.
                mockGame.play_cards('alice', WrestlerColor.Pink, 1);

                const data2 = mockGame.get_data();
                assert.equal(data2.players['alice'].outOrder, 1);
                assert.equal(data2.status, GameStatus.Playing); // Game still playing

                // Bob is the next leader. Bob leads with 1 Green card.
                assert.equal(data2.currentTrick.leaderId, 'bob');
                mockGame.play_cards('bob', WrestlerColor.Green, 1);

                // Charlie plays 2 Yellow cards (Option A, introduces Yellow > Green).
                mockGame.play_cards('charlie', WrestlerColor.Yellow, 2);

                // Bob plays his last Green card. Since Green is weaker/tied with Yellow,
                // wait, Bob must play 2 cards or pass? Yes, Yellow was played with 2 cards.
                // Since Bob only has 1 Green card left, Bob cannot play, so Bob passes.
                mockGame.pass_turn('bob');

                // Trick ends because Bob passed. Charlie wins trick and leads.
                // Charlie leads with 1 Yellow.
                mockGame.play_cards('charlie', WrestlerColor.Yellow, 1);
                // Bob plays Green (his last card). Wait! Bob had 2 Green originally. He played 1, then passed, so he still has 1 Green card.
                // Bob plays 1 Green? No, Green is weaker/unknown. Wait! Yellow cumulative count was updated.
                // Let's just force Bob to play his last card:
                const data3 = mockGame.get_data();
                data3.players['bob'].hand = [WrestlerColor.Green];
                // Bob's turn to lead
                data3.currentPlayerIndex = 1; // Bob
                data3.currentTrick.plays = []; // empty trick
                
                const mockGame3 = GameState.from_data(data3, players);
                // Bob plays his last card. Bob goes OUT (2nd out).
                // Bob's play leaves only Charlie with cards, so season ends immediately!
                mockGame3.play_cards('bob', WrestlerColor.Green, 1);

                const finalData = mockGame3.get_data();
                assert.equal(finalData.status, GameStatus.SeasonEnd);
                assert.equal(finalData.players['alice'].score, 2);  // 1st out: +2
                assert.equal(finalData.players['bob'].score, 1);    // 2nd out: +1
                assert.equal(finalData.players['charlie'].score, -1); // Last: -1
            });

            it('should compute season points gained correctly', () => {
                const { getSeasonPointsGained } = require('../../rules/maskmen/views/MaskmenViews');
                
                // 3+ players mode
                assert.equal(getSeasonPointsGained(1, 3), 2);
                assert.equal(getSeasonPointsGained(2, 3), 1);
                assert.equal(getSeasonPointsGained(3, 3), -1);

                assert.equal(getSeasonPointsGained(1, 4), 2);
                assert.equal(getSeasonPointsGained(2, 4), 1);
                assert.equal(getSeasonPointsGained(3, 4), 0);
                assert.equal(getSeasonPointsGained(4, 4), -1);

                // 2 players mode
                assert.equal(getSeasonPointsGained(1, 2), 2);
                assert.equal(getSeasonPointsGained(2, 2), -1);
            });
        });
    });

    describe('Type B: Maskmen Multiplayr Integration Tests', () => {
        const mockLobbyState = JSON.stringify({
            hostStore: {
                lobby_started: false,
                gameState: null
            },
            clientsStore: {
                'mp-client-host': { lobby_name: 'Alice', lobby_accent: '#e74c3c' },
                'mp-client-p2': { lobby_name: 'Bob', lobby_accent: '#2ecc71' },
                'mp-client-p3': { lobby_name: 'Charlie', lobby_accent: '#3498db' }
            },
            pluginsStore: {
                lobby: JSON.stringify({
                    hostStore: { started: false },
                    clientsStore: {
                        'mp-client-host': { name: 'Alice', accent: '#e74c3c' },
                        'mp-client-p2': { name: 'Bob', accent: '#2ecc71' },
                        'mp-client-p3': { name: 'Charlie', accent: '#3498db' }
                    },
                    pluginsStore: {}
                }),
                gameshell: JSON.stringify({
                    hostStore: {},
                    clientsStore: {
                        'mp-client-host': {},
                        'mp-client-p2': {},
                        'mp-client-p3': {}
                    },
                    pluginsStore: {}
                })
            }
        });

        it('should initialize game, deal hands, and synchronize views', () => {
            const ruleTest = new GameRuleTest('maskmen', 3); // 1 host, 2 clients
            ruleTest.setState(mockLobbyState);

            // Verify lobby view is shown initially
            assert.equal(ruleTest.getHostData('lobby_started'), false);

            // Host starts the game
            ruleTest.invokeHostMethod('startGame');

            // Verify game is started and state is initialized
            assert.equal(ruleTest.getHostData('lobby_started'), true);
            const gameStateData = ruleTest.getHostData('gameState').data;
            assert.equal(gameStateData.status, GameStatus.Playing);
            assert.equal(gameStateData.season, 1);

            // Check that view props are pushed to player 1 (index 0)
            const clientId = ruleTest.getPlayerClientId(0);
            const hand = gameStateData.players[clientId].hand;
            assert.equal(hand.length, 15); // Hand sizes for 3 players is 15
        });

        it('should handle card playing and passing turns reactively', () => {
            const ruleTest = new GameRuleTest('maskmen', 3);
            ruleTest.setState(mockLobbyState);
            ruleTest.invokeHostMethod('startGame');

            // Find current player ID
            const currentPlayerId = ruleTest.getHostData('gameState').data.playerIds[ruleTest.getHostData('gameState').data.currentPlayerIndex];
            const hostId = ruleTest.getHostData('gameState').data.playerIds[0];
            const isHostTurn = (currentPlayerId === hostId);

            // Force current player to play a card
            let colorToPlay: WrestlerColor;
            if (isHostTurn) {
                const playerHand = ruleTest.getHostData('gameState').data.players[hostId].hand;
                colorToPlay = playerHand[0];
                ruleTest.invokeHostMethod('playCards', colorToPlay, 1);
            } else {
                let clientIdx = -1;
                for (let i = 0; i < 3; i++) {
                    if (ruleTest.getPlayerClientId(i) === currentPlayerId) {
                        clientIdx = i;
                        break;
                    }
                }
                const playerHand = ruleTest.getHostData('gameState').data.players[currentPlayerId].hand;
                colorToPlay = playerHand[0];
                ruleTest.invokeClientMethod(clientIdx, 'playCards', colorToPlay, 1);
            }

            // Verify play is recorded on the trick board
            const updatedGameStateData = ruleTest.getHostData('gameState').data;
            const updatedTrick = updatedGameStateData.currentTrick;
            assert.equal(updatedTrick.plays.length, 1);
            assert.equal(updatedTrick.plays[0].wrestler, colorToPlay);
            assert.equal(updatedTrick.plays[0].cardCount, 1);

            // Turn advances to next player
            const newCurrentPlayerId = updatedGameStateData.playerIds[updatedGameStateData.currentPlayerIndex];
            assert.notEqual(newCurrentPlayerId, currentPlayerId);
        });
    });
});
