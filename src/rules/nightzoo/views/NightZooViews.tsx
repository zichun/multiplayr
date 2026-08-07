/**
 * NightZooViews.tsx — React views for Night at the Zoo.
 *
 * Presentation only: every mutation goes through an MP RPC method. UI-only
 * interaction state (which held tile / which figure is selected) lives in
 * component state; game state never does. The board legality engine is imported
 * straight from the pure GameState, so highlights match what the host allows.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';

import {
    NIGHTZOO_PALETTE, NIGHTZOO_ICONS, getIcon, buildTileCard,
    animalIconId, terrainIconId, actionIconId, foodIconId, foodDiscIconId
} from '../NightZooAssets';
import {
    AnimalType, ANIMALS, ANIMAL_TYPES, Terrain, TERRAINS, ActionSymbol, ACTION_LABELS,
    Food, FOODS, FOOD_LABELS, TileDef, TILE_BY_ID, makeBonusTile,
    BOARD_CONFIG, GRID, ZOO, ENTRANCES,
    TERRAIN_COLORS, TERRAIN_INK, FOOD_COLORS,
    WOLF_SET_VP, BUTTERFLY_POLLEN_VP, FOOD_SET_VP
} from '../NightZooData';
import {
    Phase, Figure, MoveOption, PlayerState, ScoreBreakdown, Dir,
    legalMoveOptions, canPlaceOnCell
} from '../NightZooGameState';

// ============================================================================
// Prop shapes
// ============================================================================

interface PublicPlayer {
    grid: (string | null)[][];
    figures: Figure[];
    warehouseCount: number;
    vp: number;
    placementDone: boolean;
    endMoveDone: boolean;
    liveScore: ScoreBreakdown;
}

interface Shared {
    phase: Phase;
    activeTypes: AnimalType[];
    round: number;
    draftIndex: number;
    draftNumber: number;
    market: (string | null)[];
    leftover: string[];
    firstPlayer: number;
    currentDrafter: string | null;
    winningTerrain: Terrain | null;
    bonusPiles: Record<Terrain, number>;
    deckCount: number;
    playerOrder: string[];
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    publicPlayers: Record<string, PublicPlayer>;
    scores: Record<string, ScoreBreakdown> | null;
    winnerIds: string[] | null;
}

interface NZProps extends ViewPropsInterface {
    shared: Shared;
    me: PlayerState | null;
    isHost: boolean;
    isMyDraftTurn: boolean;
}

// ============================================================================
// Tile / icon helpers
// ============================================================================

function tileDef(id: string): TileDef {
    if (TILE_BY_ID[id]) return TILE_BY_ID[id];
    const m = /^B-(grass|rocks|sand)-(\d+)$/.exec(id);
    if (m) return makeBonusTile(m[1] as Terrain, parseInt(m[2], 10));
    return { id, kind: 'bonus', terrain: 'grass', actions: [], food: null };
}

const Icon: React.FC<{ id: string; size?: number; color?: string; title?: string }> = ({ id, size = 22, color, title }) => {
    const ic = getIcon(id);
    if (!ic) return null;
    return (
        <span className="nz-ic" title={title} style={{ width: size, height: size }}>
            <ExpressiveIcon icon={ic} palette={NIGHTZOO_PALETTE} savedIcons={NIGHTZOO_ICONS} colorOverride={color} />
        </span>
    );
};

const DIR_ARROW: Record<Dir, string> = { N: '▲', E: '▶', S: '▼', W: '◀' };

/** A drafted / placed tile face, rendered as a square card. */
const TileFace: React.FC<{
    id: string; size?: number; selected?: boolean; onClick?: () => void; onBoard?: boolean; dim?: boolean; label?: string;
}> = ({ id, size = 54, selected, onClick, onBoard, dim, label }) => {
    const def = tileDef(id);
    const card = buildTileCard(def, !!onBoard);
    const labelText = label || [def.actions.map(a => ACTION_LABELS[a]).join(' + '), def.food ? FOOD_LABELS[def.food] : '', def.terrain]
        .filter(Boolean).join(' · ');
    return (
        <div className={['nz-tile-card', dim ? 'dim' : ''].filter(Boolean).join(' ')} title={labelText}>
            <PlayingCard
                card={card}
                customIcons={NIGHTZOO_ICONS}
                width={size}
                onClick={onClick}
                selectable={!!onClick}
                hoverable={!!onClick}
                selected={!!selected}
                selectedStyle="outline"
                selectedGlowColor="#3f8f85"
            />
        </div>
    );
};

/** A single animal figure token. */
const FigureToken: React.FC<{ fig: Figure; size?: number; faded?: boolean; selectable?: boolean; selected?: boolean; onClick?: () => void }> =
    ({ fig, size = 28, faded, selectable, selected, onClick }) => {
        const color = ANIMALS[fig.type].color;
        return (
            <div
                className={['nz-fig', faded ? 'faded' : '', selectable ? 'pick' : '', selected ? 'on' : ''].filter(Boolean).join(' ')}
                style={{ width: size, height: size, borderColor: color }}
                onClick={onClick}
                role={onClick ? 'button' : undefined}
                title={ANIMALS[fig.type].name}
            >
                <Icon id={animalIconId(fig.type)} size={Math.round(size * 0.82)} />
                {fig.type === 'snake' && fig.heading && <span className="nz-fig-badge dir">{DIR_ARROW[fig.heading]}</span>}
                {fig.type === 'sloth' && fig.awake === false && <span className="nz-fig-badge">z</span>}
                {fig.type === 'butterfly' && <span className="nz-fig-badge pollen">{fig.pollen ?? 0}</span>}
            </div>
        );
    };

