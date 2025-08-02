/**
 * drawing.tsx - Drawing rule implementation
 */

import * as React from 'react';
import { Canvas, DrawingAction } from './Canvas';
import { DrawingView } from './DrawingView';
import { CanvasRenderer } from './CanvasRenderer';
import './drawing.scss';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

interface DrawingViewInterface extends ViewPropsInterface {
    canvas: Canvas;
}

interface CanvasDisplayInterface extends ViewPropsInterface {
    canvas: Canvas;
    width?: number;
    height?: number;
}

export const Drawing: GameRuleInterface = {

    name: 'drawing',

    plugins: {},

    globalData: {
        canvas: () => new Canvas()
    },

    playerData: {
        canvas: () => new Canvas()
    },

    onDataChange: (mp: MPType) => {
        // Get canvas data for global (host) and all players
        const globalCanvas = mp.getData('canvas');
        
        // Set view props for host
        mp.setViewProps(mp.hostId, 'canvas', globalCanvas);
        mp.setView(mp.hostId, 'DrawingDemo');

        // Set view props for all players
        mp.playersForEach((clientId, i) => {
            const playerCanvas = mp.getPlayerData(clientId, 'canvas');
            mp.setViewProps(clientId, 'canvas', playerCanvas);
            mp.setView(clientId, 'DrawingDemo');
        });

        return false;
    },

    methods: {
        /**
         * Update a client's canvas with a new drawing action
         */
        updateCanvas: (mp: MPType, clientId: string, action: DrawingAction) => {
            let canvas: Canvas;
            
            if (clientId === mp.hostId) {
                // Update global canvas for host
                canvas = mp.getData('canvas') || new Canvas();
                canvas.addAction(action);
                mp.setData('canvas', canvas);
            } else {
                // Update player canvas
                canvas = mp.getPlayerData(clientId, 'canvas') || new Canvas();
                canvas.addAction(action);
                mp.setPlayerData(clientId, 'canvas', canvas);
            }
        },

        /**
         * Clear a specific client's canvas (erase all)
         */
        clearCanvas: (mp: MPType, clientId: string) => {
            const canvas = new Canvas(); // Create new empty canvas
            
            if (clientId === mp.hostId) {
                mp.setData('canvas', canvas);
            } else {
                mp.setPlayerData(clientId, 'canvas', canvas);
            }
        },

        /**
         * Reset all canvases (global and all players)
         */
        resetAllCanvases: (mp: MPType, clientId: string) => {
            // Only allow host to reset all canvases
            if (clientId !== mp.hostId) {
                return;
            }

            // Clear global canvas
            mp.setData('canvas', new Canvas());

            // Clear all player canvases
            mp.playersForEach((playerId) => {
                mp.setPlayerData(playerId, 'canvas', new Canvas());
            });
        }
    },

    views: {
        /**
         * Interactive drawing view - allows drawing with tools
         */
        'DrawingView': class extends React.Component<DrawingViewInterface, {}> {
            public render() {
                return React.createElement(DrawingView, {
                    ...this.props,
                    width: 400,
                    height: 300
                });
            }
        },

        /**
         * Small interactive drawing view
         */
        'DrawingViewSmall': class extends React.Component<DrawingViewInterface, {}> {
            public render() {
                return React.createElement(DrawingView, {
                    ...this.props,
                    width: 300,
                    height: 200
                });
            }
        },

        /**
         * Large interactive drawing view
         */
        'DrawingViewLarge': class extends React.Component<DrawingViewInterface, {}> {
            public render() {
                return React.createElement(DrawingView, {
                    ...this.props,
                    width: 600,
                    height: 400
                });
            }
        },

        /**
         * Read-only canvas display - just shows the drawing
         */
        'CanvasDisplay': class extends React.Component<CanvasDisplayInterface, {}> {
            public render() {
                return React.createElement(CanvasRenderer, {
                    canvas: this.props.canvas,
                    width: this.props.width || 400,
                    height: this.props.height || 300,
                    className: 'canvas-display'
                });
            }
        },

        /**
         * Small read-only canvas display
         */
        'CanvasDisplaySmall': class extends React.Component<CanvasDisplayInterface, {}> {
            public render() {
                return React.createElement(CanvasRenderer, {
                    canvas: this.props.canvas,
                    width: 300,
                    height: 200,
                    className: 'canvas-display-small'
                });
            }
        },

        /**
         * Large read-only canvas display
         */
        'CanvasDisplayLarge': class extends React.Component<CanvasDisplayInterface, {}> {
            public render() {
                return React.createElement(CanvasRenderer, {
                    canvas: this.props.canvas,
                    width: 600,
                    height: 400,
                    className: 'canvas-display-large'
                });
            }
        },

        /**
         * Combined view showing drawing tools and other players' canvases
         */
        'DrawingStudio': class extends React.Component<ViewPropsInterface & {
            canvas: Canvas,
            otherCanvases?: Canvas[],
            playerNames?: string[]
        }, {}> {
            public render() {
                const otherCanvases = this.props.otherCanvases || [];
                const playerNames = this.props.playerNames || [];

                return (
                    <div className="drawing-studio">
                        <div className="main-canvas">
                            <h3>Your Canvas</h3>
                            {React.createElement(DrawingView, {
                                ...this.props,
                                width: 500,
                                height: 350
                            })}
                        </div>
                        
                        {otherCanvases.length > 0 && (
                            <div className="other-canvases">
                                <h3>Other Players</h3>
                                <div className="canvas-grid">
                                    {otherCanvases.map((canvas, index) => (
                                        <div key={index} className="other-canvas">
                                            <h4>{playerNames[index] || `Player ${index + 1}`}</h4>
                                            {React.createElement(CanvasRenderer, {
                                                canvas: canvas,
                                                width: 200,
                                                height: 150,
                                                className: 'other-canvas-renderer'
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }
        },

        /**
         * Demo view to showcase drawing functionality
         */
        'DrawingDemo': class extends React.Component<DrawingViewInterface, {}> {
            public render() {
                return (
                    <div style={{ padding: '20px' }}>
                        <h2>Drawing Canvas Demo</h2>
                        <p>Use the tools below to draw on your personal canvas:</p>
                        {React.createElement(DrawingView, {
                            ...this.props,
                            width: 500,
                            height: 350
                        })}
                        
                        <div style={{ marginTop: '20px' }}>
                            <h3>Actions Available:</h3>
                            <ul>
                                <li>Select pen tool and choose from 16 colors</li>
                                <li>Adjust thickness (1-20px)</li>
                                <li>Switch to eraser tool</li>
                                <li>Use &quot;Erase All&quot; to clear your canvas</li>
                            </ul>
                        </div>
                    </div>
                );
            }
        }
    }
};

export default Drawing;