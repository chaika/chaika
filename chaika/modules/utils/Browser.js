/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ['Browser'];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import('resource://gre/modules/Services.jsm', {});


this.Browser = {

    init() {
        let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
                    .getService(Ci.nsIProcessScriptLoader);
        ppmm.addMessageListener('chaika-open-chrome-window', this._openWindowFromContent);
    },


    uninit() {
        let ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"]
                    .getService(Ci.nsIProcessScriptLoader);
        ppmm.removeMessageListener('chaika-open-chrome-window', this._openWindowFromContent);
    },


    getGlobalMessageManager() {
        if(this._mm) return this._mm;

        return this._mm = Cc['@mozilla.org/globalmessagemanager;1']
                            .getService(Ci.nsIFrameScriptLoader);
    },


    /**
     * Returns nsIWindow object that has a specified type.
     * @param {String} [type="navigator:browser"] aType  Window type to get.
     * @return {nsIDOMWindow}
     */
    getWindow(aType = 'navigator:browser') {
        return Services.wm.getMostRecentWindow(aType);
    },


    /**
     * Opening a specified URI in the current window.
     * @param  {String|nsIURI} aURI      URL to open.
     * @param  {Boolean} inNewTab        Whether open the URL in a new tab or not.
     * @param  {Boolean} openAsTreeChild Whether open the URL as a child tab of the current tab.
     * @return {Tab} The opened tab element.
     */
    open(aURI, inNewTab, openAsTreeChild) {
        let url = aURI.spec || aURI;
        let browser = this.getWindow().getBrowser();

        if(!browser){
            Services.console.logStringMessage('Cannot find a browser window.');
            return;
        }

        if(!inNewTab){
            browser.loadURI(url);
        }else{
            if(openAsTreeChild && 'TreeStyleTabService' in browser){
                browser.TreeStyleTabService.readyToOpenChildTab(browser.selectedTab);
            }

            browser.loadOneTab(url, {
                relatedToCurrent: openAsTreeChild
            });
        }
    },


    /**
     * Opening a specified URI in a new window.
     * @param {String} aURL URL to open.
     * @param {String} [aType] `windowtype` to focus the existing window and not to open a new one.
     * @param {Any} [args] Arguments to pass to the window.
     * @return {nsIWindow} The opened window.
     */
    openWindow(aURL, aType, ...args) {
        if(aType){
            let win = this.getWindow(aType);

            if(win){
                win.focus();
                return win;
            }
        }else{
            let params = 'chrome, toolbar, centerscreen, resizable, minimizable';

            return this.getWindow().openDialog(aURL, '_blank', params, ...args);
        }
    },


    _openWindowFromContent(message) {
        return Browser.openWindow(message.data.url, null, ...message.data.args);
    }

};


Browser.init();
