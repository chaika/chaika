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
        /^https?:\/\/\w+\.bbspink\.com\/\w+\/$/,
        /^https?:\/\/\w+\.machi\.to\/\w+\/$/,
        /^https?:\/\/jbbs\.shitaraba\.net\/\w+\/\d+\/$/,
        /^https?:\/\/jbbs\.livedoor\.jp\/\w+\/\d+\/$/,
        /^https?:\/\/\w+\.2ch\.sc\/\w+\/$/,
        /^https?:\/\/xpic\.sc\/\w+\/$/,                     // part of 2ch.sc bbs
        /^https?:\/\/blogban\.net\/\w+\/$/,
        /^https?:\/\/ex14\.vip2ch\.com\/\w+\/$/,
        /^https?:\/\/\w+\.open2ch\.net\/\w+\/$/,
        /^https?:\/\/\w+\.jikkyo\.org\/\w+\/$/,
        /^https?:\/\/rikach\.usamimi\.info\/cgi-bin\/lnanusmm\/$/,  // part of jikkyo.org bbs
        /^https?:\/\/livech\.sakura\.ne\.jp\/livesalon\/$/,         // part of jikkyo.org bbs
        /^https?:\/\/super2ch\.net\/\w+\/$/,
        /^https?:\/\/next2ch\.net\/\w+\/$/,
        /^https?:\/\/bbs\.nicovideo\.jp\/(?:delete\/)?\w+\/$/,
        /^https?:\/\/nicodic\.razil\.jp\/\w+\/$/,
        /^https?:\/\/\w+\.plusvip\.jp\/\w+\/$/,
        /^https?:\/\/\w+\.m-ch\.jp\/\w+\/$/,
        /^https?:\/\/mch\.qp\.land\.to\/2ch\/$/,            // part of m-ch.jp bbs
        /^https?:\/\/uravip\.tonkotsu\.jp\/\w+\/$/,         // alias of 7gon.net
        /^https?:\/\/7gon\.net\/\w+\/$/,
        /^https?:\/\/septagon\.s602\.xrea\.com\/\w+\/$/,    // part of 7gon.net bbs
        /^https?:\/\/saradabird\.com\/\w+\/$/,
        /^https?:\/\/\w+\.mmobbs\.com\/\w+\/$/,
        /^https?:\/\/free2\.ch\/(?:original\/)?\w+\/$/,
        /^https?:\/\/ha10\.net\/\w+\/$/,
        /^https?:\/\/www\.bbs2ch\.net\/\w+\/$/,
        /^https?:\/\/friend\.ship\.jp\/\w+\/$/,             // alias of www.bbs2ch.net
        /^https?:\/\/refugee-chan\.mobi\/\w+\/$/,
        /^https?:\/\/rankstker\.net\/urisure\/$/,           // part of refugee-chan.mobi bbs
        /^https?:\/\/bbs\.unionbbs\.org\/\w+\/$/,
        /^https?:\/\/www\.2nn\.jp\/(?:refuge|temp)\/$/,
        /^https?:\/\/azlucky\.s28\.xrea\.com\/\w+\/$/,
    ],

    thread: [
        /\/test\/read\.cgi\//,
        /\/bbs\/read\.cgi\//,
    ]
};

let excludes = {
    board: [
        /* 2ch.net */
        /^https?:\/\/www\.2ch\.net\//,          // Top Page
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
        /^https?:\/\/ken\.2ch\.net\//,          // Prefecture Name Server
        /^https?:\/\/\w+\.2ch\.net\/_403\//,    // BBON House
        /^https?:\/\/\w+\.2ch\.net\/_service\//, // Server Log

        /* 2ch.sc */
        /^https?:\/\/find\.2ch\.sc\//,          // 2ch Search
        /^https?:\/\/info\.2ch\.sc\//,          // 2ch Wiki
        /^https?:\/\/be\.2ch\.sc\//,            // 2ch Be
        /^https?:\/\/c\.2ch\.sc\//,             // Mobile-version 2ch.sc
        /^https?:\/\/sp\.2ch\.sc\//,            // Smartphone-version 2ch.sc
        /^https?:\/\/p2\.2ch\.sc\//,            // p2 on 2ch.sc

        /* open2ch */
        /^https?:\/\/find\.open2ch\.net\//,     // open2ch Search
        /^https?:\/\/wiki\.open2ch\.net\//,     // open2ch Wiki
        /^https?:\/\/p2\.open2ch\.net\//,       // open p2
        /^https?:\/\/\w+\.open2ch\.net\/menu\//, // Top Menu

        /* bbspink.com */
        /^https?:\/\/www\.bbspink\.com\//,      // Top Page
        /^https?:\/\/headline\.bbspink\.com\//, // Headline on bbspink.com
        /^https?:\/\/update\.bbspink\.com\//,   // PINKheadline
        /^https?:\/\/ronin\.bbspink\.com\//,    // RONIN on bbspink.com
        /^https?:\/\/nyan\.bbspink\.com\//,     // nyan nyan
        /^https?:\/\/\w+\.bbspink\.com\/_service\//,    // Server Log

        /* jikkyo.org */
        /^https?:\/\/kita\.jikkyo\.org\/cbm\//,         // CBM Custom BBS Menu
        /^https?:\/\/free\.jikkyo\.org\/menu2ch\//,     // jikkyo board data
        /^https?:\/\/free\.jikkyo\.org\/i\//,           // Mobile-version Top Page
        /^https?:\/\/free\.jikkyo\.org\/j\//,           // jikkyo.org jump service
        /^https?:\/\/captain\.jikkyo\.org\/j\//,        // jikkyo.org jump service
        /^https?:\/\/captain\.jikkyo\.org\/wiki\//,     // jikkyo.org wiki
        /^https?:\/\/captain\.jikkyo\.org\/posts\//,    // jikkyo.org statistics
        /^https?:\/\/captain\.jikkyo\.org\/cat\//,      // JLAB uploader

        /* vip2ch.com */
        /^https?:\/\/ex14\.vip2ch\.com\/(?:m|monazilla)\//,
        /* plusvip.jp */
        /^https?:\/\/docs\.plusvip\.jp\//,
        /* m-ch.jp */
        /^https?:\/\/www\.m-ch\.jp\/mail\//,
        /* 7gon.net */
        /^https?:\/\/7gon\.net\/PONNAProject\//,
        /^https?:\/\/uravip\.tonkotsu\.jp\/PONNAProject\//,
        /* saradabird.com */
        /^https?:\/\/saradabird\.com\/(?:blog|TC)\//,
        /* mmobbs.com */
        /^https?:\/\/www\.mmobbs\.com\//,
        /* ha10.net */
        /^https?:\/\/ha10\.net\/(?:m|map|bbs|js|up|test|wiki)\//,
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

        let url = aURL.replace(/[\?#].*$/, '')
                      .replace(/\/(?:test|bbs)\/read\.cgi\/(.+?)\/\d{9,}.*$/, '/$1/');

        return includes.board.some((regexp) => regexp.test(url)) &&
               !excludes.board.some((regexp) => regexp.test(url));
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
