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


EXPORTED_SYMBOLS = ["ChaikaHttpController"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/**
 * chaika のスレッド表示における HTTP 通信を制御するクラス
 * @class
 */
var ChaikaHttpController = {

    /** @private */
    _startup: function(){
        this.ref = new ChaikaRefController();
        this.ref.startup();

        this.ivur = new ChaikaImageViewURLReplace();
        this.ivur.startup();

        this.ngfiles = new ChaikaNGFiles();
        this.ngfiles.startup();


        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.addObserver(this, 'http-on-opening-request', true);

        var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
        pref.addObserver("extensions.chaika.refController.enabled", this, true);
        pref.addObserver('extensions.chaika.imageViewURLReplace.enabled', this, true);
        pref.addObserver('extensions.chaika.ngfiles.enabled', this, true);

        this._serverURL = ChaikaCore.getServerURL();
    },


    /** @private */
    _quit: function(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.removeObserver(this, 'http-on-opening-request');

        var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
        pref.removeObserver("extensions.chaika.refController.enabled", this);
        pref.removeObserver('extensions.chaika.imageViewURLReplace.enabled', this);
        pref.removeObserver('extensions.chaika.ngfiles.enabled', this);
    },


    // ********** ********* implements nsIObserver ********** **********

    /** @private */
    observe: function ChaikaHttpController_observe(aSubject, aTopic, aData){
        if(aTopic === 'http-on-opening-request'){
            let httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);

            // リファラがなければ終了
            if(!httpChannel.referrer) return;

            // リファラが内部サーバ以外なら終了
            if(this._serverURL.hostPort !== httpChannel.referrer.hostPort) return;

            // 読み込むリソースが内部サーバなら終了
            if(this._serverURL.hostPort === httpChannel.URI.hostPort) return;


            //リファラ制御
            if(this.ref.enabled){
                this.ref.referrerOverwrite(httpChannel);
            }

            //ImageViewURLReplace.dat
            if(this.ivur.enabled){
                this.ivur.apply(httpChannel);
            }

            //NGFiles.txt
            if(this.ngfiles.enabled && /(?:jpe?g|png|gif|bmp)$/.test(httpChannel.URI.spec)){
                if(this.ngfiles.shouldBlock(httpChannel.URI)){
                    return httpChannel.cancel(Cr.NS_ERROR_FAILURE);
                }
            }

            return;
        }


        //設定値の監視
        if(aTopic === "nsPref:changed"){
            switch(aData){
                case 'extensions.chaika.refController.enabled':
                    this.ref.enabled = ChaikaCore.pref.getBool('refController.enabled');
                    break;

                case 'extensions.chaika.imageViewURLReplace.enabled':
                    this.ivur.enabled = ChaikaCore.pref.getBool('imageViewURLReplace.enabled');
                    break;

                case 'extensions.chaika.ngfiles.enabled':
                    this.ngfiles.enabled = ChaikaCore.pref.getBool('ngfiles.enabled');
                    break;
            }
        }

    },


    /** @private */
    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIObserver,
        Ci.nsISupportsWeakReference,
        Ci.nsISupports
    ])

};


/**
 * リファラを管理する
 * URL ごとにリファラを設定したい場合には ImageViewURLReplace.dat を使用すること
 * ChaikaHttpController.ref を通して使用する
 * @constructor
 * @private
 */
function ChaikaRefController(){
}

ChaikaRefController.prototype = {

    enabled: false,

    startup: function(){
        this.enabled = ChaikaCore.pref.getBool('refController.enabled');
    },

    quit: function(){
    },


    /** @private */
    referrerOverwrite: function ChaikaRefController_referrerOverwrite(aHttpChannel){
        var targetSpec = aHttpChannel.URI.spec;
        var newReferrer = null;

        ChaikaCore.logger.debug(targetSpec +" >> "+ ((newReferrer) ? newReferrer.spec : "(null)"));
        aHttpChannel.referrer = newReferrer;
    },

};



