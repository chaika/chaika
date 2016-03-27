/* See license.txt for terms of usage */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import("resource://chaika-modules/ChaikaCore.js");

this.EXPORTED_SYMBOLS = ["ChaikaBBSMenu"];

this.ChaikaBBSMenu = {

    /**
     * @type {Document}
     */
    _xml: null,


    /**
     * @type {nsIFile}
     */
    _bbsmenuFile: null,


    _startup: function(){
        this._bbsmenuFile = ChaikaCore.getDataDir();
        this._bbsmenuFile.appendRelativePath('bbsmenu.xml');

        this._parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);

        this._initFavBoardsFile();
    },


    _initFavBoardsFile: function(){
        let favBoardsFile = ChaikaCore.getDataDir();
        favBoardsFile.appendRelativePath('favorite_boards.xml');

        if(!favBoardsFile.exists()){
            let origFavBoardsFile = ChaikaCore.getDefaultsDir();
            origFavBoardsFile.appendRelativePath('favorite_boards.xml');

            origFavBoardsFile.copyTo(favBoardsFile.parent, null);
        }
    },


    _quit: function(){
        this._save();
    },


    _save: function(){
        let serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);

        ChaikaCore.io.writeString(this._bbsmenuFile, 'UTF-8', false, serializer.serializeToString(this._xml));
    },


    /**
     * @param {String} url
     * @return {nsIFile}
     */
    _resolveLocalURL: function(url){
        let fph = Cc["@mozilla.org/network/protocol;1?name=file"].createInstance(Ci.nsIFileProtocolHandler);

        if(url.includes('%%DEFAULTS_DIR%%')){
            let defaultsDir = ChaikaCore.getDefaultsDir();
            let defaultsDirSpec = fph.getURLSpecFromActualFile(defaultsDir);

            url = url.replace('%%DEFAULTS_DIR%%', defaultsDirSpec);
        }

        if(url.includes('%%DATA_DIR%%')){
            let dataDir = ChaikaCore.getDataDir();
            let dataDirSpec = fph.getURLSpecFromActualFile(dataDir);

            url = url.replace('%%DATA_DIR%%', dataDirSpec);
        }

        return fph.getFileFromURLSpec(url);
    },


    /**
     * @param {String} url url to fetch
     */
    _fetch: function(url, charset){
        return new Promise((resolve, reject) => {
            const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");

            let req = XMLHttpRequest();

            req.addEventListener('error', reject, false);
            req.addEventListener('load', () => resolve(req.responseText), false);
            req.open("GET", url, true);
            req.overrideMimeType('text/html; charset=' + (charset || 'utf-8'));
            req.send(null);
        });
    },


    update: function(){
        let primaryURL = ChaikaCore.pref.getChar("bbsmenu.bbsmenu_html_url");
        let primaryCharset = ChaikaCore.pref.getChar("bbsmenu.bbsmenu_html_charset");
        let addChaikaBoards = ChaikaCore.pref.getBool('bbsmenu.add_chaika_boards');

        let root = `
        <bbsmenu>
            <bbsmenu src="%%DATA_DIR%%/favorite_boards.xml" charset="utf-8" />
            ${
                addChaikaBoards ?
                '<bbsmenu src="%%DEFAULTS_DIR%%/chaika_boards.xml" charset="utf-8" />' +
                '<separator />' :
                ''
            }
            <bbsmenu src="${primaryURL}" charset="${primaryCharset}" />
        </bbsmenu>`;

        return this._parseXML(root).then((doc) => {
            return this._xml = doc;
        });
    },


    _parseXML: function(xmlString){
        let doc = this._parser.parseFromString(xmlString, "application/xml");
        let subSources = Array.from(doc.querySelectorAll('bbsmenu[src]'));

        return Promise.all(subSources.map((source) => {
            let url = source.getAttribute('src');
            let charset = source.getAttribute('charset');

            // Fetch sub document
            if(url.startsWith('http')){
                return this._fetch(url, charset)
                           .then((htmlString) => this._parseHTML(htmlString));
            }else{
                let file = this._resolveLocalURL(url);

                return this._parseXML(ChaikaCore.io.readString(file, charset));
            }
        }))
        .then((subDocs) => {
            // Import sub documents
            subDocs.forEach((subDoc, index) => {
                let sourceNode = subSources[index];

                Array.from(subDoc.documentElement.childNodes).forEach((node) => {
                    let importedNode = doc.importNode(node, true);

                    sourceNode.parentNode.insertBefore(importedNode, sourceNode);
                });

                sourceNode.parentNode.removeChild(sourceNode);
            });

            return doc;
        });
    },


    _parseHTML: function(htmlString){
        let xmlDoc = this._parser.parseFromString("<bbsmenu/>", "text/xml");
        let htmlDoc = this._parser.parseFromString("<root xmlns:html='http://www.w3.org/1999/xhtml'/>", "text/xml");
        let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        let fragment = parserUtils.parseFragment(htmlString, 0, false, null, htmlDoc.documentElement);

        htmlDoc.documentElement.appendChild(fragment);

        let targetNodes = htmlDoc.querySelectorAll('b, a[href]');
        let currentCategoryNode;

        Array.from(targetNodes).forEach((node) => {
            switch(node.nodeName.toLowerCase()){
                case 'b': {
                    currentCategoryNode = xmlDoc.createElement('category');
                    currentCategoryNode.setAttribute('title', node.textContent);

                    xmlDoc.documentElement.appendChild(currentCategoryNode);
                }
                break;

                case 'a': {
                    if(!currentCategoryNode) return;

                    let board = xmlDoc.createElement('board');

                    board.setAttribute('title', node.textContent);
                    board.setAttribute('url', node.getAttribute('href'));

                    currentCategoryNode.appendChild(board);
                }
                break;
            }
        });

        return xmlDoc;
    },


    getXML: function(){
        if(this._xml) return Promise.resolve().then(() => this._xml);

        return Promise.resolve().then(() => {
            if(!this._bbsmenuFile.exists()){
                ChaikaCore.logger.debug('bbsmenu.xml is not found.');

                return this.update();
            }

            // Update BBSMENU if the local menu is older than one-month old.
            if(Date.now() - this._bbsmenuFile.lastModifiedTime > 30 * 24 * 60 * 60 * 1000){
                ChaikaCore.logger.debug('bbsmenu.xml is too old.');

                return this.update();
            }


            let localContent = ChaikaCore.io.readString(this._bbsmenuFile, 'UTF-8');

            return this._parser.parseFromString(localContent, 'text/xml');
        }).then((doc) => {
            return this._xml = doc;
        });
    }

};
