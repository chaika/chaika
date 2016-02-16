/* See license.txt for terms of usage */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://chaika-modules/utils/Logger.js");


this.EXPORTED_SYMBOLS = ["ChaikaServer"];


var gServerScriptList = [];


/** @ignore */
function makeException(aResult, aMessage){
    var stack = Components.stack.caller.caller;
    return new Components.Exception(aMessage || "exception", aResult, stack);
}


/** @ignore */
function sleep(aWait) {
    var timerCallback = {
        notify: function(aTimer){
            this.timeup = true;
        },
        timeup: false
    };

    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(timerCallback, aWait, Ci.nsITimer.TYPE_ONE_SHOT);

    var mainThread = Cc["@mozilla.org/thread-manager;1"].getService().mainThread;
    while(!timerCallback.timeup){
        mainThread.processNextEvent(true);
    }
}




var ChaikaServer = {

    _listening: false,


    /**
     * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
     * @private
     */
    _startup: function(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.addObserver(this, "network:offline-status-changed", false);

        try{
            Components.utils.import("resource://chaika-modules/server/skin.js");
            Components.utils.import("resource://chaika-modules/server/thread.js");
            gServerScriptList["skin"]   = SkinServerScript;
            gServerScriptList["thread"] = ThreadServerScript;
        }catch(ex){
            Logger.error(ex);
        }

        this._start();
    },


    /**
     * ブラウザ終了時に一度だけ実行され、終了処理を行う。
     * @private
     */
    _quit: function(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.removeObserver(this, "network:offline-status-changed");

        this._stop();

        // Restore the original port number.
        if(this._origPort){
            Services.prefs.setIntPref('extensions.chaika.server.port', this._origPort);
        }
    },


    get serverURL(){
        if(!this._serverURL){
            let port = Services.prefs.getIntPref('extensions.chaika.server.port');

            this._serverURL = Services.io.newURI('http://127.0.0.1:' + port, null, null);
        }

        return this._serverURL.clone().QueryInterface(Ci.nsIURL);
    },


    _invalidateServerURL: function(){
        this._stop();
        this._serverURL = null;
    },


    _start: function(){
        if(this._listening){
            Logger.warn("chaika is already listening port " + this.serverURL.port);
            return;
        }

        // port randomization
        if(Services.prefs.getBoolPref('extensions.chaika.server.port.randomization')){
            // Use one of the private ports
            Services.prefs.setIntPref('extensions.chaika.server.port', 49513 + Math.floor(16000 * Math.random()));
        }

        try{
            // Listen the port to establish the local server
            let url = this.serverURL;

            this._socket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);
            this._socket.init(url.port, true, 10);
            this._socket.asyncListen(this);

            this._listening = true;
            Logger.info("Start listening port " + url.port);
        }catch(ex){
            // Reject listening the port.
            if(Services.prefs.getBoolPref('extensions.chaika.server.port.retry')){
                let port = this.serverURL.port;

                // Save the original port number to restore it during shutting down.
                if(!this._origPort){
                    this._origPort = port;
                }

                Logger.info('Fail to listen port ' + port + '. Try another one.');

                // Find another port.
                Services.prefs.setIntPref('extensions.chaika.server.port', port + 1);

                // Retry.
                this._invalidateServerURL();
                this._start();
            }else{
                Logger.fatal('Cannot establish the local server bacause port ' + this.serverURL.port +
                             ' is not available!');
                this._stop();
            }
        }
    },


    _stop: function(){
        if(this._listening && this._socket){
            this._socket.close();
            this._socket = null;
            this._listening = false;
        }
    },


    observe: function(aSubject, aTopic, aData){
        if(aTopic == "network:offline-status-changed"){
            if(aData == "online"){
                this._start();
            }else{
                this._stop();
            }
        }
    },


    // ********** ********* implements nsIServerSocketListener ********** **********

    onSocketAccepted: function(aServerSocket, aTransport){
        (new ChaikaServerHandler(aTransport));
    },


    onStopListening: function(aServerSocket, aStatus){
        Logger.info("Stop Listening");
    },


    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIServerSocketListener,
        Ci.nsIObserver,
        Ci.nsISupportsWeakReference,
        Ci.nsISupports
    ])

};




