/* See license.txt for terms of usage */

var Dig2ch = {

    id: '00.dig.2ch.net',

    name: '2ch検索 (dig.2ch.net)',

    version: '1.0.0pre',

    updateURL: '%%ChaikaDefaultsDir%%/search/dig2ch.search.js',

    charset: 'utf-8',

    url: 'http://dig.2ch.net/?keywords=%%TERM%%',

    // json で結果を取得することは可能だが,
    // 利用するためには <script> タグを含む広告を表示しなければならない.
    // 現在の検索結果表示方法 (tree 要素を使って表示する) では
    // そのような広告は表示できないため, サイドバー検索の実装は保留とする.
    search: null

};
