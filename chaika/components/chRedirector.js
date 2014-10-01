/* See license.txt for terms of usage */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


var gRedirector = null;


function chRedirector(){
    this.enabled = false;
}

chRedirector.prototype = {

    _startup: function chRedirector__startup(){
        this.enabled = Services.prefs.getBoolPref("extensions.chaika.browser.redirector.enabled");

        if(this.enabled){
            var categoryManager = Cc["@mozilla.org/categorymanager;1"]
                    .getService(Ci.nsICategoryManager);
            categoryManager.addCategoryEntry("content-policy", this.classDescription,
                    this.contractID, false, true);
        }

        Services.prefs.addObserver("extensions.chaika.browser.redirector.enabled", this, false);
    },


    _quitApp: function chRedirector__quitApp(){
        Services.prefs.removeObserver("extensions.chaika.browser.redirector.enabled", this, false);
    },


    // ********** ********* implements nsIContentPolicy ********** **********

    shouldLoad: function chRedirector_shouldLoad(aContentType, aContentLocation,
                                aRequestOrigin, aContext, aMimeTypeGuess, aExtra){
        if(!this.enabled) return Ci.nsIContentPolicy.ACCEPT;
        if(aContentType != Ci.nsIContentPolicy.TYPE_DOCUMENT) return Ci.nsIContentPolicy.ACCEPT;
        if(aContentLocation.scheme.substring(0, 4) != "http") return Ci.nsIContentPolicy.ACCEPT;

        var host = aContentLocation.host;
        if(host.indexOf(".2ch.net") == -1 &&
           host.indexOf(".bbspink.com") == -1 &&
           host != "jbbs.livedoor.jp" &&
           host != "jbbs.shitaraba.net"){
            return Ci.nsIContentPolicy.ACCEPT;
        }

        if(ChaikaCore.pref.getBool("browser.redirector.throw_bookmarks")){
            if(aRequestOrigin.host == "127.0.0.1" || aRequestOrigin.scheme == "chrome"){
                return Ci.nsIContentPolicy.ACCEPT;
            }
        }

        var spec = aContentLocation.spec;

        // コンテキストメニュー等の「ブラウザーで開く」
        if(spec.lastIndexOf('?chaika_force_browser=1') !== -1){
            aContentLocation.spec = spec.replace('?chaika_force_browser=1', '');
            return Ci.nsIContentPolicy.ACCEPT;
        }

        // Be Profile Page
        if(spec.indexOf("http://be.2ch.net/test/p.php")!=-1){
            return Ci.nsIContentPolicy.ACCEPT;
        }

        if(spec.indexOf("/read.cgi/")==-1 && spec.indexOf("/test/read.html/")==-1){
            return Ci.nsIContentPolicy.ACCEPT;
        }

        var replaceViewLimit = ChaikaCore.pref.getBool("browser.redirector.replace_view_limit");
        var threadURL = ChaikaCore.browser._getThreadURL(aContentLocation, replaceViewLimit, false);
        aContentLocation.spec = threadURL.spec.replace("/test/read.html/", "/test/read.cgi/");

        return Ci.nsIContentPolicy.ACCEPT;
    },


    shouldProcess: function chRedirector_shouldProcess(aContentType, aContentLocation,
                                aRequestOrigin, aContext, aMimeTypeGuess, aExtra){
        return Ci.nsIContentPolicy.ACCEPT;
    },


    // ********** ********* implements nsIObserver ********** **********

    observe: function chRedirector_observe(aSubject, aTopic, aData){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

        switch(aTopic){
            case "profile-after-change":
                os.addObserver(this, "quit-application", false);
                this._startup();
                break;
            case "quit-application":
                os.removeObserver(this, "quit-application");
                this._quitApp();
                break;
            case "nsPref:changed":
                if(aData == "extensions.chaika.browser.redirector.enabled"){
                    this.enabled = ChaikaCore.pref.getBool("browser.redirector.enabled");
                }
                break;
        }
    },


    // ********** ********* XPCOMUtils Component Registration ********** **********

    classDescription: "chRedirector js component",
    contractID: "@chaika.xrea.jp/redirector;1",
    classID: Components.ID("{a0f48aef-8a53-4bab-acd5-9618cbb67e14}"),
    _xpcom_factory: {
        createInstance: function(aOuter, aIID) {
            if(aOuter != null) throw Cr.NS_ERROR_NO_AGGREGATION;
            if(!gRedirector) gRedirector = new chRedirector();

            return gRedirector.QueryInterface(aIID);
        }
    },
    _xpcom_categories: [{ category: "app-startup", service: true }],
    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIContentPolicy,
        Ci.nsISupportsWeakReference,
        Ci.nsIObserver,
        Ci.nsISupports
    ])
};


XPCOMUtils.defineLazyGetter(this, "ChaikaCore", function () {
    var scope = {};
    Components.utils.import("resource://chaika-modules/ChaikaCore.js", scope);
    return scope.ChaikaCore;
});


var NSGetFactory = XPCOMUtils.generateNSGetFactory([chRedirector]);
