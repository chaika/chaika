Components.utils.import("resource://chaika-modules/ChaikaClipboard.js");


var gBbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
			.getService(Components.interfaces.nsIBbs2chService);

var gBbsmenuUpdater
var gTreeBbsMenu;
var gTreeBbsMenuView;
var gBbsMenuFile;
var gBbsMenuXMLFile;

function startup(){
	gBbsmenuUpdater = document.getElementById("bbsmenuUpdater");
	gTreeBbsMenu = document.getElementById("treeBbsMenu");
	gBbsMenuFile = gBbs2chService.getDataDir();
	gBbsMenuFile.appendRelativePath("bbsmenu.html");
	gBbsMenuXMLFile = gBbs2chService.getDataDir();
	gBbsMenuXMLFile.appendRelativePath("bbsmenu.xml");


	var btnHistory = document.getElementById("btnHistory");
	btnHistory.hidden = !gBbs2chService.pref.getBoolPref(
				"extensions.chaika.bbsmenu_historymenu_show");

    	// ツリーの偶数行に色をつける
	if(gBbs2chService.pref.getBoolPref("extensions.chaika.enable_tree_stripe2"))
		gTreeBbsMenu.setAttribute("stripe", "true");


	if(gBbsMenuXMLFile.exists()){
		initTreeBbsMenu();
	}else{	// bbsmenu.html が無いときは自動で取得
		bbsmenuUpdate();
	}
}

function shutdown(){
		// XXX TODO オートコンプリートテキストボックスにフォーカスがある状態で
		// XXX TODO 閉じるとメモリリークを起こすのでツリーにフォーカスを移す
	gTreeBbsMenu.focus();
	if(gTreeBbsMenuView) gTreeBbsMenuView.persistOpenedCategories();
	gTreeBbsMenu.view = null;
}


function initTreeBbsMenu(){
	if(!gBbsMenuXMLFile.exists()){
		createBbsmenuXML();
	}else if(gBbsMenuFile.exists() &&
					(gBbsMenuXMLFile.lastModifiedTime < gBbsMenuFile.lastModifiedTime)){
		createBbsmenuXML();
	}

	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
	var bbsMenuXMLURL = ioService.newFileURI(gBbsMenuXMLFile);
	var httpReq = new XMLHttpRequest();
	httpReq.open("GET", bbsMenuXMLURL.spec, false);
	httpReq.send(null);
	var bbsmenuDoc = httpReq.responseXML;
	delete httpReq;

		// 外部板
	var	outsidexmlFile = gBbs2chService.getDataDir();
	outsidexmlFile.appendRelativePath("outside.xml");
	if(!outsidexmlFile.exists()){
		var outsideContent = gBbs2chService.readLocalURI(
				"chrome://chaika/content/res/outside.xml");
		gBbs2chService.writeFile(outsidexmlFile.path, outsideContent, false);
	}
	var outsideXMLURL = ioService.newFileURI(outsidexmlFile);
	var httpReq = new XMLHttpRequest();
	httpReq.open("GET", outsideXMLURL.spec, false);
	httpReq.send(null);
	var outsideDoc = httpReq.responseXML
	delete httpReq;

	// outsideDoc.documentElement.appendChild(outsideDoc.createElement("separator"));

	gTreeBbsMenu.view = null;
	gTreeBbsMenuView = new b2rBbsmenuTreeView();
	gTreeBbsMenuView.init(outsideDoc, bbsmenuDoc);
	gTreeBbsMenu.view = gTreeBbsMenuView;
}


