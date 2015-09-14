/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is bbs2chreader.
 *
 * The Initial Developer of the Original Code is
 * flyson.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson at users.sourceforge.jp>
 *    nodaguti <nodaguti at gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Browser } = Cu.import('resource://chaika-modules/utils/Browser.js', {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");
Components.utils.import("resource://chaika-modules/ChaikaContentReplacer.js");

var gBoard;
var gSubjectDownloader;
var gSettingDownloader;
var gBoardMoveChecker;
var gNewURL;

/**
 * 開始時の処理
 */
function startup(){
    if(location.protocol === 'chaika:'){
        console.info('This page is loaded in the content process. Reload!');

        let boardXUL = 'chrome://chaika/content/board/page.xul';
        let boardURI = location.pathname.substring(1);
        let boardQuery = location.search.substring(1);
        let url = boardXUL + '?url=' + boardURI;

        if(boardQuery){
            url += '&query=' + boardQuery;
        }

        location.href = url;
        return;
    }

    PrefObserver.start();

    let params = new URL(location.href).searchParams;
    let boardURI = params.get('url');

    if(!boardURI){
        alert('板 URL が指定されていません．');
        return;
    }

    document.title = boardURI;
    document.getElementById("lblTitle").setAttribute("value", boardURI);

    try{
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var boardURL = ioService.newURI(boardURI, null, null);
        gBoard = new ChaikaBoard(boardURL);
    }catch(ex){
        // 認識できない URL
        alert('サポートされていない種類の板です．');
        return;
    }

    loadPersist();

    var subjectFile = gBoard.subjectFile.clone();
    var settingFile = gBoard.settingFile.clone();

    //前回SETTING.TXTをチェックしてから3ヶ月以上経っていたら更新する
    if(settingFile.exists()){
        let lastModified = settingFile.lastModifiedTime || 0;
        let expire = lastModified + 3 * 30 * 24 * 60 * 60 * 1000;

        if(expire < (new Date()).getTime()){
            settingUpdate();
        }
    }

    if(ChaikaCore.pref.getBool("board.auto_update")){
        subjectUpdate();
    }else if(!subjectFile.exists() || subjectFile.fileSize==0){
        subjectUpdate();
    }else if(gBoard.getItemLength()==0){
        subjectUpdate();
    }else if(!settingFile.exists() || settingFile.fileSize==0){
        settingUpdate();
    }else{
        BoardTree.initTree();
    }

    UpdateObserver.startup();


    //Search Queryが指定されていた時は始めから絞り込んでおく
    var query = params.get('query');

    if(query){
        var searchBox = document.getElementById('searchTextBox');
        searchBox.value = decodeURIComponent(query);
        BoardTree.initTree(true);
    }
}

/**
 * 終了時の処理
 */
function shutdown(){
    PrefObserver.stop();

    if(!BoardTree.firstInitBoardTree){
        savePersist();
    }

        // ダウンロードのキャンセル
    if(gSubjectDownloader && gSubjectDownloader.loading)
        gSubjectDownloader.abort(true);
    if(gSettingDownloader && gSettingDownloader.loading)
        gSettingDownloader.abort(true);
    if(gBoardMoveChecker && gBoardMoveChecker.checking)
        gBoardMoveChecker.abort();

    UpdateObserver.shutdown();
}

/**
 * ブラウザへのイベントフロー抑制
 */
function eventBubbleCheck(aEvent){
    // オートスクロールや Find As You Type を抑制しつつキーボードショートカットを許可
    if(!(aEvent.ctrlKey || aEvent.shiftKey || aEvent.altKey || aEvent.metaKey))
        aEvent.stopPropagation();
}

function loadPersist(){
    var jsonFile = ChaikaCore.getDataDir();
    jsonFile.appendRelativePath("boardPersist.json");
    if(!jsonFile.exists()) return;

    var content = ChaikaCore.io.readString(jsonFile, "UTF-8");
    try{
        var persistData = JSON.parse(content);
        for(var i in persistData){
            var element = document.getElementById(i);
            if(!element) continue;
            for(var j in persistData[i]){
                var attrName = String(j);
                var attrValue = String(persistData[i][j]);
                element.setAttribute(attrName, attrValue);
            }
        }
    }catch(ex){
        ChaikaCore.logger.error(ex + " : " + content);
    }
}

function savePersist(){
    var persistData = {};
    var xpathResult = document.evaluate("descendant::*[@id][@persist2]", document, null,
                        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    for (var i = 0; i < xpathResult.snapshotLength; i++){
        var element = xpathResult.snapshotItem(i);
        var persists = element.getAttribute("persist2").split(/\s/);

        for(var j=0; j<persists.length; j++){
            var attrName = persists[j];
            var attrValue = element.getAttribute(attrName);

            if(attrValue != "" && attrValue != "undefined"){
                if(!persistData[element.id]) persistData[element.id] = {};
                persistData[element.id][attrName] = attrValue;
            }
        }
    }

    var jsonFile = ChaikaCore.getDataDir();
    jsonFile.appendRelativePath("boardPersist.json");
    ChaikaCore.io.writeString(jsonFile, "UTF-8", false, JSON.stringify(persistData, null, "  "));
}

function setPageTitle(){
    var boardTitle = gBoard.getTitle();
    document.title = boardTitle + " [chaika]";
    document.getElementById("lblTitle").setAttribute("value", boardTitle.replace(/[@＠].+$/, ""));
}

var PrefObserver = {

    PREF_BRANCH: "extensions.chaika.board.",

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
            BoardTree.changeTreeSize();
        }

    }

};

var BoardTree = {

    tree: null,
    firstInitBoardTree: true,

    initTree: function BoardTree_initTree(aNoFocus){
        this.tree = document.getElementById("boardTree");

        this.changeTreeSize();
        setPageTitle();

        if(this.firstInitBoardTree){
            ChaikaCore.history.visitPage(gBoard.url,
                    ChaikaBoard.getBoardID(gBoard.url), gBoard.getTitle(), 0);
            this.firstInitBoardTree = false;
        }

        var browserWindow = ChaikaCore.browser.getBrowserWindow();
        if(browserWindow && browserWindow.XULBrowserWindow){
            this._XULBrowserWindow = browserWindow.XULBrowserWindow;
        }

        var startTime = Date.now();

        var searchStr = document.getElementById("searchTextBox").value;
        if(searchStr){
            searchStr = "%" + searchStr + "%";
            gBoard.refresh(gBoard.FILTER_LIMIT_SEARCH, searchStr);
        }else{
            var filterLimit = Number(document.getElementById("filterGroup").value);
            gBoard.refresh(filterLimit);
        }


        //スレッドあぼーん処理 および スレタイ置換
        var enableHideAbone = ChaikaCore.pref.getBool('thread_hide_abone');
        var threads = gBoard.itemsDoc.documentElement.getElementsByTagName('boarditem');

        for(let i = 0, iz = threads.length; i < iz; i++){
            let thread = threads[i];

            //透明あぼーんの影響で最後の方は参照できなくなる
            if(!thread) continue;


            //スレッドあぼーん処理
            let hitAboneData = ChaikaAboneManager.shouldAbone({
                title: thread.getAttribute('title'),
                date: thread.getAttribute('created'),
                thread_url: thread.getAttribute('url'),
                board_url: gBoard.url.spec,
                isThread: true
            });

            if(hitAboneData){
                if(hitAboneData.hide === true ||
                   hitAboneData.hide === undefined && enableHideAbone){
                    thread.parentNode.removeChild(thread);
                    i--;
                    iz--;
                    continue;
                }

                if(hitAboneData.highlight){
                    thread.setAttribute('highlighted', 'true');
                }else{
                    thread.setAttribute('title', '***** ABONE ***** (' + hitAboneData.title + ')');
                }
            }


            //スレタイ置換処理
            let replacedThreadData = ChaikaContentReplacer.replace({
                title: thread.getAttribute('title'),
                date: thread.getAttribute('created'),
                thread_url: thread.getAttribute('url'),
                board_url: gBoard.url.spec,
                isThreadList: true,
                isSubjectTxt: false
            });

            if(replacedThreadData){
                thread.setAttribute('title', replacedThreadData.title);
            }
        }


        this.tree.builder.datasource = gBoard.itemsDoc.documentElement;
        this.tree.builder.rebuild();

        ChaikaCore.logger.debug("Tree Build Time: " + (Date.now() - startTime));

            // 前回のソートを復元
        var colNodes = document.getElementsByClassName("boardTreeCol");
        for(var i=0; i<colNodes.length; i++){
            if(colNodes[i].getAttribute("sortActive") == "true"){
                var sortDirection = colNodes[i].getAttribute("sortDirection");
                if(sortDirection == "descending"){
                    colNodes[i].setAttribute("sortDirection", "ascending");
                }else if(sortDirection == "natural"){
                    colNodes[i].setAttribute("sortDirection", "descending");
                }else{
                    colNodes[i].setAttribute("sortDirection", "natural");
                }
                this.tree.builderView.sort(colNodes[i]);
            }
        }

            // フォーカス
        if(!aNoFocus){
            this.tree.focus();
            this.tree.treeBoxObject.view.selection.select(0);
        }

    },

    changeTreeSize: function BoardTree_changeTreeSize(){
        this.tree.collapsed = true;

        this.tree.className = this.tree.className.replace(/tree-text-\W+/g, '');
        this.tree.classList.add('tree-text-' + ChaikaCore.pref.getChar("board.tree_size"));

        setTimeout(() => this.tree.collapsed = false, 0);
    },

    click: function BoardTree_click(aEvent){
        if(aEvent.originalTarget.localName != "treechildren") return;
        if(this.getClickItemIndex(aEvent) == -1) return;
        if(aEvent.ctrlKey || aEvent.shiftKey) return;
        if(aEvent.button > 1) return;

        var singleClicked = aEvent.type == "click";
        var openSingleClick = ChaikaCore.pref.getBool("board.open_single_click");
        var openNewTab = ChaikaCore.pref.getBool("board.open_new_tab");

        if(aEvent.button==1 && singleClicked){
            this.openThread(!openNewTab);
        }else if(openSingleClick && singleClicked){
            this.openThread(openNewTab);
        }else if(!openSingleClick && !singleClicked){
            this.openThread(openNewTab);
        }
    },

    keyDown: function BoardTree_keyDown(aEvent){
        switch(aEvent.key){
            case 'Enter':
                this.openThread(aEvent.ctrlKey || aEvent.altKey);
                break;

            case ' ':
                if(aEvent.shiftKey){
                    this.tree._moveByPage(-1, 0, aEvent);
                }else{
                    this.tree._moveByPage(1, this.tree.view.rowCount - 1, aEvent);
                }
                break;

            case 'r':
                subjectUpdate();
                break;

            case 'f':
                document.getElementById('searchTextBox').focus();
                break;

            case 'j':
                let nextIndex = this.tree.currentIndex + 1;

                if(nextIndex > this.tree.view.rowCount - 1) nextIndex = this.tree.view.rowCount - 1;

                this.tree.treeBoxObject.view.selection.select(nextIndex);
                this.tree.treeBoxObject.ensureRowIsVisible(nextIndex);
                break;

            case 'k':
                let prevIndex = this.tree.currentIndex - 1;

                if(prevIndex < 0) prevIndex = 0;

                this.tree.treeBoxObject.view.selection.select(prevIndex);
                this.tree.treeBoxObject.ensureRowIsVisible(prevIndex);
                break;

        }
    },

    mouseMove: function BoardTree_mouseMove(aEvent){
        if(!this._XULBrowserWindow) return;
        if(aEvent.originalTarget.localName != "treechildren") return;

        var index = this.getClickItemIndex(aEvent);
        if(index == -1) return;
        if(index == this._lastMouseOverIndex) return;

        this._XULBrowserWindow.setOverLink(this.getItemURL(index).spec, null);

        this._lastMouseOverIndex = index;
    },

    mouseOut: function BoardTree_mouseOut(aEvent){
        if(!this._XULBrowserWindow) return;

        this._XULBrowserWindow.setOverLink("", null);
    },

    showContext: function BoardTree_showContext(aEvent){
            // ツリーのアイテム以外をクリック
        if(this.getClickItemIndex(aEvent) == -1) return false;

        var currentIndex = this.tree.currentIndex;
        var selectionIndices = this.getSelectionIndices();

        selectionIndices = selectionIndices.filter(function(aElement, aIndex, aArray){
            return (aElement != currentIndex);
        });
        selectionIndices.unshift(currentIndex);

        var items = selectionIndices.map(function(aElement, aIndex, aArray){
            var title = BoardTree.getItemTitle(aElement);
            var urlSpec = BoardTree.getItemURL(aElement).spec;
            return new ChaikaCore.ChaikaURLItem(title, urlSpec, "thread", gBoard.type);
        });

        var boardTreeContextMenu = document.getElementById("boardTreeContextMenu");
        boardTreeContextMenu.items = items;

        return true;
    },

    getClickItemIndex: function BoardTree_getClickItemIndex(aEvent){
        var row = {}
        var obj = {}
        this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
        if(!obj.value) return -1;
        return row.value;
    },

    getItemURL: function BoardTree_getItemURL(aIndex){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

        var titleColumn = this.tree.columns.getNamedColumn("boardTreeCol-title");
        var spec = this.tree.builder.getCellValue(aIndex, titleColumn);

        return ioService.newURI(spec, null, null);
    },

    getItemTitle: function BoardTree_getItemTitle(aIndex){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

        var titleColumn = this.tree.columns.getNamedColumn("boardTreeCol-title");
        return this.tree.builder.getCellText(aIndex, titleColumn);
    },

    getSelectionIndices: function BoardTree_getSelectionIndices(){
        var resultArray = new Array();

        var rangeCount = this.tree.treeBoxObject.view.selection.getRangeCount();
        for(var i=0; i<rangeCount; i++){
            var rangeMin = {};
            var rangeMax = {};

            this.tree.treeBoxObject.view.selection.getRangeAt(i, rangeMin, rangeMax);
            for (var j=rangeMin.value; j<=rangeMax.value; j++){
                resultArray.push(j);
            }
        }
        return resultArray;
    },

    openThread: function BoardTree_openThread(aAddTab){
        var index = this.tree.currentIndex;
        if(index == -1) return null;
        ChaikaCore.browser.openThread(this.getItemURL(index), aAddTab, true, false, true);
    },

        // nsDragAndDrop Observer
    onDragStart: function BoardTree_onDragStart(aEvent, aTransferData, aDragAction){
        if(aEvent.originalTarget.localName != "treechildren") return;
        var itemIndex = this.getClickItemIndex(aEvent);
        if(itemIndex == -1) return;
        if(this.getSelectionIndices().length != 1) return;

        var url = this.getItemURL(itemIndex).spec;
        var title = this.getItemTitle(itemIndex);
        aTransferData.data = new TransferData();
        aTransferData.data.addDataForFlavour("text/x-moz-url", url + "\n" + title);
        aTransferData.data.addDataForFlavour("text/unicode", url);
    }

};

function setStatus(aString){
    document.getElementById("lblStatus").value = aString;
}

/**
 * subject.txt をダウンロードする
 */
function subjectUpdate(aForceUpdate){
        // ダウンロード間隔の制限
    var subjectFile = gBoard.subjectFile.clone();
    var settingFile = gBoard.settingFile.clone();
    if(subjectFile.exists() && !aForceUpdate){
        var interval = new Date().getTime() - subjectFile.lastModifiedTime;
        var updateIntervalLimit =  ChaikaCore.pref.getInt("board.update_interval_limit");
            // 不正な値や、10 秒以下なら 10 秒にする
        if(isNaN(parseInt(updateIntervalLimit)) || updateIntervalLimit < 10)
            updateIntervalLimit = 10;

        if(interval < updateIntervalLimit * 1000){
            if(!settingFile.exists() || settingFile.fileSize==0){
                settingUpdate();
            }else{
                BoardTree.initTree();
            }
            return;
        }
    }

    gSubjectDownloader = new ChaikaDownloader(gBoard.subjectURL, gBoard.subjectFile);

    gSubjectDownloader.onStart = function(aDownloader){
        setStatus("start: " + this.url.spec);
    };

    gSubjectDownloader.onStop = function(aDownloader, aStatus){
        setStatus("");

        var subjectFile = gBoard.subjectFile.clone();
        var settingFile = gBoard.settingFile.clone();

        if(aStatus === 302 || !subjectFile.exists() || subjectFile.fileSize === 0){
            setStatus("スレッド一覧を取得できませんでした。板の移転を確認しています...");
            return checkBoardRelocation();
        }

        gBoard.boardSubjectUpdate();

        if(!settingFile.exists() || settingFile.fileSize === 0){
            settingUpdate();
        }else{
            BoardTree.initTree();
        }
    };

    gSubjectDownloader.onProgressChange = function(aDownloader, aPercentage){
        setStatus("downloading: " + aPercentage + "%");
    };

    gSubjectDownloader.onError = function(aDownloader, aErrorCode){
        setStatus("ネットワークの問題により、スレッド一覧を取得できませんでした。");
    };


    gSubjectDownloader.download();
    setStatus("request: " + gSubjectDownloader.url.spec);
}

/**
 * SETTING.TXT をダウンロードする
 */
function settingUpdate(){
    gSettingDownloader = new ChaikaDownloader(gBoard.settingURL, gBoard.settingFile);

    gSettingDownloader.onStart = function(aDownloader){
        setStatus("start: " + this.url.spec);
    };
    gSettingDownloader.onStop = function(aDownloader, aStatus){
        setStatus("");
        BoardTree.initTree();
    };
    gSettingDownloader.onProgressChange = function(aDownloader, aPercentage){
        setStatus("downloading: " + aPercentage + "%");
    };
    gSettingDownloader.onError = function(aDownloader, aErrorCode){
        if(aErrorCode == ChaikaDownloader.ERROR_NOT_AVAILABLE){
            setStatus("Download Error: NOT AVAILABLE: " + this.url.spec);
        }
    };

    gSettingDownloader.download();
    setStatus("request: " + gSettingDownloader.url.spec);
}

function showBrowser(aTab){
    if(aTab){
        document.getElementById("popTools").hidePopup();
    }

    Browser.open(URLUtils.unchaikafy(gBoard.url.spec) + '?chaika_force_browser=1', aTab);
}

function openLogsDir(){
    ChaikaCore.io.reveal(gBoard.subjectFile.parent);
}

function postNewThread(){
    ChaikaCore.browser.openWindow("chrome://chaika/content/post/wizard.xul", null, gBoard.url.spec, true);
}

function openSettings(){
    ChaikaCore.browser.openWindow("chrome://chaika/content/settings/settings.xul#paneBoard", "chaika:settings");
}

function showBanner(aEvent){
    if(aEvent.type=="click" && aEvent.button!=0) return;

    var imgBanner = document.getElementById("imgHiddenBanner");
    imgBanner.removeAttribute("src");
    imgBanner.setAttribute("src", gBoard.getLogoURL().spec);
}

function bannerLoaded(){
    var imgBanner = document.getElementById("imgBanner");
    imgBanner.setAttribute("src", gBoard.getLogoURL().spec);

    var lblShowBanner = document.getElementById("lblShowBanner");
    var popBanner = document.getElementById("popBanner");

    popBanner.openPopup(lblShowBanner, 0, 0, "end", false, true);
}

function bannerLoadError(aEvent){
    alert("バナーの読み込みに失敗しました");
}

function checkBoardRelocation(){
    gBoardMoveChecker = new NewBoardURLFinder();

    gBoardMoveChecker.onSuccess = function(aNewURL){
        var shouldMove = confirm(aNewURL + ' への移転を確認しました。新しい URL へ移動しますか？');

        if(shouldMove){
            moveToNewURL(aNewURL);
        }
    };

    gBoardMoveChecker.onFail = function(){
        setStatus("移転先を確認できませんでした。板の URL を再度確認して下さい。");
    };

    gBoardMoveChecker.check(gBoard.url.spec);
}

function moveToNewURL(newURL){
    if(newURL){
        var oldLogDir = ChaikaBoard.getLogFileAtURL(gBoard.url);

        try{
            var subjectFile = gBoard.subjectFile.clone();
            var settingFile = gBoard.settingFile.clone();

            if(subjectFile.exists() && subjectFile.fileSize === 0){
                subjectFile.remove(true);
            }

            if(settingFile.exists() && settingFile.fileSize === 0){
                settingFile.remove(true);
            }

            oldLogDir.remove(false);
        }catch(ex){}

        setTimeout(function(){
            window.location.href = "chaika://board/" + newURL;
        }, 0);
    }
}


function NewBoardURLFinder(){
}

NewBoardURLFinder.prototype = {

    check: function(aBoardURLSpec){
        if(this._httpReq && this._httpReq.readyState !== 0){
            this._httpReq.abort();
        }

        this._httpReq = new XMLHttpRequest();

        this._httpReq.onreadystatechange = this._onreadystatechange.bind(this);
        this._httpReq.open("GET", aBoardURLSpec);
        this._httpReq.send(null);
    },

    abort: function(){
        if(this._httpReq && this._httpReq.readyState !== 0){
            this._httpReq.abort();
            this._httpReq = null;
        }
    },

    _onreadystatechange: function(){
        if(this._httpReq.readyState !== 4) return;

        var responseText = this._httpReq.responseText;

        if(/Change your bookmark/m.test(responseText)){
            if(responseText.match(/<a href=\"([^\"]+)\">/m)){
                this.onSuccess(RegExp.$1);
            }
        }else{
            this.onFail();
        }

        this._httpReq = null;
    },

    onChecked: function(aSuccess, aNewURL){}
};


var UpdateObserver = {

    startup: function UpdateObserver_startup(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.addObserver(this, "itemContext:deleteLog", false);
        os.addObserver(this, "findNewThread:update", false);
    },

    shutdown: function UpdateObserver_shutdown(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.removeObserver(this, "itemContext:deleteLog");
        os.removeObserver(this, "findNewThread:update");
    },

    deleteLogsTreeUpdate: function UpdateObserver_deleteLogsTreeUpdate(aURLs){
        if(!BoardTree.tree.boxObject.beginUpdateBatch) return;

        var xpathResult = gBoard.itemsDoc.evaluate("descendant::boarditem[@read>0]",
                    gBoard.itemsDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        BoardTree.tree.boxObject.beginUpdateBatch();
        for (var i=0; i<xpathResult.snapshotLength; i++){
            var element = xpathResult.snapshotItem(i);
            var url = element.getAttribute("url");
            if(aURLs.indexOf(url) != -1){
                element.setAttribute("status", "0");
                element.setAttribute("unread", "0");
                element.setAttribute("read", "0");
            }
        }
        BoardTree.tree.boxObject.endUpdateBatch();
    },

    observe: function UpdateObserver_observe(aSubject, aTopic, aData){
        if(aTopic == "itemContext:deleteLog"){
            this.deleteLogsTreeUpdate(aData.split(","));
            return;
        }

        if(aTopic == "findNewThread:update"){
            var newThreadInfo = JSON.parse(aData);
            if(newThreadInfo.boardURL == gBoard.url.spec){
                subjectUpdate(true);
            }
            return;
        }
    },

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsISupportsWeakReference,
        Ci.nsIObserver,
        Ci.nsISupports
    ])

};
