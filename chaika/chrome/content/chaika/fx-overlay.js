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


var b2rBrowserOverlay = {};


b2rBrowserOverlay.contextMenu = {

	get prefBranch(){
		if(!this._prefBranch){
			this._prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
								.getService(Components.interfaces.nsIPrefBranch);
		}
		return this._prefBranch;
	},
	_prefBranch: null,


	start: function(){
		var enableContextMenu = true;
		try{
			enableContextMenu = b2rBrowserOverlay.contextMenu.prefBranch.getBoolPref(
									"extensions.chaika.enable_browser_contextmenu");
		}catch(ex){}

		if(enableContextMenu){
			document.getElementById("contentAreaContextMenu")
						.addEventListener("popupshowing",
								b2rBrowserOverlay.contextMenu.showMenu, false);
		}
	},

	stop: function(){
		document.getElementById("contentAreaContextMenu")
					.removeEventListener("popupshowing",
							b2rBrowserOverlay.contextMenu.showMenu, false);
	},


	showMenu: function(aEvent){
		if(aEvent.originalTarget.id != "contentAreaContextMenu") return;
		document.getElementById("context-bbs2chreader").hidden = true;

		if(!gContextMenu || !gContextMenu.onLink) return;

		var pathname = gContextMenu.link.pathname;
		if(pathname.indexOf("/test/read.cgi/")==-1 &&
				pathname.indexOf("/bbs/read.cgi/")==-1) return;

		document.getElementById("context-bbs2chreader").hidden = false;
	},


	openThread: function(aNewTab){

		if(!gContextMenu || !gContextMenu.onLink) return;

		var bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
					.getService(Components.interfaces.nsIBbs2chService);
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);

		var threadURLSpec = gContextMenu.link.href;

				// スレッド表示数の制限
		var disregardURLOption = bbs2chService.pref.getBoolPref(
						"extensions.chaika.browser_contextmenu_disregard_url_option");
		var type = bbs2chService.getBoardType(threadURLSpec);
		if(disregardURLOption && (type != bbs2chService.BOARD_TYPE_MACHI)){
			var threadURL = ioService.newURI(threadURLSpec, null, null)
					.QueryInterface(Components.interfaces.nsIURL);
			var threadViewLimit = Number(bbs2chService.pref.getIntPref(
						"extensions.chaika.board_thread_view_limit"));
			if(isNaN(threadViewLimit) || threadViewLimit == 0){
				threadViewLimit = "./";
			}else{
				threadViewLimit = "./l" + threadViewLimit;
			}
			threadURLSpec = threadURL.resolve(threadViewLimit);
		}

		threadURLSpec = bbs2chService.serverURL.resolve("./thread/" + threadURLSpec);

		if(aNewTab){
			var newTab = gBrowser.addTab(threadURLSpec, null);
				// 新しいタブをアクティブにするか
			var tabLoadInForeground = false;
			try{
				tabLoadInForeground = this.prefBranch.getBoolPref(
							"extensions.chaika.tab_load_in_foreground");
			}catch(ex){}
			if(tabLoadInForeground) gBrowser.selectedTab = newTab; 
		}else{
			gBrowser.loadURI(threadURLSpec, null);
		}
	}

};


b2rBrowserOverlay.statusbar = {

	start: function(){
		getBrowser().addProgressListener(b2rBrowserOverlay.statusbar.webProgress, 
						Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
	},


	stop: function(){
		getBrowser().removeProgressListener(b2rBrowserOverlay.statusbar.webProgress, 
						Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
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


b2rBrowserOverlay.aboneEvent = {
	start: function(){
		var os = Components.classes["@mozilla.org/observer-service;1"]
					.getService(Components.interfaces.nsIObserverService);
		os.addObserver(b2rBrowserOverlay.aboneEvent, "b2r-abone-data-add", false);
	},

	stop: function(){
		var os = Components.classes["@mozilla.org/observer-service;1"]
					.getService(Components.interfaces.nsIObserverService);
		os.removeObserver(b2rBrowserOverlay.aboneEvent, "b2r-abone-data-add", false);
	},

	observe: function(aSubject, aTopic, aData){
		var aboneType;
		switch(aTopic){
			case "b2r-abone-data-add":
				aboneType = aSubject.QueryInterface(Components.interfaces.nsISupportsPRInt32).data;
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


window.addEventListener("load",   b2rBrowserOverlay.contextMenu.start, false);
window.addEventListener("unload", b2rBrowserOverlay.contextMenu.stop, false);
window.addEventListener("load",   b2rBrowserOverlay.statusbar.start, false);
window.addEventListener("unload", b2rBrowserOverlay.statusbar.stop, false);
window.addEventListener("load",   b2rBrowserOverlay.aboneEvent.start, false);
window.addEventListener("unload", b2rBrowserOverlay.aboneEvent.stop, false);