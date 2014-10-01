/* See license.txt for terms of usage */

EXPORTED_SYMBOLS = ["ChaikaSearch"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

/**
 * chaika のスレッド検索を行うクラス
 */
var ChaikaSearch = {

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
        this._loadPlugins();
        this._updatePlugins();
    },


    /**
     * プラグインのアップデート処理を行う
     */
    _updatePlugins: function(){
        let fph = Cc["@mozilla.org/network/protocol;1?name=file"].createInstance(Ci.nsIFileProtocolHandler);
        let pluginFolder = this._getPluginFolder();
        let hasUpdate = false;

        this.plugins.forEach(plugin => {
            if(!plugin.version || !plugin.updateURL) return;

            let updateURL = plugin.updateURL;

            if(updateURL.contains('%%ChaikaDefaultsDir%%')){
                let defaultsDir = ChaikaCore.getDefaultsDir();
                let defaultsDirSpec = fph.getURLSpecFromActualFile(defaultsDir);

                updateURL = updateURL.replace('%%ChaikaDefaultsDir%%', defaultsDirSpec);
            }

            let remotePlugin = this._loadPluginFromURL(updateURL);

            if(Services.vc.compare(plugin.version, remotePlugin.version) < 0){
                ChaikaCore.logger.debug(plugin.name, 'needs to be updated.',
                                        'old:', plugin.version, 'new:', remotePlugin.version);

                //いまのところ file:// スキーム以外は未対応
                if(!updateURL.startsWith('file://')) return;

                let fileName = updateURL.match(/[^\/]+$/)[0];
                let oldFile = pluginFolder.clone();
                let newFile = fph.getFileFromURLSpec(updateURL);

                oldFile.appendRelativePath(fileName);
                oldFile.remove(false);
                newFile.copyTo(oldFile.parent, null);

                ChaikaCore.logger.debug('Successfully updated.');
                hasUpdate = true;
            }
        });

        if(hasUpdate){
            ChaikaCore.logger.debug('All search plugins are now up-to-date. Reload the plugins...');
            this._loadPlugins();
        }
    },


    /**
     * 検索プラグインを読み込む
     */
    _loadPlugins: function(){
        const pluginExtReg = /\.search\.js$/;
        let fph = Cc["@mozilla.org/network/protocol;1?name=file"].createInstance(Ci.nsIFileProtocolHandler);

        let pluginFolder = this._getPluginFolder();
        let files = pluginFolder.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);

        this.plugins.length = 0;

        while(true){
            let file = files.nextFile;
            if(!file) break;

            if(!file.isDirectory() && pluginExtReg.test(file.leafName)){
                let url = fph.getURLSpecFromActualFile(file);
                let plugin = this._loadPluginFromURL(url);

                if(plugin){
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
     * 検索プラグインフォルダを返す
     * なければ作成する
     * @return {nsFile}
     */
    _getPluginFolder: function(){
        let pluginFolder = ChaikaCore.getDataDir();
        pluginFolder.appendRelativePath('search');

        //フォルダがまだ存在しない場合には、
        //defaults フォルダからコピーしてくる
        if(!pluginFolder.exists()){
            let origPluginFolder = ChaikaCore.getDefaultsDir();
            origPluginFolder.appendRelativePath('search');

            origPluginFolder.copyTo(ChaikaCore.getDataDir(), null);
        }

        return pluginFolder;
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
     * @param {String} term 検索文字列 (エンコード済みでない)
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
    search: function(term){},

};


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
