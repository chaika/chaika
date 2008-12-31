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


const B2R_PROTOCOL_HANDLER_CONTRACTID = "@mozilla.org/network/protocol;1?name=bbs2ch";
const B2R_PROTOCOL_HANDLER_CID = Components.ID("{e40dcbe9-0d0a-44c2-b135-3b2a2afe8b97}");
const B2R_PROTOCOL_HANDLER_CNAME = "b2rProtocolHandler js component";

const B2R_CONTENT_HANDLER_CONTRACTID = "@mozilla.org/uriloader/content-handler;1?type=application/x-b2r-command";
const B2R_CONTENTL_HANDLER_CID = Components.ID("{409FF8BB-32AB-49c7-AD66-8E2BA8530A49}");
const B2R_CONTENT_HANDLER_CNAME = "b2rContentHandler content handler js component";




function b2rProtocolHandler(){
	this._ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
}

b2rProtocolHandler.prototype = {

	// ********** メソッド **********

	_redirectChannel: function(aURISpec){
		var channelURI = this._ioService.newURI(aURISpec, null, null);
		return this._ioService.newChannelFromURI(channelURI);
	},


	_createStreamChannel: function(aURI, aContentType, aContentCharset){
		var content = "";
		var stream = Cc["@mozilla.org/io/string-input-stream;1"]
				.createInstance(Ci.nsIStringInputStream);
		stream.setData(content, content.length);
		var channel = Cc["@mozilla.org/network/input-stream-channel;1"]
				.createInstance(Ci.nsIInputStreamChannel)
				.QueryInterface(Ci.nsIChannel);
		channel.setURI(aURI);
		channel.contentStream = stream;
		channel.contentType = aContentType || "text/plain";
		channel.contentCharset = aContentCharset || "UTF-8";
		return channel;
	},


	// ********** implements nsIProtocolHandler **********

	scheme: "bbs2ch",
	defaultPort: -1,
		// XXX 設計を見直して URI_LOADABLE_BY_ANYONE をやめるようにする
	protocolFlags: Ci.nsIProtocolHandler.URI_NOAUTH | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,



	allowPort: function(aPort, aScheme){
		return false;
	},


	newURI: function(aSpec, aCharset, aBaseURI){
		var simpleURI = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);

		if(aBaseURI && aSpec.charAt(0)=="#"){ // アンカー付 URL
			var baseURISprc = aBaseURI.spec.replace(/#[^\/]+/, "");
			try{
				simpleURI.spec = baseURISprc + aSpec;
			}catch(ex){
				dump("ERROR: b2rProtocolHandler.newURI : " + aSpec + "\n");
				return null;
			}
		}else{ // 通常 URL
			try{
				simpleURI.spec = aSpec;
			}catch(ex){
				dump("ERROR: b2rProtocolHandler.newURI : " + aSpec + "\n");
				return null;
			}
		}
		return simpleURI;
	},


	newChannel: function(aURI){
		var mode = "";
		if(aURI.spec.match(/bbs2ch:([\w-]+:?)/)) mode = RegExp.$1;

		var tmpChannel;
		switch(mode){
			case "bbsmenu":
				tmpChannel = this._redirectChannel("chrome://chaika/content/bbsmenu/page.xul");
				break;
			case "board:":
				tmpChannel = this._redirectChannel("chrome://chaika/content/board/page.xul");
				break;
			default:
				tmpChannel = this._createStreamChannel(aURI, "application/x-b2r-command");
				break;
		}

		return tmpChannel;
	},


	// ********** ********* implements nsISupports ********** **********

	QueryInterface: function(aIID){
		if(aIID.equals(Ci.nsIProtocolHandler)) return this;
		if(aIID.equals(Ci.nsISupports)) return this;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	}

};



function b2rContentHandler(){
}

