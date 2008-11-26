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


// ********** ********* b2rThreadRedirector ********** **********

const Ci = Components.interfaces;
const Cc = Components.classes;


function b2rThreadRedirector(){
	this._init();
}


b2rThreadRedirector.prototype = {

	/**
	 * Iitialize b2rThreadRedirector
	 */
	_init: function(){
		this._PREF_ENABLED = "extensions.chaika.thread_redirector.enabled";
		this._PREF_ASK = "extensions.chaika.thread_redirector.ask";
		this._PREF_THROW_BOOKMARKS = "extensions.chaika.thread_redirector.throw_bookmarks";

		this._observerService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
		this._pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);

		this._enabled = this._pref.getBoolPref(this._PREF_ENABLED);
	},


	// ********** ********* implements nsIObserver ********** **********

	observe: function(aSubject, aTopic, aData){
		switch(aTopic){
			case "app-startup":
				this._pref.addObserver(this._PREF_ENABLED, this, false);
				this._observerService.addObserver(this, "xpcom-shutdown", false);
				this._observerService.addObserver(this, "profile-after-change", false);
				break;

			case "xpcom-shutdown":
				this._pref.removeObserver(this._PREF_ENABLED, this);
				this._observerService.removeObserver(this, "xpcom-shutdown");
				break;

			case "profile-after-change":
				if(this._enabled){
					var categoryManager = Cc["@mozilla.org/categorymanager;1"]
								.getService(Ci.nsICategoryManager);
					categoryManager.addCategoryEntry("content-policy", ComponentModule.CONTRACTID,
											ComponentModule.CONTRACTID, true, true);
				}
				this._observerService.removeObserver(this, "profile-after-change");
				break;

			case "nsPref:changed":
				if(aData == this._PREF_ENABLED){
					this._enabled = this._pref.getBoolPref(this._PREF_ENABLED);
				}
				break;
		}
	},


	// ********** ********* implements nsIContentPolicy ********** **********

	TYPE_OTHER			: Ci.nsIContentPolicy.TYPE_OTHER,
	TYPE_SCRIPT			: Ci.nsIContentPolicy.TYPE_SCRIPT,
	TYPE_IMAGE			: Ci.nsIContentPolicy.TYPE_IMAGE,
	TYPE_STYLESHEET		: Ci.nsIContentPolicy.TYPE_STYLESHEET,
	TYPE_OBJECT			: Ci.nsIContentPolicy.TYPE_OBJECT,
	TYPE_DOCUMENT		: Ci.nsIContentPolicy.TYPE_DOCUMENT,
	TYPE_SUBDOCUMENT	: Ci.nsIContentPolicy.TYPE_SUBDOCUMENT,
	TYPE_REFRESH		: Ci.nsIContentPolicy.TYPE_REFRESH,
	ACCEPT				: Ci.nsIContentPolicy.ACCEPT,
	REJECT_REQUEST		: Ci.nsIContentPolicy.REJECT_REQUEST,
	REJECT_TYPE			: Ci.nsIContentPolicy.REJECT_TYPE,
	REJECT_SERVER		: Ci.nsIContentPolicy.REJECT_SERVER,
	REJECT_OTHER		: Ci.nsIContentPolicy.REJECT_OTHER,


	shouldLoad: function(aContentType, aContentLocation, aRequestOrigin,
											aContext, aMimeTypeGuess, aExtra){

		if(!this._enabled) return this.ACCEPT;
		if(aContentType != this.TYPE_DOCUMENT) return this.ACCEPT;
		if(aContentLocation.scheme.substring(0, 4) != "http") return this.ACCEPT;

		var host = aContentLocation.host;
		if(host.indexOf(".2ch.net")==-1 && host.indexOf(".bbspink.com")==-1 &&
				host!="jbbs.livedoor.jp"){
			return this.ACCEPT;
		}


		if(this._pref.getBoolPref(this._PREF_THROW_BOOKMARKS)){
			if(aRequestOrigin.host == "127.0.0.1" || aRequestOrigin.scheme == "chrome"){
				return this.ACCEPT;
			}
		}

			// Be Profile Page
		if(aContentLocation.spec.indexOf("http://be.2ch.net/test/p.php") != -1){
			return this.ACCEPT;
		}

		if(aContentLocation.spec.indexOf("/read.cgi/") != -1){
			var viewB2r = true;
			var ask = this._pref.getBoolPref(this._PREF_ASK);

			if(ask){
				var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Ci.nsIPromptService);
				var dialogTitle = "bbs2chreader";
				var dialogText = "Do you want to view it in bbs2chreader?\n" +
										aContentLocation.spec +"\n";
				var checkText = "Don't ask me this again";
				var notAskCheck = { value: false };
				viewB2r = (promptService.confirmEx(null, dialogTitle, dialogText,
								promptService.STD_YES_NO_BUTTONS, null, null, null,
								checkText, notAskCheck) == 0);
				if(notAskCheck.value){
					this._pref.setBoolPref(this._PREF_ASK, false);
					this._pref.setBoolPref(this._PREF_ENABLED, viewB2r);
				}
			}

			if(viewB2r){
				var bbs2chService = Cc["@mozilla.org/bbs2ch-service;1"]
							.getService(Ci.nsIBbs2chService);
				var serverURL = "./thread/" + aContentLocation.spec;
				serverURL = bbs2chService.serverURL.resolve(serverURL);
				aContentLocation.spec = serverURL;
			}
		}

		return this.ACCEPT;
	},


	shouldProcess: function(aContentType, aContentLocation, aRequestOrigin,
											aContext, aMimeTypeGuess, aExtra){
		return this.ACCEPT;
	},


	// ********** ********* implements nsISupports ********** **********

	QueryInterface: function(aIID){
		if(aIID.equals(Ci.nsIContentPolicy)) return this;
		if(aIID.equals(Ci.nsISupportsWeakReference)) return this;
		if(aIID.equals(Ci.nsIObserver)) return this;
		if(aIID.equals(Ci.nsISupports)) return this;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	}

}




