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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaThread.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");
Components.utils.import("resource://chaika-modules/Chaika2chViewer.js");
Components.utils.import("resource://chaika-modules/ChaikaLogin.js");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const WIZ_TYPE_RES = 0;
const WIZ_TYPE_NEW_THREAD = 1;

var gWizard = null;
var gThread = null;
var gBoard  = null;
var gPost   = null;
var gWizType = WIZ_TYPE_RES;


function startup(){

	gWizard = document.documentElement;
	gWizard.canRewind = false;
	gWizard.canAdvance = false;

	if(!("arguments" in window)){
		Notification.critical("認識できない URL です");
		return;
	}

	if(window.arguments[1]){
		gWizType = WIZ_TYPE_NEW_THREAD;
	}

	var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

	if(gWizType == WIZ_TYPE_RES){
		var threadURL;
		try{
			threadURL = ioService.newURI(window.arguments[0], null, null)
								.QueryInterface(Components.interfaces.nsIURL);
		}catch(ex){
				// 認識できない URL
			Notification.critical("認識できない URL です");
			return;
		}

		gThread = new ChaikaThread(threadURL);
		gBoard = new ChaikaBoard(gThread.boardURL);

		if(gThread.lineCount == 0){
			Notification.critical("一度も読んでいないスレッドには書き込みできません");
			return;
		}

		switch(gBoard.type){
			case ChaikaBoard.BOARD_TYPE_2CH:
			case ChaikaBoard.BOARD_TYPE_JBBS:
			case ChaikaBoard.BOARD_TYPE_MACHI:
				break;
			default:
				Notification.critical("chaika での書き込みに対応していない掲示板です");
				return;
				break;
		}

	}else if(gWizType == WIZ_TYPE_NEW_THREAD){
		gThread = null;

		var boardURL;
		try{
			boardURL = ioService.newURI(window.arguments[0], null, null)
								.QueryInterface(Components.interfaces.nsIURL);
		}catch(ex){
				// 認識できない URL
			Notification.critical("認識できない URL です");
			return;
		}
		gBoard = new ChaikaBoard(boardURL);

		switch(gBoard.type){
			case ChaikaBoard.BOARD_TYPE_2CH:
				break;
			default:
				Notification.critical("chaika での新規スレッド作成に対応していない掲示板です");
				return;
				break;
		}

	}else{
		ChaikaCore.logger.warning("UNKNOWN WIZ TYPE: " + window.arguments[0]);
		return;
	}




	var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	os.addObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Login", false);
	os.addObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Logout", false);

	if(gBoard.type == ChaikaBoard.BOARD_TYPE_2CH && !gBoard.settingFile.exists()){
		gWizard.goTo("boardSettingPage");
	}else{
		gWizard.goTo("formPage");
	}

}


function shutdown(){
		// checked の値を完全に覚えさせる
	var sageCheck = document.getElementById("sageCheck");
	if(!sageCheck.checked) sageCheck.setAttribute("checked", "false");
	var useAAFontCheck = document.getElementById("useAAFontCheck");
	if(!useAAFontCheck.hasAttribute("checked")){
		useAAFontCheck.setAttribute("checked", "false");
	}
	var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	try{
		os.removeObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Login");
		os.removeObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Logout");
	}catch(ex){
	}
	FormPage.addFormHistory();
}


function finish(){
	if(gWizType == WIZ_TYPE_RES && ChaikaCore.pref.getBool("post.thread_reload")){
		SubmitPage.reloadThreadPage();
	}

	return true;
}


function cancelCheck(aEvent){
	if(FormPage._messeageForm && FormPage._messeageForm.value){
		var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Ci.nsIPromptService);
		var comformMsg = "書きかけのメッセージがありますがそのまま閉じますか?";
		var result = promptService.confirm(window, "chaika", comformMsg);

		return result;
	}

	return true;
}


