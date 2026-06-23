/**
 * CockroachViews.tsx - React components for Cockroach Poker: Royal
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { GameStatus, Card, Claim, PassRecord, ResolutionDetails, SPECIES_LIST, Species } from '../CockroachGameState';

import PassSound from '../../ito/sounds/pass.mp3';
import FailSound from '../../ito/sounds/fail.mp3';
import CardSound from '../../coup/sounds/card.mp3';

// Helper to map card species to Emojis (functional replacements of text)
export const speciesEmoji = (species?: Species | 'royal' | 'joker' | 'blank'): string => {
    switch (species) {
        case 'bat': return '🦇';
        case 'fly': return '🪰';
        case 'cockroach': return '🪳';
        case 'toad': return '🐸';
        case 'rat': return '🐀';
        case 'scorpion': return '🦂';
        case 'stinkbug': return '🪲';
        case 'royal': return '👑';
        case 'joker': return '🃏👑';
        case 'blank': return '🚫';
        default: return '❓';
    }
};

export const speciesLabel = (species?: Species | 'royal' | 'joker' | 'blank'): string => {
    switch (species) {
        case 'stinkbug': return 'Stink Bug';
        default: return species ? species.charAt(0).toUpperCase() + species.slice(1) : '';
    }
};

export const cardEmojiKey = (card: Card): Species | 'royal' | 'joker' | 'blank' | undefined => {
    if (card.type === 'animal' || card.type === 'royal') {
        return card.species;
    }
    return card.type;
};

// Lobby Views
export class CockroachHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Cockroach Poker',
                'links': {
                    'home': {
                        'icon': 'home',
                        'label': 'Lobby',
                        'view': (
                            <div className="cockroach-lobby-container">
                                {mp.getPluginView('lobby', 'SetNameWithLobby')}
                            </div>
                        )
                    },
                    'clients': {
                        'icon': 'users',
                        'label': 'Players',
                        'view': mp.getPluginView('lobby', 'host-roommanagement')
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <CockroachRulesView />
                    }
                }
            }
        );
    }
}

export class CockroachClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'gameName': 'Cockroach Poker',
                'links': {
                    'home': {
                        'icon': 'id-card',
                        'label': 'Lobby',
                        'view': (
                            <div className="cockroach-lobby-container">
                                {mp.getPluginView('lobby', 'SetNameWithLobby')}
                                <div className="lobby-waiting-status">
                                    Waiting for Host to start...
                                </div>
                            </div>
                        )
                    },
                    'rules': {
                        'icon': 'book',
                        'label': 'Rules',
                        'view': <CockroachRulesView />
                    }
                }
            });
    }
}

// Rules Reference View
export class CockroachRulesView extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="cockroach-rules-panel">
                <h2>Cockroach Poker Royal Rules</h2>

                <div className="rules-section">
                    <h3>Overview</h3>
                    <p>
                        A 2-6 player bluffing game. One player loses, everyone else wins. Players pass cards face-down
                        and make claims. The goal is to avoid accumulating 4 (or 5 in a 2-player game) face-up cards of
                        the same type in your tableau.
                    </p>
                </div>

                <div className="rules-section">
                    <h3>Card Deck Breakdown</h3>
                    <ul>
                        <li><strong>65 Cards Total:</strong>
                            <ul>
                                <li><strong>56 Animal Cards:</strong> 8 cards for each of the 7 species (Bat 🦇, Fly 🪰, Cockroach 🪳, Toad 🐸, Rat 🐀, Scorpion 🦂, Stink Bug 🪲).</li>
                                <li><strong>7 Royal Cards:</strong> 1 crowned card (👑) for each of the 7 species.</li>
                                <li><strong>2 Special Cards:</strong> 1 Joker card (🃏) and 1 Blank card (🚫).</li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Starting Setup</h3>
                    <ul>
                        <li><strong>Penalty Pile:</strong> A set number of cards are placed face-down during setup to form the penalty pile (16 cards in 2-player games, 7 cards in 3-6 player games). The top card is turned face-up and remains visible.</li>
                        <li><strong>Hand Dealing:</strong> The remaining cards are distributed equally among all players.</li>
                        <li><strong>Leftover Cards:</strong> If there are leftover cards during dealing:
                            <ul>
                                <li>If exactly 1 leftover card exists, it is given to the starting player (who starts with 1 extra card).</li>
                                <li>Any additional leftover cards are added face-down to the penalty pile.</li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Turn Order & Round Progression</h3>
                    <ul>
                        <li><strong>Starting Turn:</strong> The starting player of the first round is chosen randomly (and receives any leftover card from dealing).</li>
                        <li><strong>Passing a Card:</strong> The active player chooses a card from their hand, passes it face-down to a receiver of their choice, and states a claim (e.g., &quot;Bat&quot; or &quot;Royal&quot;). The claim can be True or False.</li>
                        <li><strong>Receiver&apos;s Options:</strong>
                            <ul>
                                <li><strong>Accept (Challenge):</strong> Guess whether the claim is &quot;True&quot; or &quot;False&quot;. If correct, the sender must place the card face-up in their tableau. If incorrect, you must place it in your tableau.</li>
                                <li><strong>Pass It On:</strong> Peek at the card, and pass it to another player with a new claim (True or False).
                                    <ul>
                                        <li>You cannot pass the card back to the immediate previous sender.</li>
                                        <li>You cannot pass the card to anyone who has already held the card in this passing chain.</li>
                                        <li>Passing is entirely disabled in the 2-player variant.</li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                        <li><strong>Final Receiver:</strong> If a card has been passed to everyone else, the last player who receives it has no option to pass and <strong>must</strong> make a challenge guess.</li>
                        <li><strong>Subsequent Rounds:</strong> The player who loses the challenge (and takes the card or places substitute cards in their tableau) starts the next round.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Royal Cards & Penalty Cascades</h3>
                    <ul>
                        <li>Royal cards feature a crown. Stating the specific species OR &quot;Royal&quot; are both <strong>True</strong> claims (e.g. Royal Rat is true for &quot;Rat&quot; and true for &quot;Royal&quot;).</li>
                        <li>All Royal cards in your tableau group together as one type (&quot;Royal&quot;). They do not count towards their individual species.</li>
                        <li><strong>Royal Cascade Draw:</strong> When a Royal card enters your tableau, you must immediately draw the top face-up card of the penalty pile and place it in your tableau. If that drawn card is also a Royal card, you must draw again, repeating this cascade until you draw a non-Royal card.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Special Cards</h3>
                    <ul>
                        <li><strong>Joker:</strong> Always counts as True for species claims, and False for &quot;Royal&quot; claims.</li>
                        <li><strong>Blank:</strong> Always counts as False for all claims.</li>
                        <li><strong>Special Tableau Resolution:</strong> When you lose a challenge on a special card, the special card goes back into your hand. You must instead place a regular card matching the last declared species from your hand into your tableau. If you do not have one, you must place any 2 cards from your hand instead.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h3>Loss Conditions</h3>
                    <p>A player loses immediately when:</p>
                    <ul>
                        <li>They accumulate 4 cards (5 in 2p) of the same species or Royal type in their tableau.</li>
                        <li>They have 0 cards in hand on their turn to start a round. Note that hand sizes are only evaluated for loss at the <strong>start</strong> of a player&apos;s turn to begin a round, not mid-round while a card is in transit.</li>
                    </ul>
                </div>
            </div>
        );
    }
}

// Interface for view props passed from cockroach.tsx onDataChange
interface CockroachMainProps extends ViewPropsInterface {
    gameStatus: GameStatus;
    playerIds: string[];
    currentPlayerId: string;
    lastSenderId: string | null;
    receiverId: string | null;
    currentCard: Card | null;
    currentClaim: Claim | null;
    passingChain: PassRecord[];
    penaltyPileSize: number;
    penaltyTopCard: Card | null;
    tableaus: { [playerId: string]: Card[] };
    hand: Card[];
    handSizes: { [playerId: string]: number };
    loserId: string | null;
    resolutionDetails: ResolutionDetails | null;
    variant2Player: boolean;
    isHost: boolean;
    playerNames: { [playerId: string]: string };
}

interface CockroachViewState {
    selectedCardId: number | null;
    targetPlayerId: string | null;
    selectedClaim: Claim | null;
    peeked: boolean;
    substituteCardIds: number[];
    passTargetPlayerId: string | null;
    passClaim: Claim | null;
}

class CockroachArenaView extends React.Component<CockroachMainProps, CockroachViewState> {
    constructor(props: CockroachMainProps) {
        super(props);
        this.state = {
            selectedCardId: null,
            targetPlayerId: null,
            selectedClaim: null,
            peeked: false,
            substituteCardIds: [],
            passTargetPlayerId: null,
            passClaim: null
        };
    }

    componentDidUpdate(prevProps: CockroachMainProps) {
        // Reset local selection state when turn or status shifts
        if (prevProps.currentPlayerId !== this.props.currentPlayerId ||
            prevProps.gameStatus !== this.props.gameStatus) {
            this.setState({
                selectedCardId: null,
                targetPlayerId: null,
                selectedClaim: null,
                peeked: false,
                substituteCardIds: [],
                passTargetPlayerId: null,
                passClaim: null
            });
        }
    }

    private handleCardSelect(cardId: number) {
        if (this.props.gameStatus === GameStatus.NewRound && this.props.currentPlayerId === this.props.MP.clientId) {
            this.setState({ selectedCardId: cardId });
        } else if (this.props.gameStatus === GameStatus.SpecialResolution && this.props.currentPlayerId === this.props.MP.clientId) {
            const currentSubstitutes = [...this.state.substituteCardIds];
            const idx = currentSubstitutes.indexOf(cardId);
            if (idx > -1) {
                currentSubstitutes.splice(idx, 1);
            } else {
                currentSubstitutes.push(cardId);
            }
            this.setState({ substituteCardIds: currentSubstitutes });
        }
    }

    private handleCardSelectClick(cardId: number) {
        this.handleCardSelect(cardId);
    }

    private executePass() {
        const { selectedCardId, targetPlayerId, selectedClaim } = this.state;
        if (selectedCardId !== null && targetPlayerId && selectedClaim) {
            this.props.MP.passCard(targetPlayerId, selectedCardId, selectedClaim);
        }
    }

    private executePassOn() {
        const { passTargetPlayerId, passClaim } = this.state;
        if (passTargetPlayerId && passClaim) {
            this.props.MP.passCard(passTargetPlayerId, null, passClaim);
        }
    }

    private executeDecision(guess: boolean) {
        this.props.MP.decideCard(guess);
    }

    private executeResolveSpecial() {
        this.props.MP.resolveSpecial(this.state.substituteCardIds);
    }

    render() {
        const {
            MP,
            gameStatus,
            playerIds,
            currentPlayerId,
            lastSenderId,
            receiverId,
            currentCard,
            currentClaim,
            passingChain,
            penaltyPileSize,
            penaltyTopCard,
            tableaus,
            hand,
            handSizes,
            loserId,
            resolutionDetails,
            variant2Player,
            playerNames
        } = this.props;

        const myId = MP.clientId;
        const isMyTurn = myId === currentPlayerId;
        const isReceiver = myId === receiverId;
        const winThreshold = variant2Player ? 5 : 4;
        const canPassOn = !variant2Player && playerIds.some(id => {
            if (id === myId) return false;
            return !passingChain.some(record => record.senderId === id || record.receiverId === id);
        });

        // Group Tableau cards by player and type for display
        const getPlayerTableauCounts = (playerId: string) => {
            const counts: { [key in Claim]?: number } = {};
            const cards = tableaus[playerId] || [];

            for (const c of cards) {
                const key = c.type === 'royal' ? 'royal' : c.species;
                if (key) {
                    counts[key] = (counts[key] || 0) + 1;
                }
            }
            return counts;
        };

        return (
            <div className="cockroach-arena-container">
                {/* Active Status Bar */}
                <div className="arena-status-bar">
                    <div className={`status-indicator ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                        {gameStatus === GameStatus.NewRound && (
                            isMyTurn ? (
                                <span>Play a card to start the bluffing chain</span>
                            ) : (
                                <span>Waiting for <strong>{playerNames[currentPlayerId]}</strong> to play</span>
                            )
                        )}
                        {gameStatus === GameStatus.CardPassed && (
                            isReceiver ? (
                                <span>Decide or Pass the card in transit</span>
                            ) : (
                                <span>Waiting for <strong>{playerNames[receiverId]}</strong> to decide</span>
                            )
                        )}
                        {gameStatus === GameStatus.SpecialResolution && (
                            isMyTurn ? (
                                <span>Choose substitute card(s) from your hand</span>
                            ) : (
                                <span>Waiting for <strong>{playerNames[currentPlayerId]}</strong> to resolve penalty</span>
                            )
                        )}
                    </div>
                </div>

                {/* Gameplay Transit/Action Zone (Row 1 at the top) */}
                {gameStatus === GameStatus.CardPassed && (
                    <div className="brutalist-panel transit-card-panel">
                        <h3>Card In Transit</h3>
                        <div className="transit-flow-desc">
                            {(() => {
                                const elements = [];
                                if (passingChain.length > 0) {
                                    elements.push(
                                        <React.Fragment key={passingChain[0].senderId}>
                                            {MP.getPluginView('lobby', 'player-tag', { clientId: passingChain[0].senderId })}
                                        </React.Fragment>
                                    );
                                    for (let i = 0; i < passingChain.length; i++) {
                                        const rec = passingChain[i];
                                        elements.push(
                                            <React.Fragment key={`arrow-${i}`}>
                                                <span className="transit-arrow">➡</span>
                                            </React.Fragment>
                                        );
                                        elements.push(
                                            <React.Fragment key={rec.receiverId}>
                                                {MP.getPluginView('lobby', 'player-tag', { clientId: rec.receiverId })}
                                            </React.Fragment>
                                        );
                                    }
                                }
                                return elements;
                            })()}
                        </div>
                        <div className="transit-claim-display">
                            Claim: <strong>{speciesEmoji(currentClaim)} {speciesLabel(currentClaim)}</strong>
                        </div>

                        <div className="card-transit-visual">
                            {isReceiver ? (
                                <div className={`brutalist-card transit-interactive-card ${this.state.peeked ? 'flipped' : ''}`}>
                                    <div className="card-back">
                                        {canPassOn && (
                                            <button
                                                className="brutalist-button btn-primary"
                                                onClick={() => this.setState({ peeked: true })}
                                            >
                                                Peek Card
                                            </button>
                                        )}
                                    </div>
                                    <div className="card-front">
                                        {currentCard && (
                                            <div className={`card-detail card-type-${currentCard.type}`}>
                                                <div className="card-emoji">
                                                    {speciesEmoji(cardEmojiKey(currentCard))}
                                                </div>
                                                <div className="card-label">
                                                    {speciesLabel(cardEmojiKey(currentCard))}
                                                </div>
                                                {currentCard.type === 'royal' && <div className="card-badge">👑</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="brutalist-card card-back-only">
                                    <div className="card-back-grid"></div>
                                </div>
                            )}
                        </div>

                        {/* Decisions Pane */}
                        {isReceiver && (
                            <div className="receiver-decisions-pane">
                                {!this.state.peeked ? (
                                    <div className="decision-row">
                                        <button
                                            className="brutalist-button btn-success"
                                            onClick={() => this.executeDecision(true)}
                                        >
                                            True
                                        </button>
                                        <button
                                            className="brutalist-button btn-danger"
                                            onClick={() => this.executeDecision(false)}
                                        >
                                            False
                                        </button>
                                    </div>
                                ) : (
                                    <div className="peeked-info-text">
                                        You peeked at the card. You must pass it on below.
                                    </div>
                                )}

                                <div className="pass-on-section">
                                    <h4>Or Pass It On</h4>
                                    {variant2Player ? (
                                        <p className="pass-disabled-text">Passing is disabled for 2-player games.</p>
                                    ) : !canPassOn ? (
                                        <p className="pass-disabled-text">Passing is not allowed as you are the last player in the passing chain.</p>
                                    ) : !this.state.peeked ? (
                                        <p className="peek-warning-text">You must peek at the card before you can pass it on</p>
                                    ) : (
                                        (() => {
                                            const validReceivers = playerIds.filter(id => {
                                                if (id === myId) return false;
                                                const hasHeld = passingChain.some(
                                                    record => record.senderId === id || record.receiverId === id
                                                );
                                                return !hasHeld;
                                            });

                                            return (
                                                <div className="pass-on-form">
                                                    <div className="form-group">
                                                        <label>Select Next Receiver:</label>
                                                        <div className="player-select-list">
                                                            {validReceivers.map(id => {
                                                                const isSelected = this.state.passTargetPlayerId === id;
                                                                return (
                                                                    <div
                                                                        key={id}
                                                                        className={`player-select-chip ${isSelected ? 'active' : ''}`}
                                                                        onClick={() => this.setState({ passTargetPlayerId: id })}
                                                                    >
                                                                        {MP.getPluginView('lobby', 'player-tag', { clientId: id, invertColors: isSelected })}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Select Claim:</label>
                                                        <div className="claims-grid">
                                                            {SPECIES_LIST.map(sp => (
                                                                <button
                                                                    key={sp}
                                                                    type="button"
                                                                    className={`claim-chip ${this.state.passClaim === sp ? 'active' : ''}`}
                                                                    onClick={() => this.setState({ passClaim: sp })}
                                                                >
                                                                    {speciesEmoji(sp)}
                                                                </button>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                className={`claim-chip royal-chip ${this.state.passClaim === 'royal' ? 'active' : ''}`}
                                                                onClick={() => this.setState({ passClaim: 'royal' })}
                                                            >
                                                                {speciesEmoji('royal')}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="brutalist-button btn-primary"
                                                        disabled={!this.state.passTargetPlayerId || !this.state.passClaim}
                                                        onClick={() => this.executePassOn()}
                                                    >
                                                        Pass Card
                                                    </button>
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Active Player Setup Card Form (Row 1 at the top) */}
                {gameStatus === GameStatus.NewRound && isMyTurn && (
                    <div className="brutalist-panel active-play-panel">
                        <h3>Play a Card</h3>
                        <p className="action-instruction">Choose a card, receiver, and claim to start the round</p>

                        {this.state.selectedCardId === null ? (
                            <div className="select-card-prompt">
                                Select a card from your hand below
                            </div>
                        ) : (
                            <div className="play-form-fields">
                                <div className="form-group">
                                    <label>Select Receiver:</label>
                                    <div className="player-select-list">
                                        {playerIds
                                            .filter(id => id !== myId)
                                            .map(id => {
                                                const isSelected = this.state.targetPlayerId === id;
                                                return (
                                                    <div
                                                        key={id}
                                                        className={`player-select-chip ${isSelected ? 'active' : ''}`}
                                                        onClick={() => this.setState({ targetPlayerId: id })}
                                                    >
                                                        {MP.getPluginView('lobby', 'player-tag', { clientId: id, invertColors: isSelected })}
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Select Claim:</label>
                                    <div className="claims-grid">
                                        {SPECIES_LIST.map(sp => (
                                            <button
                                                key={sp}
                                                type="button"
                                                className={`claim-chip ${this.state.selectedClaim === sp ? 'active' : ''}`}
                                                onClick={() => this.setState({ selectedClaim: sp })}
                                            >
                                                {speciesEmoji(sp)}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className={`claim-chip royal-chip ${this.state.selectedClaim === 'royal' ? 'active' : ''}`}
                                            onClick={() => this.setState({ selectedClaim: 'royal' })}
                                        >
                                            {speciesEmoji('royal')}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    className="brutalist-button btn-primary btn-play"
                                    disabled={this.state.selectedCardId === null || !this.state.targetPlayerId || !this.state.selectedClaim}
                                    onClick={() => this.executePass()}
                                >
                                    Pass Card
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Special Card Resolution Panel (Row 1 at the top) */}
                {gameStatus === GameStatus.SpecialResolution && isMyTurn && (
                    <div className="brutalist-panel special-resolution-panel">
                        <h3>Substitute Resolution</h3>
                        {(() => {
                            const details = resolutionDetails;
                            if (!details) return null;
                            const lastClaim = details.claim;
                            const hasMatchingSpecies = (lastClaim !== 'royal') &&
                                hand.some(c => c.type === 'animal' && c.species === lastClaim);

                            return (
                                <div className="special-resolution-content">
                                    <p className="resolution-warning">
                                        You took a special card ({speciesLabel(cardEmojiKey(details.card))}).
                                        The special card remains in your hand, but you must place substitute cards in your tableau.
                                    </p>

                                    {hasMatchingSpecies ? (
                                        <p className="substitute-instruction">
                                            You have a card matching the last claim species.
                                            You <strong>must</strong> select exactly 1 regular <strong>{speciesLabel(lastClaim)}</strong> card to place in your tableau.
                                        </p>
                                    ) : (
                                        <p className="substitute-instruction">
                                            You do not have a card matching the last claim species (or the claim was Royal).
                                            You <strong>must</strong> select exactly <strong>{Math.min(2, hand.length)}</strong> card(s) of any type from your hand to place in your tableau.
                                        </p>
                                    )}

                                    <div className="selected-substitutes-count">
                                        Selected: {this.state.substituteCardIds.length} card(s)
                                    </div>

                                    <button
                                        className="brutalist-button btn-primary"
                                        onClick={() => this.executeResolveSpecial()}
                                        disabled={
                                            hasMatchingSpecies
                                                ? (this.state.substituteCardIds.length !== 1 || (() => {
                                                    const card = hand.find(c => c.id === this.state.substituteCardIds[0]);
                                                    return !card || card.type !== 'animal' || card.species !== lastClaim;
                                                })())
                                                : this.state.substituteCardIds.length !== Math.min(2, hand.length)
                                        }
                                    >
                                        Confirm Substitutes
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Hand Zone (Row 2, above Penalty Pile, right below Action Zone) */}
                <div className="brutalist-panel hand-zone-container">
                    <h3>Your Hand <span>(🃏 {hand.length})</span></h3>
                    <div className="hand-cards-list">
                        {hand.length === 0 ? (
                            <div className="empty-hand-text">No cards in hand</div>
                        ) : (
                            hand.map(card => {
                                const isSelected = this.state.selectedCardId === card.id;
                                const isSubSelected = this.state.substituteCardIds.includes(card.id);
                                const isHighlighted = isSelected || isSubSelected;

                                return (
                                    <div
                                        key={card.id}
                                        className={`brutalist-card hand-card card-type-${card.type} ${isHighlighted ? 'selected' : ''}`}
                                        onClick={() => this.handleCardSelect(card.id)}
                                    >
                                        <div className="card-emoji">
                                            {speciesEmoji(cardEmojiKey(card))}
                                        </div>
                                        <div className="card-label">
                                            {speciesLabel(cardEmojiKey(card))}
                                        </div>
                                        {card.type === 'royal' && <div className="card-badge">👑</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Penalty Pile (Row 3, 100% width) */}
                <div className="brutalist-panel penalty-pile-container">
                    <h3>Penalty Pile</h3>
                    <div className="penalty-pile-layout">
                        <div className="pile-stack-visual">
                            <span className="pile-count-badge">🎴 x{penaltyPileSize}</span>
                        </div>
                        <div className="penalty-top-card-visual">
                            {penaltyTopCard ? (
                                <div className={`brutalist-card card-royal`}>
                                    <div className="card-emoji">{speciesEmoji(penaltyTopCard.species)}</div>
                                    <div className="card-label">
                                        {speciesLabel(penaltyTopCard.species)}
                                    </div>
                                    <div className="card-badge">👑</div>
                                </div>
                            ) : (
                                <div className="empty-pile-placeholder">Empty</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Players Tableau List (Row 4, 100% width) */}
                <div className="brutalist-panel players-tableaus-container">
                    <h3>Tableaus</h3>
                    <div className="tableaus-list">
                        {playerIds.map(pid => {
                            const counts = getPlayerTableauCounts(pid);
                            const playerHandSize = handSizes[pid] || 0;
                            const active = pid === currentPlayerId;

                            return (
                                <div key={pid} className={`player-tableau-row ${active ? 'active-player' : ''}`}>
                                    <div className="tableau-player-header">
                                        {MP.getPluginView('lobby', 'player-tag', { clientId: pid })}
                                        <span className="player-hand-size">🃏 x{playerHandSize}</span>
                                    </div>
                                    <div className="tableau-cards-container">
                                        {SPECIES_LIST.map(sp => {
                                            const count = counts[sp] || 0;
                                            if (count === 0) return null;
                                            const warning = count >= winThreshold - 1;
                                            return (
                                                <div key={sp} className={`tableau-card-badge ${warning ? 'warning-pulse' : ''}`}>
                                                    <span className="badge-emoji">{speciesEmoji(sp)}</span>
                                                    <span className="badge-count">x{count}</span>
                                                </div>
                                            );
                                        })}
                                        {(() => {
                                            const count = counts['royal'] || 0;
                                            if (count === 0) return null;
                                            const warning = count >= winThreshold - 1;
                                            return (
                                                <div className={`tableau-card-badge royal ${warning ? 'warning-pulse' : ''}`}>
                                                    <span className="badge-emoji">{speciesEmoji('royal')}</span>
                                                    <span className="badge-count">x{count}</span>
                                                </div>
                                            );
                                        })()}
                                        {Object.values(counts).reduce((a, b) => a + b, 0) === 0 && (
                                            <span className="empty-tableau-text">No cards</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Challenge Logs / Last Action Summary */}
                {resolutionDetails && (
                    <div className="brutalist-panel challenge-logs-container">
                        <h3>Last Challenge Result</h3>
                        <div className="challenge-result-summary">
                            <div className="result-main-text">
                                {MP.getPluginView('lobby', 'player-tag', { clientId: resolutionDetails.loserId })} took the card from {MP.getPluginView('lobby', 'player-tag', { clientId: resolutionDetails.senderId })}: <strong>{speciesEmoji(cardEmojiKey(resolutionDetails.card))} {resolutionDetails.card.type === 'royal' ? 'Royal ' : ''}{speciesLabel(cardEmojiKey(resolutionDetails.card))}</strong>
                            </div>
                            <div className="result-details-list">
                                <div>Claim made: <strong>{speciesLabel(resolutionDetails.claim)}</strong></div>
                                <div>Guess: <strong>{resolutionDetails.guess ? 'True' : 'False'}</strong> ({resolutionDetails.guessedCorrectly ? 'Guessed Correctly' : 'Guessed Incorrectly'})</div>
                                {resolutionDetails.penaltyDrawn.length > 0 && (
                                    <div className="penalty-draws-summary">
                                        Royal Penalty Cascade: Drew <strong>{resolutionDetails.penaltyDrawn.length}</strong> card(s) from pile: {resolutionDetails.penaltyDrawn.map(c => speciesEmoji(cardEmojiKey(c))).join(' ')}
                                    </div>
                                )}
                                {resolutionDetails.specialSubstitute.length > 0 && (
                                    <div className="special-substitutes-summary">
                                        Special substitute placed in tableau: {resolutionDetails.specialSubstitute.map(c => speciesEmoji(cardEmojiKey(c))).join(' ')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

// Victory Screen
class CockroachGameOverScreen extends React.Component<CockroachMainProps, {}> {
    render() {
        const { MP, playerIds, loserId, isHost } = this.props;

        return (
            <div className="cockroach-game-over-container">
                <div className="brutalist-panel victory-panel">
                    <h2>Game Over</h2>
                    <div className="loser-display-box">
                        <div className="loser-label">Loser</div>
                        {loserId && (
                            <div className="loser-name-badge">
                                {MP.getPluginView('lobby', 'player-tag', { clientId: loserId })}
                            </div>
                        )}
                        <p className="losers-outcome-desc">
                            All other players have successfully won the challenge!
                        </p>
                    </div>

                    {isHost ? (
                        <div className="game-over-actions">
                            <button
                                className="brutalist-button btn-primary"
                                onClick={() => MP.restartGame()}
                            >
                                Play Again
                            </button>
                            <button
                                className="brutalist-button btn-secondary"
                                onClick={() => MP.backToLobby()}
                            >
                                Lobby
                            </button>
                        </div>
                    ) : (
                        <div className="lobby-waiting-status">
                            Waiting for host to start next game...
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

// Master component router
function MainPage(props: CockroachMainProps) {
    if (props.gameStatus === GameStatus.GameOver) {
        return <CockroachGameOverScreen {...props} />;
    }
    return <CockroachArenaView {...props} />;
}

export class CockroachMainPage extends React.Component<CockroachMainProps, {}> {
    public render() {
        const mp = this.props.MP;

        const links = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': MainPage(this.props)
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <CockroachRulesView />
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Settings',
                'view': (
                    <div className="settings-panel">
                        <button
                            className="brutalist-button btn-primary"
                            onClick={() => this.props.MP.restartGame()}
                        >
                            Restart Game
                        </button>
                        <button
                            className="brutalist-button btn-secondary"
                            onClick={() => this.props.MP.backToLobby()}
                        >
                            Back to Lobby
                        </button>
                    </div>
                )
            };
        }

        // Setup toast notifications if move changes
        let toastNotification = null;
        if (this.props.resolutionDetails) {
            const res = this.props.resolutionDetails;
            const loserName = this.props.playerNames[res.loserId] || res.loserId;
            // Create a unique id combining details
            const moveId = `res_${res.loserId}_${res.card.id}_${res.penaltyDrawn.length}`;
            toastNotification = {
                id: moveId,
                message: `Challenge complete. ${loserName} took the card.`,
                bgColor: '#d5482f', // Warning red accent
                sound: FailSound,
                duration: 5000
            };
        } else if (this.props.gameStatus === GameStatus.CardPassed && this.props.lastSenderId) {
            const senderName = this.props.playerNames[this.props.lastSenderId] || this.props.lastSenderId;
            const receiverName = this.props.playerNames[this.props.receiverId!] || this.props.receiverId!;
            const moveId = `pass_${this.props.lastSenderId}_${this.props.receiverId}_${this.props.passingChain.length}`;
            toastNotification = {
                id: moveId,
                message: `${senderName} passed a card to ${receiverName}`,
                bgColor: '#457fc4', // Blue accent
                sound: CardSound,
                duration: 4000
            };
        }

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links,
                'gameName': 'Cockroach Poker',
                'topBarContent': `🎴 x${this.props.penaltyPileSize}`,
                'toastNotification': toastNotification
            });
    }
}
