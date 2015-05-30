/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["Board", "BoardDB"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { Sqlite } = Cu.import('resource://gre/modules/Sqlite.jsm', {});
let { Task } = Cu.import('resource://gre/modules/Task.jsm', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


function Board(url){
    this.origURL = url;
}

Board.prototype = {

    get url() {
        if(!this._url){
            this._url = this.origURL.replace('/test/read.cgi/', '/')
                                    .replace(/[^\/]+\/?$/, '');
        }

        return this._url;
    },


    get title() {

    },


    get subjectURL() {
        return this._url + 'subject.txt';
    },


    get settingsURL() {
        return this._url + 'SETTING.TXT';
    },


    get metadata() {

    }

};



let BoardDB = {


};
