/* See license.txt for terms of usage */


(function(global){
    "use strict";

    const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

    let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
    let { ChaikaCore } = Cu.import("resource://chaika-modules/ChaikaCore.js", {});
    let { ChaikaBBSMenu }  = Cu.import("resource://chaika-modules/ChaikaBBSMenu.js", {});


    let Page = {

        /**
         * 初回表示時に実行される
         */
        startup: function(){
            this._ns = new NotificationService(document.getElementById('notification'));
            this._search = new SearchBox(document.getElementById('searchBox'),
                                         document.getElementById('searchEngineMenu'));

            this._initEvent();
            this._initTree();
            this._detectFoxAge2ch();
        },


        shutdown: function(){
            this._uninitTree();
        },


        _initEvent: function(){
            document.getElementById('searchBox')
                    .addEventListener('command', (ev) => this.search(ev.target.value));
        },


        _initTree: function(){
            this._tree = document.getElementById("bbsmenuTree");

            ChaikaBBSMenu.getXML().then((xml) => {
                this._treeView = new BBSTreeView(xml);
                this._tree.view = this._treeView;
            }).catch((ex) => {
                this._ns.critical('BBSMENU 初期化エラー: ' + ex.message);
                ChaikaCore.logger.error(ex);
            });

            this._changeTextSize();

            this._branch = Services.prefs.getBranch("extensions.chaika.bbsmenu.");
            this._branch.addObserver('', this, false);
        },


        _uninitTree: function(){
            this._treeView.uninit();
            this._branch.removeObserver('', this);
        },


        observe: function(aSubject, aTopic, aData){
            if(aData === "tree_size"){
                this._changeTextSize();
            }
        },


        _changeTextSize: function(){
            this._tree.collapsed = true;

            this._tree.className = this._tree.className.replace(/tree-text-\W+/g, '');
            this._tree.classList.add('tree-text-' + ChaikaCore.pref.getChar("bbsmenu.tree_size"));

            setTimeout(() => this._tree.collapsed = false, 0);
        },


        _detectFoxAge2ch: function(){
            var browser = ChaikaCore.browser.getBrowserWindow();

            if(browser && browser.document.getElementById("viewFoxAge2chSidebar")){
                document.getElementById("viewFoxAge2chMenu").hidden = false;
                document.getElementById('viewFoxAge2chMenu-separator').hidden = false;
            }
        },


        search: function(query, engine){
            if(query === '' || query === undefined){
                // 検索ボックスがクリアされた時は BBSMENU を表示する
                ChaikaBBSMenu.getXML().then((xml) => {
                    this._treeView.build(xml);

                    this._ns.clear();
                }).catch((ex) => {
                    this._ns.clear();
                    this._ns.critical('BBSMENU 初期化エラー: ' + ex.message);
                    ChaikaCore.logger.error(ex);
                });
            }else{
                this._ns.info('検索中...');

                if(engine){
                    this._search.setSearchEngine(engine);
                }

                this._search.search(query).then((resultXML) => {
                    this._treeView.build(resultXML);

                    this._ns.clear();
                }).catch((er) => {
                    this._ns.clear();
                    this._ns.critical('検索失敗: ' + (er.message || er));
                    ChaikaCore.logger.error('Search failed:', er);
                });
            }
        },



        /**
         * URL を新しいタブで開く
         * @param {String} aURL 開く URL
         */
        _openURL: function(aURL){
            ChaikaCore.browser.openURL(Services.io.newURI(aURL, null, null), true);
        },


        /**
         * フォルダを開く
         * @param {nsIFile} aFile 開くファイルまたはフォルダ
         */
        _openFile: function(aFile){
            ChaikaCore.io.reveal(aFile);
        },


        /**
         * ダイアログを開く
         * @param {String} aURL 開くダイアログの URL
         * @param {String} [aType] 開くダイアログのタイプ (windowtype)
         */
        _openDialog: function(aURL, aType){
            ChaikaCore.browser.openWindow(aURL, aType);
        },



        /* ***** Implement Menu Commands ***** */

        updateBBSMENU: function(){
            this._ns.info('BBSMENU 更新中...');

            ChaikaBBSMenu.update().then((updatedXML) => {
                this._treeView.build(updatedXML);

                this._ns.clear();
                this._ns.info('更新完了', 1500);
            }).catch((er) => {
                this._ns.clear();
                this._ns.critical('更新失敗: ' + er.message);
                ChaikaCore.logger.error(er);
            });
        },

        addFavoriteBoard: function(){
            let favBoardFile = ChaikaCore.getDataDir();
            favBoardFile.appendRelativePath('favorite_boards.xml');

            if(ChaikaCore.pref.getBool('bbsmenu.open_favs_in_scratchpad')){
                try{
                    var { ScratchpadManager } = Cu.import('resource:///modules/devtools/scratchpad-manager.jsm', {});
                }catch(ex){
                    // Firefox 44+ (See https://bugzilla.mozilla.org/show_bug.cgi?id=912121)
                    var { ScratchpadManager } = Cu.import('resource://devtools/client/scratchpad/scratchpad-manager.jsm', {});
                }
                let win = ScratchpadManager.openScratchpad();

                win.addEventListener('load', () => {
                    win.Scratchpad.addObserver({
                        onReady: () => {
                            win.Scratchpad.removeObserver(this);
                            win.Scratchpad.importFromFile(favBoardFile, false, () => {
                                win.Scratchpad.editor.setMode({ name: 'xml' });
                            });
                        }
                    });
                });
            }else{
                this._openFile(favBoardFile);
            }
        },

        openLogManager: function(){
            this._openURL("chaika://log-manager/");
        },


        openAboneManager: function(){
            this._openDialog("chrome://chaika/content/settings/abone-manager.xul");
        },


        openAAManager: function(){
            this._openDialog("chrome://chaika/content/settings/aa-manager.xul");
        },


        openReplacementManager: function(){
            this._openDialog("chrome://chaika/content/settings/replacement-manager.xul");
        },


        openDataFolder: function(){
            this._openFile(ChaikaCore.getDataDir());
        },


        openSkinFolder: function(){
            let skinDir = ChaikaCore.getDataDir();

            skinDir.appendRelativePath('skin');
            this._openFile(skinDir);
        },


        openSearchPluginFolder: function(){
            let pluginFolder = ChaikaCore.getDataDir();

            pluginFolder.appendRelativePath('search');
            this._openFile(pluginFolder);
        },


        openLogFolder: function(){
            this._openFile(ChaikaCore.getLogDir());
        },


        openSupport: function(){
            this._openURL("chaika://support/");
        },


        openReleaseNotes: function(){
            this._openURL("chaika://releasenotes/");
        },


        openOnlineHelp: function(){
            this._openURL("https://github.com/chaika/chaika/wiki");
        },


        openHomePage: function(){
            this._openURL("https://github.com/chaika/chaika");
        },


        openSettings: function(){
            this._openDialog("chrome://chaika/content/settings/settings.xul", "chaika:settings");
        },


        viewFoxAge2ch: function Page_viewFoxAge2ch(){
            var browser = ChaikaCore.browser.getBrowserWindow();
            if(browser && browser.document.getElementById("viewFoxAge2chSidebar")){
                browser.document.getElementById("viewFoxAge2chSidebar").doCommand();
            }
        }
    };


    // ---- Export ------------------------------------------
    global.Page = Page;

})((this || 0).self || global);
