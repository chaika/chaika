/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["ThreadFetcher"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


function ThreadFetcher(thread){
    this._thread = thread;
}

ThreadFetcher.prototype = {


};
