import { shuffle } from '../../common/utils';

export enum BoardEl {
    Empty = 0,
    Empty_1,
    Empty_2,
    Empty_3,
    Empty_4,
    Empty_5,
    Empty_6,
    Empty_7,
    Empty_8,
    Empty_9,
    Mine,
    Unknown
}

export enum MinesweeperFlagsGameStatus {
    Playing,
    Gameover
}

export class MinesweeperFlagsGameState {
    private board: MinesweeperBoard;
    private turn: number;
    private score: number[];
    private status: MinesweeperFlagsGameStatus;
    private revealed: boolean[][];

    constructor(board: MinesweeperBoard) {
        this.board = board;
        this.new_game();
    }

    public get_turn() {
        return this.turn;
    }

    public get_status() {
        return this.status;
    }

    public get_score(player: number) {
        return this.score[player];
    }

    public get_revealed() {
        return this.revealed;
    }

    public new_game() {
        if (this.board.get_mines() % 2 !== 1) {
            throw new Error("Cannot create a game that has even number of mines");
        }

        this.turn = Math.round(Math.random());
        this.score = [0, 0];
        this.status = MinesweeperFlagsGameStatus.Playing;

        const rows = this.board.get_height();
        const cols = this.board.get_width();

        this.revealed = new Array(rows);
        for (let i = 0; i < rows; ++i) {
            this.revealed[i] = new Array(cols);
            for (let j = 0; j < cols; ++j) {
                this.revealed[i][j] = false;
            }
        }
    }

    public move(row: number, col: number): boolean {
        const rows = this.board.get_height();
        const cols = this.board.get_width();

        if (this.status === MinesweeperFlagsGameStatus.Gameover) {
            throw new Error("Game is over");
        } else if (row < 0 || row >= rows ||
            col < 0 || col >= cols) {
            throw new Error("Invalid row/col");
        } else if (this.revealed[row][col]) {
            throw new Error("Cannot make a move on revealed tile");
        }

        if (this.board.get_board(row, col) === BoardEl.Mine) {
            this.revealed[row][col] = true;
            this.score[this.turn] += 1;

            if (this.score[this.turn] * 2 > this.board.get_mines()) {
                this.status = MinesweeperFlagsGameStatus.Gameover;
                console.log("OPEN bomb - game is over");
            }

            return true;
        }

        const delta = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        const floodfill = (r: number, c: number) => {
            if (r < 0 || r >= rows || c < 0 || c >= cols ||
                this.board.get_board(r, c) === BoardEl.Mine ||
                this.revealed[r][c]) {
                return;
            }
            this.revealed[r][c] = true;

            if (this.board.get_board(r, c) === BoardEl.Empty) {
                for (const d of delta) {
                    floodfill(r + d[0], c + d[1]);
                }
            }
        };

        floodfill(row, col);

        this.turn = 1 - this.turn;
        return false;
    }

}

export class MinesweeperBoard {
    private board: BoardEl[][];

    private width: number;
    private height: number;
    private mines: number;

    get_width(): number {
        return this.width;
    }

    get_height(): number {
        return this.height;
    }

    get_mines(): number {
        return this.mines;
    }

    private constructor(mines_board: boolean[][]) {
        this.height = mines_board.length;
        this.width = mines_board[0].length;

        let mines = 0;
        this.board = new Array(this.height);
        for (let r = 0; r < this.height; ++r) {
            this.board[r] = new Array(this.width);
            for (let c = 0; c < this.width; ++c) {
                if (mines_board[r][c]) {
                    mines += 1;
                }
                this.board[r][c] = mines_board[r][c] ? BoardEl.Mine : BoardEl.Empty;
            }
        }

        this.mines = mines;

        const count_adjacent_mines = (r: number, c: number) => {
            let tr = 0;
            for (let rd = -1; rd <= 1; ++rd) {
                for (let cd = -1; cd <= 1; ++cd) {
                    const nr = r + rd;
                    const nc = c + cd;
                    if (nr < 0 || nc < 0 || nr >= this.height || nc >= this.width) {
                        continue;
                    }
                    if (this.board[nr][nc] === BoardEl.Mine) {
                        tr += 1;
                    }
                }
            }
            return tr;
        };

        for (let r = 0; r < this.height; ++r) {
            for (let c = 0; c < this.width; ++c) {
                if (this.board[r][c] !== BoardEl.Mine) {
                    this.board[r][c] = count_adjacent_mines(r, c);
                }
            }
        }
    }

    static from_parameters(width: number, height: number, mines: number) {
        if (width < 4 || width > 100 ||
            height < 4 || height > 100)
        {
            throw new Error("Invalid width/height");
        }
        if (mines <= 0 || mines >= width * height) {
            throw new Error("Invalid number of mines");
        }

        const flat_board: boolean[] = new Array(width * height);
        for (let i = 0; i < width * height; ++i) {
            flat_board[i] = (i < mines);
        }
        shuffle(flat_board);

        let index = 0;
        const board = new Array(height);
        for (let r = 0; r < height; ++r) {
            board[r] = new Array(width);
            for (let c = 0; c < width; ++c) {
                board[r][c] = flat_board[index];
                index += 1;
            }
        }

        return new MinesweeperBoard(board);
    }

    static from_mines_board(mines_board: boolean[][]) {
        return new MinesweeperBoard(mines_board);
    }

    get_board(row: number, col: number): BoardEl {
        if (row < 0 || row >= this.height ||
            col < 0 || col >= this.width) {
            throw new Error("Invalid row/col");
        }

        return this.board[row][col];
    }
}
