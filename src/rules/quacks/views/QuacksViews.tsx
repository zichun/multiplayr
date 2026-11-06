/**
 * QuacksViews.tsx — React views for The Quacks of Quedlinburg.
 *
 * Presentation only: every mutation goes through an MP RPC method. The only
 * component state is UI-local (the shopping basket, which book is zoomed).
 *
 * Built for a phone in portrait: the pot is a 7-wide grid that scales with the
 * column, the three brewing buttons sit in one thumb-reachable row, and
 * everything that is reference material (books, rivals' pots, rules) lives in
 * its own gameshell tab.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';

import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import { Die } from '../../../client/lib/dice-roller/Die';

import {
    Chip, ChipColor, chipColor, chipValue, makeChip, INGREDIENT_NAME, Field, POT_TRACK, SPOON_FIELD,
    BOOK_ORDER, Book, getBook, SET_NAMES, BookSets, presetOf, pickableBooks, bookChoices, maxPlayers,
    Witch, WITCH_BY_ID, WITCHES, METALS,
    Patient, PATIENTS, PATIENT_BY_ID, Glass, glassLabel, ESSENCE_MAX, bookLabel, FORTUNE_BY_ID, FortuneCard, DieFace, DIE_FACE_LABEL,
    ROUNDS, MIN_PLAYERS, YELLOW_REVEAL_ROUND, PURPLE_REVEAL_ROUND, roundEvent,
    DROPLET_COST, FLASK_COST
} from '../QuacksData';
import {
    QUACKS_ICONS, QUACKS_PALETTE, chipIconId, getBookCardDefinition, getFortuneCardDefinition,
    getWitchCardDefinition, witchIconId, getPatientCardDefinition,
    QUACKS_DIE_FACES, QUACKS_DIE_THEME
} from '../QuacksAssets';
import { Phase, EvalStage, PotChip, Prompt, ShopOffer } from '../QuacksGameState';

// Cards are rendered in pixel-scaled mode, so these are true on-screen widths.
const SIZE_BOOK = 150;
const SIZE_BOOK_LOBBY = 132;
const SIZE_FORTUNE = 150;
const SIZE_DETAIL = 250;

// ---------------------------------------------------------------------------
// Prop shapes
// ---------------------------------------------------------------------------

interface PublicPlayer {
    vp: number;
    rubies: number;
    droplet: number;
    flaskFull: boolean;
    bagCount: number;
    bag: Record<Chip, number>;
    pot: PotChip[];
    aside: Chip[];
    ratTails: number;
    origin: number;
    stopped: boolean;
    exploded: boolean;
    potFull: boolean;
    shielded: boolean;
    shieldLeft: number;
    whiteSum: number;
    threshold: number;
    field: Field;
    stage: EvalStage | null;
    coins: number;
    rolled: DieFace[];
    notes: string[];
    deciding: boolean;
    intentSet: boolean;
    needsAction: boolean;
    // Herb Witches
    overflow: Chip[];
    reserve: Chip[];
    carry: Chip | null;
    pennies: Record<string, boolean>;
    saved: boolean;
    cheap: boolean;
    extraShops: number;
    // The Alchemists
    patient: string | null;
    essence: number;
    essenceReach: number;
    extraRats: number;
    pendingDraw: number;
    hand: Chip[];
    essenceNow: number;
}

interface QuacksProps extends ViewPropsInterface {
    phase: Phase;
    round: number;
    bookSets: BookSets;
    lockstep: boolean;
    playerOrder: string[];
    turnOrder: string[];
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    publicPlayers: Record<string, PublicPlayer>;
    fortune: string | null;
    fortuneNotes: string[];
    revealed: ChipColor[];
    offers: ShopOffer[];
    maxBuy: number;
    winnerIds: string[] | null;
    isHost: boolean;
    myPrompt: Prompt | null;
    myIntent: 'draw' | 'stop' | null;
    myCanFlask: boolean;
    myCollection: Record<Chip, number> | null;
    expansion: boolean;
    witchIds: string[];
    myWitchUsable: Record<string, boolean>;
    myRubyCost: { droplet: number; flask: number };
    alch: boolean;
    patientIds: string[];
    guestWitch: string | null;
    myForget: number[];
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

const Ic: React.FC<{ id: string; size?: number; title?: string }> = ({ id, size, title }) => (
    <span className="qk-ic" style={size ? { width: size, height: size } : undefined} title={title}>
        <ExpressiveIcon icon={QUACKS_ICONS[id]} palette={QUACKS_PALETTE} savedIcons={QUACKS_ICONS} />
    </span>
);

/** An ingredient chip: the coloured disc carries the ingredient, the badge its value. */
const ChipView: React.FC<{ chip: Chip; size?: number; className?: string }> = ({ chip, size, className }) => (
    <span
        className={['qk-chip', className || ''].join(' ').trim()}
        style={size ? { width: size, height: size, fontSize: size } : undefined}
        title={`${INGREDIENT_NAME[chipColor(chip)]} ${chipValue(chip)}`}
    >
        <ExpressiveIcon icon={QUACKS_ICONS[chipIconId(chipColor(chip))]} palette={QUACKS_PALETTE} savedIcons={QUACKS_ICONS} />
        {/* a fool's herb has no fixed value, so it carries no badge */}
        {chipColor(chip) !== 'herb' && <b className="qk-chip-val">{chipValue(chip)}</b>}
    </span>
);

/** A multiset of chips as `chip ×n`, whites first, then in book order, small to large. */
const ChipCounts: React.FC<{ counts: Record<Chip, number>; size?: number }> = ({ counts, size = 28 }) => {
    const order = (c: Chip) => (chipColor(c) === 'white' ? -1 : BOOK_ORDER.indexOf(chipColor(c)));
    const chips = Object.keys(counts).filter(c => counts[c] > 0)
        .sort((a, b) => order(a) - order(b) || chipValue(a) - chipValue(b));
    return (
        <div className="qk-collection">
            {chips.map(c => (
                <span className="qk-count" key={c}><ChipView chip={c} size={size} /><b>&times;{counts[c]}</b></span>
            ))}
        </div>
    );
};

/** What is still in a bag. Counts only — the draw order stays secret. */
const BagContents: React.FC<{ pl: PublicPlayer; size?: number }> = ({ pl, size }) => (
    <div className="qk-bag">
        <div className="qk-bag-head">
            <Ic id="bag" size={18} />
            <span>In the bag</span>
            <b>{pl.bagCount}</b>
        </div>
        {pl.bagCount > 0
            ? <ChipCounts counts={pl.bag} size={size} />
            : <span className="qk-muted">Empty</span>}
    </div>
);

/** A gold disc with a number — always a coin value or a price. */
const Coin: React.FC<{ n: number; size?: number }> = ({ n, size = 24 }) => (
    <span className="qk-coin" style={{ width: size, height: size, fontSize: size * 0.48 }}>{n}</span>
);

const Stat: React.FC<{ icon: string; value: React.ReactNode; label: string }> = ({ icon, value, label }) => (
    <span className="qk-stat" title={label}>
        <Ic id={icon} size={18} />
        <b>{value}</b>
    </span>
);

const FieldReward: React.FC<{ field: Field }> = ({ field }) => (
    <span className="qk-reward-items">
        <Coin n={field.coins} />
        <span className="qk-reward-vp"><Ic id="vp" size={20} /><b>{field.vp}</b></span>
        {field.ruby && <Ic id="ruby" size={18} title="plus 1 ruby" />}
    </span>
);

// ---------------------------------------------------------------------------
// The pot
// ---------------------------------------------------------------------------

/**
 * The pot track: start + 33 spaces + the spoon, seven to a row. An empty space
 * shows what stopping there is worth (gold coin value, star points, ruby); a
 * filled one shows only its chip. The space you would score right now is ringed.
 */
/** A rival's scoring space (just past their last chip), drawn as a translucent marker on your own pot. */
interface Ghost {
    id: string;
    name: string;
    pos: number;
    accent: string;
    icon: number;
    state: 'brewing' | 'stopped' | 'boom';
}

const GHOST_STATE: Record<Ghost['state'], string> = { brewing: 'brewing', stopped: 'stopped', boom: 'exploded' };

/**
 * The small marker that sits in the lane above a pot space. It is too small for
 * a corner flag, so an exploded rival shows the burst in place of their icon
 * and a stopped one turns solid with a green ring.
 */
const GhostMarker: React.FC<{ g: Ghost }> = ({ g }) => (
    <span
        className={`qk-ghost ${g.state}`}
        style={{ ['--c' as any]: g.accent }}
        title={`${g.name}: ${GHOST_STATE[g.state]} at space ${g.pos}`}
    >
        {g.state === 'boom'
            ? <Ic id="boom" />
            : <FontAwesomeIcon icon={LOBBY_ICONS[g.icon] || 'circle'} className="qk-ghost-icon" />}
    </span>
);

