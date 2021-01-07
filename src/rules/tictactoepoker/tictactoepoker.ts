import { shuffle, cartesianProduct } from '../../common/utils';

export enum GameStatus {
    Playing,
    GameOver,
}

// Returns random integer in low..high, inclusive
function randInt(low: number, high: number): number {
    return Math.floor(Math.random() * (high - low + 1)) + low;
}

function assert(cond: boolean, message?: string) {
    if (!cond) {
        const error = new Error();
        throw("assertion failed: " + (message ? message : "") + " call stack: " + error.stack);
    }
}

export enum CardType {
    Normal,
    Empty,
    Joker,
    Thief,
}

export enum Suit {
	Diamonds,
	Clubs,
	Hearts,
	Spades,
}

export interface CardObject {
    type: CardType,
    suit?: Suit,
    value?: number,
}

export class Card {
    static readonly EMPTY = Card.create_special(CardType.Empty);
    static readonly AceValue: number = 1;

    private type: CardType;
    private suit?: Suit;
    private value?: number;

    private constructor(type: CardType, suit?: Suit, value?: number) {
        this.type = type;
        this.suit = suit;
        this.value = value;
    }

    public static from_object(obj: CardObject): Card {
        return new Card(obj.type, obj.suit, obj.value);
    }

    public static create_special(type: CardType): Card {
        assert(type != CardType.Normal);
        return new Card(type);
    }

    public static create_normal(suit: Suit, value: number): Card {
        return new Card(CardType.Normal, suit, value);
    }

    public clone(): Card {
        return new Card(this.type, this.suit, this.value);
    }

    // Returns a string representation of this card,
    // e.g. "Joker", "Thief", "5 of Hearts", "Ace of Spades"
    public toString(): string {
        if (!this.is_normal()) {
            return CardType[this.type];
        }
        let value_str = "";
        if (this.value == Card.AceValue) {
            value_str = "Ace";
        } else {
            value_str = this.value.toString();
        }

        return value_str + " of " + Suit[this.suit];
    }

    public is_normal(): boolean {
        return this.type == CardType.Normal;
    }

    public is_empty(): boolean {
        return this.type == CardType.Empty;
    }

    public get_type(): CardType {
        return this.type;
    }

    public get_suit(): Suit {
        assert(this.is_normal());
        return this.suit;
    }

    public get_value(): number {
        assert(this.is_normal());
        return this.value;
    }

    // Like get_value, but treats Aces as 14 instead of 1
    public get_rank_value(): number {
        assert(this.is_normal());
        if (this.value == Card.AceValue) {
            return 14;
        }
        return this.value;
    }
}

type Deck = Card[];

// Add the 52 standard cards to the given deck.
function add_standard_cards(deck: Deck){
    // Normal cards
    for (let suit of Object.values(Suit).filter(v => typeof v == "number")) {
        for (let value = 2; value <= 13; value++) {
            deck.push(Card.create_normal(suit as Suit, value));
        }
        deck.push(Card.create_normal(suit as Suit, Card.AceValue));
    }
    return deck;
}

// Combination types. The values should be such that a higher value represents a better combination.
enum CombinationType {
    None = 0,
    Pair = 1,
    ThreeOfAKind = 2,
    Straight = 3,
    Flush = 4,
    StraightFlush = 5,
}

// Score type.
interface ScoreType {
    combination_type: CombinationType,
    rank_card?: Card,
}

// Returns the score value for the given score type.
function compute_score_value(score_type: ScoreType): number {
    let rank_value = 0;
    if (score_type.rank_card) {
        rank_value = score_type.rank_card.get_rank_value();
    }

    switch(score_type.combination_type) {
        case CombinationType.StraightFlush:
            return 1000 + 30 * rank_value;
        case CombinationType.Flush:
            return 750 + 15 * rank_value;
        case CombinationType.Straight:
            return 500 + 10 * rank_value;
        case CombinationType.ThreeOfAKind:
            return 250 + 5 * rank_value;
        case CombinationType.Pair:
            return 100 + rank_value;
        case CombinationType.None:
            return 0;
    }

    throw("should not get here");
}

