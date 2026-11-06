/**
 * ParksScenes.ts — the landscape kit behind every Park card and Trail Site.
 *
 * A scene is painter's-order stacking over a 0–100 square: sky, then something
 * in the sky, then far land, mid land, water and a foreground. Each natural
 * feature below is a small geometric function taking a `ScenePalette`, so the
 * same mountain or pine reads as Denali at noon or Yosemite under the stars
 * purely through the palette it is handed. Nothing uses gradients or masks:
 * depth is three or four flat tones, and facets are a second flat tone laid on
 * one side of a shape.
 */

import { IconLayer, PrimitiveShape } from '../../client/lib/card-renderer/types';

export interface ScenePalette {
    sky: string;
    sky2: string;      // lower, lighter sky band
    disc: string;      // sun or moon
    far: string;       // distant land
    mid: string;
    near: string;
    ground: string;
    water: string;
    foam: string;
    leaf: string;
    leaf2: string;     // the shaded side of foliage
    trunk: string;
    rock: string;
    rock2: string;     // the shaded side of rock
    snow: string;
}

export const SCENE_PALETTES: Record<string, ScenePalette> = {
    dawn: {
        sky: '#f8d7c2', sky2: '#fce9d8', disc: '#f4a27c', far: '#d3aec6', mid: '#9d8fbb', near: '#6a6f9f', ground: '#46577a',
        water: '#8fc6d6', foam: '#e2f3f3', leaf: '#5f9a84', leaf2: '#3f7869', trunk: '#6b5560', rock: '#a98792', rock2: '#83667a', snow: '#fff6ec'
    },
    noon: {
        sky: '#cbe6ee', sky2: '#e3f3f3', disc: '#f7d26f', far: '#a8cdd6', mid: '#82b8a5', near: '#559a85', ground: '#3d7d6b',
        water: '#62b3d1', foam: '#d9f1f5', leaf: '#529d74', leaf2: '#347d5d', trunk: '#7a5b45', rock: '#aaa59b', rock2: '#83807a', snow: '#ffffff'
    },
    dusk: {
        sky: '#f2b49a', sky2: '#f8d0b0', disc: '#fce5a8', far: '#cb8d90', mid: '#936688', near: '#5e4877', ground: '#3b3459',
        water: '#8493c4', foam: '#ced7ea', leaf: '#5b6d7c', leaf2: '#3e4f66', trunk: '#46395c', rock: '#a56e7c', rock2: '#7c5170', snow: '#fde9d6'
    },
    night: {
        sky: '#28325e', sky2: '#343f72', disc: '#f4eac8', far: '#4a588d', mid: '#39467d', near: '#262f5a', ground: '#1b2247',
        water: '#506ca8', foam: '#adc1df', leaf: '#316168', leaf2: '#204751', trunk: '#1d2549', rock: '#5c6189', rock2: '#404572', snow: '#e1e8f6'
    },
    arctic: {
        sky: '#d9ebf2', sky2: '#ebf5f6', disc: '#fbeabb', far: '#bcd6e2', mid: '#93b9cb', near: '#6c97ad', ground: '#4d7d94',
        water: '#6eb2cb', foam: '#e6f6f8', leaf: '#5a8f88', leaf2: '#3e7270', trunk: '#59616b', rock: '#8197a8', rock2: '#61788b', snow: '#ffffff'
    },
    desert: {
        sky: '#fbe6c0', sky2: '#fdf1d6', disc: '#f1905c', far: '#ecc595', mid: '#e0a06c', near: '#c9804f', ground: '#e9c78f',
        water: '#7cb9bf', foam: '#d8efec', leaf: '#7fa06b', leaf2: '#5c8056', trunk: '#8a6a4a', rock: '#cb744c', rock2: '#a5593d', snow: '#fff4e0'
    },
    redrock: {
        sky: '#c9e4e6', sky2: '#e0f1ee', disc: '#fbe4a8', far: '#e6a680', mid: '#d0734f', near: '#ab523d', ground: '#823f35',
        water: '#65b0bd', foam: '#d3eeee', leaf: '#6f9a6e', leaf2: '#4f7a58', trunk: '#6e4a38', rock: '#d0734f', rock2: '#a8503c', snow: '#fff2e3'
    },
    tropic: {
        sky: '#bfe9e3', sky2: '#daf4ea', disc: '#fbd87c', far: '#82cdb6', mid: '#52b49c', near: '#31917f', ground: '#f3e0b4',
        water: '#40b4c5', foam: '#c9f1ea', leaf: '#3fa27b', leaf2: '#208064', trunk: '#8e6b4c', rock: '#a9987c', rock2: '#857660', snow: '#ffffff'
    },
    autumn: {
        sky: '#f4e6c9', sky2: '#faf0dd', disc: '#ea905c', far: '#dbb38a', mid: '#cb8d5d', near: '#aa6d47', ground: '#71603f',
        water: '#7ab3b5', foam: '#dcefe9', leaf: '#d77e45', leaf2: '#ba5730', trunk: '#5f4632', rock: '#a78b70', rock2: '#826a56', snow: '#fff7ea'
    },
    mist: {
        sky: '#d7e3dd', sky2: '#e6eee8', disc: '#f4f0dd', far: '#b6cac1', mid: '#92b0a2', near: '#628c7b', ground: '#416d5d',
        water: '#86b9b8', foam: '#e3f1ee', leaf: '#518c6e', leaf2: '#316c54', trunk: '#54483f', rock: '#9caaa3', rock2: '#7a8a83', snow: '#ffffff'
    },
    lagoon: {
        sky: '#f7d9d0', sky2: '#fcebe0', disc: '#fbbe88', far: '#9fd3cb', mid: '#62bcae', near: '#3d9a90', ground: '#f4dcb6',
        water: '#55bfd0', foam: '#d5f4ef', leaf: '#46a585', leaf2: '#2a8569', trunk: '#8b6a4e', rock: '#b59a82', rock2: '#907a66', snow: '#fff'
    },
    aurora: {
        sky: '#1f2f54', sky2: '#2a3d63', disc: '#e9f2d8', far: '#40587e', mid: '#2f4570', near: '#20315a', ground: '#172448',
        water: '#40638f', foam: '#a7c6da', leaf: '#2a6364', leaf2: '#1a484e', trunk: '#172448', rock: '#55698c', rock2: '#3b4f76', snow: '#e6f0f6'
    }
};

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

