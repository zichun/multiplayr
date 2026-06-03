/**
 * CleverGameState.ts - Standalone game state management for Clever
 */

import { shuffle } from '../../common/utils';

export enum GameStatus {
    RoundStartBonus = 'RoundStartBonus',
    ActiveRolling = 'ActiveRolling',
    ActiveChoosing = 'ActiveChoosing',
    PassiveChoosing = 'PassiveChoosing',
    TurnEnd = 'TurnEnd',
    GameOver = 'GameOver'
}

export type DieColor = 'white' | 'yellow' | 'blue' | 'green' | 'orange' | 'purple';

export interface Die {
    color: DieColor;
    value: number;
}

export interface PendingBonus {
    type: 'yellow_X' | 'blue_X' | 'green_X' | 'orange_num' | 'purple_num' | 'choice_X_6';
    value?: number; // pre-determined value like 4, 5, or 6
}

export interface PlayerState {
    id: string;
    yellow: boolean[][]; // 4x4 grid of marked cells
    blue: boolean[]; // 11-cell array for sums 2-12
    green: number; // progressive count of marked green cells (0-11)
    orange: (number | null)[]; // 11 cells
    purple: (number | null)[]; // 11 cells
    rerollsTotal: number;
    rerollsUsed: number;
    extraDiceTotal: number;
    extraDiceUsed: number;
    foxesTotal: number;
    bonusesToResolve: PendingBonus[];
    // Track already used dice in Extra Die actions this turn
    extraDicePickedThisTurn: DieColor[];
    hasConfirmedPassiveSelection: boolean;
    draftPassiveLog: string;
}

export interface GameStateData {
    status: GameStatus;
    round: number;
    totalRounds: number;
    playerIds: string[];
    activePlayerIndex: number;
    rollCount: number; // 0 to 3
    activePickedDice: Die[]; // up to 3 dice
    poolDice: Die[]; // remaining dice to roll
    trayDice: Die[]; // dice on silver tray
    rolledDice: Die[]; // dice in the current roll pool
    isSolo: boolean;
    soloPassiveTurn: boolean; // simulated passive turn in Solo Mode
    players: { [playerId: string]: PlayerState };
    gameLogs: string[];
    passiveStartPlayerStates?: { [playerId: string]: PlayerState };
}

// Blue area values mapping: sums 2 to 12
export const BLUE_SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Blue scoring scale: index is (count - 1)
export const BLUE_POINTS = [1, 2, 4, 7, 11, 16, 22, 29, 37, 46, 56];

// Green progressive values requirements
export const GREEN_MINIMUMS = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6];

// Green scoring progressive scale: index is (count - 1)
export const GREEN_POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];

// Orange multipliers: 0-indexed cell index
export const ORANGE_MULTIPLIERS: { [index: number]: number } = {
    3: 2, // cell 4 (x2)
    6: 2, // cell 7 (x2)
    8: 2, // cell 9 (x2)
    10: 3 // cell 11 (x3)
};

export class CleverGameState {
    private data: GameStateData;

    constructor(playerIds: string[]) {
        const isSolo = playerIds.length === 1;
        const totalRounds = playerIds.length === 4 ? 4 : playerIds.length === 3 ? 5 : 6;

        this.data = {
            status: GameStatus.RoundStartBonus,
            round: 1,
            totalRounds,
            playerIds: [...playerIds],
            activePlayerIndex: 0,
            rollCount: 0,
            activePickedDice: [],
            poolDice: [],
            trayDice: [],
            rolledDice: [],
            isSolo,
            soloPassiveTurn: false,
            players: {},
            gameLogs: []
        };

        // Initialize players
        for (const id of playerIds) {
            this.data.players[id] = this.create_empty_player(id);
        }

        this.data.gameLogs.push('Game initialized. Press Start to begin!');
    }

    private create_empty_player(id: string): PlayerState {
        // Yellow 4x4 grid: opposite diagonal is pre-marked (already true)
        const yellowGrid = [
            [false, false, false, true],  // Row 1: 3, 6, 5, X (pre-marked)
            [false, false, true, false],  // Row 2: 2, 1, X (pre-marked), 5
            [false, true, false, false],  // Row 3: 1, X (pre-marked), 2, 4
            [true, false, false, false]   // Row 4: X (pre-marked), 3, 4, 6
        ];

        return {
            id,
            yellow: yellowGrid,
            blue: Array(11).fill(false), // sum index: sum - 2
            green: 0,
            orange: Array(11).fill(null),
            purple: Array(11).fill(null),
            rerollsTotal: 0,
            rerollsUsed: 0,
            extraDiceTotal: 0,
            extraDiceUsed: 0,
            foxesTotal: 0,
            bonusesToResolve: [],
            extraDicePickedThisTurn: [],
            hasConfirmedPassiveSelection: false,
            draftPassiveLog: ''
        };
    }

    public static from_data(data: GameStateData): CleverGameState {
        const gameState = new CleverGameState(data.playerIds);
        gameState.data = { ...data };
        return gameState;
    }

    public get_data(): GameStateData {
        return { ...this.data };
    }

    public start_game(): void {
        this.data.round = 1;
        this.data.activePlayerIndex = 0;
        this.data.gameLogs = [];
        this.data.gameLogs.push('=== Game Started! ===');

        // Reset players
        for (const id of this.data.playerIds) {
            this.data.players[id] = this.create_empty_player(id);
        }

        this.trigger_round_start();
    }

    private trigger_round_start(): void {
        this.data.gameLogs.push(`--- Round ${this.data.round} Starts ---`);

        // Rounds 1-4 grant automatic tracker bonuses to ALL players
        if (this.data.round === 1) {
            // All players get 1 Reroll
            for (const id of this.data.playerIds) {
                const player = this.data.players[id];
                player.rerollsTotal++;
                this.data.gameLogs.push(`${id} received a free Reroll as Round 1 start bonus.`);
            }
            this.start_active_turn();
        } else if (this.data.round === 2) {
            // All players get 1 Extra Die
            for (const id of this.data.playerIds) {
                const player = this.data.players[id];
                player.extraDiceTotal++;
                this.data.gameLogs.push(`${id} received a free Extra Die (+1) as Round 2 start bonus.`);
            }
            this.start_active_turn();
        } else if (this.data.round === 3) {
            // All players get 1 Reroll
            for (const id of this.data.playerIds) {
                const player = this.data.players[id];
                player.rerollsTotal++;
                this.data.gameLogs.push(`${id} received a free Reroll as Round 3 start bonus.`);
            }
            this.start_active_turn();
        } else if (this.data.round === 4) {
            // All players must choose ONE of two options: an X-bonus or a 6-bonus
            this.data.status = GameStatus.RoundStartBonus;
            for (const id of this.data.playerIds) {
                const player = this.data.players[id];
                player.bonusesToResolve.push({ type: 'choice_X_6' });
            }
            this.data.gameLogs.push('Round 4: All players must choose one round-start bonus: one X-bonus (Yellow, Blue, or Green) OR a 6-bonus (Orange or Purple).');
            this.check_bonus_resolution_phase();
        } else {
            // Round 5-6 (only applicable for 1-3 or 1-2 players) have no round-start bonuses
            this.start_active_turn();
        }
    }

