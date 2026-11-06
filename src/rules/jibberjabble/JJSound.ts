/**
 * JJSound.ts — a tiny WebAudio synth for Jibber Jabble's sound effects.
 *
 * Everything is generated on the fly (no audio files): bubbly "bloops" pitched
 * per letter, a STOP slam, chirpy "Jibber!", a wobbly "Jabble?", a fanfare and
 * a sad trombone. Safe to import in node tests — every call is a no-op when
 * there's no AudioContext. The mute switch is remembered per browser.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
    muted = typeof localStorage !== 'undefined' && localStorage.getItem('jj_muted') === '1';
} catch (e) { /* storage blocked */ }

const listeners = new Set<(m: boolean) => void>();

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem('jj_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
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

// A major-pentatonic ladder so any run of letters sounds like a tune.
const PENTA = [0, 2, 4, 7, 9];
function letterFreq(ch: string): number {
    const i = Math.max(0, (ch || 'A').toUpperCase().charCodeAt(0) - 65) % 10;
    const step = PENTA[i % 5] + 12 * Math.floor(i / 5);
    return 330 * Math.pow(2, step / 12);
}

export const sfx = {
    /** A letter block lands: a bubbly bloop pitched by the letter, plus a soft thunk. */
    plonk(ch: string) {
        const f = letterFreq(ch);
        tone(f * 1.6, 0.16, { type: 'sine', gain: 0.32, slideTo: f });
        tone(f / 2, 0.09, { type: 'triangle', gain: 0.18, delay: 0.05 });
        noise(0.05, { band: 300, gain: 0.12, delay: 0.05 });
    },
    /** Local key press feedback (very quiet tick). */
    tap() { tone(1400, 0.03, { type: 'square', gain: 0.04 }); },
    /** STOP! — a rubber-stamp slam with a boing tail. */
    stop() {
        noise(0.12, { band: 180, gain: 0.5, q: 0.7 });
        tone(140, 0.22, { type: 'sine', gain: 0.5, slideTo: 50 });
        tone(260, 0.5, { type: 'sine', gain: 0.18, slideTo: 520, delay: 0.08, vibrato: 18, vibratoDepth: 40 });
    },
    /** It's your turn. */
    turn() {
        tone(988, 0.18, { type: 'triangle', gain: 0.2 });
        tone(1319, 0.28, { type: 'triangle', gain: 0.2, delay: 0.11 });
    },
    /** "Jibber!" — three quick rising chirps. */
    jibber() {
        [660, 880, 1175].forEach((f, i) => tone(f, 0.09, { type: 'square', gain: 0.09, slideTo: f * 1.25, delay: i * 0.07, lowpass: 2800 }));
    },
    /** "Jabble?" — a wobbly descending warble that lifts at the end, like a question. */
    jabble() {
        tone(520, 0.32, { type: 'triangle', gain: 0.22, slideTo: 260, vibrato: 14, vibratoDepth: 30 });
        tone(300, 0.22, { type: 'triangle', gain: 0.2, slideTo: 620, delay: 0.3 });
    },
    /** A face pops over someone's avatar — each with its own little voice. */
    emote(id: string) {
        switch (id) {
            case 'laugh': [0, 1, 2].forEach(i => tone(700 - i * 60, 0.08, { type: 'square', gain: 0.08, delay: i * 0.1, lowpass: 2200, slideTo: 560 - i * 60 })); break;
            case 'love': tone(660, 0.25, { type: 'sine', gain: 0.2, slideTo: 990 }); tone(990, 0.35, { type: 'sine', gain: 0.15, delay: 0.18, vibrato: 7, vibratoDepth: 10 }); break;
            case 'wow': tone(300, 0.45, { type: 'triangle', gain: 0.22, slideTo: 900 }); break;
            case 'hmm': tone(220, 0.5, { type: 'triangle', gain: 0.2, vibrato: 5, vibratoDepth: 6, lowpass: 1200 }); break;
            case 'nooo': tone(520, 0.6, { type: 'sawtooth', gain: 0.1, slideTo: 180, lowpass: 1000, vibrato: 8, vibratoDepth: 14 }); break;
            case 'party': [784, 988, 1319].forEach((f, i) => tone(f, 0.1, { type: 'square', gain: 0.07, delay: i * 0.06, lowpass: 3000 })); noise(0.15, { band: 5000, gain: 0.06, delay: 0.18 }); break;
        }
    },
    /** Card flip / whoosh. */
    flip() { noise(0.28, { band: 600, bandTo: 3200, gain: 0.22, q: 0.8 }); },
    /** A choice snaps into place. */
    select() {
        tone(523, 0.08, { type: 'square', gain: 0.08, lowpass: 2400 });
        tone(784, 0.16, { type: 'square', gain: 0.08, delay: 0.06, lowpass: 2400 });
    },
    /** One scramble tick while a word unjumbles. */
    tick(i = 0) { tone(1800 + (i % 5) * 120, 0.025, { type: 'square', gain: 0.035 }); },
    /** Drumroll while the Guesser ponders. */
    drumroll() {
        for (let i = 0; i < 14; i++) noise(0.06, { band: 220 + (i % 2) * 40, gain: 0.08 + i * 0.012, delay: i * 0.055, q: 0.9 });
    },
    /** Wrong guess, but tries remain. */
    buzz() { tone(150, 0.3, { type: 'square', gain: 0.12, lowpass: 900, vibrato: 30, vibratoDepth: 8 }); },
    /** Correct! */
    fanfare() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => tone(f, 0.18, { type: 'square', gain: 0.1, delay: i * 0.09, lowpass: 3200 }));
        [1047, 1319, 1568].forEach(f => tone(f, 0.7, { type: 'triangle', gain: 0.14, delay: 0.38, vibrato: 6, vibratoDepth: 6 }));
        noise(0.5, { band: 6000, gain: 0.05, delay: 0.38 });
    },
    /** Missed — the sad trombone. */
    wahwah() {
        const steps = [392, 370, 349, 330];
        steps.forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.3, {
            type: 'sawtooth', gain: 0.13, delay: i * 0.32, lowpass: 900,
            slideTo: i === 3 ? 300 : f * 0.97, vibrato: i === 3 ? 6 : 0, vibratoDepth: 8
        }));
    },
    /** A hint card is played. */
    sparkle() {
        for (let i = 0; i < 6; i++) tone(1500 + i * 220, 0.12, { type: 'sine', gain: 0.08, delay: i * 0.045 });
    },
    /** Erasing letters. */
    erase() { noise(0.18, { band: 2400, bandTo: 600, gain: 0.18 }); },
    /** End of the game. */
    finale(good: boolean) {
        if (good) {
            sfx.fanfare();
            [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.12, delay: 0.95 + i * 0.08 }));
        } else {
            sfx.jabble();
        }
    }
};

export default sfx;
