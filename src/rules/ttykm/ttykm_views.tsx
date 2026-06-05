import * as React from 'react';
import { ViewPropsInterface } from '../../common/interfaces';

const renderHatSVG = (playerColor: number, size: number = 24) => {
    const isWhite = playerColor === 0;
    const crownColor = isWhite ? '#ffffff' : '#1e1e24';
    const bandColor = isWhite ? '#457fc4' : '#e74c3c';
    const strokeColor = '#000000';
    const strokeWidth = 2;

    return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(1.5px 1.5px 0px rgba(0,0,0,0.15))' }}>
            <path 
                d="M 8 20 L 10 6 L 22 6 L 24 20 Z" 
                fill={crownColor} 
                stroke={strokeColor} 
                strokeWidth={strokeWidth} 
                strokeLinejoin="round"
            />
            <path 
                d="M 8.8 17.5 L 9.3 14 L 22.7 14 L 23.2 17.5 Z" 
                fill={bandColor} 
                stroke={strokeColor} 
                strokeWidth={strokeWidth} 
                strokeLinejoin="round"
            />
            <path 
                d="M 4 20 C 4 20, 4 24, 16 24 C 28 24, 28 20, 28 20 Z" 
                fill={crownColor} 
                stroke={strokeColor} 
                strokeWidth={strokeWidth} 
                strokeLinejoin="round"
            />
        </svg>
    );
};

export interface TTYKMSpaceType {
    player: number | null;
    seed: boolean;
    shrub: boolean;
    tree: boolean;
    fallenTree: number | null;
    statue: number | null;
    elephant: 'dark' | 'light' | null;
    hat: number | null;
}

export interface TTYKMViewPropsInterface extends ViewPropsInterface {
    waiting: boolean;
    player: number; // 0 for White/Host, 1 for Black/Client
    boards: TTYKMSpaceType[][];
    focusTokens: number[];
    supplies: {
        playerCopies: number[];
        statues: number[];
        hats: number[];
        seeds: number;
        shrubs: number;
        trees: number;
        fallenTrees: number;
    };
    statueBuilt: boolean[];
    turn: number;
    turnStep: number;
    activeCopySpace: number | null;
    actionsRemaining: number;
    winner: number;
    status: 'playing' | 'gameover' | 'stalemate';
    config: {
        growthModule: boolean;
        influenceModule: boolean;
        memoryModule: boolean;
        reboundRule: '2023' | '2021';
    };
    lastActionText: string;
}

interface TTYKMViewState {
    targeting: 'plantSeed' | 'removeSeed' | 'buildStatue' | 'trainElephant' | 'commandElephant' | null;
    selectedElephantSpace: number | null;
    pullStatueEnabled: boolean;
}

export class TTYKMView extends React.Component<TTYKMViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const player = this.props.player;
        const view = this.props.waiting ? waiting(this.props) : React.createElement(TTYKMMainView, this.props);

        const links: any = {
            'home': {
                'icon': 'gamepad',
                'label': 'Board',
                'view': view
            },
            'rules': {
                'icon': 'book',
                'label': 'Rules',
                'view': React.createElement(TTYKMGameRules)
            }
        };

        if (player === 0) {
            links['host'] = {
                'icon': 'cog',
                'label': 'Host Settings',
                'view': React.createElement(TTYKMHostSettingsView, this.props)
            };
        }

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': links
            }
        );
    }
}

class TTYKMMainView extends React.Component<TTYKMViewPropsInterface, TTYKMViewState> {
    constructor(props: TTYKMViewPropsInterface) {
        super(props);
        this.state = {
            targeting: null,
            selectedElephantSpace: null,
            pullStatueEnabled: false
        };
    }

    private selectCopy(space: number) {
        this.props.MP.select_copy(space);
    }

    private selectMove(dir: { dx: number, dy: number }, pullStatueSpace: number | null) {
        this.props.MP.make_action({
            type: 'move',
            dir: dir,
            pullStatueSpace: pullStatueSpace
        });
        this.setState({ pullStatueEnabled: false });
    }

    private selectTimeTravel(forward: boolean) {
        this.props.MP.make_action({
            type: forward ? 'timeTravelForward' : 'timeTravelBackward'
        });
    }

    private selectFocus(era: number) {
        this.props.MP.move_focus(era);
    }

