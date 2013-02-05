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


EXPORTED_SYMBOLS = ["ChaikaBeLogin"];
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
