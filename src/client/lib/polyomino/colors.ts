/**
 * colors.ts — tiny hex-colour helpers for the polyomino renderers.
 * Pure functions, no dependencies. Kept separate from geometry so the
 * geometry core stays purely combinatorial.
 */

function clamp(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** Mix `hex` toward black by `amount` (0..1). */
export function shade(hex: string, amount: number): string {
    const [r, g, b] = parseHex(hex);
    return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Mix `hex` toward white by `amount` (0..1). */
export function tint(hex: string, amount: number): string {
    const [r, g, b] = parseHex(hex);
    return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** rgba() string from a hex colour and an alpha. */
export function alpha(hex: string, a: number): string {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Perceived luminance (0..1); useful to pick readable ink over a fill. */
export function luminance(hex: string): number {
    const [r, g, b] = parseHex(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A readable ink colour (near-black or near-white) for text on `bg`. */
export function readableInk(bg: string): string {
    return luminance(bg) > 0.6 ? '#1c2431' : '#ffffff';
}
