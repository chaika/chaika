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
 * The Original Code is bbs2chreader.
 *
 * The Initial Developer of the Original Code is
 * flyson.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson at users.sourceforge.jp>
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
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


var gBoard;
var gSubjectDownloader;
var gSettingDownloader;
var gBoardMoveChecker;
var gNewURL;


/**
 * 開始時の処理
 */
function startup(){
	document.title = location.href;
	document.getElementById("lblTitle").setAttribute("value", location.href);

		// chrome から呼ばれたら止める
	if(location.href.match(/^chrome:/)){
		alert("BAD URL");
		return;
	}

		// 板一覧URLの取得
	var boardURLSpec = location.pathname.substring(1);

	try{
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var boardURL = ioService.newURI(boardURLSpec, null, null);
		gBoard = new ChaikaBoard(boardURL);
	}catch(ex){
		// 認識できない URL
		alert("BAD URL");
		return;
	}


	loadPersist();


	var subjectFile = gBoard.subjectFile.clone();
	var settingFile = gBoard.settingFile.clone();
	if(ChaikaCore.pref.getBool("board_auto_update")){
		subjectUpdate();
	}else if(!subjectFile.exists() || subjectFile.fileSize==0){
		subjectUpdate();
	}else if(gBoard.getItemLength()==0){
		subjectUpdate();
	}else if(!settingFile.exists() || settingFile.fileSize==0){
		settingUpdate();
	}else{
		BoardTree.initTree();
	}

	ThreadUpdateObserver.startup();
}


/**
 * 終了時の処理
 */
