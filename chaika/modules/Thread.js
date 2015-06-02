/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["ThreadFactory", "ThreadDB"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { BoardPluginLoader } = Cu.import('resource://chaika-modules/plugins/BoardPluginLoader.js', {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { Sqlite } = Cu.import('resource://gre/modules/Sqlite.jsm', {});
let { Task } = Cu.import('resource://gre/modules/Task.jsm', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { Range } = Cu.import("resource://chaika-modules/utils/Range.js", {});
let { Board } = Cu.import("resource://chaika-modules/Board.js", {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


let ThreadFactory = {

    create(url) {
        let thread = new Thread(url);
        let plugin = BoardPluginLoader.get(url).thread;

        return new Proxy(thread, {
            get(target, name) {
                if(name in plugin){
                    return plugin[name];
                }

                if(name in target){
                    return target[name];
                }

                return undefined;
            }
        });
    }

};



/**
 * URL manipulation and data accessing accosiated with a Thread.
 * Some methods are left to be abstract method,
 * which are expected to be implemented by board plugins loaded by BoardPluginLoader.
 *
 * @param {String} aURL
 */
function Thread(aURL){
    this.origURL = aURL;
}

Thread.prototype = {

    /**
     * a Board object to which this thread belongs.
     * @type {Board}
     */
    get board() {
        if(!this._board){
            this._board = new Board(this.url);
        }

        return this._board;
    },


    /**
     * a relative path of thread's source from FileIO.Path.logDir.
     * @abstract
     * @return {String}
     */
    get sourcePath() {},


    /**
     * a path string of thread's source, e.g., a dat file on 2ch-like BBS, in the local disk.
     * @type {String}
     */
    get source() {
        let path = OS.Path.join(FileIO.Path.logDir, ...this.sourcePath.split('/'));
        return path;
    },


    /**
     * URL string without any filter strings.
     * @abstract
     * @type {String}
     */
    get url() {},


    /**
     * Thread filter string that represents a range or
     * specific numbers of posts in a thread to show.
     * @abstract
     * @type {String}
     */
    get filterStr() {},


    /**
     * Iteratable object that represents a thread filter.
     * @type {ThreadFilter}
     */
    get filter() {
        if(!this._filter){
            this._filter = new ThreadFilter(this.filterStr);
        }

        return this._filter;
    },


    /**
     * Accessor for metadata of this thread, such as title, state, # of fetched posts.
     * @type {ThreadMetadata}
     */
    get metadata() {
        if(!this._metadata){
            this._metadata = new ThreadMetadata(this.url);
        }

        return this._metadata;
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
    },


    apply(posts, isLocal) {
        return Promise.resolve(posts);
    }

};



function ThreadMetadata(url){
    this._url = url;

    this._init();
}

ThreadMetadata.prototype = {

    SQL_SELECT: "SELECT * FROM threads WHERE url=:url",

    SQL_UPDATE: `UPDATE threads
                 SET title=:title,
                     closed=:closed,
                     fetched_index=:fetched_index,
                     read_index=:read_index
                 WHERE url=:url`,

    SQL_INSERT: "INSERT INTO threads VALUES (:url, :title, :closed, :fetched_index, :read_index)",


    _init() {
        this._row = ThreadDB.conn.then((conn) => {
            return conn.executeCached(this.SQL_SELECT, { url: this._url });
        }).then((rows) => {
            return rows && rows.length > 0 ? rows[0] : null;
        });
    },


    /**
     * Getting a value that has a given key name from the threads' database.
     * @param  {String} key key name. See ThreadDB.SQL_TABLE_CREATION for available keys.
     * @return {Promise<String|Boolean>}     the value.
     * @see TheadDB.SQL_TABLE_CREATION
     */
    get(key) {
        return this._row.then((row) => {
            if(!row){
                Logger.warn('The metadata of this thread is not stored yet.');
                return null;
            }

            return row.getResultByName(key);
        });
    },


    set(map) {
        return Promise.all([ThreadDB.conn, this._row]).then(([conn, row]) => {
            let data = {};

            data.url = this._url;

            ['title', 'closed', 'fetched_index', 'read_index'].forEach((key) => {
                if(map[key] !== undefined){
                    data[key] = map[key];
                }else{
                    data[key] = row ? row.getResultByName(key) : null;
                }
            });

            if(row){
                return conn.executeCached(this.SQL_UPDATE, data);
            }else{
                return conn.executeCached(this.SQL_INSERT, data);
            }
        });
    }

};



let ThreadDB = {

    SQL_TABLE_CREATION: `
        CREATE TABLE threads(
            url           TEXT NOT NULL UNIQUE, /* a url of a thread. */
            title         TEXT,                 /* a title of a thread. */
            closed        BOOLEAN,              /* true if a thread is already ended,
                                                   i.e., no one can post a comment
                                                   to the thread any more. */
            fetched_index INTEGER DEFAULT 0,    /* # of posts downloaded in the local disk. */
            read_index    INTEGER DEFAULT 0     /* # of posts a user has read. */
        );`,


    startup() {
        let path = OS.Path.join(FileIO.Path.logDir, 'threads.sqlite');

        this.conn = Task.spawn(function* () {
            let conn = yield Sqlite.openConnection({ path });
            let exist = yield conn.tableExists('threads');

            if(!exist){
                yield conn.execute(ThreadDB.SQL_TABLE_CREATION);
            }

            return conn;
        });
    },


    quit() {
        this.conn.then((conn) => conn.close());
    }

};
