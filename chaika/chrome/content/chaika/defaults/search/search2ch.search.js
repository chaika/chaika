/* See license.txt for terms of usage */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");

try{
    //Firefox 25+
    Components.utils.import("resource://gre/modules/Promise.jsm");
}catch(ex){
    //Firefox 24
    Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js");
}


var Search2ch = {

    id: '00.search.2ch.net',

    name: '2ch検索 (search.2ch.net)',

    version: '1.0.0pre',

    updateURL: '%%ChaikaDefaultsDir%%/search/search2ch.search.js',

    charset: 'utf-8',

    url: 'http://search.2ch.net/search?match=full&q=%%TERM%%',

    search: function(term){
        this._defer = Promise.defer();

        let TERM = encodeURIComponent(term);

        const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
        this._req = XMLHttpRequest();
        this._req.addEventListener('error', this._onError.bind(this), false);
        this._req.addEventListener('load', this._onSuccess.bind(this), false);
        this._req.open("GET", 'http://search.2ch.net/search.json?site=all&match=full&size=30&q=' + TERM, true);
        this._req.overrideMimeType('application/json; charset=utf-8');
        this._req.send(null);

        return this._defer.promise;
    },

    _onError: function(){
        this._defer.reject('HTTP Status: ' + this._req.status);
    },

    _onSuccess: function(){
        if(this._req.status !== 200 || !this._req.responseText){
            return this._defer.reject('Unable to connect. Status:',
                                      this._req.status, 'Response', this._req.responseText);
        }

        let json = JSON.parse(this._req.responseText);

        if(!json.success){
            return this._defer.reject('Failed due to server error.', this._req.responseText);
        }

        let boards = [];

        json.results.forEach(result => {
            let thread = result.source;
            let board = boards.find(board => board.id === thread.board);

            if(!board){
                let boardURI = Services.io.newURI('http://' + thread.server + '.' +
                                                  thread.host + '/' + thread.board + '/', null, null);
                let boardObj = new ChaikaBoard(boardURI);

                board = {
                    id: thread.board,  //news, morningcoffee など
                    title: boardObj.getTitle(),  //ニュース速報, ソフトウェア など
                    threads: []
                };

                boards.push(board);
            }

            board.threads.push({
                url: 'http://' + thread.server + '.' + thread.host + '/test/read.cgi/' +
                        thread.board + '/' + thread.thread_id + '/',
                title: thread.title,
                post: thread.comment_count,
            });
        });

        this._defer.resolve(boards);
    },

}


//Polyfill for Firefox 24
//Copied from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function(predicate) {
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                if (i in list) {
                    value = list[i];
                    if (predicate.call(thisArg, value, i, list)) {
                        return value;
                    }
                }
            }
            return undefined;
        }
    });
}
