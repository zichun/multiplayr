/**
 * host-icons.ts
 *
 * Flat, geometric `GAME_ICONS` — one per game — that belong to the rules layer
 * so a game can reference its own emblem. Each rule points at its icon from the
 * `MPRULES` metadefinition (`glyph: GAME_ICONS.<game>`), and any consumer — the
 * host page browser, a game's own React views (via `ExpressiveIcon`), a lobby
 * badge — reuses the same definition rather than re-drawing it.
 *
 * Each icon is authored in the card-renderer `IconObject` DSL (the same 0-100
 * viewBox, primitive shapes, and negative-space recipe used by SkullAssets /
 * CourtisansAssets), so the whole platform shares one iconographic language.
 *
 * These icons rely purely on painter's-order layering for negative space (draw
 * the silhouette in `primary`, punch details back in `background`) — no boolean
 * masks — so they render identically through the React `ExpressiveIcon` and
 * through the card-renderer's React-free `iconToSvg()` helper (used by the
 * jQuery host page), and a single hue reads cleanly when a glyph is dimmed to a
 * watermark.
 */

import { IconObject, IconLayer, PrimitiveShape } from '../client/lib/card-renderer/types';

// ---------------------------------------------------------------------------
// Authoring shorthands
// ---------------------------------------------------------------------------

type Extra = Partial<Pick<PrimitiveShape, 'stroke' | 'strokeWidth' | 'opacity' | 'customPath'>>;

// solid silhouette piece (defaults to the watermark tone, `primary`)
const S = (
    id: string,
    type: PrimitiveShape['type'],
    x: number,
    y: number,
    sx: number,
    sy: number,
    rot = 0,
    fill = 'primary',
    extra: Extra = {}
): IconLayer => ({ id, type, x, y, scaleX: sx, scaleY: sy, rotation: rot, fill, ...extra });

// knocked-out piece (drawn in the body tint, `background`, to carve negative space)
const CUT = (
    id: string,
    type: PrimitiveShape['type'],
    x: number,
    y: number,
    sx: number,
    sy: number,
    rot = 0
): IconLayer => S(id, type, x, y, sx, sy, rot, 'background');

const ring = (
    id: string,
    x: number,
    y: number,
    s: number,
    w: number,
    fill = 'primary'
): IconLayer => S(id, 'circle', x, y, s, s, 0, 'none', { stroke: fill, strokeWidth: w });

// radial helper — place `count` copies around (cx,cy) at radius r
function radial(
    prefix: string,
    count: number,
    cx: number,
    cy: number,
    r: number,
    make: (id: string, x: number, y: number, angleDeg: number) => IconLayer,
    startDeg = -90
): IconLayer[] {
    return Array.from({ length: count }, (_, i) => {
        const deg = startDeg + (360 / count) * i;
        const rad = (deg * Math.PI) / 180;
        return make(`${prefix}_${i}`, cx + r * Math.cos(rad), cy + r * Math.sin(rad), deg);
    });
}

function icon(id: string, layers: IconLayer[]): IconObject {
    return { id, name: id, layers };
}

// ---------------------------------------------------------------------------
// The game icons
// ---------------------------------------------------------------------------

