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


EXPORTED_SYMBOLS = ["Chaika2chViewer"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/** @ignore */
function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}


/**
 * 2ch ビューア認証オブジェクト
 * @class
 */
var Chaika2chViewer = {

	logined: false,
	sessionID: "",


	/**
	 * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
	 * @private
	 */
	_startup: function Chaika2chViewer__startup(){
		this.logined = false;
		this.sessionID = "";

		this._autoAuth();
	},


	/**
	 * ブラウザ終了時に一度だけ実行され、終了処理を行う。
	 * @private
	 */
	_quit: function Chaika2chViewer__quit(){
		this.logined = false;
		this.sessionID = "";
	},


	/**
	 * ユーザーIDとパスワードを返す関数
	 * @return {Object}  {String} .id ID
	 *                   {String} .password Password
	 */
	getLoginInfo: function Chaika2chViewer_getLoginInfo(){
		var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

		var account = {
			id: '',
			password: ''
		};

		account.id = ChaikaCore.pref.getChar('maru_id');


		//保存されているパスワードをログインマネージャへ移行
		if(ChaikaCore.pref.getChar('maru_password')){
			account.password = ChaikaCore.pref.getChar('maru_password');
			ChaikaCore.pref.setChar('maru_password', '');
			this.setLoginInfo(account.id, account.password);

			return account;
		}


		var logins = lm.findLogins({}, 'chrome://chaika', null, '2ch Viewer Registration');

		logins.some(function(login){
			if(login.username === account.id){
				account.password = login.password;
				return true;
			}

			return false;
		});

		//パスワードがない時はそのアカウントは無効
		if(!account.password) account.id = '';

		return account;
	},


	/**
	 * ユーザーIDとパスワードをセットする関数
	 * @param {String} id
	 * @param {String} password
	 */
	setLoginInfo: function Chaika2chViewer_setLoginInfo(id, password){
		if(!id || !password) return;

		var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
		var loginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
														Ci.nsILoginInfo, "init");

		var login = new loginInfo('chrome://chaika', null, '2ch Viewer Registration', id, password, '', '');

		try{
			var oldLogin = this.getLoginInfo();

			if(oldLogin.id == id && oldLogin.password == password) return;

			if(oldLogin.id && oldLogin.id == id){
				var oldLoginInfo = new loginInfo('chrome://chaika', null, '2ch Viewer Registration',
										oldLogin.id, oldLogin.password, '', '');
				lm.modifyLogin(oldLoginInfo, login);
			}else{
				lm.addLogin(login);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}
	},


	auth: function(){
		this.maruLogined = false;
		this.maruSessionID = "";

		var maruEnabled = ChaikaCore.pref.getBool("maru_enabled");
		if(!maruEnabled){ return; }
		this._authStart();
	},


	_autoAuth: function Chaika2chViewer__autoAuth(){
		var maruAutoAuth = ChaikaCore.pref.getBool("maru_auto_auth");
		var maruEnabled = ChaikaCore.pref.getBool("maru_enabled");
		if(!(maruAutoAuth && maruEnabled)) return;


			// 6時間以内にログインしている場合は、スキップ
			// 実際の 2ch viewer のセッション有効期間は 24 時間?
		var lastAuthTime = ChaikaCore.pref.getInt("maru_last_auth_time");
		var nowTime = Math.round(Date.now() / 1000);
		if((nowTime - lastAuthTime) < 21600){
			this.logined = true;
			this.sessionID = ChaikaCore.pref.getChar("maru_session_id");

			ChaikaCore.logger.info("Auth: SKIP");
			var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
			os.notifyObservers(null, "Chaika2chViewer:Auth", "SKIP");
			return;
		}


		var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
		var timerCallback = {
			observe: function timerCallback_observe(aTimer){
				Chaika2chViewer._authStart();
			}
		};
		timer.init(timerCallback, 500, Ci.nsITimer.TYPE_ONE_SHOT);
	},


	_authStart: function Chaika2chViewer__authStart(){
		var maruAuthURLSpec = ChaikaCore.pref.getChar("maru_auth_url");
		var account = this.getLoginInfo();
		var maruID = account.id;
		var maruPass = account.password;

		if(!(maruID && maruPass)){
			ChaikaCore.logger.warning("Auth: STOP");
			return;
		}
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var maruAuthURL = ioService.newURI(maruAuthURLSpec, null, null).QueryInterface(Ci.nsIURL);

		var httpChannel = ChaikaCore.getHttpChannel(maruAuthURL);
		httpChannel.setRequestHeader("User-Agent", "DOLIB/1.00", false);
		httpChannel.setRequestHeader("X-2ch-UA", ChaikaCore.getUserAgent(), false);
		httpChannel.setRequestHeader("Content-Type", "application/x-www-form-urlencoded", false);
		httpChannel = httpChannel.QueryInterface(Ci.nsIUploadChannel);

		var strStream = Cc["@mozilla.org/io/string-input-stream;1"]
				.createInstance(Ci.nsIStringInputStream);
		var postString = String("ID=" + maruID + "&PW=" + maruPass);
		strStream.setData(postString, postString.length);
		httpChannel.setUploadStream(strStream, "application/x-www-form-urlencoded", -1);
		httpChannel.requestMethod = "POST";

		var authListener = {
			onStartRequest: function authListener_onStartRequest(aRequest, aContext){
				this._binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
						.createInstance(Ci.nsIBinaryInputStream);
				this._data = [];
			},
			onDataAvailable: function authListener_onDataAvailable(aRequest, aContext,
												aInputStream, aOffset, aCount){
				this._binaryStream.setInputStream(aInputStream);
				this._data.push(this._binaryStream.readBytes(aCount));
			},
			onStopRequest: function authListener_onStopRequest(aRequest, aContext, aStatus){
				var data = this._data.join("");
				ChaikaCore.logger.debug("Auth Response: " + data);
				if(data.indexOf("ERROR:") != -1){
					Chaika2chViewer._maruLoginNG();
					return;
				}
				Chaika2chViewer._maruLoginOK(data.substring(11, data.length -1));
			}
		};

		httpChannel.asyncOpen(authListener, null);
		ChaikaCore.logger.info("Auth: START");
	},


	_maruLoginOK: function(aSessionID){
		this.logined = true;
		this.sessionID = aSessionID;

		var nowTime = Math.round(Date.now() / 1000);
		ChaikaCore.pref.setChar("maru_session_id", aSessionID);
		ChaikaCore.pref.setInt("maru_last_auth_time", nowTime);

		ChaikaCore.logger.info("Auth: OK");
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.notifyObservers(null, "Chaika2chViewer:Auth", "OK");
	},


	_maruLoginNG: function(aSessionID){
		this.maruLogined = false;
		this.maruSessionID = "";

		ChaikaCore.logger.info("Auth: NG");
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.notifyObservers(null, "Chaika2chViewer:Auth", "NG");
		try{
			var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
			alertsService.showAlertNotification("", "Chaika",
						"Login failed on 2ch Viewer", false, "", null);
		}catch(ex){}
	}

};
