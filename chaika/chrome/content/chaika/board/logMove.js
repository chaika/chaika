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


var gBbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
			.getService(Components.interfaces.nsIBbs2chService);
var gIoService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
var gPromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);

const REPLACE_YES = 0;
const REPLACE_NO = 1;
const REPLACE_NEW_FILE = 2;

var gOldLogDir;
var gNewLogDir;
var gOldLogDirEntrieIterator;
var gOldLogDirEntrieIterator2;
var gOldLogDirEntries;
var gReplaceMode = REPLACE_YES;
var gReplaceModeNoConfirm = false;

function startup(){
	window.sizeToContent();

	if(!(window.arguments && window.arguments.length == 3)){
		alert("X");
		window.close();
		return;
	}

	document.getElementById("hdrDialog").setAttribute("label",
					window.arguments[0] +" のログファイルを移動しています");
	var oldBoardURLSpec = window.arguments[1];
	var newBoardURLSpec = window.arguments[2];

	gOldLogDir = gBbs2chService.getLogFileAtURL(oldBoardURLSpec);
	gNewLogDir = gBbs2chService.getLogFileAtURL(newBoardURLSpec);
	if(!gOldLogDir.exists()){
		window.close();
		return;
	}

	if(!(gNewLogDir.exists() && gNewLogDir.isDirectory)){
		gNewLogDir.create(gNewLogDir.DIRECTORY_TYPE, 0777);
	}

	gOldLogDirEntrieIterator = getDirEntries(gOldLogDir);
	gOldLogDirEntries = new Array();
	document.getElementById("hdrDialog")
				.setAttribute("description", "ファイルを確認中です");
	document.getElementById("progress").mode = "undetermined";
	checkFiles();
}


function checkFiles(){
    try{
		var entry = gOldLogDirEntrieIterator.next();
		outputStatus(entry.path);
		gOldLogDirEntries.push(entry);
        setTimeout("checkFiles()", 0);
    }catch(ex){
		gOldLogDirEntrieIterator2 = Iterator(gOldLogDirEntries);
		document.getElementById("hdrDialog")
					.setAttribute("description", "ファイルを移動しています");
		document.getElementById("progress").mode = "determined";
        moveFiles();
    }
}

var gCount = 0;
function moveFiles(){
    try{
		var entry = gOldLogDirEntrieIterator2.next()[1];
		outputStatus(entry.path);

		var percentage = parseInt((gCount * 100.0) / gOldLogDirEntries.length);
		document.getElementById("progress").value = percentage;
		gCount++;
		try{
			var toFile = gNewLogDir.clone()
					.QueryInterface(Components.interfaces.nsILocalFile);
			toFile.appendRelativePath(entry.leafName);

			if(toFile.exists()){
				try{
					if(toFile.fileSize==0){
						toFile.remove(false);
					}
				}catch(ex2){}

				if(gReplaceModeNoConfirm==false) replaceConfirm(entry.leafName);

				switch(gReplaceMode){
					case REPLACE_YES:
						entry.moveTo(gNewLogDir, entry.leafName);
						break;
					case REPLACE_NO:
						break;
					case REPLACE_NEW_FILE:
						var toFileLastModifiedTime = toFile.lastModifiedTime;
						var fromFileLastModifiedTime = entry.lastModifiedTime;
						if(toFileLastModifiedTime > fromFileLastModifiedTime){
							entry.moveTo(gNewLogDir, entry.leafName);
						}
						break;
				}
			}else{
				entry.moveTo(gNewLogDir, entry.leafName);
			}

		}catch(ex){
			dump(ex +"\n");
			return;
		}
        setTimeout("moveFiles()", 0);
    }catch(ex2){
		document.getElementById("progress").value = 100;
		document.getElementById("hdrDialog")
					.setAttribute("description", "終了");
        moveEnd();
    }
}

function moveEnd(){
	try{
		gOldLogDir.remove(false);
	}catch(ex){
		alert("古いフォルダに移動できなかったファイルがあります");
		try{
			gOldLogDir.launch();
		}catch(ex){
				// for Unix
			var logDirURI = gIoService.newFileURI(gOldLogDir);
		    var protocolService = Components.classes
		    		["@mozilla.org/uriloader/external-protocol-service;1"]
    					.getService(Components.interfaces.nsIExternalProtocolService);
			protocolService.loadUrl(logDirURI);
		}


	}
	window.close();
}

function replaceConfirm(aFileName){
	var checkbox = {value: false};
	var std_buttons = (gPromptService.BUTTON_TITLE_YES * gPromptService.BUTTON_POS_0) +
                      (gPromptService.BUTTON_TITLE_NO * gPromptService.BUTTON_POS_1) +
                      (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_2) +
                      gPromptService.BUTTON_POS_1_DEFAULT;
	var result = gPromptService.confirmEx(window,
					"ファイルの上書き",
					aFileName + "\n移動先に同名のファイルがありますファイルを上書きしますか?",
					std_buttons, "", "", "新しいファイルのみ",
					"次から確認しない", checkbox);
	switch(result){
		case 0:
			gReplaceMode = REPLACE_YES;
			break;
		case 1:
			gReplaceMode = REPLACE_NO;
			break;
		case 2:
			gReplaceMode = REPLACE_NEW_FILE;
			break;
	}
	gReplaceModeNoConfirm = checkbox.value;
}

function getDirEntries(aCurrentDir){
    if(!aCurrentDir.isDirectory()) return;

    var entries = aCurrentDir.directoryEntries;
    while(entries.hasMoreElements()){
        var entry = entries.getNext()
                        .QueryInterface(Components.interfaces.nsILocalFile);
		yield entry;
    }
}

function outputStatus(aString){
	document.getElementById("lblStatus").value = aString;
}