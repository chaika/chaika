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
		var isMac = navigator.platform.indexOf("Mac") == 0;
		var contextMenu = document.getElementById('context-chaika');
		var browserContextMenu = document.getElementById("contentAreaContextMenu");
		var enableContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool("enable_browser_contextmenu");

		if(enableContextMenu){
			contextMenu.hidden = false;
			this._createSkinMenu();
			this._checkRequirements();
			this._toolbar = document.getElementById("chaika-thread-toolbaritem");

			browserContextMenu.addEventListener("popupshowing", ChaikaBrowserOverlay.contextMenu.showMenu, false);
			browserContextMenu.addEventListener('click', ChaikaBrowserOverlay.contextMenu.hidePopup, false);
			gBrowser.mPanelContainer.addEventListener(isMac ? 'mousedown' : 'click', this._setCursorPosition, false);
		}else{
			contextMenu.hidden = true;
		}
	},


	stop: function contextMenu_stop(){
		var isMac = navigator.platform.indexOf("Mac") == 0;
		var enableContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool("enable_browser_contextmenu");
		var browserContextMenu = document.getElementById("contentAreaContextMenu");

		if(enableContextMenu){
			document.getElementById('context-chaika').hidden = true;
			this._destorySkinMenu();
			browserContextMenu.removeEventListener("popupshowing", ChaikaBrowserOverlay.contextMenu.showMenu, false);
			browserContextMenu.removeEventListener('click', ChaikaBrowserOverlay.contextMenu.hidePopup, false);
			gBrowser.mPanelContainer.removeEventListener(isMac ? 'mousedown' : 'click', this._setCursorPosition, false);
		}
	},


	/**
	 * スキンのメニューを作成する
	 */
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


	/**
	 * スキンのメニューを削除する
	 */
	_destroySkinMenu: function contextMenu__destroySkinMenu(){
		var skinMenu = document.getElementById("context-chaika-skin");
		var skinItems = skinMenu.getElementsByClassName('context-chaika-skin-item');

		while(skinItems.length){
			skinItems[0].removeEventListener('command', this._setSkin, false);
			skinMenu.menupopup.removeChild(skinItems[0]);
		}
	},


	/**
	 * 他アドオンが必要なメニュー項目をチェックする
	 */
	_checkRequirements: function contextMenu__checkRequirements(){
		const FOX_AGE_2CH = !!document.getElementById("viewFoxAge2chSidebar");

		if(!FOX_AGE_2CH){
			document.getElementById('context-chaika-find-next-thread').disabled = true;
		}
	},


	/**
	 * コンテキストメニューが表示された時に呼ばれる
	 */
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


		//非表示にする項目のIDを入れておく配列
		var hiddenItems = [];


		//選択部分がない場合
		if(!gContextMenu.isTextSelected){
			hiddenItems.push('copy-title-url-selection');
		}

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
				'find-next-thread',
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
						'find-next-thread',
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


	hidePopup: function contextMenu_hidePopup(event){
		if(event.button == 1){
			document.getElementById('contentAreaContextMenu').hidePopup();
		}
	},


	/**
	 * 選択文字列またはカーソル直下の文字列をNGワードに追加する
	 * @param {Number} ngType NGワードの種類
	 * @see ChaikaAboneManager
	 */
	addAbone: function contextMenu_addAbone(ngType){
		var ngWord = gContextMenu.isTextSelected ? content.getSelection().toString() : this._getCursorPositionText();
		var confirm = ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_confirm_add_abone');

		if(confirm){
			this._toolbar._openAboneManager({ ngType: ngType, ngWord: ngWord });
		}else{
			ChaikaBrowserOverlay.ChaikaAboneManager.addAbone(ngWord, ngType);
		}
	},


	/**
	 * スキンのフォルダを開く
	 */
	openSkinFolder: function contextMenu_openSkinFolder(){
		var skinDir = this._getSkinDir();
		ChaikaBrowserOverlay.ChaikaCore.io.revealDir(skinDir);
	},


	/**
	 * スキンを変更する
	 * スキンメニューから呼ばれる
	 */
	_setSkin: function contextMenu__setSkin(aEvent){
		ChaikaBrowserOverlay.ChaikaCore.pref.setUniChar('thread_skin', this.getAttribute('value'));
	},



	/**
	 * スキンフォルダを返す
	 */
	_getSkinDir: function contextMenu__getSkinDir(){
		var skinDir = ChaikaBrowserOverlay.ChaikaCore.getDataDir();
		skinDir.appendRelativePath("skin");
		return skinDir;
	},


	/**
	 * 新規タブに開くかどうかを調べる
	 */
	_addTab: function contextMenu__addTab(aEvent){
		var addTab = ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_add_tab_by_click');
		ChaikaBrowserOverlay.ChaikaCore.logger.debug(aEvent.button);

		//中クリックか、コマンドボタンとともにクリックされたら
		//デフォルト値を反転
		if(aEvent.button === 1 || aEvent.ctrlKey || aEvent.metaKey){
			addTab = !addTab;
		}

		return addTab;
	},


	/**
	 * クリックされた時のカーソルの状態を保存する
	 * This function is based on contextSercher.uc.js by Griever (http://d.hatena.ne.jp/Griever/)
	 * @license MIT License
	 */
	_setCursorPosition: function contextMenu__setCursorPosition(event){
		var that = ChaikaBrowserOverlay.contextMenu;

		if (event.button === 2) {
			that._clickNode = event.rangeParent;
			that._clickOffset = event.rangeOffset;
			that._clientX = event.clientX;
		} else {
			that._clickNode = null;
			that._clickOffset = 0;
			that._clientX = 0;
		}
	},


	/**
	 * カーソル直下の文字列を取得して返す
	 * This function is based on contextSercher.uc.js by Griever (http://d.hatena.ne.jp/Griever/)
	 * @license MIT License
	 */
	_getCursorPositionText: function contextMenu__getCursorPositionText(){
		var cursorPositionData = {
			_regexp: {
				hiragana: "[\\u3040-\\u309F]+",
				katakana: "[\\u30A0-\\u30FA\\u30FC]+",
				kanji	 : "[\\u4E00-\\u9FA0]+",
				suuji	 : "[0-9_./,%-]+",
				eisu_han: "\\w[\\w\\-]*",
				eisu_zen: "[\\uFF41-\\uFF5A\\uFF21-\\uFF3A\\uFF10-\\uFF19]+",
				hankaku : "[\\uFF00-\\uFFEF]+",
				hangul	: "[\\u1100-\\u11FF\\uAC00-\\uD7AF\\u3130-\\u318F]+",
			},

			get startReg() {
				let reg = {};
				for(let n in this._regexp) {
					reg[n] = new RegExp('^' + this._regexp[n]);
				}
				delete this.startReg;
				return this.startReg = reg;
			},
			get endReg() {
				let reg = {};
				for(let n in this._regexp) {
					reg[n] = new RegExp(this._regexp[n] + '$');
				}
				delete this.endReg;
				return this.endReg = reg;
			},
			getCharType: function(aChar) {
				var c = aChar.charCodeAt(0);
				//if (c >= 0x30 && c <= 0x39) return "suuji";
				if (c >= 0x30 && c <= 0x39 || c >= 0x41 && c <= 0x5A || c >= 0x61 && c <= 0x7A || c === 0x5F) return "eisu_han";
				if (c >= 0x30A0 && c <= 0x30FA || c === 0x30FC) return "katakana";
				if (c >= 0x3040 && c <= 0x309F) return "hiragana";
				if (c >= 0x4E00 && c <= 0x9FA0) return "kanji";
				if (c >= 0xFF41 && c <= 0x9F5A || c >= 0xFF21 && c <= 0xFF3A || c >= 0xFF10 && c <= 0xFF19) return "eisu_zen";
				if (c >= 0xFF00 && c <= 0xFFEF) return "hankaku";
				if (c >= 0x1100 && c <= 0x11FF || c >= 0xAC00 && c <= 0xD7AF || c >= 0x3130 && c <= 0x318F) return "hangul";
				return "";
			},
		};


		//カーソル直下の要素を取得
		var node = this._clickNode;
		if(!node || node.nodeType !== Node.TEXT_NODE) return '';

		//もし20文字以内なら、そのまま返す
		if(node.nodeValue.length < 20){
			return node.nodeValue;
		}

		//20文字より長い場合は、単語を抜き出すことを試みる
		var offset = this._clickOffset;
		var clientX = this._clientX;
		var text = node.nodeValue;

		// 文字の右半分をクリック時に次の文字を取得する対策
		var range = node.ownerDocument.createRange();
		range.setStart(node, offset);

		var rect = range.getBoundingClientRect();
		range.detach();

		if (rect.left >= this._clientX){
			offset--;
		}

		//文字範囲外の場合はエラー
		if (!text[offset]) return "";

		//文字種を取得
		var type = cursorPositionData.getCharType(text[offset]);
		if (!type) return "";

		//単語を抜き出す
		//カーソル直下で同じ文字種のものが続いている部分を抜き出す
		var beforeOffset = text.substr(0, offset);
		var afterOffset = text.substr(offset); // text[offset] はこっちに含まれる
		var beforeOffsetWord = (cursorPositionData.endReg[type].exec(beforeOffset) || [""])[0];
		var afterOffsetWord = (cursorPositionData.startReg[type].exec(afterOffset) || [""])[0];
		var str = beforeOffsetWord + afterOffsetWord;

		//漢字一文字の場合、送り仮名があれば付け加える
		//ない場合は空文字にする
		if (str.length === 1) {
			if (type === "kanji") {
				if (cursorPositionData.startReg["hiragana"].test(afterOffset.substr(afterOffsetWord.length))){
					str += RegExp.lastMatch;
				}else{
					return "";
				}
			}
		}

		return str;
	},



	/* **** ここより下の関数は thread-toolbarbutton.xml の関数に処理を投げる関数 **** */

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

	findNextThread: function contextMenu_findNextThread(){
		this._toolbar._findNextThread();
	},

	openSettings: function contextMenu_openSettings(){
		this._toolbar._openSettings();
	},

	_isChaika: function contextMenu__isChaika(aURI){
		return this._toolbar._isChaika(aURI);
	},

	_isBBS: function contextMenu__isBBS(aURI){
		//Googleトラッキング対策
		if(aURI.indexOf('google') > -1 && aURI.indexOf('/url?') > -1){
			aURI = decodeURIComponent(aURI.match(/url=([^&]*)/i)[1]);
		}

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
				document.getElementById("chaika-thread-toolbaritem").showCheck();
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