function ChaikaServerHandler(aTransport){
    this._init(aTransport);
}


ChaikaServerHandler.prototype = {

    _init: function ChaikaServerHandler__init(aTransport){
        this.isAlive = false;

        aTransport.setTimeout(Ci.nsISocketTransport.TIMEOUT_CONNECT, 30);
        aTransport.setTimeout(Ci.nsISocketTransport.TIMEOUT_READ_WRITE, 30);

        this._transport = aTransport;

        var inputStream = aTransport.openInputStream(0, 1024*8, 1024)
                                .QueryInterface(Ci.nsIAsyncInputStream);
        var mainThread = Cc["@mozilla.org/thread-manager;1"].getService().mainThread;
        inputStream.asyncWait(this, 0, 0, mainThread);
        //var inputStream = aTransport.openInputStream(0, 1024*8, 1024);
        //this.onInputStreamReady(inputStream);
    },


    onInputStreamReady: function ChaikaServerHandler_onInputStreamReady(aInputStream){
        var outputStream = this._transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING,
                1024*512, 1024).QueryInterface(Ci.nsIAsyncOutputStream);

        var mainThread = Cc["@mozilla.org/thread-manager;1"].getService().mainThread;
        outputStream.asyncWait(this, Ci.nsIAsyncOutputStream.WAIT_CLOSURE_ONLY, 0, mainThread);

        this.response = new ChaikaServerResponse(outputStream);
        this.isAlive = true;

        try{
            this.request = new ChaikaServerRequest(aInputStream);
        }catch(ex){
            Logger.error(ex);

            aInputStream.close();
            this.sendErrorPage(400, "Invalid Request");
            return;
        }

        this._startScript();
    },


    _startScript: function ChaikaServerHandler__startScript(){
        this.response.setHeader("Host",         this.request.url.host);
        this.response.setHeader("Date",         (new Date()).toUTCString());
        this.response.setHeader("Content-Type", "text/plain; charset=UTF-8");
        this.response.setHeader("Connection",   "close");


        if(this.request.method != "GET"){
            this.sendErrorPage(501, this.request.method + " Is Not Implemented");
            return;
        }

        var mode = (this.request.url.directory.match(/^\/([^\/]+)\//)) ? RegExp.$1 : null;
        if(!mode){
            this.sendErrorPage(404, this.request.url.spec);
            return;
        }

        if(!gServerScriptList[mode]){
            this.sendErrorPage(404, this.request.url.spec);
            return;
        }

        try{
            this._script = new gServerScriptList[mode]();
            this._script.start(this);
        }catch(ex){
            Logger.error(ex);
            var message = (typeof(ex) == "string") ? ex :
                    (ex.message + "\n" + ex.fileName +" : "+ ex.lineNumber);
            this.sendErrorPage(500, message);
        }
    },


    close: function ChaikaServerHandler_close(){
        if(this.isAlive){
            if(this.response){
                this.response.close();
                this.response = null;
            }
            if(this.request){
                this.request.close();
                this.request = null;
            }
            this._transport = null;
        }
        this.isAlive = false;
        this._script = null;
    },


    onCancelled: function ChaikaServerHandler_onCancelled(){
        if(this._script){
            Logger.warn("Cancelled");
            this._script.cancel();
            this._script = null;
        }

        this.close();
    },


    sendErrorPage: function ChaikaServerHandler_sendErrorPage(aStatusCode, aMessage){
        var message = aMessage || "";

        this.response.setHeader("Content-Type", "text/html; charset=UTF-8");
        this.response.writeHeaders(aStatusCode);

        var status = StatusCode.getStatusCode(aStatusCode);

        var html =
            "<html>" +
            "<head><title>" + status + "[ChaikaServer]</title></head>" +
            "<body><h1>" + status + "</h1><pre>" + message + "</pre></body>" +
            "</html>";

        this.response.write(html);
        this.close();
    },


    // ********** ********* implements nsIOutputStreamCallback ********** **********

    onOutputStreamReady: function ChaikaServerHandler_onOutputStreamReady(aStream){
        if(this.isAlive){
            this.onCancelled();
        }

        this.close();
    },


    // ********** ********* implements nsISupports ********** **********

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIInputStreamCallback,
        Ci.nsIOutputStreamCallback,
        Ci.nsISupportsWeakReference,
        Ci.nsISupports
    ])
}




