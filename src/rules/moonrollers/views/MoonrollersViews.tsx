/**
 * MoonrollersViews.tsx - React components for Moonrollers (2-5 players).
 *
 * Flat, mid-century-modern skin: white surfaces, bold faction hues, hairline borders,
 * no offset shadows. Dice are solid colour tiles with a knocked-out white/ink glyph;
 * crew cards are custom flat panels whose requirement rows carry live commit/complete
 * token state (the load-bearing Bust-vs-Stop distinction).
 */

import * as React from 'react';
import { ViewPropsInterface } from '../../../common/interfaces';
import {
    GameStatus, DieSymbol, ReqType, Faction, Die as GameDie, DisplayCard, CrewCard, HazardToken,
    AbilityDef, AbilityKind, FinalScoreRow, symbolName, factionName, INSTANT_KINDS, SELECT_KINDS
} from '../MoonrollersGameState';

// Ability kinds the player actively triggers (a button / die-tap) vs. automatic passives.
const TRIGGERED_KINDS: AbilityKind[] = ['first_roll_reroll', 'retag_wild', 'extra_convert', ...INSTANT_KINDS, ...SELECT_KINDS];
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import { Die } from '../../../client/lib/dice-roller/Die';
import { DicePool } from '../../../client/lib/dice-roller/DicePool';
import {
    MOONROLLERS_ICONS, MOON_PALETTES, SYMBOL_COLORS, FACTION_COLORS,
    symbolIconId, INK, MOON_DICE_FACES, MOON_DICE_THEME
} from '../MoonrollersAssets';
import DiceRollSound from '../../../sounds/dice_roll.mp3';
import CoinFewSound from '../../../sounds/coin_few.mp3';
import CoinManySound from '../../../sounds/coin_many.mp3';
import MicrowaveBellSound from '../../../sounds/microwave_bell.mp3';
import ScratchSound from '../../../sounds/scratch.mp3';

// Five distinct player-token colours (one per seat).
const PLAYER_COLORS = ['#d1495b', '#2b90b3', '#e0a51b', '#419a5e', '#8a5aa6'];

// ==========================================
// Shared glyph helpers
// ==========================================
function Glyph(props: { iconId: string; size: string; override?: string }) {
    const icon = MOONROLLERS_ICONS[props.iconId];
    if (!icon) return null;
    return (
        <span className="mr-glyph" style={{ width: props.size, height: props.size }}>
            <ExpressiveIcon icon={icon} palette={MOON_PALETTES.neutral} colorOverride={props.override} />
        </span>
    );
}

// A static (non-rolling) die face — used in the rules legend.
function DieTile(props: { symbol: DieSymbol; size?: number }) {
    return (
        <Die faceId={props.symbol} faceset={MOON_DICE_FACES}
            theme={{ ...MOON_DICE_THEME, size: props.size || 46 }}
            animation={{ enabled: false }} title={symbolName(props.symbol)} />
    );
}

