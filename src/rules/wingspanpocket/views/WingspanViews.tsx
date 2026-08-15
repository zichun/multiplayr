/**
 * WingspanViews.tsx — React views for Wingspan (Pocket).
 *
 * Presentation only: every mutation goes through an MP RPC method. UI-only
 * interaction state (which reserve card is being played, which draw picks are
 * staged, which egg targets are chosen) lives in component state; game state
 * never does. Bird / food faces render through the shared `card-renderer` with
 * the flat-vibrant Wingspan palettes + icons.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';

import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';

import {
    BirdCard, CARD_BY_ID, FoodType, FOOD_TYPES, GoalId, GOAL_BY_ID, PowerEffect, DrawBirdFilter
} from '../WingspanData';
import {
    WINGSPAN_ICONS, getWingspanCardDefinition,
    foodIconId, describePower, birdIconId, getWingspanPalette
} from '../WingspanAssets';
import { WingspanGameState, Phase, CardInPlay, ReserveCard, PlayPayment, DrawPick, ActivationChoices } from '../WingspanGameState';

// ============================================================================
// Activation choice model — which interactive decision (if any) a brown power
// needs, so the player picks *what* to draw rather than the engine guessing.
// ============================================================================

type ActPick =
    | { kind: 'chooseFood'; food: FoodType | 'any' }           // pick a food deck (which card to draw)
    | { kind: 'drawBird'; filter?: DrawBirdFilter }            // pick a face-up supply bird
    | { kind: 'drawCard' }                                     // pick a supply bird OR a food deck
    | { kind: 'hunt' }                                         // pick a deck to hunt from
    | { kind: 'tuck'; from: 'bird' | 'food' | 'any' }          // pick a reserve card to tuck
    | { kind: 'layEgg'; target: 'another' | 'any'; count: number } // pick egg target(s)
    | { kind: 'choose'; options: PowerEffect[] };              // choose one branch

/** The interactive choice a power needs (drilling into a gated power's gain). null = auto. */
function leafPick(e: PowerEffect): ActPick | null {
    switch (e.op) {
        case 'draw_food':
        case 'gain_food':
            // even a specific food can be a choice — different decks may show it on
            // different 2-food cards (seed/fish vs seed/fruit). The modal filters
            // decks by the food and only opens when there's more than one option.
            return { kind: 'chooseFood', food: e.food };
        case 'draw_bird':
            if (e.filter && (e.filter.select === 'largest_wingspan' || e.filter.select === 'smallest_wingspan')) return null;
            return { kind: 'drawBird', filter: e.filter };
        case 'draw_card': return { kind: 'drawCard' };
        case 'hunt': return { kind: 'hunt' };
        case 'tuck': return { kind: 'tuck', from: e.from };
        case 'lay_egg':
            return e.target === 'this' ? null : { kind: 'layEgg', target: e.target === 'another' ? 'another' : 'any', count: e.count || 1 };
        case 'gated': return leafPick(e.gain);
        case 'choose_one': return { kind: 'choose', options: e.options };
        default: return null; // sequence / copy / all_players / none → resolved automatically
    }
}

function birdMatchesFilter(cardId: number, filter?: DrawBirdFilter): boolean {
    const c = CARD_BY_ID[cardId];
    if (!filter) return true;
    if (filter.cost_contains) return (c.cost.food[filter.cost_contains] || 0) > 0;
    if (filter.egg_limit != null) return c.egg_limit === filter.egg_limit;
    if (filter.egg_limit_min != null) return c.egg_limit >= filter.egg_limit_min;
    return true;
}

/** Non-empty food decks whose top card shows `food` ('any' = any non-empty deck). */
function eligibleDecks(supply: { foodDeckCounts: number[]; foodDeckTops: (number | null)[] }, food: FoodType | 'any'): number[] {
    const out: number[] = [];
    supply.foodDeckCounts.forEach((n, d) => {
        if (n === 0) return;
        const top = supply.foodDeckTops[d];
        if (food === 'any' || (top != null && CARD_BY_ID[top].reverse_food.indexOf(food) !== -1)) out.push(d);
    });
    return out;
}

// ============================================================================
// Client-side payment helpers (for the manual-payment modal). These mirror the
// engine so the UI can validate a hand-picked payment live; the host re-checks
// on play, so this is purely for UX.
// ============================================================================

const SIM_ID = '__pay__';

/** A throwaway engine seeded with my state, so `can_pay` can validate a payment. */
function paymentSim(reserve: ReserveCard[], flock: CardInPlay[], nestEggs: number): WingspanGameState {
    const gs = new WingspanGameState([SIM_ID]);
    const d = gs.get_data();
    d.players[SIM_ID].reserve = reserve.map(r => ({ ...r }));
    d.players[SIM_ID].flock = flock.map(c => ({ cardId: c.cardId, eggs: c.eggs, tucked: [...c.tucked] }));
    d.players[SIM_ID].nestEggs = nestEggs;
    return gs;
}

/**
 * The payment is just the set of selected food cards (+ chosen eggs). The engine
 * decides how each card is spent (a 2-food card can cover either type) via proper
 * matching, so the client only tags each card with a valid printed type.
 */
function buildPayment(foodIds: number[], eggSources: number[]): PlayPayment {
    return {
        foods: foodIds.map(id => ({ cardId: id, as: CARD_BY_ID[id].reverse_food[0] })),
        eggSources: [...eggSources]
    };
}

// ============================================================================
// Prop shapes
// ============================================================================

interface PublicPlayer {
    nestEggs: number;
    flock: CardInPlay[];
    reserveCount: number;
    flockSize: number;
    score: { total: number; vp: number; eggs: number; tucked: number; goals: number };
    turnCount: number;
}

