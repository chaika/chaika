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


EXPORTED_SYMBOLS = ["ChaikaBoard"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


const LOGS_DIR_NAME = "chaika-logs";


function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}


function ChaikaBoard(){
}

ChaikaBoard.getBoardID = function ChaikaBoard_getBoardID(aBoardURL){
	if(!(aURL instanceof Ci.nsIURI)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}
	if(aURL.scheme.indexOf("http") != 0){
		throw makeException(Cr.NS_ERROR_INVALID_ARG);
	}

	var boardID = "/";
	if(aBoardURL.host.indexOf(".2ch.net")!=-1){
		boardID += "2ch" + aBoardURL.path;
	}else if(aBoardURL.host.indexOf(".machi.to")!=-1){
		boardID += "machi" + aBoardURL.path;
	}else if(aBoardURL.host.indexOf(".bbspink.com")!=-1){
		boardID += "bbspink" + aBoardURL.path;
	}else if(aBoardURL.host == "jbbs.livedoor.jp"){
		boardID += "jbbs" + aBoardURL.path;
	}else{
		boardID += "outside/";
		boardID += aBoardURL.host +  aBoardURL.path;
	}
	return boardID;
}


ChaikaBoard.getLogFileAtURL = function(aURL){
	var logFile = null;
	try{
		var boardID = ChaikaBoard.getBoardID(aURL);
		logFile = ChaikaBoard.getLogFileAtBoardID(boardID);
	}catch(ex){
		throw makeException(ex.result);
	}
	return logFile;
}

ChaikaBoard.getLogFileAtBoardID = function(aBoardID){
	var logFile = ChaikaCore.getDataDir();
	logFile.appendRelativePath(LOGS_DIR_NAME);

	var pathArray = aBoardID.split("/");
	for(let i=0; i<pathArray.length; i++){
		if(pathArray[i]) logFile.appendRelativePath(pathArray[i]);
	}
	return logFile;
}