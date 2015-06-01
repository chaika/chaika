/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["SearchPluginLoader"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { AbstractPluginLoader } = Cu.import('resource://chaika-modules/plugins/AbstractPluginLoader.js', {});


let SearchPluginLoader = Object.create(AbstractPluginLoader, {

    name: {
        value: 'search'
    },

});