// Represents an explanation for how a single scoring line (row, column, or diagonal)
export class ScoreExplanation {
    private readonly score_type: ScoreType
    private readonly where: string
    private readonly score_value: number;

    constructor(score_type: ScoreType, where: string) {
        this.score_type = score_type;
        this.where = where;
        this.score_value = compute_score_value(score_type);
    }

    public get_score_value(): number {
        return this.score_value;
    }

    public toString(): string {
        return CombinationType[this.score_type.combination_type] + " in " + this.where + " " +
            "with ranking card " + this.score_type.rank_card.toString() + " worth " +
            this.score_value + " points";
    }
}

export interface ScoreWithExplanations {
    score: number,
    explanations: ScoreExplanation[]
}

// Return score type for the given three cards (some of all of which may be empty cards)
function compute_score(a: Card, b: Card, c: Card): ScoreType {
    // Get all normal cards
    let cards = [];
    if (a.is_normal()) { cards.push(a); }
    if (b.is_normal()) { cards.push(b); }
    if (c.is_normal()) { cards.push(c); }

    // Compute score for an array of cards, where the Aces have been resolved to
    // either 1 or 14
    const compute_no_ace = ((cards) => {

        if (cards.length == 3) {
            // Sort cards in ascending order of value
            let sorted_cards = [cards[0], cards[1], cards[2]]
            // Note that the Aces have been resolved to 1 or 14, so we don't need to use
            // get_rank_value
            sorted_cards.sort((a, b) => a.get_value() - b.get_value());

            // Flush (all same suit)
            const is_flush: boolean = (() => {
                // All the same suit.
                let suits = {};
                for (let card of cards) {
                    suits[card.get_suit()] = true;
                }
                if (Object.keys(suits).length != 1) {
                    return false;
                }
                return true;
            })();

            // Straight (just three consecutive cards, in any order: 4 6 5 is also considered a
            // straight)
            const is_straight: boolean = (() => {
                if (sorted_cards[0].get_value() + 1 == sorted_cards[1].get_value() &&
                    sorted_cards[1].get_value() + 1 == sorted_cards[2].get_value()) {
                    return true;
                }
                return false;
            })();

            if (is_straight && is_flush) {
                return {combination_type: CombinationType.StraightFlush,
                        rank_card: sorted_cards[2]};
            }
            if (is_flush) {
                return {combination_type: CombinationType.Flush, rank_card: sorted_cards[2]};
            }
            if (is_straight) {
                return {combination_type: CombinationType.Straight, rank_card: sorted_cards[2]};
            }

            // Three of a kind
            if (cards[0].get_value() == cards[1].get_value() &&
                cards[1].get_value() == cards[2].get_value()) {
                return {combination_type: CombinationType.ThreeOfAKind, rank_card: sorted_cards[0]};
            }
        }

        // Pair
        const pair_card: Card = (() => {
            for (let i = 0; i < cards.length; i++) {
                for (let j = i + 1; j < cards.length; j++) {
                    if (cards[i].get_value() == cards[j].get_value()) {
                        return cards[i];
                    }
                }
            }
            return Card.EMPTY;
        })();

        if (pair_card != Card.EMPTY) {
            return {combination_type: CombinationType.Pair, rank_card: pair_card};
        }

        return {combination_type: CombinationType.None};
    });

    const is_better = (score_a, score_b) => {
        if (score_a.combination_type == score_b.combination_type) {
            if (score_a.combination_type == CombinationType.None) {
                return true;
            }
            return score_a.rank_card.get_rank_value() >= score_b.rank_card.get_rank_value();
        } else {
            return score_a.combination_type > score_b.combination_type;
        }
    };

    // Since Aces can be 1 or 14, we have to try all combinations.
    //
    // Note the same Ace on the board can be treated differently
    // for the different directions (rows, columns, diagonals)
    let score = {combination_type: CombinationType.None};
    let possibilities = [];
    for (let i = 0; i < cards.length; i++) {
        if (cards[i].get_value() == Card.AceValue) {
            possibilities.push([1, 14]);
        } else {
            possibilities.push([cards[i].get_value()]);
        }
    }
    const all_combinations = cartesianProduct(possibilities);
    for (let combination of all_combinations) {
        let cards_copy = [];
        for (let i = 0; i < combination.length; i++) {
            cards_copy.push(Card.create_normal(cards[i].get_suit(), combination[i]));
        }
        const forward_score = compute_no_ace(cards_copy);
        if (is_better(forward_score, score)) {
            score = forward_score;
        }
    }

    return score;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Board
////////////////////////////////////////////////////////////////////////////////////////////////////

export type BoardObject = CardObject[][];

export class Board {
    private raw_board: Card[][];

    private constructor(raw_board: Card[][]) {
        assert(raw_board.length == 3);
        for (let row = 0; row < 3; row++) {
            assert(raw_board[row].length == 3);
        }
        this.raw_board = raw_board;
    }

    public static from_object(obj: BoardObject): Board {
        let raw_board = [];
        for (let row of obj) {
            let raw_row = [];
            for (let cell of row) {
                raw_row.push(Card.from_object(cell));
            }
            raw_board.push(raw_row);
        }
        return new Board(raw_board);
    }

    // Creates an empty board.
    public static create_empty(): Board {
        let raw_board = [];
        for (let row = 0; row < 3; row++) {
            let board_row = [];
            for (let col = 0; col < 3; col++) {
                board_row.push(Card.EMPTY);
            }
            raw_board.push(board_row);
        }
        return new Board(raw_board);
    }

    // Computes the score for the current board.
    public compute_score_with_explanations(): ScoreWithExplanations {
        let total_score = 0;
        let explanations = [];

        const add_score = (where, score_type) => {
            if (score_type.combination_type == CombinationType.None) {
                return;
            }

            const explanation = new ScoreExplanation(score_type, where);
            explanations.push(explanation);
            total_score += explanation.get_score_value();
        };

        for (let row = 0; row < 3; row++) {
            add_score(`row ${row}`, compute_score(
                this.raw_board[row][0], this.raw_board[row][1], this.raw_board[row][2]));
        }

        for (let col = 0; col < 3; col++) {
            add_score(`column ${col}`, compute_score(
                this.raw_board[0][col], this.raw_board[1][col], this.raw_board[2][col]));
        }

        add_score("diagonal left to right", compute_score(
            this.raw_board[0][0], this.raw_board[1][1], this.raw_board[2][2]));
        add_score("diagonal right to left", compute_score(
            this.raw_board[0][2], this.raw_board[1][1], this.raw_board[2][0]));

        return {score: total_score, explanations: explanations};
    }

    public compute_score(): number {
        return this.compute_score_with_explanations().score;
    }

    // Place card at (row, col). Returns true if it succeeded and false if the cell was already
    // occupied.
    public place_card(row: number, col: number, card: Card): boolean {
        let existing_card = this.get_card(row, col);
        if (!existing_card.is_empty()) {
            return false;
        }
        this.raw_board[row][col] = card;
        return true;
    }

    // Remove card from (row, col), and return it. Returns the empty card if the cell was
    // already empty to begin with.
    public remove_card(row: number, col: number): Card {
        let existing_card = this.get_card(row, col);
        if (existing_card.is_empty()) {
            return Card.EMPTY;
        }
        this.raw_board[row][col] = Card.EMPTY;
        return existing_card;
    }

    // Returns card at (row, col).
    public get_card(row: number, col: number): Card {
        assert(0 <= row);
        assert(row < 3);
        assert(0 <= col);
        assert(col < 3);
        return this.raw_board[row][col];
    }

    // Returns the number of empty cells.
    public count_empty(): number {
        let empty = 0;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (this.raw_board[row][col].is_empty()) {
                    empty++;
                }
            }
        }

        return empty;
    }

    public is_full(): boolean {
        return this.count_empty() == 0;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Moves
////////////////////////////////////////////////////////////////////////////////////////////////////

// Represents a move.
// All moves have a player playing the move.
class Move {
    // The player who is playing this move.
    protected readonly current_player: number;

    constructor(current_player: number) {
        this.current_player = current_player;
    }

    public get_current_player(): number {
        return this.current_player;
    }

    // Returns the empty string if the move was successfully applied,
    // and a string describing why the move was invalid otherwise.
    public apply(deck: Deck, table_cards: Deck, boards: Board[]): string {
        assert(0 <= this.current_player);
        assert(this.current_player < boards.length);
        return "";
    }
}

export class SkipMove extends Move {
    public apply(deck: Deck, table_cards: Deck, boards: Board[]): string {
        assert(0 <= this.current_player);
        assert(this.current_player < boards.length);
        return "";
    }
}

// Represents a move that involves a table card.
// All TableCardMoves have:
// - The table card that's being played
// - A row and column on the current player's board the move is played to
class TableCardMove extends Move {
    // The table card that is being played.
    protected readonly table_card_index: number;
    protected readonly row: number;
    protected readonly col: number;

    constructor(current_player: number, table_card_index: number, row: number, col: number) {
        super(current_player);
        this.table_card_index = table_card_index;
        this.row = row;
        this.col = col;
    }

    // Child classes implement this method: this method will be called with the selected
    // table card.
    //
    // This method should return the empty string if the move was succesfully applied,
    // and a string describing why the move was invalid otherwise.
    //
    // If the move was invalid, then the state of the boards should not be changed.
    //
    // The default implementation plays the given card at (row, col) of the current player's
    // board.
    protected apply_card(card: Card, boards: Board[]): string {
        if (!boards[this.current_player].place_card(this.row, this.col, card)) {
            return `cell (${this.row}, ${this.col}) already occupied`;
        }
        return "";
    }

    public apply(deck: Deck, table_cards: Deck, boards: Board[]): string {
        assert(0 <= this.current_player);
        assert(this.current_player < boards.length);

        assert(0 <= this.table_card_index);
        assert(this.table_card_index < table_cards.length);
        if (table_cards[this.table_card_index].is_empty()) {
            return "selected table card was empty";
        }

        let table_card = table_cards[this.table_card_index];
        // Defer drawing a new table card to later, in case the move is illegal.
        let result = this.apply_card(table_card, boards);
        if (result != "") {
            return result;
        }

        // Replace table card
        if (deck.length > 0) {
            table_cards[this.table_card_index] = deck.shift();
        } else {
            table_cards[this.table_card_index] = Card.EMPTY;
        }

        return "";
    }
}

export class PlayNormalCard extends TableCardMove {
    protected apply_card(table_card: Card, boards: Board[]): string {
        assert(table_card.is_normal());
        return super.apply_card(table_card, boards);
    }
}

export class PlayJoker extends TableCardMove {
    private readonly play_as: Card;

    constructor(current_player: number, table_card_index: number, row: number, col: number,
                play_as: Card) {
        super(current_player, table_card_index, row, col);
        this.play_as = play_as;
    }

    protected apply_card(table_card: Card, boards: Board[]): string {
        assert(table_card.get_type() == CardType.Joker);
        assert(this.play_as.is_normal());
        return super.apply_card(this.play_as, boards);
    }
}

export class PlayThief extends TableCardMove {
    private readonly steal_player: number;
    private readonly steal_row: number;
    private readonly steal_col: number;

    constructor(current_player: number, table_card_index: number, row: number, col: number,
                steal_player: number, steal_row: number, steal_col: number) {
        super(current_player, table_card_index, row, col);
        this.steal_player = steal_player;
        this.steal_row = steal_row;
        this.steal_col = steal_col;
    }

    protected apply_card(table_card: Card, boards: Board[]): string {
        assert(table_card.get_type() == CardType.Thief);
        assert(this.current_player != this.steal_player);
        assert(0 <= this.steal_player);
        assert(this.steal_player < boards.length);
        assert(0 <= this.steal_row);
        assert(this.steal_row < 3);
        assert(0 <= this.steal_col);
        assert(this.steal_col < 3);

        let stolen_card = boards[this.steal_player].remove_card(this.steal_row, this.steal_col);
        if (stolen_card.is_empty()) {
            return `there is no card at (${this.steal_row}, ${this.steal_col}) on player ` +
                   `${this.steal_player}'s board`;
        }

        let result = super.apply_card(stolen_card, boards);
        if (result != "") {
            // Reverse the stealing if the move was illegal.
            assert(boards[this.steal_player].place_card(
                this.steal_row, this.steal_col, stolen_card));
            return result;
        }

        return "";
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Game state
////////////////////////////////////////////////////////////////////////////////////////////////////

export interface GameOptions {
    enable_special_cards: boolean,
}

export interface GameStateObject {
    status: GameStatus,
    deck: CardObject[],
    table_cards: CardObject[],
    current_player: number,
    boards: BoardObject[],
    num_players: number,
    game_options: GameOptions
}

export class GameState {
    static readonly NUM_TABLE_CARDS = 5;

    private status: GameStatus;
    private deck: Deck;
    private table_cards: Card[];  // Cards showing on the table
    private current_player: number;
    private boards: Board[];
    private readonly num_players: number;
    private readonly game_options: GameOptions;

    constructor(num_players: number, game_options: GameOptions) {
        this.status = GameStatus.GameOver;
        this.num_players = num_players;
        this.game_options = game_options
    }

    public static from_object(obj: GameStateObject): GameState {
        let state = new GameState(obj.num_players, obj.game_options);
        state.status = obj.status;
        state.deck = [];
        for (let card of obj.deck) {
            state.deck.push(Card.from_object(card));
        }
        state.table_cards = [];
        for (let card of obj.table_cards) {
            state.table_cards.push(Card.from_object(card));
        }
        state.current_player = obj.current_player;
        state.boards = [];
        for (let board of obj.boards) {
            state.boards.push(Board.from_object(board));
        }
        return state;

    }

    // Starts a new game, resetting the state.
    public start_new_game() {
        this.status = GameStatus.Playing;
        this.current_player = randInt(0, this.num_players - 1);
        this.deck = [];
        add_standard_cards(this.deck);
        if (this.game_options.enable_special_cards) {
            this.deck.push(Card.create_special(CardType.Joker));
            this.deck.push(Card.create_special(CardType.Joker));
            this.deck.push(Card.create_special(CardType.Thief));
        }
        shuffle(this.deck);
        this.table_cards = [];

        for (let i = 0; i < GameState.NUM_TABLE_CARDS; i++) {
            this.table_cards.push(this.deck.shift());
        }

        this.boards = []
        for (let i = 0; i < this.num_players; i++) {
            this.boards.push(Board.create_empty());
        }
    }

    // Apply the given move.
    // If it was succesfully applied, returns the empty string and updates the current player.
    // Otherwise, returns a message describing why the move was illegal.
    public apply_move(move: Move): string {
        if (this.status == GameStatus.GameOver) {
            return "the game is over";
        }

        if (move.get_current_player() != this.current_player) {
            return `it is player ${this.current_player}'s turn, but the move was for player ` +
                   `${move.get_current_player()}`;
        }

        let result = move.apply(this.deck, this.table_cards, this.boards);
        if (result != "") {
            return result;
        }
        this.current_player = (this.current_player + 1) % (this.num_players);

        if (!this.does_any_player_have_a_valid_move()) {
            // No more valid moves, game over.
            this.status = GameStatus.GameOver;
        }

        return "";
    }

    // Returns the number of non-empty table cards.
    private count_table_cards(): number {
        let result = 0;
        for (let i = 0; i < GameState.NUM_TABLE_CARDS; i++) {
            if (!this.table_cards[i].is_empty()) {
                result++;
            }
        }
        return result;
    }

    // Returns true if at least one player has a valid move.
    private does_any_player_have_a_valid_move(): boolean {
        // If there are no table cards left then there are no valid moves left.
        if (this.count_table_cards() == 0) {
            return false;
        }

        // Otherwise, if at least one board is not full, then that player has a valid move.
        for (let i = 0; i < this.num_players; i++) {
            if (!this.get_board(i).is_full()) {
                return true;
            }
        }

        // All boards are full.
        return false;
    }

    public get_board(player_num: number): Board {
        assert(0 <= player_num);
        assert(player_num < this.boards.length);
        return this.boards[player_num];
    }

    public get_current_player() { return this.current_player; }

    public get_table_cards() { return this.table_cards; }

    public get_score(player_num: number): number {
        return this.get_board(player_num).compute_score();
    }

    public get_score_with_explanations(player_num: number): ScoreWithExplanations {
        return this.get_board(player_num).compute_score_with_explanations();
    }

    public get_status() { return this.status; }
}