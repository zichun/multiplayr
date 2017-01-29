/**
 * Multiplayr.js
 */

import SocketTransport from './socket.transport';
import Session from './session';
import GameObject from './gameobject';

import MPRULES from '../../rules/rules';

import {isArray, isFunction} from '../../common/utils';

import {checkReturnMessage,
        forwardReturnMessage} from '../../common/messages';

import {CallbackType,
        ReturnPacketType} from '../../common/types';

declare var MPGameObject;

export class MultiplayR {
    protected static gamerulesPath: string = '';

    /**
     * Modular gamerules functions
     */

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

    private static LoadRuleCss(
        ruleName: string,
        css: any,
        cb?: any
    ) {
        const src = (cssName) => {
            return MultiplayR.gamerulesPath + ruleName + '/' + cssName;
        }

        if (typeof css === 'string') {

            MultiplayR.LoadCss(src(css), cb);

        } else if (isArray(css)) {

            let cnt = css.length;
            let i = 0;

            for (i = 0; i < css.length; i = i + 1) {
                MultiplayR.LoadCss(src(css[i]), () => {
                    cnt = cnt - 1;
                    if (cnt === 0 && isFunction(cb)) {
                        cb();
                    }
                });
            }
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

    private static LoadRuleCssDeep(
        rule: any
    ) {
        MultiplayR.LoadRuleCss(rule.name, rule.css);

        if (rule.plugins) {
            Object.keys(rule.plugins).forEach((plugin) => {
                MultiplayR.LoadRuleCssDeep(rule.plugins[plugin]);
            });
        }
    }

    public static Host(
        rule: string,
        transport: SocketTransport,
        container: any,
        cb?: CallbackType
    ) {
        const ruleDef = MPRULES[rule];

        const gameObj = new GameObject(transport,
                                       container);
        gameObj.host(ruleDef.rule.name, ruleDef.rule, cb);
    }

    public static ReJoin(
        roomId: string,
        clientId: string,
        transport: SocketTransport,
        container: any,
        cb?: CallbackType
    ) {
        const gameObj = new GameObject(transport,
                                       container);
        gameObj.rejoin(roomId,
                       clientId,
                       (res: ReturnPacketType) => {
                           if (!res.success) {
                               return forwardReturnMessage(res, cb);
                           }

                           checkReturnMessage(res, 'rule');

                           const rule = res.message;
                           const ruleDef = MPRULES[rule];

                           gameObj.setupRule(ruleDef.rule);

                           return forwardReturnMessage(res, cb);
                       });
    }

    public static Join(
        roomId: string,
        transport: SocketTransport,
        container: any,
        cb?: CallbackType
    ) {

        const gameObj = new GameObject(transport,
                                       container);
        gameObj.join(roomId, (res: ReturnPacketType) => {
            if (!res.success) {
                return forwardReturnMessage(res, cb);
            }

            checkReturnMessage(res, 'rule');

            const rule = res.message;
            const ruleDef = MPRULES[rule];

            gameObj.setupRule(ruleDef.rule);

            return forwardReturnMessage(res, cb);
        });
    }

}

export default MultiplayR;
