
Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import('resource://chaika-modules/ChaikaAA.js');


var gAAManager = {

    startup: function(){
        this._initTree();
    },


    shutdown: function(){
        this._tree.view = null;
    },


    _initTree: function(){
        this._tree = document.getElementById("aaTree");
        this._view = new AATreeView(ChaikaAA.getAAXML());
        this._tree.view = this._view;
    },


    handleClick: function(event){
        if(event.button !== 0) return;

        let row = {};
        let obj = {};

        this._view._treeBoxObject.getCellAt(event.clientX, event.clientY, row, {}, obj);

        if(row.value === -1 || obj.value === 'twisty') return;

        if(this._view.isContainer(row.value)){
            this._view.toggleOpenState(row.value);
        }
    }


};



/**
 * @implements nsITreeView
 */
function AATreeView(aaXML){
    this._init.apply(this, arguments);
}

AATreeView.prototype = {

    _init: function(aaXML){
        this._treeBoxObject = null;
        this._xml = aaXML;

        this._buildVisibleNodes();
    },

    _buildVisibleNodes: function(){
        this._visibleNodes = Array.slice(this._xml.querySelectorAll(':root > folder, folder[opened] > *'));

        ChaikaCore.logger.debug(this._visibleNodes.length);

        this._visibleNodes.forEach((node) => {
            node._parentIndex = this._visibleNodes.indexOf(node.parentNode);
        });
    },


    get rowCount(){
        return this._visibleNodes.length;
    },

    selection: null,

    getRowProperties: function(index){},

    getCellProperties: function(row, col){},

    getColumnProperties: function(col){},

    isContainer: function(index){
        return this._visibleNodes[index].nodeName.toLowerCase() === 'folder';
    },

    isContainerOpen: function(index){
        return this._visibleNodes[index].hasAttribute('opened');
    },

    isContainerEmpty: function(index){
        return !this._visibleNodes[index].hasChildNodes();
    },

    isSeparator: function(index){ return false; },

    isSorted: function(){ return false; },

    canDrop: function(targetIndex, orientation){ return false; },

    drop: function(targetIndex, orientation){},

    getParentIndex: function(rowIndex){
        return this._visibleNodes[rowIndex]._parentIndex;
    },

    hasNextSibling: function(rowIndex, afterIndex){
        return !!this._visibleNodes[rowIndex].nextSibling;
    },

    getLevel: function(rowIndex){
        return this._visibleNodes[rowIndex].getAttribute('level') - 0;
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
    isEditable: function(row, col){},
    isSelectable: function(row, col){},
    setCellValue: function(row, col, value){},
    setCellText: function(row, col, value){},
    performAction: function(action){},
    performActionOnRow: function(action, row){},
    performActionOnCell: function(action, row, col){},
};
