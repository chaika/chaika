/* See license.txt for terms of usage */

'use strict';

let EXPORTED_SYMBOL = 'exports';

let exports = {

    bbs: {

        includes: [
            // Here we make sure these rules begin with "/^https?:\/\/"
            // so that they will keep compatible with TLS-version of these websites.
            // There is a decent posibility of switching from normal HTTP to SSL/TLS
            // in the future on any websites because Mozilla and other browser vendors are now
            // promoting deprecation of Non-Secure HTTP.
            //  cf.) http://t-webber.hatenablog.com/entry/2015/05/01/231948
            /^https?:\/\/\w+\.open2ch\.net\//,
            /^https?:\/\/\w+\.jikkyo.org\//,
            /^https?:\/\/\w+\.next2ch.net\//,
            /^https?:\/\/\w+\.plusvip\.jp\//,
            /^https?:\/\/\w+\.2ch\.sc\//,
            /^https?:\/\/blogban\.net\//,
        ],

        excludes: [
            /^https?:\/\/[^\/]+\/$/,            // toppage of each BBS's.
            /^https?:\/\/[^\/]+\/\w+\.html?$/,  // anouncement etc.
            /bbs\.html?/i,                      // BBSMENU of plusvip.jp etc.
            /bbsmenu\.html?/i,                  // BBSMENU of most 2ch-compatible BBS.
            /\/cbm\//,                          // CBM Custom BBS Menu provided by jikkyo.org.
            /\.txt$/,
        ]

    },


    thread: {

        includes: [
            /\/test\/read\.cgi\//,
        ],


        excludes: [
        ],


        get sourcePath() {
            let uri = new URL(this.board.url);
            let datID = this.origURL.match(/\/(\d{9,10})/)[1];

            return `${uri.host}${uri.path}${datID}.dat`;
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
