/**
 * CKMeals.ts — pure meal maths for Critter Kitchen (no engine state).
 *
 * Shared by the engine (authoritative validation + scoring) and the views
 * (live quality previews while a player builds a plate), so a plate that looks
 * valid in the builder is exactly what the host accepts.
 */

import {
    IngType, ING_TYPES, Item, CriticId, RestId, RumorId, RUMOR_BY_ID, challengeStars, trackStars
} from './CKData';

export type MealKind = 'challenge' | 'critic';

export interface MealCtx {
    critic: CriticId;
    rest: RestId | null;
    /** rumor tokens held (Guy Beari bonus) */
    rumorTokens: number;
}

export interface PlateIng { id: number; spice?: number; }

export interface ChallengePlate {
    /** index into the challenge list offered this scoring */
    slot: number;
    ings: PlateIng[];
    soups: number[];
}

export interface CriticCourse { ings: PlateIng[]; bat?: number; }
export type CriticPlate = Partial<Record<IngType, CriticCourse>>;

export type ItemMap = Record<number, Item>;

export function itemMap(items: Item[]): ItemMap {
    const m: ItemMap = {};
    items.forEach(it => { m[it.id] = it; });
    return m;
}

// ---------------------------------------------------------------------------
// Primitive rules
// ---------------------------------------------------------------------------

/** Can `it` stand in as an ingredient of `type` in this kind of meal? */
export function canServeAs(it: Item, type: IngType, ctx: MealCtx, meal: MealKind): boolean {
    if (it.k === 'ing') {
        if (it.t === type) return true;
        if (ctx.critic === 'badger' && it.t === 'mushroom') return true;
        if (ctx.rest === 'alexg' && it.v === 3) return true;
        if (ctx.rest === 'wolfgang' && meal === 'challenge' && it.t === 'wine') return true;
        return false;
    }
    if (it.k === 'spice' && ctx.rest === 'emeril') {
        return it.t === type || it.t === 'all';
    }
    return false;
}

/** Is `it` usable as an ingredient at all (in any type)? */
export function isServableIngredient(it: Item, ctx: MealCtx): boolean {
    return it.k === 'ing' || (it.k === 'spice' && ctx.rest === 'emeril');
}

/** Can `spice` be paired with ingredient `ing`? */
export function spiceFits(spice: Item, ing: Item, ctx: MealCtx, meal: MealKind): boolean {
    if (ing.k !== 'ing') return false; // a spice served as an ingredient can't be spiced
    if (spice.k === 'spice') {
        if (spice.t === 'all' || ctx.rest === 'julia') return true;
        if (spice.t === ing.t) return true;
        if (ctx.critic === 'badger' && ing.t === 'mushroom') return true;
        return false;
    }
    if (spice.k === 'ing' && spice.t === 'wine' && ctx.critic === 'stbernard') return spice.id !== ing.id;
    if (spice.k === 'rumor' && ctx.critic === 'jerboa' && meal === 'critic') return true;
    return false;
}

/** Can `it` be used as a spice at all? */
export function isSpiceLike(it: Item, ctx: MealCtx, meal: MealKind): boolean {
    if (it.k === 'spice') return true;
    if (it.k === 'ing' && it.t === 'wine' && ctx.critic === 'stbernard') return true;
    if (it.k === 'rumor' && ctx.critic === 'jerboa' && meal === 'critic') return true;
    return false;
}

/** Value "before spice", with critic and restaurateur value rules applied. */
export function baseValue(it: Item, ctx: MealCtx, meal: MealKind): number {
    if (it.k === 'spice') return 5; // Emeril: spice served as a 5-value ingredient
    if (it.k === 'soup') return 1;
    if (it.k === 'bisque') return 3;
    if (it.k !== 'ing') return 0;
    const printed = it.v || 0;
    let v = (ctx.critic === 'kangaroo' && printed === 6) ? 9 : printed;
    if (meal === 'challenge') {
        if (ctx.rest === 'bobcat' && (it.t === 'meat' || it.t === 'fish')) v += 3;
        if (ctx.rest === 'goat' && printed === 2) v += 2;
    }
    if (ctx.critic === 'rabbit' && it.t === 'carrot') v *= 2;
    return v;
}

