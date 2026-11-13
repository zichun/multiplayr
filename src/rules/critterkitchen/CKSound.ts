/**
 * CKSound.ts — a tiny WebAudio synth for Critter Kitchen's sound effects.
 *
 * Everything is generated on the fly (no audio files): token picks, soup
 * sloshes, star sparkles, a dinner bell and a fanfare. Same synth core as
 * Hooky / Jibber Jabble. Safe to import in node tests — every call is a no-op
 * when there's no AudioContext. The mute switch is remembered per browser.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
    muted = typeof localStorage !== 'undefined' && localStorage.getItem('ck_muted') === '1';
} catch (e) { /* storage blocked */ }

const listeners = new Set<(m: boolean) => void>();

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem('ck_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    listeners.forEach(fn => fn(m));
}
export function onMuteChange(fn: (m: boolean) => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

function ac(): AudioContext | null {
    if (muted || typeof window === 'undefined') return null;
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    try {
        if (!ctx) {
            ctx = new AC() as AudioContext;
            master = ctx.createGain();
            master.gain.value = 0.55;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => { /* needs a gesture */ });
    } catch (e) {
        return null;
    }
    return ctx;
}

interface ToneOpts {
    type?: Wave;
    gain?: number;
    delay?: number;
    slideTo?: number;      // glide target frequency
    attack?: number;
    vibrato?: number;      // Hz of pitch wobble
    vibratoDepth?: number; // Hz of pitch swing
    lowpass?: number;
}

function tone(freq: number, dur: number, o: ToneOpts = {}) {
    const c = ac();
    if (!c || !master) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
    const peak = o.gain ?? 0.3;
    const atk = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out: AudioNode = g;
    if (o.lowpass) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.lowpass;
        g.connect(f);
        out = f;
    }
    if (o.vibrato) {
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = o.vibrato;
        lg.gain.value = o.vibratoDepth ?? 12;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
    }
    osc.connect(g);
    out.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, o: { delay?: number; gain?: number; band?: number; bandTo?: number; q?: number } = {}) {
    const c = ac();
    if (!c || !master) return;
    const t0 = c.currentTime + (o.delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = o.q ?? 1.2;
    f.frequency.setValueAtTime(o.band ?? 1200, t0);
    if (o.bandTo) f.frequency.exponentialRampToValueAtTime(o.bandTo, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
}

const C5 = 523, E5 = 659, G5 = 784, C6 = 1047;

export const sfx = {
    tap() { tone(1400, 0.03, { type: 'square', gain: 0.04 }); },
    /** A token is plucked from a stall. */
    pick(i = 0) { tone(620 + i * 70, 0.08, { type: 'triangle', gain: 0.18, slideTo: 900 + i * 70 }); },
    /** Soup ladle slosh. */
    soup() { noise(0.22, { band: 500, bandTo: 260, gain: 0.18, q: 1.4 }); tone(330, 0.16, { type: 'sine', gain: 0.1, slideTo: 220 }); },
    /** Stars earned: rising sparkle. */
    star(n = 1) {
        for (let i = 0; i < Math.min(n, 6); i++) tone(1175 + i * 160, 0.12, { type: 'triangle', gain: 0.14, delay: i * 0.07 });
    },
    /** It's your pick / plan. */
    turn() {
        tone(988, 0.18, { type: 'triangle', gain: 0.2 });
        tone(1319, 0.28, { type: 'triangle', gain: 0.2, delay: 0.11 });
    },
    /** Chefs dash out of the kitchen. */
    run() { noise(0.4, { band: 400, bandTo: 2400, gain: 0.14, q: 0.7 }); },
    /** A card flips. */
    flip() { noise(0.22, { band: 700, bandTo: 3200, gain: 0.18, q: 0.8 }); },
    /** Locked in. */
    lock() { tone(G5, 0.08, { type: 'triangle', gain: 0.18 }); tone(C6, 0.2, { type: 'triangle', gain: 0.18, delay: 0.07 }); },
    /** A plate is set down. */
    plate() { tone(1760, 0.06, { type: 'sine', gain: 0.12 }); tone(2640, 0.12, { type: 'sine', gain: 0.06, delay: 0.02 }); },
    buzz() { tone(150, 0.25, { type: 'square', gain: 0.1, lowpass: 900, vibrato: 30, vibratoDepth: 8 }); },
    /** Dinner bell for meal phases. */
    bell() { [C6, G5, E5].forEach((f, i) => tone(f, 0.35, { type: 'sine', gain: 0.16, delay: i * 0.14 })); },
    fanfare() {
        [C5, E5, G5, C6].forEach((f, i) => tone(f, 0.18, { type: 'square', gain: 0.1, delay: i * 0.09, lowpass: 3200 }));
        [C6, 1319, 1568].forEach(f => tone(f, 0.7, { type: 'triangle', gain: 0.14, delay: 0.38, vibrato: 6, vibratoDepth: 6 }));
        noise(0.5, { band: 6000, gain: 0.05, delay: 0.38 });
    }
};

export default sfx;
