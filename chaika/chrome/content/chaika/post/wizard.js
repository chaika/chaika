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
 * Portions created by the Initial Developer are Copyright (C) 2008
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/FormHistory.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaThread.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");
Components.utils.import("resource://chaika-modules/ChaikaLogin.js");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const WIZ_TYPE_RES = 0;
const WIZ_TYPE_NEW_THREAD = 1;

var gWizard = null;
var gThread = null;
var gBoard  = null;
var gPost   = null;
var gWizType = WIZ_TYPE_RES;


function startup(){

    gWizard = document.documentElement;
    gWizard.canRewind = false;
    gWizard.canAdvance = false;

    if(!("arguments" in window)){
        Notification.critical("認識できない URL です");
        return;
    }

    if(window.arguments[1]){
        gWizType = WIZ_TYPE_NEW_THREAD;
    }

    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

    if(gWizType == WIZ_TYPE_RES){
        var threadURL;
        try{
            threadURL = ioService.newURI(window.arguments[0], null, null)
                                .QueryInterface(Components.interfaces.nsIURL);
        }catch(ex){
                // 認識できない URL
            Notification.critical("認識できない URL です");
            return;
        }

        gThread = new ChaikaThread(threadURL);
        gBoard = new ChaikaBoard(gThread.boardURL);

        if(gThread.lineCount == 0){
            Notification.critical("一度も読んでいないスレッドには書き込みできません");
            return;
        }

        switch(gBoard.type){
            case ChaikaBoard.BOARD_TYPE_2CH:
            case ChaikaBoard.BOARD_TYPE_JBBS:
            case ChaikaBoard.BOARD_TYPE_MACHI:
                break;
            default:
                Notification.critical("chaika での書き込みに対応していない掲示板です");
                return;
                break;
        }

    }else if(gWizType == WIZ_TYPE_NEW_THREAD){
        gThread = null;

        var boardURL;
        try{
            boardURL = ioService.newURI(window.arguments[0], null, null)
                                .QueryInterface(Components.interfaces.nsIURL);
        }catch(ex){
                // 認識できない URL
            Notification.critical("認識できない URL です");
            return;
        }
        gBoard = new ChaikaBoard(boardURL);

        switch(gBoard.type){
            case ChaikaBoard.BOARD_TYPE_2CH:
            case ChaikaBoard.BOARD_TYPE_JBBS:
                break;
            default:
                Notification.critical("chaika での新規スレッド作成に対応していない掲示板です");
                return;
                break;
        }

    }else{
        ChaikaCore.logger.warning("UNKNOWN WIZ TYPE: " + window.arguments[0]);
        return;
    }

    var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    os.addObserver(FormPage.roninLoginObserver, "Chaika2chViewer:Auth", false);
    os.addObserver(FormPage.roninLoginObserver, "ChaikaRoninLogin:Logout", false);
    os.addObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Login", false);
    os.addObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Logout", false);
    os.addObserver(FormPage.p2LoginObserver, "ChaikaP2Login:Login", false);
    os.addObserver(FormPage.p2LoginObserver, "ChaikaP2Login:Logout", false);

    if(gBoard.type == ChaikaBoard.BOARD_TYPE_2CH && !gBoard.settingFile.exists()){
        gWizard.goTo("boardSettingPage");
    }else{
        gWizard.goTo("formPage");
    }
}


