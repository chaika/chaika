/* See license.txt for terms of usage */

var Dig2ch = {

    id: '00.dig.2ch.net',

    name: '2ch検索 (dig.2ch.net)',

    version: '2.0.0',

    charset: 'utf-8',

    url: 'http://dig.2ch.net/?keywords=%%TERM%%',

    search: function(query){
        return new Promise((resolve, reject) => {
            const url = 'http://dig.2ch.net/?json=1&keywords=' + encodeURIComponent(query);
            const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
            let req = XMLHttpRequest();

            req.addEventListener('error', reject, false);
            req.addEventListener('load', () => {
                if(req.status !== 200 || !req.responseText){
                    reject('Unable to connect. (status: ' + this._req.status + ')');
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
