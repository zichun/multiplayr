/**
 * JJBits.tsx — small presentational pieces for Jibber Jabble: chunky letter
 * blocks, the Blabbit mascot, player avatars, tier pills, confetti and the
 * floating geometric backdrop.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { Tier, TIER_LABEL, TIER_NONSENSE, HintId, EmoteId, EMOTES } from '../JJData';
import { JJPlayer } from '../JJTypes';
import { sfx, isMuted, setMuted, onMuteChange } from '../JJSound';

// Pastel block colours, cycled along a word.
export const BLOCK_COLOURS = ['#ff9aa2', '#ffc28f', '#ffe38f', '#a8e6c4', '#9fd3f5', '#c6b6f7'];
const TILTS = [-5, 3, -2, 4, -4, 2, -3, 5];

export const tiltFor = (seed: number) => TILTS[Math.abs(seed * 7 + 3) % TILTS.length];
export const colourFor = (i: number, offset = 0) => BLOCK_COLOURS[(i + offset) % BLOCK_COLOURS.length];

// ---------------------------------------------------------------------------
// Letter blocks
// ---------------------------------------------------------------------------

export type BlockAnim = 'drop' | 'flip' | 'pop' | 'shake' | 'none';

interface BlockProps {
    ch: string;
    colour: string;
    tilt?: number;
    anim?: BlockAnim;
    delay?: number;     // ms
    dot?: string;       // author accent
    ghost?: boolean;    // a "?" placeholder
    title?: string;
}

export const LetterBlock: React.FC<BlockProps> = ({ ch, colour, tilt = 0, anim = 'none', delay = 0, dot, ghost, title }) => (
    <span
        className={['jj-block', `anim-${anim}`, ghost ? 'ghost' : ''].join(' ')}
        style={{ '--c': colour, '--r': `${tilt}deg`, '--d': `${delay}ms` } as any}
        title={title}
    >
        <span className="jj-block-face">{ch}</span>
        {dot && <span className="jj-block-dot" style={{ background: dot }} />}
    </span>
);

/** A whole word as blocks. `size` sets the block edge in px. */
export const BlockWord: React.FC<{
    word: string; size?: number; anim?: BlockAnim; stagger?: number; offset?: number; className?: string;
}> = ({ word, size = 44, anim = 'none', stagger = 60, offset = 0, className }) => (
    <span className={['jj-word', className || ''].join(' ')} style={{ '--max': `${size}px`, '--n': Math.max(word.length, 1) } as any}>
        {word.split('').map((ch, i) => ch === ' '
            ? <span key={i} className="jj-word-gap" />
            : <LetterBlock key={i} ch={ch} colour={colourFor(i, offset)} tilt={tiltFor(i + offset)}
                anim={anim} delay={i * stagger} />)}
    </span>
);

/** Block edge for a clue of this length, so long clues still fit a phone. */
export function blockSizeFor(len: number, max = 60): number {
    if (len <= 5) return max;
    if (len <= 7) return Math.min(max, 46);
    if (len <= 9) return Math.min(max, 38);
    if (len <= 12) return Math.min(max, 30);
    return Math.min(max, 26);
}

/**
 * Remembers which letters/stamps a client has already seen animate in, so a
 * tab switch doesn't replay every drop. Keyed per client because the debug
 * page runs several clients in one window.
 */
export interface SeenRec { t: number; delay: number; }
const SEEN = new Map<string, Map<string | number, SeenRec>>();
export function seenMap(clientId: string): Map<string | number, SeenRec> {
    let s = SEEN.get(clientId);
    if (!s) { s = new Map(); SEEN.set(clientId, s); }
    return s;
}

// ---------------------------------------------------------------------------
// Scramble → settle ("unjumble") animation for the secret word
// ---------------------------------------------------------------------------

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class ScrambleWord extends React.Component<
    { word: string; size?: number; play: boolean; onDone?: () => void },
    { settled: number; noise: string }
> {
    private timer: any = null;
    public state = { settled: 0, noise: '' };

    componentDidMount() {
        if (this.props.play) this.run();
        else this.setState({ settled: this.props.word.length });
    }
    componentWillUnmount() { if (this.timer) clearInterval(this.timer); }

    private run() {
        const word = this.props.word;
        let frame = 0;
        this.timer = setInterval(() => {
            frame++;
            const settled = Math.min(word.length, Math.max(0, Math.floor((frame - 6) / 2)));
            let noise = '';
            for (let i = 0; i < word.length; i++) noise += ALPHA[Math.floor(Math.random() * 26)];
            if (frame % 2 === 0) sfx.tick(frame);
            this.setState({ settled, noise });
            if (settled >= word.length) {
                clearInterval(this.timer);
                this.timer = null;
                sfx.select();
                if (this.props.onDone) this.props.onDone();
            }
        }, 55);
    }

    render() {
        const { word, size = 34 } = this.props;
        const { settled, noise } = this.state;
        return (
            <span className="jj-word" style={{ '--max': `${size}px`, '--n': Math.max(word.length, 1) } as any}>
                {word.split('').map((ch, i) => {
                    const done = i < settled;
                    return (
                        <LetterBlock key={i}
                            ch={done ? ch : (noise[i] || '?')}
                            colour={done ? colourFor(i) : '#e9e5f5'}
                            tilt={done ? tiltFor(i) : tiltFor(i + 3) * 2}
                            anim={done ? 'pop' : 'none'} />
                    );
                })}
            </span>
        );
    }
}

