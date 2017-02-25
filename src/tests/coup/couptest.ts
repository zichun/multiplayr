/**
 * couptest.ts
 *
 * Unit Test for Coup game rule
 **/

import * as chai from 'chai';
import * as assert from 'assert';

import {
    CreateRoomReturnPacketType,
    GetRuleReturnPacketType
} from '../../common/interfaces';

import { configureLoadStyles } from '@microsoft/load-themed-styles';
configureLoadStyles((styles) => {});
global['window'] = {document: {}};

import { checkReturnMessage } from '../../common/messages';
import { LocalClientTransport } from '../../client/lib/local.transport';
import { MPRULES } from '../../rules/rules';
import { GameObject } from '../../client/lib/gameobject';

class GameRuleTest {
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

    public setState(state: string) {
        this.hostGameObject.setState(state, true);
    }
}

const couptest = new GameRuleTest('coup', 3);
