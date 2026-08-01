/**
 * MagicalAthletesAssets.ts
 * Flat, soft-colour, geometric iconography for "Magical Athletes".
 *
 * Every racer is a single flat COIN — a solid pastel disc with one simple glyph
 * punched over it in warm ivory (with the occasional disc-toned notch for depth).
 * The negative-space recipe is the platform house style (Skull discs, Splendor
 * Duel coins, Courtisans crests): no blurred shadows, just clean tone. Each of the
 * 36 racers gets a deliberately distinct silhouette so a token reads at a glance,
 * even at the small size the mobile race track renders them.
 *
 * The board glyphs (flag / star / arrow / trip) share the same language so the
 * whole game looks like one set.
 */

import { IconObject, IconLayer, Palette, PrimitiveShape } from '../../client/lib/card-renderer/types';
import { ROSTER } from './MagicalAthletesGameState';

export const IVORY = '#fbf8f2';   // negative-space glyph colour
export const PAPER = '#f6f7fa';   // page / board background
export const INK = '#39414f';     // neutral text ink

// A soft, flat palette (Cat-in-the-Box / Courtisans register — never neon).
export const ATH_PALETTE: Palette = {
    id: 'magicalathletes',
    name: 'Magical Athletes',
    background: IVORY,
    border: '#dfe3ea',
    primary: '#7c8aa5',
    secondary: '#e6d59a',
    accent: '#f0a6c0',
    charcoal: '#4a5262',
    text: INK,
    panelBg: '#ffffff',
    tertiary: '#8fbf9c',
    success: '#76c4a0',
    danger: '#e88a86'
};

type Part = Omit<PrimitiveShape, 'id'>;

// A racer coin: pastel disc + glyph layers.
function coin(id: string, color: string, parts: Part[]): IconObject {
    const layers: IconLayer[] = [
        { id: `${id}_disc`, type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: color },
        ...parts.map((p, i) => ({ ...(p as any), id: `${id}_${i}` }))
    ];
    return { id, name: id, layers };
}

// shorthand builders (glyph pieces default to ivory)
const W = IVORY;
const rc = (x: number, y: number, sx: number, sy: number, rot = 0, fill = W, op = 1): Part =>
    ({ type: 'circle', x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, opacity: op });
const rr = (x: number, y: number, sx: number, sy: number, rot = 0, fill = W, op = 1): Part =>
    ({ type: 'rectangle', x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, opacity: op });
const rt = (x: number, y: number, sx: number, sy: number, rot = 0, fill = W, op = 1): Part =>
    ({ type: 'triangle', x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, opacity: op });
const ra = (x: number, y: number, sx: number, sy: number, rot = 0, fill = W, op = 1): Part =>
    ({ type: 'arch', x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, opacity: op });
const rs = (x: number, y: number, sx: number, sy: number, rot = 0, fill = W, op = 1): Part =>
    ({ type: 'semi-circle', x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, opacity: op });

// colour lookup so a glyph "notch" can punch back to the disc colour
const COLOR: Record<string, string> = Object.fromEntries(ROSTER.map(r => [r.id, r.color]));

// ---------------------------------------------------------------------------
// The 36 racer coins
// ---------------------------------------------------------------------------

