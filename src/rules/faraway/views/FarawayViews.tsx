/**
 * FarawayViews.tsx — React views for Faraway.
 *
 * Presentation only: every mutation goes through an MP RPC method. UI-only
 * interaction state (which card is highlighted, which card is being inspected)
 * lives in component state; game state never does.
 *
 * Layout is built for a phone in portrait: one vertical column of panels, every
 * card row a horizontal scroller, and anything non-essential (opponents, rules,
 * the full score pad) moved into its own gameshell tab.
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';

import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';

import {
    Colour, COLOURS, COLOUR_BIOME, Resource, RESOURCES, RESOURCE_NAME,
    REGION_BY_ID, SANCTUARY_BY_ID, ROUNDS, MIN_PLAYERS, MAX_PLAYERS, describeQuest
} from '../FarawayData';
import {
    FARAWAY_ICONS, getRegionCardDefinition, getSanctuaryCardDefinition,
    getFarawayPalette, resourceIconId, resourceIconIdOk, resourceIconIdNeed,
    swatchId, COLOUR_HEX, resourceListLabel
} from '../FarawayAssets';
import { Phase, ScoreBreakdown, RegionScore } from '../FarawayGameState';

// ---------------------------------------------------------------------------
// Sizes (px). Cards are rendered in pixel-scaled mode, so these are the true
// on-screen widths; heights follow the 63.5 × 88.9 aspect automatically.
// ---------------------------------------------------------------------------

const SIZE_HAND = 112;      // hand / draft pool — same width in every phase
const SIZE_MARKET = 104;    // market row — same width in every phase
const SIZE_PENDING = 112;   // sanctuaries drawn this round
const SIZE_TABLEAU = 90;
const SIZE_TABLEAU_BIG = 108;
const SIZE_MINI = 80;
const SIZE_DETAIL = 228;
const SIZE_ANATOMY = 196;   // the annotated example cards in the rules tab
const SIZE_RIVAL = Math.round(SIZE_TABLEAU * 0.65);  // rivals' rows on the main tab (~65% of yours)

const cardHeight = (w: number) => Math.round(w * 88.9 / 63.5);

// ---------------------------------------------------------------------------
// Prop shapes
// ---------------------------------------------------------------------------

interface PublicPlayer {
    tableau: number[];
    sanctuaries: string[];
    handCount: number;
    hasCommitted: boolean;
    pendingCount: number;
    tookMarket: boolean;
    clues: number;
    colours: Record<Colour, number>;
    score: ScoreBreakdown;
}

interface FarawayProps extends ViewPropsInterface {
    phase: Phase;
    round: number;
    advanced: boolean;
    playerOrder: string[];
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    publicPlayers: Record<string, PublicPlayer>;
    market: number[];
    marketActive: boolean;
    turnOrder: string[];
    currentPlayerId: string | null;
    revealed: Record<string, number> | null;
    regionDeckCount: number;
    sanctuaryDeckCount: number;
    scores: Record<string, ScoreBreakdown> | null;
    winnerIds: string[] | null;
    isHost: boolean;
    myHand: number[];
    myDraftPool: number[];
    myPending: string[];
    myCommitted: number | null;
    myLastRegion: number | null;
    isMyTurn: boolean;
    myPendingActions: { market: boolean; sanctuary: boolean } | null;
    myPreviews: Record<number, { qualifies: boolean; draws: number }>;
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

const Icon: React.FC<{ id: string; size?: number; title?: string }> = ({ id, size = 18, title }) => (
    <span className="fw-icon" style={{ width: size, height: size }} title={title}>
        <ExpressiveIcon icon={FARAWAY_ICONS[id]} palette={getFarawayPalette(null)} savedIcons={FARAWAY_ICONS} />
    </span>
);

interface CardProps {
    width?: number;
    onClick?: () => void;
    selected?: boolean;
    selectable?: boolean;
    dimmed?: boolean;
}

/** A Region card face. `has-prereq` tells the stylesheet to open the gate strip. */
const RegionCardView: React.FC<CardProps & { cardId: number; missing?: Resource[] }> = ({
    cardId, width = SIZE_TABLEAU, onClick, selected, selectable, dimmed, missing
}) => {
    const card = REGION_BY_ID[cardId];
    const cls = ['fw-card', card.prerequisite.length > 0 ? 'has-prereq' : ''].join(' ').trim();
    return (
        <div className={cls} style={dimmed ? { opacity: 0.45 } : undefined}>
            <PlayingCard
                card={getRegionCardDefinition(card, { missing })}
                customIcons={FARAWAY_ICONS}
                width={`${width}px`}
                onClick={onClick}
                selectable={!!selectable}
                selected={!!selected}
                hoverable={!!selectable}
                selectedStyle="outline"
                hoverStyle="offset"
            />
        </div>
    );
};

const SanctuaryCardView: React.FC<CardProps & { sanctuaryId: string }> = ({
    sanctuaryId, width = SIZE_TABLEAU, onClick, selected, selectable, dimmed
}) => (
    <div className="fw-sanctuary" style={dimmed ? { opacity: 0.45 } : undefined}>
        <PlayingCard
            card={getSanctuaryCardDefinition(SANCTUARY_BY_ID[sanctuaryId])}
            customIcons={FARAWAY_ICONS}
            width={`${width}px`}
            onClick={onClick}
            selectable={!!selectable}
            selected={!!selected}
            hoverable={!!selectable}
            selectedStyle="outline"
            hoverStyle="offset"
        />
    </div>
);

const CardBack: React.FC<{ width?: number; label?: string }> = ({ width = SIZE_MINI, label }) => (
    <div className="fw-back" style={{ width, height: cardHeight(width), fontSize: Math.max(9, width * 0.13) }}>
        {label}
    </div>
);

const EmptySlot: React.FC<{ width?: number }> = ({ width = SIZE_TABLEAU }) => (
    <div className="fw-empty-card" style={{ width, height: cardHeight(width) }} />
);