function createBbsmenuXML(){
		// bbsmenu.html を読み込んで、行を配列に格納
	var contentLines = gBbs2chService.readFile(gBbsMenuFile.path);
	contentLines = gBbs2chService.fromSJIS(contentLines);
		// 改行位置がおかしい部分の修正
	contentLines = contentLines.replace(/<\/B><BR><A HREF/igm, "</B><BR>\n<A HREF");
	contentLines = contentLines.split("\n");

	var categoryReg = /<BR><B>([^<]+)<\/B><BR>/i;
	var threadReg	= /^<A HREF=([^> ]+)>([^<]+)<\/A>/i;
	var threadReg2	= /^<A HREF=([^> ]+) TARGET=_blank>([^<]+)<\/A>/i;

	var currentCategory = null;
	var doc = new DOMParser().parseFromString("<bbsmenu/>", "text/xml");
	for(var i=0; i<contentLines.length; i++){
		var line = contentLines[i];
		if(categoryReg.test(line)){
			currentCategory = doc.createElement("category");
			currentCategory.setAttribute("title", RegExp.$1);
			doc.documentElement.appendChild(currentCategory);
		}else if((threadReg.test(line) || threadReg2.test(line)) && currentCategory){
			var board = doc.createElement("board");
			board.setAttribute("title", RegExp.$2);
			var url = RegExp.$1;
			url = url.replace(/"/g, "");
			board.setAttribute("url", url);
			try{
				board.setAttribute("type", gBbs2chService.getBoardType(url));
				currentCategory.appendChild(board);
			}catch(ex){
				dump(RegExp.$1 +"\n");
			}
		}
	}
	var xmlSource = new XMLSerializer().serializeToString(doc);
	xmlSource = gBbs2chService.toSJIS(xmlSource);
	xmlSource = xmlSource.replace(/></gm, ">\n<");
	xmlSource = xmlSource.replace(/<board/gm, "\t<board");
	xmlSource = '<?xml version="1.0" encoding="SHIFT_JIS"?>\n' + xmlSource;
	gBbs2chService.writeFile(gBbsMenuXMLFile.path, xmlSource, false);
}


/**
 * 履歴を読んで History メニューを更新する
 */
function updateHistoryMenu(){
	var popHistory = document.getElementById("popHistory");
	while(popHistory.hasChildNodes()){
		popHistory.removeChild(popHistory.firstChild);
	}

	var boardMax = gBbs2chService.pref.getIntPref("extensions.chaika.bbsmenu_historymenu_board_max");
	if(boardMax > 15) boardMax = 15;

	var sql = "SELECT url, title FROM history WHERE type=0 ORDER BY last_visited DESC LIMIT ?1";
	var statement = gBbs2chService.historyDB.createStatement(sql);
	statement.bindInt32Parameter(0, boardMax);

	gBbs2chService.historyDB.beginTransaction();
	try{
		while(statement.executeStep()){
			var url =  "bbs2ch:board:" + statement.getString(0);
			var title = statement.getString(1);
			var menuNode = document.createElement("menuitem");
			menuNode.setAttribute("label", title);
			menuNode.setAttribute("value", url);
			menuNode.setAttribute("tooltiptext", url);
			popHistory.appendChild(menuNode);
		}
		statement.reset();
	}finally{
		gBbs2chService.historyDB.commitTransaction();
	}

	if(popHistory.hasChildNodes()){
		popHistory.appendChild(document.createElement("menuseparator"));
	}

	var threadViewLimit = gBbs2chService.pref.getIntPref("extensions.chaika.board_thread_view_limit");
	var threadMax = gBbs2chService.pref.getIntPref("extensions.chaika.bbsmenu_historymenu_thread_max");
	if(threadMax > 15) threadMax = 15;
	sql = sql = "SELECT url, title FROM history WHERE type=1 ORDER BY last_visited DESC LIMIT ?1";
	statement = gBbs2chService.historyDB.createStatement(sql);
	statement.bindInt32Parameter(0, threadMax);

	gBbs2chService.historyDB.beginTransaction();
	try{
		while(statement.executeStep()){
			var url = statement.getString(0);
			var title = statement.getString(1);
			var type = gBbs2chService.getBoardType(url);
			var threadURL = gBbs2chService.serverURL.resolve("./thread/" + url);

			if(threadViewLimit > 0){
				if(type == gBbs2chService.BOARD_TYPE_MACHI){
					threadURL += "&LAST=" + threadViewLimit;
				}else{
					threadURL += "l" + threadViewLimit;
				}
			}

			var menuNode = document.createElement("menuitem");
			menuNode.setAttribute("label", title);
			menuNode.setAttribute("value", threadURL);
			menuNode.setAttribute("tooltiptext", threadURL);
			popHistory.appendChild(menuNode);
		}
		statement.reset();
	}finally{
		gBbs2chService.historyDB.commitTransaction();
	}

	if(popHistory.hasChildNodes()){
		popHistory.appendChild(document.createElement("menuseparator"));
		var menuNode = document.createElement("menuitem");
		menuNode.setAttribute("label", "Clear History");
		menuNode.setAttribute("oncommand", "clearHistory()");
		popHistory.appendChild(menuNode);
	}

}


/**
 * History メニューアイテムをクリックしたときの処理
 * @param aEvent event イベントオブジェクト
 */
function popHistoryClick(aEvent){
	var target = aEvent.originalTarget;
	if(target.localName != "menuitem" || !(target.value)) return;
	if(aEvent.button == 0){
		gBbs2chService.openURL(target.value, null, false);
	}else if(aEvent.button == 1){
		target.parentNode.hidePopup();
		gBbs2chService.openURL(target.value, null, true);
	}
}

function clearHistory(){
	gBbs2chService.clearHistory();
}

/**
 * bbsmenu.html をダウンロードして板一覧を更新する
 */
function bbsmenuUpdate(){
	gBbsmenuUpdater.collapsed = false;
	gBbsmenuUpdater.update();
}

function onBbsmenuUpdated(){
	gBbsmenuUpdater.collapsed = true;
	gBbsMenuFile.initWithFile(gBbsMenuFile);
	initTreeBbsMenu();
}


/**
 * ログフォルダを開く
 */
function openLogsDir(){
	var logDir = gBbs2chService.getDataDir();

	try{
		logDir.reveal();
	}catch(ex){
			// for Unix
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
	    var protocolService = Components.classes
	    		["@mozilla.org/uriloader/external-protocol-service;1"]
    				.getService(Components.interfaces.nsIExternalProtocolService);
		var logDirURI = ioService.newFileURI(logDir);
		protocolService.loadUrl(logDirURI);
	}
}


/**
 * 設定ダイアログを開く
 */
function openSettings(){
	var settingDialogURL = "chrome://chaika/content/settings/settings.xul";

	var features = "";
	try{
    	var instantApply = gBbs2chService.pref.getBoolPref("browser.preferences.instantApply");
		features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
	}catch(ex){
		features = "chrome,titlebar,toolbar,centerscreen,modal";
	}
	window.openDialog(settingDialogURL, "", features);
}


/**
 * エクステンションマネージャを使った About の表示
 */
function openAbout(){
	var ExtensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
								.getService(Components.interfaces.nsIExtensionManager);
	var emDS = ExtensionManager.datasource;
	var ExtensionID = "urn:mozilla:item:chaika@chaika.xrea.jp";
	window.openDialog("chrome://mozapps/content/extensions/about.xul", "",
				"chrome, modal", ExtensionID, emDS);
}
/**
 * About ダイアログがホームページを開く時に利用するメソッド
 */
function openURL(aURLSpec){
	gBbs2chService.openURL(aURLSpec, null, true);
}

/**
 * 選択中の板をブラウザで開く
 * @param {boolean} aAddTab true なら新しいタブで開く
 */
function openBoard(aAddTab){
	var boardURL = getSelectedBoardURL();
	if(boardURL){
		gBbs2chService.openURL(boardURL, null, aAddTab);
	}
}


function getSelectedBoardURL(){
	if(gTreeBbsMenu.currentIndex == -1) return null;
	var item = gTreeBbsMenuView.viewItems[gTreeBbsMenu.currentIndex];
	var boardURL = item.url;
	if(boardURL.indexOf("http://") != 0) return null;

	var boardType = item.type;
	switch(parseInt(boardType)){
		case gBbs2chService.BOARD_TYPE_2CH:
		case gBbs2chService.BOARD_TYPE_BE2CH:
		case gBbs2chService.BOARD_TYPE_JBBS:
		case gBbs2chService.BOARD_TYPE_MACHI:
			boardURL = "bbs2ch:board:" + boardURL;
			break;
	}
	return boardURL;
}

/**
 * ツリーをクリックしたときに呼ばれる
 * @param {event} aEvent
 */
function treeBbsMenuClick(aEvent){
	var row = {}
	var obj = {};
	gTreeBbsMenu.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
	if(row.value == -1) return;	// ツリーのアイテム以外をクリック

	var button = aEvent.button;
	var detail = aEvent.detail;
	var isSeparator = gTreeBbsMenu.view.isSeparator(row.value);
	var isContainer = gTreeBbsMenu.view.isContainer(row.value);

	if(isSeparator) return;

	if(button==0 && detail==1 && obj.value=="twisty"){
			// twisty ボタンを使ったコンテナのオープン
		closeAllOpendContainers(aEvent, row.value);
		return;
	}else if(detail==2 && obj.value!="twisty" && isContainer){
			// ダブルクリックによるコンテナのオープン
		closeAllOpendContainers(aEvent, row.value);
		return;
	}

	if(isContainer) return;
	if(gTreeBbsMenu._timer){
		clearTimeout(gTreeBbsMenu._timer);
	}
	gTreeBbsMenu._timer = setTimeout(treeBbsMenuClickDelay, 5, aEvent);
}

function treeBbsMenuClickDelay(aEvent){
	gTreeBbsMenu._timer = null;

	var button = aEvent.button;
	var detail = aEvent.detail;

	var openActionPref;
	if(button==0 && detail==1){
			// クリック
		openActionPref = "extensions.chaika.bbsmenu_click_action";
	}else if(button==0 && detail==2){
			// ダブルクリック
		openActionPref = "extensions.chaika.bbsmenu_double_click_action";
	}else if(button==1 && detail==1){
			// ミドルクリック
		openActionPref = "extensions.chaika.bbsmenu_middle_click_action";
	}else{
		return;
	}

	var openAction = gBbs2chService.pref.getIntPref(openActionPref);
	if(openAction==1){
		openBoard(false);
	}else if(openAction==2){
		openBoard(true);
	}
}


/**
 * ツリーでキーボードダウン
 * aEvent event キーボードダウン時のイベントオブジェクト
 */
function treeBbsMenuKeyDown(aEvent){
	if(gTreeBbsMenu.currentIndex == -1) return;

		// エンターキー以外なら終了
	if(!(aEvent.keyCode==aEvent.DOM_VK_ENTER || aEvent.keyCode==aEvent.DOM_VK_RETURN))
		return;

	if(aEvent.ctrlKey || aEvent.altKey){
		openBoard(true);
	}else{
		openBoard(false);
	}
}


/**
 * 開いているすべてのツリーコンテナを閉じる
 * @param aEvent event マウスイベント
 * @param aExceptIndex number 閉じないコンテナのインデックス
 */
function closeAllOpendContainers(aEvent, aExceptIndex){
	// XXX TODO b2rBbsmenuTreeView に移動させる
	if(!gTreeBbsMenu.view.isContainerOpen(aExceptIndex)) return;

	if(!gBbs2chService.pref.getBoolPref(
					"extensions.chaika.bbsmenu_toggle_open_container")) return;

	var exceptItemTitle = gTreeBbsMenuView.viewItems[aExceptIndex].title;
	var exceptItem;

	for(var i=0; i<gTreeBbsMenuView.items.length; i++){
		var item = gTreeBbsMenuView.items[i];
		if(!item.isContainer) continue;
		if(item.title == exceptItemTitle){
			item.isOpen = true;
			exceptItem = item;
		}else{
			item.isOpen = false;
		}
	}
	for(i=exceptItem.parent; i!=null; i=i.parent){
		i.isOpen = true;
	}
	gTreeBbsMenu.treeBoxObject.rowCountChanged(0, - gTreeBbsMenuView.rowCount);
	gTreeBbsMenuView._refreshItems();
	gTreeBbsMenu.treeBoxObject.rowCountChanged(0, gTreeBbsMenuView.rowCount);

		// 閉じないコンテナをクリックした位置までスクロール
	var mouseOverRowIndex = gTreeBbsMenu.boxObject.getRowAt(aEvent.clientX, aEvent.clientY);
	for(i=0; i<gTreeBbsMenuView.viewItems.length; i++){
		item = gTreeBbsMenuView.viewItems[i];
		if(item.title == exceptItemTitle){
			var difference = i - mouseOverRowIndex;
			if(difference > 0) gTreeBbsMenu.boxObject.scrollToRow(difference);
			return;
		}
	}
}


/**
 * ツリーのコンテキストメニューが表示されるときに呼ばれる
 * @param {event} aEvent
 */
function showBbsMenuContext(aEvent){
	var row = {}
	var obj = {};
	gTreeBbsMenu.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);

		// ツリーのアイテム以外をクリック
	if(row.value == -1) return false;
		// セパレータの場合はコンテキストメニューを出さない
	if(gTreeBbsMenu.view.isSeparator(row.value)) return false;
		// コンテナの場合はコンテキストメニューを出さない
	if(gTreeBbsMenu.view.isContainer(row.value)) return false;
	return true;
}


function searchTitle(aSearchString){
	if(aSearchString){
			// フォーム履歴に検索文字列を追加
		if(Components.interfaces.nsIFormHistory2){
				// フォーム履歴に検索文字列を追加
			var formHistory	= Components.classes["@mozilla.org/satchel/form-history;1"]
					.getService(Components.interfaces.nsIFormHistory2);
			formHistory.addEntry("bbs2ch-bbsmenu-history", aSearchString);
		}

		gTreeBbsMenuView.searchString = aSearchString;
	}else{
		gTreeBbsMenuView.searchString = "";
	}
}


/**
 * 選択中の板の URL をクリップボードにコピー
 * @param {boolean} aAddTitle 真ならタイトルもコピーする
 */
function copyURL(aAddTitle){
	if(gTreeBbsMenu.currentIndex == -1) return;
	var item = gTreeBbsMenuView.viewItems[gTreeBbsMenu.currentIndex];

	var boardURL = item.url;
	if(boardURL.indexOf("http://")!=0) return;
	var boardTitle = item.title;
	if(aAddTitle){
		ChaikaClipboard.setString(boardTitle +"\n"+ boardURL);
	}else{
		ChaikaClipboard.setString(boardURL);
	}
}
