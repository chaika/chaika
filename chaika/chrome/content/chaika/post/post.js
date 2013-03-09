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


function Post(aThread, aBoard){
	this._thread = aThread;
	this._board = aBoard;
}

Post.prototype = {

	charset: "Shift_JIS",


	setPostData: function Post_setPostData(aTitle, aName, aMail, aMessage){
		this.title = aTitle;
		this.name = aName;
		this.mail = aMail;
		this.message = aMessage;
	},


	getErrorMessages: function Post_getErrorMessages(){
		var result = [];

		var convertedMessage = this._convert(this.message, this.charset, true, false);
		var convertedName = this._convert(this.name, this.charset, true, false);
		var convertedMail = this._convert(this.mail, this.charset, true, false);

			// 本文の未記入チェック
		if(convertedMessage == ""){
			result.push("本文が空です");
		}

			// 本文の改行チェック
		var bbsLineNumber = this._board.getSetting("BBS_LINE_NUMBER");
		if(bbsLineNumber && convertedMessage != ""){
			bbsLineNumber = parseInt(bbsLineNumber) * 2;
			var lineCount = convertedMessage.split("\n").length;
			if(lineCount > bbsLineNumber){
				result.push("本文に改行が多すぎます (" + lineCount + "/" + bbsLineNumber + ")");
			}
		}

			// 本文の長さチェック
		var bbsMessageCount = parseInt(this._board.getSetting("BBS_MESSAGE_COUNT"));
		if(bbsMessageCount && convertedMessage != ""){
			var length = convertedMessage.length;
			if(length > bbsMessageCount){
				result.push("本文が長すぎます (" + length + "/" + bbsMessageCount + ")");
			}
		}

			// 名前の未記入チェック
		if(this._board.getSetting("NANASHI_CHECK") == "1" && convertedName == ""){
			result.push("名前が空です");
		}

			// 名前の長さチェック
		var bbsNameCount = parseInt(this._board.getSetting("BBS_NAME_COUNT"));
		if(bbsNameCount && convertedName != ""){
			var length = convertedName.length;
			if(length > bbsNameCount){
				result.push("名前が長すぎます (" + length + "/" + bbsNameCount + ")");
			}
		}

			// メールの長さチェック
		var bbsMailCount = parseInt(this._board.getSetting("BBS_MAIL_COUNT"));
		if(bbsMailCount && convertedMail != ""){
			var length = convertedMail.length;
			if(length > bbsMailCount){
				result.push("メールが長すぎます (" + length + "/" + bbsMailCount + ")");
			}
		}

		return result;
	},


	getWarningMessages: function Post_getWarningMessages(){
		var result = [];
		var convertedMessage = this._convert(this.message, this.charset, true, false);

		// fusianasan 警告
		if(ChaikaCore.pref.getBool('post.warn_fusianasan')){
			var name = this.name || this._board.getSetting("BBS_NONAME_NAME") || "";
			if(name){
				name = name.replace("&r", "", "g");
				if(name.indexOf("fusianasan") != -1){
					result.push("fusianasan トラップ (リモートホストが表示されます)");
				}
			}
		}

		//be警告
		if(!/\.2ch\.net\/(?:be|nandemo|argue)\//.test(this._board.url.spec) &&
		   ChaikaCore.pref.getBool('post.warn_be') && ChaikaBeLogin.isLoggedIn()){
			result.push('Beが有効になっています');
		}

		//p2警告
		if(ChaikaCore.pref.getBool('post.warn_p2') && ChaikaP2Login.enabled){
			result.push('p2経由で書き込みを行います');
		}

		// 文字化けチェック
		var bbsUnicode = this._board.getSetting("BBS_UNICODE");
		if(bbsUnicode && bbsUnicode!="pass"){
			if(convertedMessage != this.message){
				result.push("この板では文字化けする可能性のある文字列が含まれています");
			}
		}

		return result;
	},


	getThreadTitle:function Post_getThreadTitle(){
		return this._thread.title;
	},


	getPreview: function Post_getPreview(){
		var preview = {};

		var board = this._board;
		function getSetting(aSettingName){
			return board.getSetting(aSettingName)
		}

		function convertEntity(aStr){
			return aStr.replace("&", "&amp;", "g")
						.replace("<", "&lt;", "g")
						.replace(">", "&gt;", "g");
		}

		preview["title"]   = convertEntity(this.getThreadTitle());

		preview["mail"]    = convertEntity(this.mail);
		preview["message"] = convertEntity(this.message).replace("\n", "<br>", "g");

		preview["bgColor"]   = getSetting("BBS_THREAD_COLOR") || "#EFEFEF";
		preview["color"]     = getSetting("BBS_TEXT_COLOR") || "#000000";
		preview["nameColor"] = getSetting("BBS_NAME_COLOR") || "green";

		preview["linkColor"]  = getSetting("BBS_LINK_COLOR");
		preview["alinkColor"] = getSetting("BBS_ALINK_COLOR");
		preview["vlinkColor"] = getSetting("BBS_VLINK_COLOR");


		var name = convertEntity(this.name || getSetting("BBS_NONAME_NAME") || "");
		name = name.replace("◆", "◇");

			// トリップ変換
		var tripPos = name.indexOf("#");
		if(tripPos != -1){
			var tripKey = name.substring(tripPos);

			var uniConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Ci.nsIScriptableUnicodeConverter)
			uniConverter.charset = gPost.charset;
			tripKey = uniConverter.convertToByteArray(tripKey, {}).map(
				function(aElement, aIndex, aArray){
					return String.fromCharCode(aElement);
				}
			).join("");

			var trip = Trip.getTrip(tripKey);
			name = [name.substring(0, tripPos),
						" <span class='resSystem'>", "◆", trip, "</span>"].join("");
		}
		preview["name"] = name;


		return preview;
	},


	writeKakikomi: function Post_writeKakikomi(aNewThread){
		var url;
		if(aNewThread){
			url = this._board.url.spec;
		}else{
			url = this._thread.plainURL.spec;
		}

		var nowDate = new Date();
		var week = "日月火水木金土";
		var date = nowDate.toLocaleFormat("%Y/%m/%d($WEEK$) %H:%M:%S")
				.replace("$WEEK$", week[nowDate.getDay()]);

		var kakikomi = [];
		kakikomi.push("--------------------------------------------");
		kakikomi.push("Date   : " + date);
		kakikomi.push("Subject: " + this.getThreadTitle());
		kakikomi.push("URL    : " + url);
		kakikomi.push("FROM   : " + this.name);
		kakikomi.push("MAIL   : " + this.mail);
		kakikomi.push("");
		kakikomi = kakikomi.concat(this.message.split("\n"));

		kakikomi = kakikomi.join("\r\n") + "\r\n\r\n\r\n";

		var kakikomiFile = ChaikaCore.getDataDir();
		kakikomiFile.appendRelativePath("kakikomi.txt");
		ChaikaCore.io.writeString(kakikomiFile, "Shift_JIS", true, kakikomi);
	},


	submit: function Post_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var postURI = ioService.newURI("../test/bbs.cgi?guid=ON", null, this._board.url);

		this._httpRequest = new HttpRequest(postURI, this._thread.plainURL, this);

		var postData = [];
		postData.push("submit=" + this._convert("書き込む", this.charset, false, true));
		postData.push("bbs="    + this._board.url.directory.match(/\/([^\/]+)\/?$/)[1]);
		postData.push("key="    + this._thread.datID);
		postData.push("time="   + Math.ceil(new Date(this._thread.lastModified).getTime() / 1000));

		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("FROM="    + this._convert(this.name, this.charset, false, true));
		postData.push("mail="    + this._convert(this.mail, this.charset, false, true));

		if(additionalData){
			postData = postData.concat(additionalData);
		}


		if(Chaika2chViewer.logined){
			postData.push("sid=" + encodeURIComponent(Chaika2chViewer.sessionID));
		}
		this._httpRequest.post(postData.join("&"));
	},


	SUCCESS:     0,
	COOKIE:      1,
	SERVER_HIGH: 2,
	SAMBA:       3,
	NINJA:       4,
	ERROR:       0xFE,
	UNKNOWN:     0xFF,


	responseCheck: function Post_responseCheck(aResponseData, aResponseStatus){
		var statuses = [];
		statuses[this.SUCCESS    ] = ["書きこみました",
		                              "書き込みました",
		                              "書き込み終了",
		                              "書きこみが終わりました"];
		statuses[this.COOKIE     ] = ["クッキー確認"];
		statuses[this.NINJA      ] = ["貴方の冒険の書を作成します"];
		statuses[this.SERVER_HIGH] = ["お茶でも飲みましょう"];
		statuses[this.SAMBA      ] = ["Samba", "SAMBA", "samba"];
		statuses[this.STRANGE    ] = ["ブラウザ"];
		statuses[this.ERROR      ] = ["ERROR", "ＥＲＲＯＲ"];

		for(var i in statuses){
			var status = statuses[i];
			for(var j in status){
				if(aResponseData.match(status[j])){
					return Number(i);
				}
			}
		}
		return this.UNKNOWN;

	},


	_cookieReSubmit: false,


	onHttpStart: function Post_onHttpStart(){},


	onHttpStop: function Post_onHttpStop(aHttpRequest, aData, aHeaders, aStatus, aSucceeded){
		var uniConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Ci.nsIScriptableUnicodeConverter)
		uniConverter.charset = this.charset;
		var responseData = uniConverter.ConvertToUnicode(aData);

		var postStatus = this.responseCheck(responseData, aStatus);

		if(postStatus == this.SUCCESS){
			this._listener.onSucceeded(this, responseData, postStatus);
		}else if(postStatus == this.NINJA && this._cookieReSubmit){
			this._cookieReSubmit = false;
			this._listener.onError(this, responseData, postStatus);
			return;
		}else if(postStatus == this.COOKIE && !this._cookieReSubmit){
			this._cookieReSubmit = true;

			try{
				var doc = document.implementation.createDocument("", "", null);
				doc.appendChild(doc.createElement("root"));
				var unescapeHTML = Cc["@mozilla.org/feed-unescapehtml;1"]
						.getService(Ci.nsIScriptableUnescapeHTML);
				var fragment = unescapeHTML.parseFragment(responseData, false, null, doc.documentElement);
				doc.documentElement.appendChild(fragment);
				var inputNodes = doc.getElementsByTagName("input");
				var additionalData = new Array();
				var ignoreInputs = ["submit","subject","bbs","key","time","MESSAGE","FROM","mail"];
				for(var [i, input] in Iterator(inputNodes)){
					if(input.type != "hidden") continue;
					if(ignoreInputs.indexOf(input.name) != -1) continue;
					additionalData.push(input.name +"="+ input.value);
				}
				this._listener.onCookieCheck(this, responseData, postStatus);
				this.submit(this._listener, additionalData);
				ChaikaCore.logger.debug("AdditionalData: " + additionalData);
				return;
			}catch(ex){
				ChaikaCore.logger.error(ex);
			}

		}else{
			this._listener.onError(this, responseData, postStatus);
		}

	},


	onHttpDataAvailable: function Post_onHttpDataAvailable(){},


	onHttpError: function Post_onHttpError(aHttpRequest, aStatus){
		this._listener.onError(this, "NETWORK ERROR: " + aStatus.toString(16), this.UNKNOWN);
	},


	_convert: function Post__convert(aStr, aCharset, aConvertHTML4Entity, aEscape){
		var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Ci.nsIScriptableUnicodeConverter);
		var entityConverter = Cc["@mozilla.org/intl/entityconverter;1"]
				.createInstance(Ci.nsIEntityConverter);

		unicodeConverter.charset = aCharset;

		var result = Array.map(aStr, function(aElement, aIndex, aArray){
			var convertCharsetChar = unicodeConverter.ConvertFromUnicode(aElement);
			var redecodeCharsetChar = unicodeConverter.ConvertToUnicode(convertCharsetChar);

			if(aElement == redecodeCharsetChar){ // 文字コード変換に対応している文字
				return aElement;
			}else{ // 文字コード変換に対応していない文字
				if(aConvertHTML4Entity){
					var convertEntityChar = entityConverter.ConvertToEntities(aElement,
								Ci.nsIEntityConverter.html40);
					if(convertEntityChar[0] == "&"){ // 文字実体参照化できる文字
						return convertEntityChar;
					}
				}
					// 文字実体参照にない文字は数値文字参照化
				return "&#" + aElement.charCodeAt(0) + ";"
			}
			return aElement;
		});

		result = result.join("");

		if(aEscape){
			var textToSubURI = Cc["@mozilla.org/intl/texttosuburi;1"]
					.getService(Ci.nsITextToSubURI);
			result = textToSubURI.ConvertAndEscape(aCharset, result);
		}


		return result;
	}

};




