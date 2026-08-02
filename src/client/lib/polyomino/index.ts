/**
 * polyomino — a reusable, framework-light library for representing polyomino
 * puzzles and manipulating pieces on a grid (touch-first).
 *
 * Split into a pure geometry core (usable by game logic and tests) and a small
 * set of flat, themeable React renderers built on top of it:
 *   - geometry.ts   pure bitmask/orientation/tiling math
 *   - colors.ts     hex helpers for the renderers
 *   - PolyShape     a single polyomino glyph (supply pieces, reward chips)
 *   - PolyBoard     a puzzle board (wells + committed pieces + ghost)
 *   - PolyPlacer    interactive drag-to-place surface
 */

export * from './geometry';
export * from './colors';
export { PolyShape } from './PolyShape';
export type { PolyShapeProps } from './PolyShape';
export { renderTiles } from './PolyShape';
export { PolyBoard } from './PolyBoard';
export type { PolyBoardProps, BoardPlacement } from './PolyBoard';
export { PolyPlacer } from './PolyPlacer';
export type { PolyPlacerProps, PolyPlacerShape } from './PolyPlacer';
