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
 * The Original Code is bbs2chreader.
 *
 * The Initial Developer of the Original Code is
 * flyson.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson at users.sourceforge.jp>
 *    nodaguti <nodaguti at gmail.com>
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

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://chaika-modules/ChaikaCore.js');
Cu.import('resource://chaika-modules/utils/Browser.js');
Cu.import("resource://chaika-modules/ChaikaAboneManager.js");


var gAboneManager = {

    startup: function(){
        this.name = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_NAME);
        this.mail = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_MAIL);
        this.id = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_ID);
        this.word = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_WORD);
        this.ex = new NGExAboneManagerView(ChaikaAboneManager.ABONE_TYPE_EX);

        this._messageManager = Browser.getGlobalMessageManager();

        this._messageManager.addMessageListener('chaika-abone-add', this.listener);
        this._messageManager.addMessageListener('chaika-abone-remove', this.listener);

        window.addEventListener('select', this, false);
        window.addEventListener('command', this, false);

        //右クリックあぼーんの時
        if('arguments' in window && window.arguments.length > 1 &&
           window.arguments[0] && window.arguments[1]){

            let ngType = window.arguments[0];
            let ngData = window.arguments[1];

            setTimeout(() => { this[ngType].populateData(ngData) }, 0);
        }

        window.sizeToContent();
    },


    shutdown: function(){
        this.name.uninit();
        this.mail.uninit();
        this.id.uninit();
        this.word.uninit();
        this.ex.uninit();

        this._messageManager.removeMessageListener('chaika-abone-add', this.listener);
        this._messageManager.removeMessageListener('chaika-abone-remove', this.listener);

        window.removeEventListener('select', this, false);
        window.removeEventListener('command', this, false);
    },


    listener: function(message){
        gAboneManager[message.data.type].update(message.data.data);
    },


    handleEvent: function(aEvent){
        const panel = document.getElementById('aboneManagerTabBox').selectedPanel;
        const type = panel.getAttribute('id').replace('abone-', '');
        const view = this[type];
        const target = aEvent.target;

        switch(aEvent.type){
            case 'select':
                if(target.nodeName === 'listbox' && !!view._listbox.selectedItem){
                    view.populateData(view._listbox.selectedItem.value, true);
                }
                break;

            case 'command':
                view.doCommand(target.className);
                break;
        }
    }

}



function AboneManagerView(aNGType){
    this._init(aNGType);
}

AboneManagerView.prototype = {

    _init: function(aNGType){
        this._type = aNGType;
        this._tab = document.getElementById('abone-' + this._type);
        this._textbox = this._tab.querySelector('textbox');
        this._listbox = this._tab.querySelector('listbox');

        this._initList();
    },


    _initList: function(){
        let ngData = ChaikaAboneManager[this._type].getNgData();

        while(this._listbox.getRowCount() > 0){
            this._listbox.removeItemAt(0);
        }

        ngData.forEach((aWord) => {
            this._listbox.appendItem(aWord, aWord);
        });
    },


    uninit: function(){
    },


    doCommand: function(name){
        switch(name){
            case 'button-add':
                this.add();
                break;

            case 'context-add':
                this._textbox.focus();
                break;

            case 'button-remove':
            case 'context-remove':
                this.remove();
                break;
        }
    },


    /**
     * あぼーんデータが更新された時に呼ばれる
     * (オブザーバから通知された時に表示を更新する)
     */
    update: function(updatedData){
        this._initList();

        this._listbox.value = updatedData;

        if(this._listbox.selectedIndex === -1)
            this._listbox.selectedIndex = 0;
    },


    /**
     * 指定されたデータを入力状態にする
     */
    populateData: function(aWord){
        //タブを選択
        let tabbox = document.getElementById('aboneManagerTabBox');
        tabbox.selectedPanel = this._tab;
        tabbox.selectedIndex = this._tab.parentNode.selectedIndex;

        //テキストボックスにデータを入れてフォーカスを当てる
        this._textbox.value = aWord;
        this._textbox.focus();
    },


    /**
     * 入力欄に入力されているワードをNGデータに追加する
     */
    add: function(){
        if(this._textbox.value){
            ChaikaAboneManager[this._type].add(this._textbox.value);
        }
    },


    /**
     * 選択されているNGデータを削除する
     */
    remove: function(){
        if(this._listbox.selectedIndex === -1) return;

        const items = this._listbox.selectedItems;
        let rv = true;

        if(ChaikaCore.pref.getBool('abone.warn_when_delete')){
            if(items.length > 1){
                rv = window.confirm(items.length + ' 件のデータを削除してもよろしいですか？');
            }else{
                rv = window.confirm(this._listbox.selectedItem.label + ' を削除してもよろしいですか？');
            }
        }

        if(rv){
            Array.from(items)
                 .map((node) => node.value)
                 .forEach((item) => ChaikaAboneManager[this._type].remove(item));
        }
    }

};



function NGExAboneManagerView(aNGType){
    AboneManagerView.apply(this, arguments);
}

NGExAboneManagerView.prototype = Object.create(AboneManagerView.prototype, {

    _init: {
        value: function(aNGType){
            AboneManagerView.prototype._init.apply(this, arguments);

            this._editor = document.getElementById('ngex-editor');

            if(this._listbox.getRowCount() > 0){
                this._listbox.selectedIndex = 0;
                this.populateData(this._listbox.selectedItem.value, true);
            }else{
                this._editor.collapsed = true;
            }
        }
    },


    _initList: {
        value: function(){
            let ngData = ChaikaAboneManager[this._type].getNgData();

            while(this._listbox.getRowCount() > 0){
                this._listbox.removeItemAt(0);
            }

            ngData.forEach((aNGData) => {
                this._listbox.appendItem(JSON.parse(aNGData).title, aNGData);
            });

            //一つも項目がない場合にはユーザーが混乱するのを防ぐため、
            //NGデータ編集欄を非表示にしておく
            if(this._listbox.getRowCount() === 0 && this._editor){
                this._editor.collapsed = true;
            }
        }
    },


    doCommand: {
        value: function(name){
            switch(name){
                case 'button-add':
                case 'context-add':
                    this.add();
                    break;

                case 'button-remove':
                case 'context-remove':
                    this.remove();
                    break;

                case 'button-save':
                    this.save();
                    break;
            }
        }
    },


    /**
     * @param {NGExData|String} aData 表示するデータ
     * @param {Boolean} inContext ページ内表示かどうか
     */
    populateData: {
        value: function(aData, inContext){
            if((typeof aData) === 'string'){
                aData = JSON.parse(aData);
            }

            if(inContext){
                this._editor.collapsed = false;
                this._editor.populateData(aData);
            }else{
                //タブを選択
                let tabbox = document.getElementById('aboneManagerTabBox');
                tabbox.selectedPanel = this._tab;
                tabbox.selectedIndex = this._tab.parentNode.selectedIndex;

                //追加ダイアログを表示する
                this.add(aData);
            }
        },
    },


    /**
     * @param {NGExData} [dataToPopulate] 予め入力しておくデータ
     */
    add: {
        value: function(dataToPopulate){
            window.openDialog('chrome://chaika/content/settings/abone-manager-ngex-new.xul',
                              '', 'modal, resizable', dataToPopulate);
        }
    },


    save: {
        value: function(){
            ChaikaAboneManager.ex.change(this._listbox.selectedItem.value, this._editor.getNgData());
        }
    },


});

NGExAboneManagerView.constructor = NGExAboneManagerView;