function PostJBBS(aThread, aBoard){
	this._thread = aThread;
	this._board = aBoard;
}

PostJBBS.prototype = {

	charset: "euc-jp",

	submit: function PostJBBS_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var postRUISpec = this._thread.plainURL.spec.replace("read.cgi", "write.cgi");
		var postURI = ioService.newURI(postRUISpec, null, null);

		this._httpRequest = new HttpRequest(postURI, this._thread.plainURL, this);


		var postData = [];
		postData.push("submit=" + this._convert("書き込む", this.charset, false, true));
		postData.push("DIR="    + this._board.url.directory.split("/")[1]);
		postData.push("BBS="    + this._board.url.directory.split("/")[2]);
		postData.push("KEY="    + this._thread.datID);
		postData.push("TIME="   + Math.ceil(Date.now() / 1000));
		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("NAME="    + this._convert(this.name, this.charset, false, true));
		postData.push("MAIL="    + this._convert(this.mail, this.charset, false, true));

		if(additionalData){
			postData = postData.concat(additionalData);
		}

		this._httpRequest.post(postData.join("&"));

	}

};
PostJBBS.prototype.__proto__ = Post.prototype;



function PostMachi(aThread, aBoard){
	this._thread = aThread;
	this._board = aBoard;
}

PostMachi.prototype = {

	charset: "Shift_JIS",


	submit: function PostMachi_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var postRUISpec = this._thread.plainURL.spec.replace("read.cgi", "write.cgi");
		var postURI = ioService.newURI("../bbs/write.cgi", null, this._board.url);

		this._httpRequest = new HttpRequest(postURI, this._thread.plainURL, this);


		var postData = [];
		postData.push("submit=" + this._convert("書き込む", this.charset, false, true));
		postData.push("BBS="    + this._board.url.directory.match(/\/([^\/]+)\/?$/)[1]);
		postData.push("KEY="    + this._thread.datID);
		postData.push("TIME="   + Math.ceil(Date.now() / 1000));
		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("NAME="    + this._convert(this.name, this.charset, false, true));
		postData.push("MAIL="    + this._convert(this.mail, this.charset, false, true));

		if(additionalData){
			postData = postData.concat(additionalData);
		}

		this._httpRequest.post(postData.join("&"));

	},


	responseCheck: function Post_responseCheck(aResponseData, aResponseStatus){
		if(aResponseStatus == 302){
			return this.SUCCESS;
		}
		return this.UNKNOWN;

	}

};
PostMachi.prototype.__proto__ = Post.prototype;



