/**
 * SplendorDuelAssets.ts
 * SplendorDuel-specific card definition builders plus its ability / royal medallion
 * icons. The gem/coin/bonus/silhouette glyphs, the star / crown / scroll / castle
 * glyphs, the soft palettes, and the deck backs are shared with the base Splendor
 * game and live in `../splendor-shared/SplendorArt`.
 */

import { CardDefinition, Palette, IconObject, DataRow } from '../../client/lib/card-renderer/types';
import { Card, RoyalCard, TokenColor } from './SplendorDuelGameState';
import {
    SPLENDOR_PALETTES,
    SPLENDOR_SHARED_ICONS,
    getSplendorPalette,
    getDeckBackDefinition as sharedGetDeckBackDefinition
} from '../splendor-shared/SplendorArt';

// Re-export the shared palette map so existing SplendorDuel imports keep working.
export { SPLENDOR_PALETTES };

// Helper to resolve card visual color based on cost requirements if color is null (points-only)
export function getCardVisualColor(card: Card): TokenColor | 'wild' {
    if (card.color) return card.color;
    const costKeys = Object.keys(card.cost) as TokenColor[];
    if (costKeys.length > 0) {
        // Find the color with the maximum cost value
        let maxColor = costKeys[0];
        let maxVal = card.cost[maxColor] || 0;
        for (const col of costKeys) {
            const val = card.cost[col] || 0;
            if (val > maxVal) {
                maxVal = val;
                maxColor = col;
            }
        }
        return maxColor;
    }
    return 'white';
}

// Helper to get custom palette dynamically (kept as a named export for SplendorDuel views)
export function getSplendorDuelPalette(color: TokenColor | 'wild' | null | undefined): Palette {
    return getSplendorPalette(color);
}

