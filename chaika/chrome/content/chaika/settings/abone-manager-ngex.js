
Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");


var gNGExView;


function startup(){
    gNGExView = new NGExView(document.getElementById('ngex'));

    if('arguments' in window &&
       window.arguments.length > 0 &&
       typeof window.arguments[0] === 'object'){
            gNGExView.populateData(window.arguments[0]);
    }
}


function shutdown(){
    gNGExView.uninit();
}


function onDialogAccept(){
    if(gNGExView._enableAutoNaming){
        gNGExView.setLabel();
    }

    ChaikaAboneManager.ex.add(gNGExView.getNgData());
}


/**
 * あぼーんデータ (NGEx)
    {
        title: 'Label',
        target: 'post' or 'thread',
        chain: true,
        autoNGID: true,
        match: 'any' or 'all',
        rules: [
            {
                target: 'name', 'msg', 'baseBe' など
                regexp: true,
                ignoreCase: true,
                query: 'NGワード',

                // を含む, を含まない, である, でない, で始まる, で終わる
                condition: 'contains', 'notContain', 'equals', 'notEqual', 'startsWith', 'endsWith'
            }, ...
        ]
    }
 */
var NGExData = {
    title: '',
    target: '',
    chain: undefined,
    hide: undefined,
    expire: undefined,
    autoNGID: false,
    highlight: false,
    rules: [],
};


function NGExView(root){
    this._init(root);
}

