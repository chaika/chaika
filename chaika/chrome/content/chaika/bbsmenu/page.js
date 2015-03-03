/* See license.txt for terms of usage */


let Page = {

    startup: function(){
        this._ns = new NotificationService(document.getElementById('notification'));
        this._bbsmenu = new BBSMenu();
        this._search = new SearchBox(document.getElementById('searchBox'),
                                       document.getElementById('searchEngineMenu'));

        this._initEvent();
        this._initTree();
        this._detectFoxAge2ch();
    },


    shutdown: function(){
        this._treeView.uninit();
        this._bbsmenu.uninit();
        this._search.uninit();
        this._uninitTree();
    },


    _initEvent: function(){
        window.addEventListener('unload', Page.shutdown.bind(this));
        document.getElementById('searchBox')
                .addEventListener('keydown', (ev) => this._incrementalSearch(ev.target.value));
    },


    _initTree: function(){
        this._tree = document.getElementById("bbsmenuTree");

        this._bbsmenu.getXML().then((xml) => {
            this._treeView = new BBSTreeView(xml);
            this._tree.view = this._treeView;
        }).catch((ex) => {
            this._ns.critical('BBSMENU 初期化エラー: ' + ex.message);
            ChaikaCore.logger.error(ex);
        });

        this._tree.setAttribute('treesize', ChaikaCore.pref.getChar("bbsmenu.tree_size"));
        this._branch = Services.prefs.getBranch("extensions.chaika.bbsmenu.");
        this._branch.addObserver('', this, false);
    },


    _uninitTree: function(){
        this._branch.removeObserver('', this);
    },


    observe: function(aSubject, aTopic, aData){
        if(aData === "tree_size"){
            this._tree.setAttribute('treesize', ChaikaCore.pref.getChar("bbsmenu.tree_size"));
        }
    },


    _detectFoxAge2ch: function(){
        var browser = ChaikaCore.browser.getBrowserWindow();

        if(browser && browser.document.getElementById("viewFoxAge2chSidebar")){
            document.getElementById("viewFoxAge2chMenu").hidden = false;
            document.getElementById('viewFoxAge2chMenu-separator').hidden = false;
        }
    },


    _incrementalSearch: function(query){
        if(this._inputTimer) clearTimeout(this._inputTimer);

        this._inputTimer = setTimeout(() => this.search(query), 250);
    },


    search: function(query, engine){
        if(query === ''){
            // 検索ボックスがクリアされた時は BBSMENU を表示する
            this._bbsmenu.getXML().then((xml) => {
                this._treeView.build(xml);

                this._ns.clear();
            }).catch((ex) => {
                this._treeView.build(null);

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
                this._ns.critical('検索失敗: ' + er.message);
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
     * @param {nsIFile} aDir 開くフォルダ
     */
    _openFolder: function(aDir){
        ChaikaCore.io.reveal(aDir);
    },


    /**
     * ダイアログを開く
     * @param {String} aURL 開くダイアログの URL
     * @param {String} [aType] 開くダイアログのタイプ (windowtype)
     */
    _openDialog: function(aURL, aType){
        ChaikaCore.browser.openWindow(aURL, aType);
    },



    /* ***** Implement menu commands ***** */

    updateBBSMENU: function(){
        this._ns.info('BBSMENU 更新中...');

        this._bbsmenu.update().then((updatedXML) => {
            this._treeView.build(updatedXML);

            this._ns.clear();
            this._ns.info('更新完了', 1500);
        }).catch((er) => {
            this._ns.critical('更新失敗: ' + er.message);
            ChaikaCore.logger.error(er);
        });
    },

    addFavoriteBoard: function(){
        let favBoardFile = ChaikaCore.getDataDir();
        favBoardFile.appendRelativePath('favorite_boards.xml');

        this._openFolder(favBoardFile);
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
        this._openFolder(ChaikaCore.getDataDir());
    },


    openSkinFolder: function(){
        let skinDir = ChaikaCore.getDataDir();

        skinDir.appendRelativePath('skin');
        this._openFolder(skinDir);
    },


    openSearchPluginFolder: function(){
        let pluginFolder = ChaikaCore.getDataDir();

        pluginFolder.appendRelativePath('search');
        this._openFolder(pluginFolder);
    },


    openLogFolder: function(){
        this._openFolder(ChaikaCore.getLogDir());
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


Page.startup();
