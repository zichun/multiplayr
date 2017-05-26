/**
 * GameRuleTest.ts - class wrapper to test a game rule.
 */

import { configureLoadStyles } from '@microsoft/load-themed-styles';
configureLoadStyles((styles) => {});
global['window'] = {document: {}, location: {href: '', protocol: ''}, addEventListener: () => {}, removeEventListener: () => {}};
global['document'] = {createElement: () => { return {}; }, location: { protocol: ''}, getElementById: () => {}};
global['navigator'] = {userAgent: ''};

import {
    CreateRoomReturnPacketType,
    GetRuleReturnPacketType
} from '../common/interfaces';

import { checkReturnMessage } from '../common/messages';
import { LocalClientTransport } from '../client/lib/local.transport';
import { MPRULES } from '../rules/rules';
import { GameObject } from '../client/lib/gameobject';

export class GameRuleTest {
    private hostGameObject: GameObject;
    private clientsGameObjects: GameObject[];

    constructor(
        ruleName: string,
        clientsCount: number,
        initialState?: string
    ) {
        const ruleDef = MPRULES[ruleName];

        if (!ruleDef) {
            throw (new Error('Rule ' + ruleName + ' does not exists.'));
        }

        this.clientsGameObjects = [];

        //
        // Create the host.
        //
        this.hostGameObject = new GameObject(new LocalClientTransport(), null);
        this.hostGameObject.host(
            ruleName,
            ruleDef.rule,
            (res: CreateRoomReturnPacketType) => {

                checkReturnMessage(res, 'roomId')
                const roomId = res.roomId;

                //
                // Create client game objects and join the host's room.
                //
                for (let i = 0; i < clientsCount; i = i + 1) {

                    const clientGameObject = new GameObject(new LocalClientTransport(), null);

                    clientGameObject.join(
                        roomId,
                        (res: GetRuleReturnPacketType) => {
                            checkReturnMessage(res, 'rule');
                            clientGameObject.setupRule(ruleDef.rule);
                        });

                    this.clientsGameObjects.push(clientGameObject);
                }
            }
        );

        if (initialState) {
            this.setState(initialState);
        }
    }

    public getClientData(
        player: number,
        variable: string
    ) {
        if (player < 0 || player >= this.clientsGameObjects.length) {
            throw (new Error('Invalid player count'));
        }
        const clientId = this.getPlayerClientId(player);
        return this.hostGameObject.getMPObject().getPlayerData(clientId, variable);
    }

    public getHostData(
        variable: string
    ) {
        return this.hostGameObject.getMPObject().getData(variable);
    }

    public getPlayerClientId(player: number) {
        if (player < 0 || player >= this.clientsGameObjects.length) {
            throw (new Error('Invalid player count'));
        }
        return this.clientsGameObjects[player].getClientId();
    }

    public invokeClientMethod(
        player: number,
        method: string,
        ...args: any[]
    ) {
        if (player < 0 || player >= this.clientsGameObjects.length) {
            throw (new Error('Invalid player count'));
        }
        this.clientsGameObjects[player].getMPObject()[method](...args);
    }

    public invokeHostMethod(
        method: string,
        ...args: any[]
    ) {
        this.hostGameObject.getMPObject()[method](...args);
    }

    public setState(state: string) {
        this.hostGameObject.setState(state, true);
    }
}

export default GameRuleTest;
