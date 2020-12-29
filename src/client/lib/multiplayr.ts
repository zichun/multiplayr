/**
 * Multiplayr.ts
 */

import { ClientTransportInterface } from '../../common/interfaces';
import Session from './session';
import GameObject from './gameobject';

import { isArray, isFunction } from '../../common/utils';

import {
    checkReturnMessage,
    forwardReturnMessage
} from '../../common/messages';

import {
    CallbackType,
    ReturnPacketType,
    GameRuleWrapperInterface
} from '../../common/interfaces';

declare let MPGameObject;

export class MultiplayR {
    protected static gameRules: GameRuleWrapperInterface[] = [];
    protected static gamerulesPath = '';

    /**
     * Modular gamerules functions
     */

    public static SetGameRules(rules: GameRuleWrapperInterface[]) {
        MultiplayR.gameRules = rules;
    }

    public static SetGamerulesPath(path: string) {
        MultiplayR.gamerulesPath = path;
    }

    public static GetGamerulesPath() {
        return MultiplayR.gamerulesPath;
    }

    public static LoadRule(
        rule: any,
        cb: any
    ) {
        const src = (rule) => {
            return MultiplayR.gamerulesPath + rule + '/' + rule + '.js';
        };

        if (typeof rule === 'string') {
            MultiplayR.LoadJs(src(rule), cb);
        } else if (isArray(rule)) {
            // load them sequentially
            const cnt = rule.length;

            const loadNum = (ruleInd) => {
                MultiplayR.LoadJs(src(rule[ruleInd]), () => {
                    if (ruleInd + 1 === cnt && isFunction(cb)) {
                        cb();
                    } else if (ruleInd + 1 < cnt) {
                        loadNum(ruleInd + 1);
                    }
                });
            };

            loadNum(0);
        }
    }

    private static LoadJs(
        src: string,
        cb?: any
    ) {
        const scr = document.createElement('script');
        scr.setAttribute('src', src);
        scr.onload = cb;
        document.head.appendChild(scr);
    }

    private static LoadCss(
        src: string,
        cb?: any
    ) {
        const lnk = document.createElement('link');
        const stylesheet = 'stylesheet';

        // if (src.endsWith('.less')) {
        //     stylesheet = 'stylesheet/less';
        //     isLess = true;
        // }

        lnk.setAttribute('rel', stylesheet);
        lnk.setAttribute('type', 'text/css');
        lnk.setAttribute('href', src);
        lnk.onload = cb;
        document.head.appendChild(lnk);

        // if (isLess && typeof less != 'undefined') {
        //     less.sheets.push(lnk);
        //     less.refresh(true);
        // }
    }

    public static ReHost(
        ruleName: string,
        roomId: string,
        clientId: string,
        gameState: string,
        transport: ClientTransportInterface,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {
        const ruleDef = MultiplayR.gameRules[ruleName];

        const gameObj = new GameObject(transport,
                                       container);

        gameObj.rehost(ruleName,
                       ruleDef.rule,
                       roomId,
                       clientId,
                       gameState,
                       cb);
    }

    public static Host(
        ruleName: string,
        transport: ClientTransportInterface,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {
        const ruleDef = MultiplayR.gameRules[ruleName];

        const gameObj = new GameObject(transport,
                                       container);
        gameObj.host(ruleName, ruleDef.rule, cb);
    }

    public static ReJoin(
        roomId: string,
        clientId: string,
        transport: ClientTransportInterface,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {
        const gameObj = new GameObject(transport,
                                       container);
        gameObj.rejoin(roomId,
                       clientId,
                       (res: ReturnPacketType) => {
                           if (!checkReturnMessage(res, 'rule', cb)) {
                               return;
                           }

                           const rule = res.message;
                           const ruleDef = MultiplayR.gameRules[rule];

                           gameObj.setupRule(ruleDef.rule);

                           return forwardReturnMessage(res, cb);
                       });
    }

    public static Join(
        roomId: string,
        transport: ClientTransportInterface,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {

        const gameObj = new GameObject(transport,
                                       container);
        gameObj.join(roomId, (res: ReturnPacketType) => {
            if (!checkReturnMessage(res, 'rule', cb)) {
                return;
            }

            const rule = res.message;
            const ruleDef = MultiplayR.gameRules[rule];

            gameObj.setupRule(ruleDef.rule);

            return forwardReturnMessage(res, cb);
        });
    }

}

export default MultiplayR;
