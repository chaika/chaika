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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

var gService = null;


function ChaikaService(){

}

ChaikaService.prototype = {

	_startup: function ChaikaService__startup(){
		Components.utils.import("resource://chaika-modules/ChaikaCore.js");
		ChaikaCore._startup();

		Components.utils.import("resource://chaika-modules/Chaika2chViewer.js");
		Chaika2chViewer._startup();

		Components.utils.import("resource://chaika-modules/ChaikaServer.js");
		ChaikaServer._startup();

		Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");
		ChaikaAboneManager._startup();


		Components.utils.import("resource://chaika-modules/ChaikaThread.js");
		Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
	},


	_quitApp: function ChaikaService__quitApp(){
		ChaikaAboneManager._quit();
		ChaikaCore._quit();
		Chaika2chViewer._quit();
		ChaikaServer._quit();
	},


	_shutdown: function ChaikaService__shutdown(){
	},


	// ********** ********* implements chIChaikaService ********** **********


	isSupportedThread: function ChaikaService_isSupportedThread(aThreadURL){
		try{
			return ChaikaBoard.getBoardType(aThreadURL) != ChaikaBoard.BOARD_TYPE_PAGE;
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return false;
	},


	getThreadLineCount: function ChaikaService_getThreadLineCount(aThreadURL){
		try{
			return (new ChaikaThread(aThreadURL)).lineCount;
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return 0;
	},


	openBoard: function ChaikaService_openBoard(aBoardURL, aAddTab){
		try{
			return ChaikaCore.browser.openBoard(aBoardURL, aAddTab);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return null;
	},


	getBoardURI: function ChaikaService_getBoardURI(aBoardURL){
		try{
			return ChaikaCore.browser._getBoardURI(aBoardURL);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return null;
	},


	openThread: function ChaikaService_openThread(aThreadURL, aAddTab, aReplaceViewLimit){
		try{
			return ChaikaCore.browser.openThread(aThreadURL, aAddTab, aReplaceViewLimit, false);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return null;
	},


	getThreadURL: function ChaikaService_getThreadURL(aThreadURL, aReplaceViewLimit){
		try{
			return ChaikaCore.browser._getThreadURL(aThreadURL, aReplaceViewLimit, false);
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

		return null;
	},


	// ********** ********* implements nsIObserver ********** **********

	observe: function ChaikaService_observe(aSubject, aTopic, aData){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

		switch(aTopic){
			case "app-startup":
				os.addObserver(this, "profile-after-change", false);
				os.addObserver(this, "quit-application", false);
				os.addObserver(this, "xpcom-shutdown", false);
				break;
			case "profile-after-change":
				this._startup();
				os.removeObserver(this, "profile-after-change");
				os.notifyObservers(null, "ChaikaService:startup", "startup");
				break;
			case "quit-application":
				os.removeObserver(this, "quit-application");
				os.notifyObservers(null, "ChaikaService:quit", "quit");
				this._quitApp();
				break;
			case "xpcom-shutdown":
				os.removeObserver(this, "xpcom-shutdown");
				this._shutdown();
				break;
		}
	},


	// ********** ********* XPCOMUtils Component Registration ********** **********

	classDescription: "ChaikaService js component",
	contractID: "@chaika.xrea.jp/chaika-service;1",
	classID: Components.ID("{1a48801d-18c1-4d5f-9fed-03b2aeded9f9}"),
	_xpcom_categories: [{ category: "app-startup", service: true }],
	_xpcom_factory: {
		createInstance: function(aOuter, aIID) {
			if(aOuter != null) throw Cr.NS_ERROR_NO_AGGREGATION;
			if(!gService) gService = new ChaikaService();

			return gService.QueryInterface(aIID);
		}
	},
	QueryInterface: XPCOMUtils.generateQI([
		Ci.chIChaikaService,
		Ci.nsISupportsWeakReference,
		Ci.nsIObserver,
		Ci.nsISupports
	])
};


function NSGetModule(aCompMgr, aFileSpec){
	return XPCOMUtils.generateModule([ChaikaService]);
}