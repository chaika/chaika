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


EXPORTED_SYMBOLS = ["ChaikaThread"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


const PR_PERMS_FILE = 0644;
const PR_RDONLY = 0x01;
const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_APPEND = 0x10;
const PR_TRUNCATE = 0x20;


/** @ignore */
function makeException(aResult, aMessage){
	var stack = Components.stack.caller.caller;
	return new Components.Exception(aMessage || "exception", aResult, stack);
}




/**
 * スレッドを扱うオブジェクト
 * @class
 */
function ChaikaThread(aThreadURL){
	if(!(aThreadURL instanceof Ci.nsIURL)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}
	if(aThreadURL.scheme.indexOf("http") != 0){
		throw makeException(Cr.NS_ERROR_INVALID_ARG, "BAD URL");
	}

	try{
		this._init(aThreadURL);
	}catch(ex){
		throw makeException(ex.result, ex.message);
	}
}

ChaikaThread.prototype = {

	/**
	 *
	 * @type nsIURL
	 */
	url: null,
	/**
	 *
	 *@type nsIURL
	 */
	plainURL: null,
	/**
	 *
	 * @type nsIURL
	 */
	boardURL: null,
	/**
	 *
	 * @type nsIURL
	 */
	datURL: null,
	/**
	 *
	 * @type nsIURL
	 */
	datKakoURL: null,
	/**
	 *
	 * @type String
	 */
	threadID: null,
	/**
	 *
	 * @type String
	 */
	datID: null,
	/**
	 *
	 * @type nsILocalFIle
	 */
	datFile: null,
	/**
	 *
	 * @type String
	 */
	title: null,
	/**
	 *
	 * @type Number
	 */
	lineCount: null,
	/**
	 *
	 * @type String
	 */
	lastModified: null,
	/**
	 *
	 * @type Boolean
	 */
	maruGetted: null,


	/**
	 * 初期化処理
	 * @private
	 */
	_init: function ChaikaThread__init(aThreadURL){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		this.url = aThreadURL;
		if((/^\d{9,10}$/).test(this.url.fileName)){
			this.url = ioService.newURI(this.url.spec + "/", null, null)
					.QueryInterface(Components.interfaces.nsIURL);
			ChaikaCore.logger.warning("/ で終わっていない URL の修正: " + this.url.spec);
		}


		this.type = ChaikaBoard.getBoardType(this.url);
			// 板のタイプが、BOARD_TYPE_PAGE でも、
			// URL に /test/read.cgi/ を含んでいたら 2ch互換とみなす
		if(this.type == ChaikaBoard.BOARD_TYPE_PAGE &&
					this.url.spec.indexOf("/test/read.cgi/") != -1){
			this.type = ChaikaBoard.BOARD_TYPE_2CH;
		}
		if(this.type == ChaikaBoard.BOARD_TYPE_PAGE){
			throw makeException(Cr.NS_ERROR_INVALID_ARG, "No Supported Boad");
		}

		this.plainURL = ioService.newURI(this.url.resolve("./"), null, null)
				.QueryInterface(Components.interfaces.nsIURL);

		this.datID = this.plainURL.directory.match(/\/(\d{9,10})/) ? RegExp.$1 : null;
		if(!this.datID){
			throw makeException(Cr.NS_ERROR_INVALID_ARG, "No Supported Boad");
		}

		this.boardURL = ChaikaThread.getBoardURL(this.plainURL);

		var datURLSpec;
		if(this.type == ChaikaBoard.BOARD_TYPE_MACHI){
			datURLSpec = this.url.spec.replace("/read.cgi/", "/offlaw.cgi/") + this.datID + "/";
			this.datURL = ioService.newURI(datURLSpec, null, null).QueryInterface(Ci.nsIURL);
		}else{
			datURLSpec = this.boardURL.resolve("dat/" + this.datID + ".dat");
			this.datURL = ioService.newURI(datURLSpec, null, null).QueryInterface(Ci.nsIURL);
		}


		if(this.type != ChaikaBoard.BOARD_TYPE_2CH){
			this.datKakoURL = this.datURL.clone().QueryInterface(Ci.nsIURL);
		}else{
			datURLSpec = this.boardURL.resolve(["kako/", this.datID.substring(0,4), "/",
								this.datID.substring(0,5), "/", this.datID, ".dat"].join(""));
			this.datKakoURL = ioService.newURI(datURLSpec, null, null)
					.QueryInterface(Components.interfaces.nsIURL);
		}

		var boardID = ChaikaBoard.getBoardID(this.boardURL);
		this.threadID = boardID + this.datID;

		this.datFile = ChaikaBoard.getLogFileAtBoardID(boardID);
		this.datFile.appendRelativePath(this.datID + ".dat");

		this.getThreadData();

		// DAT が無く ThreadData のみ存在する場合は、ライン数がずれてしまうので ThreadData を消す
		if(!this.datFile.exists() && this.lineCount>0){
			this.deteleThreadData();
		}
	},


	/**
	 * データベースからスレッド情報を取得する。
	 */
	getThreadData: function ChaikaThread_getThreadData(){
		var storage = ChaikaCore.storage;
		storage.beginTransaction();
		try{
			var statement = storage.createStatement(
					"SELECT title, line_count, http_last_modified, maru_getted" +
						"    FROM thread_data WHERE thread_id=?1;");
			statement.bindStringParameter(0, this.threadID);
			if(statement.executeStep()){
				this.title        = statement.getString(0);
				this.lineCount    = statement.getInt32(1);
				this.lastModified = statement.getString(2);
				this.maruGetted   = (statement.getInt32(3)==1);
			}else{
				this.title        = "";
				this.lineCount    = 0;
				this.lastModified = "";
				this.maruGetted   = false;
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
			this.title        = "";
			this.lineCount    = 0;
			this.lastModified = "";
			this.maruGetted   = false;
		}finally{
			statement.reset();
			statement.finalize();
			storage.commitTransaction();
		}

	},


	/**
	 * スレッド情報をデータベースに保存する。
	 */
	setThreadData: function ChaikaThread_setThreadData(){
		var storage = ChaikaCore.storage;
		storage.beginTransaction();
		try{
			var statement = storage.createStatement(
								"SELECT _rowid_ FROM thread_data WHERE thread_id=?1;");
			statement.bindStringParameter(0, this.threadID);
			var threadRowID = 0;
			if(statement.executeStep()){
				threadRowID = statement.getInt64(0);
			}
			statement.reset();
			statement.finalize();
			if(threadRowID){
				statement = storage.createStatement(
					"UPDATE thread_data SET url=?1, line_count=?2, http_last_modified=?3, " +
						"maru_getted=?4 WHERE _rowid_=?5;");
				statement.bindStringParameter(0, this.url.spec);
				statement.bindInt32Parameter(1, this.lineCount);
				statement.bindStringParameter(2, this.lastModified);
				statement.bindInt32Parameter(3, this.maruGetted ? 1 : 0);
				statement.bindInt64Parameter(4, threadRowID);
				statement.execute();
			}else{
				statement = storage.createStatement(
				"INSERT INTO thread_data(thread_id, board_id, url, dat_id, title, " +
					"title_n, line_count, http_last_modified, maru_getted)" +
					"   VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9);");
				statement.bindStringParameter(0, this.threadID);
				statement.bindStringParameter(1, ChaikaBoard.getBoardID(this.boardURL));
				statement.bindStringParameter(2, this.url.spec);
				statement.bindStringParameter(3, this.datID);
				statement.bindStringParameter(4, this.title);
				statement.bindStringParameter(5, "");
				statement.bindInt32Parameter(6, this.lineCount);
				statement.bindStringParameter(7, this.lastModified);
				statement.bindInt32Parameter(8, this.maruGetted ? 1 : 0);
				statement.execute();
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}finally{
			statement.finalize();
			storage.commitTransaction();
		}
	},


	/**
	 * スレッド情報をデータベースから消去し、DAT ファイルを削除する。
	 */
	deteleThreadData: function ChaikaThread_deteleThreadData(){
		var storage = ChaikaCore.storage;
		var statement = storage.createStatement("DELETE FROM thread_data WHERE thread_id=?1");
		statement.bindStringParameter(0, this.threadID);

		storage.beginTransaction();
		try{
			statement.execute();
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}finally{
			statement.reset();
			statement.finalize();
			storage.commitTransaction();
		}

		try{
			if(this.datFile.exists()) this.datFile.remove(false);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		this.title        = "";
		this.lineCount    = 0;
		this.lastModified = "";
		this.maruGetted   = false;
	},


	/**
	 * DAT ファイルに aContent の内容を追加保存する。
	 * DAT ファイルが存在しない場合は新規作成する。
	 * @param {String} aContent
	 */
	appendContent: function ChaikaThread_appendContent(aContent){
		var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
						.createInstance(Ci.nsIFileOutputStream);
		try{
				// nsILocalFIle.create は親フォルダをふくめて作成する
			if(!this.datFile.exists()){
				this.datFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
			}

			var flag = PR_WRONLY | PR_CREATE_FILE | PR_APPEND;
			fileOutputStream.init(this.datFile, flag, PR_PERMS_FILE, 0);
			fileOutputStream.write(aContent, aContent.length);
			fileOutputStream.flush();
			fileOutputStream.close();
		}catch(ex){
			ChaikaCore.logger.error(ex);
			return false;
		}
	}

};


/**
 * スレッドの所属する板の URL を返す。
 * @param {nsIURL} aThreadURL
 * @return {nsIURL} 板 URL
 */
ChaikaThread.getBoardURL = function ChaikaThread_getBoardURL(aThreadURL){
	if(!(aThreadURL instanceof Ci.nsIURL)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}
	if(aThreadURL.scheme.indexOf("http") != 0){
		throw makeException(Cr.NS_ERROR_INVALID_ARG);
	}


	var type = ChaikaBoard.getBoardType(aThreadURL);
	var boardURLSpec = aThreadURL.resolve("../");

	switch(type){
		case ChaikaBoard.BOARD_TYPE_2CH:
		case ChaikaBoard.BOARD_TYPE_BE2CH:
			boardURLSpec = boardURLSpec.replace("/test/read.cgi/", "/");
			break;
		case ChaikaBoard.BOARD_TYPE_JBBS:
		case ChaikaBoard.BOARD_TYPE_MACHI:
			boardURLSpec = boardURLSpec.replace("/bbs/read.cgi/", "/");
			break;
		case ChaikaBoard.BOARD_TYPE_OLD2CH:
			throw makeException(Cr.NS_ERROR_INVALID_ARG);
			break;
	}

	var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	return ioService.newURI(boardURLSpec, null, null).QueryInterface(Ci.nsIURL);

}