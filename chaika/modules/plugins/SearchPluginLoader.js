/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["SearchPluginLoader"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { AbstractPluginLoader } = Cu.import('resource://chaika-modules/plugins/AbstractPluginLoader.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


let SearchPluginLoader = Object.create(AbstractPluginLoader, {

    name: {
        value: 'search'
    },

});