let nextId = 0;
const uid = (): string => `n${++nextId}`;

/** A polygon or free path in absolute 0–100 space. */
export function shape(d: string, fill: string, opacity?: number): IconLayer {
    const layer: PrimitiveShape = { id: uid(), type: 'bezier', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, fill, customPath: d };
    if (opacity !== undefined) layer.opacity = opacity;
    return layer;
}

export function poly(points: number[], fill: string, opacity?: number): IconLayer {
    let d = '';
    for (let i = 0; i < points.length; i += 2) d += `${i === 0 ? 'M' : 'L'} ${points[i]} ${points[i + 1]} `;
    return shape(`${d}Z`, fill, opacity);
}

/** Ellipse, using the circle primitive (radius 25 at scale 1). */
export function oval(x: number, y: number, rx: number, ry: number, fill: string, opacity?: number): IconLayer {
    const layer: PrimitiveShape = { id: uid(), type: 'circle', x, y, scaleX: rx / 25, scaleY: ry / 25, rotation: 0, fill };
    if (opacity !== undefined) layer.opacity = opacity;
    return layer;
}

export const box = (x: number, y: number, w: number, h: number, fill: string, opacity?: number): IconLayer =>
    poly([x, y, x + w, y, x + w, y + h, x, y + h], fill, opacity);

type Layers = IconLayer[];

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

export const sky = (P: ScenePalette, horizon = 58): Layers => [
    box(0, 0, 100, 100, P.sky),
    box(0, horizon * 0.62, 100, 100, P.sky2)
];

export const sun = (P: ScenePalette, x: number, y: number, r = 9): Layers => [
    oval(x, y, r * 1.55, r * 1.55, P.sky2, 0.7),
    oval(x, y, r, r, P.disc)
];

export const moon = (P: ScenePalette, x: number, y: number, r = 8): Layers => [
    oval(x, y, r, r, P.disc),
    oval(x + r * 0.5, y - r * 0.2, r * 0.84, r * 0.84, P.sky)
];

