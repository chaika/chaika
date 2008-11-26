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

const Ci = Components.interfaces;
const Cc = Components.classes;


function b2rAboneManager(){

}

b2rAboneManager.prototype = {

	get ABONE_TYPE_NAME(){ return Ci.b2rIAboneManager.ABONE_TYPE_NAME },
	get ABONE_TYPE_MAIL(){ return Ci.b2rIAboneManager.ABONE_TYPE_MAIL },
	get ABONE_TYPE_ID  (){ return Ci.b2rIAboneManager.ABONE_TYPE_ID   },
	get ABONE_TYPE_WORD(){ return Ci.b2rIAboneManager.ABONE_TYPE_WORD },

	_startup: function(){
		this._loadAboneData();
		dump("b2rAboneManager.startup\n");
	},

	_shutdown: function(){
		this._saveAboneData();
		dump("b2rAboneManager.shutdown\n");
	},

	_loadAboneData: function(){
		this._aboneData = new Array();
		this._aboneData["name"] = this._loadNgFile("NGnames.txt");
		this._aboneData["mail"] = this._loadNgFile("NGaddrs.txt");
		this._aboneData["id"] = this._loadNgFile("NGid.txt");
		this._aboneData["word"] = this._loadNgFile("NGwords.txt");
	},
	_loadNgFile: function(aNgFileName){
		var bbs2chService = Cc["@mozilla.org/bbs2ch-service;1"]
						.getService(Ci.nsIBbs2chService);

		var ngFile = bbs2chService.getDataDir();
		ngFile.appendRelativePath(aNgFileName);
		if(!ngFile.exists()) return new Array();

		var contentLine = bbs2chService.readFileLine(ngFile.path, {});
		var resultArray = new Array();
			// 空白行は読み込まない
		for(let [i, line] in Iterator(contentLine)){
			if(line) resultArray.push(line);
		}
		return resultArray;
	},


	_saveAboneData: function(){
		this._saveNgFile("NGnames.txt", this._aboneData["name"]);
		this._saveNgFile("NGaddrs.txt", this._aboneData["mail"]);
		this._saveNgFile("NGid.txt", this._aboneData["id"]);
		this._saveNgFile("NGwords.txt", this._aboneData["word"]);
	},
	_saveNgFile: function(aNgFileName, aboneDataArray){
		var bbs2chService = Cc["@mozilla.org/bbs2ch-service;1"]
						.getService(Ci.nsIBbs2chService);

		var ngFile = bbs2chService.getDataDir();
		ngFile.appendRelativePath(aNgFileName);
		bbs2chService.writeFile(ngFile.path, aboneDataArray.join("\n"), false);
	},



	shouldAbone: function(aName, aMail, aID, aMsg){
		function checkFunc(aElement, aIndex, aArray){
			return this.indexOf(aElement) != -1;
		}
		if(this._aboneData["name"].some(checkFunc, aName)) return true;
		if(this._aboneData["mail"].some(checkFunc, aMail)) return true;
		if(this._aboneData["id"].some(checkFunc, aID)) return true;
		if(this._aboneData["word"].some(checkFunc, aMsg)) return true;

		return false;
	},


	getAboneData: function(aType){
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


	addAbone: function(aWord, aType){
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


	removeAbone: function(aWord, aType){
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

	},




  	// ********** ********* implements nsIObserver ********** **********

	observe: function(aSubject, aTopic, aData){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		switch(aTopic){
			case "app-startup":
				dump("b2rAboneManager\n");
				os.addObserver(this, "profile-after-change", false);
				os.addObserver(this, "quit-application", false);
				break;
			case "profile-after-change":
				this._startup();
				os.removeObserver(this, "profile-after-change");
				break;
			case "quit-application":
				this._shutdown();
				os.removeObserver(this, "quit-application");
				break;
		}
	},


  	// ********** ********* implements nsIClassInfo ********** **********

	get classDescription() {
		return "b2rAboneManager js component";
	},
	get classID() {
		return Components.ID("{ff8a31ea-d3c1-47f1-a72b-0a2a0975d69a}");
	},
	get implementationLanguage() {
		return Ci.nsIProgrammingLanguage.JAVASCRIPT;
	},
	get flags() {
		return Ci.nsIClassInfo.SINGLETON;
	},
	get contractID() {
    	return "@mozilla.org/b2r-abone-manager;1";
	},

	getInterfaces: function(aCount) {
	    var interfaces = [
			Ci.b2rIAboneManager,
			Ci.nsIClassInfo,
			Ci.nsIObserver,
			Ci.nsISupports
		];
	    aCount.value = interfaces.length;
    	return interfaces;
	},

 	getHelperForLanguage: function(aLanguage) {
    	return null;
	},


  	// ********** ********* implements nsISupports ********** **********

	QueryInterface: function(aIID){
		if(aIID.equals(Ci.b2rIAboneManager) ||
				aIID.equals(Ci.nsIClassInfo) ||
				aIID.equals(Ci.nsIObserver) ||
				aIID.equals(Ci.nsISupports)){
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}

};




// ********** ********* Component Registration ********** **********

var Factory = {

	createInstance: function (aOuter, aIID){
		if(aOuter != null)
			throw Components.results.NS_ERROR_NO_AGGREGATION;

		if(aIID.equals(Ci.b2rIAboneManager))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsIClassInfo))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsIObserver))
			return this.getInstance(aIID);
		if(aIID.equals(Ci.nsISupports))
			return this.getInstance(aIID);

		throw Components.results.NS_ERROR_INVALID_ARG;
	},

	getInstance: function(aIID){
		if(!this._instance){
			this._instance = new b2rAboneManager();
		}
		return this._instance.QueryInterface(aIID);
	}

};

var Module = {

	CONTRACTID: "@mozilla.org/b2r-abone-manager;1",
	CID: Components.ID("{ff8a31ea-d3c1-47f1-a72b-0a2a0975d69a}"),
	CNAME: "b2rAboneManager js component",


	registerSelf: function(aCompMgr, aFileSpec, aLocation, aType){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
		aCompMgr.registerFactoryLocation(this.CID, this.CNAME, this.CONTRACTID,
											aFileSpec, aLocation, aType);
		var categoryManager = Cc["@mozilla.org/categorymanager;1"]
					.getService(Ci.nsICategoryManager);
		categoryManager.addCategoryEntry("app-startup", this.CONTRACTID,
											this.CONTRACTID, true, true);
	},


	unregisterSelf: function(aCompMgr, aFileSpec, aLocation){
		aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);

		var categoryManager = Cc["@mozilla.org/categorymanager;1"]
					.getService(Ci.nsICategoryManager);
		categoryManager.deleteCategoryEntry("app-startup", this.CONTRACTID, true);
	},


	getClassObject: function(aCompMgr, aCID, aIID){
		if(aCID.equals(this.CID))
			return Factory;

		if(!aIID.equals(Ci.nsIFactory))
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

		throw Components.results.NS_ERROR_NO_INTERFACE;
	},


	canUnload: function(aCompMgr){
		return true;
	}

};


function NSGetModule(aCompMgr, aFileSpec){
	return Module;
}