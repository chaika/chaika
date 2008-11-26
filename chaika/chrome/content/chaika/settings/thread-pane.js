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


var gThreadPane = {
	startup: function(){
		this.initThreadSkinList();
		this.initThreadFontList();
		this.initThreadAAFontList();
	},

	initThreadSkinList: function(){
		var lstThreadSkinList = document.getElementById("lstThreadSkinList");

		var menupopup = lstThreadSkinList.menupopup;
		while(menupopup.firstChild){
			menupopup.removeChild(menupopup.firstChild);
		}

			// 規定のスキン
		lstThreadSkinList.appendItem("(Default)", "");

		var skinDir = gBbs2chService.getDataDir();
		skinDir.appendRelativePath("skin");
		try{
			if(!skinDir.exists()) skinDir.create(skinDir.DIRECTORY_TYPE, 0777);
		}catch(ex){
			return;
		}

		var entries = skinDir.directoryEntries
				.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
		while(true){
			var entry = entries.nextFile;
			if(!entry) break;
			if(entry.isDirectory()){
				lstThreadSkinList.appendItem(entry.leafName, entry.leafName);
			}
		}
		entries.close();

			// MenuList の Value と同じ MenuItem を選択
		var menuItems = lstThreadSkinList.menupopup.childNodes;
		for(var i=0; i<menuItems.length; i++){
			if(menuItems[i].getAttribute("value") == lstThreadSkinList.value){
				lstThreadSkinList.selectedIndex = i;
			}
		}
			// 同じ MenuItem が無い場合は、デフォルトを選択
		if(lstThreadSkinList.selectedIndex == -1){
				lstThreadSkinList.selectedIndex = 0;
		}
	},

	initThreadFontList: function(){
		var lstThreadFontList = document.getElementById("lstThreadFontList");

		var fontEnumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
				.createInstance(Components.interfaces.nsIFontEnumerator);

		var fonts = fontEnumerator.EnumerateFonts("ja", "", {});
		fonts.sort();
		for(let i=0; i<fonts.length; i++){
			var item = lstThreadFontList.appendItem(fonts[i], fonts[i]);
		}

			// MenuList の Value と同じ MenuItem を選択
		var menuItems = lstThreadFontList.menupopup.childNodes;
		for(var i=0; i<menuItems.length; i++){
			if(menuItems[i].getAttribute("value") == lstThreadFontList.value){
				lstThreadFontList.selectedIndex = i;
			}
		}
			// 同じ MenuItem が無い場合は、デフォルトを選択
		if(lstThreadFontList.selectedIndex == -1){
				lstThreadFontList.selectedIndex = 1;
		}
	},

	initThreadAAFontList: function(){
		var lstThreadFontList = document.getElementById("lstThreadAAFontList");

		var fontEnumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
				.createInstance(Components.interfaces.nsIFontEnumerator);

		var fonts = fontEnumerator.EnumerateFonts("ja", "", {});
		fonts.sort();
		for(let i=0; i<fonts.length; i++){
			var item = lstThreadFontList.appendItem(fonts[i], fonts[i]);
		}

			// MenuList の Value と同じ MenuItem を選択
		var menuItems = lstThreadFontList.menupopup.childNodes;
		for(var i=0; i<menuItems.length; i++){
			if(menuItems[i].getAttribute("value") == lstThreadFontList.value){
				lstThreadFontList.selectedIndex = i;
			}
		}
			// 同じ MenuItem が無い場合は、デフォルトを選択
		if(lstThreadFontList.selectedIndex == -1){
				lstThreadFontList.selectedIndex = 1;
		}
	},

	openSkinDir: function(){
		var skinDir = gBbs2chService.getDataDir();
		skinDir.appendRelativePath("skin");
		try{
			skinDir.launch();
		}catch(ex){
				// for Unix
			var skinDirURI = gIoService.newFileURI(skinDir);
		    var protocolService = Components.classes
		    		["@mozilla.org/uriloader/external-protocol-service;1"]
    					.getService(Components.interfaces.nsIExternalProtocolService);
			protocolService.loadUrl(skinDirURI);
		}
	},

	openAboneManager: function(){
		var aboneManagerURL = "chrome://chaika/content/settings/abone-manager.xul";
		window.openDialog(aboneManagerURL, "_blank", "chrome, resizable, toolbar");
	}
};