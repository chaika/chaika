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
 * Portions created by the Initial Developer are Copyright (C) 2009
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaThread.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/**
 * 開始時の処理
 */
function startup(){
	ThreadUpdateObserver.startup();
	setTimeout("delayStartup()", 0);
}

function delayStartup(){
	BoardTree.initTree();
}


/**
 * 終了時の処理
 */
function shutdown(){
	ThreadUpdateObserver.shutdown();
}


/**
 * ブラウザへのイベントフロー抑制
 */
function eventBubbleCheck(aEvent){
	// オートスクロールや Find As You Type を抑制しつつキーボードショートカットを許可
	if(!(aEvent.ctrlKey || aEvent.shiftKey || aEvent.altKey || aEvent.metaKey))
		aEvent.stopPropagation();
}


function vacuum(){
	document.getElementById("vacuumButton").disabled = true;
	setTimeout("delayVacuum()", 0);
}


function delayVacuum(){
	var storage = ChaikaCore.storage;
	var beforeStorageSize = storage.databaseFile.clone().fileSize / 1024;

		// スレを読んだことのない板情報を削除
	storage.beginTransaction();
	try{
		storage.executeSimpleSQL("DELETE FROM board_data WHERE board_id IN " +
				" (SELECT board_id FROM board_data EXCEPT SELECT board_id FROM thread_data);");
		storage.executeSimpleSQL("DELETE FROM board_subject WHERE board_id IN " +
				"(SELECT board_id FROM board_subject EXCEPT SELECT board_id FROM thread_data);");
	}catch(ex){
		ChaikaCore.logger.error(ex);
	}finally{
		storage.commitTransaction();
	}

	try{
		storage.executeSimpleSQL("VACUUM");
	}catch(ex){
		ChaikaCore.logger.error(ex);
	}

	var afterStorageSize = storage.databaseFile.clone().fileSize / 1024;
	alert("データベースを最適化しました\n" + beforeStorageSize +"KB > "+ afterStorageSize +"KB");
	document.getElementById("vacuumButton").disabled = false;
}



