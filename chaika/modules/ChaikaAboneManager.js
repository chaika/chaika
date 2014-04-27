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

/** @ignore */
var UniConverter = {

    _unicodeConverter: Cc["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Ci.nsIScriptableUnicodeConverter),

    toSJIS: function uniConverter_toSJIS(aString){
        this._unicodeConverter.charset = "Shift_JIS";
        return this._unicodeConverter.ConvertFromUnicode(aString);
    },

    fromSJIS: function uniConverter_fromSJIS(aString){
        this._unicodeConverter.charset = "Shift_JIS";
        return this._unicodeConverter.ConvertToUnicode(aString);
    }

};


var ChaikaAboneManager = {

    /** あぼーんの種類を表す定数 */

    ABONE_TYPE_NAME : 0,
    ABONE_TYPE_MAIL : 1,
    ABONE_TYPE_ID   : 2,
    ABONE_TYPE_WORD : 3,
    ABONE_TYPE_EX   : 4,


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
     * @param {Number} aResData.baseBe Be基礎番号
     * @param {ChaikaThread} aResData.thread スレッド
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

        //Shift-JISのまま読み込みたいので、readStringではなくreadDataを用いる
        //空白行を除いて読み込む
        this._data = ChaikaCore.io.readData(this._ngFile)
                                  .split('\n')
                                  .filter((line) => !!line);
    },


    _saveNgData: function(){
        ChaikaCore.io.writeData(this._ngFile, this._data.join("\n"), false);
    },


    shouldAbone: function(aResData){
        return this._data.some((ngData) => aResData.contains(ngData));
    },


    getNgData: function(){
        return this._data.map((item) => UniConverter.fromSJIS(item));
    },


    add: function(aWord){
        let sjisWord = UniConverter.toSJIS(aWord);

        //2重登録を防ぐ
        if(this._data.indexOf(sjisWord) !== -1){
            return;
        }

        this._data.push(sjisWord);

        //通知する
        let type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
        type.data = this._ngType;

        Services.obs.notifyObservers(type, "b2r-abone-data-add", aWord);
    },

    remove: function(aWord){
        let sjisWord = UniConverter.toSJIS(aWord);
        let index = this._data.indexOf(sjisWord);

        if(index !== -1){
            this._data.splice(index, 1);

            //通知する
            let type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
            type.data = this._ngType;

            Services.obs.notifyObservers(type, "b2r-abone-data-remove", aWord);
        }
    },

};


// NGEx で正規表現のデータがJSONから抜け落ちるのを防ぐ
RegExp.prototype.toJSON = RegExp.prototype.toString;


/**
 * あぼーんデータ (NGEx)
 */
function NGExAboneData(aNgType, aFileName){
    AboneData.apply(this, arguments);
}

NGExAboneData.prototype = Object.create(AboneData.prototype, {

    _loadNgData: {
        value: function(){
            if(!this._ngFile.exists())
                return this._data = [];

            //Shift-JISのまま読み込みたいので、readStringではなくreadDataを用いる
            //空白行を除いて読み込む
            this._data = ChaikaCore.io.readData(this._ngFile)
                                      .split('\n')
                                      .filter((line) => !!line);

            this._dataObj = this._data.map((item) => JSON.parse(item));
        }
    },


    shouldAbone: {
        value: function(aResData){
            return this._dataObj.some((ngData) => {
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
                return aRule.query.test(target);
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


    add: {
        value: function(aNGData){
            //データの補正
            aNGData.rules.forEach((rule) => {
                if(rule.regexp){
                    rule.query = new RegExp(rule.query, rule.ignoreCase ? 'i' : '');
                }else{
                    if(rule.ignoreCase){
                        rule.query = rule.ruery.toLowerCase();
                    }
                }
            });

            let jsonData = JSON.stringify(aNGData);
            let sjisWord = UniConverter.toSJIS(jsonData);
            let sjisJsonData = JSON.parse(sjisWord);

            //2重登録を防ぐ
            if(this._data.indexOf(sjisWord) !== -1){
                return;
            }

            this._data.push(sjisWord);
            this._dataObj.push(sjisJsonData);

            //通知する
            let type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
            type.data = this._ngType;

            Services.obs.notifyObservers(type, "b2r-abone-data-add", jsonData);
        }
    },

    remove: {
        value: function(aNGData){
            //データの補正
            aNGData.rules.forEach((rule) => {
                if(rule.regexp){
                    rule.query = new RegExp(rule.query, rule.ignoreCase ? 'i' : '');
                }else{
                    if(rule.ignoreCase){
                        rule.query = rule.ruery.toLowerCase();
                    }
                }
            });

            let jsonData = JSON.stringify(aNGData);
            let sjisWord = UniConverter.toSJIS(jsonData);
            let index = this._data.indexOf(sjisWord);

            if(index !== -1){
                this._data.splice(index, 1);
                this._dataObj.splice(index, 1);

                //通知する
                let type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
                type.data = this._ngType;

                Services.obs.notifyObservers(type, "b2r-abone-data-remove", jsonData);
            }
        }
    },

});

NGExAboneData.constructor = NGExAboneData;


