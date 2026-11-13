/**
 * DecorumArt.tsx — flat, layered, outline-free 2.5D vector art for Décorum.
 *
 * Every shape is a solid fill; depth comes from a darker "side" face, a lighter
 * highlight and a flat floor shadow — never from strokes or blur. Colours are
 * muted pastels (PAL). One drawing per object (12 = 3 types × 4 styles), the
 * dollhouse cross-section, and small glyphs for condition text.
 */

import * as React from 'react';
import { findIconDefinition, IconName } from '@fortawesome/fontawesome-svg-core';
import {
    Color, Style, ObjType, RoomId, Zone, House, ROOMS, TYPES, OBJECT_COLOR, ZONE_ROOMS, WARM, Filter, Move, Reaction,
    Board, Beds, BEDROOMS, roomName, Twists
} from '../DecorumData';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';

export const INK = '#3d3a52';
export const PAPER = '#fbf8f3';

export interface Shade { base: string; shade: string; light: string; wall: string; wallShade: string; }

export const PAL: Record<Color, Shade> = {
    red: { base: '#e5908a', shade: '#c97670', light: '#f3bfb9', wall: '#f1cdc6', wallShade: '#e3b5ad' },
    yellow: { base: '#eec46e', shade: '#d2a653', light: '#f7dfa6', wall: '#f5e3b8', wallShade: '#e7d09d' },
    blue: { base: '#88aad6', shade: '#6c8dbb', light: '#b8cdea', wall: '#cddcf0', wallShade: '#b5c8e4' },
    green: { base: '#8ec4a1', shade: '#70a785', light: '#bcdcc7', wall: '#cfe7d6', wallShade: '#b6d7c0' }
};

const SHADOW = 'rgba(61,58,82,0.13)';
const SKIN = '#f3d3bd';
const NEUTRAL = { base: '#ddd3c6', shade: '#c9bdad', light: '#ece5db' };
const FLOOR: Record<RoomId, { base: string; shade: string }> = {
    bath: { base: '#dfe3e2', shade: '#cdd3d2' },
    bed: { base: '#e7d7c4', shade: '#d6c4ae' },
    living: { base: '#e4d3bf', shade: '#d3c0a9' },
    kitchen: { base: '#e2ddd1', shade: '#d0cabc' }
};

// ---------------------------------------------------------------------------
// The 12 objects, drawn in a 48×48 box. Floor objects stand on y=48.
// ---------------------------------------------------------------------------

