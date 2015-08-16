/* See license.txt for terms of usage */

/**
 * The frame script to register components that must be executed in the content process.
 */

'use strict';

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});


function init(){
    Cu.import('resource://chaika-modules/ProtocolHandler.js', {});

    // We should initialize ChaikaRedirector in the content process
    // so that nsISimpleContentPolicy can handle http requests made in the content.
    if(Prefs.get('browser.redirector.enabled')){
        Cu.import('resource://chaika-modules/Redirector.js', {});
    }

    // ChaikaCore, the deprecated module, is loaded here for now,
    // so that important features depending ChaikaCore deeply, such as ChaikaBoard, page.js, can work.
    let { ChaikaCore } = Cu.import('resource://chaika-modules/ChaikaCore.js', {});
    ChaikaCore._startup();
}


init();
