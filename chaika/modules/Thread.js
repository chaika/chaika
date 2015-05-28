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

