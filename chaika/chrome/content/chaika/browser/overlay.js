/* See license.txt for terms of usage */


(function(global){
    "use strict";

    const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

    let { ChaikaCore } = Cu.import("resource://chaika-modules/ChaikaCore.js", {});
    let { ChaikaAddonInfo } = Cu.import('resource://chaika-modules/ChaikaAddonInfo.js', {});
    let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});
    let { Browser } = Cu.import('resource://chaika-modules/utils/Browser.js', {});


    let Overlay = {

        start: function(){
            BrowserMenu.start();
            ContextMenu.start();
            ToolbarButton.start();

            gBrowser.addProgressListener(this.webProgress);

            global.setTimeout(() => {
                this._showReleaseNotes();

                // スタートページを about:blank にしていると
                // 起動時にページ遷移が発火せずツールバーボタンの表示/非表示が正しく行われない
                // そこで起動直後に擬似的にページ遷移を発火させる
                this.webProgress.onLocationChange(null, null, gBrowser.currentURI);
            }, 0);
        },


        stop: function(){
            BrowserMenu.stop();
            ContextMenu.stop();
            gBrowser.removeProgressListener(this.webProgress);
        },


        /**
         * ブラウザ起動時のウィンドウロード後に一度だけ実行される
         * バージョン更新時にのみ自動的にリリースノートを表示する
         */
        _showReleaseNotes: function(){
            //現在のバージョン
            var currentVersion = ChaikaAddonInfo.version;

            //前回リリースノートを表示した時のバージョン
            var showedVersion = ChaikaCore.pref.getChar('releasenotes_showed');

            if(Services.vc.compare(currentVersion, showedVersion) > 0){
                gBrowser.selectedTab = gBrowser.addTab('chaika://releasenotes/?updated=1');
                ChaikaCore.pref.setChar('releasenotes_showed', currentVersion);
            }
        },


        checkIvurRedirection: function(aLocation){
            if(!aLocation.spec.startsWith('chaika://ivur/')) return;

            let originalURI = aLocation.spec.replace('chaika://ivur/', '')
                                            .replace('?dummy_ext=.jpg', '');

            if(ChaikaCore.pref.getInt('browser.redirector.ivur.behavior') === 1){
                openUILinkIn(originalURI, 'current');
                return;
            }

            PopupNotifications.show(
                gBrowser.selectedBrowser,
                'chaika-ivur-popup',
                'ImageViewURLReplace.dat によって書き換えられたリンク先を表示しています。元のリンク先を表示しますか？',
                null,
                {
                    label: '元のリンク先へ移動する',
                    accessKey: 'M',
                    callback: function(){
                        ChaikaCore.pref.setInt('browser.redirector.ivur.behavior', 0);
                        openUILinkIn(originalURI, 'current');
                    }
                },
                [
                    {
                        label: '今後は必ず元のリンク先へ移動する',
                        accessKey: 'F',
                        callback: function(){
                            ChaikaCore.pref.setInt('browser.redirector.ivur.behavior', 1);
                            openUILinkIn(originalURI, 'current');
                        }
                    },
                    {
                        label: '今後一切この通知を表示しない',
                        accessKey: 'I',
                        callback: function(){
                            ChaikaCore.pref.setInt('browser.redirector.ivur.behavior', 2);
                        }
                    }

                ],
                {
                    popupIconURL: 'chrome://chaika/content/icon.png',
                    dismissed: ChaikaCore.pref.getInt('browser.redirector.ivur.behavior') > 0
                }
            );
        },


        webProgress: {
            onLocationChange: function(aWebProgress, aRequest, aLocation){
                setTimeout(() => {
                    ToolbarButton.onLocationChange(aLocation);
                    Overlay.checkIvurRedirection(aLocation);
                }, 0);
            },

            onStateChange: function(){},
            onProgressChange: function(){},
            onStatusChange: function(){},
            onSecurityChange: function(){},
            onLinkIconAvailable: function(){},

            QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"])
        },

    };


    /**
     * Chaika Browser Menu (Base Class)
     * @class
     */
    let BrowserMenuBase = {

        get _root(){
            return document.getElementsByClassName('chaika-browser-menu')[0];
        },


        start: function(){
            Browser.getGlobalMessageManager()
                   .addMessageListener('chaika-browser-menu-command', this.listener);
        },


        stop: function(){
            Browser.getGlobalMessageManager()
                   .removeMessageListener('chaika-browser-menu-command', this.listener);
        },


        /**
         * Handle browser menu command request from the content.
         * @param  {Object} message .name {String} Command name, .args {Array} arguments for the command
         * @return {Any}
         */
        listener: function(message){
            return BrowserMenu._root[message.data.name](...message.data.args);
        },

    };


    /**
     * Chaika Browser Menu
     * @class
     */
    let BrowserMenu = new Proxy(BrowserMenuBase, {

        has: function(target, name){
            return true;
        },

        get: function(target, name, receiver){
            if(name in target){
                return target[name];
            }

            // Forward the method call to browserMenu.xml
            return (...args) => {
                return target._root[name](...args);
            };
        }

    });


    /**
     * Context Menu
     * @class
     */
    let ContextMenu = {

        get _menuNode(){
            return this._isFlattened ?
                this._flattenedMenu :
                this._unflattenedMenu;
        },

        get _menuRoot(){
            return this._isFlattened ?
                this._flattenedMenu :
                this._unflattenedMenu.firstChild;
        },

        start: function(){
            this._flattenedMenu = document.getElementById('context-chaika-flattened');
            this._unflattenedMenu = document.getElementById('context-chaika');

            this._unflatten();

            if(ChaikaCore.pref.getBool("contextmenu.enabled")){
                this._show();

                if(ChaikaCore.pref.getBool('contextmenu.flattened')){
                    this._flatten();
                }

                document.getElementById("contentAreaContextMenu")
                        .addEventListener("popupshowing", this, false);
            }else{
                this._hide();
            }
        },


        stop: function(){
            this._hide();
            document.getElementById("contentAreaContextMenu")
                    .removeEventListener("popupshowing", this, false);
        },


        handleEvent: function(aEvent){
            switch(aEvent.type){
                case 'popupshowing':
                    this._popupShowing(aEvent);
                    break;

                default:
            }
        },


        /**
         * コンテキストメニューをフラットにする
         */
        _flatten: function(){
            this._flattenedMenu.hidden = false;
            this._flattenedMenu.classList.add('chaika-status-flattened');
            this._unflattenedMenu.hidden = true;
            this._isFlattened = true;
        },


        _unflatten: function(){
            this._flattenedMenu.hidden = true;
            this._flattenedMenu.classList.remove('chaika-status-flattened');
            this._unflattenedMenu.hidden = false;
            this._isFlattened = false;
        },


        /**
         * コンテキストメニューを非表示にする
         */
        _hide: function(){
            this._menuNode.hidden = true;
        },


        /**
         * コンテキストメニューを表示する
         */
        _show: function(){
            this._menuNode.hidden = false;
        },


        /**
         * コンテキストメニューが表示された時に呼ばれる
         */
        _popupShowing: function(aEvent){
            // Show/hide the context menu
            const showOnlyOnBBS = ChaikaCore.pref.getBool('contextmenu.show_only_on_bbs');
            const showOnBBSLink = ChaikaCore.pref.getBool('contextmenu.always_show_open_link');
            const isOnBBS = URLUtils.isBBS(gBrowser.currentURI.spec);
            const isOnBBSLink = gContextMenu.onLink && URLUtils.isBBS(BrowserMenu._getLinkURL().spec);

            if(showOnlyOnBBS && !isOnBBS){
                if(!showOnBBSLink || (showOnBBSLink && !isOnBBSLink)){
                    this._hide();
                    return;
                }
            }

            this._show();

            // Show/hide each items
            let prefs = Services.prefs.getBranch("extensions.chaika.contextmenu.");
            let prefNames = prefs.getChildList("", {});

            prefNames.forEach((name) => {
                if(!name.endsWith('enabled')) return;

                let anonid = name.replace('.enabled', '');
                let menuitem = document.getAnonymousElementByAttribute(
                    this._menuRoot, 'anonid', anonid
                );

                if(menuitem){
                    menuitem.hidden = !prefs.getBoolPref(name);
                }
            });

            // Set status if the menu is flattened
            if(this._isFlattened){
                BrowserMenu._onPopupshowing(aEvent);
            }
        },

    };


    /**
     * Toolbar Button
     * @class
     */
    let ToolbarButton = {

        start: function(){
            //初回起動時にボタンを追加する
            if(!ChaikaCore.pref.getBool("browser.toolbarbutton.installed") &&
               !document.getElementById('chaika-toolbarbutton')){
                    let toolbar = document.getElementById("nav-bar");

                    toolbar.insertItem('chaika-toolbarbutton', null);
                    toolbar.setAttribute("currentset", toolbar.currentSet);
                    document.persist(toolbar.id, "currentset");

                    ChaikaCore.pref.setBool("browser.toolbarbutton.installed", true);
            }

            this._toolbarbutton = document.getElementById('chaika-toolbarbutton');
        },


        onLocationChange: function(aLocation){
            if(!ChaikaCore.pref.getBool('browser.toolbarbutton.show_only_on_bbs')){
                return;
            }

            this._toolbarbutton.hidden = aLocation.spec !== 'about:customizing' &&
                                         !URLUtils.isBBS(aLocation.spec);
        },

    };


    // Export
    global.ChaikaBrowserOverlay = Overlay;
    global.ChaikaBrowserOverlay.browserMenu = BrowserMenu;
    global.ChaikaBrowserMenu = BrowserMenu;


    // Invoke
    global.addEventListener("load", Overlay.start.bind(Overlay), false);
    global.addEventListener("unload", Overlay.stop.bind(Overlay), false);

})((this || 0).self || global);
