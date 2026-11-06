/**
 * HookyBits.tsx — small presentational pieces for Hooky: student cards with a
 * doodled face, letter tiles, the answer stamp, avatars, a paper plane,
 * confetti, a doodle backdrop and the mute switch.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { STUDENTS, colourOf, CARD_COLOURS } from '../HookyData';
import { sfx, isMuted, setMuted, onMuteChange } from '../HookySound';

export const INK = '#2d2a3e';

// ---------------------------------------------------------------------------
// First-sight bookkeeping (entrance animations play once per client)
// ---------------------------------------------------------------------------

const ANIM_WINDOW = 1600;
const SEEN = new Map<string, Map<string | number, number>>();

/** True while `key` is fresh for this client: its entrance animation should play. */
export function fresh(me: string, key: string | number): boolean {
    let s = SEEN.get(me);
    if (!s) { s = new Map(); SEEN.set(me, s); }
    const now = Date.now();
    if (!s.has(key)) s.set(key, now);
    return now - s.get(key)! < ANIM_WINDOW;
}

// ---------------------------------------------------------------------------
// Student face doodle
// ---------------------------------------------------------------------------

/** A tiny flat face; hair style, skin and expression vary by letter. */
export const Face: React.FC<{ letter: string; size?: number; sleepy?: boolean }> = ({ letter, size = 36, sleepy }) => {
    const i = letter.charCodeAt(0) - 65;
    const skins = ['#ffd9b8', '#f2c29b', '#d9a07a', '#b97c55', '#8d5a3b'];
    const hairs = ['#3b2a20', '#6b3e1f', '#e0b04a', '#c4552d', '#2d2a3e', '#8a6bd1'];
    const skin = skins[(i * 3) % skins.length];
    const hair = hairs[(i * 5 + 1) % hairs.length];
    const style = i % 6;
    return (
        <svg className="hk-face" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
            {style === 2 && <circle cx="20" cy="22" r="17" fill={hair} />}
            {style === 5 && <><circle cx="7" cy="14" r="5" fill={hair} /><circle cx="33" cy="14" r="5" fill={hair} /></>}
            <circle cx="20" cy="22" r="13" fill={skin} stroke={INK} strokeWidth="2" />
            {style === 0 && <path d="M7 20 Q8 7 20 7 Q32 7 33 20 Q27 13 20 14 Q13 13 7 20 Z" fill={hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
            {style === 1 && <path d="M8 18 Q10 6 22 7 Q32 8 32 18 L26 13 L22 16 L18 12 L13 16 Z" fill={hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
            {style === 2 && <path d="M8 19 Q12 9 20 9 Q28 9 32 19 Q26 15 20 15 Q14 15 8 19 Z" fill={hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
            {style === 3 && <><path d="M8 17 Q20 3 32 17 Z" fill={hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" /><rect x="6" y="15" width="28" height="4" rx="2" fill={CARD_COLOURS[i % CARD_COLOURS.length]} stroke={INK} strokeWidth="2" /></>}
            {style === 4 && <path d="M9 18 Q9 8 20 8 Q31 8 31 18 Q29 12 25 12 L20 16 L15 12 Q11 12 9 18 Z" fill={hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
            {style === 5 && <path d="M8 18 Q10 8 20 8 Q30 8 32 18 Q20 12 8 18 Z" fill={hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
            {sleepy
                ? <><path d="M13 23 q2.5 2 5 0 M22 23 q2.5 2 5 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" /></>
                : <><circle cx="15.5" cy="23" r="1.9" fill={INK} /><circle cx="24.5" cy="23" r="1.9" fill={INK} /></>}
            <path d={i % 3 === 0 ? 'M16 29 q4 3.5 8 0' : i % 3 === 1 ? 'M17 29.5 h6' : 'M16.5 28.5 q3.5 4 7 0 Z'}
                stroke={INK} strokeWidth="2" fill={i % 3 === 2 ? '#ff8f9a' : 'none'} strokeLinecap="round" />
            <circle cx="11.5" cy="27" r="1.8" fill="#ff9aa2" opacity=".6" />
            <circle cx="28.5" cy="27" r="1.8" fill="#ff9aa2" opacity=".6" />
        </svg>
    );
};

// ---------------------------------------------------------------------------
// Student card
// ---------------------------------------------------------------------------

export type CardLook = 'face' | 'back';

export const StudentCard: React.FC<{
    letter?: string | null;
    look?: CardLook;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    badge?: React.ReactNode;
    anim?: 'deal' | 'flip' | 'pop' | null;
    delay?: number;
    dim?: boolean;
    onClick?: () => void;
    selected?: boolean;
    className?: string;
}> = ({ letter, look = 'face', size = 'md', badge, anim, delay = 0, dim, onClick, selected, className }) => {
    const L = letter || '?';
    const showFace = look === 'face' && !!letter;
    const cls = ['hk-card', `size-${size}`, showFace ? 'face' : 'back', anim ? `anim-${anim}` : '',
        dim ? 'dim' : '', selected ? 'selected' : '', onClick ? 'tappable' : '', className || ''].join(' ');
    const style = { '--c': showFace ? colourOf(L) : '#fff6d6', '--d': `${delay}ms` } as any;
    const body = showFace ? (
        <>
            <span className="hk-card-letter">{L}</span>
            {size !== 'xs' && <Face letter={L} size={size === 'lg' ? 46 : size === 'md' ? 34 : 24} />}
            {(size === 'md' || size === 'lg') && <span className="hk-card-name">{STUDENTS[L]}</span>}
        </>
    ) : (
        <span className="hk-card-back"><span>?</span></span>
    );
    return onClick
        ? <button type="button" className={cls} style={style} onClick={onClick}>{body}{badge}</button>
        : <span className={cls} style={style}>{body}{badge}</span>;
};

// ---------------------------------------------------------------------------
// Letter tiles
// ---------------------------------------------------------------------------

export type TileMark = 'yes' | 'no' | 'maybe' | 'mine' | null;

export const Tile: React.FC<{
    ch: string; size?: number; anim?: boolean; delay?: number; mark?: TileMark; empty?: boolean; caret?: boolean;
}> = ({ ch, size = 40, anim, delay = 0, mark, empty, caret }) => (
    <span className={['hk-tile', anim ? 'anim' : '', mark ? `mark-${mark}` : '', empty ? 'empty' : '', caret ? 'caret' : ''].join(' ')}
        style={{ '--s': `${size}px`, '--d': `${delay}ms`, '--c': empty ? '#fff' : colourOf(ch || 'A') } as any}>
        {ch}
    </span>
);

export const TileWord: React.FC<{ word: string; size?: number; anim?: boolean; marks?: TileMark[]; stagger?: number }> =
    ({ word, size = 40, anim, marks, stagger = 70 }) => (
        <span className="hk-tileword">
            {word.split('').map((ch, i) => <Tile key={i} ch={ch} size={size} anim={anim} delay={i * stagger} mark={marks ? marks[i] : null} />)}
        </span>
    );

/** The answer, rubber-stamped onto the board. */
export const Stamp: React.FC<{ n: number; anim?: boolean; size?: number; delay?: number }> = ({ n, anim, size = 52, delay = 420 }) => (
    <span className={['hk-stamp', anim ? 'anim' : '', `n${Math.min(n, 5)}`].join(' ')} style={{ '--s': `${size}px`, '--d': `${delay}ms` } as any}>
        <b>{n}</b>
    </span>
);

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface AvatarP { name: string; accent: string; icon: number; }

export const Avatar: React.FC<{ p: AvatarP; size?: number }> = ({ p, size = 36 }) => (
    <span className="hk-avatar" style={{ width: size, height: size, '--a': p.accent } as any} title={p.name}>
        <FontAwesomeIcon icon={(LOBBY_ICONS[p.icon] || 'grin') as any} />
    </span>
);

/** A bell glyph for the Hooky column. */
export const BellGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="hk-bell">
        <path d="M12 3 q-6 0 -6 7 v4 l-2 3 h16 l-2 -3 v-4 q0 -7 -6 -7 Z" fill="#ffd166" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="12" cy="19.5" r="2.2" fill={INK} />
    </svg>
);

/** A slide for the Playground. */
export const SlideGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 21 V6 M8 21 V6 M4 9 h4 M4 13 h4 M4 17 h4" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 6 Q14 6 16 13 Q18 20 22 20" stroke="#ff9aa2" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
);

export const PlaneGlyph: React.FC<{ size?: number }> = ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M2 15 L30 3 L22 29 L15 19 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M15 19 L30 3 M15 19 L14 26 L18 22" stroke={INK} strokeWidth="2" fill="#e8e4f7" strokeLinejoin="round" />
    </svg>
);

/** A paper plane that swoops across the screen once (keyed by the event id). */
export const PaperPlane: React.FC<{ id: number }> = ({ id }) => (
    <span key={id} className="hk-plane" aria-hidden="true"><PlaneGlyph size={34} /></span>
);

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export const Title: React.FC<{ size?: number }> = ({ size = 44 }) => (
    <div className="hk-title">
        <TileWord word="HOOKY" size={size} anim stagger={90} />
        <div className="hk-title-sub">Who&rsquo;s skipping class?</div>
    </div>
);

// ---------------------------------------------------------------------------
// Confetti & backdrop
// ---------------------------------------------------------------------------

export const Confetti: React.FC<{ count?: number }> = ({ count = 40 }) => {
    const bits = React.useMemo(() => Array.from({ length: count }, (_, i) => ({
        left: (i * 37 + 11) % 100,
        delay: (i * 53) % 900,
        dur: 1500 + ((i * 97) % 900),
        colour: CARD_COLOURS[i % CARD_COLOURS.length],
        shape: ['sq', 'ci', 'tri', 'bar'][i % 4],
        spin: (i % 2 ? 1 : -1) * (360 + (i * 41) % 360)
    })), [count]);
    return (
        <div className="hk-confetti" aria-hidden="true">
            {bits.map((b, i) => (
                <span key={i} className={`bit ${b.shape}`} style={{
                    left: `${b.left}%`, animationDelay: `${b.delay}ms`, animationDuration: `${b.dur}ms`,
                    '--c': b.colour, '--spin': `${b.spin}deg`
                } as any} />
            ))}
        </div>
    );
};

/** Faint floating doodles: a pencil, an apple, a star, a paper plane. */
export const Backdrop: React.FC = () => (
    <div className="hk-backdrop" aria-hidden="true">
        <svg className="fl" style={{ left: '5%', top: '10%' }} width="42" height="42" viewBox="0 0 40 40">
            <path d="M8 32 L28 6 L34 11 L14 37 L6 38 Z" fill="#ffe38f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M28 6 L34 11" stroke="#ff9aa2" strokeWidth="5" />
        </svg>
        <svg className="fl" style={{ left: '84%', top: '7%' }} width="36" height="36" viewBox="0 0 40 40">
            <circle cx="20" cy="24" r="13" fill="#ff9aa2" stroke={INK} strokeWidth="2.5" />
            <path d="M20 11 Q21 5 26 4" stroke={INK} strokeWidth="2.5" fill="none" />
            <path d="M21 9 Q28 6 30 11 Q24 13 21 9 Z" fill="#a8e6c4" stroke={INK} strokeWidth="2" />
        </svg>
        <svg className="fl" style={{ left: '88%', top: '52%' }} width="30" height="30" viewBox="0 0 40 40">
            <path d="M20 4 L24.5 15 L36 15.5 L27 23 L30 35 L20 28.5 L10 35 L13 23 L4 15.5 L15.5 15 Z" fill="#c6b6f7" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        <span className="fl" style={{ left: '3%', top: '62%' }}><PlaneGlyph size={34} /></span>
    </div>
);

// ---------------------------------------------------------------------------
// Mute toggle
// ---------------------------------------------------------------------------

export const MuteToggle: React.FC = () => {
    const [m, setM] = React.useState(isMuted());
    React.useEffect(() => onMuteChange(setM), []);
    return (
        <button className="hk-mute" title={m ? 'Sound off' : 'Sound on'}
            onClick={(e) => { e.stopPropagation(); setMuted(!m); if (m) setTimeout(() => sfx.select(), 30); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 9 h4 l5 -4 v14 l-5 -4 h-4 Z" fill="currentColor" />
                {m
                    ? <path d="M16 9 l5 6 M21 9 l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    : <path d="M15.5 8.5 q3 3.5 0 7 M18 6 q5.5 6 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
            </svg>
        </button>
    );
};
