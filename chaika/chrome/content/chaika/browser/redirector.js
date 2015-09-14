/* See license.txt for terms of usage */

"use strict";

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});
let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});


/**
 * Thread Redirector to redirect from normal-view to chaika-view automatically.
 * This module should be initialized from the content process to handle connections made in the content.
 */
let Redirector = {

    classDescription: "chaika thread redirector",
    classID: Components.ID("{a0f48aef-8a53-4bab-acd5-9618cbb67e14}"),
    contractID: "@chaika.xrea.jp/redirector;1",
    xpcom_categories: ['simple-content-policy'],

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsISimpleContentPolicy,
        Ci.nsISupportsWeakReference,
        Ci.nsIObserver,
        Ci.nsISupports,
        Ci.nsIFactory
    ]),

    createInstance: function(outer, iid){
        if(outer){
            throw Cr.NS_ERROR_NO_AGGREGATION;
        }

        return this.QueryInterface(iid);
    },


    init: function(){
        let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
        let cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);

        if(!registrar.isContractIDRegistered(this.contractID)){
            registrar.registerFactory(
                this.classID,
                this.classDescription,
                this.contractID,
                this
            );

            this.xpcom_categories.forEach((category) => {
                cm.addCategoryEntry(category, this.contractID, this.contractID, false, true);
            });

            Services.obs.addObserver(this, "xpcom-category-entry-removed", true);
            Services.obs.addObserver(this, "xpcom-category-cleared", true);
        }
    },


    uninit: function(){
        let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
        let cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);

        Services.obs.removeObserver(this, "xpcom-category-entry-removed");
        Services.obs.removeObserver(this, "xpcom-category-cleared");

        this.xpcom_categories.forEach((category) => {
            cm.deleteCategoryEntry(category, this.contractID, false);
        });

        registrar.unregisterFactory(this.classID, this);
    },


    shouldLoad: function(aContentType, aLocation, aRequestOrigin){
        // Don't redirect if the page is not HTTP document.
        if(aContentType !== Ci.nsISimpleContentPolicy.TYPE_DOCUMENT) return Ci.nsISimpleContentPolicy.ACCEPT;
        if(!aLocation.scheme.startsWith('http')) return Ci.nsISimpleContentPolicy.ACCEPT;

        // Don't redirect if the page is loaded from localhost or chrome.
        if(Services.prefs.getBoolPref("extensions.chaika.browser.redirector.throw_bookmarks") && aRequestOrigin){
            if(aRequestOrigin.host === "127.0.0.1" || aRequestOrigin.scheme === "chrome"){
                return Ci.nsISimpleContentPolicy.ACCEPT;
            }
        }

        // Don't redirect if the page is chaika-view.
        if(URLUtils.isChaikafied(aLocation.spec)) return Ci.nsISimpleContentPolicy.ACCEPT;

        // Don't redirect if the page is not BBS.
        if(!URLUtils.isBBS(aLocation.spec)) return Ci.nsISimpleContentPolicy.ACCEPT;

        // Don't redirect if the page is forced to load as normal web-view.
        if(aLocation.spec.contains('?chaika_force_browser=1')) return Ci.nsISimpleContentPolicy.ACCEPT;


        // Redirect to chaika-view page!
        let redirectTo = URLUtils.chaikafy(aLocation.spec);

        // Replace view limit
        let replaceViewLimit = Services.prefs.getBoolPref("extensions.chaika.browser.redirector.replace_view_limit");
        let viewLimit = Services.prefs.getIntPref("extensions.chaika.board.thread_view_limit");

        if(replaceViewLimit){
            redirectTo = redirectTo.replace(/[^\/]+$/, viewLimit ? 'l' + viewLimit : '');
        }

        aLocation.spec = redirectTo;

        return Ci.nsISimpleContentPolicy.ACCEPT;
    },


    shouldProcess: function(){
        return Ci.nsISimpleContentPolicy.ACCEPT;
    },


    observe: function(subject, topic, data){
        switch(topic){
            case "xpcom-category-entry-removed":
            case "xpcom-category-cleared": {
                let category = data;

                if(this.xpcom_categories.indexOf(category) < 0) return;

                if(topic === "xpcom-category-entry-removed" &&
                   subject instanceof Ci.nsISupportsCString &&
                   subject.data !== this.contractID){
                    return;
                }

                // Our category entry was removed, make sure to add it back
                let cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
                cm.addCategoryEntry(category, this.contractID, this.contractID, false, true);
                break;
            }
        }
    }
};


Redirector.init();
