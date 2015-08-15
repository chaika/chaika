/* See license.txt for terms of usage */

/* global content, addMessageListener, sendAsyncMessage, sendSyncMessage */

/**
 * The root frame script to cooperate between chrome and content scripts.
 */

'use strict';

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});


function init(){
    let mm = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIFrameScriptLoader);
    mm.loadFrameScript('chrome://chaika/content/browser/thread-agent.js', true);

    // We should initialize ChaikaRedirector in the content process
    // so that nsISimpleContentPolicy can handle http requests made in the content.
    if(Prefs.get('browser.redirector.enabled')){
        let { Redirector } = Cu.import('resource://chaika-modules/Redirector.js', {});
        Redirector.init();
    }
}


init();