function PostP2(aThread, aBoard){
	this._thread = aThread;
	this._board = aBoard;
}

PostP2.prototype = {

	charset: 'Shift_JIS',

	submit: function PostP2_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var postURI = ioService.newURI(ChaikaCore.pref.getChar('login.p2.post_url'), null, null);

		this._httpRequest = new HttpRequest(postURI, null, this);

		//JBBS用に調整
		if(this._board.url.host.indexOf('jbbs.livedoor.jp') > -1){
			var bbs = this._board.url.directory.match(/\/([^\/]+)\/?$/)[1];
			var host = this._board.url.host + '%2F' + this._board.url.directory.match(/\/([^\/]+)\/?/)[1];
		}else{
			var bbs = this._board.url.directory.match(/\/([^\/]+)\/?$/)[1];
			var host = this._board.url.host;
		}

		//csrfidを書き込みページから取得する
		var csrfid = ChaikaP2Login.getCsrfid(host, bbs, this._thread.datID);
		if(!csrfid){
			return this._listener.onError(this, "P2 LOGIN ERROR (Cannot get csrfid)", this.UNKNOWN);
		}

		var postData = [];
		postData.push("bbs="    + bbs);
		postData.push("key="    + this._thread.datID);
		postData.push("time="   + Math.ceil(new Date(this._thread.lastModified).getTime() / 1000));
		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("FROM="    + this._convert(this.name, this.charset, false, true));
		postData.push("mail="    + this._convert(this.mail, this.charset, false, true));
		postData.push("host="    + host);
		postData.push("csrfid="  + csrfid);
		postData.push("detect_hint=%81%9D%81%9E");

		if(ChaikaBeLogin.isLoggedIn()){
			postData.push("submit_beres=" + this._convert("BEで書き込む", this.charset, false, true));
		}else{
			postData.push("submit=" + this._convert("書き込む", this.charset, false, true));
		}

		if(additionalData){
			postData = postData.concat(additionalData);
		}

		this._httpRequest.post(postData.join("&"));
	}
};
PostP2.prototype.__proto__ = Post.prototype;



