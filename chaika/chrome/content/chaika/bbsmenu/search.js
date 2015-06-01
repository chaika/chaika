/* See license.txt for terms of usage */


(function(global){
    "use strict";

    const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

    let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
    let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});
    let { SearchPluginLoader } = Cu.import("resource://chaika-modules/plugins/SearchPluginLoader.js", {});


    function SearchBox(){
        this._init.apply(this, arguments);
    }

    SearchBox.prototype = {

        _engine: null,


        _init: function(searchBox, engineMenu){
            this._searchBox = searchBox;
            this._engineMenu = engineMenu;

            this._createMenu(engineMenu);
            this.setSearchEngine(Prefs.get('bbsmenu.search.default_engine_name'));
        },

        /**
         * 検索メニューを構築する
         * @param {Node} root メニューのルートノード
         */
        _createMenu: function(root){
            let packages = SearchPluginLoader.packages;
            let plugins = SearchPluginLoader.plugins;

            for(let id in packages){
                if(!plugins[id].search) continue;

                let menuitem = document.createElement('menuitem');

                menuitem.setAttribute('label', packages[id].name);
                menuitem.setAttribute('value', id);
                menuitem.setAttribute('type', 'radio');
                menuitem.setAttribute('name', 'search-engine-list');

                menuitem.addEventListener('command', (event) => {
                    this.setSearchEngine(event.target.getAttribute('value'));
                });

                root.appendChild(menuitem);
            }
        },


        /**
         * 検索してその結果を返す
         * @param {String} query
         * @return {Promise}
         * @see SearchBox#_onSuccess
         */
        search: function(query){
            return SearchPluginLoader.plugins[this._engine].search(
                FileIO.escapeHTML(query)
            ).then(this._onSuccess);
        },


        /**
         * @typedef thread
         * @type {Object}
         * @property {String} url
         * @property {String} title
         * @property {String} boardName
         */

        /**
         * @typedef board
         * @type {Object}
         * @property {String} url
         * @property {String} title
         * @property {Array.<thread>} threads
         */

        /**
          * 検索が成功した時に呼ばれる
          * @param {Array.<board>} results
          * @return {Document} tree の source となる Document Node
          */
        _onSuccess: function(results){
            let doc = document.implementation.createDocument(null, '', null);
            let root = doc.createElement('category');

            results.forEach((board) => {
                let boardItem = doc.createElement('board');
                let boardTitle = FileIO.unescapeHTML(board.title);

                boardItem.setAttribute('title', boardTitle);
                boardItem.setAttribute('url', board.url || '');

                //板名フィルタの場合、threadsが空になるが、
                //それ以外の時は板はフォルダ扱いになる
                if(board.threads){
                    boardItem.setAttribute('opened', 'true');

                    board.threads.forEach((thread) => {
                        let threadItem = doc.createElement('thread');
                        let threadTitle = FileIO.unescapeHTML(thread.title);

                        if(thread.post){
                            threadTitle += ' [' + thread.post + ']';
                        }

                        threadItem.setAttribute('url', thread.url);
                        threadItem.setAttribute('title', threadTitle);
                        threadItem.setAttribute('boardName', boardTitle);

                        boardItem.appendChild(threadItem);
                    });
                }

                root.appendChild(boardItem);
            });

            doc.appendChild(root);

            return doc;
        },


        /**
         * 現在選択されている検索エンジンのIDを返す
         * @return {String} 検索エンジンのID
         */
        getSearchEngine: function(){
            return this._engine;
        },


        /**
         * 検索エンジンを指定する
         * @param {String} aID 検索エンジンのID
         */
        setSearchEngine: function(aID){
            this._engine = aID;

            let engineNode = this._engineMenu.querySelector('menuitem[value="' + aID + '"]');

            engineNode.setAttribute('checked', 'true');
            this._engineMenu.selectedItem = engineNode;
            this._searchBox.emptyText = SearchPluginLoader.packages[aID].name;
        }

    };


    // ---- Export ------------------------------------------
    global.SearchBox = SearchBox;

})((this || 0).self || global);
