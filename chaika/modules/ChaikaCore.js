/* See license.txt for terms of usage */


this.EXPORTED_SYMBOLS = ["ChaikaCore"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/Deprecated.jsm');
Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaAddonInfo.js");
Components.utils.import("resource://chaika-modules/utils/URLUtils.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


const DATA_DIR_NAME = "chaika";
const LOGS_DIR_NAME = "chaika-logs";
const EXTENSION_ID = "chaika@chaika.xrea.jp";

const PR_PERMS_DIR = 0755;
const PR_PERMS_FILE = 0644;
const PR_RDONLY = 0x01;
const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_APPEND = 0x10;
const PR_TRUNCATE = 0x20;


const STORAGE_SQL_HISTORY = [
        "CREATE TABLE history(",
        "    id TEXT NOT NULL UNIQUE,",
        "    url TEXT NOT NULL,",
        "    title NOT NULL,",
        "    last_visited INTEGER NOT NULL DEFAULT 0,",
        "    visit_count INTEGER NOT NULL DEFAULT 1,",
        "    type INTEGER NOT NULL DEFAULT 0",
        ");"
    ].join("\n");
const STORAGE_SQL_BBSMENU = [
        "CREATE TABLE bbsmenu(",
        "    title       TEXT NOT NULL,",
        "    title_n     TEXT NOT NULL,",
        "    url         TEXT,",
        "    path        TEXT NOT NULL,",
        "    board_type  INTEGER,",
        "    board_id    TEXT,",
        "    is_category INTEGER NOT NULL",
        ");",
        "CREATE INDEX IF NOT EXISTS bbsmenu_board_id_index ON bbsmenu(board_id);"
    ].join("\n");
const SQL_THREAD_DATA = [
        "CREATE TABLE thread_data(",
        "    thread_id          TEXT NOT NULL UNIQUE,",
        "    board_id           TEXT NOT NULL,",
        "    url                TEXT NOT NULL,",
        "    dat_id             TEXT NOT NULL,",
        "    title              TEXT,",
        "    title_n            TEXT,",
        "    line_count         INTEGER DEFAULT 0,",
        "    read_position      INTEGER DEFAULT 0,",
        "    http_last_modified TEXT,",
        "    maru_getted        INTEGER DEFAULT 0,",
        "    stored             INTEGER DEFAULT 0,",
        "    post_name          TEXT,",
        "    post_mail          TEXT,",
        "    rate               INTEGER DEFAULT 0",
        ");"
    ].join("\n");
const SQL_BOARD_SUBJECT = [
        "CREATE TABLE board_subject(",
        "    thread_id  TEXT NOT NULL UNIQUE,",
        "    board_id   TEXT NOT NULL,",
        "    dat_id     TEXT NOT NULL,",
        "    title      TEXT,",
        "    title_n    TEXT,",
        "    line_count INTEGER DEFAULT 0,",
        "    ordinal    INTEGER DEFAULT 0",
        ");"
    ].join("\n");
const SQL_BOARD_DATA = [
        "CREATE TABLE board_data(",
        "    board_id       TEXT NOT NULL UNIQUE,",
        "    url            TEXT NOT NULL,",
        "    title          TEXT,",
        "    title_n        TEXT,",
        "    type           INTEGER DEFAULT 0,",
        "    last_modified  INTEGER DEFAULT 0,",
        "    subscribed     INTEGER DEFAULT 0,",
        "    post_name      TEXT,",
        "    post_mail      TEXT",
        ");"
    ].join("\n");


/**
 * Polyfill for Firefox 39-
 */
if(!String.prototype.includes){
    String.prototype.includes = function(){'use strict';
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}


/** @ignore */
function makeException(aResult){
    var stack = Components.stack.caller.caller;
    return new Components.Exception("exception", aResult, stack);
}




/**
 * @namespace
 */
var ChaikaCore_ = {

    initialized: false,

    /**
     * ログをとるための {@link ChaikaLogger} オブジェクト
     * @type ChaikaLogger
     * @deprecated
     */
    logger: null,


    /**
     * ブランチが extensions.chaika に設定されている {@link ChaikaPref} オブジェクト
     * @type ChaikaPref
     */
    pref: null,


    /**
     * ホストブラウザとの連携を行う {@link ChaikaBrowser} オブジェクト
     * @type ChaikaBrowser
     */
    browser: null,


    /**
     * ファイルを読み書きする {@link ChaikaIO} オブジェクト
     * @type ChaikaIO
     */
    io: null,


    /**
     * 履歴を管理する {@link ChaikaHistory} オブジェクト
     * @type ChaikaHistory
     */
    history: null,


    /**
     * ログデータ等を保存する mozIStorageConnection
     * @type mozIStorageConnection
     */
    storage: null,


    /**
     * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
     * @private
     */
    _startup: function ChaikaCore__startup(){
        this.logger = new ChaikaLogger();
        this.pref = new ChaikaPref("extensions.chaika.");
        this.browser = new ChaikaBrowser();
        this.io = new ChaikaIO();
        this.history = new ChaikaHistory();

        this.logger._startup();
        this.storage = this._openStorage();
        this.history._startup();

        this.initialized = true;
    },


    /**
     * ブラウザ終了時に一度だけ実行され、終了処理を行う。
     * @private
     */
    _quit: function ChaikaCore__quit(){
        this.history._quit();
        try{
            this.storage.close();
        }catch(ex){
            this.logger.error(ex);
        }
        this.logger._quit();
    },


    /**
     * ログ情報などを保存するストレージを開く。
     * @private
     */
    _openStorage: function ChaikaCore__openStorage(){
        var dbFile = this.getLogDir();
        dbFile.appendRelativePath("storage.sqlite");

        var storageService = Cc["@mozilla.org/storage/service;1"]
                .getService(Ci.mozIStorageService);

        var storage = null;

        try{
            storage = storageService.openDatabase(dbFile);
        }catch(ex){
                // SQLite ファイルの読み込みに失敗した場合は、
                // バックアップを取って新規に作成する
            ChaikaCore_.logger.error(ex);
            storageService.backupDatabaseFile(dbFile, dbFile.leafName + ".corrupt");
            if(storage){
                try{ storage.close(); }catch(ex2){};
            }
            try{
                dbFile.remove(false);
                storage = storageService.openDatabase(dbFile);
            }catch(ex2){
                ChaikaCore_.logger.error(ex2);
            }
        }

            // SQLite ユーザ定義関数
            // x_normalize(文字列)
            // 文字列の NFKC 正規化を行う
        storage.createFunction("x_normalize", 1, {
            onFunctionCall: function sqlite_x_normalize(aFunctionArguments) {
                var arg = aFunctionArguments.getString(0);
                var normalizedStr = {};
                this._unicodeNormalizer.NormalizeUnicodeNFKC(arg, normalizedStr);
                return normalizedStr.value;
            },
            _unicodeNormalizer: Cc["@mozilla.org/intl/unicodenormalizer;1"]
                .createInstance(Ci.nsIUnicodeNormalizer)
        });


        // データベースにテーブルが存在しない場合に作成する。
        storage.beginTransaction();
        try{
            if(!storage.tableExists("history")){
                storage.executeSimpleSQL(STORAGE_SQL_HISTORY);
                ChaikaCore_.logger.info("Create Table: history");
            }
            if(!storage.tableExists("bbsmenu")){
                storage.executeSimpleSQL(STORAGE_SQL_BBSMENU);
                ChaikaCore_.logger.info("Create Table: bbsmenu");
            }
            if(!storage.tableExists("thread_data")){
                storage.executeSimpleSQL(SQL_THREAD_DATA);
                ChaikaCore_.logger.info("Create Table: thread_data");
            }
            if(!storage.tableExists("board_subject")){
                storage.executeSimpleSQL(SQL_BOARD_SUBJECT);
                ChaikaCore_.logger.info("Create Table: board_subject");
            }
            if(!storage.tableExists("board_data")){
                storage.executeSimpleSQL(SQL_BOARD_DATA);
                ChaikaCore_.logger.info("Create Table: board_data");
            }
        }catch(ex){
            ChaikaCore_.logger.error(storage.lastErrorString);
            ChaikaCore_.logger.error(ex);
        }finally{
            storage.commitTransaction();
        }

        return storage;
    },


    /**
     * Chaika の使用するデータを保存するプロファイル内のディレクトリを返す。
     * ディレクトリが存在しない場合はこのメソッドが呼ばれた時に作成される。
     * @return {nsIFile}
     */
    getDataDir: function ChaikaCore_getDataDir(){
        if(!this._dataDir){
            if(this.pref.getBool("appoint_data_dir")){
                try{
                    this._dataDir = this.pref.getFile("data_dir");
                    if(this._dataDir.leafName != DATA_DIR_NAME){
                        this._dataDir.appendRelativePath(DATA_DIR_NAME);
                    }
                }catch(ex){
                    this.logger.error(ex);
                    this._dataDir = null;
                }
            }
            if(!this._dataDir){
                var dirService = Cc["@mozilla.org/file/directory_service;1"]
                        .getService(Ci.nsIProperties);
                this._dataDir = dirService.get("ProfD", Ci.nsIFile);
                this._dataDir.appendRelativePath(DATA_DIR_NAME);
            }
        }

        var dataDir = this._dataDir.clone();
        if(!dataDir.exists()){
            dataDir.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIR);
        }

        return dataDir;
    },


    /**
     * DAT ファイル等を保存するディレクトリを返す。
     * ディレクトリが存在しない場合はこのメソッドが呼ばれた時に作成される。
     * @return {nsIFile}
     */
    getLogDir: function ChaikaCore_getLogDir(){
        var logDir = this.getDataDir();
        logDir.appendRelativePath(LOGS_DIR_NAME);
        if(!logDir.exists()){
            logDir.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIR);
        }
        return logDir;
    },


    /**
     * 拡張機能のインストールディレクトリ内にある defaults ディレクトリを返す。
     * @return {nsIFile}
     */
    getDefaultsDir: function ChaikaCore_getDefaultsDir(){
        var defaultsDir = __LOCATION__.parent.parent.clone();
        defaultsDir.setRelativeDescriptor(defaultsDir, 'chrome/content/chaika/defaults');
        return defaultsDir;
    },


    /**
     * Chaika が通信時に利用する UserAgent を返す。
     * @return {String}
     */
    getUserAgent: function ChaikaCore_getUserAgent(){
        if(!this._userAgent || this._userAgent.includes('chaika/1;')){
            let appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
            let httpProtocolHandler = Cc["@mozilla.org/network/protocol;1?name=http"]
                                        .getService(Ci.nsIHttpProtocolHandler);

            let extName = ChaikaAddonInfo.name + "/" + ChaikaAddonInfo.version;
            let oscpu = httpProtocolHandler.oscpu;
            let appName = appInfo.name + "/" + appInfo.version;

            this._userAgent = "Monazilla/1.00 (" + extName + "; " + oscpu + "; " + appName + ")";
        }

        return this._userAgent;
    },


    /**
    * Chaika がスレッド表示に使用するローカルサーバの URL を返す。
    * @return {nsIURL}
    */
    getServerURL: function ChaikaCore_getServerURL(){
       if(!this._serverURL){
           var port = this.pref.getInt('server.port');
           var spec = "http://127.0.0.1:" + port;
           var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
           this._serverURL = ioService.newURI(spec, null, null);
       }
       return this._serverURL.clone().QueryInterface(Ci.nsIURL);
    },


    /**
     * プロクシや UserAgent などの設定を施した nsIHttpChannel を返す。
     * @param {nsIURI} aURL nsIHttpChannel を作成する URL
     * @return {nsIHttpChannel}
     */
    getHttpChannel: function ChaikaCore_getHttpChannel(aURL){
        if(!(aURL instanceof Ci.nsIURI)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        if(aURL.scheme.indexOf("http") != 0){
            throw makeException(Cr.NS_ERROR_INVALID_ARG);
        }

        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var httpChannel;

        var proxyMode = this.pref.getInt("http_proxy_mode");
        if(proxyMode != 0){
            var httpProtocolHandler = ioService.getProtocolHandler("http")
                    .QueryInterface(Ci.nsIHttpProtocolHandler);
            var pps = Cc["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Ci.nsIProtocolProxyService);
            if(proxyMode == 1){
                var proxyInfo = pps.newProxyInfo("direct", "", -1, 0, 0, null);
                httpChannel = httpProtocolHandler.newProxiedChannel(aURL, proxyInfo, 0, null)
                        .QueryInterface(Ci.nsIHttpChannel);
            }else if(proxyMode == 2){
                    var httpProxyValue = this.pref.getUniChar("http_proxy_value");
                    httpProxyValue = httpProxyValue.replace(/\s/g, "");
                    if(httpProxyValue.match(/([^:]+):(\d+)/)){
                        var host = RegExp.$1;
                        var port = parseInt(RegExp.$2);
                        try{
                            var proxyInfo = pps.newProxyInfo("http", host, port, 0, 10,
                                    pps.newProxyInfo("direct", "", -1, 0, 0, null));
                            httpChannel = httpProtocolHandler.newProxiedChannel(aURL, proxyInfo, 0, null)
                                .QueryInterface(Ci.nsIHttpChannel);
                        }catch(ex){
                            this.logger.error(ex);
                        }
                    }
            }
        }

        if(!httpChannel){
            httpChannel = ioService.newChannelFromURI(aURL).QueryInterface(Ci.nsIHttpChannel);
        }

        httpChannel.setRequestHeader("User-Agent", this.getUserAgent(), false);
        httpChannel.notificationCallbacks = {
            /** @ignore */
            getInterface: function(aIID, aInstance) {
                Components.returnCode = Cr.NS_ERROR_NO_INTERFACE;
                return null;
            }
        };
        return httpChannel;
    },

};




/**
 * @constructor
 * @param {String} aTitle URL のタイトル
 * @param {String} aURLSpec URL
 * @param {String} aItemType このアイテムのタイプ "board"、"thread"、"page"
 * @param {Number} aBoardType ChaikaBoard.BOARD_TYPE_XXX
 */
ChaikaCore_.ChaikaURLItem = function ChaikaCore_ChaikaURLItem(
                                        aTitle, aURLSpec, aItemType, aBoardType){
    this.title     = aTitle;
    this.urlSpec   = aURLSpec;
    this.itemType  = aItemType;
    this.boardType = aBoardType;
}

ChaikaCore_.ChaikaURLItem.prototype = {

    /**
     * @return {nsIURL}
     */
    getURL: function ChaikaURLItem_getURL(){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        return ioService.newURI(this.urlSpec, null, null).QueryInterface(Ci.nsIURL);
    },

    open: function ChaikaURLItem_open(aAddTab){
        if(this.itemType == "board"){
            ChaikaCore_.browser.openBoard(this.getURL(), aAddTab);
        }else if(this.itemType == "thread"){
            ChaikaCore_.browser.openThread(this.getURL(), aAddTab, true);
        }else{
            ChaikaCore_.browser.openURL(this.getURL(), aAddTab);
        }
    }

};




/**
 * メッセージログを取るオブジェクト。
 * {@link ChaikaCore_.logger} を経由して利用すること。
 * @constructor
 * @deprecated
 */
function ChaikaLogger(){
}

ChaikaLogger.prototype = {

    LEVEL_NONE      : 70,
    LEVEL_ERROR     : 60,
    LEVEL_WARNING   : 50,
    LEVEL_INFO      : 40,
    LEVEL_DEBUG     : 20,


    /** @private */
    _startup: function ChaikaLogger__startup(){
        this._level = ChaikaCore_.pref.getInt("logger.level");
        this._console = Cc["@mozilla.org/consoleservice;1"]
                .getService(Ci.nsIConsoleService);
    },


    _quit: function ChaikaLogger__quit(){
    },


    /** @private */
    _insertLog: function ChaikaLogger__insertLog(aType, ...args){
        //スタックトレースの取得
        var stackName = "";
        var stackLine = "";

        if(Components.stack.caller.caller){
            stackName = Components.stack.caller.caller.name;
            stackLine = Components.stack.caller.caller.lineNumber;
        }

        //確実に文字列に直す
        args = args.map(function(arg){
            try{
                return arg.toString();
            }catch(ex){
                return typeof arg;
            }
        });

        var message = "[" + stackName + ":" + stackLine + "] " + aType +  " " + args.join(' ');
        this._console.logStringMessage(message);
    },


    debug: function ChaikaLogger_debug(...args){
        if(this._level > this.LEVEL_DEBUG) return;

        args.unshift('DEBUG');
        this._insertLog.apply(this, args);
    },
    info: function ChaikaLogger_info(...args){
        if(this._level > this.LEVEL_INFO) return;

        args.unshift('INFO');
        this._insertLog.apply(this, args);
    },
    warning: function ChaikaLogger_warning(...args){
        if(this._level > this.LEVEL_WARNING) return;

        args.unshift('WARN');
        this._insertLog.apply(this, args);
    },
    error: function ChaikaLogger_error(...args){
        if(this._level > this.LEVEL_ERROR) return;

        args.unshift('ERROR');
        this._insertLog.apply(this, args);
    }

};




/**
 * Mozilla 設定システムにアクセスするためのオブジェクト。
 * {@link ChaikaCore_.pref} を経由して利用すること。
 * @constructor
 * @param {String} aBranch 設定名のブランチ。指定しない場合はルートとみなされる
 */
function ChaikaPref(aBranch){
    this._init(aBranch);
}

ChaikaPref.prototype = {

    /** @private */
    _init: function ChaikaPref__init(aBranch){
        var branch = aBranch || "";
        var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
        this._branch = prefService.getBranch(aBranch);
    },

    getBool: function ChaikaPref_getBool(aPrefName){
        try{
            return this._branch.getBoolPref(aPrefName);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    },
    setBool: function ChaikaPref_setBool(aPrefName, aPrefValue){
        try{
            return this._branch.setBoolPref(aPrefName, aPrefValue);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, aPrefValue, ex);
            throw makeException(ex.result);
        }
    },

    getInt: function ChaikaPref_getInt(aPrefName){
        try{
            return this._branch.getIntPref(aPrefName);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    },
    setInt: function ChaikaPref_setInt(aPrefName, aPrefValue){
        try{
            return this._branch.setIntPref(aPrefName, parseInt(aPrefValue));
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, aPrefValue, ex);
            throw makeException(ex.result);
        }
    },

    getChar: function ChaikaPref_getChar(aPrefName){
        try{
            return this._branch.getCharPref(aPrefName);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    },
    setChar: function ChaikaPref_setChar(aPrefName, aPrefValue){
        try{
            return this._branch.setCharPref(aPrefName, aPrefValue);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, aPrefValue, ex);
            throw makeException(ex.result);
        }
    },

    getUniChar: function ChaikaPref_getUniChar(aPrefName){
        try{
            return this._branch.getComplexValue(aPrefName, Ci.nsISupportsString).data;
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    },
    setUniChar: function ChaikaPref_setUniChar(aPrefName, aPrefValue){
        try{
            var sStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            sStr.data = aPrefValue;
            return this._branch.setComplexValue(aPrefName, Ci.nsISupportsString, sStr);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    },

    getFile: function ChaikaPref_getFile(aPrefName){
        try{
            return this._branch.getComplexValue(aPrefName, Ci.nsIFile);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    },
    setFile: function ChaikaPref_setFile(aPrefName, aPrefValue){
        try{
            return this._branch.setComplexValue(aPrefName, Ci.nsIFile, aPrefValue);
        }catch(ex){
            ChaikaCore_.logger.error(aPrefName, ex);
            throw makeException(ex.result);
        }
    }
};




/**
 * ホストブラウザとの連携を行うオブジェクト
 * {@link ChaikaCore_.browser} を経由して利用すること。
 * @constructor
 */
function ChaikaBrowser(){
}

ChaikaBrowser.prototype = {


    getGlobalMessageManager: function(){
        if(this._globalMM) return this._globalMM;

        this._globalMM = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIFrameScriptLoader);
        this._globalMM.loadFrameScript('chrome://chaika/content/browser/frame.js', true);

        return this._globalMM;
    },


    /**
     * 指定した URL をスレッド表示で開く。
     * aReplaceViewLimit が真なら、渡された URL のオプションを Chaika の設定で上書きする。
     * @param {nsIURL} aThreadURL 開くスレッドの URL
     * @param {Boolean} aAddTab 新しいタブで開くかどうか
     * @param {Boolean} aReplaceViewLimit 表示制限オプションの上書き
     * @param {Boolean} aOpenBrowser 真ならブラウザで開く
     * @param {Boolean} aChildTab TreeStyleViewで子タブとして開くかどうか
     * @return {nsIURL} 開いたスレッドのURL
     */
    openThread: function ChaikaBrowser_openThread(aThreadURL, aAddTab,
                                                    aReplaceViewLimit, aOpenBrowser, aChildTab){
        try{
            var threadURL = this._getThreadURL(aThreadURL, aReplaceViewLimit, aOpenBrowser);
        }catch(ex){
            throw makeException(ex.result);
        }

        try{
            this.openURL(threadURL, aAddTab, aChildTab);
        }catch(ex){
            throw makeException(ex.result);
        }

        return threadURL;
    },


    /** @private */
    _getThreadURL: function ChaikaBrowser__getThreadURL(aThreadURL, aReplaceViewLimit, aOpenBrowser){
        if(!(aThreadURL instanceof Ci.nsIURL)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var threadURL = aThreadURL;

        try{
            if((/^\d{9,10}$/).test(threadURL.fileName)){
                threadURL = ioService.newURI(threadURL.spec + "/", null, null);
                ChaikaCore_.logger.warning("Fixed URL: " + threadURL.spec);
            }

                // スレッド表示数の制限
            if(aReplaceViewLimit){
                var threadViewLimit = ChaikaCore_.pref.getInt("board.thread_view_limit");

                if(threadViewLimit === 0){
                    threadURL = ioService.newURI("./", null, threadURL);
                }else{
                    threadURL = ioService.newURI("./l" + threadViewLimit, null, threadURL);
                }
            }
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }

        if(!aOpenBrowser){
            threadURL = ioService.newURI(URLUtils.chaikafy(threadURL.spec), null, null);
        }else if(ChaikaCore_.pref.getBool("browser.redirector.enabled")){
            // スレッドリダイレクタを回避
            threadURL = ioService.newURI(threadURL.spec + '?chaika_force_browser=1', null, null);
        }

        return threadURL.QueryInterface(Ci.nsIURL);
    },


    /**
     * 指定した URL をスレ一覧で開く。
     * @param {nsIURL} aBoardURL 開く板の URL
     * @param {Boolean} aAddTab 新しいタブで開くかどうか
     */
    openBoard: function ChaikaBrowser_openBoard(aBoardURL, aAddTab){
        try{
            var boardURI = this._getBoardURI(aBoardURL);
            this.openURL(boardURI, aAddTab);
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }
        return boardURI;
    },


    /** @private */
    _getBoardURI: function ChaikaBrowser__getBoardURI(aBoardURL){
        if(!(aBoardURL instanceof Ci.nsIURL)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        var boardURI = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
        boardURI.spec = "chaika://board/" + aBoardURL.spec;
        return boardURI;
    },


    /**
     * ブラウザで指定した URI を開く。
     * ブラウザウィンドウが無いときは新規ウィンドウで開く。
     * @param {nsIURI} aURI 開くページの URI
     * @param {Boolean} aAddTab タブで開くかどうか
     * @param {Boolean} aChildTab TreeStyleViewで子タブとして開くかどうか
     */
    openURL: function ChaikaBrowser_openURL(aURI, aAddTab, aChildTab){
        if(!(aURI instanceof Ci.nsIURI)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        var browserWindow = this.getBrowserWindow();
        if(browserWindow && browserWindow.getBrowser){
            try{
                var contentBrowser = browserWindow.getBrowser();

                if(aAddTab){
                    //For Tree Style Tab user
                    if(aChildTab && 'TreeStyleTabService' in browserWindow){
                        browserWindow.TreeStyleTabService.readyToOpenChildTab(contentBrowser.selectedTab);
                    }

                    var loadInForeground = ChaikaCore_.pref.getBool("tab_load_in_foreground");
                    ChaikaCore_.logger.debug("loadOneTab: " + aURI.spec + " : " + loadInForeground);

                    contentBrowser.loadOneTab(aURI.spec, null, null, null, !loadInForeground, false);
                }else{
                    ChaikaCore_.logger.debug("loadURI: " + aURI.spec);
                    contentBrowser.loadURI(aURI.spec);
                }
            }catch(ex){
                ChaikaCore_.logger.error(ex);
                throw makeException(ex.result);
            }
            return;
        }
    },


    /**
     * 新しいウィンドウを開く
     * @param {String} aURL 開くウィンドウの URL
     * @param {String} [aType] 開くウィンドウのタイプ (windowtype) 指定すると該当ウィンドウがある場合に再利用する
     * @param {Any} [args] ウィンドウに渡す引数
     */
    openWindow: function(aURL, aType, ...args){
        if(aType){
            let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
            let win = wm.getMostRecentWindow(aType);

            if(win){
                win.focus();
                return;
            }
        }

        this.getBrowserWindow().openDialog(aURL, "_blank", "chrome, toolbar, centerscreen, resizable, minimizable", ...args);
    },


    /**
     * ブラウザウィンドウを返す。
     * @return {ChromeWindow} ブラウザウィンドウ
     */
    getBrowserWindow: function ChaikaBrowser_getBrowserWindow(){
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

        return wm.getMostRecentWindow("navigator:browser");
    },


    /**
     * 指定したバージョン文字列と現在の Gecko のバージョンを比較する
     * @param {String} aVersion バージョン文字列(e.g. "1.8" "1.7.5")
     * @return {Number} 指定したバージョンの方が新しければ 0より上、同じなら 0、古ければ 0より下
     * @see nsIVersionComparator
     */
    geckoVersionCompare: function ChaikaBrowser_geckoVersionCompare(aVersion){
        var versionComparator = Cc["@mozilla.org/xpcom/version-comparator;1"]
                .getService(Ci.nsIVersionComparator);
        var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
        return versionComparator.compare(aVersion, appInfo.platformVersion);
    }

};




/**
 * ファイルを読み書きするオブジェクト。
 * {@link ChaikaCore_.io} を経由して利用すること。
 * @constructor
 */
function ChaikaIO(){
}

ChaikaIO.prototype = {

    /**
     * @param {nsIFile} aFile 読み込むファイル
     * @param {String} aCharset 読み込むファイルの文字コード。指定しない場合は UTF-8
     * @return {nsIConverterInputStream}
     */
    getFileInputStream: function ChaikaIO_getFileInputStream(aFile, aCharset){
        if(!(aFile instanceof Ci.nsIFile)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        var charset = aCharset || "UTF-8";

        var fileInputStream = Cc["@mozilla.org/network/file-input-stream;1"]
                .createInstance(Ci.nsIFileInputStream);
        var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
                .createInstance(Ci.nsIConverterInputStream);

        try{
            fileInputStream.init(aFile, PR_RDONLY, PR_PERMS_FILE,
                    Ci.nsIFileInputStream.CLOSE_ON_EOF);
            converterInputStream.init(fileInputStream, charset, 1024*8,
                    Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }
        return converterInputStream;
    },


    /**
     * @param {nsIFile} aFile 書き込むファイル
     * @param {String} aCharset 書き込む文字コード。指定しない場合は UTF-8
     * @param {Boolean} aAppend 真ならファイルの末尾から追加書き込み
     * @return {nsIConverterOutputStream}
     */
    getFileOutputStream: function ChaikaIO_getFileOutputStream(aFile, aCharset, aAppend){
        if(!(aFile instanceof Ci.nsIFile)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        var charset = aCharset || "UTF-8";
        var ioFlags = PR_WRONLY|PR_CREATE_FILE;
        ioFlags |= (aAppend) ? PR_APPEND : PR_TRUNCATE;

        var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
                .createInstance(Ci.nsIFileOutputStream);
        var converterOutputStream = Cc["@mozilla.org/intl/converter-output-stream;1"]
                .createInstance(Ci.nsIConverterOutputStream);

        try{
                // nsIFile.create は親フォルダもふくめて作成する
            if(!aFile.exists()){
                aFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
            }

            fileOutputStream.init(aFile, ioFlags, PR_PERMS_FILE, 0);
            converterOutputStream.init(fileOutputStream, charset, 0,
                    Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }


        return converterOutputStream;
    },


    /**
     * @param {nsIFile} aFile 読み込むファイル
     * @param {String} aCharset 読み込むファイルの文字コード。指定しない場合は UTF-8
     * @return {String}
     */
    readString: function ChaikaIO_readString(aFile, aCharset){
        var result = [];
        var stream;

        try{
            stream = this.getFileInputStream(aFile, aCharset);
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }

        try{
            let str = {};

            while (stream.readString(1024*16, str) !== 0){
                result.push(str.value);
            }
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }finally{
            stream.close();
        }

        return result.join("");
    },


    /**
     * エンコーディングが不明なファイルを読み込む
     * @param {nsIFile} file 読みこむファイル
     * @param {Boolean} overrideOrigFile 元のファイルを UTF-8 で上書きするかどうか
     * @param {String} suspects エンコーディングの候補
     */
    readUnknownEncodingString: function(file, overrideOrigFile, ...suspects){
        var encoding = suspects.shift();
        var fileString = this.readString(file, encoding);

        //U+FFFD = REPLACEMENT CHARACTER
        if(fileString.includes('\uFFFD')){
            if(suspects.length > 0){
                fileString = this.readUnknownEncodingString(file, overrideOrigFile, suspects);
            }else{
                ChaikaCore_.logger.error('Unable to read string from ' + file.leafName + ': Unknown Encoding');
                return null;
            }
        }

        if(fileString !== null && overrideOrigFile){
            this.writeString(file, 'utf-8', false, fileString);
        }

        return fileString;
    },


    /**
     * @param {nsIFile} aFile 書き込むファイル
     * @param {String} aCharset 書き込む文字コード。指定しない場合は UTF-8
     * @param {Boolean} aAppend 真ならファイルの末尾から追加書き込み
     * @param {String} aContent 書き込む内容
     */
    writeString: function ChaikaIO_writeString(aFile, aCharset, aAppend, aContent){
        var stream;
        try{
            stream = ChaikaCore_.io.getFileOutputStream(aFile, aCharset, aAppend);
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }

        try{
            stream.writeString(aContent);
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }finally{
            stream.close();
        }
    },


    /**
     * @param {nsIFile} aFile 読み込むファイル
     * @return {String}
     */
    readData: function ChaikaIO_readData(aFile){
        var result = [];
        var fileStream = Cc["@mozilla.org/network/file-input-stream;1"]
                    .createInstance(Ci.nsIFileInputStream);
        var binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Ci.nsIBinaryInputStream);

        try{
            fileStream.init(aFile, PR_RDONLY, PR_PERMS_FILE, 0);
            binaryStream.setInputStream(fileStream);

            while(binaryStream.available() > 1024*16){
                result.push(binaryStream.readBytes(1024*16));
            }

            result.push(binaryStream.readBytes(binaryStream.available()));
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }finally{
            // binaryStream.close();
            fileStream.close();
        }

        return result.join("");
    },


    /**
     * @param {nsIFile} aFile 書き込むファイル
     * @param {Boolean} aAppend 真ならファイルの末尾から追加書き込み
     * @param {String} aContent 書き込む内容
     * @return {Boolean} 成功したら true を返す
     */
    writeData: function ChaikaIO_writeData(aFile, aContent, aAppend){
        var fileStream = Cc["@mozilla.org/network/file-output-stream;1"]
                        .createInstance(Ci.nsIFileOutputStream);
        try{
                // nsIFile.create は親フォルダもふくめて作成する
            if(!aFile.exists()){
                aFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
            }

            var ioFlags = PR_WRONLY|PR_CREATE_FILE;
            ioFlags |= (aAppend) ? PR_APPEND : PR_TRUNCATE;
            fileStream.init(aFile, ioFlags, PR_PERMS_FILE, 0);

            var content = String(aContent);
            fileStream.write(content, content.length);
            fileStream.flush();
        }catch(ex){
            ChaikaCore_.logger.error(ex);
            throw makeException(ex.result);
        }finally{
            fileStream.close();
        }

        return true;
    },


    /**
     * ファイラでファイルやディレクトリを開く
     * @param {nsIFile} aFile 開くファイルまたはディレクトリ
     * @return {Boolean} 成功したら真を返す
     */
    reveal: function(aFile){
        if(!(aFile instanceof Ci.nsIFile)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        try{
            // OS の機能で開く
            // aFile がファイルの場合にはファイルを内包しているフォルダを開く
            aFile.reveal();
            return true;
        }catch(ex){}

        try{
            // file: プロトコルで開く
            let uri = Services.io.newFileURI(aFile);
            let protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                                    .getService(Ci.nsIExternalProtocolService);
            protocolService.loadUrl(uri);

            return true;
        }catch(ex){
            ChaikaCore_.logger.error(ex);
        }

        return false;
    },


    /**
     * HTML実体参照にエンコードする
     * @param {String} aStr エンコードする文字列
     * @return {String} エンコード後の文字列
     */
    escapeHTML: function ChaikaCore_escapeHTML(aStr){
        return aStr.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#039;')
                   .replace(/\u00a9/g, '&copy;');
    },


    /**
     * HTML実体参照をデコードする
     * @param {String} aStr デコードする文字列
     * @return {String} デコード後の文字列
     */
    unescapeHTML: function ChaikaCore_unescapeHTML(aStr){
        return aStr.replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#039;/g, "'")
                   .replace(/&amp;/g, '&')
                   .replace(/&copy;/g, this.fromUTF8Octets('©'));
    },


    /**
     * UTF-8 バイト列から文字列へ変換する
     * @param {Octets} octets UTF-8 バイト列
     * @return 文字列
     * @note http://nanto.asablo.jp/blog/2006/10/23/572458 より
     */
    fromUTF8Octets: function(octets){
        return decodeURIComponent(escape(octets));
    },


    /**
     * 文字列から UTF-8 バイト列へ変換する
     * @param {String} string 文字列
     * @return UTF-8 バイト列
     * @note http://nanto.asablo.jp/blog/2006/10/23/572458 より
     */
    toUTF8Octets: function(string){
        return unescape(encodeURIComponent(string));
    }
};




/**
 * 履歴を管理するオブジェクト。
 * {@link ChaikaCore_.history} を経由して利用すること。
 * @constructor
 */
function ChaikaHistory(){

}

ChaikaHistory.prototype = {

    _startup: function ChaikaHistory__startup(){
        var sql = "";
        this._statement = [];
        var storage = ChaikaCore_.storage;

        sql = "SELECT ROWID FROM history WHERE id=?1";
        this._statement["visitPage_SelectID"] = storage.createStatement(sql);
        sql = "UPDATE history SET url=?1, title=?2, visit_count=visit_count+1, last_visited=?3 WHERE ROWID=?4;";
        this._statement["visitPage_UpdateHistory"] = storage.createStatement(sql);
        sql = "INSERT INTO history(id, url, title, last_visited, visit_count, type) VALUES(?1, ?2, ?3, ?4, ?5, ?6);";
        this._statement["visitPage_InsertHistory"] = storage.createStatement(sql);
    },


    _quit: function ChaikaHistory__startup(){
        this._statement["visitPage_SelectID"].finalize();
        this._statement["visitPage_UpdateHistory"].finalize();
        this._statement["visitPage_InsertHistory"].finalize();
        this._statement = null;
    },


    visitPage: function ChaikaHistory_visitPage(aURL, aID, aTitle, aType){
        //プライベートモードの時は履歴に残さない
        var win = ChaikaCore_.browser.getBrowserWindow();
        if(PrivateBrowsingUtils.isWindowPrivate(win)) return;

        ChaikaCore_.logger.debug([aURL.spec, aID, /*aTitle,*/ aType]);

        var title = ChaikaCore_.io.unescapeHTML(aTitle);
        var storage = ChaikaCore_.storage;

        storage.beginTransaction();
        try{
            // ID で指定されたレコードがあるかチェック
            var rowID = 0;
            var statement = this._statement["visitPage_SelectID"];
            statement.bindStringParameter(0, aID);
            if(statement.executeStep()){
                rowID = statement.getInt32(0);
            }
            statement.reset();

            var now = Date.now()/1000;
            if(rowID){ // レコードがあれば更新
                statement = this._statement["visitPage_UpdateHistory"];
                statement.bindStringParameter(0, aURL.spec);// url
                statement.bindStringParameter(1, title);    // title
                statement.bindInt32Parameter(2, now);        // last_visited
                statement.bindStringParameter(3, rowID);    // id
                statement.execute();
            }else{ // レコードがなければ新規作成
                statement = this._statement["visitPage_InsertHistory"];
                statement.bindStringParameter(0, aID);        // id
                statement.bindStringParameter(1, aURL.spec);// url
                statement.bindStringParameter(2, title);    // title
                statement.bindInt32Parameter(3, now);        // last_visited
                statement.bindInt32Parameter(4, 1);            // visit_count
                statement.bindInt32Parameter(5, aType);        // type
                statement.execute();
            }

        }catch(ex){
            ChaikaCore_.logger.error(storage.lastErrorString);
            ChaikaCore_.logger.error(ex);
            return false;
        }finally{
            storage.commitTransaction();
        }

        return true;
    },


    clearHistory: function ChaikaHistory_clearHistory(){
        var storage = ChaikaCore_.storage;
        storage.beginTransaction();
        try{
            storage.executeSimpleSQL("DELETE FROM history;");
        }catch(ex){
            ChaikaCore_.logger.error(storage.lastErrorString);
            ChaikaCore_.logger.error(ex);
        }finally{
            storage.commitTransaction();
        }

        /*
        try{
            storage.executeSimpleSQL("VACUUM");
        }catch(ex){
            ChaikaCore_.logger.error(storage.lastErrorString);
            ChaikaCore_.logger.error(ex);
        }
        */
    }

};


const loggerLevel = Services.prefs.getIntPref("extensions.chaika.logger.level");
const enableWarning = Services.prefs.getBoolPref("extensions.chaika.deprecation-warning.enabled");

this.ChaikaCore = new Proxy(ChaikaCore_, {

    get: function(target, name, receiver){
        const caller = Components.stack.caller;

        // Warn deprecation when ChaikaCore is used from outside of ChaikaCore.
        if(name !== 'initialized' && !caller.name.startsWith('ChaikaCore')){
            // If the logging level is set to higher than INFO,
            // we suppress the warning about the usage from inside of chaika,
            // because ChaikaCore is still widely used in the chaika codebase.
            if(loggerLevel > 40 && /:\/\/chaika|chaika@chaika\.xrea\.jp/.test(caller.filename)){
                // Do not warn
            }else if(enableWarning){
                Deprecated.warning('ChaikaCore is deprecated. It will be removed from chaika in the future.',
                                   'https://github.com/chaika/chaika/issues/234');
            }
        }

        if(name in target){
            return target[name];
        }
    }

});
