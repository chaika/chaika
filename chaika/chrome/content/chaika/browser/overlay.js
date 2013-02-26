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
		var flattenContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_flatten');

		if(enableContextMenu){
			contextMenu.hidden = false;
			this._createSkinMenu();
			this._toolbar = document.getElementById("chaika-thread-toolbaritem");

			if(flattenContextMenu){
				this._flattenContextMenu();
				contextMenu = document.getElementById('context-chaika');
			}

			browserContextMenu.addEventListener("popupshowing", this, false);
			gBrowser.mPanelContainer.addEventListener(isMac ? 'mousedown' : 'click', this, false);
			contextMenu.addEventListener('command', this, false);
			contextMenu.addEventListener('click', this, false);
		}else{
			contextMenu.hidden = true;
		}
	},


	stop: function contextMenu_stop(){
		var isMac = navigator.platform.indexOf("Mac") == 0;
		var contextMenu = document.getElementById('context-chaika');
		var browserContextMenu = document.getElementById("contentAreaContextMenu");

		contextMenu.hidden = true;
		this._destroySkinMenu();

		browserContextMenu.removeEventListener("popupshowing", this, false);
		gBrowser.mPanelContainer.removeEventListener(isMac ? 'mousedown' : 'click', this, false);
		contextMenu.removeEventListener('command', this, false);
		contextMenu.removeEventListener('click', this, false);
	},


	/**
	 * スキンのメニューを作成する
	 */
	_createSkinMenu: function contextMenu__createSkinMenu(){
		var skinMenu = document.getElementById('context-chaika-skin');

		//初期化
		this._destroySkinMenu();


		//デフォルトスキン
		var defaultItem = skinMenu.appendItem('(Default)', '');
		defaultItem.setAttribute('name', 'context-chaika-skin-item');
		defaultItem.setAttribute('type', 'radio');

		//セパレータ
		var sep1 = document.createElement('menuseparator');
		sep1.setAttribute('id', 'context-chaika-skin-default-sep');
		skinMenu.menupopup.appendChild(sep1);

		//その他のスキン
		var skinDir = this._getSkinDir();
		if(skinDir.exists()){
			let entries = skinDir.directoryEntries
					.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
			let entry;

			while(entry = entries.nextFile){
				if(entry.isDirectory()){
					let item = skinMenu.appendItem(entry.leafName, entry.leafName);
					item.setAttribute('name', 'context-chaika-skin-item');
					item.setAttribute('type', 'radio');
				}
			}

			entries.close();
		}

		//セパレータ
		var sep2 = document.createElement('menuseparator');
		sep2.setAttribute('id', 'context-chaika-skin-open-folder-sep');
		skinMenu.menupopup.appendChild(sep2);

		//スキンフォルダを開く
		var folderOpenItem = skinMenu.appendItem('スキンフォルダを開く...', '');
		folderOpenItem.setAttribute('id', 'context-chaika-open-skin-folder');


		//現在設定されているスキンを選択状態にする
		var currentSkinName = ChaikaBrowserOverlay.ChaikaCore.pref.getUniChar('thread_skin');
		var currentSkinItem = skinMenu.querySelector('menuitem[value="' + currentSkinName + '"]');
		if(currentSkinItem){
			currentSkinItem.setAttribute('checked', 'true');
		}

		//イベント設定
		skinMenu.addEventListener('command', this, false);
	},


	/**
	 * スキンのメニューを削除する
	 */
	_destroySkinMenu: function contextMenu__destroySkinMenu(){
		var skinMenu = document.getElementById('context-chaika-skin');
		skinMenu.removeEventListener('command', this, false);

		var range = document.createRange();
		range.selectNodeContents(skinMenu.firstChild);
		range.deleteContents();
	},


	/**
	 * コンテキストメニューをフラットにする
	 */
	_flattenContextMenu: function contextMenu__flattenContextMenu(){
		var browserContextMenu = document.getElementById('contentAreaContextMenu');
		var contextMenu = document.getElementById('context-chaika');
		var range = document.createRange();
		var vbox = document.createElement('vbox');

		//#context-chaika > menupopupの中身をvboxに移す
		range.selectNodeContents(contextMenu.menupopup);
		vbox.appendChild(range.extractContents());

		//vboxをコンテキストメニューの先頭に挿入
		range.setStartBefore(browserContextMenu.firstChild);
		range.insertNode(vbox);

		//vboxの後にセパレータを挿入
		var separator = document.createElement('menuseparator');
		range.setStartAfter(vbox);
		range.insertNode(separator);

		//#context-chaikaを消去
		range.selectNode(contextMenu);
		range.deleteContents();

		//vboxにidを移す
		vbox.setAttribute('id', 'context-chaika');
	},



	handleEvent: function contextMenu_handleEvent(aEvent){
		var element = aEvent.currentTarget;

		switch(element.getAttribute('id')){
			case 'contentAreaContextMenu':
				this.showMenu(aEvent);
				break;

			case 'context-chaika':
				this._doCommand(aEvent);
				break;

			case 'context-chaika-skin':
				this._setSkin(aEvent);
				break;

			default:
				switch(element.nodeName){
					case 'xul:tabpanels':
						this._setCursorPosition(aEvent);
						break;
				}
				break;
		}

	},


	/**
	 * コンテキストメニューが表示された時に呼ばれる
	 */
	showMenu: function contextMenu_showMenu(aEvent){
		if(aEvent.originalTarget.id != "contentAreaContextMenu") return;
		if(!gContextMenu) return;

		var contextMenu = document.getElementById('context-chaika');
		var url = gBrowser.currentURI;

		//掲示板上でのみ表示する設定の場合
		if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_only_bbs') && !this._isBBS(url)){
			contextMenu.hidden = true;
			return;
		}


		//すべての非表示・無効化を解除

		//ChaikaCore.pref を使うと存在しない設定値の場合エラーが出てしまうので自前で用意する
		var prefs = Services.prefs.getBranch("extensions.chaika.contextmenu.");

		contextMenu.hidden = false;
		Array.slice(contextMenu.querySelectorAll('menu, menuitem, menuseparator')).forEach(function(item){
			item.hidden = false;

			//非表示に設定されているものを非表示にする
			var id = item.getAttribute('id');
			if(!id) return;

			id = id.replace('context-chaika-', '');
			try{
				if(!prefs.getBoolPref(id + '.enabled')){
					item.hidden = true;
				}
			}catch(ex){}
		});


		//非表示にする項目のIDを入れておく配列
		var hiddenItems = [];


		//選択部分がない場合
		if(!gContextMenu.isTextSelected){
			hiddenItems.push('copy-title-url-selection');
		}

		//2chリンク上ではない場合
		if(!gContextMenu.onLink || !this._isBBS(gContextMenu.linkURL)){
			hiddenItems = hiddenItems.concat([
				'open-link-in-chaika',
				'open-link-in-browser',
			]);
		}

		//掲示板上ではない時
		if(!this._isBBS(url)){
			hiddenItems = hiddenItems.concat([
				'copy',
				'search-in-board',
				'search-in-thread',
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
			if(!gContextMenu.onLink || !this._isBBS(gContextMenu.linkURL)){
				hiddenItems.push('open-in-sep');
			}
		}else{
			//chaika上ではない時
			if(!this._isChaika(url)){
				//共通
				hiddenItems = hiddenItems.concat([
					'write',
					'delete-log',
					'thread-sep',
					'open-in-browser',
				]);

				//板の時
				if(this._isBoard(url)){
					hiddenItems = hiddenItems.concat([
						'search-in-thread',
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


	/**
	 * メニューコマンドを実行する
	 */
	_doCommand: function contextMenu__doCommand(aEvent){
		//clickの場合は中クリックでなければ終了
		if(aEvent.type === 'click' && aEvent.button !== 1) return;

		var addTab = this._addTab(aEvent);
		var middleClicked = aEvent.type === 'click' && aEvent.button === 1;

		var id = aEvent.target.getAttribute('id').replace('context-chaika-', '');

		switch(id){
			case 'abone-name':
				if(!middleClicked) this.addAbone(0);
				break;

			case 'abone-mail':
				if(!middleClicked) this.addAbone(1);
				break;

			case 'abone-id':
				if(!middleClicked) this.addAbone(2);
				break;

			case 'abone-word':
				if(!middleClicked) this.addAbone(3);
				break;

			case 'abone-manager':
				if(!middleClicked) this.openAboneManager();
				break;

			case 'copy-title':
				if(!middleClicked) this.copyClipBoard('%TITLE%');
				break;

			case 'copy-url':
				if(!middleClicked) this.copyClipBoard('%URL%');
				break;

			case 'copy-title-url':
				if(!middleClicked) this.copyClipBoard('%TITLE%%NEWLINE%%URL%');
				break;

			case 'copy-title-url-selection':
				if(!middleClicked) this.copyClipBoard('%SEL%%NEWLINE%%NEWLINE%%TITLE%%NEWLINE%%URL%');
				break;

			case 'search-find-2ch':
				this.searchFind2ch(addTab);
				break;

			case 'search-in-board':
				this.searchInBoard(addTab);
				break;

			case 'search-in-thread':
				this.searchInThread();
				break;

			case 'open-skin-folder':
				if(!middleClicked) this.openSkinFolder();
				break;

			case 'write':
				if(!middleClicked) this.write();
				break;

			case 'delete-log':
				if(!middleClicked) this.deleteLog();
				break;

			case 'open-in-chaika':
				this.viewChaika(null, addTab);
				break;

			case 'open-in-browser':
				this.viewBrowser(null, addTab);
				break;

			case 'open-link-in-chaika':
				this.viewChaika(gContextMenu.linkURL, addTab);
				break;

			case 'open-link-in-browser':
				this.viewBrowser(gContextMenu.linkURL, addTab);
				break;

			case 'show-all':
				this.viewChange('./', addTab);
				break;

			case 'show-l50':
				this.viewChange('./l50', addTab);
				break;

			case 'open-board':
				this.goToBoard(addTab);
				break;

			case 'find-next-thread':
				this.findNextThread(addTab);
				break;

			case 'open-settings':
				if(!middleClicked) this.openSettings();
				break;
		}


		//中クリックの場合明示的にコンテキストメニューを閉じる必要がある
		if(middleClicked){
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
	 * find.2ch.net での検索結果を開く
	 * @param {Boolean} aAddTab 新しいタブで開くかどうか
	 */
	searchFind2ch: function contextMenu_searchFind2ch(aAddTab){
		var sidebarMode = ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_find_2ch_in_sidebar');
		var searchStr = gContextMenu.isTextSelected ? content.getSelection().toString() : this._getCursorPositionText();

		if(!sidebarMode){
			const QUERY_URL = 'http://find.2ch.net/?COUNT=50&BBS=ALL&TYPE=TITLE&STR=';

			var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].getService(Ci.nsIScriptableUnicodeConverter);
			converter.charset = 'EUC-JP';
			searchStr = escape(converter.ConvertFromUnicode(searchStr));

			var searchURI = Services.io.newURI(QUERY_URL + searchStr, null, null);
			ChaikaBrowserOverlay.ChaikaCore.browser.openURL(searchURI, aAddTab);
		}else{
			const SIDEBAR_URL = 'chrome://chaika/content/bbsmenu/page.xul';
			var sidebarBox = document.getElementById("sidebar-box");
			var sidebar = document.getElementById("sidebar");

			function _search(){
				setTimeout(function(){
					var sideDoc = sidebar.contentDocument;
					var sideWin = sidebar.contentWindow;
					var searchBox = sideDoc.getElementById("searchBox");

					searchBox.focus();
					searchBox.value = searchStr;
					sideWin.SearchBox.setSearchMode("find2ch");
					sideWin.SearchBox.search(searchStr);

					sidebar.removeEventListener('DOMContentLoaded', _search, false);
				}, 0);
			}

			if(sidebarBox.hidden || sidebar.getAttribute('src') !== SIDEBAR_URL){
				sidebar.addEventListener("DOMContentLoaded", _search, false);
				toggleSidebar("viewChaikaSidebar", true);
			}else{
				_search();
			}
		}
	},


	/**
	 * 板一覧で検索する
	 * @param {Boolean} aAddTab 新規タブに開くかどうか
	 */
	searchInBoard: function contextMenu_searchInBoard(aAddTab){
		var boardURL = this._toolbar._getCurrentBoardURL();
		if(!boardURL) return;

		var searchStr = gContextMenu.isTextSelected ? content.getSelection().toString() : this._getCursorPositionText();
		var searchURL = Services.io.newURI(boardURL.spec + '?query=' + encodeURIComponent(searchStr), null, null);

		ChaikaBrowserOverlay.ChaikaCore.browser.openBoard(searchURL, aAddTab);
	},


	/**
	 * スレッド内で検索する
	 * @note 本来ならスキンの検索機能を呼び出したいが、仕様が固まっておらず困難
	 */
	searchInThread: function contextMenu_searchInThread(){
		var searchStr = gContextMenu.isTextSelected ? content.getSelection().toString() : this._getCursorPositionText();

		//今のところ標準の検索バーを出して検索するだけ
		gFindBar.onFindCommand();
		gFindBar._findField.value = searchStr;
		gFindBar._find();
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
		var target = aEvent.target;
		if(target.getAttribute('name') !== 'context-chaika-skin-item') return;

		aEvent.stopPropagation();
		ChaikaBrowserOverlay.ChaikaCore.pref.setUniChar('thread_skin', target.getAttribute('value'));

		if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser_contextmenu_reload_when_skin_changed') &&
		   this._isChaika(content.location.href) && this._isThread(content.location.href)){
			content.location.reload();
		}
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

		//中クリックか、コマンドボタンとともにクリックされたら
		//デフォルト値を反転
		if(aEvent.button === 1 || aEvent.ctrlKey || aEvent.metaKey){
			addTab = !addTab;
		}

		return addTab;
	},


	/**
	 * クリックされた時のカーソルの状態を保存する
	 * This function is based on contextSearcher.uc.js by Griever (http://d.hatena.ne.jp/Griever/)
	 * @license MIT License
	 */
	_setCursorPosition: function contextMenu__setCursorPosition(aEvent){
		if(aEvent.button === 2){
			this._clickNode = aEvent.rangeParent;
			this._clickOffset = aEvent.rangeOffset;
			this._clientX = aEvent.clientX;
		}else{
			this._clickNode = null;
			this._clickOffset = 0;
			this._clientX = 0;
		}
	},


	/**
	 * カーソル直下の文字列を取得して返す
	 * This function is based on contextSearcher.uc.js by Griever (http://d.hatena.ne.jp/Griever/)
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

	viewChaika: function contextMenu_viewChaika(aURI, aAddTab){
		var disregardURLOption = ChaikaBrowserOverlay.ChaikaCore.pref.getBool(
									"browser_contextmenu_disregard_url_option");
		this._toolbar._viewChaika(aURI, aAddTab, disregardURLOption);
	},

	viewBrowser: function contextMenu_viewBrowser(aURI, aAddTab){
		this._toolbar._viewBrowser(aURI, aAddTab);
	},

	viewChange: function contextMenu_viewChange(aOption, aAddTab){
		this._toolbar._viewChange(aOption, aAddTab);
	},

	goToBoard: function contextMenu_goToBoard(aAddTab){
		this._toolbar._goToBoard(aAddTab);
	},

	findNextThread: function contextMenu_findNextThread(aAddTab){
		this._toolbar._findNextThread(aAddTab);
	},

	openSettings: function contextMenu_openSettings(){
		this._toolbar._openSettings();
	},

	_isChaika: function contextMenu__isChaika(aURI){
		return this._toolbar._isChaika(aURI);
	},

	_isBBS: function contextMenu__isBBS(aURI){
		var url = aURI.spec || aURI;

		//Googleトラッキング対策
		if(url.indexOf('google') > -1 && url.indexOf('/url?') > -1){
			aURI = decodeURIComponent(url.match(/url=([^&]*)/i)[1]);
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
		Services.obs.addObserver(ChaikaBrowserOverlay.aboneEvent, "b2r-abone-data-add", false);
	},


	stop: function aboneEvent_stop(){
		Services.obs.removeObserver(ChaikaBrowserOverlay.aboneEvent, "b2r-abone-data-add", false);
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
