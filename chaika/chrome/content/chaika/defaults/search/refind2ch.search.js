/* See license.txt for terms of usage */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import("resource://chaika-modules/ChaikaCore.js");
Cu.import("resource://gre/modules/Promise.jsm");

var Refind2ch = {

    id: '02.refind2ch.org',

    name: 'スレッド検索 (refind2ch.org)',

    version: '1.0.0',

    charset: 'utf-8',

    url: 'http://refind2ch.org/search?q=%%TERM%%',

    search: function(term){
        this._defer = Promise.defer();

        let TERM = encodeURIComponent(term);

        const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
        this._req = XMLHttpRequest();
        this._req.addEventListener('error', this._onError.bind(this), false);
        this._req.addEventListener('load', this._onSuccess.bind(this), false);
        this._req.open("GET", 'http://refind2ch.org/search?q=' + TERM, true);
        this._req.setRequestHeader('User-Agent', ChaikaCore.getUserAgent());
        this._req.overrideMimeType('text/html; charset=utf-8');
        this._req.send(null);

        return this._defer.promise;
    },

    _onError: function(){
        this._defer.reject('HTTP Status: ' + this._req.status);
    },

    _onSuccess: function(){
        // 404 means "No results found."
        // http://refind2ch.org/about#to_developer
        if(this._req.status === 404){
            return this._defer.reject('No results found.');
        }

        if(this._req.status !== 200 || !this._req.responseText){
            return this._defer.reject('Unable to connect or parse the response. Status:' + this._req.status);
        }

        let parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
        let doc = parser.parseFromString("<root xmlns:html='http://www.w3.org/1999/xhtml'/>", "text/xml");
        let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        let fragment = parserUtils.parseFragment(this._req.responseText, 0, false, null, doc.documentElement);

        doc.documentElement.appendChild(fragment);


        let results = doc.querySelectorAll('#search_results > .thread_url');
        let boards = [];

        Array.slice(results).forEach((thread) => {
            let thread_title = thread.querySelector('.thread_title').textContent;
            let thread_url = thread.getAttribute('href');
            let thread_posts = Number.parseInt(thread.querySelector('.res_num').textContent);
            let board_title = thread.querySelector('.board_title').textContent;

            let board = boards.find((board) => board.title === board_title);

            if(!board){
                board = {
                    title: board_title,
                    threads: []
                };

                boards.push(board);
            }

            board.threads.push({
                url: thread_url,
                title: thread_title,
                post: thread_posts,
            });
        });

        this._defer.resolve(boards);
    },

};
