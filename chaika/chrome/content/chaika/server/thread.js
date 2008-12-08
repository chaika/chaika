Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");

this.script = {

	start: function(aServerHandler){
		this._bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
					.getService(Components.interfaces.nsIBbs2chService);

		this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);

		aServerHandler.setResponseHeader("Content-Type", "text/html; charset=Shift_JIS");
		aServerHandler.writeResponseHeader(200);

		var threadURL = this.getThreadURL(aServerHandler.requestURL);
		if(!threadURL){
			aServerHandler.write("BAD URL");
			aServerHandler.close();
			return;
		}
		var boardURL = this._bbs2chService.getBoardURL(threadURL.spec);
		var type = this._bbs2chService.getBoardType(threadURL.spec);
			// 板のタイプが、BOARD_TYPE_PAGE でも、
			// URL に /test/read.cgi/ を含んでいたら 2ch互換とみなす
		if(type == this._bbs2chService.BOARD_TYPE_PAGE &&
					threadURL.spec.indexOf("/test/read.cgi/") != -1){
			type = this._bbs2chService.BOARD_TYPE_2CH;
		}


		switch(type){
			case this._bbs2chService.BOARD_TYPE_2CH:
				this.thread = new b2rThread2ch();
				break;
			case this._bbs2chService.BOARD_TYPE_JBBS:
				this.thread = new b2rThreadJbbs();
				break;
			case this._bbs2chService.BOARD_TYPE_MACHI:
				this.thread = new b2rThreadMachi();
				break;
			default:
				this.thread = null;
				break;
		}

		if(this.thread){
			this.thread.init(aServerHandler, threadURL, boardURL, type);
		}else{
			aServerHandler.write("No Supported Boad");
			aServerHandler.close();
		}
	},

	cancel: function(){
		if(this.thread){
			this.thread.close();
			this.thread = null;
		}
	},

	getThreadURL: function(aRequestURL){
		var threadURLSpec = aRequestURL.path.substring(8);
		if(threadURLSpec == "") return null;

		// threadURLSpec = decodeURIComponent(threadURLSpec);

		try{
			var threadURL = this._ioService.newURI(threadURLSpec, null, null)
					.QueryInterface(Components.interfaces.nsIURL);
				// URL が、DAT ID で終わるときは "/" を追加する
			if(threadURL.fileName.match(/^\d{9,10}$/)){
				threadURL = this._ioService.newURI(threadURLSpec + "/", null, null)
						.QueryInterface(Components.interfaces.nsIURL);
			}
			return threadURL;
		}catch(ex){}

		return null;
	}

};


// ***** ***** ***** ***** ***** b2rThread2ch ***** ***** ***** ***** *****
function b2rThread2ch(){
}

