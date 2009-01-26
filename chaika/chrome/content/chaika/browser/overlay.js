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
		document.getElementById("context-chaika").hidden = true;

		if(!gContextMenu || !gContextMenu.onLink) return;

		var pathname = gContextMenu.link.pathname;
		if(pathname.indexOf("/test/read.cgi/")==-1 &&
				pathname.indexOf("/bbs/read.cgi/")==-1) return;

		document.getElementById("context-chaika").hidden = false;
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
			var b2rstatusbar = document.getElementById("statusbar-chaika");
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