// ==========================================
// SplendorDuel-only iconography: ability silhouettes + royal medallions.
// Merged over the shared gem/star/crown/scroll/castle glyphs.
// ==========================================
const SPLENDOR_DUEL_ONLY_ICONS: Record<string, IconObject> = {
    // --- ABILITY SILHOUETTES (Faint accent circle + solid white flat glyph, matching the gems) ---
    ability_extra_turn_silhouette: {
        id: 'ability_extra_turn_silhouette',
        name: 'Extra Turn Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'arr1_s', type: 'rectangle', x: 38, y: 50, scaleX: 0.25, scaleY: 0.12, fill: '#ffffff' },
            { id: 'arr1_h', type: 'triangle', x: 52, y: 50, scaleX: 0.28, scaleY: 0.28, rotation: 90, fill: '#ffffff' },
            { id: 'arr2_s', type: 'rectangle', x: 58, y: 50, scaleX: 0.25, scaleY: 0.12, fill: '#ffffff' },
            { id: 'arr2_h', type: 'triangle', x: 72, y: 50, scaleX: 0.28, scaleY: 0.28, rotation: 90, fill: '#ffffff' }
        ]
    },
    ability_steal_silhouette: {
        id: 'ability_steal_silhouette',
        name: 'Steal Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'm_base', type: 'rectangle', x: 50, y: 50, scaleX: 0.72, scaleY: 0.32, fill: '#ffffff' },
            { id: 'eye_l', type: 'circle', x: 38, y: 50, scaleX: 0.12, scaleY: 0.12, fill: 'primary' },
            { id: 'eye_r', type: 'circle', x: 62, y: 50, scaleX: 0.12, scaleY: 0.12, fill: 'primary' }
        ]
    },
    ability_take_matching_silhouette: {
        id: 'ability_take_matching_silhouette',
        name: 'Take Matching Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 'a_shaft', type: 'rectangle', x: 50, y: 42, scaleX: 0.15, scaleY: 0.42, fill: '#ffffff' },
            { id: 'a_head', type: 'triangle', x: 50, y: 68, scaleX: 0.38, scaleY: 0.32, rotation: 180, fill: '#ffffff' }
        ]
    },
    ability_take_privilege_silhouette: {
        id: 'ability_take_privilege_silhouette',
        name: 'Scroll Silhouette',
        layers: [
            { id: 'bg', type: 'circle', x: 50, y: 50, scaleX: 1.6, scaleY: 1.6, fill: 'primary', opacity: 0.22 },
            { id: 's_body', type: 'rectangle', x: 50, y: 50, scaleX: 0.48, scaleY: 0.62, fill: '#ffffff' },
            { id: 's_top', type: 'rectangle', x: 50, y: 18, scaleX: 0.58, scaleY: 0.1, fill: '#ffffff' },
            { id: 's_bottom', type: 'rectangle', x: 50, y: 82, scaleX: 0.58, scaleY: 0.1, fill: '#ffffff' },
            { id: 's_ribbon', type: 'rectangle', x: 50, y: 50, scaleX: 0.52, scaleY: 0.1, fill: 'primary' }
        ]
    },

    // Royal medallions: solid gold disc with a dark engraved glyph (regal + clearly visible).
    royal_crown: {
        id: 'royal_crown', name: 'Royal Crown',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 'cr_base', type: 'rectangle', x: 50, y: 64, scaleX: 0.46, scaleY: 0.1, fill: '#4a3608' },
            { id: 'cr_p1', type: 'triangle', x: 32, y: 54, scaleX: 0.16, scaleY: 0.26, fill: '#4a3608' },
            { id: 'cr_p2', type: 'triangle', x: 50, y: 46, scaleX: 0.2, scaleY: 0.44, fill: '#4a3608' },
            { id: 'cr_p3', type: 'triangle', x: 68, y: 54, scaleX: 0.16, scaleY: 0.26, fill: '#4a3608' }
        ]
    },
    royal_extra_turn: {
        id: 'royal_extra_turn', name: 'Royal Extra Turn',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 'arr1_s', type: 'rectangle', x: 37, y: 50, scaleX: 0.24, scaleY: 0.13, fill: '#4a3608' },
            { id: 'arr1_h', type: 'triangle', x: 51, y: 50, scaleX: 0.3, scaleY: 0.3, rotation: 90, fill: '#4a3608' },
            { id: 'arr2_s', type: 'rectangle', x: 57, y: 50, scaleX: 0.24, scaleY: 0.13, fill: '#4a3608' },
            { id: 'arr2_h', type: 'triangle', x: 71, y: 50, scaleX: 0.3, scaleY: 0.3, rotation: 90, fill: '#4a3608' }
        ]
    },
    royal_steal: {
        id: 'royal_steal', name: 'Royal Steal',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 'm_base', type: 'rectangle', x: 50, y: 50, scaleX: 0.74, scaleY: 0.34, fill: '#4a3608' },
            { id: 'eye_l', type: 'circle', x: 38, y: 50, scaleX: 0.13, scaleY: 0.13, fill: '#d9a520' },
            { id: 'eye_r', type: 'circle', x: 62, y: 50, scaleX: 0.13, scaleY: 0.13, fill: '#d9a520' }
        ]
    },
    royal_take_privilege: {
        id: 'royal_take_privilege', name: 'Royal Privilege',
        layers: [
            { id: 'disc', type: 'circle', x: 50, y: 50, scaleX: 1.9, scaleY: 1.9, fill: '#d9a520' },
            { id: 's_body', type: 'rectangle', x: 50, y: 50, scaleX: 0.44, scaleY: 0.58, fill: '#4a3608' },
            { id: 's_top', type: 'rectangle', x: 50, y: 24, scaleX: 0.52, scaleY: 0.1, fill: '#4a3608' },
            { id: 's_bottom', type: 'rectangle', x: 50, y: 76, scaleX: 0.52, scaleY: 0.1, fill: '#4a3608' },
            { id: 's_ribbon', type: 'rectangle', x: 50, y: 50, scaleX: 0.48, scaleY: 0.09, fill: '#d9a520' }
        ]
    }
};

export const SPLENDOR_DUEL_ICONS: Record<string, IconObject> = {
    ...SPLENDOR_SHARED_ICONS,
    ...SPLENDOR_DUEL_ONLY_ICONS
};

// ==========================================
// Dynamic Card Definition Builders
// ==========================================

