
var gBbs2chService = Cc["@mozilla.org/bbs2ch-service;1"].getService(Ci.nsIBbs2chService);
var gRDFS = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
var gRDFCU = Cc["@mozilla.org/rdf/container-utils;1"].getService(Ci.nsIRDFContainerUtils);
var gTreeSubscribe;
var gDatasource;

var gBoardItemsHash;
var gSubjectDownloader;
var gDownloadQueue;

const SUBSCRIBE_BOARD_LIMIT = 5;
const B2R_NS = gBbs2chService.nameSpace;

function startup(){
	gTreeSubscribe = document.getElementById("treeSubscribe");

    	// ツリーの偶数行に色をつける
	if(gBbs2chService.pref.getBoolPref("extensions.chaika.enable_tree_stripe2")){
		gTreeSubscribe.setAttribute("stripe", "true");
	}

    	// コンパクトモード
	if(gBbs2chService.pref.getBoolPref("extensions.chaika.subscribe_compact_mode")){
		gTreeSubscribe.setAttribute("compact", "true");
	}

	initTreeSubscribe();
}


function shutdown(){
		// ダウンロードのキャンセル
	if(gSubjectDownloader && gSubjectDownloader.loading){
		gSubjectDownloader.abort(true);
	}
}


function setStatus(aString){
	document.getElementById("lblStatus").value = aString;
}

/**
 * ブラウザへのイベントフロー抑制
 */
function eventBubbleCheck(aEvent){
	// オートスクロールや Find As You Type を抑制しつつキーボードショートカットを許可
	if(!(aEvent.ctrlKey || aEvent.shiftKey || aEvent.altKey || aEvent.metaKey))
		aEvent.stopPropagation();
}


function initTreeSubscribe(aNoOpenSubscribeManager){
	var subscribeBoards = new Array();

	var subscribeBoardsFile = gBbs2chService.getDataDir();
	subscribeBoardsFile.appendRelativePath("subscribe.txt");
	if(subscribeBoardsFile.exists()){
		subscribeBoards = gBbs2chService.readFileLine(subscribeBoardsFile.path, {});
	}

	gBoardItemsHash = new Array();
	for(let [index, boardURL]  in subscribeBoards){
		if(index == SUBSCRIBE_BOARD_LIMIT) break;
		boardURL = boardURL.replace(/^bbs2ch:board:/, "");
		if(boardURL.charAt(0) == "#"){ continue; }
		var boardItems = new Bbs2chBoardItems(boardURL);
		if(boardItems.validURL && boardItems.subjectFile.exists()){
			gBoardItemsHash[boardURL] = boardItems;
		}
	}

		// ツリーデータベースの初期化
	var dsEnu = gTreeSubscribe.database.GetDataSources();
	while(dsEnu.hasMoreElements()){
		var ds = dsEnu.getNext().QueryInterface(Ci.nsIRDFDataSource);
		if(ds.URI == null){
			gTreeSubscribe.database.RemoveDataSource(ds);
		}
	}

	if(subscribeBoards.length == 0){
		if(!aNoOpenSubscribeManager){
			openSubscribeManager();
		}
		return;
	}

	gDatasource = Cc["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"]
						.createInstance(Ci.nsIRDFDataSource);

	var rootContainer = gRDFCU.MakeSeq(gDatasource, gRDFS.GetResource("urn:b2rSubscribe:root"));

	var resLabel = gRDFS.GetResource(B2R_NS + "label");
	var resTitle = gRDFS.GetResource(B2R_NS + "title");
	var resURL = gRDFS.GetResource(B2R_NS + "url");

	for(let [boardURL, boardItems] in gBoardItemsHash){
		var boardContainer = gRDFCU.MakeSeq(gDatasource,
				gRDFS.GetResource("urn:b2rSubscribe:board:" + boardItems.url.spec));
		var boardContainerRes = boardContainer.Resource;
		gDatasource.Assert(boardContainerRes, resTitle, gRDFS.GetLiteral(boardItems.title), true);
		gDatasource.Assert(boardContainerRes, resURL, gRDFS.GetLiteral(boardItems.url.spec), true);
		var boardTreeItemLength = createBoardTreeItem(boardContainer, boardURL);
		rootContainer.AppendElement(boardContainerRes);
		if(boardTreeItemLength > 0){
			setBoardState(boardURL, "Updated");
		}else{
			setBoardState(boardURL, "Normal");
		}
	}

	gTreeSubscribe.database.AddDataSource(gDatasource);
	gTreeSubscribe.builder.rebuild();
}


