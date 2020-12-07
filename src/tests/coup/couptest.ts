/**
 * couptest.ts
 *
 * Unit Test for Coup game rule
 **/

import * as chai from 'chai';
import * as assert from 'assert';

import { GameRuleTest } from '../GameRuleTest';
import {
    CoupAction,
    CoupReaction,
    CoupGameState,
    CoupCardState
} from '../../rules/coup/CoupTypes';

const basicState = '{\"hostStore\":{\"gameState\":1,\"playerTurn\":0,\"lastAction\":{\"player\":-1,\"action\":1,\"challenge\":-1,\"block\":-1},\"actions\":[],\"deck\":[2,5,5,4,5,3,1,4,4]},\"clientsStore\":{\"mp-client-njn6a17.88982934\":{\"coins\":4,\"cards\":[{\"card\":3,\"state\":1},{\"card\":5,\"state\":1}],\"isDead\":false},\"mp-client-olf6a24.33371757\":{\"coins\":4,\"cards\":[{\"card\":3,\"state\":1},{\"card\":1,\"state\":1}],\"isDead\":false},\"mp-client-00e6a35.39757958\":{\"coins\":4,\"cards\":[{\"card\":2,\"state\":1},{\"card\":1,\"state\":2}],\"isDead\":false}},\"pluginsStore\":{\"lobby\":\"{\\\"hostStore\\\":{\\\"started\\\":true},\\\"clientsStore\\\":{\\\"mp-client-njn6a17.88982934\\\":{\\\"name\\\":\\\"Leonard Stokes\\\",\\\"icon\\\":55,\\\"accent\\\":\\\"#2ECC40\\\"},\\\"mp-client-olf6a24.33371757\\\":{\\\"name\\\":\\\"Rose Barnett\\\",\\\"icon\\\":25,\\\"accent\\\":\\\"#7FDBFF\\\"},\\\"mp-client-00e6a35.39757958\\\":{\\\"name\\\":\\\"Richard Harper\\\",\\\"icon\\\":25,\\\"accent\\\":\\\"#FF851B\\\"}},\\\"pluginsStore\\\":{}}\",\"gameshell\":\"{\\\"hostStore\\\":{},\\\"clientsStore\\\":{\\\"mp-client-njn6a17.88982934\\\":{},\\\"mp-client-olf6a24.33371757\\\":{},\\\"mp-client-00e6a35.39757958\\\":{}},\\\"pluginsStore\\\":{}}\"}}';

