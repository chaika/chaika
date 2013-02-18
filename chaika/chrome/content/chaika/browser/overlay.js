var ChaikaBrowserOverlay = {

	_initCount: 0,

	start: function ChaikaBrowserOverlay_start(){
		//10s待ってもChaikaCoreが初期化されていなかったら
		//初期化は失敗したものとみなす
		if(ChaikaBrowserOverlay._initCount > 100){
			return;
		}

		if(ChaikaBrowserOverlay.ChaikaCore.initialized){
			ChaikaBrowserOverlay.contextMenu.start();
			ChaikaBrowserOverlay.threadToolbar.start();
			ChaikaBrowserOverlay.aboneEvent.start();

			//リリースノートの表示
			setTimeout(function(){ ChaikaBrowserOverlay._showReleaseNotes(); }, 0);
		}else{
			ChaikaBrowserOverlay._initCount++;
			setTimeout(ChaikaBrowserOverlay.start, 100);
		}
	},


	stop: function ChaikaBrowserOverlay_stop(){
		ChaikaBrowserOverlay.contextMenu.stop();
		ChaikaBrowserOverlay.threadToolbar.stop();
		ChaikaBrowserOverlay.aboneEvent.stop();
	},


	/**
	 * ブラウザ起動時のウィンドウロード後に一度だけ実行される
	 * バージョン更新時にのみ自動的にリリースノートを表示する
	 */
	_showReleaseNotes: function ChaikaBrowserOverlay__showReleaseNotes(){
		//現在のバージョン
		var currentVersion = ChaikaBrowserOverlay.ChaikaAddonInfo.version.split('.');

		//前回リリースノートを表示した時のバージョン
		var showedVersion = ChaikaBrowserOverlay.ChaikaCore.pref.getChar('releasenotes_showed').split('.');

		for(let i=0; i<currentVersion.length; i++){
			if(currentVersion[i] > ( showedVersion[i] || 0 )){
				gBrowser.selectedTab = gBrowser.addTab('chaika://releasenotes/?updated=1');
				ChaikaBrowserOverlay.ChaikaCore.pref.setChar('releasenotes_showed', currentVersion.join('.'));
				break;
			}
		}
	},

};


Components.utils.import("resource://chaika-modules/ChaikaCore.js", ChaikaBrowserOverlay);
Components.utils.import("resource://chaika-modules/ChaikaBoard.js", ChaikaBrowserOverlay);
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js", ChaikaBrowserOverlay);
Components.utils.import('resource://chaika-modules/ChaikaAddonInfo.js', ChaikaBrowserOverlay);