    public choose_round_start_bonus(playerId: string, choice: 'X' | '6'): void {
        if (this.data.status !== GameStatus.RoundStartBonus) {
            throw new Error('Not in Round Start Bonus phase');
        }

        const player = this.data.players[playerId];
        const bonusIndex = player.bonusesToResolve.findIndex(b => b.type === 'choice_X_6');
        if (bonusIndex === -1) {
            throw new Error('No pending round start bonus choice for this player');
        }

        // Remove the choice bonus
        player.bonusesToResolve.splice(bonusIndex, 1);

        if (choice === 'X') {
            // Player chose X-bonus (usable for yellow, blue, or green)
            player.bonusesToResolve.push({ type: 'choice_X_6' }); // Wait! Let's push a specific choice helper
            // Actually, let's push a direct X-bonus option where they can select Yellow, Blue or Green.
            // Let's model a choice bonus as choice of yellow_X, blue_X, or green_X. Let's just push a specific X resolution bonus:
            // Since they chose X, let's let them select yellow, blue or green.
            // We can handle this by immediately pushing a choice between yellow_X, blue_X, green_X.
            // To simplify, let's represent this by adding three optional pending bonuses, or just one generic 'yellow_X' | 'blue_X' | 'green_X' which we let them click.
            // Let's push a custom pending bonus type: 'yellow_X' | 'blue_X' | 'green_X'
            // Wait, let's push an 'X' bonus that allows yellow, blue, or green. Let's implement it by letting them choose yellow_X, blue_X or green_X immediately!
            // Let's just push a dummy bonus that our view will recognize as "Round 4 X-Bonus Choice".
            // Or easier, let's push yellow_X or blue_X or green_X directly? No, the player will choose which color they want.
            // So we can let them do that. Let's push a bonus of type 'yellow_X' | 'blue_X' | 'green_X'. Let's add them to the queue!
            // To represent a choice X, let's let them choose yellow_X, blue_X, or green_X.
            // When they click 'X', we can just let the view ask them which area they want, and then trigger a resolve_bonus for that area!
            // That is perfect! We don't even need a separate state, we can just push a pending bonus of type: 'yellow_X' | 'blue_X' | 'green_X'!
            // Let's push a pending bonus with a list or just push a specific X choice.
            // Let's call it a choice X-bonus. Let's define a dummy pending bonus in the queue:
            player.bonusesToResolve.push({ type: 'yellow_X' }); // Let's just push a temporary yellow_X and let them choose where to mark? No, let's let them mark Yellow, Blue, or Green.
            // Let's push a wildcard X bonus: we can model it as a pending bonus of type 'yellow_X' (and let them click Yellow, Blue, or Green? No, let's represent the X choice in the view by checking if the bonus is a wildcard).
            // Let's create a pending bonus type 'yellow_X' but we can also allow blue_X or green_X.
            // Better yet, let's let them choose in the methods, e.g. `selectRound4XBonus(color)` which resolves the choice bonus and pushes the selected color bonus!
            // Yes! That's much cleaner:
            // 1. Player calls choose_round_start_bonus(playerId, 'X') -> pushes wildcard 'yellow_X' | 'blue_X' | 'green_X'.
            // Actually, let's just let the method choose_round_start_bonus push a specific pending bonus:
            // If they chose 'X', we push a wildcard bonus. Let's add `wildcard_X` or let's push three options? No, let's just push `yellow_X` | `blue_X` | `green_X` wildcard:
            // Let's add a type to PendingBonus: `type: 'yellow_X' | 'blue_X' | 'green_X' | ...`
            // Let's add `type: 'choice_X_6'` as a pending bonus. When they resolve it, they choose between:
            // Option A: X-Bonus (Yellow, Blue, Green)
            // Option B: 6-Bonus (Orange, Purple)
            // When they choose Option A: we replace 'choice_X_6' in their queue with a wildcard X.
            // When they choose Option B: we replace 'choice_X_6' in their queue with a wildcard 6.
            // Let's implement this! That is extremely elegant and handles the choice sequentially!
        } else {
            // Player chose 6-bonus (usable in orange or purple row)
            // We'll let them record a 6 in either Orange or Purple.
            // Let's push a pending bonus of type 'orange_num' or 'purple_num' with value 6!
            // Actually, we can let them select which row to write it in.
        }

        this.data.gameLogs.push(`${playerId} selected option ${choice} for their Round 4 start bonus.`);
        this.check_bonus_resolution_phase();
    }

    public select_round4_option(playerId: string, option: 'X' | '6'): void {
        const player = this.data.players[playerId];
        const idx = player.bonusesToResolve.findIndex(b => b.type === 'choice_X_6');
        if (idx === -1) {
            throw new Error('No choice_X_6 bonus pending');
        }

        player.bonusesToResolve.splice(idx, 1); // remove the choice

        if (option === 'X') {
            // Pushes an X bonus. Since they can mark yellow, blue or green, let's let them choose.
            // To make it simple, let's push a special bonus: we can push a wildcard X that lets them select yellow, blue, or green.
            // Let's model a wildcard X by pushing a bonus of type 'yellow_X' and we will let them mark yellow, blue, or green in the view!
            // Actually, let's push a specific bonus: we can let them click Yellow, Blue, or Green cells directly!
            // Let's represent this by pushing a wildcard pending bonus: `{ type: 'yellow_X' | 'blue_X' | 'green_X' }`.
            // Wait, we can just push a bonus `{ type: 'yellow_X' }` but in the UI let them choose between Yellow, Blue, Green.
            // Or let's define a new PendingBonus type: `type: 'choice_yellow_blue_green_X'`.
            // Let's do that! It is 100% clear.
            player.bonusesToResolve.push({ type: 'yellow_X' }); // Let's just push 'yellow_X' for Yellow, or let the player choose.
            // Wait, let's define the PendingBonus types:
            // - `yellow_X`: mark one box in yellow
            // - `blue_X`: mark one box in blue
            // - `green_X`: mark next green sequential cell
            // - `orange_num`: write a number in orange (with value)
            // - `purple_num`: write a number in purple (with value)
            // If they choose X, let's let them select which color (Yellow, Blue, Green) and immediately resolve it.
            // To do this, let's push a pending bonus: `type: 'yellow_X'` (and if they want blue or green, we can let them pick).
            // Actually, let's define a new wildcard bonus type: `type: 'yellow_X'` but let's let the player choose the color!
            // Let's just define a specific wildcard bonus in their queue: `type: 'choice_X_6'` is already handled.
            // Let's let them select:
            // - If they choose X, we push a pending bonus of type: 'yellow_X' (for Yellow), 'blue_X' (for Blue), or 'green_X' (for Green) depending on what they click.
            // Yes! When they resolve the 'choice_X_6' in the UI: they can click a button "I want Yellow X" -> pushes 'yellow_X' to their queue.
            // "I want Blue X" -> pushes 'blue_X' to queue.
            // "I want Green X" -> pushes 'green_X' to queue.
            // "I want Orange 6" -> pushes 'orange_num' with value 6 to queue.
            // "I want Purple 6" -> pushes 'purple_num' with value 6 to queue.
            // This is brilliant! It decomposes the choice into a standard single-color bonus immediately!
            // So they click the option on their screen, and it pushes the exact single-color bonus, which they then mark on their sheet!
            // This is incredibly clean and intuitive!
        }
    }