    private startTargeting(action: 'plantSeed' | 'removeSeed' | 'buildStatue' | 'trainElephant' | 'commandElephant') {
        if (action === 'commandElephant') {
            // Find trained elephant in this era
            const era = this.props.focusTokens[this.props.turn];
            let trainedSpace = -1;
            for (let s = 0; s < 16; s++) {
                if (this.props.boards[era][s].elephant && this.props.boards[era][s].hat === this.props.turn) {
                    trainedSpace = s;
                    break;
                }
            }
            if (trainedSpace !== -1) {
                this.setState({ targeting: 'commandElephant', selectedElephantSpace: trainedSpace });
            }
        } else {
            this.setState({ targeting: action, selectedElephantSpace: null });
        }
    }

    private cancelTargeting() {
        this.setState({ targeting: null, selectedElephantSpace: null });
    }

    private clickTargetSpace(targetSpace: number) {
        const type = this.state.targeting;
        if (!type) return;

        this.props.MP.make_action({
            type: type,
            targetSpace: targetSpace
        });
        this.setState({ targeting: null, selectedElephantSpace: null });
    }

    private clickCommandDirection(dir: { dx: number, dy: number }) {
        if (this.state.selectedElephantSpace === null) return;
        this.props.MP.make_action({
            type: 'commandElephant',
            elephantSpace: this.state.selectedElephantSpace,
            dir: dir
        });
        this.setState({ targeting: null, selectedElephantSpace: null });
    }

    private skipActions() {
        this.props.MP.skip_actions();
        this.setState({ targeting: null, selectedElephantSpace: null });
    }

    private restartGame(config: any) {
        this.props.MP.new_game(config);
        this.setState({ targeting: null, selectedElephantSpace: null });
    }

    private toggleConfigModule(moduleKey: 'growthModule' | 'influenceModule' | 'memoryModule') {
        const newConfig = { ...this.props.config };
        newConfig[moduleKey] = !newConfig[moduleKey];
        this.restartGame(newConfig);
    }

    private setReboundRule(rule: '2023' | '2021') {
        const newConfig = { ...this.props.config };
        newConfig.reboundRule = rule;
        this.restartGame(newConfig);
    }

    private getAdjacentLegalSpaces(): number[] {
        if (this.props.activeCopySpace === null) return [];
        const space = this.props.activeCopySpace;
        const era = this.props.focusTokens[this.props.turn];
        const adjSpaces: number[] = [];
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
        ];

        for (const dir of dirs) {
            const adj = this.getAdjacentSpaceIdx(space, dir);
            if (adj !== null) {
                if (this.state.targeting === 'plantSeed') {
                    if (this.isPlantSeedLegalLocal(era, space, adj)) adjSpaces.push(adj);
                } else if (this.state.targeting === 'removeSeed') {
                    if (this.isRemoveSeedLegalLocal(era, space, adj)) adjSpaces.push(adj);
                } else if (this.state.targeting === 'buildStatue') {
                    if (this.isBuildStatueLegalLocal(era, space, adj)) adjSpaces.push(adj);
                } else if (this.state.targeting === 'trainElephant') {
                    if (this.isTrainElephantLegalLocal(era, space, adj)) adjSpaces.push(adj);
                }
            }
        }

        // Add self for plant/remove seed if applicable
        if (this.state.targeting === 'plantSeed' && this.isPlantSeedLegalLocal(era, space, space)) {
            adjSpaces.push(space);
        }
        if (this.state.targeting === 'removeSeed' && this.isRemoveSeedLegalLocal(era, space, space)) {
            adjSpaces.push(space);
        }

