/**
 * rng.ts — a tiny seeded PRNG (mulberry32). The state is a plain number so it
 * can live inside serialised game data and replay exactly.
 */

export interface Rng { state: number; }

export const makeRng = (seed: number): Rng => ({ state: seed | 0 });

export function next(r: Rng): number {
    let t = (r.state = (r.state + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const int = (r: Rng, n: number): number => Math.floor(next(r) * n);
export const between = (r: Rng, lo: number, hi: number): number => lo + int(r, hi - lo + 1);
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[int(r, arr.length)];
export const chance = (r: Rng, p: number): boolean => next(r) < p;

export function shuffle<T>(r: Rng, arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = int(r, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Weighted pick: `weights[i]` ≥ 0. */
export function weighted<T>(r: Rng, items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((s, w) => s + w, 0);
    let x = next(r) * total;
    for (let i = 0; i < items.length; i++) {
        x -= weights[i];
        if (x < 0) return items[i];
    }
    return items[items.length - 1];
}