    public push_round4_choice_result(playerId: string, bonusType: 'yellow_X' | 'blue_X' | 'green_X' | 'orange_num' | 'purple_num'): void {
        const player = this.data.players[playerId];
        const idx = player.bonusesToResolve.findIndex(b => b.type === 'choice_X_6');
        if (idx === -1) {
            throw new Error('No choice_X_6 bonus pending');
        }

        player.bonusesToResolve.splice(idx, 1); // remove the choice card

        if (bonusType === 'orange_num') {
            player.bonusesToResolve.push({ type: 'orange_num', value: 6 });
        } else if (bonusType === 'purple_num') {
            player.bonusesToResolve.push({ type: 'purple_num', value: 6 });
        } else {
            player.bonusesToResolve.push({ type: bonusType });
        }

        this.data.gameLogs.push(`${playerId} chose to resolve their Round 4 start bonus as a ${bonusType}.`);
        this.check_bonus_resolution_phase();
    }

    private check_bonus_resolution_phase(): void {
        // Check if ANY player still has pending bonuses to resolve during the RoundStartBonus phase
        let anyPending = false;
        for (const id of this.data.playerIds) {
            const player = this.data.players[id];
            if (player.bonusesToResolve.length > 0) {
                anyPending = true;
                break;
            }
        }

        if (this.data.status === GameStatus.RoundStartBonus && !anyPending) {
            this.start_active_turn();
        }
    }

    private start_active_turn(): void {
        // Reset turn parameters
        this.data.rollCount = 0;
        this.data.activePickedDice = [];
        this.data.trayDice = [];
        this.data.rolledDice = [];
        this.data.soloPassiveTurn = false;

        // Reset the extra dice picked list for all players
        for (const id of this.data.playerIds) {
            this.data.players[id].extraDicePickedThisTurn = [];
            this.data.players[id].hasConfirmedPassiveSelection = false;
            this.data.players[id].draftPassiveLog = '';
        }

        // Set up the full pool of 6 dice
        const colors: DieColor[] = ['white', 'yellow', 'blue', 'green', 'orange', 'purple'];
        this.data.poolDice = colors.map(color => ({ color, value: 1 }));

        const activePlayerId = this.data.playerIds[this.data.activePlayerIndex];
        this.data.status = GameStatus.ActiveRolling;
        this.data.gameLogs.push(`It is ${activePlayerId}'s turn as Active Player!`);

        if (this.data.isSolo) {
            this.data.gameLogs.push('Solo player rolls all 6 dice.');
        }
    }

    private validate_active_player(playerId: string): void {
        const expectedPlayerId = this.data.playerIds[this.data.activePlayerIndex];
        if (playerId !== expectedPlayerId) {
            throw new Error(`It is not ${playerId}'s turn (Current active: ${expectedPlayerId})`);
        }
    }

    public roll_active_dice(playerId: string): void {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.ActiveRolling) {
            throw new Error('Not in rolling phase');
        }
        if (this.data.rollCount >= 3) {
            throw new Error('Already rolled 3 times');
        }
        if (this.data.poolDice.length === 0) {
            throw new Error('No dice left to roll');
        }

        // Increment roll count
        this.data.rollCount++;

        // Roll all pool dice
        const rolled: Die[] = this.data.poolDice.map(d => ({
            color: d.color,
            value: Math.floor(Math.random() * 6) + 1
        }));

        this.data.rolledDice = rolled;
        this.data.status = GameStatus.ActiveChoosing;