        return adjSpaces;
    }

    private getAdjacentSpaceIdx(space: number, dir: { dx: number, dy: number }): number | null {
        const row = Math.floor(space / 4);
        const col = space % 4;
        const targetRow = row + dir.dy;
        const targetCol = col + dir.dx;
        if (targetRow < 0 || targetRow >= 4 || targetCol < 0 || targetCol >= 4) {
            return null;
        }
        return targetRow * 4 + targetCol;
    }

    private getDirection(from: number, to: number): { dx: number, dy: number } {
        const rFrom = Math.floor(from / 4);
        const cFrom = from % 4;
        const rTo = Math.floor(to / 4);
        const cTo = to % 4;
        return { dx: cTo - cFrom, dy: rTo - rFrom };
    }

    private getEraName(era: number): string {
        if (era === 0) return 'Past';
        if (era === 1) return 'Present';
        return 'Future';
    }

    // Local rules checks to avoid remote call latency for highlighting
    private isPlantSeedLegalLocal(era: number, space: number, target: number): boolean {
        if (!this.props.config.growthModule) return false;
        if (this.props.supplies.seeds <= 0) return false;
        const dest = this.props.boards[era][target];
        if (dest.seed || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
            return false;
        }
        return true;
    }

    private isRemoveSeedLegalLocal(era: number, space: number, target: number): boolean {
        if (!this.props.config.growthModule) return false;
        return this.props.boards[era][target].seed;
    }

    private isBuildStatueLegalLocal(era: number, space: number, target: number): boolean {
        if (!this.props.config.influenceModule) return false;
        if (this.props.statueBuilt[this.props.turn]) return false;
        if (this.props.supplies.statues[this.props.turn] <= 0) return false;
        const dest = this.props.boards[era][target];
        if (dest.player !== null || dest.seed || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
            return false;
        }
        return true;
    }

    private isTrainElephantLegalLocal(era: number, space: number, target: number): boolean {
        if (!this.props.config.memoryModule) return false;
        const dest = this.props.boards[era][target];
        if (!dest.elephant || dest.hat === this.props.turn) return false;

        if (this.props.supplies.hats[this.props.turn] <= 0) {
            let hasOtherHat = false;
            for (let s = 0; s < 16; s++) {
                if (s !== target && this.props.boards[era][s].elephant && this.props.boards[era][s].hat === this.props.turn) {
                    hasOtherHat = true;
                    break;
                }
            }
            if (!hasOtherHat) return false;
        }
        return true;
    }

    private isMoveLegalLocal(era: number, space: number, dir: { dx: number, dy: number }): boolean {
        const toSpace = this.getAdjacentSpaceIdx(space, dir);
        if (toSpace === null) return false;
        const target = this.props.boards[era][toSpace];
        if (target.player === this.props.turn) return false;
        if (target.shrub || target.fallenTree || target.elephant) return false;
        return true;
    }

    private isTimeTravelLegalLocal(era: number, space: number, forward: boolean): boolean {
        if (forward) {
            if (era >= 2) return false;
            const dest = this.props.boards[era + 1][space];
            if (dest.player !== null || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
                return false;
            }
        } else {
            if (era <= 0) return false;
            if (this.props.supplies.playerCopies[this.props.turn] <= 0) return false;
            const dest = this.props.boards[era - 1][space];
            if (dest.player !== null || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
                return false;
            }
        }
        return true;
    }

    public render() {
        const {
            boards,
            focusTokens,
            supplies,
            turn,
            turnStep,
            activeCopySpace,
            actionsRemaining,
            winner,
            status,
            config,
            lastActionText,
            player
        } = this.props;

        const activeEra = focusTokens[turn];
        const isMyTurn = (player === turn && status === 'playing');

        // Setup Panel (only Host before any moves)
        const isGameInitialSetup = (player === 0 && lastActionText === 'New game started.' && turn === 0 && turnStep === 0);
        const setupPanel = isGameInitialSetup ? (
            <div className="ttykm-setup-card">
                <h3>🛠️ Game Configuration</h3>
                <div className="setup-checkboxes">
                    <label className="checkbox-container">
                        <input
                            type="checkbox"
                            checked={config.growthModule}
                            onChange={() => this.toggleConfigModule('growthModule')}
                        />
                        <span className="checkbox-label">Chapter 1: Growth Module (Plants 🌿🌳)</span>
                    </label>
                    <label className="checkbox-container">
                        <input
                            type="checkbox"
                            checked={config.influenceModule}
                            onChange={() => this.toggleConfigModule('influenceModule')}
                        />
                        <span className="checkbox-label">Chapter 2: Influence Module (Statues 🏛️)</span>
                    </label>
                    {config.influenceModule && (
                        <div className="sub-settings">
                            <span className="sub-settings-label">Statue Rebound Rule:</span>
                            <button
                                className={`btn-sub ${config.reboundRule === '2023' ? 'active' : ''}`}
                                onClick={() => this.setReboundRule('2023')}
                            >
                                2023 (No Rebound)
                            </button>
                            <button
                                className={`btn-sub ${config.reboundRule === '2021' ? 'active' : ''}`}
                                onClick={() => this.setReboundRule('2021')}
                            >
                                2021 (Legacy Rebound)
                            </button>
                        </div>
                    )}
                    <label className="checkbox-container">
                        <input
                            type="checkbox"
                            checked={config.memoryModule}
                            onChange={() => this.toggleConfigModule('memoryModule')}
                        />
                        <span className="checkbox-label">Chapter 3: Memory Module (Elephants 🐘)</span>
                    </label>
                </div>
                <div className="setup-info">
                    Toggle options above. Settings sync automatically in real-time.
                </div>
            </div>
        ) : null;

        // Banner details
        let bannerText = '';
        let bannerClass = 'banner-turn';
        if (status === 'playing') {
            const playerLabel = turn === 0 ? 'White' : 'Black';
            const actionStep = turnStep === 0
                ? 'Choose Active Copy'
                : turnStep === 1
                    ? `Take Action (${3 - actionsRemaining}/2)`
                    : 'Move Focus Token';

            bannerText = `${playerLabel} Traveler's Turn: ${actionStep}`;
            bannerClass = turn === 0 ? 'banner-turn white-p' : 'banner-turn black-p';
            if (isMyTurn) {
                bannerText += ' (YOUR TURN)';
            }
        } else if (status === 'gameover') {
            bannerText = `🏆 Player ${winner === 0 ? 'White' : 'Black'} has won the game!`;
            bannerClass = 'banner-gameover';
        } else {
            bannerText = '🤝 The game has ended in a Stalemate/Draw!';
            bannerClass = 'banner-stalemate';
        }

        // Available active copy actions toolbar
        const hasTimeTravelForward = activeCopySpace !== null && this.isTimeTravelLegalLocal(activeEra, activeCopySpace, true);
        const hasTimeTravelBackward = activeCopySpace !== null && this.isTimeTravelLegalLocal(activeEra, activeCopySpace, false);
        const canPlantSeed = activeCopySpace !== null && config.growthModule && supplies.seeds > 0;
        const canRemoveSeed = activeCopySpace !== null && config.growthModule;
        const canBuildStatue = activeCopySpace !== null && config.influenceModule && !this.props.statueBuilt[turn] && supplies.statues[turn] > 0;
        const canTrainElephant = activeCopySpace !== null && config.memoryModule;

        // Command elephant check
        let hasTrainedElephantInEra = false;
        let trainedElephantSpace = -1;
        if (config.memoryModule && activeCopySpace !== null) {
            for (let s = 0; s < 16; s++) {
                if (boards[activeEra][s].elephant && boards[activeEra][s].hat === turn) {
                    hasTrainedElephantInEra = true;
                    trainedElephantSpace = s;
                    break;
                }
            }
        }

        const adjacentStatueSpaces: number[] = [];
        if (activeCopySpace !== null) {
            const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
            for (const d of dirs) {
                const adj = this.getAdjacentSpaceIdx(activeCopySpace, d);
                if (adj !== null && boards[activeEra][adj].statue !== null) {
                    adjacentStatueSpaces.push(adj);
                }
            }
        }

        const actionToolbar = (isMyTurn && turnStep === 1 && activeCopySpace !== null && !this.state.targeting) ? (
            <div className="action-toolbar">
                <h4>Select Action:</h4>
                <div className="action-buttons">
                    {hasTimeTravelForward && (
                        <button className="btn-action" onClick={() => this.selectTimeTravel(true)}>
                            ⏩ Travel Forward
                        </button>
                    )}
                    {hasTimeTravelBackward && (
                        <button className="btn-action" onClick={() => this.selectTimeTravel(false)}>
                            ⏪ Travel Backward
                        </button>
                    )}
                    {canPlantSeed && (
                        <button className="btn-action" onClick={() => this.startTargeting('plantSeed')}>
                            🌿 Plant Seed
                        </button>
                    )}
                    {canRemoveSeed && (
                        <button className="btn-action" onClick={() => this.startTargeting('removeSeed')}>
                            ❌ Remove Seed
                        </button>
                    )}
                    {canBuildStatue && (
                        <button className="btn-action" onClick={() => this.startTargeting('buildStatue')}>
                            🏛️ Build Statue
                        </button>
                    )}
                    {canTrainElephant && (
                        <button className="btn-action" onClick={() => this.startTargeting('trainElephant')}>
                            🐘 Train Elephant
                        </button>
                    )}
                    {hasTrainedElephantInEra && (
                        <button className="btn-action" onClick={() => this.startTargeting('commandElephant')}>
                            🎮 Command Elephant
                        </button>
                    )}
                    <button className="btn-action btn-skip" onClick={() => this.skipActions()}>
                        Skip Remaining Action
                    </button>
                </div>
                {adjacentStatueSpaces.length > 0 && (
                    <div className="pull-option">
                        <label className="checkbox-container">
                            <input
                                type="checkbox"
                                checked={this.state.pullStatueEnabled}
                                onChange={(e) => this.setState({ pullStatueEnabled: e.target.checked })}
                            />
                            <span className="checkbox-label">Pull adjacent statue when moving copy</span>
                        </label>
                    </div>
                )}
            </div>
        ) : null;

        // Targeting overlays
        const targetingOverlay = (isMyTurn && this.state.targeting && this.state.targeting !== 'commandElephant') ? (
            <div className="targeting-overlay">
                <div className="targeting-message">
                    Select a highlighted space on the <strong>{this.getEraName(activeEra)}</strong> board to <strong>{
                        {
                            'plantSeed': 'plant a seed',
                            'removeSeed': 'remove a seed',
                            'buildStatue': 'build a statue',
                            'trainElephant': 'train an elephant'
                        }[this.state.targeting] || this.state.targeting
                    }</strong>.
                </div>
                <button className="btn-cancel" onClick={() => this.cancelTargeting()}>
                    Cancel Action
                </button>
            </div>
        ) : null;

        // Command elephant direction buttons
        const commandOverlay = (isMyTurn && this.state.targeting === 'commandElephant' && this.state.selectedElephantSpace !== null) ? (
            <div className="command-overlay">
                <div className="targeting-message">
                    Select direction to move the commanded elephant:
                </div>
                <div className="direction-controls">
                    <button className="btn-dir" onClick={() => this.clickCommandDirection({ dx: 0, dy: -1 })}>⬆️</button>
                    <button className="btn-dir" onClick={() => this.clickCommandDirection({ dx: 0, dy: 1 })}>⬇️</button>
                    <button className="btn-dir" onClick={() => this.clickCommandDirection({ dx: -1, dy: 0 })}>⬅️</button>
                    <button className="btn-dir" onClick={() => this.clickCommandDirection({ dx: 1, dy: 0 })}>➡️</button>
                </div>
                <button className="btn-cancel" onClick={() => this.cancelTargeting()}>
                    Cancel Action
                </button>
            </div>
        ) : null;

        // Highlight spaces logic
        const targetSpaces = this.getAdjacentLegalSpaces();

        // Let's render the three boards
        const renderBoard = (eraIdx: number) => {
            const eraName = this.getEraName(eraIdx);
            const isFocused = (focusTokens[turn] === eraIdx);
            const hasMyFocus = (focusTokens[player] === eraIdx);

            const isFocusTarget = (isMyTurn && turnStep === 2 && !isFocused);

            const gridCells = [];
            for (let s = 0; s < 16; s++) {
                const space = boards[eraIdx][s];
                const isSelected = (activeCopySpace === s && isFocused);

                // Click handler
                let onClick = null;
                let cellClass = 'ttykm-cell';

                if (isMyTurn) {
                    if (turnStep === 0 && isFocused && space.player === player) {
                        onClick = () => this.selectCopy(s);
                        cellClass += ' eligible-copy';
                    } else if (turnStep === 1 && isFocused && !this.state.targeting) {
                        // Regular move click on adjacent space
                        if (activeCopySpace !== null) {
                            const dir = this.getDirection(activeCopySpace, s);
                            if (Math.abs(dir.dx) + Math.abs(dir.dy) === 1 && this.isMoveLegalLocal(eraIdx, activeCopySpace, dir)) {
                                const pullStatueSpace = this.state.pullStatueEnabled && adjacentStatueSpaces.length > 0
                                    ? adjacentStatueSpaces[0] // pick the first adjacent statue for simplicity
                                    : null;
                                onClick = () => this.selectMove(dir, pullStatueSpace);
                                cellClass += ' legal-move';
                            }
                        }
                    } else if (turnStep === 1 && isFocused && this.state.targeting && this.state.targeting !== 'commandElephant') {
                        if (targetSpaces.includes(s)) {
                            onClick = () => this.clickTargetSpace(s);
                            cellClass += ' targeting-cell';
                        }
                    }
                }

                if (isSelected) cellClass += ' selected';

                // Icons/labels inside the cell
                let content = null;
                if (space.player !== null) {
                    content = (
                        <div className={`piece-player ${space.player === 0 ? 'white-p' : 'black-p'}`}>
                            <div className={`piece-player-circle ${space.player === 0 ? 'white-circle' : 'black-circle'}`} />
                        </div>
                    );
                } else if (space.shrub) {
                    content = <div className="piece-plant">🌲</div>;
                } else if (space.tree) {
                    content = <div className="piece-plant">🌳</div>;
                } else if (space.fallenTree !== null) {
                    const fallDir = this.getDirection(space.fallenTree, s);
                    const arrow = fallDir.dx === 0 && fallDir.dy === -1 ? '🪵⬆️'
                        : fallDir.dx === 0 && fallDir.dy === 1 ? '🪵⬇️'
                            : fallDir.dx === -1 && fallDir.dy === 0 ? '🪵⬅️'
                                : '🪵➡️';
                    content = <div className="piece-plant-fallen">{arrow}</div>;
                } else if (space.statue !== null) {
                    const stClass = space.statue === 10 ? 'neutral' : (space.statue === 0 ? 'white-s' : 'black-s');
                    content = <div className={`piece-statue ${stClass}`}>🏛️</div>;
                } else if (space.elephant !== null) {
                    content = (
                        <div className="piece-elephant" style={{ position: 'relative' }}>
                            <span className="elephant-emoji" style={{ fontSize: '2.2rem' }}>🐘</span>
                            {space.hat !== null && (
                                <div className="hat-overlay-svg">
                                    {renderHatSVG(space.hat, 24)}
                                </div>
                            )}
                        </div>
                    );
                }

                // Append seed if present (since player can share space with seed)
                let seedOverlay = null;
                if (space.seed) {
                    seedOverlay = <div className="piece-seed">🌿</div>;
                }

                gridCells.push(
                    <div key={s} className={cellClass} onClick={onClick}>
                        {content}
                        {seedOverlay}
                        <span className="space-num">{s + 1}</span>
                    </div>
                );
            }

            let boardClass = 'ttykm-board';
            if (isFocused) boardClass += ' active-era';
            if (hasMyFocus) boardClass += ' my-focused';
            if (isFocusTarget) boardClass += ' focus-target';

            const headerClick = isFocusTarget ? () => this.selectFocus(eraIdx) : null;

            return (
                <div className={boardClass} key={eraIdx}>
                    <div className="board-header" onClick={headerClick}>
                        <h3>{eraName} Era</h3>
                        {focusTokens[0] === eraIdx && <span className="focus-badge white-f">White Focus</span>}
                        {focusTokens[1] === eraIdx && <span className="focus-badge black-f">Black Focus</span>}
                        {isFocusTarget && <span className="focus-click-prompt">Click to move focus here</span>}
                    </div>
                    <div className="board-grid">
                        {gridCells}
                    </div>
                </div>
            );
        };

        // Supplies list UI
        const suppliesPanel = (
            <div className="ttykm-supplies">
                <h3>Reserves</h3>
                <div className="supplies-row">
                    <div className="supply-item">
                        <span className="label">White Supply:</span>
                        <span className="value">
                            <div className="supply-circle white-circle" />x {supplies.playerCopies[0]}
                        </span>
                    </div>
                    <div className="supply-item">
                        <span className="label">Black Supply:</span>
                        <span className="value">
                            <div className="supply-circle black-circle" />x {supplies.playerCopies[1]}
                        </span>
                    </div>
                    {config.growthModule && (
                        <>
                            <div className="supply-item">
                                <span className="label">Seeds:</span>
                                <span className="value">🌿 x {supplies.seeds}</span>
                            </div>
                            <div className="supply-item">
                                <span className="label">Shrubs:</span>
                                <span className="value">🌲 x {supplies.shrubs}</span>
                            </div>
                            <div className="supply-item">
                                <span className="label">Trees:</span>
                                <span className="value">🌳 x {supplies.trees}</span>
                            </div>
                        </>
                    )}
                    {config.influenceModule && (
                        <>
                            <div className="supply-item">
                                <span className="label">White Statues:</span>
                                <span className="value">🏛️ x {supplies.statues[0]}</span>
                            </div>
                            <div className="supply-item">
                                <span className="label">Black Statues:</span>
                                <span className="value">🏛️ x {supplies.statues[1]}</span>
                            </div>
                        </>
                    )}
                    {config.memoryModule && (
                        <>
                            <div className="supply-item">
                                <span className="label">White Hats:</span>
                                <span className="value">
                                    {renderHatSVG(0, 18)} x {supplies.hats[0]}
                                </span>
                            </div>
                            <div className="supply-item">
                                <span className="label">Black Hats:</span>
                                <span className="value">
                                    {renderHatSVG(1, 18)} x {supplies.hats[1]}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );

        return (
            <div className="ttykm-container">
                <div className="ttykm-header">
                    <h1>That Time You Killed Me</h1>
                    <div className="player-identity">
                        You are: <strong className={player === 0 ? 'white-tag' : 'black-tag'}>{player === 0 ? 'White Traveler' : 'Black Traveler'}</strong>
                    </div>
                </div>

                <div className={bannerClass}>
                    {bannerText}
                </div>

                <div className="ttykm-boards-row">
                    {renderBoard(0)}
                    {renderBoard(1)}
                    {renderBoard(2)}
                </div>

                {actionToolbar}
                {targetingOverlay}
                {commandOverlay}

                {suppliesPanel}

                <div className="ttykm-log">
                    <h4>📜 Chronicle Log</h4>
                    <p>{lastActionText}</p>
                </div>
            </div>
        );
    }
}
function waiting(props: TTYKMViewPropsInterface) {
    const mp = props.MP;
    const isP2P = window.location.href.includes('p2p') || window.location.href.includes('host_p2p');
    const roomId = mp.roomId || 'local';

    return (
        <div className="ttykm-waiting-container">
            <h2>That Time You Killed Me</h2>
            <div className="waiting-spinner">⏳</div>
            <h3>Waiting for opponent traveler to join...</h3>
            <div className="join-instructions">
                <p>Share this room code with player 2:</p>
                <div className="room-code">{roomId}</div>
                {isP2P ? (
                    <p className="p2p-tip">{"Ensure Player 2 connects using the 'Join P2P' screen with this exact code."}</p>
                ) : (
                    <p className="p2p-tip">Player 2 should enter this code in the join portal.</p>
                )}
            </div>
        </div>
    );
}

class TTYKMGameRules extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="ttykm-rules-tab">
                <h2>That Time You Killed Me — Rules Reference</h2>

                <section>
                    <h3>Goal</h3>
                    <p>{"Erase your opponent from history! You win if you eliminate your opponent's copies from all but one era (so they have copies on only 1 or 0 boards at the end of a turn)."}</p>
                </section>

                <section>
                    <h3>Turn Structure</h3>
                    <ol>
                        <li><strong>Choose Active Copy</strong>: Select one of your copies on the board where your focus token is located.</li>
                        <li><strong>Take 2 Actions</strong> with that copy:
                            <ul>
                                <li><strong>Move</strong>: Orthogonally (Up/Down/Left/Right). Cannot move into your own pieces, plants, statues, or elephants. Pushing opponent copies is allowed (pushed copies displace others recursively).</li>
                                <li><strong>Time Travel Forward</strong>: Move to the same space in the next era (e.g. Past → Present or Present → Future). Destination space must be empty.</li>
                                <li><strong>Time Travel Backward</strong>: Move to the same space in the previous era. Leaves a copy behind in the starting era (requires spending 1 copy from your reserve). Destination space must be empty.</li>
                            </ul>
                        </li>
                        <li><strong>Move Focus Token</strong>: Move your focus token to a different era.</li>
                    </ol>
                </section>

                <section>
                    <h3>Movement & Pushing Allowances</h3>
                    <ul>
                        <li><strong>Voluntary Off-board Move:</strong> You <strong>cannot</strong> voluntarily move off the grid.</li>
                        <li><strong>Pushing Own Pieces:</strong> You <strong>cannot</strong> move into or push your own copies. Any chain movement that contains one of your own copies is illegal.</li>
                        <li><strong>Pushing Opponent Pieces:</strong> You can move into an opponent copy to push them. This pushes the opponent copy 1 space in the direction of your move.</li>
                        <li><strong>Chain Pushing:</strong> Pushing is recursive. If you push an opponent copy into another opponent copy, both are pushed. This chain continues as long as the path is clear.</li>
                    </ul>
                </section>

                <section>
                    <h3>Pushes, Squishes & Paradoxes</h3>
                    <ul>
                        <li><strong>Squish (Elimination):</strong> If an opponent copy is pushed off the grid edge, they are squished and removed from the game. (You cannot push your own copies off the board).</li>
                        <li><strong>Paradox (Mutual Destruction):</strong> If you push an opponent copy into another opponent copy, and the target copy is blocked from moving (by a grid edge, statue, tree, shrub, or elephant), both opponent copies are eliminated in a paradox!</li>
                    </ul>
                </section>

                <section>
                    <h3>🌿 Chapter 1: Growth Module</h3>
                    <ul>
                        <li><strong>Immovable Obstacles:</strong> Shrubs 🌲 and fallen trees 🪵 are immovable. Pushing any copy (yours or opponent) into them squishes and eliminates that copy.</li>
                        <li><strong>Plant Seed:</strong> Place a seed 🌿 on your space or an adjacent space. Planting propagates a Shrub 🌲 in the next era, and a Tree 🌳 in the era after that.</li>
                        <li><strong>Remove Seed:</strong> Remove a seed. This triggers ungrowth, removing shrubs and trees in future eras.</li>
                        <li><strong>Topple Tree:</strong> Trees 🌳 cannot be pushed directly under normal moves. However, pushing a player copy into a tree will topple the tree (if the space behind it is clear), turning it into a fallen tree 🪵. The toppling tree squishes all copies and crushes seeds in its path. If the space behind is blocked, pushing into the tree simply squishes the player copy.</li>
                    </ul>
                </section>

                <section>
                    <h3>🏛️ Chapter 2: Influence Module</h3>
                    <ul>
                        <li><strong>Statues as Walls:</strong> Statues 🏛️ are immovable for players. Pushing any player copy into a statue squishes and eliminates that copy.</li>
                        <li><strong>Build Statue:</strong> Place a statue 🏛️ of your color adjacent to your copy. Statue building propagates to future eras, pushing other objects out of the way.</li>
                        <li><strong>Rebound Rules:</strong> What happens when statue propagation in a future era is blocked by an immovable obstacle (your own copy, a shrub, a tree, or another statue)?
                            <ul>
                                <li><strong>2021 Rules (Legacy Rebound):</strong> The build rebounds. The statue is instead built in the future era on the space immediately behind your copy, pushing any objects in that opposite direction. If that rebound space is also blocked or off-board, the build fails.</li>
                                <li><strong>2023 Rules (No Rebound):</strong> The build simply fails to propagate to that future era.</li>
                            </ul>
                        </li>
                        <li><strong>Pulling Statues:</strong> When moving your copy, you can voluntarily pull a statue you are adjacent to into your vacated space, propagating the statue's movement to future eras.</li>
                    </ul>
                </section>

                <section>
                    <h3>🐘 Chapter 3: Memory Module</h3>
                    <ul>
                        <li><strong>Elephants:</strong> Elephants 🐘 cannot be pushed by players. Pushing a copy into an elephant squishes that copy.</li>
                        <li><strong>Train Elephant</strong>: Train an adjacent elephant by placing a hat of your color (White hat with a blue band or Black hat with a red band) on it. Training propagates to future eras.</li>
                        <li><strong>Command Elephant:</strong> Move a trained elephant orthogonally. The elephant moves, trampling (eliminating) player copies, shrubs, and fallen trees, toppling trees, and pushing statues.</li>
                    </ul>
                </section>
            </div>
        );
    }
}

