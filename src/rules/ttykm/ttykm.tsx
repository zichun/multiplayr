import Shell from '../gameshell/gameshell';
import './ttykm.scss';

import {
    GameRuleInterface,
    MPType
} from '../../common/interfaces';

import { TTYKMGameState } from './ttykm_state';
import { TTYKMView } from './ttykm_views';

function get_gamestate(mp: MPType): TTYKMGameState {
    let state = mp.getData('gamestate');
    if (state && state.constructor.name !== 'TTYKMGameState') {
        state = TTYKMGameState.from_object(state);
    }
    return state;
}

function select_copy(mp: MPType, clientId: string, space: number) {
    const state = get_gamestate(mp);
    const turn = state.turn;

    // Verify it is this player's turn
    let otherId = null;
    mp.playersForEach((id) => {
        otherId = id;
    });

    const isHostTurn = (turn === 0 && clientId === mp.hostId);
    const isClientTurn = (turn === 1 && clientId === otherId);

    if (!isHostTurn && !isClientTurn) {
        throw new Error("It is not your turn");
    }

    state.selectCopy(space);
    mp.setData('gamestate', state);
}

function make_action(mp: MPType, clientId: string, action: any) {
    const state = get_gamestate(mp);
    const turn = state.turn;

    let otherId = null;
    mp.playersForEach((id) => {
        otherId = id;
    });

    const isHostTurn = (turn === 0 && clientId === mp.hostId);
    const isClientTurn = (turn === 1 && clientId === otherId);

    if (!isHostTurn && !isClientTurn) {
        throw new Error("It is not your turn");
    }

    state.performAction(action);
    mp.setData('gamestate', state);
}

function skip_actions(mp: MPType, clientId: string) {
    const state = get_gamestate(mp);
    const turn = state.turn;

    let otherId = null;
    mp.playersForEach((id) => {
        otherId = id;
    });

    const isHostTurn = (turn === 0 && clientId === mp.hostId);
    const isClientTurn = (turn === 1 && clientId === otherId);

    if (!isHostTurn && !isClientTurn) {
        throw new Error("It is not your turn");
    }

    state.skipActions();
    mp.setData('gamestate', state);
}

function move_focus(mp: MPType, clientId: string, newEra: number) {
    const state = get_gamestate(mp);
    const turn = state.turn;

    let otherId = null;
    mp.playersForEach((id) => {
        otherId = id;
    });

    const isHostTurn = (turn === 0 && clientId === mp.hostId);
    const isClientTurn = (turn === 1 && clientId === otherId);

    if (!isHostTurn && !isClientTurn) {
        throw new Error("It is not your turn");
    }

    state.moveFocusToken(newEra);
    mp.setData('gamestate', state);
}

function new_game(mp: MPType, clientId: string, config?: any) {
    if (clientId !== mp.hostId) {
        throw new Error("New game can only be started by host");
    }
    const state = new TTYKMGameState(config);
    mp.setData('gamestate', state);
}

export const TTYKMRule: GameRuleInterface = {
    name: 'ttykm',
    plugins: {
        'gameshell': Shell
    },
    globalData: {
        gamestate: null,
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

        let state = get_gamestate(mp);
        if (state === null) {
            state = new TTYKMGameState();
            mp.setData('gamestate', state);
        }

        clientIds.forEach((clientId, idx) => {
            if (clientId) {
                mp.setViewProps(clientId, 'boards', state.boards);
                mp.setViewProps(clientId, 'focusTokens', state.focusTokens);
                mp.setViewProps(clientId, 'supplies', state.supplies);
                mp.setViewProps(clientId, 'statueBuilt', state.statueBuilt);
                mp.setViewProps(clientId, 'turn', state.turn);
                mp.setViewProps(clientId, 'turnStep', state.turnStep);
                mp.setViewProps(clientId, 'activeCopySpace', state.activeCopySpace);
                mp.setViewProps(clientId, 'actionsRemaining', state.actionsRemaining);
                mp.setViewProps(clientId, 'winner', state.winner);
                mp.setViewProps(clientId, 'status', state.status);
                mp.setViewProps(clientId, 'config', state.config);
                mp.setViewProps(clientId, 'lastActionText', state.lastActionText);
                mp.setViewProps(clientId, 'player', idx);
            }
        });

        return true;
    },
    methods: {
        'select_copy': select_copy,
        'make_action': make_action,
        'skip_actions': skip_actions,
        'move_focus': move_focus,
        'new_game': new_game
    },
    views: {
        'main': TTYKMView
    }
};

export default TTYKMRule;