var BoardTree = {

	initTree: function BoardTree_initTree(){
		this.tree = document.getElementById("boardTree");

		var itemsDoc = Cc["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Ci.nsIDOMParser).parseFromString("<boardItems/>", "text/xml");

		var boardItem = itemsDoc.createElement("boardItem");
		itemsDoc.documentElement.appendChild(boardItem);
		boardItem.setAttribute("title", "(すべて)");
		boardItem.setAttribute("id",    "*");
		boardItem.setAttribute("url",   "");
		boardItem.setAttribute("type",  "0");

		var sql = [
			"SELECT",
			"    IFNULL(bm.title, td.board_id) AS board_title,",
			"    td.board_id AS board_id,",
			"    IFNULL(bm.url, '') AS board_url,",
			"    IFNULL(bm.board_type, 0) AS board_type,",
			"    td.url AS threas_url",
			"FROM thread_data AS td LEFT OUTER JOIN bbsmenu AS bm",
			"ON td.board_id=bm.board_id",
			"GROUP BY td.board_id;"
		].join("\n");

		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var storage = ChaikaCore.storage;
		var statement = storage.createStatement(sql);

		storage.beginTransaction();
		try{
			while(statement.executeStep()){
				var boardItem = itemsDoc.createElement("boardItem");
				boardItem.setAttribute("title", statement.getString(0));
				boardItem.setAttribute("id",    statement.getString(1));
				boardItem.setAttribute("url",   statement.getString(2));
				boardItem.setAttribute("type",  statement.getInt32(3));
				if(!boardItem.getAttribute("url")){
					var threadURL = ioService.newURI(statement.getString(4), null, null);
					var boardURL =  ChaikaThread.getBoardURL(threadURL);
					boardItem.setAttribute("url", boardURL.spec);
				}
				itemsDoc.documentElement.appendChild(boardItem);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}finally{
			statement.reset();
			statement.finalize();
			storage.commitTransaction();
		}

		this.tree.builder.datasource = itemsDoc.documentElement;
		this.tree.builder.rebuild();
	},


	select: function BoardTree_select(aEvent){
		var currentIndex = this.tree.currentIndex;
		if(currentIndex == -1) return;
		var item = this._getItem(currentIndex);
		ThreadTree.initTree(item.id);
	},


	showContext: function BoardTree_showContext(aEvent){
		// ツリーのアイテム以外をクリック
		if(this.getClickItemIndex(aEvent) == -1) return false;

		var currentIndex = this.tree.currentIndex;

		var item = this._getItem(currentIndex);

		var boardTreeContext = document.getElementById("boardTreeContext");
		boardTreeContext.itemTitle = item.title;
		boardTreeContext.itemURL = item.urlSpec;
	},


	getClickItemIndex: function BoardTree_getClickItemIndex(aEvent){
		var row = {}
		var obj = {}
		this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
		if(!obj.value) return -1;
		return row.value;
	},


	_getItem: function BoardTree__getItem(aIndex){
		var view = this.tree.view;
		var titleColumn = this.tree.columns.getNamedColumn("boardTree-title");
		var urlColumn   = this.tree.columns.getNamedColumn("boardTree-url");

		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		var item = {};
		item.title   = view.getCellText(aIndex, titleColumn);
		item.id      = view.getCellValue(aIndex, titleColumn);
		item.urlSpec = view.getCellText(aIndex, urlColumn);
		item.url     = (item.urlSpec) ? ioService.newURI(item.urlSpec, null, null) : null;
		item.type    = parseInt(view.getCellValue(aIndex, urlColumn));

		return item;
	}

};




var ThreadTree = {

	initTree: function ThreadTree_initTree(aBoardID){
		this.tree = document.getElementById("threadTree");

		var itemsDoc = Cc["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Ci.nsIDOMParser).parseFromString("<threadItems/>", "text/xml");

		var sql = "";

		if(aBoardID == "*"){
			sql = [
				"SELECT DISTINCT",
				"    td.title AS title,",
				"    td.line_count AS read,",
				"    td.dat_id AS dat_id,",
				"    td.board_id AS board_id,",
				"    IFNULL(bm.board_type, 0) AS board_type,",
				"    IFNULL(bm.title, td.board_id) AS board_title,",
				"    td.url,",
				"    STRFTIME('%Y/%m/%d %H:%M', td.dat_id, 'unixepoch', 'localtime') AS created,",
				"    td.line_count * 86400 / (strftime('%s','now') - td.dat_id) AS force",
				"FROM thread_data AS td LEFT OUTER JOIN bbsmenu AS bm",
				"ON td.board_id=bm.board_id"
			].join("\n");
		}else{
			sql = [
				"SELECT DISTINCT",
				"    td.title AS title,",
				"    td.line_count AS read,",
				"    td.dat_id AS dat_id,",
				"    td.board_id AS board_id,",
				"    IFNULL(bm.board_type, 0) AS board_type,",
				"    IFNULL(bm.title, td.board_id) AS board_title,",
				"    td.url,",
				"    STRFTIME('%Y/%m/%d %H:%M', td.dat_id, 'unixepoch', 'localtime') AS created,",
				"    td.line_count * 86400 / (strftime('%s','now') - td.dat_id) AS force",
				"FROM thread_data AS td LEFT OUTER JOIN bbsmenu AS bm",
				"ON td.board_id=bm.board_id",
				"WHERE td.board_id='" + aBoardID + "';"
			].join("\n");
		}

		var storage = ChaikaCore.storage;
		var statement = storage.createStatement(sql);

		storage.beginTransaction();
		try{
			while(statement.executeStep()){
				var threadItem = itemsDoc.createElement("threadItem");
				threadItem.setAttribute("title",      statement.getString(0));
				threadItem.setAttribute("read",       statement.getInt32(1));
				threadItem.setAttribute("readSort",   statement.getInt32(1) + 10000);
				threadItem.setAttribute("datID",      statement.getString(2));
				threadItem.setAttribute("boardID",    statement.getString(3));
				threadItem.setAttribute("type",       statement.getInt32(4));
				threadItem.setAttribute("boardTitle", statement.getString(5));
				threadItem.setAttribute("url",        statement.getString(6));
				threadItem.setAttribute("created",    statement.getString(7));
				threadItem.setAttribute("force",      statement.getInt32(8));
				threadItem.setAttribute("forceSort",  statement.getInt32(8) + 10000);
				itemsDoc.documentElement.appendChild(threadItem);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}finally{
			statement.reset();
			statement.finalize();
			storage.commitTransaction();
		}

		this.tree.builder.datasource = itemsDoc.documentElement;
		this.tree.builder.rebuild();

		this._lastSelectedID = aBoardID;
	},


	refreshTree: function ThreadTree_refreshTree(){
		if(this._lastSelectedID){
			this.initTree(this._lastSelectedID);
		}
	},


	showContext: function ThreadTree_showContext(aEvent){
		// ツリーのアイテム以外をクリック
		if(this.getClickItemIndex(aEvent) == -1) return false;

		var currentIndex = this.tree.currentIndex;
		var selectionIndices = this.getSelectionIndices();

		selectionIndices = selectionIndices.filter(function(aElement, aIndex, aArray){
			return (aElement != currentIndex);
		});
		selectionIndices.unshift(currentIndex);

		var urls = selectionIndices.map(function(aElement, aIndex, aArray){
			return ThreadTree._getItem(aElement).urlSpec;
		});


		var threadTreeContext = document.getElementById("threadTreeContext");
		threadTreeContext.itemTitle = this._getItem(currentIndex).title;
		threadTreeContext.itemURL = urls.join(",");
	},


	getClickItemIndex: function ThreadTree_getClickItemIndex(aEvent){
		var row = {}
		var obj = {}
		this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
		if(!obj.value) return -1;
		return row.value;
	},


	getSelectionIndices: function ThreadTree_getSelectionIndices(){
		var resultArray = new Array();

		var rangeCount = this.tree.treeBoxObject.view.selection.getRangeCount();
		for(var i=0; i<rangeCount; i++){
			var rangeMin = {};
			var rangeMax = {};

			this.tree.treeBoxObject.view.selection.getRangeAt(i, rangeMin, rangeMax);
			for (var j=rangeMin.value; j<=rangeMax.value; j++){
				resultArray.push(j);
			}
		}
		return resultArray;
	},


	_getItem: function ThreadTree__getItem(aIndex){
		var view = this.tree.view;
		var titleColumn = this.tree.columns.getNamedColumn("threadTree-title");

		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		var item = {};
		item.title   = view.getCellText(aIndex, titleColumn);
		item.urlSpec = view.getCellValue(aIndex, titleColumn);
		item.url     = (item.urlSpec) ? ioService.newURI(item.urlSpec, null, null) : null;

		return item;
	}

};




var ThreadUpdateObserver = {

	startup: function ThreadUpdateObserver_startup(){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.addObserver(this, "itemContext:deleteLog", false);
	},


	shutdown: function ThreadUpdateObserver_shutdown(){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.removeObserver(this, "itemContext:deleteLog");
	},


	deleteLogsTreeUpdate: function ThreadUpdateObserver_deleteLogsTreeUpdate(aURLs){
		ThreadTree.refreshTree();
	},


	observe: function ThreadUpdateObserver_observe(aSubject, aTopic, aData){
		if(aTopic == "itemContext:deleteLog"){
			this.deleteLogsTreeUpdate(aData.split(","));
		}
	},


	QueryInterface: XPCOMUtils.generateQI([
		Ci.nsISupportsWeakReference,
		Ci.nsIObserver,
		Ci.nsISupports
	])

};