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

Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");

var gAboneObserver = {
	observe: function(aSubject, aTopic, aData){
		var aboneType;
		switch(aTopic){
			case "b2r-abone-data-add":
			case "b2r-abone-data-remove":
				aboneType = aSubject.QueryInterface(Components.interfaces.nsISupportsPRInt32).data;
				break;
			default:
				return;
		}

		var aboneListBox;
		switch(aboneType){
			case ChaikaAboneManager.ABONE_TYPE_NAME:
				aboneListBox = document.getElementById("aboneNameListBox");
				break;
			case ChaikaAboneManager.ABONE_TYPE_MAIL:
				aboneListBox = document.getElementById("aboneMailListBox");
				break;
			case ChaikaAboneManager.ABONE_TYPE_ID:
				aboneListBox = document.getElementById("aboneIDListBox");
				break;
			case ChaikaAboneManager.ABONE_TYPE_WORD:
				aboneListBox = document.getElementById("aboneWordListBox");
				break;
		}
		var aboneData = ChaikaAboneManager.getAboneData(aboneType);
		initList(aboneData, aboneListBox);
	}
};


function startup(){
	var aboneNameListBox = document.getElementById("aboneNameListBox");
	var aboneMailListBox = document.getElementById("aboneMailListBox");
	var aboneIDListBox = document.getElementById("aboneIDListBox");
	var aboneWordListBox = document.getElementById("aboneWordListBox");

	initList(ChaikaAboneManager.getAboneData(ChaikaAboneManager.ABONE_TYPE_NAME), aboneNameListBox);
	initList(ChaikaAboneManager.getAboneData(ChaikaAboneManager.ABONE_TYPE_MAIL), aboneMailListBox);
	initList(ChaikaAboneManager.getAboneData(ChaikaAboneManager.ABONE_TYPE_ID), aboneIDListBox);
	initList(ChaikaAboneManager.getAboneData(ChaikaAboneManager.ABONE_TYPE_WORD), aboneWordListBox);

	var os = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
	os.addObserver(gAboneObserver, "b2r-abone-data-add", false);
	os.addObserver(gAboneObserver, "b2r-abone-data-remove", false);


	//右クリックあぼーんの時
	if('arguments' in window && window.arguments.length > 0 && typeof window.arguments[0] === 'object'){
		var ngData = window.arguments[0];

		//ngTypeから名前へ変換
		var ngTypeName = '';
		switch(ngData.ngType){
			case 0:
				ngTypeName = 'Name'; break;

			case 1:
				ngTypeName = 'Mail'; break;

			case 2:
				ngTypeName = 'ID'; break;

			case 3:
				ngTypeName = 'Word'; break;

			default:
				ngTypeName = 'Name'; break;
		}

		//該当するタブを選択
		var textbox = document.getElementById('abone' + ngTypeName + 'TextBox');
		var tabpanel = textbox.parentNode.parentNode;
		var tabbox = document.getElementById('aboneManagerTabBox');
		tabbox.selectedPanel = tabpanel;
		tabbox.selectedIndex = tabpanel.parentNode.selectedIndex;

		//テキストボックスにngWordを入れてフォーカスを当てる
		textbox.value = ngData.ngWord;
		textbox.focus();
	}
}


function shutdown(){
	var os = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
	os.removeObserver(gAboneObserver, "b2r-abone-data-add", false);
	os.removeObserver(gAboneObserver, "b2r-abone-data-remove", false);

}


function accept(){
}


function initList(aAboneData, aListBox){
	while(aListBox.getRowCount() > 0){
		aListBox.removeItemAt(0);
	}

	for(let [i, value] in aAboneData){
		if(!value) continue;
		aListBox.appendItem(value, value);
	}
}


function addAbone(aType){
	var aboneWord;
	var aboneListBox;

	switch(aType){
		case ChaikaAboneManager.ABONE_TYPE_NAME:
			aboneWord = document.getElementById("aboneNameTextBox").value;
			aboneListBox = document.getElementById("aboneNameListBox");
			break;
		case ChaikaAboneManager.ABONE_TYPE_MAIL:
			aboneWord = document.getElementById("aboneMailTextBox").value;
			aboneListBox = document.getElementById("aboneMailListBox");
			break;
		case ChaikaAboneManager.ABONE_TYPE_ID:
			aboneWord = document.getElementById("aboneIDTextBox").value;
			aboneListBox = document.getElementById("aboneIDListBox");
			break;
		case ChaikaAboneManager.ABONE_TYPE_WORD:
			aboneWord = document.getElementById("aboneWordTextBox").value;
			aboneListBox = document.getElementById("aboneWordListBox");
			break;
	}
	if(!aboneWord) return;

	ChaikaAboneManager.addAbone(aboneWord, aType);
}


function removeAbone(aType){
	var aboneListBox;
	switch(aType){
		case ChaikaAboneManager.ABONE_TYPE_NAME:
			aboneListBox = document.getElementById("aboneNameListBox");
			break;
		case ChaikaAboneManager.ABONE_TYPE_MAIL:
			aboneListBox = document.getElementById("aboneMailListBox");
			break;
		case ChaikaAboneManager.ABONE_TYPE_ID:
			aboneListBox = document.getElementById("aboneIDListBox");
			break;
		case ChaikaAboneManager.ABONE_TYPE_WORD:
			aboneListBox = document.getElementById("aboneWordListBox");
			break;
	}
	if(aboneListBox.selectedIndex == -1) return;
	var aboneWord = aboneListBox.selectedItem.value;

	ChaikaAboneManager.removeAbone(aboneWord, aType);
}
