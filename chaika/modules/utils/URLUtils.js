/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["URLUtils"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { Range } = Cu.import("resource://chaika-modules/utils/Range.js", {});
let { ChaikaServer } = Cu.import("resource://chaika-modules/ChaikaServer.js", {});


/**
 * Polyfill for Firefox 39-
 */
if(!String.prototype.includes){
    String.prototype.includes = function(){'use strict';
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}


let includes = {
    board: [
        // Here we make sure these rules begin with "/^https?:\/\/"
        // so that they will keep compatible with TLS-version of these websites.
        // There is a decent posibility of switching from normal HTTP to SSL/TLS
        // in the future on any websites because Mozilla and other browser vendors are now
        // promoting deprecation of Non-Secure HTTP.
        //  cf.) http://t-webber.hatenablog.com/entry/2015/05/01/231948
        /^https?:\/\/\w+\.2ch\.net\/\w+\/$/,
        /^https?:\/\/\w+\.bbspink.com\/\w+\/$/,
        /^https?:\/\/\w+\.machi\.to\/\w+\/$/,
        /^https?:\/\/jbbs\.shitaraba\.net\/\w+\/\d+\/$/,
        /^https?:\/\/jbbs\.livedoor\.net\/\w+\/\d+\/$/,
        /^https?:\/\/\w+\.2ch\.sc\/\w+\/$/,
        /^https?:\/\/blogban\.net\/\w+\/$/,
        /^https?:\/\/ex14\.vip2ch\.com\/\w+\/$/,
        /^https?:\/\/\w+\.open2ch\.net\/\w+\/$/,
        /^https?:\/\/\w+\.jikkyo\.org\/\w+\/$/,
        /^https?:\/\/next2ch\.net\/\w+\/$/,
        /^https?:\/\/bbs\.nicovideo\.jp\/\w+\/$/,
        /^https?:\/\/\w+\.plusvip\.jp\/\w+\/$/,
        /^https?:\/\/\w+\.blogbbs\.net\/\w+\/$/,
        /^https?:\/\/\w+\.m-ch\.jp\/\w+\/$/,
        /^https?:\/\/uravip.tonkotsu\.jp\/\w+\/$/,
        /^https?:\/\/7gon\.jp\/\w+\/$/,
        /^https?:\/\/saradabird\.com\/\w+\/$/,
        /^https?:\/\/\w+\.2nn\.jp\/\w+\/$/,
    ],

    thread: [
        /\/test\/read\.cgi\//,
        /\/bbs\/read\.cgi\//,
    ]
};

let excludes = {
    board: [
        /* 2ch.net */
        /^https?:\/\/find\.2ch\.net\//,         // 2ch Search
        /^https?:\/\/dig\.2ch\.net\//,          // 2ch Thread Search
        /^https?:\/\/search\.2ch\.net\//,       // 2ch Search
        /^https?:\/\/info\.2ch\.net\//,         // 2ch Wiki
        /^https?:\/\/wiki\.2ch\.net\//,         // 2ch Wiki
        /^https?:\/\/developer\.2ch\.net\//,    // Notice of new specs for 2ch dedicated browser developers
        /^https?:\/\/notice\.2ch\.net\//,       // Notice of new features for 2ch users and developers
        /^https?:\/\/headline\.2ch\.net\//,     // Headline on 2ch.net
        /^https?:\/\/newsnavi\.2ch\.net\//,     // 2channel News Navigator (2NN)
        /^https?:\/\/api\.2ch\.net\//,          // 2ch API entry point
        /^https?:\/\/be\.2ch\.net\//,           // 2ch Be 2.0
        /^https?:\/\/stats\.2ch\.net\//,        // 2ch Hot Threads
        /^https?:\/\/c\.2ch\.net\//,            // Mobile-version 2ch.net
        /^https?:\/\/itest\.2ch\.net\//,        // Smartphone-version 2ch.net
        /^https?:\/\/i\.2ch\.net\//,            // Smartphone-version 2ch.net
        /^https?:\/\/menu\.2ch\.net\//,         // BBSMENU
        /^https?:\/\/p2\.2ch\.net\//,           // Ads of Ronin
        /^https?:\/\/conbini\.2ch\.net\//,      // Ads of Ronin
        /^https?:\/\/premium\.2ch\.net\//,      // Ads of Ronin
        /^https?:\/\/irc\.2ch\.net\//,          // IRC

        /* 2ch.sc */
        /^https?:\/\/find\.2ch\.sc\//,          // 2ch Search
        /^https?:\/\/info\.2ch\.sc\//,          // 2ch Wiki
        /^https?:\/\/be\.2ch\.sc\//,            // 2ch Be 2.0
        /^https?:\/\/c\.2ch\.sc\//,             // Mobile-version 2ch.net
        /^https?:\/\/p2\.2ch\.sc\//,            // Ads of Ronin

        /* bbspink.com */
        /^https?:\/\/headline\.bbspink\.net\//, // Headline on bbspink.com

        /* jikkyo.org */
        /^https?:\/\/kita\.jikkyo\.org\/cbm\//,         // CBM Custom BBS Menu
    ],

    thread: [
    ]
}


/**
 * URL に対し, chaika が絡む処理をまとめる
 */
this.URLUtils = {

    /**
     * The URL of the local server.
     * @type {String}
     * @example http://127.0.0.1:8823/
     */
    get serverURL(){
        return ChaikaServer.serverURL.spec;
    },


    /**
     * Returns true if a URL indicates the page in chaika-view mode.
     * @param {String} aURL
     * @return {Bool}
     */
    isChaikafied: function(aURL){
        return aURL.startsWith('chaika://') ||
               aURL.startsWith('chrome://chaika/') ||
               aURL.startsWith(this.serverURL);
    },


    /**
     * Returns true if a URL indicates the page is in BBS service, i.e., a board or a thread.
     * @param {String} aURL
     * @return {Bool}
     */
    isBBS: function(aURL){
        if(this.isChaikafied(aURL)){
            return true;
        }

        if(!aURL.startsWith('http')){
            return false;
        }

        return includes.board.some((regexp) => regexp.test(aURL)) &&
               !excludes.board.some((regexp) => regexp.test(aURL));
    },


    /**
     * Returns true if a URL indicates the page is a board.
     * ("Board" is a home page of list of threads about a certain topic.)
     * @param {String} aURL
     * @return {Bool}
     */
    isBoard: function(aURL){
        return this.isBBS(aURL) && !this.isThread(aURL);
    },


    /**
     * Returns true if a URL indicates the page is a thread.
     * @param {String} aURL
     * @return {Bool}
     */
    isThread: function(aURL){
        return includes.thread.some((regexp) => regexp.test(aURL)) &&
               !excludes.thread.some((regexp) => regexp.test(aURL));
    },


    /**
     * Convert a chaika-mode URL to a normal-mode URL.
     * @param {String} aURL
     * @return {String}
     */
    unchaikafy: function(aURL){
        return aURL.replace(this.serverURL + 'thread/', '')
                   .replace(/^chaika:\/\/[a-z]*\/?/, '')
                   .replace(/^chrome:\/\/chaika\/content\/board\/page\.xul\?(?:.*&)?url=([^&#]*).*$/, '$1');
    },


    /**
     * Convert a normal-mode URL to a chaika-mode URL
     * @param {String} aURL
     * @return {String}
     */
    chaikafy: function(aURL){
        let chaikafied;

        if(this.isThread(aURL)){
            chaikafied = this._chaikafyThread(aURL);
        }else{
            chaikafied = this._chaikafyBoard(aURL);
        }

        return chaikafied.replace(/[\?&]?chaika_force_browser=1/, '');
    },


    /**
     * @param {String} aURL
     * @return {String}
     */
    _chaikafyBoard: function(aURL){
        return 'chrome://chaika/content/board/page.xul?url=' + aURL.replace('?', '&');
    },


    /**
     * @param {String} aURL
     * @return {String}
     */
    _chaikafyThread: function(aURL){
        return this.serverURL + 'thread/' + aURL;
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
        if(str.includes(',') || str.includes('+')){
            return str.split(/,\+/).map((range) => this._parseRange(range, upos));
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

            if(str.includes('n')){
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


        let [begin, end] = str.split('-');

        return new Range(begin || undefined, end || undefined);
    }

};
