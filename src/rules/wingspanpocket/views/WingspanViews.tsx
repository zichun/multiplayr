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
    BirdCard, CARD_BY_ID, BIRD_CARDS, FoodType, FOOD_TYPES, GoalId, GOAL_BY_ID, PowerEffect, DrawBirdFilter,
    cardMatchesStaticGoal
} from '../WingspanData';
import {
    WINGSPAN_ICONS, getWingspanCardDefinition,
    foodIconId, describePower, birdIconId, getWingspanPalette
} from '../WingspanAssets';
import { WingspanGameState, Phase, CardInPlay, ReserveCard, PlayPayment, DrawPick, ActivationChoices, PendingAllPlayersAction, MoveItem, PlayerMoveEvent } from '../WingspanGameState';

// ============================================================================
// Activation choice model — which interactive decision (if any) a brown power
// needs, so the player picks *what* to draw rather than the engine guessing.
// ============================================================================

type ActPick =
    | { kind: 'chooseFood'; food: FoodType | 'any' }                   // pick a food deck (which card to draw)
    | { kind: 'drawBird'; filter?: DrawBirdFilter }                    // pick a face-up supply bird
    | { kind: 'drawCard' }                                             // pick a supply bird OR a food deck
    | { kind: 'hunt'; max: number }                                    // pick a deck to hunt from
    | { kind: 'tuck'; from: 'bird' | 'food' | 'any'; food?: FoodType }  // pick a reserve card to tuck
    | { kind: 'discard'; what: 'food' | 'egg' | 'bird'; food?: FoodType | 'any' } // pick card/egg to discard
    | { kind: 'layEgg'; target: 'another' | 'any'; count: number }     // pick egg target(s)
    | { kind: 'copyOwn' };                                             // pick one of own birds to copy

/** Gather all interactive picks needed for an active power effect */
function getPicks(e: PowerEffect): ActPick[] {
    switch (e.op) {
        case 'draw_food':
        case 'gain_food':
            return [{ kind: 'chooseFood', food: e.food }];
        case 'draw_bird':
            if (e.filter && (e.filter.select === 'largest_wingspan' || e.filter.select === 'smallest_wingspan')) {
                return [];
            }
            return [{ kind: 'drawBird', filter: e.filter }];
        case 'draw_card':
            return [{ kind: 'drawCard' }];
        case 'hunt':
            return [{ kind: 'hunt', max: e.max }];
        case 'tuck':
            return [{ kind: 'tuck', from: e.from, food: e.food }];
        case 'discard':
            return [{ kind: 'discard', what: e.what, food: e.food }];
        case 'lay_egg':
            if (e.target === 'this') return [];
            return [{ kind: 'layEgg', target: e.target || 'any', count: e.count || 1 }];
        case 'gated':
            return [...getPicks(e.pay), ...getPicks(e.gain)];
        case 'sequence': {
            const out: ActPick[] = [];
            for (const s of e.steps) out.push(...getPicks(s));
            return out;
        }
        case 'copy_brown':
            if (e.scope === 'own') return [{ kind: 'copyOwn' }];
            return [];
        case 'all_players':
            if (e.from_1_deck && (e.effect.op === 'draw_food' || e.effect.op === 'gain_food')) {
                return [{ kind: 'chooseFood', food: 'any' }];
            }
            return [];
        default:
            return [];
    }
}

function getChooseOneOptions(eff: PowerEffect): { options: PowerEffect[]; makeEffect: (o: PowerEffect) => PowerEffect } | null {
    if (eff.op === 'choose_one') {
        return { options: eff.options, makeEffect: (o) => o };
    }
    if (eff.op === 'gated' && eff.pay.op === 'choose_one') {
        return { options: eff.pay.options, makeEffect: (o) => ({ op: 'gated', pay: o, gain: eff.gain }) };
    }
    return null;
}