function setTitle(){
	if(gWizType == WIZ_TYPE_RES){
		gWizard.title = "書き込み: " + gThread.title + " [chaika]";
		document.getElementById("titleHeader").value = gThread.title;
	}else if(gWizType == WIZ_TYPE_NEW_THREAD){
		gWizard.title = gBoard.getTitle() + " への新規スレッド作成"  + " [chaika]";
		document.getElementById("titleHeader").value = gBoard.getTitle() + " への新規スレッド作成";
	}
}




var Notification = {

	info: function Notification_info(aLabel){
		var notification = document.getElementById("notification");
		notification.appendNotification(aLabel, null, null,
				notification.PRIORITY_INFO_MEDIUM, null);
	},


	warning: function Notification_warning(aLabel){
		var notification = document.getElementById("notification");
		notification.appendNotification(aLabel, null, null,
				notification.PRIORITY_WARNING_MEDIUM, null);
	},


	critical: function Notification_critical(aLabel){
		var notification = document.getElementById("notification");
		notification.appendNotification(aLabel, null, null,
				notification.PRIORITY_CRITICAL_MEDIUM, null);
	},


	removeAll: function Notification_removeAll(){
		var notification = document.getElementById("notification");
		notification.removeAllNotifications(false);
	}

};




var BoardSettingPage = {

	pageShow: function BoardSettingPage_pageShow(aEvent){
		gWizard.canRewind = false;
		gWizard.canAdvance = false;

		this._progress = document.getElementById("settingDownloaderProgress");

		this._downloader = new ChaikaDownloader(gBoard.settingURL, gBoard.settingFile);
		this._downloader.onStart = function(aDownloader){};
		this._downloader.onStop = function(aDownloader, aStatus){
			ChaikaCore.logger.debug([aDownloader.url.spec, aStatus]);
			BoardSettingPage._downloaded();
		};
		this._downloader.onProgressChange = function(aDownloader, aPercentage){
			if(aPercentage != -1){
				BoardSettingPage._progress.mode = "determined";
				BoardSettingPage._progress.value = aPercentage;
			}
		};
		this._downloader.onError = function(aDownloader, aErrorCode){
			ChaikaCore.logger.error([aDownloader.url.spec, aErrorCode]);
		};
		this._downloader.download();

	},

	_downloaded: function BoardSettingPage__downloaded(){
		BoardSettingPage._progress.mode = "determined";
		gBoard = new ChaikaBoard(gBoard.url); // gBoard の再初期化
		setTimeout("gWizard.goTo('formPage')", 500);
	}

};




