/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["BoardPluginLoader"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { AbstractPluginLoader } = Cu.import('resource://chaika-modules/plugins/AbstractPluginLoader.js', {});


let SearchPluginLoader = Object.create(AbstractPluginLoader, {

    name: {
        value: 'board'
    },


    /**
     * Getting an appropriate plugin for a given URL.
     * @param {String} url
     * @return {BoardPlugin}
     */
    get: {
        value: function(url){
            for(let id in this.plugins){
                let plugin = this.plugins[id];

                if(plugin.bbs.includes.find((reg) => reg.test(url)) &&
                   !plugin.bbs.excludes.find((reg) => reg.test(url))){
                       return plugin;
                }
            }

            return null;
        }
    }

});
