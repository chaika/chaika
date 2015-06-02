/* See license.txt for terms of usage */

'use strict';

let EXPORTED_SYMBOL = 'exports';

let exports = {

    bbs: {

        includes: [
            /^https?:\/\/\w+\.2ch\.net\//,
            /^https?:\/\/\w+\.bbspink.com\//,
        ],

        excludes: [
            /* 2ch.net */
            /find\.2ch\.net/,          // 2ch Search
            /dig\.2ch\.net/,           // 2ch Thread Search
            /info\.2ch\.net/,          // 2ch Wiki
            /wiki\.2ch\.net/,          // 2ch Wiki
            /developer\.2ch\.net/,     // Notice of new specs for 2ch dedicated browser developers
            /notice\.2ch\.net/,        // Notice of new features for 2ch users and developers
            /headline\.2ch\.net/,      // Headline on 2ch.net
            /newsnavi\.2ch\.net/,      // 2channel News Navigator (2NN)
            /api\.2ch\.net/,           // 2ch API entry point
            /be\.2ch\.net/,            // 2ch Be 2.0
            /stats\.2ch\.net/,         // 2ch Hot Threads
            /c\.2ch\.net/,             // Mobile-version 2ch.net
            /p2\.2ch\.net/,            // Ads of Ronin
            /conbini\.2ch\.net/,       // Ads of Ronin

            /* bbspink.com */
            /headline\.bbspink\.net/,  // Headline on bbspink.com

            /* obsoleted domains */
            /epg\.2ch\.net/,           // Japan TV Guide provided by 2ch, vanished on 4/6/2014.
        ]

    },


    thread: {

        get sourcePath() {
            let uri = new URL(this.board.url);
            let datID = this.origURL.match(/\/(\d{9,10})/)[1];

            return `2ch.net${uri.path}${datID}.dat`;
        },


        get url() {
            if(!this._url){
                this._url = this.origURL.replace(/[^\/]+$/, '');
            }

            return this._url;
        },


        get filter() {
            if(!this._filterStr){
                this._filterStr = this.origURL.replace(/^.*\//, '');
            }

            return this._filterStr;
        }

    },


    parser: 'chaika.2ch-compatible',

};
