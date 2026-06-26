/**
 * test_cards.ts
 * Automated unit tests for the geometric minimalist playing card library.
 */

import * as assert from 'assert';
import { PALETTES, PRESET_ICONS, PRESET_CARDS } from '../client/lib/card-renderer/presets';
import { resolveColor } from '../client/lib/card-renderer/IconEngine';

describe('Geometric Playing Card Library Tests', () => {
    
    describe('Palette Presets', () => {
        it('should have all required colors for midCentury', () => {
            const pal = PALETTES.midCentury;
            assert.ok(pal);
            assert.strictEqual(pal.background, '#f5f2eb');
            assert.strictEqual(pal.primary, '#d95a2b');
            assert.strictEqual(pal.secondary, '#cbb26a');
            assert.strictEqual(pal.accent, '#009bb4');
            assert.strictEqual(pal.charcoal, '#1e2022');
        });

        it('should have all required colors for softPastel', () => {
            const pal = PALETTES.softPastel;
            assert.ok(pal);
            assert.strictEqual(pal.background, '#ffffff');
            assert.strictEqual(pal.primary, '#ffd3b6');
            assert.strictEqual(pal.panelBg, '#b2f5d9');
        });
    });

    describe('Vector Icon Presets', () => {
        it('should contain the waterDrop preset with geometric layers', () => {
            const icon = PRESET_ICONS.waterDrop;
            assert.ok(icon);
            assert.strictEqual(icon.layers.length, 6);
            assert.strictEqual(icon.layers[0].type, 'circle');
            assert.strictEqual(icon.layers[5].type, 'triangle');
        });

        it('should contain the beneGesseritSister preset with complex composition', () => {
            const icon = PRESET_ICONS.beneGesseritSister;
            assert.ok(icon);
            assert.ok(icon.layers.some(l => l.type === 'arch'));
            assert.ok(icon.layers.some(l => l.type === 'circle'));
        });
    });

    describe('Card Definition Presets', () => {
        it('should define the Bene Gesserit card with exact dimensions and components', () => {
            const card = PRESET_CARDS.find(c => c.id === 'beneGesserit');
            assert.ok(card);
            assert.strictEqual(card!.widthMm, 63.5);
            assert.strictEqual(card!.heightMm, 88.9);
            assert.strictEqual(card!.header!.title, 'BENE GESSERIT');
            assert.ok(card!.footer!.text.includes('Fear is the mind-killer'));
        });

        it('should define the Splendor Gem card with smaller size', () => {
            const card = PRESET_CARDS.find(c => c.id === 'splendorEmerald');
            assert.ok(card);
            assert.strictEqual(card!.widthMm, 44.0);
            assert.strictEqual(card!.heightMm, 68.0);
        });

        it('should support configurable border thickness and visibility on cards and overlays', () => {
            // Define a card with custom card borders and custom overlay borders
            const testCard = {
                id: 'testConfigurableBorders',
                name: 'Test Border Card',
                widthMm: 63.5,
                heightMm: 88.9,
                borderRadiusMm: 3.5,
                palette: 'midCentury',
                borderWidth: 0.45,
                borderColor: 'primary',
                backIconId: 'waterDrop',
                backBgColor: 'charcoal',
                overlay: {
                    position: 'top-left',
                    iconId: 'costLeaf',
                    value: '3',
                    showBorder: false,
                    borderWidth: 0.15,
                    borderColor: 'secondary',
                    backgroundColor: 'accent'
                }
            };

            assert.strictEqual(testCard.borderWidth, 0.45);
            assert.strictEqual(testCard.borderColor, 'primary');
            assert.strictEqual(testCard.backIconId, 'waterDrop');
            assert.strictEqual(testCard.backBgColor, 'charcoal');
            assert.strictEqual(testCard.overlay.showBorder, false);
            assert.strictEqual(testCard.overlay.borderWidth, 0.15);
            assert.strictEqual(testCard.overlay.borderColor, 'secondary');
            assert.strictEqual(testCard.overlay.backgroundColor, 'accent');
        });
    });

    describe('Color Resolution Helper', () => {
        const testPalette = PALETTES.midCentury;

        it('should resolve palette color keys correctly', () => {
            const col = resolveColor('primary', testPalette);
            assert.strictEqual(col, '#d95a2b');
        });

        it('should resolve literal hex colors directly', () => {
            const col = resolveColor('#ff0000', testPalette);
            assert.strictEqual(col, '#ff0000');
        });

        it('should respect color overrides if provided', () => {
            const col = resolveColor('primary', testPalette, '#000000');
            assert.strictEqual(col, '#000000');
        });
    });
});