/**
 * ImageViewURLReplace.dat をもとに URL の書き換えやリファラ制御を行う
 * ファイル自体の書式についてはサンプルファイルを参照のこと
 * ChaikaHttpController.ivur を通して使用する
 * @constructor
 * @private
 */
function ChaikaImageViewURLReplace(){
}

ChaikaImageViewURLReplace.prototype = {

    enabled: false,

    /**
     * 置換ルールの配列
     * @type {Array}
     */
    rules: [],

    /**
     * 処理したURLをキーに、置換ルールを値に持つハッシュ
     */
    urls: {},


    startup: function(){
        this.enabled = ChaikaCore.pref.getBool('imageViewURLReplace.enabled');

        if(this.enabled){
            this._loadFile();
        }
    },

    quit: function(){
    },


    _loadFile: function ChaikaIvur__loadFile(){
        this.rules = new Array();

        const IVUR_NAME = 'ImageViewURLReplace.dat';

        var file = ChaikaCore.getDataDir();
        file.appendRelativePath(IVUR_NAME);

        if(!file.exists()){
            let defaultsFile = ChaikaCore.getDefaultsDir();
            defaultsFile.appendRelativePath(IVUR_NAME);
            defaultsFile.copyTo(file.parent, null);
            file = file.clone();
        }

        var lines = ChaikaCore.io.readString(file, "Shift_JIS").replace(/\r/g, "\n").split(/\n+/);
        for(let i=0, l=lines.length; i<l; i++){
            let config = this._parseConfig(lines[i]);
            if(config){
                this.rules.push(config);
            }
        }
    },


    /**
     * ImageViewURLReplace.dat の行を解析してオブジェクトへ変換する
     * @param {String} line
     * @return {Object} 変換できない場合や定義行以外の場合は null が返る
     */
    _parseConfig: function(line){
        var config = {
            target: null,           //検索文字列 RegExpオブジェクト
            image: '',              //補正文字列 [後方参照有]
            referrer: '',           //リファラ [後方参照有]
            cookie: {
                shouldGet: false,   //Cookieを取得するかどうか
                referrer: '',       //Cookieを取得するときに送るリファラ [後方参照有]
                str: '',            //Cookie本体
            },
            processFlag: '',        //動作制御パラメータ
            extract: {
                pattern: '',        //スクレイピング時に画像URLを取得する正規表現 [後方参照有]
                referrer: '',       //スクレイピング時に送るリファラ [後方参照有]
            },
            userAgent: '',          //ユーザーエージェント (chaika 独自拡張)
        };

        var data = line.split(/\t/);

        //空行もしくはコメント行の場合
        if(!data[0] || (/^\s*(?:;|'|#|\/\/)/).test(data[0])){
            return null;
        }

        config.target = new RegExp(data[0]);
        config.image = data[1];
        config.referrer = data[2];
        config.userAgent = data[5];

        if(data[3]){
            if(data[3].indexOf('$COOKIE') > -1){
                config.cookie.shouldGet = true;
                config.cookie.referrer = data[3].match(/\$COOKIE=?([^\$]*)/)[1];
            }

            if(data[3].indexOf('$EXTRACT') > -1 && data[4]){
                config.extract.pattern = data[4];
                config.extract.referrer = data[3].match(/\$EXTRACT=?([^\$]*)/)[1];
                config.cookie.shouldGet = true;
            }

            config.processFlag = data[3];
        }

        return config;
    },


    /**
     * 補正文字列などの後方参照を解決する
     * @param {String} aStr 対象の文字列
     * @param {RegExp} aMatch 検索文字列のRegExpオブジェクト
     * @param {RegExp} [aExtractMatch] スクレイピングのRegExpオブジェクト
     * @return {String}
     */
    _resolveBackReference: function ChaikaIvur__resolvBackReference(aStr, aMatch, aExtractMatch){
        if(!aStr) return '';

        return aStr.replace(/\$(\d+|&)/g, function(_str, _backRefs){
            if(_backRefs === '&'){
                return aMatch[0];
            }else if(parseInt(_backRefs)){
                return aMatch[_backRefs];
            }
        }).replace(/\$EXTRACT(\d+)?/g, function(_str, _backRefs){
            if(!_backRefs){
                return aExtractMatch[1];
            }else{
                return aExtractMatch[_backRefs];
            }
        });
    },


    /**
     * URL を ImageViewURLReplace.dat を適用して書き換える
     * datLineParseから呼ばれる
     * @param {String} url
     * @return {String}
     */
    replaceURL: function ChaikaIvur_replaceURL(url){
        for(let i=0, l=this.rules.length; i<l; i++){
            let match;
            if(match = url.match(this.rules[i].target)){

                //補正文字列がない場合はブロックする
                //今後リクエストは発生しないのでこれで終わり
                if(!this.rules[i].image){
                    return '';
                }


                //コピーして ivurObj を作成する
                let ivurObj = JSON.parse(JSON.stringify(this.rules[i]));

                //$EXTRACT でないとき
                if(!ivurObj.extract.pattern){
                    //後方参照の解決
                    ivurObj.image = this._resolveBackReference(ivurObj.image, match);
                    ivurObj.referrer = this._resolveBackReference(ivurObj.referrer, match);
                    ivurObj.cookie.referrer = this._resolveBackReference(ivurObj.cookie.referrer, match);

                    //Cookieの取得
                    if(ivurObj.cookie.shouldGet){
                        let request = new this.Request(ivurObj);
                        request.getCookie();
                    }
                }else{
                    //後方参照の解決
                    ivurObj.referrer = this._resolveBackReference(ivurObj.referrer, match);
                    ivurObj.cookie.referrer = this._resolveBackReference(ivurObj.cookie.referrer, match);
                    ivurObj.extract.referrer = this._resolveBackReference(ivurObj.extract.referrer, match);
                    ivurObj.extract.pattern =
                        new RegExp(this._resolveBackReference(ivurObj.extract.pattern, match));

                    //スクレイピングにより補正文字列とCookieを取得
                    let request = new this.Request(ivurObj);
                    let extractMatch = request.fetchExtract();

                    //スクレイピングに失敗した時は元の URL を返す
                    if(!extractMatch){
                        ChaikaCore.logger.error('Fail to fetch $EXTRACT.');
                        return url;
                    }

                    //後方参照の解決
                    ivurObj.image = this._resolveBackReference(ivurObj.image, match, extractMatch);
                }

                //urlsに保存する
                this.urls[ivurObj.image] = JSON.parse(JSON.stringify(ivurObj));

                //補正後の URL を返す
                //$VIEWER が指定されている場合や元のURLに画像の拡張子がある場合には、
                //スキンに画像のURLであると判断されるように URL の末尾に .jpg を付ける
                let forceViewer = ivurObj.processFlag.indexOf('$VIEWER') > -1 ||
                                    /(?:jpe?g|png|gif|bmp)$/.test(url);

                return ivurObj.image + '?chaika_ivur_enabled=1' + (forceViewer ? '&dummy_ext=.jpg' : '');
            }
        }

        return url;
    },


    /**
     * リファラやCookieの制御を行う
     * http-on-opening-request で呼ばれる
     */
    apply: function ChaikaIvur_apply(aHttpChannel){
        var url = aHttpChannel.URI.spec;
        if(url.indexOf('?chaika_ivur_enabled=1') === -1) return;

        url = url.replace('?chaika_ivur_enabled=1', '')
                .replace('&dummy_ext=.jpg', '');

        var ivurObj = this.urls[url];
        if(!ivurObj) return;

        aHttpChannel.setRequestHeader('Referer', ivurObj.referrer, false);
        aHttpChannel.setRequestHeader('Cookie', ivurObj.cookie.str, false);
    },

};


/**
 * ImageViewURLReplace のリクエストを行う
 * @constructor
 * @private
 */
ChaikaImageViewURLReplace.prototype.Request = function(ivurObj){
    this.init(ivurObj);
};

ChaikaImageViewURLReplace.prototype.Request.prototype = {

    timeout: 10 * 1000,

    init: function(ivurObj){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.addObserver(this, 'http-on-opening-request', false);
        os.addObserver(this, 'http-on-examine-response', false);

        this._ivurObj = ivurObj;
        this._request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
        this._request.QueryInterface(Ci.nsIDOMEventTarget).QueryInterface(Ci.nsIXMLHttpRequest);
    },


    destroy: function(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.removeObserver(this, 'http-on-opening-request');
        os.removeObserver(this, 'http-on-examine-response');

        this._ivurObj = null;
    },


    /**
     * Cookieを取得する
     */
    getCookie: function ChaikaIvurRequest_getCookie(){
        this._request.timeout = this.timeout;
        this._request.open('GET', this._ivurObj.referrer, true);
        this._request.addEventListener('load', this.destroy.bind(this), false);

        this._request.setRequestHeader('Referer', this._ivurObj.cookie.referrer);
        if(this._ivurObj.userAgent){
            this._request.setRequestHeader('User-Agent', this._ivurObj.userAgent);
        }

        this._request.send(null);
    },


    /**
     * $EXTRACT に基づきスクレイピングする
     * @return {RegExp} スクレイピングした結果のRegExp
     */
    fetchExtract: function ChaikaIvurRequest_fetchExtract(){
        this._request.timeout = this.timeout;
        this._request.open('GET', this._ivurObj.referrer, false);

        this._request.setRequestHeader('Content-Type', 'text/html');
        this._request.setRequestHeader('Referer', this._ivurObj.extract.referrer);
        if(this._ivurObj.userAgent){
            this._request.setRequestHeader('User-Agent', this._ivurObj.userAgent);
        }

        this._request.send(null);

        var extractMatch = null;
        if(this._request.status === 200 && this._request.responseText){
            extractMatch = this._request.responseText.match(this._ivurObj.extract.pattern);
        }

        this.destroy();
        return extractMatch;
    },


    observe: function ChaikaIvurRequest_observe(aSubject, aTopic, aData){
        if(aTopic === 'http-on-examine-response'){
            let httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);

            if(httpChannel.URI.spec === this._ivurObj.referrer){
                try{
                    this._ivurObj.cookie.str = httpChannel.getResponseHeader('Set-Cookie');
                    httpChannel.setResponseHeader('Set-Cookie', '');
                }catch(ex){
                    this._ivurObj.cookie.str = '';
                }
            }
        }
    },
};



/**
 * NGFiles.txtに基づき画像をブロックする
 * ChaikaHttpController.ngfiles を通して利用する
 * @constructor
 * @private
 */
function ChaikaNGFiles(){
}

ChaikaNGFiles.prototype = {

    enabled: false,

    ngData: [],

    startup: function(){
        this.enabled = ChaikaCore.pref.getBool('ngfiles.enabled');

        this._loadFile();
    },

    quit: function(){
    },


    _loadFile: function ChaikaNGFiles__loadFile(){
        this.ngData = null;
        this.ngData = [];

        const NGFILES_NAME = 'NGFiles.txt';

        var ngFile = ChaikaCore.getDataDir();
        ngFile.appendRelativePath(NGFILES_NAME);

        if(!ngFile.exists()){
            var defaultsFile = ChaikaCore.getDefaultsDir();
            defaultsFile.appendRelativePath(NGFILES_NAME);
            defaultsFile.copyTo(ngFile.parent, null);
            ngFile = ngFile.clone();
        }

        var data = ChaikaCore.io.readString(ngFile);

        //U+FFFD (REPLACEMENT CHARACTER) が含まれる場合には
        //Shift-JISで保存されている旧式のファイルであるということなので
        //Shift-JIS で再読込する
        if(data.indexOf("\uFFFD") !== -1){
            ChaikaCore.logger.warning("The encoding of NGFiles.txt is Shift-JIS. It is recommended to convert to UTF-8.");
            data = ChaikaCore.io.readString(ngFile, 'Shift-JIS');
        }

        var lines = data.replace(/\r/g, "\n").split(/\n+/);

        for(let i=0, l=lines.length; i<l; i++){
            var data = lines[i].split(/=\*/);

            if(data[0] && !(/^\s*(?:;|'|#|\/\/)/).test(data[0])){
                this.ngData.push({
                    hash: data[0],
                    description: data[1]
                });
            }
        }
    },


    /**
     * URIからそのファイルのMD5を得る
     * @param {nsIURI} uri 対象のファイル
     * @return {String} MD5ハッシュ エラー時はnullが返る
     */
    _getMD5: function ChaikaNGFiles__getMD5(uri){
        try{
            var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
            var channel = ioService.newChannelFromURI(uri);

            var stream = channel.open();
            var binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
            binaryInputStream.setInputStream(stream);

            if(channel instanceof Ci.nsIHttpChannel && channel.responseStatus != 200){
                ChaikaCore.logger.error('channel status: ' + channel.responseStatus);
            }else{
                var byteArray = new Array();
                var readLength = binaryInputStream.available();

                while(readLength != 0){
                    byteArray = byteArray.concat(binaryInputStream.readByteArray(readLength));
                    readLength = binaryInputStream.available();
                }

                var cryptoHash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
                cryptoHash.init(cryptoHash.MD5);
                cryptoHash.update(byteArray, byteArray.length);

                var hash = cryptoHash.finish(false);

                function toHexString(charCode){
                    return ("0" + charCode.toString(16)).slice(-2);
                }

                return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }finally{
            if(binaryInputStream) binaryInputStream.close();
            if(stream) stream.close();
        }

        return null;
    },


    /**
     * MD5からNGFiles.txt互換のハッシュを得る
     * @param {String} md5 MD5ハッシュ値
     * @return {String} ハッシュ
     */
    _getHash: function ChaikaNGFiles__getHash(md5){
        //NGFiles.txt互換ハッシュを算出
        //Based on nghash.c by taotao1942
        //http://www6.atpages.jp/appsouko/souko/pkg/nghash.zip
        const NGHASH_CHAR = [
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
            'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
            'U', 'V'
        ];

        const NGHASH_LEN = 26;

        function make_word(lo, hi){
            return lo + (hi << 8);
        }


        //2文字ごとに16進数とみなして数値に変換する
        md5 = Array.slice(md5.match(/../g));
        for(let i=0, l=md5.length; i<l; i++){
            md5[i] = parseInt(md5[i], 16);
        }

        md5.push(0);

        var hash = '';
        for(let i=0; i<NGHASH_LEN; i++){
            let num = ~~(5 * i / 8);
            hash += NGHASH_CHAR[(make_word(md5[num], md5[num + 1]) >> (5 * i % 8)) & 31];
        }

        return hash;
    },


    /**
     * ブロックすべきURLかどうかを判定する
     * @param {nsIURI} uri 判定するURL
     * @return {Boolean}
     */
    shouldBlock: function ChaikaNGFiles_shouldBlock(uri){
        var md5 = this._getMD5(uri);
        if(!md5) return false;

        var hash = this._getHash(md5);

        for(let i=0, l=this.ngData.length; i<l; i++){
            if(this.ngData[i].hash === hash){
                uri = uri.QueryInterface(Ci.nsIURL);

                var alertStr = decodeURIComponent(escape(
                    'NGFiles.txt に基づき ' + uri.fileName + ' をブロックしました。\n説明: '
                )) + this.ngData[i].description;

                var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
                alertsService.showAlertNotification("chrome://chaika/content/icon.png", "Chaika", alertStr, false, "", null);

                return true;
            }
        }

        return false;
    },
};
