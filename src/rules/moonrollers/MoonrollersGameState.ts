/**
 * MoonrollersGameState.ts - Standalone game engine for Moonrollers (2-5 players).
 *
 * A push-your-luck dice game. On your turn you roll dice, pick ONE Crew card from the
 * shared display, and try to fulfil its requirements by locking matching dice.
 * Completing a requirement banks Prestige for its owner; completing the LAST open
 * requirement HIRES the Crew for whoever finished it. The game ends the instant a
 * player has hired 1 Crew of each Faction (5) OR 3 Crew of the same Faction (also if
 * the deck runs out), then Hazard tokens resolve and highest Prestige wins.
 *
 * Pure, frame-independent state machine (no React / Multiplayr / socket deps) per the
 * decoupled GameState architecture. Serializable via get_data / from_data.
 *
 * NOTE ON DATA FIDELITY: the physical rulebook does not print a per-card faction /
 * requirement table, so the 30-card deck below follows the internally-consistent
 * 5-factions-of-6 reconstruction documented in the spec (§11). Grids use the
 * archetype shapes; ability *text* is verbatim from the appendix. A curated set of
 * abilities is mechanically active (see ABILITIES); the rest are shown as reference
 * text only in this first version.
 */

// ==========================================
// Core types
// ==========================================
export type DieSymbol = 'DAMAGE' | 'REACTOR' | 'THRUSTER' | 'SHIELD' | 'WILD' | 'EXTRA';
export type ReqType = 'DAMAGE' | 'REACTOR' | 'THRUSTER' | 'SHIELD' | 'WILD';
export type Faction = 'REACTOR' | 'SHIELD' | 'DAMAGE' | 'THRUSTER' | 'WILD';

export const DIE_FACES: DieSymbol[] = ['DAMAGE', 'REACTOR', 'THRUSTER', 'SHIELD', 'WILD', 'EXTRA'];
export const REQ_TYPES: ReqType[] = ['DAMAGE', 'REACTOR', 'THRUSTER', 'SHIELD', 'WILD'];
export const FACTIONS: Faction[] = ['REACTOR', 'SHIELD', 'DAMAGE', 'THRUSTER', 'WILD'];

export interface Die {
    id: string;
    face: DieSymbol;
    asWild?: boolean;   // pseudo-wild (retagged / converted) — locks to NORMAL reqs only, never a WILD-type req
    saved?: boolean;    // Meg Gallak: preserved (not re-rolled) on exactly the next re-roll
    transient?: boolean;// a pulled die shown rolling in the pool but destined to return to supply (never lockable)
}

export interface Requirement {
    index: number;
    type: ReqType;    // WILD ⇒ needs actual Wild faces, pays 2×
    count: number;    // dice needed AND base prestige
    hazard: boolean;  // draw-2-keep-1 on completion
}

export interface CrewCard {
    id: string;
    name: string;
    faction: Faction;
    isStartingCrew: boolean;
    requirements: Requirement[];
    abilityId: string;
    abilityText: string;
}

export type ReqStatus = 'OPEN' | 'COMMITTED' | 'COMPLETED';

export interface RequirementState {
    status: ReqStatus;
    owner: string | null;      // token owner while COMMITTED / COMPLETED
    placedThisTurn: boolean;   // for Bust vs Stop resolution
}

export interface DisplayCard {
    card: CrewCard;
    reqStates: RequirementState[];
}

export interface HazardToken {
    id: string;
    prestige: 1 | 2 | 5;
    hazards: 0 | 1 | 2;
}

export interface PlayerState {
    id: string;
    prestige: number;              // the Prestige track (banked from completed requirements)
    hired: CrewCard[];             // crew hired, in hire order
    activeByFaction: Record<string, string>; // faction → id of the crew on TOP of the stack (grants its ability)
    hazardTokens: HazardToken[];   // PRIVATE
}

export interface LastMove {
    playerId: string;
    desc: string;
    moveId: number;
    kind: 'start' | 'choose' | 'commit' | 'lock' | 'complete' | 'hazard' | 'hire'
        | 'stop' | 'bust' | 'roll' | 'ability';
    cardName?: string;
    faction?: Faction;
}

export enum GameStatus {
    Lobby = 'Lobby',
    Active = 'Active',
    GameOver = 'GameOver'
}

// Fine-grained sub-phase of the active player's turn.
export type TurnStep =
    | 'CHOOSE'   // dice rolled; must pick a display card
    | 'COMMIT'   // card chosen; uncommitted; must commit to an OPEN requirement (& lock >=1)
    | 'LOCKING'  // committed to an incomplete requirement; may lock more / roll / stop
    | 'DECIDE'   // just completed a (non-last) requirement; may roll again or stop
    | 'HAZARD'   // resolving a 2-keep-1 Hazard draw
    | 'CHOOSE_ABILITY' // recruited a duplicate faction; pick which crew's ability is on top
    | 'MUST_STOP'; // completed the card's last requirement; only Stop (→ resolve) remains

export interface FinalScoreRow {
    playerId: string;
    trackPrestige: number;
    tokenPrestige: number;
    hazardSymbols: number;
    disqualified: boolean;
    total: number;
}

export interface GameStateData {
    status: GameStatus;
    playerIds: string[];
    firstPlayerId: string;
    currentPlayerId: string;

    deck: CrewCard[];
    display: DisplayCard[];
    hazardBag: HazardToken[];

    players: Record<string, PlayerState>;

    // Active turn state
    step: TurnStep;
    chosenCardIndex: number | null;
    committedReqIndex: number | null;
    committedProgress: number;   // progress toward the committed requirement's count
    lockedThisRoll: number;      // dice locked (or a completion) since the last roll
    rolledOnce: boolean;         // has the pool been re-rolled at least once this turn (gates first-roll abilities)
    rollingPool: Die[];
    supplyCount: number;
    lockedCount: number;         // physical dice locked this turn
    pendingHazards: HazardToken[]; // the 2 drawn tokens awaiting a keep-1 choice
    hazardsGainedThisTurn: number;
    pendingAbilityFaction: Faction | null; // faction whose stack ordering awaits a choice
    bustSafeThisRoll: boolean;     // this roll cannot bust (Moro Mada / At-0k carry / B3-AR)
    bustSafeNextRoll: boolean;     // At-0k: next roll cannot bust
    bonusDiceNextRoll: number;     // Avari: extra supply dice to pull on the next re-roll
    abilitiesUsedThisRoll: string[]; // triggered ability ids already used since the last roll

    endTriggered: boolean;
    winnerIds: string[] | null;
    finalScores: FinalScoreRow[] | null;
    lastMove: LastMove | null;
    moveCounter: number;
    dieCounter: number;          // for unique die ids
    rollId: number;              // monotonic; bumps on every full pool roll (drives roll animations)
}

// ==========================================
// Abilities
// ==========================================
export type AbilityKind =
    | 'passive_dice'         // rolling pool starts with a larger size (Kal Damar)
    | 'passive_bust'         // gain prestige after busting (Namari)
    | 'first_roll_reroll'    // before locking on the first roll, may re-roll all dice (Salatar)
    | 'retag_wild'           // roll exactly 1 of `retagType` ⇒ that die may lock as a Wild
    | 'extra_convert'        // an EXTRA die may lock as `extraCount` of `extraType`
    // --- automatic passives ---
    | 'pool_doubler'         // pool ≤3: a locked Wild/`doubleType` counts double (Aponi/Umbrage/Sol Forst/[Redacted])
    | 'safe_small_extra'     // pool ≤3 with an Extra ⇒ safe from busting (Moro Mada)
    | 'safe_shields'         // roll ≥2 Shields ⇒ safe from busting next roll (At-0k)
    // --- triggered (instant) ---
    | 'pull_supply'          // roll `pullCount` supply dice, add faces in `pullKeep` (Saghari/Ryan Rogal)
    | 'draw_hazard'          // draw & keep 1 Hazard token (Imdar Shade)
    | 'wild_to_extra'        // convert the lone Wild to Extra (FT-1000)
    | 'complete_committed'   // instantly complete the committed requirement (B3-AR)
    | 'bonus_next_roll'      // +3 supply dice on the next re-roll (Avari)
    // --- triggered (select dice) ---
    | 'reroll_select'        // re-roll chosen dice (Lila re-roll any / Vila Noir ≤2)
    | 'convert_extra_select' // convert chosen dice to Extra (Kary Damage→Extra / Myla any→Extra)
    | 'retag_select'         // one chosen die locks as a Wild (Vanta Sae)
    | 'save_wild'            // save a chosen Wild through the next re-roll (Meg Gallak)
    | 'reference';           // (unused) shown as text only

// Predicate over the current roll gating a triggered ability.
export type AbilityCond =
    | 'none_damage' | 'ge2_damage' | 'none_shield' | 'ge2_reactor' | 'none_reactor'
    | 'first_damage' | 'ge2_thruster' | 'none_extra' | 'one_wild' | 'first_wild'
    | 'ge3_thruster' | 'all_wild';

