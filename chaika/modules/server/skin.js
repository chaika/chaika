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


EXPORTED_SYMBOLS = ["SkinServerScript"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


function SkinServerScript(){
}


SkinServerScript.prototype = {

	start: function(aServerHandler){
		var filePath = aServerHandler.requestURL.filePath.substring(6);
		var skinFile = this.resolveSkinFile(filePath);

			// File Not Found
		if(!skinFile.exists()){
			aServerHandler.sendErrorPage(404, aServerHandler.requestURL.spec);
			return;
		}

		var lastModifiedString = new Date(skinFile.lastModifiedTime).toUTCString();
		aServerHandler.setResponseHeader("Last-Modified", lastModifiedString);
		aServerHandler.setResponseHeader("Cache-Control", "max-age=0, must-revalidate");

			// If-Modified-Since が存在しファイルが更新されていなければ 304
		if(aServerHandler.requestHeaders["If-Modified-Since"]){
			var lastModified = parseInt(new Date(skinFile.lastModifiedTime).getTime() / 1000);
			var ifLastModified = parseInt(new Date(
					aServerHandler.requestHeaders["If-Modified-Since"]).getTime() / 1000);
			if(lastModified == ifLastModified){
				aServerHandler.writeResponseHeader(304);
				aServerHandler.close();
				return;
			}
		}

		var mimeService = Cc["@mozilla.org/uriloader/external-helper-app-service;1"]
				.getService(Ci.nsIMIMEService);
		var contentType = mimeService.getTypeFromFile(skinFile);
		aServerHandler.setResponseHeader("Content-Type", contentType);
		aServerHandler.writeResponseHeader(200);
		var fileStream = Cc["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Ci.nsIFileInputStream);
		fileStream.init(skinFile, 0x01, 0444, fileStream.CLOSE_ON_EOF);
		aServerHandler._output.writeFrom(fileStream, skinFile.fileSize);
		fileStream.close();
		aServerHandler.close();
	},

	cancel: function(){
	},

	resolveSkinFile: function(aFilePath){
		var skinName = ChaikaCore.pref.getUniChar("thread_skin");

		var skinFile = null;
		if(skinName){
			skinFile = ChaikaCore.getDataDir();
			skinFile.appendRelativePath("skin");
			skinFile.appendRelativePath(skinName);
		}else{
			skinFile = ChaikaCore.getDefaultsDir();
			skinFile.appendRelativePath("skin");
		}

		for(var [i, value] in Iterator(aFilePath.split("/"))){
			skinFile.appendRelativePath(value);
		}

		return skinFile;
	}
};