function ChaikaServerRequest(aInputStream){
    this.stream = aInputStream;

    this.requestLine = null;
    this.method = null;
    this.url = null;
    this.httpVersion = null;
    this.headers = [];
    this.queries = [];

    this._init();
};


ChaikaServerRequest.prototype = {

    _init: function ChaikaServerRequest__init(){
        var binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
                .createInstance(Ci.nsIBinaryInputStream);
        binaryStream.setInputStream(this.stream);

        sleep(0);
        var data = binaryStream.readBytes(this.stream.available());
        for(var i=0; i<10; i++){
            if(data.indexOf("\r\n\r\n") != -1) break;
            sleep(0);
            data += binaryStream.readBytes(this.stream.available());
        }

        if(data.indexOf("\r\n\r\n") == -1){
            throw makeException(Cr.NS_ERROR_INVALID_ARG, "Invalid Request");
        }

        var lines = data.split("\r\n");
        this.requestLine = lines.shift();

            // リクエストラインの解析
        var urlSpec;
        if((/(.+) (.+) (HTTP\/\d+\.\d+)/).test(this.requestLine)){
            this.method = RegExp.$1;
            urlSpec = RegExp.$2;
            this.httpVersion = RegExp.$3;
        }else{
            throw makeException(Cr.NS_ERROR_INVALID_ARG, "Invalid Request");
        }

        try{
            var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
            var baseURI = ChaikaServer.serverURL;
            this.url = ioService.newURI(urlSpec, null, baseURI).QueryInterface(Ci.nsIURL);
        }catch(ex){
            throw makeException(Cr.NS_ERROR_INVALID_ARG, "Invalid Request");
        }


            // リクエストヘッダの解析
        var headerReg = /([^: ]+)[: ]+(.+)/;
        for each (var line in lines){
            if(line == "") break;
            if(headerReg.test(line)){
                this.headers[RegExp.$1] = RegExp.$2;
            }
        }


            // リクエスト URL クエリの解析
        var queries = this.url.query.split("&");
        for each (var item in queries){
            var query = item.split("=");
            this.queries[query[0]] = query[1];
        }
    },


    close: function ChaikaServerResponse_close(){
        this.stream.close();
        this.stream = null;
    }

};




function ChaikaServerResponse(aTransport){
    this.stream = null;
    this.headers = [];

    this._init(aTransport);
}


ChaikaServerResponse.prototype = {

    _init: function ChaikaServerResponse__init(aOutputStream){
        this.stream = aOutputStream;
    },


    setHeader: function ChaikaServerResponse_setHeader(aName, aValue){
        if(aValue === null){
            if(aName in this.headers){
                delete this.headers[aName];
            }
        }else{
            this.headers[aName] = aValue;
        }
    },


    writeHeaders: function ChaikaServerResponse_writeHeaders(aStatusCode){
        var response = [];
        response.push("HTTP/1.1 " + StatusCode.getStatusCode(aStatusCode));

        for(var i in this.headers){
            response.push(i + ": " + this.headers[i]);
        }

        this.write(response.join("\r\n") + "\r\n\r\n");
    },


    write: function ChaikaServerResponse_write(aString){
        sleep(0);

        if(this.stream){
            this.stream.write(aString, aString.length);
        }else{
            Logger.warn("Stream Closed");
        }
    },


    flush: function ChaikaServerResponse_flush(){
        sleep(0);

        if(this.stream){
            this.stream.flush();
        }else{
            Logger.warn("Stream Closed");
        }
    },


    close: function ChaikaServerResponse_close(){
        this.stream.close();
        this.stream = null;
    }

};