export interface AbilityDef {
    id: string;
    faction: Faction;
    text: string;
    kind: AbilityKind;
    label?: string;           // short UI button label for triggered abilities
    diceCount?: number;       // passive_dice
    bustPrestige?: number;    // passive_bust
    retagType?: ReqType;      // retag_wild
    extraType?: ReqType;      // extra_convert (WILD ⇒ Sella: 1 wild into any normal req)
    extraCount?: number;      // extra_convert
    doubleType?: ReqType;     // pool_doubler
    cond?: AbilityCond;       // triggered predicate
    pullCount?: number;       // pull_supply
    pullKeep?: DieSymbol[];   // pull_supply — faces kept in the pool
    selectMax?: number;       // reroll_select / convert_extra_select / retag_select / save_wild
    selectFace?: DieSymbol;   // restrict selectable dice to this face (undefined = any)
}

// Which triggered abilities need dice selection vs. fire instantly (drives the UI).
export const INSTANT_KINDS: AbilityKind[] = ['pull_supply', 'draw_hazard', 'wild_to_extra', 'complete_committed', 'bonus_next_roll'];
export const SELECT_KINDS: AbilityKind[] = ['reroll_select', 'convert_extra_select', 'retag_select', 'save_wild'];

export const ABILITIES: Record<string, AbilityDef> = {
    // --- Reactor ---
    ada_massa: { id: 'ada_massa', faction: 'REACTOR', kind: 'extra_convert', extraType: 'REACTOR', extraCount: 2, text: 'Each Extra Die may lock as 2 Reactors; locked this way it adds no die on the re-roll.' },
    aponi: { id: 'aponi', faction: 'REACTOR', kind: 'pool_doubler', doubleType: 'REACTOR', text: 'If the rolling pool has 1–3 dice, each locked Wild/Reactor counts as 2 Reactors.' },
    lee_van_cribb: { id: 'lee_van_cribb', faction: 'REACTOR', kind: 'retag_wild', retagType: 'REACTOR', text: 'Roll exactly 1 Reactor ⇒ you may lock it as a Wild.' },
    lila_al_bindar: { id: 'lila_al_bindar', faction: 'REACTOR', kind: 'reroll_select', cond: 'ge2_reactor', selectMax: 12, label: 'Lila: re-roll dice', text: 'Roll 2+ Reactors ⇒ you may re-roll any dice in the pool (including the Reactors).' },
    salatar: { id: 'salatar', faction: 'REACTOR', kind: 'first_roll_reroll', text: 'Before locking or using abilities on your first roll, you may re-roll all pool dice.' },
    vila_noir: { id: 'vila_noir', faction: 'REACTOR', kind: 'reroll_select', cond: 'none_reactor', selectMax: 2, label: 'Vila Noir: re-roll ≤2', text: 'Roll no Reactors ⇒ you may re-roll 2 pool dice.' },

    // --- Shield ---
    ryle_al_wren: { id: 'ryle_al_wren', faction: 'SHIELD', kind: 'extra_convert', extraType: 'SHIELD', extraCount: 2, text: 'Each Extra Die may lock as 2 Shields; locked this way it adds no die on the re-roll.' },
    redacted: { id: 'redacted', faction: 'SHIELD', kind: 'pool_doubler', doubleType: 'SHIELD', text: 'If the rolling pool has 1–3 dice, each locked Wild/Shield counts as 2 Shields.' },
    bill_bendo: { id: 'bill_bendo', faction: 'SHIELD', kind: 'retag_wild', retagType: 'SHIELD', text: 'Roll exactly 1 Shield ⇒ that Shield may lock as a Wild.' },
    imdar_shade: { id: 'imdar_shade', faction: 'SHIELD', kind: 'draw_hazard', cond: 'none_shield', label: 'Imdar Shade: draw a Hazard', text: 'Roll no Shields ⇒ you may draw 1 Hazard token.' },
    at_0k: { id: 'at_0k', faction: 'SHIELD', kind: 'safe_shields', text: 'Roll 2+ Shields and don’t bust ⇒ you are safe from busting next roll.' },
    namari: { id: 'namari', faction: 'SHIELD', kind: 'passive_bust', bustPrestige: 2, text: 'Gain 2 Prestige after you bust.' },

    // --- Damage ---
    dana_powalki: { id: 'dana_powalki', faction: 'DAMAGE', kind: 'extra_convert', extraType: 'DAMAGE', extraCount: 2, text: 'Each Extra Die may lock as 2 Damage; locked this way it adds no die on the re-roll.' },
    dr_umbrage: { id: 'dr_umbrage', faction: 'DAMAGE', kind: 'pool_doubler', doubleType: 'DAMAGE', text: 'If the pool has 1–3 dice, each locked Wild/Damage counts as 2 Damage.' },
    tantin_al_vale: { id: 'tantin_al_vale', faction: 'DAMAGE', kind: 'retag_wild', retagType: 'DAMAGE', text: 'Roll exactly 1 Damage ⇒ you may lock it as a Wild.' },
    saghari: { id: 'saghari', faction: 'DAMAGE', kind: 'pull_supply', cond: 'none_damage', pullCount: 1, pullKeep: ['WILD', 'EXTRA'], label: 'Saghari: pull a die', text: 'Roll no Damage ⇒ roll 1 supply die, add any Wild/Extra to the pool.' },
    ryan_rogal: { id: 'ryan_rogal', faction: 'DAMAGE', kind: 'pull_supply', cond: 'ge2_damage', pullCount: 2, pullKeep: ['WILD'], label: 'Ryan Rogal: pull 2 dice', text: 'Roll 2+ Damage ⇒ roll 2 supply dice, add any Wilds to the pool.' },
    kary_powalk: { id: 'kary_powalk', faction: 'DAMAGE', kind: 'convert_extra_select', cond: 'first_damage', selectFace: 'DAMAGE', selectMax: 12, label: 'Kary: Damage → Extra', text: 'Any Damage on your first roll may be treated as an Extra Die.' },

    // --- Thruster ---
    nella_van_daval: { id: 'nella_van_daval', faction: 'THRUSTER', kind: 'extra_convert', extraType: 'THRUSTER', extraCount: 2, text: 'Each Extra Die may lock as 2 Thrusters; locked this way it adds no die on the re-roll.' },
    sol_forst: { id: 'sol_forst', faction: 'THRUSTER', kind: 'pool_doubler', doubleType: 'THRUSTER', text: 'If the pool has 1–3 dice, each locked Wild/Thruster counts as 2 Thrusters.' },
    zek_zarag: { id: 'zek_zarag', faction: 'THRUSTER', kind: 'retag_wild', retagType: 'THRUSTER', text: 'Roll exactly 1 Thruster ⇒ you may lock it as a Wild.' },
    myla_dystra: { id: 'myla_dystra', faction: 'THRUSTER', kind: 'convert_extra_select', cond: 'ge2_thruster', selectMax: 1, label: 'Myla: a die → Extra', text: 'Roll 2+ Thrusters ⇒ any die may be treated as an Extra Die (it can’t be locked).' },
    b3_ar: { id: 'b3_ar', faction: 'THRUSTER', kind: 'complete_committed', cond: 'ge3_thruster', label: 'B3-AR: complete requirement', text: 'Roll 3+ Thrusters ⇒ complete your committed requirement. No bust that roll.' },
    kal_damar: { id: 'kal_damar', faction: 'THRUSTER', kind: 'passive_dice', diceCount: 6, text: 'Your rolling pool starts with 6 dice.' },

    // --- Wild ---
    sella_pelleon: { id: 'sella_pelleon', faction: 'WILD', kind: 'extra_convert', extraType: 'WILD', extraCount: 1, text: 'An Extra Die may lock as a Wild; locked this way it adds no die on the re-roll.' },
    vanta_sae: { id: 'vanta_sae', faction: 'WILD', kind: 'retag_select', cond: 'none_extra', selectMax: 1, label: 'Vanta: a die → Wild', text: 'Roll no Extra Dice ⇒ 1 pool die may lock as a Wild.' },
    ft_1000: { id: 'ft_1000', faction: 'WILD', kind: 'wild_to_extra', cond: 'one_wild', label: 'FT-1000: Wild → Extra', text: 'Roll exactly 1 Wild ⇒ treat it as an Extra Die.' },
    meg_gallak: { id: 'meg_gallak', faction: 'WILD', kind: 'save_wild', cond: 'first_wild', selectFace: 'WILD', selectMax: 1, label: 'Meg: save a Wild', text: 'Save 1 Wild from your first roll: on the re-roll, place it back into the pool instead of rolling it.' },
    moro_mada: { id: 'moro_mada', faction: 'WILD', kind: 'safe_small_extra', text: 'If the pool has 1–3 dice and you roll 1+ Extra ⇒ you are safe from busting.' },
    avari: { id: 'avari', faction: 'WILD', kind: 'bonus_next_roll', cond: 'all_wild', label: 'Avari: +3 dice next roll', text: 'Roll all Wilds ⇒ add 3 supply dice on your next roll.' }
};

