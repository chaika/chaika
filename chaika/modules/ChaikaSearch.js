/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is chaika.
 *
 * The Initial Developer of the Original Code is
 * chaika.xrea.jp
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson.moz at gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
     * 検索プラグイン
     */
    plugins: {},


    /** @private **/
    _startup: function(){
        this._loadSearchPlugins();
    },


    /**
     * 検索プラグインを読み込む
     */
    _loadSearchPlugins: function(){
        const pluginExtReg = /\.search\.js$/;

        let pluginFolder = this._getPluginFolder();
        let files = pluginFolder.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);

        while(true){
            let file = files.nextFile;
            if(!file) break;

            if(!file.isDirectory() && pluginExtReg.test(file.leafName)){
                let tmp = {};
                let namespace = this._getPluginNameSpace(file.leafName);

                Services.scriptloader.loadSubScript(Services.io.getURLSpecFromFile(file), tmp, 'UTF-8');

                if(!tmp[namespace]){
                    ChaikaCore.logger.error('Unable to load a search plugin named "' + file.leafName + '" due to spec violation.');
                }else{
                    this.plugins[namespace] = tmp[namespace];
                }
            }
        }

        files.close();
    },


    /**
     * 検索プラグインフォルダを返す
     * なければ作成する
     */
    _getPluginFolder: function(){
        let pluginFolder = ChaikaCore.getDataFolder();
        pluginFolder.appendRelativePath('search');

        //フォルダがまだ存在しない場合には、
        //defaults フォルダからコピーしてくる
        if(!pluginFolder.exists()){
            let origPluginFolder = ChaikaCore.getDefaultsDir();
            origPluginFolder.appendRelativePath('search');

            origPluginFolder.copyTo(ChaikaCore.getDataFolder(), null);
        }

        return pluginFolder;
    },


    /**
     * ファイル名からネームスペース名を得る
     * @param {String} fileName ファイル名
     * @return {String} ネームスペース名
     */
    _getPluginNameSpace: function(fileName){
        //hogehoge.search.js -> Hogehoge
        return fileName[0].toUpperCase() + fileName.match(/^.([^\.]+)/)[0];
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
     * @type {String}
     */
    url: '',

    /**
     * 検索を実行し、その結果を返す
     * 主にサイドバー検索を実行する場合に使用される
     * 通信は非同期で行う必要があるため、
     * Promise を使用する
     * 通信が成功した時にはその結果を resolve で返し、
     * 失敗した場合には reject によりその理由を返す
     * @param {String} term 検索文字列 (エンコード済みでない)
     * @return {Promise} - 成功時: 以下のようなオブジェクトの配列を返す必要がある
     *     [
     *         {
     *             title: '板名',
     *             threads: [
     *                 {
     *                      url: 'スレッドのURL',
     *                      title: 'スレッドタイトル'
     *                 }, ...
     *             ]
     *         }, ...
     *     ]
     *                    - 失敗時: エラーオブジェクトを返す必要がある
     */
    search: function(term){},

};
