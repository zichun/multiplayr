/**
 * DecorumSound.ts — a tiny WebAudio synth for Décorum's sound effects.
 *
 * Generated on the fly (no audio files) and deliberately soft: a felt "thunk"
 * as an object is set down, a pluck when one is lifted away, a card-flip swap,
 * a brush sweep for paint, three gentle reaction tones, a little bell for
 * meetings. Same synth core as Hooky / Jibber Jabble. Safe to import in node
 * tests — every call is a no-op without an AudioContext. Mute is per browser.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
    muted = typeof localStorage !== 'undefined' && localStorage.getItem('dc_muted') === '1';
} catch (e) { /* storage blocked */ }

const listeners = new Set<(m: boolean) => void>();

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem('dc_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
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

const C5 = 523, E5 = 659, G5 = 784, A5 = 880, C6 = 1047;

export const sfx = {
    /** Local tap feedback. */
    tap() { tone(1200, 0.03, { type: 'triangle', gain: 0.05 }); },
    /** An object is set down in a slot. */
    place() {
        tone(220, 0.16, { type: 'sine', gain: 0.32, slideTo: 140 });
        noise(0.06, { band: 900, gain: 0.08, q: 1 });
        tone(G5, 0.12, { type: 'triangle', gain: 0.06, delay: 0.05 });
    },
    /** An object is lifted out. */
    remove() { tone(520, 0.14, { type: 'triangle', gain: 0.14, slideTo: 300 }); noise(0.08, { band: 2400, bandTo: 900, gain: 0.05 }); },
    /** An object is swapped for another of its type. */
    swap() {
        noise(0.18, { band: 700, bandTo: 2600, gain: 0.1, q: 0.8 });
        tone(392, 0.1, { type: 'triangle', gain: 0.12 });
        tone(587, 0.14, { type: 'triangle', gain: 0.12, delay: 0.08 });
    },
    /** Two soft knocks and a little step up: someone switches bedrooms. */
    door() {
        tone(170, 0.07, { type: 'sine', gain: 0.26, slideTo: 120 });
        noise(0.04, { band: 600, gain: 0.07, q: 1.2 });
        tone(170, 0.07, { type: 'sine', gain: 0.22, slideTo: 120, delay: 0.13 });
        noise(0.04, { band: 600, gain: 0.06, q: 1.2, delay: 0.13 });
        tone(523, 0.12, { type: 'triangle', gain: 0.09, delay: 0.3 });
        tone(659, 0.16, { type: 'triangle', gain: 0.09, delay: 0.38 });
    },
    /** A soft "mrrp?": the cat wanders into another room. */
    cat() {
        tone(520, 0.09, { type: 'sine', gain: 0.1, slideTo: 760, vibrato: 18, vibratoDepth: 14 });
        tone(760, 0.16, { type: 'sine', gain: 0.09, delay: 0.09, slideTo: 620 });
        noise(0.05, { band: 300, gain: 0.04, delay: 0.32 });
        noise(0.05, { band: 300, gain: 0.04, delay: 0.44 });
    },
    /** A brush sweep: a wall is repainted. */
    paint() {
        noise(0.42, { band: 500, bandTo: 1800, gain: 0.12, q: 0.6 });
        noise(0.3, { band: 1400, bandTo: 600, gain: 0.07, q: 0.6, delay: 0.18 });
    },
    /** No change (a pass). */
    pass() { tone(E5, 0.12, { type: 'sine', gain: 0.1 }); tone(C5, 0.18, { type: 'sine', gain: 0.1, delay: 0.1 }); },
    love() { tone(C5, 0.1, { type: 'triangle', gain: 0.14 }); tone(E5, 0.1, { type: 'triangle', gain: 0.14, delay: 0.07 }); tone(G5, 0.22, { type: 'triangle', gain: 0.14, delay: 0.14 }); },
    meh() { tone(440, 0.16, { type: 'sine', gain: 0.12 }); tone(440, 0.16, { type: 'sine', gain: 0.1, delay: 0.14 }); },
    hate() { tone(330, 0.3, { type: 'triangle', gain: 0.14, slideTo: 220, lowpass: 1400 }); },
    /** It's your turn. */
    turn() {
        tone(A5, 0.16, { type: 'triangle', gain: 0.16 });
        tone(C6, 0.26, { type: 'triangle', gain: 0.16, delay: 0.1 });
    },
    /** A choice snaps into place. */
    select() { tone(C5, 0.07, { type: 'triangle', gain: 0.1 }); tone(G5, 0.12, { type: 'triangle', gain: 0.1, delay: 0.05 }); },
    /** Meeting time: a soft doorbell. */
    bell() {
        tone(E5, 0.6, { type: 'sine', gain: 0.18 });
        tone(C5, 0.9, { type: 'sine', gain: 0.18, delay: 0.32 });
    },
    /** A heart token flips. */
    heart() { noise(0.2, { band: 900, bandTo: 3000, gain: 0.1, q: 0.8 }); tone(330, 0.3, { type: 'sine', gain: 0.1, delay: 0.12, slideTo: 260 }); },
    /** A condition is shared. */
    share() { tone(G5, 0.1, { type: 'sine', gain: 0.12 }); tone(C6, 0.25, { type: 'sine', gain: 0.12, delay: 0.08, vibrato: 6, vibratoDepth: 8 }); },
    /** Nope. */
    buzz() { tone(150, 0.22, { type: 'square', gain: 0.07, lowpass: 900 }); },
    /** Everyone is happy. */
    fanfare() {
        [C5, E5, G5, C6].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.14, delay: i * 0.1 }));
        [C6, 1319, 1568].forEach(f => tone(f, 0.8, { type: 'sine', gain: 0.1, delay: 0.42, vibrato: 5, vibratoDepth: 5 }));
        noise(0.5, { band: 6000, gain: 0.03, delay: 0.42 });
    },
    /** Time's up. */
    sigh() { tone(392, 0.4, { type: 'triangle', gain: 0.12, slideTo: 330 }); tone(330, 0.6, { type: 'triangle', gain: 0.12, delay: 0.35, slideTo: 262 }); }
};

export default sfx;
