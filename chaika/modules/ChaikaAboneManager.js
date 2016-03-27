/* See license.txt for terms of usage */


this.EXPORTED_SYMBOLS = ["ChaikaAboneManager"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import('resource://chaika-modules/utils/Browser.js');

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


this.ChaikaAboneManager = {

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
     * @param {Boolean} aResData.isThread スレッドあぼーんの処理なら真
     * @return {NGData} ヒットしたNGデータが返る. ヒットしない場合は undefined が返る.
     */
    shouldAbone: function ChaikaAboneManager_shouldAbone(aResData){
        return !aResData.isThread && this.name.shouldAbone(aResData.name) ||
               !aResData.isThread && this.mail.shouldAbone(aResData.mail) ||
               !aResData.isThread && this.id.shouldAbone(aResData.id) ||
               !aResData.isThread && this.word.shouldAbone(aResData.msg) ||
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
        if(!this._ngFile.exists()){
            this._data = [];
            return;
        }

        this._data = ChaikaCore.io.readUnknownEncodingString(this._ngFile, true, 'utf-8', 'Shift_JIS');

        if(this._data === null){
            ChaikaCore.logger.error('Fail in converting the encoding of ' + this._ngFile.leafName);
            this._data = "";
            this._encodingError = true;
        }

        this._data = this._data.split('\n')
                               .filter((line) => !!line); //空白行を取り除く
    },


    _saveNgData: function(){
        if(this._data && !this._encodingError){
            ChaikaCore.io.writeString(this._ngFile, 'UTF-8', false, this._data.join("\n"));
        }
    },


    /**
     * NGワードに該当するレスかどうかを返す
     * @param {ResData} aResData
     * @see ChaikaAboneManager.shouldAbone
     */
    shouldAbone: function(aResData){
        return aResData && this._data.find((ngData) => aResData.includes(ngData));
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
        Browser.getGlobalMessageManager().broadcastAsyncMessage(
            'chaika-abone-add', {
                type: this._ngType,
                data: aWord
            }
        );
    },

    remove: function(aWord){
        let index = this._data.indexOf(aWord);

        if(index !== -1){
            this._data.splice(index, 1);

            //通知する
            Browser.getGlobalMessageManager().broadcastAsyncMessage(
                'chaika-abone-remove', {
                    type: this._ngType,
                    data: aWord
                }
            );
        }
    },

};



/**
 * NGEx のあぼーんデータを表す.
 */
var NGExData = {
    /**
     * タイトル
     * @type {String}
     * @required
     */
    title: '',

    /**
     * あぼーんの対象
     * @type {String}
     * @note 'post' (レス), 'thread' (スレッド) のみが可
     * @required
     */
    target: 'post',

    /**
     * マッチの方法
     * @type {String}
     * @note 'any' (いづれか), 'all' (全て) のみが可
     * @required
     */
    match: 'all',

    /**
     * 連鎖あぼーんをするかどうか
     * @type {Boolean|undefined}
     * @note true: する, false: しない, undefined: デフォルトの設定に従う
     */
    chain: undefined,

    /**
     * 透明あぼーんをするかどうか
     * @type {Boolean|undefined}
     * @note true: する, false: しない, undefined: デフォルトの設定に従う
     */
    hide: undefined,

    /**
     * 有効期限
     * @type {Number|undefined}
     * @note UNIX時間を設定する. undefined の場合は期限なしを表す.
     */
    expire: undefined,

    /**
     * 自動NGIDをするかどうか
     * @type {Boolean}
     * @note true: する, false: しない
     */
    autoNGID: false,

    /**
     * あぼーんせずにハイライトするかどうか
     * @type {Boolean}
     * @note true: する, false: しない
     */
    highlight: false,


    /**
     * マッチする条件
     * @type {Array.<Group, Rule>}
     * @see getRuleData in chrome://chaika/content/settings/rule-editor.xml#editor
     */
    rules: [],
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

            this._dataObj = this._data.map((json) => {
                try{
                    return JSON.parse(json);
                }catch(ex){
                    ChaikaCore.logger.warning('Invalid JSON:', json, '\n' + ex);
                    return null;
                }
            });

            //有効期限切れのものを削除する
            //削除結果を _data にも反映させる
            this._dataObj = this._dataObj.filter((item) => item && (item.expire ? item.expire > Date.now() : true));
            this._data = this._dataObj.map((item) => JSON.stringify(item));
        }
    },


    /**
     * NGワードに該当するレスかどうかを返す
     * @param {ResData} aResData
     * @see ChaikaAboneManager.shouldAbone
     */
    shouldAbone: {
        value: function(aResData){
            return this._dataObj.find((ngData) => {
                if((ngData.target === 'post' && aResData.isThread) ||
                   (ngData.target === 'thread' && !aResData.isThread)){
                    return false;
                }

                return this._matchRule(ngData, aResData);
            });
        }
    },


    /**
     * 条件に一致するレスかどうかを返す
     * @param {RuleData} aRule 条件
     * @param {ResData} aResData レスデータ
     * @see ChaikaAboneManager.shouldAbone
     * @see getRuleData in chrome://chaika/content/settings/rule-editor.xml#editor
     * @note ChaikaContentReplacer からも呼ばれる
     * @todo 条件に一致するかどうかという処理は置換処理でも使われているため別のクラスとして抽出するべき
     */
    _matchRule: {
        value: function(aRule, aResData){
            if(aRule.match && aRule.rules){
                switch(aRule.match){
                    case 'all':
                        return aRule.rules.every((rule) => this._matchRule(rule, aResData));

                    case 'any':
                        return aRule.rules.some((rule) => this._matchRule(rule, aResData));
                }
            }


            let target = aResData[aRule.target];

            if(typeof target !== 'string'){
                return false;
            }

            if(aRule.regexp){
                let regexp = new RegExp(aRule.query, aRule.ignoreCase ? 'i' : '');

                switch(aRule.condition){
                    case 'contains':
                    case 'equals':
                    case 'startsWith':
                    case 'endsWith':
                        return regexp.test(target);

                    case 'notContain':
                    case 'notEqual':
                        return !regexp.test(target);

                    default:
                        return false;
                }
            }else{
                if(aRule.ignoreCase){
                    target = target.toLowerCase();
                }

                switch(aRule.condition){
                    case 'contains':
                        return target.includes(aRule.query);

                    case 'notContain':
                        return !target.includes(aRule.query);

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
            Browser.getGlobalMessageManager().broadcastAsyncMessage(
                'chaika-abone-add', {
                    type: this._ngType,
                    data: jsonData
                }
            );
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
                Browser.getGlobalMessageManager().broadcastAsyncMessage(
                    'chaika-abone-remove', {
                        type: this._ngType,
                        data: aNGData
                    }
                );
            }
        }
    },


    /**
     * 指定したデータを変更する
     * @param {String} oldData 変更するデータ
     * @param {NGExData} newData 変更後のデータ
     */
    change: {
        value: function(oldData, newData){
            //データの補正
            newData.rules.forEach((rule) => {
                if(!rule.regexp && rule.ignoreCase){
                    rule.query = rule.query.toLowerCase();
                }
            });

            jsonNewData = JSON.stringify(newData);


            let index = this._data.indexOf(oldData);

            if(index === -1){
                return;
            }


            this._data[index] = jsonNewData;
            this._dataObj[index] = newData;


            Browser.getGlobalMessageManager().broadcastAsyncMessage(
                'chaika-abone-remove', {
                    type: this._ngType,
                    data: oldData
                }
            );

            Browser.getGlobalMessageManager().broadcastAsyncMessage(
                'chaika-abone-add', {
                    type: this._ngType,
                    data: jsonNewData
                }
            );
        }
    },

});

NGExAboneData.constructor = NGExAboneData;
