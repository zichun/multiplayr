/**
 * DicePool.tsx — renders a pool of dice and orchestrates their roll animation.
 *
 * Two animation modes (see RollAnimation.mode):
 *  - 'in-place': every die tumbles in its own slot, staggered.
 *  - 'overlay' : on a roll, dice tumble on a full-viewport overlay (a portal, independent
 *                of the container), reveal, then fly into their slots.
 *
 * Interaction is left to the caller via the `renderDie` render-prop, which receives the
 * fully-computed `DieProps` (spread onto <Die/>) so games can add clicks / badges / state
 * classes without the library knowing anything about them.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Die, DieProps } from './Die';
import { DieDatum, DiceFaceset, DiceTheme, RollAnimation, DEFAULT_ANIMATION } from './types';

export interface DicePoolProps {
    dice: DieDatum[];
    faceset: DiceFaceset;
    theme?: DiceTheme;
    animation?: RollAnimation;
    rollNonce?: number | string;   // change to (re)roll the whole pool
    className?: string;
    style?: React.CSSProperties;
    /** Render each die yourself (add onClick / badges / state). Spread `dieProps` onto <Die/>. */
    renderDie?: (datum: DieDatum, dieProps: DieProps, index: number) => React.ReactNode;
    emptyContent?: React.ReactNode; // shown when there are no dice
}

const buildDieProps = (
    d: DieDatum, faceset: DiceFaceset, theme: DiceTheme | undefined,
    anim: RollAnimation, rollNonce: number | string | undefined, index: number
): DieProps => ({
    faceId: d.faceId, faceset, theme, animation: anim, rollNonce, delay: index * (anim.stagger ?? 0)
});

export const DicePool: React.FC<DicePoolProps> = (props) => {
    const anim: RollAnimation = { ...DEFAULT_ANIMATION, ...(props.animation || {}) };
    const overlay = anim.enabled && anim.mode === 'overlay';

    if (overlay) return <OverlayPool {...props} anim={anim} />;

    // ---- in-place ----
    return (
        <div className={`dr-pool ${props.className || ''}`} style={props.style}>
            {props.dice.length === 0 && props.emptyContent}
            {props.dice.map((d, i) => {
                const dp = buildDieProps(d, props.faceset, props.theme, anim, props.rollNonce, i);
                const content = props.renderDie ? props.renderDie(d, dp, i) : <Die {...dp} />;
                return <React.Fragment key={d.id}>{content}</React.Fragment>;
            })}
        </div>
    );
};

// ==========================================
// Overlay (viewport) mode
// ==========================================
type Rect = { x: number; y: number; w: number; h: number };

const OverlayPool: React.FC<DicePoolProps & { anim: Required<RollAnimation> | RollAnimation }> = (props) => {
    const anim: RollAnimation = { ...DEFAULT_ANIMATION, ...(props.anim || {}) };
    const slotRefs = React.useRef<Array<HTMLDivElement | null>>([]);
    const [flight, setFlight] = React.useState<{ nonce: number; rects: Rect[]; faces: string[]; phase: 'tumble' | 'fly' } | null>(null);
    const lastNonce = React.useRef<number | string | undefined>(undefined);
    const timers = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

    React.useLayoutEffect(() => {
        if (props.rollNonce === lastNonce.current) return;
        lastNonce.current = props.rollNonce;
        if (props.dice.length === 0) return;
        clearTimers();

        // Measure target slots (they are rendered, just hidden during the flight).
        const rects: Rect[] = props.dice.map((_, i) => {
            const el = slotRefs.current[i];
            const r = el ? el.getBoundingClientRect() : null;
            return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 46, h: 46 };
        });
        const faces = props.dice.map(d => d.faceId);
        const nonce = Date.now();
        setFlight({ nonce, rects, faces, phase: 'tumble' });

        const flyAt = setTimeout(() => setFlight(f => (f && f.nonce === nonce ? { ...f, phase: 'fly' } : f)), anim.duration);
        const done = setTimeout(() => setFlight(f => (f && f.nonce === nonce ? null : f)), (anim.duration || 0) + 460);
        timers.current.push(flyAt, done);
        return clearTimers;
    }, [props.rollNonce]);

    const flying = flight !== null;
    const size = props.theme?.size ?? 46;

    const inflow = (
        <div className={`dr-pool ${flying ? 'dr-pool-hidden' : ''} ${props.className || ''}`} style={props.style}>
            {props.dice.length === 0 && props.emptyContent}
            {props.dice.map((d, i) => {
                const dp = buildDieProps(d, props.faceset, props.theme, { ...anim, enabled: false }, props.rollNonce, i);
                const content = props.renderDie ? props.renderDie(d, dp, i) : <Die {...dp} />;
                return <div className="dr-slot" key={d.id} ref={el => { slotRefs.current[i] = el; }}>{content}</div>;
            })}
        </div>
    );

    const overlayLayer = flying && typeof document !== 'undefined' ? createPortal(
        <div className="dr-overlay">
            {flight!.rects.map((r, i) => {
                // Tumble in a centred cluster, then fly to the measured slot.
                const clusterW = Math.min(flight!.rects.length, 8) * (size * 1.3);
                const cx = window.innerWidth / 2 - clusterW / 2 + (i % 8) * (size * 1.3);
                const cy = window.innerHeight * 0.4;
                const target = flight!.phase === 'fly';
                const px = target ? r.x : cx;
                const py = target ? r.y : cy;
                const scale = target ? 1 : Math.min(2.2, 130 / size);
                return (
                    <div key={i} className={`dr-fly ${target ? 'is-landing-fly' : ''}`}
                        style={{
                            left: 0, top: 0,
                            transform: `translate(${px}px, ${py}px) scale(${scale})`,
                            transitionDuration: `${target ? 420 : 0}ms`,
                            transitionDelay: `${target ? i * (anim.stagger ?? 0) : 0}ms`
                        }}>
                        <Die faceId={flight!.faces[i]} faceset={props.faceset} theme={props.theme}
                            animation={{ ...anim, enabled: flight!.phase === 'tumble', stagger: 0 }}
                            rollNonce={`${flight!.nonce}-${i}`} />
                    </div>
                );
            })}
        </div>,
        document.body
    ) : null;

    return <>{inflow}{overlayLayer}</>;
};

export default DicePool;
