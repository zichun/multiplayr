/**
 * Canvas.ts - Action-based drawing canvas with minimal serialization
 */

// 16-color palette for drawing (indices 0-15)
export const COLOR_PALETTE = [
    '#000000', // 0: Black
    '#FF0000', // 1: Red  
    '#00FF00', // 2: Green
    '#0000FF', // 3: Blue
    '#FFFF00', // 4: Yellow
    '#FF00FF', // 5: Magenta
    '#00FFFF', // 6: Cyan
    '#FFFFFF', // 7: White
    '#800000', // 8: Maroon
    '#008000', // 9: Dark Green
    '#000080', // 10: Navy
    '#808000', // 11: Olive
    '#800080', // 12: Purple
    '#008080', // 13: Teal
    '#808080', // 14: Gray
    '#C0C0C0'  // 15: Silver
];

// Drawing action interface with minimal property names for smaller JSON
export interface DrawingAction {
    t: 'p' | 'e'; // tool: 'p' = pen, 'e' = eraser
    c?: number;   // color: index into COLOR_PALETTE (0-15), only for pen
    s: number;    // size: thickness (1-20)
    pts: number[][]; // points: array of [x, y] coordinates
}

export class Canvas {
    private actions: DrawingAction[] = [];

    constructor(actions: DrawingAction[] = []) {
        this.actions = [...actions];
    }

    /**
     * Add a new drawing action
     */
    public addAction(action: DrawingAction): void {
        this.actions.push(action);
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