function createBoardTreeItem(aContainer, aBoardURL){
	var boardItems = gBoardItemsHash[aBoardURL];
	var resLabel = gRDFS.GetResource(B2R_NS + "label");
	var resTitle = gRDFS.GetResource(B2R_NS + "title");
	var resURL = gRDFS.GetResource(B2R_NS + "url");
	var resDatID = gRDFS.GetResource(B2R_NS + "datID");
	var resUnread = gRDFS.GetResource(B2R_NS + "unread");
	var resState = gRDFS.GetResource(B2R_NS + "state");

	var minUnread = gBbs2chService.pref.getIntPref("extensions.chaika.subscribe_min_unread");
	if(minUnread < 0) minUnread = 0;

	boardItems.refresh(0, false);
	var items = boardItems.items.slice(0);
	items.sort(function(aA, aB){
		return  aB.unread - aA.unread;
	});

	if(gBbs2chService.pref.getBoolPref("extensions.chaika.subscribe_hide_unread")){
		items = items.filter(function(aElement, aIndex, aArray){
    		return (aElement.unread > minUnread);
		});
	}

	for(let i=0; i<items.length; i++){
		var item = items[i];
		var itemRes = gRDFS.GetResource("urn:b2rSubscribe:item:" + item.url);

		var newState;
		if(item.unread > minUnread){
			newState = gRDFS.GetLiteral("updateItem");
		}else{
			newState = gRDFS.GetLiteral("noUpdateItem");
		}
		var newUnread = gRDFS.GetIntLiteral(item.unread);
		var oldUnread = gDatasource.GetTarget(itemRes, resUnread, true);
		if(oldUnread){
			oldUnread.QueryInterface(Ci.nsIRDFInt);
			if(newUnread.Value != oldUnread.Value){
				gDatasource.Change(itemRes, resUnread, oldUnread, newUnread);
			}
			var oldState = gDatasource.GetTarget(itemRes, resState, true)
					.QueryInterface(Ci.nsIRDFLiteral);
			if(newState.Value != oldState.Value){
				gDatasource.Change(itemRes, resState, oldState, newState);
			}
		}else{
			gDatasource.Assert(itemRes, resTitle, gRDFS.GetLiteral(item.title), true);
			gDatasource.Assert(itemRes, resURL, gRDFS.GetLiteral(item.url), true);
			gDatasource.Assert(itemRes, resDatID, gRDFS.GetLiteral(item.datID), true);
			gDatasource.Assert(itemRes, resUnread, newUnread, true);
			gDatasource.Assert(itemRes, resState, newState, true);
		}
		aContainer.AppendElement(itemRes);
	}
	return items.length;
}

function treeSubscribeClick(aEvent){
		// ツリーのアイテム以外をクリック
	if(getClickItemIndex(aEvent) == -1) return;
	if(gTreeSubscribe._timer){
		clearTimeout(gTreeSubscribe._timer);
	}
	gTreeSubscribe._timer = setTimeout(treeSubscribeClickDelay, 5, aEvent);
}

function treeSubscribeClickDelay(aEvent){
	gTreeSubscribe._timer = null;

	var button = aEvent.button;
	var detail = aEvent.detail;

	var openActionPref;
	if(button==0 && detail==1){
			// クリック
		openActionPref = "extensions.chaika.board_click_action";
	}else if(button==0 && detail==2){
			// ダブルクリック
		openActionPref = "extensions.chaika.board_double_click_action";
			// ダブルクリックしたのがコンテナなら終了
		if(gTreeSubscribe.builderView.isContainer(gTreeSubscribe.currentIndex)){ return; }
	}else if(button==1 && detail==1){
			// ミドルクリック
		openActionPref = "extensions.chaika.board_middle_click_action";
	}else{
		return;
	}

	var openAction = gBbs2chService.pref.getIntPref(openActionPref);
	if(openAction==1){
		openThread(false);
	}else if(openAction==2){
		openThread(true);
	}
}

