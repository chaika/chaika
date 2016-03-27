/* See license.txt for terms of usage */

/* global content, addMessageListener, sendAsyncMessage, sendSyncMessage */

'use strict';

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});


/**
 * A bridge between chrome and content on chaika's thread pages.
 */
let ThreadAgent = {

    logmsg: function(msg){
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage(msg);
    },


    init: function(){
        addMessageListener('chaika-skin-changed', this.handleMessage.bind(this));
        addMessageListener('chaika-post-finished', this.handleMessage.bind(this));
        addMessageListener('chaika-abone-add', this.handleMessage.bind(this));
        addMessageListener('chaika-abone-remove', this.handleMessage.bind(this));
        addMessageListener('chaika-get-selected-text', this.handleMessage.bind(this));
    },


    handleMessage: function(message){
        if(!message.name.startsWith('chaika-')) return;
        if(!URLUtils.isChaikafied(content.location.href)) return;

        switch(message.name){
            case 'chaika-skin-changed':
                if(URLUtils.isThread(content.location.href)){
                    content.location.reload();
                }
                break;

            case 'chaika-post-finished':
                let postedThreadURL = new content.URL(message.data.url);

                if(content.location.pathname.includes(postedThreadURL.pathname)){
                    content.location.reload();
                }
                break;

            case 'chaika-abone-add':
                this.emitEvent(message.name, message.data.type, message.data.data);
                sendAsyncMessage(message.name, message.data);

                let legacyAboneType = ['name', 'mail', 'id', 'word', 'ex'].indexOf(message.data.type);
                if(legacyAboneType === 4) legacyAboneType = 99;

                this.emitEvent('b2raboneadd', legacyAboneType, message.data.data, true);
                break;

            case 'chaika-abone-remove':
                this.emitEvent(message.name, message.data.type, message.data.data);
                sendAsyncMessage(message.name, message.data);
                break;
            case 'chaika-get-selected-text':
                try{
                    let sel = content.getSelection();
                    if(!sel.isCollapsed){
                        sendAsyncMessage(message.name, {isSelected: true, text: sel.toString()});
                    }else{
                        sendAsyncMessage(message.name, {isSelected: false, text: ''});
                    }
                }catch(ex){
                    this.logmsg(ex);
                    sendAsyncMessage(message.name, {isSelected: false, text: ''});
                }
                break;
        }
    },


    /**
     * browserMenu.xml のメソッドを実行し、その結果を同期的に返す
     * @param {String} name メソッド名
     * @param {Any} args メソッドに渡す引数
     */
    executeBrowserMenuCommand: function(name, ...args){
        return sendSyncMessage('chaika-browser-menu-command', {
            name: name,
            args: args
        })[0];
    },


    /**
     * content 領域にイベントを発生させる
     * @param {String} aEventName イベント名
     * @param {String} aSubject 送るデータのタイトル event.sourceEvent.type で参照できる
     * @param {String} aData 送るデータ event.sourceEvent.detail で参照できる
     * @param {Boolean} [isLegacyEvent=false] レガシータイプのイベントを作成するか？
     */
    emitEvent: function(aEventName, aSubject, aData, isLegacyEvent){
        let win = content;
        let doc = content.document;

        if(!isLegacyEvent){
            let sourceEvent = doc.createEvent('CustomEvent');
            sourceEvent.initCustomEvent(aSubject, false, false, aData);

            let event = doc.createEvent('XULCommandEvents');
            event.initCommandEvent(aEventName, true, false, win, null,
                                   false, false, false, false, sourceEvent);

            doc.dispatchEvent(event);
        }else{
            let sourceEvent = doc.createEvent('Events');
            sourceEvent.initEvent(aData, false, false);

            let event = doc.createEvent('XULCommandEvents');
            event.initCommandEvent(aEventName, true, false, win, aSubject,
                                   false, false, false, false, sourceEvent);

            doc.dispatchEvent(event);
        }
    }

};


ThreadAgent.init();