interface WingspanProps extends ViewPropsInterface {
    phase: Phase;
    advanced: boolean;
    goals: GoalId[] | null;
    playerOrder: string[];
    currentPlayerId: string;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    publicPlayers: Record<string, PublicPlayer>;
    supply: { supplyBirds: (number | null)[]; foodDeckCounts: number[]; foodDeckTops: (number | null)[]; discardCount: number };
    endTriggered: boolean;
    scores: Record<string, number> | null;
    winnerIds: string[] | null;
    nestTaken: boolean;
    isHost: boolean;
    myReserve: ReserveCard[];
    myPlayable: Record<number, PlayPayment | null>;
    myTokenIndex: number;
    isMyTurn: boolean;
    activeBirdIndex: number;
}

// ============================================================================
// Small presentational helpers
// ============================================================================

const Icon: React.FC<{ id: string; size?: number; title?: string }> = ({ id, size = 20, title }) => (
    <span className="ws-icon" style={{ width: size, height: size, display: 'inline-flex' }} title={title}>
        <ExpressiveIcon icon={WINGSPAN_ICONS[id]} palette={getWingspanPalette('slate')} savedIcons={WINGSPAN_ICONS} />
    </span>
);

/**
 * A food card's face rendered as an **icon-only** card tile — no header/footer,
 * just the 1–2 large food coins centred. Shared by the supply food decks and a
 * player's food-side reserve cards so they look identical.
 */
const FoodTile: React.FC<{ cardId: number; width?: number }> = ({ cardId, width = 96 }) => {
    const foods = CARD_BY_ID[cardId].reverse_food;
    const height = Math.round(width * 88.9 / 63.5);
    const iconSize = Math.round(width * (foods.length > 1 ? 0.46 : 0.68));
    return (
        <div className="ws-food-face" style={{ width, height }} title={foods.join(' / ')}>
            {foods.map((f, k) => <Icon key={k} id={foodIconId(f)} size={iconSize} />)}
        </div>
    );
};

/** A row of egg tokens (filled) up to a bird's / nest's limit. */
const EggPips: React.FC<{ eggs: number; limit: number }> = ({ eggs, limit }) => (
    <span className="ws-eggpips" aria-label={`${eggs} of ${limit} eggs`}>
        {Array.from({ length: Math.max(limit, eggs) }).map((_, i) => (
            <span key={i} className={['ws-eggpip', i < eggs ? 'on' : 'off'].join(' ')} />
        ))}
    </span>
);

/** A bird face + its live eggs / tucked counters. */
const BirdInPlay: React.FC<{
    inPlay: CardInPlay;
    width?: number;
    active?: boolean;
    accent?: string;
    onClick?: () => void;
    selectable?: boolean;
    selected?: boolean;
}> = ({ inPlay, width = 125, active, accent, onClick, selectable, selected }) => {
    const card = CARD_BY_ID[inPlay.cardId];
    return (
        <div className={['ws-bird', 'wingspan-card', active ? 'active' : ''].filter(Boolean).join(' ')} style={active && accent ? { boxShadow: `0 0 0 3px ${accent}` } : undefined}>
            <PlayingCard
                card={getWingspanCardDefinition(card)}
                width={`${width}px`}
                customIcons={WINGSPAN_ICONS}
                selectable={selectable}
                selected={selected}
                onClick={onClick}
            />
            <div className="ws-bird-status">
                <EggPips eggs={inPlay.eggs} limit={card.egg_limit} />
                {inPlay.tucked.length > 0 && <span className="ws-tuck-badge"><Icon id="feather" size={12} />{inPlay.tucked.length}</span>}
            </div>
        </div>
    );
};

/** The Nest — leftmost slot; holds ≤3 eggs and flips to the score screen. */
const NestSlot: React.FC<{ eggs: number; selectable?: boolean; selected?: boolean; onClick?: () => void }> =
    ({ eggs, selectable, selected, onClick }) => (
        <div
            className={['ws-nest', selectable ? 'selectable' : '', selected ? 'selected' : ''].filter(Boolean).join(' ')}
            onClick={selectable ? onClick : undefined}
            role={selectable ? 'button' : undefined}
        >
            <div className="ws-nest-label">NEST</div>
            <div className="ws-nest-eggs">
                {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={['ws-eggpip', 'big', i < eggs ? 'on' : 'off'].join(' ')} />
                ))}
            </div>
        </div>
    );

// ============================================================================
// Goals strip
// ============================================================================

const GoalsStrip: React.FC<{ goals: GoalId[] | null }> = ({ goals }) => {
    if (!goals) return null;
    return (
        <div className="ws-goals">
            {goals.map((g) => {
                const def = GOAL_BY_ID[g];
                return (
                    <div key={g} className="ws-goal">
                        <span className="ws-goal-icon">{def.display_icon}</span>
                        <span className="ws-goal-desc">{def.description}</span>
                    </div>
                );
            })}
            <div className="ws-goal-note">1 pt / egg on a bird matching a goal</div>
        </div>
    );
};

// ============================================================================
// Supply strip (4 supply birds + 4 food decks + discard)
// ============================================================================

