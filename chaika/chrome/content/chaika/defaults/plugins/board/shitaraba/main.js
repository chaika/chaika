/* See license.txt for terms of usage */

'use strict';

let EXPORTED_SYMBOL = 'exports';

let exports = {

    bbs: {

        includes: [
            /^https?:\/\/jbbs\.shitaraba\.net\//,
        ],

        excludes: [
            /\/subject\.cgi\//,
            /\/storage\.cgi\//,
            /\/notice_mail\.cgi\//,
        ]

    },


    thread: {

        includes: [
            /\/bbs\/read\.cgi\//,
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


    parser: 'chaika.2ch-compatible'

};