function shutdown(){
    // checked の値を完全に覚えさせる
    // ただし、defaultmail.txtの内容は覚えない
    var sageCheck = document.getElementById("sageCheck");

    if(sageCheck.hasAttribute('previousValue')){
        sageCheck.setAttribute('checked', sageCheck.getAttribute('previousValue').toString());
    }else{
        sageCheck.setAttribute('checked', sageCheck.checked.toString());
    }

    var useAAFontCheck = document.getElementById("useAAFontCheck");
    if(!useAAFontCheck.hasAttribute("checked")){
        useAAFontCheck.setAttribute("checked", "false");
    }

    var alwaysRaisedCheck = document.getElementById('alwaysRaisedCheck');
    if(!alwaysRaisedCheck.hasAttribute('checked')){
        alwaysRaisedCheck.setAttribute('checked', 'false');
    }


    var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    try{
        os.removeObserver(FormPage.roninLoginObserver, "Chaika2chViewer:Auth");
        os.removeObserver(FormPage.roninLoginObserver, "ChaikaRoninLogin:Logout");
        os.removeObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Login");
        os.removeObserver(FormPage.beLoginObserver, "ChaikaBeLogin:Logout");
        os.removeObserver(FormPage.p2LoginObserver, "ChaikaP2Login:Login");
        os.removeObserver(FormPage.p2LoginObserver, "ChaikaP2Login:Logout");
    }catch(ex){}

    FormPage.addFormHistory();

    //自動ログアウト
    if(ChaikaCore.pref.getBool('post.auto_be_disable')){
        ChaikaBeLogin.logout();
    }

    if(ChaikaCore.pref.getBool('post.auto_p2_disable')){
        ChaikaP2Login.logout();
    }
}


function finish(){
    if(gWizType == WIZ_TYPE_RES && ChaikaCore.pref.getBool("post.thread_reload")){
        SubmitPage.reloadThreadPage();
    }

    return true;
}


function cancelCheck(aEvent){
    if(FormPage._messeageForm && FormPage._messeageForm.value && ChaikaCore.pref.getBool('post.warn_when_close')){
        var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(Ci.nsIPromptService);
        var comformMsg = "書きかけのメッセージがありますがそのまま閉じますか?";
        var result = promptService.confirm(window, "chaika", comformMsg);

        return result;
    }

    return true;
}


function setTitle(){
    if(gWizType == WIZ_TYPE_RES){
        var title = gThread.title;

        gWizard.title = "書き込み: " + title + " [chaika]";
        document.getElementById("titleHeader").value = title;
    }else if(gWizType == WIZ_TYPE_NEW_THREAD){
        var title = gBoard.getTitle();

        gWizard.title = title + " への新規スレッド作成"  + " [chaika]";
        document.getElementById("titleHeader").value = title + " への新規スレッド作成";
    }
}



var Notification = {

    info: function Notification_info(aLabel){
        var notification = document.getElementById("notification");
        notification.appendNotification(aLabel, null, null,
                notification.PRIORITY_INFO_MEDIUM, null);
    },


    warning: function Notification_warning(aLabel){
        var notification = document.getElementById("notification");
        notification.appendNotification(aLabel, null, null,
                notification.PRIORITY_WARNING_MEDIUM, null);
    },


    critical: function Notification_critical(aLabel){
        var notification = document.getElementById("notification");
        notification.appendNotification(aLabel, null, null,
                notification.PRIORITY_CRITICAL_MEDIUM, null);
    },


    removeAll: function Notification_removeAll(){
        var notification = document.getElementById("notification");
        notification.removeAllNotifications(false);
    }

};




var BoardSettingPage = {

    pageShow: function BoardSettingPage_pageShow(aEvent){
        gWizard.canRewind = false;
        gWizard.canAdvance = false;

        this._progress = document.getElementById("settingDownloaderProgress");

        this._downloader = new ChaikaDownloader(gBoard.settingURL, gBoard.settingFile);
        this._downloader.onStart = function(aDownloader){};
        this._downloader.onStop = function(aDownloader, aStatus){
            ChaikaCore.logger.debug([aDownloader.url.spec, aStatus]);
            BoardSettingPage._downloaded();
        };
        this._downloader.onProgressChange = function(aDownloader, aPercentage){
            if(aPercentage != -1){
                BoardSettingPage._progress.mode = "determined";
                BoardSettingPage._progress.value = aPercentage;
            }
        };
        this._downloader.onError = function(aDownloader, aErrorCode){
            ChaikaCore.logger.error([aDownloader.url.spec, aErrorCode]);
        };
        this._downloader.download();

    },

    _downloaded: function BoardSettingPage__downloaded(){
        BoardSettingPage._progress.mode = "determined";
        gBoard = new ChaikaBoard(gBoard.url); // gBoard の再初期化
        setTimeout(function(){ gWizard.goTo('formPage'); }, 500);
    }

};




