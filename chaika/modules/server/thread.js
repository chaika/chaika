/* See license.txt for terms of usage */

EXPORTED_SYMBOLS = ["ThreadServerScript"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaServer.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaThread.js");
Components.utils.import("resource://chaika-modules/ChaikaLogin.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");
Components.utils.import("resource://chaika-modules/ChaikaContentReplacer.js");
Components.utils.import("resource://chaika-modules/ChaikaHttpController.js");
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/**
 * Polyfill for Firefox 39-
 */
if(!String.prototype.includes){
    String.prototype.includes = function(){'use strict';
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}


function ThreadServerScript(){
}

ThreadServerScript.prototype  = {

    start: function(aServerHandler){
        aServerHandler.response.setHeader("Content-Type", "text/html; charset=Shift_JIS");
        aServerHandler.response.writeHeaders(200);

        var threadURL = this.getThreadURL(aServerHandler.request.url);
        if(!threadURL){
            aServerHandler.response.write("INVALID URL");
            aServerHandler.close();
            return;
        }
        var boardURL = ChaikaThread.getBoardURL(threadURL);
        var type = ChaikaBoard.getBoardType(threadURL);

        // 板のタイプが、BOARD_TYPE_PAGE でも、
        // URL に /test/read.cgi/ を含んでいたら 2ch互換とみなす
        if(type === ChaikaBoard.BOARD_TYPE_PAGE && threadURL.spec.includes("/test/read.cgi/")){
            type = ChaikaBoard.BOARD_TYPE_2CH;
        }


        switch(type){
            case ChaikaBoard.BOARD_TYPE_2CH:
                this.thread = new Thread2ch();
                break;
            case ChaikaBoard.BOARD_TYPE_JBBS:
                this.thread = new ThreadJbbs();
                break;
            case ChaikaBoard.BOARD_TYPE_MACHI:
                this.thread = new ThreadMachi();
                break;
            default:
                this.thread = null;
                break;
        }

        if(this.thread){
            this.thread.init(aServerHandler, threadURL, boardURL, type);
        }else{
            aServerHandler.response.write("No Supported Boad");
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
        if(threadURLSpec === "") return null;

        // threadURLSpec = decodeURIComponent(threadURLSpec);
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        try{
            var threadURL = ioService.newURI(threadURLSpec, null, null).QueryInterface(Ci.nsIURL);
                // URL が、DAT ID で終わるときは "/" を追加する
            if(/^\d{9,10}$/.test(threadURL.fileName)){
                threadURL = ioService.newURI(threadURLSpec + "/", null, null)
                        .QueryInterface(Ci.nsIURL);
            }
            return threadURL;
        }catch(ex){}

        return null;
    }

};


var UniConverter = {

    _unicodeConverter: Cc["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Ci.nsIScriptableUnicodeConverter),

    toSJIS: function uniConverter_toSJIS(aString){
        this._unicodeConverter.charset = "Shift_JIS";
        return this._unicodeConverter.ConvertFromUnicode(aString);
    },

    fromSJIS: function uniConverter_fromSJIS(aString){
        this._unicodeConverter.charset = "Shift_JIS";
        return this._unicodeConverter.ConvertToUnicode(aString);
    },

    toEUC: function uniConverter_toEUC(aString){
        this._unicodeConverter.charset = "EUC-JP";
        return this._unicodeConverter.ConvertFromUnicode(aString);
    },

    fromEUC: function uniConverter_fromEUC(aString){
        this._unicodeConverter.charset = "EUC-JP";
        return this._unicodeConverter.ConvertToUnicode(aString);
    }

};


// ***** ***** ***** ***** ***** Thread2ch ***** ***** ***** ***** *****
function Thread2ch(){
}

Thread2ch.prototype = {

    get optionsOnes(){
        return (this.thread.url.fileName.match(/^(\d+)n?$/)) ? parseInt(RegExp.$1) : null;
    },
    get optionsStart(){
        return (this.thread.url.fileName.match(/(\d+)\-/)) ? parseInt(RegExp.$1) : null;
    },
    get optionsLast(){
        return (this.thread.url.fileName.match(/l(\d+)/)) ? parseInt(RegExp.$1) : null;
    },
    get optionsEnd(){
        return (this.thread.url.fileName.match(/\-(\d+)/)) ? parseInt(RegExp.$1) : null;
    },
    get optionsNoFirst(){
        return this.thread.url.fileName.includes("n");
    },

    init: function(aHandler, aThreadURL, aBoardURL, aType){
        this._handler = aHandler;
        this._parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
        this._serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);
        this._parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);

        this._chainAboneNumbers = [];
        this._chainHideAboneNumbers = [];

        this._disableAbone = aThreadURL.query.includes('chaika_disable_abone=1');
        this._enableChainAbone = !this._disableAbone && ChaikaCore.pref.getBool("thread_chain_abone");
        this._enableHideAbone = !this._disableAbone && ChaikaCore.pref.getBool('thread_hide_abone');
        this._showBeIcon = ChaikaCore.pref.getBool("thread_show_be_icon");

        // HTML ヘッダを送信したら true になる
        this._headerResponded = false;
        this._opened = true;
        this.httpChannel = null;

        try{
            this.thread = new ChaikaThread(aThreadURL);
        }catch(ex){
            ChaikaCore.logger.error(ex);
            this.write("BAD URL");
            this.close();
            return;
        }

        this.converter = new ThreadConverter();
        try{
            this.converter.init(this, this.thread.url, this.thread.boardURL, this.thread.type);
        }catch(ex){
            if(ex == Components.results.NS_ERROR_FILE_NOT_FOUND){
                var skinName = ChaikaCore.pref.getUniChar("thread_skin");

                var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"]
                        .getService(Ci.nsIStringBundleService);
                var statusBundle = strBundleService.createBundle(
                        "resource://chaika-modules/server/thread-status.properties");
                var skinLoadErrorString = statusBundle.formatStringFromName(
                        "skin_load_error", [skinName], 1);
                skinLoadErrorString = UniConverter.toSJIS(skinLoadErrorString);
                this.write(skinLoadErrorString);
                this.close();
                ChaikaCore.pref.setChar("thread_skin", "");
                return;
            }else {
                this.write(ex);
                this.close();
                return;
            }
        }

        /*
        this.write("<!-- \n");
        this.write("URL Options \n");
        this.write("  Ones        : " + this.optionsOnes + "\n");
        this.write("  Start       : " + this.optionsStart + "\n");
        this.write("  Last        : " + this.optionsLast + "\n");
        this.write("  End         : " + this.optionsEnd + "\n");
        this.write("  NoFirst     : " + this.optionsNoFirst + "\n");
        this.write("-->\n\n");
        */

        //取得済みログの件数
        this._logLineCount = 0;

        //ダウンロードしたログの範囲で、すでに取得済みのログの件数
        this._readLogCount = 0;

        // 取得済みログの送信
        if(this.thread.datFile.exists()){
            let datLines = ChaikaCore.io.readData(this.thread.datFile).split("\n");
            datLines.pop();

            this._logLineCount = datLines.length;
            this._readLogCount = this._logLineCount;

            //単レス指定
            if(this.optionsOnes && this.optionsOnes <= this._logLineCount){
                this._headerResponded = true;

                let title = UniConverter.toSJIS(ChaikaCore.io.escapeHTML(this.thread.title));
                let header = this.converter.getHeader(title);
                this.write(header);
                this.write(this.datLineParse(datLines[this.optionsOnes-1],
                                this.optionsOnes, false));
                this.write(this.converter.getFooter("log_pickup_mode"));
                this.close();
                return;

            //レス範囲指定
            }else if(this.optionsEnd  && this.optionsEnd <= this._logLineCount){
                this._headerResponded = true;

                let title = UniConverter.toSJIS(ChaikaCore.io.escapeHTML(this.thread.title));
                let header = this.converter.getHeader(title);
                this.write(header);

                let start = this.optionsStart ? this.optionsStart : 1;
                let end = this.optionsEnd;

                if(start < 1) start = 1;
                if(end > datLines.length) end = datLines.length;
                if(start > end) start = end;

                let content = "";
                for(let i=start-1; i<end; i++){
                    content += ( this.datLineParse(datLines[i], i+1, false) + '\n' );
                }
                this.write(content);


                this.write(this.converter.getFooter("log_pickup_mode"));
                this.close();
                return;

            }else{
                if(!this.optionsNoFirst){
                    this.write(this.datLineParse(datLines[0], 1, false) +"\n");
                }else if(this.thread.title){
                    this._headerResponded = true;

                    let title = UniConverter.toSJIS(ChaikaCore.io.escapeHTML(this.thread.title));
                    let header = this.converter.getHeader(title);
                    this.write(header);
                }else{
                    this.write(this.datLineParse(datLines[0], 1, false) +"\n");
                }

                let start = 1;
                let end = datLines.length;

                if(this.optionsLast === 0){
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

                let content = "";
                for(let i=start; i<end; i++){
                    content += ( this.datLineParse(datLines[i], i+1, false) + '\n' );
                }

                this.write(content);
                this.write(this.converter.getNewMark() +"\n");
            }
        }

        if(this.thread.maruGetted){
            this.write(this.converter.getFooter("ok"));
            this.close();
        }

        this._handler.response.flush();
        this.datDownload();
    },

    write: function(aString){
        this._handler.response.write(aString);
    },

    close: function(){
        if(this._headerResponded && this.thread){
            ChaikaCore.history.visitPage(this.thread.plainURL,
                    this.thread.threadID, this.thread.title, 1);
        }
        this._opened = false;
        this._httpChannel = null;
        this._handler.close();
        this._handler = null;
    },


    htmlToText: function(aStr){
        var fmtConverter = Cc["@mozilla.org/widget/htmlformatconverter;1"].createInstance(Ci.nsIFormatConverter);
        var fromStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        var toStr = { value: null };

        try{
            fromStr.data = aStr;
            fmtConverter.convert("text/html", fromStr, fromStr.toString().length, "text/unicode", toStr, {});
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
     * HTMLタグをサニタイズする
     * @param {String} aStr HTML string
     * @return {String} sanitized HTML string
     */
    sanitizeHTML: function(aStr){
        //実体参照を保護する
        aStr = aStr.replace(/&#/g, "_&#_")  // &#169; など
                   .replace(/&([a-zA-Z0-9]+?);/g, '_&_$1;');  // &copy; など

        //sanitize
        var doc = this._parser.parseFromString("<html><body></body></html>", 'text/html');
        var fragment = this._parserUtils.parseFragment(aStr, 0, false, null, doc.documentElement);
        var sanitizedStr = this._serializer.serializeToString(fragment);

        //serializeで余計に挿入されるxmlns属性を削除
        sanitizedStr = sanitizedStr.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');

        //実体参照を元に戻す
        sanitizedStr = sanitizedStr.replace(/_&amp;#_/g, "&#")
                                   .replace(/_&amp;_([a-zA-Z0-9]+?);/g, '&$1;');

        // <br /> をもとに戻す
        sanitizedStr = sanitizedStr.replace(/<br \/>/g, '<br>');

        return sanitizedStr;
    },


    datLineParse: function(aLine, aNumber, aNew){
        if(!aLine) return "";

        var resArray = aLine.split("<>");
        var resNumber = aNumber;
        var resName = "BROKEN";
        var resMail = "";
        var resDate = "BROKEN";
        var resID = "";
        var resBeID = '';
        var resBeBaseID = '';
        var resBeLink = "";
        var resIP = "";
        var resHost = "";
        var resMes = "";
        var threadTitle = "";
        var isAbone = false;
        var ngData = '';  // あぼーんされる原因となったNGデータ


        if(resArray.length > 3){
            resName = resArray[0]; //.replace(/<\/?b>|/g, "");
            resMail = resArray[1];
            resDate = resArray[2];
            resMes = resArray[3];
            threadTitle = resArray[4];
        }


        // スレッドのタイトルが見つかったときは HTML ヘッダを追加して送る
        if(!this._headerResponded && threadTitle){
            this._headerResponded = true;

            // 一旦 ChaikaThread を通して ChaikaContentReplacer を反映させる
            this.thread.title = UniConverter.fromSJIS(threadTitle);

            let header = this.converter.getHeader(UniConverter.toSJIS(this.thread.title));
            this.write(header);
            this._handler.response.flush();
        }


        //特殊な名前欄の置換
        resName = resName.replace(/<\/b>/g, '<span class="resSystem">')
                            .replace(/<b>/g, "</span>");

        //日付中のHTMLを除去
        if(resDate.includes("<")){
            resDate = this.htmlToText(resDate);
        }

        //sanitize HTML special characters
        //掲示板側でサニタイズ済みなため本来は不要だが、
        //AMOの指摘に基づきより安全性を高めることにする
        resName = this.sanitizeHTML(resName);
        resMail = this.sanitizeHTML(resMail);
        resMes = this.sanitizeHTML(resMes);


        // resDate を DATE と BeID に分割
        if(resDate.includes('BE:') && resDate.match(/(.+)BE:([^ ]+)/)){
            resDate = RegExp.$1;
            resBeLink = RegExp.$2;
        }

        // resDate を DATE と 発信元 に分割
        // \x94\xad \x90\x4d \x8c\xb3 = 発信元
        if(resDate.includes('\x94\xad\x90\x4d\x8c\xb3:') &&
           resDate.match(/(.+)\x94\xad\x90\x4d\x8c\xb3:([\d\.]+)/)){
            resDate = RegExp.$1;
            resIP = RegExp.$2;
        }

        // resDate を DATE と HOST に分割
        if(resDate.includes('HOST:') && resDate.match(/(.+)HOST:([^ ]+)/)){
            resDate = RegExp.$1;
            resHost = RegExp.$2;
        }

        // resDate を DATE と ID に分割
        if(resDate.includes('ID:') && resDate.match(/(.+)ID:([^ ]+)/)){
            resDate = RegExp.$1;
            resID = RegExp.$2;
        }

        // resDate の末尾に空白が残ってしまう問題へ対処する
        resDate = resDate.trim();


        if(resBeLink){
            // 2ch Be の不具合により BeID が数値でなくなる場合があるので,
            // 正規表現にマッチしない可能性も考慮する必要がある
            resBeID = resBeLink.match(/^\d+/) || '';

            if(resBeID){
                resBeID = resBeID[0];

                //BeIDのリンク処理
                resBeLink = "<a href='http://be.2ch.net/test/p.php?i=" + resBeID + "'>" + resBeLink + '</a>';

                // Be基礎番号を取得
                // refs http://qb5.2ch.net/test/read.cgi/operate/1296265910/569
                // let centesimalBeNumber = Math.floor(resBeID / 100);
                // let deciBeNumber = Math.floor(resBeID / 10);
                // resBeBaseID = ( centesimalBeNumber + deciBeNumber % 10 - resBeID % 10 - 5 ) /
                //                                ( (deciBeNumber % 10) * (resBeID % 10) * 3 );
                //
                // Be 2.0 では基礎番号は廃止されたので、BeID をそのまま用いることにする
                // http://qb5.2ch.net/test/read.cgi/operate/1396689383/50
                resBeBaseID = resBeID;
            }
        }


        //あぼーん処理
        if(!this._disableAbone){
            let aboneResult = ChaikaAboneManager.shouldAbone({
                name: UniConverter.fromSJIS(resName),
                mail: UniConverter.fromSJIS(resMail),
                id: resID,
                msg: UniConverter.fromSJIS(resMes),
                date: resDate,
                ip: resIP,
                host: resHost,
                be: resBeID + '',
                baseBe: resBeBaseID + '',
                title: this.thread.title,
                thread_url: this.thread.plainURL.spec,
                board_url: this.thread.boardURL.spec,
                isThread: false
            });

            if(aboneResult){
                let enableChain = aboneResult.chain === true ||
                                  aboneResult.chain === undefined && this._enableChainAbone;
                let enableHide = aboneResult.hide === true ||
                                 aboneResult.hide === undefined && this._enableHideAbone;

                isAbone = true;
                ngData = aboneResult;

                //連鎖あぼーん (親)
                if(enableChain){
                    this._chainAboneNumbers.push(resNumber);

                    if(enableHide){
                        this._chainHideAboneNumbers.push(resNumber);
                    }
                }

                //自動NGID
                if(aboneResult.autoNGID && resID && !resID.startsWith('???')){
                    let now = new Date();
                    let expire = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

                    ChaikaAboneManager.ex.add({
                        title: 'NGID: ' + resID + ' (Auto NGID: ' + this.thread.title + ' >>' + resNumber + ')',
                        target: 'post',
                        match: 'all',
                        expire: expire.getTime(),
                        rules: [{
                            target: 'id',
                            query: resID,
                            condition: 'equals'
                        }]
                    });
                }

                //透明あぼーん
                if(enableHide){
                    return '';
                }
            }
        }


        //ユーザー定義の置換
        let replacedResData = ChaikaContentReplacer.replace({
            name: UniConverter.fromSJIS(resName),
            mail: UniConverter.fromSJIS(resMail),
            id: resID,
            msg: UniConverter.fromSJIS(resMes),
            date: UniConverter.fromSJIS(resDate),
            ip: resIP,
            host: resHost,
            be: resBeID + '',
            baseBe: resBeBaseID + '',
            title: this.thread.title,
            thread_url: this.thread.plainURL.spec,
            board_url: this.thread.boardURL.spec,
            isThreadList: false,
            isSubjectTxt: false
        });

        if(replacedResData){
            [
                resName,
                resMail,
                resDate,
                resIP,
                resHost,
                resMes,
                resID
            ] = [
                UniConverter.toSJIS(replacedResData.name),
                UniConverter.toSJIS(replacedResData.mail),
                UniConverter.toSJIS(replacedResData.date),
                UniConverter.toSJIS(replacedResData.ip),
                UniConverter.toSJIS(replacedResData.host),
                UniConverter.toSJIS(replacedResData.msg),
                UniConverter.toSJIS(replacedResData.id),
            ];
        }


        // JSでは "\" が特殊な意味を持つため、数値文字参照に変換
        resName = resName.replace(/([^\x81-\xfc]|^)\x5C/g,"$1&#x5C;");
        resMail = resMail.replace(/([^\x81-\xfc]|^)\x5C/g,"$1&#x5C;");

        //メール欄
        var resMailName = resName;
        if(resMail) resMailName = '<a href="mailto:' + resMail + '">' + resName + '</a>';

        // レス番リンク処理 & 連鎖あぼーんの判定
        // \x81\x84 = ＞
        var regResPointer = /(?:<a.*?>)?((?:&gt;|\x81\x84){1,2})((?:\d{1,4}\s*(?:<\/a>|,|\-)*\s*)+)/g;
        var fixInvalidAnchor = ChaikaCore.pref.getBool('thread_fix_invalid_anchor');
        var shouldChainAbone = false;
        var shouldChainHideAbone = false;
        var chainAboneParent;
        resMes = resMes.replace(regResPointer, (aStr, ancMark, ancBody) => {
            let enableChainAbone = this._chainAboneNumbers.length > 0;
            let ancNums = [];

            //アンカーの詳細解析を行う
            if(enableChainAbone || fixInvalidAnchor){
                //アンカー番号解析
                //アンカー番号の配列に落としこむ: >>1-3,5 -> [[1,2,3],5]
                //最大500個に制限する
                ancBody.replace(/(?:\s+|<\/a>)/g, '').split(',').forEach((ancNumRange) => {
                    if(ancNumRange && !isNaN(ancNumRange)){
                        //範囲指定がないとき
                        if(ancNums.length < 500){
                            ancNums.push(parseInt(ancNumRange));
                        }
                    }else{
                        //範囲指定があるとき
                        let [ancStart, ancEnd] = ancNumRange.split('-');
                        ancStart = parseInt(ancStart);
                        ancEnd = parseInt(ancEnd);

                        if(ancStart > ancEnd){
                            [ancStart, ancEnd] = [ancEnd, ancStart];
                        }


                        if(0 < ancStart && 0 < ancEnd && ancNums.length < 500){
                            //最大の範囲を500に制限する
                            if((ancEnd - ancStart + 1) > 500){
                                ancEnd = ancStart + 499;
                            }

                            //配列に落としこむ
                            let rangeArray = [];
                            for(let i = ancStart; i <= ancEnd; i++){
                                rangeArray.push(i);
                            }

                            ancNums.push(rangeArray);
                        }
                    }
                });
            }


            //連鎖あぼーん (子) の判定
            //
            //すでにこのレスが連鎖透明あぼーんの対象であることが分かっている場合には、
            //それ以上調べる必要はないのでチェックを飛ばす
            //一方、連鎖あぼーんの対象かどうかわからない or
            //連鎖あぼーんの対象だが、連鎖透明あぼーんの対象かはわからない
            //という場合には、連鎖透明あぼーんまで発展する可能性があるから
            //引き続き調べる必要がある
            if(enableChainAbone && !shouldChainHideAbone){
                let ancNumsFlattened = Array.prototype.concat.apply([], ancNums);

                ancNumsFlattened.some((ancNum) => {
                    if(!shouldChainAbone){
                        if(this._chainAboneNumbers.indexOf(ancNum) !== -1){
                            shouldChainAbone = true;
                            chainAboneParent = ancNum;
                        }
                    }

                    if(shouldChainAbone){
                        shouldChainHideAbone = this._chainHideAboneNumbers.indexOf(ancNum) !== -1;
                    }

                    return shouldChainHideAbone;
                });
            }


            //アンカーリンク処理
            if(!fixInvalidAnchor){
                // > 一つなど不正なアンカの場合, 2ch 側ではリンクが貼られていないので
                // 末尾に </a> を補って通常アンカの場合と同じ状態にする
                if(!ancBody.includes('</a>')){
                    ancBody += '</a>';
                }

                return '<a href="#res' + parseInt(ancBody) + '" class="resPointer">' + ancMark + ancBody;
            }else{
                let links = [];

                ancNums.forEach((ancNum) => {
                    if(ancNum instanceof Array){
                        links.push('<a href="#res' + ancNum[0] + '" class="resPointer">&gt;&gt;' +
                                    ancNum[0] + '-' + ancNum[ancNum.length-1] + '</a>');
                    }else{
                        links.push('<a href="#res' + ancNum + '" class="resPointer">&gt;&gt;' + ancNum + '</a>');
                    }
                });

                return links.join('&nbsp;');
            }
        });


        //連鎖あぼーん (子) 処理
        if(shouldChainAbone){
            this._chainAboneNumbers.push(resNumber);
            isAbone = true;
            ngData = 'Chain Abone: >>' + chainAboneParent;
        }


        //連鎖透明あぼーん (子) 処理
        if(shouldChainHideAbone){
            this._chainHideAboneNumbers.push(resNumber);
            return '';
        }


        // 通常リンク処理
        if(resMes.includes("ttp")){
            var regUrlLink = /(h?ttp)(s)?\:([\-_\.\!\~\*\'\(\)a-zA-Z0-9\;\/\?\:\@\&\=\+\$\,\%\#\|]+)/g;

            if(ChaikaHttpController.ivur.enabled){
                resMes = resMes.replace(regUrlLink, function(aStr, aScheme, aSecure, aSpec){
                    const url = 'http' + (aSecure || '') + ':' + aSpec;
                    const image_url = ChaikaHttpController.ivur.replaceURL(url);

                    return '<a href="' + image_url + '" class="outLink">' + aStr + '</a>';
                });
            }else{
                resMes = resMes.replace(regUrlLink, '<a href="http$2:$3" class="outLink">$1$2:$3</a>');
            }
        }

        // Beアイコン, Emoticons 処理
        if(this._showBeIcon){
            resMes = resMes.replace(/sssp:\/\/img\.2ch\.net\/(\S+\.(?:gif|png))/g,
                                    '<img src="http://img.2ch.net/$1" class="beIcon" alt="">');
        }

        // レス本文中のIDを抽出
        var regResID = /(?:(="[^"]*?)( |[^A-Z]|[\x81-\x9f\xe0-\xfc][A-Z])(ID:)([0-9A-Za-z\+\/!]+)([^"]*?")|( |[^A-Z]|[\x81-\x9f\xe0-\xfc][A-Z])(ID:)([0-9A-Za-z\+\/!]+))/g;
        resMes = resMes.replace(regResID, (...args) => {
            if(args[1]){
                //タグの属性値中に含まれるIDは置換しない
                return args[1] + args[2] + args[3] + args[4] + args[5];
            }else{
                // $6<span class="resMesID" resID="$8"><span class="mesID_$8">$7$8</span></span>
                return args[6] + '<span class="resMesID" resID="' + args[8] +
                        '"><span class="mesID_' + args[8] + '">' + args[7] + args[8] +
                        '</span></span>';
            }
        });

        return this.converter.getResponse(aNew, resNumber, resName, resMail, resMailName, resDate,
                                          resID, resIP, resHost, resBeLink, resBeID, resBeBaseID, resMes, isAbone, ngData);
    },


    datDownload: function(aKako, aDisableRange){
        this._maruMode = false;
        this._mimizunMode = false;

        if(aKako){
            this._kakoDatDownload = true;

            if(ChaikaRoninLogin.isLoggedIn()){
                //Rokka spec: https://github.com/Cipherwraith/Rokka/blob/master/README.md
                let KAGI = encodeURIComponent(ChaikaCore.pref.getChar("login.ronin.session_id"));
                let hostParts = this.thread.plainURL.host.split('.');
                let pathParts = this.thread.plainURL.path.split('/');
                let rokkaURLSpec = [
                    "http://rokka." + hostParts[1] + '.' + hostParts[2],  //2ch.com or bbspink.com
                    hostParts[0],  //SERVER
                    pathParts[3],  //BOARD
                    this.thread.datID
                ].join('/');
                let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
                let datKakoURL = ioService.newURI(rokkaURLSpec + '/?sid=' + KAGI, null, null).QueryInterface(Ci.nsIURL);

                ChaikaCore.logger.debug(datKakoURL.spec);

                this.httpChannel = ChaikaCore.getHttpChannel(datKakoURL);
                this._maruMode = true;
            }else if(ChaikaCore.pref.getBool("thread_get_log_from_mimizun")){
                let mimizunURLSpec  = [
                    "http://mimizun.com/log/2ch",
                    this.thread.boardURL.filePath,
                    this.thread.datID,
                    ".dat"
                ].join("");

                let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
                let mimizunURL = ioService.newURI(mimizunURLSpec, null, null).QueryInterface(Ci.nsIURL);

                this.httpChannel = ChaikaCore.getHttpChannel(mimizunURL);
                this._mimizunMode = true;
            }else{
                this.httpChannel = ChaikaCore.getHttpChannel(this.thread.datKakoURL);
            }
        }else{
            this.httpChannel = ChaikaCore.getHttpChannel(this.thread.datURL);
            this._kakoDatDownload = false;
        }

        this.httpChannel.requestMethod = "GET";
        this.httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
        this.httpChannel.loadFlags = this.httpChannel.LOAD_BYPASS_CACHE;
        this._aboneChecked = true;
        this._threadAbone = false;

        // Set If-Modified-Since
        if(this.thread.lastModified){
            this.httpChannel.setRequestHeader("If-Modified-Since", this.thread.lastModified, false);
        }

        if(!aDisableRange && this.thread.datFile.exists()){
            // 差分 GET
            // あぼーんされたか調べるために1byte余計に取得する
            let begin = this.thread.datFile.fileSize - 1;

            this.httpChannel.setRequestHeader("Accept-Encoding", "", false);
            this.httpChannel.setRequestHeader("Range", "bytes=" + begin + "-", false);
            this._aboneChecked = false;
        }else{
            // 全取得
            this.httpChannel.setRequestHeader("Accept-Encoding", "gzip", false);
        }

        this.httpChannel.asyncOpen(this, null);
    },

    onStartRequest: function(aRequest, aContext){
        this._bInputStream = Cc["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Ci.nsIBinaryInputStream);
        this._data = [];
        this._dataBuffer = '';
    },

    onDataAvailable: function (aRequest, aContext, aInputStream, aOffset, aCount){
        if(!this._opened) return;

        aRequest.QueryInterface(Ci.nsIHttpChannel);

        var httpStatus = aRequest.responseStatus;

        // あぼーん発生の場合
        if(httpStatus === 416){
            this._threadAbone = true;
            return;
        }

        // 新着がない場合は終了
        if(!(httpStatus === 200 || httpStatus === 206)) return;
        if(aCount === 0) return;

        this._bInputStream.setInputStream(aInputStream);

        // 206でもあぼーん発生の場合があるので、
        // データ全体の先頭の1byteを調べる
        // ついでに受信したデータを読み込む
        var availableData = "";
        if(!this._aboneChecked && httpStatus === 206){
            var firstChar = this._bInputStream.readBytes(1);
            availableData = this._bInputStream.readBytes(aCount - 1);

            //もし改行でなければあぼーん発生ということ
            if(firstChar.charCodeAt(0) !== 10){
                this._threadAbone = true;
            }
        }else{
            availableData = this._bInputStream.readBytes(aCount);
        }
        this._aboneChecked = true;


        if(this._maruMode && !this._mimizunMode && this._data.length === 0){
            if(availableData.match(/\n/)){
                availableData = RegExp.rightContext;
            }else{
                return;
            }
        }

        // NULL 文字を変換
        availableData = availableData.replace(/\x00/g, "*");

        //前回のバッファと結合し先頭のレス断片を解消
        availableData = this._dataBuffer + availableData;

        //受信したデータをレスごとに分割
        var lines = availableData.split(/\n/);

        //データの最後にレス断片がある場合にはバッファに追加する
        this._dataBuffer = lines.pop();

        //レス断片しかない場合は終了
        if(!lines.length){
            return;
        }

        //ステータスが206 Partial Contentの場合、
        //受信したデータの中に既読レスは含まれない
        if(this._readLogCount && httpStatus === 206){
            this._readLogCount = 0;
        }

        //新着レスのみからなる変換済みデータを作成
        var newResLines = "";      //新着レスの生データ
        var newResHTMLLines = "";   //新着レスの変換済みデータ
        for(let i=0, l=lines.length; i<l; i++){
            //既読部分は飛ばす
            if(this._readLogCount > 0){
                this._readLogCount--;
                continue;
            }

            newResLines += ( lines[i] + '\n' );
            newResHTMLLines += ( this.datLineParse(lines[i], ++this.thread.lineCount, true) + '\n' );
        }

        //ブラウザに書き出す
        this.write(newResHTMLLines);

        //新着レスをを保存用配列に追加
        this._data.push(newResLines);
    },

    onStopRequest: function(aRequest, aContext, aStatus){
        if(!this._opened) return;

        this._bInputStream = null;
        aRequest.QueryInterface(Ci.nsIHttpChannel);

        var httpStatus;

        try{
            httpStatus = aRequest.responseStatus;
        }catch(ex){
            this.write(this.converter.getFooter("network_error"));
            this.close();
            return;
        }

        try{
            this.thread.lastModified = aRequest.getResponseHeader("Last-Modified");
        }catch(ex){}

        switch(httpStatus){
            case 200: // 通常GET OK
            case 206: // 差分GET OK
                break;
            case 302: // DAT落ち
            case 403: // DAT落ちに対して403が返される場合がある: https://github.com/chaika/chaika/issues/105
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
                this._onThreadCollapsed();
                return;
            default: // HTTP エラー
                this.write(this.converter.getFooter(httpStatus));
                this.close();
                return;
        }

        //あぼーん発生時
        if(this._threadAbone){
            this._onThreadCollapsed();
            return;
        }

            // XXX TODO 一部互換スクリプトには、未更新でも 206 を返すものがある?
        var newResLength = this.thread.lineCount - this._logLineCount;

        if(newResLength === 0){
            this.write(this.converter.getFooter("not_modified"));
            this.close();
            return;
        }

        if(httpStatus === 200 || httpStatus === 206){
            this.datSave(this._data.join(""));
        }
        this.write(this.converter.getFooter("ok"));
        this.close();
        this._data = null;
    },


    /**
     * あぼーんが発生して dat が正常に差分取得できなくなったときに呼ばれる
     */
    _onThreadCollapsed: function(){
        if(ChaikaCore.pref.getBool('dat.self-repair.enabled')){
            // dat の自動修復
            ChaikaCore.logger.warning('The dat file of this thread seems to be collapsed. ' +
                                      'Recapture the whole dat to repair.');

            this.thread.lineCount = this._logLineCount;
            this._readLogCount = this._logLineCount;
            this.datDownload(false, true);

            // dat が壊れる (あぼーんされた部分が残っている dat になってしまうので, 次回の range がおかしくなる)
            // ため, うらで dat を取得しなおして置き換える
            //    (dat の取得処理とブラウザへの出力処理が分離されていないので応急処置)
            let downloader = new ChaikaDownloader(this.thread.datURL, this.thread.datFile);
            downloader.download();
        }else{
            this.write(this.converter.getFooter("abone"));
            this.close();
        }
    },


    datSave: function(aDatContent){
                // 書き込みのバッティングを避ける
        var tmpLineCount = 0;
        try{
            var thread = new ChaikaThread(this.thread.url);
            tmpLineCount = thread.lineCount;
        }catch(ex){}

        if(this.thread.lineCount > tmpLineCount){
                // .dat の追記書き込み
            this.thread.appendContent(aDatContent);

            if(this._maruMode || this._mimizunMode){
                this.thread.maruGetted = true;
                this._alertGotLog();
            }
            this.thread.setThreadData();
        }

    },


    _alertGotLog: function(){
        if(!ChaikaCore.pref.getBool("thread_alert_got_log")) return;

        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"]
                .getService(Ci.nsIStringBundleService);
        var statusBundle = strBundleService.createBundle(
                "resource://chaika-modules/server/thread-status.properties");

        var alertStrID = "";
        if(this._maruMode){
            alertStrID = "got_a_log_from_maru";
        }else if(this._mimizunMode){
            alertStrID = "got_a_log_from_mimizun";
        }else{
            return;
        }

        var alertStr = statusBundle.formatStringFromName(alertStrID, [this.thread.title], 1);
        try{
            var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
            alertsService.showAlertNotification("chrome://chaika/content/icon.png", "Chaika", alertStr, false, "", null);
        }catch(ex){}
    }

};


// ***** ***** ***** ***** ***** ThreadJbbs ***** ***** ***** ***** *****
function ThreadJbbs(){
}

ThreadJbbs.prototype = Object.create(Thread2ch.prototype, {

    datDownload: {
        value: function(){
            var datURLSpec = this.thread.url.resolve("./").replace("read.cgi", "rawmode.cgi");
            this._aboneChecked = true;
            this._threadAbone = false;
            this._deltaMode = false;

            // 差分GET
            // したらばの場合、差分取得でも206ではなく200が返るので
            // こちらで記録しておかないといけない
            if(this.thread.datFile.exists() && this.thread.lineCount){
                this._deltaMode = true;
                datURLSpec += (this.thread.lineCount + 1) + "-";
            }

            var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
            var datURL = ioService.newURI(datURLSpec, null, null).QueryInterface(Ci.nsIURL);

            this.httpChannel = ChaikaCore.getHttpChannel(datURL);
            this.httpChannel.requestMethod = "GET";
            this.httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
            this.httpChannel.loadFlags = this.httpChannel.LOAD_BYPASS_CACHE;

            this.httpChannel.asyncOpen(this, null);
        }
    },

    datLineParse: {
        value: function(aLine, aNumber, aNew){
            if(!aLine) return "";

            // EUC-JP から SJIS へ変換
            var line = UniConverter.fromEUC(aLine);
            line = UniConverter.toSJIS(line);

            //2ch互換へと変換
            var resArray = line.split("<>");
            var resNumber = aNumber;
            var resName = "";
            var resMail = "";
            var resDate = "";
            var resID = "";
            var resMes  = "";
            var threadTitle = '';

            if(resArray.length > 5){
                resName = resArray[1].replace(/<\/?b>|/g, "");
                resMail = resArray[2];
                resDate = resArray[3];
                resMes = resArray[4];
                threadTitle = resArray[5];
                resID = resArray[6];
            }

            line = [
                resName,
                resMail,
                resDate + (resID ? ' ID:' + resID : ''),
                resMes,
                threadTitle
            ].join('<>');

            return Thread2ch.prototype.datLineParse.apply(this, [line, resNumber, aNew]);
        }
    },

    onDataAvailable: {
        value: function (aRequest, aContext, aInputStream, aOffset, aCount){
            if(!this._opened) return;

            aRequest.QueryInterface(Ci.nsIHttpChannel);

            var httpStatus = aRequest.responseStatus;

            // あぼーん発生の場合
            if(httpStatus === 416){
                this._threadAbone = true;
                return;
            }

            // 新着がない場合は終了
            if(!(httpStatus === 200 || httpStatus === 206)) return;
            if(aCount === 0) return;

            this._bInputStream.setInputStream(aInputStream);

            // 206でもあぼーん発生の場合があるので、
            // データ全体の先頭の1byteを調べる
            // ついでに受信したデータを読み込む
            var availableData = "";
            if(!this._aboneChecked && httpStatus === 206){
                var firstChar = this._bInputStream.readBytes(1);
                availableData = this._bInputStream.readBytes(aCount - 1);

                //もし改行でなければあぼーん発生ということ
                if(firstChar.charCodeAt(0) !== 10){
                    this._threadAbone = true;
                }
            }else{
                availableData = this._bInputStream.readBytes(aCount);
            }
            this._aboneChecked = true;


            // NULL 文字を変換
            availableData = availableData.replace(/\x00/g, "*");

            //前回のバッファと結合し先頭のレス断片を解消する
            availableData = this._dataBuffer + availableData;

            //受信したデータをレスごとに分割
            var _lines = availableData.split("\n");

            //最後にレス断片が付いている場合にはそれをバッファに追加する
            this._dataBuffer = _lines.pop();

            //もしレス断片しかない場合にはここで終了
            if(!_lines.length){
                return;
            }


            //datを2ch互換に変換する
            let lineCount = parseInt(_lines[0].match(/^(\d+)<>/));
            let lines = [];  //空白挿入後のdatLines

            // サーバ側で透明あぼーんがある場合そこに空白行を挿入する
            for(let i=0, l=_lines.length; i<l; i++){
                let line = _lines[i];
                let resNum = parseInt(line.match(/^(\d+)<>/));

                //透明あぼーんの分だけ空行を挿入
                while(lineCount < resNum){
                    lineCount++;
                    lines.push('');
                }

                lineCount++;
                lines.push(line);
            }


            //差分取得の場合は受信したデータの中に既読レスは含まれない
            if(this._readLogCount && (httpStatus === 206 || this._deltaMode)){
                this._readLogCount = 0;
            }

            //新着レスのみからなる変換済みデータを作成
            var newResLines = "";      //新着レスの生データ
            var newResHTMLLines = "";  //新着レスの変換済みデータ
            for(let i=0, l=lines.length; i<l; i++){
                //既読部分は飛ばす
                if(this._readLogCount > 0){
                    this._readLogCount--;
                    continue;
                }

                newResLines += ( lines[i] + '\n' );
                newResHTMLLines += ( this.datLineParse(lines[i], ++this.thread.lineCount, true) + '\n' );
            }

            //データをブラウザに書き出す
            this.write(newResHTMLLines);

            //新着レスを保存用配列に追加
            this._data.push(newResLines);
        }
    },

    onStopRequest: {
        value: function(aRequest, aContext, aStatus){
            if(!this._opened) return;

            aRequest.QueryInterface(Ci.nsIHttpChannel);
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

            if(httpStatus === 200 || httpStatus === 206){
                this.datSave(this._data.join(""));
            }
            this.write(this.converter.getFooter("ok"));
            this.close();
            this._data = null;
        }
    }
});

ThreadJbbs.constructor = ThreadJbbs;



// ***** ***** ***** ***** ***** ThreadMachi ***** ***** ***** ***** *****
function ThreadMachi(){
}

ThreadMachi.prototype = Object.create(Thread2ch.prototype, {
    datDownload: {
        value: function(){
            var datURLSpec = this.thread.url.resolve("./").replace("read.cgi", "offlaw.cgi/2");
            this._aboneChecked = true;
            this._threadAbone = false;
            this._deltaMode = false;

            // 差分GET
            if(this.thread.datFile.exists() && this.thread.lineCount){
                this._deltaMode = true;
                datURLSpec += (this.thread.lineCount + 1) + "-";
            }

            var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
            var datURL = ioService.newURI(datURLSpec, null, null).QueryInterface(Ci.nsIURL);

            this.httpChannel = ChaikaCore.getHttpChannel(datURL);
            this.httpChannel.requestMethod = "GET";
            this.httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
            this.httpChannel.loadFlags = this.httpChannel.LOAD_BYPASS_CACHE;

            this.httpChannel.asyncOpen(this, null);
        }
    },

    datLineParse: {
        value: function(aLine, aNumber, aNew){
            if(!aLine) return "";

            // 透明削除がある場合に正しいレス番号に補正する
            var resArray = aLine.split("<>");
            var trueNumber = parseInt(resArray.shift());

            // リモートホスト情報を日付部分に追加して 2ch 互換データにする
            resArray[2] += ' HOST:' + resArray[5];
            resArray.pop();

            return Thread2ch.prototype.datLineParse.apply(this, [resArray.join("<>"), trueNumber, aNew]);
        }
    },

    onDataAvailable: {
        value: function (aRequest, aContext, aInputStream, aOffset, aCount){
            return ThreadJbbs.prototype.onDataAvailable.apply(this, arguments);
        }
    }
});

ThreadMachi.constructor = ThreadMachi;



// ***** ***** ***** ***** ***** Id2Color ***** ***** ***** ***** *****
/**
 * idから色を返します。
 */
function Id2Color(){
}

Id2Color.prototype = {
    _char64To8: [],
    _cache: [],
    _bgcache: [],

    init: function(){
        var idChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var i = 0;

        for(var m in idChars){
            this._char64To8[idChars[m]] = i;
            if(((parseInt(m) + 1) % 8) === 0) i++;
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
            var newint = Array.from(aID).reduce((p, c) => (p << 3) | this._char64To8[c], 0);

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
};


// ***** ***** ***** ***** ***** ThreadConverter ***** ***** ***** ***** *****
function ThreadConverter(){
}

ThreadConverter.prototype = {

    init: function(aContext, aThreadURL, aBoardURL, aType){
        this._context = aContext;
        this._threadURL = aThreadURL;
        this._boardURL = aBoardURL;
        this._type = aType;

        this._id2Color = new Id2Color();
        this._id2Color.init();

        try{
            this._tmpHeader = ChaikaCore.io.readData(this._resolveSkinFile("Header.html"));
            this._tmpFooter = ChaikaCore.io.readData(this._resolveSkinFile("Footer.html"));
            this._tmpRes = ChaikaCore.io.readData(this._resolveSkinFile("Res.html"));
            this._tmpNewRes = ChaikaCore.io.readData(this._resolveSkinFile("NewRes.html"));
            this._tmpNewMark = ChaikaCore.io.readData(this._resolveSkinFile("NewMark.html"));
        }catch(ex){
            ChaikaCore.logger.error(ex);
            throw Components.results.NS_ERROR_FILE_NOT_FOUND;
        }

        this._tmpNGRes = null;
        this._tmpNGNewRes = null;
        try{
            var ngResFile = this._resolveSkinFile("NGRes.html");
            var ngNewResFile = this._resolveSkinFile("NGNewRes.html");
            if(ngResFile.exists() && ngNewResFile.exists()){
                this._tmpNGRes = ChaikaCore.io.readData(ngResFile);
                this._tmpNGNewRes = ChaikaCore.io.readData(ngNewResFile);
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
            this._tmpNGRes = null;
            this._tmpNGNewRes = null;
        }

            // 基本スキンタグの置換
        this._tmpHeader = this._replaceBaseTag(this._tmpHeader);
        this._tmpFooter = this._replaceBaseTag(this._tmpFooter);
        this._tmpRes = this._replaceBaseTag(this._tmpRes);
        this._tmpNewRes = this._replaceBaseTag(this._tmpNewRes);
        this._tmpNewMark = this._replaceBaseTag(this._tmpNewMark);

        this._tmpGetRes = this.toFunction(this._tmpRes);
        this._tmpGetNewRes = this.toFunction(this._tmpNewRes);

        if(this._tmpNGRes && this._tmpNGNewRes){
            this._tmpNGRes = this._replaceBaseTag(this._tmpNGRes);
            this._tmpNGNewRes = this._replaceBaseTag(this._tmpNGNewRes);
            this._tmpGetNGRes = this.toFunction(this._tmpNGRes);
            this._tmpGetNGNewRes = this.toFunction(this._tmpNGNewRes);
        }

        // 旧仕様の互換性確保
        if(!this._tmpFooter.includes('<STATUS/>')){
            this._tmpFooter = '<p class="info"><STATUS/></p>\n' + this._tmpFooter;
        }
    },

    _resolveSkinFile: function(aFilePath){
        var skinName = ChaikaCore.pref.getUniChar("thread_skin");

        var skinFile = null;
        if(skinName){
            skinFile = ChaikaCore.getDataDir();
            skinFile.appendRelativePath("skin");
            skinFile.appendRelativePath(skinName);
        }else{
            skinFile = ChaikaCore.getDefaultsDir();
            skinFile.appendRelativePath("skin");
        }
        skinFile.appendRelativePath(aFilePath);
        return skinFile;
    },

    /**
     * 基本スキンタグの置換
     * @param aString string 置換される文字列
     */
    _replaceBaseTag: function(aString){
        var skinURISpec = ChaikaServer.serverURL.resolve("./skin/");
        var serverURLSpec = ChaikaServer.serverURL.resolve("./thread/");
        var fontName = ChaikaCore.pref.getUniChar("thread_font_name");
        var fontSize = ChaikaCore.pref.getInt("thread_font_size");
        var aaFontName = ChaikaCore.pref.getUniChar("thread_aa_font_name");
        var aaFontSize = ChaikaCore.pref.getInt("thread_aa_font_size");
        var aaLineSpace = ChaikaCore.pref.getInt("thread_aa_line_space");

        fontName = UniConverter.toSJIS(fontName);
        aaFontName = UniConverter.toSJIS(aaFontName);

        return aString.replace(/<SKINPATH\/>/g, skinURISpec)
                      .replace(/<THREADURL\/>/g, this._threadURL.resolve("./"))
                      .replace(/<BOARDURL\/>/g, this._boardURL.spec)
                      .replace(/<SERVERURL\/>/g, serverURLSpec)
                      .replace(/<FONTNAME\/>/g, "\'" + fontName + "\'")
                      .replace(/<FONTSIZE\/>/g, fontSize + "px")
                      .replace(/<AAFONTNAME\/>/g, "\'" + aaFontName + "\'")
                      .replace(/<AAFONTSIZE\/>/g, aaFontSize + "px")
                      .replace(/<AALINEHEIGHT\/>/g, aaFontSize + aaLineSpace + "px");
    },

    getHeader: function(aTitle){
        return this._tmpHeader.replace(/<THREADNAME\/>/g, aTitle);
    },

    getFooter: function(aStatusText){
        var datSize = 0;
        var datSizeKB = 0;
        var datFile = this._context.thread.datFile.clone();
        if(datFile.exists()){
            datSize = datFile.fileSize;
            datSizeKB = Math.round(datSize / 1024);
        }
        var logLineCount = this._context._logLineCount;
        var lineCount = this._context.thread.lineCount;

        return this._tmpFooter.replace(/<STATUS\/>/g, this.getStatusText(aStatusText))
                              .replace(/<SIZE\/>/g, datSize)
                              .replace(/<SIZEKB\/>/g, datSizeKB)
                              .replace(/<GETRESCOUNT\/>/g, logLineCount)
                              .replace(/<NEWRESCOUNT\/>/g, lineCount - logLineCount)
                              .replace(/<ALLRESCOUNT\/>/g, lineCount);
    },

    getStatusText: function(aStatus){
        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
        var statusBundle = strBundleService.createBundle("resource://chaika-modules/server/thread-status.properties");
        var statusText = "";

        if(typeof aStatus === "string"){
            try{
                statusText = statusBundle.GetStringFromName(aStatus);
            }catch(ex){}
        }else{
            try{
                statusText = statusBundle.formatStringFromName("error", [String(aStatus)], 1);
            }catch(ex){}
        }

        return UniConverter.toSJIS(statusText);
    },

    getNewMark: function(){
        return this._tmpNewMark;
    },

    toFunction: function(aRes){
        return function(aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor,
                        aIP, aHost, aBeLink, aBeID, aBeBaseID, aMessage, aNGData){

            //置換文字列で特殊な意味を持つ$をエスケープする
            for(let i=0, l=arguments.length; i<l; i++){
                if(typeof arguments[i] === 'string'){
                    arguments[i] = arguments[i].replace(/\$/g, '&#36;');
                }
            }

            let ngData = UniConverter.toSJIS(ChaikaCore.io.escapeHTML(aNGData.title || aNGData));

            //タグを置換する
            return aRes.replace(/<PLAINNUMBER\/>/g, aNumber)
                       .replace(/<NUMBER\/>/g, aNumber)
                       .replace(/<NAME\/>/g, aName)
                       .replace(/<MAIL\/>/g, aMail)
                       .replace(/<MAILNAME\/>/g, aMailName)
                       .replace(/<DATE\/>/g, aDate)
                       .replace(/<ID\/>/g, aID)
                       .replace(/<IDCOLOR\/>/g, resIDColor)
                       .replace(/<IDBACKGROUNDCOLOR\/>/g, resIDBgColor)
                       .replace(/<IP\/>/g, aIP)
                       .replace(/<HOST\/>/g, aHost)
                       .replace(/<BEID\/>/g, aBeLink)  //スキンタグの <BEID/> は正確には BeLink である
                       .replace(/<BENUMBER\/>/g, aBeID)
                       .replace(/<BEBASEID\/>/g, aBeBaseID)
                       .replace(/<MESSAGE\/>/g, aMessage)
                       .replace(/<NGDATA\/>/g, ngData)
                       .replace(/<ABONEWORD\/>/g, ngData);  //Chaika Abone Helper 互換
        };
    },

    getResponse: function(aNew, aNumber, aName, aMail, aMailName, aDate, aID,
                          aIP, aHost, aBeLink, aBeID, aBeBaseID, aMessage, aIsAbone, aNGData){

        var template = aNew ? this._tmpNewRes : this._tmpRes;

        if(aIP && !template.includes('<IP/>')){
            aDate = aDate + " \x94\xad\x90\x4d\x8c\xb3:" + aIP;
        }

        if(aHost && !template.includes('<HOST/>')){
            aDate = aDate + " HOST:" + aHost;
        }

        if(aID && !template.includes('<ID/>')){
            aDate = aDate + " ID:" + aID;
        }

        if(aBeLink && !template.includes('<BEID/>')){
            aDate = aDate + " Be:" + aBeLink;
        }

        //ハイライトレス
        if(aIsAbone && aNGData.highlight){
            aIsAbone = !aIsAbone;
            aMessage = '<span class="highlightedRes">' + aMessage + '</span>';

            //chaikaAboneEx 互換
            aDate = '<span class="resDateImportant">' + aDate + '</span>';
            aName = '<span class="resNameImportant">' + aName + '</span>';
        }

        //あぼーんレス
        if(aIsAbone && !(this._tmpGetNGNewRes && this._tmpGetNGRes)){
            aName = aMail = aMailName = aDate = aMessage = "ABONE";
            aID = aBeID = aIP = aHost = "";
        }

        var resIDColor = template.includes('<IDCOLOR/>') ?
                            this._id2Color.getColor(aID, false) : "inherit";

        var resIDBgColor = template.includes('<IDBACKGROUNDCOLOR/>') ?
                                this._id2Color.getColor(aID, true) : "inherit";

        //AAレス
        if(this.isAA(aMessage)){
            aMessage = '<span class="aaRes">' + aMessage + '</span>';
        }


        var resFunc;

        if(aIsAbone && this._tmpGetNGNewRes && this._tmpGetNGRes){
            if(aNew){
                resFunc = this._tmpGetNGNewRes;
            }else{
                resFunc = this._tmpGetNGRes;
            }
        }else{
            if(aNew){
                resFunc = this._tmpGetNewRes;
            }else{
                resFunc = this._tmpGetRes;
            }
        }

        return resFunc(aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor,
                       aIP, aHost, aBeLink, aBeID, aBeBaseID, aMessage, aNGData);
    },

    isAA: function(aMessage) {
        var lineCount = aMessage.match(/<br>/g);

        if(lineCount && lineCount.length >= 3){
            // \x81\x40 = 全角空白, \x81F = ：, \x81b = ｜, \x84\xab = ┃, \x81P = ‾
            // \x81\x5e = ／, \x81_ = ＼, \x84\xaa = ━, \x81i = （, \x81j = ）
            // 半角空白は、英文中に多く含まれるためカウントから外す
            let aaSymbols = /(?:\x81\x40|\x81F|\x81b|\x84\xab|\x81P|\x81\x5e|\x81_|\x84\xaa|\x81i|\x81j|[^\x81-\xfc][_:;\|\/\\\(\)])/g;
            let aaSymbolsCount = aMessage.match(aaSymbols);
            let aaSymbolsRatio = aaSymbolsCount ? aaSymbolsCount.length / aMessage.length : 0;

            if(aaSymbolsRatio >= 0.2){
                return true;
            }
        }

        // read.crx, V2C 互換方式
        // 全角空白と半角空白が連続している時に AA と判定
        // refs.  AA（アスキーアート）簡易判定アルゴリズム - awef
        //        http://d.hatena.ne.jp/awef/20110412/1302605740
        // @license MIT License (Copyright (c) 2011 awef) (only the following one-line)
        if(/(?:(?:\x81\x40 )|(?:[^>] \x81\x40))(?!<|$)/i.test(aMessage)){
            return true;
        }

        return false;
    }

};
