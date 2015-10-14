/* See license.txt for terms of usage */


this.EXPORTED_SYMBOLS = ["ChaikaDownloader", "ChaikaSimpleDownloader"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const PR_PERMS_DIR = 0755;
const PR_PERMS_FILE = 0644;
const PR_RDONLY = 0x01;
const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_APPEND = 0x10;
const PR_TRUNCATE = 0x20;

// nsNetError.h
const NS_ERROR_MODULE_NETWORK      = 2152398848;
const NS_BINDING_ABORTED           = NS_ERROR_MODULE_NETWORK + 2;
const NS_ERROR_NET_TIMEOUT         = NS_ERROR_MODULE_NETWORK + 14;
const NS_ERROR_UNKNOWN_HOST        = NS_ERROR_MODULE_NETWORK + 30;
const NS_ERROR_REDIRECT_LOOP       = NS_ERROR_MODULE_NETWORK + 31;
const NS_ERROR_DOCUMENT_NOT_CACHED = NS_ERROR_MODULE_NETWORK + 70;


/** @ignore */
function makeException(aResult){
    var stack = Components.stack.caller.caller;
    return new Components.Exception("exception", aResult, stack);
}


/**
 * シンプルなダウンローダオブジェクト。
 * @constructor
 * @param {nsIURL} aURL 保存する URL
 * @param {nsIFile} aFile 保存先ファイル
 */
function ChaikaDownloader(aURL, aFile){
    if(!(aURL instanceof Ci.nsIURL)){
        throw makeException(Cr.NS_ERROR_INVALID_POINTER);
    }
    if(!(aFile instanceof Ci.nsIFile)){
        throw makeException(Cr.NS_ERROR_INVALID_POINTER);
    }

    this.url = aURL;
    this.file = aFile;

    this.loading = false;
}


ChaikaDownloader.prototype = {

    /**
     * ダウンロード元 URL。
     * @type nsIURL
     */
    url: null,


    /**
     * ダウンロード先ファイル。
     * @type nsIFile
     */
    file: null,


    /**
     * ダウンロード中なら真。
     * @type Boolean
     */
    loading: false,


    /**
     * ダウンロードを開始する。
     */
    download: function ChaikaDownloader_download(){
        this.loading = false;

        try{
            try{
                if(!this.file.parent.exists()){
                    this.file.parent.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIR);
                }
            }catch(ex){
                ChaikaCore.logger.error(ex);
                this.onError(this, ChaikaDownloader.ERROR_BAD_FILE);
                return;
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
            this.onError(this, ChaikaDownloader.ERROR_BAD_FILE);
            return;
        }

        this.wrappedJSObject = this;

        this._httpChannel = ChaikaCore.getHttpChannel(this.url);
        this._httpChannel.requestMethod = "GET";
        this._httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
        this._httpChannel.loadFlags |= Ci.nsIHttpChannel.LOAD_BYPASS_CACHE;
        this._httpChannel.asyncOpen(this._listener, this);
    },


    /** @private */
    _listener: {

        /** @private */
        onStartRequest: function ChaikaDownloader__listener_onStartRequest(aRequest, aContext) {
            var context = aContext.wrappedJSObject;

            context.loading = true;
            context.onStart(context);

            context._data = [];
        },

        /** @private */
        onDataAvailable: function ChaikaDownloader__listener_onDataAvailable(aRequest,
                                        aContext, aStream, aSourceOffset, aLength) {
            if(aLength == 0) return;

            var context = aContext.wrappedJSObject;

            aRequest.QueryInterface(Ci.nsIHttpChannel);
            var httpStatus = aRequest.responseStatus;


            if(aRequest.contentLength != -1){
                var percentage = Math.floor((aSourceOffset * 100.0) / aRequest.contentLength);
                context.onProgressChange(context, percentage);
            }


            var inputStream = Cc["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Ci.nsIBinaryInputStream);
            inputStream.setInputStream(aStream);
            context._data.push(inputStream.readBytes(aLength));
        },

        /** @private */
        onStopRequest: function ChaikaDownloader__listener_onStopRequest(aRequest,
                                        aContext, aStatus){
            var context = aContext.wrappedJSObject;
            context.loading = false;

            aRequest.QueryInterface(Ci.nsIHttpChannel);


            if(aStatus == 0){
                try{
                    var outputStream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
                        .createInstance(Ci.nsIFileOutputStream)
                            .QueryInterface(Ci.nsISafeOutputStream);
                    var ioFlag = PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE;
                    outputStream.init(context.file, ioFlag, PR_PERMS_FILE, 0);

                    var data = context._data.join("");
                    context._data = null;
                    outputStream.write(data, data.length);
                    outputStream.finish();
                    outputStream.close();
                }catch(ex){
                    ChaikaCore.logger.error(ex);
                }
                context.onStop(context, aRequest.responseStatus);
            }else if(aStatus == NS_ERROR_REDIRECT_LOOP){
                context.onStop(context, aRequest.responseStatus);
            }else if(aStatus == NS_BINDING_ABORTED){
                // キャンセル
            }else{
                ChaikaCore.logger.error([aRequest.URI.spec, aStatus.toString(16)]);
                        // TODO 詳細なエラーを出す
                context.onError(context, ChaikaDownloader.ERROR_FAILURE);
            }
        },

        /** @private */
        QueryInterface: XPCOMUtils.generateQI([
            Ci.nsIStreamListener,
            Ci.nsISupportsWeakReference,
            Ci.nsISupports
        ])
    },


    /**
     * ダウンロードを中止する。
     * @param {Boolean} aSilent 真なら ERROR_CANCEL エラーを発生させない。
     */
    abort: function ChaikaDownloader_abort(aSilent){
        try{
            this._httpChannel.cancel(NS_BINDING_ABORTED);
            this._httpChannel = null;
        }catch(ex){}

        if(!aSilent) this.onError(this, ChaikaDownloader.ERROR_CANCEL);

        this._clearEventHandler();

        this.loading = false;
    },


    _clearEventHandler: function ChaikaDownloader__clearEventHandler(){
        this.onStart = function(aDownloader){};
        this.onStop = function(aDownloader, aStatus){};
        this.onProgressChange = function(aDownloader, aPercentage){};
        this.onError = function(aDownloader, aErrorCode){};
    },


    /**
     * ダウンロード開始時に呼ばれる。
     * @param {ChaikaDownloader} aDownloader
     */
    onStart: function(aDownloader){},
    /**
     * ダウンロード終了時に呼ばれる。
     * @param {ChaikaDownloader} aDownloader
     * @param {Number} aStatus リクエストの HTTP ステータス
     */
    onStop: function(aDownloader, aStatus){},
    /**
     * プログレスの変更時に呼ばれる。
     * @param {ChaikaDownloader} aDownloader
     * @param {Number} aPercentage 進行率
     */
    onProgressChange: function(aDownloader, aPercentage){},
    /**
     * ダウンロードの失敗時に呼ばれる。
     * @param {ChaikaDownloader} aDownloader
     * @param {Number} aErrorCode エラーコード(ERROR_XXX)
     */
    onError: function(aDownloader, aErrorCode){}
};


/**
 * 不正な URL。
 * @constant
 */
ChaikaDownloader.ERROR_BAD_URL      = 1;
/**
 * 不正なファイル。
 * @constant
 */
ChaikaDownloader.ERROR_BAD_FILE     = 2;
/**
 * リクエストの失敗。
 * @constant
 */
ChaikaDownloader.ERROR_FAILURE      = 3;
/**
 * タイムアウト。
 * @constant
 */
ChaikaDownloader.ERROR_NET_TIMEOUT  = 4;
/**
 * 接続先が見付からない。
 * @constant
 */
ChaikaDownloader.ERROR_UNKNOWN_HOST = 5;
/**
 * キャッシュがない(オフライン)。
 * @constant
 */
ChaikaDownloader.ERROR_NOT_CACHED   = 6;
/**
 * キャンセルされた。
 * @constant
 */
ChaikaDownloader.ERROR_CANCEL       = 7;




function ChaikaSimpleDownloader(){
    this.loading = false;
}


ChaikaSimpleDownloader.prototype = {

    download: function ChaikaSimpleDownloader_download(aURL, aCharset, aObserver){
        if(!(aURL instanceof Ci.nsIURL)){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }
        if(typeof aObserver != "object"){
            throw makeException(Cr.NS_ERROR_INVALID_POINTER);
        }

        if(this._channel){
            this.abort(true);
        }

        this._charset = aCharset;
        this._observer = Components.utils.getWeakReference(aObserver);

        this._streamLoader = Cc["@mozilla.org/network/stream-loader;1"]
                .createInstance(Ci.nsIStreamLoader);
        this._streamLoader.init(this);

        this._channel = ChaikaCore.getHttpChannel(aURL);
        this._channel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
            // LOAD_BYPASS_CACHE : キャッシュを使用しない
            // LOAD_ANONYMOUS    : cookie を渡さない
        this._channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE | Ci.nsIRequest.LOAD_ANONYMOUS;
        this._channel.requestMethod = "GET";

        this.loading = true;
        this.wrappedJSObject = this;
        this._channel.asyncOpen(this._streamLoader, this);
    },


    onStreamComplete: function ChaikaSimpleDownloader_onStreamComplete(
                                    aLoader, aContext, aStatus, aLength, aResult){
        var context = aContext.wrappedJSObject;

        switch(aStatus){
            case 0:
                try{
                    var response = context._readResponse(aResult);
                }catch(ex){
                    ChaikaCore.logger.error("failure: " + ex);
                    context._onError(ChaikaSimpleDownloader.ERROR_FAILURE);
                    break;
                }
                context._onStop(response, context._channel.responseStatus);
                break;

            case NS_ERROR_REDIRECT_LOOP:
                context._onStop(null, context._channel.responseStatus);
                break;

            case NS_BINDING_ABORTED:
                // キャンセル
                break;

            case NS_ERROR_UNKNOWN_HOST:
                ChaikaCore.logger.error("unknown host: " + context._channel.URI.spec);
                context._onError(ChaikaSimpleDownloader.ERROR_UNKNOWN_HOST);
                break;

            case NS_ERROR_DOCUMENT_NOT_CACHED:
                ChaikaCore.logger.error("not cached: " + context._channel.URI.spec);
                context._onError(ChaikaSimpleDownloader.ERROR_NOT_CACHED);
                break;

            default:
                ChaikaCore.logger.error("failure: " + context._channel.URI.spec);
                context._onError(ChaikaSimpleDownloader.ERROR_FAILURE);
                break;
        }


        this.loading = false;
        this._channel = null;
        this._streamLoader = null
    },


    _readResponse: function ChaikaSimpleDownloader__readResponse(aResult){
        var storageStream = Cc["@mozilla.org/storagestream;1"]
                .createInstance(Ci.nsIStorageStream);
        var binaryOutputStream = Cc["@mozilla.org/binaryoutputstream;1"]
                .createInstance(Ci.nsIBinaryOutputStream);
        var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
                .createInstance(Ci.nsIConverterInputStream);

        storageStream.init(1024*8, -1, null);
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));
        binaryOutputStream.writeByteArray(aResult, aResult.length);

        try{
            converterInputStream.init(storageStream.newInputStream(0), this._charset, 0, 0);
        }catch(ex){
            ChaikaCore.logger.warning("invalid Charser: " + this._charset);
            converterInputStream.init(storageStream.newInputStream(0), "UTF-8", 0, 0);
        }

        var str = {};
        var result = [];
        while (converterInputStream.readString(1024*32, str) != 0){
          result.push(str.value);
        }

        converterInputStream.close();
        binaryOutputStream.close();

        return result.join("");
    },


    _onStop: function ChaikaSimpleDownloader__onStop(aResponse, aHttpStatus){
        var observer = this._observer.get();
        if(observer && observer.onStop){
            observer.onStop(this, aResponse, aHttpStatus);
        }
    },


    _onError: function ChaikaSimpleDownloader__onError(aErrorCode){
        var observer = this._observer.get();
        if(observer && observer.onError){
            observer.onError(this, aErrorCode);
        }
    },


    /**
     * ダウンロードを中止する。
     * @param {Boolean} aSilent 真なら ERROR_CANCEL エラーを発生させない。
     */
    abort: function ChaikaSimpleDownloader_abort(aSilent){
        if(!this.loading) return;

        try{
            this._channel.cancel(NS_BINDING_ABORTED);
            this._channel = null;
            this._streamLoader = null
        }catch(ex){}

        if(!aSilent) this._onError(ChaikaSimpleDownloader.ERROR_CANCEL);

        this.loading = false;
    },

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIStreamLoaderObserver,
        Ci.nsISupportsWeakReference,
        Ci.nsISupports
    ]),

};

/**
 * 不正な URL。
 * @constant
 */
ChaikaSimpleDownloader.ERROR_BAD_URL      = 1;
/**
 * リクエストの失敗。
 * @constant
 */
ChaikaSimpleDownloader.ERROR_FAILURE      = 3;
/**
 * タイムアウト。
 * @constant
 */
ChaikaSimpleDownloader.ERROR_NET_TIMEOUT  = 4;
/**
 * 接続先が見付からない。
 * @constant
 */
ChaikaSimpleDownloader.ERROR_UNKNOWN_HOST = 5;
/**
 * キャッシュがない(オフライン)。
 * @constant
 */
ChaikaSimpleDownloader.ERROR_NOT_CACHED   = 6;
/**
 * キャンセルされた。
 * @constant
 */
ChaikaSimpleDownloader.ERROR_CANCEL       = 7;
