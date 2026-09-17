/**
 * HarmoniesRulesView.tsx
 *
 * Visual, graphical rulebook for Harmonies:
 * 1. Stacking Grammar Graph: 1:1 graphical replica of the Harmonies player aid.
 * 2. Token Drafting & Placement: Interactive diagrams of drafting, valid vs invalid stacking, and undo actions.
 * 3. Animal Cards & Scoring: Sample animal card (Stag / Hare), habitat pattern matching, cube placement, and point track progression.
 * 4. Terrain Scoring Guides: Visual mini-boards explaining Trees, Mountains, Fields, Buildings, and Water (Sides A & B).
 */

import * as React from 'react';
import { Color } from '../HarmoniesAssets';
import { ANIMAL_CARD_SPECS, getHarmoniesCardDefinition, ALL_HARMONIES_ICONS } from '../HarmoniesAssets';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';

import { TOKEN_COLORS, TokenGlyph, TokenDisc, TokenSvg } from './TokenVisuals';

// ============================================================================
// Helper: Draw 2.5D Hex Tile Base
// ============================================================================

/**
 * Flat-top axial -> pixel, matching the player board's layout so that diagrams
 * showing neighbouring spaces actually tile the way the board does.
 * Neighbours are (q+-1, r) / (q, r+-1) / (q+1, r-1) / (q-1, r+1).
 */
const ax = (q: number, r: number, R: number, ox: number, oy: number) => ({
    cx: ox + 1.5 * R * q,
    cy: oy + Math.sqrt(3) * R * (r + q / 2)
});

