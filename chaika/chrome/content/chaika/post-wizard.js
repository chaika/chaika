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


var gThreadURL;
var gPost;
var gFilterManager;
var gIoService = Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);

var gTxtResponse;

function startup(){
	gTxtResponse = document.getElementById("txtResponse");

	if(!("arguments" in window)){
		alert("NOT ARGUMENTS");
		window.close();
		return;
	}

	var threadURLSpec = window.arguments[0];
	threadURLSpec = threadURLSpec.replace(/^bbs2ch:post:/, "");

	try{
		gThreadURL = gIoService.newURI(threadURLSpec, null, null)
							.QueryInterface(Components.interfaces.nsIURL);
	}catch(ex){
			// 認識できない URL
		alert("BAD URL");
		window.close();
		return;
	}

	gPost = new Bbs2chPost(gThreadURL);

	if(!gPost.isSupport()){
		switch(gPost.type){
			case ChaikaBoard.BOARD_TYPE_PAGE:
				alert("BAD URL");
				break;
			default:
				alert("NOT SUPPORTED");
		}
		window.close();
		return;
	}

	if(!gPost.isValidThread){
		alert("Invalid Thread");
	}

	var wizPostWizard = document.getElementById("wizPostWizard");
	wizPostWizard.setAttribute("title", "POST: " + gPost.title + " [chaika]");
	wizPostWizard.title = "POST: " + gPost.title + " [chaika]";
	document.getElementById("lblThreadTitle").value = gPost.title;


	mailDisabled();
	initPostFilter();
	checkBeLogin();
}


/**
 * 終了時の処理
 */
function shutdown(){
		// checked の値を完全に覚えさせる
	var chkSage = document.getElementById("chkSage");
	if(!chkSage.checked) chkSage.setAttribute("checked", "false");
}


function mailDisabled(){
	document.getElementById("txtMail").disabled = document.getElementById("chkSage").checked;
}

function initPostFilter(){
	gFilterManager = new b2rPostFilterManager();
	gFilterManager.loadScripts();
	var filterPopup = document.getElementById("filterPopup");

	for(let[key, value] in Iterator(gFilterManager.filters)){
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("label", value.title);
		menuitem.setAttribute("value", key);
		filterPopup.appendChild(menuitem);
	}
	filterPopup.parentNode.parentNode.buildContextMenu();
}

function execPostFilter(aScriptIndex){
	var postFilter = gFilterManager.filters[aScriptIndex];
	var messageText = document.getElementById("txtMsg");

	messageText.value = gFilterManager.execFilterScript(postFilter, messageText);
}

/**
 * ハードコーティングな文字列をスクリプト内部で利用可能な文字列に変換
 * @param aString string 文字列
 * @return string 内部文字列
 */
function hardCoatingStr(aString){
	return aString;
}

/**
 * 書き込み
 */
function post(aAdditionalData){
	document.getElementById("wizPostWizard").getButton("back").disabled = true;
	document.getElementById("wizPostWizard").getButton("finish").disabled = true;
	gTxtResponse.value = "";
	document.getElementById("btnRePost").disabled = true;
	gPost.post(postListener, aAdditionalData);
}

/**
 * post で利用する Bbs2chHttpRequestListener
 */