/** Four-point sparkles at [x, y, size] triples. */
export function stars(P: ScenePalette, list: number[][]): Layers {
    return list.map(([x, y, s]) => poly([
        x, y - s, x + s * 0.28, y - s * 0.28, x + s, y, x + s * 0.28, y + s * 0.28,
        x, y + s, x - s * 0.28, y + s * 0.28, x - s, y, x - s * 0.28, y - s * 0.28
    ], P.disc));
}

export const STARFIELD = [[12, 12, 2.4], [28, 24, 1.5], [44, 9, 2], [62, 20, 1.6], [78, 8, 2.6], [90, 26, 1.6], [8, 34, 1.4], [54, 34, 1.3], [38, 37, 1.1]];

export const cloud = (P: ScenePalette, x: number, y: number, s = 1, tone?: string): Layers => {
    const c = tone || P.sky2;
    return [
        oval(x - 8 * s, y, 7 * s, 4.4 * s, c),
        oval(x, y - 2.6 * s, 8 * s, 6 * s, c),
        oval(x + 8.5 * s, y, 6.5 * s, 4 * s, c),
        box(x - 12 * s, y, 24 * s, 4.2 * s, c)
    ];
};

/** Ribbons of northern light. */
export const aurora = (): Layers => [
    shape('M -4 34 C 14 10 28 40 46 20 C 62 4 78 28 104 8 L 104 22 C 80 42 62 18 46 36 C 28 54 14 26 -4 50 Z', '#7fe3bb', 0.55),
    shape('M -4 18 C 18 0 34 22 54 8 C 70 -2 86 12 104 0 L 104 8 C 86 22 70 8 54 18 C 34 32 18 12 -4 28 Z', '#a98fe3', 0.5)
];

// ---------------------------------------------------------------------------
// Land
// ---------------------------------------------------------------------------

/** A jagged skyline through [x, y, ...] points, filled down to the card's foot. */
export const ridge = (points: number[], fill: string): IconLayer =>
    poly([points[0], 104, ...points, points[points.length - 2], 104], fill);

/** Soft rolling land: `y` baseline, `amp` swell, `phase` flips which way it rolls first. */
export const hills = (y: number, amp: number, fill: string, phase = 1): IconLayer =>
    shape(`M -4 104 L -4 ${y} Q 24 ${y - amp * phase} 50 ${y} T 104 ${y} L 104 104 Z`, fill);

/** Faceted peak, with a shaded right face and an optional zig-zag snowcap. */
export function peak(x: number, base: number, w: number, h: number, fill: string, shade: string, snow?: string): Layers {
    const ax = x, ay = base - h;
    const lx = x - w / 2, rx = x + w / 2;
    const out: Layers = [
        poly([lx, base, ax, ay, rx, base], fill),
        poly([ax, ay, rx, base, x + w * 0.04, base, x + w * 0.1, ay + h * 0.55, x - w * 0.02, ay + h * 0.28], shade)
    ];
    if (snow) {
        const k = 0.3;
        const sl = ax - (w / 2) * k, sr = ax + (w / 2) * k, sy = ay + h * k;
        out.push(poly([
            ax, ay, sr, sy,
            ax + (sr - ax) * 0.5, sy - h * 0.05,
            ax + (sr - ax) * 0.1, sy + h * 0.05,
            ax - (ax - sl) * 0.32, sy - h * 0.06,
            ax - (ax - sl) * 0.62, sy + h * 0.03,
            sl, sy
        ], snow));
    }
    return out;
}

/** Flat-topped mesa with strata stripes; `narrow` makes it a butte. */
export function mesa(x: number, base: number, w: number, h: number, fill: string, shade: string, narrow = 0.72): Layers {
    const top = base - h;
    const tw = w * narrow;
    const edge = (t: number) => { // half-width at height fraction t from the top
        return tw / 2 + (w - tw) / 2 * t;
    };
    const band = (t0: number, t1: number) => poly([
        x - edge(t0), top + h * t0, x + edge(t0), top + h * t0,
        x + edge(t1), top + h * t1, x - edge(t1), top + h * t1
    ], shade);
    return [
        poly([x - w / 2, base, x - tw / 2, top, x + tw / 2, top, x + w / 2, base], fill),
        band(0.2, 0.3),
        band(0.55, 0.66),
        poly([x + tw * 0.16, top, x + tw / 2, top, x + w / 2, base, x + w * 0.2, base], shade, 0.45)
    ];
}

