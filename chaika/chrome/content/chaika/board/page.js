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

Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaClipboard.js");


var gBbs2chService = Cc["@mozilla.org/bbs2ch-service;1"].getService(Ci.nsIBbs2chService);
var gBoardTree;
var gBoard;
var gSubjectDownloader;
var gSettingDownloader;
var gBoardMoveChecker;
var gNewURL;
var gFirstInitBoardTree = true;


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
	var boardURLSpec = location.href.replace(/^bbs2ch:board:/, "");

	try{
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var boardURL = ioService.newURI(boardURLSpec, null, null);
		gBoard = new ChaikaBoard(boardURL);
	}catch(ex){
		// 認識できない URL
		alert("BAD URL");
		return;
	}


	gBoardTree = document.getElementById("boardTree");
	loadPersist();

	var mlstFilterLimit = document.getElementById("mlstFilterLimit");
	var menuItems = mlstFilterLimit.menupopup.getElementsByTagName("menuitem");
	for(var i=0; menuItems.length; i++){
		if(mlstFilterLimit.value == menuItems[i].value){
			mlstFilterLimit.selectedIndex = i;
			break;
		}
	}

	var subjectFile = gBoard.subjectFile.clone();
	var settingFile = gBoard.settingFile.clone();
	if(gBbs2chService.pref.getBoolPref("extensions.chaika.board_auto_update")){
		subjectUpdate();
	}else if(!subjectFile.exists() || subjectFile.fileSize==0){
		subjectUpdate();
	}else if(!settingFile.exists() || settingFile.fileSize==0){
		settingUpdate();
	}else{
		initBoardTree();
	}
}


/**
 * 終了時の処理
 */
function shutdown(){

	savePersist();

		// ダウンロードのキャンセル
	if(gSubjectDownloader && gSubjectDownloader.loading)
		gSubjectDownloader.abort(true);
	if(gSettingDownloader && gSettingDownloader.loading)
		gSettingDownloader.abort(true);
	if(gBoardMoveChecker && gBoardMoveChecker.checking)
		gBoardMoveChecker.abort();

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
	var persistPref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
			.getBranch("extensions.chaika.board_persist.");
	var prefList = persistPref.getChildList("", {});
	for(var i=0; i<prefList.length; i++){
		var prefName = prefList[i];
		var prefValue = persistPref.getCharPref(prefName);
		var elementId = prefName.split(".")[0];
		var attrName = prefName.split(".")[1];
		var element = document.getElementById(elementId);
		if(element){
			element.setAttribute(attrName, prefValue);
			if(attrName == "value") element.value = prefValue;
		}
	}
}


function savePersist(){
	var persistPref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
			.getBranch("extensions.chaika.board_persist.");

	var xpathResult = document.evaluate("descendant::*[@id][@persist2]", document, null,
						XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

	for (var i = 0; i < xpathResult.snapshotLength; i++){
		var node = xpathResult.snapshotItem(i);
		var persists = node.getAttribute("persist2").split(/\s/);

		for(var j=0; j<persists.length; j++){
			var attrName = persists[j];
			var attrValue = node.getAttribute(attrName);
			var prefName = node.id +"."+ attrName;
			if(attrValue != ""){
				persistPref.setCharPref(prefName, attrValue);
			}else if(persistPref.prefHasUserValue(prefName)){
				persistPref.clearUserPref(prefName);
			}
		}
	}

}


/**
 * boardTree の初期化
 */
function initBoardTree(){
	var boardTitle = gBoard.getTitle();
	document.title = boardTitle + " [chaika]";
	document.getElementById("lblTitle").setAttribute("value", boardTitle);

	if(gFirstInitBoardTree){
		ChaikaCore.history.visitPage(gBoard.url,
				ChaikaBoard.getBoardID(gBoard.url), boardTitle, 0);
		gFirstInitBoardTree = false;
	}

	var aFilterLimit = Number(document.getElementById("mlstFilterLimit").getAttribute("value"));

	gBoard.refresh(aFilterLimit);
	gBoardTree.builder.datasource = gBoard.itemsDoc.documentElement;
	gBoardTree.builder.rebuild();

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
			gBoardTree.builderView.sort(colNodes[i]);
		}
	}


		// フォーカス
	if(gBoardTree.treeBoxObject.view.selection){
		gBoardTree.focus();
		gBoardTree.treeBoxObject.view.selection.select(0);
	}
}


/**
 * ツリーをクリックした時に呼ばれる
 * aEvent event クリック時のイベントオブジェクト
 */
function boardTreeClick(aEvent){
		// ツリーのアイテム以外をクリック
	if(getClickItemIndex(aEvent) == -1) return;

	if(gBoardTree._timer){
		clearTimeout(gBoardTree._timer);
	}
	gBoardTree._timer = setTimeout(boardTreeClickDelay, 5, aEvent);
}


