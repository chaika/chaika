Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/Chaika2chViewer.js");

var gMaruPane = {

	startup: function(){
		setCcontainerDisabled("extensions.chaika.maru_enabled", "boxMaru", true);

		var os = Components.classes["@mozilla.org/observer-service;1"]
					.getService(Components.interfaces.nsIObserverService);
		os.addObserver(this, "Chaika2chViewer:Auth", false);
	},

	shutdown: function(){
		var os = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
		os.removeObserver(this, "Chaika2chViewer:Auth");
	},

	maruAuth: function(){
		document.getElementById("btnAuth").disabled = true;

		Chaika2chViewer.auth();
	},


  	// ********** ********* implements nsIObserver ********** **********

	observe: function(aSubject, aTopic, aData){
		if(aTopic == "Chaika2chViewer:Auth"){
			if(aData == "OK"){
				alert("2ch ビューアへのログインに成功しました。");
			}else if(aData == "NG"){
				alert("2ch ビューアへのログインに失敗しました。\n" +
						"ID と パスワードを確認してください。");
			}
			document.getElementById("btnAuth").disabled = false;
		}
	},
}