class TTYKMHostSettingsView extends React.Component<TTYKMViewPropsInterface, {}> {
    private restartGame(config?: any) {
        this.props.MP.new_game(config || this.props.config);
    }

    private toggleConfigModule(moduleKey: 'growthModule' | 'influenceModule' | 'memoryModule') {
        const newConfig = { ...this.props.config };
        newConfig[moduleKey] = !newConfig[moduleKey];
        this.restartGame(newConfig);
    }

    private setReboundRule(rule: '2023' | '2021') {
        const newConfig = { ...this.props.config };
        newConfig.reboundRule = rule;
        this.restartGame(newConfig);
    }

    public render() {
        const { config, turn, turnStep, lastActionText } = this.props;

        const isGameInitialSetup = (lastActionText === 'New game started.' && turn === 0 && turnStep === 0);

        return (
            <div className="ttykm-host-settings-container">
                <h2>🛠️ Host Controls</h2>

                <div className="restart-section">
                    <button
                        className="btn-restart-action"
                        onClick={() => this.restartGame(undefined)}
                    >
                        Restart Game
                    </button>
                </div>

                <div className="settings-divider" />

                <h3>⚙️ Game Configuration</h3>
                {isGameInitialSetup ? (
                    <div className="setup-checkboxes">
                        <label className="checkbox-container">
                            <input
                                type="checkbox"
                                checked={config.growthModule}
                                onChange={() => this.toggleConfigModule('growthModule')}
                            />
                            <span className="checkbox-label">Chapter 1: Growth Module (Plants 🌿🌳)</span>
                        </label>
                        <label className="checkbox-container">
                            <input
                                type="checkbox"
                                checked={config.influenceModule}
                                onChange={() => this.toggleConfigModule('influenceModule')}
                            />
                            <span className="checkbox-label">Chapter 2: Influence Module (Statues 🏛️)</span>
                        </label>
                        {config.influenceModule && (
                            <div className="sub-settings">
                                <span className="sub-settings-label">Statue Rebound Rule:</span>
                                <button
                                    className={`btn-sub ${config.reboundRule === '2023' ? 'active' : ''}`}
                                    onClick={() => this.setReboundRule('2023')}
                                >
                                    2023 (No Rebound)
                                </button>
                                <button
                                    className={`btn-sub ${config.reboundRule === '2021' ? 'active' : ''}`}
                                    onClick={() => this.setReboundRule('2021')}
                                >
                                    2021 (Legacy Rebound)
                                </button>
                            </div>
                        )}
                        <label className="checkbox-container">
                            <input
                                type="checkbox"
                                checked={config.memoryModule}
                                onChange={() => this.toggleConfigModule('memoryModule')}
                            />
                            <span className="checkbox-label">Chapter 3: Memory Module (Elephants 🐘)</span>
                        </label>
                        <div className="settings-sync-note">
                            Settings sync automatically in real-time.
                        </div>
                    </div>
                ) : (
                    <div className="locked-notice">
                        🔒 Game is in progress. Configuration options are locked. (To change configuration, click the Restart button above).
                    </div>
                )}
            </div>
        );
    }
}

export default TTYKMView;