// Highlight faction / die-symbol words inside ability text — each in its own colour, bold.
const ABILITY_KEYWORD = /(Extra Dice|Extra Die|Extra|Reactors?|Shields?|Thrusters?|Damage|Wilds?)/gi;
function symbolColorForWord(word: string): string | undefined {
    const w = word.toLowerCase();
    if (w.startsWith('reactor')) return SYMBOL_COLORS.REACTOR;
    if (w.startsWith('shield')) return SYMBOL_COLORS.SHIELD;
    if (w.startsWith('thruster')) return SYMBOL_COLORS.THRUSTER;
    if (w.startsWith('damage')) return SYMBOL_COLORS.DAMAGE;
    if (w.startsWith('wild')) return SYMBOL_COLORS.WILD;
    if (w.startsWith('extra')) return SYMBOL_COLORS.EXTRA;
    return undefined;
}
function abilityText(text: string): React.ReactNode {
    if (!text) return text;
    return text.split(ABILITY_KEYWORD).map((part, i) => {
        if (/^(Extra Dice|Extra Die|Extra|Reactors?|Shields?|Thrusters?|Damage|Wilds?)$/i.test(part)) {
            return <strong key={i} style={{ color: symbolColorForWord(part), fontWeight: 800 }}>{part}</strong>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

// ==========================================
// Props
// ==========================================
type HiredSummary = { id: string; name: string; faction: Faction; abilityText: string; starting: boolean };
type PublicPlayer = {
    id: string; name: string; prestige: number;
    factionCounts: Record<string, number>;
    hired: HiredSummary[];
    hazardCount: number;
};

// A faction-coloured chip naming a hired crew (with a starter marker).
function CrewChip(props: { crew: HiredSummary }) {
    const c = props.crew;
    return (
        <span className="mr-hired-chip" style={{ background: FACTION_COLORS[c.faction] }} title={c.abilityText}>
            <Glyph iconId={symbolIconId(c.faction)} size="14px" override="#ffffff" />
            {c.name}
            {c.starting && <span className="mr-chip-starter" title="Starting crew"><Glyph iconId="starter" size="11px" override="#ffffff" /></span>}
        </span>
    );
}

interface Affordances {
    committable: Array<{ cardIndex: number; reqIndex: number }>;
    directLockDice: number[];
    retagDice: Array<{ dieIndex: number; ability: string }>;
    extraConvert: { dieIndices: number[]; type: ReqType; count: number } | null;
    canRerollAll: boolean;
    availableAbilities: Array<{ id: string; label: string; trigger: 'instant' | 'select'; selectMax?: number; selectFace?: DieSymbol }>;
}

interface MoonProps extends ViewPropsInterface {
    status: GameStatus;
    step: string;
    playerIds: string[];
    firstPlayerId: string;
    currentPlayerId: string;
    display: DisplayCard[];
    deckSize: number;
    rollingPool: GameDie[];
    supplyCount: number;
    lockedCount: number;
    chosenCardIndex: number | null;
    committedReqIndex: number | null;
    committedProgress: number;
    lockedThisRoll: number;
    bustSafeThisRoll: boolean;
    rollId: number;
    pendingAbilityFaction: Faction | null;
    publicPlayers: PublicPlayer[];
    playerNames: Record<string, string>;
    winnerIds: string[] | null;
    finalScores: FinalScoreRow[] | null;
    lastMove: any;

    myId: string;
    isHost: boolean;
    myHazardTokens: HazardToken[];
    myAbilities: AbilityDef[];
    affordances: Affordances;
    pendingHazards: HazardToken[];
}

const playerColor = (playerIds: string[], id: string): string =>
    PLAYER_COLORS[Math.max(0, playerIds.indexOf(id)) % PLAYER_COLORS.length];

// Does the pool hold ENOUGH dice to COMPLETE this requirement right now — ignoring
// abilities (no converters / retags) and transient pull dice? Wilds count toward a normal
// requirement; only real Wilds count toward a ×2 Wild requirement. Drives the pulse, so it
// highlights only requirements you can actually finish with your current dice.
function poolCanFulfill(pool: GameDie[], req: { type: ReqType; count: number }): boolean {
    const active = pool.filter(d => !d.transient);
    const available = req.type === 'WILD'
        ? active.filter(d => d.face === 'WILD' && !d.asWild).length
        : active.filter(d => d.face === req.type || d.face === 'WILD').length;
    return available >= req.count;
}

// ==========================================
// Lobby
// ==========================================
export class MoonrollersHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const count = mp.playersCount() + 1;
        const ok = count >= 2 && count <= 5;
        const links = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        {!ok && (
                            <p style={{ color: '#d1495b', fontWeight: 700, textAlign: 'center', marginTop: 20 }}>
                                Moonrollers is for 2&ndash;5 players. Currently {count} in the lobby.
                            </p>
                        )}
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <MoonrollersRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Moonrollers', 'links': links });
    }
}

export class MoonrollersClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links = {
            'home': {
                'icon': 'id-card', 'label': 'Lobby',
                'view': (
                    <div>
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="mr-wait">Waiting for the host to launch&hellip;</div>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <MoonrollersRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Moonrollers', 'links': links });
    }
}

// ==========================================
// Rules
// ==========================================
export class MoonrollersRulesView extends React.Component<{}, {}> {
    private sampleCard(): DisplayCard {
        const card: CrewCard = {
            id: 'sample', name: 'Zeta Kael', faction: 'SHIELD', isStartingCrew: true,
            abilityId: '', abilityText: 'Roll 2+ Shields ⇒ you are safe from busting next roll.',
            requirements: [
                { index: 0, type: 'SHIELD', count: 4, hazard: false },
                { index: 1, type: 'THRUSTER', count: 3, hazard: false },
                { index: 2, type: 'DAMAGE', count: 3, hazard: true },
                { index: 3, type: 'WILD', count: 2, hazard: false }
            ]
        };
        return {
            card,
            reqStates: [
                { status: 'COMPLETED', owner: 'you', placedThisTurn: false }, // covered token
                { status: 'COMMITTED', owner: 'you', placedThisTurn: true },  // token above (2/3 done)
                { status: 'OPEN', owner: null, placedThisTurn: false },
                { status: 'OPEN', owner: null, placedThisTurn: false }
            ]
        };
    }

    public render() {
        const faces: DieSymbol[] = ['DAMAGE', 'REACTOR', 'THRUSTER', 'SHIELD', 'WILD', 'EXTRA'];
        return (
            <div className="mr-rules">
                <div className="mr-rules-sec">
                    <h3>Goal</h3>
                    <p>Roll dice and lock them onto a shared Crew card&rsquo;s requirements to bank <strong>Prestige</strong>,
                        and <strong>recruit</strong> Crew by finishing their last requirement. The game ends the <em>instant</em>
                        someone has recruited <strong>1 Crew of each of the 5 Factions</strong> or <strong>3 Crew of one
                        Faction</strong> (also if the deck runs out). The most total Prestige then wins.</p>
                </div>

                <div className="mr-rules-sec">
                    <h3>The Dice</h3>
                    <div className="mr-legend">
                        {faces.map(s => (
                            <div key={s} className="mr-legend-item">
                                <DieTile symbol={s} size={40} />
                                <span>{symbolName(s)}</span>
                            </div>
                        ))}
                    </div>
                    <p><strong>Wild</strong> locks onto any normal requirement (only a <em>real</em> Wild satisfies a ×2 Wild
                        requirement). <strong>Extra Dice</strong> never lock on their own — each Extra showing adds a die from
                        supply on your next roll, stretching your turn.</p>
                </div>

                <div className="mr-rules-sec">
                    <h3>Anatomy of a Crew Card</h3>
                    <div className="mr-anatomy">
                        <div className="mr-anatomy-card">
                            <CrewCardView
                                dc={this.sampleCard()} cardIndex={0}
                                playerIds={['you']} playerNames={{ you: 'You' }} myId="you"
                                chosen committedReqIndex={1} committedProgress={2}
                                canChoose={false} committableReqIdx={[]}
                            />
                        </div>
                        <ul className="mr-anatomy-list">
                            <li><span className="mr-a-ico"><Glyph iconId="sym_shield" size="18px" override={FACTION_COLORS.SHIELD} /></span>
                                <span><strong>Faction band</strong> (top) — its colour &amp; symbol. Recruiting drives the win
                                    condition, and same-faction Crew stack (below).</span></li>
                            <li><span className="mr-a-ico"><Glyph iconId="starter" size="15px" override="#ffffff" /></span>
                                <span><strong>Starting-Crew arrow</strong> — a down-arrow marks the five starters; you begin the game with one already recruited.</span></li>
                            <li><span className="mr-a-ico"><Glyph iconId="sym_thruster" size="18px" override={FACTION_COLORS.THRUSTER} /></span>
                                <span><strong>Requirement symbol</strong> — the die face that locks onto that row (Wilds also lock onto normal rows).</span></li>
                            <li><span className="mr-a-ico mr-a-num">3</span>
                                <span><strong>Requirement number</strong> — does double duty: the dice needed to complete the row <em>and</em> the Prestige it pays whoever completes it.</span></li>
                            <li><span className="mr-a-ico"><Glyph iconId="hazard_flag" size="16px" /></span>
                                <span><strong>Hazard flag</strong> — completing this row makes you draw 2 Hazard tokens and keep 1.</span></li>
                            <li><span className="mr-a-ico mr-a-num" style={{ color: '#8a5aa6' }}>×2</span>
                                <span><strong>Wild requirement</strong> — accepts <em>only</em> real Wild dice and pays <strong>double</strong> its number.</span></li>
                            <li><span className="mr-a-tok covered">Y</span>
                                <span><strong>Token covering</strong> a row = you <strong>completed</strong> it (kept when you Stop).</span></li>
                            <li><span className="mr-a-tok above">Y</span>
                                <span><strong>Token above</strong> a row = you are <strong>committed</strong> but not done (the pips show progress, here 2/3).</span></li>
                            <li><span className="mr-a-ico"><span className="mr-a-dot" /></span>
                                <span><strong>Ability</strong> (bottom) — activates once the Crew is recruited and sits on top of its faction stack.</span></li>
                        </ul>
                    </div>
                </div>

                <div className="mr-rules-sec">
                    <h3>Your Turn</h3>
                    <ol>
                        <li>Roll 5 dice, then <strong>choose one Crew</strong> from the display for the whole turn.</li>
                        <li><strong>Commit</strong> to an open requirement (one without a token) and lock ≥1 matching die onto it.
                            You may re-pick the requirement or Crew freely until your first die is locked.</li>
                        <li><strong>Roll again</strong> — you must lock ≥1 die every roll or <strong>Bust</strong> — or <strong>Stop</strong>.</li>
                    </ol>
                    <p>You may only work <strong>one Crew per turn</strong>, and only requirements without a token are available
                        — a row another player already completed is locked out for you until the card is fully cleared.</p>
                    <p><strong>Stop</strong> keeps every requirement you <em>completed</em> this turn (and earlier). <strong>Bust</strong>
                        — a roll where you can lock nothing — wipes <em>everything you placed this turn</em>, even completions
                        (Hazard tokens gained this turn are kept). Requirements completed on earlier turns always stay.</p>
                </div>

                <div className="mr-rules-sec">
                    <h3>Scoring Prestige</h3>
                    <p>Prestige is the score, earned two ways:</p>
                    <ol>
                        <li><strong>Requirements you complete.</strong> Each row&rsquo;s number is both its cost and its reward.
                            Payout is <strong>deferred</strong>: no Prestige is paid when a row is completed — instead, the moment a
                            Crew&rsquo;s <em>last</em> row is finished the whole card resolves and <strong>every</strong> contributor is
                            paid the number under their token. So a row you completed on an earlier turn still pays you even if someone
                            <em>else</em> finishes the card. A <strong>×2 Wild</strong> row pays double its number.</li>
                        <li><strong>Hazard tokens.</strong> Each token you keep is worth <strong>1 / 2 / 5</strong> Prestige — but only
                            if you are not the most-hazardous player at game end (see below).</li>
                    </ol>
                    <p className="mr-muted">Example: on the card above, completing the Shield&nbsp;4 row banks 4 Prestige, the
                        Damage&nbsp;3 row banks 3 (and draws a Hazard), and the ×2 Wild&nbsp;2 row banks 4.</p>
                </div>

                <div className="mr-rules-sec">
                    <h3>Recruiting Crew &amp; Factions</h3>
                    <p>When you complete a Crew&rsquo;s <strong>last</strong> open requirement you must Stop; the card resolves,
                        contributors are paid, and <strong>you recruit the Crew</strong> — take it in front of you and gain its ability.
                        A fresh card is drawn from the deck so the display stays full for the next player.</p>
                    <p><strong>Same faction stacks.</strong> Recruited Crew are grouped by faction. Only the <strong>top</strong> card of
                        each faction stack grants its ability, so you have at most one active ability per faction. When you recruit a
                        Crew of a faction you <em>already</em> hold, you <strong>choose which of them sits on top</strong> (its ability
                        becomes active), and you may return <strong>1 of your Hazard tokens</strong> to the bag, face down.</p>
                    <p><strong>Win.</strong> Recruiting your 5th distinct faction, or 3rd Crew of one faction, ends the game immediately.</p>
                </div>

                <div className="mr-rules-sec">
                    <h3>Hazards &amp; Final Scoring</h3>
                    <p>A kept Hazard token is secret, and carries both Prestige (1/2/5) and <strong>Hazard symbols</strong> (0/1/2).
                        At game end all tokens are revealed and each player&rsquo;s Hazard symbols are summed. The player(s) with the
                        <strong> most Hazard symbols</strong> score <strong>no</strong> Prestige from their tokens (a tie disqualifies all
                        tied players; in a 2-player game the leader is disqualified only if <strong>3+</strong> symbols ahead). Everyone
                        else adds their token Prestige. Highest total wins; ties break to <strong>fewest Hazard symbols</strong>.</p>
                </div>
            </div>
        );
    }
}

// ==========================================
// Crew card (custom flat panel with live token state)
// ==========================================
class CrewCardView extends React.Component<{
    dc: DisplayCard;
    cardIndex: number;
    playerIds: string[];
    playerNames: Record<string, string>;
    myId: string;
    // interactive
    chosen: boolean;
    committedReqIndex: number | null;
    committedProgress: number;
    canChoose: boolean;                // clicking the card chooses it
    committableReqIdx: number[];       // req indices that can be committed right now
    dicePool?: GameDie[] | null;           // current player's pool (for the dice-match pulse); null = no pulse
    onChoose?: () => void;
    onCommit?: (reqIndex: number) => void;
}, {}> {
    public render() {
        const { dc, playerIds, playerNames, myId } = this.props;
        const faction = dc.card.faction;
        const fc = FACTION_COLORS[faction];

        const reqRows = dc.card.requirements.map((req, i) => {
            const rs = dc.reqStates[i];
            const isCommittedHere = this.props.chosen && this.props.committedReqIndex === i;
            const progress = isCommittedHere ? this.props.committedProgress : (rs.status === 'COMPLETED' ? req.count : 0);
            const committable = this.props.committableReqIdx.includes(i);
            const diceGlow = rs.status === 'OPEN' && !!this.props.dicePool && poolCanFulfill(this.props.dicePool, req);
            const ownerColor = rs.owner ? playerColor(playerIds, rs.owner) : null;
            const ownerInitial = rs.owner ? (playerNames[rs.owner] || '?').charAt(0).toUpperCase() : '';

            const pips = [];
            for (let p = 0; p < req.count; p++) {
                pips.push(<span key={p} className={`mr-pip ${p < progress ? 'filled' : ''}`}
                    style={p < progress ? { background: SYMBOL_COLORS[req.type] } : {}} />);
            }

            return (
                <button
                    key={i}
                    type="button"
                    className={`mr-req status-${rs.status.toLowerCase()} ${isCommittedHere ? 'is-live' : ''} ${committable ? 'is-committable' : ''} ${diceGlow ? 'is-dice-glow' : ''}`}
                    disabled={!committable || !this.props.onCommit}
                    onClick={() => committable && this.props.onCommit && this.props.onCommit(i)}
                >
                    <span className="mr-req-sym"><Glyph iconId={symbolIconId(req.type)} size="20px" override={SYMBOL_COLORS[req.type]} /></span>
                    <span className="mr-req-count">{req.count}{req.type === 'WILD' && <em className="mr-x2">×2</em>}</span>
                    <span className="mr-pips">{pips}</span>
                    {req.hazard && <span className="mr-req-hz"><Glyph iconId="hazard_flag" size="16px" /></span>}
                    {rs.status !== 'OPEN' && ownerColor && (
                        <span className={`mr-token ${rs.status === 'COMPLETED' ? 'covered' : 'above'}`}
                            style={{ background: ownerColor }} title={playerNames[rs.owner!]}>{ownerInitial}</span>
                    )}
                </button>
            );
        });

        return (
            <div
                className={`mr-crew ${this.props.chosen ? 'is-chosen' : ''} ${this.props.canChoose ? 'is-choosable' : ''}`}
                onClick={() => this.props.canChoose && this.props.onChoose && this.props.onChoose()}
                style={this.props.chosen ? { boxShadow: `inset 0 0 0 3px ${fc}` } : {}}
            >
                <div className="mr-crew-head" style={{ background: fc }}>
                    <Glyph iconId={symbolIconId(faction)} size="20px" override="#ffffff" />
                    <span className="mr-crew-name">{dc.card.name}</span>
                    {dc.card.isStartingCrew && <span className="mr-starter"><Glyph iconId="starter" size="14px" override="#ffffff" /></span>}
                </div>
                <div className="mr-crew-reqs">{reqRows}</div>
                <div className="mr-crew-ability" title={dc.card.abilityText}>{abilityText(dc.card.abilityText)}</div>
            </div>
        );
    }
}

// ==========================================
// Main page
// ==========================================
interface MainState {
    abilityKeep: string | null;   // crew id chosen to sit on top of the stack
    hazardReturn: string | null;  // hazard token id to return (optional)
    armedAbilityId: string | null; // a select-dice ability being aimed
    armedLabel: string;
    armedSelectMax: number;
    armedSelectFace: DieSymbol | null;
    selectedDice: number[];       // die indices chosen for the armed ability
}

export class MoonrollersMainPage extends React.Component<MoonProps, MainState> {
    constructor(props: MoonProps) {
        super(props);
        this.state = {
            abilityKeep: null, hazardReturn: null,
            armedAbilityId: null, armedLabel: '', armedSelectMax: 1, armedSelectFace: null, selectedDice: []
        };
    }

    private transientTimer: ReturnType<typeof setTimeout> | null = null;

    // A pulled die that isn't kept (Wild/Extra) is shown rolling in the pool, then removed
    // ~1.5s later. Only the active player fires the dismissal (it clears the shared state).
    public componentDidUpdate() {
        const mine = this.isMyTurn();
        const hasTransient = mine && this.props.rollingPool.some(d => d.transient);
        if (hasTransient && !this.transientTimer) {
            this.transientTimer = setTimeout(() => {
                this.transientTimer = null;
                this.props.MP.dismissTransient();
            }, 1500);
        } else if (!hasTransient && this.transientTimer) {
            clearTimeout(this.transientTimer);
            this.transientTimer = null;
        }
    }

    public componentWillUnmount() {
        if (this.transientTimer) clearTimeout(this.transientTimer);
    }

    private armAbility(a: { id: string; label: string; selectMax?: number; selectFace?: DieSymbol }) {
        this.setState({
            armedAbilityId: a.id, armedLabel: a.label,
            armedSelectMax: a.selectMax || 1, armedSelectFace: a.selectFace || null, selectedDice: []
        });
    }
    private cancelArm() { this.setState({ armedAbilityId: null, selectedDice: [] }); }
    private toggleSelectDie(index: number) {
        const sel = this.state.selectedDice;
        if (sel.indexOf(index) !== -1) this.setState({ selectedDice: sel.filter(i => i !== index) });
        else if (sel.length < this.state.armedSelectMax) this.setState({ selectedDice: [...sel, index] });
    }
    // Armed only while its ability is still offered this roll.
    private armedActive(): boolean {
        return !!this.state.armedAbilityId
            && this.props.affordances.availableAbilities.some(a => a.id === this.state.armedAbilityId);
    }

    private isMyTurn(): boolean {
        return this.props.currentPlayerId === this.props.myId && this.props.status === GameStatus.Active;
    }

    private extrasPending(): number {
        const extras = this.props.rollingPool.filter(d => d.face === 'EXTRA').length;
        return Math.min(extras, this.props.supplyCount);
    }

    // Determine the action for a die in the tray.
    private dieAction(index: number): { state: 'idle' | 'lockable' | 'convert' | 'retag' | 'dim' | 'select' | 'selected'; badge?: string; act?: () => void } {
        const mp = this.props.MP;
        const aff = this.props.affordances;
        const mine = this.isMyTurn();
        if (!mine) return { state: 'idle' };

        // Armed ability: dice are being picked for it.
        if (this.armedActive()) {
            const die = this.props.rollingPool[index];
            const eligible = !this.state.armedSelectFace || die.face === this.state.armedSelectFace;
            if (!eligible) return { state: 'dim' };
            const selected = this.state.selectedDice.indexOf(index) !== -1;
            return { state: selected ? 'selected' : 'select', act: () => this.toggleSelectDie(index) };
        }

        if (this.props.step !== 'LOCKING') return { state: 'idle' };
        if (aff.directLockDice.includes(index)) {
            return { state: 'lockable', act: () => mp.lockDie(index) };
        }
        if (aff.extraConvert && aff.extraConvert.dieIndices.includes(index)) {
            return { state: 'convert', badge: `+${aff.extraConvert.count}`, act: () => mp.abilityExtraLock(index) };
        }
        const rt = aff.retagDice.find(r => r.dieIndex === index);
        if (rt) return { state: 'retag', badge: '◇', act: () => mp.abilityRetag(index) };
        return { state: 'dim' };
    }

    private renderAbilityBar() {
        const mp = this.props.MP;
        if (!this.isMyTurn()) return null;
        const abilities = this.props.affordances.availableAbilities;
        const armed = this.armedActive();

        if (armed) {
            const need = this.state.armedSelectMax;
            const faceHint = this.state.armedSelectFace ? `${symbolName(this.state.armedSelectFace)} ` : '';
            const n = this.state.selectedDice.length;
            return (
                <div className="mr-ability-bar armed">
                    <span className="mr-ability-armed-label">{this.state.armedLabel}: pick up to {need} {faceHint}die{need > 1 ? 's' : ''}{n > 0 ? ` (${n} chosen)` : ''}</span>
                    <button className="mr-btn tiny primary" disabled={n < 1}
                        onClick={() => { mp.useAbility(this.state.armedAbilityId, this.state.selectedDice); this.setState({ armedAbilityId: null, selectedDice: [] }); }}>
                        Use
                    </button>
                    <button className="mr-btn tiny" onClick={() => this.cancelArm()}>Cancel</button>
                </div>
            );
        }
        if (abilities.length === 0) return null;
        return (
            <div className="mr-ability-bar">
                <span className="mr-ability-bar-label">Abilities</span>
                {abilities.map(a => (
                    <button key={a.id} className="mr-btn tiny ability"
                        onClick={() => a.trigger === 'instant' ? mp.useAbility(a.id) : this.armAbility(a)}>
                        {a.label}
                    </button>
                ))}
            </div>
        );
    }

    private renderDiceTray() {
        const { rollingPool, step } = this.props;
        const mine = this.isMyTurn();
        const armed = this.armedActive();
        return (
            <div className="mr-tray">
                <div className="mr-tray-head">
                    <span className="mr-tray-label">Rolling Pool</span>
                    <span className="mr-tray-meta">Supply {this.props.supplyCount} · Locked {this.props.lockedCount}</span>
                </div>
                <DicePool
                    className="mr-dice"
                    dice={rollingPool.map(d => ({ id: d.id, faceId: d.face }))}
                    faceset={MOON_DICE_FACES}
                    theme={MOON_DICE_THEME}
                    animation={{ mode: 'in-place', duration: 650, stagger: 55 }}
                    rollNonce={this.props.rollId}
                    emptyContent={<span className="mr-muted">No dice in the pool.</span>}
                    renderDie={(datum, dieProps, i) => {
                        const transient = !!this.props.rollingPool[i]?.transient;
                        const a = transient ? { state: 'dim' as const, act: undefined, badge: undefined } : this.dieAction(i);
                        return (
                            <Die {...dieProps}
                                className={`mr-die state-${a.state} ${a.act ? 'is-actionable' : ''} ${transient ? 'is-transient' : ''}`}
                                onClick={a.act}
                                title={transient ? 'Returning to supply…' : symbolName(datum.faceId as DieSymbol)}>
                                {a.badge && <span className="mr-die-badge">{a.badge}</span>}
                            </Die>
                        );
                    }}
                />
                {this.props.bustSafeThisRoll && this.props.lockedThisRoll === 0 && (
                    <p className="mr-hint">Safe from busting this roll — you may Stop or Roll Again.</p>
                )}
                {this.renderAbilityBar()}
                {mine && !armed && step === 'LOCKING' && (
                    <p className="mr-hint">Tap a highlighted die to lock it onto your requirement.
                        {this.props.affordances.retagDice.length > 0 && ' A ◇ die can lock as a Wild.'}
                        {this.props.affordances.extraConvert && ' An Extra Die can convert.'}
                        {this.props.committedProgress === 0 && ' You can still tap another requirement — or Crew — to change your mind.'}
                    </p>
                )}
                {mine && !armed && (step === 'CHOOSE') && <p className="mr-hint">Choose a Crew card above to work on this turn.</p>}
                {mine && !armed && (step === 'COMMIT') && <p className="mr-hint">Commit to an open requirement — or tap another Crew to switch. Nothing is locked in until you lock a die.</p>}
            </div>
        );
    }

    private renderActionBar() {
        const mp = this.props.MP;
        const { step, lockedThisRoll, affordances } = this.props;
        if (!this.isMyTurn() || this.armedActive()) return null;

        const canRollStop = ((step === 'LOCKING' && (lockedThisRoll >= 1 || this.props.bustSafeThisRoll)) || step === 'DECIDE');
        const pend = this.extrasPending();
        // An empty rolling pool has nothing to re-roll — only Stop is meaningful.
        const poolEmpty = this.props.rollingPool.length === 0;
        return (
            <div className="mr-actions">
                {affordances.canRerollAll && (
                    <button className="mr-btn ghost" onClick={() => mp.abilityRerollAll()}>Salatar: Re-roll All</button>
                )}
                {!poolEmpty && (
                    <button className="mr-btn primary" disabled={!canRollStop} onClick={() => mp.rollAgain()}>
                        Roll Again{pend > 0 ? ` (+${pend})` : ''}
                    </button>
                )}
                <button className="mr-btn" disabled={!canRollStop} onClick={() => mp.stop()}>Stop</button>
                {poolEmpty && canRollStop && <span className="mr-action-note">No dice left — Stop to bank your progress.</span>}
            </div>
        );
    }

    private renderHazardModal() {
        const mp = this.props.MP;
        if (this.props.step !== 'HAZARD' || !this.isMyTurn() || this.props.pendingHazards.length < 2) return null;
        return (
            <div className="mr-modal-backdrop">
                <div className="mr-modal">
                    <h3>Hazard Draw — keep one</h3>
                    <p className="mr-muted">The other returns to the bag, face down. Kept tokens stay secret.</p>
                    <div className="mr-haz-choices">
                        {this.props.pendingHazards.map((t, i) => (
                            <button key={t.id} className="mr-haz-card" onClick={() => mp.keepHazard(i)}>
                                <div className="mr-haz-prestige"><Glyph iconId="prestige" size="30px" /> <strong>{t.prestige}</strong></div>
                                <div className="mr-haz-symbols">
                                    {t.hazards === 0 ? <span className="mr-muted">no hazard</span> :
                                        Array.from({ length: t.hazards }).map((_, k) => <Glyph key={k} iconId="hazard" size="24px" />)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    private renderAbilityChoiceModal() {
        const mp = this.props.MP;
        const { step, pendingAbilityFaction, publicPlayers, myId, myHazardTokens } = this.props;
        if (step !== 'CHOOSE_ABILITY' || !this.isMyTurn() || !pendingAbilityFaction) return null;
        const me = publicPlayers.find(p => p.id === myId);
        if (!me) return null;
        const candidates = me.hired.filter(c => c.faction === pendingAbilityFaction);
        // Default the selection to the crew just recruited (the last of that faction).
        const keep = this.state.abilityKeep || (candidates.length ? candidates[candidates.length - 1].id : null);
        return (
            <div className="mr-modal-backdrop">
                <div className="mr-modal">
                    <h3>{factionName(pendingAbilityFaction)} Stack</h3>
                    <p className="mr-muted">You now hold two {factionName(pendingAbilityFaction)} Crew. Choose which one sits
                        on top — only the top card&rsquo;s ability is active.</p>
                    <div className="mr-ability-choices">
                        {candidates.map(c => (
                            <button key={c.id} type="button"
                                className={`mr-ability-choice ${keep === c.id ? 'is-sel' : ''}`}
                                onClick={() => this.setState({ abilityKeep: c.id })}>
                                <span className="mr-hired-chip" style={{ background: FACTION_COLORS[c.faction] }}>
                                    <Glyph iconId={symbolIconId(c.faction)} size="14px" override="#ffffff" />{c.name}
                                </span>
                                <span className="mr-choice-text">{abilityText(c.abilityText)}</span>
                            </button>
                        ))}
                    </div>
                    {myHazardTokens.length > 0 && (
                        <div className="mr-haz-return">
                            <span className="mr-group-label">Optionally return 1 Hazard token</span>
                            <div className="mr-haz-return-row">
                                <button type="button" className={`mr-btn tiny ${!this.state.hazardReturn ? 'is-sel' : ''}`}
                                    onClick={() => this.setState({ hazardReturn: null })}>Keep all</button>
                                {myHazardTokens.map(t => (
                                    <button key={t.id} type="button"
                                        className={`mr-btn tiny ${this.state.hazardReturn === t.id ? 'is-sel' : ''}`}
                                        onClick={() => this.setState({ hazardReturn: t.id })}>
                                        <Glyph iconId="prestige" size="13px" /> {t.prestige} · <Glyph iconId="hazard" size="13px" /> {t.hazards}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <button className="mr-btn primary" disabled={!keep}
                        onClick={() => { mp.resolveDuplicate(keep, this.state.hazardReturn); this.setState({ abilityKeep: null, hazardReturn: null }); }}>
                        Confirm
                    </button>
                </div>
            </div>
        );
    }

    private renderMyPanel() {
        const { publicPlayers, myId, myHazardTokens, myAbilities, playerIds } = this.props;
        const me = publicPlayers.find(p => p.id === myId);
        if (!me) return null;
        const totalHazSym = myHazardTokens.reduce((s, t) => s + t.hazards, 0);
        const tokenPrestige = myHazardTokens.reduce((s, t) => s + t.prestige, 0);
        return (
            <div className={`mr-panel ${this.isMyTurn() ? 'is-active' : ''}`} style={{ borderColor: playerColor(playerIds, myId) }}>
                <div className="mr-panel-head">
                    <span className="mr-dot" style={{ background: playerColor(playerIds, myId) }} />
                    <span className="mr-panel-name">{me.name} (You)</span>
                    {this.isMyTurn() && <span className="mr-turn-tag">Your Turn</span>}
                    <span className="mr-panel-prestige"><Glyph iconId="prestige" size="20px" /> {me.prestige}</span>
                </div>
                <FactionRow counts={me.factionCounts} />
                <div className="mr-crew-chips">
                    <span className="mr-group-label">Your Crew ({me.hired.length})</span>
                    <div className="mr-chips-row">
                        {me.hired.length === 0 ? <span className="mr-muted">none hired yet</span>
                            : me.hired.map(c => <CrewChip key={c.id} crew={c} />)}
                    </div>
                </div>
                {myAbilities.length > 0 && (
                    <div className="mr-abilities">
                        <span className="mr-group-label">Active Abilities</span>
                        {myAbilities.map(a => {
                            const triggered = TRIGGERED_KINDS.indexOf(a.kind) !== -1;
                            return (
                                <div key={a.id} className={`mr-ability ${triggered ? 'is-triggered' : 'is-passive'}`}>
                                    <span className="mr-ability-icon">
                                        <Glyph iconId={symbolIconId(a.faction)} size="18px" override={FACTION_COLORS[a.faction]} />
                                    </span>
                                    <span className="mr-ability-text">{abilityText(a.text)}</span>
                                    <span className={`mr-ability-tag ${triggered ? 'triggered' : 'passive'}`}
                                        title={triggered ? 'A button appears in the dice tray when you can use it.' : 'Applied automatically.'}>
                                        {triggered ? 'Tap to use' : 'Passive'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="mr-haz-drawer">
                    <span className="mr-group-label">Your Hazards ({myHazardTokens.length})</span>
                    {myHazardTokens.length === 0 ? <span className="mr-muted">none</span> : (
                        <span className="mr-haz-summary">
                            <Glyph iconId="prestige" size="16px" /> {tokenPrestige}
                            <span className="mr-haz-sep">·</span>
                            <Glyph iconId="hazard" size="16px" /> {totalHazSym}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    private renderOpponents() {
        const { publicPlayers, myId, currentPlayerId, playerIds } = this.props;
        const others = publicPlayers.filter(p => p.id !== myId);
        return (
            <div className="mr-opponents">
                {others.map(p => (
                    <div key={p.id} className={`mr-opp ${p.id === currentPlayerId && this.props.status === GameStatus.Active ? 'is-active' : ''}`}>
                        <div className="mr-opp-head">
                            <span className="mr-dot" style={{ background: playerColor(playerIds, p.id) }} />
                            <span className="mr-opp-name">{p.name}</span>
                            <span className="mr-opp-prestige"><Glyph iconId="prestige" size="16px" /> {p.prestige}</span>
                        </div>
                        <FactionRow counts={p.factionCounts} small />
                        <span className="mr-opp-haz"><Glyph iconId="hazard" size="14px" /> {p.hazardCount} kept</span>
                    </div>
                ))}
            </div>
        );
    }

    private renderGameOver() {
        const mp = this.props.MP;
        const { winnerIds, finalScores, playerNames, myId } = this.props;
        if (this.props.status !== GameStatus.GameOver || !finalScores) return null;
        const iWon = !!(winnerIds && winnerIds.includes(myId));
        return (
            <div className={`mr-gameover ${iWon ? 'victory' : ''}`}>
                <div className="mr-go-title">{iWon ? 'Victory!' : 'Mission Complete'}</div>
                <div className="mr-go-sub">
                    {winnerIds && winnerIds.length === 1 ? `${playerNames[winnerIds[0]]} wins!`
                        : winnerIds ? `Shared victory: ${winnerIds.map(w => playerNames[w]).join(' & ')}` : ''}
                </div>
                <table className="mr-score-table">
                    <thead><tr><th>Player</th><th>Track</th><th>Tokens</th><th><Glyph iconId="hazard" size="14px" /></th><th>Total</th></tr></thead>
                    <tbody>
                        {finalScores.slice().sort((a, b) => b.total - a.total).map(r => (
                            <tr key={r.playerId} className={winnerIds && winnerIds.includes(r.playerId) ? 'is-winner' : ''}>
                                <td>{playerNames[r.playerId]}</td>
                                <td>{r.trackPrestige}</td>
                                <td className={r.disqualified ? 'is-dq' : ''}>{r.disqualified ? `(${r.tokenPrestige})` : r.tokenPrestige}</td>
                                <td>{r.hazardSymbols}</td>
                                <td><strong>{r.total}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {finalScores.some(r => r.disqualified) && (
                    <p className="mr-muted mr-dq-note">Most-Hazard players (in parentheses) scored no token Prestige.</p>
                )}
                {this.props.isHost && (
                    <div className="mr-go-actions">
                        <button className="mr-btn primary" onClick={() => mp.restartGame()}>Play Again</button>
                        <button className="mr-btn" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )}
            </div>
        );
    }

    private toast() {
        const { lastMove, playerNames, myId } = this.props;
        if (!lastMove) return null;
        const actor = playerNames[lastMove.playerId] || 'Player';
        let sound = null;
        switch (lastMove.kind) {
            case 'roll': case 'start': sound = DiceRollSound; break;
            case 'hire': sound = CoinManySound; break;
            case 'complete': case 'hazard': sound = CoinFewSound; break;
            case 'lock': case 'commit': case 'choose': case 'ability': sound = MicrowaveBellSound; break;
            case 'bust': sound = ScratchSound; break;
            default: sound = null;
        }
        return {
            id: lastMove.moveId,
            message: `${actor} ${lastMove.desc}`,
            bgColor: lastMove.playerId === myId ? '#2b90b3' : INK,
            duration: 3200,
            sound
        };
    }

    public render() {
        const mp = this.props.MP;
        const { display, step, affordances } = this.props;
        const mine = this.isMyTurn();
        const gameOver = this.props.status === GameStatus.GameOver;

        // Card / requirement selection stays reversible until the first die is locked.
        const canReselectCard = mine && !gameOver && step !== 'HAZARD' && this.props.lockedCount === 0;
        const canPickReq = mine && (step === 'COMMIT' || (step === 'LOCKING' && this.props.committedProgress === 0));

        const committableByCard: Record<number, number[]> = {};
        affordances.committable.forEach(c => {
            (committableByCard[c.cardIndex] = committableByCard[c.cardIndex] || []).push(c.reqIndex);
        });
        const choosableCards = new Set(canReselectCard ? affordances.committable.map(c => c.cardIndex) : []);

        const arena = (
            <div className="moonrollers-game">
                {this.renderGameOver()}
                {this.renderHazardModal()}
                {this.renderAbilityChoiceModal()}

                {!gameOver && (
                    <div className="mr-turn-banner">
                        {mine ? <span className="mr-you-turn">Your turn — {this.stepHint()}</span>
                            : <span>{this.props.playerNames[this.props.currentPlayerId]} is rolling…</span>}
                        <span className="mr-deck">Deck {this.props.deckSize}</span>
                    </div>
                )}

                <div className="mr-display">
                    {display.map((dc, i) => (
                        <CrewCardView
                            key={dc.card.id + '_' + i}
                            dc={dc}
                            cardIndex={i}
                            playerIds={this.props.playerIds}
                            playerNames={this.props.playerNames}
                            myId={this.props.myId}
                            chosen={this.props.chosenCardIndex === i}
                            committedReqIndex={this.props.committedReqIndex}
                            committedProgress={this.props.committedProgress}
                            canChoose={choosableCards.has(i) && this.props.chosenCardIndex !== i}
                            committableReqIdx={(this.props.chosenCardIndex === i && canPickReq) ? (committableByCard[i] || []) : []}
                            dicePool={(mine && this.props.committedReqIndex === null) ? this.props.rollingPool : null}
                            onChoose={() => mp.chooseCard(i)}
                            onCommit={(r) => mp.commit(r)}
                        />
                    ))}
                </div>

                {!gameOver && this.renderDiceTray()}
                {!gameOver && this.renderActionBar()}
                {this.renderMyPanel()}
                {this.renderOpponents()}
            </div>
        );

        const links: any = {
            'home': { 'icon': 'gamepad', 'label': 'Arena', 'view': arena },
            'roster': {
                'icon': 'address-card', 'label': 'Roster',
                'view': <RosterView publicPlayers={this.props.publicPlayers} playerIds={this.props.playerIds} myId={this.props.myId} />
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <MoonrollersRulesView /> }
        };
        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Admin',
                'view': (
                    <div className="mr-admin">
                        <h3>Game Settings</h3>
                        <button className="mr-btn primary" onClick={() => mp.restartGame()}>Restart Game</button>
                        <button className="mr-btn" onClick={() => mp.backToLobby()}>Back to Lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Moonrollers',
            'topBarContent': gameOver ? 'Game Over' : (mine ? 'Your Turn' : 'Waiting'),
            'roomClassName': mine ? 'attention-bg' : '',
            'toastNotification': this.toast()
        });
    }

    private stepHint(): string {
        switch (this.props.step) {
            case 'CHOOSE': return 'choose a Crew';
            case 'COMMIT': return 'commit to a requirement';
            case 'LOCKING': return 'lock dice, then roll or stop';
            case 'DECIDE': return 'roll again or stop';
            case 'HAZARD': return 'resolve your Hazard draw';
            default: return '';
        }
    }
}

// ==========================================
// Faction progress row (win condition tracker)
// ==========================================
function FactionRow(props: { counts: Record<string, number>; small?: boolean }) {
    const factions: Faction[] = ['REACTOR', 'SHIELD', 'DAMAGE', 'THRUSTER', 'WILD'];
    const sz = props.small ? '15px' : '18px';
    return (
        <div className={`mr-faction-row ${props.small ? 'small' : ''}`}>
            {factions.map(f => {
                const n = props.counts[f] || 0;
                return (
                    <span key={f} className={`mr-fac ${n > 0 ? 'has' : ''} ${n >= 3 ? 'trio' : ''}`} title={`${factionName(f)}: ${n}`}>
                        <Glyph iconId={symbolIconId(f)} size={sz} override={n > 0 ? FACTION_COLORS[f] : '#c9c9c9'} />
                        {n > 0 && <span className="mr-fac-n" style={{ color: FACTION_COLORS[f] }}>{n}</span>}
                    </span>
                );
            })}
        </div>
    );
}

// ==========================================
// Roster (all players' hired crew)
// ==========================================
class RosterView extends React.Component<{ publicPlayers: PublicPlayer[]; playerIds: string[]; myId: string }, {}> {
    public render() {
        return (
            <div className="mr-roster">
                {this.props.publicPlayers.map(p => (
                    <div key={p.id} className="mr-roster-player" style={{ borderColor: playerColor(this.props.playerIds, p.id) }}>
                        <div className="mr-roster-head">
                            <span className="mr-dot" style={{ background: playerColor(this.props.playerIds, p.id) }} />
                            <span className="mr-roster-name">{p.name}{p.id === this.props.myId ? ' (You)' : ''}</span>
                            <span className="mr-opp-prestige"><Glyph iconId="prestige" size="16px" /> {p.prestige}</span>
                        </div>
                        <FactionRow counts={p.factionCounts} />
                        <div className="mr-roster-crew">
                            {p.hired.length === 0 ? <span className="mr-muted">No crew hired yet.</span> :
                                p.hired.map(c => <CrewChip key={c.id} crew={c} />)}
                        </div>
                    </div>
                ))}
            </div>
        );
    }
}