function boardTreeClickDelay(aEvent){
	gBoardTree._timer = null;

	var button = aEvent.button;
	var detail = aEvent.detail;

	var openActionPref;
	if(button==0 && detail==1){
			// クリック
		openActionPref = "extensions.chaika.board_click_action";
	}else if(button==0 && detail==2){
			// ダブルクリック
		openActionPref = "extensions.chaika.board_double_click_action";
	}else if(button==1 && detail==1){
			// ミドルクリック
		openActionPref = "extensions.chaika.board_middle_click_action";
	}else{
		return;
	}

	var openAction = gBbs2chService.pref.getIntPref(openActionPref);
	if(openAction==1){
		openThread(false);
	}else if(openAction==2){
		openThread(true);
	}
}


/**
 * ツリーでキーボードダウン
 * aEvent event キーボードダウン時のイベントオブジェクト
 */
function boardTreeKeyDown(aEvent){
	if(gBoardTree.currentIndex == -1) return;

		// エンターキー以外なら終了
	if(!(aEvent.keyCode==aEvent.DOM_VK_ENTER || aEvent.keyCode==aEvent.DOM_VK_RETURN))
		return;

	if(aEvent.ctrlKey || aEvent.altKey){
		openThread(true);
	}else{
		openThread(false);
	}
}


/**
 * 選択中のスレッドをブラウザで開く
 * @param aAddTab boolean true なら新しいタブで開く
 */
function openThread(aAddTab){
	var threadURL = getSelectedThreadURL();
	if(threadURL){
		gBbs2chService.openURL(threadURL, null, aAddTab);
	}
}


function getSelectedThreadURL(){
	var index = gBoardTree.currentIndex;
	if(index == -1) return null;

	var itemID = gBoardTree.builderView.getResourceAtIndex(index).Value;
	var result = gBoardTree.builder.getResultForId(itemID);

		// スレッド表示数の制限
	var threadViewLimit = Number(gBbs2chService.pref.getIntPref(
									"extensions.chaika.board_thread_view_limit"));
	if(isNaN(threadViewLimit) || threadViewLimit == 0){
		threadViewLimit = "";
	}else{
			threadViewLimit = "l" + threadViewLimit;
	}

	var atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
	var url = result.getBindingFor(atomService.getAtom("?url"));
	url = "/thread/" + url + threadViewLimit;
	return gBbs2chService.serverURL.resolve(url);
}


/**
 * ツリーのコンテキストメニューが表示されるときに呼ばれる
 */
function showBoardTreeContextMenu(aEvent){
		// ツリーのアイテム以外をクリック
	if(getClickItemIndex(aEvent) == -1) return false;

	return true;
}


/**
 * 選択スレッドの URL をクリップボードにコピー
 */
function copyURL(){
	var index = gBoardTree.currentIndex;
	if(index == -1) return;

	var itemID = gBoardTree.builderView.getResourceAtIndex(index).Value;
	var result = gBoardTree.builder.getResultForId(itemID);

	var atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
	var url = result.getBindingFor(atomService.getAtom("?url"));

	ChaikaClipboard.setString(url);
}


/**
 * 選択スレッドのタイトルと URL をクリップボードにコピー
 */
function copyTitleAndURL(){
	var index = gBoardTree.currentIndex;
	if(index == -1) return;

	var itemID = gBoardTree.builderView.getResourceAtIndex(index).Value;
	var result = gBoardTree.builder.getResultForId(itemID);

	var atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
	var title = result.getBindingFor(atomService.getAtom("?title"));
	var url = result.getBindingFor(atomService.getAtom("?url"));

	ChaikaClipboard.setString(title +"\n"+ url);
}


/**
 * 選択スレッドのログを削除する (複数選択可)
 */
function deleteLog(){

}




/**
 * 選択中のスレッドのインデックスを配列として返す
 * @return array
 */
function getSelectionIndices(){
	var resultArray = new Array();

	var rangeCount = gBoardTree.treeBoxObject.view.selection.getRangeCount();
	for(var i=0; i<rangeCount; i++){
		var rangeMin = {};
		var rangeMax = {};

		gBoardTree.treeBoxObject.view.selection.getRangeAt(i, rangeMin, rangeMax);
		for (var j=rangeMin.value; j<=rangeMax.value; j++){
			resultArray.push(j);
		}
	}
	return resultArray;
}


/**
 * gBoardTree のクリックされたアイテムのインデックスを返す
 * アイテム以外をクリックしたときは、-1 を返す
 * @param aEvent event onClick のイベント
 * @return number アイテムのインデックス
 */
