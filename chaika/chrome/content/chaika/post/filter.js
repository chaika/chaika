

function b2rPostFilterManager(){
	this._filters = new Array();
}

b2rPostFilterManager.prototype = {
	get filters(){
		return this._filters;
	},

	loadScripts: function(){
		this._filters = new Array();
		var fileExtensionTest = /\.xml$/i;

		var bbs2chreaderID = "chaika@chaika.xrea.jp";
		var extensionManager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
		var installLocation = extensionManager.getInstallLocation(bbs2chreaderID);
		var postFiltersFolder = installLocation.getItemFile(bbs2chreaderID, "defaults/postFilters")
				.clone().QueryInterface(Ci.nsILocalFile);
		var entries = postFiltersFolder.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);
		while(true){
			var entry = entries.nextFile;
			if(!entry) break;
			if(!fileExtensionTest.test(entry.leafName)) continue;

			var postFilter = this._createFilter(entry);
			if(postFilter){
				this._filters.push(postFilter);
			}
		}
		entries.close();


		var postFiltersProfileFolder = gBbs2chService.getDataDir();
		postFiltersProfileFolder.appendRelativePath("postFilters");
		if(!postFiltersProfileFolder.exists()){
			postFiltersProfileFolder.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
		}
		var entries = postFiltersProfileFolder.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);
		while(true){
			var entry = entries.nextFile;
			if(!entry) break;
			if(!fileExtensionTest.test(entry.leafName)) continue;

			var postFilter = this._createFilter(entry);
			if(postFilter){
				this._filters.push(postFilter);
			}
		}
		entries.close();
	},

	_createFilter: function(aLocalFile){
		var fileInputStream = Cc["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Ci.nsIFileInputStream);
		fileInputStream.init(aLocalFile, 0x01, 0666, Ci.nsIFileInputStream.CLOSE_ON_EOF);
		var parser = new DOMParser();
		var doc = parser.parseFromStream(fileInputStream, null, aLocalFile.fileSize , "text/xml");
		if(doc.firstChild.nodeName!="postFilter") return null;
		doc.normalize();

		var filter = {};
		filter.title = this._getTextContent(doc, "title");
		if(!filter.title) filter.title = aLocalFile.leafName.replace(/\.xml$/, "");
		filter.description = this._getTextContent(doc, "description");
		filter.version = this._getTextContent(doc, "version");
		filter.script = this._getTextContent(doc, "script");
		filter.scriptFile = aLocalFile;
		filter.scriptDoc = doc;
		if(!filter.script) return null;

		return filter;
	},

	_getTextContent: function(aDoc, aTagName){
		var nodes = aDoc.getElementsByTagName(aTagName);
		if(nodes.length>0) return nodes[0].textContent;
		return null;
	},

	execFilterScript: function(aPostFilter, aTextArea){
		var safeWindow = new XPCNativeWrapper(window);
		var sandbox = new Components.utils.Sandbox(safeWindow);
		sandbox.PostFilter = new b2rPostFilterContext(aPostFilter, aTextArea);

		sandbox.__proto__ = safeWindow;
		try{
			var stackLinenumber = Components.stack.lineNumber + 1;
			Components.utils.evalInSandbox(aPostFilter.script, sandbox);
		}catch(ex){
			this.logErrorMessage(ex.message, aPostFilter.scriptFile.path, ex.lineNumber - stackLinenumber);
			return aTextArea.value;
		}
		return sandbox.PostFilter.result;
	},

	logErrorMessage: function(aMessage, aSourceName, aLineNumber){
		var consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
		var scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
		scriptError.init(aMessage, aSourceName, null, aLineNumber, null, null, null);
		consoleService.logMessage(scriptError);
	}

}


function b2rPostFilterContext(aPostFilter, aTextArea){
	this._filter = aPostFilter;
	this._textArea = aTextArea;
	this._value = aTextArea.value;
	this._result = aTextArea.value;
}

b2rPostFilterContext.prototype = {

	get scriptFile(){
		return this._filter.scriptFile;
	},
	get scriptDoc(){
		return this._filter.scriptDoc;
	},

	get value(){
		return this._value;
	},

	get result(){
		return String(this._result);
	},
	set result(aValue){
		return this._result = aValue;
	},

	get isSelection(){
		return this._textArea.selectionStart != this._textArea.selectionEnd;
	},

	get selectionLeft(){
		return this.value.substring(0, this._textArea.selectionStart);
	},
	get selection(){
		return this.value.substring(this._textArea.selectionStart, this._textArea.selectionEnd);
	},
	get selectionRight(){
		return this.value.substring(this._textArea.selectionEnd);
	}
};