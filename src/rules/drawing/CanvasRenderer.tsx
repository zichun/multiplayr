/**
 * CanvasRenderer.tsx - Read-only canvas display component
 */

import * as React from 'react';
import { Canvas, COLOR_PALETTE, DrawingAction } from './Canvas';

interface CanvasRendererProps {
    canvas: Canvas;
    width?: number;
    height?: number;
    className?: string;
}

export class CanvasRenderer extends React.Component<CanvasRendererProps, {}> {
    private canvasRef = React.createRef<HTMLCanvasElement>();

    public componentDidMount() {
        this.renderCanvas();
    }

    public componentDidUpdate() {
        this.renderCanvas();
    }

    private renderCanvas() {
        const canvas = this.canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render all actions
        const actions = this.props.canvas.actions;
        for (const action of actions) {
            this.renderAction(ctx, action);
        }
    }

    private renderAction(ctx: CanvasRenderingContext2D, action: DrawingAction) {
        if (action.pts.length === 0) return;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = action.s;

        if (action.t === 'p') {
            // Pen tool
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = COLOR_PALETTE[action.c || 0];
        } else if (action.t === 'e') {
            // Eraser tool
            ctx.globalCompositeOperation = 'destination-out';
        }

        // Draw the stroke
        ctx.beginPath();
        const [startX, startY] = action.pts[0];
        ctx.moveTo(startX, startY);

        for (let i = 1; i < action.pts.length; i++) {
            const [x, y] = action.pts[i];
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    public render() {
        const width = this.props.width || 400;
        const height = this.props.height || 300;
        const className = this.props.className || '';

        return (
            <canvas
                ref={this.canvasRef}
                width={width}
                height={height}
                className={`canvas-renderer ${className}`}
                style={{
                    border: '1px solid #ccc',
                    backgroundColor: '#fff'
                }}
            />
        );
    }
}
