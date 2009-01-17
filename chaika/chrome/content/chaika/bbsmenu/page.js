Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaClipboard.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


var gBbsmenuUpdater

var gBbsMenuFile;
var gBbsMenuXMLFile;

function startup(){
	gBbsmenuUpdater = document.getElementById("bbsmenuUpdater");

	gBbsMenuFile = ChaikaCore.getDataDir();
	gBbsMenuFile.appendRelativePath("bbsmenu.html");
	gBbsMenuXMLFile = ChaikaCore.getDataDir();
	gBbsMenuXMLFile.appendRelativePath("bbsmenu.xml");


	var historyMenu = document.getElementById("historyMenu");
	historyMenu.hidden = !ChaikaCore.pref.getBool("bbsmenu_historymenu_show");


	if(gBbsMenuXMLFile.exists()){
		if(!gBbsMenuXMLFile.exists()){
			createBbsmenuXML();
		}else if(gBbsMenuFile.exists() &&
						(gBbsMenuXMLFile.lastModifiedTime < gBbsMenuFile.lastModifiedTime)){
			createBbsmenuXML();
		}
		var	outsidexmlFile = ChaikaCore.getDataDir();
		outsidexmlFile.appendRelativePath("outside.xml");
		if(!outsidexmlFile.exists()){
			var defaultOutsideFile = ChaikaCore.getDefaultsDir();
			defaultOutsideFile.appendRelativePath("outside.xml");
			defaultOutsideFile.copyTo(outsidexmlFile.parent, null);

			outsidexmlFile = outsidexmlFile.clone().QueryInterface(Ci.nsILocalFile);
		}
		document.getElementById("bbsmenuTree").initTree(gBbsMenuXMLFile, outsidexmlFile);
	}else{	// bbsmenu.html が無いときは自動で取得
		bbsmenuUpdate();
	}
}


function shutdown(){

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

	if(!gBbsMenuXMLFile.exists()){
		createBbsmenuXML();
	}else if(gBbsMenuFile.exists() &&
					(gBbsMenuXMLFile.lastModifiedTime < gBbsMenuFile.lastModifiedTime)){
		createBbsmenuXML();
	}
	var	outsidexmlFile = ChaikaCore.getDataDir();
	outsidexmlFile.appendRelativePath("outside.xml");
	if(!outsidexmlFile.exists()){
		var defaultOutsideFile = ChaikaCore.getDefaultsDir();
		defaultOutsideFile.appendRelativePath("outside.xml");
		defaultOutsideFile.copyTo(outsidexmlFile.parent, null);

		outsidexmlFile = outsidexmlFile.clone().QueryInterface(Ci.nsILocalFile);
	}
	document.getElementById("bbsmenuTree").initTree(gBbsMenuXMLFile, outsidexmlFile);
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


var find2ch = {

	search: function find2ch_search(aSearchString){
		if(aSearchString){
				// フォーム履歴に検索文字列を追加
			if(Components.interfaces.nsIFormHistory2){
					// フォーム履歴に検索文字列を追加
				var formHistory	= Cc["@mozilla.org/satchel/form-history;1"]
						.getService(Ci.nsIFormHistory2);
				formHistory.addEntry("chaika-find2ch-history", aSearchString);
			}

			document.getElementById("deck").selectedIndex = 1;
			document.getElementById("find2ch").search(aSearchString);
		}else{
			document.getElementById("deck").selectedIndex = 0;
			document.getElementById("find2ch").cancel();
		}
	},


	openThread: function find2ch_openThread(aAddTab){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var selectedItem = document.getElementById("find2ch").list.getSelectedItem(0);
		if(selectedItem){
			var threadURL = ioService.newURI(selectedItem.value, null, null);
			ChaikaCore.browser.openThread(threadURL, aAddTab, true, false);
		}
	},


	click: function find2ch_search(aEvent){
		if(aEvent.button >= 2){
			return;
		}

		if(this._clickTimer){
			clearTimeout(this._clickTimer);
		}
		this._clickTimer = setTimeout(find2ch._clickDelay, 5, aEvent);
	},
	_clickDelay: function find2ch__clickDelay(aEvent){
		this._clickTimer = null;

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
			find2ch.openThread(false);
		}else if(openAction==2){
			find2ch.openThread(true);
		}

	},


	keyDown: function find2ch_keyDown(aEvent){
			// エンターキー以外なら終了
		if(!(aEvent.keyCode==aEvent.DOM_VK_ENTER || aEvent.keyCode==aEvent.DOM_VK_RETURN)){
			return;
		}

		if(aEvent.ctrlKey || aEvent.altKey){
			find2ch.openThread(true);
		}else{
			find2ch.openThread(false);
		}
	}
};