export function spiceMult(ctx: MealCtx): number {
    return ctx.critic === 'treeshrew' ? 3 : 2;
}

export function soupValue(it: Item): number {
    return it.k === 'bisque' ? 3 : it.k === 'soup' ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Challenge meals
// ---------------------------------------------------------------------------

export interface ChallengeEval {
    ok: boolean;
    error?: string;
    quality: number;
    /** stars incl. critic / restaurateur bonuses */
    stars: number;
    baseStars: number;
    bonus: { reason: string; n: number }[];
    /** requirement indexes covered by real ingredients */
    covered: boolean[];
}

/** Max bipartite cover of requirements by distinct ingredients (tiny brute force). */
function coverReqs(ings: Item[], req: IngType[], ctx: MealCtx): boolean[] {
    let best: boolean[] = req.map(() => false);
    let bestN = 0;
    const used = new Set<number>();
    const cur = req.map(() => false);
    const rec = (ri: number, n: number) => {
        if (ri === req.length) {
            if (n > bestN) { bestN = n; best = cur.slice(); }
            return;
        }
        rec(ri + 1, n);
        for (let i = 0; i < ings.length; i++) {
            if (used.has(i) || !canServeAs(ings[i], req[ri], ctx, 'challenge')) continue;
            used.add(i); cur[ri] = true;
            rec(ri + 1, n + 1);
            used.delete(i); cur[ri] = false;
        }
    };
    rec(0, 0);
    return best;
}

export function evaluateChallenge(plate: ChallengePlate, req: IngType[], items: ItemMap, ctx: MealCtx): ChallengeEval {
    const fail = (error: string): ChallengeEval => ({ ok: false, error, quality: 0, stars: 0, baseStars: 0, bonus: [], covered: req.map(() => false) });
    const ings: Item[] = [];
    const spiceUse: Record<number, Item[]> = {};
    for (const pi of plate.ings) {
        const it = items[pi.id];
        if (!it) return fail('Unknown ingredient');
        if (!isServableIngredient(it, ctx)) return fail('Only ingredients can be plated');
        if (!req.some(t => canServeAs(it, t, ctx, 'challenge'))) return fail('Every ingredient must match a requirement');
        ings.push(it);
        if (pi.spice !== undefined && pi.spice !== null) {
            const sp = items[pi.spice];
            if (!sp || !isSpiceLike(sp, ctx, 'challenge')) return fail('Unknown spice');
            if (!spiceFits(sp, it, ctx, 'challenge')) return fail('That spice does not fit');
            (spiceUse[pi.spice] = spiceUse[pi.spice] || []).push(it);
        }
    }
    for (const sid of Object.keys(spiceUse)) {
        const list = spiceUse[+sid];
        if (list.length > 1) {
            const sameType = list.every(x => x.t === list[0].t);
            if (!(ctx.rest === 'heron' && sameType)) return fail('Each spice pairs with one ingredient');
        }
    }
    const soups: Item[] = [];
    for (const sid of plate.soups) {
        const s = items[sid];
        if (!s || (s.k !== 'soup' && s.k !== 'bisque')) return fail('Unknown soup');
        soups.push(s);
    }
    if (ings.length === 0) return fail('Plate at least one required ingredient');
    const covered = coverReqs(ings, req, ctx);
    const missing = covered.filter(c => !c).length;
    if (missing > soups.length) return fail(`Missing ${missing} requirement${missing > 1 ? 's' : ''} (soup can substitute)`);

    const mult = spiceMult(ctx);
    let quality = 0;
    plate.ings.forEach((pi, i) => {
        const v = baseValue(ings[i], ctx, 'challenge');
        quality += (pi.spice !== undefined && pi.spice !== null) ? v * mult : v;
    });
    soups.forEach(s => { quality += soupValue(s); });
    if (ctx.rest === 'guy') quality += ctx.rumorTokens;
    if (ctx.rest === 'kitjoy') quality += 3;

    const baseStars = challengeStars(quality);
    const bonus: { reason: string; n: number }[] = [];
    if (baseStars > 0) {
        if (ctx.critic === 'capybara') bonus.push({ reason: 'The Capybara', n: 1 });
        if (ctx.rest === 'falcoln' && soups.length === 0 && ings.length === req.length && missing === 0) bonus.push({ reason: 'Falcoln Brown', n: 1 });
        if (ctx.rest === 'graham' && quality >= 25) bonus.push({ reason: 'Graham Elephant', n: 1 });
    }
    const stars = baseStars + bonus.reduce((a, b) => a + b.n, 0);
    return { ok: true, quality, stars, baseStars, bonus, covered };
}

/** Item ids consumed by a plate (ingredients, spices, soups). */
export function plateItemIds(p: { ings: PlateIng[]; soups?: number[]; bat?: number }): number[] {
    const ids: number[] = [];
    p.ings.forEach(pi => { ids.push(pi.id); if (pi.spice !== undefined && pi.spice !== null) ids.push(pi.spice); });
    (p.soups || []).forEach(s => ids.push(s));
    if (p.bat !== undefined && p.bat !== null) ids.push(p.bat);
    return ids;
}

// ---------------------------------------------------------------------------
// Critic meal
// ---------------------------------------------------------------------------

export interface CourseEval {
    type: IngType;
    served: boolean;
    quality: number;
    /** highest base value in the course (0 if empty) */
    top: number;
    /** base values of every ingredient served in the course */
    values: number[];
    spiced: number;
    singleUnspiced: boolean;
    batWine: boolean;
}

export interface CriticEval {
    ok: boolean;
    error?: string;
    courses: CourseEval[];
}

function courseMax(ctx: MealCtx, type: IngType): number {
    if (ctx.critic === 'mouse' && type === 'cheese') return 99;
    if (ctx.critic === 'pig') return 2;
    return 1;
}

export function evaluateCritic(plate: CriticPlate, items: ItemMap, ctx: MealCtx): CriticEval {
    const fail = (error: string): CriticEval => ({ ok: false, error, courses: [] });
    const mult = spiceMult(ctx);
    const used = new Set<number>();
    const courses: CourseEval[] = [];
    let cowCourses = 0;

    for (const type of ING_TYPES) {
        const c = plate[type] || { ings: [] };
        const values: number[] = [];
        let quality = 0;
        let spiced = 0;
        let mainCount = 0;
        let hyenaSum = 0;
        let topFish = 0;
        for (const pi of c.ings) {
            const it = items[pi.id];
            if (!it) return fail('Unknown ingredient');
            if (used.has(pi.id)) return fail('An item can only be served once');
            used.add(pi.id);
            const natural = it.k === 'ing' && it.t === type;
            const asWild = !natural && canServeAs(it, type, ctx, 'critic');
            const hyena = !natural && !asWild && ctx.critic === 'hyena' && type === 'fish' && it.k === 'ing' && it.v === 3;
            if (!natural && !asWild && !hyena) return fail(`That does not belong in the ${type} course`);
            const raccoonFree = ctx.critic === 'raccoon' && natural && it.v === 2;
            if (hyena) hyenaSum += it.v || 0;
            else if (!raccoonFree) mainCount++;
            if (type === 'fish' && it.k === 'ing' && it.t === 'fish') topFish = Math.max(topFish, it.v || 0);
            const bv = baseValue(it, ctx, 'critic');
            values.push(bv);
            if (pi.spice !== undefined && pi.spice !== null) {
                const sp = items[pi.spice];
                if (!sp || !isSpiceLike(sp, ctx, 'critic')) return fail('Unknown spice');
                if (used.has(pi.spice)) return fail('Each spice pairs with one ingredient');
                if (!spiceFits(sp, it, ctx, 'critic')) return fail('That spice does not fit');
                used.add(pi.spice);
                spiced++;
                quality += bv * mult;
            } else {
                quality += bv;
            }
        }
        if (hyenaSum > 0 && hyenaSum > topFish) return fail('Hyena: extra 3s may not exceed your top fish');
        const max = courseMax(ctx, type);
        if (mainCount > max) {
            if (ctx.critic === 'cow' && mainCount <= 4) cowCourses++;
            else return fail(`Too many ingredients in the ${type} course`);
        }
        const top = values.length ? Math.max(...values) : 0;
        let batWine = false;
        if (c.bat !== undefined && c.bat !== null) {
            if (ctx.critic !== 'fruitbat') return fail('Only the Fruit Bat pairs wine');
            const w = items[c.bat];
            if (!w || w.k !== 'ing' || w.t !== 'wine') return fail('Pair a wine ingredient');
            if (used.has(c.bat)) return fail('An item can only be served once');
            if (values.length === 0) return fail('Pair wine with a served course');
            const wv = baseValue(w, ctx, 'critic');
            if (wv !== top) return fail('Paired wine must match the course\'s highest value');
            used.add(c.bat);
            quality += wv;
            values.push(wv);
            batWine = true;
        }
        courses.push({
            type, served: c.ings.length > 0, quality, top, values, spiced,
            singleUnspiced: c.ings.length === 1 && spiced === 0 && !batWine, batWine
        });
    }
    if (cowCourses > 1) return fail('The Cow allows only one big course');
    return { ok: true, courses };
}

// ---------------------------------------------------------------------------
// Final (critic) scoring
// ---------------------------------------------------------------------------

export interface FinalInput {
    pid: string;
    ctx: MealCtx;
    courses: CourseEval[];
    /** total value of soup + bisque still held */
    soup: number;
    /** rumor tokens collected */
    rumorTokens: number;
    /** unserved ingredient + spice tokens */
    leftovers: Item[];
    /** stars from restaurateur card */
    restStars: number;
}

export interface FinalLine { key: string; label: string; n: number; }

export interface FinalResult {
    pid: string;
    lines: FinalLine[];
    quality: number;
    total: number;
}

/** Winners of a "most" contest (>0, friendly ties). */
function mostOf(vals: Record<string, number>): Set<string> {
    const max = Math.max(0, ...Object.keys(vals).map(k => vals[k]));
    const s = new Set<string>();
    if (max <= 0) return s;
    Object.keys(vals).forEach(k => { if (vals[k] === max) s.add(k); });
    return s;
}

function servedValues(cs: CourseEval[]): number[] {
    const out: number[] = [];
    cs.forEach(c => out.push(...c.values));
    return out;
}

function rumorStars(rid: RumorId, inp: FinalInput, all: FinalInput[]): number {
    const served = inp.courses.filter(c => c.served);
    const byType = (t: IngType) => inp.courses.find(c => c.type === t)!;
    const vals = servedValues(inp.courses);
    switch (rid) {
        case 'bigcheese': {
            const ch = byType('cheese');
            return ch.served && ch.top >= served.length ? 3 : 0;
        }
        case 'bigdipper': return inp.soup >= byType('bread').top ? 2 : 0;
        case 'pampered':
            return served.length === 7 && served.every(c => c.top >= 5) ? 2 : 0;
        case 'hibernator': {
            if (!served.length) return 0;
            const right = served[served.length - 1];
            return served.every(c => c.quality <= right.quality) ? 2 : 0;
        }
        case 'mercurial': return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
        case 'nocturnal': {
            if (!served.length) return 0;
            for (let i = 1; i < served.length; i++) if (served[i].top < served[i - 1].top) return 0;
            return 5;
        }
        case 'oddtastes':
            return served.length && served.every(c => c.top % 2 === 1) ? 3 : 0;
        case 'picky': return served.length === 7 && vals.length ? Math.min(...vals) : 0;
        case 'psychedelic': {
            const m = byType('mushroom');
            return m.served && served.every(c => c.quality <= m.quality) ? 2 : 0;
        }
        case 'shortsighted': return Math.max(0, byType('carrot').top - 2);
        case 'simplepalate': {
            const score = (x: FinalInput) => {
                const cnt: Record<number, number> = {};
                servedValues(x.courses).forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
                return Math.max(0, ...Object.keys(cnt).map(k => cnt[+k]));
            };
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = score(x); });
            return mostOf(m).has(inp.pid) ? 3 : 0;
        }
        case 'sommelier': {
            const w = byType('wine').top, f = byType('fish').top, me = byType('meat').top;
            let n = 0;
            if (w > 0 && w === f) n += 2;
            if (w > 0 && w === me) n += 2;
            return n;
        }
        case 'spicelover': {
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = x.courses.reduce((a, c) => a + c.spiced, 0); });
            return mostOf(m).has(inp.pid) ? 2 : 0;
        }
        case 'subtle': {
            const score = (x: FinalInput) => {
                const b = x.courses.find(c => c.type === 'bread')!;
                if (!b.served) return 0;
                return servedValues(x.courses).filter(v => v === b.top).length;
            };
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = score(x); });
            return mostOf(m).has(inp.pid) ? 3 : 0;
        }
        case 'superchatty': return inp.rumorTokens;
        case 'tender': {
            if (served.length < 2) return 0;
            return served[0].top + served[served.length - 1].top === 10 ? 3 : 0;
        }
        case 'togo': {
            const n = (x: FinalInput) => x.leftovers.filter(i => i.k === 'ing' || i.k === 'spice').length;
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = n(x); });
            return Math.floor(n(inp) / 2) + (mostOf(m).has(inp.pid) ? 1 : 0);
        }
        case 'unsophisticated': {
            const n = (x: FinalInput) => x.courses.filter(c => c.singleUnspiced).length;
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = n(x); });
            return n(inp) + (mostOf(m).has(inp.pid) ? 1 : 0);
        }
        case 'variedleftovers': {
            const n = (x: FinalInput) => new Set(x.leftovers.filter(i => i.k === 'ing').map(i => baseValue(i, x.ctx, 'critic'))).size;
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = n(x); });
            return n(inp) + (mostOf(m).has(inp.pid) ? 1 : 0);
        }
        case 'variedservings': {
            const n = (x: FinalInput) => new Set(servedValues(x.courses)).size;
            const m: Record<string, number> = {};
            all.forEach(x => { m[x.pid] = n(x); });
            return n(inp) + (mostOf(m).has(inp.pid) ? 1 : 0);
        }
        case 'winecellar': return inp.leftovers.filter(i => i.k === 'ing' && i.t === 'wine').length;
        default: return 0; // fanatics act on final quality
    }
}

