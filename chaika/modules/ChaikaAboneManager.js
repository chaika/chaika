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


EXPORTED_SYMBOLS = ["ChaikaAboneManager"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/** @ignore */
function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}


/** @ignore */
var UniConverter = {

	_unicodeConverter: Cc["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Ci.nsIScriptableUnicodeConverter),

	toSJIS: function uniConverter_toSJIS(aString){
		this._unicodeConverter.charset = "Shift_JIS";
		return this._unicodeConverter.ConvertFromUnicode(aString);
	},

	fromSJIS: function uniConverter_fromSJIS(aString){
		this._unicodeConverter.charset = "Shift_JIS";
		return this._unicodeConverter.ConvertToUnicode(aString);
	}

};


var ChaikaAboneManager = {

	ABONE_TYPE_NAME : 0,
	ABONE_TYPE_MAIL : 1,
	ABONE_TYPE_ID   : 2,
	ABONE_TYPE_WORD : 3,

	/**
	 * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
	 * @private
	 */
	_startup: function ChaikaAboneManager__startup(){
		this._loadAboneData();
	},


	/**
	 * ブラウザ終了時に一度だけ実行され、終了処理を行う。
	 * @private
	 */
	_quit: function ChaikaAboneManager__quit(){
		this._saveAboneData();
	},


	_loadAboneData: function ChaikaAboneManager__loadAboneData(){
		this._aboneData = new Array();
		this._aboneData["name"] = this._loadNgFile("NGnames.txt");
		this._aboneData["mail"] = this._loadNgFile("NGaddrs.txt");
		this._aboneData["id"]   = this._loadNgFile("NGid.txt");
		this._aboneData["word"] = this._loadNgFile("NGwords.txt");
	},


	_loadNgFile: function ChaikaAboneManager__loadNgFile(aNgFileName){
		var ngFile = ChaikaCore.getDataDir();
		ngFile.appendRelativePath(aNgFileName);
		if(!ngFile.exists()) return new Array();

		var contentLine = ChaikaCore.io.readData(ngFile).split("\n");
		var resultArray = new Array();
			// 空白行は読み込まない
		for(let [i, line] in Iterator(contentLine)){
			if(line) resultArray.push(line);
		}
		return resultArray;
	},


	_saveAboneData: function ChaikaAboneManager__saveAboneData(){
		this._saveNgFile("NGnames.txt", this._aboneData["name"]);
		this._saveNgFile("NGaddrs.txt", this._aboneData["mail"]);
		this._saveNgFile("NGid.txt",    this._aboneData["id"]);
		this._saveNgFile("NGwords.txt", this._aboneData["word"]);
	},


	_saveNgFile: function ChaikaAboneManager__saveNgFile(aNgFileName, aboneDataArray){
		var ngFile = ChaikaCore.getDataDir();
		ngFile.appendRelativePath(aNgFileName);
		ChaikaCore.io.writeData(ngFile, aboneDataArray.join("\n"), false);
	},


	shouldAbone: function ChaikaAboneManager_shouldAbone(aName, aMail, aID, aMsg){
		function checkFunc(aElement, aIndex, aArray){
			return this.indexOf(aElement) != -1;
		}
		if(this._aboneData["name"].some(checkFunc, aName)) return true;
		if(this._aboneData["mail"].some(checkFunc, aMail)) return true;
		if(this._aboneData["id"].some(checkFunc, aID)) return true;
		if(this._aboneData["word"].some(checkFunc, aMsg)) return true;

		return false;
	},


	getAboneData: function ChaikaAboneManager_getAboneData(aType){
		var ngArray;
		switch(aType){
			case this.ABONE_TYPE_NAME:
				ngArray = this._aboneData["name"];
				break;
			case this.ABONE_TYPE_MAIL:
				ngArray = this._aboneData["mail"];
				break;
			case this.ABONE_TYPE_ID:
				ngArray = this._aboneData["id"];
				break;
			case this.ABONE_TYPE_WORD:
				ngArray = this._aboneData["word"];
				break;
			default:
				return null;
		}

		var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Ci.nsIScriptableUnicodeConverter);
		unicodeConverter.charset = "Shift_JIS";

		var resultArray = ngArray.map(function testFunc(aElement, aIndex, aArray){
				return unicodeConverter.ConvertToUnicode(aElement);
		});
		return resultArray;
	},


	addAbone: function ChaikaAboneManager_addAbone(aWord, aType){
		var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Ci.nsIScriptableUnicodeConverter);
		unicodeConverter.charset = "Shift_JIS";

		var sjisWord = unicodeConverter.ConvertFromUnicode(aWord);

		var ngArray;
		switch(aType){
			case this.ABONE_TYPE_NAME:
				ngArray = this._aboneData["name"];
				break;
			case this.ABONE_TYPE_MAIL:
				ngArray = this._aboneData["mail"];
				break;
			case this.ABONE_TYPE_ID:
				ngArray = this._aboneData["id"];
				break;
			case this.ABONE_TYPE_WORD:
				ngArray = this._aboneData["word"];
				break;
			default:
				return;
		}

			// 二重登録の禁止
		if(ngArray.indexOf(sjisWord) != -1) return;

		ngArray.push(sjisWord);

		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		var type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
		type.data = aType;

		os.notifyObservers(type, "b2r-abone-data-add", aWord);
	},


	removeAbone: function ChaikaAboneManager_removeAbone(aWord, aType){
		var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Ci.nsIScriptableUnicodeConverter);
		unicodeConverter.charset = "Shift_JIS";

		var sjisWord = unicodeConverter.ConvertFromUnicode(aWord);

		var ngArray;
		switch(aType){
			case this.ABONE_TYPE_NAME:
				ngArray = this._aboneData["name"];
				break;
			case this.ABONE_TYPE_MAIL:
				ngArray = this._aboneData["mail"];
				break;
			case this.ABONE_TYPE_ID:
				ngArray = this._aboneData["id"];
				break;
			case this.ABONE_TYPE_WORD:
				ngArray = this._aboneData["word"];
				break;
			default:
				return;
		}

		var wordIndex = ngArray.indexOf(sjisWord);
		if(wordIndex != -1) ngArray.splice(wordIndex, 1);

		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		var type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
		type.data = aType;
		os.notifyObservers(type, "b2r-abone-data-remove", aWord);

	}

};

