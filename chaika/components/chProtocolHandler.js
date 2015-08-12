/* See license.txt for terms of usage */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaServer.js");
Components.utils.import('resource://chaika-modules/ChaikaHttpController.js');


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


function chProtocolHandler(){
}

chProtocolHandler.prototype = {

    _getRedirectChannel: function chProtocolHandler__getRedirectChannel(aURISpec){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var channelURI = ioService.newURI(aURISpec, null, null);
        return ioService.newChannelFromURI(channelURI);
    },


    _getCommandChannel: function chProtocolHandler__getCommandChannel(aURI){
        var content = aURI.spec;
        var stream = Cc["@mozilla.org/io/string-input-stream;1"]
                        .createInstance(Ci.nsIStringInputStream);

        stream.setData(content, content.length);

        var channel = Cc["@mozilla.org/network/input-stream-channel;1"]
                        .createInstance(Ci.nsIInputStreamChannel)
                        .QueryInterface(Ci.nsIChannel);

        channel.setURI(aURI);
        channel.contentStream = stream;
        channel.contentType = "application/x-chaika-command";
        channel.contentCharset = "UTF-8";

        return channel;
    },


    // ********** ********* implements nsIProtocolHandler ********* **********

    scheme: "chaika",
    defaultPort: -1,
        // TODO 設計を見直して URI_LOADABLE_BY_ANYONE をやめるようにする
    protocolFlags: Ci.nsIProtocolHandler.URI_NOAUTH | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,


    allowPort: function chProtocolHandler_allowPort(aPort, aScheme){
        return false;
    },


    newURI: function chProtocolHandler_newURI(aSpec, aCharset, aBaseURI){
        var uri = Cc["@mozilla.org/network/standard-url;1"].createInstance(Ci.nsIStandardURL);

        uri.init(Ci.nsIStandardURL.URLTYPE_STANDARD, -1, aSpec, aCharset, aBaseURI);
        uri.QueryInterface(Ci.nsIURL);

        return uri;
    },


    newChannel: function chProtocolHandler_newChannel(aURI){
        var channel;

        switch(aURI.host){

            case "bbsmenu":
                channel = this._getRedirectChannel("chrome://chaika/content/bbsmenu/page.xul");
                break;

            case "board":
                channel = this._getRedirectChannel("chrome://chaika/content/board/page.xul");
                break;

            case "log-manager":
                channel = this._getRedirectChannel("chrome://chaika/content/board/log-manager.xul");
                break;

            case "support":
                channel = this._getRedirectChannel("chrome://chaika/content/support.xhtml");
                break;

            case "releasenotes":
                channel = this._getRedirectChannel("chrome://chaika/content/releasenotes.html");
                break;

            case 'ivur':
                channel = this._getRedirectChannel(ChaikaHttpController.ivur.getRedirectURI(aURI));
                break;

            default:
                channel = this._getCommandChannel(aURI);
                break;
        }

        channel.originalURI = aURI;
        return channel;
    },


    // ********** ********* XPCOMUtils Component Registration ********** **********

    classDescription: "chProtocolHandler js component",
    contractID: "@mozilla.org/network/protocol;1?name=chaika",
    classID: Components.ID("{5b0cd1b2-2f16-4472-bdd2-1416380ab3d4}"),
    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIProtocolHandler,
        Ci.nsISupports
    ])
};




function b2rProtocolHandler(){
}

b2rProtocolHandler.prototype = Object.create(chProtocolHandler.prototype, {

    // ********** ********* implements nsIProtocolHandler ********* **********

    scheme: {
        value: "bbs2ch"
    },


    newURI: {
        value: function chProtocolHandler_newURI(aSpec, aCharset, aBaseURI){
            aSpec = aSpec.replace("bbs2ch:board:", "bbs2ch:board/")
                        .replace("bbs2ch:post:", "bbs2ch:post/")
                        .replace("bbs2ch:", "chaika://");

            var uri = Cc["@mozilla.org/network/standard-url;1"].createInstance(Ci.nsIStandardURL);
            uri.init(Ci.nsIStandardURL.URLTYPE_STANDARD, -1, aSpec, aCharset, null);
            uri.QueryInterface(Ci.nsIURL);

            return uri;
        }
    },


    // ********** ********* XPCOMUtils Component Registration ********** **********

    classDescription: {
        value: "b2rProtocolHandler js component"
    },

    contractID: {
        value: "@mozilla.org/network/protocol;1?name=bbs2ch"
    },

    classID: {
        value: Components.ID("{9c30cf1f-eb30-4870-a12a-15c1414bd299}")
    },

    QueryInterface: {
        value: XPCOMUtils.generateQI([Ci.nsIProtocolHandler, Ci.nsISupports])
    }

});

b2rProtocolHandler.constructor = b2rProtocolHandler;



function chContentHandler(){
}

chContentHandler.prototype = {

    // ********** ********* implements nsIProtocolHandler ********* **********

    handleContent: function chContentHandler_handleContent(aContentType, aWindowContext, aRequest){
        var url = aRequest.originalURI;
        if(url.scheme !== "chaika") return;

        if(!(url instanceof Ci.nsIURL)){
            ChaikaCore.logger.error(url.spec);
            return;
        }

        var contextWin = null;
        try{
            contextWin = aWindowContext.getInterface(Ci.nsIDOMWindow);
        }catch(ex){
            ChaikaCore.logger.error(ex);
            return;
        }

        var contextHost = "";
        try{
            contextHost = contextWin.location.host;
        }catch(ex){
            // about:blank など host を持たない URI
                ChaikaCore.logger.warning(contextWin.location +" : "+ url.spec);
            return;
        }

        if(contextHost && ChaikaServer.serverURL.hostPort !== contextHost){
            // 内部サーバ外から呼ばれたなら終了
            ChaikaCore.logger.warning(contextWin.location +" : "+ url.spec);
            return;
        }


        switch(url.host){
            case "post": // 書き込みウィザード
                this._openPostWizard(url.filePath.substring(1));
                break;

            default:
                ChaikaCore.logger.warning(contextWin.location + " : " + url.spec);
                break;
        }
    },


    _openPostWizard: function chContentHandler__openPostWizard(aThreadURLSpec){
        ChaikaCore.browser.openWindow(
            "chrome://chaika/content/post/wizard.xul",
            null,
            aThreadURLSpec
        );
    },


    // ********** ********* XPCOMUtils Component Registration ********** **********

    classDescription: "chContentHandler js component",
    contractID: "@mozilla.org/uriloader/content-handler;1?type=application/x-chaika-command",
    classID: Components.ID("{ae4c60c5-6db2-4c39-939f-4bea59fa9508}"),
    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIContentHandler,
        Ci.nsISupports
    ])

};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([chProtocolHandler, b2rProtocolHandler, chContentHandler]);
