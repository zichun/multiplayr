/**
 * geometry.ts — Pure, framework-independent polyomino geometry.
 *
 * This is the reusable core of the polyomino library. It has NO dependency on
 * React, the DOM, or the Multiplayr engine, so it can be shared by:
 *   - game-state logic (validity / completion checks on the host)
 *   - the UI components (rendering + interactive placement)
 *   - unit tests
 *
 * A board is an arbitrary `width * height` grid. Cells are addressed either as
 * `[row, col]` pairs or as a single bitmask where `bit = row * width + col`.
 * Bitmask ops rely on JS 32-bit bitwise arithmetic, so a board is limited to at
 * most 31 cells (a 5x5 Project L board uses 25 — comfortably inside the limit).
 */

export type Cell = [number, number]; // [row, col]

/** A polyomino orientation, normalised so its min row and min col are both 0. */
export interface Orientation {
    cells: Cell[];
    width: number;   // bounding-box width  (max col + 1)
    height: number;  // bounding-box height (max row + 1)
}

/** Normalise a set of cells to the origin (min row/col -> 0) and sort them. */
export function normalize(cells: Cell[]): Cell[] {
    let minR = Infinity;
    let minC = Infinity;
    for (const [r, c] of cells) {
        if (r < minR) minR = r;
        if (c < minC) minC = c;
    }
    return cells
        .map(([r, c]) => [r - minR, c - minC] as Cell)
        .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

/** A stable string key for a normalised cell set (for de-duping orientations). */
export function cellsKey(cells: Cell[]): string {
    return normalize(cells).map(([r, c]) => `${r},${c}`).join(' ');
}

function rotateCW(cells: Cell[]): Cell[] {
    // (r, c) -> (c, -r); normalisation fixes the negative offset.
    return normalize(cells.map(([r, c]) => [c, -r] as Cell));
}

function reflect(cells: Cell[]): Cell[] {
    // horizontal mirror: (r, c) -> (r, -c)
    return normalize(cells.map(([r, c]) => [r, -c] as Cell));
}

function toOrientation(cells: Cell[]): Orientation {
    const norm = normalize(cells);
    let maxR = 0;
    let maxC = 0;
    for (const [r, c] of norm) {
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
    }
    return { cells: norm, width: maxC + 1, height: maxR + 1 };
}

/**
 * All unique orientations of a free polyomino (rotations + reflections).
 * Returns 1–8 orientations depending on the shape's symmetry.
 */
export function freeOrientations(cells: Cell[]): Orientation[] {
    const seen = new Set<string>();
    const out: Orientation[] = [];
    let base = normalize(cells);
    for (let flip = 0; flip < 2; flip++) {
        let cur = flip === 0 ? base : reflect(base);
        for (let rot = 0; rot < 4; rot++) {
            const key = cellsKey(cur);
            if (!seen.has(key)) {
                seen.add(key);
                out.push(toOrientation(cur));
            }
            cur = rotateCW(cur);
        }
    }
    return out;
}

// ----------------------------------------------------------------------------
// Bitmask helpers (board of a given width)
// ----------------------------------------------------------------------------

export function bitIndex(row: number, col: number, width: number): number {
    return row * width + col;
}

export function cellsToMask(cells: Cell[], width: number): number {
    let mask = 0;
    for (const [r, c] of cells) mask |= (1 << (r * width + c));
    return mask;
}

export function maskToCells(mask: number, width: number, height: number): Cell[] {
    const cells: Cell[] = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            if (mask & (1 << (r * width + c))) cells.push([r, c]);
        }
    }
    return cells;
}

export function popcount(mask: number): number {
    let n = 0;
    let m = mask >>> 0;
    while (m) {
        m &= (m - 1);
        n++;
    }
    return n;
}

/**
 * Place `orientation` with its top-left bounding box at (anchorRow, anchorCol)
 * on a `width * height` board. Returns the placed bitmask, or `null` if it
 * would fall outside the board bounds.
 */
export function placeMask(
    orientation: Orientation,
    anchorRow: number,
    anchorCol: number,
    width: number,
    height: number
): number | null {
    let mask = 0;
    for (const [r, c] of orientation.cells) {
        const rr = anchorRow + r;
        const cc = anchorCol + c;
        if (rr < 0 || cc < 0 || rr >= height || cc >= width) return null;
        mask |= (1 << (rr * width + cc));
    }
    return mask;
}

/** A placement is valid when it stays inside the recess and overlaps nothing. */
export function isPlacementValid(mask: number, recessed: number, filled: number): boolean {
    if (mask === 0) return false;
    const insideRecess = (mask & ~recessed) === 0;
    const noOverlap = (mask & filled) === 0;
    return insideRecess && noOverlap;
}

/** Bounding box (in cells) of a mask on a board of the given width. */
export function maskBounds(mask: number, width: number, height: number) {
    let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            if (mask & (1 << (r * width + c))) {
                if (r < minR) minR = r;
                if (c < minC) minC = c;
                if (r > maxR) maxR = r;
                if (c > maxC) maxC = c;
            }
        }
    }
    if (maxR < 0) return null;
    return { minR, minC, maxR, maxC };
}

/**
 * Does any placement of `orientations` fit somewhere inside `region`
 * (a recess minus already-filled cells)? Cheap "can this piece still go
 * anywhere?" test used by hints / UI affordances.
 */
export function pieceFitsAnywhere(
    orientations: Orientation[],
    recessed: number,
    filled: number,
    width: number,
    height: number
): boolean {
    const region = recessed & ~filled;
    for (const o of orientations) {
        for (let r = 0; r + o.height <= height; r++) {
            for (let c = 0; c + o.width <= width; c++) {
                const m = placeMask(o, r, c, width, height);
                if (m !== null && (m & ~region) === 0) return true;
            }
        }
    }
    return false;
}

/**
 * Backtracking tiling solver: can `region` be exactly covered using the given
 * shapes (each an orientation list), with unlimited copies? Returns one
 * solution as a list of placed masks, or `null` if untileable. Powers puzzle
 * validation and an optional auto-solve / hint feature.
 */
export function solveTiling(
    region: number,
    shapes: Orientation[][],
    width: number,
    height: number
): number[] | null {
    // Precompute every placement mask for every shape orientation.
    const placements: number[] = [];
    for (const orients of shapes) {
        for (const o of orients) {
            for (let r = 0; r + o.height <= height; r++) {
                for (let c = 0; c + o.width <= width; c++) {
                    const m = placeMask(o, r, c, width, height);
                    if (m !== null && (m & ~region) === 0) placements.push(m);
                }
            }
        }
    }
    // Index placements by the cells they cover for fast lookup.
    const solution: number[] = [];
    const solve = (remaining: number): boolean => {
        if (remaining === 0) return true;
        // Target the lowest remaining bit; every tiling must cover it.
        const target = remaining & (-remaining);
        for (const m of placements) {
            if ((m & target) && (m & ~remaining) === 0) {
                solution.push(m);
                if (solve(remaining & ~m)) return true;
                solution.pop();
            }
        }
        return false;
    };
    return solve(region) ? solution.slice() : null;
}