const renderHexPolygon = (cx: number, cy: number, r: number, fill: string, stroke: string, strokeW: number = 1.4) => {
    const points = [0, 1, 2, 3, 4, 5].map((idx) => {
        const angle = idx * Math.PI / 3;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');

    return (
        <polygon
            points={points}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeW}
            strokeLinejoin="round"
        />
    );
};

// ============================================================================
// Helper: Draw a Stack of Tokens on a Hex Base
// ============================================================================

interface StackTileProps {
    cx: number;
    cy: number;
    stack: Color[];
    hexR?: number;
    tokenR?: number;
    stackStep?: number;
    highlightDest?: boolean;
    hasCube?: boolean;
}

const StackTile: React.FC<StackTileProps> = ({
    cx,
    cy,
    stack,
    hexR = 25,
    tokenR = 19,
    stackStep = 9,
    highlightDest = false,
    hasCube = false
}) => {
    return (
        <g>
            {/* Hex Base */}
            {renderHexPolygon(
                cx,
                cy,
                highlightDest ? hexR * 1.08 : hexR,
                highlightDest ? '#fef08a' : '#fde8be',
                highlightDest ? '#f59e0b' : '#d4a373',
                highlightDest ? 2.6 : 1.4
            )}
            {highlightDest && (
                <polygon
                    points={[0, 1, 2, 3, 4, 5].map((idx) => {
                        const angle = idx * Math.PI / 3;
                        const px = cx + (hexR * 1.08 - 2.6) * Math.cos(angle);
                        const py = cy + (hexR * 1.08 - 2.6) * Math.sin(angle);
                        return `${px.toFixed(1)},${py.toFixed(1)}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.2"
                />
            )}

            {/* Stacked Discs */}
            {stack.map((color, idx) => {
                const tokenY = cy - idx * stackStep;
                const isTop = idx === stack.length - 1;
                return (
                    <TokenDisc
                        key={idx}
                        cx={cx}
                        cy={tokenY}
                        color={color}
                        r={tokenR}
                        isTop={isTop}
                    />
                );
            })}

            {/* Optional 3D Animal Cube atop stack */}
            {hasCube && (
                <g transform={`translate(${cx}, ${cy - stack.length * stackStep - 7})`}>
                    <polygon points="0,-10 10,-4 0,3 -10,-4" fill="#fef08a" stroke="#d97706" strokeWidth="0.8" />
                    <polygon points="-10,-4 0,3 0,13 -10,6" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <polygon points="0,3 10,-4 10,6 0,13" fill="#d97706" stroke="#b45309" strokeWidth="0.8" />
                </g>
            )}
        </g>
    );
};

// ============================================================================
// 1. Harmonies Stacking Grammar Graph (Official Player Aid Replica)
// ============================================================================

export const HarmoniesStackingChart: React.FC = () => {
    // Level Y positions
    const yL3 = 65;
    const yL2 = 165;
    const yL1 = 265;

    // Column X positions
    const xGray = 100;
    const xRedGray = 190;
    const xRedRed = 275;
    const xRedBrown = 360;
    const xBrown = 445;
    const xGreen = 530;
    const xBlue = 615;
    const xYellow = 700;

    return (
        <div className="rules-chart-card">
            <div className="rules-chart-header">
                <span className="chart-badge">Stack Grammar Diagram</span>
                <h4>Official Stacking & Height Rules</h4>
                <p className="chart-subtitle">Follow the colored lines to see what tokens can be placed on top of each base.</p>
            </div>

            <div className="rules-svg-scroll">
                <svg
                    viewBox="0 0 780 330"
                    className="stacking-grammar-svg"
                >
                    <defs>
                        <filter id="chart-shadow" x="-10%" y="-10%" width="120%" height="120%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.3" />
                        </filter>
                    </defs>

                    {/* Light clean board background */}
                    <rect
                        x="10"
                        y="10"
                        width="760"
                        height="310"
                        rx="16"
                        fill="#ffffff"
                        stroke="#e2e8f0"
                        strokeWidth="1.5"
                    />

                    {/* Subtle horizontal guideline tracks */}
                    <line x1="65" y1={yL3} x2="750" y2={yL3} stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="4 4" />
                    <line x1="65" y1={yL2} x2="750" y2={yL2} stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="4 4" />
                    <line x1="65" y1={yL1} x2="750" y2={yL1} stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="4 4" />

                    {/* Left Height Badges */}
                    <g transform="translate(42, 0)">
                        <circle cx="0" cy={yL3} r="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                        <text x="0" y={yL3 + 5} fill="#334155" fontSize="13" fontWeight="bold" textAnchor="middle">3</text>

                        <circle cx="0" cy={yL2} r="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                        <text x="0" y={yL2 + 5} fill="#334155" fontSize="13" fontWeight="bold" textAnchor="middle">2</text>

                        <circle cx="0" cy={yL1} r="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                        <text x="0" y={yL1 + 5} fill="#334155" fontSize="13" fontWeight="bold" textAnchor="middle">1</text>
                    </g>

                    {/* -------------------------------------------------------- */}
                    {/* Connecting Branch Lines */}
                    {/* -------------------------------------------------------- */}

                    {/* 1. Mountain Gray line: L1 -> L2 -> L3 */}
                    <path
                        d={`M ${xGray} ${yL1 - 18} L ${xGray} ${yL2 + 20} M ${xGray} ${yL2 - 25} L ${xGray} ${yL3 + 28}`}
                        stroke="#64748b"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                    />

                    {/* 2. Building Coral/Red lines: Gray/Red/Brown bases converge to Red roof buildings */}
                    <path
                        d={`
                            M ${xGray} ${yL1 - 18} V 212 H ${xRedGray} V ${yL2 + 20}
                            M ${xRedRed} ${yL1 - 18} V ${yL2 + 20}
                            M ${xBrown} ${yL1 - 18} V 212 H ${xRedBrown} V ${yL2 + 20}
                        `}
                        stroke="#ef4444"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />

                    {/* 3. Trunk Brown line: L1 Brown -> L2 Brown */}
                    <line
                        x1={xBrown}
                        y1={yL1 - 18}
                        x2={xBrown}
                        y2={yL2 + 20}
                        stroke="#854d0e"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                    />

                    {/* 4. Foliage Lime/Green lines: Tree branching */}
                    {/* L1 Brown -> L2 [Brown, Green] (Tree Size 2) */}
                    <path
                        d={`M ${xBrown} 212 H ${xGreen} V ${yL2 + 20}`}
                        stroke="#22c55e"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                    {/* L2 [Brown, Brown] -> L3 [Brown, Brown, Green] (Tree Size 3) */}
                    <path
                        d={`M ${xBrown} ${yL2 - 25} V 115 H ${xGreen} V ${yL3 + 28}`}
                        stroke="#22c55e"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />

                    {/* -------------------------------------------------------- */}
                    {/* Level 1: Ground Tokens on Hex Bases */}
                    {/* -------------------------------------------------------- */}
                    <StackTile cx={xGray} cy={yL1} stack={['gray']} />
                    <StackTile cx={xRedRed} cy={yL1} stack={['red']} />
                    <StackTile cx={xBrown} cy={yL1} stack={['brown']} />
                    <StackTile cx={xGreen} cy={yL1} stack={['green']} />
                    <StackTile cx={xBlue} cy={yL1} stack={['blue']} />
                    <StackTile cx={xYellow} cy={yL1} stack={['yellow']} />

                    {/* -------------------------------------------------------- */}
                    {/* Level 2: Two-token Stacks */}
                    {/* -------------------------------------------------------- */}
                    {/* Mountain H2 */}
                    <StackTile cx={xGray} cy={yL2} stack={['gray', 'gray']} />
                    {/* Red Building on Gray */}
                    <StackTile cx={xRedGray} cy={yL2} stack={['gray', 'red']} />
                    {/* Red Building on Red */}
                    <StackTile cx={xRedRed} cy={yL2} stack={['red', 'red']} />
                    {/* Red Building on Brown */}
                    <StackTile cx={xRedBrown} cy={yL2} stack={['brown', 'red']} />
                    {/* Brown Trunk H2 */}
                    <StackTile cx={xBrown} cy={yL2} stack={['brown', 'brown']} />
                    {/* Tree Size 2 (Brown + Green) */}
                    <StackTile cx={xGreen} cy={yL2} stack={['brown', 'green']} />

                    {/* -------------------------------------------------------- */}
                    {/* Level 3: Three-token Stacks */}
                    {/* -------------------------------------------------------- */}
                    {/* Mountain H3 */}
                    <StackTile cx={xGray} cy={yL3} stack={['gray', 'gray', 'gray']} />
                    {/* Tree Size 3 (Brown + Brown + Green) */}
                    <StackTile cx={xGreen} cy={yL3} stack={['brown', 'brown', 'green']} />

                    {/* -------------------------------------------------------- */}
                    {/* Descriptive Column Labels at Bottom */}
                    {/* -------------------------------------------------------- */}
                    <text x={xGray} y="306" fill="#475569" fontSize="10.5" fontWeight="600" textAnchor="middle">Mountain</text>
                    <text x={(xRedGray + xRedBrown) / 2} y="306" fill="#dc2626" fontSize="10.5" fontWeight="600" textAnchor="middle">Building (Red Roof)</text>
                    <text x={(xBrown + xGreen) / 2} y="306" fill="#16a34a" fontSize="10.5" fontWeight="600" textAnchor="middle">Tree / Trunk</text>
                    <text x={xBlue} y="306" fill="#0284c7" fontSize="10.5" fontWeight="600" textAnchor="middle">Water (Term)</text>
                    <text x={xYellow} y="306" fill="#ca8a04" fontSize="10.5" fontWeight="600" textAnchor="middle">Field (Term)</text>
                </svg>
            </div>

            <div className="grammar-quick-pills">
                <div className="pill-item">
                    <span className="pill-dot blue" />
                    <strong>Water & Field</strong>: Terminal at Level 1 (cannot be stacked on).
                </div>
                <div className="pill-item">
                    <span className="pill-dot red" />
                    <strong>Buildings</strong>: Level 2 only (Red token on Gray, Red, or Brown).
                </div>
                <div className="pill-item">
                    <span className="pill-dot green" />
                    <strong>Trees</strong>: Height 1–3 (Green canopy on ground or 1–2 trunks).
                </div>
                <div className="pill-item">
                    <span className="pill-dot gray" />
                    <strong>Mountains</strong>: Pure gray stacks up to Height 3.
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 2. Token Placement & Turn Flow Visuals
// ============================================================================

export const HarmoniesPlacementVisual: React.FC = () => {
    const [selectedDemoIndex, setSelectedDemoIndex] = React.useState<number>(0);
    const demoTokens: Color[] = ['green', 'brown', 'gray'];

    return (
        <div className="rules-section-container">
            <div className="section-title-row">
                <h3>Token Drafting, Placement & Undo</h3>
                <span className="section-tag">Core Turn Mechanism</span>
            </div>

            <div className="placement-cards-grid">
                {/* 1. Drafting & Choosing */}
                <div className="rule-card">
                    <div className="rule-card-header">
                        <span className="step-num draft">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 4v11m-4-4l4 4 4-4" />
                                <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
                            </svg>
                        </span>
                        <h4>Draft & Select Token</h4>
                    </div>
                    <div className="rule-card-body">
                        <p>Draft an entire set of <strong>3 tokens</strong> from any market space into your draft shelf.</p>
                        <div className="visual-shelf-demo">
                            <div className="demo-shelf-box">
                                <span className="shelf-tag">Your Draft Shelf</span>
                                <div className="demo-shelf-tokens">
                                    {demoTokens.map((col, idx) => {
                                        const isSelected = selectedDemoIndex === idx;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                className={`demo-token ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setSelectedDemoIndex(idx)}
                                                title={`Click to select ${col} token for placement`}
                                                aria-label={`Select ${col} token`}
                                            >
                                                <TokenSvg color={col} size={36} r={16} />
                                                {isSelected && <span className="token-check-badge">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                <span className="shelf-hint">
                                    Selected <strong>{demoTokens[selectedDemoIndex].charAt(0).toUpperCase() + demoTokens[selectedDemoIndex].slice(1)}</strong> token. <strong>Click any token</strong> to switch selection!
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Legal Placements */}
                <div className="rule-card">
                    <div className="rule-card-header">
                        <span className="step-num check">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </span>
                        <h4>Valid Placements</h4>
                    </div>
                    <div className="rule-card-body">
                        <p>Place the selected token on your hex board following stack grammar:</p>
                        <div className="tile-examples-row">
                            <div className="tile-example">
                                <svg width="70" height="70" viewBox="0 0 70 70">
                                    <StackTile cx={35} cy={45} stack={[]} hexR={22} />
                                    <text x="35" y="49" fill="#94a3b8" fontSize="10" textAnchor="middle">Empty</text>
                                </svg>
                                <span>Any token on empty cell</span>
                            </div>
                            <div className="tile-example">
                                <svg width="70" height="70" viewBox="0 0 70 70">
                                    <StackTile cx={35} cy={48} stack={['brown', 'green']} hexR={22} tokenR={16} stackStep={8} />
                                </svg>
                                <span>Leaves on trunk (Tree)</span>
                            </div>
                            <div className="tile-example">
                                <svg width="70" height="70" viewBox="0 0 70 70">
                                    <StackTile cx={35} cy={48} stack={['gray', 'red']} hexR={22} tokenR={16} stackStep={8} />
                                </svg>
                                <span>Red on base (Building)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Illegal Placements */}
                <div className="rule-card">
                    <div className="rule-card-header">
                        <span className="step-num cross">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </span>
                        <h4>Illegal Placements</h4>
                    </div>
                    <div className="rule-card-body">
                        <p>Tokens cannot be placed in the following restricted locations:</p>
                        <div className="tile-examples-row">
                            <div className="tile-example">
                                <svg width="70" height="70" viewBox="0 0 70 70">
                                    <StackTile cx={35} cy={45} stack={['blue']} hexR={22} tokenR={16} />
                                    <line x1="18" y1="18" x2="52" y2="52" stroke="#ef4444" strokeWidth="2.5" />
                                </svg>
                                <span>Onto Blue Water</span>
                            </div>
                            <div className="tile-example">
                                <svg width="70" height="70" viewBox="0 0 70 70">
                                    <StackTile cx={35} cy={45} stack={['yellow']} hexR={22} tokenR={16} />
                                    <line x1="18" y1="18" x2="52" y2="52" stroke="#ef4444" strokeWidth="2.5" />
                                </svg>
                                <span>Onto Yellow Field</span>
                            </div>
                            <div className="tile-example">
                                <svg width="70" height="70" viewBox="0 0 70 70">
                                    <StackTile cx={35} cy={50} stack={['gray']} hexR={22} tokenR={16} hasCube={true} />
                                    <line x1="18" y1="18" x2="52" y2="52" stroke="#ef4444" strokeWidth="2.5" />
                                </svg>
                                <span>Cell with Animal Cube</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Full Undo Support */}
                <div className="rule-card">
                    <div className="rule-card-header">
                        <span className="step-num undo">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 10h10a5 5 0 0 1 5 5v2" />
                                <path d="M7 6L3 10l4 4" />
                            </svg>
                        </span>
                        <h4>Turn Undo Controls</h4>
                    </div>
                    <div className="rule-card-body">
                        <p>You can freely undo your draft or placements anytime before ending your turn:</p>
                        <div className="undo-demo-buttons">
                            <div className="demo-btn undo-place">
                                <strong>Undo Place</strong>
                                <span>Pops the last placed token back into your shelf.</span>
                            </div>
                            <div className="demo-btn undo-draft">
                                <strong>Undo Draft</strong>
                                <span>Returns all 3 tokens to the market space (when all placements are undone).</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 3. Animal Cards, Pattern Matching & Cube Scoring Visual
// ============================================================================

export const HarmoniesAnimalScoringVisual: React.FC = () => {
    // We showcase the Stag card (W5) as our canonical example
    const sampleCard = ANIMAL_CARD_SPECS.find(c => c.id === 'W5') || ANIMAL_CARD_SPECS[0];
    const cardDef = getHarmoniesCardDefinition(sampleCard);

    return (
        <div className="rules-section-container">
            <div className="section-title-row">
                <h3>Animal Cards & Habitat Scoring</h3>
                <span className="section-tag">Wildlife & Habitats</span>
            </div>

            <div className="animal-scoring-interactive">
                {/* 1. The Animal Card */}
                <div className="animal-flow-col card-col">
                    <div className="flow-step-badge">1. Take Animal Card</div>
                    <div className="card-render-wrap">
                        <PlayingCard
                            card={cardDef}
                            width="165px"
                            hoverable={false}
                            customIcons={ALL_HARMONIES_ICONS}
                        />
                    </div>
                    <p className="step-caption">
                        Take 1 face-up card from the display into your hand (hand limit: up to 4 incomplete cards).
                    </p>
                </div>

                {/* Arrow */}
                <div className="flow-arrow-col">
                    <div className="arrow-line" />
                    <span className="arrow-label">Recreate Pattern</span>
                </div>

                {/* 2. Recreate Habitat Pattern on Board */}
                <div className="animal-flow-col pattern-col">
                    <div className="flow-step-badge">2. Match Board Pattern</div>
                    <div className="mini-board-pattern-demo">
                        <svg width="190" height="150" viewBox="0 0 190 150">
                            {/* Stag (W5): water at (0,0) + water at (1,0) + tree-2 at (0,1) */}
                            <StackTile {...ax(0, 0, 28, 74, 52)} stack={['blue']} hexR={28} tokenR={20} highlightDest={true} />
                            <StackTile {...ax(1, 0, 28, 74, 52)} stack={['blue']} hexR={28} tokenR={20} />
                            <StackTile {...ax(0, 1, 28, 74, 52)} stack={['brown', 'green']} hexR={28} tokenR={20} stackStep={9} />

                            {/* Destination indicator */}
                            <text x="74" y="18" fill="#d97706" fontSize="10.5" fontWeight="bold" textAnchor="middle">Cube Here</text>
                        </svg>
                    </div>
                    <p className="step-caption">
                        Recreate the card's required pattern on your board in <strong>any of the 6 rotations</strong>.
                    </p>
                </div>

                {/* Arrow */}
                <div className="flow-arrow-col">
                    <div className="arrow-line" />
                    <span className="arrow-label">Place Cube</span>
                </div>

                {/* 3. Place Animal Cube & Score Track */}
                <div className="animal-flow-col scoring-col">
                    <div className="flow-step-badge">3. Score Animal Points</div>
                    <div className="cube-track-demo">
                        <div className="track-step-display">
                            <div className="track-box achieved">
                                <span className="cube-num">Cube 1</span>
                                <span className="cube-pts">3 pts</span>
                            </div>
                            <div className="track-box achieved">
                                <span className="cube-num">Cube 2</span>
                                <span className="cube-pts">7 pts</span>
                            </div>
                            <div className="track-box max-achieved">
                                <span className="cube-num">Cube 3</span>
                                <span className="cube-pts">12 pts</span>
                                <span className="max-tag">MAX</span>
                            </div>
                        </div>
                        <div className="board-cube-mini">
                            <svg width="60" height="60" viewBox="0 0 60 60">
                                <StackTile cx={30} cy={38} stack={['blue']} hexR={22} tokenR={16} highlightDest={true} hasCube={true} />
                            </svg>
                            <span>Cube sits on highlighted destination tile</span>
                        </div>
                    </div>
                    <p className="step-caption">
                        Place a cube from the card onto the board. You score the <strong>highest uncovered point value</strong>!
                    </p>
                </div>
            </div>

            <div className="rules-callout-box">
                <strong>Important Animal Rules:</strong>
                <ul>
                    <li>Each animal cube requires a distinct matching pattern on your board.</li>
                    <li>Each board cell may only hold <strong>1 animal cube</strong> maximum (once placed, that cell cannot receive more tokens).</li>
                    <li>When all cubes are placed from a card, the card is completed and worth its maximum points!</li>
                </ul>
            </div>
        </div>
    );
};

// ============================================================================
// 4. Terrain Scoring Visual Guides (Trees, Mountains, Fields, Buildings, Water)
// ============================================================================

export const HarmoniesTerrainScoringVisual: React.FC = () => {
    return (
        <div className="rules-section-container">
            <div className="section-title-row">
                <h3>Terrain Scoring Rules</h3>
                <span className="section-tag">Endgame Point Calculation</span>
            </div>

            <div className="terrain-scoring-grid">
                {/* 1. Trees */}
                <div className="terrain-rule-card">
                    <div className="terrain-header">
                        <span className="terrain-badge green">Trees</span>
                        <h4>Green Foliage on Brown Trunks</h4>
                    </div>
                    <div className="terrain-body">
                        <div className="terrain-visual-row">
                            <div className="score-item">
                                <svg width="70" height="85" viewBox="0 0 70 85">
                                    <StackTile cx={35} cy={60} stack={['green']} hexR={22} tokenR={16} />
                                </svg>
                                <span className="pts-badge">+1 VP</span>
                                <span className="desc">Size 1 (Ground)</span>
                            </div>
                            <div className="score-item">
                                <svg width="70" height="85" viewBox="0 0 70 85">
                                    <StackTile cx={35} cy={60} stack={['brown', 'green']} hexR={22} tokenR={16} stackStep={8} />
                                </svg>
                                <span className="pts-badge">+3 VP</span>
                                <span className="desc">Size 2 (1 Trunk)</span>
                            </div>
                            <div className="score-item">
                                <svg width="70" height="85" viewBox="0 0 70 85">
                                    <StackTile cx={35} cy={60} stack={['brown', 'brown', 'green']} hexR={22} tokenR={16} stackStep={8} />
                                </svg>
                                <span className="pts-badge gold">+7 VP</span>
                                <span className="desc">Size 3 (2 Trunks)</span>
                            </div>
                        </div>
                        <p className="rule-note">Brown trunks without a green canopy score <strong>0 VP</strong>.</p>
                    </div>
                </div>

                {/* 2. Mountains */}
                <div className="terrain-rule-card">
                    <div className="terrain-header">
                        <span className="terrain-badge gray">Mountains</span>
                        <h4>Pure Gray Granite Ranges</h4>
                    </div>
                    <div className="terrain-body">
                        <div className="terrain-visual-row">
                            <div className="score-item">
                                <span className="pts-badge">+1 VP</span>
                                <span className="desc">Height 1</span>
                            </div>
                            <div className="score-item">
                                <span className="pts-badge">+3 VP</span>
                                <span className="desc">Height 2</span>
                            </div>
                            <div className="score-item">
                                <span className="pts-badge gold">+7 VP</span>
                                <span className="desc">Height 3</span>
                            </div>
                        </div>
                        <div className="comparison-box">
                            <div className="cmp-col valid">
                                <span className="cmp-status">✓ Mountain Range</span>
                                <svg width="110" height="75" viewBox="0 0 110 75">
                                    <StackTile {...ax(0, 0, 20, 40, 38)} stack={['gray', 'gray', 'gray']} hexR={20} tokenR={14} stackStep={7} />
                                    <StackTile {...ax(1, 0, 20, 40, 38)} stack={['gray', 'gray']} hexR={20} tokenR={14} stackStep={7} />
                                </svg>
                                <strong>7 + 3 = 10 VP</strong>
                                <span>Adjacent mountains score fully</span>
                            </div>
                            <div className="cmp-col invalid">
                                <span className="cmp-status">✕ Isolated Mountain</span>
                                <svg width="60" height="75" viewBox="0 0 60 75">
                                    <StackTile cx={30} cy={50} stack={['gray', 'gray', 'gray']} hexR={20} tokenR={14} stackStep={7} />
                                </svg>
                                <strong>0 VP</strong>
                                <span>Must touch at least 1 other mountain!</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Fields */}
                <div className="terrain-rule-card">
                    <div className="terrain-header">
                        <span className="terrain-badge yellow">Fields</span>
                        <h4>Yellow Meadows in Groups of 2 or More</h4>
                    </div>
                    <div className="terrain-body">
                        <div className="field-group-demo">
                            <div className="field-demo-item">
                                <span className="field-pts">+5 VP</span>
                                <svg width="100" height="60" viewBox="0 0 100 60">
                                    <StackTile {...ax(0, 0, 18, 36, 23)} stack={['yellow']} hexR={18} tokenR={13} />
                                    <StackTile {...ax(1, 0, 18, 36, 23)} stack={['yellow']} hexR={18} tokenR={13} />
                                </svg>
                                <span>Group of 2 contiguous tiles</span>
                            </div>
                            <div className="field-demo-item">
                                <span className="field-pts">+5 VP</span>
                                <svg width="120" height="60" viewBox="0 0 120 60">
                                    <StackTile {...ax(0, 0, 16, 32, 22)} stack={['yellow']} hexR={16} tokenR={12} />
                                    <StackTile {...ax(1, 0, 16, 32, 22)} stack={['yellow']} hexR={16} tokenR={12} />
                                    <StackTile {...ax(2, -1, 16, 32, 22)} stack={['yellow']} hexR={16} tokenR={12} />
                                </svg>
                                <span>Group of 3 or more (still 1 group = 5 VP)</span>
                            </div>
                        </div>
                        <p className="rule-note">Single isolated yellow tiles score <strong>0 VP</strong>. Two separate groups of 2 tiles score <strong>5 + 5 = 10 VP</strong>.</p>
                    </div>
                </div>

                {/* 4. Buildings */}
                <div className="terrain-rule-card">
                    <div className="terrain-header">
                        <span className="terrain-badge red">Buildings</span>
                        <h4>Red Roof Settlements (Height 2)</h4>
                    </div>
                    <div className="terrain-body">
                        <div className="comparison-box">
                            <div className="cmp-col valid">
                                <span className="cmp-status">✓ Diverse (5 VP)</span>
                                <svg width="120" height="90" viewBox="0 0 120 90">
                                    {/* Building at (0,0) with three of its six neighbours */}
                                    <StackTile {...ax(-1, 0, 17, 60, 52)} stack={['blue']} hexR={16} tokenR={11} />
                                    <StackTile {...ax(0, -1, 17, 60, 52)} stack={['green']} hexR={16} tokenR={11} />
                                    <StackTile {...ax(1, -1, 17, 60, 52)} stack={['yellow']} hexR={16} tokenR={11} />
                                    {/* Center building */}
                                    <StackTile {...ax(0, 0, 17, 60, 52)} stack={['brown', 'red']} hexR={17} tokenR={12} stackStep={6} />
                                </svg>
                                <strong>3 distinct colors adjacent</strong>
                            </div>
                            <div className="cmp-col invalid">
                                <span className="cmp-status">✕ Monotone (0 VP)</span>
                                <svg width="100" height="90" viewBox="0 0 100 90">
                                    <StackTile {...ax(-1, 0, 17, 50, 50)} stack={['blue']} hexR={16} tokenR={11} />
                                    <StackTile {...ax(1, 0, 17, 50, 50)} stack={['blue']} hexR={16} tokenR={11} />
                                    {/* Center building */}
                                    <StackTile {...ax(0, 0, 17, 50, 50)} stack={['gray', 'red']} hexR={17} tokenR={12} stackStep={6} />
                                </svg>
                                <strong>Only 1 color neighbor</strong>
                            </div>
                        </div>
                        <p className="rule-note">Scores <strong>5 VP</strong> if adjacent to <strong>at least 3 distinct colors</strong> among its neighbor top tokens.</p>
                    </div>
                </div>

                {/* 5. Water */}
                <div className="terrain-rule-card wide">
                    <div className="terrain-header">
                        <span className="terrain-badge blue">Water</span>
                        <h4>Rivers (Side A) vs Islands (Side B)</h4>
                    </div>
                    <div className="terrain-body">
                        <div className="water-sides-row">
                            {/* Side A */}
                            <div className="water-side-box">
                                <h5>Side A: Longest Continuous River</h5>
                                <div className="river-track-steps">
                                    <div className="step-pill"><span>Length 2</span><strong>2 VP</strong></div>
                                    <div className="step-pill"><span>Length 3</span><strong>5 VP</strong></div>
                                    <div className="step-pill"><span>Length 4</span><strong>8 VP</strong></div>
                                    <div className="step-pill"><span>Length 5</span><strong>11 VP</strong></div>
                                    <div className="step-pill gold"><span>Length 6+</span><strong>15 VP (+4/ea)</strong></div>
                                </div>
                                <p className="rule-note">Scores your single longest non-branching river path.</p>
                            </div>

                            {/* Side B */}
                            <div className="water-side-box">
                                <h5>Side B: Islands</h5>
                                <div className="island-visual-badge">
                                    <span className="pts-big">+5 VP</span>
                                    <span>Per isolated land region completely bounded by water or board edges</span>
                                </div>
                                <p className="rule-note">Separate your terrain into distinct islands with water channels to score 5 VP per island.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 5. Main Rules View Container with Sticky Navigation Tabs
// ============================================================================

export const HarmoniesRulesView: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState<'stacking' | 'placement' | 'animals' | 'terrain'>('stacking');

    return (
        <div className="harmonies-rules-container">
            {/* Header Hero */}
            <div className="rules-hero-header">
                <div className="hero-text">
                    <h2>Harmonies — Player Reference Guide</h2>
                    <p>Draft terrain tokens, shape your landscape, attract wildlife, and score harmony points.</p>
                </div>

                {/* Navigation Pills */}
                <div className="rules-nav-pills">
                    <button
                        className={`nav-pill-btn ${activeTab === 'stacking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stacking')}
                    >
                        Stacking Grammar
                    </button>
                    <button
                        className={`nav-pill-btn ${activeTab === 'placement' ? 'active' : ''}`}
                        onClick={() => setActiveTab('placement')}
                    >
                        Drafting & Placement
                    </button>
                    <button
                        className={`nav-pill-btn ${activeTab === 'animals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('animals')}
                    >
                        Animal Cards
                    </button>
                    <button
                        className={`nav-pill-btn ${activeTab === 'terrain' ? 'active' : ''}`}
                        onClick={() => setActiveTab('terrain')}
                    >
                        Terrain Scoring
                    </button>
                </div>
            </div>

            {/* Main Content Sections */}
            <div className="rules-content-body">
                {activeTab === 'stacking' && <HarmoniesStackingChart />}
                {activeTab === 'placement' && <HarmoniesPlacementVisual />}
                {activeTab === 'animals' && <HarmoniesAnimalScoringVisual />}
                {activeTab === 'terrain' && <HarmoniesTerrainScoringVisual />}
            </div>

            {/* Quick Endgame Summary */}
            <div className="rules-footer-summary">
                <div className="summary-title">End of Game Trigger:</div>
                <p>
                    The final round is triggered when a player has <strong>2 or fewer empty spaces</strong> remaining on their board, or the token pouch is empty.
                    All players finish equal turns. The player with the most victory points wins! (Tiebreaker: Most animal cubes placed).
                </p>
            </div>
        </div>
    );
};
