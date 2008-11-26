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




/**
 * Be@2ch へのログインログアウト処理を行う
 */
var Bbs2chBeLogin = {


// ********** ********* プロパティ ********** **********


	/**
	 * nsICookieService を返す
	 * @return nsICookieService
	 */
	get cookieService(){
		if(!this._cookieService){
			this._cookieService = Components.classes["@mozilla.org/cookieService;1"]
									.getService(Components.interfaces.nsICookieService);
		}
		return this._cookieService;
	},
	_cookieService: null,


	/**
	 * http://be.2ch.net/ の nsIURI を返す
	 * @return nsIURI
	 */
	get beURI(){
		if(!this._beURI){
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
									.getService(Components.interfaces.nsIIOService);
			this._beURI = ioService.newURI("http://be.2ch.net/", null, null);
		}
		return this._beURI;
	},
	_beURI: null,


	/**
	 * Be@2ch にログイン中なら 真
	 * @return boolean
	 */
	get logined(){
		var cookie = this.cookieService.getCookieString(this.beURI, null);
		if(cookie && cookie.indexOf("MDMD")!=-1 && cookie.indexOf("DMDM")!=-1)
			return true;
		return false;
	},


// ********** ********* メソッド ********** **********


	/**
	 * Be@2ch にログインする
	 * @param aBeCode string Be@2ch の認証コード
	 * @param aBeMail string Be@2ch の認証メールアドレス
	 */
	login: function(aBeCode, aBeMail){
		if(!aBeCode) return;
		if(!aBeMail) return;
	
			// cookie の有効期限
		var cookieExpires = new Date(2015, 11, 31).toString();

			// Be 認証コードの登録
		var cookieBeCode = "MDMD=" + aBeCode  + "; domain=.2ch.net; expires=" + cookieExpires;
		this.cookieService.setCookieString(this.beURI, null, cookieBeCode, null);

			// Be 認証メールの登録
		var cookieBeMail = "DMDM=" + aBeMail + "; domain=.2ch.net; expires=" + cookieExpires;
		this.cookieService.setCookieString(this.beURI, null, cookieBeMail, null);
	},


	/**
	 * Be@2ch からログアウトする
	 */
	logout: function(){
			// cookie の有効期限
		var cookieExpires = new Date(1995, 0, 1).toString();

			// 有効期限に過去を指定して Be 認証コードの削除
		var cookieBeCode = "MDMD=; domain=.2ch.net; expires=" + cookieExpires;
		this.cookieService.setCookieString(this.beURI, null, cookieBeCode, null);

			// 有効期限に過去を指定して Be 認証メールの削除
		var cookieBeMail = "DMDM=; domain=.2ch.net; expires=" + cookieExpires;
		this.cookieService.setCookieString(this.beURI, null, cookieBeMail, null);
	},


	/**
	 * ログインダイアログを開く
	 */
	openLoginDialog:function(){
		var dialogURL = "chrome://chaika/content/belogin/belogin-dialog.xul";
		window.openDialog(dialogURL, "bbe2chBeDialog", "chrome,dialog,modal");
	}
}