# polyomino

A small, reusable library for **polyomino puzzles on a grid** — the shapes, the
board, and a touch-first way to place pieces. Built for Project L but written to
be game-agnostic (any "fit shapes into a recessed area" game can use it).

## Layers

| File | Responsibility | Deps |
|---|---|---|
| `geometry.ts` | Pure bitmask/orientation/tiling math. Free-polyomino orientations, placement masks, validity, a backtracking tiling solver. | none |
| `colors.ts` | Hex → shade/tint/alpha helpers for the renderers. | none |
| `PolyShape.tsx` | One polyomino drawn as a flat, geometric glyph (supply pieces, reward chips, legends). | React |
| `PolyBoard.tsx` | A puzzle board: recessed **wells**, committed **pieces**, and a live **ghost** preview. Presentational; forwards pointer events. | React |
| `PolyPlacer.tsx` | Interactive **drag-to-place** surface built on `PolyBoard`. | React |

The geometry core has no React/DOM dependency, so game logic and unit tests can
share the exact same placement/validity code the UI uses.

## Board & bitmask model

A board is `width × height`. Cells are `[row, col]` or a single **bitmask** with
`bit = row * width + col`. Bitmask ops use JS 32-bit arithmetic → **max 31
cells** (a 5×5 board uses 25). Placement, collision and completion are then
single integer ops:

```ts
insideRecess = (mask & ~recessed) === 0;   // never spill outside the hole
noOverlap    = (mask & filled)    === 0;    // never overlap a placed piece
```

Pieces are **free polyominoes** — `freeOrientations(cells)` returns the 1–8
unique orientations under rotation + reflection.

## Placement UX (`PolyPlacer`)

- **Drag** the ghost anywhere over the board; it snaps to the grid and follows
  the pointer. On **touch** the ghost is lifted above the fingertip so the piece
  is never hidden under the hand.
- **Rotate ↻ / Flip ⇋** cycle orientations in place (clamped into bounds).
- The ghost tints **emerald when legal**, **coral when not**.
- Committing is an **explicit** step (`Place`), enabled only on a legal spot —
  matching games where placed pieces lock. Nothing mutates until commit, so the
  interaction is fully undoable.

```tsx
<PolyPlacer
  width={5} height={5}
  recessed={puzzle.recessed}
  placements={committedPieces}      // [{ mask, color }]
  shape={{ cells: shape.cells, color: shape.color }}
  onCommit={(mask) => placePiece(mask)}
  onCancel={() => exitPlacement()}
/>
```

## Theming

Import `polyomino.scss` once. It is a **flat minimalist skin** (soft surfaces,
hairline borders, gentle radii, no hard shadows). Well colours are CSS variables
on `.poly-board` (`--poly-well`, `--poly-well-edge`, `--poly-well-dot`) so a host
game can retint the board without touching markup. Piece and ghost colours are
passed as props.
