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

    public static ResolveRule(ruleDef: any): Promise<any> {
        if (!ruleDef) return Promise.resolve(null);
        if (typeof ruleDef.rule === 'function') {
            return Promise.resolve(ruleDef.rule());
        }
        return Promise.resolve(ruleDef.rule);
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

        MultiplayR.ResolveRule(ruleDef).then((resolvedRule) => {
            const gameObj = new GameObject(transport,
                                           container);

            gameObj.rehost(ruleName,
                           resolvedRule,
                           roomId,
                           clientId,
                           gameState,
                           cb);
        }).catch(err => console.error("Error resolving rule:", err));
    }

    public static Host(
        ruleName: string,
        transport: ClientTransportInterface,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {
        const ruleDef = MultiplayR.gameRules[ruleName];

        MultiplayR.ResolveRule(ruleDef).then((resolvedRule) => {
            const gameObj = new GameObject(transport,
                                           container);
            gameObj.host(ruleName, resolvedRule, cb);
        }).catch(err => console.error("Error resolving rule:", err));
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

                           MultiplayR.ResolveRule(ruleDef).then((resolvedRule) => {
                               gameObj.setupRule(resolvedRule);
                               return forwardReturnMessage(res, cb);
                           }).catch(err => console.error("Error resolving rule:", err));
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

            MultiplayR.ResolveRule(ruleDef).then((resolvedRule) => {
                gameObj.setupRule(resolvedRule);
                return forwardReturnMessage(res, cb);
            }).catch(err => console.error("Error resolving rule:", err));
        });
    }

}

export default MultiplayR;
