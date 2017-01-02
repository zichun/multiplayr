/**
 * utils.ts
 *
 * Unit Test for utility functions in src/common/utils.ts.
 **/

import * as utils from '../common/utils';
import * as chai from 'chai';
import * as assert from 'assert';

const expect = chai.expect;

describe('utils', () => {

    describe('isArray', () => {

        it('should return true when the value is an array', () => {
            assert.equal(utils.isArray([]), true);
        });

        it('should return false when the value is a number', () => {
            assert.equal(utils.isArray(-1), false);
        });

        it('should return false when the value is an object', () => {
            assert.equal(utils.isArray({}), false);
        });
    });

    describe('isFunction', () => {

        it('should return true when the value is an array', () => {
            assert.equal(utils.isFunction([]), false);
        });

        it('should return false when the value is a number', () => {
            assert.equal(utils.isFunction(-1), false);
        });

        it('should return false when the value is an object', () => {
            assert.equal(utils.isFunction({}), false);
        });

        it('should return true when the value is a lambda', () => {
            assert.equal(utils.isFunction(() => {
                return true;
            }), true);
        });

        it('should return true when the value is a function', () => {
            assert.equal(utils.isFunction(utils.isFunction), true);
        });

        it('should return true when the value is a named function', () => {
            assert.equal(utils.isFunction(describe), true);
        });
    });

});
