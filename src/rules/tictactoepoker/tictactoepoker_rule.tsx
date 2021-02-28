import Shell from '../gameshell/gameshell';
import './tictactoepoker.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import { TicTacToePokerView } from './tictactoepoker_views';

import { Board, GameState, GameStatus, Move } from './tictactoepoker';

function get_game_state(mp: MPType): GameState {
    let state = mp.getData('game_state');
    if (state && state.constructor.name !== 'GameState') {
        state = GameState.from_object(state);
    }
    return state;
}

function make_move(mp: MPType, clientId: string, move: Move): string {
    const state = get_game_state(mp);
    const turn = state.get_current_player();

    if ((turn === 0 && clientId !== mp.hostId) ||
        (turn === 1 && clientId === mp.hostId)) {
        throw new Error("Move by invalid player");
    }

    const result = state.apply_move(move);
    mp.setData('game_state', state);
    return result;
}

function new_game(mp: MPType, clientId: string) {
    if (clientId !== mp.hostId) {
        throw new Error("New game can only be called by host");
    }
    const state = new GameState(2, {enable_special_cards: false});
    state.start_new_game();
    mp.setData('game_state', state);
}

export const TicTacToePokerRule: GameRuleInterface = {
    name: 'tictactoepoker',
    plugins: {
        'gameshell': Shell
    },
    globalData: {
        game_state: null,
    },
    playerData: {},
    onDataChange: (mp: MPType) => {
        let otherId = null;

        mp.setView(mp.clientId, 'main');
        mp.playersForEach((clientId) => {
            otherId = clientId;
            mp.setView(clientId, 'main');
        });

        if (mp.playersCount() === 0) {
            mp.setViewProps(mp.hostId, 'waiting', true);
            return true;
        }

        mp.setViewProps(mp.hostId, 'waiting', false);
        const clientIds = [mp.hostId, otherId];

        let state = get_game_state(mp);
        if (state === null) {
            state = new GameState(2, {enable_special_cards: false});
            state.start_new_game();
            mp.setData('game_state', state);
        }

        let turn = state.get_current_player();
        let winner = -1;
        if (state.get_status() === GameStatus.GameOver) {
            let best_score = -1;
            let best_player = -1;
            for (let player = 0; player < state.get_num_players(); player++) {
                if (state.get_score(player) > best_score) {
                    best_score = state.get_score(player);
                    best_player = player;
                }
            }
            winner = best_player;
            turn = -1;
        }

        const boards = [];
        const scores = [];
        for (let player = 0; player < state.get_num_players(); player++) {
            boards.push(state.get_board(player));
            scores.push(state.get_score(player));
        }


        clientIds.forEach((clientId, index) => {
            mp.setViewProps(clientId, "num_players", state.get_num_players());
            mp.setViewProps(clientId, 'view_player', index);
            mp.setViewProps(clientId, 'winner', winner);
            mp.setViewProps(clientId, 'turn', turn);
            mp.setViewProps(clientId, 'boards', boards);
            mp.setViewProps(clientId, 'scores', scores);
            mp.setViewProps(clientId, 'table_cards', state.get_table_cards());
        });

        return true;
    },
    methods: {
        'make_move': make_move,
        'new_game': new_game
    },
    views: {
        'main': TicTacToePokerView,
    }
}

export default TicTacToePokerRule;
