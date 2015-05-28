/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["Thread", "ThreadMetadata"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { FileUtils } = Cu.import('resource://gre/modules/FileUtils.jsm', {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});
let { Range } = Cu.import("resource://chaika-modules/utils/Range.js", {});
let { Board } = Cu.import("resource://chaika-modules/Board.js", {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


/**
 * @param {String} aURL
 */
function Thread(aURL){
    this.origURL = aURL;
}

Thread.prorotype = {

    /**
     * @type {String}
     */
    get id() {

    },


    /**
     * a Board object to which this thread belongs.
     * @type {Board}
     */
    get board() {
        if(!this._board){
            this._board = new Board(this.origURL);
        }

        return this._board;
    },


    /**
     * a path string of thread's source, e.g., a dat file on 2ch-like BBS, in the local disk.
     * @type {String}
     */
    get source() {
        let path = OS.Path.join(FileIO.Path.logDir, this.board.id, this.id);

        return path;
    },


    /**
     * URL string without any filter strings.
     * @type {String}
     */
    get url() {
        if(this._url){
            this._url = this.origURL.replace(/[^\/]+$/, '');
        }

        return this._url;
    },


    /**
     * Thread filter string that represents a range or
     * specific numbers of posts in a thread to show.
     * @type {String}
     */
    get filterStr() {
        if(!this._filterStr){
            this._filterStr = this.origURL.replace(/^.*\//, '');
        }

        return this._filterStr;
    },


    /**
     * Iteratable object that represents a thread filter.
     * @type {ThreadFilter}
     */
    get filter() {
        if(!this._filter){
            this._filter = new ThreadFilter(this.filterStr);
        }

        return this._filter;
    }
};



/**
 * Parser for a thread filter string
 * @param {String} aFilterStr String that represents a range of thread to show
 * @param {Number} [unreadPosition] Optional but require if aFilterStr is like 'l30'
 */
function ThreadFilter(aFilterStr, unreadPosition){
    this._range = this.parse(aFilterStr, unreadPosition);
}

ThreadFilter.prototype = {

    // [official]
    // (blank) -> 1-
    // n -> 2-
    // 10 -> 10
    // 3-5 -> 1,3-5
    // 3-5n -> 3-5
    // 10- -> 1,10-
    // 10n- -> 10-
    // -5 -> 1-5
    // -5n -> 1-5
    // l10 -> 1,l10
    // l10n -> l10
    //
    // [non-standard extends]
    // 2,5,10 -> 2,5,10
    // 2+5+10 -> 2,5,10
    // 2,5-7,9 -> 2,5-7,9
    // -3,5 -> 1-3,5
    // 5,10- -> 5,10-

    parse(str, upos) {
        if(str.contains(',') || str.contains('+')){
            return str.split(/[,\+]/).map((range) => this._parseRange(range, upos));
        }else{
            // A blank filter means a request for all posts from the first.
            if(str === ''){
                return [this._parseRange('1-', upos)];
            }

            // 'n' means a request for all posts except for the first.
            if(str === 'n'){
                return [this._parseRange('2-', upos)];
            }

            // Simple number
            if(/^\d+$/.test(str)){
                return [Number.parseInt(str, 10)];
            }

            if(str.contains('n')){
                return [this._parseRange(str.replace(/n/g, ''))];
            }else{
                let _range = this._parseRange(str, upos);

                if(_range.includes(1)){
                    return [_range];
                }else{
                    return [1, _range];
                }
            }

            throw new Error('Unexpected token: ' + str);
        }
    },


    _parseRange(str, upos) {
        if(str.startsWith('l')){
            let limit = str.replace(/l/g, '') - 0;

            return new Range(upos - limit, upos - 1);
        }

        if(/^\d+$/.test(str)){
            return Number.parseInt(str, 10);
        }


        let [start, end] = str.split('-');

        return new Range(start || undefined, end || undefined);
    }

};
