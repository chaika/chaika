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

const Ci = Components.interfaces;
const Cc = Components.classes;
const XPC = {
	createInstance: function(aContractId, aInterface){
		return Components.classes[aContractId].createInstance(Components.interfaces[aInterface]);
	},
	getService: function(aContractId, aInterface){
	    return Components.classes[aContractId].getService(Components.interfaces[aInterface]);
	}
}


const B2R_SERVER_CONTRACTID = "@bbs2ch.sourceforge.jp/b2r-server;1";
const B2R_SERVER_CID = Components.ID("{f99671cf-868a-4e46-a849-a7bf35a878d7}");
const B2R_SERVER_CNAME = "b2rServer js component";




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




// ********** ********* b2rServer ********** **********

function b2rServer(){
	this._listening = false;
}

b2rServer.prototype = {

	get currentThread(){
		return this._thread;
	},

	start: function(){
		if(this._listening){
			dump("b2rServer.start : Is Running\n");
			return;
		}

		var port = XPC.getService("@mozilla.org/bbs2ch-service;1", "nsIBbs2chService").serverURL.port;
		var serverSocket = XPC.createInstance("@mozilla.org/network/server-socket;1", "nsIServerSocket");
		serverSocket.init(port, true, 10);
		serverSocket.asyncListen(this);

		dump("b2rServer.run : Start Listening Port " +  port + "\n");
	},

	stop: function(){
		if(this._listening){
	        this._thread.interrupt();
	        this._thread = null;
       		dump("b2rServer.stop\n");
		}
	},


  	// ********** ********* implements nsIServerSocketListener ********** **********

	onSocketAccepted: function(aServerSocket, aTransport){
		aTransport.setTimeout(Ci.nsITransport.TIMEOUT_CONNECT, 30);
		aTransport.setTimeout(Ci.nsITransport.TIMEOUT_READ_WRITE, 30);

		var input = aTransport.openInputStream(0, 1024*8, 1024).QueryInterface(Ci.nsIAsyncInputStream);
		var output = XPC.createInstance("@mozilla.org/network/buffered-output-stream;1", "nsIBufferedOutputStream");
		output.init(aTransport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 1024*32, 1024), 1024*128);

		new b2rServerHandler(aServerSocket.port, input, output);
		// dump("b2rServer.onSocketAccepted\n");
	},

	onStopListening: function(aServerSocket, aStatus) {
		// dump("b2rServer.onStopListening\n");
	},


	// ********** ********* implements nsIObserver ********** **********

	observe: function(aSubject, aTopic, aData){
		var os = XPC.getService("@mozilla.org/observer-service;1", "nsIObserverService");

		switch(aTopic){
			case "app-startup":
				os.addObserver(this, "network:offline-status-changed", false);
				os.addObserver(this, "final-ui-startup", false);
				os.addObserver(this, "xpcom-shutdown", false);
				break;
			case "network:offline-status-changed":
				if(aData == "online"){
					this.start();
				}else{
					this.stop();
				}
				break;
		    case "final-ui-startup":
				os.removeObserver(this, "final-ui-startup");
				this.start();
				break;
			case "xpcom-shutdown":
				this.stop();
				os.removeObserver(this, "xpcom-shutdown");
				os.removeObserver(this, "network:offline-status-changed");
				break;
		}
	},


	// ********** ********* implements nsISupports ********** **********

	QueryInterface: function(aIID){
		if(aIID.equals(Ci.nsIServerSocket)) return this;
		if(aIID.equals(Ci.nsIServerSocketListener)) return this;
		if(aIID.equals(Ci.nsIRunnable)) return this;
		if(aIID.equals(Ci.nsIObserver)) return this;
		if(aIID.equals(Ci.nsISupportsWeakReference)) return this;
		if(aIID.equals(Ci.nsISupports)) return this;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	}

};


// ********** ********* b2rServerHandler ********** **********

function b2rServerHandler(aPort, aInput, aOutput){
	this._init(aPort, aInput, aOutput);
}