// ==========================================
// Crew deck (30 cards — 5 factions × 6 archetypes)
// ==========================================
const R = (type: ReqType, count: number, hazard = false): Omit<Requirement, 'index'> => ({ type, count, hazard } as any);

function crew(
    id: string, name: string, faction: Faction, abilityId: string,
    reqs: Array<Omit<Requirement, 'index'>>, isStartingCrew = false
): CrewCard {
    return {
        id, name, faction, isStartingCrew,
        abilityId,
        abilityText: ABILITIES[abilityId] ? ABILITIES[abilityId].text : '',
        requirements: reqs.map((r, i) => ({ index: i, type: r.type, count: r.count, hazard: !!r.hazard }))
    };
}

const CREW_DB: CrewCard[] = [
    // --- Reactor (blue) ---
    crew('ada_massa', 'Ada Massa', 'REACTOR', 'ada_massa', [R('REACTOR', 2), R('THRUSTER', 2), R('DAMAGE', 1)], true),
    crew('aponi', 'Aponi', 'REACTOR', 'aponi', [R('REACTOR', 4), R('THRUSTER', 3), R('SHIELD', 3), R('WILD', 2)]),
    crew('lee_van_cribb', 'Lee Van Cribb', 'REACTOR', 'lee_van_cribb', [R('REACTOR', 2), R('SHIELD', 2), R('THRUSTER', 2), R('DAMAGE', 1, true)]),
    crew('lila_al_bindar', 'Lila Al Bindar', 'REACTOR', 'lila_al_bindar', [R('REACTOR', 3, true), R('THRUSTER', 3), R('SHIELD', 2), R('DAMAGE', 1)]),
    crew('salatar', 'Salatar', 'REACTOR', 'salatar', [R('REACTOR', 4), R('THRUSTER', 3), R('SHIELD', 3), R('DAMAGE', 1)]),
    crew('vila_noir', 'Vila Noir', 'REACTOR', 'vila_noir', [R('REACTOR', 4), R('SHIELD', 3), R('THRUSTER', 2), R('DAMAGE', 1)]),

    // --- Shield (green) ---
    crew('ryle_al_wren', 'Ryle Al Wren', 'SHIELD', 'ryle_al_wren', [R('SHIELD', 2), R('DAMAGE', 2), R('REACTOR', 1)], true),
    crew('redacted', '[Redacted]', 'SHIELD', 'redacted', [R('SHIELD', 4), R('DAMAGE', 3), R('THRUSTER', 3), R('WILD', 2)]),
    crew('bill_bendo', 'Bill Bendo', 'SHIELD', 'bill_bendo', [R('SHIELD', 2), R('DAMAGE', 2), R('THRUSTER', 2), R('REACTOR', 1)]),
    crew('imdar_shade', 'Imdar Shade', 'SHIELD', 'imdar_shade', [R('SHIELD', 4), R('DAMAGE', 3, true), R('THRUSTER', 2), R('REACTOR', 1)]),
    crew('at_0k', 'At-0k', 'SHIELD', 'at_0k', [R('SHIELD', 3), R('DAMAGE', 3), R('THRUSTER', 2), R('REACTOR', 1)]),
    crew('namari', 'Namari', 'SHIELD', 'namari', [R('SHIELD', 4), R('THRUSTER', 3), R('DAMAGE', 3, true), R('REACTOR', 1)]),

    // --- Damage (orange) ---
    crew('dana_powalki', 'Dana Powalki', 'DAMAGE', 'dana_powalki', [R('DAMAGE', 2), R('REACTOR', 2), R('THRUSTER', 1)], true),
    crew('dr_umbrage', 'Dr. Umbrage', 'DAMAGE', 'dr_umbrage', [R('DAMAGE', 4), R('SHIELD', 3), R('REACTOR', 3), R('WILD', 2)]),
    crew('tantin_al_vale', 'Tantin Al Vale', 'DAMAGE', 'tantin_al_vale', [R('DAMAGE', 2), R('SHIELD', 2), R('REACTOR', 2), R('THRUSTER', 1)]),
    crew('saghari', 'Saghari', 'DAMAGE', 'saghari', [R('DAMAGE', 4), R('SHIELD', 3), R('REACTOR', 2), R('THRUSTER', 1)]),
    crew('ryan_rogal', 'Ryan Rogal', 'DAMAGE', 'ryan_rogal', [R('DAMAGE', 3, true), R('SHIELD', 3), R('REACTOR', 2), R('THRUSTER', 1)]),
    crew('kary_powalk', 'Kary Powalk', 'DAMAGE', 'kary_powalk', [R('DAMAGE', 4), R('REACTOR', 3), R('SHIELD', 2), R('THRUSTER', 1)]),

    // --- Thruster (yellow) ---
    crew('nella_van_daval', 'Nella Van Daval', 'THRUSTER', 'nella_van_daval', [R('THRUSTER', 2), R('REACTOR', 2), R('DAMAGE', 1)], true),
    crew('sol_forst', 'Sol Forst', 'THRUSTER', 'sol_forst', [R('THRUSTER', 4), R('REACTOR', 3), R('SHIELD', 3), R('WILD', 2)]),
    crew('zek_zarag', 'Zek Zarag', 'THRUSTER', 'zek_zarag', [R('THRUSTER', 2), R('REACTOR', 2), R('SHIELD', 2), R('DAMAGE', 1)]),
    crew('myla_dystra', 'Myla Dystra', 'THRUSTER', 'myla_dystra', [R('THRUSTER', 3), R('REACTOR', 3), R('SHIELD', 2), R('DAMAGE', 1)]),
    crew('b3_ar', 'B3-AR', 'THRUSTER', 'b3_ar', [R('THRUSTER', 3), R('SHIELD', 3), R('REACTOR', 2), R('DAMAGE', 1)]),
    crew('kal_damar', 'Kal Damar', 'THRUSTER', 'kal_damar', [R('THRUSTER', 4), R('REACTOR', 3), R('SHIELD', 3), R('DAMAGE', 1)]),

    // --- Wild (purple) ---
    crew('sella_pelleon', 'Sella Pelleon', 'WILD', 'sella_pelleon', [R('REACTOR', 2), R('SHIELD', 2), R('THRUSTER', 1)], true),
    crew('vanta_sae', 'Vanta Sae', 'WILD', 'vanta_sae', [R('WILD', 3), R('WILD', 2), R('WILD', 1), R('DAMAGE', 1)]),
    crew('ft_1000', 'FT-1000', 'WILD', 'ft_1000', [R('REACTOR', 2), R('SHIELD', 2), R('THRUSTER', 2), R('WILD', 1)]),
    crew('meg_gallak', 'Meg Gallak', 'WILD', 'meg_gallak', [R('REACTOR', 3), R('SHIELD', 2), R('WILD', 2), R('DAMAGE', 1)]),
    crew('moro_mada', 'Moro Mada', 'WILD', 'moro_mada', [R('DAMAGE', 3), R('REACTOR', 2), R('SHIELD', 2), R('WILD', 1)]),
    crew('avari', 'Avari', 'WILD', 'avari', [R('DAMAGE', 3, true), R('REACTOR', 3), R('SHIELD', 2), R('THRUSTER', 2)])
];

// Hazard bag: 45 tokens (1 prestige/0 haz, 2/1, 5/2).
function buildHazardBag(): HazardToken[] {
    const bag: HazardToken[] = [];
    let id = 0;
    const push = (n: number, prestige: 1 | 2 | 5, hazards: 0 | 1 | 2) => {
        for (let i = 0; i < n; i++) bag.push({ id: `H${id++}`, prestige, hazards });
    };
    push(20, 1, 0);
    push(15, 2, 1);
    push(10, 5, 2);
    return bag;
}

export function getAllCrew(): CrewCard[] {
    return CREW_DB.map(c => JSON.parse(JSON.stringify(c)));
}

// ==========================================
// Helpers
// ==========================================
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const factionName = (f: Faction): string => {
    switch (f) {
        case 'REACTOR': return 'Reactor';
        case 'SHIELD': return 'Shield';
        case 'DAMAGE': return 'Damage';
        case 'THRUSTER': return 'Thruster';
        case 'WILD': return 'Wild';
        default: return f;
    }
};

export const symbolName = (s: DieSymbol): string => {
    switch (s) {
        case 'DAMAGE': return 'Damage';
        case 'REACTOR': return 'Reactor';
        case 'THRUSTER': return 'Thruster';
        case 'SHIELD': return 'Shield';
        case 'WILD': return 'Wild';
        case 'EXTRA': return 'Extra Die';
        default: return s;
    }
};

export const BASE_POOL_SIZE = 5;
export const TOTAL_DICE = 12;

export function displaySizeFor(playerCount: number): number {
    if (playerCount <= 2) return 4;
    if (playerCount === 3) return 5;
    return 6;
}

// ==========================================
// GameState
// ==========================================
export class MoonrollersGameState {
    private data: GameStateData;
    private readonly playerIds: string[];

