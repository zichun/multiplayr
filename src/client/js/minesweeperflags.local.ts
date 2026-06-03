/**
 * minesweeperflags.local.ts
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

$(() => {
    _mplib.DebuggerUI.init({
        gameId: 'minesweeperflags',
        gameName: 'Minesweeper Flags',
        ruleName: 'minesweeperflags-debug',
        defaultClientsCount: 2,
        hasAI: true,
        setupAI: (roomId: string, container: HTMLElement) => {
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
        }
    });
});
