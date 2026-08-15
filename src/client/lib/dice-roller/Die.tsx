/**
 * Die.tsx — a single die: renders a face (vector glyph or label) in a flat or 2.5D
 * "iso" tile, and plays an in-place tumble animation whenever it (re)rolls.
 *
 * Roll detection: the tumble replays whenever `rollNonce` OR `faceId` changes (and on
 * mount). During the tumble the die flips through random faces, so the real result is
 * hidden until it settles — i.e. the animation always plays *before* the result shows.
 */

import * as React from 'react';
import { ExpressiveIcon } from '../card-renderer/IconEngine';
import { Palette } from '../card-renderer/types';
import { DiceFaceset, DiceTheme, RollAnimation, DEFAULT_ANIMATION } from './types';
import './dice-roller.scss';

// ExpressiveIcon needs a palette; face glyphs always paint via `colorOverride`, so the
// palette values are irrelevant here.
const STUB_PALETTE: Palette = {
    id: 'dr', name: 'dr', background: '#ffffff', border: '#000000', primary: '#000000',
    secondary: '#000000', accent: '#000000', charcoal: '#000000', text: '#000000',
    tertiary: '#000000', success: '#000000', danger: '#000000'
};

function darken(hex: string, amt: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
    const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
    const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function randomFaceId(faceset: DiceFaceset, exclude?: string): string {
    const keys = Object.keys(faceset);
    if (keys.length === 0) return exclude || '';
    if (keys.length === 1) return keys[0];
    let id = keys[Math.floor(Math.random() * keys.length)];
    let guard = 0;
    while (id === exclude && guard++ < 5) id = keys[Math.floor(Math.random() * keys.length)];
    return id;
}

export interface DieProps {
    faceId: string;
    faceset: DiceFaceset;
    theme?: DiceTheme;
    animation?: RollAnimation;
    rollNonce?: number | string; // change to force a re-roll animation (even to the same face)
    delay?: number;              // ms before this die starts tumbling (pool stagger)
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    onClick?: () => void;
    children?: React.ReactNode;  // overlay layer (badges, corner markers…)
    onRollStart?: () => void;
    onRollEnd?: () => void;
}

export const Die: React.FC<DieProps> = (props) => {
    const t = props.theme || {};
    const anim = { ...DEFAULT_ANIMATION, ...(props.animation || {}) };
    const faceset = props.faceset;

    const size = t.size ?? 46;
    const radius = t.radius ?? Math.round(size * 0.24);
    const depth = t.depth ?? Math.round(size * 0.16);
    const glyphScale = t.glyphScale ?? 0.62;
    const glyphPx = Math.round(size * glyphScale);
    const style = t.style ?? 'flat';

    const [displayId, setDisplayId] = React.useState<string>(() => anim.enabled ? randomFaceId(faceset, props.faceId) : props.faceId);
    const [rolling, setRolling] = React.useState<boolean>(!!anim.enabled);
    const [landing, setLanding] = React.useState<boolean>(false);
    const timers = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

    React.useEffect(() => {
        clearTimers();
        if (!anim.enabled) { setDisplayId(props.faceId); setRolling(false); setLanding(false); return; }
        setRolling(true); setLanding(false);
        if (props.onRollStart) props.onRollStart();
        const begin = setTimeout(() => {
            const iv = setInterval(() => setDisplayId(prev => randomFaceId(faceset, prev)), anim.tumbleInterval);
            timers.current.push(iv as unknown as ReturnType<typeof setTimeout>);
            const settle = setTimeout(() => {
                clearInterval(iv);
                setDisplayId(props.faceId);
                setRolling(false);
                setLanding(true);
                const land = setTimeout(() => setLanding(false), 260);
                timers.current.push(land);
                if (props.onRollEnd) props.onRollEnd();
            }, anim.duration);
            timers.current.push(settle);
        }, props.delay || 0);
        timers.current.push(begin);
        return clearTimers;
        // Replay on an explicit roll signal or a new result; also on mount.
    }, [props.rollNonce, props.faceId]);

    const face = faceset[displayId] || faceset[props.faceId] || faceset[Object.keys(faceset)[0]];
    if (!face) return null;

    const cssVars: React.CSSProperties = {
        width: size, height: size,
        ['--dr-size' as any]: `${size}px`,
        ['--dr-radius' as any]: `${radius}px`,
        ['--dr-color' as any]: face.color,
        ['--dr-side' as any]: darken(face.color, 0.26),
        ['--dr-depth' as any]: `${depth}px`,
        ['--dr-border' as any]: t.borderColor || 'transparent',
        ['--dr-border-w' as any]: `${t.borderWidth ?? 0}px`
    };

    const cls = [
        'dr-die', `dr-style-${style}`,
        rolling ? 'is-rolling' : '', landing ? 'is-landing' : '',
        props.onClick ? 'is-clickable' : '', props.className || ''
    ].filter(Boolean).join(' ');

    return (
        <div className={cls} style={{ ...cssVars, ...props.style }} title={props.title}
            onClick={props.onClick} role={props.onClick ? 'button' : undefined}>
            <div className="dr-die-face">
                {face.icon ? (
                    <span className="dr-die-glyph" style={{ width: glyphPx, height: glyphPx }}>
                        <ExpressiveIcon icon={face.icon} palette={STUB_PALETTE} colorOverride={face.glyphColor || '#ffffff'} />
                    </span>
                ) : face.label ? (
                    <span className="dr-die-label" style={{ color: face.glyphColor || '#ffffff' }}>{face.label}</span>
                ) : null}
            </div>
            {props.children != null && <div className="dr-die-overlay">{props.children}</div>}
        </div>
    );
};

export default Die;