function Post2chNewThread(aBoard){
	this._thread = null;
	this._board = aBoard;
}


Post2chNewThread.prototype = {
	getErrorMessages: function Post2chNewThread_getErrorMessages(){
		var result = [];


		var convertedTitle = this._convert(this.title, this.charset, true, false);
			// タイトルの未記入チェック
		if(convertedTitle == ""){
			result.push("タイトルが空です");
		}

		var superClassMethod = Post.prototype.getErrorMessages;
		return result.concat(superClassMethod.apply(this));
	},


	getThreadTitle:function Post2chNewThread_getThreadTitle(){
		return this.title;
	},


	submit: function Post2chNewThread_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var postURI = ioService.newURI("../test/bbs.cgi?guid=ON", null, this._board.url);

		this._httpRequest = new HttpRequest(postURI, this._board.url, this);

		var postData = [];
		postData.push("submit=" + this._convert("新規スレッド作成", this.charset, false, true));
		postData.push("bbs="    + this._board.url.directory.match(/\/([^\/]+)\/?$/)[1]);
		postData.push("time="   + (Math.ceil(Date.now() / 1000) - 300)); // 5分前の時間を指定

		postData.push("subject=" + this._convert(this.title, this.charset, false, true));
		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("FROM="    + this._convert(this.name, this.charset, false, true));
		postData.push("mail="    + this._convert(this.mail, this.charset, false, true));

		if(additionalData){
			postData = postData.concat(additionalData);
		}


		if(Chaika2chViewer.logined){
			postData.push("sid=" + encodeURIComponent(Chaika2chViewer.sessionID));
		}
		this._httpRequest.post(postData.join("&"));
	}

};