const SupplyStrip: React.FC<{
    p: WingspanProps;
    mode: 'idle' | 'draw';
    picks: DrawPick[];
    onPickBird: (slot: number) => void;
    onPickDeck: (deck: number) => void;
}> = ({ p, mode, picks, onPickBird, onPickDeck }) => {
    const birdPicked = (slot: number) => picks.some(pk => pk.kind === 'bird' && pk.index === slot);
    const totalPicks = picks.length;
    return (
        <div className="ws-supply">
            {/* one shared, horizontally-scrollable row: supply birds + food decks + discard */}
            <div className="ws-supply-row">
                {p.supply.supplyBirds.map((cid, slot) => (
                    <div key={`b${slot}`} className="ws-supply-slot wingspan-card">
                        {cid == null ? <div className="ws-empty-card" /> : (
                            <PlayingCard
                                card={getWingspanCardDefinition(CARD_BY_ID[cid])}
                                width="101px"
                                customIcons={WINGSPAN_ICONS}
                                selectable={mode === 'draw'}
                                selected={mode === 'draw' && birdPicked(slot)}
                                onClick={mode === 'draw' ? () => onPickBird(slot) : undefined}
                            />
                        )}
                    </div>
                ))}

                <span className="ws-supply-divider" aria-hidden="true" />

                {p.supply.foodDeckCounts.map((n, deck) => {
                    const top = p.supply.foodDeckTops[deck];
                    const drawable = mode === 'draw' && n > 0;
                    const pickedHere = picks.filter(pk => pk.kind === 'food' && pk.index === deck).length;
                    const foods = top != null ? CARD_BY_ID[top].reverse_food : [];
                    return (
                        <div
                            key={`d${deck}`}
                            className={['ws-fooddeck', drawable ? 'pick' : '', pickedHere > 0 ? 'picked' : ''].filter(Boolean).join(' ')}
                            onClick={drawable ? () => onPickDeck(deck) : undefined}
                            role={drawable ? 'button' : undefined}
                            title={top != null ? `food deck — top: ${foods.join(' / ')}` : 'empty deck'}
                        >
                            {top == null
                                ? <div className="ws-food-face ws-food-empty" style={{ width: 101, height: 141 }}><span className="ws-muted">—</span></div>
                                : <FoodTile cardId={top} width={101} />}
                            <span className="ws-fooddeck-count">{n}</span>
                            {pickedHere > 0 && <span className="ws-fooddeck-picked">×{pickedHere}</span>}
                        </div>
                    );
                })}

                <div className="ws-discard"><span className="ws-discard-count">{p.supply.discardCount}</span><span className="ws-discard-label">discard</span></div>
            </div>
            {mode === 'draw' && <div className="ws-supply-hint">Pick up to 2 ({totalPicks}/2)</div>}
        </div>
    );
};

// ============================================================================
// Reserve drawer (bird-side = playable, food-side = spendable)
// ============================================================================

