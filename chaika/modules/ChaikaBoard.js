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


EXPORTED_SYMBOLS = ["ChaikaBoard"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/** @ignore */
function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}

/** @ignore */
function convertEntities(aString){
	if(aString.indexOf("&") == -1) return aString;
	return aString.replace(/&quot;/g, "\"").replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}


// getBoardType で利用する例外的な URL のリスト (2ch だけど板じゃない URL)
const EX_HOSTS = [
		"find.2ch.net",
		"info.2ch.net",
		"epg.2ch.net",
		"headline.2ch.net",
		"newsnavi.2ch.net",
		"headline.bbspink.com"
	];


/**
 * 板情報(スレッド一覧)を扱うオブジェクト
 * @class
 */
function ChaikaBoard(aBoardURL){
	if(!(aBoardURL instanceof Ci.nsIURL)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}
	if(aBoardURL.scheme.indexOf("http") != 0){
		throw makeException(Cr.NS_ERROR_INVALID_ARG);
	}

	this._init(aBoardURL);
}

ChaikaBoard.prototype = {

	_init: function ChaikaBoard__init(aBoardURL){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		this.url = aBoardURL;
		if(this.url.fileName){ // URL の最後が "/" で終わっていないなら追加
			ChaikaCore.logger.warning("/ で終わっていない URL の修正: " + this.url.spec);
			this.url = ioService.newURI(this.url.spec + "/", null, null)
							.QueryInterface(Ci.nsIURL);
		}

		this.id = ChaikaBoard.getBoardID(this.url);

		this.type = ChaikaBoard.getBoardType(this.url);
		if(this.type == Ci.nsIBbs2chService.BOARD_TYPE_PAGE){
			this.type = Ci.nsIBbs2chService.BOARD_TYPE_2CH;
		}

		this.subjectURL = ioService.newURI("subject.txt", null, this.url)
				.QueryInterface(Ci.nsIURL);
		this.subjectFile = ChaikaBoard.getLogFileAtURL(this.subjectURL);

		this.settingURL = ioService.newURI("SETTING.TXT", null, this.url)
					.QueryInterface(Ci.nsIURL);
		this.settingFile = ChaikaBoard.getLogFileAtURL(this.settingURL);

		this.itemsDoc = null;

		var logger = ChaikaCore.logger;
		logger.debug("id:   " + this.id);
		logger.debug("url:  " + this.url.spec);
		logger.debug("type: " + this.type);
		logger.debug("subjectURL:  " + this.subjectURL.spec);
		logger.debug("subjectFile: " + this.subjectFile.path);
		logger.debug("settingURL:  " + this.settingURL.spec);
		logger.debug("settingFile: " + this.settingFile.path);
	},


	getTitle: function ChaikaBoard_getTitle(){
		return this.getSetting("BBS_TITLE") || this.url.spec;
	},


	getLogoURL: function ChaikaBoard_getLogoURL(){
		var logoURLSpec = this.getSetting("BBS_TITLE_PICTURE") ||
				this.getSetting("BBS_FIGUREHEAD") || null;

		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		if(logoURLSpec){
			try{
					// 相対リンクの解決
				return ioService.newURI(logoURLSpec, null, this.url).QueryInterface(Ci.nsIURL);
			}catch(ex){
				try{
					return ioService.newURI(logoURLSpec, null, null).QueryInterface(Ci.nsIURL);
				}catch(ex2){
					return null;
				}
			}
		}
		return null;
	},


	getSetting: function ChaikaBoard_getSetting(aSettingName){
		if(!this._settings){
			this._settings = [];

			if(this.settingFile.exists()){
				var charset;
				switch(this.type){
					case Ci.nsIBbs2chService.BOARD_TYPE_2CH:
					case Ci.nsIBbs2chService.BOARD_TYPE_MACHI:
					case Ci.nsIBbs2chService.BOARD_TYPE_OLD2CH:
						charset =  "Shift_JIS";
						break;
					case Ci.nsIBbs2chService.BOARD_TYPE_BE2CH:
					case Ci.nsIBbs2chService.BOARD_TYPE_JBBS:
						charset = "EUC-JP";
						break;
				}

				var fileStream = ChaikaCore.io.getFileInputStream(this.settingFile, charset)
							.QueryInterface(Ci.nsIUnicharLineInputStream);
				var line = {};
				var cont;
				do{
					cont = fileStream.readLine(line);
					var splitPos = line.value.indexOf("=");
					if(splitPos != -1){
						var key = line.value.substring(0, splitPos);
						var value = line.value.substring(splitPos + 1) || null;
						this._settings[key] = value;
					}
				}while(cont);
				fileStream.close();
			}

		}
		return this._settings[aSettingName] || null;
	},


	FILTER_LIMIT_ALL: 0,
	FILTER_LIMIT_LOG: -1,
	FILTER_LIMIT_SUBSCRIBE: -2,
	FILTER_LIMIT_NEW: -3,


	refresh: function(aFilterLimit){
		this.itemsDoc = Cc["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Ci.nsIDOMParser).parseFromString("<boarditems/>", "text/xml");

			// スレッドの URL
		var baseUrlSpec;
		var categoryPath;
		var threadUrlSpec;
		switch(this.type){
			case Ci.nsIBbs2chService.BOARD_TYPE_2CH:
			case Ci.nsIBbs2chService.BOARD_TYPE_BE2CH:
				baseUrlSpec = this.url.resolve("../");
				categoryPath = this.url.spec.substring(baseUrlSpec.length);
				threadUrlSpec = baseUrlSpec + "test/read.cgi/" + categoryPath;
				break;
			case Ci.nsIBbs2chService.BOARD_TYPE_JBBS:
				baseUrlSpec = this.url.resolve("../../");
				categoryPath = this.url.spec.substring(baseUrlSpec.length);
				threadUrlSpec = baseUrlSpec + "bbs/read.cgi/" + categoryPath;
				break;
			case Ci.nsIBbs2chService.BOARD_TYPE_MACHI:
				baseUrlSpec = this.url.resolve("../");
				categoryPath = this.url.spec.substring(baseUrlSpec.length);
				threadUrlSpec = baseUrlSpec + "bbs/read.cgi/" + categoryPath;

				break;
		}

		var boardID = this.id;
		var database = ChaikaCore.storage;

		var sql;
		var statement;
		switch(aFilterLimit){
			case this.FILTER_LIMIT_LOG:
				sql = [
					"SELECT",
					"    4 AS status,",
					"    0 AS number,",
					"    td.dat_id AS dat_id,",
					"    td.title AS title,",
					"    0 AS line_count,",
					"    td.line_count AS read,",
					"    0 AS unread,",
					"    0 AS force,",
					"    STRFTIME(?1, td.dat_id, 'unixepoch', 'localtime') AS make_date",
					"FROM thread_data AS td",
					"WHERE board_id=?2 AND dat_id IN (",
					"    SELECT dat_id FROM thread_data WHERE board_id=?2",
					"    EXCEPT",
					"    SELECT dat_id FROM board_subject WHERE board_id=?2",
					");"
				].join("\n");
				statement = database.createStatement(sql);
				statement.bindStringParameter(0, "%Y-%m-%d %H:%M");
				statement.bindStringParameter(1, boardID);
				break;
			case this.FILTER_LIMIT_SUBSCRIBE:
				sql = [
					"SELECT",
					"    1 + (bs.line_count > td.line_count) AS status,",
					"    bs.ordinal AS number,",
					"    bs.dat_id AS dat_id,",
					"    bs.title AS title,",
					"    bs.line_count AS line_count,",
					"    IFNULL(td.line_count, 0) AS read,",
					"    IFNULL(MAX(bs.line_count - td.line_count, 0), 0) AS unread,",
					"    bs.line_count * 864000 / (?3 - bs.dat_id) AS force,",
					"    STRFTIME(?1, bs.dat_id, 'unixepoch', 'localtime') AS make_date",
					"FROM board_subject AS bs INNER JOIN thread_data AS td",
					"ON td.board_id=?2 AND bs.dat_id=td.dat_id",
					"WHERE bs.board_id=?2;"
				].join("\n");
				statement = database.createStatement(sql);
				statement.bindStringParameter(0, "%Y-%m-%d %H:%M");
				statement.bindStringParameter(1, boardID);
				statement.bindInt32Parameter(2, Date.now() / 1000);
				break;
			case this.FILTER_LIMIT_NEW:
				sql = [
					"SELECT",
					"    2 AS status,",
					"    bs.ordinal AS number,",
					"    bs.dat_id AS dat_id,",
					"    bs.title AS title,",
					"    bs.line_count AS line_count,",
					"    IFNULL(td.line_count, 0) AS read,",
					"    IFNULL(MAX(bs.line_count - td.line_count, 0), 0) AS unread,",
					"    bs.line_count * 864000 / (?3 - bs.dat_id) AS force,",
					"    STRFTIME(?1, bs.dat_id, 'unixepoch', 'localtime') AS make_date",
					"FROM board_subject AS bs INNER JOIN thread_data AS td",
					"ON td.board_id=?2 AND bs.dat_id=td.dat_id AND bs.line_count > td.line_count",
					"WHERE bs.board_id=?2;"
				].join("\n");
				statement = database.createStatement(sql);
				statement.bindStringParameter(0, "%Y-%m-%d %H:%M");
				statement.bindStringParameter(1, boardID);
				statement.bindInt32Parameter(2, Date.now() / 1000);
				break;
			default:
				sql = [
					"SELECT",
					"    IFNULL((td.line_count != 0) + (bs.line_count > td.line_count), 0) AS status,",
					"    bs.ordinal AS number,",
					"    bs.dat_id AS dat_id,",
					"    bs.title AS title,",
					"    bs.line_count AS line_count,",
					"    IFNULL(td.line_count, 0) AS read,",
					"    IFNULL(MAX(bs.line_count - td.line_count, 0), 0) AS unread,",
					"    bs.line_count * 864000 / (?3 - bs.dat_id) AS force,",
					"    STRFTIME(?1, bs.dat_id, 'unixepoch', 'localtime') AS make_date",
					"FROM board_subject AS bs LEFT OUTER JOIN thread_data AS td",
					"ON td.board_id=?2 AND bs.dat_id=td.dat_id",
					"WHERE bs.board_id=?2",
					"LIMIT ?4;"
				].join("\n");
				statement = database.createStatement(sql);
				statement.bindStringParameter(0, "%Y-%m-%d %H:%M");
				statement.bindStringParameter(1, boardID);
				statement.bindInt32Parameter(2, Date.now() / 1000);
				statement.bindInt32Parameter(3, (aFilterLimit > 0) ? aFilterLimit : 10000);
				break;
		}

		database.beginTransaction();
		try{
			while(statement.executeStep()){
				var itemNode = this.itemsDoc.createElement("boarditem");
				itemNode.setAttribute("status",     statement.getInt32(0));
				itemNode.setAttribute("number",     statement.getInt32(1));
				itemNode.setAttribute("numberSort", statement.getInt32(1) + 100000);
				itemNode.setAttribute("datID",      statement.getString(2));
				itemNode.setAttribute("id",         "item-" + statement.getString(2));
				itemNode.setAttribute("title",      statement.getString(3));
				itemNode.setAttribute("count",      statement.getInt32(4));
				itemNode.setAttribute("countSort",  statement.getInt32(4) + 100000);
				itemNode.setAttribute("read",       statement.getInt32(5));
				itemNode.setAttribute("readSort",   statement.getInt32(5) + 100000);
				itemNode.setAttribute("unread",     statement.getInt32(6));
				itemNode.setAttribute("unreadSort", statement.getInt32(6) + 100000);
				itemNode.setAttribute("force",      Math.round(statement.getInt32(7) / 10));
				itemNode.setAttribute("forceSort",  statement.getInt32(7)  + 100000);
				itemNode.setAttribute("created",  statement.getString(8));
				itemNode.setAttribute("url",      threadUrlSpec + statement.getString(2) + "/");

				this.itemsDoc.documentElement.appendChild(itemNode);
			}
		}catch(ex){
			Components.utils.reportError(ex);
		}finally{
			statement.reset();
			database.commitTransaction();
		}

	},


	boardSubjectUpdate: function ChaikaBoard_boardSubjectUpdate(){
		if(!this.subjectFile.exists()){
			ChaikaCore.logger.warning("FILE NOT FOUND: " + this.subjectFile.path);
			return;
		}

			// 行の解析に使う正規表現
		var regLine;
		switch(this.type){
			case Ci.nsIBbs2chService.BOARD_TYPE_2CH:
			case Ci.nsIBbs2chService.BOARD_TYPE_BE2CH:
				regLine = /^(\d{9,10})\.dat<>(.+) ?\((\d{1,4})\)/;
				break;
			case Ci.nsIBbs2chService.BOARD_TYPE_JBBS:
			case Ci.nsIBbs2chService.BOARD_TYPE_MACHI:
				regLine = /^(\d{9,10})\.cgi,(.+) ?\((\d{1,4})\)/;
				break;
		}

		var charset;
		switch(this.type){
			case Ci.nsIBbs2chService.BOARD_TYPE_2CH:
			case Ci.nsIBbs2chService.BOARD_TYPE_MACHI:
				charset = "Shift_JIS";
				break;
			case Ci.nsIBbs2chService.BOARD_TYPE_BE2CH:
			case Ci.nsIBbs2chService.BOARD_TYPE_JBBS:
				charset = "euc-jp";
				break;
		}

		var fileStream = ChaikaCore.io.getFileInputStream(this.subjectFile, charset)
								.QueryInterface(Ci.nsIUnicharLineInputStream);

		var database = ChaikaCore.storage;
		var statement = database.createStatement(
				"INSERT INTO board_subject(thread_id, board_id, dat_id, title, title_n, line_count, ordinal) " +
				"VALUES(?1,?2,?3,?4,?5,?6,?7);");

		var boardID = this.id;
		database.beginTransaction();
		try{
			database.executeSimpleSQL("DELETE FROM board_subject WHERE board_id='" + boardID + "';");
			var line = {};
			var ordinal = 1;
			var cont;
			do{
				cont = fileStream.readLine(line);
				if(!regLine.test(line.value)) continue;
				var datID = RegExp.$1;
				var threadID = boardID + datID;
				var count = Number(RegExp.$3);
				var title = convertEntities(RegExp.$2);
				// ChaikaCore.logger.debug([threadID, boardID, datID, count, ordinal]);
				statement.bindStringParameter(0, threadID);
				statement.bindStringParameter(1, boardID);
				statement.bindStringParameter(2, datID);
				statement.bindStringParameter(3, title);
				statement.bindStringParameter(4, "");
				statement.bindInt32Parameter(5, count);
				statement.bindInt32Parameter(6, ordinal);
				statement.execute();
				ordinal++;
			}while (cont);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			throw makeException(ex.result);
		}finally{
			statement.reset();
			database.commitTransaction();
			fileStream.close();
		}
		this._setBoardData();
	},


	_setBoardData: function(){
		var boardID = this.id;
		var type = this.type;
		var database = ChaikaCore.storage;
		database.beginTransaction();
		var statement = database.createStatement("SELECT _rowid_ FROM board_data WHERE board_id=?1;");
		try{
			statement.bindStringParameter(0, boardID);
			var boardRowID = 0;
			if(statement.executeStep()){
				boardRowID = statement.getInt64(0);
			}
			statement.reset();

			if(boardRowID){
				statement = database.createStatement(
					"UPDATE board_data SET url=?1, type=?2, last_modified=?3 WHERE _rowid_=?4;");
				statement.bindStringParameter(0, this.url.spec);
				statement.bindInt32Parameter(1, type);
				statement.bindInt64Parameter(2, this.subjectFile.clone().lastModifiedTime);
				statement.bindInt64Parameter(3, boardRowID);
				statement.execute();
			}else{
				statement = database.createStatement(
					"INSERT OR REPLACE INTO board_data(board_id, url, type, last_modified) VALUES(?1,?2,?3,?4);");
 				statement.bindStringParameter(0, boardID);
				statement.bindStringParameter(1, this.url.spec);
				statement.bindInt32Parameter(2, type);
				statement.bindInt64Parameter(3, this.subjectFile.clone().lastModifiedTime);
				statement.execute();
			}
		}catch(ex){
			Components.utils.reportError(ex);
		}finally{
			statement.reset();
			database.commitTransaction();
		}
	}

};


ChaikaBoard.getBoardID = function ChaikaBoard_getBoardID(aBoardURL){
	if(!(aBoardURL instanceof Ci.nsIURL)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}
	if(aBoardURL.scheme.indexOf("http") != 0){
		throw makeException(Cr.NS_ERROR_INVALID_ARG);
	}

	var boardID = "/";
	if(aBoardURL.host.indexOf(".2ch.net")!=-1){
		boardID += "2ch" + aBoardURL.path;
	}else if(aBoardURL.host.indexOf(".machi.to")!=-1){
		boardID += "machi" + aBoardURL.path;
	}else if(aBoardURL.host.indexOf(".bbspink.com")!=-1){
		boardID += "bbspink" + aBoardURL.path;
	}else if(aBoardURL.host == "jbbs.livedoor.jp"){
		boardID += "jbbs" + aBoardURL.path;
	}else{
		boardID += "outside/";
		boardID += aBoardURL.host +  aBoardURL.path;
	}
	return boardID;
}


ChaikaBoard.getLogFileAtURL = function ChaikaBoard_getLogFileAtURL(aURL){
	var logFile = null;
	try{
		var boardID = ChaikaBoard.getBoardID(aURL);
		logFile = ChaikaBoard.getLogFileAtBoardID(boardID);
	}catch(ex){
		ChaikaCore.logger.error(ex);
		throw makeException(ex.result);
	}
	return logFile;
}

ChaikaBoard.getLogFileAtBoardID = function ChaikaBoard_getLogFileAtBoardID(aBoardID){
	var logFile = ChaikaCore.getLogDir();

	var pathArray = aBoardID.split("/");
	for(var i=0; i<pathArray.length; i++){
		if(pathArray[i]) logFile.appendRelativePath(pathArray[i]);
	}
	return logFile;
}


ChaikaBoard.getBoardType = function ChaikaBoard_getBoardType(aURL){
	if(!(aURL instanceof Ci.nsIURI)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}

	if(!(aURL instanceof Ci.nsIURL)) return Ci.nsIBbs2chService.BOARD_TYPE_PAGE;
		// HTTP 以外
	if(aURL.scheme != "http") return Ci.nsIBbs2chService.BOARD_TYPE_PAGE;
		// HOST だけの URL
	if(aURL.directory.length == 1) return Ci.nsIBbs2chService.BOARD_TYPE_PAGE;

	if(EX_HOSTS.indexOf(aURL.host) != -1) return Ci.nsIBbs2chService.BOARD_TYPE_PAGE;

		// Be@2ch.net
	if(aURL.host == "be.2ch.net") return Ci.nsIBbs2chService.BOARD_TYPE_BE2CH;
		// 2ch.net
	if(aURL.host.indexOf(".2ch.net") != -1) return Ci.nsIBbs2chService.BOARD_TYPE_2CH;
		// bbspink.com
	if(aURL.host.indexOf(".bbspink.com") != -1) return Ci.nsIBbs2chService.BOARD_TYPE_2CH;
		// まちBBS
	if(aURL.host.indexOf(".machi.to") != -1) return Ci.nsIBbs2chService.BOARD_TYPE_MACHI;
		// JBBS
	if(aURL.host == "jbbs.livedoor.jp") return Ci.nsIBbs2chService.BOARD_TYPE_JBBS;

		// スレッド URL
	if(aURL.directory.indexOf("/test/read.cgi/") != -1) return Ci.nsIBbs2chService.BOARD_TYPE_2CH;
	if((aURL.fileName == "read.cgi") && (aURL.query.indexOf("key=") != -1))
			return Ci.nsIBbs2chService.BOARD_TYPE_OLD2CH;

	return Ci.nsIBbs2chService.BOARD_TYPE_PAGE;
}