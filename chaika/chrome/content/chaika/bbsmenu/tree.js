/* See license.txt for terms of usage */


/**
 * @implements nsITreeView
 */
function BBSTreeView(xml){
    this._init.apply(this, arguments);
}

BBSTreeView.prototype = {

    _init: function(xml){
        this._treeBoxObject = null;
        this._xml = xml;

        this._buildVisibleNodes();
    },

    build: function(xml){
        if(xml){
            this._xml = xml;
            this._buildVisibleNodes();
            this._treeBoxObject.invalidate();
        }else{
            this._visibleNodes = [];
            this._treeBoxObject.invalidate();
        }
    },

    uninit: function(){
    },

    _buildVisibleNodes: function(){
        this._visibleNodes = Array.slice(
            this._xml.querySelectorAll(':root > *, [opened] > *')
        );

        this._visibleNodes = this._visibleNodes.filter((node) => {
            if(!node) return false;

            if(node.matches){
                //Firefox 34+
                return !node.matches(':root *:not([opened]) *');
            }else{
                //Firefox 34-
                return !node.mozMatchesSelector(':root *:not([opened]) *');
            }
        });

        this._visibleNodes.forEach((node) => {
            node._level = this._getAccurateLevel(node);
            node._parentIndex = this._visibleNodes.indexOf(node.parentNode);
        });
    },

    get rowCount(){
        return this._visibleNodes.length;
    },

    get selectedIndex(){
        let start = {};
        let end = {};

        this.selection.getRangeAt(0, start, end);

        if(start.value === end.value){
            return start.value;
        }else{
            return -1;
        }
    },

    selection: null,

    handleClick: function(event){
        if(event.button !== 0) return;

        let row = {};
        let obj = {};

        this._treeBoxObject.getCellAt(event.clientX, event.clientY, row, {}, obj);

        if(row.value === -1 || obj.value === 'twisty') return;

        this._openURL(row.value);
    },

    _openURL: function(index){
        let url = this._visibleNodes[index].getAttribute('url');
        let uri = Services.io.newURI(url, null, null);

        if(ChaikaURLUtil.isBoard(url)){
            ChaikaCore.browser.openBoard(uri);
        }else if(ChaikaURLUtil.isThread(url)){
            ChaikaCore.browser.openThread(uri);
        }else{
            ChaikaCore.browser.openURL(uri);
        }
    },

    getRowProperties: function(index){},

    getCellProperties: function(row, col){
        if(this.isContainer(row)){
            return 'title';
        }
    },

    getColumnProperties: function(col){},

    isContainer: function(index){
        return this._visibleNodes[index].hasChildNodes();
    },

    isContainerOpen: function(index){
        return this._visibleNodes[index].hasAttribute('opened');
    },

    isContainerEmpty: function(index){
        return false;
    },

    isSeparator: function(index){ return false; },

    isSorted: function(){ return false; },

    canAppend: function(sourceNode, parentNode){ return false; },

    canDrop: function(targetIndex, orientation, dataTransfer){ return false; },

    drop: function(targetIndex, orientation, dataTransfer){},

    getParentIndex: function(rowIndex){
        return this._visibleNodes[rowIndex]._parentIndex;
    },

    hasNextSibling: function(rowIndex, afterIndex){
        return !!this._visibleNodes[rowIndex].nextSibling;
    },

    getLevel: function(rowIndex){
        return this._visibleNodes[rowIndex]._level;
    },

    _getAccurateLevel: function(node){
        let level = -2;

        while(node = node.parentNode) ++level;

        return level;
    },

    getImageSrc: function(row, col){},
    getProgressMode: function(row, col){},
    getCellValue: function(row, col){},

    getCellText: function(row, col){
        return this._visibleNodes[row].getAttribute('title') || '';
    },

    setTree: function(tree){
        if(tree){
            this._treeBoxObject = tree;
        }else{
            this._treeBoxObject = null;
            this._xml = null;
            this._visibleNodes = null;
        }
    },

    toggleOpenState: function(index){
        let lastRowCount = this.rowCount;

        if(this._visibleNodes[index].hasAttribute('opened')){
            this._visibleNodes[index].removeAttribute('opened');
        }else{
            this._visibleNodes[index].setAttribute('opened', 'true');
        }

        this._buildVisibleNodes();
        this._treeBoxObject.rowCountChanged(index + 1, this.rowCount - lastRowCount);
        this._treeBoxObject.invalidateRow(index);
    },


    cycleHeader: function(col){},
    selectionChanged: function(){},
    cycleCell: function(row, col){},

    isEditable: function(row, col){ return false; },

    isSelectable: function(row, col){},
    setCellValue: function(row, col, value){},

    setCellText: function(row, col, value){
        this._visibleNodes[row].setAttribute('title', value);
        this._treeBoxObject.invalidateRow(row);
    },

    performAction: function(action){},
    performActionOnRow: function(action, row){},
    performActionOnCell: function(action, row, col){},
};