/** A row of slim rock spires, each capped with a wider stone. */
export function hoodoos(xs: number[], base: number, h: number, fill: string, shade: string, cap: string): Layers {
    const out: Layers = [];
    xs.forEach((x, i) => {
        const hh = h * (i % 2 === 0 ? 1 : 0.76);
        const w = 6.4;
        const top = base - hh;
        out.push(poly([x - w / 2, base, x - w * 0.36, top + hh * 0.5, x - w * 0.44, top, x + w * 0.44, top, x + w * 0.36, top + hh * 0.5, x + w / 2, base], fill));
        out.push(poly([x, top, x + w * 0.44, top, x + w * 0.36, top + hh * 0.5, x + w / 2, base, x, base], shade));
        out.push(oval(x, top, w * 0.66, w * 0.34, cap));
    });
    return out;
}

/** Stone arch: a single horseshoe outline, shaded on its inner right. */
export function arch(x: number, base: number, w: number, h: number, t: number, fill: string, shade: string): Layers {
    const l = x - w / 2, r = x + w / 2;
    const ty = base - h;
    return [
        shape(`M ${l} ${base} C ${l} ${ty - h * 0.08} ${r} ${ty - h * 0.08} ${r} ${base} L ${r - t} ${base} C ${r - t} ${ty + h * 0.36} ${l + t} ${ty + h * 0.36} ${l + t} ${base} Z`, fill),
        shape(`M ${r} ${base} C ${r} ${ty + h * 0.2} ${x + w * 0.1} ${ty + h * 0.02} ${x} ${ty + h * 0.1} C ${x + w * 0.18} ${ty + h * 0.34} ${r - t} ${ty + h * 0.5} ${r - t} ${base} Z`, shade)
    ];
}

/** Half Dome: a rounded back falling to a sheer cut face. */
export function dome(x: number, base: number, w: number, h: number, fill: string, shade: string): Layers {
    const l = x - w / 2;
    const top = base - h;
    return [
        shape(`M ${l} ${base} C ${l + w * 0.1} ${top + h * 0.2} ${x - w * 0.1} ${top} ${x + w * 0.12} ${top} L ${x + w * 0.2} ${top + h * 0.28} L ${x + w * 0.26} ${base} Z`, fill),
        poly([x + w * 0.12, top, x + w * 0.2, top + h * 0.28, x + w * 0.26, base, x + w * 0.04, base, x + w * 0.02, top + h * 0.4], shade)
    ];
}

/** Volcano: truncated cone, crater notch, a lick of colour on its face. */
export function volcano(x: number, base: number, w: number, h: number, fill: string, shade: string, glow?: string): Layers {
    const top = base - h;
    const c = w * 0.14;
    const out: Layers = [
        poly([x - w / 2, base, x - c, top, x + c, top, x + w / 2, base], fill),
        poly([x + c * 0.2, top, x + c, top, x + w / 2, base, x + w * 0.1, base], shade)
    ];
    if (glow) {
        out.push(poly([x - c, top, x + c, top, x + c * 0.4, top + h * 0.2, x, top + h * 0.1, x - c * 0.5, top + h * 0.3], glow));
    }
    return out;
}

/** A column of steam or smoke rising in widening puffs. */
export function plume(x: number, base: number, h: number, fill: string): Layers {
    return [
        poly([x - 1.4, base, x - 3, base - h * 0.55, x + 3, base - h * 0.55, x + 1.4, base], fill),
        oval(x, base - h * 0.62, 4.6, 4, fill),
        oval(x + 3, base - h * 0.8, 5.4, 4.6, fill),
        oval(x - 2, base - h, 6.4, 5, fill)
    ];
}

