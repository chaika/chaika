/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is chaika.
 *
 * The Initial Developer of the Original Code is
 * chaika.xrea.jp
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson.moz at gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


EXPORTED_SYMBOLS = ["ChaikaCore"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

try{
	XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils", "resource://gre/modules/PrivateBrowsingUtils.jsm");
}catch(ex){}


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


/** @ignore */
function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}




/**
 * @namespace
 */
var ChaikaCore = {

	initialized: false,

	/**
	 * ログをとるための {@link ChaikaLogger} オブジェクト
	 * @type ChaikaLogger
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
			ChaikaCore.logger.error(ex);
			storageService.backupDatabaseFile(dbFile, dbFile.leafName + ".corrupt");
			if(storage){
				try{ storage.close(); }catch(ex2){};
			}
			try{
				dbFile.remove(false);
				storage = storageService.openDatabase(dbFile);
			}catch(ex2){
				ChaikaCore.logger.error(ex2);
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
				ChaikaCore.logger.info("Create Table: history");
			}
			if(!storage.tableExists("bbsmenu")){
				storage.executeSimpleSQL(STORAGE_SQL_BBSMENU);
				ChaikaCore.logger.info("Create Table: bbsmenu");
			}
			if(!storage.tableExists("thread_data")){
				storage.executeSimpleSQL(SQL_THREAD_DATA);
				ChaikaCore.logger.info("Create Table: thread_data");
			}
			if(!storage.tableExists("board_subject")){
				storage.executeSimpleSQL(SQL_BOARD_SUBJECT);
				ChaikaCore.logger.info("Create Table: board_subject");
			}
			if(!storage.tableExists("board_data")){
				storage.executeSimpleSQL(SQL_BOARD_DATA);
				ChaikaCore.logger.info("Create Table: board_data");
			}
		}catch(ex){
			ChaikaCore.logger.error(storage.lastErrorString);
			ChaikaCore.logger.error(ex);
		}finally{
			storage.commitTransaction();
		}

		return storage;
	},


	/**
	 * Chaika の使用するデータを保存するプロファイル内のディレクトリを返す。
	 * ディレクトリが存在しない場合はこのメソッドが呼ばれた時に作成される。
	 * @return {nsILocalFile}
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
				this._dataDir = dirService.get("ProfD", Ci.nsILocalFile);
				this._dataDir.appendRelativePath(DATA_DIR_NAME);
			}
		}

		var dataDir = this._dataDir.clone().QueryInterface(Ci.nsILocalFile);
		if(!dataDir.exists()){
			dataDir.create(Ci.nsILocalFile.DIRECTORY_TYPE, PR_PERMS_DIR);
		}

		return dataDir;
	},


	/**
	 * DAT ファイル等を保存するディレクトリを返す。
	 * ディレクトリが存在しない場合はこのメソッドが呼ばれた時に作成される。
	 * @return {nsILocalFile}
	 */
	getLogDir: function ChaikaCore_getLogDir(){
		var logDir = this.getDataDir();
		logDir.appendRelativePath(LOGS_DIR_NAME);
		if(!logDir.exists()){
			logDir.create(Ci.nsILocalFile.DIRECTORY_TYPE, PR_PERMS_DIR);
		}
		return logDir;
	},


	/**
	 * 拡張機能のインストールディレクトリ内にある defaults ディレクトリを返す。
	 * @return {nsILocalFile}
	 */
	getDefaultsDir: function ChaikaCore_getDefaultsDir(){
		var defaultsDir = __LOCATION__.parent.parent.clone().QueryInterface(Ci.nsILocalFile);
		defaultsDir.append("defaults");
		return defaultsDir;
	},


	/**
	 * Chaika が通信時に利用する UserAgent を返す。
	 * @return {String}
	 */
	getUserAgent: function ChaikaCore_getUserAgent(){
		if(!this._userAgent){
			try{

				var scope = {};
				Components.utils.import("resource://chaika-modules/ChaikaAddonInfo.js", scope);

				var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
				var httpProtocolHandler = Cc["@mozilla.org/network/protocol;1?name=http"]
						.getService(Ci.nsIHttpProtocolHandler);

				var extName = scope.ChaikaAddonInfo.name + "/" + scope.ChaikaAddonInfo.version;
				var oscpu = httpProtocolHandler.oscpu;
				var appName = appInfo.name + "/" + appInfo.version;

				this._userAgent = "Monazilla/1.00 (" + extName + "; " + oscpu + "; " + appName + ")";
			}catch(ex){
				this.logger.error(ex);
				this._userAgent = this.pref.getChar("exception_useragent");
			}
		}

		return this._userAgent;
	},


	/**
	 * Chaika がスレッド表示に使用するローカルサーバの URL を返す。
	 * @return {nsIURL}
	 */
	getServerURL: function ChaikaCore_getServerURL(){
		if(!this._serverURL){
			var port = 0;
			try{
				var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
				if(appInfo.name == "Firefox"){
					port = this.pref.getInt("server_port.firefox");
				}else if(appInfo.name == "SeaMonkey"){
					port = this.pref.getInt("server_port.seamonkey");
				}else{
					port = this.pref.getInt("server_port.other");
				}
			}catch(ex){
				this.logger.error(ex);
				port = this.pref.getInt("server_port.other");
			}

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
ChaikaCore.ChaikaURLItem = function ChaikaCore_ChaikaURLItem(
										aTitle, aURLSpec, aItemType, aBoardType){
	this.title     = aTitle;
	this.urlSpec   = aURLSpec;
	this.itemType  = aItemType;
	this.boardType = aBoardType;
}

ChaikaCore.ChaikaURLItem.prototype = {

	/**
	 * @return {nsIURL}
	 */
	getURL: function ChaikaURLItem_getURL(){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		return ioService.newURI(this.urlSpec, null, null).QueryInterface(Ci.nsIURL);
	},

	open: function ChaikaURLItem_open(aAddTab){
		if(this.itemType == "board"){
			ChaikaCore.browser.openBoard(this.getURL(), aAddTab);
		}else if(this.itemType == "thread"){
			ChaikaCore.browser.openThread(this.getURL(), aAddTab, true);
		}else{
			ChaikaCore.browser.openURL(this.getURL(), aAddTab);
		}
	}

};




/**
 * メッセージログを取るオブジェクト。
 * {@link ChaikaCore.logger} を経由して利用すること。
 * @constructor
 */
function ChaikaLogger(){
}

ChaikaLogger.prototype = {

	LEVEL_NONE      : 0,
	LEVEL_ERROR     : 1,
	LEVEL_WARNING   : 2,
	LEVEL_INFO      : 3,
	LEVEL_DEBUG     : 4,


	/** @private */
	_startup: function ChaikaLogger__startup(){
		this._level = ChaikaCore.pref.getInt("logger.level");
		this._console = Cc["@mozilla.org/consoleservice;1"]
				.getService(Ci.nsIConsoleService);
	},


	_quit: function ChaikaLogger__quit(){
	},


	/** @private */
	_insertLog: function ChaikaLogger__insertLog(atype, aMessage){
		var stackName = "";
		var stackLine = "";
		if(Components.stack.caller.caller){
			stackName = Components.stack.caller.caller.name;
			stackLine = Components.stack.caller.caller.lineNumber;
		}
		var message = "[" + stackName + ":" + stackLine + "] " + atype +  " " + aMessage;
		this._console.logStringMessage(message);
	},


	debug: function ChaikaLogger_debug(aMessage){
		if(this._level < this.LEVEL_DEBUG) return;

		this._insertLog("DEBUG", aMessage);
	},
	info: function ChaikaLogger_info(aMessage){
		if(this._level < this.LEVEL_INFO) return;

		this._insertLog("INFO", aMessage);
	},
	warning: function ChaikaLogger_warning(aMessage){
		if(this._level < this.LEVEL_WARNING) return;

		var message =  aMessage.message || aMessage.toString();
		this._insertLog("WARNING", aMessage);
	},
	error: function ChaikaLogger_error(aMessage){
		if(this._level < this.LEVEL_ERROR) return;

		var message =  aMessage.message || aMessage.toString();
		this._insertLog("ERROR", message);
	}

};




/**
 * Mozilla 設定システムにアクセスするためのオブジェクト。
 * {@link ChaikaCore.pref} を経由して利用すること。
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
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},
	setBool: function ChaikaPref_setBool(aPrefName, aPrefValue){
		try{
			return this._branch.setBoolPref(aPrefName, aPrefValue);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},

	getInt: function ChaikaPref_getInt(aPrefName){
		try{
			return this._branch.getIntPref(aPrefName);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},
	setInt: function ChaikaPref_setInt(aPrefName, aPrefValue){
		try{
			return this._branch.setIntPref(aPrefName, parseInt(aPrefValue));
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},

	getChar: function ChaikaPref_getChar(aPrefName){
		try{
			return this._branch.getCharPref(aPrefName);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},
	setChar: function ChaikaPref_setChar(aPrefName, aPrefValue){
		try{
			return this._branch.setCharPref(aPrefName, aPrefValue);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},

	getUniChar: function ChaikaPref_getUniChar(aPrefName){
		try{
			return this._branch.getComplexValue(aPrefName, Ci.nsISupportsString).data;
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},
	setUniChar: function ChaikaPref_setUniChar(aPrefName, aPrefValue){
		try{
			var sStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
			sStr.data = aPrefValue;
			return this._branch.setComplexValue(aPrefName, Ci.nsISupportsString, sStr);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},

	getFile: function ChaikaPref_getFile(aPrefName){
		try{
			return this._branch.getComplexValue(aPrefName, Ci.nsILocalFile);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},
	setFile: function ChaikaPref_setFile(aPrefName, aPrefValue){
		try{
			return this._branch.setComplexValue(aPrefName, Ci.nsILocalFile, aPrefValue);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	}
};




/**
 * ホストブラウザとの連携を行うオブジェクト
 * {@link ChaikaCore.browser} を経由して利用すること。
 * @constructor
 */
function ChaikaBrowser(){
}

ChaikaBrowser.prototype = {

	/**
	 * 指定した URL をスレッド表示で開く。
	 * aReplaceViewLimit が真なら、渡された URL のオプションを Chaika の設定で上書きする。
	 * @param {nsIURL} aThreadURL 開くスレッドの URL
	 * @param {Boolean} aAddTab 新しいタブで開くかどうか
	 * @param {Boolean} aReplaceViewLimit 表示制限オプションの上書き
	 * @param {Boolean} aOpenBrowser 真ならブラウザで開く
	 */
	openThread: function ChaikaBrowser_openThread(aThreadURL, aAddTab,
														aReplaceViewLimit, aOpenBrowser){
		try{
			var threadURL = this._getThreadURL(aThreadURL, aReplaceViewLimit, aOpenBrowser);
		}catch(ex){
			throw makeException(ex.result);
		}

		try{
			this.openURL(threadURL, aAddTab);
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
				ChaikaCore.logger.warning("Fixed URL: " + threadURL.spec);
			}

				// スレッド表示数の制限
			if(aReplaceViewLimit){
				var threadViewLimit = ChaikaCore.pref.getInt("board.thread_view_limit");
				if(threadViewLimit == 0){
					threadURL = ioService.newURI("./", null, threadURL);
				}else{
					threadURL = ioService.newURI("./l" + threadViewLimit, null, threadURL);
				}
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}

		if(!aOpenBrowser){
			threadURL = ioService.newURI("/thread/" + threadURL.spec,
						null, ChaikaCore.getServerURL());
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
			ChaikaCore.logger.error(ex);
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
	 */
	openURL: function ChaikaBrowser_openURL(aURI, aAddTab){
		if(!(aURI instanceof Ci.nsIURI)){
			throw makeException(Cr.NS_ERROR_INVALID_POINTER);
		}

		var browserWindow = this.getBrowserWindow();
		if(browserWindow && browserWindow.getBrowser){
			try{
				var contentBrowser = browserWindow.getBrowser();
				if(aAddTab){
					var loadInForeground = ChaikaCore.pref.getBool("tab_load_in_foreground");
					ChaikaCore.logger.debug("loadOneTab: " + aURI.spec + " : " + loadInForeground);
					contentBrowser.loadOneTab(aURI.spec, null, null, null, !loadInForeground, false);
				}else{
					ChaikaCore.logger.debug("loadURI: " + aURI.spec);
					contentBrowser.loadURI(aURI.spec);
				}
			}catch(ex){
				ChaikaCore.logger.error(ex);
				throw makeException(ex.result);
			}
			return;
		}

		// Firefox/Seamonkey 以外のブラウザでの処理はここに書く

		ChaikaCore.logger.warning("Acquisition of browser window failed");
		this.openNewWindow(aURI);
	},


	/**
	 * 新しいブラウザウィンドウで指定した URI を開く。
	 * @param {nsIURI} aURI 新しいウィンドウで開くページの URI
	 */
	openNewWindow: function ChaikaBrowser_openNewWindow(aURI){
		if(!(aURI instanceof Ci.nsIURI)){
			throw makeException(Cr.NS_ERROR_INVALID_POINTER);
		}

		var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
		try{
			var browserURL = pref.getCharPref("browser.chromeURL");
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}

		var argString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		argString.data = aURI.spec;

		var winWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Ci.nsIWindowWatcher);
		try{
			winWatcher.openWindow(null, browserURL, "_blank",
					"chrome,all,dialog=no", argString);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
	},


	/**
	 * ブラウザウィンドウを返す。
	 * @return {ChromeWindow} ブラウザウィンドウ
	 */
	getBrowserWindow: function ChaikaBrowser_getBrowserWindow(){
		var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
				.getService(Ci.nsIWindowMediator);
		return windowMediator.getMostRecentWindow("navigator:browser");
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
 * {@link ChaikaCore.io} を経由して利用すること。
 * @constructor
 */
function ChaikaIO(){

}

ChaikaIO.prototype = {

	/**
	 * @param {nsILocalFile} aLocalFile 読み込むファイル
	 * @param {String} aCharset 読み込むファイルの文字コード。指定しない場合は UTF-8
	 * @return {nsIConverterInputStream}
	 */
	getFileInputStream: function ChaikaIO_getFileInputStream(aLocalFile, aCharset){
		if(!(aLocalFile instanceof Ci.nsILocalFile)){
			throw makeException(Cr.NS_ERROR_INVALID_POINTER);
		}

		var charset = aCharset || "UTF-8";

		var fileInputStream = Cc["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Ci.nsIFileInputStream);
		var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
				.createInstance(Ci.nsIConverterInputStream);

		try{
			fileInputStream.init(aLocalFile, PR_RDONLY, PR_PERMS_FILE,
					Ci.nsIFileInputStream.CLOSE_ON_EOF);
			converterInputStream.init(fileInputStream, charset, 1024*8,
					Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}
		return converterInputStream;
	},


	/**
	 * @param {nsILocalFile} aLocalFile 書き込むファイル
	 * @param {String} aCharset 書き込む文字コード。指定しない場合は UTF-8
	 * @param {Boolean} aAppend 真ならファイルの末尾から追加書き込み
	 * @return {nsIConverterOutputStream}
	 */
	getFileOutputStream: function ChaikaIO_getFileOutputStream(aLocalFile, aCharset, aAppend){
		if(!(aLocalFile instanceof Ci.nsILocalFile)){
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
				// nsILocalFile.create は親フォルダもふくめて作成する
			if(!aLocalFile.exists()){
				aLocalFile.create(Ci.nsILocalFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
			}

			fileOutputStream.init(aLocalFile, ioFlags, PR_PERMS_FILE, 0);
			converterOutputStream.init(fileOutputStream, charset, 0,
					Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}


		return converterOutputStream;
	},


	/**
	 * @param {nsILocalFile} aLocalFile 読み込むファイル
	 * @param {String} aCharset 読み込むファイルの文字コード。指定しない場合は UTF-8
	 * @return {String}
	 */
	readString: function ChaikaIO_readString(aLocalFile, aCharset){
		var result = [];
		var stream;
		try{
			stream = this.getFileInputStream(aLocalFile, aCharset);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}

		try{
			var str = {};
			while (stream.readString(1024*16, str) != 0){
				result.push(str.value);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}finally{
			stream.close();
		}

		return result.join("");
	},


	/**
	 * @param {nsILocalFile} aLocalFile 書き込むファイル
	 * @param {String} aCharset 書き込む文字コード。指定しない場合は UTF-8
	 * @param {Boolean} aAppend 真ならファイルの末尾から追加書き込み
	 * @param {String} aContent 書き込む内容
	 */
	writeString: function ChaikaIO_writeString(aLocalFile, aCharset, aAppend, aContent){
		var stream;
		try{
			stream = ChaikaCore.io.getFileOutputStream(aLocalFile, aCharset, aAppend);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}

		try{
			stream.writeString(aContent);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}finally{
			stream.close();
		}
	},


	/**
	 * @param {nsILocalFile} aLocalFile 読み込むファイル
	 * @return {String}
	 */
	readData: function ChaikaIO_readData(aLocalFile){
		var result = [];
		var fileStream = Cc["@mozilla.org/network/file-input-stream;1"]
					.createInstance(Ci.nsIFileInputStream);
		var binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
					.createInstance(Ci.nsIBinaryInputStream);

		try{
			fileStream.init(aLocalFile, PR_RDONLY, PR_PERMS_FILE, 0);
			binaryStream.setInputStream(fileStream);

			var str;
			while(binaryStream.available() > 1024*16){
				result.push(binaryStream.readBytes(1024*16));
			}
			result.push(binaryStream.readBytes(binaryStream.available()));
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}finally{
			// binaryStream.close();
			fileStream.close();
		}

		return result.join("");
	},


	/**
	 * @param {nsILocalFile} aLocalFile 書き込むファイル
	 * @param {Boolean} aAppend 真ならファイルの末尾から追加書き込み
	 * @param {String} aContent 書き込む内容
	 */
	writeData: function ChaikaIO_writeData(aLocalFile, aContent, aAppend){
		var fileStream = Cc["@mozilla.org/network/file-output-stream;1"]
						.createInstance(Ci.nsIFileOutputStream);
		try{
				// nsILocalFile.create は親フォルダもふくめて作成する
			if(!aLocalFile.exists()){
				aLocalFile.create(Ci.nsILocalFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
			}

			var ioFlags = PR_WRONLY|PR_CREATE_FILE;
			ioFlags |= (aAppend) ? PR_APPEND : PR_TRUNCATE;
			fileStream.init(aLocalFile, ioFlags, PR_PERMS_FILE, 0);
			var content = String(aContent);
			fileStream.write(content, content.length);
			fileStream.flush();
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}finally{
			fileStream.close();
		}
		return true;
	},


	/**
	 * ファイラで指定したディレクトリを開く
	 * @param {nsILocalFile} aDir 開くディレクトリ
	 * @return {Boolean} 成功したら真を返す
	 */
	revealDir: function ChaikaIO_revealDir(aDir){
		if(!(aDir instanceof Ci.nsILocalFile)){
			throw makeException(Cr.NS_ERROR_INVALID_POINTER);
		}
		if(!aDir.isDirectory()){
			throw makeException(Cr.NS_ERROR_INVALID_ARG);
		}

		try{ // ディレクトリに関連づけられたファイラで開く
			aDir.launch();
			return true;
		}catch(ex){}

		try{ // OS の機能でディレクトリを開く
			aDir.reveal();
			return true;
		}catch(ex){}
		
		try{ // file: プロトコルで開く
			var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);	
			var dirURI = ioService.newFileURI(aDir);
		    var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
    					.getService(Ci.nsIExternalProtocolService);
			protocolService.loadUrl(dirURI);
			return true;
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return false;
	}
};




/**
 * 履歴を管理するオブジェクト。
 * {@link ChaikaCore.history} を経由して利用すること。
 * @constructor
 */
function ChaikaHistory(){

}

ChaikaHistory.prototype = {

	_startup: function ChaikaHistory__startup(){
		var sql = "";
		this._statement = [];
		var storage = ChaikaCore.storage;

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

		if(PrivateBrowsingUtils){
			//Firefox 20+
			var win = ChaikaCore.browser.getBrowserWindow();
			if(PrivateBrowsingUtils.isWindowPrivate(win)) return;
		}else{
			var privateBrowsingService = Cc["@mozilla.org/privatebrowsing;1"]
					.getService(Ci.nsIPrivateBrowsingService);
			if(privateBrowsingService.privateBrowsingEnabled) return;
		}

		ChaikaCore.logger.debug([aURL.spec, aID, /*aTitle,*/ aType]);

		var title = aTitle;
		if(title.indexOf("&") != -1){
			title = title.replace("&quot;", "\"", "g")
						.replace("&amp;", "&", "g")
						.replace("&lt;", "<", "g")
						.replace("&gt;", ">", "g");
		}

		var storage = ChaikaCore.storage;

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
				statement.bindStringParameter(1, title);	// title
				statement.bindInt32Parameter(2, now);		// last_visited
				statement.bindStringParameter(3, rowID);	// id
				statement.execute();
			}else{ // レコードがなければ新規作成
				statement = this._statement["visitPage_InsertHistory"];
				statement.bindStringParameter(0, aID);		// id
				statement.bindStringParameter(1, aURL.spec);// url
				statement.bindStringParameter(2, title);	// title
				statement.bindInt32Parameter(3, now);		// last_visited
				statement.bindInt32Parameter(4, 1);			// visit_count
				statement.bindInt32Parameter(5, aType);		// type
				statement.execute();
			}

		}catch(ex){
			ChaikaCore.logger.error(storage.lastErrorString);
			ChaikaCore.logger.error(ex);
			return false;
		}finally{
			storage.commitTransaction();
		}

		return true;
	},


	clearHistory: function ChaikaHistory_clearHistory(){
		var storage = ChaikaCore.storage;
		storage.beginTransaction();
		try{
			storage.executeSimpleSQL("DELETE FROM history;");
		}catch(ex){
			ChaikaCore.logger.error(storage.lastErrorString);
			ChaikaCore.logger.error(ex);
		}finally{
			storage.commitTransaction();
		}

		/*
		try{
			storage.executeSimpleSQL("VACUUM");
		}catch(ex){
			ChaikaCore.logger.error(storage.lastErrorString);
			ChaikaCore.logger.error(ex);
		}
		*/
	}

};
