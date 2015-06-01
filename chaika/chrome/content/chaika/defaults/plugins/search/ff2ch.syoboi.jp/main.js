/* See license.txt for terms of usage */

'use strict';

let EXPORTED_SYMBOL = 'Ff2ch';

let Ff2ch = {

    charset: 'utf-8',

    url: 'http://ff2ch.syoboi.jp/?q=%%TERM%%',

    search: function(query){
        return new Promise((resolve, reject) => {
            const url = 'http://ff2ch.syoboi.jp/?alt=rss&q=' + encodeURIComponent(query);
            let req = new XMLHttpRequest();

            req.addEventListener('error', reject, false);
            req.addEventListener('load', () => {
                if(req.status !== 200 || !req.responseText){
                    reject('Unable to connect. (status: ' + this._req.status + ')');
                    return;
                }

                if(!req.responseXML){
                    reject('Response is not XML: ' + req.responseText);
                    return;
                }


                let doc = req.responseXML;
                let boards = [];

                let threads = doc.getElementsByTagName('item');

                Array.from(threads).forEach(thread => {
                    let threadTitle = thread.querySelector('title').textContent.replace(/\s*\((\d+)\)$/, '');
                    let threadPosts = RegExp.$1;
                    let threadURL = thread.querySelector('guid').textContent.replace(/\d+-\d+$/, '');
                    let boardTitle = thread.querySelector('category').textContent;

                    let board = boards.find(board => board.title === boardTitle);

                    if(!board){
                        board = {
                            title: boardTitle,
                            threads: []
                        };

                        boards.push(board);
                    }

                    board.threads.push({
                        url: threadURL,
                        title: threadTitle,
                        post: threadPosts,
                    });
                });

                resolve(boards);
            }, false);

            req.open("GET", url, true);
            req.overrideMimeType('application/rss+xml; charset=utf-8');
            req.send(null);
        });
    }

};
