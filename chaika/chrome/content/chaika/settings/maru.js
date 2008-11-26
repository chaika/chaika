var gMaruPane = {

	startup: function(){
		setCcontainerDisabled("extensions.chaika.maru_enabled",
				"boxMaru", true);

		var os = Components.classes["@mozilla.org/observer-service;1"]
					.getService(Components.interfaces.nsIObserverService);
		os.addObserver(this, "b2r-2ch-viewer-auth", false);
	},

	shutdown: function(){
		var os = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
		os.removeObserver(this, "b2r-2ch-viewer-auth");
	},

	maruAuth: function(){
		document.getElementById("btnAuth").disabled = true;

		var bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
					.getService(Components.interfaces.nsIBbs2chService);
		bbs2chService.maruAuth(true);
	},


  	// ********** ********* implements nsIObserver ********** **********

	observe: function(aSubject, aTopic, aData){
		if(aTopic == "b2r-2ch-viewer-auth"){
			if(aData == "OK"){
				alert("OK");
			}
			document.getElementById("btnAuth").disabled = false;
		}
	},
}