b2rServerHandler.prototype = {

	get method(){
		return this._method;
	},
	get httpVersion(){
		return this._httpVersion;
	},
	get requestHeaders(){
		return this._requestHeaders;
	},
	get responseHeaders(){
		return this._responseHeaders;
	},
	get requestURL(){
		return this._requestURL;
	},
	get getData(){
		return this._getData;
	},

	_init: function(aPort, aInput, aOutput){
		this._port = aPort;

		this._input = aInput;
		this._output = aOutput;

		this._isAlive = true;

		this._method = "";
		this._httpVersion = "";
		this._requestHeaders = new Array();
		this._responseHeaders = new Array();
		this._requestURL = null;
		this._getData = new Array();

		this._requestBuffer = "";
		this._input.asyncWait(this, 0, 0, this._getMainThread());
	},

	_getMainThread: function(){
		if ("@mozilla.org/thread-manager;1" in Components.classes) {
			// Firefox 3
			return Cc["@mozilla.org/thread-manager;1"].getService().mainThread;
		} else {
			// Firefox 2
			var eventQueueService = XPC.getService("@mozilla.org/event-queue-service;1", "nsIEventQueueService");
			return eventQueueService.getSpecialEventQueue(Ci.nsIEventQueueService.UI_THREAD_EVENT_QUEUE);
		}
	},

	onInputStreamReady: function(aInput){
		var available = aInput.available();
		var bInputStream = XPC.createInstance("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
		bInputStream.setInputStream(aInput);
		this._requestBuffer += bInputStream.readBytes(available);
		if((/\r\n\r\n/).test(this._requestBuffer)){
			this._parseRequestData();
		}else{
			this._input.asyncWait(this, 0, 0, this._getMainThread());
		}
	},

	_parseRequestData: function(){
		var lines = this._requestBuffer.split("\r\n");
		this._requestBuffer = "";
		var headerLine = lines.shift();

			// リクエストヘッダ部分
		for(let [i, line] in Iterator(lines)){
			if(line == "") break;
			if(line.match(/([^: ]+)[: ]*(.+)/i)){
				this._requestHeaders[RegExp.$1] = RegExp.$2;
			}
		}

		var uri = "";
		if(headerLine.match(/(.+) (.+) (.+)/)){
			this._method = RegExp.$1;
			uri = RegExp.$2;
			this._httpVersion = RegExp.$3;
		}

		var ioService = XPC.getService("@mozilla.org/network/io-service;1", "nsIIOService");
		try{
			var baseURI = ioService.newURI("http://127.0.0.1:" + this._port, null, null);
			this._requestURL = ioService.newURI(uri, null, baseURI).QueryInterface(Ci.nsIURL);
		}catch(ex){}

		if(this._requestURL){
			var tmpqueries = this._requestURL.query.split("&");
			for(var i=0; i<tmpqueries.length; i++){
				var query = tmpqueries[i].split("=");
				this._getData[query[0]] = query[1];
			}
		}

		this._responseHeaders["Host"] = this.requestURL.host;
		this._responseHeaders["Date"] = new Date().toUTCString();
		this._responseHeaders["Content-Type"] = "text/plain; charset=UTF-8";
		this._responseHeaders["Connection"] = "close";
		this._startScript();
	},


	_startScript: function(){
		if(this.method != "GET"){
			this.sendErrorPage(501, this.method + " Is Not Implemented");
			return;
		}

		var mode = (this.requestURL.directory.match(/^\/([^\/]+)\//)) ? RegExp.$1 : null;
		if(!mode){
			this.sendErrorPage(404, this.requestURL.spec);
			return;
		}

		var scriptURL = "chrome://chaika/content/server/%MODE%.js";
		scriptURL = scriptURL.replace("%MODE%", mode);

		var subScrLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
		try{
			this._scope = { script:null };
			try{
				subScrLoader.loadSubScript(scriptURL, this._scope);
			}catch(ex if ex instanceof SyntaxError){
				var message = ex.message + "\n" + ex.fileName +" : "+ ex.lineNumber;
				this.sendErrorPage(500, message);
				return;
			}catch(ex){
				this.sendErrorPage(404, this.requestURL.spec);
				return;
			}
			this._scope.script.start(this);
		}catch(ex){
			var message = (typeof(ex) == "string") ? ex : ex.message + "\n" + ex.fileName +" : "+ ex.lineNumber;
			this.sendErrorPage(500, message);
		}
	},

	write: function(aString){
		if(this._isAlive){
			var str = String(aString);
			this._output.write(str, str.length);
		}else if(this._scope && this._scope.script){
			this._scope.script.cancel();
			this._scope = null;
		}
	},

	flush: function(aString){
		if(this._isAlive){
			this._output.flush();
		}
	},

	setResponseHeader: function(aName, aValue){
		if(aValue === null){
			if(aName in this._responseHeaders){
				delete this._responseHeaders[aName];
			}
		}else{
			this._responseHeaders[aName] = aValue;
		}
	},

	writeResponseHeader: function(aStatusCode){
		this.write("HTTP/1.1 " + StatusCode.getStatusCode(aStatusCode) + "\r\n");
		for(var i in this._responseHeaders){
			this.write(i + ": " + this._responseHeaders[i] + "\r\n");
		}
		this.write("\r\n");
	},

	close: function(){
		if(this._isAlive){
			this._output.close();
			this._input.close();
			this._output = null;
			this._input = null;
		}
		this._isAlive = false;
		this._scope = null;
	},

	sendErrorPage: function(aStatusCode, aMessage){
		var message = aMessage||"";

		this.setResponseHeader("Content-Type", "text/html; charset=UTF-8");
		this.writeResponseHeader(aStatusCode);

		var status = StatusCode.getStatusCode(aStatusCode);

		var html = <html>
			<head><title>{status} [bbs2chserver]</title></head>
			<body>
				<h1>{status}</h1>
				<pre>{message}</pre>
			</body>
		</html>;

		this.write(html.toXMLString());
		this.close();
	}

}


// ********** ********* Component Registration ********** **********


var Factory = {

	createInstance: function (aOuter, aIID) {
		if(aOuter != null) throw Components.results.NS_ERROR_NO_AGGREGATION;

		if(aIID.equals(Ci.nsIServerSocket))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsIServerSocketListener))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsIRunnable))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsIObserver))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsISupportsWeakReference))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsISupports))
			return this.getInstance(aIID);

		throw Components.results.NS_ERROR_NO_INTERFACE;
	},

	getInstance: function(aIID){
		if(!this._instance){
			this._instance = new b2rServer();
		}
		return this._instance.QueryInterface(aIID);
	}

};


