import { shuffle } from '../../common/utils';

export interface TTYKMSpace {
    player: number | null; // 0 = White, 1 = Black, null
    seed: boolean;
    shrub: boolean;
    tree: boolean;
    fallenTree: number | null; // index of space it fell from (trunk origin)
    statue: number | null; // 10 = Yellow/neutral, 0 = Player 0, 1 = Player 1
    elephant: 'dark' | 'light' | null;
    hat: number | null; // 0 = Player 0 hat, 1 = Player 1 hat
}

export function createEmptySpace(): TTYKMSpace {
    return {
        player: null,
        seed: false,
        shrub: false,
        tree: false,
        fallenTree: null,
        statue: null,
        elephant: null,
        hat: null
    };
}

export interface TTYKMConfig {
    growthModule: boolean;
    influenceModule: boolean;
    memoryModule: boolean;
    reboundRule: '2023' | '2021';
}

export class TTYKMGameState {
    public boards: TTYKMSpace[][]; // [era][space] (3 eras, 16 spaces each)
    public focusTokens: number[]; // [player] -> era index (0, 1, 2)
    public supplies: {
        playerCopies: number[]; // [player]
        statues: number[]; // [player]
        hats: number[]; // [player]
        seeds: number;
        shrubs: number;
        trees: number;
        fallenTrees: number;
    };
    public statueBuilt: boolean[]; // [player]
    public turn: number; // 0 or 1
    public turnStep: number; // 0 = Choose active copy, 1 = Take Actions, 2 = Move focus token, 3 = End Turn Check
    public activeCopySpace: number | null; // index (0-15) on focused board
    public actionsRemaining: number;
    public winner: number; // 0, 1, or -1 (playing)
    public status: 'playing' | 'gameover' | 'stalemate';
    public config: TTYKMConfig;
    public lastActionText: string;

    constructor(config?: Partial<TTYKMConfig>, skipInit: boolean = false) {
        this.config = {
            growthModule: config?.growthModule ?? true,
            influenceModule: config?.influenceModule ?? true,
            memoryModule: config?.memoryModule ?? true,
            reboundRule: config?.reboundRule ?? '2023'
        };
        if (!skipInit) {
            this.new_game();
        }
    }

    public static from_object(obj: any): TTYKMGameState {
        const state = new TTYKMGameState(obj.config, true);
        state.config = { ...obj.config };
        state.boards = obj.boards.map((board: any[]) =>
            board.map((space: any) => ({ ...space }))
        );
        state.focusTokens = [...obj.focusTokens];
        state.supplies = {
            playerCopies: [...obj.supplies.playerCopies],
            statues: [...obj.supplies.statues],
            hats: [...obj.supplies.hats],
            seeds: obj.supplies.seeds,
            shrubs: obj.supplies.shrubs,
            trees: obj.supplies.trees,
            fallenTrees: obj.supplies.fallenTrees
        };
        state.statueBuilt = [...obj.statueBuilt];
        state.turn = obj.turn;
        state.turnStep = obj.turnStep;
        state.activeCopySpace = obj.activeCopySpace;
        state.actionsRemaining = obj.actionsRemaining;
        state.winner = obj.winner;
        state.status = obj.status;
        state.lastActionText = obj.lastActionText || '';
        return state;
    }

    public new_game() {
        this.boards = Array.from({ length: 3 }, () =>
            Array.from({ length: 16 }, () => createEmptySpace())
        );

        // Starting positions: Player 0 (White) on space 1 (index 0), Player 1 (Black) on space 16 (index 15)
        for (let era = 0; era < 3; era++) {
            this.boards[era][0].player = 0;
            this.boards[era][15].player = 1;
        }

        // Setup modules if enabled
        if (this.config.influenceModule) {
            // Yellow statue on space 7 (index 6) of each era
            for (let era = 0; era < 3; era++) {
                this.boards[era][6].statue = 10;
            }
        }

        if (this.config.memoryModule) {
            // Dark elephant on space 4 (index 3) of each era
            // Light elephant on space 13 (index 12) of each era
            for (let era = 0; era < 3; era++) {
                this.boards[era][3].elephant = 'dark';
                this.boards[era][12].elephant = 'light';
            }
        }

        // Supplies
        this.supplies = {
            playerCopies: [4, 4], // 7 total, 3 pre-placed, 4 in supply
            statues: [3, 3],
            hats: [3, 3],
            seeds: 5,
            shrubs: 5,
            trees: 5,
            fallenTrees: 5
        };

        this.statueBuilt = [false, false];
        this.focusTokens = [0, 2]; // White starts on Past (0), Black on Future (2)
        this.turn = 0; // Player 0 goes first
        this.turnStep = 0; // Choose active copy
        this.activeCopySpace = null;
        this.actionsRemaining = 0;
        this.winner = -1;
        this.status = 'playing';
        this.lastActionText = 'New game started.';

        this.autoCheckForfeitStep12();
    }