b2rThread2ch.prototype = {

	get optionsOnes(){
		return (this.dat.threadURL.fileName.match(/^(\d+)n?$/)) ? parseInt(RegExp.$1) : null;
	},
	get optionsStart(){
		return (this.dat.threadURL.fileName.match(/(\d+)\-/)) ? parseInt(RegExp.$1) : null;
	},
	get optionsLast(){
		return (this.dat.threadURL.fileName.match(/l(\d+)/)) ? parseInt(RegExp.$1) : null;
	},
	get optionsEnd(){
		return (this.dat.threadURL.fileName.match(/\-(\d+)/)) ? parseInt(RegExp.$1) : null;
	},
	get optionsNoFirst(){
		return (this.dat.threadURL.fileName.indexOf("n") != -1);
	},

	init: function(aHandler, aThreadURL, aBoardURL, aType){
		this._handler = aHandler;

		this._bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
					.getService(Components.interfaces.nsIBbs2chService);
		this._aboneManager = Components.classes["@mozilla.org/b2r-abone-manager;1"]
					.getService(Components.interfaces.b2rIAboneManager);

		this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);

		this._chainAboneNumbers = new Array();
		this._enableChainAbone = this._bbs2chService.pref.getBoolPref("extensions.chaika.thread_chain_abone")

			// HTML ヘッダを送信したら true になる
		this._headerResponded = false;
		this._opend = true;
		this.httpChannel = null;

		this.dat = new b2rDat();
		this.dat.init(aThreadURL, aBoardURL, aType);
		if(!this.dat.id){
			this.write("BAD URL");
			this.close();
			return;
		}

		this.converter = new b2rThreadConverter();
		try{
			this.converter.init(this, this.dat.threadURL, this.dat.boardURL, this.dat.type);
		}catch(ex){
			if(ex == Components.results.NS_ERROR_FILE_NOT_FOUND){
				var skinName = this._bbs2chService.pref.getComplexValue(
						"extensions.chaika.thread_skin",
						Components.interfaces.nsISupportsString).data;
				skinName = this._bbs2chService.toSJIS(skinName);
				this.write("スキン ("+ skinName +") の読み込みに失敗したため、");
				this.write("設定をデフォルトスキンに戻しました。<br>ページを更新してください。");
				this.close();
				this._bbs2chService.pref.setCharPref("extensions.chaika.thread_skin", "");
				return;
			}else {
				this.write(ex);
				this.close();
				return;
			}
		}

		/*
		this.write("<!-- \n");
		this.write("Thread URL    : " + this.dat.threadURL.spec + "\n");
		this.write("Board URL     : " + this.dat.boardURL.spec + "\n");
		this.write("Type          : " + this.dat.type + "\n");
		this.write("DAT URL       : " + this.dat.datURL.spec + "\n");
		this.write("DAT ID        : " + this.dat.id + "\n");
		this.write("DAT File      : " + this.dat.datFile.path + "\n");
		this.write("IDX File      : " + this.dat.idxFile.path + "\n");
		this.write("----- ----- -----\n");
		this.write("Title         : " + this.dat.title + "\n");
		this.write("LineCount     : " + this.dat.lineCount + "\n");
		this.write("LastModified  : " + this.dat.lastModified + "\n");
		this.write("----- ----- -----\n");
		this.write("URL Options \n");
		this.write("  Ones        : " + this.optionsOnes + "\n");
		this.write("  Start       : " + this.optionsStart + "\n");
		this.write("  Last        : " + this.optionsLast + "\n");
		this.write("  End         : " + this.optionsEnd + "\n");
		this.write("  NoFirst     : " + this.optionsNoFirst + "\n");
		this.write("-->\n\n");
		*/

		this._logLineCount = 0;
			// 取得済みログの送信
		if(this.dat.datFile.exists()){
			var datLines = this._bbs2chService.readFileLine(this.dat.datFile.path, {});

			this._logLineCount = datLines.length;

			if(this.optionsOnes && this.optionsOnes <= this._logLineCount){
				this._headerResponded = true;
				var header = this.converter.getHeader(this.dat.title);
				this.write(header);
				this.write(this.datLineParse(datLines[this.optionsOnes-1],
								this.optionsOnes, false));
				this.write(this.converter.getFooter("log_pickup_mode"));
				this.close();
				return;

			}else if(this.optionsEnd){
				this._headerResponded = true;
				var header = this.converter.getHeader(this.dat.title);
				this.write(header);

				var start = this.optionsStart ? this.optionsStart : 1;
				if(start < 1) start = 1;
				var end = this.optionsEnd;
				if(end > datLines.length) end = datLines.length;
				if(start > end) start = end;

				for(var i=start-1; i<end; i++){
					this.write(this.datLineParse(datLines[i], i+1, false) +"\n");
				}

				this.write(this.converter.getFooter("log_pickup_mode"));
				this.close();
				return;

			}else{
				if(!this.optionsNoFirst){
					this.write(this.datLineParse(datLines[0], 1, false) +"\n");
				}else if(this.dat.title){
					this._headerResponded = true;
					var header = this.converter.getHeader(this.dat.title);
					this.write(header);
				}else{
					this.write(this.datLineParse(datLines[0], 1, false) +"\n");
				}

				var start = 1;
				var end = datLines.length;
				if(this.optionsLast == 0){
					this.write(this.converter.getNewMark() +"\n");
					this.datDownload();
					return;
				}else if(this.optionsLast){
					start = end - this.optionsLast;
					if(start < 1) start = 1;
				}else if(this.optionsStart){
					start = this.optionsStart - 1;
					if(start > end) start = end;
				}

				var content = new Array();
				for(var i=start; i<end; i++){
					content.push(this.datLineParse(datLines[i], i+1, false));
				}

				this.write(content.join("\n"));
				this.write(this.converter.getNewMark() +"\n");
			}
		}

		if(this.dat.maruGetted){
			this.write(this.converter.getFooter("ok"));
			this.close();
		}

		this._handler.flush();
		this.datDownload();
	},

	write: function(aString){
		this._handler.write(aString);
	},

	close: function(){
		if(this._headerResponded && this.dat){
			var threadID = ChaikaBoard.getBoardID(this.dat.boardURL) + this.dat.id;
			var title = this._bbs2chService.fromSJIS(this.dat.title);
			ChaikaCore.history.visitPage(this.dat.threadPlainURL, threadID, title, 1);
		}
		this._opend = false;
		this._httpChannel = null;
		this._handler.close();
		this._handler = null;
	},


	htmlToText: function(aStr){
		var fromStr = Components.classes["@mozilla.org/supports-string;1"]
									.createInstance(Components.interfaces.nsISupportsString);
		fromStr.data = aStr;
		try{
			var toStr = { value: null };
			var	formatConverter = Components.classes["@mozilla.org/widget/htmlformatconverter;1"]
									.createInstance(Components.interfaces.nsIFormatConverter);
			formatConverter.convert("text/html", fromStr, fromStr.toString().length,
										"text/unicode", toStr, {});
		}catch(e){
			return aStr;
		}
		if(toStr.value){
			toStr = toStr.value.QueryInterface(Components.interfaces.nsISupportsString);
			return toStr.toString();
		}
		return aStr;
	},


	datLineParse: function(aLine, aNumber, aNew){
		if(!aLine) return "";

		var resArray = aLine.split("<>");
		var resNumber = aNumber;
		var resName = "BROKEN";
		var resMail = "";
		var resDate = "BROKEN";
		var resID = "";
		var resBeID = "";
		var resMes	= "";

		if(resArray.length > 3){
			resName = resArray[0].replace(/<\/?b>|/g, "");
			resMail = resArray[1];
			resDate = resArray[2];
			resMes = resArray[3];
		}

		if(resDate.indexOf("<") != -1){
			resDate	= this.htmlToText(resDate);
		}

			// resDate を DATE、BeID に分割
		if(resDate.indexOf("BE:")!=-1 && resDate.match(/(.+)BE:([^ ]+)/)){
			resDate = RegExp.$1;
			resBeID = RegExp.$2;
		}
			// resDate を DATE と ID に分割
		if(resDate.indexOf("ID:")!=-1 && resDate.match(/(.+)ID:(.+)/)){
			resDate = RegExp.$1;
			resID = RegExp.$2;
		}

		/*
			// resDate に IP が含まれている場合は IP を ID として扱う
		if(resDate.match(/(.+)発信元:(.+)/)){
			resDate = RegExp.$1;
			resID = RegExp.$2;
		}
		*/

		if(resBeID){
			var regBeID = /^(\d+)/;
			if(resBeID.match(regBeID)){
				var idInfoUrl = "http://be.2ch.net/test/p.php?i=" + RegExp.$1 +
						"&u=d:" + this.dat.threadURL.resolve("./") + aNumber;
				resBeID = resBeID.replace(regBeID, String("$1").link(idInfoUrl));
			}
		}

		if(this._aboneManager.shouldAbone(resName, resMail, resID, resMes)){
			this._chainAboneNumbers.push(aNumber);
			resName = resMail = resDate = resMes = "ABONE";
			if(aNumber>1 && this._bbs2chService.pref.getBoolPref("extensions.chaika.thread_hide_abone")){
				return "";
			}
		}

			// JSでは "\" が特殊な意味を持つため、数値文字参照に変換
		resName = resName.replace(/([^\x81-\xfc]|^)\x5C/g,"$1&#x5C;");
		resMail = resMail.replace(/([^\x81-\xfc]|^)\x5C/g,"$1&#x5C;");

		var resMailName = resName;
		if(resMail) resMailName = '<a href="mailto:' + resMail + '">' + resName + '</a>';

			// レス番リンク処理 & 連鎖あぼーん
		var regResPointer = /(?:<a .*?>)?(&gt;&gt;|&gt;)([0-9]{1,4})(\-[0-9]{1,4})?(?:<\/a>)?/g;

		var chainAboneNumbers = this._chainAboneNumbers;
		var chainAbone = false;
		resMes = resMes.replace(regResPointer, function(aStr, aP1, aP2, aP3, aOffset, aS){
			chainAbone = chainAbone || (chainAboneNumbers.indexOf(parseInt(aP2)) != -1);
			return '<a href="#res' + aP2 + '" class="resPointer">' + aP1 + aP2 + aP3 + '</a>';
		});
		if(this._enableChainAbone && chainAbone){
			this._chainAboneNumbers.push(aNumber);
			resName = resMail = resDate = resMes = "ABONE";
			if(aNumber>1 && this._bbs2chService.pref.getBoolPref("extensions.chaika.thread_hide_abone")){
				return "";
			}
		}

			// 通常リンク処理
		if(resMes.indexOf("ttp")!=-1){
			var regUrlLink = /(h?ttp)(s)?\:([\-_\.\!\~\*\'\(\)a-zA-Z0-9\;\/\?\:\@\&\=\+\$\,\%\#]+)/g;
			resMes = resMes.replace(regUrlLink, '<a href="http$2:$3" class="outLink">$1$2:$3</a>');
		}

			// レスID
		var regResID = / (ID:)([0-9a-z\+\/]+)/ig;
		resMes = resMes.replace(regResID, ' <span class="resMesID"><span class="mesID_$2">$1$2</span></span>');

			// スレッドのタイトルが見つかったときは HTML ヘッダを追加して送る
		if(!this._headerResponded && resArray[4]){
			this._headerResponded = true;
			this.dat.title = resArray[4];

			var header = this.converter.getHeader(this.dat.title);
			this.write(header);
			this._handler.flush();
		}
		var response = this.converter.getResponse(aNew, aNumber, resName, resMail,
								resMailName, resDate, resID, resBeID, resMes);
		return response;
	},


	datDownload: function(aKako){
		if(aKako){
			if(this._bbs2chService.maruLogined){
				var sid = encodeURIComponent(this._bbs2chService.maruSessionID);
				var datURLSpec = this.dat.threadPlainURL.spec.replace(/\/read\.cgi\//, "/offlaw.cgi/");
				datURLSpec += "?raw=.0&sid=" + sid;
				var datKakoURL = this._ioService.newURI(datURLSpec, null, null)
						.QueryInterface(Components.interfaces.nsIURL);
				this.httpChannel = this._bbs2chService.getHttpChannel(datKakoURL);
				this._maruMode = true;
			}else{
				this.httpChannel = this._bbs2chService.getHttpChannel(this.dat.datKakoURL);
			}
			this._kakoDatDownload = true;

		}else{
			this.httpChannel = this._bbs2chService.getHttpChannel(this.dat.datURL);
			this._kakoDatDownload = false;
		}
		this.httpChannel.requestMethod = "GET";
		this.httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
		this.httpChannel.loadFlags = this.httpChannel.LOAD_BYPASS_CACHE;
		this._aboneChecked = true;
		this._threadAbone = false;

			// 差分GET
		if(this.dat.datFile.exists() && this.dat.lastModified){
			var lastModified = this.dat.lastModified;
			var range = this.dat.datFile.fileSize - 1;
			this.httpChannel.setRequestHeader("Accept-Encoding", "", false);
			this.httpChannel.setRequestHeader("If-Modified-Since", lastModified, false);
			this.httpChannel.setRequestHeader("Range", "bytes=" + range + "-", false);
			this._aboneChecked = false;
		}else{
			this.httpChannel.setRequestHeader("Accept-Encoding", "gzip", false);
		}

		this.httpChannel.asyncOpen(this, null);
	},

	onStartRequest: function(aRequest, aContext){
		this._bInputStream = Components.classes["@mozilla.org/binaryinputstream;1"]
					.createInstance(Components.interfaces.nsIBinaryInputStream);
		this._data = new Array();
		this._datBuffer = "";
	},

	onDataAvailable: function (aRequest, aContext, aInputStream, aOffset, aCount){
		if(!this._opend) return;

		aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);
		var httpStatus = aRequest.responseStatus;
			// 必要な情報がないなら終了
		if(!(httpStatus==200 || httpStatus==206)) return;
		if(aCount == 0) return;

		this._bInputStream.setInputStream(aInputStream);

		var availableData = "";
		if(!this._aboneChecked){
			var firstChar = this._bInputStream.readBytes(1)
			availableData = this._bInputStream.readBytes(aCount - 1);
			if(firstChar.charCodeAt(0) != 10){
				this._threadAbone = true;
			}

		}else{
			availableData = this._bInputStream.readBytes(aCount);
		}
		this._aboneChecked = true;


		if(this._maruMode && this._data.length == 0){
			if(availableData.match(/\n/)){
				availableData = RegExp.rightContext;
			}else{
				return;
			}
		}

			// NULL 文字
		availableData = availableData.replace(/\x00/g, "*");
			// 変換前の DAT を保存しておく
		this._data.push(availableData);

		var availableData = this._datBuffer + availableData;
			// 改行を含まないならバッファに追加して終了
		if(!availableData.match(/\n/)){
			this._datBuffer = availableData;
			return;
		}

			// 取得した DAT を行ごとに配列にし、最後の行をバッファに追加
		var datLines = availableData.split("\n");
		this._datBuffer = (datLines.length>1) ? datLines.pop() : "";

			// DAT を 変換して書き出す
		for(var i=0; i<datLines.length; i++){
			this.dat.lineCount++;
			datLines[i] = this.datLineParse(datLines[i], this.dat.lineCount, true);
		}
		this.write(datLines.join("\n"));
	},

	onStopRequest: function(aRequest, aContext, aStatus){
		if(!this._opend) return;

		this._bInputStream = null;
		aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);
		try{
			var httpStatus = aRequest.responseStatus;
		}catch(ex){
			this.write(this.converter.getFooter("network_error"));
			this.close();
			return;
		}

		try{
			this.dat.lastModified = aRequest.getResponseHeader("Last-Modified");
		}catch(ex){}

		switch(httpStatus){
			case 200: // 通常GET OK
			case 206: // 差分GET OK
				break;
			case 302: // DAT落ち
				if(this._kakoDatDownload){
					this.write(this.converter.getFooter("dat_down"));
					this.close();
				}else{
					this.datDownload(true);
				}
				return;
			case 304: // 未更新
				this.write(this.converter.getFooter("not_modified"));
				this.close();
				return;
			case 416: //あぼーん
				this.write(this.converter.getFooter("abone"));
				this.close();
				return;
			default: // HTTP エラー
				this.write(this.converter.getFooter(httpStatus));
				this.close();
				return;
		}

		if(this._threadAbone){ //あぼーん
			this.write(this.converter.getFooter("abone"));
			this.close();
			return;
		}

			// XXX TODO 一部互換スクリプトには、未更新でも 206 を返すものがある?
		var newResLength = this.dat.lineCount - this._logLineCount;
		if(newResLength == 0){
			this.write(this.converter.getFooter("not_modified"));
			this.close();
			return;
		}

		if(this._datBuffer){
			this.dat.lineCount++;
			this._datBuffer = this.dat.lineCount +"\t: "+ this._datBuffer;
			this.write(this._datBuffer);
			this._datBuffer = "";
		}

		if(httpStatus == 200 || httpStatus == 206){
			this.datSave(this._data.join(""));
		}
		this.write(this.converter.getFooter("ok"));
		this.close();
		this._data = null;
	},

	datSave: function(aDatContent){
				// 書き込みのバッティングを避ける
		var tmpLineCount = 0;
		if(this.dat.idxFile.exists()){
			var idxContent = this._bbs2chService.readFile(this.dat.idxFile.path);
			tmpLineCount = idxContent.match(/^lineCount=(.+)/m) ? parseInt(RegExp.$1) : 0;
		}
		if(this.dat.lineCount > tmpLineCount){
				// .dat の追記書き込み
			this.dat.appendContent(aDatContent);
				// .idx の書き込み
			if(this._maruMode) this.dat.maruGetted = true;
			this.dat.flushIdx();
		}
	}

};


