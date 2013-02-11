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

	/**
	 * ログインマネージャからパスワードを取得してセットする
	 */
	setPasswordBox: function(){
		var account = Chaika2chViewer.getLoginInfo();
		return account.password;
	},

	/**
	 * パスワードをログインマネージャに登録し、設定値には空文字列を登録するようにする
	 * 変更の反映処理等を効率的に行うためにダミーの設定項目を使用する
	 */
	setPasswordPref: function(){
		var id = document.getElementById('txtMaruID').value;
		var pass = document.getElementById('txtMaruPass').value;

		Chaika2chViewer.setLoginInfo(id, pass);

		return '';
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
