/* See license.txt for terms of usage */

'use strict';

let EXPORTED_SYMBOL = "Dig2ch";

let Dig2ch = {

    charset: 'utf-8',

    url: 'http://dig.2ch.net/?keywords=%%TERM%%',

    search: function(query){
        return new Promise((resolve, reject) => {
            const url = 'http://dig.2ch.net/?json=1&keywords=' + encodeURIComponent(query);
            let req = new XMLHttpRequest();

            req.addEventListener('error', reject, false);
            req.addEventListener('load', () => {
                if(req.status !== 200 || !req.responseText){
                    reject('Unable to connect. (status: ' + req.status + ')');
                    return;
                }

                let json = JSON.parse(req.responseText);

                if(!json.result){
                    reject('Server error.');
                    return;
                }

                if(!json.result.length){
                    reject('No results found.');
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

                resolve(boards);
            }, false);

            req.open("GET", url, true);
            req.overrideMimeType('text/plain; charset=utf-8');
            req.send(null);
        });
    },

};
