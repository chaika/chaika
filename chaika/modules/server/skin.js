/* See license.txt for terms of usage */

EXPORTED_SYMBOLS = ["SkinServerScript"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


function SkinServerScript(){
}


SkinServerScript.prototype = {

    start: function(aServerHandler){
        var filePath = aServerHandler.request.url.filePath.substring(6);

        if(!filePath){
            aServerHandler.sendErrorPage(404, aServerHandler.request.url.spec);
            return;
        }

        var skinFile = this.resolveSkinFile(filePath);

            // File Not Found
        if(!skinFile.exists()){
            aServerHandler.sendErrorPage(404, aServerHandler.request.url.spec);
            return;
        }

        var lastModifiedString = new Date(skinFile.lastModifiedTime).toUTCString();
        aServerHandler.response.setHeader("Last-Modified", lastModifiedString);
        aServerHandler.response.setHeader("Cache-Control", "max-age=0, must-revalidate");

            // If-Modified-Since が存在しファイルが更新されていなければ 304
        if(aServerHandler.request.headers["If-Modified-Since"]){
            var lastModified = parseInt(new Date(skinFile.lastModifiedTime).getTime() / 1000);
            var ifLastModified = parseInt(new Date(
                    aServerHandler.request.headers["If-Modified-Since"]).getTime() / 1000);

            if(lastModified == ifLastModified){
                aServerHandler.response.writeHeaders(304);
                aServerHandler.close();
                return;
            }
        }

        //Content-Typeの設定
        var contentType = 'text/plain';
        try{
            let mimeService = Cc["@mozilla.org/uriloader/external-helper-app-service;1"]
                    .getService(Ci.nsIMIMEService);
            contentType = mimeService.getTypeFromFile(skinFile);
        }catch(ex){}
        aServerHandler.response.setHeader("Content-Type", contentType);

        aServerHandler.response.writeHeaders(200);

        //ファイル送信
        var fileStream = Cc["@mozilla.org/network/file-input-stream;1"]
                .createInstance(Ci.nsIFileInputStream);
        fileStream.init(skinFile, 0x01, 0444, fileStream.CLOSE_ON_EOF);
        aServerHandler.response.stream.writeFrom(fileStream, skinFile.fileSize);

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