// ============================================================================
// Board
// ============================================================================

function key(r: number, c: number) { return `${r},${c}`; }

interface BoardProps {
    grid: (string | null)[][];
    figures: Figure[];
    // interaction
    placeableAt?: (r: number, c: number) => boolean;  // which empty cells accept the selected tile
    onPlaceCell?: (r: number, c: number) => void;
    moveTargets?: Map<string, MoveOption>;          // cell key → option (step/slide)
    onMoveCell?: (opt: MoveOption) => void;
    selectableFigures?: boolean;
    selectedFigureId?: string | null;
    onFigureClick?: (figId: string) => void;
    discoverTargets?: boolean;                       // entrance cells are discover targets
    onDiscoverCell?: (r: number, c: number) => void;
    winningTerrain?: Terrain | null;
}

const HINT_INK = '#544d66';

/** The printed action(s) + condition of an empty placeable cell — high-contrast so it reads. */
const PrintedHint: React.FC<{ r: number; c: number }> = ({ r, c }) => {
    const cfg = BOARD_CONFIG[r][c];
    if (!cfg) return null;
    const cond = cfg.condition;

    // paired special cells — two linked cells that TOGETHER grant ONE reward
    if (cond && cond.type === 'paired') {
        const rewardText = cond.reward === 'vp5' ? '5 VP' : cond.reward === 'move2' ? '2 moves' : '2 bonus';
        return (
            <span className="nz-hint paired" title={`Pair ${cond.group}: cover BOTH linked cells with the same terrain to unlock ${rewardText} (once, shared by the pair)`}>
                <span className="nz-hint-pairhead"><Icon id="link" size={16} color="#8a5aa0" /><b>{cond.group}</b></span>
                <span className="nz-hint-pairreward">{rewardText}</span>
            </span>
        );
    }

    const acts = cfg.printedActions;
    const sz = acts.length > 1 ? 21 : 30;
    const glyphs = acts.map((a, i) => {
        if (a.kind === 'move') return <Icon key={i} id={actionIconId(a.amount === 2 ? 'move2' : 'move1')} size={sz} color={HINT_INK} title={a.amount === 2 ? 'Move 2' : 'Move 1'} />;
        if (a.kind === 'discover') return <Icon key={i} id={actionIconId('discover')} size={sz} color={HINT_INK} title="Discover" />;
        if (a.kind === 'bonus') return <Icon key={i} id={actionIconId('bonus')} size={sz - 2} color={HINT_INK} title="Take Bonus" />;
        return <span key={i} className="nz-hint-star"><Icon id={actionIconId('vp1')} size={sz - 2} color={HINT_INK} /><b>{a.amount}</b></span>;
    });

    let condBadge: React.ReactNode = null;
    if (cond && cond.type === 'terrain') {
        condBadge = <span className="nz-hint-terr" title={`needs ${cond.requires}`} style={{ background: TERRAIN_COLORS[cond.requires], borderColor: TERRAIN_INK[cond.requires] }} />;
    } else if (cond && cond.type === 'symbol') {
        condBadge = <span className="nz-hint-sym" title={`needs a ${cond.requires} tile`}><Icon id={actionIconId(cond.requires)} size={14} color="#8a5aa0" /></span>;
    }
    return <span className="nz-hint">{glyphs}{condBadge}</span>;
};

