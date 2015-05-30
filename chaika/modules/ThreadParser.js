/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["ThreadParser"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


function ThreadParser(thread){
    this._thread = thread;
}

ThreadParser.prototype = {

    parseChunk(chunk) {
        return chunk.split('\n');
    },


    parsePost(text) {
        if(!text) return '';

        let parts = text.split('<>');
        let post = {
            number: 0,
            name: parts[0] || 'BROKEN',
            mail: parts[1],
            date: parts[2],
            id: '',
            be: '',
            basebe: '',
            belink: '',
            ip: '',
            host: '',
            msg: parts[3],

            title: parts[4],
        };

        // Extract a Be link from the date string.
        if(post.date.contains('BE:')){
            let match = post.date.match(/(.+)BE:([^ ]+)/);

            post.date = match[1];
            post.belink = match[2];
        }

        // Extract an IP address string from the date string.
        // \x94\xad \x90\x4d \x8c\xb3 = 発信元
        if(post.date.contains('\x94\xad\x90\x4d\x8c\xb3:')){
            let match = post.date.match(/(.+)\x94\xad\x90\x4d\x8c\xb3:([\d\.]+)/);

            post.date = match[1];
            post.ip = match[2];
        }

        // Extract an Host string from the date string.
        if(post.date.contains('HOST:')){
            let match = post.date.match(/(.+)HOST:([^ ]+)/);

            post.date = match[1];
            post.host = match[2];
        }

        // Extract an writer ID from the date string.
        if(post.date.contains('ID:')){
            let match = post.date.match(/(.+)ID:([^ ]+)/);

            post.date = match[1];
            post.id = match[2];
        }

        // Remove unnecessary spaces from the date string.
        post.date = post.date.trim();


        // Extract a Be ID and Be Base ID from the Be link if available.
        if(post.belink){
            // 2ch Be の不具合により BeID が数値でなくなる場合があるので,
            // 正規表現にマッチしない可能性も考慮する必要がある
            let match = post.belink.match(/^\d+/);

            post.be = match.length ? Number.parseInt(match[match.length-1], 10) : -1;

            // BeIDのリンク処理
            post.belink = "<a href='http://be.2ch.net/test/p.php?i=" + post.be + "'>" +
                            post.belink +
                          '</a>';

            // Be基礎番号を取得
            // refs http://qb5.2ch.net/test/read.cgi/operate/1296265910/569
            // let centesimalBeNumber = Math.floor(resBeID / 100);
            // let deciBeNumber = Math.floor(resBeID / 10);
            // resBeBaseID = ( centesimalBeNumber + deciBeNumber % 10 - resBeID % 10 - 5 ) /
            //                                ( (deciBeNumber % 10) * (resBeID % 10) * 3 );
            //
            // Be 2.0 では基礎番号は廃止されたので、BeID をそのまま用いることにする
            // http://qb5.2ch.net/test/read.cgi/operate/1396689383/50
            post.basebe = post.be;
        }

        return post;
    }
};