/**
 * Score every player's critic meal (steps 2–7 of the rulebook's final scoring).
 * `rumors` are every rumor card in play (incl. Jamie Owliver's secret one).
 */
export function scoreFinal(all: FinalInput[], rumors: RumorId[], critic: CriticId): FinalResult[] {
    const soupMost = mostOf(all.reduce((m, x) => { m[x.pid] = x.soup; return m; }, {} as Record<string, number>));
    const bestCourse: Record<IngType, Set<string>> = {} as any;
    ING_TYPES.forEach(t => {
        const m: Record<string, number> = {};
        all.forEach(x => { m[x.pid] = x.courses.find(c => c.type === t)!.quality; });
        bestCourse[t] = mostOf(m);
    });
    const fanatics = new Set<IngType>();
    rumors.forEach(r => { const f = RUMOR_BY_ID[r]?.fanatic; if (f) fanatics.add(f); });

    return all.map(inp => {
        const lines: FinalLine[] = [];
        if (soupMost.has(inp.pid)) lines.push({ key: 'soup', label: 'Most soup', n: 1 });
        if (inp.courses.every(c => c.served)) lines.push({ key: 'all7', label: 'All 7 courses', n: 1 });
        let best = 0;
        ING_TYPES.forEach(t => {
            if (bestCourse[t].has(inp.pid)) best += (critic === 'mouse' && t === 'cheese') ? 3 : 1;
        });
        if (best) lines.push({ key: 'best', label: 'Best of each course', n: best });
        rumors.forEach(r => {
            const def = RUMOR_BY_ID[r];
            if (!def || def.fanatic) return;
            const n = rumorStars(r, inp, all);
            if (n) lines.push({ key: `rumor_${r}`, label: def.name, n });
        });
        if (inp.restStars) lines.push({ key: 'rest', label: 'Restaurateur', n: inp.restStars });
        if (critic === 'poodle') {
            const n = inp.courses.reduce((a, c) => a + c.values.filter(v => v >= 6).length, 0);
            if (n) lines.push({ key: 'poodle', label: 'The Poodle', n });
        }
        if (critic === 'fruitbat') {
            const n = inp.courses.filter(c => c.batWine).length;
            if (n) lines.push({ key: 'fruitbat', label: 'The Fruit Bat', n });
        }
        const quality = inp.courses.reduce((a, c) => a + (fanatics.has(c.type) ? c.quality * 2 : c.quality), 0);
        const q = trackStars(quality);
        if (q) lines.push({ key: 'quality', label: `Meal quality ${quality}`, n: q });
        return { pid: inp.pid, lines, quality, total: lines.reduce((a, l) => a + l.n, 0) };
    });
}