const Board: React.FC<BoardProps> = (p) => {
    const figuresAt = new Map<string, Figure[]>();
    for (const f of p.figures) {
        if ((f.zone === 'neighborhood' || f.zone === 'entrance') && f.pos) {
            const k = key(f.pos[0], f.pos[1]);
            if (!figuresAt.has(k)) figuresAt.set(k, []);
            figuresAt.get(k)!.push(f);
        }
    }

    const renderFigs = (figs: Figure[]) => (
        <div className="nz-cell-figs">
            {figs.map(f => (
                <FigureToken
                    key={f.id} fig={f} size={24}
                    selectable={p.selectableFigures}
                    selected={p.selectedFigureId === f.id}
                    onClick={p.selectableFigures && p.onFigureClick ? () => p.onFigureClick!(f.id) : undefined}
                />
            ))}
        </div>
    );

    // 5×5 board cells, placed into the inner tracks of a 7×7 grid (tracks 2..6).
    const boardCells: React.ReactNode[] = [];
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        const isZoo = r === ZOO[0] && c === ZOO[1];
        const tileId = p.grid[r][c];
        const figs = figuresAt.get(key(r, c)) || [];
        const moveOpt = p.moveTargets?.get(key(r, c));
        const canPlace = tileId === null && !isZoo && !!p.placeableAt && p.placeableAt(r, c);
        const isPaired = !isZoo && !tileId && BOARD_CONFIG[r][c]?.condition?.type === 'paired';
        const cls = [
            'nz-cell',
            isZoo ? 'zoo' : '',
            tileId ? 'filled' : 'empty',
            isPaired ? 'paired' : '',
            canPlace ? 'place-target' : '',
            moveOpt ? 'move-target' : '',
            (moveOpt && (moveOpt.kind === 'step' || moveOpt.kind === 'slide') && moveOpt.arrives) ? 'arrives' : ''
        ].filter(Boolean).join(' ');
        const onClick = moveOpt
            ? () => p.onMoveCell && p.onMoveCell(moveOpt)
            : (canPlace ? () => p.onPlaceCell && p.onPlaceCell(r, c) : undefined);
        boardCells.push(
            <div key={key(r, c)} className={cls} style={{ gridRow: r + 2, gridColumn: c + 2 }} onClick={onClick} role={onClick ? 'button' : undefined}>
                {isZoo ? <span className="nz-zoo-label">ZOO</span>
                    : tileId ? <TileFace id={tileId} size={56} onBoard />
                        : <PrintedHint r={r} c={c} />}
                {figs.length > 0 && renderFigs(figs)}
            </div>
        );
    }

    // external entrances, as half-squares in the outer gutter tracks
    const entranceCells = ENTRANCES.map((ent) => {
        const [er, ec] = ent.pos;
        const figs = figuresAt.get(key(er, ec)) || [];
        const canDiscover = p.discoverTargets;
        // grid placement: gutter track (1 or 7) on the relevant axis, board track on the other
        const gr = ent.side === 'N' ? 1 : ent.side === 'S' ? 7 : ent.cell[0] + 2;
        const gc = ent.side === 'W' ? 1 : ent.side === 'E' ? 7 : ent.cell[1] + 2;
        const cls = ['nz-entrance-cell', `side-${ent.side}`, canDiscover ? 'discover-target' : ''].filter(Boolean).join(' ');
        return (
            <div
                key={`ent-${er},${ec}`}
                className={cls}
                style={{ gridRow: gr, gridColumn: gc, background: TERRAIN_COLORS[ent.terrain], borderColor: TERRAIN_INK[ent.terrain] }}
                onClick={canDiscover && p.onDiscoverCell ? () => p.onDiscoverCell!(er, ec) : undefined}
                role={canDiscover ? 'button' : undefined}
                title={`Entrance · ${ent.terrain}`}
            >
                <span className="nz-entrance-mark">IN</span>
                {figs.length > 0 && renderFigs(figs)}
            </div>
        );
    });

    return (
        <div className="nz-board-wrap">
            <div className="nz-grid7">
                {entranceCells}
                {boardCells}
            </div>
        </div>
    );
};

// ============================================================================
// Draft market + leftover
// ============================================================================

const MarketRow: React.FC<{ shared: Shared; canDraft: boolean; onDraft: (slot: number) => void }> = ({ shared, canDraft, onDraft }) => (
    <div className="nz-market">
        <div className="nz-market-head">
            <span className="nz-section-title">Draft market</span>
            <span className="nz-deck-badge">deck {shared.deckCount}</span>
        </div>
        <div className="nz-market-row">
            {shared.market.map((id, i) => id == null ? (
                <div key={i} className="nz-tile-ghost" style={{ width: 58, height: 58 }} />
            ) : (
                <TileFace key={i} id={id} size={58} onClick={canDraft ? () => onDraft(i) : undefined} />
            ))}
        </div>
    </div>
);

const LeftoverRow: React.FC<{ shared: Shared }> = ({ shared }) => (
    <div className="nz-leftover">
        <span className="nz-section-title small">Leftover ({shared.leftover.length})</span>
        <div className="nz-leftover-row">
            {shared.leftover.length === 0 && <span className="nz-muted">none yet</span>}
            {shared.leftover.map((id, i) => <TileFace key={i} id={id} size={38} />)}
        </div>
    </div>
);

// ============================================================================
// Animal reference (points + movement rules)
// ============================================================================

function animalPoints(t: AnimalType): string {
    if (t === 'wolf') return `set ${WOLF_SET_VP[1]}/${WOLF_SET_VP[2]}/${WOLF_SET_VP[3]}`;
    if (t === 'butterfly') return `pollen ${BUTTERFLY_POLLEN_VP[1]}/${BUTTERFLY_POLLEN_VP[2]}/${BUTTERFLY_POLLEN_VP[3]}/${BUTTERFLY_POLLEN_VP[4]}`;
    return `${ANIMALS[t].zooVP} VP each`;
}

