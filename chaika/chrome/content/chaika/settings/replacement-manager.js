/* See license.txt for terms of usage */

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import("resource://chaika-modules/ChaikaContentReplacer.js");

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


var gReplacerObserver = {
    observe: function(aSubject, aTopic, aData){
        switch(aTopic){
            case "chaika-replace-rule-add":
            case "chaika-replace-rule-remove":
                gReplacementManager.update(aData);
                break;

            default:
                return;
        }
    }
};


var gReplacementManager = {

    startup: function(){
        Services.obs.addObserver(gReplacerObserver, "chaika-replace-rule-add", false);
        Services.obs.addObserver(gReplacerObserver, "chaika-replace-rule-remove", false);

        this._editor = document.getElementById('editor');
        this._listbox = document.getElementById('rulelist');

        this._listbox.addEventListener('select', this);
        document.addEventListener('command', this);

        this._initList();

        if(this._listbox.getRowCount() > 0){
            setTimeout(() => { this._listbox.selectedIndex = 0; }, 0);
        }

        window.sizeToContent();
    },


    shutdown: function(){
        Services.obs.removeObserver(gReplacerObserver, "chaika-replace-rule-add", false);
        Services.obs.removeObserver(gReplacerObserver, "chaika-replace-rule-remove", false);

        this._listbox.removeEventListener('select', this);
        document.removeEventListener('command', this);
    },


    _initList: function(){
        let rules = ChaikaContentReplacer.getRules();

        while(this._listbox.getRowCount() > 0){
            this._listbox.removeItemAt(0);
        }

        rules.forEach((rule) => {
            this._listbox.appendItem(rule.title, JSON.stringify(rule));
        });

        if(this._listbox.getRowCount() === 0){
            //一つも項目がない場合にはユーザーが混乱するのを防ぐため、
            //データ編集欄を非表示にしておく
            this._editor.collapsed = true;
        }
    },


    handleEvent: function(aEvent){
        switch(aEvent.type){
            case 'select':
                if(!!this._listbox.selectedItem){
                    this.populateData(JSON.parse(this._listbox.selectedItem.value), true);
                }
                break;

            case 'command':
                switch(aEvent.originalTarget.className){
                    case 'button-add':
                    case 'context-add':
                        this.add();
                        break;

                    case 'button-import':
                        this.import();
                        break;

                    case 'button-remove':
                    case 'context-remove':
                        this.remove();
                        break;

                    case 'button-save':
                        this.save();
                        break;
                }
                break;
        }
    },


    /**
     * @param {String} updatedData 更新されたデータ (JSON)
     */
    update: function(updatedData){
        this._initList();
        this._listbox.value = updatedData;

        if(this._listbox.selectedIndex === -1)
            this._listbox.selectedIndex = 0;
    },


    /**
     * @param {ReplaceData} aData 表示するデータ
     * @param {Boolean} inContext ページ内表示かどうか
     */
    populateData: function(aData, inContext){
        if(inContext){
            this._editor.collapsed = false;
            this._editor.populateData(aData);
        }else{
            //追加ダイアログを表示する
            this.add(aData);
        }
    },


    /**
     * @param {ReplaceData} [dataToPopulate] 予め入力しておくデータ
     */
    add: function(dataToPopulate){
        window.openDialog('chrome://chaika/content/settings/replacement-manager-new.xul',
                          '_blank', 'modal, resizable', dataToPopulate);
    },


    import: function(){
        window.openDialog('chrome://chaika/content/settings/replacestr.xul',
                          '_blank', 'modal, resizable');
    },


    remove: function(){
        if(this._listbox.selectedIndex === -1) return;

        const items = this._listbox.selectedItems;
        let rv = true;

        if(ChaikaCore.pref.getBool('replace.warn_when_delete')){
            if(items.length > 1){
                rv = window.confirm(items.length + ' 件のデータを削除してもよろしいですか？');
            }else{
                rv = window.confirm(this._listbox.selectedItem.label + ' を削除してもよろしいですか？');
            }
        }

        if(rv){
            Array.from(items)
                 .map((node) => JSON.parse(node.value))
                 .forEach((item) => ChaikaContentReplacer.remove(item));
        }
    },


    /**
     * 編集画面での変更を保存する
     */
    save: function(){
        ChaikaContentReplacer.change(JSON.parse(this._listbox.selectedItem.value),
                                     this._editor.getReplaceData());
    },

};