function getClickItemIndex(aEvent){
	var row = {}
	var obj = {}
	gTreeSubscribe.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
	if(!obj.value) return -1;
	return row.value;
}


/**
 * ツリーでキーボードダウン
 * aEvent event キーボードダウン時のイベントオブジェクト
 */
function treeSubscribeKeyDown(aEvent){
	if(gTreeSubscribe.currentIndex == -1) return;

		// エンターキー以外なら終了
	if(!(aEvent.keyCode==aEvent.DOM_VK_ENTER || aEvent.keyCode==aEvent.DOM_VK_RETURN))
		return;

	if(aEvent.ctrlKey || aEvent.altKey){
		openThread(true);
	}else{
		openThread(false);
	}
}


/**
 * 選択中のスレッドをブラウザで開く
 * @param aAddTab boolean true なら新しいタブで開く
 */
function openThread(aAddTab){
	var index = gTreeSubscribe.currentIndex;
	if(index == -1){ return; }
	if(gTreeSubscribe.builderView.isSeparator(index)){ return; }

	var itemRes = gTreeSubscribe.builderView.getResourceAtIndex(index);

	if(gTreeSubscribe.builderView.isContainer(index)){
		var boardURL = gDatasource.GetTarget(itemRes, gRDFS.GetResource(B2R_NS + "url"), true)
			.QueryInterface(Ci.nsIRDFLiteral).Value;
		boardURL = "bbs2ch:board:" + boardURL;
		gBbs2chService.openURL(boardURL, null, aAddTab);
		return;
	}

	var parentIndex = gTreeSubscribe.builderView.getParentIndex(index);
	var parentRes = gTreeSubscribe.builderView.getResourceAtIndex(parentIndex);
	var boardURL = gDatasource.GetTarget(parentRes, gRDFS.GetResource(B2R_NS + "url"), true)
			.QueryInterface(Ci.nsIRDFLiteral).Value;
	var boardItems = gBoardItemsHash[boardURL];

		// スレッド表示数の制限
	var threadViewLimit = Number(gBbs2chService.pref.getIntPref(
									"extensions.chaika.board_thread_view_limit"));
	if(isNaN(threadViewLimit) || threadViewLimit == 0){
		threadViewLimit = "";
	}else{
		if(boardItems.type == gBbs2chService.BOARD_TYPE_MACHI){
			threadViewLimit = "&LAST=" + threadViewLimit;
		}else{
			threadViewLimit = "l" + threadViewLimit;
		}
	}

	var threadURL = gDatasource.GetTarget(itemRes, gRDFS.GetResource(B2R_NS + "url"), true)
			.QueryInterface(Ci.nsIRDFLiteral).Value;
	threadURL = "/thread/" + threadURL + threadViewLimit;
	threadURL = gBbs2chService.serverURL.resolve(threadURL);
	gBbs2chService.openURL(threadURL, null, aAddTab);


	var resUnread = gRDFS.GetResource(B2R_NS + "unread");
	var newUnread = gRDFS.GetIntLiteral(0);
	var oldUnread = gDatasource.GetTarget(itemRes, resUnread, true)
						.QueryInterface(Ci.nsIRDFInt);
	if(newUnread.Value != oldUnread.Value){
			gDatasource.Change(itemRes, resUnread, oldUnread, newUnread);
	}
	var resState = gRDFS.GetResource(B2R_NS + "state");
	var newState = gRDFS.GetLiteral("noUpdateItem");
	var oldState = gDatasource.GetTarget(itemRes, resState, true)
					.QueryInterface(Ci.nsIRDFLiteral);
	if(newState.Value != oldState.Value){
		gDatasource.Change(itemRes, resState, oldState, newState);
	}
}


function removeTreeItem(aParentResource, aResource, aIndex){
	var container = Cc["@mozilla.org/rdf/container;1"].createInstance(Ci.nsIRDFContainer);
	container.Init(gDatasource, aParentResource);
	container.RemoveElement(aResource, true);
}

function subjectUpdateAll(){
		// ダウンロードのキャンセル
	if(gSubjectDownloader && gSubjectDownloader.loading){
		gSubjectDownloader.abort(true);
	}

	gDownloadQueue = new Array();
	for(let [url, boardItems] in gBoardItemsHash){
		gDownloadQueue.push(boardItems);
	}
	subjectUpdate();
}


