/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["ChaikaSearch"];

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { ChaikaCore } = Cu.import("resource://chaika-modules/ChaikaCore.js", {});


/**
 * chaika のスレッド検索を行うクラス
 */
this.ChaikaSearch = {

    /**
     * 検索プラグインオブジェクトが入る配列
     * @type {Array.<ChaikaSearchPlugin>}
     */
    plugins: [],


    getPlugin: function(id){
        return this.plugins.find(plugin => plugin.id === id);
    },


    /** @private **/
    _startup: function(){
        // Load the third-party plugins first so that they can override the default plugins.
        this._loadPlugins(this._getUserPluginsFolder());
        this._loadPlugins(this._getDefaultPluginsFolder());
    },


    /**
     * 検索プラグインを読み込む
     */
    _loadPlugins: function(pluginFolder){
        const pluginExtReg = /\.search\.js$/;
        let fph = Cc["@mozilla.org/network/protocol;1?name=file"].createInstance(Ci.nsIFileProtocolHandler);
        let files = pluginFolder.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);

        while(true){
            let file = files.nextFile;
            if(!file) break;

            if(!file.isDirectory() && pluginExtReg.test(file.leafName)){
                let url = fph.getURLSpecFromActualFile(file);
                let plugin = this._loadPluginFromURL(url);

                // Migration: remove the old files.
                if(plugin && plugin.updateURL && plugin.updateURL.contains('%%ChaikaDefaultsDir%%')){
                    file.remove(false);
                    continue;
                }

                // Don't load the plugin whose id is already existed.
                if(plugin && !this.getPlugin(plugin.id)){
                    this.plugins.push(plugin);
                }
            }
        }

        this.plugins.sort((a, b) => a.id > b.id);

        files.close();
    },


    /**
     * 指定された URL からプラグインオブジェクトを読み込んで返す
     * @param {String} aURL 読み込むプラグインの URL
     * @returns {ChaikaSearchPlugin}
     */
    _loadPluginFromURL: function(aURL){
        let tmp = {};
        let fileName = aURL.match(/[^\/]+$/)[0];
        let namespace = this._getPluginNameSpace(fileName);

        ChaikaCore.logger.debug('Load search plugin:', aURL, namespace);

        //URL の末尾にランダムな数値をつけることで、
        //キャッシュされたファイルが返るのを防ぐ
        Services.scriptloader.loadSubScript(aURL + '?' + Math.random(), tmp, 'UTF-8');

        if(!tmp[namespace]){
            ChaikaCore.logger.error('Unable to load a search plugin named "' + fileName + '" due to spec violation.');
            return null;
        }

        return tmp[namespace];
    },


    /**
     * 組み込みの検索プラグインフォルダを返す
     * @return {nsFile}
     */
    _getDefaultPluginsFolder: function(){
        let folder = ChaikaCore.getDefaultsDir();
        folder.appendRelativePath('search');

        return folder;
    },


    /**
     * サードパーティ検索プラグインフォルダを返す
     * なければ作成する
     * @return {nsFile}
     */
    _getUserPluginsFolder: function(){
        let folder = ChaikaCore.getDataDir();
        folder.appendRelativePath('search');

        if(!folder.exists()){
            folder.create(Ci.nsIFile.DIRECTORY_TYPE, Number.parseInt('0755', 8));
        }

        return folder;
    },


    /**
     * ファイル名からネームスペース名を得る
     * @param {String} fileName ファイル名
     * @return {String} ネームスペース名
     * @example _getPluginNameSpace('foo.search.js') // -> Foo
     */
    _getPluginNameSpace: function(fileName){
        return fileName[0].toUpperCase() + fileName.split('.')[0].substring(1);
    },

};


/**
 * 検索プラグイン抽象クラス
 * すべての検索プラグインはこの抽象クラスを継承する必要がある
 * 具体的な実装例は search2ch.search.js も参照のこと
 * @abstract
 */
var ChaikaSearchPlugin = {

    /**
     * ID
     * chaika 全体の中で一意である必要がある
     * @type {String}
     */
    id: null,

    /**
     * プラグイン名
     * 実際にメニュー等に表示される際の検索サービスの名称
     * @type {String}
     */
    name: null,

    /**
     * 文字コード名
     * ページのエンコーディングではなく、
     * 検索文字列をエンコードする際の文字列を指定する
     * @type {String}
     */
    charset: 'utf-8',

    /**
     * 検索先URL
     * 主に検索結果のページを直接ブラウザで表示する場合に使用される
     * %%TERM%% がエンコード済み検索文字列に置き換えられる
     *   (エンコードは上記 charset プロパティに依る)
     *
     * URL を開く必要がない場合, null を指定する (例: boardFilter.search.js)
     *
     * @type {?String}
     */
    url: null,

    /**
     * 検索を実行し、その結果を返す
     * 主にサイドバー検索を実行する場合に使用される
     * 通信は非同期で行う必要があるため、
     * Promise を使用する
     * 通信が成功した時にはその結果を resolve で返し、
     * 失敗した場合には reject によりその理由を返す
     *
     * 検索結果を取得する用途がない場合、null を指定する
     *
     * @param {String} query 検索文字列 (URIEncode はされていないが, '<' などは ChaikaIO#escapeHTML により実体参照化されている)
     * @return {Promise} - 成功時: 以下のようなオブジェクトの配列を返す必要がある
     *     [
     *         {
     *             title: '板名', //@type {String}, @required
     *             threads: [
     *                 {
     *                      url: 'スレッドのURL', //@type {String}, @required
     *                      title: 'スレッドタイトル', //@type {String}, @required
     *                      post: レス数, //@type {Number}, @optional
     *                 }, ...
     *             ]
     *         }, ...
     *     ]
     *                    - 失敗時: エラーオブジェクトを返す必要がある
     */
    search: function(query){},

};
