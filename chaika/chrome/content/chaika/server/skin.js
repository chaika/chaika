this.script = {

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
			var ifLastModified = parseInt(new Date(aServerHandler.requestHeaders["If-Modified-Since"]).getTime() / 1000);
			if(lastModified == ifLastModified){
				aServerHandler.writeResponseHeader(304);
				aServerHandler.close();
				return;
			}
		}

		var mimeService = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
								.getService(Components.interfaces.nsIMIMEService);
		var contentType = mimeService.getTypeFromFile(skinFile);
		aServerHandler.setResponseHeader("Content-Type", contentType);
		aServerHandler.writeResponseHeader(200);
		var fileStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
							.createInstance(Components.interfaces.nsIFileInputStream);
		fileStream.init(skinFile, 0x01, 0444, fileStream.CLOSE_ON_EOF);
		aServerHandler._output.writeFrom(fileStream, skinFile.fileSize);
		fileStream.close();
		aServerHandler.close();
	},

	cancel: function(){
	},

	resolveSkinFile: function(aFilePath){
		var bbs2chService = Components.classes["@mozilla.org/bbs2ch-service;1"]
				.getService(Components.interfaces.nsIBbs2chService);
		var skinName = bbs2chService.pref.getComplexValue(
							"extensions.chaika.thread_skin",
							Components.interfaces.nsISupportsString).data;

		var skinFile = null;
		if(skinName){
			skinFile = bbs2chService.getDataDir();
			skinFile.appendRelativePath("skin");
			skinFile.appendRelativePath(skinName);
		}else{
			var bbs2chreaderID = "chaika@chaika.xrea.jp";
			var extensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager);
			var installLocation = extensionManager.getInstallLocation(bbs2chreaderID);
			skinFile = installLocation.getItemFile(bbs2chreaderID, "defaults/skin").clone()
							.QueryInterface(Components.interfaces.nsILocalFile);
		}

		for(let [i, value] in Iterator(aFilePath.split("/"))){
			skinFile.appendRelativePath(value);
		}

		return skinFile;
	}
}