    constructor(playerIds: string[]) {
        this.playerIds = [...playerIds];
        this.data = {
            status: GameStatus.Lobby,
            playerIds: [...playerIds],
            firstPlayerId: playerIds[0] || '',
            currentPlayerId: '',
            deck: [],
            display: [],
            hazardBag: [],
            players: {},
            step: 'CHOOSE',
            chosenCardIndex: null,
            committedReqIndex: null,
            committedProgress: 0,
            lockedThisRoll: 0,
            rolledOnce: false,
            rollingPool: [],
            supplyCount: TOTAL_DICE,
            lockedCount: 0,
            pendingHazards: [],
            hazardsGainedThisTurn: 0,
            pendingAbilityFaction: null,
            bustSafeThisRoll: false,
            bustSafeNextRoll: false,
            bonusDiceNextRoll: 0,
            abilitiesUsedThisRoll: [],
            endTriggered: false,
            winnerIds: null,
            finalScores: null,
            lastMove: null,
            moveCounter: 0,
            dieCounter: 0,
            rollId: 0
        };
    }

    public static from_data(data: GameStateData, playerIds: string[]): MoonrollersGameState {
        const s = new MoonrollersGameState(playerIds);
        s.data = JSON.parse(JSON.stringify(data));
        // Backfill fields added in later versions so states from an older build still work.
        if (s.data.pendingAbilityFaction === undefined) s.data.pendingAbilityFaction = null;
        if (s.data.bustSafeThisRoll === undefined) s.data.bustSafeThisRoll = false;
        if (s.data.bustSafeNextRoll === undefined) s.data.bustSafeNextRoll = false;
        if (s.data.bonusDiceNextRoll === undefined) s.data.bonusDiceNextRoll = 0;
        if (s.data.abilitiesUsedThisRoll === undefined) s.data.abilitiesUsedThisRoll = [];
        if (s.data.rollId === undefined) s.data.rollId = 0;
        for (const pid in s.data.players) {
            if (!s.data.players[pid].activeByFaction) s.data.players[pid].activeByFaction = {};
        }
        return s;
    }

    public get_data(): GameStateData {
        return JSON.parse(JSON.stringify(this.data));
    }

    // ==========================================
    // Setup
    // ==========================================
    public start_game(firstPlayer?: string) {
        const n = this.playerIds.length;
        if (n < 2 || n > 5) throw new Error('Moonrollers requires 2 to 5 players');

        this.data.status = GameStatus.Active;
        this.data.firstPlayerId = firstPlayer && this.playerIds.includes(firstPlayer)
            ? firstPlayer
            : this.playerIds[Math.floor(Math.random() * n)];
        this.data.currentPlayerId = this.data.firstPlayerId;
        this.data.endTriggered = false;
        this.data.winnerIds = null;
        this.data.finalScores = null;

        this.data.hazardBag = shuffle(buildHazardBag());

        // Deal one starting Crew to each player; the rest join the deck.
        const all = getAllCrew();
        const starters = shuffle(all.filter(c => c.isStartingCrew));
        const nonStarters = all.filter(c => !c.isStartingCrew);

        this.data.players = {};
        for (let i = 0; i < n; i++) {
            const pid = this.playerIds[i];
            this.data.players[pid] = { id: pid, prestige: 0, hired: [], activeByFaction: {}, hazardTokens: [] };
        }
        const dealt: CrewCard[] = [];
        for (let i = 0; i < n; i++) {
            const starter = starters[i];
            const pid = this.playerIds[i];
            this.data.players[pid].hired.push(starter);
            this.data.players[pid].activeByFaction[starter.faction] = starter.id; // starter is on top
            dealt.push(starter);
        }
        const leftoverStarters = starters.filter(s => !dealt.includes(s));

        this.data.deck = shuffle([...nonStarters, ...leftoverStarters]);

        // Deal the display honouring the per-player-count faction constraints.
        this.deal_display(n);

        this.data.currentPlayerId = this.data.firstPlayerId;
        if (!this.start_roll(this.data.firstPlayerId)) {
            this.apply_bust(this.data.firstPlayerId, true);
            this.advance_turn(this.data.firstPlayerId);
        }

        this.log(this.data.currentPlayerId, 'started the mission', { kind: 'start' });
    }

    private deal_display(playerCount: number) {
        const size = displaySizeFor(playerCount);
        const display: DisplayCard[] = [];
        const takeFaction = (f: Faction): boolean => {
            const idx = this.data.deck.findIndex(c => c.faction === f);
            if (idx === -1) return false;
            const [card] = this.data.deck.splice(idx, 1);
            display.push(this.make_display_card(card));
            return true;
        };

        if (size <= 5) {
            // Distinct factions, one card each.
            const factions = shuffle([...FACTIONS]).slice(0, size);
            for (const f of factions) takeFaction(f);
        } else {
            // Six cards: at least one of each faction (one faction repeats).
            for (const f of shuffle([...FACTIONS])) takeFaction(f);
            const extra = this.data.deck.pop();
            if (extra) display.push(this.make_display_card(extra));
        }
        // Backfill if the deck somehow lacked a faction.
        while (display.length < size && this.data.deck.length > 0) {
            display.push(this.make_display_card(this.data.deck.pop()!));
        }
        this.data.display = display;
    }

    private make_display_card(card: CrewCard): DisplayCard {
        return {
            card,
            reqStates: card.requirements.map(() => ({ status: 'OPEN', owner: null, placedThisTurn: false }))
        };
    }

    // ==========================================
    // Turn lifecycle
    // ==========================================
    private reset_turn_state() {
        this.data.chosenCardIndex = null;
        this.data.committedReqIndex = null;
        this.data.committedProgress = 0;
        this.data.lockedThisRoll = 0;
        this.data.rolledOnce = false;
        this.data.rollingPool = [];
        this.data.supplyCount = TOTAL_DICE;
        this.data.lockedCount = 0;
        this.data.pendingHazards = [];
        this.data.hazardsGainedThisTurn = 0;
        this.data.pendingAbilityFaction = null;
        this.data.bustSafeThisRoll = false;
        this.data.bustSafeNextRoll = false;
        this.data.bonusDiceNextRoll = 0;
        this.data.abilitiesUsedThisRoll = [];
    }

    // Roll a fresh turn for `playerId`; returns whether they can commit somewhere.
    private start_roll(playerId: string): boolean {
        this.reset_turn_state();
        const passive = this.first_ability_of_kind(playerId, 'passive_dice');
        const startSize = passive ? (passive.diceCount || BASE_POOL_SIZE) : BASE_POOL_SIZE;
        this.data.supplyCount = TOTAL_DICE - startSize;
        this.data.rollingPool = this.roll_new(startSize);
        this.data.rollId++;
        this.data.step = 'CHOOSE';
        this.recompute_roll_flags(playerId);
        return this.any_card_committable(playerId);
    }

    // After any roll, refresh the per-roll safety flags (Moro Mada / At-0k).
    private recompute_roll_flags(playerId: string) {
        this.data.bustSafeThisRoll = this.data.bustSafeNextRoll;
        this.data.bustSafeNextRoll = false;
        const pool = this.data.rollingPool;
        if (this.has_ability_kind(playerId, 'safe_small_extra') && pool.length <= 3 && pool.some(d => d.face === 'EXTRA')) {
            this.data.bustSafeThisRoll = true;
        }
        const shields = pool.filter(d => d.face === 'SHIELD' && !d.asWild).length;
        if (this.has_ability_kind(playerId, 'safe_shields') && shields >= 2) {
            this.data.bustSafeNextRoll = true;
        }
    }

    // Move to the next player who has a playable opening roll, opening-busting any who
    // cannot lock a single die. Iterative — never recurses back through begin/bust.
    private advance_turn(fromPlayerId: string) {
        if (this.data.status === GameStatus.GameOver) return;
        const order = this.playerIds;
        let idx = order.indexOf(fromPlayerId);
        for (let guard = 0; guard < order.length; guard++) {
            idx = (idx + 1) % order.length;
            const pid = order[idx];
            this.data.currentPlayerId = pid;
            if (this.start_roll(pid)) return;
            this.apply_bust(pid, true); // opening bust — try the next player
        }
        // Pathological: nobody could lock a single die this pass. Leave the last up.
    }