export const GAME_ICONS: Record<string, IconObject> = {
    // ✊ Rock-Paper-Scissors — a fist
    rockscissorspaper: icon('rps', [
        S('palm', 'rectangle', 51, 58, 1.18, 0.98),
        S('k1', 'circle', 37, 44, 0.44, 0.44),
        S('k2', 'circle', 48, 42, 0.46, 0.46),
        S('k3', 'circle', 59, 43, 0.46, 0.46),
        S('k4', 'circle', 69, 47, 0.4, 0.4),
        S('thumb', 'circle', 30, 56, 0.5, 0.6),
        CUT('f1', 'rectangle', 44, 60, 0.045, 0.5),
        CUT('f2', 'rectangle', 55, 60, 0.045, 0.5),
        CUT('f3', 'rectangle', 65, 61, 0.045, 0.42)
    ]),

    // 🔍 Guess the odd one — magnifying glass
    theoddone: icon('magnifier', [
        ring('ring', 43, 42, 1.32, 8),
        S('handle', 'rectangle', 70, 71, 0.24, 0.7, 45)
    ]),

    // ⚔️ Coup — crossed swords
    coup: icon('swords', [
        S('blade1', 'rectangle', 50, 47, 0.13, 1.5, 45),
        S('blade2', 'rectangle', 50, 47, 0.13, 1.5, -45),
        S('guard1', 'rectangle', 34, 66, 0.42, 0.12, 45),
        S('guard2', 'rectangle', 66, 66, 0.42, 0.12, -45),
        S('hilt1', 'circle', 29, 72, 0.26, 0.26),
        S('hilt2', 'circle', 71, 72, 0.26, 0.26)
    ]),

    // 👑 Avalon — crown
    avalon: icon('crown', [
        S('band', 'rectangle', 50, 66, 1.22, 0.32),
        S('p_l', 'triangle', 32, 46, 0.5, 0.72),
        S('p_m', 'triangle', 50, 40, 0.56, 0.88),
        S('p_r', 'triangle', 68, 46, 0.5, 0.72),
        CUT('g_l', 'circle', 32, 60, 0.17, 0.17),
        CUT('g_m', 'circle', 50, 60, 0.19, 0.19),
        CUT('g_r', 'circle', 68, 60, 0.17, 0.17)
    ]),

    // 🕵️ Decrypto — a key
    decrypto: icon('key', [
        ring('bow', 34, 40, 1.02, 9),
        S('shaft', 'rectangle', 55, 60, 0.66, 0.11, 42),
        S('tooth1', 'rectangle', 66, 68, 0.1, 0.26, 42),
        S('tooth2', 'rectangle', 73, 61, 0.1, 0.2, 42)
    ]),

    // 🚩 Minesweeper Flags — flag on a pole
    minesweeperflags: icon('flag', [
        S('pole', 'rectangle', 36, 50, 0.09, 1.5),
        S('flag', 'triangle', 55, 36, 0.62, 0.9, 90)
    ]),

    // ❌ Tic-tac-toe Poker — grid + X + O
    tictactoepoker: icon('ttt', [
        S('v1', 'rectangle', 41, 50, 0.09, 1.34),
        S('v2', 'rectangle', 59, 50, 0.09, 1.34),
        S('h1', 'rectangle', 50, 41, 1.34, 0.09),
        S('h2', 'rectangle', 50, 59, 1.34, 0.09),
        S('x1', 'rectangle', 30, 30, 0.075, 0.36, 45),
        S('x2', 'rectangle', 30, 30, 0.075, 0.36, -45),
        ring('o', 70, 70, 0.4, 9)
    ]),

    // 🔢 Ito — ascending bars
    ito: icon('bars', [
        S('b1', 'rectangle', 30, 64, 0.34, 0.5),
        S('b2', 'rectangle', 50, 54, 0.34, 0.9),
        S('b3', 'rectangle', 70, 44, 0.34, 1.3)
    ]),

    // 📝 Catch Sketch — pencil
    catchsketch: icon('pencil', [
        S('body', 'rectangle', 50, 50, 0.3, 1.15, 45),
        S('tip', 'triangle', 27, 73, 0.42, 0.42, -135),
        CUT('nib', 'triangle', 24, 76, 0.16, 0.16, -135),
        S('eraser', 'rectangle', 72, 28, 0.3, 0.26, 45)
    ]),

    // 🍍 Durian — spiky fruit
    durian: icon('durian', [
        S('core', 'circle', 50, 52, 1.45, 1.45),
        ...radial('spike', 11, 50, 52, 40, (id, x, y, deg) =>
            S(id, 'triangle', x, y, 0.34, 0.5, deg + 90))
    ]),

    // 💼 Startups — briefcase
    startups: icon('briefcase', [
        S('case', 'rectangle', 50, 58, 1.34, 0.86),
        S('handle', 'arch', 50, 40, 0.42, 0.5, 0, 'none', { stroke: 'primary', strokeWidth: 7 }),
        CUT('latch', 'rectangle', 50, 50, 0.16, 0.18),
        CUT('seam', 'rectangle', 50, 52, 1.34, 0.045)
    ]),

    // 🧠 Clever — a die
    clever: icon('die', [
        S('die', 'rectangle', 50, 50, 1.52, 1.52),
        CUT('p1', 'circle', 36, 36, 0.15, 0.15),
        CUT('p2', 'circle', 64, 36, 0.15, 0.15),
        CUT('p3', 'circle', 50, 50, 0.15, 0.15),
        CUT('p4', 'circle', 36, 64, 0.15, 0.15),
        CUT('p5', 'circle', 64, 64, 0.15, 0.15)
    ]),

    // ⏳ That Time You Killed Me — hourglass
    ttykm: icon('hourglass', [
        S('cap_t', 'rectangle', 50, 22, 1.0, 0.12),
        S('cap_b', 'rectangle', 50, 78, 1.0, 0.12),
        S('top', 'triangle', 50, 39, 0.86, 0.72, 180),
        S('bot', 'triangle', 50, 61, 0.86, 0.72, 0)
    ]),

    // 🤼 Maskmen — luchador mask
    maskmen: icon('mask', [
        S('head', 'circle', 50, 50, 1.62, 1.72),
        CUT('brow', 'triangle', 50, 32, 0.5, 0.34, 180),
        CUT('eye_l', 'circle', 40, 46, 0.26, 0.34),
        CUT('eye_r', 'circle', 60, 46, 0.26, 0.34),
        CUT('mouth', 'rectangle', 50, 66, 0.46, 0.12)
    ]),

    // 🪳 Cockroach Poker — beetle
    cockroach: icon('beetle', [
        S('body', 'circle', 50, 54, 1.16, 1.62),
        S('head', 'circle', 50, 30, 0.62, 0.5),
        S('ant_l', 'rectangle', 41, 19, 0.045, 0.42, -28),
        S('ant_r', 'rectangle', 59, 19, 0.045, 0.42, 28),
        S('leg_l1', 'rectangle', 30, 44, 0.04, 0.34, 55),
        S('leg_l2', 'rectangle', 28, 55, 0.04, 0.34, 80),
        S('leg_l3', 'rectangle', 30, 66, 0.04, 0.34, 110),
        S('leg_r1', 'rectangle', 70, 44, 0.04, 0.34, -55),
        S('leg_r2', 'rectangle', 72, 55, 0.04, 0.34, -80),
        S('leg_r3', 'rectangle', 70, 66, 0.04, 0.34, -110),
        CUT('split', 'rectangle', 50, 56, 0.045, 1.3)
    ]),

    // 🐫 Jaipur — balance scales (trading)
    jaipur: icon('scales', [
        S('post', 'rectangle', 50, 52, 0.09, 1.32),
        S('beam', 'rectangle', 50, 30, 1.42, 0.09),
        S('top', 'circle', 50, 28, 0.14, 0.14),
        S('ch_l', 'rectangle', 27, 41, 0.03, 0.42),
        S('ch_r', 'rectangle', 73, 41, 0.03, 0.42),
        S('pan_l', 'semi-circle', 27, 52, 0.72, 0.6, 180),
        S('pan_r', 'semi-circle', 73, 52, 0.72, 0.6, 180),
        S('base', 'triangle', 50, 74, 0.66, 0.4)
    ]),

    // 💎 Splendor Duel — gem
    splendorduel: icon('gem', [
        S('gem', 'rectangle', 50, 50, 1.05, 1.05, 45),
        CUT('f_top', 'rectangle', 50, 36, 0.62, 0.035),
        CUT('f_l', 'rectangle', 44, 52, 0.03, 0.6, 40),
        CUT('f_r', 'rectangle', 56, 52, 0.03, 0.6, -40)
    ]),

    // 💠 Splendor — a cluster of three faceted gems
    splendor: icon('gems', [
        S('g3', 'rectangle', 50, 36, 0.62, 0.62, 45),
        CUT('g3c', 'rectangle', 50, 36, 0.3, 0.03, 45),
        S('g1', 'rectangle', 33, 60, 0.52, 0.52, 45),
        CUT('g1c', 'rectangle', 33, 60, 0.26, 0.03, 45),
        S('g2', 'rectangle', 67, 60, 0.52, 0.52, 45),
        CUT('g2c', 'rectangle', 67, 60, 0.26, 0.03, 45)
    ]),

    // 🐱 Cat in the Box — cat face
    catinthebox: icon('cat', [
        S('ear_l', 'triangle', 33, 30, 0.6, 0.72),
        S('ear_r', 'triangle', 67, 30, 0.6, 0.72),
        S('head', 'circle', 50, 55, 1.6, 1.42),
        CUT('eye_l', 'circle', 40, 52, 0.17, 0.28),
        CUT('eye_r', 'circle', 60, 52, 0.17, 0.28),
        CUT('nose', 'triangle', 50, 63, 0.16, 0.14, 180),
        CUT('wk1', 'rectangle', 26, 60, 0.24, 0.03),
        CUT('wk2', 'rectangle', 74, 60, 0.24, 0.03)
    ]),

    // 🔺 Trio — three rings
    trio: icon('trio', [
        S('c_top', 'circle', 50, 33, 0.72, 0.72),
        S('c_l', 'circle', 33, 64, 0.72, 0.72),
        S('c_r', 'circle', 67, 64, 0.72, 0.72),
        CUT('h_top', 'circle', 50, 33, 0.32, 0.32),
        CUT('h_l', 'circle', 33, 64, 0.32, 0.32),
        CUT('h_r', 'circle', 67, 64, 0.32, 0.32)
    ]),

    // 🗡️ Regicide — dagger
    regicide: icon('dagger', [
        S('blade', 'triangle', 50, 36, 0.5, 1.5),
        S('guard', 'rectangle', 50, 66, 0.96, 0.13),
        S('grip', 'rectangle', 50, 76, 0.17, 0.4),
        S('pommel', 'circle', 50, 86, 0.2, 0.2)
    ]),

    // 🐚 Sea Salt & Paper — scallop shell
    seasalt: icon('shell', [
        S('shell', 'semi-circle', 50, 62, 1.9, 1.7, 0),
        CUT('r_c', 'rectangle', 50, 50, 0.05, 0.5),
        CUT('r_l1', 'rectangle', 41, 51, 0.05, 0.48, 22),
        CUT('r_l2', 'rectangle', 33, 54, 0.05, 0.42, 44),
        CUT('r_r1', 'rectangle', 59, 51, 0.05, 0.48, -22),
        CUT('r_r2', 'rectangle', 67, 54, 0.05, 0.42, -44),
        S('hinge', 'circle', 50, 62, 0.2, 0.2)
    ]),

    // 💀 Skull — friendly geometric skull
    skull: icon('skull', [
        S('cranium', 'circle', 50, 44, 1.5, 1.5),
        S('jaw', 'rectangle', 50, 64, 0.64, 0.5),
        S('jaw_l', 'circle', 36, 66, 0.48, 0.48),
        S('jaw_r', 'circle', 64, 66, 0.48, 0.48),
        CUT('eye_l', 'circle', 38, 44, 0.42, 0.46),
        CUT('eye_r', 'circle', 62, 44, 0.42, 0.46),
        CUT('nose', 'triangle', 50, 55, 0.24, 0.24, 180),
        CUT('t1', 'rectangle', 44, 66, 0.05, 0.3),
        CUT('t2', 'rectangle', 50, 66, 0.05, 0.32),
        CUT('t3', 'rectangle', 56, 66, 0.05, 0.3)
    ]),

    // 🎭 Courtisans — masquerade mask on a stick
    courtisans: icon('masque', [
        S('stick', 'rectangle', 70, 76, 0.07, 0.6, 28),
        S('mask', 'circle', 50, 48, 1.92, 1.2),
        S('flourish', 'triangle', 50, 27, 0.32, 0.4),
        CUT('eye_l', 'circle', 37, 47, 0.32, 0.26),
        CUT('eye_r', 'circle', 63, 47, 0.32, 0.26)
    ]),

    // 🏃 Magical Athletes — trophy
    magicalathletes: icon('trophy', [
        ring('h_l', 30, 40, 0.52, 7),
        ring('h_r', 70, 40, 0.52, 7),
        S('cup', 'arch', 50, 42, 1.16, 1.0, 180),
        S('stem', 'rectangle', 50, 68, 0.16, 0.34),
        S('base', 'rectangle', 50, 80, 0.72, 0.13),
        CUT('star', 'circle', 50, 40, 0.22, 0.22)
    ]),

    // 👑 Off With Their Heads — crowned heart (Queen of Hearts)
    offwiththeirheads: icon('crownheart', [
        S('h_l', 'circle', 40, 48, 0.66, 0.66),
        S('h_r', 'circle', 60, 48, 0.66, 0.66),
        S('h_b', 'triangle', 50, 60, 1.02, 1.1, 180),
        S('cband', 'rectangle', 50, 27, 0.5, 0.12),
        S('cp1', 'triangle', 41, 21, 0.2, 0.26),
        S('cp2', 'triangle', 50, 19, 0.22, 0.3),
        S('cp3', 'triangle', 59, 21, 0.2, 0.26)
    ]),

    // 🧩 Project L — an L polyomino
    projectl: icon('polyomino', [
        S('s1', 'rectangle', 40, 29, 0.44, 0.44),
        S('s2', 'rectangle', 40, 51, 0.44, 0.44),
        S('s3', 'rectangle', 40, 73, 0.44, 0.44),
        S('s4', 'rectangle', 62, 73, 0.44, 0.44),
        CUT('gap1', 'rectangle', 40, 40, 0.44, 0.02),
        CUT('gap2', 'rectangle', 40, 62, 0.44, 0.02),
        CUT('gap3', 'rectangle', 51, 73, 0.02, 0.44)
    ]),

    // 🎲 Moonrollers — a die with a crescent moon knocked out
    moonrollers: icon('moondie', [
        S('die', 'rectangle', 50, 50, 1.5, 1.5),
        CUT('moon', 'circle', 54, 46, 0.64, 0.64),
        S('bite', 'circle', 64, 40, 0.54, 0.54),
        CUT('star1', 'circle', 33, 66, 0.1, 0.1),
        CUT('star2', 'circle', 40, 74, 0.06, 0.06)
    ]),

    // 🐾 Night at the Zoo — a paw print (pad + four toes)
    nightzoo: icon('paw', [
        S('pad', 'circle', 50, 62, 0.98, 0.82),
        S('t1', 'circle', 30, 40, 0.4, 0.46),
        S('t2', 'circle', 43, 30, 0.4, 0.46),
        S('t3', 'circle', 57, 30, 0.4, 0.46),
        S('t4', 'circle', 70, 40, 0.4, 0.46)
    ]),

    // 🐦 Wingspan Pocket — a flat geometric bird head with a bullseye eye + beak
    wingspanpocket: icon('bird', [
        S('body', 'circle', 44, 60, 1.36, 1.28),
        S('tail', 'triangle', 16, 52, 0.5, 0.42, -60),
        S('head', 'circle', 62, 40, 0.94, 0.94),
        S('beak', 'triangle', 80, 40, 0.36, 0.32, 90),
        CUT('eye', 'circle', 64, 37, 0.2, 0.2)
    ]),

    // 🌿 Harmonies — nature landscape disc (mountain peak, tree crown, water wave)
    harmonies: icon('nature', [
        S('disc', 'circle', 50, 50, 1.84, 1.84),
        CUT('mtn', 'triangle', 36, 46, 0.72, 0.76),
        CUT('tree_top', 'circle', 64, 42, 0.54, 0.54),
        CUT('tree_trunk', 'rectangle', 64, 58, 0.12, 0.32),
        CUT('wave', 'rectangle', 50, 72, 1.3, 0.12)
    ])
};

