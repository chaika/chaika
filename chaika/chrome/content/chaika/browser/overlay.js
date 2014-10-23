/* See license.txt for terms of usage */

var ChaikaBrowserOverlay = {

    _initCount: 0,

    start: function ChaikaBrowserOverlay_start(){
        //10s待ってもChaikaCoreが初期化されていなかったら
        //初期化は失敗したものとみなす
        if(ChaikaBrowserOverlay._initCount > 100){
            return ChaikaCore.logger.error('Failed in initializing ChaikaCore.');
        }

        if(ChaikaBrowserOverlay.ChaikaCore.initialized){
            ChaikaBrowserOverlay.browserMenu.start();
            ChaikaBrowserOverlay.contextMenu.start();
            ChaikaBrowserOverlay.toolbarButton.start();
            ChaikaBrowserOverlay.aboneEvent.start();

            gBrowser.addProgressListener(ChaikaBrowserOverlay.webProgress);

            //リリースノートの表示
            setTimeout(function(){ ChaikaBrowserOverlay._showReleaseNotes(); }, 0);
        }else{
            ChaikaBrowserOverlay._initCount++;
            setTimeout(function(){ ChaikaBrowserOverlay.start(); }, 100);
        }
    },


    stop: function ChaikaBrowserOverlay_stop(){
        ChaikaBrowserOverlay.browserMenu.stop();
        ChaikaBrowserOverlay.contextMenu.stop();
        ChaikaBrowserOverlay.aboneEvent.stop();

        gBrowser.removeProgressListener(ChaikaBrowserOverlay.webProgress);
    },


    /**
     * ブラウザ起動時のウィンドウロード後に一度だけ実行される
     * バージョン更新時にのみ自動的にリリースノートを表示する
     */
    _showReleaseNotes: function ChaikaBrowserOverlay__showReleaseNotes(){
        //現在のバージョン
        var currentVersion = ChaikaBrowserOverlay.ChaikaAddonInfo.version;

        //前回リリースノートを表示した時のバージョン
        var showedVersion = ChaikaBrowserOverlay.ChaikaCore.pref.getChar('releasenotes_showed');

        if(Services.vc.compare(currentVersion, showedVersion) > 0){
            gBrowser.selectedTab = gBrowser.addTab('chaika://releasenotes/?updated=1');
            ChaikaBrowserOverlay.ChaikaCore.pref.setChar('releasenotes_showed', currentVersion);
        }
    },


    checkIvurRedirection: function(aLocation){
        if(!aLocation.spec.startsWith('chaika://ivur/')) return;

        let originalURI = aLocation.spec.replace('chaika://ivur/', '')
                                        .replace('?dummy_ext=.jpg', '');

        PopupNotifications.show(
            gBrowser.selectedBrowser,
            'chaika-ivur-popup',
            'ImageViewURLReplace.dat によって書き換えられたリンク先を表示しています。元のリンク先を表示しますか？',
            null,
            {
                label: '元のリンク先へ移動する',
                accessKey: 'O',
                callback: function(){
                    openUILinkIn(originalURI, 'current');
                }
            },
            null,
            {
                popupIconURL: 'chrome://chaika/content/icon.png'
            }
        );
    },


    webProgress: {
        onLocationChange: function(aWebProgress, aRequest, aLocation){
            setTimeout(() => {
                ChaikaBrowserOverlay.toolbarButton.onLocationChange(aLocation);
                ChaikaBrowserOverlay.checkIvurRedirection(aLocation);
            }, 0);
        },

        onStateChange: function(){},
        onProgressChange: function(){},
        onStatusChange: function(){},
        onSecurityChange: function(){},
        onLinkIconAvailable: function(){},

        QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"])
    }

};


Components.utils.import("resource://gre/modules/PopupNotifications.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js", ChaikaBrowserOverlay);
Components.utils.import('resource://chaika-modules/ChaikaAboneManager.js', ChaikaBrowserOverlay);
Components.utils.import('resource://chaika-modules/ChaikaAddonInfo.js', ChaikaBrowserOverlay);