// ********** ********* nsSimpleAdFilter Factory ********** **********


var b2rThreadRedirectorFactory = {

	createInstance: function (aOuter, aIID) {
		if(aOuter != null) throw Components.results.NS_ERROR_NO_AGGREGATION;

		if(aIID.equals(Ci.nsIContentPolicy))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsISupportsWeakReference))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsIObserver))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsISupports))
			return this.getInstance(aIID);

		throw Components.results.NS_ERROR_INVALID_ARG;
	},

	getInstance: function(aIID){
		if(!this._instance){
			this._instance = new b2rThreadRedirector();
		}
		return this._instance.QueryInterface(aIID);
	}

}


// ********** ********* Component Registration ********** **********


var ComponentModule = {

	CONTRACTID: "@mozilla.org/b2r-thread-redirector;1",
	CID: Components.ID("{0f937a10-3bbc-468f-8e16-81e6d8caae3e}"),
	CNAME: "b2rThreadRedirector JS Component",


	registerSelf: function(aCompMgr, aFileSpec, aLocation, aType){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);

		aCompMgr.registerFactoryLocation(this.CID, this.CNAME, this.CONTRACTID,
											aFileSpec, aLocation, aType);

		var categoryManager = Cc["@mozilla.org/categorymanager;1"]
					.getService(Ci.nsICategoryManager);
		categoryManager.addCategoryEntry("app-startup", this.CONTRACTID,
											this.CONTRACTID, true, true);

	},


	unregisterSelf: function(aCompMgr, aFileSpec, aLocation){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
		aCompMgr.unregisterFactoryLocation(this.CID, aFileSpec);

		var categoryManager = Cc["@mozilla.org/categorymanager;1"]
					.getService(Ci.nsICategoryManager);
		categoryManager.deleteCategoryEntry("app-startup", this.CONTRACTID, true);
	},


	getClassObject: function(aCompMgr, aCID, aIID){
		if(aCID.equals(this.CID))
				return b2rThreadRedirectorFactory;

		if(!aIID.equals(Ci.nsIFactory))
				throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	},


	canUnload: function(aCompMgr){
		return true;
	}

}


function NSGetModule(aCompMgr, aFileSpec){
	return ComponentModule;
}