const AnimalReference: React.FC<{ types: AnimalType[] }> = ({ types }) => (
    <div className="nz-animal-ref">
        <span className="nz-section-title small">Animals in play — Zoo points &amp; movement</span>
        <div className="nz-animal-ref-list">
            {types.map(t => (
                <div key={t} className="nz-animal-ref-item">
                    <Icon id={animalIconId(t)} size={34} />
                    <div className="nz-animal-ref-txt">
                        <div><b>{ANIMALS[t].name}</b> <span className="nz-animal-pts">{animalPoints(t)}</span> <span className="nz-animal-moons">☾{ANIMALS[t].difficulty}</span></div>
                        <div className="nz-muted">{ANIMALS[t].blurb}</div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ============================================================================
// Keepers panel — every player's board + score
// ============================================================================

const PlayersStrip: React.FC<{ p: NZProps }> = ({ p }) => {
    const s = p.shared;
    return (
        <div className="nz-keepers">
            {s.playerOrder.map((id) => {
                const pub = s.publicPlayers[id];
                if (!pub) return null;
                const isDrafter = s.currentDrafter === id;
                const isFirst = s.playerOrder[s.firstPlayer] === id;
                const accent = s.playerAccents[id];
                return (
                    <div key={id} className={['nz-keeper-block', isDrafter ? 'drafting' : ''].join(' ')} style={{ borderColor: accent }}>
                        <div className="nz-keeper-head">
                            <span className="nz-pchip-name" style={{ color: accent }}>{s.playerNames[id]}{isFirst ? ' ★' : ''}</span>
                            <span className="nz-pchip-score">{pub.liveScore.total} vp</span>
                            <span className="nz-pchip-sub">{pub.liveScore.animalsInZoo} home</span>
                            {s.phase === 'placement' && (pub.placementDone ? <span className="nz-tick done">done</span> : <span className="nz-tick">placing…</span>)}
                        </div>
                        <Board grid={pub.grid} figures={pub.figures} />
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================================
// Scoring panel
// ============================================================================

const ScoringPanel: React.FC<{ p: NZProps }> = ({ p }) => {
    const s = p.shared;
    const scores = s.scores || {};
    const winners = new Set(s.winnerIds || []);
    const ranked = [...s.playerOrder].sort((a, b) => (scores[b]?.total ?? 0) - (scores[a]?.total ?? 0));
    return (
        <div className="nz-scoring">
            <h2 className="win">
                {winners.size > 1 ? 'Shared victory!' : `${s.playerNames[[...winners][0]] || 'Winner'} wins!`}
            </h2>
            <div className="nz-score-table">
                <div className="nz-score-row head">
                    <span>Player</span><span>Actions</span><span>Zoo</span><span>Stranded</span><span>Food</span><b>Total</b>
                </div>
                {ranked.map((id) => {
                    const b = scores[id];
                    if (!b) return null;
                    return (
                        <div key={id} className={['nz-score-row', winners.has(id) ? 'winner' : ''].join(' ')}>
                            <span style={{ color: s.playerAccents[id] }}>{s.playerNames[id]}{winners.has(id) ? ' ★' : ''}</span>
                            <span>{b.base}</span><span>{b.zoo}</span><span>{b.stranded}</span><span>{b.food}</span><b>{b.total}</b>
                        </div>
                    );
                })}
            </div>
            <p className="nz-muted">Tie-break: most animals safely in the Zoo, then a shared win.</p>
        </div>
    );
};

// ============================================================================
// Rules
// ============================================================================

const ACTION_HELP: Record<ActionSymbol, string> = {
    move1: 'Move one animal 1 tile.',
    move2: 'Move 2 tiles for one animal, OR 1 tile each for two animals.',
    discover: 'Bring one undiscovered animal onto one of your entrances (it becomes movable).',
    bonus: 'Take a plain Bonus tile (terrain only, no icon) into your hand.',
    vp1: 'Gain the shown Victory Points immediately.',
    vp2: 'Gain the shown Victory Points immediately.'
};

const Ladder: React.FC<{ head: string; cols: [string, string][] }> = ({ head, cols }) => (
    <div className="nz-ladder">
        <span className="nz-ladder-head">{head}</span>
        <div className="nz-ladder-grid">
            {cols.map(([k, v], i) => (
                <div key={i} className="nz-ladder-cell"><span>{k}</span><b>{v}</b></div>
            ))}
        </div>
    </div>
);

const RulesView: React.FC<{ activeTypes?: AnimalType[] }> = ({ activeTypes }) => (
    <div className="nz-rules">
        <h3>Night at the Zoo</h3>
        <p>The animals have escaped! Route them back to your central <b>Zoo</b>. Each keeper drafts Action tiles and places them on their own private 5×5 <b>Neighborhood</b> to build a walkable path, then triggers actions that move animals toward the Zoo. After <b>3 rounds × 5 drafts</b> (15 tiles), the most Victory Points wins.</p>

        <h4>A round</h4>
        <p>Each of the 5 drafts in a round has three steps:</p>
        <ul>
            <li><b>1. Draft</b> — the market holds (players + 1) tiles. Starting from the first player and going clockwise, everyone takes exactly one tile. The single tile left over is pushed to the shared <b>Leftover</b> zone.</li>
            <li><b>2. Place</b> — each keeper resolves their own board (place / store / discard their drafted tile, resolving any actions). Boards never interact.</li>
            <li><b>3. Maintenance</b> — refill the market and pass the first-player token clockwise.</li>
        </ul>
        <p>After the <b>5th draft</b> of a round there is an <b>End-of-Round movement</b> (see Terrain), then the Leftover zone is cleared.</p>

        <h4>Placing a tile</h4>
        <p>With your drafted tile (and any Warehouse tiles) you may, per tile, do one of:</p>
        <ul>
            <li><b>Place</b> it on an empty cell of your 5×5. Only cells whose requirement the tile meets light up (see Terrain / restricted cells).</li>
            <li><b>Warehouse</b> it — a 2-slot stash to place or discard later.</li>
            <li><b>Discard</b> it for a special terrain move (see Terrain).</li>
        </ul>
        <p><b>Resolving actions.</b> When you place a tile, you resolve <i>both</i> the tile's own action <i>and</i> the printed action(s) of the cell it covers — in <b>any order you like</b>.</p>
        <ul>
            <li><b>Two-symbol tiles:</b> a tile showing two action symbols — you choose and perform <b>only one</b> of them.</li>
            <li><b>Cell actions:</b> the covered cell may print its own action(s) — e.g. the bottom corners print <i>both</i> 2 VP <b>and</b> a bonus; those always trigger too.</li>
            <li><b>Bonus tiles</b> carry no action of their own but still trigger the printed action of the cell they cover.</li>
        </ul>

        <h4>Paired cells (<Icon id="link" size={16} color="#8a5aa0" /> A / B / C)</h4>
        <p>Each letter marks <b>two linked cells</b>. Cover <b>both</b> cells of a pair with tiles of the <b>same terrain</b> to unlock its reward <b>once</b> — the reward belongs to the pair as a whole, it is <i>not</i> granted per cell:</p>
        <ul>
            <li><b>A</b> → 2 movements &nbsp;·&nbsp; <b>B</b> → 2 Bonus tiles &nbsp;·&nbsp; <b>C</b> → 5 VP</li>
        </ul>

        <h4>Action symbols</h4>
        <div className="nz-rules-actions">
            {(['move1', 'move2', 'discover', 'bonus', 'vp2'] as ActionSymbol[]).map(a => (
                <div key={a} className="nz-rules-action">
                    <Icon id={actionIconId(a)} size={26} color="#544d66" />
                    <div><b>{ACTION_LABELS[a]}</b><div className="nz-muted">{ACTION_HELP[a]}</div></div>
                </div>
            ))}
        </div>

        <h4>Terrain</h4>
        <p>Every tile shows exactly one terrain — <b>grass</b>, <b>rocks</b> or <b>sand</b>. Terrain does three jobs:</p>
        <div className="nz-rules-terr">
            {TERRAINS.map(t => (
                <span key={t} className="nz-rules-terr-chip" style={{ background: TERRAIN_COLORS[t], borderColor: TERRAIN_INK[t] }}>
                    <Icon id={terrainIconId(t)} size={18} /> {t}
                </span>
            ))}
        </div>
        <ul>
            <li><b>Restricted cells</b> — some cells only accept a tile of a specific terrain (shown by a coloured corner chip), and the discover cells only accept a tile showing a discover symbol.</li>
            <li><b>Discard for a special move</b> — instead of placing a tile, discard it: <b>every</b> one of your animals standing on a tile of that discarded tile's terrain then makes <b>one</b> move. (Cheetahs get +1 tile, butterflies gain pollen — see Animals.)</li>
            <li><b>End-of-round movement</b> — after the 5th draft, find the <b>most common terrain</b> in the Leftover zone (ties → the leftmost tile's terrain). Every discovered animal standing on that terrain makes one move. Then the Leftover zone is cleared.</li>
        </ul>

        <h4>Moving animals</h4>
        <ul>
            <li>Animals move onto <b>orthogonally adjacent</b> tiles. An animal can <b>never</b> step onto an empty (tile-less) space — only the <b>Zoo</b> (centre) is always enterable.</li>
            <li>Entrances sit <b>outside</b> the board; a discovered animal starts there and moves <b>inward</b> onto its adjacent cell once that cell has a tile. Animals never move back out onto an entrance.</li>
            <li>Multiple animals may share a tile. Reaching the Zoo scores the animal and removes it from the board.</li>
        </ul>

        <h4>The animals</h4>
        <div className="nz-rules-animals">
            {ANIMAL_TYPES.map(t => (
                <div key={t} className={['nz-rules-animal', activeTypes && activeTypes.includes(t) ? 'in-play' : ''].join(' ')}>
                    <Icon id={animalIconId(t)} size={36} />
                    <div>
                        <div><b>{ANIMALS[t].name}</b> <span className="nz-animal-pts">{animalPoints(t)}</span> <span className="nz-animal-moons">☾{ANIMALS[t].difficulty}</span>{activeTypes && activeTypes.includes(t) ? <span className="nz-inplay-tag">in play</span> : null}</div>
                        <div className="nz-muted">{ANIMALS[t].blurb}</div>
                    </div>
                </div>
            ))}
        </div>
        <div className="nz-ladders">
            <Ladder head="Wolves in Zoo (set)" cols={[['1', `${WOLF_SET_VP[1]}`], ['2', `${WOLF_SET_VP[2]}`], ['3', `${WOLF_SET_VP[3]}`]]} />
            <Ladder head="Butterfly by pollen" cols={[['1', `${BUTTERFLY_POLLEN_VP[1]}`], ['2', `${BUTTERFLY_POLLEN_VP[2]}`], ['3', `${BUTTERFLY_POLLEN_VP[3]}`], ['4', `${BUTTERFLY_POLLEN_VP[4]}`]]} />
        </div>

        <h4>Foods &amp; the food set</h4>
        <p>Food tiles carry a food instead of an action. At game end, score <b>once</b> for your <b>best set of distinct</b> foods — only foods in your Neighborhood count (Warehouse foods don't).</p>
        <div className="nz-rules-foods">
            {FOODS.map(f => (
                <div key={f} className="nz-rules-food"><Icon id={foodDiscIconId(f)} size={30} /><small>{FOOD_LABELS[f]}</small></div>
            ))}
        </div>
        <Ladder head="Distinct foods → VP" cols={([2, 3, 4, 5, 6, 7] as number[]).map(n => [`${n}`, `${FOOD_SET_VP[n]}`] as [string, string])} />

        <h4>Scoring</h4>
        <ul>
            <li><b>Zoo animals</b> — each animal that reached the Zoo (flat value, wolf set, or butterfly pollen; see above).</li>
            <li><b>Immediate VP</b> gained from tiles, cells and pairs during the game.</li>
            <li><b>+1</b> for every discovered animal <i>not</i> in the Zoo (stranded on the board or an entrance).</li>
            <li><b>Best food set</b> (above).</li>
        </ul>
        <p className="nz-muted">Tie-break: most animals in the Zoo, then a shared win.</p>
    </div>
);

// ============================================================================
// Lobby views
// ============================================================================

export class NightZooHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="nz-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <p className="nz-muted">Route the escaped animals home. Night at the Zoo supports 1–4 keepers.</p>
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Night at the Zoo', 'links': links });
    }
}

export class NightZooClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div className="nz-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="nz-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Night at the Zoo', 'links': links });
    }
}

// ============================================================================
// Main page
// ============================================================================

interface MainState {
    selTile: string | null;
    actionChoice: ActionSymbol | null;
    selFigure: string | null;
    discoverType: AnimalType | null;
}

export class NightZooMainPage extends React.Component<NZProps, MainState> {
    constructor(props: NZProps) {
        super(props);
        this.state = { selTile: null, actionChoice: null, selFigure: null, discoverType: null };
    }
    private mp() { return this.props.MP as any; }

    // ---- senders ----
    private draft = (slot: number) => this.mp().draft(slot);
    private placeTile = (r: number, c: number) => {
        const t = this.state.selTile;
        if (!t) return;
        const def = tileDef(t);
        const choice = (def.kind === 'action' && def.actions.length > 1) ? (this.state.actionChoice ?? undefined) : undefined;
        this.mp().placeTile(t, r, c, choice);
        this.setState({ selTile: null, actionChoice: null });
    };
    private storeTile = () => { if (this.state.selTile) { this.mp().warehouseTile(this.state.selTile); this.setState({ selTile: null, actionChoice: null }); } };
    private discardTile = () => { if (this.state.selTile) { this.mp().discardTile(this.state.selTile); this.setState({ selTile: null, actionChoice: null }); } };
    private deployWarehouse = (slot: number) => this.mp().deployWarehouse(slot);
    private discardWarehouse = (id: string) => this.mp().discardTile(id);
    private resolveDiscover = (type: AnimalType, r: number, c: number) => { this.mp().resolveDiscover(type, r, c); this.setState({ discoverType: null }); };
    private resolveBonus = (terrain: Terrain) => this.mp().resolveBonus(terrain);
    private resolveMove = (figId: string, opt: MoveOption) => { this.mp().resolveMove(figId, opt); };
    private skipMove = (figId?: string) => this.mp().skipMove(figId);
    private finishPlacement = () => this.mp().finishPlacement();
    private finishEndMove = () => this.mp().finishEndMove();

    // ---- movement helpers ----
    private movableFigures(me: PlayerState): Figure[] {
        const q = me.movementQueue;
        if (q.length === 0) return [];
        const anyFree = q.some(pt => pt.figureId === null);
        return me.figures.filter(f =>
            (f.zone === 'neighborhood' || f.zone === 'entrance') &&
            (anyFree || q.some(pt => pt.figureId === f.id))
        );
    }
    private moveTargetsFor(me: PlayerState, figId: string | null): Map<string, MoveOption> {
        const map = new Map<string, MoveOption>();
        if (!figId) return map;
        const fig = me.figures.find(f => f.id === figId);
        if (!fig) return map;
        for (const opt of legalMoveOptions(fig, me.grid)) {
            if (opt.kind === 'step' || opt.kind === 'slide') map.set(`${opt.to[0]},${opt.to[1]}`, opt);
        }
        return map;
    }

    // ---- panels ----
    private renderDiscoverPrompt(me: PlayerState) {
        const types = this.props.shared.activeTypes.filter(t => me.figures.some(f => f.type === t && f.zone === 'notDiscovered'));
        const sel = this.state.discoverType && types.includes(this.state.discoverType) ? this.state.discoverType : null;
        return (
            <div className="nz-prompt discover">
                <span className="nz-prompt-title">Discover an animal ({me.pendingDiscovers})</span>
                {types.length === 0 && <span className="nz-muted">No undiscovered animals left.</span>}
                <div className="nz-discover-pick">
                    {types.map(t => (
                        <button key={t} className={['nz-btn tiny', sel === t ? 'on' : ''].join(' ')} onClick={() => this.setState({ discoverType: t })}>
                            <Icon id={animalIconId(t)} size={22} /> {ANIMALS[t].name}
                        </button>
                    ))}
                </div>
                {sel && <span className="nz-muted">Tap a glowing entrance cell to place your {ANIMALS[sel].name}.</span>}
            </div>
        );
    }

    private renderBonusPrompt(me: PlayerState) {
        const piles = this.props.shared.bonusPiles;
        return (
            <div className="nz-prompt bonus">
                <span className="nz-prompt-title">Take a Bonus tile ({me.pendingBonuses})</span>
                <div className="nz-prompt-terrains">
                    {TERRAINS.map(t => (
                        <button key={t} className="nz-btn" disabled={piles[t] <= 0} onClick={() => this.resolveBonus(t)}
                            style={{ background: TERRAIN_COLORS[t], borderColor: TERRAIN_INK[t] }}>
                            <Icon id={terrainIconId(t)} size={20} /> {t} <small>({piles[t]})</small>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    private renderHeldTiles(me: PlayerState) {
        if (me.toPlace.length === 0) return null;
        const sel = this.state.selTile;
        const selDef = sel ? tileDef(sel) : null;
        const whFree = me.warehouse.includes(null);
        return (
            <div className="nz-held">
                <span className="nz-section-title small">In hand — place, store or discard</span>
                <div className="nz-held-row">
                    {me.toPlace.map((id, i) => (
                        <TileFace key={i} id={id} size={50} selected={sel === id}
                            onClick={() => this.setState({ selTile: sel === id ? null : id, actionChoice: null })} />
                    ))}
                </div>
                {selDef && (() => {
                    const twoActions = selDef.kind === 'action' && selDef.actions.length > 1;
                    const needChoice = twoActions && this.state.actionChoice == null;
                    return (
                        <div className="nz-held-actions">
                            {twoActions && (
                                <div className="nz-choice">
                                    <span className="nz-choice-label">Pick one action to use:</span>
                                    {selDef.actions.map(a => (
                                        <button key={a} className={['nz-btn tiny', this.state.actionChoice === a ? 'on' : ''].join(' ')}
                                            onClick={() => this.setState({ actionChoice: a })}>
                                            <Icon id={actionIconId(a)} size={16} color="#544d66" /> {ACTION_LABELS[a]}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <span className="nz-muted">
                                {needChoice ? 'Choose an action above first.' : 'Tap a highlighted cell to place.'}
                            </span>
                            <button className="nz-btn tiny" disabled={!whFree} onClick={this.storeTile}>Store</button>
                            <button className="nz-btn tiny ghost" onClick={this.discardTile}>Discard → move</button>
                        </div>
                    );
                })()}
            </div>
        );
    }

    private renderWarehouse(me: PlayerState, active: boolean) {
        return (
            <div className="nz-warehouse">
                <span className="nz-section-title small">Warehouse</span>
                <div className="nz-wh-slots">
                    {me.warehouse.map((id, i) => (
                        <div key={i} className="nz-wh-slot">
                            {id ? <TileFace id={id} size={44} /> : <span className="nz-wh-empty">empty</span>}
                            {id && active && (
                                <div className="nz-wh-btns">
                                    <button className="nz-btn xtiny" onClick={() => this.deployWarehouse(i)}>Use</button>
                                    <button className="nz-btn xtiny ghost" onClick={() => this.discardWarehouse(id)}>Discard</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    private renderMovementPanel(me: PlayerState) {
        const movable = this.movableFigures(me);
        if (me.movementQueue.length === 0) return null;
        const sel = this.state.selFigure && movable.find(f => f.id === this.state.selFigure) ? this.state.selFigure : (movable[0]?.id ?? null);
        const fig = sel ? me.figures.find(f => f.id === sel) : null;
        const opts = fig ? legalMoveOptions(fig, me.grid) : [];
        return (
            <div className="nz-prompt move">
                <span className="nz-prompt-title">Movement — {me.movementQueue.length} point(s) left</span>
                <div className="nz-move-figs">
                    {movable.map(f => (
                        <FigureToken key={f.id} fig={f} size={30} selectable selected={sel === f.id}
                            onClick={() => this.setState({ selFigure: f.id })} />
                    ))}
                </div>
                {fig && (
                    <div className="nz-move-opts">
                        {opts.length === 0 && <span className="nz-muted">No legal move.</span>}
                        {opts.filter(o => o.kind === 'rotate').map((o, i) => (
                            <button key={'r' + i} className="nz-btn tiny" onClick={() => this.resolveMove(fig.id, o)}>
                                Turn {DIR_ARROW[(o as any).heading as Dir]}
                            </button>
                        ))}
                        {opts.some(o => o.kind === 'wake') && (
                            <button className="nz-btn tiny" onClick={() => this.resolveMove(fig.id, { kind: 'wake' })}>Wake up</button>
                        )}
                        {opts.some(o => o.kind === 'step' || o.kind === 'slide') && (
                            <span className="nz-muted">Tap a highlighted cell to move.</span>
                        )}
                        <button className="nz-btn tiny ghost" onClick={() => this.skipMove(fig.id)}>Skip</button>
                    </div>
                )}
            </div>
        );
    }

    private topBar(): string {
        const s = this.props.shared;
        if (s.phase === 'scoring') return 'Final scores';
        if (s.phase === 'draft') return this.props.isMyDraftTurn ? 'Your draft pick' : `${s.playerNames[s.currentDrafter || ''] || 'Player'} is drafting`;
        if (s.phase === 'placement') return this.props.me?.placementDone ? 'Waiting for others…' : `Round ${s.round + 1} · place your tile`;
        if (s.phase === 'endRoundMove') return `End of round · ${s.winningTerrain ?? 'no'} terrain moves`;
        return 'Night at the Zoo';
    }

    private renderArena() {
        const p = this.props;
        const s = p.shared;
        const me = p.me;
        if (s.phase === 'scoring') return <ScoringPanel p={p} />;
        if (!me) return <div className="nz-muted pad">Loading…</div>;

        const iAmDrafting = s.phase === 'draft' && p.isMyDraftTurn;
        const iPlacing = s.phase === 'placement' && !me.placementDone;
        const iEndMoving = s.phase === 'endRoundMove' && !me.endMoveDone;

        const selDef = this.state.selTile ? tileDef(this.state.selTile) : null;
        const needChoice = !!selDef && selDef.kind === 'action' && selDef.actions.length > 1 && this.state.actionChoice == null;
        const placeMode = iPlacing && !!selDef && !needChoice;
        const placeableAt = selDef ? (r: number, c: number) => canPlaceOnCell(selDef, r, c) : undefined;
        const moveMode = (iPlacing || iEndMoving) && me.movementQueue.length > 0;
        const movable = moveMode ? this.movableFigures(me) : [];
        const activeFig = moveMode
            ? (this.state.selFigure && movable.find(f => f.id === this.state.selFigure) ? this.state.selFigure : (movable[0]?.id ?? null))
            : null;
        const moveTargets = moveMode ? this.moveTargetsFor(me, activeFig) : undefined;

        const discoverType = (iPlacing && me.pendingDiscovers > 0 && this.state.discoverType
            && me.figures.some(f => f.type === this.state.discoverType && f.zone === 'notDiscovered'))
            ? this.state.discoverType : null;

        return (
            <div className="nz-arena">
                <div className="nz-hud">
                    <span className="nz-round">Draft {s.draftNumber}/15 · Round {s.round + 1}</span>
                    {me && <span className="nz-live-vp">{s.publicPlayers[me.id]?.liveScore.total ?? 0} VP</span>}
                </div>

                {(s.phase === 'draft') && (
                    <>
                        <MarketRow shared={s} canDraft={iAmDrafting} onDraft={this.draft} />
                        {!iAmDrafting && <div className="nz-wait-note">Waiting for {s.playerNames[s.currentDrafter || ''] || 'the next player'} to draft…</div>}
                    </>
                )}

                {s.phase === 'endRoundMove' && (
                    <div className="nz-endround-note">
                        The <b>{s.winningTerrain ?? 'no'}</b> terrain was most common in the Leftover zone — every discovered animal on it moves once.
                    </div>
                )}

                {s.leftover.length > 0 && <LeftoverRow shared={s} />}

                {iPlacing && me.pendingDiscovers > 0 && this.renderDiscoverPrompt(me)}
                {iPlacing && me.pendingBonuses > 0 && this.renderBonusPrompt(me)}
                {iPlacing && this.renderHeldTiles(me)}
                {moveMode && this.renderMovementPanel(me)}

                <Board
                    grid={me.grid}
                    figures={me.figures}
                    placeableAt={placeMode ? placeableAt : undefined}
                    onPlaceCell={this.placeTile}
                    moveTargets={moveTargets}
                    onMoveCell={activeFig ? (opt) => this.resolveMove(activeFig, opt) : undefined}
                    selectableFigures={moveMode}
                    selectedFigureId={activeFig}
                    onFigureClick={(fid) => this.setState({ selFigure: fid })}
                    discoverTargets={!!discoverType}
                    onDiscoverCell={discoverType ? (r, c) => this.resolveDiscover(discoverType, r, c) : undefined}
                    winningTerrain={s.winningTerrain}
                />

                {(iPlacing || iEndMoving) && this.renderWarehouse(me, iPlacing)}

                <div className="nz-arena-actions">
                    {iPlacing && (
                        <button className="nz-btn primary" disabled={me.toPlace.length > 0} onClick={this.finishPlacement}>
                            {me.toPlace.length > 0 ? 'Resolve your tiles first' : 'Done placing'}
                        </button>
                    )}
                    {iEndMoving && (
                        <button className="nz-btn primary" onClick={this.finishEndMove}>Done moving</button>
                    )}
                    {s.phase === 'placement' && me.placementDone && <span className="nz-muted">Waiting for other keepers…</span>}
                    {s.phase === 'endRoundMove' && me.endMoveDone && <span className="nz-muted">Waiting for other keepers…</span>}
                </div>

                <AnimalReference types={s.activeTypes} />
            </div>
        );
    }

    public render() {
        const p = this.props;
        const mp = this.mp();
        if (!p.shared) {
            return mp.getPluginView('gameshell', 'HostShell-Main', {
                'gameName': 'Night at the Zoo',
                'links': { 'home': { 'icon': 'th', 'label': 'Zoo', 'view': <div className="nz-muted pad">Loading…</div> } }
            });
        }
        const s = p.shared;
        const myTurn = (s.phase === 'draft' && p.isMyDraftTurn)
            || (s.phase === 'placement' && p.me && !p.me.placementDone)
            || (s.phase === 'endRoundMove' && p.me && !p.me.endMoveDone);

        const links: any = {
            'home': { 'icon': 'th', 'label': 'Zoo', 'view': this.renderArena() },
            'players': { 'icon': 'users', 'label': 'Keepers', 'view': <PlayersStrip p={p} /> },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView activeTypes={s.activeTypes} /> }
        };
        if (p.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="nz-settings">
                        <button className="nz-btn primary" onClick={() => mp.restartGame()}>Restart game</button>
                        <button className="nz-btn ghost" onClick={() => mp.backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Night at the Zoo',
            'links': links,
            'topBarContent': this.topBar(),
            'roomClassName': myTurn ? 'attention-bg' : ''
        });
    }
}