// ---------------------------------------------------------------------------
// Auto-builders (suggestions for the builder UI, and headless tests)
// ---------------------------------------------------------------------------

function bestSpiceFor(ing: Item, pool: Item[], ctx: MealCtx, meal: MealKind, taken: Set<number>): Item | null {
    // prefer an exact-type spice, then allspice-like items, so allspice is saved
    const fits = pool.filter(s => !taken.has(s.id) && s.id !== ing.id && isSpiceLike(s, ctx, meal) && spiceFits(s, ing, ctx, meal));
    if (!fits.length) return null;
    const rank = (s: Item) => (s.k === 'spice' && s.t === ing.t) ? 0 : (s.k === 'spice' && s.t !== 'all') ? 1 : (s.k === 'rumor') ? 2 : (s.k === 'spice') ? 3 : 4;
    fits.sort((a, b) => rank(a) - rank(b));
    return fits[0];
}

/** Greedy single-plate suggestion for one challenge. */
export function suggestChallengePlate(slot: number, req: IngType[], pool: Item[], ctx: MealCtx, taken: Set<number>): ChallengePlate {
    const plate: ChallengePlate = { slot, ings: [], soups: [] };
    const localTaken = new Set(taken);
    const ingItems = pool.filter(it => it.k === 'ing');
    for (const t of req) {
        const cands = ingItems
            .filter(it => !localTaken.has(it.id) && canServeAs(it, t, ctx, 'challenge'))
            .sort((a, b) => baseValue(b, ctx, 'challenge') - baseValue(a, ctx, 'challenge'));
        if (cands.length) {
            localTaken.add(cands[0].id);
            plate.ings.push({ id: cands[0].id });
        } else {
            const soup = pool.filter(it => (it.k === 'soup' || it.k === 'bisque') && !localTaken.has(it.id))
                .sort((a, b) => soupValue(b) - soupValue(a))[0];
            if (soup) { localTaken.add(soup.id); plate.soups.push(soup.id); }
        }
    }
    // spice the most valuable ingredients first
    const order = plate.ings.slice().sort((a, b) =>
        baseValue(pool.find(i => i.id === b.id)!, ctx, 'challenge') - baseValue(pool.find(i => i.id === a.id)!, ctx, 'challenge'));
    for (const pi of order) {
        const ing = pool.find(i => i.id === pi.id)!;
        const sp = bestSpiceFor(ing, pool, ctx, 'challenge', localTaken);
        if (sp) { pi.spice = sp.id; localTaken.add(sp.id); }
    }
    return plate;
}