var StatusCode = {

    getStatusCode: function(aCode){
        if(!this._statusCode){
            this._statusCode = new Array();

            this._statusCode["s100"] = "100 Continue";
            this._statusCode["s101"] = "101 Switching Protocols";
            this._statusCode["s102"] = "102 Processing";

            this._statusCode["s200"] = "200 OK";
            this._statusCode["s201"] = "201 Created";
            this._statusCode["s202"] = "202 Accepted";
            this._statusCode["s203"] = "203 Non-Authoritative Information";
            this._statusCode["s204"] = "204 No Content";
            this._statusCode["s205"] = "205 Reset Content";
            this._statusCode["s206"] = "206 Partial Content";
            this._statusCode["s207"] = "207 Multi-Status";
            this._statusCode["s226"] = "226 IM Used";

            this._statusCode["s300"] = "300 Multiple Choices";
            this._statusCode["s301"] = "301 Moved Permanently";
            this._statusCode["s302"] = "302 Found";
            this._statusCode["s303"] = "303 See Other";
            this._statusCode["s304"] = "304 Not Modified";
            this._statusCode["s305"] = "305 Use Proxy";
            this._statusCode["s306"] = "306 (Unused)";
            this._statusCode["s307"] = "307 Temporary Redirect";
            this._statusCode["s400"] = "400 Bad Request";
            this._statusCode["s401"] = "401 Unauthorized";
            this._statusCode["s402"] = "402 Payment Required";
            this._statusCode["s403"] = "403 Forbidden";
            this._statusCode["s404"] = "404 Not Found";
            this._statusCode["s405"] = "405 Method Not Allowed";
            this._statusCode["s406"] = "406 Not Acceptable";
            this._statusCode["s407"] = "407 Proxy Authentication Required";
            this._statusCode["s408"] = "408 Request Timeout";
            this._statusCode["s409"] = "409 Conflict";
            this._statusCode["s410"] = "410 Gone";
            this._statusCode["s411"] = "411 Length Required";
            this._statusCode["s412"] = "412 Precondition Failed";
            this._statusCode["s413"] = "413 Request Entity Too Large";
            this._statusCode["s414"] = "414 Request-URI Too Long";
            this._statusCode["s415"] = "415 Unsupported Media Type";
            this._statusCode["s416"] = "416 Requested Range Not Satisfiable";
            this._statusCode["s417"] = "417 Expectation Failed";
            this._statusCode["s418"] = "418 I'm a teapot";
            this._statusCode["s422"] = "422 Unprocessable Entity";
            this._statusCode["s423"] = "423 Locked";
            this._statusCode["s424"] = "424 Failed Dependency";
            this._statusCode["s426"] = "426 Upgrade Required";

            this._statusCode["s500"] = "500 Internal Server Error";
            this._statusCode["s501"] = "501 Not Implemented";
            this._statusCode["s502"] = "502 Bad Gateway";
            this._statusCode["s503"] = "503 Service Unavailable";
            this._statusCode["s504"] = "504 Gateway Timeout";
            this._statusCode["s505"] = "505 HTTP Version Not Supported";
            this._statusCode["s506"] = "506 Variant Also Negotiates";
            this._statusCode["s507"] = "507 Insufficient Storage";
            this._statusCode["s510"] = "510 Not Extended";
        }

        if(this._statusCode["s" + aCode]){
            return this._statusCode["s" + aCode];
        }

        // throw "Not Difined Response Code";
        return "200 OK";
    }

};