b2rContentHandler.prototype = {

	// ********** implements nsIContentHandler **********

	handleContent: function(aContentType, aWindowContext, aRequest){
		var channel = aRequest.QueryInterface(Ci.nsIChannel);
		var uriSpec = channel.URI.spec;
		var mode = uriSpec.match(/bbs2ch:(\w+:?)/) ? RegExp.$1 : "";
		var targetURLSpec = uriSpec.match(/bbs2ch:[^:]+:(.+)/) ? RegExp.$1 : "";
		if(targetURLSpec && !this._checkOpenURL(targetURLSpec)){
			return;
		}

		switch(mode){
			case "post:": // 書き込みウィザード
				this._openPostWizaed(targetURLSpec);
				break;
			case "void": // 何もしない
				break;
			default:
				break;
		}
	},


	_openPostWizaed: function(aURLSpec){
		var argString = Cc["@mozilla.org/supports-string;1"]
				.createInstance(Ci.nsISupportsString);
		argString.data = aURLSpec;
		var winWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Ci.nsIWindowWatcher);
		winWatcher.openWindow(null, "chrome://chaika/content/post-wizard.xul",
				"_blank", "chrome, resizable, dialog", argString);
	},


	_checkOpenURL: function(aURLSpec){
		var datID = (aURLSpec.match(/\/(\d{9,10})/)) ? RegExp.$1 : null;
		if(!datID){
			return false;
		}
			// ブラウザウィンドウを列挙
		var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
								.getService(Ci.nsIWindowMediator);
		var browserWinEnu = windowMediator.getEnumerator("navigator:browser");
		while(browserWinEnu.hasMoreElements()){
			var browserWin = browserWinEnu.getNext();
			if(!("gBrowser" in browserWin)) continue;
			var browserTabLength = browserWin.gBrowser.mTabContainer.childNodes.length;
			for(let i=0; i<browserTabLength; i++){
				var currentURLSpec = browserWin.gBrowser.getBrowserAtIndex(i).currentURI.spec;
				if(currentURLSpec.indexOf(datID) != -1){
					return true;
				}
			}
		}
		return false;
	},


	// ********** ********* implements nsISupports ********** **********

	QueryInterface: function(aIID){
		if(aIID.equals(Ci.nsIContentHandler)) return this;
		if(aIID.equals(Ci.nsISupports)) return this;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	}

};



// ********** ********* Component Registration ********** **********

var b2rProtocolHandlerFactory = {

	createInstance: function (aOuter, aIID){
		if(aOuter != null)
			throw Components.results.NS_ERROR_NO_AGGREGATION;

		if(aIID.equals(Ci.nsIProtocolHandler))
			return new b2rProtocolHandler().QueryInterface(aIID);
		if(aIID.equals(Ci.nsISupports))
			return new b2rProtocolHandler().QueryInterface(aIID);

		throw Components.results.NS_ERROR_INVALID_ARG;
	}

};


var b2rContentHandlerFactory = {

	createInstance: function (aOuter, aIID){
		if(aOuter != null)
			throw Components.results.NS_ERROR_NO_AGGREGATION;

		if(aIID.equals(Ci.nsIContentHandler))
			return new b2rContentHandler().QueryInterface(aIID);
		if(aIID.equals(Ci.nsISupports))
			return new b2rContentHandler().QueryInterface(aIID);

		throw Components.results.NS_ERROR_INVALID_ARG;
	}

};


var Module = {

	registerSelf: function(aCompMgr, aFileSpec, aLocation, aType){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);

		aCompMgr.registerFactoryLocation(
						B2R_PROTOCOL_HANDLER_CID,
						B2R_PROTOCOL_HANDLER_CNAME,
						B2R_PROTOCOL_HANDLER_CONTRACTID,
						aFileSpec, aLocation, aType);

		aCompMgr.registerFactoryLocation(
						B2R_CONTENTL_HANDLER_CID,
						B2R_CONTENT_HANDLER_CNAME,
						B2R_CONTENT_HANDLER_CONTRACTID,
						aFileSpec, aLocation, aType);
	},


	unregisterSelf: function(aCompMgr, aFileSpec, aLocation){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
	},


	getClassObject: function(aCompMgr, aCID, aIID){
		if(aCID.equals(B2R_PROTOCOL_HANDLER_CID)) return b2rProtocolHandlerFactory;
		if(aCID.equals(B2R_CONTENTL_HANDLER_CID)) return b2rContentHandlerFactory;

		if(!aIID.equals(Ci.nsIFactory))
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	},


	canUnload: function(aCompMgr){
		return true;
	}

};


function NSGetModule(aCompMgr, aFileSpec){
	return Module;
}