        const diceStr = rolled.map(d => `${d.color}:${d.value}`).join(', ');
        this.data.gameLogs.push(`${playerId} rolled: [${diceStr}] (Roll #${this.data.rollCount}/3)`);
    }

    public reroll_active_dice(playerId: string): void {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.ActiveChoosing) {
            throw new Error('Must roll before you can reroll');
        }

        const player = this.data.players[playerId];
        const rerollsAvailable = player.rerollsTotal - player.rerollsUsed;
        if (rerollsAvailable <= 0) {
            throw new Error('No Rerolls available');
        }

        // Spend Reroll
        player.rerollsUsed++;

        // Reroll all currently available pool dice
        const rolled: Die[] = this.data.poolDice.map(d => ({
            color: d.color,
            value: Math.floor(Math.random() * 6) + 1
        }));

        this.data.rolledDice = rolled;
        this.data.status = GameStatus.ActiveChoosing;

        const diceStr = rolled.map(d => `${d.color}:${d.value}`).join(', ');
        this.data.gameLogs.push(`${playerId} spent a Reroll! New roll: [${diceStr}]`);
    }

    public pick_active_die(playerId: string, color: DieColor, option?: any): void {
        this.validate_active_player(playerId);
        if (this.data.status !== GameStatus.ActiveChoosing) {
            throw new Error('Not in choosing phase');
        }

        const dieIndex = this.data.rolledDice.findIndex(d => d.color === color);
        if (dieIndex === -1) {
            throw new Error(`Die color ${color} is not in the rolled pool`);
        }

        const chosenDie = this.data.rolledDice[dieIndex];

        // 1. Validate if we can legally record this die in our sheet (e.g. check green minimums or purple strictly increasing)
        // Note: White die can act as any color. If they choose White, they must specify which color track they want to use it for (option).
        const targetColor = color === 'white'
            ? (typeof option === 'string' ? option : (option && option.targetColor))
            : color;
        if (!targetColor) {
            throw new Error('Must specify target color track when picking the White die');
        }

        let yellowCoords: { r: number, c: number } | undefined = undefined;
        if (targetColor === 'yellow' && option && typeof option === 'object') {
            if (typeof option.r === 'number' && typeof option.c === 'number') {
                yellowCoords = { r: option.r, c: option.c };
            }
        }

        // Validate legality of choice
        const isLegal = this.is_die_choice_legal(playerId, chosenDie.value, targetColor, color === 'white', yellowCoords);
        if (!isLegal) {
            // Check edge case: is it unusable?
            // "Edge case - unusable die on a roll: If the active player's only remaining die cannot legally be recorded...
            // that roll counts as used anyway, and the player records nothing for it. The die goes to the tray."
            // Wait, if there are other dice in the roll pool that ARE legal, they cannot pick an illegal one!
            // Let's check if there are ANY legal dice in the rolled pool.
            const hasAnyLegal = this.has_any_legal_die_in_pool(playerId, this.data.rolledDice);
            if (hasAnyLegal) {
                throw new Error(`Selected die/color is illegal, and you have other legal dice available to pick.`);
            }

            // No legal moves at all! They are forced to pick an unusable die.
            // The die goes to the tray, and they get nothing.
            this.data.gameLogs.push(`${playerId} was forced to pick an unusable die (${color}:${chosenDie.value}). Nothing is recorded.`);
        } else {
            // Complete the mark!
            this.record_die_value(playerId, chosenDie.value, targetColor, color === 'white', yellowCoords);
            this.data.gameLogs.push(`${playerId} picked die ${color}:${chosenDie.value} and marked it in the ${targetColor} area.`);
        }

        // 2. Add picked die to sheet fields
        this.data.activePickedDice.push(chosenDie);

        // 3. Move all dice showing a value STRICTLY LOWER than the chosen die onto the silver tray
        const lowerDice = this.data.rolledDice.filter(d => d.color !== color && d.value < chosenDie.value);
        for (const d of lowerDice) {
            // Move to tray (if not already there)
            if (!this.data.trayDice.some(td => td.color === d.color)) {
                this.data.trayDice.push(d);
                this.data.gameLogs.push(`Die ${d.color}:${d.value} is strictly lower than chosen ${color}:${chosenDie.value} and goes to the Silver Tray.`);
            }
        }

        // 4. Update the pool of available dice for next roll
        // Dice that were chosen or are on the silver tray are no longer available in the pool
        this.data.poolDice = this.data.poolDice.filter(d =>
            d.color !== color && !this.data.trayDice.some(td => td.color === d.color)
        );

        // 5. Determine next phase
        this.check_active_roll_cycle();
    }

    private check_active_roll_cycle(): void {
        const activePlayerId = this.data.playerIds[this.data.activePlayerIndex];

        // Did we finish 3 rolls or run out of dice to roll?
        const finishedThreePicks = this.data.activePickedDice.length >= 3;
        const noDiceLeft = this.data.poolDice.length === 0;

        if (finishedThreePicks || noDiceLeft) {
            if (noDiceLeft && !finishedThreePicks) {
                this.data.gameLogs.push(`No dice left to roll. Active turn ends early with ${this.data.activePickedDice.length} picks.`);
            }

            // Put ALL remaining unselected dice in the roll pool onto the silver tray
            for (const d of this.data.poolDice) {
                if (!this.data.trayDice.some(td => td.color === d.color)) {
                    this.data.trayDice.push(d);
                }
            }
            this.data.poolDice = [];
            this.data.rolledDice = [];

            this.data.gameLogs.push(`Silver tray now holds: [${this.data.trayDice.map(d => `${d.color}:${d.value}`).join(', ')}]`);

            // Transition to Passive turn
            if (this.data.isSolo) {
                // Solo Mode Passive turn simulation
                this.data.soloPassiveTurn = true;
                this.data.status = GameStatus.PassiveChoosing;

                // Solo simulated passive turn setup:
                // Roll all 6 dice
                const rolled: Die[] = ['white', 'yellow', 'blue', 'green', 'orange', 'purple'].map(color => ({
                    color: color as DieColor,
                    value: Math.floor(Math.random() * 6) + 1
                }));

                // Simulation: places the 3 lowest-value dice on the silver tray
                // Sort by value (ascending), then break ties using priority: white -> yellow -> blue -> green -> orange -> purple
                const colorPriority: DieColor[] = ['white', 'yellow', 'blue', 'green', 'orange', 'purple'];
                rolled.sort((a, b) => {
                    if (a.value !== b.value) {
                        return a.value - b.value;
                    }
                    return colorPriority.indexOf(a.color) - colorPriority.indexOf(b.color);
                });

                this.data.trayDice = [rolled[0], rolled[1], rolled[2]];
                this.data.activePickedDice = [rolled[3], rolled[4], rolled[5]]; // The rest simulate active dice fields
                this.data.gameLogs.push('--- Solo Mode Passive Turn Simulation ---');
                this.data.gameLogs.push(`Rolled 6 dice: [${rolled.map(d => `${d.color}:${d.value}`).join(', ')}]`);
                this.data.gameLogs.push(`The 3 lowest-value dice go to the Silver Tray: [${this.data.trayDice.map(d => `${d.color}:${d.value}`).join(', ')}]`);

                // Capture starting player state snapshot for solo player
                this.data.passiveStartPlayerStates = {};
                const aliceId = this.data.playerIds[0];
                this.data.passiveStartPlayerStates[aliceId] = JSON.parse(JSON.stringify(this.data.players[aliceId]));
            } else {
                // Multiplayer: all OTHER players are passive players
                this.data.status = GameStatus.PassiveChoosing;
                this.data.gameLogs.push('All passive players may now select one die from the Silver Tray simultaneously.');

                // Capture starting player states snapshot for all players
                this.data.passiveStartPlayerStates = {};
                for (const id of this.data.playerIds) {
                    this.data.passiveStartPlayerStates[id] = JSON.parse(JSON.stringify(this.data.players[id]));
                }
            }
        } else {
            // Can roll again
            this.data.status = GameStatus.ActiveRolling;
        }
    }

    public pick_passive_die(playerId: string, color: DieColor, option?: any): void {
        if (this.data.status !== GameStatus.PassiveChoosing) {
            console.warn(`pick_passive_die: Not in Passive Choosing phase (current: ${this.data.status}), proceeding anyway for synchronization.`);
        }

        let player = this.data.players[playerId];

        // Passive player cannot be the active player in multiplayer!
        if (!this.data.isSolo && playerId === this.data.playerIds[this.data.activePlayerIndex]) {
            throw new Error('Active player cannot pick a passive die');
        }

        // Did they already make their main selection?
        // Let's check if they have already picked a tray die.
        // We can track this by checking player.extraDicePickedThisTurn vs their action use.
        // Distinguish between their "free" passive choice and "Extra Die (+1)" actions.
        const hasPickedFree = player.extraDicePickedThisTurn.includes('white' as any); // dummy check
        
        if (player.hasConfirmedPassiveSelection) {
            throw new Error('Already confirmed your passive selection.');
        }

        // If they already picked a die but haven't confirmed yet, they are changing their selection!
        if (player.extraDicePickedThisTurn.length > 0) {
            const snapshot = this.data.passiveStartPlayerStates?.[playerId];
            if (snapshot) {
                // Restore their player state completely from the start-of-passive snapshot!
                this.data.players[playerId] = JSON.parse(JSON.stringify(snapshot));
                player = this.data.players[playerId]; // Re-bind local reference!
            }
        }

        // Verify die source:
        // Passive players select from the silver tray.
        // Special case: If a passive player cannot legally use any die on the silver tray, they may instead pick any one die from the active player's three dice fields.
        let sourceArray = this.data.trayDice;
        let pickedFromTray = true;

        const dieOnTray = this.data.trayDice.find(d => d.color === color);
        if (!dieOnTray) {
            // Not on tray. Is it on active fields?
            const dieOnActive = this.data.activePickedDice.find(d => d.color === color);
            if (!dieOnActive) {
                throw new Error(`Die color ${color} is not available on the tray or active fields`);
            }

            // They are attempting to pick from active fields.
            // This is ONLY legal if they have NO legal moves on the tray!
            const hasTrayMoves = this.has_any_legal_die_in_pool(playerId, this.data.trayDice);
            if (hasTrayMoves) {
                throw new Error('Cannot pick from active player fields if you have a legal move available on the Silver Tray');
            }

            sourceArray = this.data.activePickedDice;
            pickedFromTray = false;
        }

        const chosenDie = sourceArray.find(d => d.color === color)!;
        const targetColor = color === 'white'
            ? (typeof option === 'string' ? option : (option && option.targetColor))
            : color;
        if (!targetColor) {
            throw new Error('Must specify target color track when picking the White die');
        }

        let yellowCoords: { r: number, c: number } | undefined = undefined;
        if (targetColor === 'yellow' && option && typeof option === 'object') {
            if (typeof option.r === 'number' && typeof option.c === 'number') {
                yellowCoords = { r: option.r, c: option.c };
            }
        }

        const isLegal = this.is_die_choice_legal(playerId, chosenDie.value, targetColor, color === 'white', yellowCoords);
        if (!isLegal) {
            // Verify if there are ANY legal dice in the tray (or active fields if tray was empty/illegal)
            const hasAnyLegal = this.has_any_legal_die_in_pool(playerId, sourceArray);
            if (hasAnyLegal) {
                throw new Error('Selected die/color is illegal, and you have other legal options available.');
            }

            // No legal moves anywhere! Forced pick of unusable die.
            player.draftPassiveLog = `${playerId} (passive) had no legal moves and selected unusable die ${color}:${chosenDie.value}. Nothing is recorded.`;
        } else {
            this.record_die_value(playerId, chosenDie.value, targetColor, color === 'white', yellowCoords);
            player.draftPassiveLog = `${playerId} (passive) picked die ${color}:${chosenDie.value} from ${pickedFromTray ? 'Tray' : 'Active Fields'} and marked it in the ${targetColor} area.`;
        }

        // Add to picked list to mark as done
        player.extraDicePickedThisTurn.push(color);
        player.hasConfirmedPassiveSelection = false;
    }

    public spend_extra_die(playerId: string, color: DieColor, option?: any): void {
        // Can be spent during TurnEnd or PassiveChoosing phase (after free choice is done)
        const player = this.data.players[playerId];

        const isPassiveFreePicked = player.extraDicePickedThisTurn.length > 0;
        const isActivePlayer = playerId === this.data.playerIds[this.data.activePlayerIndex];

        // Active player can spend extra dice after completing active turn (status is PassiveChoosing or TurnEnd)
        // Passive players can spend extra dice after making their free passive pick
        if (isActivePlayer && this.data.status !== GameStatus.PassiveChoosing && this.data.status !== GameStatus.TurnEnd) {
            console.warn(`spend_extra_die: Active player is not in passive choosing or turn end phase (current: ${this.data.status}), proceeding anyway.`);
        }
        if (!isActivePlayer && !isPassiveFreePicked) {
            throw new Error('Must make your free passive choice before spending Extra Die actions');
        }

        const extraAvailable = player.extraDiceTotal - player.extraDiceUsed;
        if (extraAvailable <= 0) {
            throw new Error('No Extra Die actions available');
        }

        // Each individual die color can only be selected once per turn across all extra die actions
        // (the active/free choice doesn't count against this, but let's make sure they haven't ALREADY picked this color in an Extra Die action)
        // Wait, the rules say: "each individual die can only be selected once per turn across all extra die actions."
        // We track spent colors in `extraDicePickedThisTurn` (excluding the free passive pick? Actually, let's track the extra dice separately,
        // or check if the color is already inside `extraDicePickedThisTurn` since the free choice color is the first element).
        // Let's see: if a passive player picked White for free, they can still pick White as an extra die?
        // Yes, "each individual die can only be selected once per turn across all extra die actions."
        // So the free pick color is exempt. Let's filter the free pick color from the check, or keep a separate list:
        // Since player.extraDicePickedThisTurn has the free color at index 0, any extra dice are from index 1 onwards.
        // Let's check:
        const extraDiceSpentColors = isActivePlayer 
            ? player.extraDicePickedThisTurn 
            : player.extraDicePickedThisTurn.slice(1);

        if (extraDiceSpentColors.includes(color)) {
            throw new Error(`You have already selected the ${color} die in an Extra Die action this turn.`);
        }

        // Extra Die can be picked from ANY of the 6 dice (whether on sheet, tray, or unrolled)
        // Find the die's value in the active rolls, picked fields, or tray:
        let chosenDie: Die | undefined = this.data.trayDice.find(d => d.color === color) 
            || this.data.activePickedDice.find(d => d.color === color)
            || this.data.rolledDice.find(d => d.color === color);

        if (!chosenDie) {
            // Edge case: if it wasn't rolled/shown (e.g. pool), just assume its current face is 1 or look it up.
            // Actually, all 6 dice are always present on the score sheet or active player's rolled dice.
            // Let's search the pool dice if not found elsewhere:
            chosenDie = this.data.poolDice.find(d => d.color === color);
        }

        if (!chosenDie) {
            throw new Error(`Die ${color} not found in game state`);
        }

        const targetColor = color === 'white'
            ? (typeof option === 'string' ? option : (option && option.targetColor))
            : color;
        if (!targetColor) {
            throw new Error('Must specify target color track when picking the White die');
        }

        let yellowCoords: { r: number, c: number } | undefined = undefined;
        if (targetColor === 'yellow' && option && typeof option === 'object') {
            if (typeof option.r === 'number' && typeof option.c === 'number') {
                yellowCoords = { r: option.r, c: option.c };
            }
        }

        const isLegal = this.is_die_choice_legal(playerId, chosenDie.value, targetColor, color === 'white', yellowCoords);
        if (!isLegal) {
            throw new Error(`Cannot record ${color}:${chosenDie.value} in ${targetColor} area: move is illegal.`);
        }

        // Spend the action
        player.extraDiceUsed++;
        player.extraDicePickedThisTurn.push(color);

        // Record the value
        this.record_die_value(playerId, chosenDie.value, targetColor, color === 'white', yellowCoords);
        this.data.gameLogs.push(`${playerId} spent an Extra Die (+1) action to pick ${color}:${chosenDie.value} and marked it in the ${targetColor} area.`);
    }

    public confirm_passive_selection(playerId: string): void {
        if (this.data.status !== GameStatus.PassiveChoosing) {
            console.warn(`confirm_passive_selection: Not in Passive Choosing phase (current: ${this.data.status}), proceeding anyway.`);
        }

        const player = this.data.players[playerId];
        const isPassiveFreePicked = player.extraDicePickedThisTurn.length > 0;
        if (!isPassiveFreePicked) {
            throw new Error('Must select a die before confirming');
        }

        player.hasConfirmedPassiveSelection = true;

        // Player is done with their passive selections.
        // In multiplayer, we wait for all passive players.
        this.check_passive_confirmations();
    }

    private check_passive_confirmations(): void {
        const activePlayerId = this.data.playerIds[this.data.activePlayerIndex];

        // Check if all passive players have made and confirmed their selections
        let allConfirmed = true;
        for (const id of this.data.playerIds) {
            if (id === activePlayerId && !this.data.isSolo) continue; // Skip active player in multiplayer

            const player = this.data.players[id];
            if (!player.hasConfirmedPassiveSelection) {
                allConfirmed = false;
                break;
            }
        }

        if (allConfirmed) {
            // Push final selection logs for all passive players
            for (const id of this.data.playerIds) {
                if (id === activePlayerId && !this.data.isSolo) continue;
                const player = this.data.players[id];
                if (player.draftPassiveLog) {
                    this.data.gameLogs.push(player.draftPassiveLog);
                }
            }
            this.data.gameLogs.push('All passive players have confirmed their selections.');
            this.advance_turn_or_round();
        }
    }

    public end_player_turn(playerId: string): void {
        if (this.data.status !== GameStatus.TurnEnd) {
            throw new Error('Not in Turn End phase');
        }

        // Active player confirms turn end, or in multiplayer, all players must confirm?
        // To make it simple and fast, once the Active Player clicks "End Turn", we can automatically proceed!
        // Because passive players have already confirmed their free picks, and they would have spent their extra dice before confirming.
        // Let's enforce that the active player ends the turn:
        const activePlayerId = this.data.playerIds[this.data.activePlayerIndex];
        if (playerId !== activePlayerId) {
            throw new Error('Only the active player can officially end the turn');
        }

        this.advance_turn_or_round();
    }

    private advance_turn_or_round(): void {
        const activePlayerId = this.data.playerIds[this.data.activePlayerIndex];
        this.data.gameLogs.push(`Active turn ended for ${activePlayerId}.`);

        // Check next active player
        if (this.data.isSolo) {
            // Solo Mode: Alternates Active and Passive 6 times
            if (this.data.soloPassiveTurn) {
                // Was passive, now next round!
                this.data.round++;
                if (this.data.round > this.data.totalRounds) {
                    this.end_game();
                } else {
                    this.trigger_round_start();
                }
            } else {
                // Was active, now passive turn!
                // Trigger passive simulation immediately (handled inside pick_active_die end check)
            }
        } else {
            // Multiplayer: next player clockwise
            this.data.activePlayerIndex = (this.data.activePlayerIndex + 1) % this.data.playerIds.length;

            if (this.data.activePlayerIndex === 0) {
                // All players have been active once. Round is complete!
                this.data.round++;
                if (this.data.round > this.data.totalRounds) {
                    this.end_game();
                } else {
                    this.trigger_round_start();
                }
            } else {
                // Next turn in same round
                this.start_active_turn();
            }
        }
    }

    private end_game(): void {
        this.data.status = GameStatus.GameOver;
        this.data.gameLogs.push('=== Game Over! Final Scoring Phase ===');
    }

    public restart_game(): void {
        this.start_game();
    }

    // --- Core Rule Checks & Marking ---

    private is_die_choice_legal(
        playerId: string,
        value: number,
        targetColor: DieColor,
        isWhiteWild: boolean,
        yellowCoords?: { r: number, c: number }
    ): boolean {
        const player = this.data.players[playerId];

        if (targetColor === 'yellow') {
            // Can only mark a number if there's an unmarked matching box in Yellow
            // Grid contains preprinted X's, so we check if there's a cell with the value that is false
            const grid = [
                [3, 6, 5, null],
                [2, 1, null, 5],
                [1, null, 2, 4],
                [null, 3, 4, 6]
            ];

            // 1. Uniqueness check: cannot choose the same number twice for yellow
            let alreadyMarkedCount = 0;
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (grid[r][c] === value && player.yellow[r][c]) {
                        alreadyMarkedCount++;
                    }
                }
            }
            if (alreadyMarkedCount > 0) {
                return false;
            }

            // 2. Coordinates selection check if provided
            if (yellowCoords) {
                const { r, c } = yellowCoords;
                if (r < 0 || r >= 4 || c < 0 || c >= 4) return false;
                return grid[r][c] === value && !player.yellow[r][c];
            }

            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (grid[r][c] === value && !player.yellow[r][c]) {
                        return true;
                    }
                }
            }
            return false;
        }

        if (targetColor === 'blue') {
            // Blue sum coupling rule: Blue value + White value.
            // If they are picking blue or white, we must add the OTHER die's current face value!
            // Wait, inside pick_active_die, chosenDie is just one die. Where is the other die?
            // We must find the other die's value in the rolled pool, tray, or picked fields!
            const pairingColor: DieColor = isWhiteWild ? 'blue' : 'white';
            const pairingDie = this.data.rolledDice.find(d => d.color === pairingColor)
                || this.data.activePickedDice.find(d => d.color === pairingColor)
                || this.data.trayDice.find(d => d.color === pairingColor)
                || this.data.poolDice.find(d => d.color === pairingColor); // fallback

            const pairingValue = pairingDie ? pairingDie.value : 1; // default fallback
            const sum = value + pairingValue;

            const sumIndex = sum - 2;
            if (sumIndex < 0 || sumIndex > 10) return false;

            // Cannot mark if already marked
            return !player.blue[sumIndex];
        }

        if (targetColor === 'green') {
            // Progressive left-to-right filling. Check next cell requirements.
            if (player.green >= 11) return false; // fully filled

            const minRequired = GREEN_MINIMUMS[player.green];
            return value >= minRequired;
        }

        if (targetColor === 'orange') {
            // Left-to-right filling. No restrictions on values.
            const orangeIndex = player.orange.indexOf(null);
            return orangeIndex !== -1;
        }

        if (targetColor === 'purple') {
            // Left-to-right strictly increasing, resets after 6.
            const purpleIndex = player.purple.indexOf(null);
            if (purpleIndex === -1) return false; // fully filled

            if (purpleIndex === 0) return true; // first cell always legal

            const lastVal = player.purple[purpleIndex - 1]!;
            if (lastVal === 6) return true; // resets after 6

            return value > lastVal;
        }

        return false;
    }

    private has_any_legal_die_in_pool(playerId: string, pool: Die[]): boolean {
        // Evaluate if any die in the pool can be legally recorded in any of the player's tracks
        for (const d of pool) {
            const tracks: DieColor[] = ['yellow', 'blue', 'green', 'orange', 'purple'];
            for (const track of tracks) {
                if (d.color === 'white') {
                    // White can act as any color
                    if (this.is_die_choice_legal(playerId, d.value, track, true)) {
                        return true;
                    }
                } else if (d.color === track) {
                    if (this.is_die_choice_legal(playerId, d.value, track, false)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private record_die_value(
        playerId: string,
        value: number,
        targetColor: DieColor,
        isWhiteWild: boolean,
        yellowCoords?: { r: number, c: number }
    ): void {
        const player = this.data.players[playerId];

        if (targetColor === 'yellow') {
            // Find first unmarked matching cell in Yellow
            const grid = [
                [3, 6, 5, null],
                [2, 1, null, 5],
                [1, null, 2, 4],
                [null, 3, 4, 6]
            ];

            if (yellowCoords) {
                const { r, c } = yellowCoords;
                if (grid[r][c] === value && !player.yellow[r][c]) {
                    player.yellow[r][c] = true;
                    this.check_yellow_triggers(playerId, r, c);
                    return;
                } else {
                    throw new Error(`Invalid yellow cell selection: row ${r + 1}, col ${c + 1} does not match value ${value} or is already marked`);
                }
            }

            let marked = false;
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (grid[r][c] === value && !player.yellow[r][c]) {
                        player.yellow[r][c] = true;
                        marked = true;
                        this.check_yellow_triggers(playerId, r, c);
                        break;
                    }
                }
                if (marked) break;
            }
        }

        else if (targetColor === 'blue') {
            let pairingColor: DieColor = 'white'; // if targetColor is blue, pairing is white
            // Wait, if color chosen was white used as blue, pairing is blue!
            // Let's find pairing die value:
            let pairingDie = this.data.rolledDice.find(d => d.color === pairingColor)
                || this.data.activePickedDice.find(d => d.color === pairingColor)
                || this.data.trayDice.find(d => d.color === pairingColor)
                || this.data.poolDice.find(d => d.color === pairingColor); // fallback

            // Wait, what if they used white as blue?
            // If isWhiteWild is true, they selected White to mark Blue, so pairing is the Blue die!
            if (isWhiteWild) {
                pairingColor = 'blue';
                pairingDie = this.data.rolledDice.find(d => d.color === pairingColor)
                    || this.data.activePickedDice.find(d => d.color === pairingColor)
                    || this.data.trayDice.find(d => d.color === pairingColor)
                    || this.data.poolDice.find(d => d.color === pairingColor);
            }

            const pairingValue = pairingDie ? pairingDie.value : 1;
            const sum = value + pairingValue;
            const sumIndex = sum - 2;

            player.blue[sumIndex] = true;
            this.check_blue_triggers(playerId, sumIndex);
        }

        else if (targetColor === 'green') {
            const index = player.green;
            player.green++;
            this.check_green_triggers(playerId, index);
        }

        else if (targetColor === 'orange') {
            const index = player.orange.indexOf(null);
            if (index !== -1) {
                const mult = ORANGE_MULTIPLIERS[index] || 1;
                player.orange[index] = value * mult;
                this.check_orange_triggers(playerId, index);
            }
        }

        else if (targetColor === 'purple') {
            const index = player.purple.indexOf(null);
            if (index !== -1) {
                player.purple[index] = value;
                this.check_purple_triggers(playerId, index);
            }
        }
    }

    // --- Cascading Bonus Triggers ---

    private check_yellow_triggers(playerId: string, r: number, c: number): void {
        const player = this.data.players[playerId];

        // 1. Check Row completions -> trigger Row bonuses
        let rowCompleted = true;
        for (let col = 0; col < 4; col++) {
            if (!player.yellow[r][col]) {
                rowCompleted = false;
                break;
            }
        }

        if (rowCompleted) {
            // Trigger row bonus
            if (r === 0) {
                player.bonusesToResolve.push({ type: 'blue_X' });
                this.data.gameLogs.push(`🎉 ${playerId} completed Yellow Row 1! Earned Blue X bonus.`);
            } else if (r === 1) {
                player.bonusesToResolve.push({ type: 'orange_num', value: 4 });
                this.data.gameLogs.push(`🎉 ${playerId} completed Yellow Row 2! Earned Orange 4 bonus.`);
            } else if (r === 2) {
                player.bonusesToResolve.push({ type: 'green_X' });
                this.data.gameLogs.push(`🎉 ${playerId} completed Yellow Row 3! Earned Green X bonus.`);
            } else if (r === 3) {
                player.foxesTotal++;
                this.data.gameLogs.push(`🎉 ${playerId} completed Yellow Row 4! Unlocked Fox multiplier! 🦊`);
            }
        }

        // 2. Check Diagonal completion (top-left to bottom-right)
        if (r === c) {
            let diagCompleted = true;
            for (let i = 0; i < 4; i++) {
                if (!player.yellow[i][i]) {
                    diagCompleted = false;
                    break;
                }
            }

            if (diagCompleted) {
                player.extraDiceTotal++;
                this.data.gameLogs.push(`🎉 ${playerId} completed Yellow Diagonal! Unlocked Extra Die action (+1).`);
            }
        }
    }

    private check_blue_triggers(playerId: string, sumIndex: number): void {
        const player = this.data.players[playerId];

        // Sum mapping: index = sum - 2
        // Rows & Columns structure:
        // Col 1 is sums: [5, 9] (sums 5 and 9 are at index 3 and 7)
        // Col 2 is sums: [2, 6, 10] (index 0, 4, 8)
        // Col 3 is sums: [3, 7, 11] (index 1, 5, 9)
        // Col 4 is sums: [4, 8, 12] (index 2, 6, 10)
        // Rows:
        // Row 1 is sums: [2, 3, 4] (index 0, 1, 2)
        // Row 2 is sums: [5, 6, 7, 8] (index 3, 4, 5, 6)
        // Row 3 is sums: [9, 10, 11, 12] (index 7, 8, 9, 10)

        // Row Checks:
        const row1 = [0, 1, 2];
        const row2 = [3, 4, 5, 6];
        const row3 = [7, 8, 9, 10];

        if (row1.includes(sumIndex) && row1.every(idx => player.blue[idx])) {
            player.bonusesToResolve.push({ type: 'orange_num', value: 5 });
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Row 1! Earned Orange 5 bonus.`);
        }
        if (row2.includes(sumIndex) && row2.every(idx => player.blue[idx])) {
            player.bonusesToResolve.push({ type: 'yellow_X' });
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Row 2! Earned Yellow X bonus.`);
        }
        if (row3.includes(sumIndex) && row3.every(idx => player.blue[idx])) {
            player.foxesTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Row 3! Unlocked Fox multiplier! 🦊`);
        }

        // Column Checks:
        const col1 = [3, 7]; // sum 5, 9
        const col2 = [0, 4, 8]; // sum 2, 6, 10
        const col3 = [1, 5, 9]; // sum 3, 7, 11
        const col4 = [2, 6, 10]; // sum 4, 8, 12

        if (col1.includes(sumIndex) && col1.every(idx => player.blue[idx])) {
            player.rerollsTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Column 1! Unlocked Reroll action.`);
        }
        if (col2.includes(sumIndex) && col2.every(idx => player.blue[idx])) {
            player.bonusesToResolve.push({ type: 'green_X' });
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Column 2! Earned Green X bonus.`);
        }
        if (col3.includes(sumIndex) && col3.every(idx => player.blue[idx])) {
            player.bonusesToResolve.push({ type: 'purple_num', value: 6 });
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Column 3! Earned Purple 6 bonus.`);
        }
        if (col4.includes(sumIndex) && col4.every(idx => player.blue[idx])) {
            player.extraDiceTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} completed Blue Column 4! Unlocked Extra Die action (+1).`);
        }
    }

    private check_green_triggers(playerId: string, cellIndex: number): void {
        const player = this.data.players[playerId];

        // Immediate cell bonuses:
        if (cellIndex === 3) {
            // cell 4
            player.extraDiceTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Green Cell 4! Unlocked Extra Die action (+1).`);
        } else if (cellIndex === 5) {
            // cell 6
            player.bonusesToResolve.push({ type: 'green_X' });
            this.data.gameLogs.push(`🎉 ${playerId} filled Green Cell 6! Earned Green X bonus.`);
        } else if (cellIndex === 6) {
            // cell 7
            player.foxesTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Green Cell 7! Unlocked Fox multiplier! 🦊`);
        } else if (cellIndex === 8) {
            // cell 9
            player.bonusesToResolve.push({ type: 'purple_num', value: 6 });
            this.data.gameLogs.push(`🎉 ${playerId} filled Green Cell 9! Earned Purple 6 bonus.`);
        } else if (cellIndex === 9) {
            // cell 10
            player.rerollsTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Green Cell 10! Unlocked Reroll action.`);
        }
    }

    private check_orange_triggers(playerId: string, cellIndex: number): void {
        const player = this.data.players[playerId];

        // Immediate cell bonuses:
        if (cellIndex === 2) {
            // cell 3
            player.rerollsTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Orange Cell 3! Unlocked Reroll action.`);
        } else if (cellIndex === 4) {
            // cell 5
            player.bonusesToResolve.push({ type: 'yellow_X' });
            this.data.gameLogs.push(`🎉 ${playerId} filled Orange Cell 5! Earned Yellow X bonus.`);
        } else if (cellIndex === 5) {
            // cell 6
            player.extraDiceTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Orange Cell 6! Unlocked Extra Die action (+1).`);
        } else if (cellIndex === 7) {
            // cell 8
            player.foxesTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Orange Cell 8! Unlocked Fox multiplier! 🦊`);
        } else if (cellIndex === 9) {
            // cell 10
            player.bonusesToResolve.push({ type: 'purple_num', value: 6 });
            this.data.gameLogs.push(`🎉 ${playerId} filled Orange Cell 10! Earned Purple 6 bonus.`);
        }
    }

    private check_purple_triggers(playerId: string, cellIndex: number): void {
        const player = this.data.players[playerId];

        // Immediate cell bonuses:
        if (cellIndex === 2) {
            // cell 3
            player.rerollsTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 3! Unlocked Reroll action.`);
        } else if (cellIndex === 3) {
            // cell 4
            player.bonusesToResolve.push({ type: 'blue_X' });
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 4! Earned Blue X bonus.`);
        } else if (cellIndex === 4) {
            // cell 5
            player.extraDiceTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 5! Unlocked Extra Die action (+1).`);
        } else if (cellIndex === 5) {
            // cell 6
            player.bonusesToResolve.push({ type: 'yellow_X' });
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 6! Earned Yellow X bonus.`);
        } else if (cellIndex === 6) {
            // cell 7
            player.foxesTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 7! Unlocked Fox multiplier! 🦊`);
        } else if (cellIndex === 7) {
            // cell 8
            player.rerollsTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 8! Unlocked Reroll action.`);
        } else if (cellIndex === 8) {
            // cell 9
            player.bonusesToResolve.push({ type: 'green_X' });
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 9! Earned Green X bonus.`);
        } else if (cellIndex === 9) {
            // cell 10
            player.bonusesToResolve.push({ type: 'orange_num', value: 6 });
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 10! Earned Orange 6 bonus.`);
        } else if (cellIndex === 10) {
            // cell 11
            player.extraDiceTotal++;
            this.data.gameLogs.push(`🎉 ${playerId} filled Purple Cell 11! Unlocked Extra Die action (+1).`);
        }
    }

    public resolve_pending_bonus(playerId: string, rOrIndex: number, c?: number): void {
        const player = this.data.players[playerId];
        if (player.bonusesToResolve.length === 0) {
            throw new Error('No pending bonuses to resolve');
        }

        const bonus = player.bonusesToResolve[0]; // get the first pending bonus

        if (bonus.type === 'yellow_X') {
            if (c === undefined) {
                throw new Error('Must specify column index to mark Yellow box');
            }

            const grid = [
                [3, 6, 5, null],
                [2, 1, null, 5],
                [1, null, 2, 4],
                [null, 3, 4, 6]
            ];

            // Verify it's a valid cell and not already marked
            if (player.yellow[rOrIndex][c]) {
                throw new Error('Yellow cell already marked');
            }

            const cellVal = grid[rOrIndex][c];
            if (cellVal !== null) {
                // Ensure player hasn't already marked this number in their yellow grid
                let alreadyMarkedCount = 0;
                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 4; c++) {
                        if (grid[r][c] === cellVal && player.yellow[r][c]) {
                            alreadyMarkedCount++;
                        }
                    }
                }
                if (alreadyMarkedCount > 0) {
                    throw new Error(`Cannot mark yellow cell with value ${cellVal} as it is already marked elsewhere in the yellow grid`);
                }
            }

            // Mark it
            player.yellow[rOrIndex][c] = true;
            this.data.gameLogs.push(`${playerId} resolved their Yellow X-Bonus by marking cell at [row:${rOrIndex + 1}, col:${c + 1}].`);

            // Pop from queue
            player.bonusesToResolve.shift();

            // Check triggers for Yellow (which can add more bonuses to queue!)
            this.check_yellow_triggers(playerId, rOrIndex, c);
        }

        else if (bonus.type === 'blue_X') {
            const sumIndex = rOrIndex; // Blue index: sum - 2
            if (sumIndex < 0 || sumIndex > 10) {
                throw new Error('Invalid sum index for Blue');
            }
            if (player.blue[sumIndex]) {
                throw new Error('Blue sum already marked');
            }

            player.blue[sumIndex] = true;
            this.data.gameLogs.push(`${playerId} resolved their Blue X-Bonus by marking sum ${sumIndex + 2}.`);

            // Pop from queue
            player.bonusesToResolve.shift();

            // Check triggers for Blue
            this.check_blue_triggers(playerId, sumIndex);
        }

        else if (bonus.type === 'green_X') {
            // Green X automatically marks the NEXT progressive cell
            if (player.green >= 11) {
                // Ignore if already fully filled, just pop
                player.bonusesToResolve.shift();
                return;
            }

            const index = player.green;
            player.green++;
            this.data.gameLogs.push(`${playerId} resolved their Green X-Bonus by marking Green Cell ${index + 1}.`);

            // Pop from queue
            player.bonusesToResolve.shift();

            // Check triggers for Green
            this.check_green_triggers(playerId, index);
        }

        else if (bonus.type === 'orange_num') {
            const val = bonus.value;
            if (val === undefined) {
                throw new Error('No pre-determined value for Orange bonus');
            }

            const orangeIndex = player.orange.indexOf(null);
            if (orangeIndex === -1) {
                // fully filled, just pop
                player.bonusesToResolve.shift();
                return;
            }

            const mult = ORANGE_MULTIPLIERS[orangeIndex] || 1;
            player.orange[orangeIndex] = val * mult;
            this.data.gameLogs.push(`${playerId} resolved their Orange ${val}-Bonus by placing it in Orange Cell ${orangeIndex + 1}.`);

            // Pop from queue
            player.bonusesToResolve.shift();

            // Check triggers for Orange
            this.check_orange_triggers(playerId, orangeIndex);
        }

        else if (bonus.type === 'purple_num') {
            const val = bonus.value;
            if (val === undefined) {
                throw new Error('No pre-determined value for Purple bonus');
            }

            const purpleIndex = player.purple.indexOf(null);
            if (purpleIndex === -1) {
                // fully filled, just pop
                player.bonusesToResolve.shift();
                return;
            }

            player.purple[purpleIndex] = val;
            this.data.gameLogs.push(`${playerId} resolved their Purple ${val}-Bonus by placing it in Purple Cell ${purpleIndex + 1}.`);

            // Pop from queue
            player.bonusesToResolve.shift();

            // Check triggers for Purple
            this.check_purple_triggers(playerId, purpleIndex);
        }

        // If in RoundStartBonus phase, check if we're done
        if (this.data.status === GameStatus.RoundStartBonus) {
            this.check_bonus_resolution_phase();
        }
    }

    // --- Scoring & Leaderboard calculations ---

    public calculate_scores(playerId: string): {
        yellow: number;
        blue: number;
        green: number;
        orange: number;
        purple: number;
        foxes: number;
        total: number;
        breakdown: string;
        lowestAreaScore: number;
    } {
        const player = this.data.players[playerId];

        // 1. Yellow scoring: completed columns
        // Columns completed:
        const colPoints = [10, 14, 16, 20];
        let yellowScore = 0;
        for (let col = 0; col < 4; col++) {
            let colCompleted = true;
            for (let row = 0; row < 4; row++) {
                if (!player.yellow[row][col]) {
                    colCompleted = false;
                    break;
                }
            }
            if (colCompleted) {
                yellowScore += colPoints[col];
            }
        }

        // 2. Blue scoring: total marks
        const blueCount = player.blue.filter(x => x).length;
        const blueScore = blueCount > 0 ? BLUE_POINTS[blueCount - 1] : 0;

        // 3. Green scoring: stars above last marked cell
        const greenScore = player.green > 0 ? GREEN_POINTS[player.green - 1] : 0;

        // 4. Orange scoring: sum of orange values
        let orangeScore = 0;
        for (const val of player.orange) {
            if (val !== null) orangeScore += val;
        }

        // 5. Purple scoring: sum of purple values
        let purpleScore = 0;
        for (const val of player.purple) {
            if (val !== null) purpleScore += val;
        }

        // 6. Fox scoring: lowest scoring area * foxesTotal
        // Foxes score 0 if ANY scoring area is 0!
        const scores = [yellowScore, blueScore, greenScore, orangeScore, purpleScore];
        const minScore = Math.min(...scores);
        const foxScore = minScore * player.foxesTotal;

        const total = yellowScore + blueScore + greenScore + orangeScore + purpleScore + foxScore;

        const breakdown = `Yellow: ${yellowScore} pts | Blue: ${blueScore} pts | Green: ${greenScore} pts | Orange: ${orangeScore} pts | Purple: ${purpleScore} pts | Foxes: ${player.foxesTotal} × ${minScore} = ${foxScore} pts`;

        return {
            yellow: yellowScore,
            blue: blueScore,
            green: greenScore,
            orange: orangeScore,
            purple: purpleScore,
            foxes: foxScore,
            total,
            breakdown,
            lowestAreaScore: minScore
        };
    }
}