function getClickItemIndex(aEvent){
	var row = {}
	var obj = {}
	gBoardTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
	if(!obj.value) return -1;
	return row.value;
}


/**
 * スレッドタイトルを検索して、結果をツリーに表示
 * aSearchString が空ならツリーを元に戻す
 * @param aEvent event イベントオブジェクト
 * @param aSearchString string 検索文字列
 */
function searchTitle(aEvent, aSearchString){
		// keypress イベント時にエンター以外が押された
	if((aEvent.type == "keypress") &&
		((aEvent.keyCode != KeyEvent.DOM_VK_ENTER) &&
			(aEvent.keyCode != KeyEvent.DOM_VK_RETURN)))
				return;


}


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
		var updateIntervalLimit =  gBbs2chService.pref.getIntPref(
					"extensions.chaika.board_update_interval_limit");
			// 不正な値や、15 秒以下なら 15 秒にする
		if(isNaN(parseInt(updateIntervalLimit)) || updateIntervalLimit < 15)
			updateIntervalLimit = 15;

		if(interval < updateIntervalLimit * 1000){
			if(!settingFile.exists() || settingFile.fileSize==0){
				settingUpdate();
			}else{
				initBoardTree();
			}
			return;
		}
	}

	gSubjectDownloader = new b2rDownloader(gBoard.subjectURL.spec,
									gBoard.subjectFile.path);

	gSubjectDownloader.onStart = function(aDownloader){
		setStatus("start: " + this.urlSpec);
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
			initBoardTree();
		}
	};
	gSubjectDownloader.onProgressChange = function(aDownloader, aPercentage){
		setStatus("downloading: " + aPercentage + "%");
	};
	gSubjectDownloader.onError = function(aDownloader, aErrorCode){
		var errorText = "";
		switch(aErrorCode){
			case this.ERROR_BAD_URL:
				errorText = "BAD URL";
				break;
			case this.ERROR_NOT_AVAILABLE:
				errorText = "NOT AVAILABLE";
				break;
			case this.ERROR_FAILURE:
				errorText = "ERROR FAILURE";
				break;
		}
		setStatus("ネットワークの問題により、スレッド一覧を取得できませんでした。");
	};


	gSubjectDownloader.download();
	setStatus("request: " + gSubjectDownloader.urlSpec);
}


/**
 * SETTING.TXT をダウンロードする
 */
function settingUpdate(){
	gSettingDownloader = new b2rDownloader(gBoard.settingURL.spec,
									gBoard.settingFile.path);

	gSettingDownloader.onStart = function(aDownloader){
		setStatus("start: " + this.urlSpec);
	};
	gSettingDownloader.onStop = function(aDownloader, aStatus){
		setStatus("");
		initBoardTree();
	};
	gSettingDownloader.onProgressChange = function(aDownloader, aPercentage){
		setStatus("downloading: " + aPercentage + "%");
	};
	gSettingDownloader.onError = function(aDownloader, aErrorCode){
		if(aErrorCode == this.ERROR_NOT_AVAILABLE){
			setStatus("Download Error: NOT AVAILABLE: " + this.urlSpec);
		}else{
			createSettingFile();
			initBoardTree();
		}
	};


	gSettingDownloader.download();
	setStatus("request: " + gSettingDownloader.urlSpec);
}



function createSettingFile(){
		// 板名記入ダイアログ表示
	var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Ci.nsIPromptService);
	var promptTitle = gBoard.url.spec + " [chaika]";
	var promptMsg = "Entry This Board Title";
	var promptValue = { value: "" };
	promptService.prompt(window, promptTitle, promptMsg, promptValue, null, {});

	var settingContent = "";
	if(promptValue.value){
		settingContent = "BBS_TITLE=" + promptValue.value + "\n";
		settingContent = gBbs2chService.toType(settingContent, gBoard.type);
	}

	gBbs2chService.writeFile(gBoard.settingFile.path, settingContent, false);
}

function showBrowser(aTab){
	if(aTab){
		document.getElementById("popTools").hidePopup();
	}
	gBbs2chService.openURL(gBoard.url.spec, null, aTab);
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
    	var instantApply = gBbs2chService.pref.getBoolPref("browser.preferences.instantApply");
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
		var oldLogDir = gBbs2chService.getLogFileAtURL(gBoard.url.spec);
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
/*
		if(oldLogDir.exists() && window.confirm("ログファイルも移動しますか?")) {
			var logMoveDialogURL = "chrome://chaika/content/board/logMove.xul";
			window.openDialog(logMoveDialogURL, "", "modal,chrome,centerscreen",
						gBoard.getTitle(), gBoard.url.spec, gNewURL);
		}
*/
		setTimeout(function(){
			window.location.href = "bbs2ch:board:" + gNewURL;
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

