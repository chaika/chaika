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


EXPORTED_SYMBOLS = ["ChaikaBeLogin", "ChaikaP2Login"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/** @ignore */
function makeException(aResult, aMessage){
	var stack = Components.stack.caller.caller;
	return new Components.Exception(aMessage || "exception", aResult, stack);
}


/**
 * Be@2ch ログインオブジェクト
 * @class
 */
var ChaikaBeLogin = {

	_loggedIn: false,


	/**
	 * ユーザーIDとパスワードを返す関数
	 * @return {Object}  {String} .id ID
	 *                   {String} .password Password
	 */
	getLoginInfo: function ChaikaBeLogin_getLoginInfo(){
		var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

		var account = {
			id: '',
			password: ''
		};

		account.id = ChaikaCore.pref.getChar('login.be.id');


		//保存されているパスワードをログインマネージャへ移行
		if(ChaikaCore.pref.getChar('login.be.password')){
			account.password = ChaikaCore.pref.getChar('login.be.password');
			ChaikaCore.pref.setChar('login.be.password', '');
			this.setLoginInfo(account.id, account.password);

			return account;
		}


		var logins = lm.findLogins({}, 'http://be.2ch.net', 'http://be.2ch.net', null);

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
	setLoginInfo: function ChaikaBeLogin_setLoginInfo(id, password){
		if(!id || !password) return;

		var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
		var loginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
														Ci.nsILoginInfo, "init");

		var login = new loginInfo('http://be.2ch.net', 'http://be.2ch.net', null,
						id, password, 'm', 'p');

		try{
			var oldLogin = this.getLoginInfo();

			if(oldLogin.id == id && oldLogin.password == password) return;

			if(oldLogin.id && oldLogin.id == id){
				var oldLoginInfo = new loginInfo('http://be.2ch.net', 'http://be.2ch.net', null,
										oldLogin.id, oldLogin.password, 'm', 'p');
				lm.modifyLogin(oldLoginInfo, login);
			}else{
				lm.addLogin(login);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}
	},


	isLoggedIn: function ChaikaBeLogin_isLoggedIn(){
		if(!this._loggedIn){
			var cookieService = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);

			var cookie = cookieService.getCookieString(this._getLoginURI(), null);
			if(cookie && cookie.indexOf("MDMD")!=-1 && cookie.indexOf("DMDM")!=-1){
				this._loggedIn = true;
			}
		}
		return this._loggedIn;
	},


	login: function ChaikaBeLogin_login(){
		this._loggedIn = false;

		var httpReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
				.createInstance(Ci.nsIXMLHttpRequest);

		httpReq.open("POST", this._getLoginURI().spec, true);
		httpReq.onload = function(aEvent){
			var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
			this.channel.contentCharset = "euc-jp";

			var id = null;
			var sessionID = null;
			if((/DMDM=([^;]+)/m).test(this.responseText)){
				id = RegExp.$1;
			}
			if((/MDMD=([^;]+)/m).test(this.responseText)){
				sessionID = RegExp.$1;
			}

			if(id && sessionID){
				var exp = new Date();
				exp.setTime(exp.getTime() + 5 * 365 * 86400 * 1000);
				ChaikaBeLogin._setCookie(id, sessionID, exp);
				ChaikaBeLogin._loggedIn = true;

				os.notifyObservers(null, "ChaikaBeLogin:Login", "OK");
			}else{
				ChaikaBeLogin.logout();
				os.notifyObservers(null, "ChaikaBeLogin:Login", "NG");
			}
		}

		var account = this.getLoginInfo();
		var fromStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		var mail = "m=" + encodeURIComponent(account.id);
		var pass = "p=" + encodeURIComponent(account.password);
		var submit = "submit=%C5%D0%CF%BF";
		fromStr.data = [mail, pass, submit].join("&");

		httpReq.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		httpReq.send(fromStr);
	},


	logout: function ChaikaBeLogin_logout(){
		this._setCookie("", "", new Date(2000, 0, 1));
		this._loggedIn = false;
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.notifyObservers(null, "ChaikaBeLogin:Logout", "OK");
	},


	_getLoginURI: function ChaikaBeLogin__getLoginURI(){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var loginURLSpec = ChaikaCore.pref.getChar("login.be.login_url");
		return ioService.newURI(loginURLSpec, null, null);
	},


	_setCookie: function ChaikaBeLogin__setCookie(aID, aSessionID, aExpires){
		var cookieService = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);

		var idCookie = "DMDM=" + aID
				+ "; domain=.2ch.net; path=/; expires=" + aExpires.toUTCString();
		var sessionIDCookie = "MDMD=" + aSessionID
				+ "; domain=.2ch.net; path=/; expires=" + aExpires.toUTCString();

		cookieService.setCookieString(this._getLoginURI(), null, idCookie, null);
		cookieService.setCookieString(this._getLoginURI(), null, sessionIDCookie, null);
	}

};


