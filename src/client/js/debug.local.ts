/**
 * debug.local.ts
 *
 * Centralized script to run any local debugger or display the selection portal.
 */

import { GetRuleReturnPacketType, ViewPropsInterface } from '../../common/interfaces';
import { checkReturnMessage, forwardReturnMessage } from '../../common/messages';
import { GameObject } from '../lib/gameobject';
import { MinesweeperflagsViewPropsInterface } from '../../rules/minesweeperflags/minesweeperflags_views';
import { MinesweeperflagsAIBasic } from '../../rules/minesweeperflags/minesweeperflags_ai';

/* eslint-disable no-var */
declare var _mplib;
declare var _mprules;

_mplib.MultiplayR.SetGameRules(_mprules.MPRULES);
_mplib.MultiplayR.SetGamerulesPath('/gamerules/');

const DEFAULT_CLIENTS: Record<string, number> = {
    avalon: 10,
    coup: 6,
    theoddone: 8,
    decrypto: 8,
    minesweeperflags: 2,
    tictactoepoker: 2,
    ito: 4,
    drawing: 4,
    catchsketch: 4,
    durian: 4,
    startups: 3,
    clever: 4,
    ttykm: 1
};

const GAME_NAMES: Record<string, string> = {
    avalon: 'Avalon',
    coup: 'Coup',
    theoddone: 'The Odd One',
    decrypto: 'Decrypto',
    minesweeperflags: 'Minesweeper Flags',
    tictactoepoker: 'Tic-Tac-Toe Poker',
    ito: 'Ito',
    drawing: 'Drawing',
    catchsketch: 'Catch Sketch',
    durian: 'Durian',
    startups: 'Startups',
    clever: 'Clever',
    ttykm: 'That Time You Killed Me'
};

function getDebugConfigs(): Record<string, any> {
    const configs: Record<string, any> = {};
    const rules = _mprules.MPRULES;

    for (const key of Object.keys(rules)) {
        if (rules[key].debug) {
            const gameId = key.replace('-debug', '');
            const gameName = GAME_NAMES[gameId] || (gameId.charAt(0).toUpperCase() + gameId.slice(1));
            const icon = (rules[gameId] && rules[gameId].icon) || rules[key].icon || '🎮';
            
            configs[gameId] = {
                gameId: gameId,
                gameName: gameName,
                ruleName: key,
                defaultClientsCount: DEFAULT_CLIENTS[gameId] || 4,
                description: rules[gameId] ? rules[gameId].description : (rules[key].description || ''),
                icon: icon
            };

            // Special configuration for Minesweeper Flags AI
            if (gameId === 'minesweeperflags') {
                configs[gameId].hasAI = true;
                configs[gameId].setupAI = (roomId: string, container: HTMLElement) => {
                    const transport = new _mplib.LocalClientTransport();
                    const gameObj = new GameObject(transport, container);
                    const ai = new MinesweeperflagsAIBasic();

                    gameObj.setViewCallback(
                        (_display: string, props: ViewPropsInterface) => {
                            const inside = (props as any).minesweeperflags;
                            setTimeout(() => {
                                ai.onPropsChange(inside as MinesweeperflagsViewPropsInterface);
                            }, 500);
                        }
                    );

                    gameObj.join(
                        roomId,
                        (res: GetRuleReturnPacketType) => {
                            checkReturnMessage(res, 'rule');
                            gameObj.setupRule(_mprules.MPRULES[res.message].rule);
                            return forwardReturnMessage(res);
                        }
                    );
                };
            }
        }
    }
    return configs;
}

function renderDashboard(configs: Record<string, any>) {
    // Clear existing body elements safely, leaving script tags intact
    $('body').children().not('script').remove();

    // Set page background
    $('body').css({
        'background-color': '#0f172a',
        'background-image': 'radial-gradient(circle at top right, rgba(30, 41, 59, 0.7), transparent 800px)',
        'min-height': '100vh',
        'margin': '0',
        'padding': '0'
    });

    const $container = $('<div class="debug-portal-container"></div>');
    const $header = $(`
        <header class="portal-header">
            <span class="portal-logo">⚡</span>
            <h1 class="portal-title">MultiplayR <span class="accent">Debug Portal</span></h1>
            <p class="portal-subtitle">Select a game rule to launch the pass-and-play local debugger environment</p>
        </header>
    `);

    const $grid = $('<div class="portal-grid"></div>');

    for (const gameId of Object.keys(configs)) {
        const conf = configs[gameId];
        const emoji = conf.icon || '🎮';
        
        const $card = $(`
            <div class="portal-card" data-game="${gameId}">
                <div class="card-top">
                    <span class="card-icon">${emoji}</span>
                    <div class="card-meta">
                        <h3 class="card-title">${conf.gameName}</h3>
                        <span class="card-badge">${conf.defaultClientsCount} Players</span>
                    </div>
                </div>
                <p class="card-desc">${conf.description || 'No description available for this game.'}</p>
                <button class="card-btn">
                    Launch Debugger <i class="fa fa-chevron-right" aria-hidden="true"></i>
                </button>
            </div>
        `);

        $card.on('click', () => {
            window.location.search = `?game=${gameId}`;
        });

        $grid.append($card);
    }

    $container.append($header).append($grid);
    $('body').append($container);
}

$(() => {
    const configs = getDebugConfigs();
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');

    if (gameParam && configs[gameParam]) {
        _mplib.DebuggerUI.init(configs[gameParam]);
    } else {
        renderDashboard(configs);
    }
});