    private autoCheckForfeitStep12() {
        if (this.status !== 'playing') return;
        if (this.turnStep !== 0) return;

        const era = this.focusTokens[this.turn];
        const playerCopiesSpaces: number[] = [];
        for (let s = 0; s < 16; s++) {
            if (this.boards[era][s].player === this.turn) {
                playerCopiesSpaces.push(s);
            }
        }

        if (playerCopiesSpaces.length === 0) {
            this.lastActionText = `Player ${this.turn === 0 ? 'White' : 'Black'} has no copies on their focused era. Forfeiting actions.`;
            this.turnStep = 2; // Jump to move focus
            this.activeCopySpace = null;
            this.actionsRemaining = 0;
            return;
        }

        // Check if any copy has a legal action
        let anyLegal = false;
        for (const s of playerCopiesSpaces) {
            if (this.hasAnyLegalAction(era, s)) {
                anyLegal = true;
                break;
            }
        }

        if (!anyLegal) {
            this.lastActionText = `Player ${this.turn === 0 ? 'White' : 'Black'} has no copies with legal actions on focused era. Forfeiting actions.`;
            this.turnStep = 2; // Jump to move focus
            this.activeCopySpace = null;
            this.actionsRemaining = 0;
        }
    }

    public hasAnyLegalAction(era: number, space: number): boolean {
        // Can move orthogonally?
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
        ];
        for (const dir of dirs) {
            if (this.isMoveLegal(era, space, dir)) return true;
        }

        // Time travel forward
        if (era < 2 && this.isTimeTravelLegal(era, space, true)) return true;

        // Time travel backward
        if (era > 0 && this.isTimeTravelLegal(era, space, false)) return true;

        // Growth: Plant seed
        if (this.config.growthModule && this.supplies.seeds > 0) {
            // Plant on own space
            if (this.isPlantSeedLegal(era, space, space)) return true;
            // Or adjacent spaces
            for (const dir of dirs) {
                const adj = this.getAdjacentSpace(space, dir);
                if (adj !== null && this.isPlantSeedLegal(era, space, adj)) return true;
            }
        }

        // Growth: Remove seed
        if (this.config.growthModule) {
            if (this.isRemoveSeedLegal(era, space, space)) return true;
            for (const dir of dirs) {
                const adj = this.getAdjacentSpace(space, dir);
                if (adj !== null && this.isRemoveSeedLegal(era, space, adj)) return true;
            }
        }

        // Influence: Build statue
        if (this.config.influenceModule && !this.statueBuilt[this.turn] && this.supplies.statues[this.turn] > 0) {
            for (const dir of dirs) {
                const adj = this.getAdjacentSpace(space, dir);
                if (adj !== null && this.isBuildStatueLegal(era, space, adj)) return true;
            }
        }

        // Memory: Train elephant
        if (this.config.memoryModule) {
            for (const dir of dirs) {
                const adj = this.getAdjacentSpace(space, dir);
                if (adj !== null && this.isTrainElephantLegal(era, space, adj)) return true;
            }
        }

        // Memory: Command elephant
        if (this.config.memoryModule) {
            // Player must have a trained elephant in this era
            let trainedSpace = -1;
            for (let s = 0; s < 16; s++) {
                if (this.boards[era][s].elephant && this.boards[era][s].hat === this.turn) {
                    trainedSpace = s;
                    break;
                }
            }
            if (trainedSpace !== -1) {
                for (const dir of dirs) {
                    if (this.isCommandElephantLegal(era, trainedSpace, dir)) return true;
                }
            }
        }

