/* See license.txt for terms of usage */

this.EXPORTED_SYMBOLS = ["ChaikaHttpController"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://chaika-modules/ChaikaCore.js");
Cu.import("resource://chaika-modules/ChaikaServer.js");


/**
 * chaika のスレッド表示における HTTP 通信を制御するクラス
 * @class
 */
this.ChaikaHttpController = {

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
            if(ChaikaServer.serverURL.hostPort !== httpChannel.referrer.hostPort) return;

            // 読み込むリソースが内部サーバなら終了
            if(ChaikaServer.serverURL.hostPort === httpChannel.URI.hostPort) return;


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
    _replaceMap: {},


    startup: function(){
        this.enabled = ChaikaCore.pref.getBool('imageViewURLReplace.enabled');

        this._loadFile();
    },

    quit: function(){
    },


    _loadFile: function ChaikaIvur__loadFile(){
        this.rules = [];

        const IVUR_NAME = 'ImageViewURLReplace.dat';

        var file = ChaikaCore.getDataDir();
        file.appendRelativePath(IVUR_NAME);

        if(!file.exists()){
            let defaultsFile = ChaikaCore.getDefaultsDir();
            defaultsFile.appendRelativePath(IVUR_NAME);
            defaultsFile.copyTo(file.parent, null);
            file = file.clone();
        }

        var data = ChaikaCore.io.readUnknownEncodingString(file, true, 'utf-8', 'Shift_JIS');

        if(data === null){
            ChaikaCore.logger.error('Fail in converting the encoding of ImageViewURLReplace.dat');
            return;
        }

        var lines = data.replace(/\r/g, "\n").split(/\n+/);
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

        config.target = data[0];
        config.image = data[1];
        config.referrer = data[2];
        config.userAgent = data[5];

        if(data[3]){
            if(data[3].contains('$COOKIE')){
                config.cookie.shouldGet = true;
                config.cookie.referrer = data[3].split('=')[1] || '';
            }

            if(data[3].contains('$EXTRACT') && data[4]){
                config.extract.pattern = data[4];
                config.extract.referrer = data[3].split('=')[1] || '';
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
                //$EXTRACT は $EXTRACT1 を指定したものとみなされる
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
            let rule = this.rules[i];
            let match = url.match(new RegExp(rule.target));

            if(!match) continue;

            //補正文字列がない場合はブロックする
            //今後リクエストは発生しないのでこれで終わり
            if(!rule.image){
                return '';
            }


            //コピーして ivurObj を作成する
            let ivurObj = JSON.parse(JSON.stringify(rule));


            if(!ivurObj.extract.pattern){
                //$EXTRACT でないとき

                //後方参照の解決
                ivurObj.image = this._resolveBackReference(ivurObj.image, match);
                ivurObj.referrer = this._resolveBackReference(ivurObj.referrer, match);
                ivurObj.cookie.referrer = this._resolveBackReference(ivurObj.cookie.referrer, match);

                //Cookieの取得
                if(ivurObj.cookie.shouldGet){
                    let request = new ChaikaIvurRequest(ivurObj);

                    request.fetchCookie().then((cookieStr) => {
                        this._replaceMap[url].cookie.str = cookieStr;
                    }).catch((err) => {
                        ChaikaCore.logger.error('Fail to fetch cookie.', err, JSON.stringify(ivurObj));
                    });
                }
            }else{
                //後方参照の解決
                ivurObj.referrer = this._resolveBackReference(ivurObj.referrer, match);
                ivurObj.cookie.referrer = this._resolveBackReference(ivurObj.cookie.referrer, match);
                ivurObj.extract.referrer = this._resolveBackReference(ivurObj.extract.referrer, match);
                ivurObj.extract.pattern = this._resolveBackReference(ivurObj.extract.pattern, match);

                //スクレイピングにより補正文字列とCookieを取得
                let request = new ChaikaIvurRequest(ivurObj);

                request.fetchExtract().then((extractMatch) => {
                    if(!extractMatch) throw new Error('No Match.');

                    this._replaceMap[url].image =
                        this._resolveBackReference(this._replaceMap[url].image, match, extractMatch);
                }).catch((err) => {
                    ChaikaCore.logger.error('Fail to fetch $EXTRACT.', err, JSON.stringify(ivurObj));
                });
            }

            this._replaceMap[url] = ivurObj;

            return 'chaika://ivur/' + url + '?dummy_ext=.jpg';
        }

        return url;
    },


    /**
     * リファラやCookieの制御を行う
     * http-on-opening-request で呼ばれる
     */
    apply: function ChaikaIvur_apply(aHttpChannel){
        var url = aHttpChannel.URI.spec;
        var ivurObj = this._replaceMap[url];

        if(!ivurObj) return;
        if(!ivurObj.image.startsWith('http')) return;

        aHttpChannel.setRequestHeader('Referer', ivurObj.referrer, false);
        aHttpChannel.setRequestHeader('Cookie', ivurObj.cookie.str, false);
    },


    /**
     * 置き換え後の画像URLを返す
     * @param {nsIURI} aURI
     * @return {String} URL
     */
    getRedirectURI: function(aURI){
        let url = aURI.spec.replace('chaika://ivur/', '')
                           .replace('?dummy_ext=.jpg', '');

        let ivurObj = this._replaceMap[url];

        if(!ivurObj) return url;
        if(!ivurObj.image.startsWith('http')) return url;

        ChaikaCore.logger.debug('[ivur]', aURI.spec, '->', ivurObj.image);

        return ivurObj.image;
    }

};


/**
 * ImageViewURLReplace のリクエストを行う
 * @constructor
 * @private
 */
function ChaikaIvurRequest(ivurObj){
    this.init(ivurObj);
}

ChaikaIvurRequest.prototype = {

    timeout: 10 * 1000,


    init: function(ivurObj){
        this._ivurObj = ivurObj;
        this._request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
        this._request.QueryInterface(Ci.nsIDOMEventTarget).QueryInterface(Ci.nsIXMLHttpRequest);
    },


    /**
     * Cookieを取得する
     */
    fetchCookie: function(){
        return new Promise((resolve, reject) => {
            this._request.open('GET', this._ivurObj.referrer, true);

            this._request.addEventListener('error', reject, false);
            this._request.addEventListener('load', (event) => {
                let req = event.target;
                let channel = req.channel;

                if(req.status !== 200 || !req.responseText || !channel){
                    reject(req.status);
                    return;
                }

                try{
                    let cookie = channel.getResponseHeader('Set-Cookie');

                    if(!cookie){
                        reject(req.status);
                    }else{
                        resolve(cookie);
                    }
                }catch(ex){
                    reject(ex);
                }
            }, false);

            this._request.setRequestHeader('Referer', this._ivurObj.cookie.referrer);

            if(this._ivurObj.userAgent){
                this._request.setRequestHeader('User-Agent', this._ivurObj.userAgent);
            }

            this._request.send(null);
        });
    },


    /**
     * $EXTRACT に基づきスクレイピングする
     * @return {Promise.<RegExp>} スクレイピングした結果のRegExp
     */
    fetchExtract: function(){
        return new Promise((resolve, reject) => {
            this._request.open('GET', this._ivurObj.referrer, true);

            this._request.addEventListener('error', reject, false);
            this._request.addEventListener('load', (event) => {
                let req = event.target;

                if(req.status !== 200 || !req.responseText){
                    reject(req.status);
                    return;
                }

                let regexp = new RegExp(this._ivurObj.extract.pattern);

                resolve(req.responseText.match(regexp));
            }, false);

            this._request.setRequestHeader('Content-Type', 'text/html');
            this._request.setRequestHeader('Referer', this._ivurObj.extract.referrer);

            if(this._ivurObj.userAgent){
                this._request.setRequestHeader('User-Agent', this._ivurObj.userAgent);
            }

            this._request.send(null);
        });
    }
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

        var data = ChaikaCore.io.readUnknownEncodingString(ngFile, true, 'utf-8', 'Shift_JIS');

        if(data === null){
            ChaikaCore.logger.error('Fail in converting the encoding of NGFiles.txt');
            return;
        }

        var lines = data.replace(/\r/g, "\n").split(/\n+/);

        for(let i=0, l=lines.length; i<l; i++){
            data = lines[i].split(/=\*/);

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
                var byteArray = [];
                var readLength = binaryInputStream.available();

                while(readLength !== 0){
                    byteArray = byteArray.concat(binaryInputStream.readByteArray(readLength));
                    readLength = binaryInputStream.available();
                }

                var cryptoHash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
                cryptoHash.init(cryptoHash.MD5);
                cryptoHash.update(byteArray, byteArray.length);

                var hash = cryptoHash.finish(false);

                var toHexString = function(charCode){
                    return ("0" + charCode.toString(16)).slice(-2);
                };

                return Array.from(hash, (c) => toHexString(c.charCodeAt(0))).join("");
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
        md5 = md5.match(/../g);
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

                var alertStr = ChaikaCore.io.fromUTF8Octets(
                    'NGFiles.txt に基づき ' + uri.fileName + ' をブロックしました。\n説明: '
                ) + this.ngData[i].description;

                var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
                alertsService.showAlertNotification("chrome://chaika/content/icon.png", "Chaika", alertStr, false, "", null);

                return true;
            }
        }

        return false;
    },
};
