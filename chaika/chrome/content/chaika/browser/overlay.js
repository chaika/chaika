var ChaikaBrowserOverlay = {

    _initCount: 0,

    start: function ChaikaBrowserOverlay_start(){
        //10s待ってもChaikaCoreが初期化されていなかったら
        //初期化は失敗したものとみなす
        if(ChaikaBrowserOverlay._initCount > 100){
            return;
        }

        if(ChaikaBrowserOverlay.ChaikaCore.initialized){
            ChaikaBrowserOverlay.browserMenu.start();
            ChaikaBrowserOverlay.contextMenu.start();
            ChaikaBrowserOverlay.toolbarButton.start();
            ChaikaBrowserOverlay.aboneEvent.start();

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
        ChaikaBrowserOverlay.toolbarButton.stop();
        ChaikaBrowserOverlay.aboneEvent.stop();
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

};


Components.utils.import("resource://chaika-modules/ChaikaCore.js", ChaikaBrowserOverlay);
Components.utils.import('resource://chaika-modules/ChaikaAboneManager.js', ChaikaBrowserOverlay);
Components.utils.import('resource://chaika-modules/ChaikaAddonInfo.js', ChaikaBrowserOverlay);


ChaikaBrowserOverlay.browserMenu = {

    get browserMenu(){
        return ChaikaBrowserOverlay.contextMenu._contextMenu.firstChild ||  // when normal
                ChaikaBrowserOverlay.contextMenu._contextMenu;  // when flattened
    },

    /**
     * browserMenu.xml に処理を移譲する
     */
    __noSuchMethod__: function(methodName, args){
        return this.browserMenu[methodName].apply(this.browserMenu, args);
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


        //設定で非表示にされているものを非表示にする

        this._contextMenu.hidden = false;

        //ChaikaCore.pref を使うと存在しない設定値の場合エラーが出てしまうので自前で用意する
        var prefs = Services.prefs.getBranch("extensions.chaika.contextmenu.");
        var menuitems = document.getAnonymousNodes(ChaikaBrowserOverlay.browserMenu.browserMenu)
                                    .item(0).querySelectorAll('menu, menuitem');

        Array.slice(menuitems).forEach(function(item){
            try{
                item.hidden = !prefs.getBoolPref(item.getAttribute('anonid') + '.enabled');
            }catch(ex){}
        });
    },

};


ChaikaBrowserOverlay.toolbarButton = {

    start: function toolbarButton_start(){
        if(ChaikaBrowserOverlay.ChaikaCore.pref.getBool('browser.toolbarbutton.show_only_on_bbs')){
            gBrowser.addProgressListener(ChaikaBrowserOverlay.toolbarButton.webProgress)
        }

        //初回起動時にボタンを追加する
        if(!ChaikaBrowserOverlay.ChaikaCore.pref.getBool("browser.toolbarbutton.installed") &&
           !document.getElementById('chaika-toolbarbutton')){
                let toolbar = document.getElementById("nav-bar");

                toolbar.insertItem('chaika-toolbarbutton', null);
                toolbar.setAttribute("currentset", toolbar.currentSet);
                document.persist(toolbar.id, "currentset");

                ChaikaBrowserOverlay.ChaikaCore.pref.setBool("browser.toolbarbutton.installed", true);
        }
    },

    stop: function toolbarButton_stop(){
        try{
            gBrowser.removeProgressListener(ChaikaBrowserOverlay.toolbarButton.webProgress);
        }catch(ex){}
    },

    webProgress: {
        QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                           "nsISupportsWeakReference"]),

        onLocationChange: function(aWebProgress, aRequest, aLocation){
            setTimeout(function(){
                document.getElementById('chaika-toolbarbutton').hidden =
                    aLocation.spec !== 'about:customizing' &&
                    !ChaikaBrowserOverlay.browserMenu._isBBS(aLocation.spec);
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
        Services.obs.addObserver(this, "b2r-abone-data-add", false);
    },


    stop: function aboneEvent_stop(){
        Services.obs.removeObserver(this, "b2r-abone-data-add", false);
    },


    observe: function aboneEvent_observe(aSubject, aTopic, aData){
        let aboneType,
            legacyAboneType,  // b2r/chaika 1.6.3互換のあぼーんタイプ値
            eventType;

        switch(aTopic){
            case "b2r-abone-data-add":
                aboneType = aSubject.QueryInterface(Ci.nsISupportsString).data;
                eventType = 'chaika-abone-add';
                break;

            case 'b2r-abone-data-remove':
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
                legacyAboneType = 99;  //Chaika Abone Manager 互換
                break;
        }


        //各タブに対して通知する
        for(let i = 0, iz = gBrowser.mPanelContainer.childNodes.length; i < iz; i++){
            let tabBrowser = gBrowser.getBrowserAtIndex(i);
            let tabURI = tabBrowser.currentURI;

            if(ChaikaBrowserOverlay.browserMenu._isChaika(tabURI)){
                let win = tabBrowser.contentWindow;
                let doc = tabBrowser.contentDocument;

                let sourceEvent = doc.createEvent("Events");
                sourceEvent.initEvent(aData, false, false);

                let event = doc.createEvent('XULCommandEvents');
                event.initCommandEvent(eventType, true, false, win, aboneType,
                                        false, false, false, false, sourceEvent);

                doc.dispatchEvent(event);

                //chaika-abone-add については b2r/chaika 1.6.3 互換のイベントも発行する
                if(eventType === 'chaika-abone-add'){
                    let legacyEvent = doc.createEvent('XULCommandEvents');
                    legacyEvent.initCommandEvent('b2raboneadd', true, false, win, legacyAboneType,
                                                 false, false, false, false, sourceEvent);

                    doc.dispatchEvent(event);
                }
            }
        }
    }

}


window.addEventListener("load",   ChaikaBrowserOverlay.start, false);
window.addEventListener("unload", ChaikaBrowserOverlay.stop, false);