var postListener = {
	ERROR_BAD_URL: 1,
	ERROR_NOT_AVAILABLE: 2,
	ERROR_FAILURE: 3,
	onHttpStart: function(){
		gTxtResponse.value = hardCoatingStr("書き込み中") + "\n\n";
	},

	onHttpStop: function(aResponseText, aStatus){
		try{
			var response = this.getCharsetFromType(aResponseText, gPost.type);
			gTxtResponse.value += htmlToText(response) + "\n";

			postCheck(response, aStatus);
		}catch(e){alert(e)}
	},

	onHttpDataAvailable: function(aAvailableData, aStatus){
	},

	onHttpError: function(aErrorCode){
		var errorMessage = "";
		switch(aErrorCode){
			case this.ERROR_BAD_URL:
				errorMessage = "BAD URL";
				break;
			case this.ERROR_NOT_AVAILABLE:
				errorMessage = "NOT AVAILABLE";
				break;
			case this.ERROR_FAILURE:
				errorMessage = "FAILURE";
				break;
		}
		gTxtResponse.value += "\n\nERROR: " + errorMessage + "\n\n";
		document.getElementById("wizPostWizard").getButton("back").disabled = false;
		document.getElementById("btnRePost").disabled = false;
	},

	getCharsetFromType: function(aString, aBoardType){
		var unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

		switch(aBoardType){
			case ChaikaBoard.BOARD_TYPE_2CH:
			case ChaikaBoard.BOARD_TYPE_OLD2CH:
			case ChaikaBoard.BOARD_TYPE_MACHI:
				unicodeConverter.charset = "Shift_JIS";
				return unicodeConverter.ConvertToUnicode(aString);
				break;
			case ChaikaBoard.BOARD_TYPE_BE2CH:
			case ChaikaBoard.BOARD_TYPE_JBBS:
				unicodeConverter.charset = "EUC-JP";
				return unicodeConverter.ConvertToUnicode(aString);
				break;
		}
		return aString;
	}

}

var rewrite = false;

/**
 * 書き込みが成功したか確認する
 * @param aResponse string サーバが返すレスポンステキスト
 */
function postCheck(aResponse, aStatus){
	var status = gPost.getStatus(aResponse, aStatus);

	if(status==gPost.SUCCESS){
		alert(hardCoatingStr("書き込みました"));
		reloadThreadPage();
		window.close();
	}else if(status==gPost.COOKIE && !rewrite){
		rewrite = true;

		try{
			var doc = document.implementation.createDocument("", "", null);
			doc.appendChild(doc.createElement("root"));
			var unescapeHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
		    		.getService(Components.interfaces.nsIScriptableUnescapeHTML);
			var fragment = unescapeHTML.parseFragment(aResponse, false, null, doc.documentElement);
			doc.documentElement.appendChild(fragment);
			var inputNodes = doc.getElementsByTagName("input");
			var additionalData = new Array();
			var ignoreInputs = ["submit","subject","bbs","key","time","MESSAGE","FROM","mail"];
			for(var [i, input] in Iterator(inputNodes)){
				if(input.type != "hidden") continue;
				if(ignoreInputs.indexOf(input.name) != -1) continue;
				additionalData.push(input.name +"="+ input.value);
			}
			post(additionalData);
			return;
		}catch(ex){
			
		}
		post();
	}else if(status==gPost.ERROR || status==gPost.SAMBA){
		alert(hardCoatingStr("書き込み中にエラーが発生しました"));

		document.getElementById("wizPostWizard").getButton("back").disabled = false;
		document.getElementById("btnRePost").disabled = false;
	}else if(status==gPost.SERVER_HIGH){
		alert(hardCoatingStr("サーバーが激しく重いです"));

		document.getElementById("wizPostWizard").getButton("back").disabled = false;
		document.getElementById("btnRePost").disabled = false;
	}else{
		document.getElementById("wizPostWizard").getButton("finish").disabled = false;
	}
}


/**
 * フォームのチェック
 */
function formCheck(){
	gPost.message = document.getElementById("txtMsg").value;
	gPost.name = document.getElementById("txtName").value;
	gPost.mail = document.getElementById("txtMail").value;
	gPost.isSage = document.getElementById("chkSage").checked;

	if(gPost.isValid()==gPost.OK)
		return true;
	var error="";
	if(gPost.isValid() & gPost.ERROR_NOT_BE_LOGIN)
		error+="beにログインしていません\n"
	if(gPost.isValid() & gPost.ERROR_MESSAGE_EMPTY)
		error+="本文が空です\n"
	if(gPost.isValid() & gPost.ERROR_NAME_EMPTY)
		error+="名前が空です\n"
	if(gPost.isValid() & gPost.ERROR_MAIL_EMPTY)
		error+="メールが空です\n"
	if(gPost.isValid() & gPost.ERROR_SUBJECT_EMPTY)
		error+="サブジェクトが空です\n"
	if(gPost.isValid() & gPost.ERROR_MESSAGE_TOO_LONG)
		error+="本文が長すぎます\n"
	if(gPost.isValid() & gPost.ERROR_NAME_TOO_LONG)
		error+="名前が長すぎます\n"
	if(gPost.isValid() & gPost.ERROR_MAIL_TOO_LONG)
		error+="メールが長すぎます\n"
	if(gPost.isValid() & gPost.ERROR_SUBJECT_TOO_LONG)
		error+="サブジェクトが長すぎます\n"
	if(gPost.isValid() & gPost.ERROR_MESSAGE_TOO_RETURN)
		error+="改行が多すぎます\n"
	alert(error);
	return false;
}