const ReserveDrawer: React.FC<{
    reserve: ReserveCard[];
    playable: Record<number, PlayPayment | null>;
    canPlay: boolean;
    onPlay: (cardId: number) => void;
}> = ({ reserve, playable, canPlay, onPlay }) => {
    const birds = reserve.filter(r => r.face === 'bird');
    const foods = reserve.filter(r => r.face === 'food');
    return (
        <div className="ws-reserve">
            <div className="ws-reserve-group">
                <div className="ws-reserve-label">Birds ({birds.length})</div>
                <div className="ws-reserve-row">
                    {birds.length === 0 && <span className="ws-muted">none</span>}
                    {birds.map((r) => {
                        const affordable = canPlay && !!playable[r.cardId];
                        return (
                            <BirdReserveCard
                                key={r.cardId}
                                cardId={r.cardId}
                                affordable={affordable}
                                dim={canPlay && !affordable}
                                onClick={affordable ? () => onPlay(r.cardId) : undefined}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="ws-reserve-group">
                <div className="ws-reserve-label">Food ({foods.length})</div>
                <div className="ws-reserve-row">
                    {foods.length === 0 && <span className="ws-muted">none</span>}
                    {foods.map((r, i) => (
                        <div key={`${r.cardId}-${i}`} className="ws-reserve-food">
                            <FoodTile cardId={r.cardId} width={96} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const BirdReserveCard: React.FC<{ cardId: number; affordable: boolean; dim: boolean; onClick?: () => void }> =
    ({ cardId, affordable, dim, onClick }) => (
        <div className={['ws-reserve-bird', 'wingspan-card', affordable ? 'affordable' : '', dim ? 'dim' : ''].filter(Boolean).join(' ')}>
            <PlayingCard
                card={getWingspanCardDefinition(CARD_BY_ID[cardId])}
                width="112px"
                customIcons={WINGSPAN_ICONS}
                selectable={affordable}
                onClick={onClick}
            />
            {affordable && <div className="ws-play-hint">Play</div>}
        </div>
    );

// ============================================================================
// Modals
// ============================================================================

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> =
    ({ title, onClose, children, wide }) => (
        <div className="ws-overlay" onClick={onClose}>
            <div className={['ws-panel', wide ? 'wide' : ''].join(' ')} onClick={(e) => e.stopPropagation()}>
                <div className="ws-panel-head">
                    <h3>{title}</h3>
                    <button className="ws-x" onClick={onClose} aria-label="Close">✕</button>
                </div>
                {children}
            </div>
        </div>
    );

/**
 * Play-a-bird modal with **manual payment selection**. Opens pre-selected with
 * the smart auto-payment; the player can toggle which food cards and which eggs
 * to spend, and sees live whether the selection covers the cost (validated by a
 * throwaway engine `can_pay`).
 */
interface PlayBirdModalProps {
    cardId: number;
    auto: PlayPayment;
    reserve: ReserveCard[];
    flock: CardInPlay[];
    nestEggs: number;
    onConfirm: (payment: PlayPayment) => void;
    onClose: () => void;
}
interface PlayBirdModalState { foodIds: number[]; eggs: number[]; }

class PlayBirdModal extends React.Component<PlayBirdModalProps, PlayBirdModalState> {
    constructor(props: PlayBirdModalProps) {
        super(props);
        this.state = { foodIds: props.auto.foods.map(f => f.cardId), eggs: [...props.auto.eggSources] };
    }

    private card() { return CARD_BY_ID[this.props.cardId]; }
    private payment(): PlayPayment {
        return buildPayment(this.state.foodIds, this.state.eggs);
    }
    private valid(): boolean {
        const gs = paymentSim(this.props.reserve, this.props.flock, this.props.nestEggs);
        return gs.can_pay(SIM_ID, this.props.cardId, this.payment());
    }

    private toggleFood = (cardId: number) => {
        const has = this.state.foodIds.indexOf(cardId) !== -1;
        this.setState({ foodIds: has ? this.state.foodIds.filter(x => x !== cardId) : [...this.state.foodIds, cardId] });
    };
    /** For a 1-egg cost: pick exactly one egg source (nest = -1, or a flock index). */
    private pickEgg = (idx: number) => this.setState({ eggs: [idx] });
    private reset = () => this.setState({ foodIds: this.props.auto.foods.map(f => f.cardId), eggs: [...this.props.auto.eggSources] });

    public render() {
        const card = this.card();
        const { reserve, flock, nestEggs } = this.props;
        const foodCards = reserve.filter(r => r.face === 'food');

        // printed cost (what the card shows)
        const costIcons: string[] = [];
        for (const f of FOOD_TYPES) for (let i = 0; i < (card.cost.food[f] || 0); i++) costIcons.push(foodIconId(f));
        for (let i = 0; i < (card.cost.any || 0); i++) costIcons.push('any_coin');
        const eggCost = card.cost.egg || 0;
        const free = costIcons.length === 0 && !eggCost;

        const selectedCount = this.state.foodIds.length;
        const usesConversion = this.valid() && selectedCount > costIcons.length && costIcons.length > 0;
        const valid = this.valid();

        // egg sources available (nest + flock birds holding eggs)
        const eggSources: { idx: number; label: string; n: number }[] = [];
        if (nestEggs > 0) eggSources.push({ idx: -1, label: 'Nest', n: nestEggs });
        flock.forEach((c, i) => { if (c.eggs > 0) eggSources.push({ idx: i, label: CARD_BY_ID[c.cardId].common_name, n: c.eggs }); });

        return (
            <Modal title={`Play ${card.common_name}?`} onClose={this.props.onClose} wide>
                <div className="ws-play-confirm">
                    <div className="wingspan-card"><PlayingCard card={getWingspanCardDefinition(card, { detail: true })} width="170px" customIcons={WINGSPAN_ICONS} /></div>
                    <div className="ws-pay">
                        <div className="ws-pay-label">Cost</div>
                        <div className="ws-pay-items">
                            {free && <span className="ws-muted">free</span>}
                            {costIcons.map((id, i) => <span key={i} className="ws-pay-pill"><Icon id={id} size={24} /></span>)}
                            {eggCost > 0 && <span className="ws-pay-pill"><Icon id="egg" size={22} /></span>}
                        </div>

                        <div className="ws-pay-label">Choose food to spend {valid ? <span className="ws-pay-ok">✓ covers cost</span> : <span className="ws-pay-bad">not enough</span>}</div>
                        <div className="ws-pay-choose">
                            {foodCards.length === 0 && <span className="ws-muted">no food cards</span>}
                            {foodCards.map((r, i) => {
                                const on = this.state.foodIds.indexOf(r.cardId) !== -1;
                                return (
                                    <button
                                        key={`${r.cardId}-${i}`}
                                        type="button"
                                        className={['ws-pay-food', on ? 'on' : ''].join(' ')}
                                        onClick={() => this.toggleFood(r.cardId)}
                                        title={CARD_BY_ID[r.cardId].reverse_food.join(' / ')}
                                    >
                                        {CARD_BY_ID[r.cardId].reverse_food.map((f, k) => <Icon key={k} id={foodIconId(f)} size={24} />)}
                                    </button>
                                );
                            })}
                        </div>

                        {eggCost > 0 && (
                            <>
                                <div className="ws-pay-label">Spend {eggCost > 1 ? `${eggCost} eggs` : 'an egg'} from</div>
                                <div className="ws-pay-choose">
                                    {eggSources.length === 0 && <span className="ws-muted">no eggs available</span>}
                                    {eggSources.map((s) => {
                                        const on = this.state.eggs.indexOf(s.idx) !== -1;
                                        return (
                                            <button key={s.idx} type="button" className={['ws-pay-egg', on ? 'on' : ''].join(' ')} onClick={() => this.pickEgg(s.idx)}>
                                                <Icon id="egg" size={20} /> {s.label} ({s.n})
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {usesConversion && (
                            <div className="ws-pay-note">
                                Includes a <b>2-for-1 swap</b>: 2 food cards cover 1 food type you don't have.
                            </div>
                        )}

                        <div className="ws-pay-actions">
                            <button className="ws-btn ghost small" onClick={this.reset}>Reset to suggested</button>
                            <button className="ws-btn primary" disabled={!valid} onClick={() => this.props.onConfirm(this.payment())}>Play bird</button>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }
}

// ============================================================================
// Opponents panel
// ============================================================================

const OpponentFlock: React.FC<{ flock: CardInPlay[]; nestEggs: number }> = ({ flock, nestEggs }) => (
    <div className="ws-opp-flock">
        <div className="ws-opp-nest"><span className="ws-opp-nest-label">N</span><b>{nestEggs}</b></div>
        {flock.map((c, i) => (
            <div key={i} className="ws-opp-bird" title={CARD_BY_ID[c.cardId].common_name}>
                <Icon id={birdIconId(CARD_BY_ID[c.cardId].shape)} size={30} />
                {c.eggs > 0 && <span className="ws-opp-eggs">{c.eggs}</span>}
                {c.tucked.length > 0 && <span className="ws-opp-tuck">+{c.tucked.length}</span>}
            </div>
        ))}
        {flock.length === 0 && <span className="ws-muted">no birds yet</span>}
    </div>
);

const OpponentsPanel: React.FC<{ p: WingspanProps }> = ({ p }) => (
    <div className="ws-opponents">
        {p.playerOrder.filter(id => id !== p.MP.clientId).map((id) => {
            const pub = p.publicPlayers[id];
            if (!pub) return null;
            const isCurrent = id === p.currentPlayerId;
            const accent = p.playerAccents[id];
            return (
                <div key={id} className={['ws-opp', isCurrent ? 'active' : ''].join(' ')} style={{ borderColor: accent }}>
                    <div className="ws-opp-head">
                        <span className="ws-opp-name" style={{ color: accent }}>{p.playerNames[id]}</span>
                        <span className="ws-opp-score">{pub.score.total} <Icon id="feather" size={13} /></span>
                        <span className="ws-opp-meta">{pub.flockSize} birds · {pub.reserveCount} cards</span>
                    </div>
                    <OpponentFlock flock={pub.flock} nestEggs={pub.nestEggs} />
                </div>
            );
        })}
    </div>
);

// ============================================================================
// Scoring panel
// ============================================================================

const ScoringPanel: React.FC<{ p: WingspanProps }> = ({ p }) => {
    const scores = p.scores || {};
    const winners = new Set(p.winnerIds || []);
    const ranked = [...p.playerOrder].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
    return (
        <div className="ws-scoring">
            <h2>{winners.size > 1 ? 'Shared victory!' : `${p.playerNames[[...winners][0]] || 'Winner'} wins!`}</h2>
            <div className="ws-score-rows">
                {ranked.map((id) => {
                    const sc = p.publicPlayers[id]?.score;
                    return (
                        <div key={id} className={['ws-score-row', winners.has(id) ? 'winner' : ''].join(' ')}>
                            <span className="ws-score-name" style={{ color: p.playerAccents[id] }}>{p.playerNames[id]}</span>
                            <span className="ws-score-break">
                                {sc && <>{sc.vp}<Icon id="feather" size={12} /> · {sc.eggs}<Icon id="egg" size={12} /> · {sc.tucked}⤵{p.advanced ? ` · ${sc.goals}◎` : ''}</>}
                            </span>
                            <b className="ws-score-total">{scores[id] ?? 0}</b>
                            {winners.has(id) && <span className="ws-crown">🏆</span>}
                        </div>
                    );
                })}
            </div>
            {p.isHost && <button className="ws-btn primary block" onClick={() => (p.MP as any).restartGame()}>New game</button>}
        </div>
    );
};

// ============================================================================
// Rules reference
// ============================================================================

const RulesView: React.FC = () => (
    <div className="ws-rules">
        <h3>Wingspan (Pocket)</h3>
        <p>Build a flock of birds. Each bird adds a repeatable power, so early plays compound. Most points wins.</p>
        <h4>Your turn — 1 action, then activate</h4>
        <ul>
            <li><b>Play a bird</b> from your reserve, paying its food/egg cost. It joins the right of your flock.</li>
            <li><b>Draw 2</b> cards — any mix of face-up supply birds and blind food from the decks.</li>
            <li><b>Lay up to 3 eggs</b>, each on a different bird (or your Nest), below its limit.</li>
        </ul>
        <p>Then walk your flock left→right and activate each <b>brown</b> power (optional). <b>Green</b> powers are always-on and are skipped.</p>
        <h4>Cards are food, birds, and points</h4>
        <p>Every card is a bird on one side and 1 food on the other. Spend it as food, tuck it for a point, or play it as a bird — never all three.</p>
        <h4>Food</h4>
        <div className="ws-legend">
            {FOOD_TYPES.map(f => <span key={f} className="ws-legend-item"><Icon id={foodIconId(f)} size={26} /><small>{f}</small></span>)}
        </div>
        <h4>Game end</h4>
        <p>When any flock reaches 6 birds, finish the round so everyone has equal turns, then score: victory points + eggs + tucked cards + (advanced) 1 point per egg on a bird matching each goal.</p>
    </div>
);

// ============================================================================
// Lobby views
// ============================================================================

export class WingspanHostLobby extends React.Component<ViewPropsInterface, {}> {
    private setAdvanced(v: boolean) { (this.props.MP as any).setAdvanced(v); }
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const advanced = mp.getData ? (mp.getData('wingspan_advanced') !== false) : true;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="ws-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="ws-lobby-opt">
                            <div className="ws-picker-label">Goals</div>
                            <div className="ws-opt-buttons">
                                <button className={['ws-btn small', advanced ? 'primary' : ''].join(' ')} onClick={() => this.setAdvanced(true)}>Advanced (2 goals)</button>
                                <button className={['ws-btn small', !advanced ? 'primary' : ''].join(' ')} onClick={() => this.setAdvanced(false)}>Basic</button>
                            </div>
                        </div>
                        <p className="ws-muted">{playerCount} player{playerCount > 1 ? 's' : ''}. Wingspan Pocket supports 2–5.</p>
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Wingspan Pocket', 'links': links });
    }
}

export class WingspanClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div className="ws-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="ws-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Wingspan Pocket', 'links': links });
    }
}

// ============================================================================
// Activation modal — lets the player choose WHAT to draw/tuck/lay etc. rather
// than the engine picking for them.
// ============================================================================

interface ActivationModalProps {
    card: BirdCard;
    activeIndex: number;
    supply: { supplyBirds: (number | null)[]; foodDeckCounts: number[]; foodDeckTops: (number | null)[] };
    reserve: ReserveCard[];
    flock: CardInPlay[];
    nestEggs: number;
    onResolve: (choices: ActivationChoices) => void;
    onSkip: () => void;
    onClose: () => void;
}
interface ActivationModalState { branch: number | null; eggTargets: number[]; }

class ActivationModal extends React.Component<ActivationModalProps, ActivationModalState> {
    constructor(props: ActivationModalProps) { super(props); this.state = { branch: null, eggTargets: [] }; }

    /** send choices, folding in the selected choose_one branch */
    private resolve = (choices: ActivationChoices) => {
        this.props.onResolve(this.state.branch !== null ? { ...choices, branch: this.state.branch } : choices);
    };

    private deckPicker(onPick: (deck: number) => void, decks?: number[]) {
        const { supply } = this.props;
        const list = decks ?? supply.foodDeckCounts.map((_, d) => d).filter(d => supply.foodDeckCounts[d] > 0);
        return (
            <div className="ws-act-grid">
                {list.map(d => {
                    const top = supply.foodDeckTops[d];
                    return (
                        <button key={d} type="button" className="ws-act-tile" disabled={supply.foodDeckCounts[d] === 0} onClick={() => onPick(d)}>
                            {top == null
                                ? <div className="ws-food-face" style={{ width: 72, height: 100 }}><span className="ws-muted">—</span></div>
                                : <FoodTile cardId={top} width={72} />}
                            <span className="ws-act-count">{supply.foodDeckCounts[d]}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    private birdPicker(filter: DrawBirdFilter | undefined, onPick: (slot: number) => void) {
        const slots = this.props.supply.supplyBirds
            .map((cid, slot) => ({ cid, slot }))
            .filter(x => x.cid != null && birdMatchesFilter(x.cid, filter));
        if (slots.length === 0) return <div className="ws-muted pad">No matching bird in the supply.</div>;
        return (
            <div className="ws-act-grid">
                {slots.map(({ cid, slot }) => (
                    <button key={slot} type="button" className="ws-act-tile wingspan-card" onClick={() => onPick(slot)}>
                        <PlayingCard card={getWingspanCardDefinition(CARD_BY_ID[cid as number])} width="96px" customIcons={WINGSPAN_ICONS} />
                    </button>
                ))}
            </div>
        );
    }

    public render() {
        const { card } = this.props;
        const eff = card.power.effect;

        // choose_one: pick the branch first
        if (eff.op === 'choose_one' && this.state.branch === null) {
            return (
                <Modal title={`Activate ${card.common_name}`} onClose={this.props.onClose} wide>
                    <div className="ws-act">
                        <div className="ws-act-prompt">Choose one</div>
                        <div className="ws-act-branches">
                            {eff.options.map((o, i) => (
                                <button key={i} className="ws-btn primary" onClick={() => {
                                    const bp = leafPick(o);
                                    if (bp === null) this.props.onResolve({ branch: i });
                                    else this.setState({ branch: i });
                                }}>{describePower(o)}</button>
                            ))}
                        </div>
                        <button className="ws-btn ghost small" onClick={this.props.onSkip}>Skip power</button>
                    </div>
                </Modal>
            );
        }

        const active = (eff.op === 'choose_one' && this.state.branch !== null) ? eff.options[this.state.branch] : eff;
        const pick = leafPick(active);

        let prompt = describePower(active);
        let body: React.ReactNode;

        if (!pick) {
            body = <button className="ws-btn primary block" onClick={() => this.resolve({})}>Activate</button>;
        } else if (pick.kind === 'chooseFood') {
            prompt = pick.food === 'any' ? 'Choose a food to draw' : `Choose which ${pick.food} to draw`;
            body = this.deckPicker(d => this.resolve({ foodDeck: d }), eligibleDecks(this.props.supply, pick.food));
        } else if (pick.kind === 'hunt') {
            prompt = 'Choose a deck to hunt from';
            body = this.deckPicker(d => this.resolve({ foodDeck: d }));
        } else if (pick.kind === 'drawBird') {
            prompt = 'Choose a bird to draw';
            body = this.birdPicker(pick.filter, s => this.resolve({ supplyBird: s }));
        } else if (pick.kind === 'drawCard') {
            prompt = 'Draw a bird or a food';
            body = (
                <>
                    <div className="ws-act-sub">Birds</div>
                    {this.birdPicker(undefined, s => this.resolve({ drawCardKind: 'bird', supplyBird: s }))}
                    <div className="ws-act-sub">Food</div>
                    {this.deckPicker(d => this.resolve({ drawCardKind: 'food', foodDeck: d }))}
                </>
            );
        } else if (pick.kind === 'tuck') {
            prompt = 'Choose a card to tuck (+1)';
            const cards = this.props.reserve.filter(r => pick.from === 'bird' ? r.face === 'bird' : pick.from === 'food' ? r.face === 'food' : true);
            body = cards.length === 0 ? <div className="ws-muted pad">No card to tuck.</div> : (
                <div className="ws-act-grid">
                    {cards.map((r, i) => (
                        <button key={`${r.cardId}-${i}`} type="button" className={['ws-act-tile', r.face === 'bird' ? 'wingspan-card' : ''].join(' ')} onClick={() => this.resolve({ tuckCardId: r.cardId })}>
                            {r.face === 'bird'
                                ? <PlayingCard card={getWingspanCardDefinition(CARD_BY_ID[r.cardId])} width="82px" customIcons={WINGSPAN_ICONS} />
                                : <FoodTile cardId={r.cardId} width={72} />}
                        </button>
                    ))}
                </div>
            );
        } else if (pick.kind === 'layEgg') {
            const { flock, nestEggs, activeIndex } = this.props;
            const targets: { idx: number; label: string; eggs: number; limit: number }[] = [];
            if (pick.target === 'any') targets.push({ idx: -1, label: 'Nest', eggs: nestEggs, limit: 3 });
            flock.forEach((c, i) => {
                if (pick.target === 'another' && i === activeIndex) return;
                targets.push({ idx: i, label: CARD_BY_ID[c.cardId].common_name, eggs: c.eggs, limit: CARD_BY_ID[c.cardId].egg_limit });
            });
            prompt = `Choose where to lay ${pick.count > 1 ? pick.count + ' eggs' : 'an egg'}`;
            const sel = this.state.eggTargets;
            body = (
                <>
                    <div className="ws-act-grid eggs">
                        {targets.map(t => {
                            const full = t.eggs >= t.limit;
                            const on = sel.indexOf(t.idx) !== -1;
                            return (
                                <button key={t.idx} type="button" disabled={full} className={['ws-act-egg', on ? 'on' : ''].join(' ')}
                                    onClick={() => {
                                        let ns = on ? sel.filter(x => x !== t.idx) : [...sel, t.idx];
                                        if (ns.length > pick.count) ns = ns.slice(ns.length - pick.count);
                                        this.setState({ eggTargets: ns });
                                    }}>
                                    <Icon id="egg" size={20} /> {t.label} <small>({t.eggs}/{t.limit})</small>
                                </button>
                            );
                        })}
                    </div>
                    <button className="ws-btn primary block" disabled={sel.length === 0} onClick={() => this.resolve({ eggTargets: sel })}>
                        Lay {sel.length} egg{sel.length === 1 ? '' : 's'}
                    </button>
                </>
            );
        } else { // nested choose (not expected) — resolve the chosen branch
            body = <button className="ws-btn primary block" onClick={() => this.resolve({})}>Activate</button>;
        }

        return (
            <Modal title={`Activate ${card.common_name}`} onClose={this.props.onClose} wide>
                <div className="ws-act">
                    <div className="ws-act-prompt">{prompt}</div>
                    {body}
                    <button className="ws-btn ghost small" onClick={this.props.onSkip}>Skip power</button>
                </div>
            </Modal>
        );
    }
}

// ============================================================================
// Main page
// ============================================================================

type UIMode =
    | { kind: 'idle' }
    | { kind: 'draw' }
    | { kind: 'lay' }
    | { kind: 'activate' }
    | { kind: 'playConfirm'; cardId: number };

interface MainState { ui: UIMode; drawPicks: DrawPick[]; eggTargets: number[]; }

export class WingspanMainPage extends React.Component<WingspanProps, MainState> {
    constructor(props: WingspanProps) {
        super(props);
        this.state = { ui: { kind: 'idle' }, drawPicks: [], eggTargets: [] };
    }

    private mp() { return this.props.MP as any; }
    private close = () => this.setState({ ui: { kind: 'idle' }, drawPicks: [], eggTargets: [] });

    private amNestTurn(): boolean {
        return this.props.isMyTurn && this.props.phase === Phase.Nest && !this.props.nestTaken;
    }
    private amActivating(): boolean {
        return this.props.isMyTurn && this.props.phase === Phase.Activate;
    }

    // ---- draw 2 ----
    private togglePickBird = (slot: number) => {
        const exists = this.state.drawPicks.find(p => p.kind === 'bird' && p.index === slot);
        let picks = exists
            ? this.state.drawPicks.filter(p => !(p.kind === 'bird' && p.index === slot))
            : [...this.state.drawPicks, { kind: 'bird' as const, index: slot }];
        if (picks.length > 2) picks = picks.slice(picks.length - 2);
        this.setState({ drawPicks: picks });
    };
    private addPickDeck = (deck: number) => {
        let picks = [...this.state.drawPicks, { kind: 'food' as const, index: deck }];
        if (picks.length > 2) picks = picks.slice(picks.length - 2);
        this.setState({ drawPicks: picks });
    };
    private confirmDraw = () => {
        if (this.state.drawPicks.length === 0) return;
        this.mp().draw2(this.state.drawPicks);
        this.close();
    };

    // ---- lay eggs ----
    private toggleEggTarget = (idx: number) => {
        const has = this.state.eggTargets.indexOf(idx) !== -1;
        let t = has ? this.state.eggTargets.filter(x => x !== idx) : [...this.state.eggTargets, idx];
        if (t.length > 3) t = t.slice(t.length - 3);
        this.setState({ eggTargets: t });
    };
    private confirmLay = () => {
        if (this.state.eggTargets.length === 0) return;
        this.mp().layEggs(this.state.eggTargets);
        this.close();
    };

    // ---- play bird ----
    private openPlay = (cardId: number) => this.setState({ ui: { kind: 'playConfirm', cardId } });
    private confirmPlay = (payment: PlayPayment) => {
        if (this.state.ui.kind !== 'playConfirm') return;
        this.mp().playBird(this.state.ui.cardId, payment);
        this.close();
    };

    // ---- activation ----
    private activate = (choices: any = {}) => this.mp().activate(choices);
    private skipActivate = () => this.mp().skipActivation();
    private endActivate = () => this.mp().endActivation();

    private topBar(): string {
        const p = this.props;
        if (p.phase === Phase.Scoring || p.phase === Phase.Done) return 'Final scores';
        const name = p.playerNames[p.currentPlayerId] || 'Player';
        if (p.phase === Phase.Activate) return p.isMyTurn ? 'Activate your flock' : `${name} is activating`;
        return p.isMyTurn ? 'Your turn' : `${name}'s turn`;
    }

    /** The active brown bird's inline activation controls (choose_one gets branch buttons). */
    /** How many distinct options a choice actually has right now (for auto-skip). */
    private activationOptionCount(pick: ActPick): number {
        const p = this.props;
        const mine = p.publicPlayers[this.mp().clientId];
        const flock = mine ? mine.flock : [];
        switch (pick.kind) {
            case 'chooseFood': return eligibleDecks(p.supply, pick.food).length;
            case 'hunt': return p.supply.foodDeckCounts.filter(n => n > 0).length;
            case 'drawBird': return p.supply.supplyBirds.filter(c => c != null && birdMatchesFilter(c, pick.filter)).length;
            case 'drawCard': return p.supply.supplyBirds.filter(c => c != null).length + p.supply.foodDeckCounts.filter(n => n > 0).length;
            case 'tuck': return p.myReserve.filter(r => pick.from === 'bird' ? r.face === 'bird' : pick.from === 'food' ? r.face === 'food' : true).length;
            case 'layEgg': {
                let c = 0;
                if (pick.target === 'any' && (mine ? mine.nestEggs : 0) < 3) c++;
                flock.forEach((cc, i) => {
                    if (pick.target === 'another' && i === p.activeBirdIndex) return;
                    if (cc.eggs < CARD_BY_ID[cc.cardId].egg_limit) c++;
                });
                return c;
            }
            case 'choose': return pick.options.length; // always a real choice
        }
    }

    /** Tap Activate: open the modal only if there's a genuine choice; else resolve now. */
    private onActivate = (card: BirdCard) => {
        const pick = leafPick(card.power.effect);
        if (pick === null) { this.activate({}); return; }
        if (pick.kind !== 'choose' && this.activationOptionCount(pick) < 2) { this.activate({}); return; }
        this.setState({ ui: { kind: 'activate' } });
    };

    private renderActivationControls(card: BirdCard) {
        return (
            <div className="ws-activate-controls">
                <div className="ws-activate-power">{describePower(card.power.effect)}</div>
                <div className="ws-activate-buttons">
                    <button className="ws-btn small primary" onClick={() => this.onActivate(card)}>Activate</button>
                    <button className="ws-btn small ghost" onClick={this.skipActivate}>Skip</button>
                </div>
            </div>
        );
    }

    private renderMyFlock() {
        const p = this.props;
        const me = p.publicPlayers[this.mp().clientId] || p.publicPlayers[p.currentPlayerId];
        const flock = me ? me.flock : [];
        const nestEggs = me ? me.nestEggs : 0;
        const laying = this.state.ui.kind === 'lay';
        const activeIdx = this.amActivating() ? p.activeBirdIndex : -1;
        const activeCard = activeIdx >= 0 ? CARD_BY_ID[flock[activeIdx].cardId] : null;

        return (
            <div className="ws-flock-zone">
                <div className="ws-section-title">
                    Your flock ({flock.length}/6)
                    {p.endTriggered && <span className="ws-endtag">final round</span>}
                </div>
                <div className="ws-flock-row">
                    <NestSlot
                        eggs={nestEggs}
                        selectable={laying && nestEggs < 3}
                        selected={this.state.eggTargets.indexOf(-1) !== -1}
                        onClick={() => this.toggleEggTarget(-1)}
                    />
                    {flock.map((c, i) => {
                        const card = CARD_BY_ID[c.cardId];
                        const canLayHere = laying && c.eggs < card.egg_limit;
                        return (
                            <BirdInPlay
                                key={i}
                                inPlay={c}
                                active={i === activeIdx}
                                accent={p.playerAccents[p.currentPlayerId]}
                                selectable={canLayHere}
                                selected={laying && this.state.eggTargets.indexOf(i) !== -1}
                                onClick={canLayHere ? () => this.toggleEggTarget(i) : undefined}
                            />
                        );
                    })}
                    {flock.length === 0 && <div className="ws-muted pad">Play a bird to start your flock.</div>}
                </div>

                {this.amActivating() && activeCard && (
                    <div className="ws-activate-bar">
                        <span className="ws-activate-title">Activate {activeCard.common_name}</span>
                        {this.renderActivationControls(activeCard)}
                        <button className="ws-btn tiny ghost" onClick={this.endActivate}>End activation</button>
                    </div>
                )}
                {this.amActivating() && !activeCard && (
                    <div className="ws-activate-bar"><button className="ws-btn small primary" onClick={this.endActivate}>Finish turn</button></div>
                )}
            </div>
        );
    }

    private renderActionBar() {
        if (!this.amNestTurn()) return null;
        const laying = this.state.ui.kind === 'lay';
        const drawing = this.state.ui.kind === 'draw';
        return (
            <div className="ws-actionbar">
                {!laying && !drawing && (
                    <>
                        <button className="ws-btn primary" onClick={() => this.setState({ ui: { kind: 'draw' }, drawPicks: [] })}>Draw 2</button>
                        <button className="ws-btn primary" onClick={() => this.setState({ ui: { kind: 'lay' }, eggTargets: [] })}>Lay eggs</button>
                        <span className="ws-actionbar-hint">…or tap a playable bird below</span>
                    </>
                )}
                {drawing && (
                    <>
                        <button className="ws-btn" onClick={this.close}>Cancel</button>
                        <button className="ws-btn primary" disabled={this.state.drawPicks.length === 0} onClick={this.confirmDraw}>Take {this.state.drawPicks.length}</button>
                    </>
                )}
                {laying && (
                    <>
                        <button className="ws-btn" onClick={this.close}>Cancel</button>
                        <button className="ws-btn primary" disabled={this.state.eggTargets.length === 0} onClick={this.confirmLay}>Lay {this.state.eggTargets.length} egg{this.state.eggTargets.length === 1 ? '' : 's'}</button>
                    </>
                )}
            </div>
        );
    }

    private renderArena() {
        const p = this.props;
        if (p.phase === Phase.Scoring || p.phase === Phase.Done) return <ScoringPanel p={p} />;
        const mode = this.state.ui.kind === 'draw' ? 'draw' : 'idle';
        const canPlay = this.amNestTurn() && this.state.ui.kind === 'idle';
        return (
            <div className="ws-arena">
                <GoalsStrip goals={p.advanced ? p.goals : null} />
                <SupplyStrip
                    p={p}
                    mode={mode}
                    picks={this.state.drawPicks}
                    onPickBird={this.togglePickBird}
                    onPickDeck={this.addPickDeck}
                />
                {this.renderActionBar()}
                {this.renderMyFlock()}
                <ReserveDrawer
                    reserve={p.myReserve}
                    playable={p.myPlayable || {}}
                    canPlay={canPlay}
                    onPlay={this.openPlay}
                />
                <OpponentsPanel p={p} />

                {this.state.ui.kind === 'playConfirm' && this.props.myPlayable[this.state.ui.cardId] && (() => {
                    const me = this.mp().clientId;
                    const mine = p.publicPlayers[me];
                    return (
                        <PlayBirdModal
                            cardId={this.state.ui.cardId}
                            auto={this.props.myPlayable[this.state.ui.cardId] as PlayPayment}
                            reserve={p.myReserve}
                            flock={mine ? mine.flock : []}
                            nestEggs={mine ? mine.nestEggs : 0}
                            onConfirm={this.confirmPlay}
                            onClose={this.close}
                        />
                    );
                })()}

                {this.state.ui.kind === 'activate' && this.amActivating() && p.activeBirdIndex >= 0 && (() => {
                    const mine = p.publicPlayers[this.mp().clientId];
                    const flock = mine ? mine.flock : [];
                    const activeCard = CARD_BY_ID[flock[p.activeBirdIndex].cardId];
                    return (
                        <ActivationModal
                            card={activeCard}
                            activeIndex={p.activeBirdIndex}
                            supply={p.supply}
                            reserve={p.myReserve}
                            flock={flock}
                            nestEggs={mine ? mine.nestEggs : 0}
                            onResolve={(choices) => { this.activate(choices); this.close(); }}
                            onSkip={() => { this.skipActivate(); this.close(); }}
                            onClose={this.close}
                        />
                    );
                })()}
            </div>
        );
    }

    public render() {
        const p = this.props;
        const mp = p.MP;
        const isMyTurn = p.isMyTurn && (p.phase === Phase.Nest || p.phase === Phase.Activate);
        const links: any = {
            'home': { 'icon': 'crow', 'label': 'Game', 'view': this.renderArena() },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        if (p.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="ws-settings">
                        <button className="ws-btn" onClick={() => this.mp().restartGame()}>Restart game</button>
                        <button className="ws-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }
        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Wingspan Pocket',
            'topBarContent': this.topBar(),
            'roomClassName': isMyTurn ? 'attention-bg' : ''
        });
    }
}