ChaikaBrowserOverlay.browserMenu = {

    get _root(){
        delete this._root;
        return (this._root = document.getElementsByClassName('chaika-browser-menu')[0]);
    },

    /**
     * browserMenu.xml に処理を移譲する
     */
    __noSuchMethod__: function(methodName, args){
        return this._root[methodName].apply(this._root, args);
    },


    start: function(){
        Services.obs.addObserver(this, "chaika-skin-changed", false);
    },

    end: function(){
        Services.obs.removeObserver(this, "chaika-skin-changed", false);
    },

    observe: function(aSubject, aTopic, aData){
        if(aTopic !== 'chaika-skin-changed') return;

        let url = gBrowser.currentURI.spec;

        if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser.browsermenu.reload_when_skin_changed') &&
           ChaikaBrowserOverlay.browserMenu._isChaika(url) &&
           ChaikaBrowserOverlay.browserMenu._isThread(url)){
                   content.location.reload();
        }
    }

};


ChaikaBrowserOverlay.contextMenu = {

    start: function contextMenu_start(){
        this._contextMenu = document.getElementById('context-chaika');

        let enableContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool("contextmenu.enabled");

        if(enableContextMenu){
            this._contextMenu.hidden = false;

            let flattenContextMenu = ChaikaBrowserOverlay.ChaikaCore.pref.getBool('contextmenu.flattened');
            if(flattenContextMenu){
                this._flattenContextMenu();
            }

            let browserContextMenu = document.getElementById("contentAreaContextMenu");
            browserContextMenu.addEventListener("popupshowing", this, false);
        }else{
            this._contextMenu.hidden = true;
        }
    },


    stop: function contextMenu_stop(){
        this._contextMenu.hidden = true;

        let browserContextMenu = document.getElementById("contentAreaContextMenu");
        browserContextMenu.removeEventListener("popupshowing", this, false);
    },


    handleEvent: function(aEvent){
        switch(aEvent.type){
            case 'popupshowing':
                this._popupShowing();
                break;

            default:
        }
    },


    /**
     * コンテキストメニューをフラットにする
     */
    _flattenContextMenu: function contextMenu__flattenContextMenu(){
        // Remove menu#context-chaika
        this._contextMenu.parentNode.removeChild(this._contextMenu);

        // Create inline menu container
        var vbox = document.createElement('vbox');
        vbox.setAttribute('style', '-moz-binding:url(chrome://chaika/content/browser/browserMenu.xml#browserMenu)');

        // Insert the container at first of the contextmenu
        var browserContextMenu = document.getElementById('contentAreaContextMenu');
        browserContextMenu.insertBefore(vbox, browserContextMenu.firstChild);

        // Insert a separator after the container
        var separator = document.createElement('menuseparator');
        browserContextMenu.insertBefore(separator, vbox.nextSibling);

        this._contextMenu.removeAttribute('id');
        vbox.setAttribute('id', 'context-chaika');

        this._contextMenu = document.getElementById('context-chaika');
    },


    /**
     * コンテキストメニューが表示された時に呼ばれる
     */
    _popupShowing: function contextMenu__popupShowing(){
        //掲示板上でのみ表示する設定の場合
        // i) ページが掲示板上である -> 表示
        // ii) ページが掲示板上でない
        //     a) 設定が有効 かつ カーソルがリンク上 かつ リンク先が掲示板 -> 表示
        //     b) それ以外の時は表示しない
        if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('contextmenu.show_only_on_bbs')){
            if(ChaikaBrowserOverlay.browserMenu._isBBS(gBrowser.currentURI)){
                // i)
            }else{
                // ii)
                if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('contextmenu.always_show_open_link') &&
                   gContextMenu.onLink && ChaikaBrowserOverlay.browserMenu._isBBS(gContextMenu.linkURL)){
                           // ii) - a)
                }else{
                    // ii) - b)
                    this._contextMenu.hidden = true;
                    return;
                }
            }
        }


        this._contextMenu.hidden = false;


        //設定で非表示にされているものを非表示にする
        let prefs = Services.prefs.getBranch("extensions.chaika.contextmenu.");
        let prefNames = prefs.getChildList("", {});
        let root = this._contextMenu.classList.contains('chaika-browser-menu') ?
                        this._contextMenu :
                        this._contextMenu.firstChild;

        prefNames.forEach((name) => {
            if(!name.endsWith('enabled')) return;

            var anonid = name.replace('.enabled', '');
            var menuitem = document.getAnonymousElementByAttribute(root, 'anonid', anonid);

            if(menuitem){
                menuitem.hidden = !prefs.getBoolPref(name);
            }
        });
    },

};


