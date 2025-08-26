/**
 * Canvas.test.ts - Tests for Canvas class
 */

import { Canvas, DrawingAction, COLOR_PALETTE } from '../../rules/drawing/Canvas';
import assert from 'assert';

describe('Drawing Canvas', () => {
    describe('Canvas class', () => {
        describe('initialization', () => {
            it('should create an empty canvas', () => {
                const canvas = new Canvas();
                assert.strictEqual(canvas.isEmpty(), true);
                assert.strictEqual(canvas.getActionCount(), 0);
                assert.deepStrictEqual(canvas.getActions(), []);
            });

            it('should create canvas with initial actions', () => {
                const actions: DrawingAction[] = [
                    { t: 'p', c: 0, s: 2, pts: [[10, 20], [15, 25]] }
                ];
                const canvas = new Canvas(actions);
                assert.strictEqual(canvas.isEmpty(), false);
                assert.strictEqual(canvas.getActionCount(), 1);
                assert.deepStrictEqual(canvas.getActions(), actions);
            });
        });

        describe('adding actions', () => {
            it('should add pen action correctly', () => {
                const canvas = new Canvas();
                const action: DrawingAction = {
                    t: 'p',
                    c: 1, // red
                    s: 3,
                    pts: [[0, 0], [10, 10], [20, 20]]
                };

                canvas.addAction(action);
                assert.strictEqual(canvas.getActionCount(), 1);
                assert.deepStrictEqual(canvas.getActions()[0], action);
            });

            it('should add eraser action correctly', () => {
                const canvas = new Canvas();
                const action: DrawingAction = {
                    t: 'e',
                    s: 5,
                    pts: [[30, 30], [35, 35]]
                };

                canvas.addAction(action);
                assert.strictEqual(canvas.getActionCount(), 1);
                assert.deepStrictEqual(canvas.getActions()[0], action);
            });

            it('should add multiple actions', () => {
                const canvas = new Canvas();
                const action1: DrawingAction = { t: 'p', c: 0, s: 2, pts: [[0, 0]] };
                const action2: DrawingAction = { t: 'e', s: 10, pts: [[50, 50]] };

                canvas.addAction(action1);
                canvas.addAction(action2);

                assert.strictEqual(canvas.getActionCount(), 2);
                assert.deepStrictEqual(canvas.getActions()[0], action1);
                assert.deepStrictEqual(canvas.getActions()[1], action2);
            });
        });

        describe('clearing canvas', () => {
            it('should clear all actions', () => {
                const actions: DrawingAction[] = [
                    { t: 'p', c: 0, s: 2, pts: [[10, 20]] },
                    { t: 'e', s: 5, pts: [[30, 40]] }
                ];
                const canvas = new Canvas(actions);
                
                assert.strictEqual(canvas.getActionCount(), 2);
                
                canvas.clear();
                
                assert.strictEqual(canvas.isEmpty(), true);
                assert.strictEqual(canvas.getActionCount(), 0);
                assert.deepStrictEqual(canvas.getActions(), []);
            });
        });

        describe('serialization', () => {
            it('should serialize empty canvas', () => {
                const canvas = new Canvas();
                const serialized = canvas.serialize();
                assert.deepStrictEqual(serialized, []);
            });

            it('should serialize canvas with actions', () => {
                const actions: DrawingAction[] = [
                    { t: 'p', c: 2, s: 4, pts: [[10, 20], [15, 25]] },
                    { t: 'e', s: 8, pts: [[50, 60]] }
                ];
                const canvas = new Canvas(actions);
                const serialized = canvas.serialize();
                assert.deepStrictEqual(serialized, actions);
            });

            it('should deserialize correctly', () => {
                const actions: DrawingAction[] = [
                    { t: 'p', c: 1, s: 3, pts: [[0, 0], [100, 100]] }
                ];
                const canvas = Canvas.deserialize(actions);
                
                assert.strictEqual(canvas.getActionCount(), 1);
                assert.deepStrictEqual(canvas.getActions(), actions);
            });

            it('should round-trip serialize/deserialize', () => {
                const originalActions: DrawingAction[] = [
                    { t: 'p', c: 5, s: 2, pts: [[10, 20], [30, 40], [50, 60]] },
                    { t: 'e', s: 12, pts: [[70, 80]] },
                    { t: 'p', c: 15, s: 1, pts: [[90, 100]] }
                ];
                
                const canvas1 = new Canvas(originalActions);
                const serialized = canvas1.serialize();
                const canvas2 = Canvas.deserialize(serialized);
                
                assert.deepStrictEqual(canvas1.getActions(), canvas2.getActions());
                assert.strictEqual(canvas1.getActionCount(), canvas2.getActionCount());
                assert.strictEqual(canvas1.isEmpty(), canvas2.isEmpty());
            });
        });

        describe('minimal serialization format', () => {
            it('should use minimal property names', () => {
                const action: DrawingAction = {
                    t: 'p',  // tool (not 'tool')
                    c: 3,    // color (not 'color')
                    s: 5,    // size (not 'thickness')
                    pts: [[10, 20]] // points (not 'points')
                };
                
                const canvas = new Canvas([action]);
                const serialized = canvas.serialize();
                const jsonString = JSON.stringify(serialized);
                
                // Verify minimal keys are used
                assert(jsonString.includes('"t":"p"'));
                assert(jsonString.includes('"c":3'));
                assert(jsonString.includes('"s":5'));
                assert(jsonString.includes('"pts":'));
                
                // Verify full property names are NOT used
                assert(!jsonString.includes('tool'));
                assert(!jsonString.includes('color'));
                assert(!jsonString.includes('thickness'));
                assert(!jsonString.includes('points'));
            });

            it('should omit color for eraser actions', () => {
                const action: DrawingAction = {
                    t: 'e',
                    s: 10,
                    pts: [[25, 35]]
                };
                
                const canvas = new Canvas([action]);
                const serialized = canvas.serialize();
                const jsonString = JSON.stringify(serialized);
                
                assert(!jsonString.includes('"c":'));
                assert(!jsonString.includes('color'));
            });
        });
    });

    describe('Color palette', () => {
        it('should have 16 colors', () => {
            assert.strictEqual(COLOR_PALETTE.length, 16);
        });

        it('should have valid hex colors', () => {
            const hexPattern = /^#[0-9A-F]{6}$/i;
            for (const color of COLOR_PALETTE) {
                assert(hexPattern.test(color), `Invalid hex color: ${color}`);
            }
        });
    });
});