export const RACER_ICONS: Record<string, IconObject> = {
    alchemist:   coin('alchemist',   COLOR.alchemist,   [rt(50, 60, 0.66, 0.62, 180), rr(50, 32, 0.18, 0.34), rc(50, 62, 0.16, 0.16, 0, COLOR.alchemist)]),
    babayaga:    coin('babayaga',    COLOR.babayaga,    [rr(56, 44, 0.1, 0.72, 35), rt(38, 66, 0.5, 0.42, 205)]),
    banana:      coin('banana',      COLOR.banana,      [ra(50, 52, 0.72, 0.92, 40), rc(50, 52, 0.5, 0.7, 40, COLOR.banana)]),
    blimp:       coin('blimp',       COLOR.blimp,       [rc(47, 50, 1.2, 0.66), rt(76, 50, 0.28, 0.4, 90, COLOR.blimp)]),
    centaur:     coin('centaur',     COLOR.centaur,     [ra(50, 46, 0.82, 0.92, 180), rc(50, 52, 0.4, 0.5, 0, COLOR.centaur)]),
    cheerleader: coin('cheerleader', COLOR.cheerleader, [rc(50, 50, 0.42, 0.42), rt(50, 24, 0.28, 0.3), rt(50, 76, 0.28, 0.3, 180), rt(26, 50, 0.3, 0.28, -90), rt(74, 50, 0.3, 0.28, 90)]),
    coach:       coin('coach',       COLOR.coach,       [rc(44, 52, 0.66, 0.66), rr(66, 44, 0.3, 0.2), rc(44, 52, 0.24, 0.24, 0, COLOR.coach)]),
    copycat:     coin('copycat',     COLOR.copycat,     [rr(58, 42, 0.5, 0.5), rr(42, 58, 0.5, 0.5), rr(42, 58, 0.3, 0.3, 0, COLOR.copycat)]),
    dicemonger:  coin('dicemonger',  COLOR.dicemonger,  [rr(50, 50, 0.66, 0.66), rc(36, 36, 0.14, 0.14, 0, COLOR.dicemonger), rc(50, 50, 0.14, 0.14, 0, COLOR.dicemonger), rc(64, 64, 0.14, 0.14, 0, COLOR.dicemonger)]),
    duelist:     coin('duelist',     COLOR.duelist,     [rr(50, 50, 0.12, 0.86, 45), rr(50, 50, 0.12, 0.86, -45), rc(50, 50, 0.18, 0.18, 0, COLOR.duelist)]),
    egg:         coin('egg',         COLOR.egg,         [rc(50, 53, 0.66, 0.82), rr(38, 50, 0.24, 0.06, 20, COLOR.egg), rr(60, 44, 0.2, 0.06, -20, COLOR.egg)]),
    flipflop:    coin('flipflop',    COLOR.flipflop,    [rt(40, 38, 0.4, 0.4, -90), rt(60, 62, 0.4, 0.4, 90)]),
    genius:      coin('genius',      COLOR.genius,      [rc(50, 44, 0.62, 0.62), rr(50, 68, 0.26, 0.16), rr(50, 44, 0.4, 0.06, 0, COLOR.genius)]),
    gunk:        coin('gunk',        COLOR.gunk,        [rc(50, 46, 0.78, 0.66), rc(37, 66, 0.2, 0.2), rc(61, 70, 0.16, 0.16)]),
    hare:        coin('hare',        COLOR.hare,        [rc(50, 62, 0.6, 0.6), rc(42, 34, 0.16, 0.5, -8), rc(58, 34, 0.16, 0.5, 8), rc(42, 34, 0.06, 0.3, -8, COLOR.hare), rc(58, 34, 0.06, 0.3, 8, COLOR.hare)]),
    heckler:     coin('heckler',     COLOR.heckler,     [rc(50, 44, 0.86, 0.6), rt(40, 66, 0.22, 0.26, 200), rc(40, 44, 0.1, 0.1, 0, COLOR.heckler), rc(60, 44, 0.1, 0.1, 0, COLOR.heckler)]),
    hugebaby:    coin('hugebaby',    COLOR.hugebaby,    [rc(50, 52, 1.02, 1.02), rc(50, 52, 0.5, 0.5, 0, COLOR.hugebaby), rc(50, 52, 0.24, 0.24)]),
    hypnotist:   coin('hypnotist',   COLOR.hypnotist,   [rc(50, 50, 0.92, 0.92), rc(50, 50, 0.62, 0.62, 0, COLOR.hypnotist), rc(50, 50, 0.34, 0.34), rc(50, 50, 0.12, 0.12, 0, COLOR.hypnotist)]),
    inchworm:    coin('inchworm',    COLOR.inchworm,    [rc(30, 56, 0.28, 0.28), rc(50, 50, 0.3, 0.3), rc(70, 44, 0.28, 0.28)]),
    lackey:      coin('lackey',      COLOR.lackey,      [rt(50, 52, 0.66, 0.56), rc(50, 30, 0.2, 0.2), rr(50, 70, 0.4, 0.08)]),
    leaptoad:    coin('leaptoad',    COLOR.leaptoad,    [ra(50, 58, 0.82, 0.72), rc(50, 38, 0.2, 0.2)]),
    legs:        coin('legs',        COLOR.legs,        [rr(42, 56, 0.14, 0.66), rr(58, 56, 0.14, 0.66), rr(50, 30, 0.4, 0.12)]),
    lovableloser: coin('lovableloser', COLOR.lovableloser, [rc(50, 44, 0.34, 0.34), rt(50, 62, 0.5, 0.5, 180)]),
    magician:    coin('magician',    COLOR.magician,    [rr(50, 66, 0.82, 0.14), rr(50, 46, 0.44, 0.52), rr(50, 62, 0.5, 0.08, 0, COLOR.magician)]),
    mastermind:  coin('mastermind',  COLOR.mastermind,  [rc(50, 48, 0.82, 0.78), rc(40, 44, 0.14, 0.14, 0, COLOR.mastermind), rc(60, 44, 0.14, 0.14, 0, COLOR.mastermind), rc(50, 62, 0.14, 0.14, 0, COLOR.mastermind)]),
    mouth:       coin('mouth',       COLOR.mouth,       [rc(50, 50, 0.88, 0.88), rr(50, 50, 0.88, 0.12, 0, COLOR.mouth), rt(38, 44, 0.12, 0.14, 180, COLOR.mouth), rt(62, 44, 0.12, 0.14, 180, COLOR.mouth)]),
    partyanimal: coin('partyanimal', COLOR.partyanimal, [{ type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill: W, customPath: 'M 50 12 L 61 38 L 89 38 L 66 56 L 75 84 L 50 66 L 25 84 L 34 56 L 11 38 L 39 38 Z' } as any]),
    rocket:      coin('rocket',      COLOR.rocket,      [rt(50, 32, 0.4, 0.5), rr(50, 56, 0.3, 0.52), rt(36, 74, 0.18, 0.22, 180), rt(64, 74, 0.18, 0.22, 180)]),
    romantic:    coin('romantic',    COLOR.romantic,    [rc(40, 42, 0.42, 0.42), rc(60, 42, 0.42, 0.42), rt(50, 66, 0.72, 0.52, 180)]),
    scoocher:    coin('scoocher',    COLOR.scoocher,    [rt(40, 50, 0.36, 0.56, 90), rt(63, 50, 0.36, 0.56, 90)]),
    sisyphus:    coin('sisyphus',    COLOR.sisyphus,    [rt(52, 66, 0.92, 0.56), rc(40, 42, 0.34, 0.34)]),
    skipper:     coin('skipper',     COLOR.skipper,     [rc(50, 28, 0.2, 0.2), rr(50, 54, 0.12, 0.62), ra(50, 62, 0.7, 0.42, 180)]),
    stickler:    coin('stickler',    COLOR.stickler,    [rr(41, 60, 0.12, 0.36, 45), rr(58, 46, 0.12, 0.7, -32)]),
    suckerfish:  coin('suckerfish',  COLOR.suckerfish,  [rc(46, 50, 0.86, 0.6), rt(74, 50, 0.4, 0.52, 270), rc(34, 48, 0.12, 0.12, 0, COLOR.suckerfish)]),
    thirdwheel:  coin('thirdwheel',  COLOR.thirdwheel,  [rc(50, 50, 0.9, 0.9), rc(50, 50, 0.5, 0.5, 0, COLOR.thirdwheel), rr(50, 50, 0.9, 0.08, 0, COLOR.thirdwheel), rr(50, 50, 0.08, 0.9, 0, COLOR.thirdwheel)]),
    twin:        coin('twin',        COLOR.twin,        [rc(38, 50, 0.44, 0.66), rc(62, 50, 0.44, 0.66), rr(50, 50, 0.06, 0.72, 0, COLOR.twin)])
};

