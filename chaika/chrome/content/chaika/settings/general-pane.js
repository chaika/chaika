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

Components.utils.import("resource://chaika-modules/ChaikaLogin.js");

var gGeneralPane = {

	startup: function(){
		setCcontainerDisabled("extensions.chaika.appoint_data_dir",
				"boxDataDir", true);
		setCcontainerDisabled("extensions.chaika.http_proxy_mode",
				"txtProxyValue", "2");
	},

	selectDataDir: function(){
		const nsIFilePicker = Components.interfaces.nsIFilePicker;

		var dataDirPref = document.getElementById("extensions.chaika.data_dir");

		var filePicker = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		filePicker.init(window, "フォルダを選択してください", nsIFilePicker.modeGetFolder);

			// 初期表示フォルダ
		var displayDirectory = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsIFile);
		try{
			displayDirectory.initWithPath(dataDirPref.value);
			if(displayDirectory.exists()){
				filePicker.displayDirectory = displayDirectory;
			}
		}catch(ex){}

		if (filePicker.show() != nsIFilePicker.returnOK) return;

		var selectedDir = filePicker.file
				.QueryInterface(Components.interfaces.nsIFile);
		dataDirPref.value = selectedDir.path;
	},

	readDataDirPref: function(){
		var dataDirPref = document.getElementById("extensions.chaika.data_dir");
		var txtDataDir = document.getElementById("txtDataDir");
		if(!dataDirPref.value) return "";
		return dataDirPref.value;
	},

	openMaruDialog: function(){
		document.documentElement.openSubDialog(
			"chrome://chaika/content/settings/maru.xul", "", null);
	},

	/**
	 * ログインマネージャからパスワードを取得してセットする
	 */
	setPasswordBox: function(mode){
		var account = mode == 'Be' ?
							ChaikaBeLogin.getLoginInfo() :
							ChaikaP2Login.getLoginInfo();

		return account.password;
	},

	/**
	 * パスワードをログインマネージャに登録し、設定値には空文字列を登録するようにする
	 * 変更の反映処理等を効率的に行うためにダミーの設定項目(login.p2.idなど)を使用する
	 */
	setPasswordPref: function(mode, pass){
		if(mode == 'Be'){
			var id = document.getElementById('extensions.chaika.login.be.id').value;
			ChaikaBeLogin.setLoginInfo(id, pass);
		}else{
			var id = document.getElementById('extensions.chaika.login.p2.id').value;
			ChaikaP2Login.setLoginInfo(id, pass);
		}

		return '';
	}
};
