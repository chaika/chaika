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

	get _toolbar(){
		if(!this.__toolbar){
			this.__toolbar = document.getElementById("chaika-thread-toolbaritem");
		}

		return this.__toolbar;
	},


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
		if(skinDir.exists()){
			let entries = skinDir.directoryEntries
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
		}

		//現在設定されているスキンを選択状態にする
		var currentSkinName = ChaikaBrowserOverlay.ChaikaCore.pref.getUniChar('thread_skin');
		var currentSkinItem = skinMenu.querySelector('menuitem[value="' + currentSkinName + '"]');
		if(currentSkinItem){
			currentSkinItem.setAttribute('checked', 'true');
		}
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

		//掲示板上でのみ表示する設定の場合
		if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_only_bbs') && !that._isBBS(url)){
			contextMenu.hidden = true;
			return;
		}

		//すべての非表示・無効化を解除
		contextMenu.hidden = false;
		Array.slice(contextMenu.querySelectorAll('menu, menuitem, menuseparator')).forEach(function(item){
			item.hidden = false;
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
				if(that._isBoard(url)){
					hiddenItems = hiddenItems.concat([
						'show-all',
						'show-l50',
						'open-board',
						'thread-show-sep',
					]);
				}

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


		//現在設定されているスキンを選択状態にする
		var skinMenu = document.getElementById("context-chaika-skin");
		var currentSkinName = ChaikaBrowserOverlay.ChaikaCore.pref.getUniChar('thread_skin');
		var currentSkinItem = skinMenu.querySelector('menuitem[value="' + currentSkinName + '"]');
		if(currentSkinItem){
			currentSkinItem.setAttribute('checked', 'true');
		}
	},


	addAbone: function contextMenu_addAbone(ngType){
		var ngWord = content.getSelection().toString();
		ChaikaBrowserOverlay.ChaikaAboneManager.addAbone(ngWord, ngType);
	},


	openSkinFolder: function contextMenu_openSkinFolder(){
		var skinDir = this._getSkinDir();
		ChaikaBrowserOverlay.ChaikaCore.io.revealDir(skinDir);
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
		var addTab = ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_add_tab_by_click');

		//中クリックか、コマンドボタンとともにクリックされたら
		//デフォルト値を反転
		if(event.button === 1 || event.ctrlKey || event.metaKey){
			addTab = !addTab;
		}

		return addTab;
	},



	openAboneManager: function contextMenu_openAboneManager(){
		this._toolbar._openAboneManager();
	},

	copyClipBoard: function contextMenu_copyClipBoard(text){
		this._toolbar._copyClipBoard(text);
	},

	write: function contextMenu_write(){
		this._toolbar._write();
	},

	deleteLog: function contextMenu_deleteLog(){
		this._toolbar._deleteLog();
	},

	viewChaika: function contextMenu_viewChaika(event, url){
		var disregardURLOption = ChaikaBrowserOverlay.ChaikaCore.pref.getBool(
									"browser_contextmenu_disregard_url_option");
		this._toolbar._viewChaika(url, this._addTab(event), disregardURLOption);
	},

	viewBrowser: function contextMenu_viewBrowser(event, url){
		this._toolbar._viewBrowser(url, this._addTab(event));
	},

	viewChange: function contextMenu_viewChange(event, option){
		this._toolbar._viewChange(option, this._addTab(event));
	},

	goToBoard: function contextMenu_goToBoard(event){
		this._toolbar._goToBoard(this._addTab(event));
	},

	openSettings: function contextMenu_openSettings(){
		this._toolbar._openSettings();
	},

	_isChaika: function contextMenu__isChaika(aURI){
		return this._toolbar._isChaika(aURI);
	},

	_isBBS: function contextMenu__isBBS(aURI){
		return this._toolbar._isBBS(aURI);
	},

	_isThread: function contextMenu__isThread(aURI){
		return this._toolbar._isThread(aURI);
	},

	_isBoard: function contextMenu__isBoard(aURI){
		return this._toolbar._isBoard(aURI);
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
				ChaikaBrowserOverlay.contextMenu._toolbar.showCheck();
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