Post2chNewThread.prototype.__proto__ = Post.prototype;



function PostJBBSNewThread(aBoard){
	this._thread = null;
	this._board = aBoard;
}

PostJBBSNewThread.prototype = {
	charset: "euc-jp",

	submit: function PostJBBSNewThread_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var bbs = this._board.url.directory.match(/\/([^\/]+)\/?$/)[1];
		var dir = this._board.url.directory.match(/\/([^\/]+)\/?/)[1];
		var postURI = ioService.newURI('http://jbbs.livedoor.jp/bbs/write.cgi/'+dir+'/'+bbs+'/new/', null, null);

		this._httpRequest = new HttpRequest(postURI, null, this);

		var postData = [];
		postData.push("BBS="    + bbs);
		postData.push("DIR="    + dir);
		postData.push("TIME="   + (Math.ceil(Date.now() / 1000) - 300));
		postData.push("SUBJECT=" + this._convert(this.title, this.charset, false, true));
		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("NAME="    + this._convert(this.name, this.charset, false, true));
		postData.push("MAIL="    + this._convert(this.mail, this.charset, false, true));
		postData.push("submit=" + this._convert("新規書き込み", this.charset, false, true));

		if(additionalData){
			postData = postData.concat(additionalData);
		}

		ChaikaCore.logger.debug(postData);
		this._httpRequest.post(postData.join("&"));
	}
};
PostJBBSNewThread.prototype.__proto__ = Post2chNewThread.prototype;



function PostNewThreadP2(aBoard){
	this._thread = null;
	this._board = aBoard;
}

PostNewThreadP2.prototype = {
	submit: function PostNewThreadP2_submit(aListener, additionalData){
		this._listener = aListener;
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var postURI = ioService.newURI(ChaikaCore.pref.getChar('login.p2.post_url'), null, null);

		this._httpRequest = new HttpRequest(postURI, null, this);

		//JBBS用に調整
		if(this._board.url.host.indexOf('jbbs.livedoor.jp') > -1){
			var bbs = this._board.url.directory.match(/\/([^\/]+)\/?$/)[1];
			var host = this._board.url.host + '%2F' + this._board.url.directory.match(/\/([^\/]+)\/?/)[1];
		}else{
			var bbs = this._board.url.directory.match(/\/([^\/]+)\/?$/)[1];
			var host = this._board.url.host;
		}

		//csrfidを書き込みページから取得する
		var csrfid = ChaikaP2Login.getCsrfid(host, bbs);
		if(!csrfid){
			return this._listener.onError(this, "P2 LOGIN ERROR (Cannot get csrfid)", this.UNKNOWN);
		}

		var postData = [];
		postData.push("bbs="    + bbs);
		postData.push("time="   + (Math.ceil(Date.now() / 1000) - 300));
		postData.push("subject=" + this._convert(this.title, this.charset, false, true));
		postData.push("MESSAGE=" + this._convert(this.message, this.charset, false, true));
		postData.push("FROM="    + this._convert(this.name, this.charset, false, true));
		postData.push("mail="    + this._convert(this.mail, this.charset, false, true));
		postData.push("host="    + host);
		postData.push("csrfid="  + csrfid);
		postData.push("detect_hint=%81%9D%81%9E");
		postData.push("newthread=1");

		if(ChaikaBeLogin.isLoggedIn()){
			postData.push("submit_beres=" + this._convert("BEで書き込む", this.charset, false, true));
		}else{
			postData.push("submit=" + this._convert("新規スレッド作成", this.charset, false, true));
		}

		if(additionalData){
			postData = postData.concat(additionalData);
		}

		this._httpRequest.post(postData.join("&"));
	}
};
PostNewThreadP2.prototype.__proto__ = Post2chNewThread.prototype;




