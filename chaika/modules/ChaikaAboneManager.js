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


EXPORTED_SYMBOLS = ["ChaikaAboneManager"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://chaika-modules/ChaikaCore.js");

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


var ChaikaAboneManager = {

    /** あぼーんの種類を表す定数 */

    ABONE_TYPE_NAME : 'name',
    ABONE_TYPE_MAIL : 'mail',
    ABONE_TYPE_ID   : 'id',
    ABONE_TYPE_WORD : 'word',
    ABONE_TYPE_EX   : 'ex',


    /**
     * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
     * @private
     */
    _startup: function ChaikaAboneManager__startup(){
        this.name = new AboneData(this.ABONE_TYPE_NAME, 'NGnames.txt');
        this.mail = new AboneData(this.ABONE_TYPE_MAIL, 'NGaddrs.txt');
        this.id = new AboneData(this.ABONE_TYPE_ID, 'NGid.txt');
        this.word = new AboneData(this.ABONE_TYPE_WORD, 'NGwords.txt');
        this.ex = new NGExAboneData(this.ABONE_TYPE_EX, 'NGEx.txt');
    },


    /**
     * ブラウザ終了時に一度だけ実行され、終了処理を行う。
     * @private
     */
    _quit: function ChaikaAboneManager__quit(){
        this.name.uninit();
        this.mail.uninit();
        this.id.uninit();
        this.word.uninit();
        this.ex.uninit();
    },


    /**
     * あぼーんするべきかどうかを調べる
     * @param {Object} aResData レスのデータ
     * @param {String} aResData.name 名前
     * @param {String} aResData.mail メール
     * @param {String} aResData.id ID
     * @param {String} aResData.msg 本文
     * @param {String} aResData.date 書き込み日時
     * @param {String} aResData.ip IPアドレス
     * @param {String} aResData.host ホスト
     * @param {String} aResData.be BeID
     * @param {String} aResData.baseBe Be基礎番号
     * @param {String} aResData.title スレッドタイトル
     * @param {String} aResData.thread_url スレッドURL
     * @param {String} aResData.board_url 板URL
     * @return {Boolean}
     */
    shouldAbone: function ChaikaAboneManager_shouldAbone(aResData){
        return this.name.shouldAbone(aResData.name) ||
               this.mail.shouldAbone(aResData.mail) ||
               this.id.shouldAbone(aResData.id) ||
               this.word.shouldAbone(aResData.msg) ||
               this.ex.shouldAbone(aResData);
    },

};



/**
 * あぼーんデータ
 */
function AboneData(aNgType, aFileName){
    this._init(aNgType, aFileName);
}

AboneData.prototype = {

    _init: function(aNgType, aFileName){
        this._ngType = aNgType;

        this._ngFile = ChaikaCore.getDataDir();
        this._ngFile.appendRelativePath(aFileName);

        this._loadNgData();
    },


    uninit: function(){
        this._saveNgData();
    },


    _loadNgData: function(){
        if(!this._ngFile.exists())
            return this._data = [];

        //空白行を除いて読み込む
        this._data = ChaikaCore.io.readString(this._ngFile);

        //U+FFFD (REPLACEMENT CHARACTER) が含まれる場合には
        //Shift-JISで保存されている旧式のファイルであるということなので
        //Shift-JIS で再読込する
        if(this._data.contains("\uFFFD")){
            ChaikaCore.logger.warning("The encoding of " + this._ngFile.leafName +
                                      " is Shift-JIS. Try to convert to UTF-8.");

            this._data = ChaikaCore.io.readString(this._ngFile, 'Shift-JIS');

            //読み込みに成功していればUTF-8で保存し直す
            if(!this._data.contains("\uFFFD")){
                ChaikaCore.io.writeString(this._ngFile, 'UTF-8', false, this._data);
            }else{
                ChaikaCore.logger.error('Fail in converting the encoding of ' + this._ngFile.leafName);
            }
        }

        this._data = this._data.split('\n')
                               .filter((line) => !!line);
    },


    _saveNgData: function(){
        ChaikaCore.io.writeString(this._ngFile, 'UTF-8', false, this._data.join("\n"));
    },


    shouldAbone: function(aResData){
        return this._data.find((ngData) => aResData.contains(ngData));
    },


    getNgData: function(){
        return this._data;
    },


    add: function(aWord){
        //2重登録を防ぐ
        if(this._data.indexOf(aWord) !== -1){
            return;
        }

        this._data.push(aWord);

        //通知する
        let type = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        type.data = this._ngType;

        Services.obs.notifyObservers(type, "b2r-abone-data-add", aWord);
    },

    remove: function(aWord){
        let index = this._data.indexOf(aWord);

        if(index !== -1){
            this._data.splice(index, 1);

            //通知する
            let type = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            type.data = this._ngType;

            Services.obs.notifyObservers(type, "b2r-abone-data-remove", aWord);
        }
    },

};


/**
 * あぼーんデータ (NGEx)
 */
function NGExAboneData(aNgType, aFileName){
    AboneData.apply(this, arguments);
}

NGExAboneData.prototype = Object.create(AboneData.prototype, {

    _loadNgData: {
        value: function(){
            AboneData.prototype._loadNgData.apply(this, arguments);

            //有効期限切れのものを削除する
            this._dataObj = this._data.map((item) => JSON.parse(item))
                                      .filter((item) => item.expire ? item.expire > Date.now() : true);

            this._data = this._dataObj.map((item) => JSON.stringify(item));
        }
    },


    shouldAbone: {
        value: function(aResData){
            return this._dataObj.find((ngData) => {
                if(ngData.match === 'all')
                    return ngData.rules.every((rule) => this._matchRule(rule, aResData));

                else if(ngData.match === 'any')
                    return ngData.rules.some((rule) => this._matchRule(rule, aResData));
            });
        }
    },


    _matchRule: {
        value: function(aRule, aResData){
            let target = aResData[aRule.target];

            if(aRule.regexp){
                let regexp = new RegExp(aRule.query, aRule.ignoreCase ? 'i' : '');
                return regexp.test(target);
            }else{
                if(aRule.ignoreCase){
                    target = target.toLowerCase();
                }

                switch(aRule.condition){
                    case 'contains':
                        return target.contains(aRule.query);

                    case 'notContain':
                        return !target.contains(aRule.query);

                    case 'equals':
                        return target === aRule.query;

                    case 'notEqual':
                        return target !== aRule.query;

                    case 'startsWith':
                        return target.startsWith(aRule.query);

                    case 'endsWith':
                        return target.endsWith(aRule.query);

                    default:
                        return false;
                }
            }
        }
    },


    /**
     * 指定したデータを追加する
     * @param {NGExData} aNGData
     */
    add: {
        value: function(aNGData){
            //データの補正
            aNGData.rules.forEach((rule) => {
                if(!rule.regexp && rule.ignoreCase){
                    rule.query = rule.query.toLowerCase();
                }
            });

            let jsonData = JSON.stringify(aNGData);

            //2重登録を防ぐ
            if(this._data.indexOf(jsonData) !== -1){
                return;
            }

            this._data.push(jsonData);
            this._dataObj.push(aNGData);

            //通知する
            let type = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            type.data = this._ngType;

            Services.obs.notifyObservers(type, "b2r-abone-data-add", jsonData);
        }
    },


    /**
     * 指定したデータを削除する
     * @param {String} aNGData 削除するデータ (JSON)
     */
    remove: {
        value: function(aNGData){
            let index = this._data.indexOf(aNGData);

            if(index !== -1){
                this._data.splice(index, 1);
                this._dataObj.splice(index, 1);

                //通知する
                let type = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                type.data = this._ngType;

                Services.obs.notifyObservers(type, "b2r-abone-data-remove", aNGData);
            }
        }
    },

});

NGExAboneData.constructor = NGExAboneData;


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