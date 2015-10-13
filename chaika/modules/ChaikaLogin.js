/* See license.txt for terms of usage */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

this.EXPORTED_SYMBOLS = ["ChaikaRoninLogin", "ChaikaBeLogin", "ChaikaP2Login"];

Cu.import("resource://chaika-modules/ChaikaCore.js");


/**
 * Cookie 文字列をパースする
 * @param {String} cookieStr
 * @return {Object}
 * @private
 * @license MIT, GPL
 * @copyright (c) 2012 Daniel Jordan (https://github.com/danjordan/cookie-parser)
 */
function parseCookie(cookieStr){
    var attributes = ['name', 'value', 'expires', 'path', 'domain', 'secure', 'httponly', 'max-age'];
    var splitter = /,\s(?=[a-zA-Z\-_]+=[a-zA-Z0-9\-_%\.])/g;

    var cookies = [];
    var cookie_array = cookieStr.split(splitter);

    ChaikaCore.logger.debug('Parse Cookie:', cookie_array);

    cookie_array.forEach(function(e){
        var cookie = {
            options: {}
        };
        var params = e.split('; ');

        params.forEach(function(param) {
            param = param.split('=');
            var key = param[0];
            var _key = param[0].toLowerCase();
            var value = param[1];

            if (attributes.indexOf(_key) !== -1){
                switch(_key){
                    case 'expires':
                        cookie.options[_key] = new Date(value.replace(/-/g, ' '));
                        break;

                    case 'domain':
                        cookie.options[_key] = value.startsWith('.') ? value : '.' + value;
                        break;

                    default:
                        cookie.options[_key] = value || true;

                }
            } else {
                cookie.name = key;
                cookie.value = value;
            }
        });

        cookies.push(cookie);
    });

    return cookies;
}



/**
 * ひな形ログインオブジェクト
 * @abstract
 */
var ChaikaLogin = {

    /**
     * ユーザーIDとパスワードを返す
     * @return {{id: string, password: string}}
     */
    getLoginInfo: function(){},

    /**
     * ユーザーIDとパスワードをセットする関数
     * @param {String} id
     * @param {String} password
     */
    setLoginInfo: function(){},

    /**
     * ログインしているか否かを返す
     * @return {bool}
     */
    isLoggedIn: function(){},

    /**
     * ログイン処理を行う
     */
    login: function(){},

    /**
     * ログアウト処理を行う
     */
    logout: function(){},

};


/**
 * 浪人アカウント
 * @extends ChaikaLogin
 */
