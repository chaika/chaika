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

Components.utils.import("resource://chaika-modules/ChaikaLogin.js");

var gAccountsPane = {

    startup: function(){},

    /**
     * ログインマネージャからパスワードを取得してセットする
     */
    setPasswordBox: function(type){
        let account;

        switch(type){
            case 'Ronin':
                account = ChaikaRoninLogin.getLoginInfo();
                break;

            case 'Be':
                account = ChaikaBeLogin.getLoginInfo();
                break;

            case 'P2':
                account = ChaikaP2Login.getLoginInfo();
                break;

            default:
                account = null;
        }

        return account ? account.password : '';
    },

    /**
     * パスワードをログインマネージャに登録し、設定値には空文字列を登録するようにする
     * 変更の反映処理等を効率的に行うためにダミーの設定項目(login.p2.idなど)を使用する
     */
    setPasswordPref: function(type, pass){
        switch(type){
            case 'Ronin':
                let id = document.getElementById('extensions.chaika.login.ronin.id').value;
                ChaikaRoninLogin.setLoginInfo(id, pass);
                break;

            case 'Be':
                let id = document.getElementById('extensions.chaika.login.be.id').value;
                ChaikaBeLogin.setLoginInfo(id, pass);
                break;

            case 'P2':
                let id = document.getElementById('extensions.chaika.login.p2.id').value;
                ChaikaP2Login.setLoginInfo(id, pass);
                break;

            default:
        }

        //実際の設定値にパスワードを格納しないようにするため、
        //つねに空文字を返す
        return '';
    }
};