describe('Coup Test', () => {

    describe('income action', () => {
        const couptest = new GameRuleTest('coup', 3);
        couptest.setState(basicState);

        couptest.invokeClientMethod(0, 'takeAction', CoupAction.Income, null);

        it('player should +1 gold', () => {
            assert.equal(couptest.getClientData(0, 'coins'), 5);
        });

        it('gameState should be PlayAction', () => {
            assert.equal(couptest.getHostData('gameState'), CoupGameState.PlayAction);
        });

        it('playerTurn should be 1', () => {
            assert.equal(couptest.getHostData('playerTurn'), 1);
        });
    });

    describe('assassin action', () => {
        const couptest = new GameRuleTest('coup', 3);
        couptest.setState(basicState);
        couptest.invokeClientMethod(0, 'takeAction', CoupAction.Assassin, couptest.getPlayerClientId(1));
        couptest.invokeHostMethod('endChallengePhase');
        couptest.invokeClientMethod(1, 'revealCard', '1');

        it('player should -3 gold', () => {
            assert.equal(couptest.getClientData(0, 'coins'), 1);
        });

        it('state should be PlayAction', () => {
            assert.equal(couptest.getHostData('gameState'), CoupGameState.PlayAction);
        });

        it('playerTurn should be 1', () => {
            assert.equal(couptest.getHostData('playerTurn'), 1);
        });

        it('target should lose card', () => {
            const cards = couptest.getClientData(1, 'cards');
            assert.equal(cards.length, 2);
            assert.equal(cards[0].state, CoupCardState.Active);
            assert.equal(cards[1].state, CoupCardState.Assassinated);
        });
    });

    describe('assassin action - block', () => {
        const couptest = new GameRuleTest('coup', 3);
        couptest.setState(basicState);
        couptest.invokeClientMethod(0, 'takeAction', CoupAction.Assassin, couptest.getPlayerClientId(1));
        couptest.invokeClientMethod(1, 'takeReaction', CoupReaction.Block);
        couptest.invokeHostMethod('endChallengePhase');

        it('player should -3 gold', () => {
            assert.equal(couptest.getClientData(0, 'coins'), 1);
        });

        it('state should be PlayAction', () => {
            assert.equal(couptest.getHostData('gameState'), CoupGameState.PlayAction);
        });

        it('target should not lose card', () => {
            const cards = couptest.getClientData(1, 'cards');
            assert.equal(cards.length, 2);
            for (let i = 0; i < 2; i = i + 1) {
                assert.equal(cards[i].state, CoupCardState.Active);
            }
        });

        it('playerTurn should be 1', () => {
            assert.equal(couptest.getHostData('playerTurn'), 1);
        });
    });

    describe('assassin action - block, block challenge, challenge failed', () => {
        const couptest = new GameRuleTest('coup', 3);
        couptest.setState(basicState);
        couptest.invokeClientMethod(0, 'takeAction', CoupAction.Assassin, couptest.getPlayerClientId(1));
        couptest.invokeClientMethod(1, 'takeReaction', CoupReaction.Block);
        couptest.invokeClientMethod(0, 'takeReaction', CoupReaction.Challenge);
        couptest.invokeClientMethod(1, 'revealCard', '0');
        couptest.invokeClientMethod(0, 'revealCard', '1');

        it('player should -3 gold', () => {
            assert.equal(couptest.getClientData(0, 'coins'), 1);
        });

        it('state should be PlayAction', () => {
            assert.equal(couptest.getHostData('gameState'), CoupGameState.PlayAction);
        });

        it('target should not lose card', () => {
            const cards = couptest.getClientData(1, 'cards');
            assert.equal(cards.length, 2);
            for (let i = 0; i < 2; i = i + 1) {
                assert.equal(cards[i].state, CoupCardState.Active);
            }
        });

        it('challenger should lose card', () => {
            const cards = couptest.getClientData(0, 'cards');
            assert.equal(cards.length, 2);
            assert.equal(cards[0].state, CoupCardState.Active);
            assert.equal(cards[1].state, CoupCardState.Challenged);
        });

        it('playerTurn should be 1', () => {
            assert.equal(couptest.getHostData('playerTurn'), 1);
        });
    });

    describe('ambassador action - challenge, challenge failed', () => {
        const couptest = new GameRuleTest('coup', 3);
        couptest.setState(basicState);
        couptest.invokeClientMethod(0, 'takeAction', CoupAction.Ambassador, null);
        couptest.invokeClientMethod(1, 'takeReaction', CoupReaction.Challenge);
        couptest.invokeClientMethod(0, 'revealCard', '1');
        couptest.invokeClientMethod(1, 'revealCard', '0');

        it('state should be AmbassadorCardChange', () => {
            assert.equal(couptest.getHostData('gameState'), CoupGameState.AmbassadorCardChange);
        });

        it('challenger should lose card', () => {
            const cards = couptest.getClientData(1, 'cards');
            assert.equal(cards.length, 2);
            assert.equal(cards[0].state, CoupCardState.Challenged);
            assert.equal(cards[1].state, CoupCardState.Active);
        });
    });

    describe('ambassador action - challenge, challenge failed cause dead', () => {
        const couptest = new GameRuleTest('coup', 3);
        couptest.setState(basicState);
        couptest.invokeClientMethod(0, 'takeAction', CoupAction.Ambassador, null);
        couptest.invokeClientMethod(2, 'takeReaction', CoupReaction.Challenge);
        couptest.invokeClientMethod(0, 'revealCard', '1');

        it('state should be AmbassadorCardChange', () => {
            assert.equal(couptest.getHostData('gameState'), CoupGameState.AmbassadorCardChange);
        });

        it('challenger should lose card', () => {
            const cards = couptest.getClientData(2, 'cards');
            assert.equal(cards.length, 2);
            assert.equal(cards[0].state, CoupCardState.Challenged);
            assert.equal(cards[1].state, CoupCardState.Challenged);
        });
    });
});
