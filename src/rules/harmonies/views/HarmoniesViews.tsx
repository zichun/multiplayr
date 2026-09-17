/**
 * HarmoniesViews.tsx
 *
 * React UI components for Harmonies:
 * - Lobby Views (Host & Client) with board side selection (A/B)
 * - Main Arena with:
 *   - Central Token Market (drafting 3 tokens)
 *   - Pointy-top SVG Hex Personal Board with 3D layered stacks & animal cubes
 *   - Face-up Animal Card Display (5 cards via PlayingCard)
 *   - Player's hand of active cards with cube tracks & pattern matches
 *   - Turn action guidance and controls
 * - Rules Reference tab
 * - Scoresheet & Endgame breakdown tab
 */

import * as React from 'react';
import { ViewPropsInterface, MPType } from '../../../common/interfaces';
import {
    HarmoniesGameStateData,
    PlayerState,
    HeldCard,
    boardMaskFor,
    NEIGHBOR_DIRECTIONS,
    featureOf,
    canPlaceToken,
    findPatternMatches,
    PatternMatch,
    coordKey,
    HarmoniesScoreBreakdown,
    calculateHarmoniesScore
} from '../HarmoniesGameState';
import {
    Color,
    Axial,
    AnimalCardSpec,
    FeatureRequirement,
    getHarmoniesCardDefinition,
    getShortAnimalName,
    ALL_HARMONIES_ICONS
} from '../HarmoniesAssets';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import { HarmoniesRulesView } from './HarmoniesRulesView';
import { TOKEN_COLORS, TokenGlyph, TokenDisc, TokenSvg } from './TokenVisuals';

// ============================================================================
// 1. Lobby Views
// ============================================================================

export class HarmoniesHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const playerCount = mp.playersCount ? mp.playersCount() + 1 : 1;

        // Kept in shared data rather than component state so the choice survives
        // lobby re-renders and is visible to waiting clients.
        const boardSide: 'A' | 'B' = (mp.getData ? mp.getData('harmonies_boardSide') : null) || 'A';

        const links = {
            'home': {
                'icon': 'home',
                'label': 'Lobby',
                'view': (
                    <div className="harmonies-lobby-container">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}

                        <div className="harmonies-lobby-controls">
                            <div className="harmonies-side-selector">
                                <span className="selector-label">BOARD SIDE:</span>
                                <div className="side-buttons">
                                    <button
                                        className={`side-btn ${boardSide === 'A' ? 'active' : ''}`}
                                        onClick={() => mp.setBoardSide('A')}
                                    >
                                        <strong>Side A</strong> (River Scoring)
                                    </button>
                                    <button
                                        className={`side-btn ${boardSide === 'B' ? 'active' : ''}`}
                                        onClick={() => mp.setBoardSide('B')}
                                    >
                                        <strong>Side B</strong> (Islands Scoring)
                                    </button>
                                </div>
                            </div>

                            <button
                                className="harmonies-start-game-btn"
                                onClick={() => mp.startGame(boardSide)}
                            >
                                START HARMONIES ({playerCount} Player{playerCount > 1 ? 's' : ''})
                            </button>
                        </div>
                    </div>
                )
            },
            'clients': {
                'icon': 'users',
                'label': 'Players',
                'view': mp.getPluginView('lobby', 'host-roommanagement')
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <HarmoniesRulesView />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Harmonies',
            'links': links
        });
    }
}

export class HarmoniesClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;

        const links = {
            'home': {
                'icon': 'id-card',
                'label': 'Lobby',
                'view': (
                    <div className="harmonies-lobby-container">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="harmonies-client-wait-banner">
                            <p>Waiting for the host to start the game...</p>
                            <p className="harmonies-client-side-note">
                                Board side: <strong>
                                    {((mp.getData ? mp.getData('harmonies_boardSide') : null) || 'A') === 'B'
                                        ? 'B — Islands scoring'
                                        : 'A — River scoring'}
                                </strong>
                            </p>
                        </div>
                    </div>
                )
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <HarmoniesRulesView />
            }
        };

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Harmonies',
            'links': links
        });
    }
}

// ============================================================================
// 2. Hex Board SVG Component
// ============================================================================

interface HexBoardProps {
    player: PlayerState;
    isMyTurn: boolean;
    activeTokenToPlace: Color | null;
    selectedCardForCube: AnimalCardSpec | null;
    onCellClick: (q: number, r: number) => void;
}