ChaikaBrowserOverlay.toolbarButton = {

    start: function toolbarButton_start(){
        //初回起動時にボタンを追加する
        if(!ChaikaBrowserOverlay.ChaikaCore.pref.getBool("browser.toolbarbutton.installed") &&
           !document.getElementById('chaika-toolbarbutton')){
                let toolbar = document.getElementById("nav-bar");

                toolbar.insertItem('chaika-toolbarbutton', null);
                toolbar.setAttribute("currentset", toolbar.currentSet);
                document.persist(toolbar.id, "currentset");

                ChaikaBrowserOverlay.ChaikaCore.pref.setBool("browser.toolbarbutton.installed", true);
        }

        this._toolbarbutton = document.getElementById('chaika-toolbarbutton');
    },


    onLocationChange: function(aLocation){
        if(!ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser.toolbarbutton.show_only_on_bbs')){
            return;
        }

        this._toolbarbutton.hidden = aLocation.spec !== 'about:customizing' &&
                                     !ChaikaBrowserOverlay.browserMenu._isBBS(aLocation.spec);
    }
};


ChaikaBrowserOverlay.aboneEvent = {

    start: function aboneEvent_start(){
        Services.obs.addObserver(this, "chaika-abone-data-add", false);
        Services.obs.addObserver(this, "chaika-abone-data-remove", false);
    },


    stop: function aboneEvent_stop(){
        Services.obs.removeObserver(this, "chaika-abone-data-add", false);
        Services.obs.removeObserver(this, "chaika-abone-data-remove", false);
    },


    observe: function aboneEvent_observe(aSubject, aTopic, aData){
        let aboneType,
            legacyAboneType,  // b2r/chaika 1.6.3互換のあぼーんタイプ値
            eventType;

        switch(aTopic){
            case "chaika-abone-data-add":
                aboneType = aSubject.QueryInterface(Ci.nsISupportsString).data;
                eventType = 'chaika-abone-add';
                break;

            case 'chaika-abone-data-remove':
                aboneType = aSubject.QueryInterface(Ci.nsISupportsString).data;
                eventType = 'chaika-abone-remove';
                break;

            default:
                return;
        }


        switch(aboneType){
            case ChaikaBrowserOverlay.ChaikaAboneManager.ABONE_TYPE_NAME:
                legacyAboneType = 0;
                break;

            case ChaikaBrowserOverlay.ChaikaAboneManager.ABONE_TYPE_MAIL:
                legacyAboneType = 1;
                break;

            case ChaikaBrowserOverlay.ChaikaAboneManager.ABONE_TYPE_ID:
                legacyAboneType = 2;
                break;

            case ChaikaBrowserOverlay.ChaikaAboneManager.ABONE_WORD:
                legacyAboneType = 3;
                break;

            case ChaikaBrowserOverlay.ChaikaAboneManager.ABONE_EX:
                legacyAboneType = 99;  //Chaika Abone Helper 互換
                break;
        }


        //各タブに対して通知する
        for(let i = 0, iz = gBrowser.mPanelContainer.childNodes.length; i < iz; i++){
            let tabBrowser = gBrowser.getBrowserAtIndex(i);
            let tabURI = tabBrowser.currentURI;

            if(ChaikaBrowserOverlay.browserMenu._isChaika(tabURI)){
                let win = tabBrowser.contentWindow;
                let doc = tabBrowser.contentDocument;

                let sourceEvent = doc.createEvent("CustomEvent");
                sourceEvent.initCustomEvent(aboneType, false, false, aData);

                let event = doc.createEvent('XULCommandEvents');
                event.initCommandEvent(eventType, true, false, win, null,
                                        false, false, false, false, sourceEvent);

                doc.dispatchEvent(event);

                //chaika-abone-add については b2r/chaika 1.6.3 互換のイベントも発行する
                if(eventType === 'chaika-abone-add'){
                    let legacySourceEvent = doc.createEvent('Events');
                    legacySourceEvent.initEvent(aData, false, false);

                    let legacyEvent = doc.createEvent('XULCommandEvents');
                    legacyEvent.initCommandEvent('b2raboneadd', true, false, win, legacyAboneType,
                                                 false, false, false, false, legacySourceEvent);

                    doc.dispatchEvent(event);
                }
            }
        }
    }

};


window.addEventListener("load",   ChaikaBrowserOverlay.start, false);
window.addEventListener("unload", ChaikaBrowserOverlay.stop, false);