    private roll_new(count: number): Die[] {
        const dice: Die[] = [];
        for (let i = 0; i < count; i++) {
            dice.push({ id: `d${this.data.dieCounter++}`, face: DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)] });
        }
        return dice;
    }

    private reroll(dice: Die[]) {
        for (const d of dice) {
            if (d.saved) { d.saved = false; continue; } // Meg Gallak: keep this face for exactly one re-roll
            d.face = DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)];
            d.asWild = false;
        }
    }

    // ==========================================
    // Player actions
    // ==========================================
    public choose_card(playerId: string, cardIndex: number) {
        this.validate_active(playerId);
        // Re-selecting the Crew is allowed until the first die is locked this turn.
        const reselecting = this.data.chosenCardIndex !== null
            && this.data.lockedCount === 0
            && (this.data.step === 'COMMIT' || (this.data.step === 'LOCKING' && this.data.committedProgress === 0));
        if (this.data.step !== 'CHOOSE' && !reselecting) {
            throw new Error('You have already started working this Crew this turn');
        }
        if (cardIndex < 0 || cardIndex >= this.data.display.length) throw new Error('Invalid card');
        if (!this.card_committable(playerId, cardIndex)) {
            throw new Error('You cannot lock any rolled die on that Crew — choose another');
        }
        this.undo_pending_commit();
        this.data.chosenCardIndex = cardIndex;
        this.data.step = 'COMMIT';
        this.log(playerId, `chose ${this.data.display[cardIndex].card.name}`, {
            kind: 'choose', cardName: this.data.display[cardIndex].card.name, faction: this.data.display[cardIndex].card.faction
        });
    }

    public commit(playerId: string, reqIndex: number) {
        this.validate_active(playerId);
        // Re-selecting the requirement is allowed until a die is locked onto it.
        const reselecting = this.data.step === 'LOCKING'
            && this.data.committedReqIndex !== null
            && this.data.committedProgress === 0;
        if (this.data.step !== 'COMMIT' && !reselecting) throw new Error('You are not choosing a requirement');
        if (reselecting) this.undo_pending_commit();
        const dc = this.chosen();
        const rs = dc.reqStates[reqIndex];
        if (!rs) throw new Error('Invalid requirement');
        if (rs.status !== 'OPEN') throw new Error('That requirement already has a token on it');
        if (!this.can_lock_any_into(playerId, dc.card.requirements[reqIndex].type)) {
            throw new Error('You have no die that can lock onto that requirement');
        }
        rs.status = 'COMMITTED';
        rs.owner = playerId;
        rs.placedThisTurn = true;
        this.data.committedReqIndex = reqIndex;
        this.data.committedProgress = 0;
        this.data.step = 'LOCKING';
        this.log(playerId, `committed to a ${symbolName(dc.card.requirements[reqIndex].type)} requirement`, { kind: 'commit' });
    }

    // Roll back a placed-but-not-yet-locked commitment token (used when re-selecting a
    // requirement or Crew before any die is locked).
    private undo_pending_commit() {
        if (this.data.chosenCardIndex !== null && this.data.committedReqIndex !== null && this.data.committedProgress === 0) {
            const dc = this.data.display[this.data.chosenCardIndex];
            const rs = dc && dc.reqStates[this.data.committedReqIndex];
            if (rs && rs.status === 'COMMITTED' && rs.placedThisTurn) {
                rs.status = 'OPEN';
                rs.owner = null;
                rs.placedThisTurn = false;
            }
        }
        this.data.committedReqIndex = null;
        this.data.committedProgress = 0;
    }

    // Lock a directly-matching die (or a real / pseudo Wild) into the committed requirement.
    public lock_die(playerId: string, dieIndex: number) {
        this.validate_active(playerId);
        this.require_committed();
        const die = this.data.rollingPool[dieIndex];
        if (!die) throw new Error('No such die');
        const req = this.committed_req();
        if (!this.die_locks_into(die, req.type)) {
            throw new Error(`A ${symbolName(die.face)} die cannot lock onto a ${symbolName(req.type)} requirement`);
        }
        // Small-pool doubler (Aponi/Umbrage/Sol Forst/[Redacted]): while the pool is 1–3 dice,
        // a locked Wild or matching die counts as 2 toward its faction's requirement.
        const doubler = this.active_abilities(playerId).find(a => a.kind === 'pool_doubler' && a.doubleType === req.type);
        const inc = (doubler && this.data.rollingPool.length <= 3) ? 2 : 1;
        this.data.rollingPool.splice(dieIndex, 1);
        this.data.lockedCount++;
        this.data.committedProgress += inc;
        this.data.lockedThisRoll++;
        this.log(playerId, `locked a ${die.asWild ? 'Wild' : symbolName(die.face)} die`, { kind: 'lock' });
        this.after_lock(playerId);
    }

    // Ability: exactly-1-of-a-type ⇒ retag that die as a Wild (Lee/Bill/Tantin/Zek).
    public ability_retag(playerId: string, dieIndex: number) {
        this.validate_active(playerId);
        if (this.data.status !== GameStatus.Active) throw new Error('The game is over');
        const die = this.data.rollingPool[dieIndex];
        if (!die) throw new Error('No such die');
        const ab = this.retag_ability_for(playerId, die.face);
        if (!ab) throw new Error('No ability lets you retag that die right now');
        die.face = 'WILD';
        die.asWild = true;
        this.log(playerId, `used ${this.crew_name(ab.id)} to lock a die as a Wild`, { kind: 'ability' });
    }

    // Ability: lock an EXTRA die as N of the committed requirement's type (converters / Sella).
    public ability_extra_lock(playerId: string, dieIndex: number) {
        this.validate_active(playerId);
        this.require_committed();
        const die = this.data.rollingPool[dieIndex];
        if (!die) throw new Error('No such die');
        if (die.face !== 'EXTRA') throw new Error('That ability only converts an Extra Die');
        const req = this.committed_req();
        const conv = this.extra_converter_for(playerId, req.type);
        if (!conv) throw new Error('You have no converter for that requirement');
        const n = conv.extraCount || 1;
        this.data.rollingPool.splice(dieIndex, 1);
        this.data.lockedCount++;
        this.data.committedProgress += n;
        this.data.lockedThisRoll++;
        this.log(playerId, `converted an Extra Die into ${n} ${symbolName(req.type)}`, { kind: 'ability' });
        this.after_lock(playerId);
    }

    // Ability: Salatar — re-roll all pool dice on the first roll before any lock.
    public ability_reroll_all(playerId: string) {
        this.validate_active(playerId);
        if (this.data.rolledOnce) throw new Error('First-roll ability only');
        if (this.data.lockedThisRoll > 0 || this.data.committedReqIndex !== null) throw new Error('Use before locking');
        if (!this.has_ability_kind(playerId, 'first_roll_reroll')) throw new Error('You do not have that ability');
        this.reroll(this.data.rollingPool);
        this.log(playerId, 'used Salatar to re-roll the whole pool', { kind: 'ability' });
        // The re-roll can strand the player with nothing to commit — that busts.
        if (this.data.step === 'CHOOSE' && !this.any_card_committable(playerId)) {
            this.apply_bust(playerId, true);
            this.advance_turn(playerId);
        }
    }

    // Trigger a manual ability (predicate-gated, once per roll). `dieIndices` feed the
    // dice-selection abilities (re-roll / convert / retag / save).
    public use_ability(playerId: string, abilityId: string, dieIndices: number[] = []) {
        this.validate_active(playerId);
        if (this.data.status !== GameStatus.Active) throw new Error('The game is over');
        const ab = this.active_abilities(playerId).find(a => a.id === abilityId);
        if (!ab) throw new Error('You do not have that ability active');
        if (this.data.abilitiesUsedThisRoll.includes(abilityId)) throw new Error('That ability is already used this roll');
        if (!this.ability_predicate_met(playerId, ab)) throw new Error('That ability’s conditions are not met');

        const pool = this.data.rollingPool;
        const selectedDice = (): Die[] => {
            if (dieIndices.length === 0) throw new Error('Select at least one die');
            const dice = dieIndices.map(i => pool[i]);
            if (dice.some(d => !d)) throw new Error('Invalid die selection');
            if (ab.selectMax !== undefined && dieIndices.length > ab.selectMax) throw new Error(`Select at most ${ab.selectMax} dice`);
            if (ab.selectFace && dice.some(d => d.face !== ab.selectFace)) throw new Error(`Select only ${symbolName(ab.selectFace)} dice`);
            return dice;
        };

        let mutatedPool = false;
        switch (ab.kind) {
            case 'pull_supply': {
                const keep = ab.pullKeep || [];
                for (let i = 0; i < (ab.pullCount || 1); i++) {
                    if (this.data.supplyCount <= 0) break;
                    this.data.supplyCount--;
                    const face = DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)];
                    const die: Die = { id: `d${this.data.dieCounter++}`, face };
                    // A kept face (Wild/Extra) joins the pool; an unkept face is shown rolling
                    // as a transient die that returns to supply shortly after (dismiss_transient).
                    if (!keep.includes(face)) die.transient = true;
                    pool.push(die);
                }
                break;
            }
            case 'draw_hazard': {
                const tok = this.data.hazardBag.pop();
                if (tok) { this.data.players[playerId].hazardTokens.push(tok); this.data.hazardsGainedThisTurn++; }
                break;
            }
            case 'wild_to_extra': {
                const w = pool.find(d => d.face === 'WILD' && !d.asWild);
                if (w) w.face = 'EXTRA';
                mutatedPool = true;
                break;
            }
            case 'bonus_next_roll': {
                this.data.bonusDiceNextRoll += 3;
                break;
            }
            case 'complete_committed': {
                const req = this.committed_req();
                this.data.committedProgress = req.count;
                this.data.lockedThisRoll++;
                this.data.abilitiesUsedThisRoll.push(abilityId);
                this.log(playerId, `used ${this.crew_name(abilityId)} to complete the requirement`, { kind: 'ability' });
                this.after_lock(playerId);
                return;
            }
            case 'reroll_select': {
                for (const d of selectedDice()) { d.face = DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)]; d.asWild = false; d.saved = false; }
                mutatedPool = true;
                break;
            }
            case 'convert_extra_select': {
                for (const d of selectedDice()) { d.face = 'EXTRA'; d.asWild = false; }
                mutatedPool = true;
                break;
            }
            case 'retag_select': {
                for (const d of selectedDice()) { d.face = 'WILD'; d.asWild = true; }
                break;
            }
            case 'save_wild': {
                for (const d of selectedDice()) d.saved = true;
                break;
            }
            default:
                throw new Error('That ability is not manually triggered');
        }

        this.data.abilitiesUsedThisRoll.push(abilityId);
        this.log(playerId, `used ${this.crew_name(abilityId)}`, { kind: 'ability' });
        // A pool-shrinking ability can strand a still-unlocked roll → that busts.
        if (mutatedPool) this.check_post_roll_bust(playerId);
    }

    private face_count(face: DieSymbol): number {
        return this.data.rollingPool.filter(d => d.face === face && !d.asWild && !d.transient).length;
    }

    private ability_predicate_met(playerId: string, ab: AbilityDef): boolean {
        const pool = this.data.rollingPool.filter(d => !d.transient);
        switch (ab.cond) {
            case 'none_damage': return this.face_count('DAMAGE') === 0;
            case 'ge2_damage': return this.face_count('DAMAGE') >= 2;
            case 'none_shield': return this.face_count('SHIELD') === 0 && this.data.hazardBag.length > 0;
            case 'ge2_reactor': return this.face_count('REACTOR') >= 2;
            case 'none_reactor': return this.face_count('REACTOR') === 0 && pool.length > 0;
            case 'first_damage': return !this.data.rolledOnce && this.face_count('DAMAGE') >= 1;
            case 'ge2_thruster': return this.face_count('THRUSTER') >= 2 && pool.length > 0;
            case 'none_extra': return this.face_count('EXTRA') === 0 && pool.some(d => !d.asWild);
            case 'one_wild': return this.face_count('WILD') === 1;
            case 'first_wild': return !this.data.rolledOnce && this.face_count('WILD') >= 1;
            case 'ge3_thruster': return this.face_count('THRUSTER') >= 3 && this.data.committedReqIndex !== null && this.data.step === 'LOCKING';
            case 'all_wild': return pool.length > 0 && pool.every(d => d.face === 'WILD' && !d.asWild);
            default: return false;
        }
    }

    // Bust if the current roll left the player unable to lock and no safety net applies.
    private check_post_roll_bust(playerId: string) {
        if (this.data.lockedThisRoll >= 1 || this.data.bustSafeThisRoll) return;
        if (this.data.committedReqIndex !== null && this.data.step === 'LOCKING') {
            if (!this.can_lock_any_into(playerId, this.committed_req().type)) this.do_bust(playerId);
        } else if (this.data.chosenCardIndex !== null && (this.data.step === 'COMMIT' || this.data.step === 'DECIDE')) {
            if (!this.card_committable(playerId, this.data.chosenCardIndex)) this.do_bust(playerId);
        } else if (this.data.step === 'CHOOSE') {
            if (!this.any_card_committable(playerId)) this.do_bust(playerId);
        }
    }

    public roll_again(playerId: string) {
        this.validate_active(playerId);
        if (this.data.step !== 'LOCKING' && this.data.step !== 'DECIDE') {
            throw new Error('You must lock a die before rolling again');
        }
        if (this.data.lockedThisRoll < 1 && !this.data.bustSafeThisRoll) {
            throw new Error('You must lock at least one die each roll');
        }
        if (this.data.rollingPool.length === 0 && this.data.bonusDiceNextRoll === 0) {
            throw new Error('No dice left to roll — you must Stop');
        }

        // Add one die per Extra face showing, plus any Avari bonus dice, then re-roll all.
        const extras = this.data.rollingPool.filter(d => d.face === 'EXTRA').length;
        const pulled = Math.min(extras + this.data.bonusDiceNextRoll, this.data.supplyCount);
        for (let i = 0; i < pulled; i++) {
            this.data.rollingPool.push({ id: `d${this.data.dieCounter++}`, face: 'EXTRA' });
            this.data.supplyCount--;
        }
        this.data.bonusDiceNextRoll = 0;
        this.reroll(this.data.rollingPool);
        this.data.rollId++;
        this.data.rolledOnce = true;
        this.data.lockedThisRoll = 0;
        this.data.abilitiesUsedThisRoll = [];
        this.recompute_roll_flags(playerId);

        if (this.data.committedReqIndex !== null) {
            this.data.step = 'LOCKING';
            if (!this.can_lock_any_into(playerId, this.committed_req().type) && !this.data.bustSafeThisRoll) {
                this.do_bust(playerId);
                return;
            }
        } else {
            this.data.step = 'COMMIT';
            if (!this.card_committable(playerId, this.data.chosenCardIndex!) && !this.data.bustSafeThisRoll) {
                this.do_bust(playerId);
                return;
            }
        }
        this.log(playerId, `re-rolled${pulled > 0 ? ` (+${pulled} dice)` : ''}`, { kind: 'roll' });
    }

    public stop(playerId: string) {
        this.validate_active(playerId);
        if (this.data.step === 'HAZARD') throw new Error('Resolve the Hazard draw first');
        if (this.data.step === 'CHOOSE_ABILITY') throw new Error('Choose which ability to keep first');
        // Must lock ≥1 this roll before stopping — unless a safety net (Moro Mada / At-0k) applies.
        const needLock = this.data.step === 'CHOOSE' || this.data.step === 'COMMIT' || this.data.step === 'LOCKING';
        if (needLock && this.data.lockedThisRoll < 1 && !this.data.bustSafeThisRoll) {
            throw new Error('You must lock at least one die before stopping');
        }
        this.do_stop(playerId);
    }

    // Resolve the 2-keep-1 Hazard draw.
    public keep_hazard(playerId: string, tokenIndex: number) {
        this.validate_active(playerId);
        if (this.data.step !== 'HAZARD') throw new Error('No Hazard draw to resolve');
        if (tokenIndex !== 0 && tokenIndex !== 1) throw new Error('Choose one of the two tokens');
        const kept = this.data.pendingHazards[tokenIndex];
        const returned = this.data.pendingHazards[1 - tokenIndex];
        this.data.players[playerId].hazardTokens.push(kept);
        this.data.hazardBag.push(returned); // face down, back to the bag
        this.data.pendingHazards = [];
        this.data.hazardsGainedThisTurn++;
        this.log(playerId, 'kept a Hazard token', { kind: 'hazard' });
        this.after_hazard(playerId);
    }

    // ==========================================
    // Post-lock / completion flow
    // ==========================================
    private after_lock(playerId: string) {
        const dc = this.chosen();
        const reqIdx = this.data.committedReqIndex!;
        const req = dc.card.requirements[reqIdx];
        if (this.data.committedProgress >= req.count) {
            // Requirement complete.
            dc.reqStates[reqIdx].status = 'COMPLETED';
            this.data.committedReqIndex = null;
            this.data.committedProgress = 0;
            this.log(playerId, `completed a ${symbolName(req.type)} requirement`, { kind: 'complete' });

            if (req.hazard) {
                this.draw_hazards(playerId);
                return; // resolves via keep_hazard → after_hazard
            }
            this.after_completion(playerId);
        } else {
            this.data.step = 'LOCKING';
        }
    }

    private draw_hazards(playerId: string) {
        const a = this.data.hazardBag.pop();
        const b = this.data.hazardBag.pop();
        const drawn: HazardToken[] = [];
        if (a) drawn.push(a);
        if (b) drawn.push(b);
        if (drawn.length === 0) {
            this.after_completion(playerId);
            return;
        }
        if (drawn.length === 1) {
            // Only one token left — keep it automatically.
            this.data.players[playerId].hazardTokens.push(drawn[0]);
            this.data.hazardsGainedThisTurn++;
            this.after_completion(playerId);
            return;
        }
        this.data.pendingHazards = drawn;
        this.data.step = 'HAZARD';
    }

    private after_hazard(playerId: string) {
        this.after_completion(playerId);
    }

    private after_completion(playerId: string) {
        const dc = this.chosen();
        const openLeft = dc.reqStates.some(r => r.status === 'OPEN');
        if (!openLeft) {
            // Completed the card's last open requirement → forced stop → resolve.
            this.data.step = 'MUST_STOP';
            this.resolve_card(playerId);
        } else {
            this.data.step = 'DECIDE';
        }
    }

    // Voluntary / forced stop: keep completed tokens, drop uncompleted ones.
    private do_stop(playerId: string) {
        const dc = this.data.chosenCardIndex !== null ? this.chosen() : null;
        if (dc) {
            // If a full card is complete, resolve it (covers the MUST_STOP path too).
            if (!dc.reqStates.some(r => r.status === 'OPEN') && dc.reqStates.some(r => r.status === 'COMPLETED')) {
                this.resolve_card(playerId);
                return;
            }
            // Remove this turn's uncompleted committed token(s).
            for (const rs of dc.reqStates) {
                if (rs.status === 'COMMITTED' && rs.placedThisTurn) {
                    rs.status = 'OPEN';
                    rs.owner = null;
                    rs.placedThisTurn = false;
                }
            }
        }
        this.log(playerId, 'stopped', { kind: 'stop' });
        this.clear_placed_flags();
        this.end_turn(playerId);
    }

    // Remove this player's this-turn tokens + apply on-bust abilities. Does NOT advance
    // the turn (callers decide, so opening busts can loop without recursion).
    private apply_bust(playerId: string, atStart = false) {
        // Remove ALL tokens this player placed this turn (including completed-this-turn).
        if (this.data.chosenCardIndex !== null && this.data.display[this.data.chosenCardIndex]) {
            const dc = this.chosen();
            for (const rs of dc.reqStates) {
                if (rs.placedThisTurn) {
                    rs.status = 'OPEN';
                    rs.owner = null;
                    rs.placedThisTurn = false;
                }
            }
        }
        // Hazards gained this turn are kept (already in the player's pile).
        // Namari: +2 prestige after busting.
        const bustAb = this.first_ability_of_kind(playerId, 'passive_bust');
        if (bustAb) this.data.players[playerId].prestige += (bustAb.bustPrestige || 0);

        this.log(playerId, atStart ? 'busted on the opening roll' : 'busted', { kind: 'bust' });
        this.clear_placed_flags();
    }

    private do_bust(playerId: string) {
        this.apply_bust(playerId, false);
        this.end_turn(playerId);
    }

    private clear_placed_flags() {
        for (const dc of this.data.display) {
            for (const rs of dc.reqStates) rs.placedThisTurn = false;
        }
    }

    // Full card completed → pay every contributor, hire to the finisher, refill, check end.
    private resolve_card(finisherId: string) {
        const idx = this.data.chosenCardIndex!;
        const dc = this.data.display[idx];

        // Pay prestige: each completed requirement's owner scores its count (×2 for WILD reqs).
        dc.card.requirements.forEach((req, i) => {
            const rs = dc.reqStates[i];
            if (rs.status === 'COMPLETED' && rs.owner) {
                const gain = req.type === 'WILD' ? req.count * 2 : req.count;
                if (this.data.players[rs.owner]) this.data.players[rs.owner].prestige += gain;
            }
        });

        // Hire the crew to the finisher.
        const finisher = this.data.players[finisherId];
        if (!finisher.activeByFaction) finisher.activeByFaction = {};
        finisher.hired.push(dc.card);
        const faction = dc.card.faction;
        const sameCount = finisher.hired.filter(c => c.faction === faction).length;
        if (sameCount === 1) finisher.activeByFaction[faction] = dc.card.id; // first of its faction → active
        this.log(finisherId, `recruited ${dc.card.name} (${factionName(faction)})`, {
            kind: 'hire', cardName: dc.card.name, faction
        });

        // Refill the slot from the deck (constant display size), or flag deck-out.
        let deckEmpty = false;
        if (this.data.deck.length > 0) {
            this.data.display[idx] = this.make_display_card(this.data.deck.pop()!);
        } else {
            this.data.display.splice(idx, 1);
            deckEmpty = true;
        }

        this.clear_placed_flags();

        // End trigger: 1 of each faction (5) OR 3 of the same faction, or deck exhausted.
        if (this.meets_win_condition(finisherId) || deckEmpty) {
            this.data.endTriggered = true;
            this.finish_game();
            return;
        }

        // Recruited a duplicate faction (and didn't win): the player chooses which crew's
        // ability stays on top, and may return one Hazard token. Pause the turn for it.
        if (sameCount >= 2) {
            this.data.pendingAbilityFaction = faction;
            this.data.step = 'CHOOSE_ABILITY';
            return;
        }
        this.end_turn(finisherId);
    }

    // Resolve the duplicate-faction choice: pick the crew on top (its ability is active),
    // optionally returning one Hazard token to the bag, then end the turn.
    public resolve_duplicate(playerId: string, keepCrewId: string, returnHazardId?: string | null) {
        this.validate_active(playerId);
        if (this.data.step !== 'CHOOSE_ABILITY' || !this.data.pendingAbilityFaction) {
            throw new Error('No faction ability choice is pending');
        }
        const faction = this.data.pendingAbilityFaction;
        const p = this.data.players[playerId];
        const crew = p.hired.find(c => c.id === keepCrewId && c.faction === faction);
        if (!crew) throw new Error('Choose one of your Crew of the recruited faction');

        if (!p.activeByFaction) p.activeByFaction = {};
        p.activeByFaction[faction] = keepCrewId;

        if (returnHazardId) {
            const hi = p.hazardTokens.findIndex(t => t.id === returnHazardId);
            if (hi !== -1) {
                const [tok] = p.hazardTokens.splice(hi, 1);
                this.data.hazardBag.push(tok);
                this.log(playerId, `kept ${crew.name}'s ability and returned a Hazard token`, { kind: 'hire' });
            }
        } else {
            this.log(playerId, `kept ${crew.name}'s ability on top`, { kind: 'hire' });
        }

        this.data.pendingAbilityFaction = null;
        this.end_turn(playerId);
    }

    private meets_win_condition(playerId: string): boolean {
        const counts: Record<string, number> = {};
        for (const c of this.data.players[playerId].hired) counts[c.faction] = (counts[c.faction] || 0) + 1;
        const distinct = Object.keys(counts).length;
        const maxSame = Object.values(counts).reduce((m, v) => Math.max(m, v), 0);
        return distinct >= FACTIONS.length || maxSame >= 3;
    }

    private end_turn(playerId: string) {
        if (this.data.status === GameStatus.GameOver) return;
        this.advance_turn(playerId);
    }

    // ==========================================
    // Final scoring
    // ==========================================
    private finish_game() {
        const rows: FinalScoreRow[] = this.playerIds.map(pid => {
            const p = this.data.players[pid];
            const hazardSymbols = p.hazardTokens.reduce((s, t) => s + t.hazards, 0);
            const tokenPrestige = p.hazardTokens.reduce((s, t) => s + t.prestige, 0);
            return { playerId: pid, trackPrestige: p.prestige, tokenPrestige, hazardSymbols, disqualified: false, total: 0 };
        });

        // Most-Hazard disqualification.
        const maxHaz = rows.reduce((m, r) => Math.max(m, r.hazardSymbols), 0);
        const leaders = rows.filter(r => r.hazardSymbols === maxHaz && maxHaz > 0);
        if (this.playerIds.length === 2 && leaders.length === 1) {
            // 2-player exception: only disqualified when 3+ more Hazard symbols than the opponent.
            const leader = leaders[0];
            const other = rows.find(r => r.playerId !== leader.playerId)!;
            if (leader.hazardSymbols - other.hazardSymbols >= 3) leader.disqualified = true;
        } else {
            for (const r of leaders) r.disqualified = true;
        }

        for (const r of rows) {
            r.total = r.trackPrestige + (r.disqualified ? 0 : r.tokenPrestige);
        }

        // Winner: most total prestige; tie-break fewest Hazard symbols; else shared.
        let best: FinalScoreRow[] = [];
        for (const r of rows) {
            if (best.length === 0) { best = [r]; continue; }
            const b = best[0];
            if (r.total > b.total || (r.total === b.total && r.hazardSymbols < b.hazardSymbols)) best = [r];
            else if (r.total === b.total && r.hazardSymbols === b.hazardSymbols) best.push(r);
        }

        this.data.finalScores = rows;
        this.data.winnerIds = best.map(r => r.playerId);
        this.data.status = GameStatus.GameOver;
        this.data.currentPlayerId = '';
        this.data.step = 'CHOOSE';
    }

    // ==========================================
    // Ability lookups (only the TOP crew of each faction stack grants its ability)
    // ==========================================
    public active_abilities(playerId: string): AbilityDef[] {
        const p = this.data.players[playerId];
        if (!p) return [];
        const topByFaction: Record<string, CrewCard> = {};
        for (const c of p.hired) topByFaction[c.faction] = c; // default: most recently hired
        // The player's explicit stack choice wins where set.
        const chosen = p.activeByFaction || {};
        for (const faction in chosen) {
            const crew = p.hired.find(c => c.id === chosen[faction]);
            if (crew) topByFaction[faction] = crew;
        }
        return Object.values(topByFaction)
            .map(c => ABILITIES[c.abilityId])
            .filter((a): a is AbilityDef => !!a);
    }

    private has_ability_kind(playerId: string, kind: AbilityKind): boolean {
        return this.active_abilities(playerId).some(a => a.kind === kind);
    }

    private first_ability_of_kind(playerId: string, kind: AbilityKind): AbilityDef | null {
        return this.active_abilities(playerId).find(a => a.kind === kind) || null;
    }

    private retag_ability_for(playerId: string, face: DieSymbol): AbilityDef | null {
        if (!REQ_TYPES.includes(face as ReqType)) return null;
        for (const a of this.active_abilities(playerId)) {
            if (a.kind === 'retag_wild' && a.retagType === face) {
                // Only usable when EXACTLY ONE die of that face is currently in the pool.
                if (this.data.rollingPool.filter(d => d.face === face && !d.asWild && !d.transient).length === 1) return a;
            }
        }
        return null;
    }

    private extra_converter_for(playerId: string, reqType: ReqType): AbilityDef | null {
        for (const a of this.active_abilities(playerId)) {
            if (a.kind !== 'extra_convert') continue;
            if (a.extraType === reqType) return a;                    // exact-type converter
            if (a.extraType === 'WILD' && reqType !== 'WILD') return a; // Sella: extra→wild into any NORMAL req
        }
        return null;
    }

    private crew_name(abilityId: string): string {
        const c = CREW_DB.find(cc => cc.abilityId === abilityId);
        return c ? c.name : abilityId;
    }

    // ==========================================
    // Lockability logic
    // ==========================================
    private die_locks_into(die: Die, reqType: ReqType): boolean {
        if (die.transient) return false; // a pull die on its way back to supply never locks
        if (reqType === 'WILD') return die.face === 'WILD' && !die.asWild; // only a REAL Wild
        return die.face === reqType || die.face === 'WILD'; // real or pseudo wild both lock normal reqs
    }

    // Could the player lock at least one die into a req of `reqType` right now (incl. abilities)?
    public can_lock_any_into(playerId: string, reqType: ReqType): boolean {
        const pool = this.data.rollingPool.filter(d => !d.transient);
        if (pool.some(d => this.die_locks_into(d, reqType))) return true;
        if (reqType === 'WILD') return false; // no ability manufactures a real Wild face
        // Converter: an EXTRA die → matching type.
        if (pool.some(d => d.face === 'EXTRA') && this.extra_converter_for(playerId, reqType)) return true;
        // Retag: exactly one of some type → Wild → locks into a normal req.
        for (const a of this.active_abilities(playerId)) {
            if (a.kind === 'retag_wild' && a.retagType
                && pool.filter(d => d.face === a.retagType && !d.asWild).length === 1) return true;
        }
        return false;
    }

    private card_committable(playerId: string, cardIndex: number): boolean {
        const dc = this.data.display[cardIndex];
        if (!dc) return false;
        return dc.card.requirements.some((req, i) =>
            dc.reqStates[i].status === 'OPEN' && this.can_lock_any_into(playerId, req.type));
    }

    private any_card_committable(playerId: string): boolean {
        return this.data.display.some((_, i) => this.card_committable(playerId, i));
    }

    // ==========================================
    // Derived (public, for the view layer)
    // ==========================================
    public faction_counts(playerId: string): Record<string, number> {
        const counts: Record<string, number> = {};
        const p = this.data.players[playerId];
        if (!p) return counts;
        for (const c of p.hired) counts[c.faction] = (counts[c.faction] || 0) + 1;
        return counts;
    }

    // Is this open requirement committable with the current roll (for UI affordances)?
    public req_committable(playerId: string, cardIndex: number, reqIndex: number): boolean {
        const dc = this.data.display[cardIndex];
        if (!dc) return false;
        if (dc.reqStates[reqIndex].status !== 'OPEN') return false;
        return this.can_lock_any_into(playerId, dc.card.requirements[reqIndex].type);
    }

    // One-shot bundle of interactive affordances for the active player's current roll.
    // The view renders straight from this — the ability/lock rules live here only.
    public affordances(playerId: string): {
        committable: Array<{ cardIndex: number; reqIndex: number }>;
        directLockDice: number[];
        retagDice: Array<{ dieIndex: number; ability: string }>;
        extraConvert: { dieIndices: number[]; type: ReqType; count: number } | null;
        canRerollAll: boolean;
        availableAbilities: Array<{ id: string; label: string; trigger: 'instant' | 'select'; selectMax?: number; selectFace?: DieSymbol }>;
    } {
        const out = {
            committable: [] as Array<{ cardIndex: number; reqIndex: number }>,
            directLockDice: [] as number[],
            retagDice: [] as Array<{ dieIndex: number; ability: string }>,
            extraConvert: null as { dieIndices: number[]; type: ReqType; count: number } | null,
            canRerollAll: false,
            availableAbilities: [] as Array<{ id: string; label: string; trigger: 'instant' | 'select'; selectMax?: number; selectFace?: DieSymbol }>
        };
        if (this.data.status !== GameStatus.Active || this.data.currentPlayerId !== playerId) return out;

        // Committable requirements across every display card. The view decides which are
        // actionable: the chosen card's reqs (to commit) plus, until the first lock, other
        // cards' presence (to switch Crew).
        this.data.display.forEach((dc, ci) => {
            dc.card.requirements.forEach((req, ri) => {
                if (dc.reqStates[ri].status === 'OPEN' && this.can_lock_any_into(playerId, req.type)) {
                    out.committable.push({ cardIndex: ci, reqIndex: ri });
                }
            });
        });

        // Lock options against the currently committed requirement.
        if (this.data.committedReqIndex !== null && this.data.step === 'LOCKING') {
            const req = this.committed_req();
            this.data.rollingPool.forEach((die, di) => {
                if (this.die_locks_into(die, req.type)) out.directLockDice.push(di);
            });
            this.data.rollingPool.forEach((die, di) => {
                if (die.transient) return;
                if (this.retag_ability_for(playerId, die.face)) {
                    out.retagDice.push({ dieIndex: di, ability: this.crew_name(this.retag_ability_for(playerId, die.face)!.id) });
                }
            });
            const conv = this.extra_converter_for(playerId, req.type);
            if (conv) {
                const dieIndices = this.data.rollingPool
                    .map((d, i) => (d.face === 'EXTRA' && !d.transient ? i : -1)).filter(i => i >= 0);
                if (dieIndices.length > 0) out.extraConvert = { dieIndices, type: req.type, count: conv.extraCount || 1 };
            }
        }

        out.canRerollAll = !this.data.rolledOnce
            && this.data.lockedThisRoll === 0
            && this.data.committedReqIndex === null
            && this.has_ability_kind(playerId, 'first_roll_reroll');

        // Triggered manual abilities whose predicate holds and that aren't used yet this roll.
        for (const ab of this.active_abilities(playerId)) {
            const instant = INSTANT_KINDS.indexOf(ab.kind) !== -1;
            const select = SELECT_KINDS.indexOf(ab.kind) !== -1;
            if (!instant && !select) continue;
            if (this.data.abilitiesUsedThisRoll.indexOf(ab.id) !== -1) continue;
            if (!this.ability_predicate_met(playerId, ab)) continue;
            out.availableAbilities.push({
                id: ab.id, label: ab.label || ab.id,
                trigger: instant ? 'instant' : 'select',
                selectMax: ab.selectMax, selectFace: ab.selectFace
            });
        }

        return out;
    }

    // ==========================================
    // Guards / small helpers
    // ==========================================
    private validate_active(playerId: string) {
        if (this.data.status === GameStatus.GameOver) throw new Error('The game is over');
        if (this.data.currentPlayerId !== playerId) throw new Error('It is not your turn');
        // Any action clears leftover transient (unkept-pull) dice back to the supply.
        this.clear_transient();
    }

    // Return transient dice (unkept pull results) to the supply.
    private clear_transient() {
        if (!this.data.rollingPool.some(d => d.transient)) return;
        const kept: Die[] = [];
        for (const d of this.data.rollingPool) {
            if (d.transient) this.data.supplyCount++;
            else kept.push(d);
        }
        this.data.rollingPool = kept;
    }

    // Client-driven: drop the transient pull dice after their brief on-screen life.
    public dismiss_transient(playerId: string) {
        if (this.data.status !== GameStatus.Active || this.data.currentPlayerId !== playerId) return;
        this.clear_transient();
    }

    private require_committed() {
        if (this.data.status === GameStatus.GameOver) throw new Error('The game is over');
        if (this.data.committedReqIndex === null || this.data.step !== 'LOCKING') {
            throw new Error('You are not locking a requirement');
        }
    }

    private chosen(): DisplayCard {
        return this.data.display[this.data.chosenCardIndex!];
    }

    private committed_req(): Requirement {
        return this.chosen().card.requirements[this.data.committedReqIndex!];
    }

    private log(playerId: string, desc: string, extra: Partial<LastMove>) {
        this.data.lastMove = {
            playerId, desc, moveId: ++this.data.moveCounter, kind: 'lock', ...extra
        } as LastMove;
    }
}
