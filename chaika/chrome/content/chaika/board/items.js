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




function Bbs2chBoardItems(aURLSpec){
	this.init(aURLSpec);
}


Bbs2chBoardItems.prototype = {


// ********** ********* プロパティ ********** **********


	get items(){
		return this._items;
	},

	get url(){
		return this._url;
	},


	get subjectURL(){
		return this._subjectURL;
	},


	get subjectFile(){
		return this._subjectFile;
	},

	get settingURL(){
		return this._settingURL;
	},


	get settingFile(){
		return this._settingFile;
	},


	get type(){
		return this._type;
	},


	get validURL(){
		return this._validURL;
	},


	get title(){
		return this.getSetting("BBS_TITLE") || this.url.spec;
	},


	get logoURL(){
		var logoURLSpec = this.getSetting("BBS_TITLE_PICTURE") || "";
		if(!logoURLSpec)
			logoURLSpec = this.getSetting("BBS_FIGUREHEAD") || "";

		if(logoURLSpec){
			try{
					// 相対リンクの解決
				return this._ioService.newURI(logoURLSpec, null, this.url);
			}catch(ex){
				try{
					return this._ioService.newURI(logoURLSpec, null, null);
				}catch(ex2){
					return null;
				}
			}
		}
		return null;
	},


// ********** ********* メソッド ********** **********


	init: function(aURLSpec){
		this._bbs2chService = Cc["@mozilla.org/bbs2ch-service;1"].getService(Ci.nsIBbs2chService);
		this._ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		this._dateFormat = Cc["@mozilla.org/intl/scriptabledateformat;1"]
				.getService(Ci.nsIScriptableDateFormat);

		this._validURL = false;
		try{
			this._url = this._ioService.newURI(aURLSpec, null, null).QueryInterface(Ci.nsIURL);

			this._subjectURL = this._ioService.newURI("subject.txt", null, this.url)
					.QueryInterface(Ci.nsIURL);
			this._subjectFile = this._bbs2chService.getLogFileAtURL(this.subjectURL.spec);

			this._settingURL = this._ioService.newURI("SETTING.TXT", null, this.url)
					.QueryInterface(Ci.nsIURL);
			this._settingFile = this._bbs2chService.getLogFileAtURL(this.settingURL.spec);
		}catch(ex){
			dump("Bbs2chBoardItems.init: " + ex + "\n");
			return;
		}

			// 板のタイプをチェック。TYPE_PAGE は TYPE_2CH にする
		this._type = this._bbs2chService.getBoardType(this.url.spec);
		if(this._type == this._bbs2chService.BOARD_TYPE_PAGE)
					this._type = this._bbs2chService.BOARD_TYPE_2CH;


		this._items = new Array();
		this._validURL = true;
	},


	getSetting: function(aSettingName){
		if(!this._settings){
			this._settings = new Array();
			if(this.settingFile.exists()){
				var fileLineIterator = this._getFileLineIterator(this.settingFile, this._getCharset());
				var regLine = /^(.+)=(.+)$/;
				for(let[i, line] in fileLineIterator){
					if(regLine.test(line)) this._settings[RegExp.$1] = RegExp.$2;
				}
			}
		}
		return this._settings[aSettingName] || null;
	},


	_getFileLineIterator: function(aLocaFile, aCharset){
		const REPLACEMENT_CHARACTER = Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
		var fileInputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
		var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
				.createInstance(Ci.nsIConverterInputStream).QueryInterface(Ci.nsIUnicharLineInputStream);
		fileInputStream.init(aLocaFile, 0x01, 0666, 0);
		converterInputStream.init(fileInputStream, aCharset, 1024, REPLACEMENT_CHARACTER);
		var i=0;
		try{
			while(true){
				var line = {};
				if(converterInputStream.readLine(line)){
					yield [i, line.value];
					i++;
				}else{
					yield [i, line.value];
					break;
				}
			}
		}finally{
			converterInputStream.close();
			fileInputStream.close();
		}
	},

	_getCharset: function(){
		var charset = "Shift_JIS";
		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_MACHI:
				charset = "Shift_JIS";
				break;
			case this._bbs2chService.BOARD_TYPE_BE2CH:
			case this._bbs2chService.BOARD_TYPE_JBBS:
				charset = "euc-jp";
				break;
		}
		return charset;
	},

	/**
	 * Date オブジェクトからフォーマットされた日付文字列(短い形式)を返す
	 */
	_getFormatedDate: function(aDate){
		return this._dateFormat.FormatDate("", this._dateFormat.dateFormatShort,
						aDate.getFullYear(),
						aDate.getMonth() + 1,
						aDate.getDate());
	},


	refresh: function(aFilterLimit, aShowDownedLogs){
		var startTime = new Date().getTime();
		const NS_BBS2CH = this._bbs2chService.nameSpace;

		const STATUS_NEW       = 5;
		const STATUS_UNREAD    = 4;
		const STATUS_SUBSCRIBE = 3;
		const STATUS_NONE      = 2;
		const STATUS_DOWN      = 1;

		this._items = new Array();
		this._lastItems = null;

			// subject.txt が無いときは終了
		if(!this.subjectFile.exists()) return;

			// subject.txt を読み込んで行ごとの配列にする。
		var subjectLines = this._bbs2chService.readFile(this.subjectFile.path);
		subjectLines = this._bbs2chService.fromType(subjectLines, this.type);
		subjectLines = subjectLines.split("\n");

			// 行の解析に使う正規表現
		var regLine;
		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_BE2CH:
				regLine = /^(\d{9,10})\.dat<>(.+) ?\((\d{1,4})\)/;
				break;
			case this._bbs2chService.BOARD_TYPE_JBBS:
			case this._bbs2chService.BOARD_TYPE_MACHI:
				regLine = /^(\d{9,10})\.cgi,(.+) ?\((\d{1,4})\)/;
				break;
		}

			// スレッドの URL
		var baseUrlSpec;
		var categoryPath;
		var threadUrlSpec;
		switch(this.type){
			case this._bbs2chService.BOARD_TYPE_2CH:
			case this._bbs2chService.BOARD_TYPE_BE2CH:
				baseUrlSpec = this.url.resolve("../");
				categoryPath = this.url.spec.substring(baseUrlSpec.length);
				threadUrlSpec = baseUrlSpec + "test/read.cgi/" + categoryPath;
				break;
			case this._bbs2chService.BOARD_TYPE_JBBS:
				baseUrlSpec = this.url.resolve("../../");
				categoryPath = this.url.spec.substring(baseUrlSpec.length);
				threadUrlSpec = baseUrlSpec + "bbs/read.cgi/" + categoryPath;
				break;
			case this._bbs2chService.BOARD_TYPE_MACHI:
				baseUrlSpec = this.url.resolve("../");
				categoryPath = this.url.spec.substring(baseUrlSpec.length);
				threadUrlSpec = baseUrlSpec + "bbs/read.cgi/" + categoryPath;

				break;
		}

		if(aFilterLimit == -1 ) aFilterLimit = subjectLines.length;
		var logItemHash = this.getLogItemHash(threadUrlSpec);

			// ぐるぐる
		for(var i=0; i<subjectLines.length; i++){
			if(!regLine.test(subjectLines[i])) continue;

				// フィルタ
			if(!logItemHash.hasOwnProperty("item-" + RegExp.$1) && aFilterLimit<=i)
					continue;

			var item = {};
			item.datID = RegExp.$1;
			item.id = "item-" + item.datID;
			item.number = i + 1;
			item.title = this.htmlToText(RegExp.$2);
			item.count = Number(RegExp.$3);
			item.read = 0;
			item.unread = 0;
			item.force = this.getThreadForce(item.datID, item.count);
			item.makeDate = this._getFormatedDate(new Date(item.datID * 1000));
			item.url = threadUrlSpec + item.datID + "/";

			if(logItemHash.hasOwnProperty("item-" + item.datID)){
				var logItem = logItemHash["item-" + item.datID];
				var unread = item.count - logItem.read;

				item.read = logItem.read;
				item.unread = (unread > 0) ? unread : 0;

					// ハッシュから削除し、残ったものは DAT 落ちとみなす
				delete logItemHash["item-" + item.datID];
			}

				// ステータス
			item.status = STATUS_NONE;
			if(item.read > 0 && item.count > item.read){
				item.status = STATUS_UNREAD;	// 未読あり
			}else if(item.read > 0){
				item.status = STATUS_SUBSCRIBE;	// 購読中
			}

			this._items.push(item);
		}

		// DAT 落ち
		if(aShowDownedLogs){
			for(i in logItemHash){
				logItemHash[i].status = STATUS_DOWN;
				this._items.push(logItemHash[i]);
			}
		}
	},


	htmlToText: function(aStr){
		if(aStr.indexOf("&") == -1) return aStr;
		var fromStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		fromStr.data = aStr;
		try{
			var toStr = { value: null };
			var	formatConverter = Cc["@mozilla.org/widget/htmlformatconverter;1"]
						.createInstance(Ci.nsIFormatConverter);
			formatConverter.convert("text/html", fromStr, fromStr.toString().length,
										"text/unicode", toStr, {});
		}catch(e){
			return aStr;
		}
		if(toStr.value){
			toStr = toStr.value.QueryInterface(Ci.nsISupportsString);
			return toStr.toString();
		}
		return aStr;
	},

	/**
	 * ログディレクトリ内の .idx を読み込んでログアイテムハッシュを作る
	 */
	getLogItemHash: function(aThreadUrlSpec){
		var resultHash = new Array();
		var cacheFile = this._bbs2chService.getLogFileAtURL(
								this.url.resolve("cache.txt"));
		var cacheUpdated = false;
		var cacheContents = this._bbs2chService.readFileLine(cacheFile.path, {});
		var cacheItemHash = new Array();
		for(var i=0; i<cacheContents.length; i++){
			var cacheLine = this._bbs2chService.fromSJIS(cacheContents[i]);
			cacheLine = cacheLine.split("<>");
			var cacheItem = {};
			cacheItem.datID = cacheLine[0];
			cacheItem.lastModified = cacheLine[1];
			cacheItem.count = parseInt(cacheLine[2]);
			cacheItem.title = this.htmlToText(cacheLine[3]);
			cacheItem.id = "item-" + cacheItem.datID;
			cacheItemHash[cacheItem.id] = cacheItem;
		}
		cacheContents = new Array();

		var regIndexName = /(\d{9,10})\.idx$/i;
		var regTitle = /^title=(.+)/m;
		var regLineCount = /^lineCount=(\d{1,4})/m;

		var logDir = this._bbs2chService.getLogFileAtURL(this.url.spec);
		var entries = logDir.directoryEntries;
		while(entries.hasMoreElements()){
			var file = entries.getNext().QueryInterface(Ci.nsILocalFile);
			if(!regIndexName.test(file.leafName)) continue;
			var datID = RegExp.$1;
			var lastModified = file.lastModifiedTime;

			var logItem = {};
				logItem.datID = datID;
				logItem.id = "item-" + datID;
				logItem.number = -1;
				logItem.unread = 0;
				logItem.force = 0;
				logItem.makeDate = this._getFormatedDate(new Date(logItem.datID * 1000));
				logItem.url = aThreadUrlSpec + logItem.datID + "/";

			if(logItem.id in cacheItemHash &&
								cacheItemHash[logItem.id].lastModified == lastModified){
				logItem.title = cacheItemHash[logItem.id].title;
				logItem.count = cacheItemHash[logItem.id].count;
				logItem.read  = logItem.count;
			}else{
					// 新規or更新 idx ファイルがあるときは読み込む
				cacheUpdated = true;
				var indexContent = this._bbs2chService.readFile(file.path);
				indexContent = this._bbs2chService.fromSJIS(indexContent, this.type);
				logItem.title = regTitle.test(indexContent) ? RegExp.$1 : "";
				logItem.count = regLineCount.test(indexContent) ? parseInt(RegExp.$1) : 0;
				logItem.read  = logItem.count;
			}

			cacheContents.push(datID +"<>"+ lastModified +"<>"+ logItem.count +"<>"+ logItem.title);
			resultHash[logItem.id] = logItem;
		}

		if(cacheUpdated){
			cacheContents = cacheContents.join("\n");
			cacheContents = this._bbs2chService.toSJIS(cacheContents);
			this._bbs2chService.writeFile(cacheFile.path, cacheContents, false);
		}
		return resultHash;
	},


	/**
	 * スレッドの勢いを返す
	 *
	 * @param aDatID number スレッドの ID
	 * @param aCount number 今ままでのレス数
	 * @return number スレッドの平均書き込み数/一日
	 */
	getThreadForce: function(aDatID, aCount){
			// スレッド作成日から現在までのミリ数
		var progress = Date.now() - aDatID * 1000;
			// 86400000 = 一日/ミリ秒 (24 * 60 * 60 * 1000)
		progress = progress / 86400000;

		var force = parseInt((aCount / progress));
		if(isNaN(force)) return 0;
		if(force < 0) return 0;
		return force;
	},


	search: function(aSearchString){
		if(!this._lastItems) this._lastItems = this.items.concat();

		var unicodeNormalizer  = Cc["@mozilla.org/intl/unicodenormalizer;1"]
				.createInstance(Ci.nsIUnicodeNormalizer);
		var normalizedStr = {};

		var searchString = aSearchString.toLowerCase();
		unicodeNormalizer.NormalizeUnicodeNFKC(searchString, normalizedStr);
		searchString = normalizedStr.value;

		var resultItems = new Array();
		for(var i=0; i<this._lastItems.length; i++){
			var title = this._lastItems[i].title.toLowerCase();
			unicodeNormalizer.NormalizeUnicodeNFKC(title, normalizedStr);
			title = normalizedStr.value;
			if(title.indexOf(searchString) != -1)
					resultItems.push(this._lastItems[i]);
		}
		return this._items = resultItems;
	}


}