const PotTrack: React.FC<{ pl: PublicPlayer; mini?: boolean; showScoring?: boolean; ghosts?: Ghost[] }> =
    ({ pl, mini, showScoring = true, ghosts = [] }) => {
    const byPos: Record<number, PotChip> = {};
    pl.pot.forEach((c) => { byPos[c.pos] = c; });
    const last = pl.pot.length ? pl.pot[pl.pot.length - 1] : null;
    const ghostsAt = (index: number) => {
        const here = ghosts.filter(g => g.pos === index);
        if (!here.length) return null;
        return <span className="qk-ghosts">{here.map(g => <GhostMarker key={g.id} g={g} />)}</span>;
    };

    return (
        <div className={['qk-pot', mini ? 'mini' : '', ghosts.length ? 'with-ghosts' : ''].join(' ').trim()}>
            {POT_TRACK.map((f) => {
                const chip = byPos[f.index];
                const spoon = f.index === SPOON_FIELD;
                const cls = ['qk-cell'];
                if (chip) cls.push('filled');
                if (!chip && f.index <= pl.origin && f.index > 0) cls.push('skipped');
                if (f.index === 0) cls.push('start');
                if (spoon) cls.push('spoon');
                if (showScoring && f.index === pl.field.index) cls.push('scoring');
                if (chip && last && chip === last) cls.push('latest');
                if (chip && chip.gone) cls.push('gone');

                return (
                    <div className={cls.join(' ')} key={f.index}>
                        {chip
                            ? <ChipView chip={chip.chip} className="fluid" />
                            : f.index === 0
                                ? <span className="qk-cell-start">GO</span>
                                : (
                                    <>
                                        {spoon && <span className="qk-cell-spoon"><Ic id="spoon" /></span>}
                                        <span className="qk-cell-coin">{f.coins}</span>
                                        {!mini && <span className="qk-cell-vp"><Ic id="vp" />{f.vp}</span>}
                                        {f.ruby && <span className="qk-cell-ruby"><Ic id="ruby" /></span>}
                                    </>
                                )}
                        {ghostsAt(f.index)}
                        {f.index === pl.droplet && <span className="qk-mark drop" title="Your droplet"><Ic id="droplet" /></span>}
                        {pl.ratTails > 0 && f.index === pl.origin && f.index !== pl.droplet && (
                            <span className="qk-mark rat" title="Rat stone"><Ic id="rat" /></span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/** White-chip total against the explosion limit, one pip per point. */
const Meter: React.FC<{ pl: PublicPlayer }> = ({ pl }) => {
    const over = pl.whiteSum > pl.threshold;
    const level = over ? 'boom' : pl.whiteSum >= pl.threshold - 1 ? 'hot' : pl.whiteSum >= pl.threshold - 3 ? 'warm' : 'calm';
    const pips: React.ReactNode[] = [];
    for (let i = 1; i <= pl.threshold; i++) {
        pips.push(<span key={i} className={['qk-meter-pip', i <= pl.whiteSum ? 'on' : ''].join(' ').trim()} />);
    }
    return (
        <div className={`qk-meter ${level}`}>
            <ChipView chip="white1" size={22} className="plain" />
            <div className="qk-meter-pips">{pips}</div>
            <span className="qk-meter-num">
                <b>{pl.whiteSum}</b>/{pl.threshold}
            </span>
            <Ic id="boom" size={20} />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const BookCard: React.FC<{ book: Book; width?: number; onClick?: () => void; locked?: string | null }> =
    ({ book, width = SIZE_BOOK, onClick, locked }) => (
        <div className={['qk-card qk-book', locked ? 'locked' : '', Object.keys(book.costs).length === 1 ? 'single' : ''].join(' ').trim()}>
            <PlayingCard
                card={getBookCardDefinition(book)}
                customIcons={QUACKS_ICONS}
                width={`${width}px`}
                selectable={!!onClick}
                hoverStyle="none"
                onClick={onClick}
            />
            {locked && <span className="qk-lock">{locked}</span>}
        </div>
    );

const FortuneCardView: React.FC<{ card: FortuneCard; width?: number; onClick?: () => void }> =
    ({ card, width = SIZE_FORTUNE, onClick }) => (
        <div className="qk-card qk-fortune">
            <PlayingCard
                card={getFortuneCardDefinition(card)}
                customIcons={QUACKS_ICONS}
                width={`${width}px`}
                selectable={!!onClick}
                hoverStyle="none"
                onClick={onClick}
            />
        </div>
    );

const WitchCardView: React.FC<{ witch: Witch; width?: number; onClick?: () => void; spent?: boolean }> =
    ({ witch, width = SIZE_FORTUNE, onClick, spent }) => (
        <div className={['qk-card qk-fortune qk-witch', spent ? 'locked' : ''].join(' ').trim()}>
            <PlayingCard
                card={getWitchCardDefinition(witch)}
                customIcons={QUACKS_ICONS}
                width={`${width}px`}
                selectable={!!onClick}
                hoverStyle="none"
                onClick={onClick}
            />
            {spent && <span className="qk-lock">penny spent</span>}
        </div>
    );

const PatientCardView: React.FC<{ patient: Patient; width?: number; onClick?: () => void; mine?: boolean }> =
    ({ patient, width = SIZE_FORTUNE, onClick, mine }) => (
        <div className={['qk-card qk-fortune qk-patient', mine ? 'mine' : ''].join(' ').trim()}>
            <PlayingCard
                card={getPatientCardDefinition(patient)}
                customIcons={QUACKS_ICONS}
                width={`${width}px`}
                selectable={!!onClick}
                hoverStyle="none"
                onClick={onClick}
            />
            {mine && <span className="qk-lock">your patient</span>}
        </div>
    );

/** The glyph and number a glass shows on the essence track. */
function glassFace(g: Glass): { icon: string; n?: number | string } {
    if (g.vp) return { icon: 'vp', n: g.vp };
    if (g.rat) return { icon: 'rat' };
    if (g.draw) return { icon: 'bag', n: g.draw };
    if (g.earworm) return { icon: 'tail', n: g.earworm };
    if (g.coins) return { icon: 'coin', n: g.coins };
    const b: Record<string, { icon: string; n?: number | string }> = {
        ruby1: { icon: 'ruby', n: 1 }, ruby3: { icon: 'ruby', n: 3 }, pumpkin: { icon: 'chip_orange' }, red1: { icon: 'chip_red' },
        refill: { icon: 'flask' }, drop2: { icon: 'droplet', n: 2 }, roll2: { icon: 'die', n: 2 }, roll4: { icon: 'die', n: 4 },
        up12: { icon: 'bag', n: '1→2' }, up14: { icon: 'bag', n: '1→4' }
    };
    return b[g.bonus || ''] || { icon: 'alembic' };
}

/**
 * A patient's essence track: the flask's 0–12 spaces, each glass's reward, the
 * marker where it stands (`at`) and, while brewing, where this pot would push it (`reach`).
 */
const EssenceTrack: React.FC<{ patient: Patient; at?: number; reach?: number }> = ({ patient, at, reach }) => {
    const cells: React.ReactNode[] = [];
    for (let f = 0; f <= ESSENCE_MAX; f++) {
        const g = patient.track[f];
        const face = g ? glassFace(g) : null;
        cells.push(
            <div key={f} className={['qk-ess-cell', g ? 'glass' : '', at === f ? 'at' : '', reach === f && reach !== at ? 'reach' : ''].join(' ').trim()}
                title={g ? `${f}: ${glassLabel(g)}` : `${f}`}>
                <span className="qk-ess-num">{f}</span>
                {face && <span className="qk-ess-glass"><Ic id={face.icon} />{face.n !== undefined && <b>{face.n}</b>}</span>}
            </div>
        );
    }
    return <div className="qk-ess-track">{cells}</div>;
};

const Modal: React.FC<{ onClose: () => void; children?: React.ReactNode }> = ({ onClose, children }) => (
    <div className="qk-modal-backdrop" onClick={onClose}>
        <div className="qk-modal" onClick={(e) => e.stopPropagation()}>
            {children}
            <button className="qk-btn block" onClick={onClose}>Close</button>
        </div>
    </div>
);

function booksFor(sets: BookSets, playerCount: number, expansion = false, alch = false): Book[] {
    return BOOK_ORDER.map(c => getBook(c, sets, playerCount, expansion, alch)).filter(b => !!b) as Book[];
}

const setLabel = (sets: BookSets, expansion = false, alch = false): string => {
    const preset = presetOf(sets, expansion, alch);
    return preset ? SET_NAMES[preset] : 'Custom mix';
};

/** Card text with its `[icon:id]` tokens drawn as inline glyphs. */
const RuleText: React.FC<{ text: string }> = ({ text }) => (
    <span className="qk-ruletext">
        {text.split(/(\[icon:[a-zA-Z0-9_-]+\])/g).map((part, i) => {
            const m = part.match(/^\[icon:([a-zA-Z0-9_-]+)\]$/);
            return m ? <Ic key={i} id={m[1]} size={15} /> : <React.Fragment key={i}>{part}</React.Fragment>;
        })}
    </span>
);

const lockLabel = (color: ChipColor, round: number): string | null => {
    if (color === 'yellow' && round < YELLOW_REVEAL_ROUND) return `opens in round ${YELLOW_REVEAL_ROUND}`;
    if (color === 'purple' && round < PURPLE_REVEAL_ROUND) return `opens in round ${PURPLE_REVEAL_ROUND}`;
    return null;
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rules: shared diagrams
// ---------------------------------------------------------------------------

interface RoundEventView { icon: string; chip?: Chip; label: string; tone?: 'unlock' | 'add' | 'final' | 'herb'; }

/** What each of the nine rounds brings. Every round also opens with a fortune card. */
function roundEvents(round: number, expansion: boolean): RoundEventView[] {
    const ev: RoundEventView[] = [];
    if (round === 1) {
        ev.push({ icon: 'bag', label: '9 chips each' });
        if (expansion) ev.push({ icon: 'witch_silver', label: '3 witch pennies', tone: 'herb' });
    }
    if (round === 2) {
        ev.push({ icon: 'chip_yellow', label: 'Mandrake opens', tone: 'unlock' });
        ev.push({ icon: 'rat', label: 'Rats begin', tone: 'unlock' });
    }
    if (round === 3) ev.push({ icon: 'chip_purple', label: 'Ghost’s Breath opens', tone: 'unlock' });
    if (round === 6) ev.push({ icon: 'chip_white', label: '+1 cherry bomb each', tone: 'add' });
    if (round === 9) {
        ev.push({ icon: 'bag', label: 'Stir together', tone: 'final' });
        ev.push({ icon: 'vp', label: 'Final tally', tone: 'final' });
    }
    return ev;
}

const RoundTimeline: React.FC<{ expansion?: boolean; current?: number }> = ({ expansion = false, current }) => (
    <div className="qk-timeline">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => {
            const ev = roundEvents(r, expansion);
            return (
                <div key={r} className={['qk-round', ev.length ? 'has' : 'quiet', current === r ? 'now' : '',
                    current && r < current ? 'past' : ''].join(' ').trim()}>
                    <span className="qk-round-num">{r}</span>
                    {ev.length
                        ? ev.map((e, i) => (
                            <span key={i} className={`qk-round-ev ${e.tone || ''}`}>
                                <Ic id={e.icon} size={16} />{e.label}
                            </span>
                        ))
                        : <span className="qk-round-ev muted">fortune card only</span>}
                    {current === r && <span className="qk-round-here">now</span>}
                </div>
            );
        })}
    </div>
);

/** The fixed order of one round. */
const RoundSteps: React.FC = () => (
    <div className="qk-steps">
        {[
            { icon: 'crystal', label: 'Fortune card' },
            { icon: 'rat', label: 'Rat stones' },
            { icon: 'bag', label: 'Everyone brews' },
            { icon: 'vp', label: 'Scoring A–F' }
        ].map((s, i) => (
            <React.Fragment key={i}>
                {i > 0 && <span className="qk-step-arrow" aria-hidden="true" />}
                <span className="qk-step"><Ic id={s.icon} size={22} /><span>{s.label}</span></span>
            </React.Fragment>
        ))}
    </div>
);

interface FlowCell { icon?: string; text: React.ReactNode; off?: boolean; witch?: { metal: string; text: string }; }
interface FlowRow { letter: string; name: string; safe: FlowCell; boom?: FlowCell; }

/**
 * After brewing: a safe pot and an exploded pot side by side, phase by phase.
 * A row with one cell applies to both. `expansion` adds where witches can step in.
 */
const EndOfDrawFlow: React.FC<{ expansion?: boolean }> = ({ expansion = false }) => {
    const w = (metal: string, text: string) => (expansion ? { metal, text } : undefined);
    const rows: FlowRow[] = [
        {
            letter: 'A', name: 'Bonus die',
            safe: { icon: 'die', text: <>Best scoring space rolls. Ties all roll{expansion ? '; a full pot always rolls' : ''}.</> },
            boom: { icon: 'die', text: 'No die.', off: true, witch: w('silver', 'The Survivor: score as if safe') }
        },
        {
            letter: 'B', name: 'Chip actions',
            safe: { icon: 'chip_green', text: 'Hawkmoth, then garden spider, then ghost’s breath books resolve. Explosions don’t matter here.' }
        },
        {
            letter: 'C', name: 'Ruby',
            safe: { icon: 'ruby', text: 'Scoring space shows a ruby: take it.', witch: w('gold', 'The Miner: as many rubies as its points') }
        },
        {
            letter: 'D', name: 'Points',
            safe: { icon: 'vp', text: <>Score the space&rsquo;s points{expansion ? ', plus half the overflow bowl' : ''}.</> },
            boom: { icon: 'boom', text: <><b>Choose one:</b> the points <b>or</b> the shopping trip.</> }
        },
        {
            letter: 'E', name: 'Shop',
            // the exploded side of E is the "choose one" cell that spans D and E
            safe: { icon: 'coin', text: 'Spend the space’s coins on 1–2 chips of different colours.', witch: w('bronze', 'Bronze witches act here') }
        },
        {
            letter: 'F', name: 'Rubies',
            safe: { icon: 'flask', text: '2 rubies: droplet +1 or refill the flask, as often as you like.', witch: w('gold', 'The Discounter: 1 ruby each') }
        }
    ];
    return (
        <div className="qk-flow">
            <span className="qk-flow-corner" />
            <span className="qk-flow-head safe"><Ic id="spoon" size={18} />Stopped safely</span>
            <span className="qk-flow-head boom"><Ic id="boom" size={18} />Exploded</span>
            {rows.map((r) => {
                const merged = !r.boom;
                const cell = (c: FlowCell, cls: string) => (
                    <div className={['qk-flow-cell', cls, c.off ? 'off' : ''].join(' ').trim()}>
                        {c.icon && <Ic id={c.icon} size={20} />}
                        <span className="qk-flow-text">{c.text}</span>
                        {c.witch && (
                            <span className="qk-flow-witch"><Ic id={`witch_${c.witch.metal}`} size={14} />{c.witch.text}</span>
                        )}
                    </div>
                );
                // the exploded "choose one" spans the points and shop rows
                if (r.letter === 'E') {
                    return (
                        <React.Fragment key={r.letter}>
                            <span className="qk-flow-letter"><b>{r.letter}</b>{r.name}</span>
                            {cell(r.safe, 'safe')}
                        </React.Fragment>
                    );
                }
                return (
                    <React.Fragment key={r.letter}>
                        <span className="qk-flow-letter"><b>{r.letter}</b>{r.name}</span>
                        {merged ? cell(r.safe, 'both') : cell(r.safe, 'safe')}
                        {!merged && cell(r.boom!, r.letter === 'D' ? 'boom tall' : 'boom')}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

/** What happens the moment a pot goes over the limit. */
const ExplosionStrip: React.FC<{ expansion?: boolean }> = ({ expansion = false }) => (
    <div className="qk-boomstrip">
        <span className="qk-boomstrip-chips">
            <ChipView chip="white3" size={26} /><ChipView chip="white2" size={26} /><ChipView chip="white3" size={26} />
            <b>= 8</b><Ic id="boom" size={24} />
        </span>
        <ul>
            <li>Cherry bombs total <b>more than 7</b>: the pot explodes.</li>
            <li>The chip that did it stays in the pot, and you stop drawing.</li>
            <li>The flask can&rsquo;t save you{expansion ? ' — unless The Bottler is in this game' : ''}.</li>
            <li>You still score: see the right-hand column below.</li>
        </ul>
    </div>
);

// ---------------------------------------------------------------------------
// Rules tabs
// ---------------------------------------------------------------------------

const RulesView: React.FC<{ round?: number }> = ({ round }) => (
    <div className="qk-rules">
        <h3>Brew the best potion</h3>
        <p>
            Nine rounds. Everyone draws chips from their own bag at the same time and lays them in their pot.
            A chip moves as many spaces as its value. Stop whenever you like &mdash; the space right after your
            last chip is your <b>scoring space</b>.
        </p>
        <div className="qk-legend">
            <span><Coin n={12} size={22} />coins to shop</span>
            <span><Ic id="vp" size={20} />points</span>
            <span><Ic id="ruby" size={20} />a ruby</span>
            <span><Ic id="droplet" size={20} />your start</span>
        </div>

        <h3>Each round</h3>
        <RoundSteps />

        <h3>Round by round</h3>
        <RoundTimeline current={round} />
        <p className="qk-muted">Every round starts with a fortune card. The start player passes clockwise.</p>

        <h3>Don&rsquo;t blow it up</h3>
        <ExplosionStrip />
        <p className="qk-rule-line">
            <Ic id="flask" size={24} />
            <span>Once a round, your full flask puts the chip you just drew back in the bag. Refill it with 2 rubies.</span>
        </p>

        <h3>When everyone has stopped</h3>
        <EndOfDrawFlow />
        <p className="qk-muted">Then every chip goes back in its bag, bought ones too.</p>

        <h3>Catching up</h3>
        <p className="qk-rule-line"><Ic id="droplet" size={24} /><span>Your first chip counts from your droplet, which only ever moves forward.</span></p>
        <p className="qk-rule-line"><Ic id="rat" size={24} /><span>From round 2, everyone behind the leader starts further on: 1 space per rat tail between you on the score track.</span></p>

        <h3>The end</h3>
        <p className="qk-rule-line">
            <Ic id="vp" size={24} />
            <span>After round 9, every 5 coins and every 2 rubies become 1 point. Most points wins; a tie goes to whoever got furthest in the last round.</span>
        </p>
        <p className="qk-muted">Tap any book in the Books tab for its full rule.</p>
    </div>
);

/** The Herb Witches, in its own tab. `witches` are the three dealt in this game, if one is running. */
const ExpansionRulesView: React.FC<{ enabled?: boolean; witches?: Witch[]; round?: number }> = ({ enabled, witches, round }) => (
    <div className="qk-rules">
        <div className={['qk-banner', enabled ? 'waiting' : ''].join(' ').trim()}>
            {enabled ? 'The Herb Witches is on for this game.' : 'The Herb Witches is off. The host can switch it on in the lobby.'}
        </div>

        <h3>What it adds</h3>
        <div className="qk-adds">
            <span><ChipView chip="herb1" size={28} /><b>Fool&rsquo;s herb</b> a new ingredient with no fixed value</span>
            <span><ChipView chip="orange6" size={28} /><b>6-pumpkins</b> fill six spaces at once</span>
            <span><Ic id="crystal" size={28} /><b>Books 5 and 6</b> for every ingredient, plus a new hawkmoth</span>
            <span><Ic id="bag" size={28} /><b>A fifth player</b> up to 5 brewers</span>
            <span><Ic id="spoon" size={28} /><b>The overflow bowl</b> a full pot keeps going</span>
            <span><Ic id="witch_gold" size={28} /><b>Three herb witches</b> one call each</span>
        </div>

        <h3>The overflow bowl</h3>
        <div className="qk-bowl">
            <span className="qk-bowl-step"><span className="qk-bowl-cell">33</span>pot full</span>
            <span className="qk-step-arrow" aria-hidden="true" />
            <span className="qk-bowl-step">
                <span className="qk-bowl-dish"><ChipView chip="green4" size={22} /><ChipView chip="white2" size={22} /><ChipView chip="red1" size={22} /></span>
                keep drawing
            </span>
            <span className="qk-step-arrow" aria-hidden="true" />
            <span className="qk-bowl-step"><span className="qk-bowl-score"><Ic id="vp" size={18} />+3</span>half the total</span>
        </div>
        <p className="qk-muted">
            Reaching space 33 no longer stops you. Later chips go in the bowl: they have no powers, but cherry bombs
            still count towards exploding. You score the spoon, plus half the bowl&rsquo;s total (rounded down), and you
            always roll the bonus die unless you explode.
        </p>

        <h3>The witches</h3>
        <p className="qk-rule-line">
            <span className="qk-pennyrow">
                <Ic id="witch_silver" size={24} /><Ic id="witch_bronze" size={24} /><Ic id="witch_gold" size={24} />
            </span>
            <span>One witch of each metal is dealt. You hold one penny per metal: spend it to call that witch once in the game. Each unspent penny is worth <b>2 points</b> at the end.</span>
        </p>
        <div className="qk-metals">
            {METALS.map((m) => {
                const dealt = witches ? witches.filter(x => x.metal === m)[0] : null;
                const pool = dealt ? [dealt] : WITCHES.filter(x => x.metal === m);
                const when = m === 'silver' ? 'while brewing' : m === 'bronze' ? 'while shopping' : 'while scoring';
                return (
                    <div key={m} className={`qk-metal ${m}`}>
                        <div className="qk-metal-head"><Ic id={`witch_${m}`} size={22} /><b>{m}</b><span>{when}</span></div>
                        {pool.map(x => (
                            <div key={x.id} className="qk-metal-witch">
                                <b>{x.name}</b>
                                <RuleText text={x.text} />
                            </div>
                        ))}
                        {!dealt && <span className="qk-muted">One of these four is dealt.</span>}
                    </div>
                );
            })}
        </div>

        <h3>When everyone has stopped</h3>
        <EndOfDrawFlow expansion />

        <h3>Round by round</h3>
        <RoundTimeline expansion current={enabled ? round : undefined} />
        <p className="qk-muted">
            In round 9 you get one last stop to call bronze and gold witches before coins, rubies and unspent
            pennies are turned into points.
        </p>
    </div>
);

/** The Alchemists, in their own rules sub-tab. */
const AlchemistRulesView: React.FC<{ enabled?: boolean; patients?: Patient[] }> = ({ enabled, patients }) => (
    <div className="qk-rules">
        <div className={['qk-banner', enabled ? 'waiting' : ''].join(' ').trim()}>
            {enabled ? 'The Alchemists is on for this game.' : 'The Alchemists is off. The host can switch it on in the lobby.'}
        </div>

        <h3>Treat a patient</h3>
        <p className="qk-rule-line">
            <Ic id="alembic" size={28} />
            <span>
                Three patients are on the table. Each player picks one to treat (several may pick the same).
                Each needs a different essence, brewed in your alchemist&rsquo;s flask every round.
            </span>
        </p>

        <h3>The essence phase</h3>
        <p>After everyone stops and before scoring, your essence marker starts at 0 and climbs:</p>
        <div className="qk-steps">
            <span className="qk-step"><Ic id="chip_red" size={22} /><span>+1 per ingredient colour in your pot</span></span>
            <span className="qk-step"><ChipView chip="white3" size={22} className="plain" /><span>+1 if cherry bombs total exactly 7</span></span>
            <span className="qk-step"><Ic id="boom" size={22} /><span>+1 per exploded neighbour</span></span>
        </div>
        <p className="qk-muted">
            Explosions don&rsquo;t matter for your own essence. Then take the reward in the glass where the marker
            stops &mdash; you may settle on a lower glass. In round 9 each space is simply worth 1 point.
        </p>

        <h3>The patients</h3>
        <div className="qk-metals">
            {(patients && patients.length ? patients : PATIENTS).map(x => (
                <div key={x.id} className="qk-metal patient">
                    <div className="qk-metal-head"><Ic id={x.art} size={22} /><b>{x.name}</b>
                        <span>{x.kind === 'power' ? 'essence is spent next round' : x.kind === 'bonus' ? 'reward now' : 'see the glasses'}</span>
                    </div>
                    <RuleText text={x.text} />
                    <EssenceTrack patient={x} />
                </div>
            ))}
        </div>

        <h3>Locoweed</h3>
        <p className="qk-rule-line">
            <ChipView chip="herb1" size={28} />
            <span>One of four locoweed books is always in play with the Alchemists, whatever the set: extra essence,
                a move per colour, sending a chip back to the bag, or a move as long as your cherry bombs.</span>
        </p>
        <p className="qk-muted">Twenty more fortune cards join the deck; the few that need the Herb Witches only appear with it.</p>
    </div>
);

/**
 * The Rules tab: the base game, plus a second sub-tab for the Herb Witches.
 * In the lobby both are always offered; in a game the expansion sub-tab only
 * appears when it is being played.
 */
class RulesTabs extends React.Component<
    { showExpansion?: boolean; expansionOn?: boolean; witches?: Witch[]; round?: number;
      showAlch?: boolean; alchOn?: boolean; patients?: Patient[] },
    { tab: 'base' | 'herb' | 'alch' }
> {
    public state = { tab: 'base' as 'base' | 'herb' | 'alch' };

    public render() {
        const { showExpansion, expansionOn, witches, round, showAlch, alchOn, patients } = this.props;
        let tab = this.state.tab;
        if ((tab === 'herb' && !showExpansion) || (tab === 'alch' && !showAlch)) tab = 'base';
        return (
            <div className="qk-rules-tabs">
                {(showExpansion || showAlch) && (
                    <div className="qk-subtabs" role="tablist">
                        <button role="tab" aria-selected={tab === 'base'} className={tab === 'base' ? 'on' : ''}
                            onClick={() => this.setState({ tab: 'base' })}>
                            <Ic id="cauldron" size={18} />Base
                        </button>
                        {showExpansion && (
                            <button role="tab" aria-selected={tab === 'herb'} className={tab === 'herb' ? 'on' : ''}
                                onClick={() => this.setState({ tab: 'herb' })}>
                                <Ic id="witch_gold" size={18} />Witches
                                {expansionOn && <span className="qk-subtab-on">on</span>}
                            </button>
                        )}
                        {showAlch && (
                            <button role="tab" aria-selected={tab === 'alch'} className={tab === 'alch' ? 'on' : ''}
                                onClick={() => this.setState({ tab: 'alch' })}>
                                <Ic id="alembic" size={18} />Alchemists
                                {alchOn && <span className="qk-subtab-on">on</span>}
                            </button>
                        )}
                    </div>
                )}
                {tab === 'base' && <RulesView round={round} />}
                {tab === 'herb' && <ExpansionRulesView enabled={expansionOn} witches={witches} round={round} />}
                {tab === 'alch' && <AlchemistRulesView enabled={alchOn} patients={patients} />}
            </div>
        );
    }
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

interface LobbyProps extends ViewPropsInterface {
    lobbyHerb?: boolean;
    lobbyAlch?: boolean;
    lobbyBooks?: BookSets;
    lobbyStir?: boolean;
    lobbyPlayers?: number;
}

/**
 * The game setup — ingredient books and drawing mode. Everyone sees the same
 * panel; only the host gets live buttons, the others see the choice read-only.
 */
class LobbySetup extends React.Component<{ props: LobbyProps; canEdit: boolean }, { zoom: Book | null; customising: boolean }> {
    public state = { zoom: null as Book | null, customising: false };

    private setOption(key: string, value: any) {
        if (this.props.canEdit) (this.props.props.MP as any).setOption(key, value);
    }

    public render() {
        const { props, canEdit } = this.props;
        const mp = props.MP;
        const fromHost = (k: string) => (canEdit && mp.getData ? mp.getData(k) : undefined);
        const herb = props.lobbyHerb === true;
        const alch = props.lobbyAlch === true;
        const sets: BookSets = props.lobbyBooks || { green: 1, blue: 1, red: 1, yellow: 1, purple: 1, black: 1, herb: 0 };
        const preset = presetOf(sets, herb, alch);
        // a custom mix keeps the per-book picker open for the host
        const customising = canEdit && (this.state.customising || preset === null);
        const locoweed = alch ? getBook('herb', sets, 2, herb, alch) : null;
        const stir = props.lobbyStir !== undefined ? props.lobbyStir : fromHost('quacks_stir') === true;
        const playerCount = props.lobbyPlayers || mp.playersCount() + 1;
        const MAX = maxPlayers(herb);
        const legal = playerCount >= MIN_PLAYERS && playerCount <= MAX;
        const seg = bookLabel;

        const choice = (label: string, active: boolean, onClick: () => void, key: React.Key) => (
            canEdit
                ? <button key={key} className={['qk-btn small', active ? 'primary' : ''].join(' ')} onClick={onClick}>{label}</button>
                : active ? <span key={key} className="qk-btn small primary qk-readonly">{label}</span> : null
        );

        return (
            <>
                <div className="qk-panel">
                    <div className="qk-title">
                        Expansions
                        <span className="qk-spacer" />
                        {!canEdit && <span className="qk-sub">chosen by the host</span>}
                    </div>
                    <div className="qk-exp-row">
                        <Ic id="witch_gold" size={26} />
                        <span className="qk-exp-name">The Herb Witches
                            <small>Fool&rsquo;s herbs, 6-pumpkins, books 5 and 6, the overflow bowl, a fifth seat and three herb witches.</small>
                        </span>
                        <span className="qk-opt-buttons">
                            {choice('Off', !herb, () => this.setOption('herb', false), 'herb-off')}
                            {choice('On', herb, () => this.setOption('herb', true), 'herb-on')}
                        </span>
                    </div>
                    <div className="qk-exp-row">
                        <Ic id="alembic" size={26} />
                        <span className="qk-exp-name">The Alchemists
                            <small>Treat a patient with an essence brewed every round, plus locoweed and twenty fortune cards.</small>
                        </span>
                        <span className="qk-opt-buttons">
                            {choice('Off', !alch, () => this.setOption('alch', false), 'alch-off')}
                            {choice('On', alch, () => this.setOption('alch', true), 'alch-on')}
                        </span>
                    </div>
                </div>
                <div className="qk-panel">
                    <div className="qk-title">
                        Ingredient books
                        <span className="qk-spacer" />
                        {!canEdit && <span className="qk-sub">chosen by the host</span>}
                    </div>
                    <div className="qk-opt-buttons">
                        {(herb ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4]).map(n => choice(`Set ${n}`, preset === n, () => this.setOption('set', n), n))}
                        {canEdit
                            ? (
                                <button className={['qk-btn small', customising ? 'primary' : ''].join(' ')}
                                    onClick={() => {
                                        // a mix stays open; pick a Set to leave it
                                        if (preset !== null) this.setState({ customising: !this.state.customising });
                                    }}>
                                    Custom
                                </button>
                            )
                            : preset === null && <span className="qk-btn small primary qk-readonly">Custom mix</span>}
                    </div>
                    <p className="qk-muted">
                        {setLabel(sets, herb, alch)}.
                        {canEdit
                            ? (customising
                                ? (herb ? ' Pick each ingredient\u2019s book.' : ' Pick each ingredient\u2019s book. Pumpkin and hawkmoth never change.')
                                : ' Set 1 is best for a first game.')
                            : ' Tap a book to read it.'}
                    </p>
                    {alch && !customising && locoweed && (
                        <div className="qk-picker">
                            <div className="qk-picker-row">
                                <div className="qk-picker-head">
                                    <ChipView chip="herb1" size={26} className="plain" />
                                    <span className="qk-picker-name">Fool&rsquo;s Herb <small className="qk-sub">locoweed</small></span>
                                    {canEdit
                                        ? (
                                            <span className="qk-seg wide">
                                                {bookChoices('herb', herb, alch).map(n => (
                                                    <button key={n} className={sets.herb === n ? 'on' : ''}
                                                        onClick={() => this.setOption('book', { color: 'herb', set: n })}>{bookLabel('herb', n)}</button>
                                                ))}
                                            </span>
                                        )
                                        : <span className="qk-pill ok">{bookLabel('herb', sets.herb)}</span>}
                                </div>
                                <RuleText text={locoweed.text} />
                            </div>
                        </div>
                    )}
                    {customising && (
                        <div className="qk-picker">
                            {pickableBooks(herb, alch).map((color) => {
                                const book = getBook(color, sets, Math.max(2, playerCount), herb, alch);
                                return (
                                    <div className="qk-picker-row" key={color}>
                                        <div className="qk-picker-head">
                                            <ChipView chip={makeChip(color, 1)} size={26} className="plain" />
                                            <span className="qk-picker-name">{INGREDIENT_NAME[color]}</span>
                                            <span className={['qk-seg', herb ? 'wide' : ''].join(' ').trim()}>
                                                {bookChoices(color, herb, alch).map(n => (
                                                    <button key={n} className={sets[color] === n ? 'on' : ''}
                                                        onClick={() => this.setOption('book', { color, set: n })}>{seg(color, n)}</button>
                                                ))}
                                            </span>
                                        </div>
                                        {book ? <RuleText text={book.text} /> : <span className="qk-muted">Not in this game.</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="qk-row">
                        {booksFor(sets, Math.max(2, playerCount), herb, alch).map(b => (
                            <BookCard key={b.color} book={b} width={SIZE_BOOK_LOBBY} onClick={() => this.setState({ zoom: b })} />
                        ))}
                    </div>
                </div>
                <div className="qk-panel">
                    <div className="qk-title">Drawing</div>
                    <div className="qk-opt-buttons">
                        {choice('Own pace', !stir, () => this.setOption('stir', false), 'own')}
                        {choice('Stir together', stir, () => this.setOption('stir', true), 'stir')}
                    </div>
                    <p className="qk-muted">
                        {stir
                            ? 'Every round, everyone commits to draw or stop before the chips are revealed.'
                            : 'Everyone draws at their own speed. The final round is always stirred together.'}
                    </p>
                </div>
                {legal
                    ? <p className="qk-muted">{playerCount} players. Quacks plays {MIN_PLAYERS}&ndash;{MAX}.</p>
                    : (
                        <p className="qk-warn">
                            {playerCount} player{playerCount > 1 ? 's' : ''} connected &mdash; Quacks needs
                            between {MIN_PLAYERS} and {MAX}.{!herb && playerCount === 5 ? ' The Herb Witches expansion seats five.' : ''}
                            {canEdit ? ' Starting now will do nothing.' : ''}
                        </p>
                    )}
                {this.state.zoom && <BookDetail book={this.state.zoom} onClose={() => this.setState({ zoom: null })} />}
            </>
        );
    }
}

export class QuacksHostLobby extends React.Component<LobbyProps, {}> {
    public render() {
        const mp = this.props.MP;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="qk-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <LobbySetup props={this.props} canEdit />
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesTabs showExpansion expansionOn={this.props.lobbyHerb === true} showAlch alchOn={this.props.lobbyAlch === true} /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Quacks', 'links': links });
    }
}

export class QuacksClientLobby extends React.Component<LobbyProps, {}> {
    public render() {
        const mp = this.props.MP;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="qk-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <LobbySetup props={this.props} canEdit={false} />
                        <p className="qk-muted">The host starts the game.</p>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesTabs showExpansion expansionOn={this.props.lobbyHerb === true} showAlch alchOn={this.props.lobbyAlch === true} /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Quacks', 'links': links });
    }
}

const BookDetail: React.FC<{ book: Book; onClose: () => void; left?: Record<number, number> }> = ({ book, onClose, left }) => (
    <Modal onClose={onClose}>
        <div className="qk-modal-card"><BookCard book={book} width={SIZE_DETAIL} /></div>
        <p className="qk-detail">{book.detail}</p>
        {left && (
            <div className="qk-detail-stock">
                {Object.keys(book.costs).map(Number).map(v => (
                    <span key={v}><ChipView chip={makeChip(book.color, v)} size={26} /> {left[v] || 0} left</span>
                ))}
            </div>
        )}
    </Modal>
);

// ---------------------------------------------------------------------------
// Shop (the only stateful panel: a local basket until "Buy")
// ---------------------------------------------------------------------------

interface ShopProps { coins: number; offers: ShopOffer[]; maxBuy: number; more?: number; onBuy: (chips: Chip[]) => void; }

class ShopPanel extends React.Component<ShopProps, { basket: Chip[] }> {
    public state = { basket: [] as Chip[] };

    private cost(basket: Chip[]): number {
        return basket.reduce((n, c) => n + (this.props.offers.filter(o => o.chip === c)[0]?.cost || 0), 0);
    }

    private toggle(chip: Chip) {
        const basket = this.state.basket;
        if (basket.indexOf(chip) !== -1) return this.setState({ basket: basket.filter(c => c !== chip) });
        // one chip per colour: picking another value of a colour swaps it
        const next = [...basket.filter(c => chipColor(c) !== chipColor(chip)), chip];
        if (next.length > this.props.maxBuy || this.cost(next) > this.props.coins) return;
        this.setState({ basket: next });
    }

    public render() {
        const { coins, offers, maxBuy } = this.props;
        const basket = this.state.basket;
        const spent = this.cost(basket);
        const colors = BOOK_ORDER.filter(c => offers.some(o => chipColor(o.chip) === c));

        return (
            <div className="qk-panel qk-shop">
                <div className="qk-title">
                    Shop
                    <span className="qk-spacer" />
                    <span className="qk-budget"><Coin n={coins - spent} size={28} /> left</span>
                </div>
                <p className="qk-muted">
                    Buy up to {maxBuy} chips of different colours. Unspent coins are lost.
                    {this.props.more ? ' Another shopping trip follows.' : ''}
                </p>
                <div className="qk-shop-rows">
                    {colors.map(color => (
                        <div className="qk-shop-row" key={color}>
                            <span className="qk-shop-name">{INGREDIENT_NAME[color]}</span>
                            <div className="qk-shop-items">
                                {offers.filter(o => chipColor(o.chip) === color).map((o) => {
                                    const picked = basket.indexOf(o.chip) !== -1;
                                    const others = basket.filter(c => chipColor(c) !== color);
                                    const blocked = !picked && (o.left < 1
                                        || others.length + 1 > maxBuy
                                        || this.cost(others) + o.cost > coins);
                                    return (
                                        <button
                                            key={o.chip}
                                            className={['qk-offer', picked ? 'picked' : ''].join(' ').trim()}
                                            disabled={blocked}
                                            onClick={() => this.toggle(o.chip)}
                                        >
                                            <ChipView chip={o.chip} size={28} />
                                            <Coin n={o.cost} size={24} />
                                            {o.left < 1 && <span className="qk-sold">sold out</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <button className="qk-btn primary block" onClick={() => { this.props.onBuy(basket); this.setState({ basket: [] }); }}>
                    {basket.length ? `Buy ${basket.length} chip${basket.length > 1 ? 's' : ''} for ${spent}` : 'Buy nothing'}
                </button>
            </div>
        );
    }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface MainState { zoomBook: Book | null; zoomFortune: boolean; zoomWitch: Witch | null; }

export class QuacksMainPage extends React.Component<QuacksProps, MainState> {
    public state: MainState = { zoomBook: null, zoomFortune: false, zoomWitch: null };

    private mp(): any { return this.props.MP; }
    private me(): PublicPlayer | undefined { return this.props.publicPlayers[this.props.MP.clientId]; }
    private tag(id: string) { return this.props.MP.getPluginView('lobby', 'player-tag', { clientId: id }); }

    private status(id: string): { text: string; cls: string } {
        const p = this.props;
        const pl = p.publicPlayers[id];
        if (p.phase === Phase.Done) return { text: 'Done', cls: 'idle' };
        if (p.phase === Phase.Fortune || p.phase === Phase.Essence) {
            return pl.deciding ? { text: 'Choosing', cls: 'busy' } : { text: 'Ready', cls: 'ok' };
        }
        if (p.phase === Phase.Brew) {
            if (pl.exploded) return { text: pl.saved ? 'Boom (saved)' : pl.shielded ? 'Boom (shielded)' : 'Boom!', cls: pl.saved ? 'ok' : 'boom' };
            if (pl.potFull) return { text: 'Pot full', cls: 'ok' };
            if (pl.deciding) return { text: 'Choosing', cls: 'busy' };
            if (pl.stopped) return { text: 'Stopped', cls: 'ok' };
            if (p.lockstep && pl.intentSet) return { text: 'Ready to stir', cls: 'ok' };
            return { text: 'Brewing', cls: 'busy' };
        }
        if (pl.stage === 'ready') return { text: 'Ready', cls: 'ok' };
        if (pl.deciding) return { text: 'Choosing', cls: 'busy' };
        return pl.stage === 'shop' ? { text: 'Shopping', cls: 'busy' } : { text: 'Wrapping up', cls: 'busy' };
    }

    // ---- shared pieces ----------------------------------------------------

    private renderFortuneStrip() {
        const p = this.props;
        const card = p.fortune ? FORTUNE_BY_ID[p.fortune] : null;
        if (!card) return null;
        const event = roundEvent(p.round);
        return (
            <button className={`qk-fortune-strip ${card.kind}`} onClick={() => this.setState({ zoomFortune: true })}>
                <Ic id="crystal" size={30} />
                <span className="qk-fortune-text">
                    <b>{card.name}</b>
                    <span>{card.text}</span>
                    {event && <span className="qk-fortune-event">{event}</span>}
                </span>
            </button>
        );
    }

    private renderStats(pl: PublicPlayer) {
        return (
            <div className="qk-stats">
                <Stat icon="vp" value={pl.vp} label="Victory points" />
                <Stat icon="ruby" value={pl.rubies} label="Rubies" />
                <Stat icon="droplet" value={pl.droplet} label="Droplet position" />
                {pl.ratTails > 0 && <Stat icon="rat" value={`+${pl.ratTails}`} label="Rat tails this round" />}
                <Stat icon={pl.flaskFull ? 'flask' : 'flask_empty'} value={pl.flaskFull ? 'full' : 'empty'} label="Flask" />
                <Stat icon="bag" value={pl.bagCount} label="Chips left in your bag" />
            </div>
        );
    }

    private renderPrompt() {
        const pr = this.props.myPrompt;
        if (!pr) return null;
        const pl = this.me();
        const patient = pl && pl.patient ? PATIENT_BY_ID[pl.patient] : null;
        return (
            <div className="qk-panel qk-prompt">
                <div className="qk-title">{pr.title}</div>
                <p className="qk-prompt-text">{pr.text}</p>
                {pr.kind === 'patient' && (
                    <div className="qk-row">
                        {(pr.data.ids as string[]).map(id => PATIENT_BY_ID[id]).filter(x => !!x).map(x => (
                            <PatientCardView key={x.id} patient={x} width={SIZE_BOOK_LOBBY}
                                onClick={() => this.mp().choose(`pat:${x.id}`)} />
                        ))}
                    </div>
                )}
                {pr.kind === 'essence' && patient && <EssenceTrack patient={patient} reach={pr.data.reach} />}
                {/* a pick prompt already lists every drawn chip as an option */}
                {pr.held.length > 0 && pr.kind !== 'pick' && (
                    <div className="qk-held">
                        {pr.held.map((c, i) => <ChipView key={i} chip={c} size={40} />)}
                    </div>
                )}
                <div className="qk-options">
                    {pr.options.map(o => (
                        <button key={o.id} className={['qk-btn option', o.chip ? 'with-chip' : ''].join(' ').trim()}
                            onClick={() => this.mp().choose(o.id)}>
                            {o.chip && <ChipView chip={o.chip} size={30} />}
                            <span>{o.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    private renderRoster() {
        const p = this.props;
        const me = p.MP.clientId;
        return (
            <div className="qk-panel">
                <div className="qk-title">The table</div>
                <div className="qk-roster">
                    {p.turnOrder.map((id, i) => {
                        const pl = p.publicPlayers[id];
                        const st = this.status(id);
                        return (
                            <div className={['qk-roster-row', id === me ? 'me' : ''].join(' ').trim()} key={id}>
                                <span className="qk-roster-name">
                                    {this.tag(id)}
                                    {i === 0 && <span className="qk-first" title="Start player">1st</span>}
                                </span>
                                <span className={`qk-pill ${st.cls}`}>{st.text}</span>
                                <span className="qk-roster-nums">
                                    <Stat icon="vp" value={pl.vp} label="Victory points" />
                                    <Stat icon="ruby" value={pl.rubies} label="Rubies" />
                                    <span className="qk-stat" title="Scoring space value"><Coin n={pl.field.coins} size={20} /></span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    private renderNotes(pl: PublicPlayer) {
        if (!pl.notes.length && !pl.rolled.length) return null;
        return (
            <div className="qk-notes">
                {pl.rolled.length > 0 && (
                    <div className="qk-dice">
                        {pl.rolled.map((f, i) => (
                            <Die key={`${this.props.round}-${i}`} faceId={f} faceset={QUACKS_DIE_FACES}
                                theme={QUACKS_DIE_THEME} title={DIE_FACE_LABEL[f]} />
                        ))}
                    </div>
                )}
                <ul>{pl.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
        );
    }

    // ---- phases -----------------------------------------------------------

    private renderFortunePhase(pl: PublicPlayer) {
        const p = this.props;
        const card = p.fortune ? FORTUNE_BY_ID[p.fortune] : null;
        return (
            <>
                <div className="qk-panel qk-center">
                    <div className="qk-title">Round {p.round} &mdash; the fortune teller</div>
                    {card && <FortuneCardView card={card} width={SIZE_DETAIL - 40} />}
                </div>
                {p.myPrompt
                    ? this.renderPrompt()
                    : <div className="qk-banner waiting">Waiting for the others to choose&hellip;</div>}
                {this.renderStats(pl)}
            </>
        );
    }

    private witches(): Witch[] {
        return (this.props.witchIds || []).map(id => WITCH_BY_ID[id]).filter(w => !!w);
    }

    /** The three witches of this game (plus a visiting fourth): tap one to read her, call her when she lights up. */
    private renderWitchBar(pl: PublicPlayer) {
        const p = this.props;
        if (!p.expansion) return null;
        const usable = p.myWitchUsable || {};
        const tiles: Array<{ w: Witch; penny: string }> = this.witches().map(w => ({ w, penny: w.metal as string }));
        if (p.guestWitch && WITCH_BY_ID[p.guestWitch]) tiles.push({ w: WITCH_BY_ID[p.guestWitch], penny: 'guest' });
        return (
            <div className={['qk-witchbar', tiles.length > 3 ? 'four' : ''].join(' ').trim()}>
                {tiles.map(({ w, penny }) => {
                    const spent = !pl.pennies[penny];
                    const live = !!usable[penny];
                    return (
                        <div key={penny} className={['qk-witch-tile', w.metal, spent ? 'spent' : '', live ? 'live' : '', penny === 'guest' ? 'guest' : ''].join(' ').trim()}>
                            <button className="qk-witch-face" onClick={() => this.setState({ zoomWitch: w })}>
                                <Ic id={witchIconId(w.metal)} size={30} />
                                <span className="qk-witch-name">{w.name}<small>{spent ? (penny === 'guest' ? 'called' : 'penny spent') : penny === 'guest' ? 'visiting, free' : w.when}</small></span>
                            </button>
                            {live && <button className="qk-btn small primary qk-witch-call" onClick={() => this.mp().useWitch(penny)}>Call</button>}
                        </div>
                    );
                })}
            </div>
        );
    }

    /** Your patient: what the banked essence does now, and where this pot would push the marker. */
    private renderEssencePanel(pl: PublicPlayer, brewing: boolean) {
        const p = this.props;
        if (!p.alch || !pl.patient) return null;
        const patient = PATIENT_BY_ID[pl.patient];
        if (!patient) return null;
        const forget = p.myForget || [];
        return (
            <div className="qk-panel qk-essence">
                <div className="qk-title">
                    <Ic id="alembic" size={20} />{patient.name}
                    <span className="qk-spacer" />
                    {patient.kind === 'power' && <span className="qk-pill ok">{pl.essence} essence to spend</span>}
                </div>
                <RuleText text={patient.text} />
                <EssenceTrack patient={patient} at={p.phase === Phase.Brew && patient.kind === 'power' ? pl.essence : undefined}
                    reach={brewing ? pl.essenceNow : pl.essenceReach} />
                <p className="qk-muted">
                    {brewing
                        ? `This pot would distil ${pl.essenceNow} essence${p.round >= ROUNDS ? ' \u2014 a point each in the last round' : ''}.`
                        : `This round\u2019s essence: ${pl.essenceReach}.`}
                    {pl.extraRats > 0 ? ` +${pl.extraRats} rat tail next round.` : ''}
                    {pl.pendingDraw > 0 ? ` Hold ${pl.pendingDraw} chips at the next brew.` : ''}
                </p>
                {brewing && forget.length > 0 && (
                    <div className="qk-aside qk-reserve">
                        <span>Forget a chip</span>
                        {forget.map(k => (
                            <button key={k} className="qk-btn small option-chip" onClick={() => this.mp().forget(k)}>
                                <ChipView chip={pl.pot[k].chip} size={24} /> &minus;{chipValue(pl.pot[k].chip)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    private renderEssencePhase(pl: PublicPlayer) {
        const p = this.props;
        return (
            <>
                <div className="qk-banner waiting">
                    {p.myPrompt ? 'The essence phase: distil your potion.' : 'Distilling\u2026 waiting for the others.'}
                </div>
                {this.renderPrompt()}
                {/* the chooser already shows the track */}
                {!p.myPrompt && this.renderEssencePanel(pl, false)}
                <div className="qk-panel qk-potpanel">
                    <div className="qk-title">Your pot</div>
                    <PotTrack pl={pl} />
                </div>
                {this.renderRoster()}
            </>
        );
    }

    /** Overflow bowl, held toadstool chips and a kept spider chip: the expansion's extra places for chips. */
    private renderExtraChips(pl: PublicPlayer, canLay: boolean) {
        const bonus = Math.floor(pl.overflow.reduce((t, c) => t + chipValue(c), 0) / 2);
        const hand = pl.hand || [];
        return (
            <>
                {hand.length > 0 && (
                    <div className="qk-aside qk-hand">
                        <span>Held &mdash; lay one instead of drawing</span>
                        {hand.map((c, i) => (
                            canLay && !pl.exploded
                                ? (
                                    <button key={i} className="qk-btn small option-chip" onClick={() => this.mp().layHand(i)}>
                                        <ChipView chip={c} size={26} /> Lay
                                    </button>
                                )
                                : <ChipView key={i} chip={c} size={26} />
                        ))}
                    </div>
                )}
                {pl.reserve.length > 0 && (
                    <div className="qk-aside qk-reserve">
                        <span>Held &mdash; lay it this round</span>
                        {pl.reserve.map((c, i) => (
                            canLay
                                ? (
                                    <button key={i} className="qk-btn small option-chip" onClick={() => this.mp().layReserve(i)}>
                                        <ChipView chip={c} size={26} /> Lay
                                    </button>
                                )
                                : <ChipView key={i} chip={c} size={26} />
                        ))}
                    </div>
                )}
                {pl.overflow.length > 0 && (
                    <div className="qk-aside qk-overflow">
                        <span>Overflow bowl</span>
                        {pl.overflow.map((c, i) => <ChipView key={i} chip={c} size={24} />)}
                        <span className="qk-overflow-vp"><Ic id="vp" size={16} />+{bonus}</span>
                    </div>
                )}
                {pl.carry && (
                    <div className="qk-aside">
                        <span>Kept for next round</span>
                        <ChipView chip={pl.carry} size={24} />
                    </div>
                )}
            </>
        );
    }

    private renderBrewActions(pl: PublicPlayer) {
        const p = this.props;
        if (p.myPrompt) return this.renderPrompt();
        if (pl.stopped) {
            return (
                <div className={['qk-banner', pl.exploded && !pl.shielded && !pl.saved ? 'boom' : 'waiting'].join(' ')}>
                    {pl.exploded
                        ? (pl.saved
                            ? 'Boom \u2014 but your witch saved the round. Waiting for the others\u2026'
                            : pl.shielded
                            ? 'Boom — but your crow skull shielded you. Waiting for the others…'
                            : 'Your pot exploded! Waiting for the others…')
                        : 'You stopped. Waiting for the others…'}
                </div>
            );
        }
        const chosen = p.lockstep ? p.myIntent : null;
        return (
            <>
                {p.lockstep && (
                    <div className="qk-banner waiting">
                        {chosen
                            ? `You will ${chosen}. Waiting for the others to decide…`
                            : 'Stir together: choose to draw or stop. Chips are revealed once everyone has chosen.'}
                    </div>
                )}
                <div className="qk-actions">
                    <button className="qk-act flask" disabled={!p.myCanFlask || !!chosen} onClick={() => this.mp().useFlask()}>
                        <Ic id={pl.flaskFull ? 'flask' : 'flask_empty'} size={26} />
                        <span>Flask</span>
                    </button>
                    <button className={['qk-act draw', chosen === 'draw' ? 'chosen' : ''].join(' ').trim()}
                        onClick={() => this.mp().drawChip()}>
                        <Ic id="bag" size={34} />
                        <span>Draw<small>{pl.bagCount} in bag</small></span>
                    </button>
                    <button className={['qk-act stop', chosen === 'stop' ? 'chosen' : ''].join(' ').trim()}
                        onClick={() => this.mp().stopBrewing()}>
                        <Ic id="spoon" size={26} />
                        <span>Stop</span>
                    </button>
                </div>
            </>
        );
    }

    /** Every other player's scoring space, so you can watch the race on your own pot. */
    private ghosts(): Ghost[] {
        const p = this.props;
        return p.turnOrder.filter(id => id !== p.MP.clientId).map((id): Ghost => {
            const r = p.publicPlayers[id];
            return {
                id,
                name: p.playerNames[id],
                pos: r.field.index,   // their scoring space, the same one your own ring marks
                accent: p.playerAccents[id] || '#8a63d2',
                icon: (p.playerIcons && p.playerIcons[id]) || 0,
                // a pot saved by The Survivor scores as safe, so it shows as an ordinary stop
                state: r.exploded && !r.saved ? 'boom' : r.stopped ? 'stopped' : 'brewing'
            };
        });
    }

    private renderBrewPhase(pl: PublicPlayer) {
        return (
            <>
                {this.renderFortuneStrip()}
                <div className="qk-panel qk-potpanel">
                    <Meter pl={pl} />
                    <PotTrack pl={pl} ghosts={this.ghosts()} />
                    {this.renderExtraChips(pl, !pl.stopped && !this.props.myPrompt)}
                    <BagContents pl={pl} />
                    {pl.aside.length > 0 && (
                        <div className="qk-aside">
                            <span>Set aside</span>
                            {pl.aside.map((c, i) => <ChipView key={i} chip={c} size={28} />)}
                        </div>
                    )}
                    <div className="qk-reward">
                        <span>{pl.stopped ? 'Your scoring space' : 'Stop now for'}</span>
                        <FieldReward field={pl.field} />
                        {pl.shieldLeft > 0 && !pl.stopped && (
                            <span className="qk-shield" title="Draws still shielded"><Ic id="shield" size={18} />{pl.shieldLeft}</span>
                        )}
                    </div>
                </div>
                {this.renderBrewActions(pl)}
                {this.props.fortune === 'good_neighbour' && !pl.stopped && !pl.exploded && !this.props.myPrompt
                    && pl.pot.some(c => c.chip === 'white3') && (
                    <button className="qk-btn option" onClick={() => this.mp().neighbourBomb()}>
                        <ChipView chip="white3" size={28} />
                        <span>Good Neighbours: bag a cherry bomb 3 <small>your left neighbour takes 2 rubies</small></span>
                    </button>
                )}
                {this.renderWitchBar(pl)}
                {this.renderEssencePanel(pl, true)}
                {this.renderStats(pl)}
                {this.renderRoster()}
            </>
        );
    }

    private renderEvalPhase(pl: PublicPlayer) {
        const p = this.props;
        const cost = p.myRubyCost || { droplet: DROPLET_COST, flask: FLASK_COST };
        const waitingOn = p.turnOrder.filter(id => p.publicPlayers[id].stage !== 'ready' && id !== p.MP.clientId);
        return (
            <>
                <div className="qk-panel">
                    <div className="qk-title">
                        Round {p.round} results
                        <span className="qk-spacer" />
                        {pl.exploded && (
                            <span className={`qk-pill ${pl.shielded || pl.saved ? 'ok' : 'boom'}`}>
                                {pl.saved ? 'Saved' : pl.shielded ? 'Shielded' : 'Exploded'}
                            </span>
                        )}
                    </div>
                    <div className="qk-reward">
                        <span>Scoring space</span>
                        <FieldReward field={pl.field} />
                    </div>
                    {this.renderNotes(pl)}
                </div>

                {this.renderPrompt()}

                {this.renderWitchBar(pl)}

                {!p.myPrompt && pl.stage === 'shop' && (
                    <ShopPanel key={`trip-${pl.extraShops}`} coins={pl.coins} offers={p.offers} maxBuy={p.maxBuy}
                        more={pl.extraShops} onBuy={(chips) => this.mp().buyChips(chips)} />
                )}

                {!p.myPrompt && pl.stage === 'rubies' && p.round >= ROUNDS && (
                    <div className="qk-panel">
                        <div className="qk-title">Final tally</div>
                        <p className="qk-muted">
                            When you finish, every 5 coins and every 2 rubies become a point
                            {p.expansion ? ', and each unspent witch penny is worth 2' : ''}.
                        </p>
                        <button className="qk-btn primary block" onClick={() => this.mp().ready()}>Finish the game</button>
                    </div>
                )}

                {!p.myPrompt && pl.stage === 'rubies' && p.round < ROUNDS && (
                    <div className="qk-panel">
                        <div className="qk-title">
                            Spend rubies
                            <span className="qk-spacer" />
                            <Stat icon="ruby" value={pl.rubies} label="Rubies" />
                        </div>
                        <div className="qk-options">
                            <button className="qk-btn option" disabled={pl.rubies < cost.droplet}
                                onClick={() => this.mp().spendRubies('droplet')}>
                                <Ic id="droplet" size={24} />
                                <span>Droplet +1 <small>{cost.droplet === 1 ? '1 ruby' : `${cost.droplet} rubies`}</small></span>
                            </button>
                            <button className="qk-btn option" disabled={pl.rubies < cost.flask || pl.flaskFull}
                                onClick={() => this.mp().spendRubies('flask')}>
                                <Ic id="flask" size={24} />
                                <span>{pl.flaskFull ? 'Flask is full' : 'Refill flask'} <small>{cost.flask === 1 ? '1 ruby' : `${cost.flask} rubies`}</small></span>
                            </button>
                        </div>
                        <button className="qk-btn primary block" onClick={() => this.mp().ready()}>Ready for round {p.round + 1}</button>
                    </div>
                )}

                {pl.stage === 'ready' && (
                    <div className="qk-banner waiting">
                        {waitingOn.length
                            ? `Waiting for ${waitingOn.map(id => p.playerNames[id]).join(', ')}…`
                            : 'Starting the next round…'}
                    </div>
                )}

                <div className="qk-panel qk-potpanel">
                    <div className="qk-title">Your pot</div>
                    <PotTrack pl={pl} />
                    {this.renderExtraChips(pl, false)}
                </div>
                {this.renderCollection()}
                {this.renderStats(pl)}
                {this.renderRoster()}
            </>
        );
    }

    private renderCollection() {
        const col = this.props.myCollection;
        if (!col) return null;
        return (
            <div className="qk-panel">
                <div className="qk-title">Your ingredients</div>
                <ChipCounts counts={col} />
            </div>
        );
    }

    private renderDone() {
        const p = this.props;
        const ranked = [...p.playerOrder].sort((a, b) => p.publicPlayers[b].vp - p.publicPlayers[a].vp);
        const winners = p.winnerIds || [];
        return (
            <>
                <div className="qk-panel qk-center">
                    <Ic id="cauldron" size={72} />
                    <div className="qk-final-title">
                        {winners.length > 1 ? 'A shared victory' : `${p.playerNames[winners[0]] || 'Nobody'} wins the bazaar`}
                    </div>
                </div>
                <div className="qk-panel">
                    <div className="qk-title">Final scores</div>
                    <div className="qk-roster">
                        {ranked.map((id) => (
                            <div className={['qk-roster-row', winners.indexOf(id) !== -1 ? 'winner' : ''].join(' ').trim()} key={id}>
                                <span className="qk-roster-name">{this.tag(id)}</span>
                                {winners.indexOf(id) !== -1 && <span className="qk-pill ok">Winner</span>}
                                <span className="qk-roster-nums"><Stat icon="vp" value={p.publicPlayers[id].vp} label="Victory points" /></span>
                            </div>
                        ))}
                    </div>
                </div>
                {this.me() && (
                    <div className="qk-panel">
                        <div className="qk-title">Your last round</div>
                        {this.renderNotes(this.me()!)}
                    </div>
                )}
                {this.renderCollection()}
            </>
        );
    }

    private renderHome() {
        const p = this.props;
        const pl = this.me();
        if (!pl) return <div className="qk-arena"><p className="qk-muted">You are watching this game.</p>{this.renderRoster()}</div>;
        return (
            <div className="qk-arena">
                {p.phase === Phase.Done && this.renderDone()}
                {p.phase === Phase.Fortune && this.renderFortunePhase(pl)}
                {p.phase === Phase.Brew && this.renderBrewPhase(pl)}
                {p.phase === Phase.Essence && this.renderEssencePhase(pl)}
                {p.phase === Phase.Eval && this.renderEvalPhase(pl)}
                {this.renderZoom()}
            </div>
        );
    }

    private renderZoom() {
        const p = this.props;
        const card = p.fortune ? FORTUNE_BY_ID[p.fortune] : null;
        if (this.state.zoomBook) {
            const book = this.state.zoomBook;
            const left: Record<number, number> = {};
            p.offers.filter(o => chipColor(o.chip) === book.color).forEach((o) => { left[chipValue(o.chip)] = o.left; });
            return <BookDetail book={book} left={left} onClose={() => this.setState({ zoomBook: null })} />;
        }
        if (this.state.zoomWitch) {
            const w = this.state.zoomWitch;
            const me = this.me();
            const live = !!(p.myWitchUsable || {})[w.metal];
            return (
                <Modal onClose={() => this.setState({ zoomWitch: null })}>
                    <div className="qk-modal-card"><WitchCardView witch={w} width={SIZE_DETAIL} spent={!!me && !me.pennies[w.metal]} /></div>
                    <p className="qk-detail">{w.detail}</p>
                    {live && (
                        <button className="qk-btn primary block" onClick={() => { this.setState({ zoomWitch: null }); this.mp().useWitch(w.metal); }}>
                            Spend my {w.metal} penny
                        </button>
                    )}
                </Modal>
            );
        }
        if (this.state.zoomFortune && card) {
            return (
                <Modal onClose={() => this.setState({ zoomFortune: false })}>
                    <div className="qk-modal-card"><FortuneCardView card={card} width={SIZE_DETAIL} /></div>
                    {p.fortuneNotes.map((n, i) => <p className="qk-detail" key={i}>{n}</p>)}
                    {!card.verified && <p className="qk-muted">House card: written for this edition.</p>}
                </Modal>
            );
        }
        return null;
    }

    private renderBooks() {
        const p = this.props;
        const card = p.fortune ? FORTUNE_BY_ID[p.fortune] : null;
        return (
            <div className="qk-arena">
                <div className="qk-panel">
                    <div className="qk-title">
                        Ingredient books
                        <span className="qk-spacer" />
                        <span className="qk-sub">{presetOf(p.bookSets, p.expansion, p.alch) ? `Set ${presetOf(p.bookSets, p.expansion, p.alch)}` : 'Custom mix'} &middot; tap for the full rule</span>
                    </div>
                    <div className="qk-grid">
                        {booksFor(p.bookSets, p.playerOrder.length, p.expansion, p.alch).map(b => (
                            <BookCard key={b.color} book={b} locked={lockLabel(b.color, p.round)}
                                onClick={() => this.setState({ zoomBook: b })} />
                        ))}
                    </div>
                </div>
                {p.alch && (
                    <div className="qk-panel">
                        <div className="qk-title">
                            Patients
                            <span className="qk-spacer" />
                            <span className="qk-sub">the three on the table</span>
                        </div>
                        <div className="qk-grid">
                            {(p.patientIds || []).map(id => PATIENT_BY_ID[id]).filter(x => !!x).map(x => (
                                <PatientCardView key={x.id} patient={x} mine={!!this.me() && this.me()!.patient === x.id} />
                            ))}
                        </div>
                    </div>
                )}
                {p.expansion && (
                    <div className="qk-panel">
                        <div className="qk-title">
                            Herb witches
                            <span className="qk-spacer" />
                            <span className="qk-sub">one call each &middot; 2 points per unspent penny</span>
                        </div>
                        <div className="qk-grid">
                            {this.witches().map(w => (
                                <WitchCardView key={w.id} witch={w} spent={!!this.me() && !this.me()!.pennies[w.metal]}
                                    onClick={() => this.setState({ zoomWitch: w })} />
                            ))}
                        </div>
                    </div>
                )}
                {card && (
                    <div className="qk-panel">
                        <div className="qk-title">This round&rsquo;s fortune</div>
                        <div className="qk-grid">
                            <FortuneCardView card={card} onClick={() => this.setState({ zoomFortune: true })} />
                        </div>
                    </div>
                )}
                {this.renderZoom()}
            </div>
        );
    }

    private renderPlayers() {
        const p = this.props;
        return (
            <div className="qk-arena">
                {p.turnOrder.map((id) => {
                    const pl = p.publicPlayers[id];
                    const st = this.status(id);
                    return (
                        <div className="qk-panel qk-potpanel" key={id}>
                            <div className="qk-title">
                                {this.tag(id)}
                                <span className="qk-spacer" />
                                <span className={`qk-pill ${st.cls}`}>{st.text}</span>
                            </div>
                            <div className="qk-stats compact">
                                <Stat icon="vp" value={pl.vp} label="Victory points" />
                                <Stat icon="ruby" value={pl.rubies} label="Rubies" />
                                <Stat icon="droplet" value={pl.droplet} label="Droplet position" />
                                <Stat icon={pl.flaskFull ? 'flask' : 'flask_empty'} value={pl.flaskFull ? 'full' : 'empty'} label="Flask" />
                                <Stat icon="bag" value={pl.bagCount} label="Chips in bag" />
                            </div>
                            <Meter pl={pl} />
                            {p.alch && pl.patient && PATIENT_BY_ID[pl.patient] && (
                                <div className="qk-aside">
                                    <Ic id="alembic" size={20} />
                                    <span>{PATIENT_BY_ID[pl.patient].name} &middot; essence {p.phase === Phase.Brew ? pl.essenceNow : pl.essenceReach}</span>
                                </div>
                            )}
                            <PotTrack pl={pl} mini />
                            {this.renderExtraChips(pl, false)}
                            <BagContents pl={pl} size={24} />
                            {p.expansion && (
                                <div className="qk-pennies">
                                    {METALS.map(m => (
                                        <span key={m} className={pl.pennies[m] ? '' : 'spent'} title={`${m} penny ${pl.pennies[m] ? 'unspent' : 'spent'}`}>
                                            <Ic id={witchIconId(m)} size={20} />
                                        </span>
                                    ))}
                                </div>
                            )}
                            {pl.aside.length > 0 && (
                                <div className="qk-aside">
                                    <span>Set aside</span>
                                    {pl.aside.map((c, i) => <ChipView key={i} chip={c} size={24} />)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    private topBar() {
        const p = this.props;
        const pl = this.me();
        return (
            <span className="qk-topbar">
                <span>{p.phase === Phase.Done ? 'Final' : `Round ${p.round}/${ROUNDS}`}</span>
                {pl && (
                    <>
                        <span className="qk-topbar-sep">|</span>
                        <Ic id="vp" size={15} /><span>{pl.vp}</span>
                        <Ic id="ruby" size={13} /><span>{pl.rubies}</span>
                    </>
                )}
            </span>
        );
    }

    public render() {
        const p = this.props;
        const mp = p.MP;
        const pl = this.me();

        const links: any = {
            'home': { 'icon': 'flask', 'label': 'Brew', 'view': this.renderHome() },
            'books': { 'icon': 'book', 'label': 'Books', 'view': this.renderBooks() },
            'players': { 'icon': 'users', 'label': 'Pots', 'view': this.renderPlayers() },
            'rules': {
                'icon': 'scroll', 'label': 'Rules',
                'view': (
                    <RulesTabs
                        showExpansion={p.expansion}
                        expansionOn={p.expansion}
                        witches={this.witches()}
                        showAlch={p.alch}
                        alchOn={p.alch}
                        patients={(p.patientIds || []).map(id => PATIENT_BY_ID[id]).filter(x => !!x)}
                        round={p.phase === Phase.Done ? undefined : p.round}
                    />
                )
            }
        };
        if (p.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="qk-settings">
                        <button className="qk-btn" onClick={() => this.mp().restartGame()}>Restart game</button>
                        <button className="qk-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Quacks',
            'topBarContent': this.topBar(),
            'roomClassName': pl && pl.needsAction && p.phase !== Phase.Done ? 'attention-bg' : ''
        });
    }
}
