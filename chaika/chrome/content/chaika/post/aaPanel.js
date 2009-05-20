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


var AAPanel = {

	_initialized: false,

	aaDirExists: function AAPanel_aaDirExists(){
		var aaDir = ChaikaCore.getDataDir();
		aaDir.appendRelativePath("AA");
		return aaDir.exists();
	},

	openPopup: function AAPanel_openPopup(aAnchor){
		var aaPanel = document.getElementById("aaPanel");
		aaPanel.openPopup(aAnchor);
	},

	popupShowing: function AAPanel_popupShowing(aEvent){
		if(!this._initialized){
			this._aaRootDir = ChaikaCore.getDataDir();
			this._aaRootDir.appendRelativePath("AA");

			this._initDirTree();
		}
	},

	popupShown: function AAPanel_popupShown(aEvent){
		if(!this._initialized){
			var dirTree = document.getElementById("aaPanel-dirTree");
			dirTree.focus();
			dirTree.view.selection.select(0);

			this._initialized = true;
		}
	},

	_initDirTree: function AAPanel__initDirTree(){
		function appendSubDir(aParentNode, aCurrentDir){
			var aaExtReg = /\.aa\.xml$/i;
			var entries = aCurrentDir.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);
			while(true){
				var entry = entries.nextFile;
				if(!entry) break;
				if(entry.isDirectory()){
					var fileNode = aParentNode.ownerDocument.createElement("file");
					fileNode.setAttribute("name", entry.leafName);
					fileNode.setAttribute("path", entry.path);
					aParentNode.appendChild(fileNode);
					appendSubDir(fileNode, entry);
				}else if(aaExtReg.test(entry.leafName)){
					if(aParentNode.getAttribute("name") != entry.leafName.replace(aaExtReg, "")){
						var fileNode = aParentNode.ownerDocument.createElement("file");
						fileNode.setAttribute("name", entry.leafName.replace(aaExtReg, ""));
						fileNode.setAttribute("path", entry.path);
						aParentNode.appendChild(fileNode);
					}
				}
			}
			entries.close();
		}

		var dirListDoc = (new DOMParser()).parseFromString("<root/>", "text/xml");
		appendSubDir(dirListDoc.documentElement, this._aaRootDir);

		var dirTree = document.getElementById("aaPanel-dirTree");
		dirTree.builder.datasource = dirListDoc.documentElement;
		dirTree.builder.rebuild();
	},


	dirTreeSelect: function AAPanel_dirTreeSelect(aEvent){
		var dirTree = document.getElementById("aaPanel-dirTree");
		var column = dirTree.columns.getFirstColumn();
		var filePath = dirTree.view.getCellValue(dirTree.currentIndex, column);

		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		file.initWithPath(filePath);

		this._initListTree(file);
	},


	_initListTree: function AAPanel__initListTree(aFile){
		var listTree = document.getElementById("aaPanel-listTree");

		var listTreeDoc, aaListXML;

		if(!aFile.isDirectory()){
			aaListXML = ChaikaCore.io.readString(aFile, "UTF-8");
			listTreeDoc = (new DOMParser()).parseFromString(aaListXML, "text/xml");
		}else{
			var defaultFile = aFile.clone().QueryInterface(Ci.nsILocalFile);
			defaultFile.appendRelativePath(aFile.leafName + ".aa.xml");
			if(defaultFile.exists()){
				aaListXML = ChaikaCore.io.readString(defaultFile, "UTF-8");
				listTreeDoc = (new DOMParser()).parseFromString(aaListXML, "text/xml");
			}else{
				listTreeDoc = (new DOMParser()).parseFromString("<root/>", "text/xml")
			}
		}
		listTree.builder.datasource = listTreeDoc.documentElement;
		listTree.builder.rebuild();
	},


	_listTreeMouseOverLastIndex: -1,

	listTreeMouseMove: function AAPanel_listTreeMouseMove(aEvent){
		if(aEvent.originalTarget.localName != "treechildren") return;

		var listTree = document.getElementById("aaPanel-listTree");
		var row = {}
		var obj = {};
		listTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
		if(row.value == -1) return;	// ツリーのアイテム以外
		if(row.value == this._listTreeMouseOverLastIndex) return;

		var column = listTree.columns.getFirstColumn();
		var content = listTree.view.getCellValue(row.value, column).replace(/\t/g, "");
		if(!content){
			content = listTree.view.getCellText(row.value, column).replace(/\t/g, "");
		}

		this._drawThumbnail(content);

		this._listTreeMouseOverLastIndex = row.value;
	},


	_drawThumbnail: function AAPanel__drawThumbnail(aContent){

		const THUMBNAIL_SIZE = 140;
		const FONT_SIZE = ChaikaCore.pref.getInt("thread_aa_font_size");
		const LINE_HEIGHT = FONT_SIZE + ChaikaCore.pref.getInt("thread_aa_line_space");
		const FONT_NAME = ChaikaCore.pref.getUniChar("thread_aa_font_name");

		var canvas = document.getElementById("aaPanel-thumbnailCanvas");
		var ctx = canvas.getContext("2d");

		ctx.mozTextStyle = FONT_SIZE + "px \'" + FONT_NAME + "\'";

		var aaLines = aContent.split("\n");

		var aaHeight = LINE_HEIGHT * aaLines.length;
		var aaWidth = 0;
		for(var i=0; i<aaLines.length; i++){
			var line = aaLines[i];
			if(line.length == 0) continue;
			try{
				var w = ctx.mozMeasureText(line);
			}catch(ex){
				w = 0;
			}
			if(w > aaWidth) aaWidth = w;
		}

		canvas.width = THUMBNAIL_SIZE;
		canvas.height = THUMBNAIL_SIZE;

		ctx.fillStyle = "#FFF";
		ctx.clearRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
		ctx.fillStyle = "#111";

		var scale = 1;
		var xSpacing = 0;
		var ySpacing = 0;
		if(aaWidth > aaHeight){
				if(aaWidth > THUMBNAIL_SIZE){
					var scale = THUMBNAIL_SIZE / aaWidth;
					ySpacing = (THUMBNAIL_SIZE - (aaHeight * scale))/2
				}else{
					xSpacing = (THUMBNAIL_SIZE - aaWidth) / 2;
					ySpacing = (THUMBNAIL_SIZE - aaHeight) / 2;
				}
		}else{
				if(aaHeight > THUMBNAIL_SIZE){
					var scale = THUMBNAIL_SIZE / aaHeight;
					xSpacing = (THUMBNAIL_SIZE - (aaWidth * scale))/2
				}else{
					xSpacing = (THUMBNAIL_SIZE - aaWidth) / 2;
					ySpacing = (THUMBNAIL_SIZE - aaHeight) / 2;
				}
		}

		ctx.save();
		ctx.translate(xSpacing, (FONT_SIZE * scale) + ySpacing);
		ctx.scale(scale, scale);

		for(var i=0; i<aaLines.length; i++){
			line = aaLines[i];
			ctx.mozDrawText(line);
			ctx.translate(0, LINE_HEIGHT);
		}
		ctx.restore();

			// 大きなAAは薄くなるので二回描画する
		if(aaWidth>300 || aaHeight>300){
			ctx.save();
			ctx.translate(xSpacing, (FONT_SIZE * scale) + ySpacing);
			ctx.scale(scale, scale);
			for(var i=0; i<aaLines.length; i++){
				line = aaLines[i];
				ctx.mozDrawText(line);
				ctx.translate(0, LINE_HEIGHT);
			}
			ctx.restore();
		}
	},


	listTreeSelect: function AAPanel_listTreeSelect(aEvent){
		var aaPanel = document.getElementById("aaPanel");

		var listTree = document.getElementById("aaPanel-listTree");
		var row = {}
		var obj = {};
		listTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
		if(row.value == -1) return;	// ツリーのアイテム以外

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