function HttpRequest(aURL, aReferrer, aListener){
	this.url = aURL;
	this.referrer = aReferrer;
	this.listener = aListener;
}

HttpRequest.prototype = {

	post: function HttpRequest_post(aPostString){
		this._channel = ChaikaCore.getHttpChannel(this.url);

			// リファラの設定
		if(this.referrer){
			this._channel.setRequestHeader("Referer", this.referrer.spec, false);
		}

		this._channel.setRequestHeader("Content-Type",
				"application/x-www-form-urlencoded", false);

			// nsIUploadChannel の準備
		this._channel.QueryInterface(Ci.nsIUploadChannel);

		var strStream = Cc["@mozilla.org/io/string-input-stream;1"]
				.createInstance(Ci.nsIStringInputStream)
				.QueryInterface(Ci.nsISeekableStream);
		var postString = String(aPostString);
		strStream.setData(postString, postString.length);
		this._channel.setUploadStream(strStream, "application/x-www-form-urlencoded", -1);
		this._channel.requestMethod = "POST";
		this._channel.redirectionLimit = 0; // 302 等のリダイレクトを行わない

		try{
			this._channel.asyncOpen(this, this);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			this.listener.onHttpError(this, 0);
		}

	},


	// ********** ********* implements nsIHttpHeaderVisitor ********** **********

	visitHeader: function HttpRequest_(aHeader, aValue){
		this._headers[aHeader] = aValue;
	},


	// ********** ********* implements nsIStreamListener ********** **********

	onStartRequest: function HttpRequest_onStartRequest(aRequest, aContext){
		this._binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
				.createInstance(Ci.nsIBinaryInputStream);
		this._data = [];

		try{
			this.listener.onHttpStart(this);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}
	},


	onDataAvailable: function HttpRequest_onDataAvailable(aRequest, aContext,
											aInputStream, aOffset, aCount){
		aRequest.QueryInterface(Ci.nsIHttpChannel);

		this._binaryStream.setInputStream(aInputStream);
		var availableData = this._binaryStream.readBytes(aCount);
		availableData = availableData.replace(/\x00/g, "*");
		this._data.push(availableData);

		try{
			this.listener.onHttpDataAvailable(this, availableData, aRequest.responseStatus);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}
	},


	onStopRequest: function HttpRequest_onStopRequest(aRequest, aContext, aStatus){
		const NS_ERROR_MODULE_NETWORK      = 2152398848;
		const NS_ERROR_REDIRECT_LOOP       = NS_ERROR_MODULE_NETWORK + 31;

		if(aStatus == 0 || aStatus == NS_ERROR_REDIRECT_LOOP){
			aRequest.QueryInterface(Ci.nsIHttpChannel);

			this._headers = [];
			try{
				aRequest.visitResponseHeaders(this);
				this.listener.onHttpStop(this, this._data.join("\n"), this._headers,
									aRequest.responseStatus, aRequest.requestSucceeded);
			}catch(ex){
				ChaikaCore.logger.error(ex);
				try{
					this.listener.onHttpError(this, aStatus);
				}catch(ex2){
					ChaikaCore.logger.error(ex2);
				}
			}
		}else{
			ChaikaCore.logger.error(aStatus);
			try{
				this.listener.onHttpError(this, aStatus);
			}catch(ex){
				ChaikaCore.logger.error(ex);
			}
		}
		this._channel = null;
	}

};