// ***** ***** ***** ***** ***** b2rThreadJbbs ***** ***** ***** ***** *****
function b2rThreadJbbs(){
}

b2rThreadJbbs.prototype = {
	datDownload: function(){
		var datURLSpec = this.dat.threadURL.resolve("./").replace("read.cgi", "rawmode.cgi");
		this._aboneChecked = true;
		this._threadAbone = false;

			// 差分GET
		if(this.dat.datFile.exists() && this.dat.lineCount){
			datURLSpec += (this.dat.lineCount + 1) + "-";
		}

		var datURL = this._ioService.newURI(datURLSpec, null, null)
				.QueryInterface(Components.interfaces.nsIURL);

		this.httpChannel = this._bbs2chService.getHttpChannel(datURL);
		this.httpChannel.requestMethod = "GET";
		this.httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
		this.httpChannel.loadFlags = this.httpChannel.LOAD_BYPASS_CACHE;

		this.httpChannel.asyncOpen(this, null);
	},

	datLineParse: function(aLine, aNumber, aNew){
		if(!aLine) return "";

			// EUC-JP から SJIS へ変換
		var line = this._bbs2chService.fromEUC(aLine);
		line = this._bbs2chService.toSJIS(line);
		var resArray = line.split("<>");
		var resNumber = aNumber;
		var resName = "BROKEN";
		var resMail = "";
		var resDate = "BROKEN";
		var resID = "";
		var resBeID = "";
		var resMes	= "";

		if(resArray.length > 5){
			resName = resArray[1].replace(/<\/?b>|/g, "");
			resMail = resArray[2];
			resDate = resArray[3];
			resMes = resArray[4];
			resID = resArray[6];
		}

		if(this._aboneManager.shouldAbone(resName, resMail, resID, resMes)){
			resName = resMail = resDate = resMes = "ABONE";
			if(aNumber>1 && this._bbs2chService.pref.getBoolPref("extensions.chaika.thread_hide_abone")){
				return "";
			}
		}

			// JSでは "\" が特殊な意味を持つため、数値文字参照に変換
		resName = resName.replace(/([^\x81-\xfc]|^)\x5C/g,"$1&#x5C;");
		resMail = resMail.replace(/([^\x81-\xfc]|^)\x5C/g,"$1&#x5C;");

		var resMailName = resName;
		if(resMail) resMailName = '<a href="mailto:' + resMail + '">' + resName + '</a>';


			// レス番リンク処理 & 連鎖あぼーん
		var regResPointer = /(?:<a .*?>)?(&gt;&gt;|&gt;)([0-9]{1,4})(\-[0-9]{1,4})?(?:<\/a>)?/g;

		var chainAboneNumbers = this._chainAboneNumbers;
		var chainAbone = false;
		resMes = resMes.replace(regResPointer, function(aStr, aP1, aP2, aP3, aOffset, aS){
			chainAbone = chainAbone || (chainAboneNumbers.indexOf(parseInt(aP2)) != -1);
			return '<a href="#res' + aP2 + '" class="resPointer">' + aP1 + aP2 + aP3 + '</a>';
		});
		if(this._enableChainAbone && chainAbone){
			this._chainAboneNumbers.push(aNumber);
			resName = resMail = resDate = resMes = "ABONE";
			if(aNumber>1 && this._bbs2chService.pref.getBoolPref("extensions.chaika.thread_hide_abone")){
				return "";
			}
		}

			// 通常リンク処理
		if(resMes.indexOf("ttp")!=-1){
			var regUrlLink = /(h?ttp)(s)?\:([\-_\.\!\~\*\'\(\)a-zA-Z0-9\;\/\?\:\@\&\=\+\$\,\%\#]+)/g;
			resMes = resMes.replace(regUrlLink, '<a href="http$2:$3" class="outLink">$1$2:$3</a>');
		}

			// スレッドのタイトルが見つかったときは HTML ヘッダを追加して送る
		if(!this._headerResponded && resArray[5]!= ""){
			this._headerResponded = true;
			this.dat.title = resArray[5];

			var header = this.converter.getHeader(this.dat.title);
			this.write(header);
			this._handler.flush();
		}
		var response = this.converter.getResponse(aNew, aNumber, resName, resMail,
								resMailName, resDate, resID, resBeID, resMes);
		return response;
	},

	onStopRequest: function(aRequest, aContext, aStatus){
		if(!this._opend) return;

		aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);
		var httpStatus = aRequest.responseStatus;
		var jbbsError = "";
		try{
			jbbsError = aRequest.getResponseHeader("ERROR");
		}catch(ex){}


		switch(jbbsError){
			case "BBS NOT FOUND":
			case "KEY NOT FOUND":
			case "THREAD NOT FOUND":
				this.write(this.converter.getFooter(999));
				this.close();
				return;
			case "STORAGE IN":
				this.write(this.converter.getFooter("dat_down"));
				this.close();
				return;
		}

		if(this._datBuffer){
			this.dat.lineCount++;
			this._datBuffer = this.dat.lineCount +"\t: "+ this._datBuffer;
			this.write(this._datBuffer);
			this._datBuffer = "";
		}

		if(httpStatus == 200 || httpStatus == 206){
			this.datSave(this._data.join(""));
		}
		this.write(this.converter.getFooter("ok"));
		this.close();
		this._data = null;
	}
};

b2rThreadJbbs.prototype.__proto__ = b2rThread2ch.prototype;


// ***** ***** ***** ***** ***** b2rThreadMachi ***** ***** ***** ***** *****
function b2rThreadMachi(){
}

b2rThreadMachi.prototype = {
	datDownload: function(){
		var datURLSpec = this.dat.threadURL.resolve("./").replace("read.cgi", "offlaw.cgi");
		this._aboneChecked = true;
		this._threadAbone = false;

				// 差分GET
		if(this.dat.datFile.exists() && this.dat.lineCount){
			datURLSpec += (this.dat.lineCount + 1) + "-";
		}
		var datURL = this._ioService.newURI(datURLSpec, null, null)
				.QueryInterface(Components.interfaces.nsIURL);

		this.httpChannel = this._bbs2chService.getHttpChannel(datURL);
		this.httpChannel.requestMethod = "GET";
		this.httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
		this.httpChannel.loadFlags = this.httpChannel.LOAD_BYPASS_CACHE;

		this.httpChannel.asyncOpen(this, null);
	},

	datLineParse: function(aLine, aNumber, aNew){
		var resArray = aLine.split("<>");
		var trueNumber = parseInt(resArray.shift());
		var superClass = b2rThread2ch.prototype.datLineParse;
		return superClass.apply(this, [resArray.join("<>"), trueNumber, aNew]);
 	},


 	datSave: function(aDatContent){
		if(aDatContent){
				// サーバ側透明あぼーんにより DAT 行数と最終レスナンバーが
				// 一致しないことがあるため、行数を最終レスのナンバーから取得
			var lines = aDatContent.split("\n");
			var lastLine = lines.pop(); // 多分空行
			if(!lastLine) lastLine = lines.pop();
			this.dat.lineCount = parseInt(lastLine.match(/^\d+/));
		}
		var superClass = b2rThread2ch.prototype.datSave;
		return superClass.apply(this, arguments);
	}

};

b2rThreadMachi.prototype.__proto__ = b2rThread2ch.prototype;


// ***** ***** ***** ***** ***** b2rDat ***** ***** ***** ***** *****
function b2rDat(){
}

b2rDat.prototype = {
	get threadURL(){
		return this._threadURL;
	},

	get threadPlainURL(){
		if(!this._threadPlainURL){
			var threadPlainSpec = this.threadURL.resolve("./");
			this._threadPlainURL = this._ioService.newURI(threadPlainSpec, null, null)
						.QueryInterface(Components.interfaces.nsIURL);
		}
		return this._threadPlainURL;
	},

	get boardURL(){
		return this._boardURL;
	},

	get datURL(){
		if(!this._datURL){
			if(this.type == this._bbs2chService.BOARD_TYPE_MACHI){
				var datURLSpec = this.threadURL.spec.replace("/read.cgi/", "/offlaw.cgi/") + this.id + "/";
				this._datURL = this._ioService.newURI(datURLSpec, null, null)
						.QueryInterface(Components.interfaces.nsIURL);
			}else{
				var datURLSpec = this.boardURL.resolve("dat/" + this.id + ".dat");
				this._datURL = this._ioService.newURI(datURLSpec, null, null)
						.QueryInterface(Components.interfaces.nsIURL);
			}
		}
		return this._datURL;
	},

	get datKakoURL(){
		if(this.type != this._bbs2chService.BOARD_TYPE_2CH){
			return this.datURL;
		}

		if(!this._datKakoURL){
			var datURLSpec = this.boardURL.resolve("kako/" +
					this.id.substring(0,4) +"/"+ this.id.substring(0,5) +"/" + this.id + ".dat");
			this._datKakoURL = this._ioService.newURI(datURLSpec, null, null)
					.QueryInterface(Components.interfaces.nsIURL);
		}
		return this._datKakoURL;
	},


	get type(){
		return this._type;
	},

	get datFile(){
		return this._datFile;
	},

	get idxFile(){
		return this._idxFile;
	},

	get id(){
		if(!this._id){
			this._id = this.threadURL.directory.match(/\/(\d{9,10})/) ? RegExp.$1 : null;
		}
		return this._id;
	},

	get title(){
		return this._title;
	},
	set title(aValue){
		return this._title = aValue;
	},

	get lineCount(){
		return this._lineCount;
	},
	set lineCount(aValue){
		return this._lineCount = aValue;
	},

	get lastModified(){
		return this._lastModified;
	},
	set lastModified(aValue){
		return this._lastModified = aValue;
	},

	get maruGetted(){
		return this._maruGetted;
	},
	set maruGetted(aValue){
		return this._maruGetted = aValue;
	},


	get queryHash(){
		if(!this._queryHash){
			this._queryHash = new Array();
			var queryArray = this.threadURL.query.split("&");
			for(var i=0; i<queryArray.length; i++){
				var query = queryArray[i].split("=");
				if(query.length == 2) this._queryHash[query[0]] = query[1];
			}
		}
		return this._queryHash;
	},

	init: function(aThreadURL, aBoardURL, aType){
		this._bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
				.getService(Components.interfaces.nsIBbs2chService);
		this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);

		this._threadURL = aThreadURL;

		this._boardURL = (!aBoardURL) ?
				this._bbs2chService.getBoardURL(this.threadURL.spec) : aBoardURL;
		this._type = (isNaN(parseInt(aType))) ?
				this._bbs2chService.getBoardType(this.threadURL.spec) : aType;

			// 板のタイプが、BOARD_TYPE_PAGE でも、
			// URL に /test/read.cgi/ を含んでいたら 2ch互換とみなす
		if(this._type == this._bbs2chService.BOARD_TYPE_PAGE &&
					this._threadURL.spec.indexOf("/test/read.cgi/") != -1){
			this._type = this._bbs2chService.BOARD_TYPE_2CH;
		}

		this._datFile = this._bbs2chService.getLogFileAtURL(
								this.boardURL.resolve(this.id + ".dat"));
		this._idxFile = this._bbs2chService.getLogFileAtURL(
								this.boardURL.resolve(this.id + ".idx"));

			// DAT が無く IDX ファイルのみ存在する場合は、ライン数がずれてしまうので IDX を消す
		if(!this.datFile.exists() && this.idxFile.exists()){
			this.remove();
		}


		this.getThreadData();
/*
			// idx ファイルからタイトル等を取得
		if(this.idxFile.exists()){
			var idxContent =  this._bbs2chService.readFile(this.idxFile.path);

			this._title = idxContent.match(/^title=(.+)/m) ? RegExp.$1 : "";
			this._lineCount = idxContent.match(/^lineCount=(.+)/m) ? Number(RegExp.$1) : 0;
			this._lastModified = idxContent.match(/^lastModified=(.+)/m) ? RegExp.$1 : "";
			this._maruGetted = idxContent.match(/^maruGetted=(.+)/m) ? (RegExp.$1=="true") : false;
		}else{
			this._title = "";
			this._lineCount = 0;
			this._lastModified = "";
			this._maruGetted = false;
		}
*/
	},


	flushIdx: function(){
		this.setThreadData();
/*
		var idxContent = new Array();
		if(this.title) idxContent.push("title=" + this.title);
		if(!isNaN(this.lineCount)) idxContent.push("lineCount=" + this.lineCount);
		if(this.lastModified) idxContent.push("lastModified=" + this.lastModified);
		if(this.maruGetted) idxContent.push("maruGetted=true");
		idxContent = idxContent.join("\n");
		this._bbs2chService.writeFile(this.idxFile.path, idxContent, false);
*/
	},


	getThreadData: function b2rDat_getThreadData(){
		var boardID  = ChaikaBoard.getBoardID(this.boardURL);
		var threadID = boardID + this.id;

		var storage = ChaikaCore.storage;
		storage.beginTransaction();
		try{
			var statement = storage.createStatement(
					"SELECT title, line_count, http_last_modified, maru_getted FROM thread_data WHERE thread_id=?1;");
			statement.bindStringParameter(0, threadID);
			if(statement.executeStep()){
				this._title        = statement.getString(0);
				this._lineCount    = statement.getInt32(1);
				this._lastModified = statement.getString(2);
				this._maruGetted   = Boolean(statement.getInt32(3)==1);
			}else{
				this._title = "";
				this._lineCount = 0;
				this._lastModified = "";
				this._maruGetted = false;
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
			this._title = "";
			this._lineCount = 0;
			this._lastModified = "";
			this._maruGetted = false;
		}finally{
			statement.reset();
			storage.commitTransaction();
		}

	},


	setThreadData: function b2rDat_setThreadData(){
		var boardID  = ChaikaBoard.getBoardID(this.boardURL);
		var threadID = boardID + this.id;
		var title = this._bbs2chService.fromSJIS(this.title);

		var storage = ChaikaCore.storage;
		storage.beginTransaction();
		try{
			var statement = storage.createStatement(
								"SELECT _rowid_ FROM thread_data WHERE thread_id=?1;");
			statement.bindStringParameter(0, threadID);
			var threadRowID = 0;
			if(statement.executeStep()){
				threadRowID = statement.getInt64(0);
			}
			statement.reset();
			if(threadRowID){
				statement = storage.createStatement(
					"UPDATE thread_data SET url=?1, line_count=?2, http_last_modified=?3, maru_getted=?4 WHERE _rowid_=?5;");
				statement.bindStringParameter(0, this.threadURL.spec);
				statement.bindInt32Parameter(1, this.lineCount);
				statement.bindStringParameter(2, this.lastModified);
				statement.bindInt32Parameter(3, this.maruGetted ? 1 : 0);
				statement.bindInt64Parameter(4, threadRowID);
				statement.execute();
			}else{
				statement = storage.createStatement(
				"INSERT INTO thread_data(thread_id, board_id, url, dat_id, title, title_n, line_count, http_last_modified, maru_getted) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9);");
				statement.bindStringParameter(0, threadID);
				statement.bindStringParameter(1, boardID);
				statement.bindStringParameter(2, this.threadURL.spec);
				statement.bindStringParameter(3, this.id);
				statement.bindStringParameter(4, title);
				statement.bindStringParameter(5, "");
				statement.bindInt32Parameter(6, this.lineCount);
				statement.bindStringParameter(7, this.lastModified);
				statement.bindInt32Parameter(8, this.maruGetted ? 1 : 0);
				statement.execute();
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}finally{
			storage.commitTransaction();
		}
	},


	readContent: function(){
		return this._bbs2chService.readFile(this.datFile.path);
	},

	writeContent: function(aContent){
		this._bbs2chService.writeFile(this.datFile.path, aContent, false);
	},

	appendContent: function(aContent){
		this._bbs2chService.writeFile(this.datFile.path, aContent, true);
	},

	remove: function(){
		try{
			if(this.datFile.exists()) this.datFile.remove(false);
			if(this.idxFile.exists()) this.idxFile.remove(false);

			this._title = "";
			this._lineCount = 0;
			this._lastModified = "";
		}catch(ex){}
	}
};


// ***** ***** ***** ***** ***** b2rId2Color ***** ***** ***** ***** *****
/**
 * idから色を返します。
 */
function b2rId2Color(){
}

b2rId2Color.prototype = {
	_char64To8: new Array(),
	_cache: new Array(),
	_bgcache: new Array(),

	init: function(){
		var idChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var i=0;
		for(var m in idChars){
			this._char64To8[idChars[m]]=i
			if(((parseInt(m)+1)%8)==0) i++;
		}
	},

	/**
	 * idからCSSの色を返します。
	 *
	 * @param aID {string} 2chのID
	 * @param aIsBackground {bool} 背景か
	 * @type string
	 * @return CSSの色
	 */
	getColor: function(aID, aIsBackground){
		if(aID.length < 8) return "inherit";

		aID = aID.substring(0,8);
		var cache = (aIsBackground) ? this._bgcache : this._cache;

		if(!(aID in cache)){
			var newint = 0;
			for each(var s in aID){
				newint <<= 3;
				newint |= this._char64To8[s];
			}
			// hsl(0-360,0-100%,0-100%);
			var h = newint%360;
			newint = Math.floor(newint/360);
			var s = newint%100;
			newint = Math.floor(newint/100);
			var l;
			if(aIsBackground)
				l = newint % 20 + 80;
			else
				l = newint%60;
			cache[aID] = "hsl("+ h +","+ s +"%,"+ l +"%)";
		}
		return cache[aID];
	}
}


// ***** ***** ***** ***** ***** b2rThreadConverter ***** ***** ***** ***** *****
function b2rThreadConverter(){
}

b2rThreadConverter.prototype = {

	init: function(aContext, aThreadURL, aBoardURL, aType){
		this._context = aContext;
		this._threadURL = aThreadURL;
		this._boardURL = aBoardURL;
		this._type = aType;

		this._bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
					.getService(Components.interfaces.nsIBbs2chService);
		this._ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);

		this._dd2Color = new b2rId2Color();
		this._dd2Color.init();

		this._tmpHeader   = this._bbs2chService.readFile(this._resolveSkinFile("Header.html").path);
		this._tmpFooter   = this._bbs2chService.readFile(this._resolveSkinFile("Footer.html").path);
		this._tmpRes	  = this._bbs2chService.readFile(this._resolveSkinFile("Res.html").path);
		this._tmpNewRes	  = this._bbs2chService.readFile(this._resolveSkinFile("NewRes.html").path);
		this._tmpNewMark  = this._bbs2chService.readFile(this._resolveSkinFile("NewMark.html").path);

		if(this._tmpHeader===null || this._tmpFooter===null || this._tmpRes===null || this._tmpNewRes===null || this._tmpNewMark===null){
			throw Components.results.NS_ERROR_FILE_NOT_FOUND
		}

			// 基本スキンタグの置換
		this._tmpHeader = this._replaceBaseTag(this._tmpHeader);
		this._tmpFooter = this._replaceBaseTag(this._tmpFooter);
		this._tmpRes = this._replaceBaseTag(this._tmpRes);
		this._tmpNewRes = this._replaceBaseTag(this._tmpNewRes);
		this._tmpNewMark = this._replaceBaseTag(this._tmpNewMark);

		this._tmpGetRes = this.toFunction(this._tmpRes);
		this._tmpGetNewRes = this.toFunction(this._tmpNewRes);

				// 旧仕様の互換性確保
		if(!this._tmpFooter.match(/<STATUS\/>/)){
			this._tmpFooter = '<p class="info"><STATUS/></p>\n' + this._tmpFooter;
		}
	},

	_resolveSkinFile: function(aFilePath){
		var skinName = this._bbs2chService.pref.getComplexValue("extensions.chaika.thread_skin",
							Components.interfaces.nsISupportsString).data;

		var skinFile = null;
		if(skinName){
			skinFile = this._bbs2chService.getDataDir();
			skinFile.appendRelativePath("skin");
			skinFile.appendRelativePath(skinName);
		}else{
			var bbs2chreaderID = "chaika@chaika.xrea.jp";
			var extensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
					.getService(Components.interfaces.nsIExtensionManager);
			var installLocation = extensionManager.getInstallLocation(bbs2chreaderID);
			skinFile = installLocation.getItemFile(bbs2chreaderID, "defaults/skin").clone()
							.QueryInterface(Components.interfaces.nsILocalFile);
		}
		skinFile.appendRelativePath(aFilePath);
		return skinFile;
	},

	/**
	 * 基本スキンタグの置換
	 * @param aString string 置換される文字列
	 */
	_replaceBaseTag: function(aString){
		var requestURL = this._context._handler.requestURL;
		var threadURLSpec = requestURL.path.substring(8);
		var skinURISpec = this._bbs2chService.serverURL.resolve("./skin/");
		var serverURLSpec = this._bbs2chService.serverURL.resolve("./thread/");
		var fontName = this._bbs2chService.pref.getComplexValue(
							"extensions.chaika.thread_font_name",
							Components.interfaces.nsISupportsString).data;
		fontName = this._bbs2chService.toSJIS(fontName);
		var fontSize = this._bbs2chService.pref.getIntPref(
							"extensions.chaika.thread_font_size");
		var aaFontName = this._bbs2chService.pref.getComplexValue(
							"extensions.chaika.thread_aa_font_name",
							Components.interfaces.nsISupportsString).data;
		aaFontName = this._bbs2chService.toSJIS(aaFontName);
		var aaFontSize = this._bbs2chService.pref.getIntPref(
							"extensions.chaika.thread_aa_font_size");

		return aString.replace(/<SKINPATH\/>/g, skinURISpec)
				.replace(/<THREADURL\/>/g, this._threadURL.resolve("./"))
				.replace(/<BOARDURL\/>/g, this._boardURL.spec)
				.replace(/<SERVERURL\/>/g, serverURLSpec)
				.replace(/<FONTNAME\/>/g, "\'" + fontName + "\'")
				.replace(/<FONTSIZE\/>/g, fontSize + "px")
				.replace(/<AAFONTNAME\/>/g, "\'" + aaFontName + "\'")
				.replace(/<AAFONTSIZE\/>/g, aaFontSize + "px");
	},

	getHeader: function(aTitle){
		return this._tmpHeader.replace(/<THREADNAME\/>/g, aTitle);
	},

	getFooter: function(aStatusText){
		var datSize = 0;
		var datSizeKB = 0;
		var datFile = this._context.dat.datFile.clone();
		if(datFile.exists()){
			datSize = datFile.fileSize;
			datSizeKB = Math.round(datSize / 1024);
		}
		var logLineCount = this._context._logLineCount;
		var lineCount = this._context.dat.lineCount;

		return this._tmpFooter.replace(/<STATUS\/>/g, this.getStatusText(aStatusText))
					.replace(/<SIZE\/>/g, datSize)
					.replace(/<SIZEKB\/>/g, datSizeKB)
					.replace(/<GETRESCOUNT\/>/g, logLineCount)
					.replace(/<NEWRESCOUNT\/>/g, lineCount - logLineCount)
					.replace(/<ALLRESCOUNT\/>/g, lineCount);
	},

	getStatusText: function(aStatus){
	    var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                      .getService(Components.interfaces.nsIStringBundleService);
		var statusBundle = strBundleService.createBundle(
								"chrome://chaika/content/server/thread-status.properties");
		var statusText = "";
		if(typeof(aStatus) == "string"){
			try{
				statusText = statusBundle.GetStringFromName(aStatus);
			}catch(ex){}
		}else{
			try{
				statusText = statusBundle.formatStringFromName("error", [String(aStatus)], 1);
			}catch(ex){}
		}
		return this._bbs2chService.toSJIS(statusText);
	},

	getNewMark: function(){
		return this._tmpNewMark;
	},

	toFunction: function(aRes){
		return eval(
			"function(aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage){return \""+aRes
				.replace(/\\/g,"\\\\").replace(/\"/g,"\\\"")
				.replace(/(\r|\n|\t)/g,"").replace(/<!--.*?-->/g,"")
				.replace(/<PLAINNUMBER\/>/g, "\"+aNumber+\"")
				.replace(/<NUMBER\/>/g, "\"+aNumber+\"")
				.replace(/<NAME\/>/g, "\"+aName+\"")
				.replace(/<MAIL\/>/g, "\"+aMail+\"")
				.replace(/<MAILNAME\/>/g, "\"+aMailName+\"")
				.replace(/<DATE\/>/g, "\"+aDate+\"")
				.replace(/<ID\/>/g, "\"+aID+\"")
				.replace(/<IDCOLOR\/>/g, "\"+resIDColor+\"")
				.replace(/<IDBACKGROUNDCOLOR\/>/g, "\"+resIDBgColor+\"")
				.replace(/<BEID\/>/g, "\"+aBeID+\"")
				.replace(/<MESSAGE\/>/g, "\"+aMessage+\"")+"\";}"
		);
	},

	getResponse: function(aNew, aNumber, aName, aMail, aMailName, aDate, aID, aBeID, aMessage){
		var template = aNew ? this._tmpNewRes : this._tmpRes;
		if(!template.match(/<ID\/>/))
			aDate = aDate + " ID:" + aID;
		if(!template.match(/<BEID\/>/))
			aDate = aDate + " Be:" + aBeID;

		var resIDColor = (template.search(/<IDCOLOR\/>/) != -1) ?
				this._dd2Color.getColor(aID, false) : "inherit";
		var resIDBgColor = (template.search(/<IDBACKGROUNDCOLOR\/>/) != -1) ?
				this._dd2Color.getColor(aID, true) : "inherit";

		if(this.isAA(aMessage)){
			aMessage = '<span class="aaRes">' + aMessage + '</span>';
		}

		var result;
		if(aNew){
			result = this._tmpGetNewRes(aNumber, aName, aMail, aMailName, aDate, aID,
						resIDColor, resIDBgColor,aBeID, aMessage);
		}else{
			result = this._tmpGetRes(aNumber, aName, aMail, aMailName, aDate, aID,
						resIDColor, resIDBgColor,aBeID, aMessage);
		}
		return result;
	},

	isAA: function(aMessage) {
		var lineCount = aMessage.match(/<br>/g);
		if(lineCount && lineCount.length >= 3){
			var spaceCount = aMessage.match(/[ 　\.:i\|]/g);
			if(spaceCount && (spaceCount.length / aMessage.length) >= 0.3){
				return true;
			}
		}
		return false;
	}

};
