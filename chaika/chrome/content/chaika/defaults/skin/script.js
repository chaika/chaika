/* See license.txt for terms of usage */

'use strict';

/**
 * Polyfill for Firefox 39-
 */
if(!String.prototype.includes){
    String.prototype.includes = function(){'use strict';
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}


/* *** Utils *** */
var $ = {

    /**
     * id から要素を取得
     * @param {String} id ID
     * @return {Node}
     */
    id: function(id){
        return document.getElementById(id);
    },

    /**
     * class から要素を取得
     * @param {String} className class 名
     * @param {Node} [parent=document] 親要素
     * @param {Boolean} [noExtract=false] 要素が1つの時にも展開しない
     * @return {Array.<Node>|Node}
     */
    klass: function(className, parent, noExtract){
        let result = (parent || document).getElementsByClassName(className);
        return noExtract || result.length > 1 ? Array.from(result) : result[0];
    },

    /**
     * 要素名から要素を取得
     * @param {String} tagName 要素名
     * @param {Node} [parent=document] 親要素
     * @return {Array.<Node>}
     */
    tag: function(tagName, parent){
        return Array.from((parent || document).getElementsByTagName(tagName));
    },

    /**
     * CSS Selector から要素を取得
     * @param {String} selector セレクタ
     * @param {Node} [parent=document] 親要素
     * @return {Node}
     */
    selector: function(selector, parent){
        return (parent || document).querySelector(selector);
    },

    /**
     * CSS Selector から要素を取得
     * @param {String} selector セレクタ
     * @param {Node} [parent=document] 親要素
     * @return {Array.<Node>}
     */
    selectorAll: function(selector, parent){
        return Array.from((parent || document).querySelectorAll(selector));
    },


    /**
     * TextRectangle を取得
     * @param {Node} element 対象の要素
     * @return {TextRectangle}
     */
    rect: function(element){
        return element.getBoundingClientRect();
    },

    /**
     * 表示状態にする
     * @param {Node} element 対象の要素
     * @return {Node}
     */
    show: function(element){
        $.css(element, { display: 'initial' });
        return element;
    },

    /**
     * 非表示にする
     * @param {Node} element 対象の要素
     * @return {Node}
     */
    hide: function(element){
        $.css(element, { display: 'none' });
        return element;
    },

    /**
     * CSS スタイルを設定する
     * @param {Node} element 対象の要素
     * @return {Node}
     * @note プロパティ名はキャメルケース化してある必要あり
     */
    css: function(element, cssList){
        for(let property in cssList){
            element.style[property] = cssList[property];
        }
        return element;
    },

    /**
     * ノードを生成する
     * 以下の nodeList により生成するノードを指定する
     * @param {Object} nodeList キーに要素名、値に属性をもつオブジェクト 属性の指定方法は $.attrs に準ずる
     * @return {Node|DocumentFragment} もし最上位が１つのノードからなる場合はそのノードが,
     *                                 複数のノードの場合は DocumentFragment が返る
     * @example { 'div': { id: 'hoge', children: { 'span': text: 'fuga' } } }
     *         -> <div id="hoge"><span>fuga</span></div>
     * @see $.attrs
     */
    node: function(nodeList){
        var fragment = document.createDocumentFragment();

        for(let tagName in nodeList){
            let element = document.createElement(tagName);

            if(nodeList[tagName] instanceof Object){
                $.attrs(element, nodeList[tagName]);
            }

            fragment.appendChild(element);
        }

        return fragment.childNodes.length === 1 ? fragment.firstChild : fragment;
    },

    /**
     * 要素に属性を指定する、もしくは属性値を取得する
     * @param {Node} element 対象の要素
     * @param {Object|String} 属性
     *     String が渡された場合はその属性の値を返す
     *     キーに属性名、値に属性値を持つハッシュが渡された場合は、それらの値をまとめて設定する
     *     特殊な属性名として children, text がある
     *         {nodeList|Node} children 指定された要素を子要素として追加する $.node の nodeList 形式でも指定可能
     *         {String} text 指定されたテキストを子要素として追加する children と共に指定された場合の挙動は未定義
     * @return {Node|String}
     * @see $.node
     */
    attrs: function(element, attrs){
        if(attrs instanceof Object){
            for(let name in attrs){
                if(name === 'children'){
                    if(!(attrs.children instanceof Node)){
                        attrs.children = $.node(attrs.children);
                    }

                    element.appendChild(attrs.children);
                }else if(name === 'text'){
                    element.appendChild(document.createTextNode(attrs.text));
                }else{
                    element.setAttribute(name, attrs[name]);
                }
            }

            return element;
        }else{
            return element.getAttribute(attrs);
        }
    },

    /**
     * フォームの値を取得する
     * @param {Node} formElement 値を取得したい要素
     * @return {String|Boolean}
     */
    getValue: function(formElement){
        let value;

        switch(formElement.type){
            case 'text':
                value = formElement.value;
                break;

            case 'checkbox':
                value = formElement.checked;
                break;

            default:
                value = formElement.value;
                break;
        }

        return value;
    },

    /**
     * フォーム要素に値を設定する
     * @param {Node} formElement 設定先
     * @param {String|Boolean} aValue 設定値
     */
    setValue: function(formElement, aValue){
        switch(formElement.type){
            case 'text':
                formElement.value = aValue;
                break;

            case 'checkbox':
                formElement.checked = aValue;
                break;

            case 'select-one':
            case 'select-multiple': {
                if(!Array.isArray(aValue)) return;

                while(formElement.hasChildNodes()){
                    formElement.removeChild(formElement.firstChild);
                }

                aValue.forEach((v) => {
                    let option = document.createElement('option');

                    $.attrs(option, {
                        value: v,
                        text: v,
                    });

                    formElement.add(option);
                });
            }
            break;

            default:
                formElement.value = aValue;
                break;
        }
    },


    /**
     * 指定した要素までスクロールする
     * @param {Element} element スクロール先の要素
     * @param {Boolean} [ignoreHeader=false] ページヘッダーの分を考慮しないようにする
     */
    scrollToElement: function(element, ignoreHeader){
        if(!element) return;

        let top = element.offsetTop;

        if(!ignoreHeader){
            top -= $.rect($.tag("header")[0]).height;
        }

        window.scrollTo(0, top - 30);
    }
};


/* *** Effects *** */
var Effects = {
    fadein: function(element, option){
        option = option || {};

        $.css(element, {
            'animationName': 'fadein',
            'animationDuration': option.speed || '0.3s',
        });
    },

    fadeout: function(element, option){
        option = option || {};

        $.css(element, {
            'animationName': 'fadeout',
            'animationDuration': option.speed || '0.3s',
        });

        if(option.remove){
            element.addEventListener('animationend', function(){
                this.remove();
            });
        }
    },

    slidedown: function(element, option){
        option = option || {};

        $.css(element, {
            'animationName': 'slidedown',
            'animationDuration': option.speed || '0.3s',
        });

        if(option.remove){
            element.addEventListener('animationend', function(){
                this.remove();
            });
        }
    },

    slideup: function(element, option){
        option = option || {};

        $.css(element, {
            'animationName': 'slideup',
            'animationDuration': option.speed || '0.3s',
        });
    },
};


/**
 * Notifications API を利用した通知を扱う
 * @class
 */
var Notifications = {

    /**
     * Notifications API に関する permission を得る
     * @return {Promise<void>} Resolved if granted and rejected if denied.
     * @note new Notification() をする前に必ず呼ぶこと.
     */
    _getPermission(){
        return new Promise((resolve, reject) => {
            if(Notification.permission === 'granted'){
                resolve();
            }else if(Notification.permission === 'denied'){
                reject();
            }else{
                Notification.requestPermission((permission) => {
                    if(permission === 'granted'){
                        resolve();
                    }else{
                        reject();
                    }
                });
            }
        });
    },


    /**
     * Notification API を利用して通知を表示する
     * @param  {String} message 本文に表示する文章
     * @param  {String} [tag='chaika'] 通知のタグ
     * @return {Promise<Notification>}
     */
    notify(message, tag = 'chaika') {
        return this._getPermission().then(() => {
            // Returning the generated Notification Object
            // so that the caller can use this object to manipurate
            // and the below code won't be eliminated by JS engine and GC.
            return (new Notification('chaika', {
                tag: tag,
                body: message,
                icon: SERVER_URL + 'icon.png'
            }));
        });
    }

};


/**
 * 設定項目を扱う
 */
var Prefs = {

    /**
     * デフォルトの設定値
     * @type {Object}
     */
    defaultValue: {
        // 書き込みの情報
        'pref-enable-referred-count': true,
        'pref-enable-posts-count': true,

        // アンカー
        'pref-limit-number-of-anchors': 5,
        'pref-limit-range-of-anchor': 15,

        // ポップアップ
        'pref-include-self-post': false,
        'pref-disable-single-id-popup': false,
        'pref-delay-popup': false,
        'pref-enable-non-strict-image-detection': false,
        'pref-invert-res-popup-dir': false,
        'pref-invert-image-popup-dir': false,
        'pref-invert-id-popup-dir': false,
        'pref-invert-refres-popup-dir': false,
        'pref-max-posts-in-popup': 20,

        // ショートカットキー
        'pref-enable-shortcut': true,
        'pref-enable-resjump': true,

        // 返信通知
        'pref-enable-reply-notification': true,
        'pref-highlight-my-posts': true,
        'pref-highlight-replies-to-me': true,
    },


    startup: function(){
        this._populateSettingsPanel();

        $.id('settings').addEventListener('change', this._onPrefChanged.bind(this), false);
        $.id('settings').addEventListener('blur', this._onPrefChanged.bind(this), false);
        $.id('settings').addEventListener('keydown', this._onKeydown.bind(this), false);
    },


    /**
     * スクロール位置を保持したままダイアログを閉じる
     */
    close: function(){
        let scrollX = window.scrollX;
        let scrollY = window.scrollY;

        location.hash = "";
        window.scrollTo(scrollX, scrollY);
    },


    /**
     * 設定項目を取得する
     */
    get: function(key){
        let value;

        try{
            value = JSON.parse(localStorage.getItem(key));
        }catch(ex){
            // localStorage へのアクセスが拒否された場合
            value = this.defaultValue[key];
        }

        if(value === null){
            value = this.defaultValue[key];
        }

        return value;
    },


    /**
     * 設定項目を設定する
     */
    set: function(key, value){
        try{
            localStorage.setItem(key, JSON.stringify(value));
            this._populateSettingsPanel();
        }catch(ex){
            console.warn('The change is ignored and will not be saved ' +
                         'because writing to the local storage is prohibited by the user.');
        }
    },


    /**
     * 設定画面へ設定値を反映させる
     */
    _populateSettingsPanel: function(){
        let prefNodes = $.selectorAll('[id^="pref-"]');

        prefNodes.forEach((prefNode) => {
            let key = prefNode.id;
            let value = this.get(key);

            $.setValue(prefNode, value);
        });

        let listNodes = $.selectorAll('[id^="list-"]');

        listNodes.forEach((listNode) => {
            let key = listNode.id;
            let value = this.get(key) || [];

            $.setValue(listNode, value[BOARD_URL] || value[EXACT_URL] || value);
        });
    },


    /**
     * 設定画面にて設定値が変更された際に呼ばれる
     */
    _onPrefChanged: function(aEvent){
        let target = aEvent.originalTarget;
        let key = target.id;

        if(!key.startsWith('pref-')) return;

        let value = $.getValue(target);

        this.set(key, value);
    },


    /**
     * 設定画面にてキーが押された時に呼ばれる
     * @todo 実装が綺麗でないので見直す
     */
    _onKeydown: function(aEvent){
        if(aEvent.key !== 'Backspace' && aEvent.key !== 'Delete') return;

        let target = aEvent.target;

        switch(target.id){
            case 'list-my-posts': {
                let selected = target.selectedOptions[0];
                let id = selected.value;
                let database = Prefs.get('list-my-posts');
                let index = database[EXACT_URL].indexOf(id);

                database[EXACT_URL].splice(index, 1);
                Prefs.set('list-my-posts', database);
                target.remove(target.selectedIndex);
                ResInfo.markAndCheckReplyToMyPosts();
            }
            break;

            case 'list-my-ids': {
                let selected = target.selectedOptions[0];
                let id = selected.value;
                let database = Prefs.get('list-my-ids');
                let index = database[BOARD_URL].indexOf(id);

                database[BOARD_URL].splice(index, 1);
                Prefs.set('list-my-ids', database);
                target.remove(target.selectedIndex);
                ResInfo.markAndCheckReplyToMyPosts();
            }
            break;
        }
    }
};


/**
 * スレッドの情報を扱う
 */
var ThreadInfo = {

    startup: function(){
        let footer = $.tag('footer')[0];
        let info = $.id('thread-info');

        info.textContent = info.textContent.replace('%GETRESCOUNT%', footer.dataset.getres)
                                           .replace('%NEWRESCOUNT%', footer.dataset.newres)
                                           .replace('%ALLRESCOUNT%', footer.dataset.allres)
                                           .replace('%SIZEKB%', footer.dataset.size);

        info.dataset.populated = true;
    }

};


/**
 * 全レスを走査しないと得られない情報を扱う
 */
var ResInfo = {

    startup: function(){
        this.countPosts();
        this.markAndCheckReplyToMyPosts();
        this.highlightHighlightedPosts();
    },


    /**
     * 発言数と逆参照をカウントする
     */
    countPosts() {
        let enableRefCount = Prefs.get('pref-enable-referred-count');
        let enablePostsCount = Prefs.get('pref-enable-posts-count');

        //全レス操作を必要とする設定が有効でない場合にはなにもしない
        if(!enableRefCount && !enablePostsCount) return;

        // ID別の発言数を数えるためのテーブル
        // key: ID, value: 回数
        let idTable = {};

        let resNodes = $.klass('resContainer', document, true);

        resNodes.forEach((resNode) => {
            // ID別発言数
            if(enablePostsCount){
                let id = resNode.dataset.id;

                if(!ResCommand.isAnonymousID(id)){
                    if(!(id in idTable)){
                        idTable[id] = 1;
                    }else{
                        idTable[id]++;
                    }

                    $.klass('resHeaderContent', resNode).dataset.idPostsIndex = idTable[id];
                }
            }


            //逆参照
            if(enableRefCount){
                let anchors = ResCommand.getAnchors(resNode);

                anchors.forEach((anchor) => {
                    let { start, end } = anchor;

                    for(let i = start; i <= end; i++){
                        let refNode = $.id('res' + i);

                        //範囲外レスはスキップ
                        if(!refNode) continue;

                        let refNumber = $.klass('resNumber', refNode);

                        if(!refNumber.dataset.referred){
                            refNumber.dataset.referred = resNode.id;
                        }else{
                            refNumber.dataset.referred += ',' + resNode.id;
                        }

                        if(!refNumber.dataset.referredNum){
                            refNumber.dataset.referredNum = 1;
                        }else{
                            refNumber.dataset.referredNum = refNumber.dataset.referredNum - 0 + 1;
                        }
                    }
                });
            }
        });

        // ID別総発言数を表示する
        if(enablePostsCount){
            for(let id in idTable){
                if(typeof idTable[id] !== 'number') continue;

                let idNodes = $.selectorAll('.resContainer[data-id="' + id + '"] > .resHeader > .resHeaderContent');
                if(!idNodes) continue;

                idNodes.forEach((idNode) => {
                    idNode.dataset.idPostsAll = idTable[id];
                });
            }
        }
    },


    /**
     * 自分のレスへの返信をチェックし, 自分のレスと返信にマークをつけ, 通知を行う
     */
    markAndCheckReplyToMyPosts() {
        let enableNotification = Prefs.get('pref-enable-reply-notification');
        let enableHighlightMe = Prefs.get('pref-highlight-my-posts');
        let enableHighlightReplies = Prefs.get('pref-highlight-replies-to-me');

        let myPostNums = (Prefs.get('list-my-posts') || {})[EXACT_URL];
        let myIDs = (Prefs.get('list-my-ids') || {})[BOARD_URL];
        let myPosts = [];

        // Resetting previous states
        $.selectorAll('.my-post, .reply-to-me').forEach((post) => {
            post.classList.remove('my-post');
            post.classList.remove('reply-to-me');
            post.classList.remove('highlighted');
        });

        // Collecting "My Posts"
        if(myPostNums){
            myPosts = myPostNums.map((resNumber) => {
                return $.selector('article[data-number="' + resNumber + '"]');
            });
        }

        if(myIDs){
            myPosts = myIDs.reduce((arr, id) => {
                return arr.concat($.selectorAll('article[data-id="' + id + '"]'));
            }, myPosts);
        }

        let repliesCount = 0;

        myPosts.forEach((res) => {
            let resNum = $.klass('resNumber', res);

            res.classList.add('my-post');

            if(enableHighlightMe){
                res.classList.add('highlighted');
            }

            if(resNum.dataset.referred){
                resNum.dataset.referred.split(',').forEach((refID) => {
                    let ref = $.id(refID);

                    ref.classList.add('reply-to-me');

                    if(ref.classList.contains('resNew')){
                        repliesCount++;
                    }

                    if(enableHighlightReplies){
                        ref.classList.add('highlighted');
                    }
                });
            }
        });

        if(enableNotification && repliesCount){
            let firstReplyNum = $.klass('reply-to-me', null, true)[0].dataset.number;

            Notifications.notify(
                `あなたの投稿に ${repliesCount} 件の新着の返信があります.\n` +
                `クリックすると先頭の返信レス (>>${firstReplyNum}) を表示します.`,
                'chaika-reply-notification'
            ).then((n) => {
                // click-to-scroll
                n.addEventListener('click', () => {
                    ResCommand.scrollTo(firstReplyNum);
                });
            });
        }
    },


    /**
     * ハイライトレスと判定されたレスにハイライト用のクラスを追加する
     * @note
     *    chaika 側では, "名前", "本文" など個々の要素ごとに扱っており,
     *    レス全体に 'highlighted' のようなクラスをつけることができない.
     *    そのため, レス全体にスタイルを適用するにはスキン側でクラスを追加する必要がある.
     */
    highlightHighlightedPosts() {
        let posts = $.klass('highlightedRes', null, true);

        posts.forEach((post) => {
            post.closest('.resContainer').classList.add('highlighted');
        });
    }

};



/**
 * スレッドに対するコマンドの実装
 */
var ThreadCommand = {

    /**
     * スレッドに書き込む
     */
    write: function(){
        try{
            location.href = 'chaika://post/' + EXACT_URL;
        }catch(ex){
            console.warn(ex.name + ' occurred, but it has been ignored.');
        }
    },


    /**
     * 新着レスへ移動する
     */
    scrollToNewMark: function(){
        $.scrollToElement($.id("newMark"));
    },


    /**
     * 現在ウィンドウの表示領域にあるレスのうち, もっとも上にあるものを取得する
     * @return {Element}
     */
    _getCurrentRes: function(){
        let left = document.documentElement.clientWidth / 2;
        let top = $.rect($.tag("header")[0]).bottom + 40;
        let res;

        while(!res){
            let element = document.elementFromPoint(left, top);

            res = element.closest('.resContainer');
            top += 8;
        }

        return res;
    },


    /**
     * 次のレスへ移動する
     */
    scrollToNextRes: function(){
        $.scrollToElement(this._getCurrentRes().nextElementSibling);
    },


    /**
     * 前のレスへ移動する
     */
    scrollToPrevRes: function(){
        $.scrollToElement(this._getCurrentRes().previousElementSibling);
    },


    /**
     * 次のハイライトされたレスへ移動する
     */
    scrollToNextHighlightedRes: function(){
        let current = this._getCurrentRes();
        let currentNum = current.dataset.number;
        let next = $.selector(`article[data-number="${currentNum}"] ~ .highlighted`);

        if(next){
            $.scrollToElement(next);
        }
    },


    /**
     * 前のハイライトされたレスへ移動する
     */
    scrollToPrevHighlightedRes: function(){
        let current = this._getCurrentRes();
        let prev = current.previousElementSibling;

        while(!prev.classList.contains('highlighted') && prev.classList.contains('resContainer')){
            prev = prev.previousElementSibling;
        }

        if(prev.classList.contains('highlighted')){
            $.scrollToElement(prev);
        }

    },


    /**
     * スレッドを再読込する
     */
    reload: function(){
        location.reload();
    }
};



/**
 * レスに対するコマンドの実装
 */
var ResCommand = {

    startup: function(){
        document.addEventListener('click', this, false);
        document.addEventListener('contextmenu', this, false);
    },


    handleEvent: function(aEvent){
        let target = aEvent.originalTarget;

        // HTML 外要素の場合
        if(!(target instanceof HTMLElement)) return;


        switch(target.className){
            case 'resNumber': {
                if(aEvent.button === 0){  // Left click
                    this.replyTo(target.textContent);
                }else if(aEvent.button === 2){  // Right click
                    aEvent.preventDefault();
                    aEvent.stopPropagation();
                    this.showPopupMenu(target.textContent, aEvent.clientX, aEvent.clientY);
                }
            }
            break;

            default: {
                let resPopupMenu = target.closest('.resPopupMenu');

                if(resPopupMenu && target.dataset.command){
                    $.hide(resPopupMenu);
                    this[target.dataset.command](resPopupMenu.dataset.target - 0);
                    return;
                }

                $.hide($.id('resPopupMenu'));

                let container = target.closest('.resContainer');
                let header = target.closest('.resHeader');

                if(header && container.dataset.aboned === 'true'){
                    this.toggleCollapse(container);
                    return;
                }
            }
            break;
        }
    },


    /**
     * 返信する
     * @param {Number} resNumber 返信元のレス番号
     */
    replyTo: function(resNumber){
        try{
            location.href = 'chaika://post/' + EXACT_URL + resNumber;
        }catch(ex){
            console.warn(ex.name + ' occurred, but it has been ignored.');
        }
    },


    /**
     * 指定したレスの位置までスクロールする
     * @param {Number} resNumber スクロール先のレス番号
     */
    scrollTo: function(resNumber){
        $.scrollToElement($.selector('article[data-number="' + resNumber + '"]'));
    },


    /**
     * レスの表示/非表示を切り替える
     * @param {Element} resContainer 対象のレス要素
     */
    toggleCollapse: function(resContainer){
        resContainer.classList.toggle('collapsed');
    },


    /**
     * 与えられたレス番号を自分のレスとして登録する
     * すでに登録されていた場合は削除する
     * @param {Number} resNumber
     */
    markAsMyPost(resNumber) {
        let database = Prefs.get('list-my-posts') || {};

        if(!database[EXACT_URL]){
            database[EXACT_URL] = [];
        }

        let index = database[EXACT_URL].indexOf(resNumber);

        if(index !== -1){
            database[EXACT_URL].splice(index, 1);
        }else{
            database[EXACT_URL].push(resNumber);
        }

        Prefs.set('list-my-posts', database);
        ResInfo.markAndCheckReplyToMyPosts();
    },


    /**
     * 自分のIDとして登録する
     * @param {Number} resNumber
     */
    markAsMyID(resNumber) {
        let res = $.selector('article[data-number="' + resNumber + '"]');
        let id = res.dataset.id;
        let database = Prefs.get('list-my-ids') || {};

        if(this.isAnonymousID(id)){
            return;
        }

        if(!database[BOARD_URL]){
            database[BOARD_URL] = [];
        }

        let index = database[BOARD_URL].indexOf(id);

        if(index !== -1){
            database[BOARD_URL].splice(index, 1);
        }else{
            database[BOARD_URL].push(id);
        }

        Prefs.set('list-my-ids', database);
        ResInfo.markAndCheckReplyToMyPosts();
    },


    /**
     * レスポップアップメニューを表示する
     * @param {Number} resNumber 呼び出し元のレス番号
     */
    showPopupMenu(resNumber, x, y) {
        let popup = $.id('resPopupMenu');

        popup.dataset.target = resNumber;
        $.css(popup, {
            position: 'fixed',
            top: y + 'px',
            left: x + 'px',
        });
        $.show(popup);
    },


    /**
     * アンカの情報を得る
     * @param {Number|Node} post 対象のレス
     * @param {Boolean} [ignoreLimits=false] アンカ数上限などの制限を無視するか
     */
    getAnchors(post, ignoreLimits){
        let resNode = post instanceof Element ? post : $.selector(`article[data-number="${post}"]`);
        let anchors = resNode.classList.contains('resPointer') ?
                        [ resNode ] :
                        $.klass('resPointer', resNode, true);

        if(!anchors || !anchors.length) return [];

        let numberLimit = Prefs.get('pref-limit-number-of-anchors') - 0;
        let rangeLimit = Prefs.get('pref-limit-range-of-anchor') - 0;

        // Exceeded the limit of # anchors in a post.
        if(!ignoreLimits && numberLimit && anchors.length >= numberLimit){
            return [];
        }

        anchors = anchors.reduce((ary, node) => {
            return ary.concat(node.textContent.match(/(?:\d{1,4}-\d{1,4}|\d{1,4}(?!-))/g));
        }, []).map((anc) => {
            let [start, end = 0] = anc.split('-');

            start = start - 0;
            end = end - 0;

            if(!start || start <= 0){
                return null;
            }

            if(!end){
                return { start, end: start };
            }

            if(end < start){
                [start, end] = [end, start];
            }

            if(!ignoreLimits && rangeLimit && (end - start + 1) >= rangeLimit){
                return null;
            }

            return { start, end };
        }).filter((anc) => !!anc);

        return anchors;
    },


    /**
     * ID が匿名かどうか調べる
     * @param {String} id
     * @return {Boolean}
     */
    isAnonymousID (id) {
        let isEmptyID = !id || id.trim().length <= 1;
        let isAnonymousID = id.startsWith('???');

        return isEmptyID || isAnonymousID;
    }

};



/**
 * キーショートカットを扱う
 */
var ShortcutHandler = {

    /**
     * ショートカットキーと機能とのマッピング
     *
     * @note
     *    押したキーの名称の前に, 押された修飾キーがアルファベット順に + で結合されます.
     *    修飾キーの名称は
     *       https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState
     *    を, キーの名称は
     *       https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent.key#Key_values
     *    を参照してください.
     *
     * @example
     *    押すキー -> 記述する文字列
     *       w -> "w" (実際に入力されるキーが名称となる)
     *       / -> "/" (記号の場合も同様)
     *     Enter -> "Enter" (一部のキーは特別に名前が付いている)
     *    Control, w -> "Control+w" (修飾キーと共に押した場合は + で結合される)
     *    Shift, w -> "Shift+w" (Shiftキー+アルファベットでは特例としてアルファベットが大文字にならずに結合)
     *    Shift, 2 -> "Shift+@" (実際に入力される記号が名称となる. 例は US キーボードの場合.)
     *    Command, Shift, w -> "Shift+Meta+w" (修飾キーはアルファベット順で結合する)
     *    Shift -> "Shift+Shift" (修飾キーのみの場合は処理の都合上特殊な表記になってしまう)
     * @note 機能はキーを押した時に実行する関数をそのまま記述してください.
     * @see ThreadCommand, ResCommand
     */
    keyMap: {
        'Control+Enter': function(){ ThreadCommand.write(); },
        'Shift+Enter': function(){ ThreadCommand.write(); },
        'w': function(){ ThreadCommand.write(); },
        'r': function(){ ThreadCommand.reload(); },
        'n': function(){ ThreadCommand.scrollToNewMark(); },
        'j': function(){ ThreadCommand.scrollToNextRes(); },
        'k': function(){ ThreadCommand.scrollToPrevRes(); },
        'u': function(){ ThreadCommand.scrollToNextHighlightedRes(); },
        'i': function(){ ThreadCommand.scrollToPrevHighlightedRes(); },
        'f': function(){ window.scrollByPages(1); },
        'b': function(){ window.scrollByPages(-1); },
    },


    /**
     * 押した数字キーを格納するスタック
     * @type {Array.<String>}
     */
    _numKeyStack: [],


    /**
     * 1回の操作であると認識する時間 [ms]
     * @type {Number}
     */
    _threshold: 500,


    startup: function(){
        if(Prefs.get('pref-enable-shortcut')){
            document.addEventListener('keydown', this, false);
        }
    },


    handleEvent: function(aEvent){
        if(aEvent.defaultPrevented) return;
        if(/(?:textarea|input|select|button)/i.test(aEvent.target.tagName)) return;

        let keyStr = aEvent.key;

        // Shift を押した場合などにアルファベットが大文字になるのを修正する
        if(keyStr.length === 1){
            keyStr = keyStr.toLowerCase()
        }

        // 修飾キーの状態を調査する
        // キーの名称は
        //    https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState
        // より取得.
        // NumLock などの XXXLock 系のキーは, 混乱のもとになるので調査しない.
        //    ref. http://jbbs.shitaraba.net/bbs/read.cgi/computer/44179/1426703154/864-865
        [
            'Alt', 'AltGraph', 'Control', 'Fn', 'Hyper', 'Meta', 'OS', 'Shift', 'Super', 'Symbol',
        ].forEach((key) => {
            if(aEvent.getModifierState(key)){
                keyStr = key + '+' + keyStr;
            }
        });

        if(this.keyMap[keyStr]){
            aEvent.preventDefault();
            this.keyMap[keyStr]();
            this._numKeyStack.length = 0;
        }

        // Press number keys to move to the position of the specific post.
        if(Prefs.get('pref-enable-resjump') && /^\d$/.test(aEvent.key)){
            aEvent.preventDefault();

            this._numKeyStack.push(aEvent.key);
            ResCommand.scrollTo(this._numKeyStack.join(''));

            if(this._timer){
                clearTimeout(this._timer);
            }

            this._timer = setTimeout(() => { this._numKeyStack.length = 0; }, this._threshold);
        }
    }
};




/**
 * 即時あぼーんを扱う
 */
var AboneHandler = {

    startup: function(){
        document.addEventListener("chaika-abone-add", this, false);
        document.addEventListener('chaika-abone-remove', this, false);
    },


    handleEvent: function(aEvent){
        var aboneType = aEvent.sourceEvent.type;
        var aboneWord = aEvent.sourceEvent.detail;
        var aboneAdded = aEvent.type === 'chaika-abone-add';

        if(aboneType === 'ex'){
            this._exOnDemandAbone(aboneWord, aboneAdded);
        }else{
            this._simpleOnDemandAbone(aboneType, aboneWord, aboneAdded);
        }
    },


    /**
     * 単純型の即時あぼーんを行う
     * @param  {String} ngType     NG の種類 'name', 'mail', 'id', or 'word'
     * @param  {String} ngWord     NG の内容
     * @param  {Boolean} aboneAdded NG追加のイベントなら true
     */
    _simpleOnDemandAbone: function(ngType, ngWord, aboneAdded){
        let className = "";

        switch(ngType){
            case 'name':    // ChaikaAboneManager.ABONE_TYPE_NAME
                className = "resName";
                break;

            case 'mail':    // ChaikaAboneManager.ABONE_TYPE_MAIL
                className = "resMail";
                break;

            case 'id':    // ChaikaAboneManager.ABONE_TYPE_ID
                className = "resID";
                break;

            case 'word':    // ChaikaAboneManager.ABONE_TYPE_WORD
                className = "resBody";
                break;

            default:
                return;
        }

        let targets = $.klass(className);

        targets.forEach((target) => {
            if(!target.textContent.includes(ngWord)) return;

            let res = target.closest('.resContainer');
            let header = $.klass('resHeader', res);

            if(aboneAdded && res.dataset.aboned !== 'true'){
                res.classList.add('collapsed');
                res.dataset.aboned = 'true';
                header.dataset.ngtitle = ngWord;
            }

            if(!aboneAdded && res.dataset.aboned === 'true'){
                res.classList.remove('collapsed');
                res.dataset.aboned = 'false';
                header.dataset.ngtitle = '';
            }
        });
    },


    /**
     * NGEx の即時あぼーんを行う
     * @unimplemented
     */
    _exOnDemandAbone: function(ngData, aboneAdded){
        // we ignore NGEx on-demand abone for the time being,
        // because it is difficult to implement.
    }

};


/**
 * ポップアップを扱う
 * @class
 */
var Popup = {

    /**
     * ポップアップを表示するまでの遅延時間
     * @type {Number}
     */
    POPUP_DELAY: 200,


    startup: function(){
        document.addEventListener('mouseover', this.mouseover, false);
        document.addEventListener('mouseout', this.mouseout, false);
    },


    mouseover: function(aEvent){
        var target = aEvent.target;
        if(!(target instanceof HTMLElement)) return;

        //Beリンク
        if(target.href && target.href.includes('be.2ch')){
            target = target.parentNode;
        }

        //本文中のIDリンク
        if(target.className.startsWith("mesID_")){
            Popup.ID.mouseover(aEvent);
            return;
        }

        switch(target.className){
            case "resPointer":
                Popup.Res.mouseover(aEvent);
                break;

            case 'resNumber':
                Popup.RefRes.mouseover(aEvent);
                break;

            case "resID":
            case "resMesID":
            case 'resIP':
            case 'resHost':
            case 'resBeID':
                Popup.ID.mouseover(aEvent);
                break;

            case "outLink":
                Popup.Image.mouseover(aEvent);
                break;

            default:
                break;
        }
    },


    mouseout: function(aEvent){
        var target = aEvent.target;

        if(!(target instanceof HTMLElement)) return;
        if(target.className === "") return;

        if(target._popupTimeout){
            clearTimeout(target._popupTimeout);
            delete target._popupTimeout;
        }
    },


    /**
     * ポップアップがウィンドウ領域を突き出ないよう位置を補正する
     * @param  {Element} baseNode       基準となるノード
     * @param  {Element} popupNode      ポップアップノード
     * @param  {Boolean} invertDirection 反転しているか否か
     */
    _adjustPopupPosition: function(baseNode, popupNode, invertDirection){
        let baseRect = $.rect(baseNode);
        let popupRect = $.rect(popupNode);

        let scrollX = window.scrollX;
        let scrollY = window.scrollY;
        let innerWidth = window.innerWidth;
        let innerHeight = window.innerHeight;

        let top = scrollY + baseRect.bottom - 2;
        let bottom = innerHeight - scrollY - baseRect.top - 2;
        let left = scrollX + baseRect.left;

        //右端
        if(left + popupRect.width > scrollX + innerWidth){
            left = scrollX + innerWidth - popupRect.width;
        }

        //下端
        if(top + popupRect.height > scrollY + innerHeight){
            top = scrollY + innerHeight - popupRect.height;
        }

        //上端
        if(innerHeight - (bottom + popupRect.height) < scrollY){
            bottom = innerHeight - scrollY - popupRect.height;
        }

        $.css(popupNode, {
            top: !invertDirection ? top + 'px' : '',
            bottom: invertDirection ? bottom + 'px' : '',
            left: left + 'px'
        });
    },


    /**
     * ポップアップを表示する
     * @param  {Event} aEvent
     * @param  {Element} aPopupContent   ポップアップの内容
     * @param  {String} aAddClassName    ポップアップ要素に追加するクラス名
     * @param  {Boolean} invertDirection ポップアップの向きを反転するか否か
     */
    showPopup: function(aEvent, aPopupContent, aAddClassName, invertDirection){
        if(aPopupContent.length === 0) return;

        if(aEvent.relatedTarget && aEvent.relatedTarget.className === "popup"){
            return;
        }


        let className = 'popupInner';

        if(aAddClassName){
            className += ' ' + aAddClassName;
        }

        var popupInnerNode = $.node({ 'div': { 'class': className, children: aPopupContent }});
        var popupNode = $.node({ 'div': {
            'class': 'popup',
            'id': 'popup-' + Date.now(),
            'data-inverted': !!invertDirection,
            children: popupInnerNode
        }});

        document.body.appendChild(popupNode);


        this._adjustPopupPosition(aEvent.originalTarget, popupNode, invertDirection);


        //親ポップアップがある場合は記録する
        var parent = aEvent.relatedTarget && aEvent.relatedTarget.closest('.popup');

        if(parent){
            popupNode.dataset.parent = $.attrs(parent, 'id');
        }


        //ポップアップを出したけどそのポップアップに
        //乗らないでマウスアウトした時は, そのポップアップを消去する
        aEvent.originalTarget.dataset.popup = popupNode.id;
        aEvent.originalTarget.addEventListener('mouseleave', this._fadeout, false);

        //ポップアップからマウスが出た場合はそのポップアップを消去する
        popupNode.addEventListener('mouseleave', this._fadeout, false);
    },


    /**
     * ポップアップを遅延表示する
     * @param  {Event} aEvent
     * @param  {Element} aPopupContent   ポップアップの内容
     * @param  {String} aAddClassName    ポップアップ要素に追加するクラス名
     * @param  {Boolean} invertDirection ポップアップの向きを反転するか否か
     * @param  {Number} aDelay           遅延時間
     */
    showPopupDelay: function(aEvent, aPopupContent, aAddClassName, invertDirection, aDelay){
        if(this._popupTimeout){
            clearTimeout(this._popupTimeout);
        }

        this._popupTimeout = setTimeout(() => {
            this.showPopup(aEvent, aPopupContent, aAddClassName, invertDirection);
        }, aDelay || this.POPUP_DELAY);
    },


    /**
     * mouseout した要素に応じてポップアップを消す
     */
    _fadeout: function(aEvent){
        //コンテキストメニューなどHTML要素外へマウスが移動した場合
        if(!aEvent.relatedTarget){
            return;
        }

        //消そうとしているポップアップ要素
        let targetPopup = aEvent.target;

        //ポップアップ元要素からポップアップを得る
        if(!targetPopup.classList.contains('popup')){
            if(aEvent.originalTarget.dataset.popup){
                targetPopup = $.id(aEvent.originalTarget.dataset.popup);
            }else{
                return;
            }
        }

        //今マウスが乗っているポップアップ要素
        let hoveredPopup = aEvent.relatedTarget.closest('.popup');


        //自分自身が hovered の時は消さない
        if(hoveredPopup && targetPopup.id === hoveredPopup.id){
            return;
        }

        //親ポップアップ -> 子ポップアップへの遷移のときに親ポップアップを消さない
        if(hoveredPopup && hoveredPopup.dataset.parent === targetPopup.id){
            return;
        }

        //親ポップアップ -> ポップアップ元要素への遷移の時に親ポップアップを消さない
        if(targetPopup.id === aEvent.relatedTarget.dataset.popup){
            return;
        }


        //対象ポップアップを消去
        Effects.fadeout(targetPopup, { remove: true });

        //消されたポップアップと現在マウスが乗っているポップアップ(またはその他の要素)
        //までの間にあるポップアップを消去する
        let popup = targetPopup;

        while(popup.dataset.parent){
            popup = $.id(popup.dataset.parent);

            // マウスの動きによっては親ポップアップが先に消されることもある
            if(!popup){
                break;
            }

            // 今マウスが乗っているところまできたら終了
            if(hoveredPopup && popup.id === hoveredPopup.id){
                break;
            }

            Effects.fadeout(popup, { remove: true });
        }
    },

};


/**
 * アンカーポップアップ
 * @class
 */
Popup.Res = {

    mouseover: function(aEvent){
        let link = aEvent.target;
        let anchors = ResCommand.getAnchors(link);

        Promise.all(anchors.map((anchor) => {
            let { start, end } = anchor;

            return this._createContent(start, end);
        })).then((popupContents) => {
            let fragment = document.createDocumentFragment();
            let shouldInvert = Prefs.get('pref-invert-res-popup-dir');

            popupContents.forEach((content) => fragment.appendChild(content));

            if(!$.selector('.resContainer', fragment)){
                return;
            }

            if(Prefs.get('pref-delay-popup')){
                Popup.showPopupDelay(aEvent, fragment, "ResPopup", shouldInvert);
            }else{
                Popup.showPopup(aEvent, fragment, "ResPopup", shouldInvert);
            }
        });
    },


    /**
     * ポップアップの内容を作成する
     * @param {Number} aBegin アンカの開始番号
     * @param {Number} aEnd アンカの終了番号
     */
    _createContent: function(aBegin, aEnd){
        const POPUP_LIMIT = Prefs.get('pref-max-posts-in-popup');

        //POPUP_LIMIT より多い時は省略する
        let tmpStart = aBegin;
        let omitRes = 0;

        if(POPUP_LIMIT && (aEnd - aBegin) > POPUP_LIMIT){
            aBegin = aEnd - POPUP_LIMIT;
            omitRes = aBegin - tmpStart;
        }

        var resNodes = document.createDocumentFragment();

        var promise = new Promise((resolve, reject) => {
            this._fetchResNodes(aBegin, aEnd).then(
                (posts) => {
                    resNodes.appendChild(posts);

                    if(resNodes.length > 0 && omitRes > 0){
                        resNodes.appendChild($.node({ 'p': { text: omitRes + '件省略' } }));
                    }

                    resolve(resNodes);
                },

                (data) => {
                    let posts = data[0];
                    let failedRangeEnd = data[1];

                    resNodes.appendChild(
                        $.node({ 'p': {
                            text: '>>' + aBegin + '-' + failedRangeEnd + ' の取得中にエラーが発生しました'
                        }})
                    );

                    resNodes.appendChild(posts);

                    if(resNodes.length > 0 && omitRes > 0){
                        resNodes.appendChild($.node({ 'p': { text: omitRes + '件省略' } }));
                    }

                    resolve(resNodes);
                }
            );
        });

        return promise;
    },


    /**
     * レスの内容を取得する
     * @param {Number} aBegin アンカの開始番号
     * @param {Number} aEnd アンカの終了番号
     */
    _fetchResNodes: function(aBegin, aEnd){
        var promise = new Promise((resolve, reject) => {
            let resNodes = document.createDocumentFragment();

            //表示域内にある場合はそこから取ってくる
            //通常, 表示域外にある可能性が高いのは, アンカ範囲のうち先頭部分であるから,
            //後ろから順に取得していくことにする
            for(var i = aEnd; i >= aBegin; i--){
                let resNode = $.id('res' + i);
                if(!resNode) break;

                resNode = resNode.cloneNode(true);
                resNode.removeAttribute('id');
                resNodes.insertBefore(resNode, resNodes.firstChild);
            }

            //すべて域内だった場合はこれで終了
            if(i < aBegin){
                return resolve(resNodes);
            }else{
                aEnd = i;
            }


            //域外のレスが含まれている場合は、その部分をAjaxで取ってくる
            let req = new XMLHttpRequest();

            req.addEventListener('load', (event) => {

                if(req.status !== 200 || !req.responseText){
                    console.error('Fail in getting >>' + aBegin + '-' + aEnd, 'status:', req.status);
                    return reject([resNodes, aEnd]);
                }

                let root = (new DOMParser()).parseFromString(req.responseText, 'text/html');

                // Parser Error
                if(root.documentElement.nodeName.toUpperCase() === 'PARSERERROR'){
                    console.error('Parser Error.', req.responseText);
                    return reject([resNodes, aEnd]);
                }

                let gotPosts = $.klass('resContainer', root, true);

                if(!gotPosts || gotPosts.length === 0){
                    console.error('Odd response.', req.responseText);
                    return reject([resNodes, aEnd]);
                }

                gotPosts.reverse().forEach((res) => {
                    let node = res.cloneNode(true);

                    node.removeAttribute('id');
                    resNodes.insertBefore(node, resNodes.firstChild);
                });

                return resolve(resNodes);
            }, false);

            req.open('GET', SERVER_URL + EXACT_URL + aBegin + "-" + aEnd + "n", true);
            req.overrideMimeType('text/html; charset=Shift_JIS');
            req.send(null);
        });

        return promise;
    }

};


/**
 * 逆参照ポップアップ
 * @class
 */
Popup.RefRes = {

    mouseover: function(aEvent){
        let target = aEvent.target;

        //逆参照がなかったら終了
        if(!target.dataset.referred) return;

        let popupContent = document.createDocumentFragment();

        target.dataset.referred.split(',').forEach((refID) => {
            let resNode = $.id(refID);

            if(resNode){
                resNode = resNode.cloneNode(true);
                resNode.removeAttribute('id');

                popupContent.appendChild(resNode);
            }
        });

        let dir = Prefs.get('pref-invert-refres-popup-dir');

        if(Prefs.get('pref-delay-popup'))
            Popup.showPopupDelay(aEvent, popupContent, "RefResPopup", dir);
        else
            Popup.showPopup(aEvent, popupContent, "RefResPopup", dir);
    }

};


/**
 * ID ポップアップ
 * @class
 */
Popup.ID = {

    mouseover: function(aEvent){
        var target = aEvent.target;
        var resID = target.dataset.id;

        //レス本文中の ID: リンクの場合には data-id が存在しないため
        //class 名から ID を取得する
        if(!resID && target.className.match(/mesID_([^\s]+)/)){
            resID = RegExp.$1;
        }

        // ID が無い場合, ID が匿名である場合にはポップアップしない
        if(ResCommand.isAnonymousID(resID)) return;

        //同じIDを持つレスを取得する
        var selfNumber = target.closest('.resContainer').dataset.number;
        var selector = Prefs.get('pref-include-self-post') ?
                "body > .resContainer[data-id*='" + resID + "']" :
                "body > .resContainer[data-id*='" + resID + "']:not([data-number='" + selfNumber + "'])";
        var sameIDPosts = $.selectorAll(selector);

        // 「このレスのみ」のポップアップが無効な場合
        if(!sameIDPosts.length && Prefs.get('pref-disable-single-id-popup')) return;

        //ポップアップを作成
        var popupContent = sameIDPosts.length ? document.createDocumentFragment() :
                                                $.node({ 'p': { text: 'このレスのみ' }});

        sameIDPosts.forEach((post) => {
            let postNode = post.cloneNode(true);

            postNode.removeAttribute('id');
            popupContent.appendChild(postNode);
        });

        var dir = Prefs.get('pref-invert-id-popup-dir');

        if(Prefs.get('pref-delay-popup'))
            Popup.showPopupDelay(aEvent, popupContent, "IDPopup", dir);
        else
            Popup.showPopup(aEvent, popupContent, "IDPopup", dir);
    }
};


/**
 * 画像ポップアップ
 * @class
 */
Popup.Image = {

    mouseover: function(aEvent){
        var link = aEvent.target;
        var linkURL = link.href;

        if(!this._isImageLink(linkURL)) return;

        var image = $.node({ img: { 'class': 'small', 'src': linkURL }});

        image.addEventListener('error', function(){
            this.parentNode.classList.add('error');
        }, false);

        image.addEventListener('click', function(){
            this.classList.toggle('small');
        }, false);

        image.addEventListener('load', function(){
            if(Prefs.get('pref-invert-image-popup-dir')){
                let popupNode = this.closest('.popup');
                Popup._adjustPopupPosition(link, popupNode, popupNode.dataset.inverted);
            }
        }, false);

        var popupContent = $.node({ 'div': { children: image }});
        var dir = Prefs.get('pref-invert-image-popup-dir');

        if(Prefs.get('pref-delay-popup')){
            Popup.showPopupDelay(aEvent, popupContent, "ImagePopup", dir);
        }else{
            Popup.showPopup(aEvent, popupContent, "ImagePopup", dir);
        }
    },


    /**
     * URL が画像を示しているかどうかを返す
     * @param  {String} url 調べる URL
     * @return {Boolean} 画像なら true
     * @note pref-enable-non-strict-image-detection によって判定方法が変わる
     */
    _isImageLink: function(url){
        if(Prefs.get('pref-enable-non-strict-image-detection')){
            return this._detectImageLinkRoughly(url);
        }else{
            return this._detectImageLink(url);
        }
    },


    /**
     * URL が画像を示しているかどうか拡張子から判断する
     * @param  {String} url 調べる URL
     * @return {Boolean} 画像なら true
     */
    _detectImageLink: function(url){
        return (/\.(?:gif|jpe?g|png|svg|bmp|tiff?)$/i).test(url);
    },


    /**
     * URL が画像を示しているかどうか, URL 中に含まれるキーワードを基に判断する
     * @param  {String} url 調べる URL
     * @return {Boolean} 画像なら true
     */
    _detectImageLinkRoughly: function(url){
        return (/\.(?:gif|jpe?g|png|svg|bmp|tiff?)/i).test(url);
    },

};


function delayInit(){
    Prefs.startup();
    ResCommand.startup();
    ShortcutHandler.startup();
    AboneHandler.startup();
    Popup.startup();
    ThreadInfo.startup();
    ResInfo.startup();
}

function init(){
    //レス指定がない場合は新着位置までスクロール
    if(!location.hash){
        ThreadCommand.scrollToNewMark();
    }

    setTimeout(() => {
        delayInit();
    }, 0);
}

init();