ChaikaBrowserOverlay.contextMenu = {

	start: function contextMenu_start(){
		var contextMenu = document.getElementById('context-chaika');
		var enableContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool("enable_browser_contextmenu");

		if(enableContextMenu){
			contextMenu.hidden = false;
			this._createSkinMenu();
			document.getElementById("contentAreaContextMenu")
						.addEventListener("popupshowing",
							ChaikaBrowserOverlay.contextMenu.showMenu, false);
		}else{
			contextMenu.hidden = true;
		}
	},


	stop: function contextMenu_stop(){
		var enableContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool("enable_browser_contextmenu");

		if(enableContextMenu){
			document.getElementById('context-chaika').hidden = true;
			this._destorySkinMenu();
			document.getElementById("contentAreaContextMenu")
						.removeEventListener("popupshowing",
							ChaikaBrowserOverlay.contextMenu.showMenu, false);
		}
	},


	_createSkinMenu: function contextMenu__createSkinMenu(){
		var skinMenu = document.getElementById("context-chaika-skin");

		//初期化
		var skinItems = skinMenu.getElementsByClassName('context-chaika-skin-item');
		while(skinItems.length){
			skinMenu.menupopup.removeChild(skinItems[0]);
		}

		//デフォルトスキン
		var defaultItem = skinMenu.insertItemAt(0, "(Default)", "");
		defaultItem.setAttribute('class', 'context-chaika-skin-item');
		defaultItem.setAttribute('name', 'context-chaika-skin-item');
		defaultItem.setAttribute('type', 'radio');
		defaultItem.addEventListener('command', this._setSkin, false);

		//その他のスキン
		var skinDir = this._getSkinDir();
		var entries = skinDir.directoryEntries
				.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
		while(entry = entries.nextFile){
			if(entry.isDirectory()){
				let item = skinMenu.insertItemAt(skinMenu.itemCount - 2, entry.leafName, entry.leafName);
				item.setAttribute('class', 'context-chaika-skin-item');
				item.setAttribute('name', 'context-chaika-skin-item');
				item.setAttribute('type', 'radio');
				item.addEventListener('command', this._setSkin, false);
			}
		}
		entries.close();

		//現在設定されているスキンを選択状態にする
		var currentSkinName = ChaikaBrowserOverlay.ChaikaCore.pref.getUniChar('thread_skin');
		skinMenu.querySelector('menuitem[value="' + currentSkinName + '"]')
				.setAttribute('checked', 'true');
	},


	_destroySkinMenu: function contextMenu__destroySkinMenu(){
		var skinMenu = document.getElementById("context-chaika-skin");
		var skinItems = skinMenu.getElementsByClassName('context-chaika-skin-item');

		while(skinItems.length){
			skinItems[0].removeEventListener('command', this._setSkin, false);
			skinMenu.menupopup.removeChild(skinItems[0]);
		}
	},


	showMenu: function contextMenu_showMenu(aEvent){
		if(aEvent.originalTarget.id != "contentAreaContextMenu") return;
		if(!gContextMenu) return;


		var that = ChaikaBrowserOverlay.contextMenu;
		var contextMenu = document.getElementById('context-chaika');
		var url = gBrowser.currentURI.spec;


		//すべての非表示・無効化を解除
		Array.slice(contextMenu.querySelectorAll('menu, menuitem, menuseparator')).forEach(function(item){
			item.hidden = false;
			item.disabled = false;
		});


		//選択部分がない場合
		if(!gContextMenu.isTextSelected){
			Array.slice(
				contextMenu.querySelectorAll('#context-chaika-copy-title-url-selection,' +
				                             '#context-chaika-abone > menupopup > menuitem:not(:last-child),' +
				                             '#context-chaika-abone > menupopup > menuseparator')
			).forEach(function(item){
				item.hidden = true;
			})
		}


		//非表示にする項目のIDを入れておく配列
		var hiddenItems = [];


		//2chリンク上ではない場合
		if(!gContextMenu.onLink || !that._isBBS(gContextMenu.linkURL)){
			hiddenItems = hiddenItems.concat([
				'open-link-in-chaika',
				'open-link-in-browser',
			]);
		}

		//掲示板上ではない時
		if(!that._isBBS(url)){
			hiddenItems = hiddenItems.concat([
				'copy',
				'write',
				'delete-log',
				'thread-sep',
				'open-in-chaika',
				'open-in-browser',
				'show-all',
				'show-l50',
				'open-board',
				'thread-show-sep',
			]);

			//2chリンク上でない場合、セパレータが2つ重なってしまうのに対処
			if(!gContextMenu.onLink || !that._isBBS(gContextMenu.linkURL)){
				hiddenItems.push('open-in-sep');
			}
		}else{
			//chaika上ではない時
			if(!that._isChaika(url)){
				//共通
				hiddenItems = hiddenItems.concat([
					'write',
					'delete-log',
					'thread-sep',
					'open-in-browser',
				]);

				//板の時
//				if(that._isBoard(url)){
					hiddenItems = hiddenItems.concat([
						'show-all',
						'show-l50',
						'open-board',
						'thread-show-sep',
					]);
//				}

			//chaika上の時(スレッドの場合しかない)
			}else{
				hiddenItems = hiddenItems.concat([
					'open-in-chaika',
				]);
			}
		}

		//まとめて非表示にする
		hiddenItems.forEach(function(id){
			document.getElementById('context-chaika-' + id).hidden = true;
		});
	},


	addAbone: function contextMenu_addAbone(ngType){
		var ngWord = content.getSelection().toString();
		ChaikaBrowserOverlay.ChaikaAboneManager.addAbone(ngWord, ngType);
	},

	openAboneManager: function contextMenu_openAboneManager(){
		document.getElementById("chaika-thread-toolbaritem")._openAboneManager();
	},

	copyClipBoard: function contextMenu_copyClipBoard(text){
		var osName = Components.classes["@mozilla.org/xre/app-info;1"]
						.getService(Components.interfaces.nsIXULRuntime).OS;
		const NEWLINE = (osName == "Darwin") ? "\n" : "\r\n";

		var url = document.getElementById("chaika-thread-toolbaritem")._getCurrentThreadURL();
		url = url ? url.spec : content.location.href;

		text = text.replace('%TITLE%', content.document.title, 'g')
					.replace('%URL%', url, 'g')
					.replace('%SEL%', content.getSelection().toString(), 'g')
					.replace('%NEWLINE%', NEWLINE, 'g');

		var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
							.getService(Components.interfaces.nsIClipboardHelper);
		clipboard.copyString(text);
	},

	openSkinFolder: function contextMenu_openSkinFolder(){
		var skinDir = this._getSkinDir();
		ChaikaBrowserOverlay.ChaikaCore.io.revealDir(skinDir);
	},

	write: function contextMenu_write(){
		document.getElementById("chaika-thread-toolbaritem")._write();
	},

	deleteLog: function contextMenu_deleteLog(){
		document.getElementById("chaika-thread-toolbaritem")._deleteLog();
	},

	openInChaika: function contextMenu_openInChaika(event, url){
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var addTab = this._addTab(event);

		try{
			if(this._isBoard(url)){
				var boardURL = ioService.newURI(url, null, null);
				ChaikaBrowserOverlay.ChaikaCore.browser.openBoard(boardURL, addTab);
			}else{
				// スレッド表示数の制限
				var disregardURLOption = ChaikaBrowserOverlay.ChaikaCore.pref.getBool(
											"browser_contextmenu_disregard_url_option");

				//read.jsを修正
				url = url.replace("/test/read.html/", "/test/read.cgi/");

				var threadURL = ioService.newURI(url, null, null);
				ChaikaBrowserOverlay.ChaikaCore.browser.openThread(threadURL, addTab, disregardURLOption, false);
			}
		}catch(ex){
			ChaikaBrowserOverlay.ChaikaCore.logger.error(ex);
			return;
		}
	},

	openInBrowser: function contextMenu_openInBrowser(event, url){
		var threadURL = document.getElementById("chaika-thread-toolbaritem")._getCurrentThreadURL();
		ChaikaBrowserOverlay.ChaikaCore.browser.openURL(threadURL, this._addTab(event));
	},

	rangeChange: function contextMenu_rangeChange(event, range){
		document.getElementById("chaika-thread-toolbaritem")._viewChange(range, this._addTab(event));
	},

	openBoard: function contextMenu_openBoard(event){
		document.getElementById("chaika-thread-toolbaritem")._gotoBoard(this._addTab(event));
	},

	openSettings: function contextMenu_openSettings(){
		var settingDialogURL = "chrome://chaika/content/settings/settings.xul";
		var features = "";
		try{
			var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
			var instantApply = pref.getBoolPref("browser.preferences.instantApply");
			features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
		}catch(ex){
			features = "chrome,titlebar,toolbar,centerscreen,modal";
		}
		window.openDialog(settingDialogURL, "", features);
	},


	_setSkin: function contextMenu__setSkin(aEvent){
		ChaikaBrowserOverlay.ChaikaCore.pref.setUniChar('thread_skin', this.getAttribute('value'));
	},


	_getSkinDir: function contextMenu__getSkinDir(){
		var skinDir = ChaikaBrowserOverlay.ChaikaCore.getDataDir();
		skinDir.appendRelativePath("skin");
		return skinDir;
	},

	_addTab: function contextMenu__addTab(event){
		var addTab = false;

		//中クリックか、コマンドボタンとともにクリックされたら
		//デフォルト値を反転
		if(event.button === 1 || event.ctrlKey || event.metaKey){
			addTab = !addTab;
		}

		return addTab;
	},


	/* *** 簡易URI判定 *** */
	_isChaika: function contextMenu__isChaika(aURI){
		return /^http:\/\/127\.0\.0\.1:\d+\/thread\//.test(aURI);
	},

	_isBBS: function contextMenu__isBBS(aURI){
		if(!(aURI instanceof Components.interfaces.nsIURI)){
			let ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
			aURI = ioService.newURI(aURI, null, null).QueryInterface(Components.interfaces.nsIURI);
		}

		return ChaikaBrowserOverlay.ChaikaBoard.getBoardType(aURI) !== ChaikaBrowserOverlay.ChaikaBoard.BOARD_TYPE_PAGE;
	},

	_isThread: function contextMenu__isThread(aURI){
		return this._isBBS(aURI) && /\/(?:test|bbs)\/read\.(?:cgi|html)\//.test(aURI);
	},

	_isBoard: function contextMenu__isBoard(aURI){
		return this._isBBS(aURI) && !this._isThread(aURI);
	}

};




ChaikaBrowserOverlay.threadToolbar = {

	start: function statusbar_start(){
		getBrowser().addProgressListener(ChaikaBrowserOverlay.threadToolbar.webProgress);
	},


	stop: function statusbar_stop(){
		getBrowser().removeProgressListener(ChaikaBrowserOverlay.threadToolbar.webProgress);
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
