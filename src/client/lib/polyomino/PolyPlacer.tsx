/**
 * PolyPlacer.tsx — interactive drag-to-place surface for a single polyomino.
 *
 * Touch-first placement, reusable by any grid game:
 *   • Drag the ghost anywhere over the board; it snaps to the grid and follows
 *     your finger. On touch, the ghost is lifted above the fingertip so the
 *     piece you are aiming is never hidden under your own hand.
 *   • Rotate ↻ / Flip ⇋ cycle the free-polyomino orientations in place.
 *   • The ghost tints emerald when the placement is legal (inside the recess,
 *     no overlap) and coral when it is not.
 *   • Because placed pieces lock in the real game, committing is an explicit
 *     step: "Place" is enabled only on a legal position. Nothing mutates game
 *     state until then, so the whole interaction is safely undoable.
 *
 * Works with both Pointer (touch/pen) and mouse input via the Pointer Events
 * API. No dependency on the game — you hand it a board + a shape and get a
 * committed bitmask back through `onCommit`.
 */

import * as React from 'react';
import {
    Cell,
    Orientation,
    freeOrientations,
    placeMask,
    maskToCells,
    isPlacementValid,
    pieceFitsAnywhere,
    normalize,
    rotateCW,
    reflect,
    toOrientation,
    cellsKey
} from './geometry';
import { PolyBoard, BoardPlacement } from './PolyBoard';

export interface PolyPlacerShape {
    cells: Cell[];
    color: string;
    orientations?: Orientation[]; // precomputed; derived if omitted
}

export interface PolyPlacerProps {
    width: number;
    height: number;
    recessed: number;
    unit?: number;
    placements?: BoardPlacement[];
    shape: PolyPlacerShape;
    onCommit: (mask: number) => void;
    onCancel?: () => void;
    /** cells to lift the ghost above the fingertip on touch (default 1.15) */
    fingerOffsetCells?: number;
    confirmLabel?: string;
}

interface PlacerState {
    /** the current orientation, as normalised cells (rotate/flip transform this) */
    cells: Cell[];
    anchorRow: number;
    anchorCol: number;
    dragging: boolean;
    touched: boolean; // has the user positioned it at least once
}

export class PolyPlacer extends React.Component<PolyPlacerProps, PlacerState> {
    private svg: SVGSVGElement | null = null;
    private orientations: Orientation[];
    private filled: number;
    private canRotate: boolean;  // shape has >1 distinct rotation
    private canFlip: boolean;    // shape is chiral (reflection is a new orientation)

    constructor(props: PolyPlacerProps) {
        super(props);
        this.orientations = props.shape.orientations && props.shape.orientations.length
            ? props.shape.orientations
            : freeOrientations(props.shape.cells);
        this.filled = (props.placements || []).reduce((m, p) => m | p.mask, 0);

        // Which controls make sense for this shape?
        const base = normalize(props.shape.cells);
        const rotKeys = new Set<string>();
        let rc: Cell[] = base;
        for (let i = 0; i < 4; i++) { rotKeys.add(cellsKey(rc)); rc = rotateCW(rc); }
        this.canRotate = rotKeys.size > 1;
        // chiral when no rotation of the mirror image matches a rotation of the base
        let chiral = true;
        let m: Cell[] = reflect(base);
        for (let i = 0; i < 4; i++) { if (rotKeys.has(cellsKey(m))) { chiral = false; break; } m = rotateCW(m); }
        this.canFlip = chiral;

        // Auto-fit on selection: land the piece on the first legal spot (any
        // orientation) so the player starts from a valid preview.
        const fit = this.findFit();
        this.state = {
            cells: fit.cells,
            anchorRow: fit.row,
            anchorCol: fit.col,
            dragging: false,
            touched: false
        };
    }

    // ---- geometry helpers -------------------------------------------------

    private currentOrientation(): Orientation {
        return toOrientation(this.state.cells);
    }

    private clampAnchor(o: Orientation, row: number, col: number) {
        const { width, height } = this.props;
        return {
            row: Math.max(0, Math.min(height - o.height, row)),
            col: Math.max(0, Math.min(width - o.width, col))
        };
    }

    /** First legal placement across every orientation (any fit will do). */
    private findFit(): { cells: Cell[]; row: number; col: number } {
        const { width, height, recessed } = this.props;
        for (const o of this.orientations) {
            for (let r = 0; r + o.height <= height; r++) {
                for (let c = 0; c + o.width <= width; c++) {
                    const m = placeMask(o, r, c, width, height);
                    if (m !== null && isPlacementValid(m, recessed, this.filled)) {
                        return { cells: o.cells, row: r, col: c };
                    }
                }
            }
        }
        const base = this.orientations[0];
        return { cells: base.cells, row: 0, col: 0 };
    }

    private currentMask(): number | null {
        const o = this.currentOrientation();
        return placeMask(o, this.state.anchorRow, this.state.anchorCol, this.props.width, this.props.height);
    }

    private fitsAnywhere(): boolean {
        return pieceFitsAnywhere(
            this.orientations, this.props.recessed, this.filled,
            this.props.width, this.props.height
        );
    }

    // ---- pointer handling -------------------------------------------------