// ---------------------------------------------------------------------------
// Blabbit — the mascot: a geometric speech bubble with googly eyes
// ---------------------------------------------------------------------------

export type Mood = 'happy' | 'confused' | 'shock' | 'peek' | 'sleepy' | 'party';

export const Blabbit: React.FC<{ mood?: Mood; size?: number; colour?: string; className?: string }> = ({
    mood = 'happy', size = 72, colour = '#c6b6f7', className
}) => {
    const eyes = mood === 'peek'
        ? (
            <g className="bb-hands">
                <rect x="22" y="30" width="24" height="16" rx="8" fill="#ffc28f" />
                <rect x="54" y="30" width="24" height="16" rx="8" fill="#ffc28f" />
            </g>
        )
        : mood === 'sleepy'
            ? (
                <g stroke="#2e2a47" strokeWidth="3.5" strokeLinecap="round" fill="none">
                    <path d="M 27 38 Q 34 43 41 38" />
                    <path d="M 59 38 Q 66 43 73 38" />
                </g>
            )
            : (
                <g>
                    <circle cx="34" cy="37" r="10" fill="#fff" stroke="#2e2a47" strokeWidth="2.5" />
                    <circle cx="66" cy="37" r={mood === 'shock' ? 12 : 10} fill="#fff" stroke="#2e2a47" strokeWidth="2.5" />
                    <circle className="bb-pupil l" cx={mood === 'confused' ? 31 : 36} cy={mood === 'confused' ? 34 : 39} r="4.2" fill="#2e2a47" />
                    <circle className="bb-pupil r" cx={mood === 'confused' ? 69 : 64} cy={mood === 'confused' ? 41 : 39} r="4.2" fill="#2e2a47" />
                </g>
            );
    const mouth = {
        happy: <path d="M 36 56 Q 50 68 64 56" stroke="#2e2a47" strokeWidth="4" fill="none" strokeLinecap="round" />,
        party: <path d="M 34 54 Q 50 74 66 54 Z" fill="#2e2a47" />,
        confused: <path d="M 34 60 L 41 55 L 48 60 L 55 55 L 62 60 L 68 56" stroke="#2e2a47" strokeWidth="3.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />,
        shock: <ellipse cx="50" cy="60" rx="7" ry="8" fill="#2e2a47" />,
        peek: <path d="M 40 60 Q 50 66 60 60" stroke="#2e2a47" strokeWidth="3.5" fill="none" strokeLinecap="round" />,
        sleepy: <path d="M 43 60 L 57 60" stroke="#2e2a47" strokeWidth="3.5" strokeLinecap="round" />
    }[mood];
    return (
        <svg className={['jj-blabbit', `mood-${mood}`, className || ''].join(' ')} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
            <path d="M 14 14 H 86 a 8 8 0 0 1 8 8 V 70 a 8 8 0 0 1 -8 8 H 46 L 28 94 L 30 78 H 14 a 8 8 0 0 1 -8 -8 V 22 a 8 8 0 0 1 8 -8 Z"
                fill={colour} stroke="#2e2a47" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="20" cy="22" r="3" fill="#fff" opacity="0.7" />
            {eyes}
            {mouth}
        </svg>
    );
};

// ---------------------------------------------------------------------------
// Emote faces — flat geometric "emoji" in the Blabbit style
// ---------------------------------------------------------------------------

const INK = '#2e2a47';
const heart = (cx: number, cy: number, s: number) =>
    `M ${cx} ${cy + 6 * s} C ${cx - 10 * s} ${cy - 1 * s} ${cx - 6 * s} ${cy - 9 * s} ${cx} ${cy - 4 * s} C ${cx + 6 * s} ${cy - 9 * s} ${cx + 10 * s} ${cy - 1 * s} ${cx} ${cy + 6 * s} Z`;