/** Terraced canyon walls either side of a gorge, three flat strata per side. */
export function canyon(P: ScenePalette, floor: number, gapL: number, gapR: number): Layers {
    const steps = (x0: number, dx: number, tone: string, y: number) =>
        poly([x0, y, x0 + dx, y, x0 + dx + (dx > 0 ? 3 : -3), floor, x0, floor], tone);
    return [
        steps(-4, gapL - 6, P.far, 30),
        steps(104, -(104 - gapR) + 6, P.far, 34),
        steps(-4, gapL - 16, P.mid, 44),
        steps(104, -(104 - gapR) + 18, P.mid, 48),
        steps(-4, gapL - 26, P.near, 62),
        steps(104, -(104 - gapR) + 28, P.near, 66),
        box(-2, floor, 104, 110 - floor, P.ground)
    ];
}

/** Sweeping sand dune with a shaded lee face. */
export function dune(x: number, base: number, w: number, h: number, fill: string, shade: string): Layers {
    const l = x - w / 2, r = x + w / 2;
    return [
        shape(`M ${l} ${base} Q ${x - w * 0.12} ${base - h * 1.1} ${x + w * 0.08} ${base - h} Q ${x + w * 0.3} ${base - h * 0.5} ${r} ${base} Z`, fill),
        shape(`M ${x + w * 0.08} ${base - h} Q ${x - w * 0.04} ${base - h * 0.4} ${x + w * 0.04} ${base} L ${r} ${base} Q ${x + w * 0.3} ${base - h * 0.5} ${x + w * 0.08} ${base - h} Z`, shade)
    ];
}

/** Sea ice flowing out of a valley, faceted in two whites. */
export function glacier(x: number, top: number, base: number, w: number, snow: string, ice: string): Layers {
    return [
        poly([x - w * 0.16, top, x + w * 0.16, top, x + w / 2, base, x - w / 2, base], snow),
        poly([x, top, x + w * 0.16, top, x + w / 2, base, x + w * 0.05, base], ice),
        poly([x - w * 0.32, base - (base - top) * 0.34, x - w * 0.08, base - (base - top) * 0.5, x - w * 0.16, base - (base - top) * 0.24], ice)
    ];
}

/** Dark cave mouth with hanging stalactites. */
export function cave(x: number, base: number, w: number, h: number, dark: string, tooth: string): Layers {
    const l = x - w / 2, r = x + w / 2, top = base - h;
    const teeth: Layers = [];
    for (let i = 0; i < 5; i++) {
        const tx = l + w * (0.18 + i * 0.16);
        const th = h * (i % 2 === 0 ? 0.34 : 0.2);
        const ty = top + h * (0.14 + Math.abs(i - 2) * 0.05);
        teeth.push(poly([tx - w * 0.04, ty, tx + w * 0.04, ty, tx, ty + th], tooth));
    }
    return [
        shape(`M ${l} ${base} C ${l} ${top - h * 0.1} ${r} ${top - h * 0.1} ${r} ${base} Z`, dark),
        ...teeth
    ];
}

// ---------------------------------------------------------------------------
// Trees and plants
// ---------------------------------------------------------------------------

/** Conifer: stacked triangles, shaded down the right. `tiers` sets the build. */
export function pine(x: number, base: number, h: number, leaf: string, leaf2: string, trunk: string, tiers = 3, slim = 0.46): Layers {
    const w = h * slim;
    const out: Layers = [box(x - h * 0.04, base - h * 0.14, h * 0.08, h * 0.14, trunk)];
    for (let i = 0; i < tiers; i++) {
        const t0 = (base - h) + (h * 0.86) * (i / tiers) * 0.82;
        const t1 = (base - h) + (h * 0.86) * ((i + 1) / tiers);
        const tw = w * (0.56 + 0.44 * ((i + 1) / tiers));
        out.push(poly([x, t0, x + tw / 2, t1, x - tw / 2, t1], leaf));
        out.push(poly([x, t0, x + tw / 2, t1, x, t1], leaf2));
    }
    return out;
}

export function forestRow(xs: number[], base: number, h: number, leaf: string, leaf2: string, trunk: string, tiers = 3, slim = 0.46): Layers {
    return xs.reduce<Layers>((all, x, i) =>
        all.concat(pine(x, base + (i % 2) * 1.6, h * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.84 : 0.92), leaf, leaf2, trunk, tiers, slim)), []);
}