        return false;
    }

    public selectCopy(space: number) {
        if (this.status !== 'playing') throw new Error('Game is not in progress');
        if (this.turnStep !== 0) throw new Error('Cannot select copy in this phase');

        const era = this.focusTokens[this.turn];
        if (this.boards[era][space].player !== this.turn) {
            throw new Error('Space does not contain your copy');
        }

        if (!this.hasAnyLegalAction(era, space)) {
            throw new Error('This copy has no legal actions. Select another copy.');
        }

        this.activeCopySpace = space;
        this.actionsRemaining = 2;
        this.turnStep = 1;
        this.lastActionText = `Selected active copy on ${this.getEraName(era)} at space ${space + 1}.`;
    }

    public performAction(action: any) {
        if (this.status !== 'playing') throw new Error('Game is not in progress');
        if (this.turnStep !== 1 || this.activeCopySpace === null) {
            throw new Error('Cannot perform action in this phase');
        }

        const era = this.focusTokens[this.turn];
        const space = this.activeCopySpace;

        let actionResolved = false;

        switch (action.type) {
            case 'move': {
                const dir = action.dir;
                const pullStatueSpace = action.pullStatueSpace;
                if (!this.isMoveLegal(era, space, dir)) {
                    throw new Error('Move is illegal');
                }
                this.applyMove(era, space, dir, pullStatueSpace);
                actionResolved = true;
                break;
            }
            case 'timeTravelForward': {
                if (!this.isTimeTravelLegal(era, space, true)) {
                    throw new Error('Time travel forward is illegal');
                }
                this.applyTimeTravel(era, space, true);
                actionResolved = true;
                break;
            }
            case 'timeTravelBackward': {
                if (!this.isTimeTravelLegal(era, space, false)) {
                    throw new Error('Time travel backward is illegal');
                }
                this.applyTimeTravel(era, space, false);
                actionResolved = true;
                break;
            }
            case 'plantSeed': {
                const target = action.targetSpace;
                if (!this.isPlantSeedLegal(era, space, target)) {
                    throw new Error('Plant seed is illegal');
                }
                this.applyPlantSeed(era, target);
                actionResolved = true;
                break;
            }
            case 'removeSeed': {
                const target = action.targetSpace;
                if (!this.isRemoveSeedLegal(era, space, target)) {
                    throw new Error('Remove seed is illegal');
                }
                this.applyRemoveSeed(era, target);
                actionResolved = true;
                break;
            }
            case 'buildStatue': {
                const target = action.targetSpace;
                if (!this.isBuildStatueLegal(era, space, target)) {
                    throw new Error('Build statue is illegal');
                }
                this.applyBuildStatue(era, space, target);
                actionResolved = true;
                break;
            }
            case 'trainElephant': {
                const target = action.targetSpace;
                if (!this.isTrainElephantLegal(era, space, target)) {
                    throw new Error('Train elephant is illegal');
                }
                this.applyTrainElephant(era, target);
                actionResolved = true;
                break;
            }
            case 'commandElephant': {
                const elephantSpace = action.elephantSpace;
                const dir = action.dir;
                if (!this.isCommandElephantLegal(era, elephantSpace, dir)) {
                    throw new Error('Command elephant is illegal');
                }
                this.applyCommandElephant(era, elephantSpace, dir);
                actionResolved = true;
                break;
            }
            default:
                throw new Error('Unknown action type');
        }

        if (actionResolved) {
            this.actionsRemaining--;
            // If the active copy is no longer on the board (died in the action, e.g. command elephant trampling it, or pushing paradox, etc.)
            // Or if active copy can take no more actions and has actions left, or if actions remaining is 0:
            const newEra = this.focusTokens[this.turn];
            const activeSpace = this.activeCopySpace;
            if (activeSpace === null || this.boards[newEra][activeSpace].player !== this.turn) {
                this.activeCopySpace = null;
                this.actionsRemaining = 0;
            }

            if (this.actionsRemaining <= 0) {
                this.turnStep = 2; // Move focus token
            } else {
                // Check if the copy has any more legal actions. If not, auto forfeit second action.
                if (this.activeCopySpace !== null && !this.hasAnyLegalAction(newEra, this.activeCopySpace)) {
                    this.turnStep = 2;
                    this.lastActionText += ' (No more legal actions possible; remaining actions forfeited)';
                }
            }
        }
    }

    public skipActions() {
        if (this.status !== 'playing') throw new Error('Game is not in progress');
        if (this.turnStep !== 1) throw new Error('Cannot forfeit actions in this phase');

        this.actionsRemaining = 0;
        this.turnStep = 2;
        this.lastActionText = `Player ${this.turn === 0 ? 'White' : 'Black'} forfeited remaining actions.`;
    }

    public moveFocusToken(newEra: number) {
        if (this.status !== 'playing') throw new Error('Game is not in progress');
        if (this.turnStep !== 2) throw new Error('Cannot move focus token in this phase');

        if (newEra < 0 || newEra > 2) throw new Error('Invalid era');
        if (newEra === this.focusTokens[this.turn]) throw new Error('Focus token must move to a different era');

        const oldEra = this.focusTokens[this.turn];
        this.focusTokens[this.turn] = newEra;
        this.lastActionText = `Player ${this.turn === 0 ? 'White' : 'Black'} moved focus token from ${this.getEraName(oldEra)} to ${this.getEraName(newEra)}.`;

        this.checkWinConditions();

        if (this.status === 'playing') {
            this.turn = 1 - this.turn;
            this.turnStep = 0;
            this.activeCopySpace = null;
            this.actionsRemaining = 0;
            this.autoCheckForfeitStep12();
        }
    }

    private checkWinConditions() {
        // Active player wins if opponent has copies on ONLY ONE era (or zero eras).
        const opponent = 1 - this.turn;
        const erasWithOpponentCopies = [0, 1, 2].filter(era => {
            return this.boards[era].some(space => space.player === opponent);
        });

        if (erasWithOpponentCopies.length <= 1) {
            this.winner = this.turn;
            this.status = 'gameover';
            this.lastActionText += ` Player ${this.turn === 0 ? 'White' : 'Black'} wins! Opponent has copies on only ${erasWithOpponentCopies.length} era(s).`;
            return;
        }

        // Check stalemate: if current player's focus token is on a board and they have no legal actions
        // (Wait, we do that automatically when their turn starts).
        // Let's also check if BOTH players have no copies or it's a mutual stalemate.
        const bothStalemate = [0, 1].every(p => {
            const era = this.focusTokens[p];
            const hasCopies = this.boards[era].some(space => space.player === p);
            if (!hasCopies) return true;
            return !this.boards[era].some((space, idx) => {
                if (space.player === p) {
                    return this.hasAnyLegalAction(era, idx);
                }
                return false;
            });
        });

        if (bothStalemate) {
            this.status = 'stalemate';
            this.lastActionText += ' The game is a stalemate! Neither player can make a move.';
        }
    }

    // Coordinate helpers
    public getAdjacentSpace(space: number, dir: { dx: number, dy: number }): number | null {
        const row = Math.floor(space / 4);
        const col = space % 4;
        const targetRow = row + dir.dy;
        const targetCol = col + dir.dx;
        if (targetRow < 0 || targetRow >= 4 || targetCol < 0 || targetCol >= 4) {
            return null;
        }
        return targetRow * 4 + targetCol;
    }

    public getDirection(from: number, to: number): { dx: number, dy: number } {
        const rFrom = Math.floor(from / 4);
        const cFrom = from % 4;
        const rTo = Math.floor(to / 4);
        const cTo = to % 4;
        return { dx: cTo - cFrom, dy: rTo - rFrom };
    }

    // Rules validation
    public isMoveLegal(era: number, fromSpace: number, dir: { dx: number, dy: number }): boolean {
        const toSpace = this.getAdjacentSpace(fromSpace, dir);
        if (toSpace === null) return false;

        const target = this.boards[era][toSpace];
        const source = this.boards[era][fromSpace];

        // Cannot move to space occupied by own copy
        if (target.player === this.turn) return false;

        // Cannot move to absolute immovable obstacles
        if (target.shrub || target.fallenTree || target.elephant) return false;

        // If it's a seed, seed is passable, treated as empty
        // If target contains opponent or tree or statue, we simulate the push chain
        const tempState = TTYKMGameState.from_object(this);
        const simulated = tempState.simulatePush(era, fromSpace, dir, 'player', this.turn);
        return simulated;
    }

    public isTimeTravelLegal(era: number, space: number, forward: boolean): boolean {
        if (forward) {
            if (era >= 2) return false;
            const dest = this.boards[era + 1][space];
            // Destination must be empty (seeds are treated as empty)
            if (dest.player !== null || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
                return false;
            }
        } else {
            if (era <= 0) return false;
            // Need supply copy
            if (this.supplies.playerCopies[this.turn] <= 0) return false;
            const dest = this.boards[era - 1][space];
            if (dest.player !== null || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
                return false;
            }
        }
        return true;
    }

    public isPlantSeedLegal(era: number, space: number, target: number): boolean {
        if (!this.config.growthModule) return false;
        if (this.supplies.seeds <= 0) return false;

        // Target must be orthogonally adjacent or the active copy's space itself
        if (target !== space) {
            const dir = this.getDirection(space, target);
            if (Math.abs(dir.dx) + Math.abs(dir.dy) !== 1) return false;
        }

        // Target must not have a seed already, and must be free of obstacles (shrubs, trees, fallen trees, statues, elephants, opponent copies? Wait!)
        // "Seed: Passable. Player pieces can share space with seeds. Treated as empty... Seed counts as occupied for grow-blocking. seed-occupied space blocks statue building."
        // Can a seed be planted on a space occupied by a player? Yes.
        // Can it be planted on a space with a statue or elephant? No, statues and elephants block plants.
        const dest = this.boards[era][target];
        if (dest.seed || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
            return false;
        }

        return true;
    }

    public isRemoveSeedLegal(era: number, space: number, target: number): boolean {
        if (!this.config.growthModule) return false;

        if (target !== space) {
            const dir = this.getDirection(space, target);
            if (Math.abs(dir.dx) + Math.abs(dir.dy) !== 1) return false;
        }

        return this.boards[era][target].seed;
    }

    public isBuildStatueLegal(era: number, space: number, target: number): boolean {
        if (!this.config.influenceModule) return false;
        if (this.statueBuilt[this.turn]) return false; // Once per game total
        if (this.supplies.statues[this.turn] <= 0) return false;

        const dir = this.getDirection(space, target);
        if (Math.abs(dir.dx) + Math.abs(dir.dy) !== 1) return false;

        // Target must be empty: no players, seeds, shrubs, trees, fallen trees, statues, elephants
        // "A seed-occupied space blocks statue building"
        const dest = this.boards[era][target];
        if (dest.player !== null || dest.seed || dest.shrub || dest.tree || dest.fallenTree !== null || dest.statue !== null || dest.elephant !== null) {
            return false;
        }

        return true;
    }

    public isTrainElephantLegal(era: number, space: number, target: number): boolean {
        if (!this.config.memoryModule) return false;

        const dir = this.getDirection(space, target);
        if (Math.abs(dir.dx) + Math.abs(dir.dy) !== 1) return false;

        const dest = this.boards[era][target];
        // Target must contain an elephant and that elephant must not already wear your hat
        if (!dest.elephant) return false;
        if (dest.hat === this.turn) return false;

        // If you don't have hats in supply, but you have another hat in the same era, you can move it.
        // Let's check:
        if (this.supplies.hats[this.turn] <= 0) {
            // Find if there is another elephant in the same era with your hat
            let hasOtherHat = false;
            for (let s = 0; s < 16; s++) {
                if (s !== target && this.boards[era][s].elephant && this.boards[era][s].hat === this.turn) {
                    hasOtherHat = true;
                    break;
                }
            }
            if (!hasOtherHat) return false; // No hats in supply and no hat on the other elephant to move
        }

        return true;
    }

    public isCommandElephantLegal(era: number, elephantSpace: number, dir: { dx: number, dy: number }): boolean {
        if (!this.config.memoryModule) return false;

        const elephant = this.boards[era][elephantSpace];
        if (!elephant.elephant || elephant.hat !== this.turn) return false;

        const toSpace = this.getAdjacentSpace(elephantSpace, dir);
        if (toSpace === null) return false;

        // Elephant cannot move to a space with another elephant
        const dest = this.boards[era][toSpace];
        if (dest.elephant) return false;

        // Elephants command moves onto player (trample), seed, shrub, fallen tree (trample), tree (topple), statue (push).
        // Let's simulate the elephant move to make sure it's valid (e.g. if it pushes a statue, the statue push must be legal)
        const tempState = TTYKMGameState.from_object(this);
        const simulated = tempState.simulatePush(era, elephantSpace, dir, 'elephant', this.turn);
        return simulated;
    }

    // Applying actions
    private applyMove(era: number, space: number, dir: { dx: number, dy: number }, pullStatueSpace?: number | null) {
        const toSpace = this.getAdjacentSpace(space, dir)!;

        // Save active copy space update
        this.simulatePush(era, space, dir, 'player', this.turn);
        this.activeCopySpace = toSpace;

        let pullText = '';
        if (pullStatueSpace !== undefined && pullStatueSpace !== null) {
            // Voluntary pull: moving player choice
            const statueColor = this.boards[era][pullStatueSpace].statue!;
            // Remove from pullStatueSpace, place at space (vacated space)
            this.boards[era][pullStatueSpace].statue = null;
            this.boards[era][space].statue = statueColor;

            pullText = `, pulling statue into space ${space + 1}`;

            // Propagate statue move
            const pullDir = this.getDirection(pullStatueSpace, space);
            this.propagateStatueMove(era, statueColor, pullDir);
        }

        this.lastActionText = `Active copy moved ${this.getDirectionName(dir)} to space ${toSpace + 1}${pullText}.`;
    }

    private applyTimeTravel(era: number, space: number, forward: boolean) {
        const p = this.turn;
        this.boards[era][space].player = null;

        if (forward) {
            this.boards[era + 1][space].player = p;
            this.focusTokens[p] = era + 1;
            this.activeCopySpace = space;
            this.lastActionText = `Active copy time traveled forward to Present/Future space ${space + 1}.`;
        } else {
            this.boards[era - 1][space].player = p;
            this.focusTokens[p] = era - 1;
            this.activeCopySpace = space;
            // Place copy from supply onto vacated space
            this.boards[era][space].player = p;
            this.supplies.playerCopies[p]--;
            this.lastActionText = `Active copy time traveled backward to Past/Present space ${space + 1}, leaving a duplicate behind.`;
        }
    }

    private applyPlantSeed(era: number, target: number) {
        this.boards[era][target].seed = true;
        this.supplies.seeds--;

        let growText = '';
        // Grow propagation
        if (era < 2) {
            const nextSpace = this.boards[era + 1][target];
            // If empty (including seed-free), grow shrub
            const isEmpty = nextSpace.player === null && !nextSpace.seed && !nextSpace.shrub && !nextSpace.tree && !nextSpace.fallenTree && !nextSpace.statue && !nextSpace.elephant;
            if (isEmpty && this.supplies.shrubs > 0) {
                nextSpace.shrub = true;
                this.supplies.shrubs--;
                growText += ` -> Shrub grew on next era`;

                if (era === 0) {
                    const futSpace = this.boards[2][target];
                    const isFutEmpty = futSpace.player === null && !futSpace.seed && !futSpace.shrub && !futSpace.tree && !futSpace.fallenTree && !futSpace.statue && !futSpace.elephant;
                    if (isFutEmpty && this.supplies.trees > 0) {
                        futSpace.tree = true;
                        this.supplies.trees--;
                        growText += ` -> Tree grew on Future`;
                    }
                }
            }
        }

        this.lastActionText = `Planted seed at space ${target + 1}${growText}.`;
    }

    private applyRemoveSeed(era: number, target: number) {
        this.boards[era][target].seed = false;
        this.supplies.seeds++;

        this.triggerUngrow(era, target);
        this.lastActionText = `Removed seed from space ${target + 1}.`;
    }

    private triggerUngrow(era: number, space: number) {
        // Remove shrub in era + 1
        if (era < 2) {
            const nextSpace = this.boards[era + 1][space];
            if (nextSpace.shrub) {
                nextSpace.shrub = false;
                this.supplies.shrubs++;

                // Remove tree or matching trunk fallen tree in era + 2
                if (era === 0) {
                    const futSpace = this.boards[2][space];
                    if (futSpace.tree) {
                        futSpace.tree = false;
                        this.supplies.trees++;
                    } else if (futSpace.fallenTree === space) {
                        // Fallen tree whose trunk points to space
                        futSpace.fallenTree = null;
                        this.supplies.fallenTrees++;
                    }
                }
            }
        }
    }

    private applyBuildStatue(era: number, space: number, target: number) {
        const p = this.turn;
        this.boards[era][target].statue = p;
        this.supplies.statues[p]--;
        this.statueBuilt[p] = true;

        this.lastActionText = `Built statue at space ${target + 1}`;
        const dir = this.getDirection(space, target);

        // Propagate build
        this.propagateBuild(era, target, dir, p);
    }

    private propagateBuild(era: number, space: number, dir: { dx: number, dy: number }, color: number) {
        if (era >= 2) return;

        const nextEra = era + 1;
        const target = this.boards[nextEra][space];

        // Is it occupied?
        const isOccupied = target.player !== null || target.seed || target.shrub || target.tree || target.fallenTree !== null || target.statue !== null || target.elephant !== null;

        if (!isOccupied) {
            target.statue = color;
            this.supplies.statues[color]--;
            this.lastActionText += ` -> Statue build propagated to ${this.getEraName(nextEra)}`;
            this.propagateBuild(nextEra, space, dir, color);
        } else {
            // Treat as moving onto that space from the same direction -> push
            const tempState = TTYKMGameState.from_object(this);
            const canPush = tempState.simulatePush(nextEra, space, dir, 'statue', color, true);

            if (canPush) {
                // Apply the push on the real state
                this.simulatePush(nextEra, space, dir, 'statue', color, true);
                this.boards[nextEra][space].statue = color;
                this.supplies.statues[color]--;
                this.lastActionText += ` -> Statue build propagated to ${this.getEraName(nextEra)} (pushed objects)`;
                this.propagateBuild(nextEra, space, dir, color);
            } else {
                // Cannot place
                if (this.config.reboundRule === '2021') {
                    // Rebound: attempt opposite direction
                    const oppDir = { dx: -dir.dx, dy: -dir.dy };
                    const reboundSpace = this.getAdjacentSpace(space, oppDir);
                    if (reboundSpace !== null) {
                        const reboundTarget = this.boards[nextEra][reboundSpace];
                        const isReboundOccupied = reboundTarget.player !== null || reboundTarget.seed || reboundTarget.shrub || reboundTarget.tree || reboundTarget.fallenTree !== null || reboundTarget.statue !== null || reboundTarget.elephant !== null;

                        if (!isReboundOccupied) {
                            reboundTarget.statue = color;
                            this.supplies.statues[color]--;
                            this.lastActionText += ` -> Statue build rebounded and placed at space ${reboundSpace + 1} on ${this.getEraName(nextEra)}`;
                            this.propagateBuild(nextEra, reboundSpace, oppDir, color);
                        } else {
                            const reboundPushState = TTYKMGameState.from_object(this);
                            const canReboundPush = reboundPushState.simulatePush(nextEra, reboundSpace, oppDir, 'statue', color, true);
                            if (canReboundPush) {
                                this.simulatePush(nextEra, reboundSpace, oppDir, 'statue', color, true);
                                this.boards[nextEra][reboundSpace].statue = color;
                                this.supplies.statues[color]--;
                                this.lastActionText += ` -> Statue build rebounded and placed at space ${reboundSpace + 1} on ${this.getEraName(nextEra)} (pushed objects)`;
                                this.propagateBuild(nextEra, reboundSpace, oppDir, color);
                            } else {
                                this.lastActionText += ` -> Statue build failed to propagate to ${this.getEraName(nextEra)} (rebound blocked)`;
                            }
                        }
                    } else {
                        this.lastActionText += ` -> Statue build failed to propagate to ${this.getEraName(nextEra)} (rebound off-board)`;
                    }
                } else {
                    // 2023 rule: stops propagating
                    this.lastActionText += ` -> Statue build failed to propagate to ${this.getEraName(nextEra)} (blocked)`;
                }
            }
        }
    }

    private applyTrainElephant(era: number, target: number) {
        const p = this.turn;
        const elephantSpace = this.boards[era][target];

        // Is it wearing opponent's hat?
        const oldHat = elephantSpace.hat;
        if (oldHat !== null && oldHat !== p) {
            this.supplies.hats[oldHat]++;
            elephantSpace.hat = null;
        }

        // Do we have another hat in the same era?
        let otherHatSpace = -1;
        for (let s = 0; s < 16; s++) {
            if (s !== target && this.boards[era][s].elephant && this.boards[era][s].hat === p) {
                otherHatSpace = s;
                break;
            }
        }

        if (otherHatSpace !== -1) {
            // Move that hat to this elephant
            this.boards[era][otherHatSpace].hat = null;
            elephantSpace.hat = p;
        } else {
            // Spend hat from supply
            elephantSpace.hat = p;
            this.supplies.hats[p]--;
        }

        this.lastActionText = `Trained ${elephantSpace.elephant} elephant at space ${target + 1}`;

        // Memory training propagation
        this.propagateTraining(era, target, p);
    }

    private propagateTraining(era: number, space: number, player: number) {
        if (era >= 2) return;

        const nextEra = era + 1;
        const color = this.boards[era][space].elephant!;

        // Find elephant of same color in next era
        let nextSpaceIdx = -1;
        for (let s = 0; s < 16; s++) {
            if (this.boards[nextEra][s].elephant === color) {
                nextSpaceIdx = s;
                break;
            }
        }

        if (nextSpaceIdx !== -1) {
            const nextElephant = this.boards[nextEra][nextSpaceIdx];
            // If already wearing your hat, stop propagating
            if (nextElephant.hat === player) {
                return;
            }

            // Train logic in next era
            const oldHat = nextElephant.hat;
            if (oldHat !== null && oldHat !== player) {
                this.supplies.hats[oldHat]++;
                nextElephant.hat = null;
            }

            let otherHatSpace = -1;
            for (let s = 0; s < 16; s++) {
                if (s !== nextSpaceIdx && this.boards[nextEra][s].elephant && this.boards[nextEra][s].hat === player) {
                    otherHatSpace = s;
                    break;
                }
            }

            if (otherHatSpace !== -1) {
                this.boards[nextEra][otherHatSpace].hat = null;
                nextElephant.hat = player;
            } else {
                nextElephant.hat = player;
                this.supplies.hats[player]--;
            }

            this.lastActionText += ` -> training propagated to ${color} elephant on ${this.getEraName(nextEra)}`;

            // Propagate further
            this.propagateTraining(nextEra, nextSpaceIdx, player);
        }
    }

    private applyCommandElephant(era: number, space: number, dir: { dx: number, dy: number }) {
        const toSpace = this.getAdjacentSpace(space, dir)!;
        const color = this.boards[era][space].elephant!;
        const hat = this.boards[era][space].hat;

        this.simulatePush(era, space, dir, 'elephant', this.turn);

        this.lastActionText = `Commanded ${color} elephant to move ${this.getDirectionName(dir)} to space ${toSpace + 1}.`;
    }

    // Pushing simulation & execution
    // Returns true if push chain is legal, and modifies state if executed
    public simulatePush(era: number, startSpace: number, dir: { dx: number, dy: number }, moverType: 'player' | 'statue' | 'elephant', activePlayer: number, isEntering: boolean = false): boolean {
        // Collect line coordinates
        const spacesLine: number[] = [];
        if (isEntering) {
            spacesLine.push(-1);
        }
        spacesLine.push(startSpace);
        let curr = startSpace;
        while (true) {
            const next = this.getAdjacentSpace(curr, dir);
            if (next === null) break;
            spacesLine.push(next);
            curr = next;
        }

        // Build cell list representing 1D state
        // Each element holds details of what is on that space
        const line = spacesLine.map((s, idx) => {
            if (isEntering && idx === 0) {
                return {
                    space: -1,
                    player: moverType === 'player' ? activePlayer : null,
                    seed: false,
                    shrub: false,
                    tree: false,
                    fallenTree: null,
                    statue: moverType === 'statue' ? activePlayer : null,
                    elephant: (moverType === 'elephant' ? 'dark' : null) as 'dark' | 'light' | null,
                    hat: null
                };
            }
            const cell = this.boards[era][s];
            return {
                space: s,
                player: cell.player,
                seed: cell.seed,
                shrub: cell.shrub,
                tree: cell.tree,
                fallenTree: cell.fallenTree,
                statue: cell.statue,
                elephant: cell.elephant as 'dark' | 'light' | null,
                hat: cell.hat
            };
        });

        // Try pushing recursively in 1D
        // Returns displacement mapping: index -> targetIndex (or -1 if dies)
        const displacement = Array(line.length).fill(null); // null = doesn't move, -1 = dies/removed

        // We want to push the element at index 0 in direction +1
        // Let's implement the recursive resolver
        const canPush = (idx: number, type: 'player' | 'statue' | 'tree' | 'elephant', playerColor?: number): boolean => {
            const nextIdx = idx + 1;
            if (nextIdx >= line.length) {
                // Pushed off board
                if (type === 'player') {
                    if (idx === 0) return false; // Voluntary off-board move is illegal
                    displacement[idx] = -1; // Squish
                    return true;
                }
                return false; // Statues, trees, elephants cannot go off board
            }

            const target = line[nextIdx];

            // If target is empty
            const isEmpty = target.player === null && !target.shrub && !target.tree && target.fallenTree === null && target.statue === null && !target.elephant;
            if (isEmpty) {
                displacement[idx] = nextIdx;
                return true;
            }

            // Obstacle handling
            if (target.shrub) {
                if (type === 'player') {
                    if (idx === 0) return false; // Voluntary move onto shrub is illegal
                    displacement[idx] = -1; // Squish
                    return true;
                }
                if (type === 'elephant') {
                    // Elephant tramples shrub
                    displacement[idx] = nextIdx;
                    return true;
                }
                return false; // Statue/tree cannot move onto shrub
            }

            if (target.fallenTree !== null) {
                if (type === 'player') {
                    if (idx === 0) return false;
                    displacement[idx] = -1;
                    return true;
                }
                if (type === 'elephant') {
                    // Elephant tramples fallen tree
                    displacement[idx] = nextIdx;
                    return true;
                }
                return false;
            }

            if (target.elephant) {
                if (type === 'player') {
                    if (idx === 0) return false;
                    displacement[idx] = -1; // Trample
                    return true;
                }
                return false; // Elephant/statue/tree cannot move onto elephant
            }

            if (target.tree) {
                // Attempt to topple tree at nextIdx to nextIdx+1
                const canTopple = canPush(nextIdx, 'tree');
                if (canTopple) {
                    displacement[idx] = nextIdx;
                    return true;
                } else {
                    // Tree acts as immovable wall
                    if (type === 'player') {
                        if (idx === 0) return false;
                        displacement[idx] = -1;
                        return true;
                    }
                    return false;
                }
            }

            if (target.statue !== null) {
                // Attempt to push statue
                const statueCol = target.statue;
                const canPushStatue = canPush(nextIdx, 'statue', statueCol);
                if (canPushStatue) {
                    displacement[idx] = nextIdx;
                    return true;
                } else {
                    // Statue is immovable wall
                    if (type === 'player') {
                        if (idx === 0) return false;
                        displacement[idx] = -1;
                        return true;
                    }
                    return false;
                }
            }

            if (target.player !== null) {
                const targetPlayer = target.player;
                if (targetPlayer === activePlayer) {
                    // Cannot push own pieces
                    return false;
                } else {
                    // Attempt to push opponent copy
                    const canPushOpponent = canPush(nextIdx, 'player', targetPlayer);
                    if (canPushOpponent) {
                        displacement[idx] = nextIdx;
                        return true;
                    } else {
                        // Opponent copy cannot move.
                        // Can we trigger paradox?
                        if (type === 'player' && playerColor === opponentColor(activePlayer)) {
                            // Opponent A pushed into Opponent B, and B is blocked -> Paradox!
                            // Both A and B die
                            displacement[idx] = -1;
                            displacement[nextIdx] = -1;
                            return true;
                        }
                        if (type === 'elephant') {
                            // Elephant tramples opponent!
                            displacement[idx] = nextIdx;
                            displacement[nextIdx] = -1;
                            return true;
                        }
                        return false;
                    }
                }
            }

            return false;
        };

        const opponentColor = (p: number) => 1 - p;

        // Start recursive check
        const initMover = moverType;
        const initColor = moverType === 'player' ? activePlayer : (moverType === 'statue' ? activePlayer : undefined);

        const ok = canPush(0, initMover, initColor);
        if (!ok) return false;

        // Apply changes to the board
        // 1. Remove seeds where they get crushed:
        // A tree toppling, statue moving, or elephant moving onto a seed crushes it.
        // Let's resolve the final placement.
        // Let's write the updates to the actual board.
        // To prevent overwriting, we first clear vacated spaces, then place in target spaces.
        // We do this by creating a temp array of cells.
        const newline = line.map(c => ({
            player: null as number | null,
            seed: c.seed,
            shrub: c.shrub,
            tree: false,
            fallenTree: null as number | null,
            statue: null as number | null,
            elephant: null as 'dark' | 'light' | null,
            hat: null as number | null
        }));

        // Keep shrubs/fallen trees/elephants/seeds if they weren't displaced/trampled
        for (let i = 0; i < line.length; i++) {
            const original = line[i];
            if (original.shrub && displacement[i] === null) newline[i].shrub = true;
            if (original.fallenTree !== null && displacement[i] === null) newline[i].fallenTree = original.fallenTree;
            if (original.elephant && displacement[i] === null) {
                newline[i].elephant = original.elephant;
                newline[i].hat = original.hat;
            }
        }

        // Apply displacements
        for (let i = 0; i < line.length; i++) {
            const original = line[i];
            const dest = displacement[i];

            let typeToPlace: 'player' | 'statue' | 'tree' | 'elephant' | null = null;
            if (i === 0) {
                typeToPlace = initMover;
            } else {
                if (original.player !== null && displacement[i] !== null) typeToPlace = 'player';
                if (original.statue !== null && displacement[i] !== null) typeToPlace = 'statue';
                if (original.tree && displacement[i] !== null) typeToPlace = 'tree';
                if (original.elephant && displacement[i] !== null) typeToPlace = 'elephant';
            }

            if (typeToPlace === null || dest === null) {
                // If it didn't move, keep it where it was
                if (i !== 0 || !isEntering) {
                    if (original.player !== null && displacement[i] === null) newline[i].player = original.player;
                    if (original.statue !== null && displacement[i] === null) newline[i].statue = original.statue;
                    if (original.tree && displacement[i] === null) newline[i].tree = true;
                }
                continue;
            }

            if (dest === -1) {
                // Dies/removed
                continue;
            }

            // Place at dest
            const targetSpaceIdx = spacesLine[dest];
            const sourceSpaceIdx = spacesLine[i];

            if (typeToPlace === 'player') {
                const col = i === 0 ? initColor! : original.player!;
                newline[dest].player = col;
            } else if (typeToPlace === 'statue') {
                const col = i === 0 ? initColor! : original.statue!;
                newline[dest].statue = col;

                // Propagate statue move if it was pushed
                if (i > 0) {
                    this.propagateStatueMove(era, col, dir);
                }
            } else if (typeToPlace === 'tree') {
                // Becomes a fallen tree!
                newline[dest].fallenTree = sourceSpaceIdx;
                this.supplies.trees++;
                this.supplies.fallenTrees--;
            } else if (typeToPlace === 'elephant') {
                const col = i === 0 ? (isEntering ? 'dark' : this.boards[era][sourceSpaceIdx].elephant!) : original.elephant!;
                const hat = i === 0 ? (isEntering ? null : this.boards[era][sourceSpaceIdx].hat!) : original.hat!;
                newline[dest].elephant = col;
                newline[dest].hat = hat;
            }
        }

        // Crushing seeds and trample removes:
        for (let i = 0; i < line.length; i++) {
            const nl = newline[i];
            // If tree, statue, or elephant entered a seed space, return seed to supply
            if (spacesLine[i] !== -1 && nl.seed && (nl.tree || nl.fallenTree !== null || nl.statue !== null || nl.elephant)) {
                nl.seed = false;
                this.supplies.seeds++;
                this.triggerUngrow(era, spacesLine[i]);
            }
        }

        // Update real board
        for (let i = 0; i < line.length; i++) {
            const spaceIdx = spacesLine[i];
            if (spaceIdx === -1) continue;
            this.boards[era][spaceIdx] = {
                player: newline[i].player,
                seed: newline[i].seed,
                shrub: newline[i].shrub,
                tree: newline[i].tree,
                fallenTree: newline[i].fallenTree,
                statue: newline[i].statue,
                elephant: newline[i].elephant,
                hat: newline[i].hat
            };
        }

        return true;
    }

    private propagateStatueMove(era: number, color: number, dir: { dx: number, dy: number }) {
        if (era >= 2) return;

        const nextEra = era + 1;
        // Find statue of same color in next era
        let idx = -1;
        for (let s = 0; s < 16; s++) {
            if (this.boards[nextEra][s].statue === color) {
                idx = s;
                break;
            }
        }

        if (idx !== -1) {
            const tempState = TTYKMGameState.from_object(this);
            const canPropagate = tempState.simulatePush(nextEra, idx, dir, 'statue', color);
            if (canPropagate) {
                this.simulatePush(nextEra, idx, dir, 'statue', color);
                this.lastActionText += ` -> Statue move propagated to ${this.getEraName(nextEra)}`;
                this.propagateStatueMove(nextEra, color, dir);
            } else {
                this.lastActionText += ` -> Statue move propagation blocked on ${this.getEraName(nextEra)}`;
            }
        }
    }

    // String formatting utilities
    public getEraName(era: number): string {
        if (era === 0) return 'Past';
        if (era === 1) return 'Present';
        return 'Future';
    }

    public getDirectionName(dir: { dx: number, dy: number }): string {
        if (dir.dx === 0 && dir.dy === -1) return 'Up';
        if (dir.dx === 0 && dir.dy === 1) return 'Down';
        if (dir.dx === -1 && dir.dy === 0) return 'Left';
        return 'Right';
    }

    public getDirectionNameLower(dir: { dx: number, dy: number }): string {
        return this.getDirectionName(dir).toLowerCase();
    }
}