export const EmoteFace: React.FC<{ id: EmoteId; size?: number }> = ({ id, size = 36 }) => {
    const colour = (EMOTES.find(e => e.id === id) || EMOTES[0]).colour;
    const stroke = { stroke: INK, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
    const parts: Record<EmoteId, React.ReactNode> = {
        laugh: <>
            <path d="M 27 44 L 36 36 L 45 44" {...stroke} />
            <path d="M 55 44 L 64 36 L 73 44" {...stroke} />
            <path d="M 28 56 H 72 Q 70 80 50 80 Q 30 80 28 56 Z" fill={INK} />
            <path d="M 40 72 Q 50 66 60 72 Q 55 79 50 79 Q 45 79 40 72 Z" fill="#ff9aa2" />
        </>,
        love: <>
            <path d={heart(35, 42, 1.15)} fill="#e8475b" stroke={INK} strokeWidth="3" />
            <path d={heart(65, 42, 1.15)} fill="#e8475b" stroke={INK} strokeWidth="3" />
            <path d="M 34 62 Q 50 78 66 62" {...stroke} />
        </>,
        wow: <>
            <circle cx="35" cy="40" r="10" fill="#fff" stroke={INK} strokeWidth="4" />
            <circle cx="65" cy="40" r="10" fill="#fff" stroke={INK} strokeWidth="4" />
            <circle cx="35" cy="41" r="4.5" fill={INK} /><circle cx="65" cy="41" r="4.5" fill={INK} />
            <ellipse cx="50" cy="68" rx="8" ry="10" fill={INK} />
        </>,
        hmm: <>
            <path d="M 26 30 L 44 26" {...stroke} />
            <path d="M 57 33 L 74 36" {...stroke} />
            <circle cx="37" cy="42" r="5.5" fill={INK} /><circle cx="64" cy="45" r="5.5" fill={INK} />
            <path d="M 36 68 L 64 62" {...stroke} />
        </>,
        nooo: <>
            <path d="M 26 34 L 42 30" {...stroke} />
            <path d="M 58 30 L 74 34" {...stroke} />
            <circle cx="36" cy="44" r="6" fill={INK} /><circle cx="64" cy="44" r="6" fill={INK} />
            <path d="M 34 72 Q 42 62 50 70 Q 58 62 66 72" {...stroke} />
            <path d="M 72 50 Q 79 60 72 64 Q 65 60 72 50 Z" fill="#9fd3f5" stroke={INK} strokeWidth="2.5" />
        </>,
        party: <>
            <path d="M 50 2 L 64 22 L 36 22 Z" fill="#c6b6f7" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
            <circle cx="50" cy="3" r="4" fill="#ff9aa2" stroke={INK} strokeWidth="2.5" />
            <path d="M 28 44 Q 36 36 44 44" {...stroke} />
            <path d="M 56 44 Q 64 36 72 44" {...stroke} />
            <path d="M 32 58 Q 50 82 68 58 Z" fill={INK} />
            <rect x="12" y="20" width="6" height="6" fill="#9fd3f5" stroke={INK} strokeWidth="2" transform="rotate(20 15 23)" />
            <circle cx="86" cy="24" r="3.5" fill="#a8e6c4" stroke={INK} strokeWidth="2" />
        </>
    };
    return (
        <svg className={`jj-emote-face e-${id}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="54" r="40" fill={colour} stroke={INK} strokeWidth="5" />
            <circle cx="34" cy="30" r="5" fill="#fff" opacity="0.6" />
            {parts[id]}
        </svg>
    );
};

// ---------------------------------------------------------------------------
// Avatars, pills, glyphs
// ---------------------------------------------------------------------------

export const Avatar: React.FC<{ p: JJPlayer; size?: number }> = ({ p, size = 40 }) => (
    <span className="jj-avatar" style={{ width: size, height: size, '--a': p.accent } as any}>
        <FontAwesomeIcon icon={(LOBBY_ICONS[p.icon] || 'grin') as any} />
    </span>
);

export const TierPill: React.FC<{ tier: Tier; num?: number; silly?: boolean }> = ({ tier, num, silly }) => (
    <span className={`jj-tier ${tier}`}>
        {num != null && <b>#{num}</b>}
        {TIER_LABEL[tier]}
        {silly && <i>{TIER_NONSENSE[tier]}</i>}
    </span>
);

/** A small geometric glyph per hint card. */
export const HintGlyph: React.FC<{ id: HintId; size?: number }> = ({ id, size = 26 }) => {
    const ink = '#2e2a47';
    const shapes: Record<HintId, React.ReactNode> = {
        lifeline: <><circle cx="20" cy="20" r="13" fill="none" stroke={ink} strokeWidth="6" /><path d="M20 7 v6 M20 27 v6 M7 20 h6 M27 20 h6" stroke="#ff9aa2" strokeWidth="5" /></>,
        doubleup: <><rect x="5" y="9" width="14" height="18" rx="3" fill={ink} /><rect x="21" y="13" width="14" height="18" rx="3" fill={ink} opacity=".55" /></>,
        rewind: <path d="M22 8 L8 20 L22 32 Z M34 8 L20 20 L34 32 Z" fill={ink} />,
        skip: <path d="M6 8 L20 20 L6 32 Z M18 8 L32 20 L18 32 Z M32 8 h4 v24 h-4 Z" fill={ink} />,
        mulligan: <><rect x="6" y="14" width="28" height="12" rx="3" fill={ink} /><path d="M10 30 l20 -20" stroke="#ff9aa2" strokeWidth="5" strokeLinecap="round" /></>,
        encore: <path d="M16 6 h8 v10 h10 v8 h-10 v10 h-8 v-10 h-10 v-8 h10 Z" fill={ink} />,
        spotlight: <><circle cx="9" cy="20" r="4" fill={ink} /><circle cx="20" cy="20" r="4" fill={ink} /><circle cx="31" cy="20" r="4" fill={ink} /></>,
        firstdibs: <><rect x="7" y="7" width="26" height="26" rx="5" fill={ink} /><path d="M17 14 l5 -3 v18" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /></>,
        doover: <><path d="M8 16 a12 12 0 0 1 22 -4" stroke={ink} strokeWidth="5" fill="none" /><path d="M32 24 a12 12 0 0 1 -22 4" stroke={ink} strokeWidth="5" fill="none" /><path d="M26 6 l6 6 l-8 2 Z M14 34 l-6 -6 l8 -2 Z" fill={ink} /></>,
        highlighter: <path d="M20 4 L24.7 14.5 L36 15.6 L27.4 23.1 L30 34.3 L20 28.4 L10 34.3 L12.6 23.1 L4 15.6 L15.3 14.5 Z" fill={ink} />
    };
    return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">{shapes[id]}</svg>;
};

/** The red-pastel octagon. */
export const StopSign: React.FC<{ size?: number; label?: string; className?: string }> = ({ size = 44, label = 'STOP', className }) => (
    <span className={['jj-stop-sign', className || ''].join(' ')} style={{ width: size, height: size, fontSize: size * 0.27 }}>
        <span>{label}</span>
    </span>
);

// ---------------------------------------------------------------------------
// Confetti & backdrop
// ---------------------------------------------------------------------------

export const Confetti: React.FC<{ count?: number }> = ({ count = 36 }) => {
    const bits = React.useMemo(() => Array.from({ length: count }, (_, i) => ({
        left: (i * 37 + 11) % 100,
        delay: (i * 53) % 900,
        dur: 1400 + ((i * 97) % 900),
        colour: BLOCK_COLOURS[i % BLOCK_COLOURS.length],
        shape: ['sq', 'ci', 'tri', 'bar'][i % 4],
        spin: (i % 2 ? 1 : -1) * (360 + (i * 41) % 360)
    })), [count]);
    return (
        <div className="jj-confetti" aria-hidden="true">
            {bits.map((b, i) => (
                <span key={i} className={`bit ${b.shape}`} style={{
                    left: `${b.left}%`, animationDelay: `${b.delay}ms`, animationDuration: `${b.dur}ms`,
                    '--c': b.colour, '--spin': `${b.spin}deg`
                } as any} />
            ))}
        </div>
    );
};

export const Backdrop: React.FC = () => (
    <div className="jj-backdrop" aria-hidden="true">
        <span className="fl ci" style={{ left: '6%', top: '12%' }} />
        <span className="fl tri" style={{ left: '82%', top: '8%' }} />
        <span className="fl sq" style={{ left: '88%', top: '46%' }} />
        <span className="fl squig" style={{ left: '4%', top: '58%' }} />
        <span className="fl plus" style={{ left: '70%', top: '80%' }} />
        <span className="fl ci sm" style={{ left: '30%', top: '90%' }} />
    </div>
);

// ---------------------------------------------------------------------------
// Mute toggle
// ---------------------------------------------------------------------------

export const MuteToggle: React.FC = () => {
    const [m, setM] = React.useState(isMuted());
    React.useEffect(() => onMuteChange(setM), []);
    return (
        <button className="jj-mute" title={m ? 'Sound off' : 'Sound on'}
            onClick={(e) => { e.stopPropagation(); setMuted(!m); if (m) setTimeout(() => sfx.jibber(), 30); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 9 h4 l5 -4 v14 l-5 -4 h-4 Z" fill="currentColor" />
                {m
                    ? <path d="M16 9 l5 6 M21 9 l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    : <path d="M15.5 8.5 q3 3.5 0 7 M18 6 q5.5 6 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
            </svg>
        </button>
    );
};
