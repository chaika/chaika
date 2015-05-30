/* See license.txt for terms of usage */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

var gService = null;


function ChaikaService(){

}

ChaikaService.prototype = {

    _startup: function ChaikaService__startup(){
        Components.utils.import("resource://chaika-modules/utils/Logger.js");

        Components.utils.import("resource://chaika-modules/ChaikaCore.js");
        ChaikaCore._startup();

        Components.utils.import("resource://chaika-modules/LocalServer.js");
        LocalServer._startup();

        Components.utils.import("resource://chaika-modules/Thread.js");
        ThreadDB.startup();

        Components.utils.import("resource://chaika-modules/ThreadBuilder.js");
        Templates.init();

        Components.utils.import('resource://chaika-modules/ChaikaHttpController.js');
        ChaikaHttpController._startup();

        Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");
        ChaikaAboneManager._startup();

        Components.utils.import("resource://chaika-modules/ChaikaSearch.js");
        ChaikaSearch._startup();

        Components.utils.import("resource://chaika-modules/ChaikaLogin.js");
        ChaikaRoninLogin._startup();

        Components.utils.import("resource://chaika-modules/ChaikaAA.js");
        ChaikaAA._startup();

        Components.utils.import("resource://chaika-modules/ChaikaContentReplacer.js");
        ChaikaContentReplacer._startup();

        Components.utils.import('resource://chaika-modules/ChaikaBBSMenu.js');
        ChaikaBBSMenu._startup();

        Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
        Components.utils.import("resource://chaika-modules/ChaikaThread.js");


        var scope = {};
        Components.utils.import("resource://gre/modules/AddonManager.jsm", scope);
        Components.utils.import("resource://chaika-modules/ChaikaAddonInfo.js", scope);
        scope.AddonManager.getAddonByID("chaika@chaika.xrea.jp", function(aAddon){
            scope.ChaikaAddonInfo._init(aAddon);
        });
    },


    _quitApp: function ChaikaService__quitApp(){
        ChaikaContentReplacer._quit();
        ChaikaAA._quit();
        ChaikaRoninLogin._quit();
        ChaikaAboneManager._quit();
        ChaikaHttpController._quit();
        LocalServer._quit();
        ChaikaBBSMenu._quit();
        ThreadDB.quit();
        ThreadBuilder.uninit();
        ChaikaCore._quit();
        Logger.uninit();
    },


    _shutdown: function ChaikaService__shutdown(){
    },


    // ********** ********* implements chIChaikaService ********** **********


    isSupportedThread: function ChaikaService_isSupportedThread(aThreadURL){
        try{
            return ChaikaBoard.getBoardType(aThreadURL) != ChaikaBoard.BOARD_TYPE_PAGE;
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }

        return false;
    },


    getThreadLineCount: function ChaikaService_getThreadLineCount(aThreadURL){
        try{
            return (new ChaikaThread(aThreadURL)).lineCount;
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }

        return 0;
    },


    openBoard: function ChaikaService_openBoard(aBoardURL, aAddTab){
        try{
            return ChaikaCore.browser.openBoard(aBoardURL, aAddTab);
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }

        return null;
    },


    getBoardURI: function ChaikaService_getBoardURI(aBoardURL){
        try{
            return ChaikaCore.browser._getBoardURI(aBoardURL);
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }

        return null;
    },


    openThread: function ChaikaService_openThread(aThreadURL, aAddTab, aReplaceViewLimit){
        try{
            return ChaikaCore.browser.openThread(aThreadURL, aAddTab, aReplaceViewLimit, false);
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }

        return null;
    },


    getThreadURL: function ChaikaService_getThreadURL(aThreadURL, aReplaceViewLimit){
        try{
            return ChaikaCore.browser._getThreadURL(aThreadURL, aReplaceViewLimit, false);
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }

        return null;
    },


    // ********** ********* implements nsIObserver ********** **********

    observe: function ChaikaService_observe(aSubject, aTopic, aData){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

        switch(aTopic){
            case "profile-after-change":
                this._startup();
                os.addObserver(this, "quit-application", false);
                break;
            case "quit-application":
                this._quitApp();
                break;
        }
    },


    // ********** ********* XPCOMUtils Component Registration ********** **********

    classDescription: "ChaikaService js component",
    contractID: "@chaika.xrea.jp/chaika-service;1",
    classID: Components.ID("{1a48801d-18c1-4d5f-9fed-03b2aeded9f9}"),
    _xpcom_categories: [{ category: "app-startup", service: true }],
    _xpcom_factory: {
        createInstance: function(aOuter, aIID) {
            if(aOuter != null) throw Cr.NS_ERROR_NO_AGGREGATION;
            if(!gService) gService = new ChaikaService();

            return gService.QueryInterface(aIID);
        }
    },
    QueryInterface: XPCOMUtils.generateQI([
        Ci.chIChaikaService,
        Ci.nsISupportsWeakReference,
        Ci.nsIObserver,
        Ci.nsISupports
    ])
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([ChaikaService]);