function shutdown(){

	if(!BoardTree.firstInitBoardTree){
		savePersist();
	}

		// ダウンロードのキャンセル
	if(gSubjectDownloader && gSubjectDownloader.loading)
		gSubjectDownloader.abort(true);
	if(gSettingDownloader && gSettingDownloader.loading)
		gSettingDownloader.abort(true);
	if(gBoardMoveChecker && gBoardMoveChecker.checking)
		gBoardMoveChecker.abort();

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


function loadPersist(){
	var jsonFile = ChaikaCore.getDataDir();
	jsonFile.appendRelativePath("boardPersist.json");
	if(!jsonFile.exists()) return;

	var json = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
	var content = ChaikaCore.io.readString(jsonFile, "UTF-8");
	try{
		var persistData = json.decode(content);
		for(var i in persistData){
			var element = document.getElementById(i);
			if(!element) continue;
			for(var j in persistData[i]){
				var attrName = String(j);
				var attrValue = String(persistData[i][j]);
				element.setAttribute(attrName, attrValue);
			}
		}
	}catch(ex){
		ChaikaCore.logger.error(ex + " : " + content);
	}
}


function savePersist(){
	var persistData = {};
	var xpathResult = document.evaluate("descendant::*[@id][@persist2]", document, null,
						XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

	for (var i = 0; i < xpathResult.snapshotLength; i++){
		var element = xpathResult.snapshotItem(i);
		var persists = element.getAttribute("persist2").split(/\s/);

		for(var j=0; j<persists.length; j++){
			var attrName = persists[j];
			var attrValue = element.getAttribute(attrName);

			if(attrValue != "" && attrValue != "undefined"){
				if(!persistData[element.id]) persistData[element.id] = {};
				persistData[element.id][attrName] = attrValue;
			}
		}
	}

	var jsonFile = ChaikaCore.getDataDir();
	jsonFile.appendRelativePath("boardPersist.json");
	var json = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
	ChaikaCore.io.writeString(jsonFile, "UTF-8", false, json.encode(persistData));
}


function setPageTitle(){
	var boardTitle = gBoard.getTitle();
	document.title = boardTitle + " [chaika]";
	document.getElementById("lblTitle").setAttribute("value", boardTitle);
}




var BoardTree = {

	tree: null,
	firstInitBoardTree: true,


	initTree: function BoardTree_initTree(aNoFocus){
		this.tree = document.getElementById("boardTree");

		setPageTitle();
		if(this.firstInitBoardTree){
			ChaikaCore.history.visitPage(gBoard.url,
					ChaikaBoard.getBoardID(gBoard.url), gBoard.getTitle(), 0);
			this.firstInitBoardTree = false;
		}

		var startTime = Date.now();

		var searchStr = document.getElementById("searchTextBox").value;
		if(searchStr){
			searchStr = "%" + searchStr + "%";
			gBoard.refresh(gBoard.FILTER_LIMIT_SEARCH, searchStr);
		}else{
			var filterLimit = Number(document.getElementById("filterGroup").getAttribute("value"));
			gBoard.refresh(filterLimit);
		}

		this.tree.builder.datasource = gBoard.itemsDoc.documentElement;
		this.tree.builder.rebuild();

		ChaikaCore.logger.debug("Tree Build Time: " + (Date.now() - startTime));

			// 前回のソートを復元
		var colNodes = document.getElementsByClassName("boardTreeCol");
		for(var i=0; i<colNodes.length; i++){
			if(colNodes[i].getAttribute("sortActive") == "true"){
				var sortDirection = colNodes[i].getAttribute("sortDirection");
				if(sortDirection == "descending"){
					colNodes[i].setAttribute("sortDirection", "ascending");
				}else if(sortDirection == "natural"){
					colNodes[i].setAttribute("sortDirection", "descending");
				}else{
					colNodes[i].setAttribute("sortDirection", "natural");
				}
				this.tree.builderView.sort(colNodes[i]);
			}
		}

			// フォーカス
		if(!aNoFocus){
			this.tree.focus();
			this.tree.treeBoxObject.view.selection.select(0);
		}

	},


	click: function BoardTree_click(aEvent){
			// ツリーのアイテム以外をクリック
		if(this.getClickItemIndex(aEvent) == -1) return;

		if(this._clickTimer){
			clearTimeout(this._clickTimer);
		}
		this._clickTimer = setTimeout(function(aEvent){
			BoardTree.clickDelay(aEvent);
		}, 50, aEvent);
	},


	clickDelay: function BoardTree_clickDelay(aEvent){
		this._clickTimer = null;

		var button = aEvent.button;
		var detail = aEvent.detail;

		var openActionPref;
		if(button==0 && detail==1){
				// クリック
			openActionPref = "board_click_action";
		}else if(button==0 && detail==2){
				// ダブルクリック
			openActionPref = "board_double_click_action";
		}else if(button==1 && detail==1){
				// ミドルクリック
			openActionPref = "board_middle_click_action";
		}else{
			return;
		}

		var openAction = ChaikaCore.pref.getInt(openActionPref);
		if(openAction==1){
			this.openThread(false);
		}else if(openAction==2){
			this.openThread(true);
		}
	},


	keyDown: function BoardTree_keyDown(aEvent){
		if(this.tree.currentIndex == -1) return;

			// エンターキー以外なら終了
		if(!(aEvent.keyCode==aEvent.DOM_VK_ENTER || aEvent.keyCode==aEvent.DOM_VK_RETURN)){
			return;
		}

		if(aEvent.ctrlKey || aEvent.altKey){
			this.openThread(true);
		}else{
			this.openThread(false);
		}
	},


	showContext: function BoardTree_showContext(aEvent){
			// ツリーのアイテム以外をクリック
		if(this.getClickItemIndex(aEvent) == -1) return false;

		var currentIndex = this.tree.currentIndex;
		var selectionIndices = this.getSelectionIndices();

		selectionIndices = selectionIndices.filter(function(aElement, aIndex, aArray){
			return (aElement != currentIndex);
		});
		selectionIndices.unshift(currentIndex);

		var urls = selectionIndices.map(function(aElement, aIndex, aArray){
			return BoardTree.getItemURL(aElement).spec;
		});

		var boardTreeContextMenu = document.getElementById("boardTreeContextMenu");
		boardTreeContextMenu.itemTitle = this.getItemTitle(currentIndex);
		boardTreeContextMenu.itemURL = urls.join(",");

		return true;
	},


	getClickItemIndex: function BoardTree_getClickItemIndex(aEvent){
		var row = {}
		var obj = {}
		this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
		if(!obj.value) return -1;
		return row.value;
	},


	getItemURL: function BoardTree_getItemURL(aIndex){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		var titleColumn = this.tree.columns.getNamedColumn("boardTreeCol-title");
		var spec = this.tree.builder.getCellValue(aIndex, titleColumn);

		return ioService.newURI(spec, null, null);
	},


	getItemTitle: function BoardTree_getItemTitle(aIndex){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		var titleColumn = this.tree.columns.getNamedColumn("boardTreeCol-title");
		return this.tree.builder.getCellText(aIndex, titleColumn);
	},


	getSelectionIndices: function BoardTree_getSelectionIndices(){
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


	openThread: function BoardTree_openThread(aAddTab){
		var index = this.tree.currentIndex;
		if(index == -1) return null;
		ChaikaCore.browser.openThread(this.getItemURL(index), aAddTab, true);
	},


		// nsDragAndDrop Observer
	onDragStart: function BoardTree_onDragStart(aEvent, aTransferData, aDragAction){
		var itemIndex = this.getClickItemIndex(aEvent);
		if(itemIndex == -1) return;
		if(this.getSelectionIndices().length != 1) return;

		var url = this.getItemURL(itemIndex).spec;
		var title = this.getItemTitle(itemIndex);
		aTransferData.data = new TransferData();
		aTransferData.data.addDataForFlavour("text/x-moz-url", url + "\n" + title);
		aTransferData.data.addDataForFlavour("text/unicode", url);
	}

};




function setStatus(aString){
	document.getElementById("lblStatus").value = aString;
}

/**
 * subject.txt をダウンロードする
 */
function subjectUpdate(aEvent){
	if(aEvent && aEvent.type=="click" && aEvent.button!=0) return;

		// ダウンロード間隔の制限
	var subjectFile = gBoard.subjectFile.clone();
	var settingFile = gBoard.settingFile.clone();
	if(subjectFile.exists()){
		var interval = new Date().getTime() - subjectFile.lastModifiedTime;
		var updateIntervalLimit =  ChaikaCore.pref.getInt("board_update_interval_limit");
			// 不正な値や、10 秒以下なら 10 秒にする
		if(isNaN(parseInt(updateIntervalLimit)) || updateIntervalLimit < 10)
			updateIntervalLimit = 10;

		if(interval < updateIntervalLimit * 1000){
			if(!settingFile.exists() || settingFile.fileSize==0){
				settingUpdate();
			}else{
				BoardTree.initTree();
			}
			return;
		}
	}

	gSubjectDownloader = new ChaikaDownloader(gBoard.subjectURL, gBoard.subjectFile);

	gSubjectDownloader.onStart = function(aDownloader){
		setStatus("start: " + this.url.spec);
	};
	gSubjectDownloader.onStop = function(aDownloader, aStatus){
		setStatus("");

		var subjectFile = gBoard.subjectFile.clone();
		var settingFile = gBoard.settingFile.clone();

		if(aStatus == 302 || !subjectFile.exists() || subjectFile.fileSize==0){
			setStatus("スレッド一覧を取得できませんでした。板が移転した可能性があります。");
			document.getElementById("dckUpdate").selectedIndex = 1;
			return;
		}

		gBoard.boardSubjectUpdate();

		if(!settingFile.exists() || settingFile.fileSize==0){
			settingUpdate();
		}else{
			BoardTree.initTree();
		}
	};
	gSubjectDownloader.onProgressChange = function(aDownloader, aPercentage){
		setStatus("downloading: " + aPercentage + "%");
	};
	gSubjectDownloader.onError = function(aDownloader, aErrorCode){
		var errorText = "";
		switch(aErrorCode){
			case ChaikaDownloader.ERROR_BAD_URL:
				errorText = "BAD URL";
				break;
			case ChaikaDownloader.ERROR_NOT_AVAILABLE:
				errorText = "NOT AVAILABLE";
				break;
			case ChaikaDownloader.ERROR_FAILURE:
				errorText = "ERROR FAILURE";
				break;
		}
		setStatus("ネットワークの問題により、スレッド一覧を取得できませんでした。");
	};


	gSubjectDownloader.download();
	setStatus("request: " + gSubjectDownloader.url.spec);
}


/**
 * SETTING.TXT をダウンロードする
 */
function settingUpdate(){
	gSettingDownloader = new ChaikaDownloader(gBoard.settingURL, gBoard.settingFile);

	gSettingDownloader.onStart = function(aDownloader){
		setStatus("start: " + this.url.spec);
	};
	gSettingDownloader.onStop = function(aDownloader, aStatus){
		setStatus("");
		BoardTree.initTree();
	};
	gSettingDownloader.onProgressChange = function(aDownloader, aPercentage){
		setStatus("downloading: " + aPercentage + "%");
	};
	gSettingDownloader.onError = function(aDownloader, aErrorCode){
		if(aErrorCode == ChaikaDownloader.ERROR_NOT_AVAILABLE){
			setStatus("Download Error: NOT AVAILABLE: " + this.url.spec);
		}
	};


	gSettingDownloader.download();
	setStatus("request: " + gSettingDownloader.url.spec);
}

function showBrowser(aTab){
	if(aTab){
		document.getElementById("popTools").hidePopup();
	}
	ChaikaCore.browser.openURL(gBoard.url, aTab);
}

function openLogsDir(){
	var logDir = gBoard.subjectFile.parent.QueryInterface(Ci.nsILocalFile);
	try{
		logDir.reveal();
	}catch(ex){
			// for Unix
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	    var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
    				.getService(Ci.nsIExternalProtocolService);
		var logDirURI = ioService.newFileURI(logDir);
		protocolService.loadUrl(logDirURI);
	}
}

function openSettings(){
	var settingDialogURL = "chrome://chaika/content/settings/settings.xul#paneBoard";

	var features = "";
	try{
		var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
    	var instantApply = pref.getBoolPref("browser.preferences.instantApply");
		features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
	}catch(ex){
		features = "chrome,titlebar,toolbar,centerscreen,modal";
	}
	window.openDialog(settingDialogURL, "", features);
}

function showBanner(aEvent){
	if(aEvent.type=="click" && aEvent.button!=0) return;

	var imgBanner = document.getElementById("imgHiddenBanner");
	imgBanner.removeAttribute("src");
	imgBanner.setAttribute("src", gBoard.getLogoURL().spec);
}

function bannerLoaded(){
	var imgBanner = document.getElementById("imgBanner");
	imgBanner.setAttribute("src", gBoard.getLogoURL().spec);

	var lblShowBanner = document.getElementById("lblShowBanner");
	var popBanner = document.getElementById("popBanner");

	popBanner.openPopup(lblShowBanner, 0, 0, "end", false, true);
}

function bannerLoadError(aEvent){
	alert("バナーの読み込みに失敗しました");
}


function boardMoveCheck(aEvent){
	if(aEvent.type=="click" && aEvent.button!=0) return;

	gBoardMoveChecker = new b2rBoardMoveChecker();
	gBoardMoveChecker.onChecked = function(aSuccess, aNewURL){
		if(aSuccess){
			setStatus(aNewURL +" への移転を確認しました");
			gNewURL = aNewURL;
			document.getElementById("dckUpdate").selectedIndex = 2;
		}else{
			setStatus("移転先を確認できませんでした");
			gNewURL = null;
			document.getElementById("dckUpdate").selectedIndex = 0;
		}
		gBoardMoveChecker = null;
	}
	gBoardMoveChecker.check(gBoard.url.spec);
	setStatus("板の移転を確認中...");
}

function moveNewURL(aEvent){
	if(aEvent.type=="click" && aEvent.button!=0) return;

	if(gNewURL){
		var oldLogDir = ChaikaBoard.getLogFileAtURL(gBoard.url);
		try{
			var subjectFile = gBoard.subjectFile.clone();
			var settingFile = gBoard.settingFile.clone();
			if(subjectFile.exists() && subjectFile.fileSize==0){
				subjectFile.remove(true);
			}
			if(settingFile.exists() && settingFile.fileSize==0){
				settingFile.remove(true);
			}
			oldLogDir.remove(false);
		}catch(ex){}

		setTimeout(function(){
			window.location.href = "chaika://board/" + gNewURL;
		}, 0);
	}else{
		document.getElementById("dckUpdate").selectedIndex = 0;
	}
}




function b2rBoardMoveChecker(){
}

b2rBoardMoveChecker.prototype = {
	get cheking(){
		this._checkiing;
	},

	check: function(aBoardURLSpec){
		this._checkiing = false;
		if(this._httpReq && this._httpReq.readyState!=0){
			this._httpReq.abort();
		}
		this._httpReq = new XMLHttpRequest();
		var context = this;
		this._httpReq.onreadystatechange = function(){
			context._onreadystatechange();
		}
		this._httpReq.open("GET", aBoardURLSpec);
		this._httpReq.send(null);
		this._checkiing = true;
	},

	abort: function(){
		this._checkiing = false;
		if(this._httpReq && this._httpReq.readyState!=0){
			this._httpReq.abort();
			this._httpReq = null;
		}
	},

	_onreadystatechange: function(){
		switch(this._httpReq.readyState){
			case 4:
				break;
			default:
				return;
		}

		var responseText = this._httpReq.responseText;
		if(responseText.match(/Change your bookmark/m)){
			if(responseText.match(/<a href="([^"]+)">/m)){
				this.onChecked(true, RegExp.$1);
			}
		}else{
			this.onChecked(false, null);
		}
		this._checkiing = false;
		this._httpReq = null;
	},

	onChecked: function(aSuccess, aNewURL){}
}




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
		if(!BoardTree.tree.boxObject.beginUpdateBatch) return;

		var xpathResult = gBoard.itemsDoc.evaluate("descendant::boarditem[@read>0]",
					gBoard.itemsDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

		BoardTree.tree.boxObject.beginUpdateBatch();
		for (var i=0; i<xpathResult.snapshotLength; i++){
			var element = xpathResult.snapshotItem(i);
			var url = element.getAttribute("url");
			if(aURLs.indexOf(url) != -1){
				element.setAttribute("status", "0");
				element.setAttribute("unread", "0");
				element.setAttribute("read", "0");
			}
		}
		BoardTree.tree.boxObject.endUpdateBatch();
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