function resolveBranchEffect(eff: PowerEffect, branch: number | null): PowerEffect {
    if (branch === null) return eff;
    if (eff.op === 'choose_one') return eff.options[branch];
    if (eff.op === 'gated' && eff.pay.op === 'choose_one') return { op: 'gated', pay: eff.pay.options[branch], gain: eff.gain };
    return eff;
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
    reserve?: ReserveCard[];
    flockSize: number;
    score: { total: number; vp: number; eggs: number; tucked: number; goals: number };
    turnCount: number;
    turnLog: PlayerMoveEvent[];
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
    supply: { supplyBirds: (number | null)[]; foodDeckCounts: number[]; foodDeckTops: (number | null)[]; foodDecks?: number[][]; discardCount: number };
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
    pendingAllPlayers: PendingAllPlayersAction | null;
    pendingDraw?: { count: number; items: MoveItem[] } | null;
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

/** Helper to compute which goals a flock bird satisfies */
function getMatchingGoalsForFlockBird(flock: CardInPlay[], idx: number, goals: GoalId[] | null | undefined): GoalId[] {
    if (!goals || goals.length === 0) return [];
    const c = flock[idx];
    if (!c) return [];
    const card = CARD_BY_ID[c.cardId];
    if (!card) return [];

    const matched: GoalId[] = [];
    for (const g of goals) {
        const def = GOAL_BY_ID[g];
        if (!def) continue;
        if (!def.positional) {
            if (cardMatchesStaticGoal(card, g, { eggs: c.eggs, tucked: c.tucked.length })) {
                matched.push(g);
            }
        } else if (g === 'pos_more_points_than_left') {
            let qualifies = true;
            for (let j = 0; j < idx; j++) {
                if (CARD_BY_ID[flock[j].cardId].victory_points >= card.victory_points) {
                    qualifies = false;
                    break;
                }
            }
            if (qualifies) matched.push(g);
        } else if (g === 'pos_larger_wingspan_than_left') {
            let qualifies = true;
            for (let j = 0; j < idx; j++) {
                if (CARD_BY_ID[flock[j].cardId].wingspan_cm >= card.wingspan_cm) {
                    qualifies = false;
                    break;
                }
            }
            if (qualifies) matched.push(g);
        }
    }
    return matched;
}

/** A bird face + its live eggs / tucked counters. */
const BirdInPlay: React.FC<{
    inPlay: CardInPlay;
    width?: number;
    active?: boolean;
    accent?: string;
    matchingGoals?: GoalId[];
    onClick?: () => void;
    selectable?: boolean;
    selected?: boolean;
}> = ({ inPlay, width = 125, active, accent, matchingGoals, onClick, selectable, selected }) => {
    const card = CARD_BY_ID[inPlay.cardId];
    return (
        <div className={['ws-bird', 'wingspan-card', active ? 'active' : ''].filter(Boolean).join(' ')} style={active && accent ? { boxShadow: `0 0 0 3px ${accent}` } : undefined}>
            <PlayingCard
                card={getWingspanCardDefinition(card, { matchingGoals })}
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
// Turn Log Move Item renderer
// ============================================================================

const MoveItemSpan: React.FC<{
    item: MoveItem;
    playerNames?: Record<string, string>;
    playerAccents?: Record<string, string>;
    onInspectBird?: (cardId: number) => void;
}> = ({ item, playerNames, playerAccents, onInspectBird }) => {
    switch (item.kind) {
        case 'player': {
            const name = (playerNames && playerNames[item.playerId]) || 'Player';
            const accent = (playerAccents && playerAccents[item.playerId]) || '#5c7080';
            return (
                <span className="ws-move-pill player" style={{ color: accent, fontWeight: 700 }}>
                    {name}
                </span>
            );
        }
        case 'text':
            return <span className="ws-move-text">{item.text}</span>;
        case 'bird': {
            const card = CARD_BY_ID[item.cardId];
            const palette = card ? getWingspanPalette(card.palette) : getWingspanPalette('slate');
            const shape = card ? card.shape : 'songbird';
            return (
                <span
                    className="ws-move-pill bird"
                    title={`${item.name} - Click to view`}
                    style={{ background: palette.panelBg || palette.background, border: `1px solid ${palette.border}` }}
                    onClick={onInspectBird ? () => onInspectBird(item.cardId) : undefined}
                >
                    <span className="ws-icon" style={{ width: 15, height: 15, display: 'inline-flex' }}>
                        <ExpressiveIcon icon={WINGSPAN_ICONS[birdIconId(shape)]} palette={palette} savedIcons={WINGSPAN_ICONS} />
                    </span>
                    <span className="ws-move-label">{item.name}</span>
                </span>
            );
        }
        case 'food': {
            const foods = item.foods && item.foods.length > 0 ? item.foods : [item.food];
            return (
                <span className="ws-move-pill food">
                    {foods.map((f, i) => (
                        <Icon key={i} id={foodIconId(f)} size={15} title={f} />
                    ))}
                </span>
            );
        }
        case 'egg':
            return (
                <span className="ws-move-pill egg">
                    <Icon id="egg" size={14} />
                    {item.count > 1 && <span className="ws-move-count">×{item.count}</span>}
                    {item.target && <span className="ws-move-target">{item.target}</span>}
                </span>
            );
        case 'icon':
            return (
                <span className="ws-move-pill icon" title={item.title}>
                    <Icon id={item.iconId} size={15} />
                    {item.count && item.count > 1 && <span className="ws-move-count">×{item.count}</span>}
                </span>
            );
        default:
            return null;
    }
};

// ============================================================================
// Supply strip (4 supply birds + 4 food decks + discard)
// ============================================================================

const SupplyStrip: React.FC<{
    p: WingspanProps;
    mode: 'idle' | 'draw';
    selectedPick: DrawPick | null;
    pendingDraw?: { count: number; items: MoveItem[] } | null;
    onSelectBird: (slot: number) => void;
    onSelectDeck: (deck: number) => void;
    onInspectBird?: (cardId: number) => void;
}> = ({ p, mode, selectedPick, pendingDraw, onSelectBird, onSelectDeck, onInspectBird }) => {
    return (
        <div className="ws-supply">
            {/* Two lines (supply birds / food decks) that share one horizontal scroll. */}
            <div className="ws-supply-scroll">
                <div className="ws-supply-lines">
                    <div className="ws-supply-line ws-supply-birds">
                        {p.supply.supplyBirds.map((cid, slot) => {
                            const isSelected = mode === 'draw' && selectedPick?.kind === 'bird' && selectedPick.index === slot;
                            const selectable = mode === 'draw' && cid != null;
                            return (
                                <div key={`b${slot}`} className="ws-supply-slot wingspan-card">
                                    {cid == null ? <div className="ws-empty-card" /> : (
                                        <PlayingCard
                                            card={getWingspanCardDefinition(CARD_BY_ID[cid])}
                                            width="101px"
                                            customIcons={WINGSPAN_ICONS}
                                            selectable={selectable}
                                            selected={isSelected}
                                            onClick={mode === 'draw' ? () => onSelectBird(slot) : (onInspectBird ? () => onInspectBird(cid) : undefined)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="ws-supply-line ws-supply-foods">
                        {p.supply.foodDeckCounts.map((n, deck) => {
                            const top = p.supply.foodDeckTops[deck];
                            const drawable = mode === 'draw' && n > 0;
                            const isSelected = mode === 'draw' && selectedPick?.kind === 'food' && selectedPick.index === deck;
                            const foods = top != null ? CARD_BY_ID[top].reverse_food : [];
                            return (
                                <div
                                    key={`d${deck}`}
                                    className={['ws-fooddeck', drawable ? 'pick' : '', isSelected ? 'picked' : ''].filter(Boolean).join(' ')}
                                    onClick={drawable ? () => onSelectDeck(deck) : undefined}
                                    role={drawable ? 'button' : undefined}
                                    title={top != null ? `food deck ${deck + 1} — top: ${foods.join(' / ')}` : 'empty deck'}
                                >
                                    {top == null
                                        ? <div className="ws-food-face ws-food-empty" style={{ width: 101, height: 141 }}><span className="ws-muted">—</span></div>
                                        : <FoodTile cardId={top} width={101} />}
                                    <span className="ws-fooddeck-count">{n}</span>
                                    {isSelected && <span className="ws-fooddeck-picked">✓</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {mode === 'draw' && (
                <div style={{ marginTop: 4 }}>
                    {pendingDraw && pendingDraw.count === 1 ? (
                        <div className="ws-draw-staged-tray">
                            <span className="ws-draw-staged-label">Card 1 Taken:</span>
                            <div className="ws-draw-staged-pills">
                                {pendingDraw.items.map((item, j) => (
                                    <MoveItemSpan
                                        key={j}
                                        item={item}
                                        playerNames={p.playerNames}
                                        playerAccents={p.playerAccents}
                                        onInspectBird={onInspectBird}
                                    />
                                ))}
                            </div>
                            <span style={{ fontSize: '0.78em', color: '#6b5c46', marginLeft: 4 }}>→ Now select your 2nd card (or finish)</span>
                        </div>
                    ) : (
                        <div className="ws-supply-hint">
                            Select card 1 of 2 from the supply birds or food decks
                        </div>
                    )}
                </div>
            )}
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
    onInspectBird?: (cardId: number) => void;
}> = ({ reserve, playable, canPlay, onPlay, onInspectBird }) => {
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
                                onClick={affordable ? () => onPlay(r.cardId) : (onInspectBird ? () => onInspectBird(r.cardId) : undefined)}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="ws-reserve-group">
                <div className="ws-reserve-label">Food ({foods.length})</div>
                <div className="ws-reserve-row ws-reserve-row-wrap">
                    {foods.length === 0 && <span className="ws-muted">none</span>}
                    {foods.map((r, i) => (
                        <div key={`${r.cardId}-${i}`} className="ws-reserve-food">
                            <FoodTile cardId={r.cardId} width={48} />
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

interface ModalProps {
    title: string;
    onClose?: () => void;
    children: React.ReactNode;
    wide?: boolean;
    minimizable?: boolean;
}

interface ModalState {
    isMinimized: boolean;
}

class Modal extends React.Component<ModalProps, ModalState> {
    constructor(props: ModalProps) {
        super(props);
        this.state = { isMinimized: false };
    }

    private toggleMinimize = (e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState(s => ({ isMinimized: !s.isMinimized }));
    };

    render() {
        const { title, onClose, children, wide, minimizable = true } = this.props;
        const { isMinimized } = this.state;

        if (isMinimized) {
            return (
                <div
                    className="ws-modal-minimized-dock"
                    onClick={this.toggleMinimize}
                    role="button"
                    title="Click to resume modal"
                >
                    <div className="ws-modal-minimized-main">
                        <span className="ws-modal-minimized-badge">Action Paused</span>
                        <strong className="ws-modal-minimized-title">{title}</strong>
                        <span className="ws-modal-minimized-hint">Reviewing flock · Tap anywhere to resume</span>
                    </div>
                    <button
                        className="ws-btn small primary ws-modal-minimized-btn"
                        onClick={this.toggleMinimize}
                    >
                        Resume 🗖
                    </button>
                </div>
            );
        }

        return (
            <div className="ws-overlay" onClick={onClose ? onClose : undefined}>
                <div className={['ws-panel', wide ? 'wide' : ''].join(' ')} onClick={(e) => e.stopPropagation()}>
                    <div className="ws-panel-head">
                        <h3>{title}</h3>
                        <div className="ws-panel-actions">
                            {minimizable && (
                                <button
                                    type="button"
                                    className="ws-minimize-btn"
                                    onClick={this.toggleMinimize}
                                    title="Minimize to review your flock and board"
                                    aria-label="Minimize"
                                >
                                    🗕 <span className="ws-minimize-label">Minimize</span>
                                </button>
                            )}
                            {onClose && (
                                <button
                                    type="button"
                                    className="ws-x"
                                    onClick={onClose}
                                    aria-label="Close"
                                    title="Close / Cancel"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        );
    }
}

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

/** Detail inspector modal when tapping any bird in reserve, flock, supply, opponents, or journal. */
const BirdCardDetailModal: React.FC<{ cardId: number; onClose: () => void }> = ({ cardId, onClose }) => {
    const card = CARD_BY_ID[cardId];
    if (!card) return null;

    const costIcons: string[] = [];
    for (const f of FOOD_TYPES) for (let i = 0; i < (card.cost.food[f] || 0); i++) costIcons.push(foodIconId(f));
    for (let i = 0; i < (card.cost.any || 0); i++) costIcons.push('any_coin');
    const eggCost = card.cost.egg || 0;
    const free = costIcons.length === 0 && !eggCost;

    return (
        <Modal title={card.common_name} onClose={onClose} wide>
            <div className="ws-play-confirm">
                <div className="wingspan-card">
                    <PlayingCard card={getWingspanCardDefinition(card, { detail: true })} width="170px" customIcons={WINGSPAN_ICONS} />
                </div>
                <div className="ws-pay ws-card-details">
                    <div className="ws-pay-label">Scientific Name</div>
                    <div style={{ fontStyle: 'italic', marginBottom: 12, color: '#666' }}>
                        {card.scientific_name}
                    </div>

                    <div className="ws-pay-label">Cost</div>
                    <div className="ws-pay-items" style={{ marginBottom: 12 }}>
                        {free && <span className="ws-muted">Free</span>}
                        {costIcons.map((id, i) => <span key={i} className="ws-pay-pill"><Icon id={id} size={24} /></span>)}
                        {eggCost > 0 && <span className="ws-pay-pill"><Icon id="egg" size={22} /></span>}
                    </div>

                    <div className="ws-detail-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                        <div className="ws-detail-stat-box" style={{ background: '#f6f4ee', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                            <div className="ws-pay-label" style={{ marginBottom: 2, fontSize: '0.78em' }}>Victory Points</div>
                            <div style={{ fontSize: '1.15em', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <Icon id="feather" size={16} /> {card.victory_points} VP
                            </div>
                        </div>
                        <div className="ws-detail-stat-box" style={{ background: '#f6f4ee', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                            <div className="ws-pay-label" style={{ marginBottom: 2, fontSize: '0.78em' }}>Maximum Eggs</div>
                            <div style={{ fontSize: '1.15em', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <Icon id="egg" size={16} /> {card.egg_limit}
                            </div>
                        </div>
                        <div className="ws-detail-stat-box" style={{ background: '#f6f4ee', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                            <div className="ws-pay-label" style={{ marginBottom: 2, fontSize: '0.78em' }}>Wingspan</div>
                            <div style={{ fontSize: '1.15em', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <Icon id="wingspan" size={16} /> {card.wingspan_cm} cm
                            </div>
                        </div>
                    </div>

                    <div className="ws-pay-label">Power / Bonus ({card.color.toUpperCase()})</div>
                    <div style={{ background: '#f8f6f0', padding: '10px 14px', borderRadius: 8, marginBottom: 12, lineHeight: 1.4, border: '1px solid #ede8de' }}>
                        <strong>{describePower(card.power.effect)}</strong>
                    </div>

                    {card.flavor && (
                        <div className="ws-flavor" style={{ fontStyle: 'italic', fontSize: '0.85em', color: '#777', borderTop: '1px solid #eee', paddingTop: 8 }}>
                            "{card.flavor}"
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// ============================================================================
// Opponents panel
// ============================================================================

const OpponentFlock: React.FC<{
    flock: CardInPlay[];
    nestEggs: number;
    goals?: GoalId[] | null;
    onInspectBird?: (cardId: number) => void;
}> = ({ flock, nestEggs, goals, onInspectBird }) => (
    <div className="ws-opp-flock">
        <div className="ws-opp-nest"><span className="ws-opp-nest-label">N</span><b>{nestEggs}</b></div>
        {flock.map((c, i) => {
            const card = CARD_BY_ID[c.cardId];
            const palette = getWingspanPalette(card.palette);
            const matchingGoals = goals ? getMatchingGoalsForFlockBird(flock, i, goals) : [];
            const matchesGoal = matchingGoals.length > 0;
            return (
                <div
                    key={i}
                    className="ws-opp-bird"
                    title={`${card.common_name} (${card.victory_points} VP)${matchesGoal ? ` [Goal match: ${matchingGoals.map(g => GOAL_BY_ID[g]?.display_icon).join(', ')}]` : ''} - Click to view`}
                    style={{ background: palette.panelBg || palette.background, border: `1px solid ${palette.border}` }}
                    onClick={onInspectBird ? () => onInspectBird(c.cardId) : undefined}
                >
                    <span className="ws-icon" style={{ width: 28, height: 28, display: 'inline-flex' }}>
                        <ExpressiveIcon icon={WINGSPAN_ICONS[birdIconId(card.shape)]} palette={palette} savedIcons={WINGSPAN_ICONS} />
                    </span>
                    {matchesGoal && <span className="ws-opp-goal" title="Matches goal">🎯</span>}
                    {c.eggs > 0 && <span className="ws-opp-eggs">{c.eggs}</span>}
                    {c.tucked.length > 0 && <span className="ws-opp-tuck">+{c.tucked.length}</span>}
                </div>
            );
        })}
        {flock.length === 0 && <span className="ws-muted">no birds yet</span>}
    </div>
);



const OpponentsPanel: React.FC<{ p: WingspanProps; onInspectBird?: (cardId: number) => void }> = ({ p, onInspectBird }) => (
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
                        {isCurrent && <span className="ws-turn-badge" style={{ backgroundColor: accent }}>Turn</span>}
                        <span className="ws-opp-score">{pub.score.total} pts</span>
                        <span className="ws-opp-meta">
                            {pub.score.vp} bird · {pub.score.eggs} egg · {pub.score.tucked} tuck{p.advanced ? ` · ${pub.score.goals} goal` : ''}
                        </span>
                    </div>
                    <OpponentFlock flock={pub.flock} nestEggs={pub.nestEggs} goals={p.advanced ? p.goals : null} onInspectBird={onInspectBird} />
                    {pub.turnLog && pub.turnLog.length > 0 && (
                        <div className="ws-opp-moves">
                            {pub.turnLog.map((ev, k) => (
                                <div key={k} className="ws-opp-move-item">
                                    {ev.items.map((item, j) => (
                                        <MoveItemSpan
                                            key={j}
                                            item={item}
                                            playerNames={p.playerNames}
                                            playerAccents={p.playerAccents}
                                            onInspectBird={onInspectBird}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

// ============================================================================
// Opponents full tableau & reserve tab view
// ============================================================================

const OpponentsTableauView: React.FC<{
    p: WingspanProps;
    onInspectBird: (cardId: number) => void;
}> = ({ p, onInspectBird }) => {
    const myId = p.MP.clientId;
    const opponentIds = p.playerOrder.filter(id => id !== myId);

    if (opponentIds.length === 0) {
        return (
            <div className="ws-opponents-tableau-view" style={{ padding: 24, textAlign: 'center' }}>
                <div className="ws-section-title" style={{ justifyContent: 'center' }}>Opponents Tableaus &amp; Hands</div>
                <div className="ws-muted pad" style={{ marginTop: 12 }}>No other players in this game.</div>
            </div>
        );
    }

    return (
        <div className="ws-opponents-tableau-view" style={{ width: '100%', maxWidth: 960, margin: '0 auto', padding: '10px 4px' }}>
            {p.advanced && p.goals && <GoalsStrip goals={p.goals} />}
            <div className="ws-section-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Opponents Tableaus &amp; Hands</span>
                <span className="ws-muted" style={{ fontSize: '0.82em', fontWeight: 600 }}>{opponentIds.length} Opponent{opponentIds.length === 1 ? '' : 's'}</span>
            </div>
            <div className="ws-review-players">
                {opponentIds.map((id) => {
                    const pub = p.publicPlayers[id];
                    if (!pub) return null;
                    const accent = p.playerAccents[id] || '#5c7080';
                    const name = p.playerNames[id] || 'Opponent';
                    const isCurrent = id === p.currentPlayerId && (p.phase === Phase.Nest || p.phase === Phase.Activate);
                    const flock = pub.flock || [];
                    const reserve = pub.reserve || [];
                    const birdsInHand = reserve.filter(r => r.face === 'bird');
                    const foodInHand = reserve.filter(r => r.face === 'food');

                    return (
                        <div key={id} className="ws-review-card" style={{ borderColor: accent, marginBottom: 16 }}>
                            <div className="ws-review-head">
                                <div className="ws-review-player-info">
                                    <span className="ws-review-name" style={{ color: accent }}>{name}</span>
                                    {isCurrent && <span className="ws-winner-tag" style={{ background: '#eef5fd', color: '#2b6cb0', borderColor: '#bee3f8' }}>⚡ Active Turn</span>}
                                    <span className="ws-review-total">{pub.score?.total ?? 0} pts</span>
                                </div>
                                <div className="ws-review-breakdown">
                                    {pub.score && (
                                        <>
                                            <strong>{pub.score.vp}</strong> bird · <strong>{pub.score.eggs}</strong> egg · <strong>{pub.score.tucked}</strong> tuck{p.advanced ? ` · <strong>${pub.score.goals}</strong> goal` : ''}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Flock */}
                            <div className="ws-review-sublabel">Flock ({flock.length}/6 birds)</div>
                            <div className="ws-flock-row" style={{ overflowX: 'auto', paddingBottom: 6 }}>
                                <NestSlot eggs={pub.nestEggs} />
                                {flock.map((c, i) => {
                                    const matchingGoals = p.advanced ? getMatchingGoalsForFlockBird(flock, i, p.goals) : [];
                                    return (
                                        <BirdInPlay
                                            key={i}
                                            inPlay={c}
                                            width={118}
                                            accent={accent}
                                            matchingGoals={matchingGoals}
                                            onClick={() => onInspectBird(c.cardId)}
                                        />
                                    );
                                })}
                                {flock.length === 0 && <span className="ws-muted pad">No birds played yet</span>}
                            </div>

                            {/* Reserve / Hand */}
                            <div className="ws-review-sublabel" style={{ marginTop: 10 }}>
                                Reserve / Hand ({reserve.length} cards: {birdsInHand.length} bird{birdsInHand.length === 1 ? '' : 's'} · {foodInHand.length} food)
                            </div>
                            <div className="ws-review-hand-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, alignItems: 'center' }}>
                                {birdsInHand.map((r, idx) => (
                                    <div
                                        key={`b-${r.cardId}-${idx}`}
                                        className="ws-reserve-bird wingspan-card"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => onInspectBird(r.cardId)}
                                        title={`${CARD_BY_ID[r.cardId]?.common_name} - Click to view`}
                                    >
                                        <PlayingCard
                                            card={getWingspanCardDefinition(CARD_BY_ID[r.cardId])}
                                            width="100px"
                                            customIcons={WINGSPAN_ICONS}
                                        />
                                    </div>
                                ))}
                                {foodInHand.map((r, idx) => (
                                    <FoodTile key={`f-${r.cardId}-${idx}`} cardId={r.cardId} width={100} />
                                ))}
                                {reserve.length === 0 && <span className="ws-muted pad">No cards in reserve</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// Scoring panel
// ============================================================================

const ScoringPanel: React.FC<{
    p: WingspanProps;
    onInspectBird: (cardId: number) => void;
}> = ({ p, onInspectBird }) => {
    const scores = p.scores || {};
    const winners = new Set(p.winnerIds || []);
    const ranked = [...p.playerOrder].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

    return (
        <div className="ws-final-review">
            <div className="ws-scoring">
                <h2>{winners.size > 1 ? 'Shared victory!' : `${p.playerNames[[...winners][0]] || 'Winner'} wins!`}</h2>
                <div className="ws-score-rows">
                    {ranked.map((id, rankIdx) => {
                        const pub = p.publicPlayers[id];
                        const sc = pub?.score;
                        const accent = p.playerAccents[id];
                        const isWin = winners.has(id);
                        return (
                            <div key={id} className={['ws-score-row', isWin ? 'winner' : ''].join(' ')}>
                                <span className="ws-score-rank">#{rankIdx + 1}</span>
                                <span className="ws-score-name" style={{ color: accent }}>{p.playerNames[id]}</span>
                                <span className="ws-score-break">
                                    {sc && (
                                        <>
                                            {sc.vp}<Icon id="feather" size={12} title="Bird points" /> · {sc.eggs}<Icon id="egg" size={12} title="Eggs" /> · {sc.tucked}<span style={{ fontSize: '0.85em' }}>⤵</span>{p.advanced ? ` · ${sc.goals}◎` : ''}
                                        </>
                                    )}
                                </span>
                                <b className="ws-score-total">{scores[id] ?? 0} pts</b>
                                {isWin && <span className="ws-crown">🏆</span>}
                            </div>
                        );
                    })}
                </div>
                {p.isHost && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                        <button className="ws-btn primary" onClick={() => (p.MP as any).restartGame()}>Play again</button>
                    </div>
                )}
            </div>

            {p.advanced && p.goals && <GoalsStrip goals={p.goals} />}

            <div className="ws-review-players">
                <div className="ws-section-title" style={{ marginTop: 12 }}>
                    Final Player Tableaus &amp; Hands
                </div>
                {ranked.map((id) => {
                    const pub = p.publicPlayers[id];
                    if (!pub) return null;
                    const accent = p.playerAccents[id];
                    const isWin = winners.has(id);
                    const flock = pub.flock || [];
                    const reserve = (id === p.MP.clientId ? p.myReserve : pub.reserve) || [];
                    const birdsInHand = reserve.filter(r => r.face === 'bird');
                    const foodInHand = reserve.filter(r => r.face === 'food');

                    return (
                        <div key={id} className={['ws-review-card', isWin ? 'winner' : ''].join(' ')} style={{ borderColor: accent }}>
                            <div className="ws-review-head">
                                <div className="ws-review-player-info">
                                    <span className="ws-review-name" style={{ color: accent }}>{p.playerNames[id]}</span>
                                    {isWin && <span className="ws-winner-tag">🏆 Winner</span>}
                                    <span className="ws-review-total">{scores[id] ?? pub.score?.total ?? 0} pts</span>
                                </div>
                                <div className="ws-review-breakdown">
                                    {pub.score && (
                                        <>
                                            <strong>{pub.score.vp}</strong> bird · <strong>{pub.score.eggs}</strong> egg · <strong>{pub.score.tucked}</strong> tuck{p.advanced ? ` · <strong>${pub.score.goals}</strong> goal` : ''}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Flock */}
                            <div className="ws-review-sublabel">Flock ({flock.length}/6 birds)</div>
                            <div className="ws-flock-row" style={{ overflowX: 'auto', paddingBottom: 4 }}>
                                <NestSlot eggs={pub.nestEggs} />
                                {flock.map((c, i) => {
                                    const matchingGoals = p.advanced ? getMatchingGoalsForFlockBird(flock, i, p.goals) : [];
                                    return (
                                        <BirdInPlay
                                            key={i}
                                            inPlay={c}
                                            width={118}
                                            accent={accent}
                                            matchingGoals={matchingGoals}
                                            onClick={() => onInspectBird(c.cardId)}
                                        />
                                    );
                                })}
                                {flock.length === 0 && <span className="ws-muted pad">No birds played</span>}
                            </div>

                            {/* Hand / Reserve cards */}
                            <div className="ws-review-sublabel" style={{ marginTop: 10 }}>
                                Hand cards remaining ({reserve.length})
                            </div>
                            <div className="ws-review-hand-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
                                {birdsInHand.map((r, idx) => (
                                    <div
                                        key={`b-${r.cardId}-${idx}`}
                                        className="ws-reserve-bird wingspan-card"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => onInspectBird(r.cardId)}
                                        title={`${CARD_BY_ID[r.cardId]?.common_name} - Click to view`}
                                    >
                                        <PlayingCard
                                            card={getWingspanCardDefinition(CARD_BY_ID[r.cardId])}
                                            width="100px"
                                            customIcons={WINGSPAN_ICONS}
                                        />
                                    </div>
                                ))}
                                {foodInHand.map((r, idx) => (
                                    <div key={`f-${r.cardId}-${idx}`} className="ws-reserve-food">
                                        <FoodTile cardId={r.cardId} width={82} />
                                    </div>
                                ))}
                                {reserve.length === 0 && <span className="ws-muted pad">No hand cards remaining</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// Rules reference
// ============================================================================

/** A little scoring/threshold table. */
const Ladder: React.FC<{ head: string; cols: [string, string][] }> = ({ head, cols }) => (
    <div className="ws-ladder">
        <span className="ws-ladder-head">{head}</span>
        <div className="ws-ladder-grid">
            {cols.map(([k, v], i) => <div key={i} className="ws-ladder-cell"><span>{k}</span><b>{v}</b></div>)}
        </div>
    </div>
);

/** One labelled row in the "bird powers" legend. */
const BonusRow: React.FC<{ icon?: string; badge?: string; name: string; children: React.ReactNode }> = ({ icon, badge, name, children }) => (
    <div className="ws-bonus">
        <span className="ws-bonus-ico">{icon ? <Icon id={icon} size={30} /> : <span className="ws-bonus-badge">{badge}</span>}</span>
        <div><b>{name}</b><div className="ws-muted">{children}</div></div>
    </div>
);

const RulesView: React.FC = () => {
    const ex = BIRD_CARDS.find(c => c.common_name === 'American Robin') || BIRD_CARDS[0]; // example card
    return (
        <div className="ws-rules">
            <h3>Wingspan Pocket</h3>
            <p>Attract birds to your flock. Every bird carries a power that can trigger again and again, so the birds you play early <b>compound</b> over the game. The moment a player reaches <b>6 birds</b>, finish the round so everyone has had equal turns — then the most points wins. 2–5 players.</p>

            <h4>Every card is three things</h4>
            <p>Each card is double-sided: a <b>bird</b> on one face and a single <b>food</b> on the other. The same card can be <b>played</b> as a bird, <b>spent</b> as food to pay a cost, or <b>tucked</b> behind a bird for a point — but only one of those, once. Deciding what to sacrifice is the heart of the game.</p>

            {/* ---------- annotated example card ---------- */}
            <h4>Reading a bird card</h4>
            <div className="ws-rules-card">
                <div className="wingspan-card ws-rules-cardart"><PlayingCard card={getWingspanCardDefinition(ex, { detail: true })} width="150px" customIcons={WINGSPAN_ICONS} /></div>
                <div className="ws-rules-legend">
                    <div className="ws-leg"><span className="ws-leg-ico"><Icon id="feather" size={22} /></span><div><b>Victory points</b> — the feather chip (top-right). Scored if the bird is in your flock at game end. This one is worth <b>{ex.victory_points}</b>.</div></div>
                    <div className="ws-leg"><span className="ws-leg-ico"><Icon id={foodIconId('invertebrate')} size={22} /><Icon id="egg_coin" size={22} /></span><div><b>Cost</b> — the coins along the top of the panel: the food (and sometimes an egg) you pay to play it.</div></div>
                    <div className="ws-leg"><span className="ws-leg-ico"><Icon id="egg_coin" size={22} /></span><div><b>Egg limit</b> — the most eggs this bird can ever hold ({ex.egg_limit} here). It matters for laying and for goals.</div></div>
                    <div className="ws-leg"><span className="ws-leg-ico"><Icon id="wing" size={22} /></span><div><b>Wingspan</b> — its size in cm ({ex.wingspan_cm}). Referenced by <b>Hunt</b> powers and some goals.</div></div>
                    <div className="ws-leg"><span className="ws-leg-ico"><Icon id={birdIconId(ex.shape)} size={26} /></span><div><b>The bird</b> — flavour; and the tinted bottom band is its <b>power</b>. A <span className="ws-pw-brown">tan</span> band is a <i>brown</i> power you activate on your turn; a <span className="ws-pw-green">green</span> band is a <i>green</i> power that is always on.</div></div>
                </div>
            </div>

            <h4>Your turn — one action, then activate</h4>
            <p>Take exactly <b>one</b> of these, then walk your flock:</p>
            <ul>
                <li><b>Play a bird</b> from your reserve — pay its cost, add it to the right end of your flock.</li>
                <li><b>Draw 2 cards</b> — any mix of the face-up <b>supply birds</b> and <b>food</b> from the decks. Each deck shows its top food, so you can see what you'd draw.</li>
                <li><b>Lay up to 3 eggs</b> — each on a <b>different</b> bird (or your Nest) that is below its egg limit.</li>
            </ul>
            <p>Then move left→right along your flock: each <b>brown</b> bird may trigger its power (optional — you choose <i>what</i> to draw, tuck, etc.). <b>Green</b> birds are skipped; their power is already always on.</p>

            <h4>Paying a cost</h4>
            <p>A cost is shown as coins: specific foods, a wild <b>[any]</b> that any one food covers, and sometimes an <b>egg</b>.</p>
            <ul>
                <li>Spend matching <b>food cards</b> from your reserve. A card printed with <b>two</b> foods counts as <b>either</b> one.</li>
                <li><b>2-for-1 conversion</b> — missing a food? Spend <b>any 2 food cards</b> as <b>1 food of the type you need</b>. A bird can therefore cost you extra cards when you lack the exact foods.</li>
                <li><b>Eggs are never food.</b> The 2-for-1 conversion <b>cannot</b> create or stand in for an egg — an egg pip must be paid with a real egg.</li>
                <li><b>Eggs come from anywhere.</b> Pay an egg cost with an egg from your <b>Nest <i>or</i> from any bird</b> in your flock that is holding eggs — a laid egg is just a spendable resource.</li>
            </ul>
            <div className="ws-foodkey">
                {FOOD_TYPES.map(f => <span key={f} className="ws-foodkey-item"><Icon id={foodIconId(f)} size={30} /><small>{f}</small></span>)}
                <span className="ws-foodkey-item"><Icon id="any_coin" size={30} /><small>any</small></span>
                <span className="ws-foodkey-item"><Icon id="egg_coin" size={30} /><small>egg</small></span>
            </div>

            <h4>Bird powers</h4>
            <p>When you activate a <b>brown</b> bird you decide how it resolves. The building blocks:</p>
            <div className="ws-bonuses">
                <BonusRow icon="any_coin" name="Draw / gain">Take a <b>food</b> (you pick which deck) or a face-up <b>bird</b> into your reserve.</BonusRow>
                <BonusRow icon="feather" name="Tuck">Slide a reserve card face-down behind this bird. Each tucked card is worth <b>1 point</b> and can fuel "tuck to…" powers.</BonusRow>
                <BonusRow icon="egg" name="Lay an egg">Add an egg to a bird (or the Nest) below its limit. Each egg is worth <b>1 point</b>.</BonusRow>
                <BonusRow icon={birdIconId('raptor')} name="Hunt">Peek the top of a food deck; if the bird on its back is small enough (wingspan under the limit) <b>tuck</b> it (1 pt), otherwise <b>discard</b> it.</BonusRow>
                <BonusRow badge="✕" name="Discard (pay-first)">Some powers make you <b>pay</b> first — discard a food, an egg, or a card — to earn a bigger reward. No payment, no reward.</BonusRow>
                <BonusRow badge="→" name="“then” &amp; “or”">An arrow <b>→</b> means do the left, then you may do the right. Two icons with <i>no</i> arrow are independent. "<b>A or B</b>" lets you choose one.</BonusRow>
            </div>
            <p><b>Green powers</b> never activate — they're continuous. e.g. <i>use one food as any when paying</i>, <i>pay one fewer of a food</i>, or <i>a food named in a power counts as any</i>.</p>

            <h4>Scoring</h4>
            <p>When the game ends, add up every source below:</p>
            <div className="ws-ladders">
                <Ladder head="Each source of points" cols={[['Bird', 'feather'], ['Egg', '1 ea'], ['Tuck', '1 ea'], ['Goal', '1 / egg']]} />
            </div>
            <ul>
                <li><b>Birds</b> — the <b>feather value</b> of every bird in your flock.</li>
                <li><b>Eggs</b> — <b>1 point per egg</b>, counting eggs on <i>every</i> bird <b>and</b> on your Nest.</li>
                <li><b>Tucked cards</b> — <b>1 point</b> each, across all your birds.</li>
                <li><b>Goals</b> (advanced only) — each of the two goals scores <b>1 point per egg</b> resting on one of your birds that <b>matches</b> it (e.g. "wingspan ≥ 66"). It's per <b>egg</b>, not per bird — so stacking eggs on goal-matching birds compounds, and the <b>same egg</b> can score on <b>both</b> goals.</li>
            </ul>
            <p className="ws-muted">Tie-break: most cards remaining in your reserve; still tied → shared victory.</p>
        </div>
    );
};

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
    supply: { supplyBirds: (number | null)[]; foodDeckCounts: number[]; foodDeckTops: (number | null)[]; foodDecks?: number[][] };
    reserve: ReserveCard[];
    flock: CardInPlay[];
    nestEggs: number;
    onResolve: (choices: ActivationChoices) => void;
    onSkip: () => void;
    onClose: () => void;
}
interface ActivationModalState {
    branch: number | null;
    stepIndex: number;
    stagedChoices: ActivationChoices;
    virtualReserve: ReserveCard[];
    virtualSupplyBirds: (number | null)[];
    virtualFoodDecks: number[][];
    virtualFoodDeckCounts: number[];
    virtualFoodDeckTops: (number | null)[];
    pendingPick:
        | { kind: 'bird'; slot: number }
        | { kind: 'food'; deck: number }
        | { kind: 'discardFood'; cardId: number }
        | null;
    eggTargets: number[];
    missedFoods: string[];
    revealedInfo: boolean;
    huntResult: {
        deck: number;
        cardId: number;
        max: number;
        success: boolean;
    } | null;
}

class ActivationModal extends React.Component<ActivationModalProps, ActivationModalState> {
    constructor(props: ActivationModalProps) {
        super(props);
        const initialDecks = props.supply.foodDecks
            ? props.supply.foodDecks.map(d => [...d])
            : props.supply.foodDeckTops.map(t => t != null ? [t] : []);
        this.state = {
            branch: null,
            stepIndex: 0,
            stagedChoices: {},
            virtualReserve: props.reserve.map(r => ({ ...r })),
            virtualSupplyBirds: [...props.supply.supplyBirds],
            virtualFoodDecks: initialDecks,
            virtualFoodDeckCounts: [...props.supply.foodDeckCounts],
            virtualFoodDeckTops: [...props.supply.foodDeckTops],
            pendingPick: null,
            eggTargets: [],
            missedFoods: [],
            revealedInfo: false,
            huntResult: null
        };
    }

    /** send choices, folding in the selected choose_one branch */
    private resolve = (choices: ActivationChoices) => {
        this.props.onResolve(this.state.branch !== null ? { ...choices, branch: this.state.branch } : choices);
    };

    private handleSkip = () => {
        const isRevealed = this.state.revealedInfo || this.state.huntResult !== null;
        if (isRevealed && this.state.stepIndex > 0 && Object.keys(this.state.stagedChoices).length > 0) {
            this.resolve(this.state.stagedChoices);
        } else {
            this.props.onSkip();
        }
    };

    private advanceOrResolve = (stepChoices: ActivationChoices) => {
        const { card } = this.props;
        const eff = card.power.effect;
        const active = resolveBranchEffect(eff, this.state.branch);
        const picks = getPicks(active);
        const nextChoices = { ...this.state.stagedChoices };

        if (stepChoices.tuckCardId != null) {
            const list = nextChoices.tuckCardIds ? [...nextChoices.tuckCardIds] : (nextChoices.tuckCardId != null ? [nextChoices.tuckCardId] : []);
            list.push(stepChoices.tuckCardId);
            nextChoices.tuckCardIds = list;
            nextChoices.tuckCardId = list[0];
        }

        const drawPicks = nextChoices.drawPicks ? [...nextChoices.drawPicks] : [];
        if (stepChoices.drawCardKind === 'bird' && stepChoices.supplyBird != null) {
            drawPicks.push({ kind: 'bird', index: stepChoices.supplyBird });
        } else if (stepChoices.drawCardKind === 'food' && stepChoices.foodDeck != null) {
            drawPicks.push({ kind: 'food', index: stepChoices.foodDeck });
        } else if (stepChoices.supplyBird != null) {
            drawPicks.push({ kind: 'bird', index: stepChoices.supplyBird });
        } else if (stepChoices.foodDeck != null) {
            drawPicks.push({ kind: 'food', index: stepChoices.foodDeck });
        }
        if (drawPicks.length > 0) {
            nextChoices.drawPicks = drawPicks;
        }

        Object.assign(nextChoices, stepChoices);
        if (nextChoices.tuckCardIds) {
            nextChoices.tuckCardIds = [...nextChoices.tuckCardIds];
        }

        // Update virtual reserve and virtual supply for subsequent steps in this activation
        const nextReserve = [...this.state.virtualReserve];
        const nextSupplyBirds = [...this.state.virtualSupplyBirds];
        const nextFoodDecks = this.state.virtualFoodDecks.map(d => [...d]);
        const nextFoodCounts = [...this.state.virtualFoodDeckCounts];
        const nextFoodTops = [...this.state.virtualFoodDeckTops];

        let hasNewRevealedInfo = this.state.revealedInfo;

        if (stepChoices.foodDeck != null && (stepChoices.drawCardKind === 'food' || stepChoices.supplyBird == null)) {
            const d = stepChoices.foodDeck;
            const vDeck = nextFoodDecks[d];
            if (vDeck && vDeck.length > 0) {
                const topId = vDeck.pop()!;
                nextReserve.push({ cardId: topId, face: 'food' });
                nextFoodCounts[d] = vDeck.length;
                nextFoodTops[d] = vDeck.length > 0 ? vDeck[vDeck.length - 1] : null;
                hasNewRevealedInfo = true;
            } else if (nextFoodTops[d] != null) {
                const topId = nextFoodTops[d]!;
                nextReserve.push({ cardId: topId, face: 'food' });
                nextFoodCounts[d] = Math.max(0, nextFoodCounts[d] - 1);
                nextFoodTops[d] = null;
                hasNewRevealedInfo = true;
            }
        }
        if (stepChoices.supplyBird != null && stepChoices.drawCardKind !== 'food') {
            const s = stepChoices.supplyBird;
            const birdId = nextSupplyBirds[s];
            if (birdId != null) {
                nextReserve.push({ cardId: birdId, face: 'bird' });
                nextSupplyBirds[s] = null; // Mark slot empty so it cannot be selected again
            }
        }
        if (stepChoices.tuckCardId != null) {
            const idx = nextReserve.findIndex(r => r.cardId === stepChoices.tuckCardId);
            if (idx !== -1) nextReserve.splice(idx, 1);
        }
        if (stepChoices.payFoodCardId != null) {
            const idx = nextReserve.findIndex(r => r.cardId === stepChoices.payFoodCardId);
            if (idx !== -1) nextReserve.splice(idx, 1);
        }

        if (this.state.stepIndex + 1 < picks.length) {
            this.setState({
                stagedChoices: nextChoices,
                virtualReserve: nextReserve,
                virtualSupplyBirds: nextSupplyBirds,
                virtualFoodDecks: nextFoodDecks,
                virtualFoodDeckCounts: nextFoodCounts,
                virtualFoodDeckTops: nextFoodTops,
                pendingPick: null,
                revealedInfo: hasNewRevealedInfo,
                stepIndex: this.state.stepIndex + 1
            });
        } else {
            this.resolve(nextChoices);
        }
    };

    private deckPicker(onPick: (deck: number) => void, decks?: number[]) {
        const list = decks ?? this.state.virtualFoodDeckCounts.map((_, d) => d).filter(d => this.state.virtualFoodDeckCounts[d] > 0);
        if (list.length === 0) return <div className="ws-muted pad">All food decks are empty.</div>;
        return (
            <div className="ws-act-grid">
                {list.map(d => {
                    const top = this.state.virtualFoodDeckTops[d];
                    const isSelected = this.state.pendingPick?.kind === 'food' && this.state.pendingPick.deck === d;
                    return (
                        <button
                            key={d}
                            type="button"
                            className={['ws-act-tile', isSelected ? 'selected' : ''].join(' ')}
                            disabled={this.state.virtualFoodDeckCounts[d] === 0}
                            onClick={() => onPick(d)}
                        >
                            {top == null
                                ? <div className="ws-food-face" style={{ width: 72, height: 100 }}><span className="ws-muted">—</span></div>
                                : <FoodTile cardId={top} width={72} />}
                            <span className="ws-act-count">{this.state.virtualFoodDeckCounts[d]}</span>
                            {isSelected && <div className="ws-pick-badge">✓ Selected</div>}
                        </button>
                    );
                })}
            </div>
        );
    }

    private birdPicker(filter: DrawBirdFilter | undefined, onPick: (slot: number) => void) {
        const slots = this.state.virtualSupplyBirds
            .map((cid, slot) => ({ cid, slot }))
            .filter(x => x.cid != null && birdMatchesFilter(x.cid, filter));
        if (slots.length === 0) return <div className="ws-muted pad">No matching bird in the supply.</div>;
        return (
            <div className="ws-act-grid">
                {slots.map(({ cid, slot }) => {
                    const isSelected = this.state.pendingPick?.kind === 'bird' && this.state.pendingPick.slot === slot;
                    return (
                        <button
                            key={slot}
                            type="button"
                            className={['ws-act-tile wingspan-card', isSelected ? 'selected' : ''].join(' ')}
                            onClick={() => onPick(slot)}
                        >
                            <PlayingCard card={getWingspanCardDefinition(CARD_BY_ID[cid as number])} width="96px" customIcons={WINGSPAN_ICONS} />
                            {isSelected && <div className="ws-pick-badge">✓ Selected</div>}
                        </button>
                    );
                })}
            </div>
        );
    }

    public render() {
        const { card } = this.props;
        const eff = card.power.effect;
        const isRevealed = this.state.revealedInfo || this.state.huntResult !== null;
        const canCancel = !isRevealed;

        // choose_one: pick the branch first (supports top-level or gated.pay choose_one)
        const chooseOneInfo = getChooseOneOptions(eff);
        if (chooseOneInfo && this.state.branch === null) {
            // Check if this is a top-level choose_one where all options are draw_food (e.g. American Redstart: [draw_invertebrate] or [draw_fruit])
            const isAllDrawFood = eff.op === 'choose_one' && eff.options.every(o => o.op === 'draw_food' || o.op === 'gain_food');
            if (isAllDrawFood) {
                const drawFoodOptions = eff.options.map((o, idx) => ({
                    branch: idx,
                    food: (o.op === 'draw_food' || o.op === 'gain_food') ? o.food : 'any'
                }));
                const wantedFoodNames = drawFoodOptions.map(o => o.food === 'any' ? 'food' : o.food);
                const deckCounts = this.state.virtualFoodDeckCounts;
                const deckTops = this.state.virtualFoodDeckTops;

                // Find eligible decks that match any of the wanted food options
                const eligible = deckCounts
                    .map((_, d) => d)
                    .filter(d => {
                        if (deckCounts[d] === 0) return false;
                        const topId = deckTops[d];
                        if (topId == null) return false;
                        const cardFoods = CARD_BY_ID[topId].reverse_food;
                        return drawFoodOptions.some(opt => opt.food === 'any' || cardFoods.includes(opt.food));
                    });

                let promptText: string;
                let bodyContent: React.ReactNode;

                if (eligible.length === 0) {
                    promptText = `No ${wantedFoodNames.join(' or ')} available in the supply`;
                    bodyContent = (
                        <div className="ws-muted pad" style={{ textAlign: 'center' }}>
                            <div>
                                There is currently no <strong>{wantedFoodNames.join(' or ')}</strong> visible on any food deck in the supply.
                            </div>
                            <div style={{ marginTop: 12, fontSize: '0.88em' }}>
                                Click <strong>Skip power</strong> below to finish your turn.
                            </div>
                        </div>
                    );
                } else {
                    promptText = `Choose which ${wantedFoodNames.join(' or ')} to draw`;
                    const pickInfo = this.state.pendingPick;
                    let pickLabel = '';
                    if (pickInfo && pickInfo.kind === 'food') {
                        const topId = this.state.virtualFoodDeckTops[pickInfo.deck];
                        pickLabel = topId != null ? CARD_BY_ID[topId].reverse_food.join(' / ') : `Deck ${pickInfo.deck + 1}`;
                    }
                    bodyContent = (
                        <>
                            {this.deckPicker(d => this.setState({ pendingPick: { kind: 'food', deck: d } }), eligible)}
                            <div style={{ marginTop: 14 }}>
                                <button
                                    className="ws-btn primary block"
                                    disabled={!pickInfo || pickInfo.kind !== 'food'}
                                    onClick={() => {
                                        if (pickInfo && pickInfo.kind === 'food') {
                                            const topId = this.state.virtualFoodDeckTops[pickInfo.deck];
                                            const cardFoods = topId != null ? CARD_BY_ID[topId].reverse_food : [];
                                            const matchedOpt = drawFoodOptions.find(o => o.food === 'any' || cardFoods.includes(o.food)) || drawFoodOptions[0];
                                            this.resolve({ branch: matchedOpt.branch, foodDeck: pickInfo.deck });
                                        }
                                    }}
                                >
                                    {pickInfo && pickInfo.kind === 'food' ? `Confirm: Draw ${pickLabel} →` : 'Select a food deck above'}
                                </button>
                            </div>
                        </>
                    );
                }

                return (
                    <Modal title={`Activate ${card.common_name}`} onClose={canCancel ? this.props.onClose : undefined} wide>
                        <div className="ws-act">
                            <div className="ws-act-prompt">{promptText}</div>
                            {bodyContent}
                            <button className="ws-btn ghost small" onClick={this.props.onSkip}>Skip power</button>
                        </div>
                    </Modal>
                );
            }

            // Check if all options are discard food (e.g. Bearded Reedling / Great Tit: [discard_invertebrate] or [discard_seed] [arrow] [lay_egg])
            const isAllDiscardFood = chooseOneInfo.options.every(o => o.op === 'discard' && o.what === 'food');
            if (isAllDiscardFood) {
                const discardOptions = chooseOneInfo.options.map((o, idx) => ({
                    branch: idx,
                    food: (o.op === 'discard' && o.what === 'food') ? o.food : 'any'
                }));
                const wantedFoodNames = discardOptions.map(o => !o.food || o.food === 'any' ? 'food' : o.food);
                const foodCards = this.state.virtualReserve.filter(r => r.face === 'food');

                // Find eligible food cards in reserve that match any discard option
                const eligibleCards = foodCards.filter(r => {
                    const cardFoods = CARD_BY_ID[r.cardId].reverse_food;
                    return discardOptions.some(opt => !opt.food || opt.food === 'any' || cardFoods.includes(opt.food));
                });

                let promptText: string;
                let bodyContent: React.ReactNode;

                if (eligibleCards.length === 0) {
                    promptText = `No ${wantedFoodNames.join(' or ')} in your reserve`;
                    bodyContent = (
                        <div className="ws-muted pad" style={{ textAlign: 'center' }}>
                            <div>
                                You do not have any <strong>{wantedFoodNames.join(' or ')}</strong> card in your reserve to discard.
                            </div>
                            <div style={{ marginTop: 12, fontSize: '0.88em' }}>
                                Click <strong>Skip power</strong> below to finish your turn.
                            </div>
                        </div>
                    );
                } else {
                    promptText = `Choose which ${wantedFoodNames.join(' or ')} card to discard`;
                    const pickInfo = this.state.pendingPick;
                    let pickLabel = '';
                    if (pickInfo && pickInfo.kind === 'discardFood') {
                        const c = CARD_BY_ID[pickInfo.cardId];
                        pickLabel = c ? c.reverse_food.join(' / ') : 'Card';
                    }
                    bodyContent = (
                        <>
                            <div className="ws-act-grid">
                                {eligibleCards.map((r, i) => {
                                    const isSelected = this.state.pendingPick?.kind === 'discardFood' && this.state.pendingPick.cardId === r.cardId;
                                    return (
                                        <button
                                            key={`${r.cardId}-${i}`}
                                            type="button"
                                            className={['ws-act-tile', isSelected ? 'selected' : ''].join(' ')}
                                            onClick={() => this.setState({ pendingPick: { kind: 'discardFood', cardId: r.cardId } })}
                                        >
                                            <FoodTile cardId={r.cardId} width={72} />
                                            {isSelected && <div className="ws-pick-badge">✓ Selected</div>}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ marginTop: 14 }}>
                                <button
                                    className="ws-btn primary block"
                                    disabled={!pickInfo || pickInfo.kind !== 'discardFood'}
                                    onClick={() => {
                                        if (pickInfo && pickInfo.kind === 'discardFood') {
                                            const chosenCard = CARD_BY_ID[pickInfo.cardId];
                                            const cardFoods = chosenCard.reverse_food;
                                            const matchedOpt = discardOptions.find(opt => !opt.food || opt.food === 'any' || cardFoods.includes(opt.food)) || discardOptions[0];
                                            const resolvedEff = chooseOneInfo.makeEffect(chooseOneInfo.options[matchedOpt.branch]);
                                            const subPicks = getPicks(resolvedEff);
                                            if (subPicks.length <= 1) {
                                                this.props.onResolve({ branch: matchedOpt.branch, payFoodCardId: pickInfo.cardId });
                                            } else {
                                                const nextReserve = this.state.virtualReserve.filter(r => r.cardId !== pickInfo.cardId);
                                                this.setState({
                                                    branch: matchedOpt.branch,
                                                    stepIndex: 1,
                                                    stagedChoices: { branch: matchedOpt.branch, payFoodCardId: pickInfo.cardId },
                                                    virtualReserve: nextReserve,
                                                    pendingPick: null,
                                                    eggTargets: []
                                                });
                                            }
                                        }
                                    }}
                                >
                                    {pickInfo && pickInfo.kind === 'discardFood' ? `Confirm: Discard ${pickLabel} →` : 'Select a food card above'}
                                </button>
                            </div>
                        </>
                    );
                }

                return (
                    <Modal title={`Activate ${card.common_name}`} onClose={canCancel ? this.props.onClose : undefined} wide>
                        <div className="ws-act">
                            <div className="ws-act-prompt">{promptText}</div>
                            {bodyContent}
                            <button className="ws-btn ghost small" onClick={this.props.onSkip}>Skip power</button>
                        </div>
                    </Modal>
                );
            }

            return (
                <Modal title={`Activate ${card.common_name}`} onClose={canCancel ? this.props.onClose : undefined} wide>
                    <div className="ws-act">
                        <div className="ws-act-prompt">Choose one</div>
                        <div className="ws-act-branches">
                            {chooseOneInfo.options.map((o, i) => {
                                const resolvedEff = chooseOneInfo.makeEffect(o);
                                return (
                                    <button key={i} className="ws-btn primary" onClick={() => {
                                        const subPicks = getPicks(resolvedEff);
                                        if (subPicks.length === 0) {
                                            this.props.onResolve({ branch: i });
                                        } else {
                                            this.setState({
                                                branch: i,
                                                stepIndex: 0,
                                                stagedChoices: { branch: i },
                                                virtualReserve: this.props.reserve.map(r => ({ ...r })),
                                                virtualSupplyBirds: [...this.props.supply.supplyBirds],
                                                virtualFoodDecks: this.props.supply.foodDecks
                                                    ? this.props.supply.foodDecks.map(d => [...d])
                                                    : this.props.supply.foodDeckTops.map(t => t != null ? [t] : []),
                                                virtualFoodDeckCounts: [...this.props.supply.foodDeckCounts],
                                                virtualFoodDeckTops: [...this.props.supply.foodDeckTops],
                                                pendingPick: null,
                                                eggTargets: [],
                                                missedFoods: [],
                                                revealedInfo: false,
                                                huntResult: null
                                            });
                                        }
                                    }}>{describePower(resolvedEff)}</button>
                                );
                            })}
                        </div>
                        <button className="ws-btn ghost small" onClick={this.props.onSkip}>Skip power</button>
                    </div>
                </Modal>
            );
        }

        const active = resolveBranchEffect(eff, this.state.branch);
        const picks = getPicks(active);

        let prompt = describePower(active);
        let body: React.ReactNode;

        if (picks.length === 0) {
            body = <button className="ws-btn primary block" onClick={() => this.resolve({})}>Activate</button>;
        } else {
            const pick = picks[Math.min(this.state.stepIndex, picks.length - 1)];
            const stepPrefix = picks.length > 1 ? `(Step ${this.state.stepIndex + 1} of ${picks.length}) ` : '';

            if (pick.kind === 'chooseFood') {
                const eligible = eligibleDecks({ foodDeckCounts: this.state.virtualFoodDeckCounts, foodDeckTops: this.state.virtualFoodDeckTops }, pick.food);
                if (eligible.length === 0) {
                    const foodName = pick.food === 'any' ? 'food' : pick.food;
                    const hasNext = this.state.stepIndex + 1 < picks.length;
                    prompt = `${stepPrefix}No ${foodName} available in the supply`;
                    body = (
                        <div className="ws-muted pad" style={{ textAlign: 'center' }}>
                            <div>There is currently no <strong>{foodName}</strong> visible on any food deck in the supply.</div>
                            {hasNext ? (
                                <div style={{ marginTop: 14 }}>
                                    <button
                                        className="ws-btn primary small"
                                        onClick={() => {
                                            const updatedMissed = this.state.missedFoods.includes(foodName)
                                                ? this.state.missedFoods
                                                : [...this.state.missedFoods, foodName];
                                            this.setState({ missedFoods: updatedMissed }, () => {
                                                this.advanceOrResolve({});
                                            });
                                        }}
                                    >
                                        Next Step →
                                    </button>
                                </div>
                            ) : (
                                <div style={{ marginTop: 12, fontSize: '0.88em' }}>
                                    Click <strong>Skip power</strong> below to finish your turn.
                                </div>
                            )}
                        </div>
                    );
                } else {
                    prompt = `${stepPrefix}${pick.food === 'any' ? 'Choose a food deck to draw from' : `Choose which ${pick.food} to draw`}`;
                    const pickInfo = this.state.pendingPick;
                    let pickLabel = '';
                    if (pickInfo && pickInfo.kind === 'food') {
                        const topId = this.state.virtualFoodDeckTops[pickInfo.deck];
                        pickLabel = topId != null ? CARD_BY_ID[topId].reverse_food.join(' / ') : `Deck ${pickInfo.deck + 1}`;
                    }
                    body = (
                        <>
                            {this.deckPicker(d => this.setState({ pendingPick: { kind: 'food', deck: d } }), eligible)}
                            <div style={{ marginTop: 14 }}>
                                <button
                                    className="ws-btn primary block"
                                    disabled={!pickInfo || pickInfo.kind !== 'food'}
                                    onClick={() => {
                                        if (pickInfo && pickInfo.kind === 'food') {
                                            this.advanceOrResolve({ foodDeck: pickInfo.deck });
                                        }
                                    }}
                                >
                                    {pickInfo && pickInfo.kind === 'food' ? `Confirm: Draw ${pickLabel} →` : 'Select a food deck above'}
                                </button>
                            </div>
                        </>
                    );
                }
            } else if (pick.kind === 'hunt') {
                if (this.state.huntResult) {
                    const hr = this.state.huntResult;
                    const huntedBird = CARD_BY_ID[hr.cardId];
                    prompt = hr.success ? 'Hunt Successful!' : 'Hunt Failed';
                    body = (
                        <div className="ws-hunt-result">
                            <div className="wingspan-card" style={{
                                boxShadow: hr.success ? '0 0 0 3px #5cb87f, 0 8px 24px rgba(92,184,127,0.3)' : '0 0 0 3px #d9534f, 0 8px 24px rgba(217,83,79,0.3)',
                                borderRadius: 10
                            }}>
                                <PlayingCard card={getWingspanCardDefinition(huntedBird)} width="130px" customIcons={WINGSPAN_ICONS} />
                            </div>
                            <div className="ws-hunt-details">
                                <div className={['ws-hunt-badge', hr.success ? 'success' : 'failure'].join(' ')}>
                                    {hr.success ? '✓ Prey Caught' : '✗ Prey Escaped'}
                                </div>
                                <div className="ws-hunt-name">
                                    <strong>{huntedBird.common_name}</strong> ({huntedBird.wingspan_cm} cm)
                                </div>
                                <div className="ws-hunt-comparison">
                                    Wingspan limit: &lt; {hr.max} cm
                                </div>
                                <div className="ws-hunt-msg">
                                    {hr.success
                                        ? 'The bird is tucked under this predator (+1 point).'
                                        : 'The bird was too large and escaped to the discard pile.'}
                                </div>
                            </div>
                            <button
                                className="ws-btn primary"
                                style={{ minWidth: 140 }}
                                onClick={() => {
                                    const d = hr.deck;
                                    this.setState({ huntResult: null }, () => {
                                        this.advanceOrResolve({ foodDeck: d });
                                    });
                                }}
                            >
                                Continue
                            </button>
                        </div>
                    );
                } else {
                    prompt = `${stepPrefix}Choose a deck to hunt from (wingspan < ${pick.max} cm)`;
                    body = this.deckPicker(d => {
                        const topId = this.state.virtualFoodDeckTops[d];
                        if (topId != null) {
                            const card = CARD_BY_ID[topId];
                            this.setState({
                                huntResult: {
                                    deck: d,
                                    cardId: topId,
                                    max: pick.max,
                                    success: card.wingspan_cm < pick.max
                                }
                            });
                        } else {
                            this.advanceOrResolve({ foodDeck: d });
                        }
                    });
                }
            } else if (pick.kind === 'drawBird') {
                prompt = `${stepPrefix}Choose a bird to draw`;
                const pickInfo = this.state.pendingPick;
                let pickLabel = '';
                if (pickInfo && pickInfo.kind === 'bird') {
                    const cardId = this.state.virtualSupplyBirds[pickInfo.slot];
                    pickLabel = cardId != null ? CARD_BY_ID[cardId].common_name : 'Bird';
                }
                body = (
                    <>
                        {this.birdPicker(pick.filter, s => this.setState({ pendingPick: { kind: 'bird', slot: s } }))}
                        <div style={{ marginTop: 14 }}>
                            <button
                                className="ws-btn primary block"
                                disabled={!pickInfo || pickInfo.kind !== 'bird'}
                                onClick={() => {
                                    if (pickInfo && pickInfo.kind === 'bird') {
                                        this.advanceOrResolve({ supplyBird: pickInfo.slot });
                                    }
                                }}
                            >
                                {pickInfo && pickInfo.kind === 'bird' ? `Confirm: Draw ${pickLabel} →` : 'Select a bird above'}
                            </button>
                        </div>
                    </>
                );
            } else if (pick.kind === 'drawCard') {
                prompt = `${stepPrefix}Draw a bird or a food`;
                const pickInfo = this.state.pendingPick;
                let pickLabel = '';
                if (pickInfo) {
                    if (pickInfo.kind === 'bird') {
                        const cardId = this.state.virtualSupplyBirds[pickInfo.slot];
                        pickLabel = cardId != null ? CARD_BY_ID[cardId].common_name : 'Bird';
                    } else if (pickInfo.kind === 'food') {
                        const topId = this.state.virtualFoodDeckTops[pickInfo.deck];
                        pickLabel = topId != null ? CARD_BY_ID[topId].reverse_food.join(' / ') : `Food Deck ${pickInfo.deck + 1}`;
                    }
                }
                body = (
                    <>
                        <div className="ws-act-sub">Birds in supply</div>
                        {this.birdPicker(undefined, s => this.setState({ pendingPick: { kind: 'bird', slot: s } }))}
                        <div className="ws-act-sub">Food decks</div>
                        {this.deckPicker(d => this.setState({ pendingPick: { kind: 'food', deck: d } }))}
                        <div style={{ marginTop: 14 }}>
                            <button
                                className="ws-btn primary block"
                                disabled={!pickInfo}
                                onClick={() => {
                                    if (!pickInfo) return;
                                    if (pickInfo.kind === 'bird') {
                                        this.advanceOrResolve({ drawCardKind: 'bird', supplyBird: pickInfo.slot });
                                    } else if (pickInfo.kind === 'food') {
                                        this.advanceOrResolve({ drawCardKind: 'food', foodDeck: pickInfo.deck });
                                    }
                                }}
                            >
                                {pickInfo ? `Confirm: Draw ${pickLabel} →` : 'Select a card or food deck above'}
                            </button>
                        </div>
                    </>
                );
            } else if (pick.kind === 'tuck') {
                const targetLabel = pick.food ? `a ${pick.food} card` : pick.from === 'bird' ? 'a bird' : pick.from === 'food' ? 'a food card' : 'a card';
                prompt = `${stepPrefix}Choose ${targetLabel} to tuck (+1)`;
                const isTuckable = (r: ReserveCard) => {
                    if (pick.from === 'bird') return r.face === 'bird';
                    if (pick.from === 'food') {
                        if (r.face !== 'food') return false;
                        if (pick.food && !CARD_BY_ID[r.cardId].reverse_food.includes(pick.food)) return false;
                        return true;
                    }
                    if (pick.food && r.face === 'food' && !CARD_BY_ID[r.cardId].reverse_food.includes(pick.food)) return false;
                    return true;
                };
                const cards = this.state.virtualReserve.filter(isTuckable);
                const foodName = pick.food;
                const missedSupplyFood = foodName && this.state.missedFoods.includes(foodName);
                body = cards.length === 0 ? (
                    <div className="ws-muted pad" style={{ textAlign: 'center' }}>
                        {missedSupplyFood ? (
                            <div>
                                No <strong>{foodName}</strong> in the supply to draw, and no <strong>{foodName}</strong> in your reserve to tuck.
                            </div>
                        ) : (
                            <div>
                                No matching {pick.from === 'bird' ? 'bird' : foodName ? `${foodName} card` : 'card'} in reserve to tuck.
                            </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                            {this.state.stepIndex > 0 && Object.keys(this.state.stagedChoices).length > 0 ? (
                                <button className="ws-btn primary small" onClick={() => this.resolve(this.state.stagedChoices)}>
                                    Finish activation
                                </button>
                            ) : (
                                <div style={{ fontSize: '0.88em', marginTop: 6 }}>
                                    Click <strong>Skip power</strong> below to finish your turn.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="ws-act-grid">
                        {cards.map((r, i) => (
                            <button key={`${r.cardId}-${i}`} type="button" className={['ws-act-tile', r.face === 'bird' ? 'wingspan-card' : ''].join(' ')} onClick={() => this.advanceOrResolve({ tuckCardId: r.cardId })}>
                                {r.face === 'bird'
                                    ? <PlayingCard card={getWingspanCardDefinition(CARD_BY_ID[r.cardId])} width="82px" customIcons={WINGSPAN_ICONS} />
                                    : <FoodTile cardId={r.cardId} width={72} />}
                            </button>
                        ))}
                    </div>
                );
            } else if (pick.kind === 'discard') {
                if (pick.what === 'egg') {
                    const { flock, nestEggs } = this.props;
                    const sources: { idx: number; label: string; eggs: number }[] = [];
                    if (nestEggs > 0) sources.push({ idx: -1, label: 'Nest', eggs: nestEggs });
                    flock.forEach((c, i) => {
                        if (c.eggs > 0) sources.push({ idx: i, label: CARD_BY_ID[c.cardId].common_name, eggs: c.eggs });
                    });
                    prompt = `${stepPrefix}Choose where to discard an egg from`;
                    body = sources.length === 0 ? <div className="ws-muted pad">No eggs available to discard.</div> : (
                        <div className="ws-act-grid eggs">
                            {sources.map(s => (
                                <button key={s.idx} type="button" className="ws-act-egg" onClick={() => this.advanceOrResolve({ discardEggFrom: s.idx })}>
                                    <Icon id="egg" size={20} /> {s.label} <small>({s.eggs} eggs)</small>
                                </button>
                            ))}
                        </div>
                    );
                } else {
                    const want = pick.food && pick.food !== 'any' ? pick.food : undefined;
                    const isDiscardable = (r: ReserveCard) => {
                        if (pick.what === 'bird') return r.face === 'bird';
                        if (r.face !== 'food') return false;
                        if (want && !CARD_BY_ID[r.cardId].reverse_food.includes(want)) return false;
                        return true;
                    };
                    const cards = this.state.virtualReserve.filter(isDiscardable);
                    const missedSupplyFood = want && this.state.missedFoods.includes(want);
                    prompt = `${stepPrefix}Choose a ${pick.what === 'bird' ? 'bird' : want ? want : 'food'} card to discard`;
                    body = cards.length === 0 ? (
                        <div className="ws-muted pad" style={{ textAlign: 'center' }}>
                            {missedSupplyFood ? (
                                <div>
                                    No <strong>{want}</strong> in the supply to draw, and no <strong>{want}</strong> in your reserve to discard.
                                </div>
                            ) : (
                                <div>
                                    No matching {pick.what === 'bird' ? 'bird' : want ? `${want} card` : 'card'} in your reserve to discard.
                                </div>
                            )}
                            <div style={{ marginTop: 6, fontSize: '0.88em', color: '#8a6d3b' }}>
                                You cannot pay the discard cost to gain the power bonus.
                            </div>
                            <div style={{ marginTop: 12 }}>
                                {this.state.stepIndex > 0 && Object.keys(this.state.stagedChoices).length > 0 ? (
                                    <button className="ws-btn primary small" onClick={() => this.resolve(this.state.stagedChoices)}>
                                        Finish activation
                                    </button>
                                ) : (
                                    <button className="ws-btn ghost small" onClick={this.props.onSkip}>
                                        Skip power
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="ws-act-grid">
                            {cards.map((r, i) => (
                                <button key={`${r.cardId}-${i}`} type="button" className={['ws-act-tile', r.face === 'bird' ? 'wingspan-card' : ''].join(' ')} onClick={() => this.advanceOrResolve({ payFoodCardId: r.cardId })}>
                                    {r.face === 'bird'
                                        ? <PlayingCard card={getWingspanCardDefinition(CARD_BY_ID[r.cardId])} width="82px" customIcons={WINGSPAN_ICONS} />
                                        : <FoodTile cardId={r.cardId} width={72} />}
                                </button>
                            ))}
                        </div>
                    );
                }
            } else if (pick.kind === 'layEgg') {
                const { flock, nestEggs, activeIndex } = this.props;
                const targets: { idx: number; label: string; eggs: number; limit: number }[] = [];
                if (pick.target === 'any') targets.push({ idx: -1, label: 'Nest', eggs: nestEggs, limit: 3 });
                flock.forEach((c, i) => {
                    if (pick.target === 'another' && i === activeIndex) return;
                    targets.push({ idx: i, label: CARD_BY_ID[c.cardId].common_name, eggs: c.eggs, limit: CARD_BY_ID[c.cardId].egg_limit });
                });
                prompt = `${stepPrefix}Choose where to lay ${pick.count > 1 ? pick.count + ' eggs' : 'an egg'}`;
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
                        <button className="ws-btn primary block" disabled={sel.length === 0} onClick={() => this.advanceOrResolve({ eggTargets: sel })}>
                            Lay {sel.length} egg{sel.length === 1 ? '' : 's'}
                        </button>
                    </>
                );
            } else if (pick.kind === 'copyOwn') {
                const { flock, activeIndex } = this.props;
                const candidates = flock
                    .map((c, i) => ({ card: CARD_BY_ID[c.cardId], i }))
                    .filter(x => x.i !== activeIndex && x.card.color === 'brown');
                prompt = `${stepPrefix}Choose one of your birds to copy its brown power`;
                body = candidates.length === 0 ? <div className="ws-muted pad">No other brown bird in your flock to copy.</div> : (
                    <div className="ws-act-branches">
                        {candidates.map(x => (
                            <button key={x.i} className="ws-btn primary" onClick={() => this.advanceOrResolve({ copyIndex: x.i })}>
                                {x.card.common_name}: {describePower(x.card.power.effect)}
                            </button>
                        ))}
                    </div>
                );
            }
        }

        return (
            <Modal title={`Activate ${card.common_name}`} onClose={canCancel ? this.props.onClose : undefined} wide>
                <div className="ws-act">
                    <div className="ws-act-prompt">{prompt}</div>
                    {body}
                    {!this.state.huntResult && (
                        <button className="ws-btn ghost small" onClick={this.handleSkip}>
                            {isRevealed && this.state.stepIndex > 0 && Object.keys(this.state.stagedChoices).length > 0 ? 'Finish with current choices' : 'Skip power'}
                        </button>
                    )}
                </div>
            </Modal>
        );
    }
}

// ============================================================================
// All-Players interactive egg placement modal
// ============================================================================

const AllPlayersEggModal: React.FC<{
    pending: PendingAllPlayersAction;
    myId: string;
    flock: CardInPlay[];
    nestEggs: number;
    playerNames: Record<string, string>;
    onConfirm: (choice: { eggTarget: number | null }) => void;
}> = ({ pending, myId, flock, nestEggs, playerNames, onConfirm }) => {
    const isPendingForMe = pending.pendingPlayers.includes(myId);
    const sourceCard = pending.sourceCardId >= 0 ? CARD_BY_ID[pending.sourceCardId] : null;
    const sourceName = sourceCard ? sourceCard.common_name : 'Bird power';
    const initiatorName = playerNames[pending.initiatorPlayerId] || 'Active player';

    const [selectedTarget, setSelectedTarget] = React.useState<number | null>(null);

    if (!isPendingForMe) {
        const waitingNames = pending.pendingPlayers.map(id => playerNames[id] || 'Player').join(', ');
        return (
            <Modal title="All Players: Lay an Egg">
                <div className="ws-act" style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '1.05em', fontWeight: 700, color: '#2b6b3a', marginBottom: 6 }}>
                        ✓ Choice submitted!
                    </div>
                    <div className="ws-muted" style={{ fontSize: '0.9em' }}>
                        Waiting for <strong>{waitingNames}</strong> to choose egg placement…
                    </div>
                </div>
            </Modal>
        );
    }

    const targets: { idx: number; label: string; eggs: number; limit: number }[] = [];
    targets.push({ idx: -1, label: 'Nest', eggs: nestEggs, limit: 3 });
    flock.forEach((c, i) => {
        targets.push({ idx: i, label: CARD_BY_ID[c.cardId].common_name, eggs: c.eggs, limit: CARD_BY_ID[c.cardId].egg_limit });
    });

    const hasAnySpace = targets.some(t => t.eggs < t.limit);

    return (
        <Modal title="All Players: Lay an Egg">
            <div className="ws-act">
                <div className="ws-act-prompt">
                    {sourceName} gives all players an egg!
                </div>
                <div className="ws-muted" style={{ textAlign: 'center', fontSize: '0.86em', marginBottom: 4 }}>
                    Activated by {initiatorName}
                </div>

                {!hasAnySpace ? (
                    <div className="ws-muted pad" style={{ textAlign: 'center' }}>
                        <div style={{ color: '#8a6d3b', fontWeight: 600, marginBottom: 8 }}>
                            Your nest and flock have no available egg slots (all full).
                        </div>
                        <button className="ws-btn primary block" onClick={() => onConfirm({ eggTarget: null })}>
                            Continue
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ws-act-grid eggs">
                            {targets.map(t => {
                                const full = t.eggs >= t.limit;
                                const on = selectedTarget === t.idx;
                                return (
                                    <button
                                        key={t.idx}
                                        type="button"
                                        disabled={full}
                                        className={['ws-act-egg', on ? 'on' : ''].join(' ')}
                                        onClick={() => setSelectedTarget(t.idx)}
                                    >
                                        <Icon id="egg" size={20} /> {t.label} <small>({t.eggs}/{t.limit})</small>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            className="ws-btn primary block"
                            disabled={selectedTarget === null}
                            onClick={() => {
                                if (selectedTarget !== null) {
                                    onConfirm({ eggTarget: selectedTarget });
                                }
                            }}
                        >
                            Lay 1 egg
                        </button>
                    </>
                )}
            </div>
        </Modal>
    );
};

// ============================================================================
// Main page
// ============================================================================

type UIMode =
    | { kind: 'idle' }
    | { kind: 'draw' }
    | { kind: 'lay' }
    | { kind: 'activate' }
    | { kind: 'playConfirm'; cardId: number };

interface MainState {
    ui: UIMode;
    stagedDrawPick: DrawPick | null;
    eggTargets: number[];
    inspectedCardId: number | null;
}

export class WingspanMainPage extends React.Component<WingspanProps, MainState> {
    constructor(props: WingspanProps) {
        super(props);
        this.state = { ui: { kind: 'idle' }, stagedDrawPick: null, eggTargets: [], inspectedCardId: null };
    }

    private mp() { return this.props.MP as any; }
    private close = () => this.setState({ ui: { kind: 'idle' }, stagedDrawPick: null, eggTargets: [] });
    private inspectCard = (cardId: number) => this.setState({ inspectedCardId: cardId });
    private closeInspect = () => this.setState({ inspectedCardId: null });

    private amNestTurn(): boolean {
        return this.props.isMyTurn && this.props.phase === Phase.Nest && !this.props.nestTaken;
    }
    private amDrawingSecondCard(): boolean {
        return this.props.isMyTurn && this.props.phase === Phase.Nest && !!this.props.pendingDraw && this.props.pendingDraw.count === 1;
    }
    private amActivating(): boolean {
        return this.props.isMyTurn && this.props.phase === Phase.Activate;
    }

    // ---- draw 2 (step by step) ----
    private selectDrawBird = (slot: number) => {
        if (this.state.stagedDrawPick && this.state.stagedDrawPick.kind === 'bird' && this.state.stagedDrawPick.index === slot) {
            this.setState({ stagedDrawPick: null });
        } else {
            this.setState({ stagedDrawPick: { kind: 'bird', index: slot } });
        }
    };
    private selectDrawDeck = (deck: number) => {
        if (this.state.stagedDrawPick && this.state.stagedDrawPick.kind === 'food' && this.state.stagedDrawPick.index === deck) {
            this.setState({ stagedDrawPick: null });
        } else {
            this.setState({ stagedDrawPick: { kind: 'food', index: deck } });
        }
    };
    private confirmTakeCard1 = () => {
        if (!this.state.stagedDrawPick) return;
        this.mp().drawCard(this.state.stagedDrawPick, false);
        this.setState({ stagedDrawPick: null });
    };
    private confirmTakeCard2 = () => {
        if (!this.state.stagedDrawPick) return;
        this.mp().drawCard(this.state.stagedDrawPick, true);
        this.setState({ ui: { kind: 'idle' }, stagedDrawPick: null });
    };
    private finishDrawAfter1 = () => {
        this.mp().finishDraw();
        this.setState({ ui: { kind: 'idle' }, stagedDrawPick: null });
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

    /** Tap Activate: open the modal for user choice, or auto-run if power has 0 interactive choices */
    private onActivate = (card: BirdCard) => {
        const eff = card.power.effect;
        if (eff.op === 'none' || (eff.op === 'lay_egg' && eff.target === 'this')) {
            this.activate({});
            return;
        }
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
                <div className="ws-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span>
                        Your flock ({flock.length}/6)
                        {p.endTriggered && <span className="ws-endtag">final round</span>}
                    </span>
                    {me && me.score && (
                        <span className="ws-my-score" style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--ws-text-dim, #666)' }}>
                            <strong style={{ fontSize: '1.1em', color: p.playerAccents[this.mp().clientId] || '#2b6b3a' }}>{me.score.total} pts</strong> ({me.score.vp} bird · {me.score.eggs} egg · {me.score.tucked} tuck{p.advanced ? ` · ${me.score.goals} goal` : ''})
                        </span>
                    )}
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
                        const matchingGoals = p.advanced ? getMatchingGoalsForFlockBird(flock, i, p.goals) : [];
                        return (
                            <BirdInPlay
                                key={i}
                                inPlay={c}
                                active={i === activeIdx}
                                accent={p.playerAccents[p.currentPlayerId]}
                                matchingGoals={matchingGoals}
                                selectable={canLayHere}
                                selected={laying && this.state.eggTargets.indexOf(i) !== -1}
                                onClick={canLayHere ? () => this.toggleEggTarget(i) : () => this.inspectCard(c.cardId)}
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
        if (!this.props.isMyTurn || this.props.phase !== Phase.Nest) return null;
        const isStep2 = this.amDrawingSecondCard();
        if (this.props.nestTaken && !isStep2) return null;
        const laying = this.state.ui.kind === 'lay';
        const drawing = this.state.ui.kind === 'draw';
        return (
            <div className="ws-actionbar">
                {isStep2 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            className="ws-btn primary"
                            disabled={this.state.stagedDrawPick === null}
                            onClick={this.confirmTakeCard2}
                        >
                            Confirm: Take 2nd Card
                        </button>
                        <button
                            className="ws-btn ghost"
                            onClick={this.finishDrawAfter1}
                        >
                            Finish Draw (1 Card)
                        </button>
                        <span className="ws-actionbar-hint">
                            Card 1 taken! Select your 2nd card (you can draw from the same deck) or finish.
                        </span>
                    </div>
                ) : drawing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button className="ws-btn" onClick={this.close}>Cancel</button>
                        <button
                            className="ws-btn primary"
                            disabled={this.state.stagedDrawPick === null}
                            onClick={this.confirmTakeCard1}
                        >
                            Confirm: Take Card 1
                        </button>
                        <span className="ws-actionbar-hint">
                            Select card 1 of 2 (supply bird or food deck).
                        </span>
                    </div>
                ) : laying ? (
                    <>
                        <button className="ws-btn" onClick={this.close}>Cancel</button>
                        <button className="ws-btn primary" disabled={this.state.eggTargets.length === 0} onClick={this.confirmLay}>Lay {this.state.eggTargets.length} egg{this.state.eggTargets.length === 1 ? '' : 's'}</button>
                    </>
                ) : (
                    <>
                        <button className="ws-btn primary" onClick={() => this.setState({ ui: { kind: 'draw' }, stagedDrawPick: null })}>Draw 2</button>
                        <button className="ws-btn primary" onClick={() => this.setState({ ui: { kind: 'lay' }, eggTargets: [] })}>Lay eggs</button>
                        <span className="ws-actionbar-hint">…or tap a playable bird below</span>
                    </>
                )}
            </div>
        );
    }

    private renderArena() {
        const p = this.props;
        if (p.phase === Phase.Scoring || p.phase === Phase.Done) {
            return (
                <div className="ws-arena">
                    <ScoringPanel p={p} onInspectBird={this.inspectCard} />
                    {this.state.inspectedCardId != null && (
                        <BirdCardDetailModal
                            cardId={this.state.inspectedCardId}
                            onClose={this.closeInspect}
                        />
                    )}
                </div>
            );
        }
        const isStep2 = this.amDrawingSecondCard();
        const mode = (this.state.ui.kind === 'draw' || isStep2) ? 'draw' : 'idle';
        const canPlay = this.amNestTurn() && this.state.ui.kind === 'idle' && !isStep2;
        return (
            <div className="ws-arena">
                <GoalsStrip goals={p.advanced ? p.goals : null} />
                <SupplyStrip
                    p={p}
                    mode={mode}
                    selectedPick={this.state.stagedDrawPick}
                    pendingDraw={p.pendingDraw}
                    onSelectBird={this.selectDrawBird}
                    onSelectDeck={this.selectDrawDeck}
                    onInspectBird={this.inspectCard}
                />
                {this.renderActionBar()}
                {this.renderMyFlock()}
                <ReserveDrawer
                    reserve={p.myReserve}
                    playable={p.myPlayable || {}}
                    canPlay={canPlay}
                    onPlay={this.openPlay}
                    onInspectBird={this.inspectCard}
                />
                <OpponentsPanel p={p} onInspectBird={this.inspectCard} />

                {this.state.inspectedCardId != null && (
                    <BirdCardDetailModal
                        cardId={this.state.inspectedCardId}
                        onClose={this.closeInspect}
                    />
                )}

                {this.state.ui.kind === 'playConfirm' && (() => {
                    const me = this.mp().clientId;
                    const mine = p.publicPlayers[me];
                    const auto = (this.props.myPlayable && this.props.myPlayable[this.state.ui.cardId]) || { foods: [], eggSources: [] };
                    return (
                        <PlayBirdModal
                            cardId={this.state.ui.cardId}
                            auto={auto}
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

                {p.pendingAllPlayers && p.pendingAllPlayers.type === 'lay_egg' && (() => {
                    const me = this.mp().clientId;
                    const mine = p.publicPlayers[me];
                    return (
                        <AllPlayersEggModal
                            pending={p.pendingAllPlayers}
                            myId={me}
                            flock={mine ? mine.flock : []}
                            nestEggs={mine ? mine.nestEggs : 0}
                            playerNames={p.playerNames}
                            onConfirm={(choice) => (this.mp() as any).respondAllPlayers(choice)}
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
            'opponents': {
                'icon': 'users',
                'label': 'Opponents',
                'view': (
                    <div className="ws-arena">
                        <OpponentsTableauView p={p} onInspectBird={this.inspectCard} />
                        {this.state.inspectedCardId != null && (
                            <BirdCardDetailModal
                                cardId={this.state.inspectedCardId}
                                onClose={this.closeInspect}
                            />
                        )}
                    </div>
                )
            },
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