/** Broadleaf: a round crown with a shaded crescent. */
export function broadleaf(x: number, base: number, h: number, leaf: string, leaf2: string, trunk: string): Layers {
    const r = h * 0.38;
    return [
        box(x - h * 0.05, base - h * 0.5, h * 0.1, h * 0.5, trunk),
        oval(x, base - h + r, r, r, leaf),
        shape(`M ${x} ${base - h} A ${r} ${r} 0 0 1 ${x} ${base - h + 2 * r} Q ${x + r * 0.5} ${base - h + r} ${x} ${base - h} Z`, leaf2)
    ];
}

export function broadleafRow(xs: number[], base: number, h: number, leaf: string, leaf2: string, trunk: string): Layers {
    return xs.reduce<Layers>((all, x, i) => all.concat(broadleaf(x, base, h * (i % 2 === 0 ? 1 : 0.82), leaf, leaf2, trunk)), []);
}

/** Giant sequoia: huge tapered trunk, crown of flat pads high above it. */
export function sequoia(x: number, base: number, h: number, w: number, leaf: string, leaf2: string, trunk: string, bark: string): Layers {
    const top = base - h;
    return [
        poly([x - w / 2, base, x - w * 0.22, top + h * 0.1, x + w * 0.22, top + h * 0.1, x + w / 2, base], trunk),
        poly([x, top + h * 0.1, x + w * 0.22, top + h * 0.1, x + w / 2, base, x + w * 0.05, base], bark),
        oval(x - w * 0.9, top + h * 0.34, w * 0.9, h * 0.07, leaf2),
        oval(x + w * 0.9, top + h * 0.26, w * 0.9, h * 0.07, leaf2),
        oval(x - w * 0.6, top + h * 0.16, w * 0.9, h * 0.08, leaf),
        oval(x + w * 0.6, top + h * 0.09, w * 0.8, h * 0.07, leaf),
        oval(x, top + h * 0.02, w * 0.8, h * 0.09, leaf)
    ];
}

/** Palm: a leaning curved trunk under five leaf blades. */
export function palm(x: number, base: number, h: number, lean: number, leaf: string, leaf2: string, trunk: string): Layers {
    const tx = x + lean, ty = base - h;
    const blade = (dx: number, dy: number, tone: string) => shape(
        `M ${tx} ${ty} Q ${tx + dx * 0.5} ${ty + dy - 6} ${tx + dx} ${ty + dy} Q ${tx + dx * 0.4} ${ty + dy * 0.2 + 2} ${tx} ${ty} Z`, tone);
    return [
        shape(`M ${x - 1.6} ${base} Q ${x + lean * 0.2} ${base - h * 0.5} ${tx - 0.8} ${ty} L ${tx + 0.8} ${ty} Q ${x + lean * 0.4 + 1.8} ${base - h * 0.5} ${x + 1.6} ${base} Z`, trunk),
        blade(-h * 0.52, h * 0.2, leaf2),
        blade(h * 0.52, h * 0.22, leaf2),
        blade(-h * 0.44, -h * 0.02, leaf),
        blade(h * 0.44, 0, leaf),
        blade(h * 0.1, -h * 0.2, leaf)
    ];
}

/** Saguaro: a rounded column with two up-turned arms. */
export function saguaro(x: number, base: number, h: number, leaf: string, leaf2: string): Layers {
    const w = h * 0.15;
    const top = base - h;
    return [
        // left arm
        box(x - w * 1.8, base - h * 0.5, w * 1.8, w * 0.78, leaf),
        box(x - w * 2.2, base - h * 0.76, w * 0.8, h * 0.26 + w * 0.78, leaf),
        oval(x - w * 1.8, base - h * 0.76, w * 0.4, w * 0.4, leaf),
        // right arm
        box(x, base - h * 0.62, w * 1.8, w * 0.78, leaf2),
        box(x + w * 1.4, base - h * 0.88, w * 0.8, h * 0.26 + w * 0.78, leaf2),
        oval(x + w * 1.8, base - h * 0.88, w * 0.4, w * 0.4, leaf2),
        // column
        box(x - w / 2, top + w / 2, w, h - w / 2, leaf),
        box(x, top + w / 2, w / 2, h - w / 2, leaf2),
        oval(x, top + w / 2, w / 2, w / 2, leaf),
        shape(`M ${x} ${top} A ${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${top + w / 2} L ${x} ${top + w / 2} Z`, leaf2)
    ];
}

