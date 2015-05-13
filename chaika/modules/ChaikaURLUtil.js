/* See license.txt for terms of usage */

EXPORTED_SYMBOLS = ["ChaikaURLUtil"];


const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://chaika-modules/ChaikaServer.js");


const BBS_DOMAINS = [
    '2ch.net',
    'bbspink.com',
    'machi.to',
    'jbbs.livedoor.jp',
    'jbbs.shitaraba.net'
];


const EXCLUDE_DOMAINS = [
    "find.2ch.net",
    "info.2ch.net",
    "epg.2ch.net",
    "headline.2ch.net",
    "newsnavi.2ch.net",
    "headline.bbspink.com"
];


/**
 * URL に対し, chaika が絡む処理をまとめる
 */
let ChaikaURLUtil = {

    /**
     * The URL of the local server.
     * @type {String}
     * @example http://127.0.0.1:8823/
     */
    get serverURL(){
        return ChaikaServer.serverURL.spec;
    },


    /**
     * @param {String} aURL
     * @return {Bool}
     */
    isChaikafied: function(aURL){
        return aURL.startsWith('chaika://') || aURL.startsWith(this.serverURL);
    },


    /**
     * @param {String} aURL
     * @return {Bool}
     */
    isBBS: function(aURL){
        let url = Services.io.newURI(aURL, null, null);

        return BBS_DOMAINS.some((domain) => url.host.contains(domain)) &&
               !EXCLUDE_DOMAINS.some((domain) => url.host.contains(domain));
    },


    /**
     * @param {String} aURL
     * @return {Bool}
     */
    isBoard: function(aURL){
        return this.isBBS(aURL) && !this.isThread(aURL);
    },


    /**
     * @param {String} aURL
     * @return {Bool}
     */
    isThread: function(aURL){
        return aURL.contains('/read.');
    },


    /**
     * @param {String} aURL
     * @return {String}
     */
    unchaikafy: function(aURL){
        return aURL.replace(this.serverURL + 'thread/', '')
                   .replace(/^chaika:\/\/[a-z]*\/?/, '');
    },


    /**
     * @param {String} aURL
     * @return {String}
     */
    chaikafy: function(aURL){
        if(this.isThread(aURL)){
            return this._chaikafyThread(aURL);
        }else{
            return this._chaikafyBoard(aURL);
        }
    },


    /**
     * @param {String} aURL
     * @return {String}
     */
    _chaikafyBoard: function(aURL){
        return 'chaika://board/' + aURL;
    },


    /**
     * @param {String} aURL
     * @return {String}
     */
    _chaikafyThread: function(aURL){
        return this.serverURL + 'thread/' + aURL;
    }

};