var FormPage = {

    _firstShow: true,

    pageShow: function FormPage_pageShow(aEvent){
        gWizard.canRewind = false;
        gWizard.canAdvance = true;

        document.getElementById("messeageForm").focus();
        if(!this._firstShow) return;

        this._titleForm = document.getElementById("titleForm");
        this._nameForm = document.getElementById("nameForm");
        this._mailForm = document.getElementById("mailForm");
        this._sageCheck = document.getElementById("sageCheck");
        this._messeageForm = document.getElementById("messeageForm");
        this._roninCheck = document.getElementById("roninCheck");
        this._beCheck = document.getElementById("beCheck");
        this._p2Check = document.getElementById("p2Check");

        //初期化処理
        this.setUseAAFont();
        this.setAlwaysRaised();
        this._setDefaultMailName();
        setTitle();

        //名無し設定
        var noName = gBoard.getSetting("BBS_NONAME_NAME");
        if(noName){
            this._nameForm.emptyText = noName;
        }

        //sage
        this.sageCheck(true);

        //Ronin, Be, p2
        this._roninCheck.checked = ChaikaRoninLogin.enabled;
        this._beCheck.checked = ChaikaBeLogin.isLoggedIn();
        this._p2Check.checked = ChaikaP2Login.enabled;

        //Be自動ログイン
        if(ChaikaCore.pref.getBool('post.auto_be_enable') && !this._beCheck.checked &&
           /\.2ch\.net\/(?:be|nandemo|argue)\//.test(gBoard.url.spec)){
            ChaikaBeLogin.login();
        }

        //gPostの初期化
        this._setPost();

        //このレスにレス
        if(gWizType == WIZ_TYPE_RES && gThread.url.fileName){
            var res = ">>" + gThread.url.fileName.replace(",", "\n>>", "g") +"\n";
            this._messeageForm.value = res;
        }

        //スレッド作成の時はタイトルフォームを表示する
        if(gWizType == WIZ_TYPE_NEW_THREAD){
            document.getElementById("titleFormContainer").hidden = false;
        }

        //cookieチェック
        if(gBoard.url.host.indexOf(".2ch.net")!=-1  && !this._cookieEnabled()){
            Notification.warning(gBoard.url.host +" への Cookie アクセスを許可してください");
        }

        this._firstShow = false;
    },


    pageAdvanced: function FormPage_pageAdvanced(aEvent){
        var title   = this._titleForm.value;
        var name    = this._nameForm.value;
        var mail    = this._mailForm.value;
        var message = this._messeageForm.value;

        if(FormPage._sageCheck.checked){
            if(mail == ""){
                mail = "sage";
            }else if(mail.toLowerCase().indexOf("sage") == -1){
                mail += " sage";
            }
        }

        gPost.setPostData(title, name, mail, message);

        var errorMessages = gPost.getErrorMessages();
        if(errorMessages.length > 0){
            gWizard.canAdvance = false;
            Notification.removeAll(true);
            Notification.warning(errorMessages[0]);
            setTimeout(function(){ gWizard.canAdvance = true; }, 750);
        }else{
            Notification.removeAll(false);

            //プレビューを表示しない設定の時は
            //次のページを送信ページにする
            if(!ChaikaCore.pref.getBool('post.show_preview')){
                gWizard.goTo('submitPage');
                return false;
            }

            return true;
        }

        return false;
    },


    _setPost: function FormPage__setPost(){
        gPost = null;

        if(gWizType == WIZ_TYPE_RES){
            if(this._p2Check.checked){
                gPost = new PostP2(gThread, gBoard);
            }else{
                switch(gBoard.type){
                    case ChaikaBoard.BOARD_TYPE_2CH:
                        gPost = new Post(gThread, gBoard);
                        break;
                    case ChaikaBoard.BOARD_TYPE_JBBS:
                        gPost = new PostJBBS(gThread, gBoard);
                        break;
                    case ChaikaBoard.BOARD_TYPE_MACHI:
                        gPost = new PostMachi(gThread, gBoard);
                        break;
                }
            }
        }else if(gWizType == WIZ_TYPE_NEW_THREAD){
            if(this._p2Check.checked){
                gPost = new PostNewThreadP2(gBoard);
            }else{
                switch(gBoard.type){
                    case ChaikaBoard.BOARD_TYPE_2CH:
                        gPost = new Post2chNewThread(gBoard);
                        break;
                    case ChaikaBoard.BOARD_TYPE_JBBS:
                        gPost = new PostJBBSNewThread(gBoard);
                        break;
                }
            }
        }
    },


    addFormHistory: function FormPage_addFormHistory(){
        var changes = [];

        if(this._nameForm && this._nameForm.value){
            changes.push({
                op: "add",
                fieldname: 'chaika-post-name-history',
                value: this._nameForm.value
            });
        }

        if(this._nameForm && this._mailForm.value){
            changes.push({
                op: "add",
                fieldname: 'chaika-post-mail-history',
                value: this._mailForm.value
            });
        }

        if(changes.length > 0){
            FormHistory.update(changes);
        }
    },


    _cookieEnabled: function FormPage__cookieEnabled(){
        var permManager = Cc["@mozilla.org/permissionmanager;1"]
                .getService(Ci.nsIPermissionManager);
        var cookiePermission = permManager.testPermission (gBoard.url , "cookie");

        if(cookiePermission == Ci.nsIPermissionManager.DENY_ACTION){
            return false;
        }else if(cookiePermission == Ci.nsIPermissionManager.ALLOW_ACTION){
            return true;
        }else if(cookiePermission == Ci.nsICookiePermission.ACCESS_SESSION){
            return true;
        }

        var pref = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefBranch);
        const COOKIE_BEHAVIOR_REJECT = 2;
        return pref.getIntPref("network.cookie.cookieBehavior") != COOKIE_BEHAVIOR_REJECT;
    },


    toggleRoninLogin: function FormPage_toggleRoninLogin(){
        if(FormPage._roninCheck.checked){
            ChaikaRoninLogin.enabled = false;
            FormPage._roninCheck.checked = false;

            if(ChaikaRoninLogin.isLoggedIn()){
                ChaikaRoninLogin.enabled = true;
                FormPage._roninCheck.checked = true;
            }else{
                ChaikaRoninLogin.login();
            }
        }else{
            ChaikaRoninLogin.enabled = false;
            FormPage._roninCheck.checked = false;
        }
    },


    roninLoginObserver: {
        observe: function(aSubject, aTopic, aData){
            if(aTopic == "Chaika2chViewer:Auth" && aData == "OK"){
                ChaikaRoninLogin.enabled = true;
                FormPage._roninCheck.checked = true;
            }

            if(aTopic == 'Chaika2chViewer:Auth' && aData == 'NG'){
                alert("浪人へのログインに失敗しました。\n" +
                        "IDとパスワードを確認してください。");
                ChaikaRoninLogin.enabled = false;
                FormPage._roninCheck.checked = false;
            }

            if(aTopic == "ChaikaRoninLogin:Logout" && aData == "OK"){
                ChaikaRoninLogin.enabled = false;
                FormPage._roninCheck.checked = false;
            }
        }
    },


    toggleBeLogin: function FormPage_toggleBeLogin(){
        if(FormPage._beCheck.checked){
            FormPage._beCheck.checked = false;

            if(ChaikaBeLogin.isLoggedIn()){
                FormPage._beCheck.checked = true;
            }else{
                ChaikaBeLogin.login();
            }
        }else{
            ChaikaBeLogin.logout();
        }
    },


    beLoginObserver: {
        observe: function(aSubject, aTopic, aData){
            if(aTopic == "ChaikaBeLogin:Login" && aData == "OK"){
                FormPage._beCheck.checked = true;
            }
            if(aTopic == 'ChaikaBeLogin:Login' && aData == 'NG'){
                alert("Be@2chへのログインに失敗しました。\n" +
                        "IDとパスワードを確認してください。");
                FormPage._beCheck.checked = false;
            }
            if(aTopic == "ChaikaBeLogin:Logout" && aData == "OK"){
                FormPage._beCheck.checked = false;
            }
        }
    },


    toggleP2Login: function FormPage_toggleP2Login(){
        if(this._p2Check.checked){
            ChaikaP2Login.enabled = false;
            FormPage._p2Check.checked = false;

            if(ChaikaP2Login.isLoggedIn()){
                ChaikaP2Login.enabled = true;
                FormPage._p2Check.checked = true;
                FormPage._setPost();
            }else{
                ChaikaP2Login.login();
            }
        }else{
            ChaikaP2Login.enabled = false;
            FormPage._p2Check.checked = false;
            FormPage._setPost();
        }
    },


    p2LoginObserver: {
        observe: function(aSubject, aTopic, aData){
            //ログイン成功時
            if(aTopic == "ChaikaP2Login:Login" && aData == "OK"){
                ChaikaP2Login.enabled = true;
                FormPage._p2Check.checked = true;
                FormPage._setPost();
            }

            //ログイン失敗
            if(aTopic == "ChaikaP2Login:Login" && aData == "NG"){
                alert("p2へのログインに失敗しました。\n" +
                        "IDとパスワードを確認してください。");
                ChaikaP2Login.enabled = false;
                FormPage._p2Check.checked = false;
                FormPage._setPost();
            }

            //ログアウト
            if(aTopic == "ChaikaP2Login:Logout" && aData == "OK"){
                ChaikaP2Login.enabled = false;
                FormPage._p2Check.checked = false;
                FormPage._setPost();
            }
        }
    },


    /**
     * sageチェックボックスを管理する
     * @param {Boolean} init 初期化する場合はtrue
     */
    sageCheck: function FormPage_sageCheck(init){
        //defaultmail.txtで指定されている場合は、
        //sageチェックボックスをそれに合わせる
        if(init && this._mailForm.value){
            //defaultmail.txtではない時の値を覚えておく
            this._sageCheck.setAttribute('previousValue', this._sageCheck.checked.toString());

            this._sageCheck.checked = this._mailForm.value.indexOf('sage') > -1;
        }

        //emptyTextの設定
        this._mailForm.emptyText = this._sageCheck.checked ? "sage" : " ";

        return this._sageCheck.checked;
    },


    /**
     * 常に最前面にするかどうかを設定する
     */
    setAlwaysRaised: function FormPage_toggleAlwaysRaised(){
        var alwaysRaisedCheck = document.getElementById('alwaysRaisedCheck');
        var value = alwaysRaisedCheck.getAttribute('checked') === 'true';

        if(typeof this._alwaysRaised === 'undefined'){
            this._alwaysRaised = false;
        }

        if(this._alwaysRaised != value){
            //alwaysRaised属性はwindow.openのパラメータでしか設定できないので
            //ウィザード上で切り替えることができない上、Windowsでのみ有効な属性である
            //そこで、blurイベントが発生した時に自動でフォーカスする方法をとることにする
            if(value){
                this._alwaysRaised = true;
                window.addEventListener('blur', this._focus, false);
            }else{
                this._alwaysRaised = false;
                window.removeEventListener('blur', this._focus, false);
            }
        }
    },


    _focus: function FormPage__focus(){
        setTimeout(function(){
            Cc['@mozilla.org/focus-manager;1'].getService(Ci.nsIFocusManager).activeWindow = window;
        }, 0);
    },


    setUseAAFont: function FormPage_setUseAAFont(){
        var useAAFontCheck = document.getElementById("useAAFontCheck");
        var useAAFont = (useAAFontCheck.getAttribute("checked") == "true");

        var fontStyle = "";
        if(useAAFont){
            var fontFamily = ChaikaCore.pref.getUniChar("thread_aa_font_name");
            var fontSize = ChaikaCore.pref.getInt("thread_aa_font_size");
            var lineHeight = ChaikaCore.pref.getInt("thread_aa_line_space") + fontSize;
            fontStyle = [fontSize, "px/", lineHeight, "px '", fontFamily, "'"].join("");
        }
        this._messeageForm.style.font = fontStyle;
    },


    insertBugReportTemplate: function(detailed){
        let template = '';

        let userAgent = ChaikaCore.getUserAgent();
        let skinName = ChaikaCore.pref.getUniChar("thread_skin") || "(Default)";
        let relatedAddons = this._fetchRelatedAddonsList();

        relatedAddons.then((addonList) => {
            template += "【ユーザーエージェント】" + userAgent + '\n';
            template += "【使用スキン】" + skinName + '\n';
            template += "【関連アドオン】\n" +
                        (addonList.length > 0 ? addonList.join('\n') :
                                               '(なし)')
                        + '\n\n';

            if(detailed){
                let changedPrefs = this._getChangedPrefList();
                template += '【変更した設定値】\n' + changedPrefs.join('\n') + '\n\n';
            }

            template += '【不具合の内容・再現手順】\n';

            this._messeageForm.value += template;
        });
    },


    _fetchRelatedAddonsList: function(){
        let relatedAddonReg = /(?:2ch|chaika)/i;

        let list = new Promise((resolve, reject) => {
            AddonManager.getAllAddons((aAddons) => {

                let relatedAddonList = [];

                aAddons.forEach((aAddon) => {
                    if(relatedAddonReg.test(aAddon.name) && aAddon.name !== 'chaika'){
                        let addonInfo = aAddon.name + ' ' + aAddon.version;

                        if(aAddon.userDisabled){
                            addonInfo += ' (無効)';
                        }

                        relatedAddonList.push(addonInfo);
                    }
                });

                resolve(relatedAddonList);
            });
        });

        return list;
    },


    _getChangedPrefList: function(){
        var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
        var branch = prefService.getBranch("extensions.chaika.");
        var list = [];

        function getPrefValue(aPrefName){
            let prefType = branch.getPrefType(aPrefName);
            let value = "";

            switch(prefType){
                case Ci.nsIPrefBranch.PREF_STRING:
                    value = ChaikaCore.pref.getUniChar(aPrefName);
                    break;

                case Ci.nsIPrefBranch.PREF_INT:
                    value = ChaikaCore.pref.getInt(aPrefName);
                    break;

                case Ci.nsIPrefBranch.PREF_BOOL:
                    value = ChaikaCore.pref.getBool(aPrefName);
                    break;

                default:
                    value = "(INVALID)";
                    break;
            }
            return value;
        }

        var prefNames = branch.getChildList("", {}).sort();

        prefNames.forEach((prefName) => {
            if(!branch.prefHasUserValue(prefName)){
                return;
            }

            if(prefName.startsWith('login.')) return;

            list.push(prefName + ': ' + getPrefValue(prefName));
        });

        return list;
    },


    _setDefaultMailName: function FormPage_setDefaultMailName(){

        function getDefaultData(aFileName){
            var defaultDataFile = ChaikaCore.getDataDir();
            defaultDataFile.appendRelativePath(aFileName);

            if(!defaultDataFile.exists()){
                var defaultsFile = ChaikaCore.getDefaultsDir();
                defaultsFile.appendRelativePath(defaultDataFile.leafName);
                defaultsFile.copyTo(defaultDataFile.parent, null);
                defaultDataFile = defaultDataFile.clone();
            }

            var urlSpec = gBoard.url.spec;
            var lines = ChaikaCore.io.readString(defaultDataFile, "Shift_JIS")
                            .replace(/\r/g, "\n").split(/\n+/);
            for(var i=0; i<lines.length; i++){
                var data = lines[i].split(/\t+/);
                if(!(/^\s*(?:;|'|#|\/\/)/).test(data[0]) && urlSpec.indexOf(data[0]) != -1){
                    return (data[1]);
                }
            }
            return null;
        }


        var defaultData = getDefaultData("defaultmail.txt");
        if(defaultData) this._mailForm.value = defaultData;

        defaultData = getDefaultData("defaultname.txt");
        if(defaultData) this._nameForm.value = defaultData;
    }
};




var PreviewPage = {

    pageShow: function PreviewPage_pageShow(aEvent){
        gWizard.canRewind = true;
        gWizard.canAdvance = false;

        let emphasizeWarnings = ChaikaCore.pref.getBool('post.emphasize_warnings');
        let warningMessages = gPost.getWarningMessages();

        if(warningMessages.length > 0){
            let promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Ci.nsIPromptService);

            Notification.removeAll(true);

            warningMessages.forEach(function(warning){
                if(emphasizeWarnings){
                    promptService.alert(window, 'chaika', warning);
                }

                Notification.warning(warning);
            });
        }

        setTimeout(function(){ PreviewPage._createPreview(); }, 0);
    },

    pageRewound: function PreviewPage_pageRewound(aEvent){
        Notification.removeAll(false);
    },

    pageAdvanced: function PreviewPage_pageAdvanced(aEvent){
        Notification.removeAll(false);
    },

    _createPreview: function PreviewPage__createPreview(){
        var previewFrame = document.getElementById("previewFrame");
        var previewData = gPost.getPreview();

        var previewDoc = previewFrame.contentDocument;

        previewDoc.body.style.backGroundColor = previewData["bgColor"];
        previewDoc.body.style.color = previewData["color"];

        var useAAFontCheck = document.getElementById("useAAFontCheck");
        var useAAFont = (useAAFontCheck.getAttribute("checked") == "true");

            // プレビューのフォントを AA フォントにする
        var fontStyle = "";
        if(useAAFont){
            var fontFamily = ChaikaCore.pref.getUniChar("thread_aa_font_name");
            var fontSize = ChaikaCore.pref.getInt("thread_aa_font_size");
            var lineHeight = ChaikaCore.pref.getInt("thread_aa_line_space") + fontSize;
            fontStyle = [fontSize, "px/", lineHeight, "px '", fontFamily, "'"].join("");
        }
        previewDoc.body.style.font = fontStyle;


        previewDoc.getElementById("title").innerHTML = previewData["title"];
        previewDoc.getElementById("name").innerHTML = previewData["name"];
        previewDoc.getElementById("mail").innerHTML = previewData["mail"];
        previewDoc.getElementById("message").innerHTML = previewData["message"];

        setTimeout(function(){ gWizard.canAdvance = true; }, 250);
    }

};




