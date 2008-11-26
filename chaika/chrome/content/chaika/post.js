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
 *    Nazo <lovesyao at hotmail.com>
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




function Bbs2chPost(aThreadURI){
	this.threadURI = aThreadURI;

	this._bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
			.getService(Components.interfaces.nsIBbs2chService),
	this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService),

	this._init();
}

Bbs2chPost.prototype = {

	_init:function(){
		this.boardURI = this._bbs2chService.getBoardURL(this.threadURI.spec);
		this.board = new Bbs2chBoardItems(this.boardURI.spec);
		this.type = this._bbs2chService.getBoardType(this.threadURI.spec);
		var datID = (this.threadURI.spec.match(/\/(\d{9,10})/)) ? RegExp.$1 : "";
		var idxFile = this._bbs2chService.getLogFileAtURL(this.boardURI.resolve(datID + ".idx"));

		if(!idxFile.exists()){
			this._isIdx=false;
		}else{
			this._isIdx=true;
			this._idx = this._bbs2chService.fromSJIS(this._bbs2chService.readFile(idxFile.path));
		}
	},


	_getSetting: function(aName){
			//実際はthread側にあるべきなんだけど…
		var reg = new RegExp("^"+aName+"=(.+)","m");
		var title = this._idx.match(reg) ? RegExp.$1 : null;
		return title;
	},


	isSupport:function(){
		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_PAGE:
			case this._bbs2chService.BOARD_TYPE_OLD2CH:
				return false;
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_BE2CH:
			case this._bbs2chService.BOARD_TYPE_JBBS:
			case this._bbs2chService.BOARD_TYPE_MACHI:
				return true;
			default:
				return false;
		}
	},


	isValidThread:function(){
			//読み込まれていないスレッドには書き込まないようにする。
		if(!this._isIdx){
			return false;
		}
		return true;
	},


	get title(){
		return (this._getSetting("title")!=null)?this._getSetting("title"):this.threadURI.spec;
	},


	_message: "",
	set message(aVal){
		this._message = aVal;
	},
	get message(){
		var message = this._message;
		message = message.replace(/(^|\n) /g,"$1&nbsp;");
		message = message.replace(/ {2}/g," &nbsp;");
		message = message.replace(/\u2003/g,"&emsp;");
		message = message.replace(/\u2002/g,"&ensp;");
		message = message.replace(/\u2009/g,"&thinsp;");
		message = message.replace(/\u00a9/g,"&copy;");
		message = message.replace(/\u00ae/g,"&reg;");
		return message;
	},


	_name: "",
	set name(aVal){
		this._name = aVal;
	},
	get name(){
		return this._name;
	},

	isSage: false,


	_mail: "",
	set mail(aVal){
		this._mail = aVal;
	},


	get mail(){
		if(this.isSage) return "sage";
		return this._mail;
	},


	//複数エラーを吐けるようにしておく
	OK: 0,
	ERROR_NOT_BE_LOGIN: 1<<0,
	ERROR_MESSAGE_EMPTY: 1<<1,
	ERROR_NAME_EMPTY: 1<<2,
	ERROR_MAIL_EMPTY: 1<<3,
	ERROR_SUBJECT_EMPTY: 1<<4,
	ERROR_MESSAGE_TOO_LONG: 1<<5,
	ERROR_NAME_TOO_LONG: 1<<6,
	ERROR_MAIL_TOO_LONG: 1<<7,
	ERROR_SUBJECT_TOO_LONG: 1<<8,
	ERROR_MESSAGE_TOO_RETURN: 1<<9,


	isValid: function(){
		var flag = this.OK;
			//beチェック
		if((this.board.getSetting("BBS_BE_ID")=="1" || this.type==this._bbs2chService.BOARD_TYPE_BE2CH)
				&& !Bbs2chBeLogin.logined){
			flag |= this.ERROR_NOT_BE_LOGIN;
		}

			//本文の未記入チェック
		if(this.message==""){
			flag |= this.ERROR_MESSAGE_EMPTY;
		}

			//改行チェック
		if(this.message.match(/\n/g) && this.board.getSetting("BBS_LINE_NUMBER") != null &&
					this.message.match(/\n/g).length+1 > this.board.getSetting("BBS_LINE_NUMBER")*2){
			flag |= this.ERROR_MESSAGE_TOO_RETURN;
		}

			//本文の長さチェック
		var checkMessage=this._escape(this.message).replace(/%[0-9a-fA-F]{2}/g,"x");
		var bbsMessageCount = this.board.getSetting("BBS_MESSAGE_COUNT");
		if(bbsMessageCount && checkMessage.length > bbsMessageCount){
			flag |= this.ERROR_MESSAGE_TOO_LONG;
		}

			//名前の未記入チェック
		if(this.board.getSetting("NANASHI_CHECK")=="1" && this.name==""){
			flag |= this.ERROR_NAME_EMPTY;
		}

			//名前の長さチェック
		var checkName=this._escape(this.name).replace(/%[0-9a-fA-F]{2}/g,"x");
		var bbsNameCount = this.board.getSetting("BBS_NAME_COUNT");
		if(bbsNameCount && checkName.length > bbsNameCount){
			flag |= this.ERROR_NAME_TOO_LONG;
		}

			//メールの長さチェック
		var checkMail = this._escape(this.mail).replace(/%[0-9a-fA-F]{2}/g,"x");
		var bbsMailCount = this.board.getSetting("BBS_MAIL_COUNT");
		if(bbsMailCount && checkMail.length > bbsMailCount){
			flag |= this.ERROR_MAIL_TOO_LONG;
		}

		return flag;
	},
	getPreview: function(){
		var preview = new Array();
		preview["name"] = (this.name!="")?this.name:this.board.getSetting("BBS_NONAME_NAME")
		preview["mail"] = this.mail;
		preview["message"] = this.message;
		var nowDate = new Date();
		var date = nowDate.getFullYear() + "/";
		date += ((nowDate.getMonth() < 9)? "0" : "") + (nowDate.getMonth() + 1) + "/";
		date += ((nowDate.getDate() < 10)? "0" : "") + nowDate.getDate() + " ";
		date += ((nowDate.getHours() < 10)? "0" : "") + nowDate.getHours() + ":";
		date += ((nowDate.getMinutes() < 10)? "0" : "") + nowDate.getMinutes();
		preview["date"] = date;
		preview["backgroundColor"] = this.board.getSetting("BBS_THREAD_COLOR");
		if(!preview["backgroundColor"]){
			preview["backgroundColor"] = "#EFEFEF";
		}
		preview["color"] = this.board.getSetting("BBS_TEXT_COLOR");
		if(!preview["color"]){
			preview["color"] = "#000000";
		}
		preview["nameColor"] = this.board.getSetting("BBS_NAME_COLOR");
		if(!preview["nameColor"]){
			preview["nameColor"] = "green";
		}
		return preview;
	},
	getLastModified: function(){
		var lastModified = this._getSetting("lastModified");
		if(lastModified==null)lastModified = "";
		return Math.ceil(new Date(lastModified).getTime() / 1000);
	},
	get _postURI(){
		var postURISpec;
		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_BE2CH:
				postURISpec = this.boardURI.resolve("../test/bbs.cgi");
				break;
			case this._bbs2chService.BOARD_TYPE_JBBS:
				postURISpec = this.threadURI.spec.replace("read.cgi", "write.cgi");
				break;
			case this._bbs2chService.BOARD_TYPE_MACHI:
				postURISpec = this.boardURI.resolve("../bbs/write.cgi");
				break;
		}
		var postURI = this._ioService.newURI(postURISpec, null, null)
							.QueryInterface(Components.interfaces.nsIURL);
		return postURI;
	},
	_escape: function(aString){
		var entityConverter = Components.classes["@mozilla.org/intl/entityconverter;1"]
					.createInstance(Components.interfaces.nsIEntityConverter);
		var textToSubURI = Components.classes["@mozilla.org/intl/texttosuburi;1"]
					.getService(Components.interfaces.nsITextToSubURI);

			// XXX TODO 参照化しないホストをリスト化する
		if(this.boardURI.host != "bbs.nicovideo.jp"){
			aString = entityConverter.ConvertToEntities(aString,
						Components.interfaces.nsIEntityConverter.html40);
		}

		var charset = "";
		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_MACHI:
				charset = "Shift_JIS";
				break;
			case this._bbs2chService.BOARD_TYPE_BE2CH:
			case this._bbs2chService.BOARD_TYPE_JBBS:
				charset = "EUC-JP";
				break;
		}
		if(charset){
			var escapedStr = textToSubURI.ConvertAndEscape(charset, aString);
			if(this.board.getSetting("BBS_UNICODE") == "pass"){
				var unescapedStr = textToSubURI.UnEscapeAndConvert(charset, escapedStr);
				if(aString != unescapedStr){
					var charactor = [];
					for(var i = 0; i<aString.length; i++){
						var c = (aString[i]==unescapedStr[i] || aString[i]==" ") ?
													aString[i] : ("&#" + aString.charCodeAt(i) + ";");
						charactor.push(c);
					}
					escapedStr = textToSubURI.ConvertAndEscape(charset, charactor.join(""));
				}
			}
			return escapedStr;
 		}
 		return aString;
	},
	post: function(aListener, additionalData){
		this.listener = aListener;

		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_BE2CH:
					// DAT ID
				this.threadURI.spec.match(/\/(\d{9,10})/);
				var datID = RegExp.$1;
					// カテゴリ
				this.boardURI.spec.match(/\/([^\/]+)\/?$/);
				var category = RegExp.$1;
						// POST データ
				var postSubmit = "\u66F8\u304D\u8FBC\u3080";
					postSubmit = "submit=" + this._escape(postSubmit);

				var postBbs  = "bbs="  + category;
				var postKey  = "key="  + datID;
				var postTime = "time=" + this.getLastModified();

				var postMsg  = "MESSAGE=" + this._escape(this.message);
				var postName = "FROM=" + this._escape(this.name);
				var postMail = "mail=" + this._escape(this.mail);
				var postHana = "hana=mogera";

				var postData = new Array(postSubmit, postBbs, postKey, postTime,
											postMsg, postName, postMail, postHana);
				if(additionalData){
					postData = postData.concat(additionalData);
				}

				if(this._bbs2chService.maruLogined){
					var sid = "sid=" + encodeURIComponent(this._bbs2chService.maruSessionID);
					postData.push(sid);
				}
				break;
			case this._bbs2chService.BOARD_TYPE_JBBS:
					// DAT ID
				this.threadURI.spec.match(/\/(\d{9,10})/);
				var datID = RegExp.$1;
					// カテゴリ
				this.boardURI.spec.match(/\/([^\/]+)\/([^\/]+)\/?$/);
				var directory = RegExp.$1;
				var category = RegExp.$2;
						// POST データ
				var postSubmit = "\u66F8\u304D\u8FBC\u3080";
					postSubmit = "submit=" + this._escape(postSubmit);

				var postDir  = "DIR="  + directory;
				var postBbs  = "BBS="  + category;
				var postKey  = "KEY="  + datID;
				var postTime = "TIME=1";

				var postMsg  = "MESSAGE=" + this._escape(this.message);
				var postName = "NAME=" + this._escape(this.name);
				var postMail = "MAIL=" + this._escape(this.mail);

				var postData = new Array(postSubmit, postDir, postBbs, postKey,
											postTime,postMsg, postName, postMail);
				break;
			case this._bbs2chService.BOARD_TYPE_MACHI:
					// DAT ID
				this.threadURI.spec.match(/\/(\d{9,10})/);
				var datID = RegExp.$1;
					// カテゴリ
				this.boardURI.spec.match(/\/([^\/]+)\/?$/);
				var category = RegExp.$1;
					// POST データ
				var postSubmit = "\u66F8\u304D\u8FBC\u307F";
				postSubmit = "submit=" + this._escape(postSubmit);
				var postName = "NAME=" + this._escape(this.name);
				var postMail = "MAIL=" + this._escape(this.mail);
				var postMsg  = "MESSAGE=" + this._escape(this.message);
				var postBbs  = "BBS="  + category;
				var postKey  = "KEY="  + datID;
				var postTime = "TIME=1";

				var postData = [postSubmit, postName, postMail, postMsg, postBbs, postKey, postTime];
				break;
		}

		var httpReqest = new Bbs2chHttpRequest(this._postURI.spec, aListener, this.threadURI.spec);
		httpReqest.post(postData.join("&"));
	},
	SUCCESS: 0,
	COOKIE: 1,
	SERVER_HIGH: 2,
	SAMBA: 3,
	ERROR: 4,
	UNKNOWN: 5,
	getStatus:function(aResponse, aStatus){
			//書きこみました,書き込みました,書き込み終了,書きこみが終わりました
		const SUCCESS = new Array("\u66F8\u304D\u3053\u307F\u307E\u3057\u305F","\u66F8\u304D\u8FBC\u307F\u307E\u3057\u305F","\u66F8\u304D\u8FBC\u307F\u7D42\u4E86","\u66F8\u304D\u3053\u307F\u304C\u7D42\u308F\u308A\u307E\u3057\u305F");
			//クッキー確認
		const CHECK_COOKIE = new Array("\u30AF\u30C3\u30AD\u30FC\u78BA\u8A8D");
			//お茶でも飲みましょう
		const CHECK_SERVER_HIGH = new Array("\u304A\u8336\u3067\u3082\u98F2\u307F\u307E\u3057\u3087\u3046");
			//SAMBA24
		const CHECK_SAMBA = new Array("Samba","SAMBA","samba");
			//ERROR,ＥＲＲＯＲ
		const CHECK_ERROR = new Array("ERROR","\uFF25\uFF32\uFF32\uFF2F\uFF32");

		if(this.type == this._bbs2chService.BOARD_TYPE_MACHI && aStatus == 302)
			return this.SUCCESS;

		for(var i in SUCCESS){
			if(aResponse.match(SUCCESS[i])){
				return this.SUCCESS;
			}
		}
		for(i in CHECK_COOKIE){
			if(aResponse.match(CHECK_COOKIE[i])){
				return this.COOKIE;
			}
		}
		for(i in CHECK_SERVER_HIGH){
			if(aResponse.match(CHECK_SERVER_HIGH[i])){
				return this.SERVER_HIGH;
			}
		}
		for(i in CHECK_SAMBA){
			if(aResponse.match(CHECK_SAMBA[i])){
				return this.SAMBA;
			}
		}
		for(i in CHECK_ERROR){
			if(aResponse.match(CHECK_ERROR[i])){
				return this.ERROR;
			}
		}
		return this.UNKNOWN;
	}
}
