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

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

var gAboneObserver = {
    observe: function(aSubject, aTopic, aData){
        let aboneType = aSubject.QueryInterface(Ci.nsISupportsString).data;

        switch(aTopic){
            case "chaika-abone-data-add":
            case "chaika-abone-data-remove":
                gAboneManager[aboneType].update(aData);
                break;

            default:
                return;
        }
    }
};


var gAboneManager = {

    startup: function(){
        this.name = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_NAME);
        this.mail = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_MAIL);
        this.id = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_ID);
        this.word = new AboneManagerView(ChaikaAboneManager.ABONE_TYPE_WORD);
        this.ex = new NGExAboneManagerView(ChaikaAboneManager.ABONE_TYPE_EX);


        Services.obs.addObserver(gAboneObserver, "chaika-abone-data-add", false);
        Services.obs.addObserver(gAboneObserver, "chaika-abone-data-remove", false);


        //右クリックあぼーんの時
        if('arguments' in window && window.arguments.length > 1 &&
           window.arguments[0] && window.arguments[1]){

            let ngType = window.arguments[0];
            let ngData = window.arguments[1];

            setTimeout(() => { this[ngType].populateData(ngData) }, 0);
        }
    },


    shutdown: function(){
        this.name.uninit();
        this.mail.uninit();
        this.id.uninit();
        this.word.uninit();
        this.ex.uninit();

        Services.obs.removeObserver(gAboneObserver, "chaika-abone-data-add", false);
        Services.obs.removeObserver(gAboneObserver, "chaika-abone-data-remove", false);
    },

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

        this._tab.querySelector('.button-add').addEventListener('command', this, false);
        this._tab.querySelector('.button-remove').addEventListener('command', this, false);

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
        this._tab.querySelector('.button-add').removeEventListener('command', this, false);
        this._tab.querySelector('.button-remove').removeEventListener('command', this, false);
    },


    handleEvent: function(aEvent){
        if(aEvent.type !== 'command') return;

        switch(aEvent.originalTarget.className){
            case 'button-add':
                this.add();
                break;

            case 'button-remove':
                this.remove();
                break;

            default:
        }
    },


    /**
     * あぼーんデータが更新された時に呼ばれる
     * (オブザーバから通知された時に表示を更新する)
     */
    update: function(){
        this._initList();
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
        textbox.focus();
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

        ChaikaAboneManager[this._type].remove(this._listbox.selectedItem.value);
    }

};



function NGExAboneManagerView(aNGType){
    AboneManagerView.apply(this, arguments);
}

NGExAboneManagerView.prototype = Object.create(AboneManagerView.prototype, {

    _init: {
        value: function(aNGType){
            AboneManagerView.prototype._init.apply(this, arguments);

            this._listbox.addEventListener('select', this, false);
            this._tab.querySelector('.button-save').addEventListener('command', this, false);

            this._info = this._tab.querySelector('#abone-ex-info');
            this._view = new NGExView(this._info);

            if(this._listbox.getRowCount() > 0){
                setTimeout(() => { this._listbox.selectedIndex = 0; }, 0);
            }else{
                this._info.collapsed = true;
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

            if(this._listbox.getRowCount() === 0 && this._info){
                //一つも項目がない場合にはユーザーが混乱するのを防ぐため、
                //NGデータ編集欄を非表示にしておく
                this._info.collapsed = true;
            }
        }
    },


    uninit: {
        value: function(){
            AboneManagerView.prototype.uninit.apply(this, arguments);

            this._listbox.removeEventListener('select', this, false);
            this._tab.querySelector('.button-save').removeEventListener('command', this, false);

            this._view.uninit();
        }
    },


    handleEvent: {
        value: function(aEvent){
            switch(aEvent.type){
                case 'select':
                    this.populateData(JSON.parse(this._listbox.selectedItem.value), true);
                    break;

                case 'command':
                    switch(aEvent.originalTarget.className){
                        case 'button-add':
                            this.add();
                            break;

                        case 'button-remove':
                            this.remove();
                            break;

                        case 'button-save':
                            this.save();
                            break;
                    }
                    break;
            }
        }
    },


    /**
     * @param {String} updatedData 更新されたデータ (JSON)
     */
    update: {
        value: function(updatedData){
            this._initList();
            this._listbox.value = updatedData;

            if(this._listbox.selectedIndex === -1)
                this._listbox.selectedIndex = 0;
        }
    },


    /**
     * @param {NGExData} aData 表示するデータ
     * @param {Boolean} inContext ページ内表示かどうか
     */
    populateData: {
        value: function(aData, inContext){
            if(inContext){
                this._info.collapsed = false;
                this._view.populateData(aData);
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
            window.openDialog('chrome://chaika/content/settings/abone-manager-ngex.xul',
                              '', 'modal, resizable', dataToPopulate);
        }
    },


    save: {
        value: function(){
            //削除する前にデータをとっておかないとデータが消えてしまう
            //(削除すると先頭のデータが選択されるため)
            let ngData = this._view.getNgData();

            this.remove();
            ChaikaAboneManager.ex.add(ngData);
        }
    },


});

NGExAboneManagerView.constructor = NGExAboneManagerView;