export function getSplendorDuelCardDefinition(
    card: Card,
    bonuses: Partial<Record<TokenColor, number>>,
    tokens?: Partial<Record<TokenColor, number>>
): CardDefinition {
    const visualColor = getCardVisualColor(card);
    const palette = getSplendorDuelPalette(visualColor);

    // Determine the icon to display in top-right for the permanent bonus
    const headerIcons = [];
    if (card.bonus_color && card.bonus_color !== 'wild') {
        const bonusIconId = `gem_${card.bonus_color}_bonus`;
        headerIcons.push({
            iconId: bonusIconId,
            value: card.bonus_count > 1 ? `x${card.bonus_count}` : undefined,
            scaling: 1.0
        });
    } else if (card.bonus_color === 'wild') {
        headerIcons.push({
            iconId: 'gem_wild_bonus',
            scaling: 1.0
        });
    }

    // Determine what goes in the central main art area
    let mainArtIconId: string = `gem_${visualColor}_silhouette`;
    if (card.ability) {
        // If it has an ability, show that ability icon
        mainArtIconId = `ability_${card.ability}_silhouette`;
    } else if (card.color === null) {
        // Points-only card: show a large star silhouette
        mainArtIconId = 'star_silhouette';
    }

    // Render costs as a vertical list in the data region
    const rows: DataRow[] = Object.keys(card.cost).map(colorKey => {
        const color = colorKey as TokenColor;
        const amt = card.cost[color] || 0;
        const discount = color === 'pearl' ? 0 : (bonuses[color] || 0);
        const effectiveCost = Math.max(0, amt - discount);

        // When we know the player's hand, show "cost ▶ shortfall": how many of this
        // colour they still need after permanent bonuses + spendable tokens of that
        // colour. Gold is deliberately NOT counted. If they have none of it (no bonus,
        // no tokens), just show the raw cost.
        let value = String(amt);
        let opacity = effectiveCost === 0 ? 0.25 : 1;
        if (tokens) {
            const spendable = tokens[color] || 0;
            if (discount > 0 || spendable > 0) {
                const shortfall = Math.max(0, amt - discount - spendable);
                value = `${amt} ▶ ${shortfall}`;
            }
            opacity = 1;
        }

        return {
            iconId: `gem_${color}_coin`,
            label: '',
            value,
            // Leave color undefined so that the cost number text is rendered in the dark palette text color (legible!)
            color: undefined,
            scaling: 1.0,
            opacity
        } as DataRow;
    });

    // Subtitle can hold crowns if any
    const subtitleVal = card.crowns === 1 ? 'c' : card.crowns === 2 ? 'cc' : undefined;

    // Footer text for abilities
    let footerText = '';
    if (card.ability) {
        footerText = card.ability.toUpperCase().replace('_', ' ');
    }

    return {
        id: card.id,
        name: card.color === 'wild' ? 'Joker' : card.bonus_color ? `${card.bonus_color.toUpperCase()} Card` : 'Points Card',
        widthMm: 63.5,
        heightMm: 88.9,
        borderRadiusMm: 4,
        palette: palette,
        borderColor: 'border',
        borderWidth: 0, // Turn off card border per user request
        header: {
            title: card.points > 0 ? String(card.points) : ' ',
            subtitle: subtitleVal,
            icons: headerIcons,
            background: 'primary' // Set to primary color (the header banner color!)
        },
        mainArt: {
            iconId: mainArtIconId,
            scaling: 1.15
        },
        data: {
            rows: rows
        },
        footer: footerText ? {
            text: footerText,
            align: 'center',
            verticalAlign: 'center',
            size: 0.7,
            background: 'panelBg'
        } : undefined
    };
}

// SplendorDuel deck backs use the shared castle deck-back definition.
export function getDeckBackDefinition(level: number): CardDefinition {
    return sharedGetDeckBackDefinition(level);
}

export function getRoyalCardDefinition(royal: RoyalCard): CardDefinition {
    const mainArtIconId = royal.ability ? `royal_${royal.ability}` : 'royal_crown';
    const label = royal.ability === 'extra_turn' ? 'EXTRA TURN'
        : royal.ability === 'steal' ? 'STEAL'
        : royal.ability === 'take_privilege' ? 'PRIVILEGE'
        : 'FAVOR';

    return {
        id: royal.id,
        name: 'Royal Favor',
        widthMm: 45,   // Portrait
        heightMm: 62,
        borderRadiusMm: 4,
        palette: {
            id: 'splendor_royal',
            name: 'Royal Gold',
            background: '#ffffff',
            border: '#d3a92f',
            primary: '#e3b52e', // Rich gold header band (white star reads as negative space)
            secondary: '#d9a520',
            accent: '#d9a520',
            charcoal: '#4a3608',
            text: '#3f2f06',
            panelBg: '#faf1d6',
            tertiary: '#ffd3b6',
            success: '#2ec27e',
            danger: '#e01b24'
        },
        borderColor: 'border',
        borderWidth: 0.09, // thin lavender edge so the card reads on the white pool
        header: {
            title: royal.points > 0 ? String(royal.points) : ' ',
            background: 'primary'
        },
        mainArt: {
            iconId: mainArtIconId,
            scaling: 1.0
        },
        footer: {
            text: label,
            align: 'center',
            verticalAlign: 'center',
            size: 1.3,
            background: 'panelBg'
        }
    };
}
