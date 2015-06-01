/* See license.txt for terms of usage */

'use strict';

let EXPORTED_SYMBOL = 'Refind2ch';

let Refind2ch = {

    charset: 'utf-8',

    url: 'http://refind2ch.org/search?q=%%TERM%%',

    search: function(query){
        return new Promise((resolve, reject) => {
            const url = 'http://refind2ch.org/search?q=' + encodeURIComponent(query);
            let req = new XMLHttpRequest();

            req.addEventListener('error', reject, false);
            req.addEventListener('load', () => {
                // 404 means "No results found."
                // http://refind2ch.org/about#to_developer
                if(req.status === 404){
                    reject('No results found.');
                    return;
                }

                if(req.status !== 200 || !req.response){
                    reject('Unable to connect or parse the response. (status: ' + req.status + ')');
                    return;
                }

                let doc = req.response;
                let results = doc.querySelectorAll('#search_results > .thread_url');
                let boards = [];

                Array.from(results).forEach((thread) => {
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

                resolve(boards);
            }, false);

            req.open("GET", url, true);
            req.setRequestHeader('User-Agent', CHAIKA_USER_AGENT);
            req.responseType = 'document';
            req.send(null);
        });
    },

};