/** Joshua tree: a forked trunk, each fork ending in a spiky rosette. */
export function joshua(x: number, base: number, h: number, leaf: string, trunk: string): Layers {
    const spike = (cx: number, cy: number, r: number) => {
        const pts: number[] = [];
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const rr = i % 2 === 0 ? r : r * 0.42;
            pts.push(+(cx + Math.cos(a) * rr).toFixed(2), +(cy + Math.sin(a) * rr).toFixed(2));
        }
        return poly(pts, leaf);
    };
    const lx = x - h * 0.3, rx = x + h * 0.3, ly = base - h * 0.76, ry = base - h * 0.88, my = base - h * 0.5;
    return [
        poly([x - h * 0.05, base, x + h * 0.05, base, x + h * 0.04, my, x - h * 0.04, my], trunk),
        poly([x - h * 0.05, my + h * 0.04, lx - h * 0.02, ly, lx + h * 0.04, ly, x + h * 0.02, my - h * 0.04], trunk),
        poly([x - h * 0.02, my - h * 0.03, rx - h * 0.04, ry, rx + h * 0.02, ry, x + h * 0.05, my + h * 0.04], trunk),
        spike(lx, ly, h * 0.17),
        spike(rx, ry, h * 0.17),
        spike(x + h * 0.02, base - h * 0.64, h * 0.12)
    ];
}

export const bush = (x: number, base: number, r: number, leaf: string): IconLayer =>
    shape(`M ${x - r} ${base} A ${r} ${r} 0 0 1 ${x + r} ${base} Z`, leaf);

/** Marsh reeds with cattail heads, for wetland shores. */
export function reeds(xs: number[], base: number, h: number, leaf: string, head: string): Layers {
    const out: Layers = [];
    xs.forEach((x, i) => {
        const hh = h * (i % 2 === 0 ? 1 : 0.72);
        const lean = i % 2 === 0 ? 1.2 : -1;
        out.push(poly([x - 0.6, base, x + lean - 0.3, base - hh, x + lean + 0.3, base - hh, x + 0.6, base], leaf));
        out.push(oval(x + lean, base - hh + 2.4, 1.1, 2.8, head));
    });
    return out;
}

