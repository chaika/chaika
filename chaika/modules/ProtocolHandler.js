/* See license.txt for terms of usage */

"use strict";

this.EXPORTED_SYMBOLS = ['ProtocolHandlerFrame'];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { XPCOMUtils } = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {});
let { Services } = Cu.import('resource://gre/modules/Services.jsm', {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});
let { Logger } = Cu.import('resource://chaika-modules/utils/Logger.js', {});
let { ChaikaHttpController } = Cu.import('resource://chaika-modules/ChaikaHttpController.js', {});


function AbstractProtocolHandler(){
}

AbstractProtocolHandler.prototype = {

    scheme: null,

    defaultPort: -1,

    protocolFlags: Ci.nsIProtocolHandler.URI_NOAUTH | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,

    createInstance(outer, iid) {
        if(outer){
            throw Cr.NS_ERROR_NO_AGGREGATION;
        }

        return this.QueryInterface(iid);
    },


    allowPort() {
        return false;
    },

    newURI(aSpec, aCharset, aBaseURI) {
        let uri = Cc['@mozilla.org/network/standard-url;1'].createInstance(Ci.nsIStandardURL);

        uri.init(Ci.nsIStandardURL.URLTYPE_STANDARD, -1, aSpec, aCharset, aBaseURI);
        uri.QueryInterface(Ci.nsIURL);

        return uri;
    },

    newChannel(aURI) {
        return Cr.NS_ERROR_NO_CONTENT;
    },


    classDescription: null,

    contractID: null,

    classID: null,

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIProtocolHandler,
        Ci.nsISupports
    ])
};



function ChaikaProtocolHandler(){
}

ChaikaProtocolHandler.prototype = Object.create(AbstractProtocolHandler.prototype, {

    scheme: {
        value: 'chaika'
    },


    _getRedirectChannel: {
        value: function(aURI){
            let channelURI = Services.io.newURI(aURI, null, null);

            return Services.io.newChannelFromURI(channelURI);
        }
    },


    newChannel: {
        value: function(aURI){
            let channel;

            switch(aURI.host){

                case 'board':
                    channel = this._getRedirectChannel('chrome://chaika/content/board/page.xul');
                    break;

                case 'log-manager':
                    channel = this._getRedirectChannel('chrome://chaika/content/board/log-manager.xul');
                    break;

                case 'support':
                    channel = this._getRedirectChannel('chrome://chaika/content/support.xhtml');
                    break;

                case 'releasenotes':
                    channel = this._getRedirectChannel('chrome://chaika/content/releasenotes.html');
                    break;

                case 'ivur':
                    channel = this._getRedirectChannel(ChaikaHttpController.ivur.getRedirectURI(aURI));
                    break;

                case 'post':
                    channel = this._getRedirectChannel('chrome://chaika/content/post/wizard.xul');
                    break;

                default:
                    return Cr.NS_ERROR_NO_CONTENT;

            }

            channel.originalURI = aURI;

            return channel;
        }
    },


    classDescription: {
        value: 'chaika scheme protocol handler'
    },

    contractID: {
        value: '@mozilla.org/network/protocol;1?name=chaika'
    },


    classID: {
        value: Components.ID('{5b0cd1b2-2f16-4472-bdd2-1416380ab3d4}')
    },

});

ChaikaProtocolHandler.constructor = ChaikaProtocolHandler;



function BBS2chProtocolHandler(){
}

BBS2chProtocolHandler.prototype = Object.create(ChaikaProtocolHandler.prototype, {

    scheme: {
        value: 'bbs2ch'
    },


    newURI: {
        value: function(aSpec, aCharset, aBaseURI){
            let url = aSpec.replace('bbs2ch:board:', 'bbs2ch:board/')
                           .replace('bbs2ch:post:', 'bbs2ch:post/')
                           .replace('bbs2ch:', 'chaika://');

            let uri = Cc['@mozilla.org/network/standard-url;1'].createInstance(Ci.nsIStandardURL);
            uri.init(Ci.nsIStandardURL.URLTYPE_STANDARD, -1, url, aCharset, null);
            uri.QueryInterface(Ci.nsIURL);

            return uri;
        }
    },


    classDescription: {
        value: 'bbs2ch scheme protocol handler'
    },

    contractID: {
        value: '@mozilla.org/network/protocol;1?name=bbs2ch'
    },


    classID: {
        value: Components.ID('{9c30cf1f-eb30-4870-a12a-15c1414bd299}')
    },

});

BBS2chProtocolHandler.constructor = BBS2chProtocolHandler;



let ProtocolHandlerFrame = {

    init() {
        let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
        let handlers = [
            ChaikaProtocolHandler.prototype,
            BBS2chProtocolHandler.prototype,
        ];

        handlers.forEach((handler) => {
            if(!registrar.isContractIDRegistered(handler.contractID)){
                registrar.registerFactory(
                    handler.classID,
                    handler.classDescription,
                    handler.contractID,
                    handler);
            }
        });
    },


    uninit() {
        let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
        let handlers = [
            ChaikaProtocolHandler.prototype,
            BBS2chProtocolHandler.prototype,
        ];

        handlers.forEach((handler) => {
            registrar.unregisterFactory(handler.classID, handler);
        });
    }

};


ProtocolHandlerFrame.init();
