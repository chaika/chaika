Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaClipboard.js");


var gBbsmenuUpdater
var gTreeBbsMenu;
var gTreeBbsMenuView;
var gBbsMenuFile;
var gBbsMenuXMLFile;

function startup(){
	gBbsmenuUpdater = document.getElementById("bbsmenuUpdater");
	gTreeBbsMenu = document.getElementById("treeBbsMenu");
	gBbsMenuFile = ChaikaCore.getDataDir();
	gBbsMenuFile.appendRelativePath("bbsmenu.html");
	gBbsMenuXMLFile = ChaikaCore.getDataDir();
	gBbsMenuXMLFile.appendRelativePath("bbsmenu.xml");


	var btnHistory = document.getElementById("btnHistory");
	btnHistory.hidden = !ChaikaCore.pref.getBool("bbsmenu_historymenu_show");

    	// ツリーの偶数行に色をつける
	if(ChaikaCore.pref.getBool("enable_tree_stripe2"))
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
	var	outsidexmlFile = ChaikaCore.getDataDir();
	outsidexmlFile.appendRelativePath("outside.xml");
	if(!outsidexmlFile.exists()){
		var defaultOutsideFile = ChaikaCore.getDefaultsDir();
		defaultOutsideFile.appendRelativePath("outside.xml");
		defaultOutsideFile.copyTo(outsidexmlFile.parent, null);

		outsidexmlFile = outsidexmlFile.clone().QueryInterface(Ci.nsILocalFile);
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
	var contentLines = ChaikaCore.io.readString(gBbsMenuFile, "Shift_JIS");
		// 改行位置がおかしい部分の修正
	contentLines = contentLines.replace(/<\/B><BR><A HREF/igm, "</B><BR>\n<A HREF");
	contentLines = contentLines.split("\n");

	var categoryReg = /<BR><B>([^<]+)<\/B><BR>/i;
	var threadReg	= /^<A HREF=([^> ]+)>([^<]+)<\/A>/i;
	var threadReg2	= /^<A HREF=([^> ]+) TARGET=_blank>([^<]+)<\/A>/i;

	var currentCategory = null;
	var doc = new DOMParser().parseFromString("<bbsmenu/>", "text/xml");

	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);

	for(var i=0; i<contentLines.length; i++){
		var line = contentLines[i];
		if(categoryReg.test(line)){
			currentCategory = doc.createElement("category");
			currentCategory.setAttribute("title", RegExp.$1);
			doc.documentElement.appendChild(currentCategory);
		}else if((threadReg.test(line) || threadReg2.test(line)) && currentCategory){
			var board = doc.createElement("board");
			board.setAttribute("title", RegExp.$2);
			var urlSpec = RegExp.$1;
			urlSpec = urlSpec.replace(/"/g, "");
			board.setAttribute("url", urlSpec);
			try{
				var url = ioService.newURI(urlSpec, null, null);
				board.setAttribute("type", ChaikaBoard.getBoardType(url));
				currentCategory.appendChild(board);
			}catch(ex){
				ChaikaCore.logger.error(RegExp.$1);
			}
		}
	}
	var xmlSource = new XMLSerializer().serializeToString(doc);
	xmlSource = xmlSource.replace(/></gm, ">\n<");
	xmlSource = xmlSource.replace(/<board/gm, "\t<board");
	xmlSource = '<?xml version="1.0" encoding="Shift_JIS"?>\n' + xmlSource;

	var output = ChaikaCore.io.writeString(gBbsMenuXMLFile, "Shift_JIS", false, xmlSource);
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
	var logDir = ChaikaCore.getDataDir();

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
		var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
    	var instantApply = pref.getBoolPref("browser.preferences.instantApply");
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
	var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	ChaikaCore.browser.openURL(ioService.newURI(aURLSpec, null, null), true);
}

/**
 * 選択中の板をブラウザで開く
 * @param {boolean} aAddTab true なら新しいタブで開く
 */
function openBoard(aAddTab){
	if(gTreeBbsMenu.currentIndex == -1) return;

	var item = gTreeBbsMenuView.viewItems[gTreeBbsMenu.currentIndex];
	if(item.url.indexOf("http://") != 0) return;

	var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	var boardURL = ioService.newURI(item.url, null, null);

	var boardType = item.type;
	switch(parseInt(boardType)){
		case ChaikaBoard.BOARD_TYPE_2CH:
		case ChaikaBoard.BOARD_TYPE_BE2CH:
		case ChaikaBoard.BOARD_TYPE_JBBS:
		case ChaikaBoard.BOARD_TYPE_MACHI:
			ChaikaCore.browser.openBoard(boardURL, aAddTab);
			break;
		default:
			ChaikaCore.browser.openURL(boardURL, aAddTab);
			break;
	}
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
		openActionPref = "bbsmenu_click_action";
	}else if(button==0 && detail==2){
			// ダブルクリック
		openActionPref = "bbsmenu_double_click_action";
	}else if(button==1 && detail==1){
			// ミドルクリック
		openActionPref = "bbsmenu_middle_click_action";
	}else{
		return;
	}

	var openAction = ChaikaCore.pref.getInt(openActionPref);
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

	if(!ChaikaCore.pref.getBool("bbsmenu_toggle_open_container")) return;

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
 * @param {Event} aEvent
 */
function showBoardItemBbsMenuContext(aEvent){
	var row = {}
	var obj = {};
	gTreeBbsMenu.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);

		// ツリーのアイテム以外をクリック
	if(row.value == -1) return false;
		// セパレータの場合はコンテキストメニューを出さない
	if(gTreeBbsMenu.view.isSeparator(row.value)) return false;
		// コンテナの場合はコンテキストメニューを出さない
	if(gTreeBbsMenu.view.isContainer(row.value)) return false;


	var item = gTreeBbsMenuView.viewItems[gTreeBbsMenu.currentIndex];
	var boardItemBbsMenuContext = document.getElementById("boardItemBbsMenuContext");
	boardItemBbsMenuContext.itemTitle = item.title;
	boardItemBbsMenuContext.itemURL = item.url;

	switch(parseInt(item.type)){
		case ChaikaBoard.BOARD_TYPE_2CH:
		case ChaikaBoard.BOARD_TYPE_BE2CH:
		case ChaikaBoard.BOARD_TYPE_JBBS:
		case ChaikaBoard.BOARD_TYPE_MACHI:
			boardItemBbsMenuContext.itemType = "board";
			break;
		default:
			boardItemBbsMenuContext.itemType = "page";
			break;
	}

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