this.ChaikaRoninLogin = {

    /**
     * Ronin経由で書き込むかどうか
     * @type {bool}
     */
    _enabled: false,


    /**
     * ID を取得中か否か
     * @type {Boolean}
     */
    _processing: false,


    /**
     * 起動時に実行される
     */
    _startup: function(){
        this.login();
    },


    /**
     * 終了時に実行される
     */
    _quit: function(){
        //this.logout();
    },


    get enabled(){
        return this._enabled && this.isLoggedIn();
    },


    set enabled(bool){
        this._enabled = bool;
    },


    /**
     * ユーザーIDとパスワードを返す関数
     * @return {Object}  {String} .id ID
     *                   {String} .password Password
     */
    getLoginInfo: function ChaikaRoninLogin_getLoginInfo(){
        var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

        var account = {
            id: '',
            password: ''
        };

        account.id = ChaikaCore.pref.getChar('login.ronin.id');


        //保存されている古いパスワードをログインマネージャへ移行
        try{
            if(ChaikaCore.pref.getChar('maru_password')){
                account.password = ChaikaCore.pref.getChar('maru_password');
                ChaikaCore.pref.setChar('maru_password', '');
                this.setLoginInfo(account.id, account.password);

                return account;
            }
        }catch(ex){}


        var logins = lm.findLogins({}, 'chrome://chaika', null, '2ch Viewer Registration');

        logins.some(function(login){
            if(login.username === account.id){
                account.password = login.password;
                return true;
            }

            return false;
        });

        //パスワードがない時はそのアカウントは無効
        if(!account.password) account.id = '';

        return account;
    },


    /**
     * ユーザーIDとパスワードをセットする関数
     * @param {String} id
     * @param {String} password
     */
    setLoginInfo: function ChaikaRoninLogin_setLoginInfo(id, password){
        if(!(id && password)) return;

        var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
        var loginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                        Ci.nsILoginInfo, "init");

        var login = new loginInfo('chrome://chaika', null, '2ch Viewer Registration', id, password, '', '');

        try{
            var oldLogin = this.getLoginInfo();

            if(oldLogin.id == id && oldLogin.password == password) return;

            if(oldLogin.id && oldLogin.id == id){
                var oldLoginInfo = new loginInfo('chrome://chaika', null, '2ch Viewer Registration',
                                        oldLogin.id, oldLogin.password, '', '');
                lm.modifyLogin(oldLoginInfo, login);
            }else{
                lm.addLogin(login);
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }
    },


    login: function ChaikaRoninLogin_login(){
        var account = this.getLoginInfo();

        //有効なアカウントが存在しないとき
        if(!account.id || !account.password){
            ChaikaCore.logger.debug('Login Error: No Account Available');
            return this._onFail();
        }

        //すでに有効なセッションIDが存在するとき
        if(this.isLoggedIn()){
            return ChaikaCore.logger.debug('Login Error: Session ID Is Still Valid');
        }

        //Session ID を取得中なとき
        if(this._processing){
            return ChaikaCore.logger.debug('Login Error: Another Process Is Running');
        }


        this._processing = true;

        //確実にログアウトする
        this.logout();

        var httpChannel = ChaikaCore.getHttpChannel(this._getLoginURI());
        httpChannel.setRequestHeader("User-Agent", "DOLIB/1.00", false);
        httpChannel.setRequestHeader("X-2ch-UA", ChaikaCore.getUserAgent(), false);
        httpChannel.setRequestHeader("Content-Type", "application/x-www-form-urlencoded", false);
        httpChannel = httpChannel.QueryInterface(Ci.nsIUploadChannel);

        var strStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
        var postString = "ID=" + account.id + "&PW=" + account.password;

        strStream.setData(postString, postString.length);
        httpChannel.setUploadStream(strStream, "application/x-www-form-urlencoded", -1);
        httpChannel.requestMethod = "POST";

        httpChannel.asyncOpen(this._listener, null);
    },


    logout: function ChaikaRoninLogin_logout(){
        ChaikaCore.pref.setChar("login.ronin.session_id", "");

        ChaikaCore.logger.debug('Logged Out');

        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.notifyObservers(null, "ChaikaRoninLogin:Logout", "OK");
    },

    isLoggedIn: function ChaikaRoninLogin_isLoggedIn(){
        //6時間以内に取得したセッションIDがある場合にログインしているとみなす
        //  ※実際の有効期限は24時間である
        //  https://pink-chan-store.myshopify.com/pages/developers
        let lastAuthTime = ChaikaCore.pref.getInt("login.ronin.last_auth_time");
        let now = Date.now() / 1000;
        let sessionID = ChaikaCore.pref.getChar("login.ronin.session_id");

        let loggedIn = (now - lastAuthTime) < 6 * 60 * 60 &&
                       typeof sessionID === 'string' &&
                       sessionID !== "";

        ChaikaCore.logger.debug('logged in:', loggedIn);

        return loggedIn;
    },

    _getLoginURI: function ChaikaRoninLogin__getLoginURI(){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var loginURLSpec = ChaikaCore.pref.getChar("login.ronin.login_url");
        return ioService.newURI(loginURLSpec, null, null).QueryInterface(Ci.nsIURL);
    },

    /**
     * ログイン失敗時に呼ばれる
     */
    _onFail: function ChaikaRoninLogin__onFail(){
        this.logout();

        ChaikaCore.logger.debug("Auth: NG");

        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.notifyObservers(null, "Chaika2chViewer:Auth", "NG");

        this._processing = false;
    },

    /**
     * ログイン成功時に呼ばれる
     */
    _onSuccess: function ChaikaRoninLogin__onSuccess(aSessionID){
        ChaikaCore.pref.setChar("login.ronin.session_id", aSessionID);
        ChaikaCore.pref.setInt("login.ronin.last_auth_time", Date.now() / 1000);

        ChaikaCore.logger.debug("Auth: OK; Session ID:", aSessionID);

        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.notifyObservers(null, "Chaika2chViewer:Auth", "OK");

        this._processing = false;
    },


    _listener: {
        onStartRequest: function(aRequest, aContext){
            this._binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
                                    .createInstance(Ci.nsIBinaryInputStream);
            this._data = [];
        },

        onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount){
            this._binaryStream.setInputStream(aInputStream);
            this._data.push(this._binaryStream.readBytes(aCount));
        },

        onStopRequest: function(aRequest, aContext, aStatus){
            var data = this._data.join("");

            aRequest.QueryInterface(Ci.nsIHttpChannel);
            ChaikaCore.logger.debug("Auth Response: " + data);
            ChaikaCore.logger.debug('HTTP Status:', aRequest.responseStatus);

            if(data.startsWith("SESSION-ID=ERROR:")){
                ChaikaRoninLogin._onFail();
                return;
            }

            //先頭のSESSION-ID=と改行コードを取り除く
            ChaikaRoninLogin._onSuccess(data.replace('SESSION-ID=', '').replace(/[\n\r]/g, ''));
        }
    },
};