/**
 * ツリーのコンテキストメニューが表示されるときに呼ばれる
 */
function showTreeSubscribeContext(aEvent){
		// ツリーのアイテム以外をクリック
	if(getClickItemIndex(aEvent) == -1) return false;

	return true;
}


function subjectUpdate(){
		// ダウンロードのキャンセル
	if(gSubjectDownloader && gSubjectDownloader.loading){
		gSubjectDownloader.abort(true);
	}

	if(gDownloadQueue.length==0){
		setStatus("");
		return;
	}

		// ダウンロード間隔の制限
	if(gDownloadQueue[0].subjectFile.exists()){
		var interval = new Date().getTime() - gDownloadQueue[0].subjectFile.clone().lastModifiedTime;
		var updateIntervalLimit =  gBbs2chService.pref.getIntPref(
					"extensions.chaika.board_update_interval_limit");
			// 不正な値や、60 秒以下なら 60 秒にする
		if(isNaN(parseInt(updateIntervalLimit)) || updateIntervalLimit < 60)
			updateIntervalLimit = 60;

		if(interval < updateIntervalLimit * 1000){
			gDownloadQueue.shift();
			setTimeout("subjectUpdate()", 100);
			return;
		}
	}

	setBoardState(gDownloadQueue[0].url.spec, "Updating");
	gSubjectDownloader = new b2rDownloader(gDownloadQueue[0].subjectURL.spec,
									gDownloadQueue[0].subjectFile.path)

	gSubjectDownloader.onStart = function(aDownloader){
		setStatus("start: " + this.urlSpec);
	};
	gSubjectDownloader.onStop = function(aDownloader, aStatus){
		setStatus("");
		var boardItmes = gDownloadQueue[0];
		if(aStatus == 302 || boardItmes.subjectFile.clone().fileSize==0){
			setStatus("スレッド一覧を取得できませんでした。板が移転した可能性があります。");
			setBoardState(boardItmes.url.spec, "Error");
			gDownloadQueue.shift();
			setTimeout("subjectUpdate()", 500);
			return;
		}

		setStatus("OK");

		gTreeSubscribe.treeBoxObject.beginUpdateBatch();

		var boardContainer = Cc["@mozilla.org/rdf/container;1"]
					.createInstance(Ci.nsIRDFContainer);
		boardContainer.Init(gDatasource, gRDFS.GetResource("urn:b2rSubscribe:board:" + gDownloadQueue[0].url.spec));
		while(boardContainer.GetCount()){
			boardContainer.RemoveElementAt(1, true);
		}
		var boardTreeItemLength = createBoardTreeItem(boardContainer, gDownloadQueue[0].url.spec);
		gTreeSubscribe.treeBoxObject.endUpdateBatch();
		if(boardTreeItemLength > 0){
			setBoardState(boardItmes.url.spec, "Updated");
		}else{
			setBoardState(boardItmes.url.spec, "Normal");
		}

		gDownloadQueue.shift();
		setTimeout("subjectUpdate()", 500);
	};
	gSubjectDownloader.onProgressChange = function(aDownloader, aPercentage){
		setStatus("downloading: " + aPercentage + "%");
	};
	gSubjectDownloader.onError = function(aDownloader, aErrorCode){
		return;
		var errorText = "";
		switch(aErrorCode){
			case this.ERROR_BAD_URL:
				errorText = "BAD URL";
				break;
			case this.ERROR_NOT_AVAILABLE:
				errorText = "NOT AVAILABLE";
				break;
			case this.ERROR_FAILURE:
				errorText = "ERROR FAILURE";
				break;
		}
		setStatus("ネットワークの問題により、スレッド一覧を取得できませんでした : " + errorText);
		setBoardState(gDownloadQueue[0].url.spec, "Error");
		gDownloadQueue.shift();
		setTimeout("subjectUpdate()", 500);
	};


	gSubjectDownloader.download();
	setStatus("request: " + gSubjectDownloader.urlSpec);

}

