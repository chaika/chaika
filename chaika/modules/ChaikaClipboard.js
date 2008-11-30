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
 * Portions created by the Initial Developer are Copyright (C) 2008
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


EXPORTED_SYMBOLS = ["ChaikaClipboard"];


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/** @ignore */
function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}


/**
 * クリップボード操作オブジェクト
 * @class
 */
var ChaikaClipboard = {


	/**
	 * クリップボードの文字列を取得する。
	 * @return {String} クリップボードの文字列
	 */
	getString: function ChaikaClipboard_getString(){
		var clipBoard = Cc["@mozilla.org/widget/clipboard;1"].getService(Ci.nsIClipboard);
		var transferable = Cc["@mozilla.org/widget/transferable;1"]
				.createInstance(Ci.nsITransferable);
		transferable.addDataFlavor("text/unicode");

		var resultStr = null;

		if(!this.hasStringData()){
			return resultStr;
		}
		try{
			var transferData = {};
			clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
			transferable.getTransferData("text/unicode", transferData, {});
			resultStr = transferData.value.QueryInterface(Ci.nsISupportsString);
		}catch(ex){
			throw makeException(ex.result);
		}
		return resultStr;
	},


	/**
	 * 取得可能な文字列がクリップボードにあるか判定する。
	 * @return {Boolean} 文字列があれば真
	 */
	hasStringData: function ChaikaClipboard_hasStringData(){
		const kGlobalClipboard = Ci.nsIClipboard.kGlobalClipboard;
		var clipBoard = Cc["@mozilla.org/widget/clipboard;1"].getService(Ci.nsIClipboard);

		return clipBoard.hasDataMatchingFlavors(["text/unicode"], 1,kGlobalClipboard);
	},


	/**
	 * クリップボードに文字列をコピーする
	 * @param {String} aCopyString コピーする文字列
	 * @return {String} コピーした文字列
	 */
	setString: function ChaikaClipboard_setString(aCopyString){
		var copyString = new String(aCopyString);
		var clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
					.getService(Ci.nsIClipboardHelper);
		try{
			clipboardHelper.copyString(copyString);
		}catch(ex){
			throw makeException(ex.result);
		}
		return copyString;
	}

};