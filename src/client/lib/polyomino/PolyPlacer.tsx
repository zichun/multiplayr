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
    pieceFitsAnywhere
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
    orientIndex: number;
    anchorRow: number;
    anchorCol: number;
    dragging: boolean;
    touched: boolean; // has the user positioned it at least once
}

export class PolyPlacer extends React.Component<PolyPlacerProps, PlacerState> {
    private svg: SVGSVGElement | null = null;
    private orientations: Orientation[];
    private filled: number;

    constructor(props: PolyPlacerProps) {
        super(props);
        this.orientations = props.shape.orientations && props.shape.orientations.length
            ? props.shape.orientations
            : freeOrientations(props.shape.cells);
        this.filled = (props.placements || []).reduce((m, p) => m | p.mask, 0);
        const start = this.firstLegalAnchor(0);
        this.state = {
            orientIndex: start.orientIndex,
            anchorRow: start.row,
            anchorCol: start.col,
            dragging: false,
            touched: false
        };
    }

    // ---- geometry helpers -------------------------------------------------

    private currentOrientation(idx = this.state.orientIndex): Orientation {
        return this.orientations[idx % this.orientations.length];
    }

    private clampAnchor(o: Orientation, row: number, col: number) {
        const { width, height } = this.props;
        return {
            row: Math.max(0, Math.min(height - o.height, row)),
            col: Math.max(0, Math.min(width - o.width, col))
        };
    }

    private maskFor(orientIndex: number, row: number, col: number): number | null {
        const o = this.currentOrientation(orientIndex);
        return placeMask(o, row, col, this.props.width, this.props.height);
    }

    /** Find a legal (or at least in-bounds) starting spot for an orientation. */
    private firstLegalAnchor(orientIndex: number) {
        const { width, height, recessed } = this.props;
        const o = this.currentOrientation(orientIndex);
        for (let r = 0; r + o.height <= height; r++) {
            for (let c = 0; c + o.width <= width; c++) {
                const m = placeMask(o, r, c, width, height);
                if (m !== null && isPlacementValid(m, recessed, this.filled)) {
                    return { orientIndex, row: r, col: c };
                }
            }
        }
        return { orientIndex, row: 0, col: 0 };
    }

    private currentMask(): number | null {
        return this.maskFor(this.state.orientIndex, this.state.anchorRow, this.state.anchorCol);
    }

    private isValid(): boolean {
        const m = this.currentMask();
        return m !== null && isPlacementValid(m, this.props.recessed, this.filled);
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

    private rotate = () => {
        const next = (this.state.orientIndex + 1) % this.orientations.length;
        const o = this.currentOrientation(next);
        const { row, col } = this.clampAnchor(o, this.state.anchorRow, this.state.anchorCol);
        this.setState({ orientIndex: next, anchorRow: row, anchorCol: col, touched: true });
    };

    private flip = () => {
        // Reflection maps to a different orientation in the free set; step by
        // half the list so a single control feels like a mirror for most shapes.
        const half = Math.max(1, Math.floor(this.orientations.length / 2));
        const next = (this.state.orientIndex + half) % this.orientations.length;
        const o = this.currentOrientation(next);
        const { row, col } = this.clampAnchor(o, this.state.anchorRow, this.state.anchorCol);
        this.setState({ orientIndex: next, anchorRow: row, anchorCol: col, touched: true });
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
        const multiOrient = this.orientations.length > 1;

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
                    {multiOrient && (
                        <button
                            type="button"
                            className="poly-ctl"
                            onClick={this.rotate}
                            aria-label="Rotate piece"
                        >
                            <span className="poly-ctl-glyph">↻</span>
                            <span className="poly-ctl-label">Rotate</span>
                        </button>
                    )}
                    {multiOrient && (
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
