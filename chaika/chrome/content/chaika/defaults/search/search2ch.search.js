Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");

try{
    //Firefox 25+
    Components.utils.import("resource://gre/modules/Promise.jsm");
}catch(ex){
    //Firefox 24
    Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js");
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


var Search2ch = {

    id: 'search.2ch.net',

    name: '2ch検索 (search.2ch.net)',

    charset: 'utf-8',

    url: 'http://search.2ch.net/search?match=full?q=%%TERM%%',

    search: function(term){
        this._defer = Promise.defer();

        let TERM = encodeURIComponent(term);

        this._req = new XMLHttpRequest();
        this._req.addEventListener('error', this._onError, false);
        this._req.addEventListener('load', this._onSuccess, false);
        this._req.open("GET", 'http://search.2ch.net/search.json?site=all&match=full&size=30&q=' + TERM, true);
        this._req.overrideMimeType('application/json; charset=utf-8');
        this._req.send(null);

        return this._defer;
    },

    _onError: function(){
        this._defer.reject('HTTP Status: ' + this._req.status);
    },

    _onSuccess: function(){
        if(this._req.status !== 200 || !this._req.responseText){
            return this._defer.reject('HTTP Status: ' + this._req.status);
        }

        let json = JSON.parse(this._req.responseText);

        if(!json.success){
            return this._defer.reject('Failed duo to an unknown reason.');
        }

        let boards = [];

        json.results.forEach(thread => {
            let board = boards.find(board => board.title === thread.board);

            if(!board){
                board = {
                    title: thread.board,
                    threads: []
                };

                boards.push(board);
            }

            board.threads.push({
                url: 'http://' + thread.server + '.' + thread.host + '/test/read.cgi/' +
                        thread.board + '/' + thread.thread_id + '/',
                title: thread.title
            });
        });

        this._defer.resolve(boards);
    },

}
