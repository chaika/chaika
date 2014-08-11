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
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson.moz at gmail.com>
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


var AAPanel = {

    openPopup: function AAPanel_openPopup(aAnchor){
        var aaPanel = document.getElementById("aaPanel");
        aaPanel.openPopup(aAnchor);
    },


    popupShowing: function AAPanel_popupShowing(aEvent){
        this._initDirTree();
    },


    _initDirTree: function AAPanel__initDirTree(){
        this._doc = ChaikaAA.getAATree();

        var dirTree = document.getElementById("aaPanel-dirTree");
        dirTree.builder.datasource = this._doc;
        dirTree.builder.rebuild();
    },


    dirTreeSelect: function AAPanel_dirTreeSelect(aEvent){
        var calculateNodeLevel = function(node){
            let level = -2;

            while(node = node.parentNode) ++level;

            return level;
        };


        let dirTree = document.getElementById("aaPanel-dirTree");
        let column = dirTree.columns.getFirstColumn();
        let folderTitle = dirTree.view.getCellText(dirTree.currentIndex, column);
        let level = dirTree.view.getLevel(dirTree.currentIndex);

        let folders = this._doc.querySelectorAll('folder[title="' + folderTitle + '"]');
        let folder = Array.slice(folders).filter((folder) => {
            return level === calculateNodeLevel(folder);
        });

        if(!folder || folder.length === 0) return;

        this._initListTree(folder[0]);
    },


    _initListTree: function AAPanel__initListTree(folderNode){
        var listTree = document.getElementById("aaPanel-listTree");

        listTree.builder.datasource = folderNode;
        listTree.builder.rebuild();
    },


    _listTreeMouseOverLastIndex: -1,


    listTreeMouseMove: function AAPanel_listTreeMouseMove(aEvent){
        if(aEvent.originalTarget.localName !== "treechildren") return;

        var listTree = document.getElementById("aaPanel-listTree");
        var row = {};
        var obj = {};

        listTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);

        if(row.value === -1) return;    // ツリーのアイテム以外
        if(row.value === this._listTreeMouseOverLastIndex) return;

        var column = listTree.columns.getFirstColumn();
        var content = listTree.view.getCellValue(row.value, column).replace(/\t/g, "");

        if(!content){
            content = listTree.view.getCellText(row.value, column).replace(/\t/g, "");
        }

        this._drawThumbnail(content);

        this._listTreeMouseOverLastIndex = row.value;
    },


    _drawThumbnail: function AAPanel__drawThumbnail(aContent){

        const THUMBNAIL_SIZE = 160;
        const FONT_SIZE = ChaikaCore.pref.getInt("thread_aa_font_size");
        const LINE_HEIGHT = FONT_SIZE + ChaikaCore.pref.getInt("thread_aa_line_space");
        const FONT_NAME = ChaikaCore.pref.getUniChar("thread_aa_font_name");

        var canvas = document.getElementById("aaPanel-thumbnailCanvas");
        var ctx = canvas.getContext("2d");

        ctx.font = FONT_SIZE + "px \'" + FONT_NAME + "\'";

        var aaLines = aContent.split("\n");

        var aaHeight = LINE_HEIGHT * aaLines.length;
        var aaWidth = 0;

        for(let i=0; i < aaLines.length; i++){
            let line = aaLines[i];

            if(line.length === 0) continue;

            let w = ctx.measureText(line).width;
            if(w > aaWidth) aaWidth = w;
        }

        canvas.width = THUMBNAIL_SIZE;
        canvas.height = THUMBNAIL_SIZE;

        ctx.fillStyle = "#FFF";
        ctx.clearRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        ctx.fillStyle = "#111";
        ctx.strokeStyle = "#555";

        var scale = 1;
        var xSpacing = 0;
        var ySpacing = 0;

        if(aaWidth > aaHeight){
            if(aaWidth > THUMBNAIL_SIZE){
                scale = THUMBNAIL_SIZE / aaWidth;
                ySpacing = (THUMBNAIL_SIZE - (aaHeight * scale))/2;
            }else{
                xSpacing = (THUMBNAIL_SIZE - aaWidth) / 2;
                ySpacing = (THUMBNAIL_SIZE - aaHeight) / 2;
            }
        }else{
            if(aaHeight > THUMBNAIL_SIZE){
                scale = THUMBNAIL_SIZE / aaHeight;
                xSpacing = (THUMBNAIL_SIZE - (aaWidth * scale))/2;
            }else{
                xSpacing = (THUMBNAIL_SIZE - aaWidth) / 2;
                ySpacing = (THUMBNAIL_SIZE - aaHeight) / 2;
            }
        }

        ctx.save();
        ctx.scale(scale, scale);

        for(let i=0; i < aaLines.length; i++){
            line = aaLines[i];

            let y = (FONT_SIZE * scale) + ySpacing + (i*LINE_HEIGHT);
            ctx.fillText(line, xSpacing, y);
            ctx.strokeText(line, xSpacing, y);
        }

        ctx.restore();
    },


    listTreeSelect: function AAPanel_listTreeSelect(aEvent){
        var aaPanel = document.getElementById("aaPanel");

        var listTree = document.getElementById("aaPanel-listTree");
        var row = {};
        var obj = {};

        listTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);

        if(row.value === -1) return;    // ツリーのアイテム以外

        var column = listTree.columns.getFirstColumn();
        var content = listTree.view.getCellValue(row.value, column).replace(/\t/g, "");

        if(!content){
            content = listTree.view.getCellText(row.value, column).replace(/\t/g, "");
        }

        var insertTextbox = document.getElementById(aaPanel.getAttribute("insertTextbox"));

        var leftValue = insertTextbox.value.substring(0, insertTextbox.selectionStart);
        var rightValue = insertTextbox.value.substring(insertTextbox.selectionEnd);

        insertTextbox.value = leftValue + content + rightValue;

        aaPanel.hidePopup();
    }

};