export const HarmoniesHexBoard: React.FC<HexBoardProps> = ({
    player,
    isMyTurn,
    activeTokenToPlace,
    selectedCardForCube,
    onCellClick
}) => {
    const sqrt3 = Math.sqrt(3);
    const mask = boardMaskFor(player.board.side);

    // Flat-top hex layout: x tracks the column, y tracks r + q/2 so that the
    // half-step between neighbouring columns falls out naturally.
    const R = player.board.side === 'B' ? 30 : 38;
    const gridX = (c: Axial) => 1.5 * R * c.q;
    const gridY = (c: Axial) => sqrt3 * R * (c.r + c.q / 2);

    // Centre whatever mask we were handed inside the viewBox.
    const xs = mask.map(gridX);
    const ys = mask.map(gridY);
    const originX = 210 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const originY = 180 - (Math.min(...ys) + Math.max(...ys)) / 2;

    // Compute active cube pattern matches if a card is selected
    const cubeMatches: PatternMatch[] = selectedCardForCube
        ? findPatternMatches(player.board, selectedCardForCube.pattern)
        : [];

    const validCubeCoords = new Set(cubeMatches.map(m => coordKey(m.cubeCoord)));

    return (
        <div className="harmonies-hex-board-wrapper">
            <svg
                viewBox="0 0 420 360"
                className="harmonies-hex-svg"
            >
                <defs>
                    <filter id="hex-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.12" />
                    </filter>
                    <filter id="token-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#000000" floodOpacity="0.18" />
                    </filter>
                </defs>

                {mask.map((coord) => {
                    const key = coordKey(coord);
                    const cell = player.board.cells[key];
                    if (!cell) return null;

                    const cx = originX + gridX(coord);
                    const cy = originY + gridY(coord);

                    // 6 vertices of a flat-top hex (first vertex due east)
                    const points = [0, 1, 2, 3, 4, 5].map((i) => {
                        const angle = i * Math.PI / 3;
                        const px = cx + R * Math.cos(angle);
                        const py = cy + R * Math.sin(angle);
                        return `${px.toFixed(1)},${py.toFixed(1)}`;
                    }).join(' ');

                    const canPlace = isMyTurn && activeTokenToPlace && !cell.cube && canPlaceToken(cell.stack, activeTokenToPlace);
                    const canPlaceCubeHere = isMyTurn && validCubeCoords.has(key);

                    return (
                        <g
                            key={key}
                            className={`hex-cell-group ${canPlace ? 'placeable' : ''} ${canPlaceCubeHere ? 'cube-target' : ''}`}
                            onClick={() => onCellClick(coord.q, coord.r)}
                        >
                            {/* Hex base tile */}
                            <polygon
                                points={points}
                                className={`hex-base-polygon ${cell.stack.length > 0 ? 'occupied' : 'empty'}`}
                            />

                            {/* Placement indicator ring */}
                            {canPlace && (
                                <polygon
                                    points={points}
                                    className="hex-highlight-polygon place-highlight"
                                />
                            )}
                            {canPlaceCubeHere && (
                                <polygon
                                    points={points}
                                    className="hex-highlight-polygon cube-highlight"
                                />
                            )}

                            {/* 3D stacked tokens inside hex */}
                            {cell.stack.map((color, idx) => {
                                const offsetY = cy - (idx * 8);
                                const isTop = idx === cell.stack.length - 1;
                                return (
                                    <TokenDisc
                                        key={idx}
                                        cx={cx}
                                        cy={offsetY}
                                        color={color}
                                        r={R * 0.68}
                                        isTop={isTop}
                                        filter="url(#token-shadow)"
                                    />
                                );
                            })}

                            {/* Animal Cube sitting atop stack */}
                            {cell.cube && (
                                <g transform={`translate(${cx}, ${cy - (cell.stack.length * 8) - 7})`}>
                                    {/* Top face */}
                                    <polygon points="0,-10 10,-4 0,3 -10,-4" fill="#f9e79f" />
                                    {/* Left face */}
                                    <polygon points="-10,-4 0,3 0,13 -10,6" fill="#f39c12" />
                                    {/* Right face */}
                                    <polygon points="0,3 10,-4 10,6 0,13" fill="#d68910" />
                                </g>
                            )}

                            {/* Empty coordinate coordinate hint for debugging / orientation */}
                            {cell.stack.length === 0 && !canPlace && (
                                <circle cx={cx} cy={cy} r="3" fill="#cbd5e1" opacity="0.8" />
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// ============================================================================
// 3. Mini Pattern Preview Component
// ============================================================================

function getRequirementStack(req: FeatureRequirement): Color[] {
    switch (req.kind) {
        case 'water':
            return ['blue'];
        case 'field':
            return ['yellow'];
        case 'mountain': {
            const h = req.height || 1;
            return Array(h).fill('gray') as Color[];
        }
        case 'tree': {
            const h = req.height || 1;
            if (h === 1) return ['green'];
            if (h === 2) return ['brown', 'green'];
            return ['brown', 'brown', 'green'];
        }
        case 'building':
            return ['brown', 'red'];
        case 'redToken':
            return ['red'];
        default:
            return ['gray'];
    }
}

export const HabitatPatternPreview: React.FC<{ pattern: AnimalCardSpec['pattern']; width?: number }> = ({
    pattern,
    width = 110
}) => {
    const R = 16;
    const sqrt3 = Math.sqrt(3);
    const stackStep = 4.2;
    const tokenR = R * 0.65;

    // Flat-top axial pixel coordinates, matching the player board's layout
    const cellData = pattern.map((p) => {
        const cx = 1.5 * R * p.offset.q;
        const cy = sqrt3 * R * (p.offset.r + p.offset.q / 2);
        const stack = getRequirementStack(p.require);
        const topY = cy - (stack.length - 1) * stackStep;
        return {
            p,
            cx,
            cy,
            topY,
            stack
        };
    });

    // Compute bounding box incorporating hex boundaries, 2.5D stack heights, and padding
    const pad = 10;
    const xs = cellData.flatMap(c => [c.cx - R * 1.15, c.cx + R * 1.15]);
    const ys = cellData.flatMap(c => [c.topY - tokenR, c.cy + R * 1.15]);

    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;

    const viewBoxW = Math.max(maxX - minX, 40);
    const viewBoxH = Math.max(maxY - minY, 35);

    // Sort cells by cy (back-to-front) so foreground cells overlap background stacks naturally
    const sortedCells = [...cellData].sort((a, b) => a.cy - b.cy);

    return (
        <svg
            viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${viewBoxW.toFixed(1)} ${viewBoxH.toFixed(1)}`}
            style={{ width: `${width}px`, height: 'auto', overflow: 'visible' }}
            className="habitat-pattern-svg"
        >
            <defs>
                <filter id="pattern-token-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodColor="#000000" floodOpacity="0.18" />
                </filter>
            </defs>

            {/* 1. Draw hex base tiles for each cell (highlighting the destination hexagon) */}
            {sortedCells.map(({ p, cx, cy }, i) => {
                const isCubeDest = p.cube === true;
                const cellR = isCubeDest ? R * 1.08 : R;
                const hexPoints = [0, 1, 2, 3, 4, 5].map((idx) => {
                    const angle = idx * Math.PI / 3;
                    const px = cx + cellR * Math.cos(angle);
                    const py = cy + cellR * Math.sin(angle);
                    return `${px.toFixed(1)},${py.toFixed(1)}`;
                }).join(' ');

                return (
                    <g key={`base-${i}`}>
                        <polygon
                            points={hexPoints}
                            fill={isCubeDest ? '#fef08a' : '#f8fafc'}
                            stroke={isCubeDest ? '#f59e0b' : '#cbd5e1'}
                            strokeWidth={isCubeDest ? 2.6 : 1.2}
                            strokeLinejoin="round"
                            className={`pattern-hex-cell ${isCubeDest ? 'pattern-hex-dest' : ''}`}
                        />
                        {/* Distinct inner accent border for destination hexagon */}
                        {isCubeDest && (
                            <polygon
                                points={[0, 1, 2, 3, 4, 5].map((idx) => {
                                    const angle = idx * Math.PI / 3;
                                    const px = cx + (cellR - 2.5) * Math.cos(angle);
                                    const py = cy + (cellR - 2.5) * Math.sin(angle);
                                    return `${px.toFixed(1)},${py.toFixed(1)}`;
                                }).join(' ')}
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                            />
                        )}
                    </g>
                );
            })}

            {/* 2. Draw 2.5D token stacks for each cell */}
            {sortedCells.map(({ p, cx, cy, stack }, cellIdx) => {
                const topIdx = stack.length - 1;

                return (
                    <g key={`stack-${cellIdx}`} className="pattern-cell-stack">
                        {stack.map((color, idx) => {
                            const tokenY = cy - idx * stackStep;
                            const isTop = idx === topIdx;

                            return (
                                <TokenDisc
                                    key={idx}
                                    cx={parseFloat(cx.toFixed(1))}
                                    cy={parseFloat(tokenY.toFixed(1))}
                                    color={color}
                                    r={tokenR}
                                    isTop={isTop}
                                    filter="url(#pattern-token-shadow)"
                                />
                            );
                        })}
                    </g>
                );
            })}
        </svg>
    );
};

// ============================================================================
// 4. Card Detail Inspector Modal (Wingspan Pocket Style)
// ============================================================================

interface CardDetailModalProps {
    card: AnimalCardSpec;
    heldInfo?: HeldCard | null;
    isMyTurn: boolean;
    canTake: boolean;
    matchesCount: number;
    onClose: () => void;
    onTake?: () => void;
    onPlaceCube?: () => void;
}

export const HarmoniesCardDetailModal: React.FC<CardDetailModalProps> = ({
    card,
    heldInfo,
    isMyTurn,
    canTake,
    matchesCount,
    onClose,
    onTake,
    onPlaceCube
}) => {
    const cubesPlaced = heldInfo ? (card.cubeCount - heldInfo.cubesLeft) : 0;
    const cardDef = getHarmoniesCardDefinition(card, cubesPlaced);

    return (
        <div className="harmonies-modal-overlay" onClick={onClose}>
            <div className="harmonies-modal-panel" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="harmonies-modal-head">
                    <div className="modal-title-wrap">
                        <h3>{getShortAnimalName(card)}</h3>
                        <span className={`harmonies-habitat-badge habitat-${card.habitat}`}>
                            {card.habitat.toUpperCase()} HABITAT
                        </span>
                    </div>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div className="harmonies-modal-body">
                    {/* Left Column: Visual Card */}
                    <div className="modal-card-preview">
                        <PlayingCard
                            card={cardDef}
                            width="160px"
                            hoverable={false}
                            customIcons={ALL_HARMONIES_ICONS}
                        />
                        <span style={{ fontSize: '0.78em', color: '#94a3b8', marginTop: 4 }}>
                            Card #{card.id}
                        </span>
                    </div>

                    {/* Right Column: Detailed Breakdown */}
                    <div className="modal-card-details">
                        {/* Status Box */}
                        <div className="detail-stat-box">
                            <div className="detail-section-title">Animal Status & Capacity</div>
                            <div style={{ fontSize: '0.95em', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span>Total Capacity: <strong>{card.cubeCount} Animal Cubes</strong></span>
                            </div>
                            <div style={{ fontSize: '0.84em', color: '#64748b', marginTop: 4 }}>
                                {heldInfo ? (
                                    <span>
                                        Currently placed: <strong>{cubesPlaced} of {card.cubeCount}</strong> cubes ({heldInfo.cubesLeft} remaining)
                                    </span>
                                ) : (
                                    <span>Available in display: Will hold {card.cubeCount} cubes when drafted into hand.</span>
                                )}
                            </div>
                        </div>

                        {/* Point Ladder Progression */}
                        <div>
                            <div className="detail-section-title">Point Ladder Progression (VP)</div>
                            <div className="detail-track-grid">
                                {card.pointTrack.slice(1).map((pts, idx) => {
                                    const cubeNum = idx + 1;
                                    const isCurrent = heldInfo && cubesPlaced === cubeNum;
                                    const isAchieved = heldInfo && cubesPlaced >= cubeNum;

                                    return (
                                        <div
                                            key={idx}
                                            className={`track-step-pill ${isAchieved ? 'achieved' : ''} ${isCurrent ? 'current' : ''}`}
                                        >
                                            <span className="step-label">Cube {cubeNum}</span>
                                            <span className="step-pts">{pts} pts</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ fontSize: '0.78em', color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                                Earn points based on the highest cube number placed by game end.
                            </div>
                        </div>

                        {/* Habitat Pattern Requirement */}
                        <div>
                            <div className="detail-section-title">Required Habitat Pattern</div>
                            <div className="pattern-preview-centered">
                                <HabitatPatternPreview pattern={card.pattern} width={220} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="harmonies-modal-footer">
                    {canTake && onTake && (
                        <button
                            type="button"
                            className="harmonies-modal-btn primary"
                            onClick={onTake}
                        >
                            Draft Card into Hand
                        </button>
                    )}
                    {heldInfo && heldInfo.cubesLeft > 0 && matchesCount > 0 && onPlaceCube && (
                        <button
                            type="button"
                            className="harmonies-modal-btn cube-action"
                            onClick={onPlaceCube}
                        >
                            Place Cube on Board ({matchesCount} valid spot{matchesCount > 1 ? 's' : ''})
                        </button>
                    )}
                    <button
                        type="button"
                        className="harmonies-modal-btn secondary"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 5. Main Page View
// ============================================================================

/**
 * Winners by final score, tie-broken on animal cubes placed. A tie that survives
 * both is a shared victory, so this can return more than one id.
 */
function computeWinnerIds(gs: HarmoniesGameStateData): string[] {
    const scores = gs.scores;
    if (!scores) return [];

    let best: { total: number; cubesPlaced: number } | null = null;
    for (const id of gs.playerIds) {
        const s = scores[id];
        if (!s) continue;
        if (!best
            || s.total > best.total
            || (s.total === best.total && s.cubesPlaced > best.cubesPlaced)) {
            best = { total: s.total, cubesPlaced: s.cubesPlaced };
        }
    }
    if (!best) return [];

    return gs.playerIds.filter((id) => {
        const s = scores[id];
        return !!s && s.total === best.total && s.cubesPlaced === best.cubesPlaced;
    });
}

interface HarmoniesMainPageProps extends ViewPropsInterface {
    gameState: HarmoniesGameStateData;
    isHost: boolean;
}

interface HarmoniesMainPageState {
    selectedCardForCube: AnimalCardSpec | null;
    inspectedCard: AnimalCardSpec | null;
    inspectedPlayerId?: string | null;
    selectedDraftTokenIndex: number;
}

export class HarmoniesMainPage extends React.Component<HarmoniesMainPageProps, HarmoniesMainPageState> {
    constructor(props: HarmoniesMainPageProps) {
        super(props);
        this.state = {
            selectedCardForCube: null,
            inspectedCard: null,
            inspectedPlayerId: null,
            selectedDraftTokenIndex: 0,
        };
    }

    private handleCellClick = (q: number, r: number) => {
        const mp = this.props.MP;
        const gs = this.props.gameState;
        const myId = mp.clientId;
        const isMyTurn = gs.playerIds[gs.currentPlayerIndex] === myId;
        if (!isMyTurn || gs.ended) return;

        const myPlayer = gs.players[myId];
        if (!myPlayer) return;

        // 1. If we have drafted tokens, place the selected drafted token
        if (myPlayer.draftedTokens.length > 0) {
            const selIndex = Math.min(this.state.selectedDraftTokenIndex, myPlayer.draftedTokens.length - 1);
            mp.placeToken(q, r, selIndex);
            // First token will be selected by default for next placement
            this.setState({ selectedDraftTokenIndex: 0 });
            return;
        }

        // 2. If a card is selected for cube placement, place cube
        if (this.state.selectedCardForCube) {
            mp.placeCube(this.state.selectedCardForCube.id, q, r);
            this.setState({ selectedCardForCube: null });
        }
    };

    public render() {
        const mp = this.props.MP;
        const gs = this.props.gameState;
        if (!gs) {
            return <div className="harmonies-loading">Loading game state...</div>;
        }

        const myId = mp.clientId;
        const currentActiveId = gs.playerIds[gs.currentPlayerIndex];
        const isMyTurn = currentActiveId === myId;
        const myPlayer = gs.players[myId] || Object.values(gs.players)[0];

        // Prepare Game Shell links
        const links: Record<string, any> = {
            'home': {
                'icon': 'gamepad',
                'label': 'Arena',
                'view': this.renderArenaView(isMyTurn, currentActiveId, myPlayer)
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': <HarmoniesRulesView />
            },
            'stats': {
                'icon': 'trophy',
                'label': gs.ended ? 'Results' : 'Scores',
                'view': this.renderScoresView()
            }
        };

        if (this.props.isHost) {
            links['settings'] = {
                'icon': 'cogs',
                'label': 'Admin',
                'view': (
                    <div className="harmonies-admin-panel">
                        <h3>Host Administration</h3>
                        <button className="admin-btn restart-btn" onClick={() => mp.restartGame()}>
                            Restart Game
                        </button>
                        <button className="admin-btn lobby-btn" onClick={() => mp.backToLobby()}>
                            Return to Lobby
                        </button>
                    </div>
                )
            };
        }

        const topBarContent = gs.ended
            ? 'GAME OVER • Final scores below'
            : gs.lastRound
                ? (isMyTurn
                    ? 'FINAL ROUND • YOUR TURN'
                    : `FINAL ROUND • Round ${gs.turnCount + 1} • Side ${gs.boardSide}`)
                : isMyTurn
                    ? 'YOUR TURN'
                    : `Round ${gs.turnCount + 1} • Side ${gs.boardSide}`;

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'gameName': 'Harmonies',
            'links': links,
            'topBarContent': topBarContent,
            'roomClassName': (isMyTurn && !gs.ended) ? 'attention-bg' : ''
        });
    }

    /**
     * Turn-order standings strip. Rendered at the bottom of the arena during play,
     * and promoted to the top of the page once the game has ended.
     */
    private renderStandingsPanel(currentActiveId: string, winnerIds: string[]) {
        const mp = this.props.MP;
        const gs = this.props.gameState;
        const ended = gs.ended;

        return (
            <div className={`harmonies-standings-panel ${ended ? 'ended' : ''}`}>
                <div className="panel-header">
                    <h4>{ended ? 'FINAL STANDINGS' : 'TURN ORDER & SCORES'}</h4>
                    <span className="standings-round">
                        {ended ? 'Game complete' : `Round ${gs.turnCount + 1}`}
                    </span>
                </div>
                <div className="standings-list">
                    {gs.playerIds.map((pId, idx) => {
                        const p = gs.players[pId];
                        const s = gs.scores
                            ? gs.scores[pId]
                            : (p ? calculateHarmoniesScore(p.board, p.hand, p.completed) : null);
                        const isActive = !ended && pId === currentActiveId;
                        const isMe = pId === mp.clientId;
                        const isWinner = ended && winnerIds.indexOf(pId) >= 0;

                        return (
                            <div
                                key={pId}
                                className={`standings-row ${isActive ? 'active' : ''} ${isMe ? 'is-me' : ''} ${isWinner ? 'winner' : ''}`}
                            >
                                <span className="standings-marker" aria-label={isActive ? 'Active turn' : undefined}>
                                    {isWinner ? '♛' : isActive ? '▶' : idx + 1}
                                </span>
                                <div className="standings-player">
                                    {mp.getPluginView('lobby', 'player-tag', { clientId: pId })}
                                    {isMe && <span className="you-badge">You</span>}
                                    {isWinner && (
                                        <span className="winner-badge">
                                            {winnerIds.length > 1 ? 'Shared Win' : 'Winner'}
                                        </span>
                                    )}
                                </div>
                                <span className="standings-cards">
                                    {p ? p.completed.length : 0} done &bull; {p ? p.hand.length : 0} active
                                </span>
                                <span className="standings-score">
                                    <strong>{s ? s.total : '-'}</strong> pts
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    private renderArenaView(isMyTurn: boolean, currentActiveId: string, myPlayer: PlayerState) {
        const mp = this.props.MP;
        const gs = this.props.gameState;

        const activePlayerTag = mp.getPluginView('lobby', 'player-tag', { clientId: currentActiveId });
        const selectedTokenIndex = Math.min(
            this.state.selectedDraftTokenIndex,
            Math.max(0, myPlayer.draftedTokens.length - 1)
        );
        const activeTokenToPlace = myPlayer.draftedTokens.length > 0
            ? myPlayer.draftedTokens[selectedTokenIndex]
            : null;

        const ended = gs.ended;
        const isFinalRound = gs.lastRound && !ended;

        // Remaining turns in the final round: play continues until the seat *before*
        // the first player has acted (landing back on firstPlayerIndex ends the game).
        const seatCount = gs.playerIds.length;
        const turnsLeftInFinalRound = isFinalRound
            ? ((gs.firstPlayerIndex - gs.currentPlayerIndex + seatCount) % seatCount) || seatCount
            : 0;

        const winnerIds = ended ? computeWinnerIds(gs) : [];
        const iWon = winnerIds.indexOf(mp.clientId) >= 0;

        const canAct = isMyTurn && !ended;

        // Drafted tokens must all be placed before any animal cube goes down.
        const canPlaceCubesNow = canAct && myPlayer.draftedTokens.length === 0;

        // Every action taken this turn is reversible, newest first. The ladder is:
        // cubes come off before the tokens they scored on, tokens come off the board
        // before the draft goes back, and a drafted card returns once its cubes are off.
        const cubesPlacedThisTurn = myPlayer.cubePlacements ? myPlayer.cubePlacements.length : 0;
        const tokensPlacedThisTurn = myPlayer.turnPlacements ? myPlayer.turnPlacements.length : 0;
        const lastTokenCubeDepth = tokensPlacedThisTurn > 0
            ? (myPlayer.turnPlacements[tokensPlacedThisTurn - 1].cubeDepth || 0)
            : 0;

        const canUndoCube = canAct && cubesPlacedThisTurn > 0;
        const canUndoPlacement = canAct && tokensPlacedThisTurn > 0 && cubesPlacedThisTurn <= lastTokenCubeDepth;
        const canUndoDraft = canAct && myPlayer.hasDraftedTokensThisTurn && tokensPlacedThisTurn === 0;
        const canUndoTakeCard = canAct && myPlayer.hasTakenCardThisTurn && !!myPlayer.takenCardRecord
            && myPlayer.hand.some((h) => h.card.id === myPlayer.takenCardRecord.cardId
                && h.cubesLeft === myPlayer.takenCardRecord.cubesLoaded);

        return (
            <div className={`harmonies-arena ${ended ? 'game-ended' : ''} ${isFinalRound ? 'final-round' : ''}`}>
                {/* 0a. Game over banner + standings promoted to the top of the page */}
                {ended && (
                    <div className="harmonies-gameover-banner" role="status">
                        <div className="gameover-badge">GAME OVER</div>
                        <div className="gameover-text">
                            <strong>
                                {winnerIds.length === 0
                                    ? 'Final scores are in.'
                                    : winnerIds.length > 1
                                        ? 'Shared victory!'
                                        : iWon ? 'You win!' : 'Winner:'}
                            </strong>
                            <span className="gameover-winners">
                                {winnerIds.map((wId) => (
                                    <span key={wId} className="gameover-winner-tag">
                                        {mp.getPluginView('lobby', 'player-tag', { clientId: wId })}
                                    </span>
                                ))}
                            </span>
                        </div>
                        <p className="gameover-hint">
                            Boards and animal cards stay visible below. Open the Results tab for the
                            full scoring breakdown and every player's tableau.
                        </p>
                    </div>
                )}

                {ended && this.renderStandingsPanel(currentActiveId, winnerIds)}

                {/* 0b. Final round warning */}
                {isFinalRound && (
                    <div className="harmonies-final-round-banner" role="status">
                        <span className="final-round-badge">
                            <span className="final-round-pulse" aria-hidden="true" />
                            FINAL ROUND
                        </span>
                        <span className="final-round-text">
                            End of game triggered
                            {gs.pouch.length === 0
                                ? ' — the token bag is empty.'
                                : ' — a landscape is nearly full.'}
                            {' '}Everyone finishes the round, then scoring happens.
                        </span>
                        <span className="final-round-count">
                            {turnsLeftInFinalRound} turn{turnsLeftInFinalRound === 1 ? '' : 's'} left
                        </span>
                    </div>
                )}

                {/* 1. Turn guidance Banner */}
                {!ended && (
                <div className="harmonies-turn-bar">
                    <div className="active-player-info">
                        <span className="turn-label">Active Turn:</span>
                        {activePlayerTag}
                    </div>

                    <div className="turn-instruction">
                        {isMyTurn ? (
                            myPlayer.draftedTokens.length > 0 ? (
                                <span className="highlight-text">
                                    Selected <span className={`inline-token-badge token-pip-${activeTokenToPlace}`}>
                                        <TokenSvg color={activeTokenToPlace} size={15} r={6.5} shadow={false} />
                                        <span>{activeTokenToPlace}</span>
                                    </span> token ({myPlayer.draftedTokens.length} remaining): Click an empty or valid stack on your board! (Click any token below to switch)
                                </span>
                            ) : !myPlayer.hasDraftedTokensThisTurn ? (
                                <span className="highlight-text">
                                    Choose 1 space from the Token Market to draft 3 tokens! (Mandatory action)
                                </span>
                            ) : (
                                <span className="highlight-text">
                                    All 3 tokens placed! You can optionally take 1 animal card or place cubes, then click "End Turn".
                                </span>
                            )
                        ) : (
                            <span>Waiting for active player to make their moves...</span>
                        )}
                    </div>

                    <div className="turn-bar-actions">
                        {canUndoCube && (
                            <button
                                type="button"
                                className="harmonies-turn-btn undo-btn cube"
                                onClick={() => mp.undoPlaceCube()}
                                title="Take back the last animal cube you placed"
                            >
                                ↩ Undo Cube
                            </button>
                        )}
                        {canUndoTakeCard && (
                            <button
                                type="button"
                                className="harmonies-turn-btn undo-btn card"
                                onClick={() => mp.undoTakeCard()}
                                title="Return the animal card you drafted to the display"
                            >
                                ↩ Undo Card
                            </button>
                        )}
                        {canUndoPlacement && (
                            <button
                                type="button"
                                className="harmonies-turn-btn undo-btn"
                                onClick={() => mp.undoTokenPlacement()}
                                title="Undo the last placed token"
                            >
                                ↩ Undo Place
                            </button>
                        )}
                        {canUndoDraft && (
                            <button
                                type="button"
                                className="harmonies-turn-btn undo-btn draft"
                                onClick={() => mp.undoTokenDraft()}
                                title="Put drafted tokens back into the market"
                            >
                                ↩ Undo Draft
                            </button>
                        )}
                        {isMyTurn && myPlayer.hasDraftedTokensThisTurn && myPlayer.draftedTokens.length === 0 && (
                            <button
                                type="button"
                                className="harmonies-end-turn-btn"
                                onClick={() => mp.endTurn()}
                            >
                                End Turn ✓
                            </button>
                        )}
                    </div>
                </div>
                )}

                {/* 2. Middle Row: Token Market + Personal Board */}
                <div className="harmonies-middle-row">
                    {/* Token Market — a turn action, hidden once the game is over */}
                    {!ended && (
                    <div className="harmonies-market-panel">
                        <div className="panel-header">
                            <h4>TOKEN MARKET</h4>
                            <span className="pouch-count">Bag: {gs.pouch.length} left</span>
                        </div>

                        <div className="market-spaces-grid">
                            {gs.market.map((space, idx) => {
                                const canDraft = isMyTurn && !myPlayer.hasDraftedTokensThisTurn && space.length > 0;
                                return (
                                    <div
                                        key={idx}
                                        className={`market-space-card ${canDraft ? 'clickable' : ''} ${space.length === 0 ? 'empty' : ''}`}
                                        onClick={() => {
                                             if (canDraft) mp.takeMarketTokens(idx);
                                        }}
                                        title={canDraft ? `Click to draft this token set` : undefined}
                                    >
                                        {space.length >= 3 ? (
                                            <div className="space-tokens-triangle">
                                                <div className="tokens-row top-row">
                                                    <TokenSvg color={space[0]} size={26} r={11.5} />
                                                    <TokenSvg color={space[1]} size={26} r={11.5} />
                                                </div>
                                                <div className="tokens-row bottom-row">
                                                    <TokenSvg color={space[2]} size={26} r={11.5} />
                                                </div>
                                            </div>
                                        ) : space.length > 0 ? (
                                            <div className="space-tokens-triangle">
                                                <div className="tokens-row top-row">
                                                    {space.slice(0, 2).map((col, tIdx) => (
                                                        <TokenSvg key={tIdx} color={col} size={26} r={11.5} />
                                                    ))}
                                                </div>
                                                {space.length > 2 && (
                                                    <div className="tokens-row bottom-row">
                                                        <TokenSvg color={space[2]} size={26} r={11.5} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="empty-market-slot">Drafted</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current Drafted Tokens Shelf & Selection */}
                        {(myPlayer.draftedTokens.length > 0 || canUndoPlacement || canUndoDraft) && (
                            <div className="drafted-shelf">
                                <div className="shelf-header">
                                    <span className="shelf-label">
                                        {myPlayer.draftedTokens.length > 0
                                            ? `CLICK TOKEN TO PLACE (${myPlayer.draftedTokens.length} REMAINING):`
                                            : 'ALL DRAFTED TOKENS PLACED'}
                                    </span>
                                    <div className="shelf-undo-actions">
                                        {canUndoPlacement && (
                                            <button
                                                type="button"
                                                className="shelf-undo-btn"
                                                onClick={() => mp.undoTokenPlacement()}
                                                title="Undo the last placed token"
                                            >
                                                ↩ Undo Place
                                            </button>
                                        )}
                                        {canUndoDraft && (
                                            <button
                                                type="button"
                                                className="shelf-undo-btn draft"
                                                onClick={() => mp.undoTokenDraft()}
                                                title="Put drafted tokens back into the market"
                                            >
                                                ↩ Undo Draft
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {myPlayer.draftedTokens.length > 0 && (
                                    <div className="shelf-tokens">
                                        {myPlayer.draftedTokens.map((col, i) => {
                                            const isSelected = i === selectedTokenIndex;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className={`token-select-btn ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => this.setState({ selectedDraftTokenIndex: i })}
                                                    title={`Click to select this ${col} token for placement`}
                                                    aria-label={`Select ${col} token`}
                                                >
                                                    <TokenSvg color={col} size={36} r={15} />
                                                    {isSelected && <span className="token-selected-check">✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Personal Hex Board */}
                    <div className={`harmonies-board-panel ${gs.boardSide === 'B' ? 'side-b' : 'side-a'}`}>
                        <div className="panel-header">
                            <h4 className="landscape-title">
                                Your Landscape ({gs.boardSide === 'B' ? 'Island' : 'River'} scoring)
                            </h4>
                            <span className="board-status">
                                {myPlayer.completed.length} Cards Done
                            </span>
                        </div>

                        <HarmoniesHexBoard
                            player={myPlayer}
                            isMyTurn={canAct}
                            activeTokenToPlace={activeTokenToPlace}
                            selectedCardForCube={this.state.selectedCardForCube}
                            onCellClick={this.handleCellClick}
                        />

                        {this.state.selectedCardForCube && (
                            <div className="cube-selection-banner">
                                <span>Targeting habitat for <strong>{getShortAnimalName(this.state.selectedCardForCube)}</strong>. Click highlighted cell to place cube!</span>
                                <button
                                    className="cancel-cube-btn"
                                    onClick={() => this.setState({ selectedCardForCube: null })}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Bottom Row: Active Animal Cards & Shared Market Display */}
                <div className="harmonies-bottom-row">
                    {/* Player's Held Animal Cards */}
                    <div className="harmonies-player-cards">
                        <div className="panel-header">
                            <h4>YOUR ANIMAL CARDS ({myPlayer.hand.length}/4)</h4>
                            {myPlayer.completed.length > 0 && (
                                <span className="completed-count">
                                    {myPlayer.completed.length} Completed
                                </span>
                            )}
                        </div>
                        <div className="player-cards-scroll">
                            {myPlayer.hand.map((held) => {
                                const cardDef = getHarmoniesCardDefinition(
                                    held.card,
                                    held.card.cubeCount - held.cubesLeft
                                );
                                const isSelected = this.state.selectedCardForCube?.id === held.card.id;
                                const matches = findPatternMatches(myPlayer.board, held.card.pattern);

                                return (
                                    <div
                                        key={held.card.id}
                                        className={`held-card-container ${isSelected ? 'selected' : ''}`}
                                        onClick={() => this.setState({ inspectedCard: held.card })}
                                        title="Click to view card details"
                                    >
                                        <PlayingCard
                                            card={cardDef}
                                            width="88px"
                                            hoverable={true}
                                            customIcons={ALL_HARMONIES_ICONS}
                                        />

                                        <div className="card-controls">
                                            <HabitatPatternPreview pattern={held.card.pattern} width={95} />
                                            {canPlaceCubesNow && held.cubesLeft > 0 && matches.length > 0 && (
                                                <button
                                                    type="button"
                                                    className={`place-cube-action-btn ${isSelected ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        this.setState({
                                                            selectedCardForCube: isSelected ? null : held.card
                                                        });
                                                    }}
                                                >
                                                    {isSelected ? 'Selecting Cell...' : `Place Cube (${matches.length})`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {myPlayer.completed.length > 0 && myPlayer.hand.length > 0 && (
                                <div className="cards-group-divider" aria-hidden="true" />
                            )}
                            {myPlayer.completed.map((card) => {
                                const cardDef = getHarmoniesCardDefinition(card, card.cubeCount);
                                const finalPts = card.pointTrack[card.cubeCount] || 0;

                                return (
                                    <div
                                        key={card.id}
                                        className="held-card-container completed"
                                        onClick={() => this.setState({ inspectedCard: card })}
                                        title={`Completed: ${getShortAnimalName(card)}`}
                                    >
                                        <PlayingCard
                                            card={cardDef}
                                            width="88px"
                                            hoverable={true}
                                            customIcons={ALL_HARMONIES_ICONS}
                                        />

                                        <div className="card-controls">
                                            <HabitatPatternPreview pattern={card.pattern} width={95} />
                                            <span className="completed-card-badge">
                                                &#10003; {finalPts} pts
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {myPlayer.hand.length === 0 && myPlayer.completed.length === 0 && (
                                <div className="no-cards-placeholder">
                                    Draft an animal card from the display below to begin attracting wildlife!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shared Animal Card Display — a draft source, hidden once the game is over */}
                    {!ended && (
                    <div className="harmonies-card-market">
                        <div className="panel-header">
                            <h4>ANIMAL DISPLAY (TAKE UP TO 1/TURN)</h4>
                            <span className="deck-count">{gs.animalDrawPile.length} in Deck</span>
                        </div>
                        <div className="market-cards-scroll">
                            {gs.animalDisplay.map((card) => {
                                const cardDef = getHarmoniesCardDefinition(card, 0);
                                const canTake = isMyTurn && !myPlayer.hasTakenCardThisTurn && myPlayer.hand.length < 4;

                                return (
                                    <div
                                        key={card.id}
                                        className="market-card-item"
                                        onClick={() => this.setState({ inspectedCard: card })}
                                        title="Click to view card details"
                                    >
                                        <PlayingCard
                                            card={cardDef}
                                            width="88px"
                                            hoverable={true}
                                            customIcons={ALL_HARMONIES_ICONS}
                                        />
                                        <div className="market-card-footer">
                                            <HabitatPatternPreview pattern={card.pattern} width={85} />
                                            {canTake && (
                                                <button
                                                    type="button"
                                                    className="take-card-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        mp.takeCard(card.id);
                                                    }}
                                                >
                                                    Draft Card
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    )}
                </div>

                {/* 4. Player Standings: turn order, live score, active-turn marker */}
                {!ended && this.renderStandingsPanel(currentActiveId, winnerIds)}

                {/* 5. Animal Card Detail Modal */}
                {this.state.inspectedCard && (() => {
                    const inspectedCard = this.state.inspectedCard;
                    const heldInfo = myPlayer.hand.find(h => h.card.id === inspectedCard.id) || null;
                    const canTakeInspected = canAct && !myPlayer.hasTakenCardThisTurn && myPlayer.hand.length < 4 && gs.animalDisplay.some(c => c.id === inspectedCard.id);
                    const matches = findPatternMatches(myPlayer.board, inspectedCard.pattern);

                    return (
                        <HarmoniesCardDetailModal
                            card={inspectedCard}
                            heldInfo={heldInfo}
                            isMyTurn={canAct}
                            canTake={canTakeInspected}
                            matchesCount={matches.length}
                            onClose={() => this.setState({ inspectedCard: null })}
                            onTake={() => {
                                mp.takeCard(inspectedCard.id);
                                this.setState({ inspectedCard: null });
                            }}
                            onPlaceCube={canPlaceCubesNow ? () => {
                                this.setState({
                                    selectedCardForCube: inspectedCard,
                                    inspectedCard: null
                                });
                            } : undefined}
                        />
                    );
                })()}
            </div>
        );
    }

    private renderScoresView() {
        const mp = this.props.MP;
        const gs = this.props.gameState;
        const scores = gs.scores;
        const myId = mp.clientId;
        const myPlayer = gs.players[myId] || Object.values(gs.players)[0];

        // Determine other players (opponents)
        let otherPlayerIds = gs.playerIds.filter((id) => id !== myId);
        if (otherPlayerIds.length === 0 && gs.playerIds.length > 0 && !gs.players[myId]) {
            // Spectator or host observing - show all players
            otherPlayerIds = gs.playerIds;
        }

        const playersToRender = otherPlayerIds;

        return (
            <div className="harmonies-scores-container">
                <div className="scores-header">
                    <h2>{gs.ended ? 'FINAL GAME SCORES' : 'CURRENT SCORE PREVIEW'}</h2>
                    <p>Total = Trees + Mountains + Fields + Buildings + Water + Animal Cards</p>
                </div>

                <div className="scores-table-wrapper">
                    <table className="harmonies-scores-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Trees</th>
                                <th>Mountains</th>
                                <th>Fields</th>
                                <th>Buildings</th>
                                <th>Water</th>
                                <th>Animals</th>
                                <th>Cubes</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gs.playerIds.map((id) => {
                                const tag = mp.getPluginView('lobby', 'player-tag', { clientId: id });
                                const p = gs.players[id];
                                const s = scores
                                    ? scores[id]
                                    : (p ? calculateHarmoniesScore(p.board, p.hand, p.completed) : null);

                                return (
                                    <tr key={id} className={s && gs.ended ? 'final-row' : ''}>
                                        <td>{tag}</td>
                                        <td>{s ? s.trees : '-'}</td>
                                        <td>{s ? s.mountains : '-'}</td>
                                        <td>{s ? s.fields : '-'}</td>
                                        <td>{s ? s.buildings : '-'}</td>
                                        <td>{s ? s.water : '-'}</td>
                                        <td>{s ? s.animals : '-'}</td>
                                        <td>{s ? s.cubesPlaced : '-'}</td>
                                        <td className="score-total"><strong>{s ? s.total : '-'}</strong></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {gs.ended && (
                    <div className="game-ended-congrats">
                        <h3>Game Completed!</h3>
                        <p>Tiebreakers: Most animal cubes placed, followed by shared victory.</p>
                    </div>
                )}

                {/* Other Players' Tableaux Section */}
                <div className="other-players-tableaux-section">
                    <div className="section-header">
                        <h3>Other Players' Tableaux</h3>
                        <p>Landscape boards and drafted animal cards for all other players</p>
                    </div>

                    {otherPlayerIds.length === 0 ? (
                        <div className="empty-other-players-notice">
                            <div className="notice-content">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <span>Solo Game • No other players in this session.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="tableaux-list">
                            {playersToRender.map((pId) => {
                                const otherPlayer = gs.players[pId];
                                if (!otherPlayer) return null;

                                const tag = mp.getPluginView('lobby', 'player-tag', { clientId: pId });
                                const otherScore = scores
                                    ? scores[pId]
                                    : calculateHarmoniesScore(otherPlayer.board, otherPlayer.hand, otherPlayer.completed);
                                const handCards = otherPlayer.hand || [];
                                const completedCards = otherPlayer.completed || [];
                                const totalDrafted = handCards.length + completedCards.length;

                                return (
                                    <div key={pId} className="other-player-tableau-card">
                                        <div className="tableau-card-header">
                                            <div className="player-tag-wrap">
                                                {tag}
                                            </div>
                                            <div className="tableau-stats">
                                                <span className="stat-pill score-pill">
                                                    Score: <strong>{otherScore.total}</strong> pts
                                                </span>
                                                <span className="stat-pill cards-pill">
                                                    Cards: <strong>{completedCards.length}</strong> done • <strong>{handCards.length}</strong> active
                                                </span>
                                                <span className="stat-pill cubes-pill">
                                                    Cubes: <strong>{otherScore.cubesPlaced}</strong>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="tableau-card-body">
                                            {/* Left Column: Landscape Board */}
                                            <div className="tableau-board-col">
                                                <div className="col-header">
                                                    <h4>Landscape Board (Side {gs.boardSide})</h4>
                                                </div>
                                                <HarmoniesHexBoard
                                                    player={otherPlayer}
                                                    isMyTurn={false}
                                                    activeTokenToPlace={null}
                                                    selectedCardForCube={null}
                                                    onCellClick={() => {}}
                                                />
                                            </div>

                                            {/* Right Column: Drafted Animals */}
                                            <div className="tableau-animals-col">
                                                <div className="col-header">
                                                    <h4>Drafted Animals ({totalDrafted})</h4>
                                                </div>

                                                {totalDrafted === 0 ? (
                                                    <div className="empty-animals-notice">
                                                        No animal cards drafted yet.
                                                    </div>
                                                ) : (
                                                    <div className="tableau-animals-content">
                                                        {handCards.length > 0 && (
                                                            <div className="animals-group">
                                                                <div className="group-subtitle">
                                                                    Active Cards ({handCards.length}/4)
                                                                </div>
                                                                <div className="animals-cards-row">
                                                                    {handCards.map((held) => {
                                                                        const cubesPlaced = held.card.cubeCount - held.cubesLeft;
                                                                        const cardDef = getHarmoniesCardDefinition(held.card, cubesPlaced);

                                                                        return (
                                                                            <div
                                                                                key={held.card.id}
                                                                                className="tableau-card-item"
                                                                                onClick={() => this.setState({
                                                                                    inspectedCard: held.card,
                                                                                    inspectedPlayerId: otherPlayer.id
                                                                                })}
                                                                                title={`Click to inspect ${getShortAnimalName(held.card)}`}
                                                                            >
                                                                                <PlayingCard
                                                                                    card={cardDef}
                                                                                    width="84px"
                                                                                    hoverable={true}
                                                                                    customIcons={ALL_HARMONIES_ICONS}
                                                                                />
                                                                                <div className="tableau-card-meta">
                                                                                    <span className="cubes-progress">
                                                                                        {cubesPlaced}/{held.card.cubeCount} cubes
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {completedCards.length > 0 && (
                                                            <div className="animals-group completed-group">
                                                                <div className="group-subtitle">
                                                                    Completed Cards ({completedCards.length})
                                                                </div>
                                                                <div className="animals-cards-row">
                                                                    {completedCards.map((card) => {
                                                                        const cardDef = getHarmoniesCardDefinition(card, card.cubeCount);
                                                                        const finalPts = card.pointTrack[card.cubeCount] || 0;

                                                                        return (
                                                                            <div
                                                                                key={card.id}
                                                                                className="tableau-card-item completed"
                                                                                onClick={() => this.setState({
                                                                                    inspectedCard: card,
                                                                                    inspectedPlayerId: otherPlayer.id
                                                                                })}
                                                                                title={`Click to inspect ${getShortAnimalName(card)}`}
                                                                            >
                                                                                <PlayingCard
                                                                                    card={cardDef}
                                                                                    width="84px"
                                                                                    hoverable={true}
                                                                                    customIcons={ALL_HARMONIES_ICONS}
                                                                                />
                                                                                <div className="tableau-card-meta">
                                                                                    <span className="completed-badge">
                                                                                        ✓ {finalPts} pts
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Inspect Modal if card clicked from tableau */}
                {this.state.inspectedCard && (() => {
                    const card = this.state.inspectedCard;
                    const inspectedPlayer = (this.state.inspectedPlayerId && gs.players[this.state.inspectedPlayerId]) || myPlayer;
                    const held = inspectedPlayer?.hand?.find((h) => h.card.id === card.id);
                    const isCompleted = inspectedPlayer?.completed?.some((c) => c.id === card.id);
                    const cubesPlaced = isCompleted ? card.cubeCount : (held ? (card.cubeCount - held.cubesLeft) : 0);

                    return (
                        <HarmoniesCardDetailModal
                            card={card}
                            heldInfo={held}
                            isMyTurn={false}
                            canTake={false}
                            matchesCount={0}
                            onClose={() => this.setState({ inspectedCard: null, inspectedPlayerId: null })}
                        />
                    );
                })()}
            </div>
        );
    }
}

// ============================================================================
// 5. Rules Reference View
// ============================================================================

export { HarmoniesRulesView } from './HarmoniesRulesView';