export function lilies(list: number[][], leaf: string, flower: string): Layers {
    const out: Layers = [];
    list.forEach(([x, y, r]) => {
        out.push(oval(x, y, r, r * 0.4, leaf));
        out.push(oval(x + r * 0.2, y - r * 0.12, r * 0.28, r * 0.2, flower));
    });
    return out;
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

/** Still water from `y` down, with a few flat highlights. */
export function lake(y: number, water: string, foam: string, dashes: number[][] = []): Layers {
    return [box(-2, y, 104, 106 - y, water), ...dashes.map(([x, dy, w]) => box(x, y + dy, w, 1, foam))];
}

/** Open sea: a scalloped wave line over a body of water. */
export function waves(y: number, water: string, foam: string, n = 6): Layers {
    const w = 104 / n;
    let d = `M -2 ${y} `;
    for (let i = 0; i < n; i++) d += `q ${w / 2} -5 ${w} 0 `;
    d += 'L 104 106 L -2 106 Z';
    return [shape(d, water), box(10, y + 8, 18, 1.1, foam), box(58, y + 12, 26, 1.1, foam), box(30, y + 18, 16, 1.1, foam)];
}

/** A river that winds down from the horizon and widens toward the viewer. */
export function river(x0: number, y0: number, w0: number, swing: number, water: string, foam: string): Layers {
    const a = x0 - w0 / 2, b = x0 + w0 / 2;
    return [
        shape(`M ${a} ${y0} L ${b} ${y0} C ${b + swing} ${y0 + 12} ${b - swing * 1.4} ${y0 + 20} ${b + 6} 104 L ${a - 16} 104 C ${a - swing * 1.8} ${y0 + 26} ${a + swing} ${y0 + 12} ${a} ${y0} Z`, water),
        box(x0 - 2, y0 + 10, 5, 0.9, foam),
        box(x0 - swing * 0.6 - 2, y0 + 20, 9, 1, foam)
    ];
}

/** A waterfall down a cliff, breaking into a white pool. */
export function falls(x: number, top: number, base: number, w: number, water: string, foam: string): Layers {
    return [
        box(x - w / 2, top, w, base - top, water),
        box(x - w * 0.26, top + (base - top) * 0.1, w * 0.12, (base - top) * 0.55, foam),
        box(x + w * 0.12, top + (base - top) * 0.3, w * 0.12, (base - top) * 0.55, foam),
        oval(x, base, w * 0.9, w * 0.3, foam)
    ];
}

export function island(x: number, y: number, w: number, h: number, fill: string): IconLayer {
    return shape(`M ${x - w / 2} ${y} Q ${x - w * 0.22} ${y - h} ${x} ${y - h} Q ${x + w * 0.24} ${y - h} ${x + w / 2} ${y} Z`, fill);
}

// ---------------------------------------------------------------------------
// The handful of built landmarks the parks are known for
// ---------------------------------------------------------------------------

/** Dry Tortugas' brick hexagon fort, seen low from the sea. */
export function fort(x: number, base: number, w: number, h: number, wall: string, shade: string, slit: string): Layers {
    const out: Layers = [
        poly([x - w / 2, base, x - w * 0.42, base - h, x + w * 0.42, base - h, x + w / 2, base], wall),
        poly([x + w * 0.08, base - h, x + w * 0.42, base - h, x + w / 2, base, x + w * 0.1, base], shade)
    ];
    for (let i = 0; i < 5; i++) out.push(box(x - w * 0.32 + i * w * 0.15, base - h * 0.62, w * 0.05, h * 0.34, slit));
    return out;
}

/** Saarinen's catenary, drawn as a slim horseshoe. */
export function steelArch(x: number, base: number, w: number, h: number, fill: string, shade: string): Layers {
    const l = x - w / 2, r = x + w / 2;
    const t = w * 0.06;
    return [
        shape(`M ${l} ${base} C ${l + w * 0.1} ${base - h * 1.3} ${r - w * 0.1} ${base - h * 1.3} ${r} ${base} L ${r - t} ${base} C ${r - t - w * 0.1} ${base - h * 1.14} ${l + t + w * 0.1} ${base - h * 1.14} ${l + t} ${base} Z`, fill),
        shape(`M ${x} ${base - h * 0.975} C ${x + w * 0.26} ${base - h * 0.98} ${r - w * 0.08} ${base - h * 0.5} ${r} ${base} L ${r - t} ${base} C ${r - t - w * 0.08} ${base - h * 0.5} ${x + w * 0.22} ${base - h * 0.86} ${x} ${base - h * 0.855} Z`, shade)
    ];
}

/** Cliff dwelling: a row of small blocks and dark doors under an overhang. */
export function cliffHouses(x: number, base: number, wall: string, shade: string, door: string): Layers {
    const out: Layers = [];
    const blocks = [[-14, 7, 7], [-7, 8, 11], [1, 7, 8], [8, 8, 12]];
    blocks.forEach(([dx, w, h]) => {
        out.push(box(x + dx, base - h, w, h, wall));
        out.push(box(x + dx + w * 0.6, base - h, w * 0.4, h, shade));
        out.push(box(x + dx + w * 0.22, base - h * 0.62, w * 0.26, h * 0.34, door));
    });
    return out;
}

/** Coastal lighthouse on a rock. */
export function lighthouse(x: number, base: number, h: number, wall: string, band: string, lamp: string): Layers {
    const w = h * 0.24;
    return [
        poly([x - w / 2, base, x - w * 0.32, base - h * 0.8, x + w * 0.32, base - h * 0.8, x + w / 2, base], wall),
        poly([x - w * 0.44, base - h * 0.32, x - w * 0.37, base - h * 0.54, x + w * 0.37, base - h * 0.54, x + w * 0.44, base - h * 0.32], band),
        box(x - w * 0.26, base - h * 0.94, w * 0.52, h * 0.14, lamp),
        poly([x - w * 0.34, base - h * 0.94, x, base - h * 1.04, x + w * 0.34, base - h * 0.94], band)
    ];
}

export const flat = (groups: Layers[]): Layers => groups.reduce<Layers>((all, g) => all.concat(g), []);
