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
 * The Original Code is chaika.
 *
 * The Initial Developer of the Original Code is
 * chaika.xrea.jp
 * Portions created by the Initial Developer are Copyright (C) 2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson.moz at gmail.com>
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


Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import('resource://chaika-modules/ChaikaAA.js');

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


var gAAManager = {

    startup: function(){
        this._initTree();

        this._aaLabel = document.getElementById('aa-label');
        this._aaTextbox = document.getElementById('aa-textbox');

        let fontFamily = ChaikaCore.pref.getUniChar("thread_aa_font_name");
        let fontSize = ChaikaCore.pref.getInt("thread_aa_font_size");
        let lineHeight = ChaikaCore.pref.getInt("thread_aa_line_space") + fontSize;
        let fontStyle = [fontSize, "px/", lineHeight, "px '", fontFamily, "'"].join("");

        this._aaTextbox.style.font = fontStyle;
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
    },


    handleDragStart: function(event){
        if(event.target.localName !== 'treechildren') return;

        let sourceIndex = this._view.selectedIndex;

        event.dataTransfer.setData('text/x-moz-tree-index', sourceIndex);
        event.dataTransfer.dropEffect = 'move';
    },


    handleSelect: function(event){
        let selectedItem = this._view._visibleNodes[this._view.selectedIndex];
        this._populateNodeData(selectedItem);
    },


    _populateNodeData: function(node){
        if(node.nodeName === 'folder'){
            this._populateData(node.getAttribute('title'));
        }else{
            this._populateData(node.getAttribute('title'), node.textContent);
        }
    },


    _populateData: function(title, content){
        this._aaLabel.value = title || '';
        this._aaTextbox.value = content || '';
    },


    insertFolder: function(){
        let title = window.prompt('フォルダ名を入力して下さい.', '', '');
        if(!title) return;

        this._view.appendItem('folder', title);
    },


    insertAA: function(){
        let title = window.prompt('AA のタイトルを入力して下さい.', '', '');
        if(!title) return;

        this._view.appendItem('aa', title);
    },


    loadAAList: function(){
        let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

        fp.init(window, 'AAList.txt の選択', Ci.nsIFilePicker.modeOpen);
        fp.appendFilters(Ci.nsIFilePicker.filterAll | Ci.nsIFilePicker.filterText);

        let rv = fp.show();

        if(rv === Ci.nsIFilePicker.returnOK || rv === Ci.nsIFilePicker.returnReplace){
            let file = fp.file;
            let aaListString = ChaikaCore.io.readString(file, 'Shift_JIS');
            let aaGroupTitles = aaListString.match(/^\[[^\]]+\]$/mg);
            let aaGroups = aaListString.split(/^\[[^\]]+\]$/m);
            let aaTables = {};

            aaGroupTitles = Array.slice(aaGroupTitles).map((title) => {
                return title.replace(/^\[/, '').replace(/\]$/, '');
            });

            aaGroups.shift();

            aaGroups.forEach((group, index) => {
                if(aaGroupTitles[index].toLowerCase() === 'aalist'){
                    //一行AA
                    group.split(/[\r\n]+/).forEach((line) => {
                        //複数行AAのタイトル
                        if(line.startsWith('*')) return;

                        aaTables[line] = line;
                    });
                }else{
                    //複数行AA
                    aaTables[aaGroupTitles[index]] = group;
                }
            });

            this._view.appendItem('folder', 'AAList.txt');

            for(let title in aaTables){
                if(title && aaTables.hasOwnProperty(title) && aaTables[title]){
                    this._view.appendItem('aa', title, aaTables[title]);
                }
            }
        }
    },


    saveAA: function(){
        this._view.changeItemAt(this._view.selectedIndex, this._aaLabel.value, this._aaTextbox.value);
    },


    removeItem: function(){
        this._view.removeItemAt(this._view.selectedIndex);
    },


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
        this._visibleNodes = Array.slice(this._xml.querySelectorAll(':root > folder, folder[opened] > :-moz-any(folder, aa)'));

        this._visibleNodes = this._visibleNodes.filter((node) => {
            if(!node) return false;

            if(node.matches){
                //Firefox 34+
                return !node.matches('folder:not([opened]) *');
            }else{
                //Firefox 34-
                return !node.mozMatchesSelector('folder:not([opened]) *');
            }
        });

        this._visibleNodes.forEach((node) => {
            node._level = this._getAccurateLevel(node);
            node._parentIndex = this._visibleNodes.indexOf(node.parentNode);
        });
    },

    appendItem: function(type, title, value){
        ChaikaCore.logger.debug('Append Item:', type, title, value);

        let selectedIndex = this.selectedIndex;
        let parentIndex;


        if(selectedIndex === -1){
            selectedIndex = this.rowCount - 1;
        }


        if(this.isContainer(selectedIndex) && type === 'aa'){
            parentIndex = selectedIndex;
        }else{
            parentIndex = this.getParentIndex(selectedIndex);
        }

        title = this._getUniqueName(parentIndex, title);


        let parentNode = this._visibleNodes[parentIndex] || this._xml;
        let node = document.createElement(type);


        if(!this.canAppend(node, parentNode)){
            return window.alert('AA とフォルダを同じ階層に置くことはできません.');
        }


        node.setAttribute('title', title);

        if(value){
            node.appendChild(document.createTextNode(value));
        }

        parentNode.appendChild(node);


        //open parent folders
        let folder = node;

        while(folder = folder.parentNode){
            if(folder.nodeName === 'folder'){
                folder.setAttribute('opened', 'true');
            }
        }

        this._buildVisibleNodes();


        let newIndex = this._visibleNodes.indexOf(parentNode.lastChild);

        this._treeBoxObject.rowCountChanged(newIndex, 1);
        this.selection.select(newIndex);
        this._treeBoxObject.ensureRowIsVisible(newIndex);
        this._treeBoxObject.treeBody.focus();
    },

    _getUniqueName: function(parentIndex, name){
        let parentNode = this._visibleNodes[parentIndex] || this._xml;
        let appendix = 2;

        if(!parentNode.querySelector('[title="' + name + '"]')){
            return name;
        }

        while(parentNode.querySelector('[title="' + name + ' ' + appendix + '"]')){
            appendix++;
        }

        return name + ' ' + appendix;
    },

    changeItemAt: function(index, title, value){
        let node = this._visibleNodes[index];

        node.setAttribute('title', title);

        if(node.nodeName === 'aa'){
            node.removeChild(node.firstChild);
            node.appendChild(document.createTextNode(value));
        }

        this._treeBoxObject.invalidateRow(index);
    },

    removeItemAt: function(index){
        let lastRowCount = this.rowCount;

        this._visibleNodes[index].parentNode.removeChild(this._visibleNodes[index]);

        this._buildVisibleNodes();
        this._treeBoxObject.rowCountChanged(index, this.rowCount - lastRowCount);

        this.selection.clearSelection();
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

    canAppend: function(sourceNode, parentNode){
        return parentNode.childNodes.length === parentNode.querySelectorAll(':scope > ' + sourceNode.nodeName).length;
    },

    canDrop: function(targetIndex, orientation, dataTransfer){
        if(!dataTransfer.types.contains('text/x-moz-tree-index')) return false;

        let sourceIndex = this.selectedIndex;

        if(sourceIndex === -1) return false;

        if(sourceIndex === targetIndex) return false;

        if(this.getParentIndex(sourceIndex) === targetIndex) return false;

        if(sourceIndex === (targetIndex + orientation)) return false;


        //aa 要素と folder 要素は同じ階層に位置できない
        let sourceNode = this._visibleNodes[sourceIndex];
        let parentNode = orientation === Ci.nsITreeView.DROP_ON ?
                            this._visibleNodes[targetIndex] :
                            this._visibleNodes[targetIndex].parentNode;

        if(!this.canAppend(sourceNode, parentNode)) return false;


        return true;
    },

    drop: function(targetIndex, orientation, dataTransfer){
        if(!this.canDrop(targetIndex, orientation, dataTransfer)) return;

        let sourceIndex = this.selectedIndex;
        let sourceNode = this._visibleNodes[sourceIndex];
        let targetNode = this._visibleNodes[targetIndex];

        sourceNode.parentNode.removeChild(sourceNode);

        switch(orientation){
            case Ci.nsITreeView.DROP_BEFORE:
                targetNode.parentNode.insertBefore(sourceNode, targetNode);
                break;

            case Ci.nsITreeView.DROP_AFTER:
                if(this.hasNextSibling(targetIndex)){
                    targetNode.parentNode.insertBefore(sourceNode, targetNode.nextSibling);
                }else{
                    targetNode.parentNode.appendChild(sourceNode);
                }
                break;

            case Ci.nsITreeView.DROP_ON:
                targetNode.appendChild(sourceNode);
                targetNode.setAttribute('opened', 'true');
                break;
        }

        this._buildVisibleNodes();
        this._treeBoxObject.invalidate();

        let newIndex = this._visibleNodes.indexOf(sourceNode);

        this.selection.clearSelection();
        this.selection.select(newIndex);
        this._treeBoxObject.ensureRowIsVisible(newIndex);
        this._treeBoxObject.treeBody.parentNode.focus();
    },

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

    isEditable: function(row, col){
        return true;
    },

    isSelectable: function(row, col){},
    setCellValue: function(row, col, value){},

    setCellText: function(row, col, value){
        this._visibleNodes[row].setAttribute('title', value);
        this._treeBoxObject.invalidateRow(row);
        gAAManager._populateNodeData(this._visibleNodes[row]);
    },

    performAction: function(action){},
    performActionOnRow: function(action, row){},
    performActionOnCell: function(action, row, col){},
};
