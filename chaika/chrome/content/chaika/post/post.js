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

		var bbsUnicode = this._board.getSetting("BBS_UNICODE");
		if(bbsUnicode && bbsUnicode!="pass"){
			if(convertedMessage != this.message){
				result.push("この板では文字化けする可能性のある文字列が含まれています");
			}
		}

		return result;
	},


	getPreview: function Post_getPreview(){
		var preview = {};

		var board = this._board;
		function getSetting(aSettingName){
			return board.getSetting(aSettingName)
		}

		function convertEntity(aStr){
			return aStr.replace("\"", "&quot;", "g")
							.replace("\"", "&quot;", "g")
							.replace("$", "&amp;", "g")
							.replace("<", "&lt;", "g")
							.replace(">", "&gt;", "g");
		}

		preview["title"]   = convertEntity(this._thread.title);
		preview["name"]    = convertEntity(this.name || getSetting("BBS_NONAME_NAME") || "");
		preview["mail"]    = convertEntity(this.mail);
		preview["message"] = convertEntity(this.message).replace("\n", "<br>", "g");

		preview["bgColor"]   = getSetting("BBS_THREAD_COLOR") || "#EFEFEF";
		preview["color"]     = getSetting("BBS_TEXT_COLOR") || "#000000";
		preview["nameColor"] = getSetting("BBS_NAME_COLOR") || "green";

		preview["linkColor"]  = getSetting("BBS_LINK_COLOR");
		preview["alinkColor"] = getSetting("BBS_ALINK_COLOR");
		preview["vlinkColor"] = getSetting("BBS_VLINK_COLOR");

		return preview;
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
	ERROR:       0xFE,
	UNKNOWN:     0xFF,


	responseCheck: function Post_responseCheck(aResponseData, aResponseStatus){
		var statuses = [];
		statuses[this.SUCCESS    ] = ["書きこみました",
		                              "書き込みました",
		                              "書き込み終了",
		                              "書きこみが終わりました"];
		statuses[this.COOKIE     ] = ["クッキー確認"];
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
			this._channel.referrer = this.referrer;
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