/** Greedy critic-plate suggestion: best ingredient per course, then spices. */
export function suggestCriticPlate(pool: Item[], ctx: MealCtx): CriticPlate {
    const plate: CriticPlate = {};
    const taken = new Set<number>();
    const val = (it: Item) => baseValue(it, ctx, 'critic');
    const ingItems = pool.filter(it => it.k === 'ing').sort((a, b) => val(b) - val(a));
    // natural types first
    for (const t of ING_TYPES) {
        const max = courseMax(ctx, t);
        const nat = ingItems.filter(it => it.t === t && !taken.has(it.id)).slice(0, max);
        nat.forEach(it => taken.add(it.id));
        plate[t] = { ings: nat.map(it => ({ id: it.id })) };
    }
    // fill empty courses with wild-capable ingredients
    for (const t of ING_TYPES) {
        if (plate[t]!.ings.length) continue;
        const wild = ingItems.find(it => !taken.has(it.id) && canServeAs(it, t, ctx, 'critic'));
        if (wild) { taken.add(wild.id); plate[t]!.ings.push({ id: wild.id }); }
    }
    if (ctx.critic === 'raccoon') {
        for (const t of ING_TYPES) {
            ingItems.filter(it => it.t === t && it.v === 2 && !taken.has(it.id))
                .forEach(it => { taken.add(it.id); plate[t]!.ings.push({ id: it.id }); });
        }
    }
    if (ctx.critic === 'cow') {
        let bestT: IngType | null = null; let bestGain = 0;
        for (const t of ING_TYPES) {
            const extra = ingItems.filter(it => it.t === t && !taken.has(it.id)).slice(0, 3);
            const gain = extra.reduce((a, it) => a + val(it), 0);
            if (gain > bestGain) { bestGain = gain; bestT = t; }
        }
        if (bestT) {
            ingItems.filter(it => it.t === bestT && !taken.has(it.id)).slice(0, 4 - plate[bestT]!.ings.length)
                .forEach(it => { taken.add(it.id); plate[bestT!]!.ings.push({ id: it.id }); });
        }
    }
    // spices: walk ingredients by value, give each its best spice
    const all: { t: IngType; pi: PlateIng }[] = [];
    ING_TYPES.forEach(t => plate[t]!.ings.forEach(pi => all.push({ t, pi })));
    all.sort((a, b) => val(pool.find(i => i.id === b.pi.id)!) - val(pool.find(i => i.id === a.pi.id)!));
    for (const e of all) {
        const ing = pool.find(i => i.id === e.pi.id)!;
        const sp = bestSpiceFor(ing, pool.filter(p => !(ctx.critic === 'stbernard' && p.k === 'ing' && p.t === 'wine' && taken.has(p.id))), ctx, 'critic', taken);
        if (sp) { e.pi.spice = sp.id; taken.add(sp.id); }
    }
    if (ctx.critic === 'fruitbat') {
        const ev = evaluateCritic(plate, itemMap(pool), ctx);
        if (ev.ok) {
            for (const c of ev.courses) {
                if (!c.served) continue;
                const w = ingItems.find(it => it.t === 'wine' && !taken.has(it.id) && val(it) === c.top);
                if (w) { taken.add(w.id); plate[c.type]!.bat = w.id; }
            }
        }
    }
    return plate;
}

export function emptyCriticPlate(): CriticPlate {
    const p: CriticPlate = {};
    ING_TYPES.forEach(t => { p[t] = { ings: [] }; });
    return p;
}

export function criticPlateIds(p: CriticPlate): number[] {
    const ids: number[] = [];
    ING_TYPES.forEach(t => { const c = p[t]; if (c) ids.push(...plateItemIds(c)); });
    return ids;
}

export function criticQuality(ev: CriticEval, rumors: RumorId[]): number {
    const fan = new Set<IngType>();
    rumors.forEach(r => { const f = RUMOR_BY_ID[r]?.fanatic; if (f) fan.add(f); });
    return ev.courses.reduce((a, c) => a + (fan.has(c.type) ? c.quality * 2 : c.quality), 0);
}
