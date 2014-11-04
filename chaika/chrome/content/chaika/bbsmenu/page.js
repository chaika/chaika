/* See license.txt for terms of usage */

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaSearch.js");
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const MODE_BBSMENU = 0;
const MODE_SEARCH = 1;


var Page = {

    startup: function Page_startup(){
        var tree = document.getElementById("bookmarks-view");
        tree.collapsed = true;
        tree.setAttribute("treesize", ChaikaCore.pref.getChar("bbsmenu.tree_size"));

        this.showViewFoxAge2chMenu();
        SearchBox.init();
        PrefObserver.start();

        setTimeout(function(){ Page.delayStartup(); }, 0);
    },

    delayStartup: function Page_delayStartup(){
        var tree = document.getElementById("bookmarks-view");
        tree.collapsed = false;

        if(Bbsmenu.getItemCount() == 0){
            BbsmenuUpdater.update();
        }else{
            Bbsmenu.initTree();
        }
    },

    shutdown: function Page_shutdown(){
        PrefObserver.stop();
        Tree.saveOpenedCategories();
    },


    showViewFoxAge2chMenu: function Page_showViewFoxAge2chMenu(){
        var browser = ChaikaCore.browser.getBrowserWindow();
        if(browser && browser.document.getElementById("viewFoxAge2chSidebar")){
            document.getElementById("viewFoxAge2chMenu").hidden = false;
            document.getElementById('viewFoxAge2chMenu-separator').hidden = false;
        }
    },


    openLogManager: function Page_openLogManager(){
        ChaikaCore.browser.openURL(Services.io.newURI("chaika://log-manager/", null, null), true);
    },


    openDataFolder: function Page_openDataFolder(){
        var logDir = ChaikaCore.getDataDir();
        ChaikaCore.io.revealDir(logDir);
    },


    openSupport: function Page_openSupport(){
        ChaikaCore.browser.openURL(Services.io.newURI("chaika://support/", null, null), true);
    },


    openReleaseNotes: function Page_openReleaseNotes(){
        ChaikaCore.browser.openURL(Services.io.newURI("chaika://releasenotes/", null, null), true);
    },


    openOnlineHelp: function(){
        ChaikaCore.browser.openURL(Services.io.newURI("https://github.com/chaika/chaika/wiki", null, null), true);
    },


    openSettings: function Page_openSettings(){
        var winMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
        var settingdWin = winMediator.getMostRecentWindow("chaika:settings");
        if(settingdWin){
            settingdWin.focus();
            return;
        }

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


    viewFoxAge2ch: function Page_viewFoxAge2ch(){
        var browser = ChaikaCore.browser.getBrowserWindow();
        if(browser && browser.document.getElementById("viewFoxAge2chSidebar")){
            browser.document.getElementById("viewFoxAge2chSidebar").doCommand();
        }
    }

};




var PrefObserver = {

    PREF_BRANCH: "extensions.chaika.bbsmenu.",

    start: function PrefObserver_start(){
        var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
        this._branch = prefService.getBranch(this.PREF_BRANCH).QueryInterface(Ci.nsIPrefBranch);
        this._branch.addObserver("", this, false);
    },


    stop: function PrefObserver_stop(){
        this._branch.removeObserver("", this);
    },


    observe: function PrefObserver_observe(aSubject, aTopic, aData){
        if(aTopic != "nsPref:changed") return;

        if(aData == "tree_size"){
            Tree.changeTreeSize();
        }

    }

};




var Notification = {

    info: function Notification_info(aLabel, aTimeout){
        var notification = document.getElementById("notification");
        var newNode = notification.appendNotification(aLabel, null, null,
                notification.PRIORITY_INFO_MEDIUM, null);

        if(aTimeout){
            setTimeout(function(){ Notification.remove(newNode); }, aTimeout);
        }

        return newNode;
    },


    warning: function Notification_warning(aLabel, aTimeout){
        var notification = document.getElementById("notification");
        var newNode = notification.appendNotification(aLabel, null, null,
                notification.PRIORITY_WARNING_MEDIUM, null);

        if(aTimeout){
            setTimeout(function(){ Notification.remove(newNode); }, aTimeout);
        }
        return newNode;
    },


    critical: function Notification_critical(aLabel, aTimeout){
        var notification = document.getElementById("notification");
        var newNode = notification.appendNotification(aLabel, null, null,
                notification.PRIORITY_CRITICAL_MEDIUM, null);

        if(aTimeout){
            setTimeout(function(){ Notification.remove(newNode); }, aTimeout);
        }
        return newNode;
    },


    removeAll: function Notification_removeAll(){
        var notification = document.getElementById("notification");
        notification.removeAllNotifications(false);
    },


    remove: function Notification_remove(aNode){
        var notification = document.getElementById("notification");
        notification.removeNotification(aNode);
    }

};




var SearchBox = {

    init: function SearchBox_init(){
        this._textbox = document.getElementById("searchBox");

        this._createMenu();
        this.setSearchMode(ChaikaCore.pref.getChar('bbsmenu.search.default_engine_name'));
    },

    /**
     * 検索メニューを構築する
     */
    _createMenu: function(){
        let popup = document.getElementById('searchModeMenu');

        ChaikaSearch.plugins.forEach(plugin => {
            if(!plugin.search) return;

            let menuitem = document.createElement('menuitem');

            menuitem.setAttribute('label', plugin.name);
            menuitem.setAttribute('value', plugin.id);
            menuitem.setAttribute('type', 'radio');
            menuitem.setAttribute('name', 'searchModeMenuitem');

            menuitem.addEventListener('command', event => {
                this._textbox.emptyText = event.target.getAttribute('label');
            });

            popup.appendChild(menuitem);
        });
    },


    search: function SearchBox_search(aSearchStr){
        //空文字が入力された場合には検索モードを終了する
        if(!aSearchStr){
            Bbsmenu.initTree();
            return;
        }

        //検索を実行する
        Notification.removeAll();
        Notification.info('検索中');

        let plugin = ChaikaSearch.getPlugin(this.getSearchMode());
        let promise = plugin.search(ChaikaCore.io.escapeHTML(aSearchStr));

        promise.then(this._showResults, this._onError)
               .then(null, this._onError);
    },

    _showResults: function(results){
        Notification.removeAll();

        let doc = document.implementation.createDocument(null, '', null);
        let root = document.createElement('category');

        results.forEach((board) => {
            let boardItem = document.createElement('board');
            let boardTitle = ChaikaCore.io.unescapeHTML(board.title);

            boardItem.setAttribute('title', boardTitle);
            boardItem.setAttribute('url', board.url || '');
            boardItem.setAttribute('type', board.type || ChaikaBoard.BOARD_TYPE_PAGE);

            //板名フィルタの場合、threadsが空になるが、
            //それ以外の時は板はフォルダ扱いになる
            if(board.threads){
                boardItem.setAttribute('isContainer', 'true');
                boardItem.setAttribute('isOpen', 'true');

                board.threads.forEach((thread) => {
                    let threadItem = document.createElement('thread');
                    let threadTitle = ChaikaCore.io.unescapeHTML(thread.title);

                    if(thread.post){
                        threadTitle += ' [' + thread.post + ']';
                    }

                    threadItem.setAttribute('url', thread.url);
                    threadItem.setAttribute('title', threadTitle);
                    threadItem.setAttribute('boardName', boardTitle);

                    boardItem.appendChild(threadItem);
                });
            }

            root.appendChild(boardItem);
        });

        doc.appendChild(root);

        Tree.initTree(doc, MODE_SEARCH);
    },

    _onError: function(aError){
        Notification.removeAll();
        Notification.warning('検索に失敗しました', 2500);
        ChaikaCore.logger.error('Search failed:', aError);
    },


    /**
     * 現在選択されている検索エンジンのIDを返す
     * @return {String} 検索エンジンのID
     */
    getSearchMode: function SearchBox_getSearchMode(){
        let popup = document.getElementById('searchModeMenu');
        let selectedItem = popup.querySelector('[checked="true"]');

        return selectedItem.getAttribute('value');
    },


    /**
     * 検索エンジンを指定する
     * @param {String} aID 検索エンジンのID
     */
    setSearchMode: function(aID){
        document.querySelector('menuitem[value="' + aID + '"]').setAttribute('checked', 'true');
        this._textbox.emptyText = ChaikaSearch.getPlugin(aID).name;
    }

};




var BbsmenuUpdater = {

    _downloader: null,
    _infoNode: null,


    update: function BbsmenuUpdater_update(){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var bbsmenuHtmlURLSpec = ChaikaCore.pref.getChar("bbsmenu.bbsmenu_html_url");
        var bbsmenuHtmlURL = ioService.newURI(bbsmenuHtmlURLSpec, null, null);
        var bbsmenuHtmlCharset = ChaikaCore.pref.getChar("bbsmenu.bbsmenu_html_charset");

        this._downloader = new ChaikaSimpleDownloader();
        this._downloader.download(bbsmenuHtmlURL, bbsmenuHtmlCharset, this);
        Notification.removeAll();
        this._infoNode = Notification.info("BBSMENU 更新中");
    },


    onStop: function BbsmenuUpdater_onStop(aDownloader, aResponse, aHttpStatus){
        if(aResponse && aResponse.indexOf(".2ch.net/") != -1){
            Bbsmenu.update(aResponse);
            Bbsmenu.initTree()
            Notification.info("更新しました", 1200);
        }else{
            Notification.critical("更新に失敗しました", 2500);
        }
        Notification.remove(this._infoNode);
        this._downloader = null;
        this._infoNode = null;
    },


    onError: function BbsmenuUpdater_onError(aDownloader, aErrorCode){
        Notification.critical("更新に失敗しました", 2500);
        Notification.remove(this._infoNode);
        this._downloader = null;
        this._infoNode = null;
    }

};




var Bbsmenu = {

    initTree: function Bbsmenu_initTree(){
        this._DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);

        var doc = this.getBbsmenuDoc();
        Tree.initTree(doc, MODE_BBSMENU);
    },

    update: function Bbsmenu_update(aHtmlSource){
        var parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

        var bbsmenuDoc = this._DOMParser.parseFromString("<root xmlns:html='http://www.w3.org/1999/xhtml'/>", "text/xml");
        var fragment = parserUtils.parseFragment(aHtmlSource, 0, false, null, bbsmenuDoc.documentElement);
        bbsmenuDoc.documentElement.appendChild(fragment);


        var storage = ChaikaCore.storage;
        var categoryInsertStatement = storage.createStatement(
                "INSERT INTO bbsmenu(title, title_n, path, is_category) VALUES(?1, '', ?2, 1);");
        var bosrdInsertStatement = storage.createStatement(
                "INSERT INTO bbsmenu(title, title_n, url, path, board_type, board_id, is_category) " +
                "VALUES(?1, '', ?2, ?3, ?4, ?5, 0);");
        var node = null;
        var currentCategoryPath = "";


        storage.beginTransaction();
        try{
            storage.executeSimpleSQL("DELETE FROM bbsmenu");
            storage.executeSimpleSQL("INSERT INTO bbsmenu(title, title_n, path, is_category) " +
                    "VALUES('2ch', '', '/2ch/', 1);");

            var xpath = "root/html:font/html:b/text() | root/html:font/html:a[@href]" +
                            " | root/font/b/text() | root/font/a[@href]";
            function resolver(){
                return "http://www.w3.org/1999/xhtml";
            }
            var xpathResult = bbsmenuDoc.evaluate(xpath, bbsmenuDoc, resolver,
                    Ci.nsIDOMXPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
            while(node = xpathResult.iterateNext()){
                if(node.nodeType == Ci.nsIDOMNode.TEXT_NODE){
                    var title = node.nodeValue;
                    currentCategoryPath = "/2ch/" + title.replace("/", "_", "g") + "/";
                    categoryInsertStatement.bindStringParameter(0, title);
                    categoryInsertStatement.bindStringParameter(1, currentCategoryPath);
                    categoryInsertStatement.execute();
                }else if(currentCategoryPath){
                    var title = node.firstChild.nodeValue;
                    var urlSpec = node.getAttribute("href");
                    var type = ChaikaBoard.BOARD_TYPE_PAGE;
                    var boardID = "";
                    try{
                        var url = ioService.newURI(urlSpec, null, null);
                        type = ChaikaBoard.getBoardType(url);
                        if(type != ChaikaBoard.BOARD_TYPE_PAGE){
                            boardID = ChaikaBoard.getBoardID(url);
                        }
                    }catch(ex){
                        ChaikaCore.logger.error(urlSpec +" : "+ ex);
                    }

                    var path = currentCategoryPath + title.replace("/", "_", "g") + "/";
                    bosrdInsertStatement.bindStringParameter(0, title);
                    bosrdInsertStatement.bindStringParameter(1, urlSpec);
                    bosrdInsertStatement.bindStringParameter(2, path);
                    bosrdInsertStatement.bindInt32Parameter(3, type);
                    bosrdInsertStatement.bindStringParameter(4, boardID);
                    bosrdInsertStatement.execute();
                }
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }finally{
            categoryInsertStatement.reset();
            bosrdInsertStatement.reset();
            categoryInsertStatement.finalize();
            bosrdInsertStatement.finalize();
            storage.commitTransaction();
        }

    },

    getItemCount: function Bbsmenu_getItemCount(){
        var result = 0;

        var storage = ChaikaCore.storage;
        var countStatement = storage.createStatement("SELECT count(rowid) FROM bbsmenu;");

        storage.beginTransaction();
        try{
            countStatement.step();
            result = countStatement.getInt32(0);
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }finally{
            countStatement.reset();
            countStatement.finalize();
            storage.commitTransaction();
        }
        return result;
    },

    getBbsmenuDoc: function Bbsmenu_getBbsmenuDoc(){
        var bbsmenuDoc = this._DOMParser.parseFromString("<bbsmenu/>", "text/xml");
        var outsideDoc = this.getOutsideDoc();

        var nodes = outsideDoc.documentElement.childNodes;
        for(var i=0; i<nodes.length; i++){
            var node = nodes[i];
            var newNode = bbsmenuDoc.importNode(node, true);
            bbsmenuDoc.documentElement.appendChild(newNode);
        }

        var storage = ChaikaCore.storage;
        var sql = "SELECT title, url, path, board_type, is_category FROM bbsmenu;";
        var statement = storage.createStatement(sql);
        storage.beginTransaction();
        try{
            var currentCategory = null;
            while(statement.executeStep()){
                var title      = statement.getString(0);
                var url        = statement.getString(1);
                var path       = statement.getString(2);
                var boardType  = statement.getInt32(3);
                var isCategory = (statement.getInt32(4) == 1);

                if(path == "/2ch/") continue;

                if(isCategory){
                    currentCategory = bbsmenuDoc.createElement("category");
                    currentCategory.setAttribute("isContainer", "true");
                    currentCategory.setAttribute("title", title);
                    currentCategory.setAttribute("isOpen", "false");
                    bbsmenuDoc.documentElement.appendChild(currentCategory);
                }else if(currentCategory){
                    var item = bbsmenuDoc.createElement("board");
                    item.setAttribute("title", title);
                    item.setAttribute("url", url);
                    item.setAttribute("type",  boardType);
                    currentCategory.appendChild(item);
                }
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }finally{
            statement.reset();
            statement.finalize();
            storage.commitTransaction();
        }

        return bbsmenuDoc;
    },


    getOutsideDoc: function Bbsmenu_getOutsideDoc(){
        var outsideXMLFile = ChaikaCore.getDefaultsDir();
        outsideXMLFile.appendRelativePath("outside.xml");

        var outsideXMLString = ChaikaCore.io.readString(outsideXMLFile, 'UTF-8');
        var outsideDoc = this._DOMParser.parseFromString(outsideXMLString, 'text/xml');

        var categoryNodes = outsideDoc.getElementsByTagName("category");

        for(var i=0; i<categoryNodes.length; i++){
            let node = categoryNodes[i];
            node.setAttribute("isContainer", "true");
            node.setAttribute("isOpen", "false");
        }

        return outsideDoc;
    }

};


var Tree = {

    initTree: function Tree_initTree(aTreeDoc, aMode){
        if(!this._tree){
            this._treeBoxObject = null;
            this._tree = document.getElementById("bookmarks-view");
            this._tree.view = this;
            this._atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
        }

        if(this._doc && this._mode == MODE_BBSMENU){
            this.saveOpenedCategories();
        }

        this._mode = aMode;
        var lastRowCount = this.rowCount;
        this._doc = aTreeDoc;
        this.loadOpenedCategories();
        this.setVisivleData();
        this._treeBoxObject.rowCountChanged(1, this.rowCount - lastRowCount);
        this._treeBoxObject.invalidate();
    },


    setVisivleData: function Tree_setVisivleData(){
        var xpath = "descendant::*[not(ancestor::*[@isContainer='true']/@isOpen='false')]";
        this._visibleNodes = this._xpathEvaluate(xpath);

        for each(var node in this._visibleNodes){
            node._title = node.getAttribute("title");

            node._isContainer = (node.getAttribute("isContainer") == "true");
            if(node._isContainer){
                node._isContainerOpen = (node.getAttribute("isOpen") == "true");
            }

            node._level = this._doc.evaluate("ancestor::*[@isContainer='true']", node, null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;

            node._parentIndex = this._visibleNodes.indexOf(node.parentNode);
        }
        this.rowCount = this._visibleNodes.length;
    },


    _xpathEvaluate: function Tree__xpathEvaluate(aXpath, aContextNode){
        var contextNode = aContextNode || this._doc.documentElement;

        var xpathResult = this._doc.evaluate(aXpath, contextNode, null,
            XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);

        var result = [];
        var node;
        while(node = xpathResult.iterateNext()){
            result.push(node);
        }
        return result;
    },


    loadOpenedCategories: function Tree_loadOpenedCategories(){
        if(this._mode != MODE_BBSMENU) return;

        var titles = decodeURIComponent(this._tree.getAttribute("openedCategories")).split(",");
        var closedContainers = this._xpathEvaluate("descendant::*[@isContainer='true'][@isOpen='false']");
        closedContainers.forEach(function(aElement){
            var title = aElement.getAttribute("title");
            if(titles.indexOf(title) != -1){
                aElement.setAttribute("isOpen", "true");
            }
        });
    },


    saveOpenedCategories: function Tree_saveOpenedCategories(){
        if(this._mode != MODE_BBSMENU) return;
        var opendContainers = this._xpathEvaluate("descendant::*[@isContainer='true'][@isOpen='true']");
        var titles = opendContainers.map(function(aElement){
            return encodeURIComponent(aElement.getAttribute("title"));
        });

        if(titles.length > 0){
            this._tree.setAttribute("openedCategories", titles.join(","));
        }else{
            this._tree.setAttribute("openedCategories", "");
        }
    },


    changeTreeSize: function Tree_changeTreeSize(){
        this._tree.collapsed = true;
        this._tree.setAttribute("treesize", ChaikaCore.pref.getChar("bbsmenu.tree_size"));
        setTimeout(function(){ Tree._tree.collapsed = false }, 0);
    },


    click: function Tree_click(aEvent){
        if(aEvent.originalTarget.localName != "treechildren") return;

        var row = {}
        var subElement = {};
        this._treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, subElement);
        if(row.value == -1) return;    // ツリーのアイテム以外をクリック
        if(subElement.value=="twisty") return;
        if(aEvent.button > 1) return;

        var singleClicked = aEvent.type == "click";

        if(this.isContainer(row.value)){
            if(singleClicked && aEvent.button == 0){
                this.toggleOpenState(row.value);
            }
            return;
        }

        var openSingleClick = ChaikaCore.pref.getBool("bbsmenu.open_single_click");
        var openNewTab = ChaikaCore.pref.getBool("bbsmenu.open_new_tab");
        var item = this.getURLItem(row.value);

        if(aEvent.button==1 && singleClicked){
            item.open(!openNewTab);
        }else if(openSingleClick && singleClicked){
            item.open(openNewTab);
        }else if(!openSingleClick && !singleClicked){
            item.open(openNewTab);
        }
    },


    showContext: function Tree_showContext(aEvent){
        var row = {}
        var subElement = {};
        this._treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, subElement);
        if(row.value == -1) return false;    // ツリーのアイテム以外をクリック

        if(this.isContainer(row.value)) return false;

        var item = this.getURLItem(row.value)
        var treeContextMenu = document.getElementById("treeContextMenu");
        treeContextMenu.items = [this.getURLItem(row.value)];
        return true
    },


    getURLItem: function Tree_getURLItem(aRowIndex){
        var node = this._visibleNodes[aRowIndex];

        var title = node.getAttribute("title");
        var urlSpec = node.getAttribute("url");
        var boardType = parseInt(node.getAttribute("type"));
        var itemType = "page";
        if(boardType == ChaikaBoard.BOARD_TYPE_PAGE){
            itemType = "page";
        }else if(node.localName == "board"){
            itemType = "board";
        }else{
            itemType = "thread";
        }
        return new ChaikaCore.ChaikaURLItem(title, urlSpec, itemType, boardType);
    },


    rowCount: 0,
    selection: null,

    getRowProperties: function(aIndex){},
    getCellProperties: function(aRow, aCol){
        if (aCol.index == 0){
            var type = "type-" + this._visibleNodes[aRow].getAttribute("type");

            return ['title', type].join(' ');
        }
    },
    getColumnProperties: function(aCol){},
    isContainer: function(aIndex){
        return this._visibleNodes[aIndex]._isContainer;
    },
    isContainerOpen: function(aIndex){
        return this._visibleNodes[aIndex]._isContainerOpen;
    },
    isContainerEmpty: function(aIndex){ return false; },
    isSeparator: function(aIndex){ return false; },
    isSorted: function(){ return false; },
    canDrop: function(targetIndex, aOrientation){ return false; },
    drop: function(targetIndex, aOrientation){},
    getParentIndex: function(aRowIndex){
        return this._visibleNodes[aRowIndex]._parentIndex;
    },
    hasNextSibling: function(aRowIndex, aAfterIndex){
        if(aRowIndex == aAfterIndex){
            var l1 = this._visibleNodes[aRowIndex]._level;
            var l2 = this._visibleNodes[aRowIndex+1]._level;
            return l1 == l2;
        }
        return true;
    },
    getLevel: function(aRowIndex){
        return this._visibleNodes[aRowIndex]._level;
    },
    getImageSrc: function(aRow, aCol){},
    getProgressMode: function(aRow, aCol){},
    getCellValue: function(aRow, aCol){},
    getCellText: function(aRow, aCol){
        return this._visibleNodes[aRow]._title;
    },
    setTree: function(aTree){
        this._treeBoxObject = aTree;
    },
    toggleOpenState: function(aIndex){
        var node =    this._visibleNodes[aIndex];

        var lastRowCount = this.rowCount;

        var opened = (node.getAttribute("isOpen") == "true");
        if(opened){
            node.setAttribute("isOpen", "false");
        }else{
            if(this._mode == MODE_BBSMENU && ChaikaCore.pref.getBool("bbsmenu.toggle_open_container")){
                var cNodeName = this._containerNodeName;
                var containers = this._xpathEvaluate("descendant::*[@isContainer='true']");
                for each(var container in containers){
                    container.setAttribute("isOpen", "false");
                }
                var ancestors = this._xpathEvaluate("ancestor::*[@isContainer='true']", node);
                for each(var ancestor in ancestors){
                    ancestor.setAttribute("isOpen", "true");
                }
            }
            node.setAttribute("isOpen", "true");
        }
        this.setVisivleData();

        this._treeBoxObject.rowCountChanged(1, this.rowCount - lastRowCount);
        this._treeBoxObject.invalidate();

        var newIndex = this._visibleNodes.indexOf(node);
        this._treeBoxObject.ensureRowIsVisible(newIndex)
        this.selection.select(newIndex);
    },
    cycleHeader: function(aCol){},
    selectionChanged: function(){},
    cycleCell: function(aRow, aCol){},
    isEditable: function(aRow, aCol){},
    isSelectable: function(aRow, aCol){},
    setCellValue: function(aRow, aCol, aValue){},
    setCellText: function(aRow, aCol, aValue){},
    performAction: function(aAction){},
    performActionOnRow: function(aAction, aRow){},
    performActionOnCell: function(aAction, aRow, aCol){},

};
