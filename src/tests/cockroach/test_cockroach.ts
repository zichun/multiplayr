/**
 * test_cockroach.ts - Comprehensive tests for Cockroach Poker: Royal
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { CockroachGameState as GameState, GameStatus, Card } from '../../rules/cockroach/CockroachGameState';
import { GameRuleTest } from '../GameRuleTest';

describe('Cockroach Poker Royal Logic', () => {
    describe('Type A: CockroachGameState Unit Tests', () => {
        describe('initialization and dealing', () => {
            it('should deal correct hand sizes for 2 players (variant)', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const data = game.get_data();
                assert.equal(data.status, GameStatus.NewRound);
                assert.equal(data.variant2Player, true);
                assert.equal(data.penaltyPile.length, 16);
                
                // Remaining cards: 65 - 16 = 49. Alice gets 1 extra.
                assert.equal(data.hands['alice'].length, 25);
                assert.equal(data.hands['bob'].length, 24);
                assert.equal(data.currentPlayerId, 'alice');
            });

            it('should deal correct hand sizes for 3 players', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game('bob');

                const data = game.get_data();
                assert.equal(data.status, GameStatus.NewRound);
                assert.equal(data.variant2Player, false);
                assert.equal(data.penaltyPile.length, 7);

                // Remaining cards: 65 - 7 = 58. Bob gets 1 extra.
                // 58 / 3 = 19 with 1 leftover.
                assert.equal(data.hands['bob'].length, 20);
                assert.equal(data.hands['alice'].length, 19);
                assert.equal(data.hands['charlie'].length, 19);
                assert.equal(data.currentPlayerId, 'bob');
            });

            it('should deal correct hand sizes and assign leftovers to penalty pile for 4 players', () => {
                const players = ['p1', 'p2', 'p3', 'p4'];
                const game = new GameState(players);
                game.start_game('p1');

                const data = game.get_data();
                // Remaining: 65 - 7 = 58. p1 gets 1 extra.
                // 58 / 4 = 14 with 2 leftovers.
                // p1 gets 1 extra = 15. Others get 14.
                // Remaining 1 leftover goes to penalty pile. Total penalty pile = 7 + 1 = 8.
                assert.equal(data.hands['p1'].length, 15);
                assert.equal(data.hands['p2'].length, 14);
                assert.equal(data.hands['p3'].length, 14);
                assert.equal(data.hands['p4'].length, 14);
                assert.equal(data.penaltyPile.length, 8);
            });
        });

        describe('passing validation', () => {
            it('should block passing back to immediate sender but allow other passes', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game('alice');

                // Let's grab a card from alice
                const card = game.get_data().hands['alice'][0];

                // alice passes card to bob
                game.pass_card('alice', 'bob', card.id, 'rat');
                assert.equal(game.get_data().status, GameStatus.CardPassed);
                assert.equal(game.get_data().currentPlayerId, 'bob');
                assert.equal(game.get_data().lastSenderId, 'alice');
                assert.equal(game.get_data().receiverId, 'bob');

                // bob cannot pass back to alice (immediate prior sender)
                assert.throws(() => {
                    game.pass_card('bob', 'alice', null as any, 'rat');
                }, /Cannot pass to someone who has already held the card/);

                // bob passes card to charlie
                game.pass_card('bob', 'charlie', null as any, 'royal');
                assert.equal(game.get_data().status, GameStatus.CardPassed);
                assert.equal(game.get_data().currentPlayerId, 'charlie');
                assert.equal(game.get_data().lastSenderId, 'bob');
                assert.equal(game.get_data().receiverId, 'charlie');

                // charlie cannot pass back to bob (immediate prior sender)
                assert.throws(() => {
                    game.pass_card('charlie', 'bob', null as any, 'bat');
                }, /Cannot pass to someone who has already held the card/);

                // charlie cannot pass back to alice (since alice has already held the card)
                assert.throws(() => {
                    game.pass_card('charlie', 'alice', null as any, 'bat');
                }, /Cannot pass to someone who has already held the card/);
            });

            it('should block passing in 2-player mode', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                const card = game.get_data().hands['alice'][0];
                game.pass_card('alice', 'bob', card.id, 'toad');

                // bob cannot pass on
                assert.throws(() => {
                    game.pass_card('bob', 'alice', null as any, 'toad');
                }, /Passing on is not allowed in 2-player mode/);
            });
        });

        describe('challenge evaluations', () => {
            it('should correctly resolve animal card claims', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Force a cockroach card as transit
                const data = game.get_data();
                data.currentCard = { id: 99, type: 'animal', species: 'cockroach' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'cockroach';
                data.status = GameStatus.CardPassed;

                const mockedGame = GameState.from_data(data, players);

                // Bob calls True (Claim is cockroach, card is cockroach -> matches -> True)
                // Correct guess, so sender Alice takes it
                mockedGame.decide_card('bob', true);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.NewRound);
                assert.equal(finalData.tableaus['alice'].length, 1);
                assert.equal(finalData.tableaus['alice'][0].species, 'cockroach');
                assert.equal(finalData.resolutionDetails?.guessedCorrectly, true);
                assert.equal(finalData.resolutionDetails?.loserId, 'alice');
            });

            it('should correctly resolve Joker claims', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Joker card
                const data = game.get_data();
                data.currentCard = { id: 99, type: 'joker' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'rat';
                data.status = GameStatus.CardPassed;

                const mockedGame = GameState.from_data(data, players);

                // Bob calls False -> guess is wrong because Joker claim for species is always True
                // Bob loses the challenge
                mockedGame.decide_card('bob', false);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.SpecialResolution);
                assert.equal(finalData.currentPlayerId, 'bob', 'Bob must resolve special card');
            });

            it('should correctly resolve Joker claimed as Royal', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Joker card
                const data = game.get_data();
                data.currentCard = { id: 99, type: 'joker' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'royal';
                data.status = GameStatus.CardPassed;

                const mockedGame = GameState.from_data(data, players);

                // Bob calls False -> guess is correct because Joker claim for royal is False
                // Alice loses the challenge
                mockedGame.decide_card('bob', false);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.SpecialResolution);
                assert.equal(finalData.currentPlayerId, 'alice', 'Alice must resolve special card');
            });

            it('should correctly resolve Blank claims', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Blank card
                const data = game.get_data();
                data.currentCard = { id: 99, type: 'blank' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'toad';
                data.status = GameStatus.CardPassed;

                const mockedGame = GameState.from_data(data, players);

                // Bob calls False -> guess is correct
                // Alice loses the challenge
                mockedGame.decide_card('bob', false);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.SpecialResolution);
                assert.equal(finalData.currentPlayerId, 'alice');
            });
        });

        describe('Royal penalty cascades', () => {
            it('should draw top card from penalty pile and continue cascade if also Royal', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Force a Royal Rat card in transit
                const data = game.get_data();
                data.currentCard = { id: 99, type: 'royal', species: 'rat' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'royal';
                data.status = GameStatus.CardPassed;

                // Force the top of the penalty pile to be: Royal Bat, then regular Scorpion
                // Top card is the last card in array
                data.penaltyPile = [
                    { id: 101, type: 'animal', species: 'scorpion' },
                    { id: 102, type: 'royal', species: 'bat' }
                ];

                const mockedGame = GameState.from_data(data, players);

                // Bob guesses incorrectly -> Bob takes the card
                mockedGame.decide_card('bob', false);

                const finalData = mockedGame.get_data();
                // Bob's tableau should have: Royal Rat, Royal Bat, and Scorpion (3 cards)
                assert.equal(finalData.tableaus['bob'].length, 3);
                assert.equal(finalData.tableaus['bob'][0].id, 99); // Royal Rat
                assert.equal(finalData.tableaus['bob'][1].id, 102); // Royal Bat
                assert.equal(finalData.tableaus['bob'][2].id, 101); // Scorpion
                assert.equal(finalData.penaltyPile.length, 0);
            });
        });

        describe('Special card substitute resolution', () => {
            it('should force player to substitute matching species card if they have one', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Bob has a Joker and must resolve special challenge with claim "rat"
                // Bob's hand has: regular Rat, regular Toad
                const data = game.get_data();
                data.hands['bob'] = [
                    { id: 101, type: 'animal', species: 'rat' },
                    { id: 102, type: 'animal', species: 'toad' }
                ];
                data.currentPlayerId = 'bob';
                data.status = GameStatus.SpecialResolution;
                data.resolutionDetails = {
                    loserId: 'bob',
                    senderId: 'alice',
                    card: { id: 99, type: 'joker' },
                    claim: 'rat',
                    guess: false,
                    guessedCorrectly: false,
                    penaltyDrawn: [],
                    specialSubstitute: []
                };

                const mockedGame = GameState.from_data(data, players);

                // Bob tries to resolve by placing Toad (not matching claim 'rat') -> should throw
                assert.throws(() => {
                    mockedGame.resolve_special('bob', [102]);
                }, /The card must be a regular animal card of type: rat/);

                // Bob tries to resolve by placing both cards -> should throw (only 1 required)
                assert.throws(() => {
                    mockedGame.resolve_special('bob', [101, 102]);
                }, /You must select exactly 1 card matching the species: rat/);

                // Bob resolves correctly with Rat
                mockedGame.resolve_special('bob', [101]);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.NewRound);
                assert.equal(finalData.tableaus['bob'].length, 1);
                assert.equal(finalData.tableaus['bob'][0].id, 101);
                assert.equal(finalData.hands['bob'].length, 1);
                assert.equal(finalData.hands['bob'][0].id, 102); // Toad remains in hand
            });

            it('should force player to substitute any 2 cards if they do not have matching species', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Bob must resolve claim "rat" but has no rats
                // Bob's hand: Toad, Fly, Bat
                const data = game.get_data();
                data.hands['bob'] = [
                    { id: 101, type: 'animal', species: 'toad' },
                    { id: 102, type: 'animal', species: 'fly' },
                    { id: 103, type: 'animal', species: 'bat' }
                ];
                data.currentPlayerId = 'bob';
                data.status = GameStatus.SpecialResolution;
                data.resolutionDetails = {
                    loserId: 'bob',
                    senderId: 'alice',
                    card: { id: 99, type: 'blank' },
                    claim: 'rat',
                    guess: true,
                    guessedCorrectly: false,
                    penaltyDrawn: [],
                    specialSubstitute: []
                };

                const mockedGame = GameState.from_data(data, players);

                // Bob tries to place only 1 card -> throws
                assert.throws(() => {
                    mockedGame.resolve_special('bob', [101]);
                }, /You must select exactly 2 card/);

                // Bob places Toad and Fly
                mockedGame.resolve_special('bob', [101, 102]);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.NewRound);
                assert.equal(finalData.tableaus['bob'].length, 2);
                assert.equal(finalData.hands['bob'].length, 1);
                assert.equal(finalData.hands['bob'][0].id, 103); // Bat remains
            });
        });

        describe('loss conditions', () => {
            it('should trigger game over on 4-of-a-kind (variant 3-6 players)', () => {
                const players = ['alice', 'bob', 'charlie'];
                const game = new GameState(players);
                game.start_game('alice');

                // Bob gets 3 bats, then gets a 4th bat
                const data = game.get_data();
                data.tableaus['bob'] = [
                    { id: 10, type: 'animal', species: 'bat' },
                    { id: 11, type: 'animal', species: 'bat' },
                    { id: 12, type: 'animal', species: 'bat' }
                ];

                // Play card in transit
                data.currentCard = { id: 13, type: 'animal', species: 'bat' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'bat';
                data.status = GameStatus.CardPassed;

                const mockedGame = GameState.from_data(data, players);
                mockedGame.decide_card('bob', false);

                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.GameOver);
                assert.equal(finalData.loserId, 'bob');
            });

            it('should trigger game over on 5-of-a-kind in 2-player mode', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Bob gets 4 bats
                const data = game.get_data();
                data.tableaus['bob'] = [
                    { id: 10, type: 'animal', species: 'bat' },
                    { id: 11, type: 'animal', species: 'bat' },
                    { id: 12, type: 'animal', species: 'bat' },
                    { id: 13, type: 'animal', species: 'bat' }
                ];

                // Play 5th bat card in transit
                data.currentCard = { id: 14, type: 'animal', species: 'bat' };
                data.lastSenderId = 'alice';
                data.receiverId = 'bob';
                data.currentClaim = 'bat';
                data.status = GameStatus.CardPassed;

                const mockedGame = GameState.from_data(data, players);
                mockedGame.decide_card('bob', false);

                // Bob has 5 bats, so game over
                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.GameOver);
                assert.equal(finalData.loserId, 'bob');
            });

            it('should trigger empty hand loss condition only on turn start', () => {
                const players = ['alice', 'bob'];
                const game = new GameState(players);
                game.start_game('alice');

                // Alice has 0 cards, Bob has cards
                const data = game.get_data();
                data.hands['alice'] = [];
                
                // Active player is currently Bob
                data.currentPlayerId = 'bob';
                const card = data.hands['bob'][0];

                const mockedGame = GameState.from_data(data, players);

                // Bob passes card to Alice
                mockedGame.pass_card('bob', 'alice', card.id, 'bat');

                // Alice's hand is empty mid-chain, which is legal
                assert.equal(mockedGame.get_data().status, GameStatus.CardPassed);

                // Determine if card in transit matches claim 'bat'
                const isClaimTrue = (card.type === 'animal' && card.species === 'bat');

                // Alice decides incorrectly, taking the card. Alice starts next round, but hand is empty
                // Alice guesses opposite of truth to ensure she loses
                mockedGame.decide_card('alice', !isClaimTrue);

                // Alice must play but has 0 cards, so Alice loses
                const finalData = mockedGame.get_data();
                assert.equal(finalData.status, GameStatus.GameOver);
                assert.equal(finalData.loserId, 'alice');
            });
        });
    });

    describe('Type B: Cockroach Multiplayr Integration Tests', () => {
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

        it('should initialize cockroach game, deal hand, and synchronize views', () => {
            const ruleTest = new GameRuleTest('cockroach', 3);
            ruleTest.setState(mockLobbyState);

            assert.equal(ruleTest.getHostData('lobby_started'), false);

            // Host starts the game
            ruleTest.invokeHostMethod('startGame');

            assert.equal(ruleTest.getHostData('lobby_started'), true);
            const gameState = ruleTest.getHostData('gameState').data;
            assert.equal(gameState.status, GameStatus.NewRound);
            assert.equal(gameState.variant2Player, false);

            // Log players for debug
            console.log('Player IDs in integration test:', gameState.playerIds);
            
            const clientId = ruleTest.getPlayerClientId(0);
            console.log('ClientId at index 0:', clientId);
            
            const hand = gameState.hands[clientId];
            console.log('Hand for player:', hand);
            assert.ok(hand.length >= 14); // 4 players total (1 host + 3 clients), so 14 cards each
        });

        it('should handle card passing and challenges reactively', () => {
            const ruleTest = new GameRuleTest('cockroach', 3);
            ruleTest.setState(mockLobbyState);
            ruleTest.invokeHostMethod('startGame');

            // Find who is the currentPlayerId from the host state
            const stateData = ruleTest.getHostData('gameState').data;
            const activePlayerId = stateData.currentPlayerId;
            const hostId = stateData.playerIds[0];
            
            // Helper to invoke action on host or client based on player ID
            const invokePlayerMethod = (playerId: string, method: string, ...args: any[]) => {
                if (playerId === hostId) {
                    ruleTest.invokeHostMethod(method, ...args);
                } else {
                    let clientIdx = -1;
                    for (let i = 0; i < 3; i++) {
                        if (ruleTest.getPlayerClientId(i) === playerId) {
                            clientIdx = i;
                            break;
                        }
                    }
                    if (clientIdx !== -1) {
                        ruleTest.invokeClientMethod(clientIdx, method, ...args);
                    }
                }
            };

            // Get state
            const card = stateData.hands[activePlayerId][0];
            
            // Find a target player who is NOT the active player
            let receiverId = '';
            for (const pid of stateData.playerIds) {
                if (pid !== activePlayerId) {
                    receiverId = pid;
                    break;
                }
            }

            // Active player passes card to receiver claiming cockroach
            invokePlayerMethod(activePlayerId, 'passCard', receiverId, card.id, 'cockroach');

            // Verify transit state
            const transitState = ruleTest.getHostData('gameState').data;
            assert.equal(transitState.status, GameStatus.CardPassed);
            assert.equal(transitState.receiverId, receiverId);
            assert.equal(transitState.currentClaim, 'cockroach');

            // Save old transit fields locally before decideCard clears them from the referenced store
            const oldSenderId = transitState.lastSenderId;
            const oldReceiverId = transitState.receiverId;

            // Receiver decides (Accept -> True)
            invokePlayerMethod(receiverId, 'decideCard', true);

            // Verify round resolved and new round starts
            const nextRoundState = ruleTest.getHostData('gameState').data;
            assert.equal(nextRoundState.status, GameStatus.NewRound);
            assert.ok(nextRoundState.tableaus[oldSenderId].length > 0 || nextRoundState.tableaus[oldReceiverId].length > 0);
        });
    });
});