/**
 * Be@2ch ログインオブジェクト
 * @extends ChaikaLogin
 */
this.ChaikaBeLogin = {

    _loggedIn: false,


    get cookieManager(){
        if(!this._cookieManager)
            this._cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);

        return this._cookieManager;
    },


    /**
     * ユーザーIDとパスワードを返す関数
     * @return {Object}  {String} .id ID
     *                   {String} .password Password
     */
    getLoginInfo: function ChaikaBeLogin_getLoginInfo(){
        var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

        var account = {
            id: '',
            password: ''
        };

        account.id = ChaikaCore.pref.getChar('login.be.id');


        //保存されているパスワードをログインマネージャへ移行
        if(ChaikaCore.pref.getChar('login.be.password')){
            account.password = ChaikaCore.pref.getChar('login.be.password');
            ChaikaCore.pref.setChar('login.be.password', '');
            this.setLoginInfo(account.id, account.password);

            return account;
        }


        var logins = lm.findLogins({}, 'http://be.2ch.net', 'http://be.2ch.net', null);

        logins.some(function(login){
            if(login.username === account.id){
                account.password = login.password;
                return true;
            }

            return false;
        });

        //パスワードがない時はそのアカウントは無効
        if(!account.password) account.id = '';

        return account;
    },


    /**
     * ユーザーIDとパスワードをセットする関数
     * @param {String} id
     * @param {String} password
     */
    setLoginInfo: function ChaikaBeLogin_setLoginInfo(id, password){
        if(!id || !password) return;

        var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
        var loginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                        Ci.nsILoginInfo, "init");

        var login = new loginInfo('http://be.2ch.net', 'http://be.2ch.net', null,
                        id, password, 'm', 'p');

        try{
            var oldLogin = this.getLoginInfo();

            if(oldLogin.id == id && oldLogin.password == password) return;

            if(oldLogin.id && oldLogin.id == id){
                var oldLoginInfo = new loginInfo('http://be.2ch.net', 'http://be.2ch.net', null,
                                        oldLogin.id, oldLogin.password, 'm', 'p');
                lm.modifyLogin(oldLoginInfo, login);
            }else{
                lm.addLogin(login);
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }
    },

    isLoggedIn: function ChaikaBeLogin_isLoggedIn(){
        var mdmdExists = this.cookieManager.cookieExists({
            host: ".2ch.net",
            path: '/',
            name: 'MDMD'
        });

        var dmdmExists = this.cookieManager.cookieExists({
            host: ".2ch.net",
            path: '/',
            name: 'DMDM'
        });

        ChaikaCore.logger.debug('MDMD exists:' + mdmdExists + '; DMDM exists:' + dmdmExists);

        //クッキーがあればログイン済みである
        this._loggedIn = mdmdExists && dmdmExists;

        return this._loggedIn;
    },


    login: function ChaikaBeLogin_login(){
        this._loggedIn = false;

        this._req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                    .createInstance(Ci.nsIXMLHttpRequest);

        this._req.open("POST", this._getLoginURI().spec, true);
        this._req.addEventListener('load', this._onSuccess.bind(this), false);

        var account = this.getLoginInfo();
        var fromStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        var mail = "m=" + encodeURIComponent(account.id);
        var pass = "p=" + encodeURIComponent(account.password);
        var submit = "submit=%C5%D0%CF%BF";
        fromStr.data = [mail, pass, submit].join("&");

        this._req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        this._req.send(fromStr);
    },


    logout: function ChaikaBeLogin_logout(){
        this.cookieManager.remove(".2ch.net", 'MDMD', '/', false);
        this.cookieManager.remove(".2ch.net", 'DMDM', '/', false);
        this.cookieManager.remove('.bbspink.com', 'MDMD', '/', false);
        this.cookieManager.remove('.bbspink.com', 'DMDM', '/', false);

        this._loggedIn = false;

        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.notifyObservers(null, "ChaikaBeLogin:Logout", "OK");
    },


    _getLoginURI: function ChaikaBeLogin__getLoginURI(){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var loginURLSpec = ChaikaCore.pref.getChar("login.be.login_url");
        return ioService.newURI(loginURLSpec, null, null);
    },


    _onSuccess: function ChaikaBeLogin__onSuccess(){
        //送られてきたクッキーを登録する
        var cookieStr = this._req.getResponseHeader('Set-Cookie');
        var cookies = parseCookie(cookieStr.replace(/\n/g, ', '));

        cookies.forEach(function(cookie){
            if(cookie.options.value !== 'deleted' && cookie.options.domain){
                //for 2ch.net
                this.cookieManager.add(
                    cookie.options.domain,
                    cookie.options.path,
                    cookie.name,
                    cookie.value,
                    false, false, false,
                    cookie.options.expires ?
                        cookie.options.expires.getTime() / 1000 :
                        ( Date.now() / 1000 ) + ( 7 * 24 * 60 * 60 )
                );

                //for bbspink.com
                this.cookieManager.add(
                    '.bbspink.com',
                    cookie.options.path,
                    cookie.name,
                    cookie.value,
                    false, false, false,
                    cookie.options.expires ?
                        cookie.options.expires.getTime() / 1000 :
                        ( Date.now() / 1000 ) + ( 7 * 24 * 60 * 60 )
                );
            }
        }, this);

        if(this.isLoggedIn()){
            ChaikaBeLogin._loggedIn = true;

            let os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
            os.notifyObservers(null, "ChaikaBeLogin:Login", "OK");
        }else{
            ChaikaBeLogin.logout();

            let os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
            os.notifyObservers(null, "ChaikaBeLogin:Login", "NG");
        }
    },

};



