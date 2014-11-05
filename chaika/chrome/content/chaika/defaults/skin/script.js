/* See license.txt for terms of usage */

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
        return noExtract || result.length > 1 ? Array.slice(result) : result[0];
    },

    /**
     * 要素名から要素を取得
     * @param {String} tagName 要素名
     * @param {Node} [parent=document] 親要素
     * @return {Array.<Node>}
     */
    tag: function(tagName, parent){
        return Array.slice((parent || document).getElementsByTagName(tagName));
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
        return Array.slice((parent || document).querySelectorAll(selector));
    },

    /**
     * class から親要素を取得
     * @param {String} className class 名
     * @param {Node} element 起点の要素
     * @param {Boolean} [includeSelf=false] 自分自身を対象に含めるか否か
     * @return {Node}
     */
    parentByClass: function(className, element, includeSelf){
        if(!element) return null;

        if(includeSelf && element.classList.contains(className)){
            return element;
        }

        while(element = element.parentNode){
            if(element.classList && element.classList.contains(className)){
                return element;
            }
        }

        return null;
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
                    if(!attrs.children instanceof Node){
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

            default:
                formElement.value = aValue;
                break;
        }
    },

    /**
     * 簡易テンプレートから文字列を生成
     * @param {String} template テンプレート 置換する場所を @@ で指定する
     * @param {String} args 可変引数 テンプレート文字列の @@ を初めから順に置換する
     * @example $.template('@@ is a @@.', 'This', 'pen') //=> This is a pen.
     * @return {String} 置換後の文字列
     */
    template: function(...args){
        var template = args.shift();
        var count = 0;

        template = template.replace('@@', function(){
            return args[count++];
        }, 'g');

        return template;
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
            top -= $.rect($.id("pageTitle")).height;
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
                this.parentNode.removeChild(this);
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
                this.parentNode.removeChild(this);
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
 * 設定項目を扱う
 */
var Prefs = {

    defaultValue: {
        // 被参照
        'pref-enable-referred-count': true,

        // ID 表示
        'pref-enable-posts-count': true,

        // ポップアップ
        'pref-include-self-post': false,
        'pref-disable-single-id-popup': false,
        'pref-delay-popup': false,
        'pref-invert-res-popup-dir': false,
        'pref-max-posts-in-popup': 20,

        // ショートカットキー
        'pref-enable-shortcut': true,
        'pref-enable-resjump': true,
    },


    startup: function(){
        this._loadPrefs();

        $.id('settings').addEventListener('change', this._onPrefChanged.bind(this), false);
        $.id('settings').addEventListener('blur', this._onPrefChanged.bind(this), false);
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
        }catch(ex){
            console.warn('The change is ignored and will not be saved ' +
                         'because writing to the local storage is prohibited by the user.');
        }
    },


    _loadPrefs: function(){
        let prefNodes = $.selectorAll('[id^="pref-"]');

        prefNodes.forEach((prefNode) => {
            let key = prefNode.id;
            let value = this.get(key);

            $.setValue(prefNode, value);
        });
    },


    _onPrefChanged: function(aEvent){
        let target = aEvent.originalTarget;
        let key = target.id;
        let value = $.getValue(target);

        this.set(key, value);
    }
};



/**
 * 全レスを走査しないと得られない情報を扱う
 */
