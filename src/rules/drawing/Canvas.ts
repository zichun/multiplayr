/**
 * Canvas.ts - Action-based drawing canvas with minimal serialization
 */

// 16-color palette for drawing (indices 0-15)
export const COLOR_PALETTE = [
    '#262626', // 0: Soft Black (very dark, not pure black)
    '#EB4667', // 1: Pastel Red
    '#46EB84', // 2: Pastel Green
    '#46BDEB', // 3: Pastel Blue
    '#fff176', // 4: Pastel Yellow
    '#A046EB', // 5: Pastel Magenta
    '#4dd0e1', // 6: Pastel Cyan
    '#f5f5f5', // 7: Off White
    '#966C5F', // 8: Soft Brown
    '#287e2c', // 9: Soft Dark Green
    '#3949ab', // 10: Soft Navy
    '#EA6D46', // 11: Soft Olive
    '#9575cd', // 12: Pastel Purple
    '#4db6ac', // 13: Pastel Teal
    '#bdbdbd', // 14: Pastel Gray
    '#e0e0e0'  // 15: Pastel Silver
];

// Drawing action interface with minimal property names for smaller JSON
export interface DrawingAction {
    t: 'p' | 'e'; // tool: 'p' = pen, 'e' = eraser
    c?: number;   // color: index into COLOR_PALETTE (0-15), only for pen
    s: number;    // size: thickness (1-20)
    pts: number[][]; // points: array of [x, y] coordinates
}

export class Canvas {
    public actions: DrawingAction[] = [];

    constructor(actions: DrawingAction[] = []) {
        this.actions = [...actions];
    }

    static from(canvas_obj: any): Canvas {
        if (canvas_obj instanceof Canvas) {
            return canvas_obj;
        } else {
            return new Canvas(canvas_obj.actions);
        }
    }
    /**
     * Add a new drawing action
     */
    public addAction(action: DrawingAction): void {
        this.actions.push(action);
    }

    public undo(): void {
        if (this.actions.length > 0) {
            this.actions.pop();
        }
    }

    /**
     * Clear all actions (erase-all)
     */
    public clear(): void {
        this.actions = [];
    }

    /**
     * Get all actions for rendering
     */
    public getActions(): ReadonlyArray<DrawingAction> {
        return this.actions;
    }

    /**
     * Get serializable representation (minimal JSON)
     */
    public serialize(): DrawingAction[] {
        return this.actions;
    }

    /**
     * Create canvas from serialized data
     */
    public static deserialize(data: DrawingAction[]): Canvas {
        return new Canvas(data);
    }

    /**
     * Check if canvas is empty
     */
    public isEmpty(): boolean {
        return this.actions.length === 0;
    }

    /**
     * Get total number of actions
     */
    public getActionCount(): number {
        return this.actions.length;
    }
}