/**
 * p2/rep2 ログインオブジェクト
 * @extends ChaikaLogin
 */
this.ChaikaP2Login = {

    /**
     * p2にログインしているかどうか
     * @type {Boolean}
     */
    _loggedIn: false,


    /**
     * p2での書き込みを有効にするかどうか
     * @type {Boolean}
     */
    _enabled: false,


    get enabled(){
        return this._enabled && this.isLoggedIn();
    },


    set enabled(bool){
        this._enabled = bool;
    },


    get cookieManager(){
        if(!this._cookieManager)
            this._cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);

        return this._cookieManager;
    },


    get os(){
        if(!this._os)
            this._os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

        return this._os;
    },


    /**
     * ユーザーIDとパスワードを返す関数
     * @return {Object}  {String} .id ID
     *                   {String} .password Password
     */
    getLoginInfo: function ChaikaP2Login_getLoginInfo(){
        var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

        var account = {
            id: '',
            password: ''
        };

        account.id = ChaikaCore.pref.getChar('login.p2.id');


        //保存されているパスワードをログインマネージャへ移行
        if(ChaikaCore.pref.getChar('login.p2.password')){
            account.password = ChaikaCore.pref.getChar('login.p2.password');
            ChaikaCore.pref.setChar('login.p2.password', '');
            this.setLoginInfo(account.id, account.password);

            return account;
        }


        var url = ChaikaCore.pref.getChar('login.p2.login_url');
        url = url.match(/^(https?:\/\/[^\/]+)\//)[1];

        var logins = lm.findLogins({}, url, url, null);

        logins.some(function(login){
            if(login.username === account.id){
                account.password = login.password;
                return true;
            }

            return false;
        });

        //パスワードがない時はそのアカウントは無効
        if(!account.password) account.id = '';

        return account;
    },


    /**
     * ユーザーIDとパスワードをセットする関数
     * @param {String} id
     * @param {String} password
     */
    setLoginInfo: function ChaikaP2Login_setLoginInfo(id, password){
        var lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
        var loginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                        Ci.nsILoginInfo, "init");

        var url = ChaikaCore.pref.getChar('login.p2.login_url');
        url = url.match(/^(https?:\/\/[^\/]+)\//)[1];

        var login = new loginInfo(url, url, null,
                        id, password, 'form_login_id', 'form_login_pass');

        try{
            var oldLogin = this.getLoginInfo();

            if(oldLogin.id == id && oldLogin.password == password) return;

            if(oldLogin.id && oldLogin.id == id){
                var oldLoginInfo = new loginInfo(url, url, null,
                                        oldLogin.id, oldLogin.password, 'form_login_id', 'form_login_pass');
                lm.modifyLogin(oldLoginInfo, login);
            }else{
                lm.addLogin(login);
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }
    },


    isLoggedIn: function ChaikaP2Login_isLoggedIn(){
        var psExists = this.cookieManager.cookieExists({
            host: ChaikaCore.pref.getChar("login.p2.cookie_domain"),
            path: '/',
            name: 'PS'
        });

        var cidExists = this.cookieManager.cookieExists({
            host: ChaikaCore.pref.getChar("login.p2.cookie_domain"),
            path: '/',
            name: 'cid'
        });

        ChaikaCore.logger.debug('ps exists:' + psExists + '; cid exists:' + cidExists);

        //クッキーがあればログイン済みである
        this._loggedIn = psExists && cidExists;

        return this._loggedIn;
    },


    login: function ChaikaP2Login_login(){
        //確実にログアウトする
        this.logout();
        this._loggedIn = false;

        this._req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
        this._req.addEventListener('load', this, false);
        this._req.addEventListener('error', this, false);

        var account = this.getLoginInfo();
        var formStr = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        var mail = "form_login_id=" + encodeURIComponent(account.id);
        var pass = "form_login_pass=" + encodeURIComponent(account.password);
        var extra = "ctl_register_cookie=1&register_cookie=1&submit_userlogin=%83%86%81%5B%83U%83%8D%83O%83C%83%93";
        formStr.data = [mail, pass, extra].join("&");

        this._req.open("POST", ChaikaCore.pref.getChar("login.p2.login_url"), true);
        this._req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        this._req.send(formStr);
    },


    logout: function ChaikaP2Login_logout(){
        //クッキーを削除する
        this.cookieManager.remove(ChaikaCore.pref.getChar("login.p2.cookie_domain"), 'PS', '/', false);
        this.cookieManager.remove(ChaikaCore.pref.getChar("login.p2.cookie_domain"), 'cid', '/', false);
        this._loggedIn = false;

        //ログアウトを通知
        this.os.notifyObservers(null, "ChaikaP2Login:Logout", "OK");
    },


    handleEvent: function(event){
        //XMLHttpRequestでない場合は終了
        if(!this._req) return;


        //一度ブラウザでログインしないとCookieを受け取れない問題への対策
        //強制的に送られてきたCookieを追加する
        var cookieStr = this._req.getResponseHeader('Set-Cookie');
        var cookies = parseCookie(cookieStr.replace(/\n/g, ', '));

        cookies.forEach(function(cookie){
            if(cookie.options.value !== 'deleted' && cookie.options.domain){
                this.cookieManager.add(
                    cookie.options.domain,
                    cookie.options.path,
                    cookie.name,
                    cookie.value,
                    false, false, false,
                    cookie.options.expires ?
                        cookie.options.expires.getTime() / 1000 :
                        ( Date.now() / 1000 ) + ( 7 * 24 * 60 * 60 )
                );
            }
        }, this);


        //ログインの成功の可否を通知する
        if(this.isLoggedIn()){
            this.os.notifyObservers(null, "ChaikaP2Login:Login", "OK");
        }else{
            ChaikaCore.logger.error('Fail to login p2.\n\n' +
                                    '[Status] ' + this._req.status + '\n' +
                                    '[Header] ' + this._req.getAllResponseHeaders());
            this.logout();
            this.os.notifyObservers(null, "ChaikaP2Login:Login", "NG");
        }

        this._req = null;
    },


    /**
     * 書き込みページからcsrfidを得る
     * @param {String} host 書き込み先のホスト
     * @param {String} bbs 書き込み先の板名
     * @param {Number} [datID] 書き込み先のdat ID 省略した場合はスレ立てになる
     * @return {String} csrfid 取得できなかった場合は null を返す
     */
    getCsrfid: function(host, bbs, datID){
        if(!this.isLoggedIn()) return null;

        var csrfid_url = ChaikaCore.pref.getChar('login.p2.csrfid_url');
        var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

        req.open('GET', csrfid_url + '?host=' + host + '&bbs=' + bbs +
                 (datID ? '&key=' + datID : '&newthread=1'), false);
        req.send(null);

        if(req.status !== 200) return null;

        var csrfid = req.responseText.match(/csrfid" value="([a-zA-Z0-9]+)"/);

        if(csrfid){
            return csrfid[1];
        }else{
            return null;
        }
    }
};
