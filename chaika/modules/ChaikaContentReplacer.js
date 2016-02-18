/* See license.txt for terms of usage */

this.EXPORTED_SYMBOLS = ["ChaikaContentReplacer"];

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


/**
 * ユーザーによるスレタイ・レスなどの置換を扱う
 */
this.ChaikaContentReplacer = {

    /**
     * 置換ルール
     * @type {Array.<ReplaceData>}
     */
    _rules: [],


    /**
     * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
     * @private
     */
    _startup: function(){
        this._uc = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
        this._uc.charset = "Shift_JIS";

        this._loadData();
    },


    /**
     * ブラウザ終了時に一度だけ実行され、終了処理を行う。
     * @private
     */
    _quit: function(){
        this._saveData();
    },


    _loadData: function(){
        this._file = ChaikaCore.getDataDir();
        this._file.appendRelativePath('Replace.txt');

        if(!this._file.exists()){
            this._rules = [];
            return;
        }

        this._rules = ChaikaCore.io.readString(this._file).split('\n').filter((item) => !!item);

        this._rules = this._rules.map((json) => {
            try{
                return JSON.parse(json);
            }catch(ex){
                ChaikaCore.logger.error('Invalid JSON:', json, '\n' + ex);
                return null;
            }
        }).filter((item) => !!item);
    },


    _saveData: function(){
        if(this._rules){
            ChaikaCore.io.writeString(this._file, 'UTF-8', false,
                                      this._rules.map((rule) => JSON.stringify(rule)).join("\n"));
        }
    },


    getRules: function(){
        return this._rules;
    },


    /**
     * ユーザー定義の置換を行う
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
     * @param {Boolean} aResData.isThreadList スレッド一覧での置換なら真
     * @param {Boolean} aResData.isSubjectTxt suject.txtでの置換なら真
     * @return {Object|null} 置換された時にはそのレスデータが返る ヒットしなかった場合には null が返る
     */
    replace: function(aResData){
        let replaced = false;

        this._rules.forEach((rule) => {
            // ルールが置換する対象のデータがそもそもなければ
            // 条件に一致するかどうかを調べる必要はないのでまずはそれを調べる

            let target = rule.target;

            // スレタイ置換へのターゲット名の調整
            if((target === 'thread_title_on_list' && aResData.isThreadList) ||
               (target === 'thread_title_subjecttxt' && aResData.isSubjectTxt)){
                target = 'title';
            }

            if(typeof aResData[target] !== 'string') return;


            let matched = false;

            if(rule.match === 'all'){
                matched = rule.rules.every((rule) => this._matchRule(rule, aResData));
            }else{
                matched = rule.rules.some((rule) => this._matchRule(rule, aResData));
            }

            if(matched){
                // フラグの調整
                let replaceFlag = '';

                if(rule.ignoreCase) replaceFlag += 'i';
                if(rule.global) replaceFlag += 'g';


                // もともと置換対象に含まれている $ が特殊文字に変換されないようにする
                aResData[target] = aResData[target].replace(/\$/g, '&#36;');


                // 置換
                let pattern = rule.searchText;

                if(!rule.regexp){
                    pattern = pattern.replace(/[.*+?|^$(){}[\]\\]/g, '\\$&');
                }

                let regexp = new RegExp(pattern, replaceFlag);

                aResData[target] = aResData[target].replace(regexp, rule.replaceText);

                replaced = true;
            }
        });

        return replaced ? aResData : null;
    },


    /**
     * レスデータがルールに合致しているかどうか調べる
     * NGEx と同じシステムなためあちらに処理を移譲する
     */
    _matchRule: function(rule, resData){
        return ChaikaAboneManager.ex._matchRule.call(this, rule, resData);
    },


    /**
     * 指定したデータを追加する
     * @param {ReplaceData} aReplaceData
     */
    add: function(aReplaceData){
        //データの補正
        aReplaceData.rules.forEach((rule) => {
            if(!rule.regexp && rule.ignoreCase){
                rule.query = rule.query.toLowerCase();
            }
        });

        this._rules.push(aReplaceData);
        Services.obs.notifyObservers(null, "chaika-replace-rule-add", JSON.stringify(aReplaceData));
    },


    /**
     * 指定したデータを削除する
     * @param {ReplaceData} aReplaceData 削除するデータ
     */
    remove: function(aReplaceData){
        let jsonReplaceData = JSON.stringify(aReplaceData);
        let index = this._rules.map((rule) => JSON.stringify(rule)).indexOf(jsonReplaceData);

        if(index !== -1){
            this._rules.splice(index, 1);
            Services.obs.notifyObservers(null, "chaika-replace-rule-remove", jsonReplaceData);
        }
    },


    /**
     * 指定したデータを変更する
     * @param {ReplaceData} oldData 変更するデータ
     * @param {ReplaceData} newData 変更後のデータ
     */
    change: function(oldData, newData){
        //データの補正
        newData.rules.forEach((rule) => {
            if(!rule.regexp && rule.ignoreCase){
                rule.query = rule.query.toLowerCase();
            }
        });

        let jsonOldData = JSON.stringify(oldData);
        let jsonNewData = JSON.stringify(newData);
        let index = this._rules.map((rule) => JSON.stringify(rule)).indexOf(jsonOldData);

        if(index === -1){
            return;
        }


        this._rules[index] = newData;

        Services.obs.notifyObservers(null, "chaika-replace-rule-remove", jsonOldData);
        Services.obs.notifyObservers(null, "chaika-replace-rule-add", jsonNewData);
    }

};