NGExView.prototype = {

    _init: function(root){
        this._root = root;
        this._labelbox = root.querySelector('.label');

        this._root.addEventListener('command', this, true);
        this._root.addEventListener('change', this, true);

        this.setAutoNaming(true);
        this.insertRule();
    },


    uninit: function(){
        this._root.removeEventListener('command', this, true);
        this._root.removeEventListener('change', this, true);
    },


    handleEvent: function(aEvent){
        switch(aEvent.type){
            case 'command':
                switch(aEvent.target.className){
                    case 'auto-naming':
                        this.toggleAutoNaming();
                        break;

                    case 'rule-button-add':
                        this.insertRule();
                        break;

                    case 'rule-button-remove':
                        this.removeRule(aEvent);
                        break;
                }
                break;

            case 'change':
                break;

            default:
                return;
        }

        if(this._enableAutoNaming){
            this.setLabel();
        }
    },


    adjustWindowSize: function(){
        let rules = this._root.querySelector('.rules');

        //ディスプレイ高さの7.5割以上の高さになったら、
        //そこでウィンドウサイズを大きくするのはやめて、
        //かわりにルール表示部にスクロールバーを表示する
        if(window.outerHeight > window.screen.availHeight * 0.75){
            window.resizeTo(window.outerWidth, window.screen.availHeight * 0.75);

            if(!rules.classList.contains('fixed-height')){
                rules.classList.add('fixed-height');
                rules.style.height = Math.floor(rules.clientHeight) + 'px';
            }
        }else{
            rules.classList.remove('fixed-height');
            rules.style.height = 'auto';
            window.sizeToContent();
        }


        //content のサイズが小さくなった場合に
        //sizeToContent が正しく働かない問題に対処
        let bottomMargin = document.documentElement.getBoundingClientRect().bottom -
                           this._root.getBoundingClientRect().bottom;

        if(bottomMargin > 0){
            window.resizeBy(0, -bottomMargin);
        }
    },


    insertRule: function(){
        let template = this._root.querySelector('.template');
        let newRule = template.cloneNode(true);

        newRule.classList.remove('template');
        newRule.classList.add('rule');

        this._root.querySelector('.rules').appendChild(newRule);

        this.adjustWindowSize();

        return newRule;
    },


    removeRule: function(aEvent){
        let rule = aEvent.target.parentNode.parentNode;
        let rules = rule.parentNode;

        if(rules.childNodes.length > 1){
            rule.parentNode.removeChild(rule);
        }

        this.adjustWindowSize();
    },


    clearRules: function(){
        let rules = this._root.querySelector('.rules');

        while(rules.childNodes.length > 0){
            rules.removeChild(rules.firstChild);
        }
    },


    toggleAutoNaming: function(){
        let checkbox = this._root.querySelector('.auto-naming');

        this._enableAutoNaming =
        this._labelbox.disabled = checkbox.checked;
    },


    setAutoNaming: function(enable){
        let checkbox = this._root.querySelector('.auto-naming');

        checkbox.checked =
        this._enableAutoNaming =
        this._labelbox.disabled = enable;
    },


    setLabel: function(){
        this._labelbox.value = this.getLabelText();
    },


    getLabelText: function(){
        let rules = this._root.querySelectorAll('.rule');

        if(!rules.length) return '';

        let rulesText = Array.slice(rules).map((rule) => {
            let target = rule.querySelector('.rule-target').selectedItem.label;
            let query = rule.querySelector('.rule-query').value;
            let condition = rule.querySelector('.rule-condition').selectedItem.label;

            return target + 'が' + query + condition;
        });

        let match = this._root.querySelector('.match').selectedItem.label;
        let target = this._root.querySelector('.target').selectedItem.label;

        return rulesText.join(', ') + ' の' + match + 'に一致する' + target;
    },


    getNgData: function(){
        let ngData = Object.create(NGExData);

        ngData.title = this._labelbox.value;
        ngData.match = this._root.querySelector('.match').value;
        ngData.target = this._root.querySelector('.target').value;
        ngData.autoNGID = this._root.querySelector('.autoNGID').checked;
        ngData.highlight = this._root.querySelector('.highlight').checked;

        ngData.hide = eval(this._root.querySelector('.hide-abone').value);
        ngData.chain = eval(this._root.querySelector('.chain-abone').value);

        if(this._root.querySelector('.set-expire').checked){
            let datepicker = this._root.querySelector('.expire-date');
            let timepicker = this._root.querySelector('.expire-time');
            let expire = new Date(datepicker.year, datepicker.month, datepicker.date,
                                  timepicker.hour, timepicker.minute, 0, 0);

            ngData.expire = expire.getTime();
        }

        let rules = this._root.querySelectorAll('.rule');

        ngData.rules = Array.slice(rules).map((rule) => {
            return {
                target: rule.querySelector('.rule-target').value,
                query: rule.querySelector('.rule-query').value,
                condition: rule.querySelector('.rule-condition').value,
                regexp: rule.querySelector('.rule-regexp').checked,
                ignoreCase: ! rule.querySelector('.rule-case-sensitive').checked
            };
        });


        return ngData;
    },


    populateData: function(ngData){
        this._labelbox.value = ngData.title;
        this._root.querySelector('.match').value = ngData.match;
        this._root.querySelector('.target').value = ngData.target;
        this._root.querySelector('.autoNGID').checked = !!ngData.autoNGID;
        this._root.querySelector('.highlight').checked = !!ngData.highlight;

        this._root.querySelector('.hide-abone').value = ngData.hide + '';
        this._root.querySelector('.chain-abone').value = ngData.chain + '';

        if(typeof ngData.expire === 'number'){
            this._root.querySelector('.set-expire').checked = true;

            let datepicker = this._root.querySelector('.expire-date');
            let timepicker = this._root.querySelector('.expire-time');
            let expire = new Date(ngData.expire);

            datepicker.year = expire.getFullYear();
            datepicker.month = expire.getMonth();
            datepicker.date = expire.getDate();
            timepicker.hour = expire.getHours();
            timepicker.minute = expire.getMinutes();
        }else{
            this._root.querySelector('.set-expire').checked = false;
        }


        this.clearRules();

        ngData.rules.forEach((rule) => {
            let node = this.insertRule();

            node.querySelector('.rule-target').value = rule.target;
            node.querySelector('.rule-query').value = rule.query;
            node.querySelector('.rule-condition').value = rule.condition;
            node.querySelector('.rule-regexp').checked = !!rule.regexp;
            node.querySelector('.rule-case-sensitive').checked = ! rule.ignoreCase;
        });


        //自動ネーミングと設定されているラベルが一致したら
        //自動ネーミングが有効だと判断する
        if(ngData.title === this.getLabelText()){
            this.setAutoNaming(true);
        }else{
            this.setAutoNaming(false);
        }

        //もし有効ならラベルをセットする
        if(this._enableAutoNaming){
            this.setLabel();
        }
    },

}