function sunburst(cx: number, cy: number, r1: number, r2: number, n: number): string {
    let d = '';
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const w = Math.PI / n * 0.55;
        const p = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy + Math.sin(ang) * r).toFixed(1)}`;
        d += `M${p(a - w, r1)} L${p(a, r2)} L${p(a + w, r1)} Z `;
    }
    return d;
}

const floorShadow = <ellipse cx="24" cy="47" rx="14" ry="2.4" fill={SHADOW} />;

export function objectShapes(type: ObjType, style: Style): React.ReactNode {
    const c = PAL[OBJECT_COLOR[type][style]];
    if (type === 'lamp') {
        switch (style) {
            case 'modern': return (
                <g>
                    {floorShadow}
                    <ellipse cx="14" cy="46" rx="8" ry="2.4" fill={c.shade} />
                    <rect x="12.6" y="12" width="2.8" height="34" rx="1.2" fill={c.shade} />
                    <path d="M12.6 13 Q13 3 30 4.4 L30 7.2 Q16.5 6.4 15.4 13 Z" fill={c.shade} />
                    <path d="M20 17 Q22 5 30 5 Q38 5 40 17 Z" fill={c.base} />
                    <path d="M30 5 Q38 5 40 17 L32 17 Q32.5 9 30 5 Z" fill={c.shade} />
                    <ellipse cx="30" cy="17.4" rx="6" ry="1.7" fill={c.light} />
                </g>
            );
            case 'antique': return (
                <g>
                    {floorShadow}
                    <rect x="16" y="42" width="16" height="4.6" rx="2" fill={c.shade} />
                    <ellipse cx="24" cy="35" rx="8.5" ry="7.5" fill={c.base} />
                    <path d="M24 27.5 Q32.5 27.5 32.5 35 Q32.5 42.5 24 42.5 Z" fill={c.shade} />
                    <ellipse cx="20.6" cy="33" rx="2.2" ry="3.2" fill={c.light} />
                    <rect x="22" y="22" width="4" height="6" fill={c.shade} />
                    <path d="M14 7 L34 7 L39.5 23 L8.5 23 Z" fill={c.base} />
                    <path d="M26 7 L34 7 L39.5 23 L29 23 Z" fill={c.shade} />
                    {[11, 16, 21, 26, 31, 36].map((x, i) => <circle key={x} cx={x + 0.5} cy="23.4" r="2.4" fill={i >= 3 ? c.shade : c.base} />)}
                    <rect x="22.5" y="3.5" width="3" height="4" rx="1" fill={c.shade} />
                </g>
            );
            case 'retro': return (
                <g>
                    {floorShadow}
                    <path d="M15 47 L33 47 L29 36 L19 36 Z" fill={c.shade} />
                    <path d="M19 36 L29 36 L27 11 L21 11 Z" fill={c.light} />
                    <path d="M24 36 L29 36 L27 11 L24 11 Z" fill={c.base} opacity="0.35" />
                    <ellipse cx="23" cy="30" rx="3.4" ry="4.2" fill={c.base} />
                    <ellipse cx="25.4" cy="21" rx="2.4" ry="3" fill={c.base} />
                    <ellipse cx="22.6" cy="15" rx="1.5" ry="1.8" fill={c.base} />
                    <path d="M21 11 L27 11 L25.4 5 L22.6 5 Z" fill={c.shade} />
                </g>
            );
            default: return (
                <g>
                    {floorShadow}
                    <path d="M20 47 Q18.5 32 21.5 22 L27 22 Q30 32 28 47 Z" fill={c.light} />
                    <path d="M24.5 22 L27 22 Q30 32 28 47 L25 47 Q26.5 33 24.5 22 Z" fill={c.base} opacity="0.45" />
                    <ellipse cx="24" cy="23.5" rx="14" ry="2.6" fill={c.shade} />
                    <path d="M8 23 Q9.5 5 24 5 Q38.5 5 40 23 Z" fill={c.base} />
                    <path d="M24 5 Q38.5 5 40 23 L31 23 Q31 11 24 5 Z" fill={c.shade} />
                    <circle cx="15" cy="16" r="2.6" fill={c.light} />
                    <circle cx="22" cy="10.5" r="2.1" fill={c.light} />
                    <circle cx="33" cy="15" r="2" fill={c.light} opacity="0.8" />
                </g>
            );
        }
    }
    if (type === 'hanging') {
        switch (style) {
            case 'modern': return (
                <g>
                    <rect x="9" y="10.5" width="33" height="28" rx="1.5" fill={c.shade} />
                    <rect x="7" y="8.5" width="33" height="28" rx="1.5" fill={c.light} />
                    <circle cx="17" cy="19" r="6" fill={c.base} />
                    <rect x="24" y="16" width="11" height="15" fill={c.shade} />
                    <path d="M10 34 L19.5 23.5 L28 34 Z" fill={c.base} />
                </g>
            );
            case 'antique': return (
                <g>
                    <ellipse cx="25.6" cy="25.6" rx="14.5" ry="17.5" fill={c.shade} />
                    <ellipse cx="24" cy="24" rx="14.5" ry="17.5" fill={c.base} />
                    <ellipse cx="24" cy="24.5" rx="10.5" ry="13.5" fill={c.light} />
                    <circle cx="24" cy="20.5" r="4.4" fill={c.shade} />
                    <path d="M15.5 34 Q24 24.5 32.5 34 Q29 37.6 24 37.8 Q19 37.6 15.5 34 Z" fill={c.shade} />
                    <circle cx="24" cy="5.6" r="2.6" fill={c.base} />
                </g>
            );
            case 'retro': return (
                <g>
                    <path d={sunburst(24, 24, 11.5, 21.5, 12)} fill={c.shade} />
                    <circle cx="25.4" cy="25.4" r="11" fill={c.shade} />
                    <circle cx="24" cy="24" r="11" fill={c.base} />
                    <circle cx="24" cy="24" r="8" fill={c.light} />
                    <rect x="23.1" y="17.5" width="1.8" height="7.5" rx="0.9" fill={c.shade} />
                    <rect x="23.4" y="23.1" width="6" height="1.8" rx="0.9" fill={c.shade} />
                    <circle cx="24" cy="24" r="1.4" fill={c.shade} />
                </g>
            );
            default: return (
                <g>
                    <path d="M11.5 13.5 L39.5 13.5 L39.5 31 Q39.5 41 25.5 43.5 Q11.5 41 11.5 31 Z" fill={c.shade} />
                    <path d="M10 12 L38 12 L38 29.5 Q38 39.5 24 42 Q10 39.5 10 29.5 Z" fill={c.light} />
                    <path d="M13 26 Q20 17.5 29 22 L36 17.5 L34.5 26 L36 34.5 L29 30 Q20 34.5 13 26 Z" fill={c.base} />
                    <path d="M29 22 L36 17.5 L34.5 26 L36 34.5 L29 30 Z" fill={c.shade} />
                    <path d="M18.5 21 L24.5 19.4 L23 23 Z" fill={c.shade} />
                    <circle cx="17.2" cy="25" r="1.5" fill={INK} />
                </g>
            );
        }
    }
    // curios
    switch (style) {
        case 'modern': return (
            <g>
                {floorShadow}
                <path d="M24 30 Q15 16 21 5 Q27 16 24 30 Z" fill={c.base} />
                <path d="M24 30 Q31 18 38 13 Q35 25 24 30 Z" fill={c.shade} />
                <path d="M14.5 29.5 L24 32.5 L24 47 L17 47 Z" fill={c.base} />
                <path d="M24 32.5 L33.5 29.5 L31 47 L24 47 Z" fill={c.shade} />
                <path d="M14.5 29.5 L24 26.8 L33.5 29.5 L24 32.5 Z" fill={c.light} />
            </g>
        );
        case 'antique': return (
            <g>
                {floorShadow}
                <path d="M13.5 30 Q13.5 22 24 22 Q34.5 22 34.5 30 L32.5 42 Q30.5 47 24 47 Q17.5 47 15.5 42 Z" fill={c.base} />
                <path d="M26 22.2 Q34.5 23 34.5 30 L32.5 42 Q30.5 47 26 47 Q29 38 26 22.2 Z" fill={c.shade} />
                <circle cx="18.5" cy="33" r="2" fill={c.light} />
                <circle cx="24" cy="34.5" r="2" fill={c.light} />
                <circle cx="29.4" cy="33" r="1.8" fill={c.light} opacity="0.75" />
                <rect x="19" y="17.5" width="10" height="5" fill={c.shade} />
                <ellipse cx="24" cy="17" rx="7.5" ry="3" fill={c.base} />
                <circle cx="24" cy="13" r="2.5" fill={c.shade} />
            </g>
        );
        case 'retro': return (
            <g>
                {floorShadow}
                <path d="M10 47 L38 47 L34 30 L14 30 Z" fill={c.base} />
                <path d="M26 30 L34 30 L38 47 L28.5 47 Z" fill={c.shade} />
                <circle cx="22.5" cy="39" r="5.6" fill={c.light} />
                <circle cx="22.5" cy="39" r="2" fill={c.shade} />
                <path d="M7.5 28.5 Q7.5 21.5 14 21.5 L34 21.5 Q40.5 21.5 40.5 28.5 L35 28.5 Q35 26 32 26 L16 26 Q13 26 13 28.5 Z" fill={c.shade} />
            </g>
        );
        default: return (
            <g>
                {floorShadow}
                <path d="M14.5 47 Q14.5 32 24 30 Q33.5 32 33.5 47 Z" fill={c.base} />
                <path d="M26 30.3 Q33.5 32 33.5 47 L27 47 Q29 37 26 30.3 Z" fill={c.shade} />
                <path d="M18 31.5 Q24 45 30 31.5 Q24 29 18 31.5 Z" fill={PAPER} />
                <circle cx="24" cy="28" r="4" fill={SKIN} />
                <circle cx="24" cy="29.6" r="1.6" fill="#e6b39a" />
                <path d="M14.5 27 Q24 30.5 33.5 27 L25.5 4 Z" fill={c.base} />
                <path d="M25.5 4 L33.5 27 Q30 28.5 26.5 29 Z" fill={c.shade} />
            </g>
        );
    }
}

/** A standalone object picture. */
export const ObjectArt: React.FC<{ type: ObjType; style: Style; size?: number; className?: string }> = ({ type, style, size = 40, className }) => (
    <svg className={['dc-obj-art', className || ''].join(' ')} width={size} height={size} viewBox="0 0 48 48" aria-label={`${OBJECT_COLOR[type][style]} ${style} ${type}`}>
        {objectShapes(type, style)}
    </svg>
);

// ---------------------------------------------------------------------------
// Small glyphs
// ---------------------------------------------------------------------------

export function typeShapes(type: ObjType, fill: string): React.ReactNode {
    if (type === 'lamp') return <g fill={fill}><path d="M6 11 Q7 3 12 3 Q17 3 18 11 Z" /><rect x="11" y="11" width="2" height="8" /><rect x="7.5" y="18.5" width="9" height="2.5" rx="1.2" /></g>;
    if (type === 'hanging') return <g fill={fill}><path d="M12 2 L15.5 6 L8.5 6 Z" /><rect x="4" y="6" width="16" height="14" rx="1.5" /><rect x="7" y="9" width="10" height="8" fill={PAPER} opacity="0.55" /></g>;
    return <g fill={fill}><path d="M7 11 Q7 7 12 7 Q17 7 17 11 L16 19 Q15 21 12 21 Q9 21 8 19 Z" /><rect x="9.5" y="4" width="5" height="3.4" rx="1" /></g>;
}

export const TypeGlyph: React.FC<{ type: ObjType; size?: number; fill?: string }> = ({ type, size = 18, fill = INK }) => (
    <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{typeShapes(type, fill)}</svg>
);

export const StyleGlyph: React.FC<{ style: Style; size?: number; fill?: string }> = ({ style, size = 18, fill = INK }) => (
    <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        {style === 'modern' && <g fill={fill}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="8" y="8" width="8" height="8" fill={PAPER} opacity="0.6" /></g>}
        {style === 'antique' && <path fill={fill} d="M3 18 L4.5 7 L9 12 L12 5 L15 12 L19.5 7 L21 18 Z" />}
        {style === 'retro' && <g><circle cx="12" cy="12" r="9" fill={fill} /><circle cx="12" cy="12" r="5" fill={PAPER} opacity="0.6" /><circle cx="12" cy="12" r="1.8" fill={fill} /></g>}
        {style === 'unusual' && <path fill={fill} d="M12 2.5 L14 9 L20.5 7 L16 12 L21 16.5 L14.3 15.5 L12 21.5 L9.7 15.5 L3 16.5 L8 12 L3.5 7 L10 9 Z" />}
    </svg>
);

export const ColorDot: React.FC<{ color: Color; size?: number; wall?: boolean }> = ({ color, size = 16, wall }) => (
    <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        {wall
            ? <g><rect x="2" y="3" width="20" height="18" rx="3" fill={PAL[color].wall} /><rect x="2" y="15" width="20" height="6" rx="2" fill={PAL[color].wallShade} /></g>
            : <g><circle cx="12" cy="12" r="10" fill={PAL[color].base} /><path d="M12 2 A10 10 0 0 1 12 22 Z" fill={PAL[color].shade} /></g>}
    </svg>
);

export const TempDot: React.FC<{ warm: boolean; size?: number; wall?: boolean }> = ({ warm, size = 16, wall }) => {
    const [a, b] = warm ? [PAL.red, PAL.yellow] : [PAL.blue, PAL.green];
    return (
        <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            {wall
                ? <g><rect x="2" y="3" width="10" height="18" rx="2" fill={a.wall} /><rect x="12" y="3" width="10" height="18" rx="2" fill={b.wall} /></g>
                : <g><path d="M12 2 A10 10 0 0 0 12 22 Z" fill={a.base} /><path d="M12 2 A10 10 0 0 1 12 22 Z" fill={b.base} /></g>}
        </svg>
    );
};

/** A mini house with the zone's rooms filled in. */
/** A small flat bed: "your bedroom" (solid) / "the other bedroom" (muted). */
export const BedGlyph: React.FC<{ size?: number; muted?: boolean }> = ({ size = 18, muted }) => (
    <svg className="dc-glyph dc-zone-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="7" width="3" height="13" rx="1" fill={muted ? '#c3bcb4' : INK} />
        <rect x="4" y="12" width="18" height="6" rx="1.5" fill={muted ? '#d8d2cc' : '#8f8aa6'} />
        <rect x="6" y="9" width="6" height="4" rx="2" fill={muted ? '#e6e1db' : '#cfcbe0'} />
        <rect x="4" y="18" width="2" height="3" fill={muted ? '#c3bcb4' : INK} />
        <rect x="20" y="18" width="2" height="3" fill={muted ? '#c3bcb4' : INK} />
    </svg>
);

export const ZoneGlyph: React.FC<{ zone: Zone; size?: number }> = ({ zone, size = 18 }) => {
    if (zone === 'mine' || zone === 'other') return <BedGlyph size={size} muted={zone === 'other'} />;
    const on = ZONE_ROOMS[zone];
    const cell = (r: RoomId, x: number, y: number) => (
        <rect key={r} x={x} y={y} width="8.6" height="7" rx="1.2" fill={on.indexOf(r) !== -1 ? INK : '#d8d2cc'} />
    );
    return (
        <svg className="dc-glyph dc-zone-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 9 L12 2 L22 9 Z" fill={zone === 'house' ? INK : '#d8d2cc'} />
            {cell('bath', 2.6, 9.6)}{cell('bed', 12.8, 9.6)}{cell('living', 2.6, 17.2)}{cell('kitchen', 12.8, 17.2)}
        </svg>
    );
};

/** The house cat, flat and pastel: sits facing you, tail curled round. Drawn in a 40×40 box, feet at y=38. */
export const CAT = { base: '#f2bf8f', shade: '#dc9f6b', light: '#f9dcbd', stripe: '#d18f5a' };
export function catShapes(): React.ReactNode {
    return (
        <g>
            <ellipse cx="20" cy="38.4" rx="12" ry="1.8" fill="rgba(61,58,82,.13)" />
            <path d="M29 36 Q37 35 36 28 Q35.4 24 32.6 25.4 Q34.6 28 33 31 Q31 34 27 33.6 Z" fill={CAT.shade} />
            <path d="M10.5 38 Q9 26 14 21 L26 21 Q31 26 29.5 38 Z" fill={CAT.base} />
            <path d="M22.5 21 L26 21 Q31 26 29.5 38 L24 38 Q26.4 28 22.5 21 Z" fill={CAT.shade} />
            <path d="M15 38 Q14.6 31 18 29 Q21.6 31 21 38 Z" fill={CAT.light} />
            <path d="M11.2 9.6 L12 1.6 L17.4 6.6 Z" fill={CAT.base} />
            <path d="M28.8 9.6 L28 1.6 L22.6 6.6 Z" fill={CAT.shade} />
            <path d="M12.6 7.6 L13 4 L15.4 6.2 Z" fill="#f4a7a4" />
            <ellipse cx="20" cy="13.4" rx="9.6" ry="8.6" fill={CAT.base} />
            <path d="M20 4.8 Q29.6 5.4 29.6 13.4 Q29.6 21 20 22 Q26 18.6 26 13.4 Q26 7.6 20 4.8 Z" fill={CAT.shade} />
            <rect x="18.9" y="5.4" width="2.2" height="4" rx="1.1" fill={CAT.stripe} />
            <ellipse cx="16.4" cy="13" rx="1.3" ry="1.7" fill={INK} />
            <ellipse cx="23.6" cy="13" rx="1.3" ry="1.7" fill={INK} />
            <path d="M18.8 16 L21.2 16 L20 17.4 Z" fill="#e48f8c" />
        </g>
    );
}

/** The cat for menus and condition text: just the head. */
export const CatGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
    <svg className="dc-glyph dc-cat-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.6 10 L4.6 2.4 L10 6.4 Z" fill={CAT.base} />
        <path d="M20.4 10 L19.4 2.4 L14 6.4 Z" fill={CAT.shade} />
        <ellipse cx="12" cy="13.6" rx="9.4" ry="8.4" fill={CAT.base} />
        <path d="M12 5.2 Q21.4 5.8 21.4 13.6 Q21.4 21 12 22 Q18 18.6 18 13.6 Q18 8 12 5.2 Z" fill={CAT.shade} />
        <ellipse cx="8.6" cy="13" rx="1.3" ry="1.7" fill={INK} />
        <ellipse cx="15.4" cy="13" rx="1.3" ry="1.7" fill={INK} />
        <path d="M10.8 16.2 L13.2 16.2 L12 17.6 Z" fill="#e48f8c" />
    </svg>
);

/** A small padlock (heirlooms, locked rooms). */
export const LockGlyph: React.FC<{ size?: number; fill?: string }> = ({ size = 16, fill = INK }) => (
    <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 11 L7 8 Q7 3 12 3 Q17 3 17 8 L17 11 L14.6 11 L14.6 8 Q14.6 5.4 12 5.4 Q9.4 5.4 9.4 8 L9.4 11 Z" fill={fill} opacity="0.75" />
        <rect x="4.5" y="10" width="15" height="11" rx="2.6" fill={fill} />
        <rect x="11" y="13.6" width="2" height="4" rx="1" fill="#fff" />
    </svg>
);

/** Glyph per twist, for chips and the rules. */
export const TwistGlyph: React.FC<{ id: string; size?: number }> = ({ id, size = 16 }) => {
    switch (id) {
        case 'cat': return <CatGlyph size={size} />;
        case 'heirloom': case 'keeper': return <LockGlyph size={size} />;
        case 'shortage': return <EmptyGlyph size={size} />;
        case 'soldOut': return (
            <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="7" width="14" height="14" rx="3" fill="#cfc8de" />
                <rect x="4" y="5" width="16" height="4" rx="2" fill="#a9a1c4" />
                <rect x="10.8" y="9" width="2.4" height="12" rx="1.2" fill="#e5908a" transform="rotate(45 12 15)" />
            </svg>
        );
        case 'noRepeat': case 'wetPaint': return (
            <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5" fill="#e5908a" />
                <rect x="6" y="10.6" width="12" height="2.8" rx="1.4" fill="#fff" />
            </svg>
        );
        default: return (
            <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5 Q4 3 6 3 L18 3 Q20 3 20 5 L20 14 Q20 16 18 16 L10 16 L5.4 20.4 L6.4 16 L6 16 Q4 16 4 14 Z" fill="#a9a1c4" />
                <circle cx="9" cy="9.6" r="1.4" fill="#fff" /><circle cx="15" cy="9.6" r="1.4" fill="#fff" />
            </svg>
        );
    }
};

export const EmptyGlyph: React.FC<{ size?: number }> = ({ size = 16 }) => (
    <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#e3ddd6" />
        <rect x="11" y="4" width="2.4" height="16" rx="1.2" fill="#b9b0a6" transform="rotate(45 12 12)" />
    </svg>
);

const ObjectsGlyph: React.FC<{ size?: number }> = ({ size = 16 }) => (
    <svg className="dc-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <g transform="translate(-2 -1) scale(0.6)">{typeShapes('lamp', INK)}</g>
        <g transform="translate(9 -1) scale(0.6)">{typeShapes('hanging', INK)}</g>
        <g transform="translate(4 10) scale(0.6)">{typeShapes('curio', INK)}</g>
    </svg>
);

/** The glyph for a condition filter. */
export const FilterGlyph: React.FC<{ filter: Filter; size?: number }> = ({ filter: f, size = 16 }) => {
    switch (f.f) {
        case 'object': return <ObjectsGlyph size={size} />;
        case 'type': return <TypeGlyph type={f.type} size={size} />;
        case 'color': return <ColorDot color={f.color} size={size} />;
        case 'style': return <StyleGlyph style={f.style} size={size} />;
        case 'specific': return <ObjectArt type={f.type} style={f.style} size={size + 6} className="dc-glyph" />;
        case 'temp': return <TempDot warm={f.warm} size={size} />;
        case 'empty': return <EmptyGlyph size={size} />;
        case 'wall': return <ColorDot color={f.color} wall size={size} />;
        case 'wallTemp': return <TempDot warm={f.warm} wall size={size} />;
        case 'feature': return <span className="dc-glyph-pair"><ColorDot color={f.color} size={size} /><ColorDot color={f.color} wall size={size - 3} /></span>;
        case 'featureTemp': return <span className="dc-glyph-pair"><TempDot warm={f.warm} size={size} /><TempDot warm={f.warm} wall size={size - 3} /></span>;
    }
    return null;
};

// ---------------------------------------------------------------------------
// Hearts, reaction faces, the wordmark
// ---------------------------------------------------------------------------

export const Heart: React.FC<{ up: boolean; size?: number; className?: string }> = ({ up, size = 20, className }) => (
    <svg className={['dc-heart', up ? 'up' : 'down', className || ''].join(' ')} width={size} height={size} viewBox="0 0 24 24" aria-label={up ? 'heart' : 'used heart'}>
        <path d="M12 21 Q3 14.5 2.6 9 Q2.4 3.6 7.4 3.4 Q10.4 3.4 12 6.4 Q13.6 3.4 16.6 3.4 Q21.6 3.6 21.4 9 Q21 14.5 12 21 Z" fill={up ? '#ec9cab' : '#d9d3dc'} />
        <path d="M12 21 Q21 14.5 21.4 9 Q21.6 3.6 16.6 3.4 Q14.5 3.4 13.2 4.8 Q18.6 5.6 18.4 10 Q18 15 12 21 Z" fill={up ? '#d97f90' : '#c7c0ca'} />
        {up
            ? <ellipse cx="7.6" cy="8.2" rx="1.9" ry="1.3" fill="#fbe2e7" transform="rotate(-30 7.6 8.2)" />
            : <g fill="#a69fab"><rect x="11" y="6.5" width="2.2" height="10" rx="1.1" transform="rotate(45 12 11.5)" /><rect x="11" y="6.5" width="2.2" height="10" rx="1.1" transform="rotate(-45 12 11.5)" /></g>}
    </svg>
);

export const REACTION_COLOR: Record<Reaction, string> = { love: '#8ec4a1', meh: '#e2d3ae', hate: '#e5908a' };

export const ReactionFace: React.FC<{ kind: Reaction; size?: number }> = ({ kind, size = 28 }) => {
    const base = REACTION_COLOR[kind];
    const dark = kind === 'love' ? '#5e9a74' : kind === 'meh' ? '#b9a77b' : '#c06a64';
    return (
        <svg className={`dc-face dc-face-${kind}`} width={size} height={size} viewBox="0 0 24 24" aria-label={kind}>
            <circle cx="12" cy="12" r="11" fill={base} />
            <path d="M12 1 A11 11 0 0 1 12 23 A13 13 0 0 0 12 1 Z" fill={dark} opacity="0.35" />
            {kind === 'love' && <g fill={INK}>
                <path d="M6.2 10.4 Q8 7.2 9.8 10.4 L8.8 10.4 Q8 8.8 7.2 10.4 Z" />
                <path d="M14.2 10.4 Q16 7.2 17.8 10.4 L16.8 10.4 Q16 8.8 15.2 10.4 Z" />
                <path d="M7 13.5 Q12 19.5 17 13.5 Z" />
            </g>}
            {kind === 'meh' && <g fill={INK}>
                <circle cx="8" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
                <rect x="8" y="15" width="8" height="1.8" rx="0.9" />
            </g>}
            {kind === 'hate' && <g fill={INK}>
                <rect x="6" y="8" width="4.4" height="1.6" rx="0.8" transform="rotate(18 8.2 8.8)" />
                <rect x="13.6" y="8" width="4.4" height="1.6" rx="0.8" transform="rotate(-18 15.8 8.8)" />
                <circle cx="8.4" cy="11.6" r="1.4" /><circle cx="15.6" cy="11.6" r="1.4" />
                <path d="M7.5 18 Q12 13 16.5 18 L15 18 Q12 15.4 9 18 Z" />
            </g>}
        </svg>
    );
};

export const Wordmark: React.FC<{ size?: number }> = ({ size = 30 }) => (
    <div className="dc-wordmark" style={{ fontSize: size }}>
        <svg width={size * 1.15} height={size * 1.15} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M5 21 L24 6 L43 21 Z" fill="#a49cbf" />
            <path d="M24 6 L43 21 L34 21 Z" fill="#8e86ab" />
            <rect x="9" y="21" width="15" height="11" fill={PAL.red.wall} />
            <rect x="24" y="21" width="15" height="11" fill={PAL.blue.wall} />
            <rect x="9" y="32" width="15" height="11" fill={PAL.yellow.wall} />
            <rect x="24" y="32" width="15" height="11" fill={PAL.green.wall} />
            <circle cx="16.5" cy="27" r="2.6" fill={PAL.red.base} />
            <rect x="29" y="24.5" width="5" height="5" fill={PAL.blue.base} />
            <path d="M14 43 L19 43 L16.5 36 Z" fill={PAL.yellow.base} />
            <circle cx="31.5" cy="39" r="3" fill={PAL.green.base} />
        </svg>
        <span>décorum</span>
    </div>
);

// ---------------------------------------------------------------------------
// The dollhouse
// ---------------------------------------------------------------------------

const RW = 164, RH = 138;           // room box
const GAP = 6;
const ROOF = 46;
export const HOUSE_W = 14 + RW * 2 + GAP + 14;
export const HOUSE_H = ROOF + 8 + RH * 2 + GAP + 12;

const ROOM_POS: Record<RoomId, { x: number; y: number }> = {
    bath: { x: 14, y: ROOF + 8 },
    bed: { x: 14 + RW + GAP, y: ROOF + 8 },
    living: { x: 14, y: ROOF + 8 + RH + GAP },
    kitchen: { x: 14 + RW + GAP, y: ROOF + 8 + RH + GAP }
};

/** Where each slot sits in a room: anchor + scale of the 48-box. */
const SLOT: Record<ObjType, { x: number; y: number; s: number; floor: boolean }> = {
    hanging: { x: 82, y: 46, s: 0.98, floor: false },
    lamp: { x: 30, y: 129, s: 1.3, floor: true },
    curio: { x: 132, y: 103, s: 0.86, floor: true }
};

/** Box (in room coords) that a slot's 48-box covers. */
function slotBox(t: ObjType) {
    const p = SLOT[t];
    const size = 48 * p.s;
    return { x: p.x - size / 2, y: p.floor ? p.y - size : p.y - size / 2, size };
}

function furniture(room: RoomId, board: Board = 'classic'): React.ReactNode {
    const n = NEUTRAL;
    // roommates board: both upstairs rooms are bedrooms
    if (board === 'roommates' && room === 'bath') room = 'bed';
    switch (room) {
        case 'bath': return (
            <g>
                <ellipse cx="84" cy="129" rx="34" ry="3" fill={SHADOW} />
                <path d="M52 108 L116 108 L112 124 Q110 128 104 128 L64 128 Q58 128 56 124 Z" fill={PAPER} />
                <path d="M96 108 L116 108 L112 124 Q110 128 104 128 L98 128 Z" fill={n.light} />
                <rect x="50" y="104" width="68" height="5" rx="2.5" fill={n.base} />
                <rect x="55" y="92" width="3" height="13" rx="1.5" fill={n.shade} />
                <rect x="55" y="92" width="9" height="3" rx="1.5" fill={n.shade} />
            </g>
        );
        case 'bed': return (
            <g>
                <ellipse cx="82" cy="129" rx="36" ry="3" fill={SHADOW} />
                <rect x="48" y="96" width="8" height="32" rx="2" fill={n.shade} />
                <rect x="52" y="110" width="64" height="14" rx="3" fill={PAPER} />
                <rect x="78" y="106" width="40" height="18" rx="4" fill={n.light} />
                <rect x="58" y="104" width="18" height="8" rx="4" fill={PAPER} />
                <rect x="54" y="123" width="4" height="6" fill={n.shade} />
                <rect x="112" y="123" width="4" height="6" fill={n.shade} />
            </g>
        );
        case 'living': return (
            <g>
                <ellipse cx="82" cy="129" rx="36" ry="3" fill={SHADOW} />
                <rect x="52" y="98" width="60" height="16" rx="6" fill={n.base} />
                <rect x="48" y="106" width="68" height="18" rx="5" fill={n.light} />
                <rect x="46" y="104" width="10" height="20" rx="4" fill={n.base} />
                <rect x="108" y="104" width="10" height="20" rx="4" fill={n.shade} />
                <rect x="52" y="124" width="4" height="5" fill={n.shade} />
                <rect x="108" y="124" width="4" height="5" fill={n.shade} />
            </g>
        );
        default: return (
            <g>
                <ellipse cx="82" cy="129" rx="34" ry="3" fill={SHADOW} />
                <rect x="52" y="98" width="58" height="31" rx="2" fill={n.light} />
                <rect x="92" y="98" width="18" height="31" rx="2" fill={n.base} />
                <rect x="50" y="95" width="62" height="5" rx="2" fill={n.shade} />
                <rect x="57" y="104" width="30" height="18" rx="2" fill={n.base} />
                <circle cx="62" cy="91" r="3" fill={n.shade} />
                <rect x="66" y="88" width="14" height="6" rx="3" fill={n.shade} />
            </g>
        );
    }
}

export type SlotRef = { room: RoomId; type: ObjType | 'wall' };

/** Who a roommate token stands for. */
export interface TokenP { name: string; accent: string; icon: number; me?: boolean; }

/** A player's lobby icon as flat path data (null when the icon library isn't loaded). */
function iconPath(icon: number): { d: string; w: number; h: number } | null {
    try {
        const def: any = findIconDefinition({ prefix: 'fas', iconName: (LOBBY_ICONS[icon] || 'grin') as IconName });
        if (!def) return null;
        const [w, h, , , path] = def.icon;
        return { d: Array.isArray(path) ? path.join(' ') : path, w, h };
    } catch (e) {
        return null;
    }
}

const darken = (hex: string, f = 0.82) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const c = (sh: number) => Math.round(((n >> sh) & 255) * f);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
};

/** A roommate token: a flat disc in the player's colour with their icon (2.5D: darker base). */
export const RoommateToken: React.FC<{ p: TokenP; cx: number; cy: number; r?: number; className?: string }> = ({ p, cx, cy, r = 10, className }) => {
    const ic = iconPath(p.icon);
    const box = r * 1.05;
    const scale = ic ? box / Math.max(ic.w, ic.h) : 1;
    return (
        <g className={['dc-token', className || ''].join(' ')}>
            <title>{p.me ? 'You' : p.name}</title>
            <ellipse cx={cx} cy={cy + r * 0.95} rx={r * 0.9} ry={r * 0.28} fill={SHADOW} />
            <circle cx={cx} cy={cy + r * 0.18} r={r} fill={darken(p.accent)} />
            <circle cx={cx} cy={cy} r={r} fill={p.accent} />
            {p.me && <circle cx={cx} cy={cy} r={r * 0.86} fill="#fff" opacity="0.92" />}
            {p.me && <circle cx={cx} cy={cy} r={r * 0.72} fill={p.accent} />}
            {ic
                ? <path d={ic.d} fill="#fff" transform={`translate(${cx - ic.w * scale / 2} ${cy - ic.h * scale / 2}) scale(${scale})`} />
                : <circle cx={cx} cy={cy} r={r * 0.3} fill="#fff" />}
        </g>
    );
};

export interface HouseProps {
    house: House;
    /** Rooms/slots react to taps when set. */
    onPick?: (ref: SlotRef) => void;
    selectedRoom?: RoomId | null;
    /** A pending move: drawn as a preview over `house` (which should already include it). */
    preview?: { move: Move; before: House } | null;
    /** Animate this change (the latest move, first time seen). */
    animate?: { id: number; move: Move; before: House } | null;
    /** Feature to mark with a soft pulse (last change). */
    mark?: SlotRef | null;
    className?: string;
    compact?: boolean;
    /** Board: names the rooms and furnishes both upstairs rooms as bedrooms on the roommates board. */
    board?: Board;
    /** Roommates board: where each seat sleeps, and how to draw each seat's token. */
    beds?: Beds | null;
    people?: (seat: number) => TokenP | null;
    /** Seats whose token just moved (pop-in animation / preview pulse). */
    movedSeats?: number[];
    previewSeats?: boolean;
    /** Twists: the heirloom slot gets a padlock, the keeper's room their badge. */
    twists?: Twists | null;
    /** Rooms the viewer can't change right now (keeper / turn rules), shaded with the reason as a tooltip. */
    blocked?: Partial<Record<RoomId, string>>;
}

export const HouseView: React.FC<HouseProps> = ({ house, onPick, selectedRoom, preview, animate, mark, className, compact, board = 'classic', beds, people, movedSeats, previewSeats, twists, blocked }) => {
    const catIn = (room: RoomId) => {
        if (house.pet !== room) return null;
        const walked = animate && animate.move.kind === 'cat' ? animate.id : null;
        const previewing = preview && preview.move.kind === 'cat';
        return (
            <g className="dc-cat" transform="translate(68 99)">
                <title>The cat</title>
                <g key={`cat-${walked || 0}`} className={previewing ? 'dc-preview-token' : walked ? 'dc-token-in' : 'dc-cat-idle'}>{catShapes()}</g>
            </g>
        );
    };
    const catLeft = (room: RoomId) => {
        const m = preview && preview.move.kind === 'cat' ? preview : animate && animate.move.kind === 'cat' ? animate : null;
        if (!m || m.before.pet !== room || house.pet === room) return null;
        // the cat leaving: a faint ghost while previewing, shrinking away after a real walk
        // (nested: a CSS transform on the translated group would replace its position)
        return (
            <g transform="translate(68 99)" key={`catout-${m === preview ? 'p' : animate!.id}`} className="dc-cat">
                {m === preview
                    ? <g opacity="0.5"><g className="dc-ghost">{catShapes()}</g></g>
                    : <g className="dc-pop-out dc-cat-out">{catShapes()}</g>}
            </g>
        );
    };
    const keeperBadge = (room: RoomId) => {
        const k = twists && twists.keeper;
        if (!k || k.room !== room || !people) return null;
        const p = people(k.seat);
        if (!p) return null;
        const x = 20 + roomName(room, board).length * 5.7 + 10;
        return <RoommateToken p={p} cx={x} cy={19.5} r={7} className="dc-keeper" />;
    };
    const tokensIn = (room: RoomId) => {
        if (!beds || !people || BEDROOMS.indexOf(room) === -1) return null;
        const seats = beds.map((b, seat) => b === room ? seat : -1).filter(x => x !== -1);
        return seats.map((seat, i) => {
            const p = people(seat);
            if (!p) return null;
            const moved = movedSeats && movedSeats.indexOf(seat) !== -1;
            return <RoommateToken key={`${seat}-${room}`} p={p} cx={122 + i * 22} cy={26} r={10}
                className={moved ? (previewSeats ? 'dc-preview-token' : 'dc-token-in') : ''} />;
        });
    };
    const interactive = !!onPick;
    const changed = (room: RoomId, t: ObjType | 'wall', m?: Move | null) =>
        !!m && m.room === room && (m.kind === 'paint' ? t === 'wall' : (m as any).type === t);

    const renderSlot = (room: RoomId, t: ObjType) => {
        const style = house[room][t];
        const p = SLOT[t];
        const box = slotBox(t);
        const isPrev = changed(room, t, preview?.move);
        const isAnim = changed(room, t, animate?.move);
        const isMark = mark && mark.room === room && mark.type === t;
        const removedStyle = isPrev && preview!.move.kind === 'remove' ? preview!.before[room][t]
            : isAnim && animate!.move.kind === 'remove' ? animate!.before[room][t] : null;
        const animCls = isAnim ? (animate!.move.kind === 'swap' ? 'dc-swap-in' : animate!.move.kind === 'add' ? 'dc-pop-in' : '') : '';
        const tr = `translate(${box.x} ${box.y}) scale(${p.s})`;
        return (
            <g key={t} className={['dc-slot', `t-${t}`, interactive ? 'tap' : ''].join(' ')}
                onClick={interactive ? (e) => { e.stopPropagation(); onPick!({ room, type: t }); } : undefined}>
                {isMark && <circle className="dc-mark" cx={box.x + box.size / 2} cy={box.y + box.size / 2} r={box.size * 0.56} />}
                {twists && twists.heirloom && twists.heirloom.room === room && twists.heirloom.type === t && (
                    <g className="dc-heirloom" transform={p.floor ? `translate(${box.x + box.size * 0.6} ${box.y + box.size - 13})` : `translate(${box.x + box.size - 8} ${box.y})`}>
                        <title>Family heirloom: it stays</title>
                        <circle cx="6" cy="6" r="7" fill="#fff" />
                        <g transform="translate(0.2 0) scale(0.5)">
                            <path d="M7 11 L7 8 Q7 3 12 3 Q17 3 17 8 L17 11 L14.6 11 L14.6 8 Q14.6 5.4 12 5.4 Q9.4 5.4 9.4 8 L9.4 11 Z" fill="#b08a4a" opacity="0.75" />
                            <rect x="4.5" y="10" width="15" height="11" rx="2.6" fill="#b08a4a" />
                        </g>
                    </g>
                )}
                {!style && !removedStyle && (
                    <g className="dc-empty-slot">
                        <rect x={box.x + box.size * 0.18} y={box.y + box.size * 0.18} width={box.size * 0.64} height={box.size * 0.64} rx="6" fill={INK} opacity="0.06" />
                        <g transform={`translate(${box.x + box.size * 0.3} ${box.y + box.size * 0.3}) scale(${box.size * 0.4 / 24})`} opacity="0.2">{typeShapes(t, INK)}</g>
                    </g>
                )}
                {removedStyle && (
                    <g transform={tr}>
                        <g key={`out-${animate ? animate.id : 'p'}`} className={isAnim ? 'dc-pop-out' : 'dc-ghost'}>{objectShapes(t, removedStyle)}</g>
                    </g>
                )}
                {style && (
                    <g transform={tr}>
                        <g key={`${style}-${isAnim ? animate!.id : 0}`} className={[animCls, isPrev ? 'dc-preview' : ''].join(' ')}>
                            {objectShapes(t, style)}
                        </g>
                    </g>
                )}
                {interactive && <rect x={box.x - 4} y={box.y - 4} width={box.size + 8} height={box.size + 8} fill="transparent" />}
            </g>
        );
    };

    return (
        <svg className={['dc-house', compact ? 'compact' : '', className || ''].join(' ')} viewBox={`0 0 ${HOUSE_W} ${HOUSE_H}`}
            role="img" aria-label="The house">
            {/* roof */}
            <path d={`M4 ${ROOF + 10} L${HOUSE_W / 2} 4 L${HOUSE_W - 4} ${ROOF + 10} Z`} fill="#a9a1c4" />
            <path d={`M${HOUSE_W / 2} 4 L${HOUSE_W - 4} ${ROOF + 10} L${HOUSE_W / 2 + 40} ${ROOF + 10} Z`} fill="#938bb2" />
            <rect x={HOUSE_W / 2 - 13} y={ROOF - 16} width="26" height="20" rx="10" fill="#efe9f6" />
            <rect x={HOUSE_W / 2 - 1} y={ROOF - 16} width="2" height="20" fill="#cfc8de" />
            {/* body */}
            <rect x="8" y={ROOF + 4} width={HOUSE_W - 16} height={HOUSE_H - ROOF - 8} rx="6" fill="#efe7dc" />
            <rect x="8" y={HOUSE_H - 12} width={HOUSE_W - 16} height="8" rx="4" fill="#ddd2c4" />
            {ROOMS.map(room => {
                const { x, y } = ROOM_POS[room];
                const wall = house[room].wall;
                const before = (animate && animate.move.kind === 'paint' && animate.move.room === room) ? animate.before[room].wall : null;
                const isWallPrev = changed(room, 'wall', preview?.move);
                const isWallMark = mark && mark.room === room && mark.type === 'wall';
                const sel = selectedRoom === room;
                return (
                    <g key={room} className={['dc-room', `r-${room}`, sel ? 'sel' : '', interactive ? 'tap' : ''].join(' ')}
                        transform={`translate(${x} ${y})`}
                        onClick={interactive ? () => onPick!({ room, type: 'wall' }) : undefined}>
                        <rect x="0" y="0" width={RW} height={RH} fill="#f3ece2" />
                        <rect className="dc-wall" x="14" y="10" width={RW - 28} height="100" fill={PAL[wall].wall} />
                        {before && <rect key={`paint-${animate!.id}`} className="dc-paint-old" x="14" y="10" width={RW - 28} height="100" fill={PAL[before].wall} />}
                        {isWallPrev && <rect className="dc-wall-preview" x="14" y="10" width={RW - 28} height="100" fill={PAL[preview!.before[room].wall].wall} />}
                        <path className="dc-wall-side" d={`M0 0 L14 10 L14 110 L0 ${RH} Z`} fill={PAL[wall].wallShade} />
                        <path className="dc-wall-side" d={`M${RW} 0 L${RW - 14} 10 L${RW - 14} 110 L${RW} ${RH} Z`} fill={PAL[wall].wallShade} />
                        <path d={`M0 0 L${RW} 0 L${RW - 14} 10 L14 10 Z`} fill="#e9e0d3" />
                        <path d={`M14 110 L${RW - 14} 110 L${RW} ${RH} L0 ${RH} Z`} fill={FLOOR[room].base} />
                        <rect x="14" y="106" width={RW - 28} height="4" fill={PAL[wall].wallShade} />
                        {isWallMark && <rect className="dc-mark-wall" x="14" y="10" width={RW - 28} height="100" />}
                        <text className="dc-room-label" x="20" y="22">{roomName(room, board).toUpperCase()}</text>
                        {furniture(room, board)}
                        {/* side table for the curio */}
                        <rect x="110" y="103" width="44" height="4" rx="2" fill={NEUTRAL.shade} />
                        <rect x="114" y="107" width="3" height="21" fill={NEUTRAL.shade} />
                        <rect x="147" y="107" width="3" height="21" fill={NEUTRAL.base} />
                        <ellipse cx="132" cy="129" rx="20" ry="2.4" fill={SHADOW} />
                        {catLeft(room)}
                        {TYPES.map(t => renderSlot(room, t))}
                        {catIn(room)}
                        {tokensIn(room)}
                        {keeperBadge(room)}
                        {blocked && blocked[room] && (
                            <g className="dc-blocked"><title>{blocked[room]}</title>
                                <rect x="0" y="0" width={RW} height={RH} fill="#3d3a52" opacity="0.12" />
                                <circle cx={RW - 18} cy={RH - 16} r="9" fill="#e5908a" />
                                <rect x={RW - 23.5} y={RH - 17.4} width="11" height="2.8" rx="1.4" fill="#fff" />
                            </g>
                        )}
                        {sel && <rect className="dc-room-ring" x="2" y="2" width={RW - 4} height={RH - 4} rx="4" />}
                    </g>
                );
            })}
        </svg>
    );
};

/** A tiny swatch for a wall colour in menus. */
export const WallSwatch: React.FC<{ color: Color; size?: number }> = ({ color, size = 40 }) => (
    <svg className="dc-swatch" width={size} height={size} viewBox="0 0 40 40" aria-label={`${color} paint`}>
        <rect x="4" y="4" width="32" height="32" rx="7" fill={PAL[color].wall} />
        <path d="M4 26 L36 26 L36 29 Q36 36 29 36 L11 36 Q4 36 4 29 Z" fill={PAL[color].wallShade} />
        <rect x="15" y="12" width="10" height="12" rx="3" fill={PAL[color].base} />
        <rect x="19" y="7" width="2" height="6" rx="1" fill={PAL[color].shade} />
    </svg>
);

export const isWarm = (c: Color) => WARM[c];
