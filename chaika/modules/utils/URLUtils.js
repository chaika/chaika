/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["URLUtils"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { ChaikaServer } = Cu.import("resource://chaika-modules/ChaikaServer.js", {});


// We are hard-coding these constants for now,
// just until finishing the implementation of Pluggable Board Definition and Pluggable Dat Fetching;
// These will and should be removed on released version.
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
let URLUtils = {

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
        return aURL.startsWith('chaika://') || aURL.startsWith(this.serverURL);
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


        let url = Services.io.newURI(aURL, null, null);

        if(!url.scheme || !url.scheme.startsWith('http')){
            return false;
        }

        return BBS_DOMAINS.some((domain) => url.host.contains(domain)) &&
               !EXCLUDE_DOMAINS.some((domain) => url.host.contains(domain));
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
        return aURL.contains('/read.');
    },


    /**
     * Convert a chaika-mode URL to a normal-mode URL.
     * @param {String} aURL
     * @return {String}
     */
    unchaikafy: function(aURL){
        return aURL.replace(this.serverURL + 'thread/', '')
                   .replace(/^chaika:\/\/[a-z]*\/?/, '');
    },


    /**
     * Convert a normal-mode URL to a chaika-mode URL
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