var ComponentModule = {

	CONTRACTID: "@mozilla.org/b2r-server;1",
	CID: Components.ID("{f99671cf-868a-4e46-a849-a7bf35a878d7}"),
	CNAME: "b2rServer JS Component",


	registerSelf: function(aCompMgr, aFileSpec, aLocation, aType){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);

		aCompMgr.registerFactoryLocation(B2R_SERVER_CID, B2R_SERVER_CNAME, B2R_SERVER_CONTRACTID,
											aFileSpec, aLocation, aType);

		var categoryManager = XPC.getService("@mozilla.org/categorymanager;1", "nsICategoryManager");
		categoryManager.addCategoryEntry("app-startup", B2R_SERVER_CNAME, B2R_SERVER_CONTRACTID, true, true);
	},


	unregisterSelf: function(aCompMgr, aFileSpec, aLocation){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
		aCompMgr.unregisterFactoryLocation(B2R_SERVER_CID, aFileSpec);

		var categoryManager = XPC.getService("@mozilla.org/categorymanager;1", "nsICategoryManager");
		categoryManager.deleteCategoryEntry("app-startup", B2R_SERVER_CONTRACTID, true);
	},


	getClassObject: function(aCompMgr, aCID, aIID){
		if(aCID.equals(B2R_SERVER_CID))
				return Factory;

		if(!aIID.equals(Ci.nsIFactory))
				throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	},


	canUnload: function(aCompMgr){
		return true;
	}

};


function NSGetModule(aCompMgr, aFileSpec){
	return ComponentModule;
}
