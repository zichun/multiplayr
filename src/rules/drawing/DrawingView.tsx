/**
 * DrawingView.tsx - Interactive drawing canvas component
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../common/interfaces';
import { Canvas, COLOR_PALETTE, DrawingAction } from './Canvas';

interface DrawingViewProps extends ViewPropsInterface {
    canvas?: Canvas;
    width?: number;
    height?: number;
}

interface DrawingViewState {
    tool: 'p' | 'e'; // pen or eraser
    color: number;   // index into COLOR_PALETTE
    thickness: number;
    isDrawing: boolean;
    currentStroke: number[][];
}

export class DrawingView extends React.Component<DrawingViewProps, DrawingViewState> {
    private canvasRef = React.createRef<HTMLCanvasElement>();

    constructor(props: DrawingViewProps) {
        super(props);
        this.state = {
            tool: 'p',
            color: 0, // black
            thickness: 2,
            isDrawing: false,
            currentStroke: []
        };
    }

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

        // Render existing actions from the canvas
        if (this.props.canvas) {
            const actions = this.props.canvas.actions;
            for (const action of actions) {
                this.renderAction(ctx, action);
            }
        }

        // Render current stroke if drawing
        if (this.state.isDrawing && this.state.currentStroke.length > 0) {
            const currentAction: DrawingAction = {
                t: this.state.tool,
                c: this.state.tool === 'p' ? this.state.color : undefined,
                s: this.state.thickness,
                pts: this.state.currentStroke
            };
            this.renderAction(ctx, currentAction);
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

    private getMousePos(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
        const canvas = this.canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return [
            e.clientX - rect.left,
            e.clientY - rect.top
        ];
    }

    private onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = this.getMousePos(e);
        this.setState({
            isDrawing: true,
            currentStroke: [pos]
        });
    }

    private onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!this.state.isDrawing) return;

        const pos = this.getMousePos(e);
        this.setState(prevState => ({
            currentStroke: [...prevState.currentStroke, pos]
        }));
    }

    private onMouseUp = () => {
        if (!this.state.isDrawing) return;

        // Create action and send to server
        const action: DrawingAction = {
            t: this.state.tool,
            c: this.state.tool === 'p' ? this.state.color : undefined,
            s: this.state.thickness,
            pts: this.state.currentStroke
        };

        // Send action to server
        this.props.MP.updateCanvas(action);

        this.setState({
            isDrawing: false,
            currentStroke: []
        });
    }

    private selectTool = (tool: 'p' | 'e') => {
        this.setState({ tool });
    }

    private selectColor = (colorIndex: number) => {
        this.setState({ color: colorIndex });
    }

    private setThickness = (thickness: number) => {
        this.setState({ thickness });
    }

    private eraseAll = () => {
        this.props.MP.clearCanvas();
    }

    public render() {
        const width = this.props.width || 400;
        const height = this.props.height || 300;

        return (
            <div className="drawing-view">
                {/* Canvas with attached toolbar */}
                <div className="canvas-with-toolbar">
                    {/* Toolbar attached to top of canvas */}
                    <div className="drawing-toolbar" style={{ width: width }}>

                        {/* Color palette (only for pen) */}
                        <div className="color-section">
                            <div className="color-palette">
                                {COLOR_PALETTE.map((color, index) => (
                                    <button
                                        key={index}
                                        className={`color-button ${this.state.color === index ? 'active' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => this.selectColor(index)}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Tool selection */}
                        <div className="tool-section">
                            <button
                                className={this.state.tool === 'p' ? 'active' : ''}
                                onClick={() => this.selectTool('p')}
                                title="Pen"
                            >
                                <FontAwesomeIcon icon="pen" />
                            </button>
                            <button
                                className={this.state.tool === 'e' ? 'active' : ''}
                                onClick={() => this.selectTool('e')}
                                title="Eraser"
                            >
                                <FontAwesomeIcon icon="eraser" />
                            </button>
                        </div>
                        {/* Thickness */}
                        <div className="thickness-section">
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={this.state.thickness}
                                onChange={(e) => this.setThickness(parseInt(e.target.value))}
                            />
                            <span>{this.state.thickness}px</span>
                        </div>

                        {/* Erase all */}
                        <div className="erase-section">
                            <button onClick={this.eraseAll} className="erase-all-button">
                                Erase All
                            </button>
                        </div>
                    </div>

                    {/* Drawing canvas */}
                    <div className="canvas-container">
                        <canvas
                            ref={this.canvasRef}
                            width={width}
                            height={height}
                            className="drawing-canvas"
                            style={{
                                backgroundColor: '#fff',
                                cursor: this.state.tool === 'p' ? 'crosshair' : 'grab'
                            }}
                            onMouseDown={this.onMouseDown}
                            onMouseMove={this.onMouseMove}
                            onMouseUp={this.onMouseUp}
                            onMouseLeave={this.onMouseUp}
                        />
                    </div>
                </div>
            </div>
        );
    }
}
