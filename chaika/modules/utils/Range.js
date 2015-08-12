/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["Range"];


/**
 * Range of number
 * @param {Number} start = 1 The start value of the range (inclusice).
 *                           We use 1 as default because a thread starts #1, not #0.
 * @param {Number} end = Infinity The end value of the range (exclusive).
 */
function Range(start = 1, end = Infinity){
    this._start = start;
    this._end = end;
    this._value = start;
}

Range.prototype = {

    toString() {
        return 'Range [' + this._start + ' ... ' + this._end + ']';
    },

    includes(searchValue) {
        return searchValue >= this._start &&
               searchValue <= this._end;
    },

    next() {
        return this._value < this._end ?
            { value: this._value++, done: false } :
            { done: true };
    }

};
