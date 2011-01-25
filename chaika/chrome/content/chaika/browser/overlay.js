var ChaikaBrowserOverlay = {

	start: function ChaikaBrowserOverlay_start(){
		ChaikaBrowserOverlay.contextMenu.start();
		ChaikaBrowserOverlay.threadToolbar.start();
		ChaikaBrowserOverlay.aboneEvent.start();
	},


	stop: function ChaikaBrowserOverlay_stop(){
		ChaikaBrowserOverlay.contextMenu.stop();
		ChaikaBrowserOverlay.threadToolbar.stop();
		ChaikaBrowserOverlay.aboneEvent.stop();
	}

};


Components.utils.import("resource://chaika-modules/ChaikaCore.js", ChaikaBrowserOverlay);


ChaikaBrowserOverlay.contextMenu = {

	start: function contextMenu_start(){
		var enableContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool(
				"enable_browser_contextmenu");

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
				pathname.indexOf("/test/read.html/")==-1 &&
				pathname.indexOf("/bbs/read.cgi/")==-1) return;

		document.getElementById("context-chaika").hidden = false;
	},


	openThread: function contextMenu_openThread(aAddTab){
		if(!gContextMenu || !gContextMenu.onLink) return;

				// スレッド表示数の制限
		var disregardURLOption = ChaikaBrowserOverlay.ChaikaCore.pref.getBool(
				"browser_contextmenu_disregard_url_option");

		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		try{
			var threadURLSpec = gContextMenu.link.href;
			threadURLSpec = threadURLSpec.replace("/test/read.html/", "/test/read.cgi/");
			var threadURL = ioService.newURI(threadURLSpec, null, null);
			ChaikaBrowserOverlay.ChaikaCore.browser.openThread(
					threadURL, aAddTab, disregardURLOption, false);
		}catch(ex){
			ChaikaBrowserOverlay.ChaikaCore.logger.error(ex);
			return;
		}
	}

};




ChaikaBrowserOverlay.threadToolbar = {

	start: function statusbar_start(){
		getBrowser().addProgressListener(ChaikaBrowserOverlay.threadToolbar.webProgress,
						Ci.nsIWebProgress.NOTIFY_LOCATION);
	},


	stop: function statusbar_stop(){
		getBrowser().removeProgressListener(ChaikaBrowserOverlay.threadToolbar.webProgress,
						Ci.nsIWebProgress.NOTIFY_LOCATION);
	},


	webProgress: {
		onLocationChange: function(aWebProgress, aRequest, aLocation){
			setTimeout(function(){
				var threadToolbarItem = document.getElementById("chaika-thread-toolbaritem");
				threadToolbarItem.showCheck();
			}, 0);
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


window.addEventListener("load",   ChaikaBrowserOverlay.start, false);
window.addEventListener("unload", ChaikaBrowserOverlay.stop, false);