/**
 * プレビューの作成
 */
function preview(){
	var previewItem = gPost.getPreview();
	var bwrPreview = document.getElementById("bwrPreview");
	var prevDoc = bwrPreview.contentDocument;
	var templateFile = ChaikaCore.getDefaultsDir();
	templateFile.appendRelativePath("post-preview.txt");
	template = ChaikaCore.io.readString(templateFile, "Shift_JIS");

	template = template.replace(/%NAME%/m, previewItem.name);
	template = template.replace(/%MAIL%/m, previewItem.mail);
	template = template.replace(/%DATE%/m, previewItem.date);

	var message = previewItem.message.replace(/</gm, "&lt;").replace(/>/gm, "&gt;");
	message = message.replace(/\n/gm, "<br>");
	template = template.replace(/%MESSAGE%/m, message);

	var htmlBody = bwrPreview.contentDocument.body;
	htmlBody.innerHTML = template;
	htmlBody.style.color = previewItem.color;
	htmlBody.style.backgroundColor = previewItem.backgroundColor;
	var name = bwrPreview.contentDocument.getElementById("name")
	if(name){
		name.style.color = previewItem.nameColor;
	}
}

/**
 * HTML をテキストに変換
 * @param aHTMLSource string 変換する HTML
 * @return string 変換されたテキスト
 */
function htmlToText(aHTMLSource){
	var formatConverter = Components.classes["@mozilla.org/widget/htmlformatconverter;1"]
								.createInstance(Components.interfaces.nsIFormatConverter);
	var fromStr = Components.classes["@mozilla.org/supports-string;1"]
								.createInstance(Components.interfaces.nsISupportsString);
	fromStr.data = aHTMLSource;
	var toStr = { value: null };

	formatConverter.convert("text/html", fromStr, fromStr.toString().length,
							"text/unicode", toStr, {});
	toStr = toStr.value.QueryInterface(Components.interfaces.nsISupportsString);
	toStr = toStr.toString();
	return toStr;
}


/**
 * スレッド表示のリロード
 */
function reloadThreadPage(){
	var threadURLSpec = gThreadURL.spec;

		// ブラウザウィンドウを列挙
	var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							.getService(Components.interfaces.nsIWindowMediator);
	var browserWinEnu = windowMediator.getEnumerator("navigator:browser");

	while(browserWinEnu.hasMoreElements()){
		var browserWin = browserWinEnu.getNext();
		if(!("gBrowser" in browserWin)) continue;

		var browserContent = browserWin.gBrowser;
			// ブラウザ内のタブ
		for(var i = 0; i < browserContent.mPanelContainer.childNodes.length; i++){
			var tabURISpec = browserContent.getBrowserAtIndex(i).currentURI.spec;
				// URL が同じならリロード
			if(tabURISpec.indexOf(threadURLSpec) != -1)
				browserContent.getBrowserAtIndex(i).reload();
		}
	}
}


/**
 * Be@2ch ログインチェックボックスの値設定
 */
function checkBeLogin(){
	var chkBeLogin = document.getElementById("chkBeLogin");
	chkBeLogin.checked = Bbs2chBeLogin.logined;
}


/**
 * Be@2ch ログインチェックボックスが変更されたときに呼ばれる
 */
function toggleBeLogin(){
	var chkBeLogin = document.getElementById("chkBeLogin");

	if(chkBeLogin.checked){
		Bbs2chBeLogin.openLoginDialog();
	}else{
		Bbs2chBeLogin.logout();
	}
	
	chkBeLogin.checked = Bbs2chBeLogin.logined;
}