/**
 * p2.2ch.net ログインオブジェクト
 * @class
 */
var ChaikaP2Login = {

	//p2にログインしているかどうか
	_loggedIn: false,

	//p2での書き込みを有効にするかどうか
	_enabled: false,

	get enabled(){
		return this._enabled && this.isLoggedIn();
	},

	set enabled(bool){
		this._enabled = bool;
	},

	get cookieManager(){
		if(!this._cookieManager)
			this._cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);

		return this._cookieManager;
	},

	get os(){
		if(!this._os)
			this._os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

		return this._os;
	},

	/**
	 * ユーザーIDとパスワードを返す関数
	 * @return {Object}  {String} .id ID
	 *                   {String} .password Password
	 */
	getLoginInfo: function ChaikaP2Login_getLoginInfo(){
		var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

		var account = {
			id: '',
			password: ''
		};

		account.id = ChaikaCore.pref.getChar('login.p2.id');


		//保存されているパスワードをログインマネージャへ移行
		if(ChaikaCore.pref.getChar('login.p2.password')){
			account.password = ChaikaCore.pref.getChar('login.p2.password');
			ChaikaCore.pref.setChar('login.p2.password', '');
			this.setLoginInfo(account.id, account.password);

			return account;
		}


		var url = ChaikaCore.pref.getChar('login.p2.login_url');
		url = url.match(/^(https?:\/\/[^\/]+)\//)[1];

		var logins = lm.findLogins({}, url, url, null);

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
	setLoginInfo: function ChaikaP2Login_setLoginInfo(id, password){
		var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
		var loginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
														Ci.nsILoginInfo, "init");

		var url = ChaikaCore.pref.getChar('login.p2.login_url');
		url = url.match(/^(https?:\/\/[^\/]+)\//)[1];

		var login = new loginInfo(url, url, null,
						id, password, 'form_login_id', 'form_login_pass');

		try{
			var oldLogin = this.getLoginInfo();

			if(oldLogin.id == id && oldLogin.password == password) return;

			if(oldLogin.id && oldLogin.id == id){
				var oldLoginInfo = new loginInfo(url, url, null,
										oldLogin.id, oldLogin.password, 'form_login_id', 'form_login_pass');
				lm.modifyLogin(oldLoginInfo, login);
			}else{
				lm.addLogin(login);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}
	},


	isLoggedIn: function ChaikaP2Login_isLoggedIn(){
		var psExists = this.cookieManager.cookieExists({
			host: ChaikaCore.pref.getChar("login.p2.cookie_domain"),
			path: '/',
			name: 'PS'
		});

		var cidExists = this.cookieManager.cookieExists({
			host: ChaikaCore.pref.getChar("login.p2.cookie_domain"),
			path: '/',
			name: 'cid'
		});

		ChaikaCore.logger.debug('ps exists:' + psExists + '; cid exists:' + cidExists);

		//クッキーがあればログイン済みである
		this._loggedIn = psExists && cidExists;

		return this._loggedIn;
	},

	login: function ChaikaP2Login_login(){
		this._loggedIn = false;

		this._req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
		this._req.addEventListener('load', this, false);
		this._req.addEventListener('error', this, false);

		var account = this.getLoginInfo();
		var formStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		var mail = "form_login_id=" + encodeURIComponent(account.id);
		var pass = "form_login_pass=" + encodeURIComponent(account.password);
		var extra = "ctl_register_cookie=1&register_cookie=1&submit_userlogin=%83%86%81%5B%83U%83%8D%83O%83C%83%93";
		formStr.data = [mail, pass, extra].join("&");

		this._req.open("POST", ChaikaCore.pref.getChar("login.p2.login_url"), true);
		this._req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		this._req.send(formStr);
	},

	logout: function ChaikaP2Login_logout(){
		//クッキーを削除する
		this.cookieManager.remove(ChaikaCore.pref.getChar("login.p2.cookie_domain"), 'PS', '/', false);
		this.cookieManager.remove(ChaikaCore.pref.getChar("login.p2.cookie_domain"), 'cid', '/', false);
		this._loggedIn = false;

		//ログアウトを通知
		this.os.notifyObservers(null, "ChaikaP2Login:Logout", "OK");
	},

	handleEvent: function(event){
		//XMLHttpRequestでない場合は終了
		if(!this._req) return;

		//w2鯖の場合は自動で修正してやり直す
		if(this._req.channel.URI.spec.indexOf('w2.p2.2ch.net') !== -1 &&
		   ChaikaCore.pref.getChar('login.p2.login_url').indexOf('w2.p2.2ch.net') === -1){
			ChaikaCore.pref.setChar('login.p2.login_url', "http://w2.p2.2ch.net/p2/?b=pc");
			ChaikaCore.pref.setChar('login.p2.post_url', 'http://w2.p2.2ch.net/p2/post.php?grid=ON');
			ChaikaCore.pref.setChar('login.p2.csrfid_url', 'http://w2.p2.2ch.net/p2/post_form.php');

			return this.login();
		}

		//w2ではないのにw2に設定されていた場合も自動で修正する
		if(this._req.channel.URI.spec.indexOf('w2.p2.2ch.net') === -1 &&
			ChaikaCore.pref.getChar('login.p2.login_url').indexOf('w2.p2.2ch.net') !== -1){
			ChaikaCore.pref.setChar('login.p2.login_url', "http://p2.2ch.net/p2/?b=pc");
			ChaikaCore.pref.setChar('login.p2.post_url', 'http://p2.2ch.net/p2/post.php?grid=ON');
			ChaikaCore.pref.setChar('login.p2.csrfid_url', 'http://p2.2ch.net/p2/post_form.php');

			return this.login();
		}

		this._req = null;

		//ログインの成功の可否を通知する
		if(this.isLoggedIn()){
			this.os.notifyObservers(null, "ChaikaP2Login:Login", "OK");
		}else{
			this.logout();
			this.os.notifyObservers(null, "ChaikaP2Login:Login", "NG");
		}
	},

	/**
     * 書き込みページからcsrfidを得る
     * @param {String} host 書き込み先のホスト
     * @param {String} bbs 書き込み先の板名
     * @param {Number} [datID] 書き込み先のdat ID 省略した場合はスレ立てになる
     * @return {String} csrfid 取得できなかった場合は null を返す
	 */
	getCsrfid: function(host, bbs, datID){
		if(!this.isLoggedIn()) return null;

		var csrfid_url = ChaikaCore.pref.getChar('login.p2.csrfid_url');
		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

		req.open('GET', csrfid_url + '?host=' + host + '&bbs=' + bbs +
		         (datID ? '&key=' + datID : '&newthread=1'), false);
		req.send(null);

		if(req.status !== 200) return null;

		var csrfid = req.responseText.match(/csrfid" value="([a-zA-Z0-9]+)"/);

		if(csrfid){
			return csrfid[1];
		}else{
			return null;
		}
	}
};