    private pointerToCell(e: React.PointerEvent): { row: number; col: number } | null {
        if (!this.svg) return null;
        const rect = this.svg.getBoundingClientRect();
        const unit = (this.props.unit || 46);
        const wPx = this.props.width * unit;
        const hPx = this.props.height * unit;
        const scaleX = wPx / rect.width;
        const scaleY = hPx / rect.height;
        let localX = (e.clientX - rect.left) * scaleX;
        let localY = (e.clientY - rect.top) * scaleY;
        if (e.pointerType === 'touch') {
            localY -= (this.props.fingerOffsetCells ?? 1.15) * unit;
        }
        return { row: localY / unit, col: localX / unit };
    }

    private moveGhostTo(e: React.PointerEvent) {
        const cell = this.pointerToCell(e);
        if (!cell) return;
        const o = this.currentOrientation();
        const rawRow = Math.round(cell.row - o.height / 2);
        const rawCol = Math.round(cell.col - o.width / 2);
        const { row, col } = this.clampAnchor(o, rawRow, rawCol);
        if (row !== this.state.anchorRow || col !== this.state.anchorCol || !this.state.touched) {
            this.setState({ anchorRow: row, anchorCol: col, touched: true });
        }
    }

    private handlePointerDown = (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        this.setState({ dragging: true });
        this.moveGhostTo(e);
    };

    private handlePointerMove = (e: React.PointerEvent) => {
        if (!this.state.dragging) return;
        this.moveGhostTo(e);
    };

    private handlePointerUp = (e: React.PointerEvent) => {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        this.setState({ dragging: false });
    };

    // ---- transforms -------------------------------------------------------

    /** Rotate the current orientation 90° clockwise, in place. */
    private rotate = () => {
        const cells = rotateCW(this.state.cells);
        const o = toOrientation(cells);
        const { row, col } = this.clampAnchor(o, this.state.anchorRow, this.state.anchorCol);
        this.setState({ cells, anchorRow: row, anchorCol: col, touched: true });
    };

    /** Mirror the current orientation (only meaningful for chiral shapes). */
    private flip = () => {
        const cells = reflect(this.state.cells);
        const o = toOrientation(cells);
        const { row, col } = this.clampAnchor(o, this.state.anchorRow, this.state.anchorCol);
        this.setState({ cells, anchorRow: row, anchorCol: col, touched: true });
    };

    private commit = () => {
        const m = this.currentMask();
        if (m !== null && isPlacementValid(m, this.props.recessed, this.filled)) {
            this.props.onCommit(m);
        }
    };

    // ---- render -----------------------------------------------------------

    public render() {
        const { width, height, recessed, unit = 46, placements = [], shape } = this.props;
        const mask = this.currentMask();
        const valid = mask !== null && isPlacementValid(mask, recessed, this.filled);
        const ghostCells: Cell[] = mask !== null ? maskToCells(mask, width, height) : [];
        const canFit = this.fitsAnywhere();

        return (
            <div className="poly-placer">
                <PolyBoard
                    width={width}
                    height={height}
                    recessed={recessed}
                    unit={unit}
                    placements={placements}
                    ghostCells={ghostCells}
                    ghostColor={shape.color}
                    ghostValid={valid}
                    highlightCells={valid ? ghostCells : null}
                    svgRef={(el) => (this.svg = el)}
                    onPointerDown={this.handlePointerDown}
                    onPointerMove={this.handlePointerMove}
                    onPointerUp={this.handlePointerUp}
                    onPointerLeave={this.handlePointerUp}
                />

                <div className="poly-placer-controls">
                    {this.canRotate && (
                        <button
                            type="button"
                            className="poly-ctl"
                            onClick={this.rotate}
                            aria-label="Rotate piece 90 degrees clockwise"
                        >
                            <span className="poly-ctl-glyph">↻</span>
                            <span className="poly-ctl-label">Rotate</span>
                        </button>
                    )}
                    {this.canFlip && (
                        <button
                            type="button"
                            className="poly-ctl"
                            onClick={this.flip}
                            aria-label="Flip piece"
                        >
                            <span className="poly-ctl-glyph">⇋</span>
                            <span className="poly-ctl-label">Flip</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="poly-ctl primary"
                        onClick={this.commit}
                        disabled={!valid}
                    >
                        <span className="poly-ctl-glyph">✓</span>
                        <span className="poly-ctl-label">{this.props.confirmLabel || 'Place'}</span>
                    </button>
                    {this.props.onCancel && (
                        <button
                            type="button"
                            className="poly-ctl ghost"
                            onClick={this.props.onCancel}
                            aria-label="Cancel placement"
                        >
                            <span className="poly-ctl-glyph">✕</span>
                            <span className="poly-ctl-label">Cancel</span>
                        </button>
                    )}
                </div>

                <div className={['poly-placer-hint', valid ? 'ok' : 'no'].join(' ')}>
                    {!canFit
                        ? 'This piece cannot fit here — cancel and try another.'
                        : valid
                            ? 'Ready to place — drag to adjust, then Place.'
                            : 'Drag the piece onto the highlighted wells.'}
                </div>
            </div>
        );
    }
}

export default PolyPlacer;