// ---------------------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------------------

interface TableauProps {
    tableau: number[];
    sanctuaries: string[];
    width?: number;
    score?: ScoreBreakdown;
    onInspectRegion?: (cardId: number) => void;
    onInspectSanctuary?: (id: string) => void;
}

/**
 * The live right-to-left verdict for one Region, shown under its card:
 *   • a fame chip  — quest met, and what it is worth as the tableau stands
 *   • a lock chip  — quest has a prerequisite that is not visible from here,
 *                    with the wonder coins still missing spelled out
 *   • a dash       — the card has no quest at all
 * It updates every round, so a prerequisite can be watched turning green as
 * regions are added to its right.
 */
const QuestStatus: React.FC<{ rs: RegionScore }> = ({ rs }) => {
    if (!rs.hasQuest) return <span className="fw-slot-fame none" title="No quest">—</span>;
    // The gold-ringed pips on the card itself say *what* is missing, so the
    // badge only has to say that the quest is not scoring.
    if (rs.blocked) {
        return <span className="fw-slot-fame blocked" title="Prerequisite not visible from this card">locked</span>;
    }
    return (
        <span className={['fw-slot-fame', rs.fame === 0 ? 'zero' : 'met'].join(' ')} title="Quest fulfilled">
            <Icon id="fame" size={11} /> {rs.fame}
        </span>
    );
};

/**
 * One player's play area: the ordered Region row, then the Sanctuary shelf.
 * Regions score right to left, so the row carries an explicit direction rail —
 * without it, "the cards to the LEFT don't count" is the single most-missed rule.
 */
