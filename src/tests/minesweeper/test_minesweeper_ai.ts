import * as assert from 'assert';

import { GameRuleTest } from '../GameRuleTest';
import { MinesweeperflagsAI } from '../../rules/minesweeperflags/minesweeperflags_ai';

const basicState = '{\"hostStore\":{\"gamestate\":{\"board\":{\"height\":16,\"width\":16,\"board\":[[0,0,0,1,1,1,0,1,2,10,10,1,1,10,1,0],[2,2,1,1,10,2,1,2,10,3,2,1,1,1,1,0],[10,10,1,1,1,2,10,2,1,2,2,2,1,1,2,2],[2,2,1,0,0,1,1,2,2,3,10,10,2,2,10,10],[0,0,0,0,0,0,1,2,10,10,3,3,10,2,3,3],[0,0,0,0,0,0,2,10,4,2,1,2,2,2,2,10],[0,0,1,1,1,0,3,10,4,1,1,1,10,1,3,10],[1,1,2,10,2,0,2,10,4,10,1,1,1,1,2,10],[10,1,2,10,2,0,1,3,10,4,2,0,0,0,1,1],[1,1,1,1,1,0,1,3,10,10,1,0,0,0,0,0],[0,0,0,1,1,1,2,10,4,2,1,0,1,1,1,0],[0,1,1,2,10,2,3,10,2,1,1,1,2,10,3,1],[1,3,10,3,1,2,10,2,1,1,10,2,3,10,3,10],[2,10,10,3,2,4,3,2,1,2,4,10,4,2,3,2],[2,10,4,4,10,10,10,1,1,10,3,10,10,1,1,10],[1,2,10,3,10,4,2,1,1,1,2,2,2,1,1,1]],\"mines\":51},\"status\":0,\"turn\":0,\"score\":[0,0],\"last_moves\":[null,null],\"bombs_left\":[1,1],\"revealed\":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}},\"clientsStore\":{\"mp-client-1m2m508.82698217\":{}},\"pluginsStore\":{\"gameshell\":\"{\\\"hostStore\\\":{},\\\"clientsStore\\\":{\\\"mp-client-1m2m508.82698217\\\":{}},\\\"pluginsStore\\":{}}"}}';

describe('Minesweeper AI Test', () => {
    describe('basic test', () => {
        const mstest = new GameRuleTest('minesweeperflags', 1);
        const ai = new MinesweeperflagsAI();

        mstest.setAIPlayer(0, ai, {
            'make_move': (_mp, original_method, r, c) => {
                console.log('AI Made move: ' + r + ', ' + c);
                original_method(r, c);
            }
        });
        mstest.setState(basicState);

        it('AI has made move', () => {
            assert.strictEqual(mstest.getHostData('gamestate').turn, 0);
        });

    });
});