var ResInfo = {

    startup: function(){
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
                let id = $.klass('resID', resNode).dataset.id;

                if(id && !(id.startsWith('???'))){
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
                let anchors = resNode.textContent.match(/>>?\d{1,4}(?:-\d{1,4})?/g);

                if(anchors){
                    anchors.forEach((anchor) => {
                        let [startRes, endRes] = anchor.split('-');

                        startRes = startRes.substring(2) - 0;
                        endRes = endRes ? endRes - 0 : startRes;

                        if(startRes < 1) startRes = 1;
                        if(endRes > 1001) endRes = 1001;

                        for(let i = startRes; i <= endRes; i++){
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
            }
        });

        // ID別総発言数を表示する
        if(enablePostsCount){
            for(let id in idTable){
                if(typeof idTable[id] !== 'number') continue;

                let idNodes = $.selectorAll('.resContainer[data-id*="' + id + '"] > .resHeader > .resHeaderContent');
                if(!idNodes) continue;

                idNodes.forEach((idNode) => {
                    idNode.dataset.idPostsAll = idTable[id];
                });
            }
        }
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
        location.href = 'chaika://post/' + EXACT_URL;
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
        let top = $.rect($.id("pageTitle")).bottom + 40;
        let res;

        while(!res){
            let element = document.elementFromPoint(left, top);

            res = $.parentByClass('resContainer', element, true);
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
    },


    handleEvent: function(aEvent){
        let target = aEvent.originalTarget;
        let container = $.parentByClass('resContainer', target, true);

        // HTML 外要素の場合
        if(!(target instanceof HTMLElement)) return;

        // レス要素外の場合
        if(!container) return;


        switch(target.className){
            case 'resNumber':
                this.replyTo(target.textContent);
                break;

            default:
                if($.parentByClass('resHeader', target, true) && container.dataset.aboned === 'true'){
                    this.toggleCollapse(container);
                }
                break;
        }
    },


    /**
     * 返信する
     * @param {Number} resNumber 返信元のレス番号
     */
    replyTo: function(resNumber){
        location.href = 'chaika://post/' + EXACT_URL + resNumber;
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
    }

};



/**
 * キーショートカットを扱う
 */
var ShortcutHandler = {

    /**
     * ショートカットキーと機能とのマッピング
     * 押した順に + で結合される.
     * 例えば Control, Shift, Enter の順で押せば Ctrl+Shift+Enter となる.
     * キーの名称は
     *    https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent.key#Key_values
     * を, 機能については ThreadCommand, ResCommand を参照.
     */
    keyMap: {
        'Control+Enter': function(){ ThreadCommand.write(); },
        'Shift+Enter': function(){ ThreadCommand.write(); },
        'w': function(){ ThreadCommand.write(); },
        'r': function(){ ThreadCommand.reload(); },
        'n': function(){ ThreadCommand.scrollToNewMark(); },
        'j': function(){ ThreadCommand.scrollToNextRes(); },
        'k': function(){ ThreadCommand.scrollToPrevRes(); },
        'f': function(){ window.scrollByPages(1); },
        'b': function(){ window.scrollByPages(-1); },
    },


    /**
     * 押したキーを格納するスタック
     * @type {Array.<String>}
     */
    _keyStack: [],


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


        this._keyStack.push(aEvent.key);

        let keyStr = this._keyStack.join('+');

        if(this.keyMap[keyStr]){
            aEvent.preventDefault();
            this.keyMap[keyStr].call();

        }else if(Prefs.get('pref-enable-resjump') && /^[\d\+]+$/.test(keyStr)){
            aEvent.preventDefault();
            ResCommand.scrollTo(keyStr.replace(/\+/g, ''));
        }


        if(this._timer){
            clearTimeout(this._timer);
        }

        this._timer = setTimeout(() => { this._keyStack = []; }, this._threshold);
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

        let aboneCandidates = $.klass(className);

        for(let i=0, l=aboneCandidates.length; i<l; i++){
            if(aboneCandidates[i].textContent.contains(ngWord)){
                let aboneRes = $.parentByClass('resContainer', aboneCandidates[i]);
                let aboneResHeader = $.klass('resHeaderAboneContent', aboneRes);

                //NGワードが追加された場合
                if(aboneAdded && aboneRes.dataset.aboned !== 'true'){
                    aboneRes.classList.add('collapsed');
                    aboneRes.dataset.aboned = 'true';
                    $.attrs(aboneResHeader, { 'text': ngWord });
                }

                //NGワードが削除された場合
                if(!aboneAdded && aboneRes.dataset.aboned === 'true'){
                    aboneRes.classList.remove('collapsed');
                    aboneRes.dataset.aboned = 'false';
                    aboneResHeader.textContent = '';
                }
            }
        }
    },


    _exOnDemandAbone: function(ngData, aboneAdded){
        // we ignore NGEx on-demand abone for the time being,
        // because it is difficult to implement.
    }

};


var Popup = {

    POPUP_DELAY: 200,

    startup: function(){
        document.addEventListener('mouseover', this.mouseover, false);
        document.addEventListener('mouseout', this.mouseout, false);
    },

    mouseover: function(aEvent){
        var target = aEvent.originalTarget;
        if(!(target instanceof HTMLElement)) return;

        //Beリンク
        if(target.href && target.href.contains('be.2ch')){
            target = target.parentNode;
        }

        //本文中のIDリンク
        if(target.className.startsWith("mesID_")){
            Popup.ID.mouseover.call(target, aEvent);
            return;
        }

        switch(target.className){
            case "resPointer":
                Popup.Res.mouseover.call(target, aEvent);
                break;

            case 'resNumber':
                Popup.RefRes.mouseover.call(target, aEvent);
                break;

            case "resID":
            case "resMesID":
            case 'resIP':
            case 'resHost':
            case 'resBeID':
                Popup.ID.mouseover.call(target, aEvent);
                break;

            case "outLink":
                Popup.Image.mouseover.call(target, aEvent);
                break;

            default:
                break;
        }
    },

    mouseout: function(aEvent){
        var target = aEvent.originalTarget;

        if(!(target instanceof HTMLElement)) return;
        if(target.className === "") return;

        if(target._popupTimeout){
            clearTimeout(target._popupTimeout);
            delete target._popupTimeout;
        }
    },


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
        var popupNode = $.node({ 'div': { 'class': 'popup', 'id': 'popup-' + Date.now(), children: popupInnerNode }});

        document.body.appendChild(popupNode);


        //ポップアップの位置を決定する
        let baseRect = $.rect(aEvent.originalTarget);
        let popupRect = $.rect(popupNode);

        let top = !invertDirection ? window.scrollY + baseRect.bottom - 2:
                                     window.scrollY + baseRect.top - popupRect.height + 2;
        let left = window.scrollX + baseRect.left;


        // ウィンドウを突き出ないようにする補正

        //右端
        if(left + popupRect.width > window.scrollX + window.innerWidth){
            left = window.scrollX + window.innerWidth - popupRect.width;
        }

        //下端
        if(top + popupRect.height > window.scrollY + window.innerHeight){
            top = window.scrollY + window.innerHeight - popupRect.height;
        }

        //上端
        if(top < window.scrollY){
            top = window.scrollY;
        }


        $.css(popupNode, {
            top: top + 'px',
            left: left + 'px'
        });


        //親ポップアップがある場合は記録する
        var parent = $.parentByClass('popup', aEvent.relatedTarget, true);

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


    showPopupDelay: function(aEvent, aPopupContent, aAddClassName, invertDirection, aDelay){
        if(this._popupTimeout){
            clearTimeout(this._popupTimeout);
        }

        this._popupTimeout = setTimeout(() => {
            this.showPopup(aEvent, aPopupContent, aAddClassName, invertDirection);
        }, aDelay || this.POPUP_DELAY);
    },


    _fadeout: function(aEvent){
        //コンテキストメニューなどHTML要素外へマウスが移動した場合
        if(!aEvent.relatedTarget){
            return;
        }

        //消そうとしているポップアップ要素
        let targetPopup = aEvent.originalTarget;

        //ポップアップ元要素からポップアップを得る
        if(!targetPopup.classList.contains('popup')){
            if(aEvent.originalTarget.dataset.popup){
                targetPopup = $.id(aEvent.originalTarget.dataset.popup);
            }else{
                return;
            }
        }

        //今マウスが乗っているポップアップ要素
        let hoveredPopup = $.parentByClass('popup', aEvent.relatedTarget, true);


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

            //今マウスが乗っているところまできたら終了
            if(hoveredPopup && popup.id === hoveredPopup.id){
                break;
            }

            Effects.fadeout(popup, { remove: true });
        }
    },

};


Popup.Res = {

    mouseover: function(aEvent){
        var startRes = 0;
        var endRes = 0;

        if(this.textContent.match(/>>?(\d{1,4})-(\d{1,4})/)){
            startRes = parseInt(RegExp.$1);
            endRes = parseInt(RegExp.$2);
        }else if(this.textContent.match(/>>?(\d{1,4})/)){
            startRes = parseInt(RegExp.$1);
        }

        Popup.Res._createContent(startRes, endRes).then((popupContent) => {
            if(Prefs.get('pref-delay-popup'))
                Popup.showPopupDelay(aEvent, popupContent, "ResPopup", Prefs.get('pref-invert-res-popup-dir'));
            else
                Popup.showPopup(aEvent, popupContent, "ResPopup", Prefs.get('pref-invert-res-popup-dir'));
        }).catch((error) => { console.log(error); });
    },


    _createContent: function(aStart, aEnd){
        const POPUP_LIMIT = Prefs.get('pref-max-posts-in-popup');

        //単独ポップアップ
        if(aStart > aEnd) aEnd = aStart;

        //枠外補正
        if(aStart < 1) aStart = 1;
        if(aEnd > 1001) aEnd = 1001;

        //POPUP_LIMIT より多い時は省略する
        let tmpStart = aStart;
        let omitRes = 0;
        if(POPUP_LIMIT && (aEnd - aStart) > POPUP_LIMIT){
            aStart = aEnd - POPUP_LIMIT;
            omitRes = aStart - tmpStart;
        }

        var resNodes = document.createDocumentFragment();

        var promise = new Promise((resolve, reject) => {
            this._fetchResNodes(aStart, aEnd).then(
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
                            text: '>>' + aStart + '-' + failedRangeEnd + ' の取得中にエラーが発生しました'
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


    _fetchResNodes: function(aStart, aEnd){
        var promise = new Promise((resolve, reject) => {
            let resNodes = document.createDocumentFragment();

            //表示域内にある場合はそこから取ってくる
            //通常, 表示域外にある可能性が高いのは, アンカ範囲のうち先頭部分であるから,
            //後ろから順に取得していくことにする
            for(var i = aEnd; i >= aStart; i--){
                let resNode = $.id('res' + i);
                if(!resNode) break;

                resNode = resNode.cloneNode(true);
                resNode.removeAttribute('id');
                resNodes.insertBefore(resNode, resNodes.firstChild);
            }

            //すべて域内だった場合はこれで終了
            if(i < aStart){
                return resolve(resNodes);
            }else{
                aEnd = i;
            }


            //域外のレスが含まれている場合は、その部分をAjaxで取ってくる
            let req = new XMLHttpRequest();

            req.addEventListener('load', (event) => {

                if(req.status !== 200 || !req.responseText){
                    console.error('Fail in getting >>' + aStart + '-' + aEnd, 'status:', req.status);
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

            req.open('GET', SERVER_URL + EXACT_URL + aStart + "-" + aEnd + "n", true);
            req.overrideMimeType('text/html; charset=Shift_JIS');
            req.send(null);
        });

        return promise;
    }

};


Popup.RefRes = {

    mouseover: function(aEvent){
        //逆参照がなかったら終了
        if(!this.dataset.referred) return;

        let popupContent = document.createDocumentFragment();

        this.dataset.referred.split(',').forEach((refID) => {
            let resNode = $.id(refID);

            if(resNode){
                resNode = resNode.cloneNode(true);
                resNode.removeAttribute('id');

                popupContent.appendChild(resNode);
            }
        });

        if(Prefs.get('pref-delay-popup'))
            Popup.showPopupDelay(aEvent, popupContent, "RefResPopup");
        else
            Popup.showPopup(aEvent, popupContent, "RefResPopup");
    }

};


Popup.ID = {

    mouseover: function(aEvent){
        var resID = this.dataset.id;

        //レス本文中のID: リンクの場合には、resID属性が存在しないため
        //class名からIDを取得する
        if(!resID && this.className.match(/mesID_([^\s]+)/)){
            resID = RegExp.$1;
        }


        if(!resID || resID.startsWith('???')) return;


        //同じIDを持つレスを取得する
        var selfNumber = $.parentByClass('resContainer', this).dataset.number;
        var selector = Prefs.get('pref-include-self-post') ?
                ".resContainer[data-id*='" + resID + "']" :
                ".resContainer[data-id*='" + resID + "']:not([data-number='" + selfNumber + "'])";
        var sameIDPosts = $.selectorAll(selector);


        if(!sameIDPosts.length && Prefs.get('pref-disable-single-id-popup')) return;

        //ポップアップを作成
        var popupContent = sameIDPosts.length ? document.createDocumentFragment() :
                                                $.node({ 'p': { text: 'このレスのみ' }});

        sameIDPosts.forEach((post) => {
            let postNode = post.cloneNode(true);

            postNode.removeAttribute('id');
            popupContent.appendChild(postNode);
        });


        if(Prefs.get('pref-delay-popup'))
            Popup.showPopupDelay(aEvent, popupContent, "IDPopup");
        else
            Popup.showPopup(aEvent, popupContent, "IDPopup");
    }
};


Popup.Image = {

    mouseover: function(aEvent){
        var imageURL = this.href;
        if(!(/\.(?:gif|jpe?g|png|svg|bmp)$/i).test(imageURL)) return;

        var image = $.node({ img: { 'class': 'small', 'src': imageURL }});

        image.addEventListener('error', function(){
            this.parentNode.classList.add('error');
        }, false);

        image.addEventListener('click', function(){
            this.classList.toggle('small');
        }, false);

        var popupContent = $.node({ 'div': { children: image }});

        if(Prefs.get('pref-delay-popup'))
            Popup.showPopupDelay(aEvent, popupContent, "ImagePopup");
        else
            Popup.showPopup(aEvent, popupContent, "ImagePopup");
    }

};



function init(){
    //レス指定がない場合は新着位置までスクロール
    if(!location.hash){
        ThreadCommand.scrollToNewMark();
    }

    Prefs.startup();
    ResInfo.startup();
    ResCommand.startup();
    ShortcutHandler.startup();
    AboneHandler.startup();
    Popup.startup();
}

init();