// ---------------------------------------------------------------------------
// Board glyphs
// ---------------------------------------------------------------------------

export const START_ICON: IconObject = coin('ma_start', '#8fbf9c', [rr(40, 50, 0.1, 0.72), rt(58, 38, 0.44, 0.34, 90)]);
export const FINISH_ICON: IconObject = coin('ma_finish', '#4a5262', [
    rr(38, 38, 0.24, 0.24), rr(62, 38, 0.24, 0.24), rr(50, 50, 0.24, 0.24), rr(38, 62, 0.24, 0.24), rr(62, 62, 0.24, 0.24)
]);
export const STAR_ICON: IconObject = coin('ma_star', '#e6c766', [{ type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, fill: W, customPath: 'M 50 14 L 61 39 L 88 39 L 66 56 L 74 83 L 50 67 L 26 83 L 34 56 L 12 39 L 39 39 Z' } as any]);
export const ARROW_ICON: IconObject = coin('ma_arrow', '#6f9ac9', [rt(58, 50, 0.5, 0.7, 90), rr(34, 50, 0.34, 0.2)]);
export const TRIP_ICON: IconObject = coin('ma_trip', '#d0a06a', [ra(50, 52, 0.8, 0.86, 30), rc(46, 52, 0.5, 0.6, 30, '#d0a06a')]);

// ---------------------------------------------------------------------------
// Aggregate map (for the inspector + customIcons)
// ---------------------------------------------------------------------------

export const MAGICAL_ATHLETES_ICONS: Record<string, IconObject> = {
    ...RACER_ICONS,
    ma_start: START_ICON,
    ma_finish: FINISH_ICON,
    ma_star: STAR_ICON,
    ma_arrow: ARROW_ICON,
    ma_trip: TRIP_ICON
};

export function racerColor(racerId: string): string {
    return COLOR[racerId] || ATH_PALETTE.primary;
}
