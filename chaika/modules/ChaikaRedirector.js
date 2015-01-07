/* See license.txt for terms of usage */

EXPORTED_SYMBOLS = ["ChaikaRedirector"];


const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://chaika-modules/ChaikaURLUtil.js');


/**
 * スレッドリダイレクタ機能を提供する
 * http 通信を補足するため, content プロセスから呼ばれる必要がある
 */
let ChaikaRedirector = {

    classDescription: "chaika thread redirector",
    classID: Components.ID("{a0f48aef-8a53-4bab-acd5-9618cbb67e14}"),
    contractID: "@chaika.xrea.jp/redirector;1",
    xpcom_categories: ['content-policy'],

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIContentPolicy,
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
        this._registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

        try{
            this._registrar.registerFactory(this.classID, this.classDescription, this.contractID, this);
        }catch(e if e.result == Cr.NS_ERROR_FACTORY_EXISTS){
            // Workaround Bug 924340: rerun this method asynchronously.
            Services.tm.currentThread.dispatch({
                run: this.init.bind(this)
            }, Ci.nsIEventTarget.DISPATCH_NORMAL);
        }


        this._cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);

        this.xpcom_categories.forEach((category) => {
            this._cm.addCategoryEntry(category, this.contractID, this.contractID, false, true);
        });


        Services.obs.addObserver(this, "xpcom-category-entry-removed", true);
        Services.obs.addObserver(this, "xpcom-category-cleared", true);
    },


    uninit: function(){
        Services.obs.removeObserver(this, "xpcom-category-entry-removed");
        Services.obs.removeObserver(this, "xpcom-category-cleared");

        this.xpcom_categories.forEach((category) => {
            this._cm.deleteCategoryEntry(category, this.contractID, false);
        });

        // This needs to run asynchronously, see Bug 753687
        Services.tm.currentThread.dispatch({
            run: function(){
                this._registrar.unregisterFactory(this.classID, this);
            }.bind(this)
        }, Ci.nsIEventTarget.DISPATCH_NORMAL);
    },


    shouldLoad: function(aContentType, aLocation, aRequestOrigin, aContext, aMimeType, aExtra){
        // Don't redirect if the page is not HTTP document.
        if(aContentType !== Ci.nsIContentPolicy.TYPE_DOCUMENT) return Ci.nsIContentPolicy.ACCEPT;
        if(!aLocation.scheme.startsWith('http')) return Ci.nsIContentPolicy.ACCEPT;

        // Don't redirect if the page is loaded from localhost or chrome.
        if(Services.prefs.getBoolPref("extensions.chaika.browser.redirector.throw_bookmarks") && aRequestOrigin){
            if(aRequestOrigin.host === "127.0.0.1" || aRequestOrigin.scheme === "chrome"){
                return Ci.nsIContentPolicy.ACCEPT;
            }
        }

        // Don't redirect if the page is chaika-view.
        if(ChaikaURLUtil.isChaikafied(aLocation.spec)) return Ci.nsIContentPolicy.ACCEPT;

        // Don't redirect if the page is not BBS.
        if(!ChaikaURLUtil.isBBS(aLocation.spec)) return Ci.nsIContentPolicy.ACCEPT;

        // Don't redirect if the page is forced to load as normal web-view.
        if(aLocation.spec.contains('?chaika_force_browser=1')) return Ci.nsIContentPolicy.ACCEPT;


        // Redirect to chaika-view page!
        let redirectTo = ChaikaURLUtil.chaikafy(aLocation.spec);

        // Replace view limit
        let replaceViewLimit = Services.prefs.getBoolPref("extensions.chaika.browser.redirector.replace_view_limit");
        let viewLimit = Services.prefs.getIntPref("extensions.chaika.board.thread_view_limit");

        if(replaceViewLimit){
            redirectTo = redirectTo.replace(/[^\/]+$/, viewLimit ? 'l' + viewLimit : '');
        }

        aLocation.spec = redirectTo;

        return Ci.nsIContentPolicy.ACCEPT;
    },


    shouldProcess: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeType, aExtra){
        return Ci.nsIContentPolicy.ACCEPT;
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
                this._cm.addCategoryEntry(category, this.contractID, this.contractID, false, true);
                break;
            }
        }
    }
};
