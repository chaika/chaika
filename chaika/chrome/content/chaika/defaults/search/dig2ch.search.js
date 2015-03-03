/* See license.txt for terms of usage */

Components.utils.import("resource://gre/modules/Promise.jsm");

var Dig2ch = {

    id: '00.dig.2ch.net',

    name: '2ch検索 (dig.2ch.net)',

    version: '2.0.0',

    charset: 'utf-8',

    url: 'http://dig.2ch.net/?keywords=%%TERM%%',

    search: function(term){
        this._defer = Promise.defer();

        let TERM = encodeURIComponent(term);

        const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
        this._req = XMLHttpRequest();
        this._req.addEventListener('error', this._onError.bind(this), false);
        this._req.addEventListener('load', this._onSuccess.bind(this), false);
        this._req.open("GET", 'http://dig.2ch.net/?json=1&keywords=' + TERM, true);
        this._req.overrideMimeType('text/plain; charset=utf-8');
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

        if(!json.result){
            return this._defer.reject('Failed due to server error.', this._req.responseText);
        }

        let boards = [];

        json.result.forEach((thread) => {
            let board = boards.find((board) => board.id === thread.bbs);

            if(!board){
                board = {
                    id: thread.bbs,
                    title: thread.ita,
                    threads: []
                };

                boards.push(board);
            }

            board.threads.push({
                url: thread.url,
                title: thread.subject,
                post: thread.resno,
            });
        });

        this._defer.resolve(boards);
    },

};
