Components.utils.import("resource://chaika-modules/ChaikaCore.js");

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

		for(let [i, value] in Iterator(aFilePath.split("/"))){
			skinFile.appendRelativePath(value);
		}

		return skinFile;
	}
}