var SubmitPage = {

    succeeded: false,


    pageShow: function SubmitPage_pageShow(aEvent){
        gWizard.canRewind = false;
        gWizard.canAdvance = false;
        gWizard.getButton("finish").disabled = true;
        document.getElementById("reSubmitButton").disabled = true;

        document.getElementById("submitProgress").hidden = false;

        gPost.submit(this);
    },


    pageRewound: function SubmitPage_pageRewound(aEvent){
        document.getElementById("response").value = "";
        Notification.removeAll();
        document.getElementById("submitProgress").hidden = true;

        setTimeout(function(){ gWizard.goTo('formPage'); }, 0);
        return false;
    },


    reSubmit: function SubmitPage_reSubmit(){
        Notification.removeAll();
        gWizard.canRewind = false;
        gWizard.canAdvance = false;
        gWizard.getButton("finish").disabled = true;
        document.getElementById("reSubmitButton").disabled = true;
        document.getElementById("submitProgress").hidden = false;

        gPost.submit(this);
    },

    onSucceeded: function SubmitPage_onSucceeded(aPost, aResponseData, aStatus){
        this.succeeded = true;

        var parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        var response = parserUtils.convertToPlainText(aResponseData, 0, 0).replace(/[\r\n]{3,}/g, "\n\n");
        document.getElementById("response").value += response + "\n----- ----- ----- ----- -----\n\n";


        Notification.info("書き込みに成功しました");

        if(ChaikaCore.pref.getBool("post.write_log.succeeded")){
            gPost.writeKakikomi(gWizType == WIZ_TYPE_NEW_THREAD);
        }

        if(gWizType == WIZ_TYPE_NEW_THREAD){
            var newThreadInfo = {
                boardURL: gBoard.url.spec,
                threadTitle: FormPage._titleForm.value
            };

            var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
            os.notifyObservers(null, "findNewThread:update", JSON.stringify(newThreadInfo));
        }


        gWizard.canRewind = false;
        gWizard.canAdvance = true;
        gWizard.getButton("finish").disabled = false;
        document.getElementById("reSubmitButton").disabled = true;
        document.getElementById("submitProgress").hidden = true;

        if(ChaikaCore.pref.getBool("post.auto_finish")){
            var delay = ChaikaCore.pref.getInt("post.auto_finish_delay");
            setTimeout(function(){ gWizard.advance(null) }, delay);
        }
    },


    onCookieCheck: function SubmitPage_onCookieCheck(aPost, aResponseData, aStatus){
        var parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        var response = parserUtils.convertToPlainText(aResponseData, 0, 0).replace(/[\r\n]{3,}/g, "\n\n");
        document.getElementById("response").value += response + "\n----- ----- ----- ----- -----\n\n";
    },


    onError: function SubmitPage_onError(aPost, aResponseData, aStatus){
        this.succeeded = false;

        var parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        var response = parserUtils.convertToPlainText(aResponseData, 0, 0).replace(/[\r\n]{3,}/g, "\n\n");
        document.getElementById("response").value += response + "\n----- ----- ----- ----- -----\n\n";


        Notification.critical("書き込みに失敗しました");

        if(ChaikaCore.pref.getBool("post.write_log.failed")){
            gPost.writeKakikomi(gWizType == WIZ_TYPE_NEW_THREAD);
        }

        gWizard.canRewind = true;
        gWizard.canAdvance = false;
        gWizard.getButton("finish").disabled = true;
        document.getElementById("reSubmitButton").disabled = false;
        document.getElementById("submitProgress").hidden = true;
    },


    reloadThreadPage: function SubmitPage_reloadThreadPage(){
        if(!this.succeeded) return;

        var serverURL = ChaikaCore.getServerURL();

        var browserWindows = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator).getEnumerator("navigator:browser");
        while(browserWindows.hasMoreElements()){
            var browserWindow = browserWindows.getNext();
            if(!browserWindow.getBrowser) continue;

            var browsers = browserWindow.getBrowser().browsers;
            for(var i = 0; i < browsers.length; i++){
                var currentURI = browsers[i].currentURI;
                if(!(currentURI instanceof Ci.nsIURL)) continue;
                try{
                    if(serverURL.hostPort != currentURI.hostPort) continue;
                    if(currentURI.filePath.indexOf(gThread.plainURL.spec) != -1){
                        browsers[i].reload();
                    }
                }catch(ex){
                    ChaikaCore.logger.error(ex);
                }
            }
        }
    }

};
