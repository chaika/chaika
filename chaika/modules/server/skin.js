/* See license.txt for terms of usage */

this.EXPORTED_SYMBOLS = ["SkinServerScript"];
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


function SkinServerScript(){
}


SkinServerScript.prototype = {

    start: function(aServerHandler){
        var path = aServerHandler.request.url.filePath.substring(6);
        var skinFile = this.resolveSkinFile(path);


        // Send 404 if the file doesn't exist
        if(!skinFile || !skinFile.exists()){
            aServerHandler.sendErrorPage(404, aServerHandler.request.url.spec);
            return;
        }


        // Set cache
        var lastModified = new Date(skinFile.lastModifiedTime).toUTCString();
        aServerHandler.response.setHeader("Last-Modified", lastModified);
        aServerHandler.response.setHeader("Cache-Control", "max-age=0, must-revalidate");


        // Send 304 if possible
        if(aServerHandler.request.headers["If-Modified-Since"]){
            let ifModifiedSince = new Date(aServerHandler.request.headers["If-Modified-Since"]).toUTCString();

            if(lastModified === ifModifiedSince){
                aServerHandler.response.writeHeaders(304);
                aServerHandler.close();
                return;
            }
        }


        // Set Content-Type
        var contentType;

        try{
            let mimeService = Cc["@mozilla.org/uriloader/external-helper-app-service;1"]
                                .getService(Ci.nsIMIMEService);
            contentType = mimeService.getTypeFromFile(skinFile);
        }catch(ex){
            contentType = 'text/plain';
        }

        aServerHandler.response.setHeader("Content-Type", contentType);


        // Set Content-Length
        // The lack of Content-Length header may cause request failure in some environments. (#224)
        aServerHandler.response.setHeader("Content-Length", skinFile.fileSize);


        // Send 200
        aServerHandler.response.writeHeaders(200);


        // Send the skin file
        var fileStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);

        fileStream.init(skinFile, 0x01, 0444, fileStream.CLOSE_ON_EOF);
        aServerHandler.response.stream.writeFrom(fileStream, skinFile.fileSize);

        fileStream.close();
        aServerHandler.close();
    },


    cancel: function(){
    },


    resolveSkinFile: function(aFilePath){
        if(!aFilePath) return null;

        var skinName = ChaikaCore.pref.getUniChar("thread_skin");
        var skinFile;

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
