/**
 * DecorumBits.tsx — small presentational pieces: condition text with glyphs,
 * avatars, the mute switch, modal/sheet portals, first-sight bookkeeping.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';
import { Condition, describe, Seg, Board } from '../DecorumData';
import { FilterGlyph, ZoneGlyph, CatGlyph } from './DecorumArt';
import { sfx, isMuted, setMuted, onMuteChange } from '../DecorumSound';

// ---------------------------------------------------------------------------
// First-sight bookkeeping (entrance animations / sounds play once per client)
// ---------------------------------------------------------------------------

const ANIM_WINDOW = 1400;
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
// Conditions
// ---------------------------------------------------------------------------

/**
 * What condition text needs to know about the game: the board (room names) and
 * who sits in each seat (roommate conditions name players). Provided once per
 * screen by the main page.
 */
export interface DCTextInfo {
    board: Board;
    seat: (seat: number) => (AvatarP & { me?: boolean }) | null;
}
export const DCText = React.createContext<DCTextInfo>({ board: 'classic', seat: () => null });

const SegView: React.FC<{ s: Seg }> = ({ s }) => {
    const info = React.useContext(DCText);
    if (s.pet) return <span className="dc-kw pet"><CatGlyph size={15} />{s.t}</span>;
    if (s.zone) return <span className="dc-kw zone"><ZoneGlyph zone={s.zone} size={15} />{s.t}</span>;
    if (s.filter) return <span className="dc-kw feat"><FilterGlyph filter={s.filter} size={14} />{s.t}</span>;
    if (s.seat !== undefined) {
        const p = info.seat(s.seat);
        if (p) return <span className="dc-who-tag" style={{ '--a': p.accent } as any}><PlayerIcon p={p} size={13} /><b>{s.t}</b></span>;
    }
    return <>{s.t}</>;
};

/**
 * A condition in words. `owner` is whose card it is when that isn't the
 * reader ("Ada's bedroom…", "Ada must share…"); omit it for your own card.
 */
export const ConditionText: React.FC<{ cond: Condition; owner?: string | null }> = ({ cond, owner }) => {
    const info = React.useContext(DCText);
    const seatName = (seat: number) => {
        const p = info.seat(seat);
        return p ? (p.me ? 'you' : p.name) : `player ${seat + 1}`;
    };
    return <span className="dc-cond-text">{describe(cond, { board: info.board, owner: owner || null, seatName }).map((s, i) => <SegView key={i} s={s} />)}</span>;
};

export const Check: React.FC<{ ok: boolean | null; size?: number }> = ({ ok, size = 22 }) => (
    <span className={['dc-check', ok === null ? 'unknown' : ok ? 'ok' : 'no'].join(' ')} style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-label={ok ? 'met' : 'not met'}>
            {ok
                ? <path d="M4 12.5 L9.5 18 L20 6.5 L17.6 4.6 L9.4 13.6 L6.3 10.4 Z" fill="currentColor" />
                : <circle cx="12" cy="12" r="4.5" fill="currentColor" />}
        </svg>
    </span>
);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export interface AvatarP { name: string; accent: string; icon: number; }

export const Avatar: React.FC<{ p: AvatarP; size?: number; className?: string }> = ({ p, size = 34, className }) => (
    <span className={['dc-avatar', className || ''].join(' ')} style={{ width: size, height: size, fontSize: size * 0.46, '--a': p.accent } as any} title={p.name}>
        <FontAwesomeIcon icon={(LOBBY_ICONS[p.icon] || 'grin') as any} />
    </span>
);

/** Just the player's lobby icon, drawn in their colour (for inline text). */
export const PlayerIcon: React.FC<{ p: AvatarP; size?: number }> = ({ p, size = 15 }) => (
    <FontAwesomeIcon className="dc-player-icon" icon={(LOBBY_ICONS[p.icon] || 'grin') as any}
        style={{ color: p.accent, fontSize: size }} title={p.name} />
);

// ---------------------------------------------------------------------------
// Sound switch
// ---------------------------------------------------------------------------

export const MuteToggle: React.FC = () => {
    const [m, setM] = React.useState(isMuted());
    React.useEffect(() => onMuteChange(setM), []);
    return (
        <button className="dc-mute" title={m ? 'Sound off' : 'Sound on'} aria-label={m ? 'Sound off' : 'Sound on'}
            onClick={(e) => { e.stopPropagation(); setMuted(!m); if (m) setTimeout(() => sfx.select(), 30); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 9 h4 l5 -4 v14 l-5 -4 h-4 Z" fill="currentColor" />
                {m
                    ? <g fill="currentColor"><rect x="15" y="11" width="7" height="2.2" rx="1.1" transform="rotate(45 18.5 12)" /><rect x="15" y="11" width="7" height="2.2" rx="1.1" transform="rotate(-45 18.5 12)" /></g>
                    : <g fill="currentColor"><path d="M15 8.4 Q18.6 12 15 15.6 L14 14.6 Q16.4 12 14 9.4 Z" /><path d="M17.4 5.6 Q23.6 12 17.4 18.4 L16.3 17.3 Q21 12 16.3 6.7 Z" /></g>}
            </svg>
        </button>
    );
};

// ---------------------------------------------------------------------------
// Overlays (portalled: the debugger's scaled host screen traps position: fixed)
// ---------------------------------------------------------------------------

const portal = (node: React.ReactNode) =>
    typeof document !== 'undefined' && document.body ? createPortal(node, document.body) : node;

/**
 * True once the entrance animation should be over. Mobile browsers occasionally
 * never start a CSS animation on a freshly inserted node; with a `both` fill the
 * overlay then sits on its first keyframe (transparent / off-screen) forever.
 * The `settled` class drops the animation so the overlay always ends up visible.
 */
function useSettled(ms = 450): boolean {
    const [settled, setSettled] = React.useState(false);
    React.useEffect(() => {
        const t = setTimeout(() => setSettled(true), ms);
        return () => clearTimeout(t);
    }, [ms]);
    return settled;
}

export const Modal: React.FC<{ onClose?: () => void; children: React.ReactNode; className?: string }> = ({ onClose, children, className }) => {
    const settled = useSettled();
    return portal(
        <div className={['dc-overlay dc-modal-back', settled ? 'settled' : ''].join(' ')} onClick={onClose}>
            <div className={['dc-modal', className || ''].join(' ')} onClick={e => e.stopPropagation()}>
                {onClose && <button className="dc-modal-x" onClick={onClose} aria-label="Close">×</button>}
                {children}
            </div>
        </div>
    ) as any;
};

export const Sheet: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
    const settled = useSettled();
    return portal(
        <div className={['dc-overlay dc-sheet-back', settled ? 'settled' : ''].join(' ')} onClick={onClose}>
            <div className="dc-sheet" onClick={e => e.stopPropagation()}>
                <div className="dc-sheet-grip" />
                {children}
            </div>
        </div>
    ) as any;
};

export const Confetti: React.FC<{ n?: number }> = ({ n = 26 }) => {
    const colors = ['#e5908a', '#eec46e', '#88aad6', '#8ec4a1', '#ec9cab', '#a9a1c4'];
    return portal(
        <div className="dc-confetti" aria-hidden="true">
            {Array.from({ length: n }, (_, i) => (
                <i key={i} style={{
                    left: `${(i * 37) % 100}%`, background: colors[i % colors.length],
                    animationDelay: `${(i % 9) * 0.11}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s`,
                    borderRadius: i % 3 === 0 ? '50%' : '2px'
                } as any} />
            ))}
        </div>
    ) as any;
};
