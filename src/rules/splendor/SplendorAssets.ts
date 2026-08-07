/**
 * SplendorAssets.ts
 * Splendor-specific card / noble definition builders and the noble medallion icon.
 * Gem, coin, bonus, silhouette, star and castle glyphs plus the soft palettes and
 * the deck backs are shared with SplendorDuel via `../splendor-shared/SplendorArt`.
 */

import { CardDefinition, Palette, IconObject, DataRow } from '../../client/lib/card-renderer/types';
import { Card, Noble, GemColor, GEM_COLORS } from './SplendorGameState';
import {
    SPLENDOR_PALETTES,
    SPLENDOR_SHARED_ICONS,
    getSplendorPalette,
    getDeckBackDefinition
} from '../splendor-shared/SplendorArt';

export { SPLENDOR_PALETTES, getSplendorPalette, getDeckBackDefinition };

// Fully-gold palette for noble tiles — the whole card is gold (no white body).
const NOBLE_PALETTE: Palette = {
    id: 'splendor_noble',
    name: 'Noble',
    background: '#dcb84f',   // gold card body
    border: '#b8942f',
    primary: '#c9a53c',      // slightly deeper gold header band
    secondary: '#d9a520',
    accent: '#8a6f2e',
    charcoal: '#3f320c',
    text: '#3f320c',
    panelBg: '#e6c65e',
    tertiary: '#efe4bf',
    success: '#2ec27e',
    danger: '#e01b24'
};

// Noble medallion: a gold disc with a clean geometric white bust (head + shoulders)
// knocked out — clearly reads as an aristocrat while staying flat + modern.
const NOBLE_ICONS: Record<string, IconObject> = {
    noble: {
        id: 'noble',
        name: 'Noble',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#8a6f2e' },
            { id: 'shoulders', type: 'arch', x: 50, y: 82, scaleX: 0.86, scaleY: 0.72, fill: '#ffffff' },
            { id: 'neck', type: 'rectangle', x: 50, y: 60, scaleX: 0.2, scaleY: 0.2, fill: '#ffffff' },
            { id: 'head', type: 'circle', x: 50, y: 42, scaleX: 0.56, scaleY: 0.56, fill: '#ffffff' }
        ]
    },
    // Faint watermark variant used as card art behind the requirement list.
    noble_silhouette: {
        id: 'noble_silhouette',
        name: 'Noble Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'shoulders', type: 'arch', x: 50, y: 80, scaleX: 0.78, scaleY: 0.64, fill: '#ffffff' },
            { id: 'neck', type: 'rectangle', x: 50, y: 60, scaleX: 0.18, scaleY: 0.18, fill: '#ffffff' },
            { id: 'head', type: 'circle', x: 50, y: 42, scaleX: 0.5, scaleY: 0.5, fill: '#ffffff' }
        ]
    }
};

export const SPLENDOR_ICONS: Record<string, IconObject> = {
    ...SPLENDOR_SHARED_ICONS,
    ...NOBLE_ICONS
};

/**
 * Build a development-card face.
 * When `bonuses`/`tokens` are supplied the cost rows show "cost ▶ shortfall" —
 * how many of each colour are still needed after permanent bonuses + spendable
 * tokens (gold deliberately excluded), turning affordability into a glance.
 */
export function getSplendorCardDefinition(
    card: Card,
    bonuses?: Partial<Record<GemColor, number>>,
    tokens?: Partial<Record<GemColor, number>>
): CardDefinition {
    const palette = getSplendorPalette(card.bonus);

    const rows: DataRow[] = GEM_COLORS
        .filter(c => (card.cost[c] || 0) > 0)
        .map(color => {
            const amt = card.cost[color] || 0;
            const discount = bonuses ? (bonuses[color] || 0) : 0;
            const effectiveCost = Math.max(0, amt - discount);

            let value = String(amt);
            let opacity = 1;
            if (bonuses || tokens) {
                const spendable = tokens ? (tokens[color] || 0) : 0;
                if (discount > 0 || spendable > 0) {
                    const shortfall = Math.max(0, amt - discount - spendable);
                    value = `${amt} ▶ ${shortfall}`;
                }
                opacity = effectiveCost === 0 && !tokens ? 0.35 : 1;
            }

            return {
                iconId: `gem_${color}_coin`,
                label: '',
                value,
                color: undefined,
                scaling: 1.0,
                opacity
            } as DataRow;
        });

    return {
        id: card.id,
        name: `${card.bonus.toUpperCase()} Card`,
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4,
        palette,
        borderColor: 'border',
        borderWidth: 0,
        header: {
            title: card.pts > 0 ? String(card.pts) : ' ',
            icons: [{ iconId: `gem_${card.bonus}_bonus`, scaling: 1.0 }],
            background: 'primary'
        },
        mainArt: {
            iconId: `gem_${card.bonus}_silhouette`,
            scaling: 1.15
        },
        data: { rows }
    };
}

/**
 * Build a noble tile face — worth 3 prestige, showing the required bonus counts.
 * The requirement gems are shown in their own colours and as a plain count (no
 * deficit arrow), so the tile stays legible even with three requirements.
 */
export function getNobleCardDefinition(noble: Noble): CardDefinition {
    const rows: DataRow[] = GEM_COLORS
        .filter(c => (noble.req[c] || 0) > 0)
        .map(color => ({
            iconId: `gem_${color}_coin`, // colored disc — one per gem colour
            label: '',
            value: String(noble.req[color] || 0),
            color: undefined,
            scaling: 1.0
        } as DataRow));

    return {
        id: noble.id,
        name: 'Noble',
        widthMm: 63.5,
        heightMm: 63.5, // square-ish tile
        borderRadiusMm: 4,
        palette: NOBLE_PALETTE,
        borderColor: 'border',
        borderWidth: 0,
        header: {
            title: String(noble.pts),
            background: 'primary'
        },
        // No central medallion: the header takes the top third, the requirement gems
        // fill the rest (see `.spl-noble` in splendor.scss).
        data: { rows }
    };
}