const PlayArea: React.FC<TableauProps> = ({
    tableau, sanctuaries, width = SIZE_TABLEAU, score, onInspectRegion, onInspectSanctuary
}) => (
    <div className="fw-panel cream">
        <div className="fw-scoredir">
            <span>scores this way</span>
            <span className="fw-arrow" />
            <span>&#9664;</span>
        </div>
        <div className="fw-tableau">
            {tableau.length === 0 && <EmptySlot width={width} />}
            {tableau.map((cardId, i) => (
                <div className="fw-tableau-slot" key={`${cardId}-${i}`}>
                    <span className="fw-slot-index">{i + 1}</span>
                    <RegionCardView
                        cardId={cardId}
                        width={width}
                        missing={score && score.regions[i] ? score.regions[i].missing : undefined}
                        selectable={!!onInspectRegion}
                        onClick={onInspectRegion ? () => onInspectRegion(cardId) : undefined}
                    />
                    {score && score.regions[i] && <QuestStatus rs={score.regions[i]} />}
                </div>
            ))}
        </div>

        <div className="fw-section-title">
            Sanctuaries
            <span className="fw-spacer" />
            <span>{sanctuaries.length}</span>
        </div>
        <div className="fw-tableau">
            {sanctuaries.length === 0 && <EmptySlot width={width} />}
            {sanctuaries.map((id, i) => (
                <div className="fw-tableau-slot" key={`${id}-${i}`}>
                    <SanctuaryCardView
                        sanctuaryId={id}
                        width={width}
                        selectable={!!onInspectSanctuary}
                        onClick={onInspectSanctuary ? () => onInspectSanctuary(id) : undefined}
                    />
                </div>
            ))}
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Card inspector
// ---------------------------------------------------------------------------

const ResourceIcons: React.FC<{ list: Resource[]; size?: number }> = ({ list, size = 18 }) => (
    <>{list.length === 0 ? <span className="fw-muted">none</span>
        : list.map((r, i) => <Icon key={i} id={resourceIconId(r)} size={size} title={RESOURCE_NAME[r]} />)}</>
);

const DetailModal: React.FC<{
    regionId?: number; sanctuaryId?: string; onClose: () => void;
}> = ({ regionId, sanctuaryId, onClose }) => {
    const region = regionId != null ? REGION_BY_ID[regionId] : null;
    const sanctuary = sanctuaryId ? SANCTUARY_BY_ID[sanctuaryId] : null;
    const colour = region ? region.colour : (sanctuary ? sanctuary.colour : null);
    const quest = region ? region.quest : (sanctuary ? sanctuary.quest : null);

    return (
        <div className="fw-modal-backdrop" onClick={onClose}>
            <div className="fw-modal" onClick={(e) => e.stopPropagation()}>
                <h4>{region ? `Region ${region.id}` : 'Sanctuary'}</h4>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {region
                        ? <RegionCardView cardId={region.id} width={SIZE_DETAIL} />
                        : <SanctuaryCardView sanctuaryId={sanctuary!.id} width={SIZE_DETAIL} />}
                </div>
                <div className="fw-modal-detail">
                    <div className="row">
                        <span className="k">Biome</span>
                        <span className="v">
                            {colour
                                ? <><Icon id={swatchId([colour])} size={16} /> {COLOUR_BIOME[colour]}</>
                                : 'Haven (no colour)'}
                        </span>
                    </div>
                    {region && (
                        <div className="row">
                            <span className="k">Time</span>
                            <span className="v">
                                <Icon id={region.night ? 'moon' : 'sun'} size={16} />
                                {region.night ? 'Night' : 'Day'}
                            </span>
                        </div>
                    )}
                    <div className="row">
                        <span className="k">Wonders</span>
                        <span className="v"><ResourceIcons list={region ? region.resources : sanctuary!.resources} /></span>
                    </div>
                    {((region ? region.clues : sanctuary!.clues) > 0) && (
                        <div className="row">
                            <span className="k">Clue</span>
                            <span className="v"><Icon id="clue" size={16} /> +1 sanctuary drawn</span>
                        </div>
                    )}
                    {region && region.prerequisite.length > 0 && (
                        <div className="row">
                            <span className="k">Requires</span>
                            <span className="v"><ResourceIcons list={region.prerequisite} /></span>
                        </div>
                    )}
                    <div className="row">
                        <span className="k">Quest</span>
                        <span className="v">{describeQuest(quest)}</span>
                    </div>
                    {region && region.prerequisite.length > 0 && (
                        <p className="fw-muted" style={{ margin: 0 }}>
                            The quest only scores if {resourceListLabel(region.prerequisite)} are visible
                            from this card — that is, on this card, on the cards to its right, or on any
                            sanctuary.
                        </p>
                    )}
                </div>
                <button className="fw-btn block" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Players strip
// ---------------------------------------------------------------------------

const PlayersStrip: React.FC<{ p: FarawayProps }> = ({ p }) => {
    const inTurnPhase = p.phase === Phase.EndExploration;
    const order = inTurnPhase && p.turnOrder.length > 0 ? p.turnOrder : p.playerOrder;

    return (
        <div className="fw-players">
            {order.map((id) => {
                const pub = p.publicPlayers[id];
                const played = p.revealed ? p.revealed[id] : undefined;
                const isCurrent = inTurnPhase && p.currentPlayerId === id;
                const doneThisTurn = inTurnPhase && p.turnOrder.indexOf(id) < p.turnOrder.indexOf(p.currentPlayerId || '');
                let state = '';
                if (p.phase === Phase.Commit) state = pub && pub.hasCommitted ? 'ready' : 'choosing…';
                else if (p.phase === Phase.Draft) state = pub && pub.handCount > 0 ? 'ready' : 'drafting…';
                else if (inTurnPhase) state = isCurrent ? 'acting' : (doneThisTurn ? 'done' : 'waiting');

                return (
                    <div key={id} className={['fw-player-chip', isCurrent ? 'active' : '', doneThisTurn ? 'done' : ''].join(' ').trim()}>
                        <span className="fw-dot" style={{ background: p.playerAccents[id] }} />
                        <span>{p.playerNames[id]}</span>
                        {played !== undefined && <span className="fw-chip-num">{played}</span>}
                        <span className="fw-chip-state">{state}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** A numbered pin laid over an example card, keyed to the list beside it. */
const Pin: React.FC<{ n: number; x: string; y: string }> = ({ n, x, y }) => (
    <span className="fw-pin" style={{ left: x, top: y }}>{n}</span>
);

/**
 * A real card from the deck with numbered pins over its parts, so the anatomy
 * is explained on the actual rendering rather than on a drawing of it.
 * Card 56 carries every Region part except night and a clue; card 20 is shown
 * alongside for those two.
 */
const RegionAnatomy: React.FC = () => (
    <div className="fw-anatomy">
        <div className="fw-anatomy-cards">
            <figure>
                <div className="fw-anatomy-card">
                    <RegionCardView cardId={56} width={SIZE_ANATOMY} />
                    <Pin n={1} x="-7%" y="10%" />
                    <Pin n={2} x="60%" y="11%" />
                    <Pin n={3} x="107%" y="24%" />
                    <Pin n={4} x="-7%" y="50%" />
                    <Pin n={6} x="-7%" y="76%" />
                    <Pin n={7} x="107%" y="91%" />
                </div>
                <figcaption>A day Region</figcaption>
            </figure>
            <figure>
                <div className="fw-anatomy-card">
                    <RegionCardView cardId={20} width={SIZE_ANATOMY} />
                    <Pin n={1} x="-7%" y="10%" />
                    <Pin n={5} x="107%" y="24%" />
                </div>
                <figcaption>A night Region with a clue</figcaption>
            </figure>
        </div>

        <ol className="fw-anatomy-list">
            <li>
                <Icon id="sun" size={20} /><Icon id="moon" size={20} />
                <span><b>Day or night</b> — top-left, beside the number. Night cards are what
                    &ldquo;per night&rdquo; quests count; day has no effect of its own.</span>
            </li>
            <li>
                <span className="fw-pin static">56</span>
                <span><b>Exploration duration</b> — the card&rsquo;s number, 1–68, and the only thing
                    that matters when the round resolves. Beat your previous region&rsquo;s number to
                    find sanctuaries; play a low one to pick from the market first.</span>
            </li>
            <li>
                <Icon id={resourceIconId('GOLDLOG')} size={20} />
                <span><b>Wonders produced</b> — the white bubble under the colour band. These icons
                    are visible to this card and to every card on its <i>left</i>.</span>
            </li>
            <li>
                <Icon id={swatchId(['YELLOW'])} size={20} />
                <span><b>Biome art and colour</b> — the band and illustration name the region&rsquo;s
                    biome, which is what colour quests count.</span>
            </li>
            <li>
                <Icon id="clue" size={20} />
                <span><b>Clue</b> — sits in the bubble with the wonders. Every clue anywhere in your
                    area adds one more sanctuary to each draw.</span>
            </li>
            <li>
                <Icon id={resourceIconIdNeed('OKIKO')} size={20} />
                <span><b>Requirements</b> — the hatched strip. These wonders must be visible from this
                    card or its quest scores nothing. In your expedition they are greyed out once
                    satisfied, and <b>ringed in gold</b> while still missing.</span>
            </li>
            <li>
                <span className="fw-pin static">4&times;</span>
                <span><b>Quest</b> — the dark band. A number alone is flat fame; a number and an icon
                    means that much fame <i>for each</i> of those icons you can see.</span>
            </li>
        </ol>
    </div>
);

const SanctuaryAnatomy: React.FC = () => (
    <div className="fw-anatomy">
        <div className="fw-anatomy-cards">
            <figure>
                <div className="fw-anatomy-card">
                    <SanctuaryCardView sanctuaryId="S30" width={SIZE_ANATOMY} />
                    <Pin n={1} x="-7%" y="10%" />
                    <Pin n={2} x="107%" y="10%" />
                    <Pin n={3} x="107%" y="91%" />
                </div>
                <figcaption>A coloured Sanctuary</figcaption>
            </figure>
            <figure>
                <div className="fw-anatomy-card">
                    <SanctuaryCardView sanctuaryId="S23" width={SIZE_ANATOMY} />
                    <Pin n={4} x="-7%" y="50%" />
                </div>
                <figcaption>A colourless Sanctuary</figcaption>
            </figure>
        </div>

        <ol className="fw-anatomy-list">
            <li>
                <Icon id="sanctuary" size={20} />
                <span><b>No number</b> — the arch badge takes its place. A sanctuary has no duration,
                    so it never affects turn order or the &ldquo;beat your last region&rdquo; check.</span>
            </li>
            <li>
                <Icon id={swatchId(['YELLOW'])} size={20} />
                <span><b>Colour, when it has one</b> — it then <b>counts as a region of that colour</b>
                    for every colour quest, wherever it sits.</span>
            </li>
            <li>
                <Icon id="fame" size={20} />
                <span><b>Quest</b> — scored last, with your whole area visible. Sanctuaries never have
                    a requirement strip.</span>
            </li>
            <li>
                <Icon id="sanctuary_coin" size={20} />
                <span><b>Colourless</b> — a plain haven. It still contributes its wonders, clues and
                    night icon, it just belongs to no biome.</span>
            </li>
        </ol>
    </div>
);

/** What each biome's illustration shows, for the icon reference. */
const BIOME_NOTE: Record<Colour, string> = {
    BLUE: 'Blue — flat-topped buttes on the sand.',
    RED: 'Red — spotted mushrooms.',
    GREEN: 'Green — flowing water and stepping stones.',
    YELLOW: 'Yellow — dwellings carved into a cave.'
};

/** How each wonder's glyph reads, for the icon reference. */
const WONDER_NOTE: Record<Resource, string> = {
    UDDU: 'A stone — the cut crystal. The most common wonder.',
    OKIKO: 'A chimera — the horned head.',
    GOLDLOG: 'A thistle — the spiked bloom. The rarest wonder.'
};

/** One labelled row in the icon reference. */
const LegendRow: React.FC<{ iconId: string; name: string; note: string }> = ({ iconId, name, note }) => (
    <div className="fw-legend-item">
        <Icon id={iconId} size={26} />
        <span><b>{name}</b><br /><span className="sub">{note}</span></span>
    </div>
);

const RulesView: React.FC = () => (
    <div className="fw-rules">
        <h3>The expedition</h3>
        <p>
            Over <b>8 rounds</b> everybody plays one Region card per round into their own row,
            left to right. At the end, Regions are scored <b>right to left</b>. Most fame wins.
        </p>

        <h3>Anatomy of a Region</h3>
        <RegionAnatomy />

        <h3>Anatomy of a Sanctuary</h3>
        <SanctuaryAnatomy />

        <h3>Reading the icons</h3>
        <p>
            Two shapes, never mixed: <b>squares are biomes</b> (colours) and <b>circles are things a
            card has</b> — wonders, clues, and day or night. So a square in a quest always counts
            cards of a colour, and a circle always counts icons.
        </p>

        <h3>Biomes</h3>
        <p className="fw-muted">
            Four biomes, one colour each. Colour quests count <b>cards</b>, so a region and a coloured
            sanctuary of the same biome each count once.
        </p>
        <div className="fw-legend">
            {COLOURS.map(c => (
                <LegendRow key={c} iconId={swatchId([c])} name={COLOUR_BIOME[c]} note={BIOME_NOTE[c]} />
            ))}
        </div>

        <h3>Wonders</h3>
        <p className="fw-muted">
            The three treasures. They are <b>never spent</b>: one icon satisfies any number of
            requirements and scores on any number of quests at the same time.
        </p>
        <div className="fw-legend">
            {RESOURCES.map(r => (
                <LegendRow key={r} iconId={resourceIconId(r)} name={RESOURCE_NAME[r]} note={WONDER_NOTE[r]} />
            ))}
        </div>

        <h3>Time and clues</h3>
        <div className="fw-legend">
            <LegendRow iconId="moon" name="Night"
                note="Counts for “per night” quests. Regions 20–40 are the night cards." />
            <LegendRow iconId="sun" name="Day"
                note="Everything else. No effect beyond not being night." />
            <LegendRow iconId="clue" name="Clue"
                note="Each clue in your area adds 1 card to every sanctuary draw." />
            <LegendRow iconId="fame" name="Fame"
                note="The score. Quests are the only source of it." />
        </div>

        <h3>Requirement states</h3>
        <p className="fw-muted">
            On cards in your expedition the requirement strip tells you, at a glance, what a quest is
            still waiting for.
        </p>
        <div className="fw-legend">
            <LegendRow iconId={resourceIconId('UDDU')} name="Neutral"
                note="In hand, in the market, or in a card’s details — position not yet known." />
            <LegendRow iconId={resourceIconIdOk('UDDU')} name="Satisfied"
                note="Greyed out: this icon is already visible from where the card sits." />
            <LegendRow iconId={resourceIconIdNeed('UDDU')} name="Still missing"
                note="Gold ring: play this wonder to the right of the card to unlock its quest." />
        </div>

        <h3>Quest types</h3>
        <p className="fw-muted">
            A quest is a number and, usually, an icon: that much fame <b>for each</b> of that icon you
            can see from the card.
        </p>
        <div className="fw-legend">
            <LegendRow iconId="fame" name="A number alone"
                note="Flat fame, as long as the requirement is met." />
            <LegendRow iconId={resourceIconId('UDDU')} name="Per wonder"
                note="Counts every one of that icon in view — several on one card all count." />
            <LegendRow iconId="moon" name="Per night card" note="Counts night cards, not night icons." />
            <LegendRow iconId="clue" name="Per clue" note="Counts clue icons in view." />
            <LegendRow iconId={swatchId(['GREEN'])} name="Per biome"
                note="Counts cards of that biome." />
            <LegendRow iconId={swatchId(['YELLOW', 'RED'])} name="Per either biome"
                note="A split square: a card of either colour counts once." />
            <LegendRow iconId="sw_set4" name="Per full set"
                note="A four-colour square: scores per complete set of all four biomes." />
        </div>

        <h3>A round</h3>
        <ol>
            <li><b>Explore</b> — everybody secretly picks 1 Region from hand; all are revealed together and added to the right end of the row.</li>
            <li><b>Find sanctuaries</b> — if your new Region&rsquo;s number is <b>strictly higher</b> than the one immediately to its left, you draw <b>1 + your total clues</b> Sanctuary cards.</li>
            <li><b>End of exploration</b> — in <b>ascending order of the number played</b>: keep exactly 1 of the Sanctuaries you drew (the rest go under the deck), then take 1 Region from the market. There is no market in round 8.</li>
        </ol>
        <p className="fw-muted">
            That is the whole tension: a <b>low</b> number picks from the market first but rarely earns
            sanctuaries; a <b>high</b> number earns sanctuaries but picks last.
        </p>

        <h3>Scoring</h3>
        <p>
            Resolve Regions <b>right to left</b>. Each Region sees <b>only itself, the Regions to its
            right, and all of your Sanctuaries</b> — never the Regions to its left.
        </p>
        <ul>
            <li>If a Region has a <b>requirement</b>, those wonder icons must be visible from it, or its quest scores <b>0</b>.</li>
            <li>Icons are <b>never spent</b>: the same icon satisfies any number of requirements and quests.</li>
            <li>A coloured Sanctuary <b>counts as a Region of that colour</b> for quests, but it has no duration and never affects turn order.</li>
            <li>Sanctuary quests are scored last, with everything visible, and never have a requirement.</li>
        </ul>
        <p className="fw-muted">
            Highest fame wins. Ties are broken by the <b>lowest total</b> of the eight exploration durations.
        </p>
    </div>
);

// ---------------------------------------------------------------------------
// Lobby views
// ---------------------------------------------------------------------------

export class FarawayHostLobby extends React.Component<ViewPropsInterface, {}> {
    private setAdvanced(v: boolean) { (this.props.MP as any).setAdvanced(v); }

    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const advanced = mp.getData ? (mp.getData('faraway_advanced') === true) : false;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="fw-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="fw-lobby-opt">
                            <div className="fw-picker-label">Opening hand</div>
                            <div className="fw-opt-buttons">
                                <button className={['fw-btn small', !advanced ? 'primary' : ''].join(' ')}
                                    onClick={() => this.setAdvanced(false)}>Standard (deal 3)</button>
                                <button className={['fw-btn small', advanced ? 'primary' : ''].join(' ')}
                                    onClick={() => this.setAdvanced(true)}>Advanced (deal 5, keep 3)</button>
                            </div>
                            <p className="fw-muted" style={{ margin: 0 }}>
                                The advanced draft is recommended once everyone has played before.
                            </p>
                        </div>
                        {(playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS)
                            ? (
                                // The host method throws for an illegal count and the lobby
                                // button gives no feedback, so say it here instead.
                                <p className="fw-warn">
                                    {playerCount} player{playerCount > 1 ? 's' : ''} connected — Faraway needs
                                    between {MIN_PLAYERS} and {MAX_PLAYERS}. Starting now will do nothing.
                                </p>
                            )
                            : <p className="fw-muted">{playerCount} player{playerCount > 1 ? 's' : ''}. Faraway supports {MIN_PLAYERS}–{MAX_PLAYERS}.</p>}
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Faraway', 'links': links });
    }
}

export class FarawayClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div className="fw-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="fw-waiting">Waiting for the host to start…</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Faraway', 'links': links });
    }
}

// ---------------------------------------------------------------------------
// Score pad
// ---------------------------------------------------------------------------

const ScoreView: React.FC<{ p: FarawayProps }> = ({ p }) => {
    const scores = p.scores;
    if (!scores) return <div className="fw-muted pad">Scoring…</div>;
    const winners = p.winnerIds || [];
    const rows = [...p.playerOrder].sort((a, b) => scores[b].total - scores[a].total);

    return (
        <div className="fw-score">
            <div className="fw-winner-banner">
                {winners.map(id => p.playerNames[id]).join(' & ')} win{winners.length > 1 ? '' : 's'} with {scores[winners[0]].total} fame
            </div>
            <div className="fw-score-scroll">
                <table className="fw-score-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            {Array.from({ length: ROUNDS }, (_, i) => <th key={i}>{i + 1}</th>)}
                            <th>Sanct.</th>
                            <th>Total</th>
                            <th>Σ dur.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(id => {
                            const s = scores[id];
                            return (
                                <tr key={id} className={winners.indexOf(id) !== -1 ? 'winner' : ''}>
                                    <td>{p.playerNames[id]}</td>
                                    {Array.from({ length: ROUNDS }, (_, i) => (
                                        <td key={i}>{s.regions[i] ? (s.regions[i].blocked ? '—' : s.regions[i].fame) : ''}</td>
                                    ))}
                                    <td>{s.sanctuaryFame}</td>
                                    <td className="total">{s.total}</td>
                                    <td className="fw-muted">{s.durationSum}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="fw-muted">
                A dash means the Region&rsquo;s prerequisite was not visible from where it sits, so its quest scored nothing.
            </p>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Opponents tab
// ---------------------------------------------------------------------------

/** Count every wonder and clue icon across a play area (regions + sanctuaries). */
function iconTotals(tableau: number[], sanctuaries: string[]): { clues: number; wonders: Record<Resource, number> } {
    const wonders = { UDDU: 0, OKIKO: 0, GOLDLOG: 0 } as Record<Resource, number>;
    let clues = 0;
    const add = (c: { clues: number; resources: Resource[] }) => {
        clues += c.clues;
        c.resources.forEach(r => { wonders[r]++; });
    };
    tableau.forEach(id => add(REGION_BY_ID[id]));
    sanctuaries.forEach(id => add(SANCTUARY_BY_ID[id]));
    return { clues, wonders };
}

/**
 * The rivals at a glance, under your own expedition on the main tab: each
 * opponent's row and sanctuaries at ~65% of your own tableau's card size, plus
 * their clue and wonder totals. The full per-rival view (with colours in play)
 * stays on the Rivals tab.
 */
const RivalsSummary: React.FC<{
    p: FarawayProps;
    onInspectRegion: (id: number) => void;
    onInspectSanctuary: (id: string) => void;
}> = ({ p, onInspectRegion, onInspectSanctuary }) => {
    const me = p.MP.clientId;
    const others = p.playerOrder.filter(id => id !== me && p.publicPlayers[id]);
    if (others.length === 0) return null;

    return (
        <>
            <div className="fw-section-title">Rivals</div>
            {others.map(id => {
                const pub = p.publicPlayers[id];
                const totals = iconTotals(pub.tableau, pub.sanctuaries);
                return (
                    <div className="fw-rival" key={id}>
                        <div className="fw-rival-head">
                            <span className="fw-dot" style={{ background: p.playerAccents[id] }} />
                            <b>{p.playerNames[id]}</b>
                            <span className="fw-spacer" />
                            <span className="fw-rival-stat" title="Clues">
                                <Icon id="clue" size={15} /> {totals.clues}
                            </span>
                            {RESOURCES.map(r => (
                                <span className="fw-rival-stat" key={r} title={RESOURCE_NAME[r]}>
                                    <Icon id={resourceIconId(r)} size={15} /> {totals.wonders[r]}
                                </span>
                            ))}
                            <span className="fw-rival-stat" title="Projected fame">
                                <Icon id="fame" size={15} /> {pub.score.total}
                            </span>
                        </div>
                        <div className="fw-tableau compact">
                            {pub.tableau.length === 0 && <span className="fw-muted">No regions yet.</span>}
                            {pub.tableau.map((cardId, i) => (
                                <RegionCardView
                                    key={`${cardId}-${i}`}
                                    cardId={cardId}
                                    width={SIZE_RIVAL}
                                    selectable
                                    onClick={() => onInspectRegion(cardId)}
                                />
                            ))}
                            {pub.sanctuaries.length > 0 && <span className="fw-rival-divider" />}
                            {pub.sanctuaries.map((sid, i) => (
                                <SanctuaryCardView
                                    key={`${sid}-${i}`}
                                    sanctuaryId={sid}
                                    width={SIZE_RIVAL}
                                    selectable
                                    onClick={() => onInspectSanctuary(sid)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </>
    );
};

const OpponentsView: React.FC<{
    p: FarawayProps;
    onInspectRegion: (id: number) => void;
    onInspectSanctuary: (id: string) => void;
}> = ({ p, onInspectRegion, onInspectSanctuary }) => {
    const me = p.MP.clientId;
    const others = p.playerOrder.filter(id => id !== me);
    if (others.length === 0) return <div className="fw-muted pad">No other explorers.</div>;

    return (
        <div className="fw-arena">
            {others.map(id => {
                const pub = p.publicPlayers[id];
                if (!pub) return null;
                return (
                    <div className="fw-opponent" key={id}>
                        <div className="fw-opponent-head">
                            <span className="fw-dot" style={{ background: p.playerAccents[id], width: 10, height: 10, borderRadius: '50%' }} />
                            {p.playerNames[id]}
                            <span className="fw-spacer" />
                            <Icon id="clue" size={14} /> {pub.clues}
                            <span className="fw-muted">· {pub.tableau.length}/{ROUNDS} regions · {pub.sanctuaries.length} sanct.</span>
                        </div>
                        <PlayArea
                            tableau={pub.tableau}
                            sanctuaries={pub.sanctuaries}
                            width={SIZE_MINI}
                            onInspectRegion={onInspectRegion}
                            onInspectSanctuary={onInspectSanctuary}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface MainState {
    pick: number | null;            // hand card highlighted before confirming
    draftPicks: number[];           // advanced draft selection
    inspectRegion: number | null;
    inspectSanctuary: string | null;
}

export class FarawayMainPage extends React.Component<FarawayProps, MainState> {
    public state: MainState = { pick: null, draftPicks: [], inspectRegion: null, inspectSanctuary: null };

    private mp(): any { return this.props.MP; }

    private inspectRegion = (id: number) => this.setState({ inspectRegion: id, inspectSanctuary: null });
    private inspectSanctuary = (id: string) => this.setState({ inspectSanctuary: id, inspectRegion: null });
    private closeInspect = () => this.setState({ inspectRegion: null, inspectSanctuary: null });

    private commit = () => {
        if (this.state.pick == null) return;
        const cardId = this.state.pick;
        this.setState({ pick: null });
        this.mp().commitRegion(cardId);
    };

    private confirmDraft = () => {
        const keep = this.state.draftPicks;
        this.setState({ draftPicks: [] });
        this.mp().draftKeep(keep);
    };

    private toggleDraft = (cardId: number) => {
        const picks = this.state.draftPicks;
        if (picks.indexOf(cardId) !== -1) {
            this.setState({ draftPicks: picks.filter(c => c !== cardId) });
        } else if (picks.length < 3) {
            this.setState({ draftPicks: [...picks, cardId] });
        }
    };

    // ---- phase panels -----------------------------------------------------
    //
    // The arena always stacks the same three card panels in the same order and
    // at the same card sizes — MARKET, HAND, then SANCTUARIES — so nothing jumps
    // around between phases or between turns. Only the headers, badges and
    // interactivity change.

    /** The single instruction line for whatever the player is being asked to do. */
    private renderPrompt() {
        const p = this.props;
        const owed = p.myPendingActions;
        const myTurn = p.isMyTurn && !!owed;

        if (p.phase === Phase.Draft) {
            return p.myDraftPool.length === 0
                ? <div className="fw-prompt waiting">Hand kept. Waiting for the other explorers…</div>
                : <div className="fw-prompt">Keep 3 of these 5 regions — the rest go back in the deck.</div>;
        }

        if (p.phase === Phase.Commit) {
            if (p.myCommitted != null) {
                return (
                    <div className="fw-panel">
                        <div className="fw-prompt waiting">
                            Region {p.myCommitted} committed. Waiting for the other explorers…
                        </div>
                        <button className="fw-btn ghost block" onClick={() => this.mp().uncommitRegion()}>
                            Change my mind
                        </button>
                    </div>
                );
            }
            return (
                <div className="fw-prompt">
                    {p.myLastRegion == null
                        ? 'Choose your first region — no sanctuaries this round.'
                        // one span, so the flex prompt doesn't split the bold number into its own column
                        : <span>Choose a region. Beat <b>{p.myLastRegion}</b> to find sanctuaries.</span>}
                </div>
            );
        }

        if (!myTurn) {
            const currentName = p.currentPlayerId ? p.playerNames[p.currentPlayerId] : '';
            return (
                <div className="fw-prompt waiting">
                    {currentName ? `${currentName} is taking their turn…` : 'Resolving the round…'}
                </div>
            );
        }
        // Sanctuaries resolve before the market pick, so the prompt names
        // whichever of the two is still outstanding.
        if (owed!.sanctuary) {
            return (
                <div className="fw-prompt">
                    Your turn — keep 1 of the {p.myPending.length} sanctuar{p.myPending.length === 1 ? 'y' : 'ies'} you found.
                </div>
            );
        }
        return <div className="fw-prompt">Your turn — take 1 region from the market.</div>;
    }

    /** Panel 1: the market. Always in the same place, whatever the phase. */
    private renderMarketPanel() {
        const p = this.props;
        const owed = p.myPendingActions;
        // Sanctuary first: the market only becomes tappable once nothing is pending.
        const interactive = !!(p.isMyTurn && owed && owed.market && !owed.sanctuary);

        if (!p.marketActive) {
            return <div className="fw-prompt waiting">Final round — there is no market to pick from.</div>;
        }
        if (p.market.length === 0) return null;

        return (
            <div className="fw-panel">
                <div className="fw-section-title">
                    Market
                    <span className="fw-spacer" />
                    <span>{interactive ? 'tap one to take it' : 'lowest number picks first'}</span>
                </div>
                <div className="fw-row">
                    {p.market.map((cardId, i) => (
                        <div className="fw-slot" key={`${cardId}-${i}`}>
                            <RegionCardView
                                cardId={cardId}
                                width={SIZE_MARKET}
                                selectable
                                onClick={interactive ? () => this.mp().takeMarket(i) : () => this.inspectRegion(cardId)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    /** Panel 2: the hand (or the dealt pool during the advanced draft). */
    private renderHandPanel() {
        const p = this.props;
        const drafting = p.phase === Phase.Draft && p.myDraftPool.length > 0;
        const choosing = p.phase === Phase.Commit && p.myCommitted == null;
        const cards = drafting ? p.myDraftPool : p.myHand;
        if (cards.length === 0) return null;

        const picks = this.state.draftPicks;

        return (
            <div className="fw-panel">
                <div className="fw-section-title">
                    {drafting ? 'Keep 3' : 'Your hand'}
                    <span className="fw-spacer" />
                    {!drafting && p.myLastRegion != null && <span>beat <b>{p.myLastRegion}</b> for sanctuaries</span>}
                </div>
                <div className="fw-row">
                    {cards.map(cardId => {
                        const pv = choosing ? p.myPreviews[cardId] : undefined;
                        const selected = drafting
                            ? picks.indexOf(cardId) !== -1
                            : (choosing ? this.state.pick === cardId : p.myCommitted === cardId);
                        return (
                            <div className="fw-hand-card fw-slot" key={cardId}>
                                <RegionCardView
                                    cardId={cardId}
                                    width={SIZE_HAND}
                                    selectable
                                    selected={selected}
                                    onClick={() => {
                                        if (drafting) this.toggleDraft(cardId);
                                        else if (choosing) this.setState({ pick: this.state.pick === cardId ? null : cardId });
                                        else this.inspectRegion(cardId);
                                    }}
                                />
                                {choosing && (
                                    // How many sanctuaries this play would draw: 1 + every
                                    // clue in view if it beats the last region, else none.
                                    <span
                                        className={['fw-gain', pv && pv.qualifies ? 'yes' : ''].join(' ').trim()}
                                        title={pv && pv.qualifies
                                            ? `Beats ${p.myLastRegion}: draw ${pv.draws} sanctuar${pv.draws === 1 ? 'y' : 'ies'}`
                                            : 'Does not beat your last region: no sanctuaries'}
                                    >
                                        +{pv && pv.qualifies ? pv.draws : 0} <Icon id="sanctuary" size={13} />
                                    </span>
                                )}
                                {!choosing && !drafting && p.myCommitted === cardId && (
                                    <span className="fw-gain yes">exploring</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {drafting && (
                    <button className="fw-btn primary block" disabled={picks.length !== 3} onClick={this.confirmDraft}>
                        {picks.length === 3 ? 'Keep these 3' : `Select ${3 - picks.length} more`}
                    </button>
                )}
                {choosing && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="fw-btn primary block" disabled={this.state.pick == null} onClick={this.commit}>
                            {this.state.pick == null ? 'Pick a region' : `Explore region ${this.state.pick}`}
                        </button>
                        {this.state.pick != null && (
                            <button className="fw-btn small" onClick={() => this.inspectRegion(this.state.pick!)}>Details</button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    /** Panel 3: the sanctuaries drawn this round, when there are any to resolve. */
    private renderSanctuaryPanel() {
        const p = this.props;
        if (p.myPending.length === 0) return null;
        const owed = p.myPendingActions;
        const interactive = !!(p.isMyTurn && owed && owed.sanctuary);

        return (
            <div className="fw-panel">
                <div className="fw-section-title">
                    Sanctuaries found
                    <span className="fw-spacer" />
                    <span>{interactive ? 'keep exactly 1' : 'you choose on your turn'}</span>
                </div>
                <div className="fw-row">
                    {p.myPending.map(id => (
                        <div className="fw-slot" key={id}>
                            <SanctuaryCardView
                                sanctuaryId={id}
                                width={SIZE_PENDING}
                                selectable
                                onClick={interactive
                                    ? () => this.mp().keepSanctuary(id)
                                    : () => this.inspectSanctuary(id)}
                            />
                        </div>
                    ))}
                </div>
                <p className="fw-muted">The others go back under the sanctuary deck.</p>
            </div>
        );
    }

    // ---- arena ------------------------------------------------------------

    private renderArena() {
        const p = this.props;
        const me = p.MP.clientId;
        const mine = p.publicPlayers[me];
        const over = p.phase === Phase.Scoring || p.phase === Phase.Done;

        return (
            <div className="fw-arena">
                {over ? <ScoreView p={p} /> : (
                    <>
                        {this.renderPrompt()}
                        {this.renderMarketPanel()}
                        {this.renderHandPanel()}
                        {this.renderSanctuaryPanel()}
                        <PlayersStrip p={p} />
                    </>
                )}

                <div className="fw-section-title">
                    Your expedition
                    <span className="fw-spacer" />
                    <Icon id="clue" size={13} /> {mine ? mine.clues : 0}
                    <span>·</span>
                    <Icon id="fame" size={13} /> {mine ? mine.score.total : 0}
                </div>
                {mine && (
                    <PlayArea
                        tableau={mine.tableau}
                        sanctuaries={mine.sanctuaries}
                        width={over ? SIZE_TABLEAU_BIG : SIZE_TABLEAU}
                        score={mine.score}
                        onInspectRegion={this.inspectRegion}
                        onInspectSanctuary={this.inspectSanctuary}
                    />
                )}

                <RivalsSummary
                    p={p}
                    onInspectRegion={this.inspectRegion}
                    onInspectSanctuary={this.inspectSanctuary}
                />

                {(this.state.inspectRegion != null || this.state.inspectSanctuary != null) && (
                    <DetailModal
                        regionId={this.state.inspectRegion ?? undefined}
                        sanctuaryId={this.state.inspectSanctuary ?? undefined}
                        onClose={this.closeInspect}
                    />
                )}
            </div>
        );
    }

    private renderBoard() {
        const p = this.props;
        const me = p.MP.clientId;
        const mine = p.publicPlayers[me];
        if (!mine) return <div className="fw-muted pad">No expedition yet.</div>;

        return (
            <div className="fw-arena">
                <div className="fw-section-title">
                    Projected fame
                    <span className="fw-spacer" />
                    <Icon id="fame" size={14} /> {mine.score.total}
                </div>
                <PlayArea
                    tableau={mine.tableau}
                    sanctuaries={mine.sanctuaries}
                    width={SIZE_TABLEAU_BIG}
                    score={mine.score}
                    onInspectRegion={this.inspectRegion}
                    onInspectSanctuary={this.inspectSanctuary}
                />
                <div className="fw-panel">
                    <div className="fw-section-title">Colours in play</div>
                    <div className="fw-legend">
                        {COLOURS.map(c => (
                            <div className="fw-legend-item" key={c}>
                                <Icon id={swatchId([c])} size={20} />
                                <span><b>{mine.colours[c]}</b> <span className="sub">{COLOUR_BIOME[c]}</span></span>
                            </div>
                        ))}
                    </div>
                    <p className="fw-muted">
                        Fame shown under each region is what it would score if the game ended now — a
                        region only ever sees itself, the regions to its right, and your sanctuaries.
                    </p>
                </div>
                {(this.state.inspectRegion != null || this.state.inspectSanctuary != null) && (
                    <DetailModal
                        regionId={this.state.inspectRegion ?? undefined}
                        sanctuaryId={this.state.inspectSanctuary ?? undefined}
                        onClose={this.closeInspect}
                    />
                )}
            </div>
        );
    }

    private topBar() {
        const p = this.props;
        const mine = p.publicPlayers[p.MP.clientId];
        if (p.phase === Phase.Scoring || p.phase === Phase.Done) {
            return <span className="fw-topbar">Final · <Icon id="fame" size={14} /> {mine ? mine.score.total : 0}</span>;
        }
        return (
            <span className="fw-topbar">
                <span>Round {p.round}/{ROUNDS}</span>
                <span className="fw-topbar-sep">|</span>
                <Icon id="fame" size={14} />
                <span>{mine ? mine.score.total : 0}</span>
            </span>
        );
    }

    public render() {
        const p = this.props;
        const mp = p.MP;
        const needsMe = (p.phase === Phase.Commit && p.myCommitted == null)
            || (p.phase === Phase.Draft && p.myDraftPool.length > 0)
            || (p.phase === Phase.EndExploration && p.isMyTurn);

        const links: any = {
            'home': { 'icon': 'compass', 'label': 'Explore', 'view': this.renderArena() },
            'board': { 'icon': 'map', 'label': 'Tableau', 'view': this.renderBoard() },
            'players': {
                'icon': 'users', 'label': 'Rivals',
                'view': (
                    <>
                        <OpponentsView p={p} onInspectRegion={this.inspectRegion} onInspectSanctuary={this.inspectSanctuary} />
                        {(this.state.inspectRegion != null || this.state.inspectSanctuary != null) && (
                            <DetailModal
                                regionId={this.state.inspectRegion ?? undefined}
                                sanctuaryId={this.state.inspectSanctuary ?? undefined}
                                onClose={this.closeInspect}
                            />
                        )}
                    </>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <RulesView /> }
        };
        if (p.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="fw-settings">
                        <button className="fw-btn" onClick={() => this.mp().restartGame()}>Restart game</button>
                        <button className="fw-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Faraway',
            'topBarContent': this.topBar(),
            'roomClassName': needsMe ? 'attention-bg' : ''
        });
    }
}
