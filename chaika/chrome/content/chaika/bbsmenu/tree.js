/* See license.txt for terms of usage */


(function(global){
    "use strict";

    const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

    let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
    let { ChaikaCore } = Cu.import("resource://chaika-modules/ChaikaCore.js", {});
    let { URLUtils }  = Cu.import("resource://chaika-modules/utils/URLUtils.js", {});


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
            let lastRowCount = this.rowCount;

            if(xml){
                this._xml = xml;
                this._buildVisibleNodes();
                this._treeBoxObject.rowCountChanged(1, this.rowCount - lastRowCount);
                this._treeBoxObject.invalidate();
            }else{
                this._visibleNodes = [];
                this._treeBoxObject.rowCountChanged(1, this.rowCount - lastRowCount);
                this._treeBoxObject.invalidate();
            }
        },

        uninit: function(){
        },

        _buildVisibleNodes: function(){
            this._visibleNodes = Array.from(
                this._xml.querySelectorAll(':root > *, [opened] > *')
            );

            this._visibleNodes = this._visibleNodes.filter((node) => {
                if(!node) return false;

                return !node.matches(':root *:not([opened]) *');
            });

            this._visibleNodes.forEach((node) => {
                node._level = this._getAccurateLevel(node);
                node._parentIndex = this._visibleNodes.indexOf(node.parentNode);
                node._iconPainted = false;
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

        handleContextMenu: function(event){
            let row = {};
            let obj = {};

            this._treeBoxObject.getCellAt(event.clientX, event.clientY, row, {}, obj);

            if(row.value === -1 || obj.value === 'twisty') return;

            let node = this._visibleNodes[row.value];

            return URLUtils.isBBS(node.getAttribute('url'));
        },


        showContext: function Tree_showContext(event){
            let row = {};
            let obj = {};

            this._treeBoxObject.getCellAt(event.clientX, event.clientY, row, {}, obj);

            if(row.value === -1 || obj.value === 'twisty') return false;
            if(this.isContainer(row.value)) return false;

            let urlItem = this._getURLItem(row.value);
            let contextMenu = document.getElementById('treeContextMenu');

            contextMenu.items = [urlItem];

            return true;
        },


        _getURLItem: function Tree_getURLItem(aRowIndex){
            let node = this._visibleNodes[aRowIndex];
            let title = node.getAttribute("title");
            let urlSpec = node.getAttribute("url");
            let itemType;

            if(URLUtils.isBoard(urlSpec)){
                itemType = 'board';
            }else if(URLUtils.isThread(urlSpec)){
                itemType = 'thread';
            }else{
                itemType = 'page';
            }

            return new ChaikaCore.ChaikaURLItem(title, urlSpec, itemType);
        },

        handleClick: function(event){
            if(event.button > 1) return;

            let row = {};
            let obj = {};

            this._treeBoxObject.getCellAt(event.clientX, event.clientY, row, {}, obj);

            if(row.value === -1 || obj.value === 'twisty') return;


            // container
            if(this.isContainer(row.value) && ChaikaCore.pref.getBool('bbsmenu.open_single_click')){
                this.toggleOpenState(row.value);
                return;
            }


            let node = this._visibleNodes[row.value];
            let inNewTab = ChaikaCore.pref.getBool('bbsmenu.open_new_tab') ? !event.button : event.button;

            if(node.hasAttribute('url')){
                this._openURL(node.getAttribute('url'), inNewTab);
            }
        },

        _openURL: function(url, inNewTab){
            let uri = Services.io.newURI(url, null, null);

            if(URLUtils.isBoard(url)){
                ChaikaCore.browser.openBoard(uri, inNewTab);
            }else if(URLUtils.isThread(url)){
                ChaikaCore.browser.openThread(uri, inNewTab);
            }else{
                ChaikaCore.browser.openURL(uri, inNewTab);
            }
        },

        getRowProperties: function(index){
            let props = [];

            if(this.isContainer(index)){
                props.push('title');
            }

            if(this.isSeparator(index)){
                props.push('separator');
            }

            return props.join(' ');
        },

        getCellProperties: function(row, col){
            return this.getRowProperties(row);
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

        isSeparator: function(index){
            return this._visibleNodes[index].nodeName === 'separator';
        },

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

        getImageSrc: function(row, col){
            let node = this._visibleNodes[row];
            let url = node.getAttribute('url');

            if(url){
                let host = Services.io.newURI(url, null, null).host;

                // Make sure that the favicon is shown in the tree.
                if(!node._iconPainted){
                    setTimeout(() => this._treeBoxObject.invalidateCell(row, col), 100);
                    node._iconPainted = true;
                }

                return 'http://' + host + '/favicon.ico';
            }

            return '';
        },

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
            let folder = this._visibleNodes[index];

            if(folder.hasAttribute('opened')){
                folder.removeAttribute('opened');
            }else{
                // Exclusive open/close
                if(ChaikaCore.pref.getBool('bbsmenu.toggle_open_container')){
                    Array.from(this._xml.querySelectorAll('[opened]')).forEach((node) => {
                        // Exclude ancestors of the folder to open
                        if(node.querySelector('[title="' + folder.getAttribute('title') + '"]')){
                            return;
                        }

                        node.removeAttribute('opened');
                    });
                }

                folder.setAttribute('opened', 'true');
            }

            this._buildVisibleNodes();
            this._treeBoxObject.rowCountChanged(1, this.rowCount - lastRowCount);
            this._treeBoxObject.invalidate();

            this._treeBoxObject.ensureRowIsVisible(this._visibleNodes.indexOf(folder));
        },


        cycleHeader: function(col){},
        selectionChanged: function(){},
        cycleCell: function(row, col){},
        isEditable: function(row, col){ return false; },
        isSelectable: function(row, col){},
        setCellValue: function(row, col, value){},
        setCellText: function(row, col, value){},
        performAction: function(action){},
        performActionOnRow: function(action, row){},
        performActionOnCell: function(action, row, col){},
    };


    // ---- Export ------------------------------------------
    global.BBSTreeView = BBSTreeView;

})((this || 0).self || global);
