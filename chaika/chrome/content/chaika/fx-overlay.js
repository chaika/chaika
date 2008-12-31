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

Components.utils.import("resource://chaika-modules/ChaikaCore.js");

var ChaikaBrowserOverlay = {};

ChaikaBrowserOverlay.contextMenu = {

	start: function contextMenu_start(){
		var enableContextMenu = ChaikaCore.pref.getBool("enable_browser_contextmenu");

		if(enableContextMenu){
			document.getElementById("contentAreaContextMenu")
						.addEventListener("popupshowing",
							ChaikaBrowserOverlay.contextMenu.showMenu, false);
		}
	},


	stop: function contextMenu_stop(){
		try{
			document.getElementById("contentAreaContextMenu")
						.removeEventListener("popupshowing",
							ChaikaBrowserOverlay.contextMenu.showMenu, false);
		}catch(ex){}
	},


	showMenu: function contextMenu_showMenu(aEvent){
		if(aEvent.originalTarget.id != "contentAreaContextMenu") return;
		document.getElementById("context-bbs2chreader").hidden = true;

		if(!gContextMenu || !gContextMenu.onLink) return;

		var pathname = gContextMenu.link.pathname;
		if(pathname.indexOf("/test/read.cgi/")==-1 &&
				pathname.indexOf("/bbs/read.cgi/")==-1) return;

		document.getElementById("context-bbs2chreader").hidden = false;
	},


	openThread: function contextMenu_openThread(aAddTab){
		if(!gContextMenu || !gContextMenu.onLink) return;

				// スレッド表示数の制限
		var disregardURLOption = ChaikaCore.pref.getBool(
				"browser_contextmenu_disregard_url_option");

		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		try{
			var threadURL = ioService.newURI(gContextMenu.link, null, null);
			ChaikaCore.browser.openThread(threadURL, aAddTab, disregardURLOption, false);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			return;
		}
	}

};




ChaikaBrowserOverlay.statusbar = {

	start: function statusbar_start(){
		getBrowser().addProgressListener(ChaikaBrowserOverlay.statusbar.webProgress,
						Ci.nsIWebProgress.NOTIFY_LOCATION);
	},


	stop: function statusbar_stop(){
		getBrowser().removeProgressListener(ChaikaBrowserOverlay.statusbar.webProgress,
						Ci.nsIWebProgress.NOTIFY_LOCATION);
	},


	webProgress: {
		onLocationChange: function(aWebProgress, aRequest, aLocation){
			var b2rstatusbar = document.getElementById("statusbar-bbs2chreader");
			b2rstatusbar.showCheck();
		},
		onStateChange: function(){},
		onProgressChange: function(){},
		onStatusChange: function(){},
		onSecurityChange: function(){},
		onLinkIconAvailable: function(){}
	}

};




ChaikaBrowserOverlay.aboneEvent = {

	start: function aboneEvent_start(){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.addObserver(ChaikaBrowserOverlay.aboneEvent, "b2r-abone-data-add", false);
	},


	stop: function aboneEvent_stop(){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		os.removeObserver(ChaikaBrowserOverlay.aboneEvent, "b2r-abone-data-add", false);
	},


	observe: function aboneEvent_observe(aSubject, aTopic, aData){
		var aboneType;
		switch(aTopic){
			case "b2r-abone-data-add":
				aboneType = aSubject.QueryInterface(Ci.nsISupportsPRInt32).data;
				break;
			default:
				return;
		}
		for(var i = 0; i < gBrowser.mPanelContainer.childNodes.length; i++){
			var currentURI = gBrowser.getBrowserAtIndex(i).currentURI;
			if((currentURI.scheme=="http") && (currentURI.host=="127.0.0.1")){
				var doc = gBrowser.getBrowserAtIndex(i).contentDocument;
				var win = gBrowser.getBrowserAtIndex(i).contentWindow;
				var sourceEvent = doc.createEvent("Events");
				sourceEvent.initEvent(aData, false, false);
				var event = document.createEvent('XULCommandEvents');
				event.initCommandEvent("b2raboneadd", true, false, win, aboneType,
										false, false, false, false, sourceEvent);
				doc.dispatchEvent(event);
			}
		}
	}

}


window.addEventListener("load",   ChaikaBrowserOverlay.contextMenu.start, false);
window.addEventListener("unload", ChaikaBrowserOverlay.contextMenu.stop, false);
window.addEventListener("load",   ChaikaBrowserOverlay.statusbar.start, false);
window.addEventListener("unload", ChaikaBrowserOverlay.statusbar.stop, false);
window.addEventListener("load",   ChaikaBrowserOverlay.aboneEvent.start, false);
window.addEventListener("unload", ChaikaBrowserOverlay.aboneEvent.stop, false);