var FormPage = {

	_firstShow: true,

	pageShow: function FormPage_pageShow(aEvent){
		gWizard.canRewind = false;
		gWizard.canAdvance = true;

		document.getElementById("messeageForm").focus();
		if(!this._firstShow) return;

		this._titleForm = document.getElementById("titleForm");
		this._nameForm = document.getElementById("nameForm");
		this._mailForm = document.getElementById("mailForm");
		this._sageCheck = document.getElementById("sageCheck");
		this._messeageForm = document.getElementById("messeageForm");
		this._beCheck = document.getElementById("beCheck");

		this.setUseAAFont();
		this._setDefaultMailName();
		setTitle();

		var noName = gBoard.getSetting("BBS_NONAME_NAME");
		if(noName){
			this._nameForm.emptyText = noName;
		}
		this.sageCheck();
		this._beCheck.checked = ChaikaBeLogin.isLoggdIn();

		document.getElementById("insertAAMenu").disabled = !AAPanel.aaDirExists();


		if(gWizType == WIZ_TYPE_RES){
			switch(gBoard.type){
				case ChaikaBoard.BOARD_TYPE_2CH:
					gPost = new Post(gThread, gBoard);
					break;
				case ChaikaBoard.BOARD_TYPE_JBBS:
					gPost = new PostJBBS(gThread, gBoard);
					break;
				case ChaikaBoard.BOARD_TYPE_MACHI:
					gPost = new PostMachi(gThread, gBoard);
					break;
				default:
					gPost = null;
			}

				// このレスにレス
			if(gThread.url.fileName){
				var res = ">>" + gThread.url.fileName.replace(",", "\n>>", "g") +"\n";
				this._messeageForm.value = res ;
			}

		}else if(gWizType == WIZ_TYPE_NEW_THREAD){
			gPost = new Post2chNewThread(gBoard);

				// タイトルフォームの表示
			document.getElementById("titleFormContainer").hidden = false;
		}


		if(gBoard.url.host.indexOf(".2ch.net")!=-1  && !this._cookieEnabled()){
			Notification.warning(gBoard.url.host +" への Cookie アクセスを許可してください");
		}

		this._firstShow = false;
	},


	pageAdvanced: function FormPage_pageAdvanced(aEvent){
		var title   = this._titleForm.value;
		var name    = this._nameForm.value;
		var mail    = this._mailForm.value;
		var message = this._messeageForm.value;

		if(FormPage._sageCheck.checked){
			if(mail == ""){
				mail = "sage";
			}else if(mail.toLowerCase().indexOf("sage") == -1){
				mail += " sage";
			}
		}

		gPost.setPostData(title, name, mail, message);

		var errorMessages = gPost.getErrorMessages();
		if(errorMessages.length > 0){
			gWizard.canAdvance = false;
			Notification.removeAll(true);
			Notification.warning(errorMessages[0]);
			setTimeout("gWizard.canAdvance = true;", 750);
		}else{
			Notification.removeAll(false);
			return true;
		}
		return false;
	},


	addFormHistory: function FormPage_addFormHistory(){
		var formHistory	= Cc["@mozilla.org/satchel/form-history;1"]
				.getService(Ci.nsIFormHistory2);
		if(this._nameForm && this._nameForm.value){
			formHistory.addEntry("chaika-post-name-history", this._nameForm.value);
		}
		if(this._nameForm && this._mailForm.value){
			formHistory.addEntry("chaika-post-mail-history", this._mailForm.value);
		}
	},


	_cookieEnabled: function FormPage__cookieEnabled(){
		var permManager = Cc["@mozilla.org/permissionmanager;1"]
				.getService(Ci.nsIPermissionManager);
		var cookiePermission = permManager.testPermission (gBoard.url , "cookie");

		if(cookiePermission == Ci.nsIPermissionManager.DENY_ACTION){
			return false;
		}else if(cookiePermission == Ci.nsIPermissionManager.ALLOW_ACTION){
			return true;
		}else if(cookiePermission == Ci.nsICookiePermission.ACCESS_SESSION){
			return true;
		}

		var pref = Cc["@mozilla.org/preferences-service;1"]
						.getService(Ci.nsIPrefBranch);
		const COOKIE_BEHAVIOR_REJECT = 2;
		return pref.getIntPref("network.cookie.cookieBehavior") != COOKIE_BEHAVIOR_REJECT;
	},

	toggleBeLogin: function FormPage_toggleBeLogin(){
		var beChecked = FormPage._beCheck.checked;
		if(beChecked){
			FormPage._beCheck.checked = false;
			openDialog("chrome://chaika/content/post/belogin.xul", "", "chrome, modal,centerscreen");
		}else{
			ChaikaBeLogin.logout();
		}
	}, 

	beLoginObserver: {
		observe: function(aSubject, aTopic, aData){
			if(aTopic == "ChaikaBeLogin:Login" && aData == "OK"){
				FormPage._beCheck.checked = true;
			}
			if(aTopic == "ChaikaBeLogin:Logout" && aData == "OK"){
				FormPage._beCheck.checked = false;
			}
		}
	},
	
	sageCheck: function FormPage_sageCheck(){
		var sageChecked = FormPage._sageCheck.checked;
		this._mailForm.emptyText = sageChecked ? "sage" : " ";

		return sageChecked;
	},

	setUseAAFont: function FormPage_setUseAAFont(){
		var useAAFontCheck = document.getElementById("useAAFontCheck");
		var useAAFont = (useAAFontCheck.getAttribute("checked") == "true");

		var fontStyle = "";
		if(useAAFont){
			var fontFamily = ChaikaCore.pref.getUniChar("thread_aa_font_name");
			var fontSize = ChaikaCore.pref.getInt("thread_aa_font_size");
			var lineHeight = ChaikaCore.pref.getInt("thread_aa_line_space") + fontSize;
			fontStyle = [fontSize, "px/", lineHeight, "px '", fontFamily, "'"].join("");
		}
		this._messeageForm.style.font = fontStyle;
	},


	_setDefaultMailName: function FormPage_setDefaultMailName(){

		function getDefaultData(aFileName){
			var defaultDataFile = ChaikaCore.getDataDir();
			defaultDataFile.appendRelativePath(aFileName);

			if(!defaultDataFile.exists()){
				var defaultsFile = ChaikaCore.getDefaultsDir();
				defaultsFile.appendRelativePath(defaultDataFile.leafName);
				defaultsFile.copyTo(defaultDataFile.parent, null);
				defaultDataFile = defaultDataFile.clone().QueryInterface(Ci.nsILocalFile);
			}

			var urlSpec = gBoard.url.spec;
			var lines = ChaikaCore.io.readString(defaultDataFile, "Shift_JIS")
							.replace(/\r/g, "\n").split(/\n+/);
			for(var i=0; i<lines.length; i++){
				var data = lines[i].split(/\t+/);
				if(!(/^\s*;|'|#|\/\//).test(data[0]) && urlSpec.indexOf(data[0]) != -1){
					return (data[1]);
				}
			}
			return null;
		}


		var defaultData = getDefaultData("defaultmail.txt");
		if(defaultData) this._mailForm.value = defaultData;

		defaultData = getDefaultData("defaultname.txt");
		if(defaultData) this._nameForm.value = defaultData;
	}
};




var PreviewPage = {

	pageShow: function PreviewPage_pageShow(aEvent){
		gWizard.canRewind = true;
		gWizard.canAdvance = false;

		var warningMessages = gPost.getWarningMessages();
		if(warningMessages.length > 0){
			Notification.removeAll(true);
			Notification.warning(warningMessages[0]);
		}

		setTimeout("PreviewPage._createPreview()", 0);
	},

	pageRewound: function PreviewPage_pageRewound(aEvent){
		Notification.removeAll(false);
	},

	pageAdvanced: function PreviewPage_pageAdvanced(aEvent){
		Notification.removeAll(false);
	},

	_createPreview: function PreviewPage__createPreview(){
		var previewFrame = document.getElementById("previewFrame");
		var previewData = gPost.getPreview();

		var previewDoc = previewFrame.contentDocument;

		previewDoc.body.style.backGroundColor = previewData["bgColor"];
		previewDoc.body.style.color = previewData["color"];

		var useAAFontCheck = document.getElementById("useAAFontCheck");
		var useAAFont = (useAAFontCheck.getAttribute("checked") == "true");

			// プレビューのフォントを AA フォントにする
		var fontStyle = "";
		if(useAAFont){
			var fontFamily = ChaikaCore.pref.getUniChar("thread_aa_font_name");
			var fontSize = ChaikaCore.pref.getInt("thread_aa_font_size");
			var lineHeight = ChaikaCore.pref.getInt("thread_aa_line_space") + fontSize;
			fontStyle = [fontSize, "px/", lineHeight, "px '", fontFamily, "'"].join("");
		}
		previewDoc.body.style.font = fontStyle;

		
		previewDoc.getElementById("title").innerHTML = previewData["title"];
		previewDoc.getElementById("name").innerHTML = previewData["name"];
		previewDoc.getElementById("mail").innerHTML = previewData["mail"];
		previewDoc.getElementById("message").innerHTML = previewData["message"];

		setTimeout("gWizard.canAdvance = true;", 250);
	}

};




var SubmitPage = {

	succeeded: false,


	pageShow: function SubmitPage_pageShow(aEvent){
		gWizard.canRewind = false;
		gWizard.canAdvance = false;
		gWizard.getButton("finish").disabled = true;
		document.getElementById("reSubmitButton").disabled = true;

		document.getElementById("submitProgress").hidden = false;

		gPost.submit(this);
	},


	pageRewound: function SubmitPage_pageShow(aEvent){
		document.getElementById("response").value = "";
		Notification.removeAll();
		document.getElementById("submitProgress").hidden = true;

		setTimeout("gWizard.goTo('formPage')", 0);
		return false;
	},


	reSubmit: function SubmitPage_reSubmit(){
		Notification.removeAll();
		gWizard.canRewind = false;
		gWizard.canAdvance = false;
		gWizard.getButton("finish").disabled = true;
		document.getElementById("reSubmitButton").disabled = true;
		document.getElementById("submitProgress").hidden = false;

		gPost.submit(this);
	},

	onSucceeded: function SubmitPage_onSucceeded(aPost, aResponseData, aStatus){
		this.succeeded = true;

		var unescapeHTML = Cc["@mozilla.org/feed-unescapehtml;1"]
				.getService(Ci.nsIScriptableUnescapeHTML);
		var response = unescapeHTML.unescape(aResponseData).replace(/[\r\n]{3,}/g, "\n\n");

		document.getElementById("response").value += response + "\n***** ***** *****\n\n"

		Notification.info("書き込みに成功しました");

		if(ChaikaCore.pref.getBool("post.write_log.succeeded")){
			gPost.writeKakikomi(gWizType == WIZ_TYPE_NEW_THREAD);
		}

		gWizard.canRewind = false;
		gWizard.canAdvance = true;
		gWizard.getButton("finish").disabled = false;
		document.getElementById("reSubmitButton").disabled = true;
		document.getElementById("submitProgress").hidden = true;

		if(ChaikaCore.pref.getBool("post.auto_finish")){
			var delay = ChaikaCore.pref.getInt("post.auto_finish_delay");
			setTimeout(function(){ gWizard.advance(null); }, delay);
		}
	},


	onError: function SubmitPage_onError(aPost, aResponseData, aStatus){
		this.succeeded = false;

		var unescapeHTML = Cc["@mozilla.org/feed-unescapehtml;1"]
				.getService(Ci.nsIScriptableUnescapeHTML);
		var response = unescapeHTML.unescape(aResponseData).replace(/[\r\n]{3,}/g, "\n\n");

		document.getElementById("response").value += response + "\n***** ***** *****\n\n";


		Notification.critical("書き込みに失敗しました");

		if(ChaikaCore.pref.getBool("post.write_log.failed")){
			gPost.writeKakikomi(gWizType == WIZ_TYPE_NEW_THREAD);
		}

		gWizard.canRewind = true;
		gWizard.canAdvance = false;
		gWizard.getButton("finish").disabled = true;
		document.getElementById("reSubmitButton").disabled = false;
		document.getElementById("submitProgress").hidden = true;
	},


	reloadThreadPage: function SubmitPage_reloadThreadPage(){
		if(!this.succeeded) return;

		var serverURL = ChaikaCore.getServerURL();

		var browserWindows = Cc["@mozilla.org/appshell/window-mediator;1"]
				.getService(Ci.nsIWindowMediator).getEnumerator("navigator:browser");
		while(browserWindows.hasMoreElements()){
			var browserWindow = browserWindows.getNext();
			if(!browserWindow.getBrowser) continue;

			var browsers = browserWindow.getBrowser().browsers;
			for(var i = 0; i < browsers.length; i++){
				var currentURI = browsers[i].currentURI;
				if(!(currentURI instanceof Ci.nsIURL)) continue;
				try{
					if(serverURL.hostPort != currentURI.hostPort) continue;
					if(currentURI.filePath.indexOf(gThread.plainURL.spec) != -1){
						browsers[i].reload();
					}
				}catch(ex){
					ChaikaCore.logger.error(ex);
				}
			}
		}
	}

};