function setBoardState(aBoardURL, aStete){
	var boardRes = gRDFS.GetResource("urn:b2rSubscribe:board:" + aBoardURL);
	var stateRes = gRDFS.GetResource(B2R_NS + "state");
	var newValue = gRDFS.GetLiteral(aStete);
	var oldValue = gDatasource.GetTarget(boardRes, stateRes, true);
	if(oldValue){
		oldValue.QueryInterface(Ci.nsIRDFLiteral);
		if(newValue.Value != oldValue.Value){
			gDatasource.Change(boardRes, stateRes, oldValue, newValue);
		}
		return;
	}
	gDatasource.Assert(boardRes, stateRes, newValue, true);
}

/**
 * 選択中のスレッドのインデックスを配列として返す
 * @return array
 */
function getSelectionIndices(){
	var resultArray = new Array();

	var rangeCount = gTreeSubscribe.view.selection.getRangeCount();
	for(let i=0; i<rangeCount; i++){
		var rangeMin = {};
		var rangeMax = {};

		gTreeSubscribe.view.selection.getRangeAt(i, rangeMin, rangeMax);
		for (var j=rangeMin.value; j<=rangeMax.value; j++){
			resultArray.push(j);
		}
	}
	return resultArray;
}

/**
 * 選択スレッドのログを削除する (複数選択可)
 */
function deleteLog(){
	if(gTreeSubscribe.currentIndex == -1) return;

	var indices = getSelectionIndices();
	for(let [i, index] in indices){
		if(gTreeSubscribe.builderView.isContainer(index)){ continue; }

		var parentIndex = gTreeSubscribe.builderView.getParentIndex(index);
		var parentRes = gTreeSubscribe.builderView.getResourceAtIndex(parentIndex);
		var boardURL = gDatasource.GetTarget(parentRes, gRDFS.GetResource(B2R_NS + "url"), true)
				.QueryInterface(Ci.nsIRDFLiteral).Value;
		var boardItems = gBoardItemsHash[boardURL];

		var itemRes = gTreeSubscribe.builderView.getResourceAtIndex(index);
		var datID = gDatasource.GetTarget(itemRes, gRDFS.GetResource(B2R_NS + "datID"), true)
				.QueryInterface(Ci.nsIRDFLiteral).Value;

					// ログディレクトリ内の .dat ファイル
		var datFile = gBbs2chService.getLogFileAtURL(boardItems.url.resolve(datID + ".dat"));
					// ログディレクトリ内の .idx ファイル
		var idxFile = gBbs2chService.getLogFileAtURL(boardItems.url.resolve(datID + ".idx"));

		try{
			if(datFile.exists()) datFile.remove(false);
			if(idxFile.exists()) idxFile.remove(false);
		}catch(e){}

		setTimeout(removeTreeItem, 0, parentRes, itemRes, index);
	}
}


function openSubscribeManager(){
	document.getElementById("spltrSubscribeManager").collapsed = false;
	document.getElementById("boxSubscribeManager").collapsed = false;

	var subscribeBoardsFile = gBbs2chService.getDataDir();
	subscribeBoardsFile.appendRelativePath("subscribe.txt");
	if(subscribeBoardsFile.exists()){
		var subscribeBoards = gBbs2chService.readFileLine(subscribeBoardsFile.path, {});
		document.getElementById("txtSubscribeManager").value = subscribeBoards.join("\n");
	}
}

function acceptSubscribeManager(){
	var subscribeBoardsFile = gBbs2chService.getDataDir();
	subscribeBoardsFile.appendRelativePath("subscribe.txt");
	var subscribeBoards = document.getElementById("txtSubscribeManager").value;
	gBbs2chService.writeFile(subscribeBoardsFile.path, subscribeBoards, false);

	closeSubscribeManager();
	setTimeout("initTreeSubscribe(true)", 0);
}

function closeSubscribeManager(){
	document.getElementById("txtSubscribeManager").value = "";
	document.getElementById("spltrSubscribeManager").collapsed = true;
	document.getElementById("boxSubscribeManager").collapsed = true;
}

function openSettings(){
	var settingDialogURL = "chrome://chaika/content/settings/settings.xul#paneSubscribe";

	var features = "";
	try{
    	var instantApply = gBbs2chService.pref.getBoolPref("browser.preferences.instantApply");
		features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
	}catch(ex){
		features = "chrome,titlebar,toolbar,centerscreen,modal";
	}
	window.openDialog(settingDialogURL, "", features);
}