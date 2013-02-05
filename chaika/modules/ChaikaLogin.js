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
		var fromStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		var mail = "m=" + encodeURIComponent(ChaikaCore.pref.getChar("login.be.id"));
		var pass = "p=" + encodeURIComponent(ChaikaCore.pref.getChar("login.be.password"));
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

		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
		req.addEventListener('load', this, false);
		req.addEventListener('error', this, false);

		var formStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		var mail = "form_login_id=" + encodeURIComponent(ChaikaCore.pref.getChar("login.p2.id"));
		var pass = "form_login_pass=" + encodeURIComponent(ChaikaCore.pref.getChar("login.p2.password"));
		var extra = "ctl_register_cookie=1&register_cookie=1&submit_userlogin=%83%86%81%5B%83U%83%8D%83O%83C%83%93";
		formStr.data = [mail, pass, extra].join("&");
		ChaikaCore.logger.debug(formStr);

		req.open("POST", ChaikaCore.pref.getChar("login.p2.login_url"), true);
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.send(formStr);
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
     * @param {Number} datID 書き込み先のdat ID
     * @return {String} csrfid 取得できなかった場合は null を返す
	 */
	getCsrfid: function(host, bbs, datID){
		if(!this.isLoggedIn()) return null;

		var csrfid_url = ChaikaCore.pref.getChar('login.p2.csrfid_url');
		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

		req.open('GET', csrfid_url + '?host=' + host + '&bbs=' + bbs + '&key=' + datID, false);
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
