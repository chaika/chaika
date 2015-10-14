/* See license.txt for terms of usage */

this.EXPORTED_SYMBOLS = ["ChaikaAA"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://chaika-modules/ChaikaCore.js");

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


this.ChaikaAA = {

    /**
     * ブラウザの起動時に一度だけ実行される
     */
    _startup: function(){
        this._loadData();
    },


    /**
     * ブラウザの終了時に一度だけ実行される
     */
    _quit: function(){
        this._saveData();
    },


    /**
     * データを読み込む
     */
    _loadData: function(){
        let parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);

        let appendSubDir = (function(aParentNode, aCurrentDir, aLevel){
            let aaExtReg = /\.aa\.xml$/;
            let entries = aCurrentDir.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);

            while(true){
                let entry = entries.nextFile;
                if(!entry) break;

                if(entry.isDirectory()){

                    let folder = this._doc.createElement('folder');
                    folder.setAttribute("title", entry.leafName);

                    aParentNode.appendChild(folder);

                    appendSubDir(folder, entry, aLevel + 1);

                }else if(aaExtReg.test(entry.leafName)){

                    let folder = this._doc.createElement('folder');
                    folder.setAttribute("title", entry.leafName.replace(aaExtReg, ""));

                    aParentNode.appendChild(folder);

                    let aaXML = ChaikaCore.io.readString(entry);
                    aaXML = parser.parseFromString(aaXML, 'text/xml');

                    let AAs = aaXML.getElementsByTagName('aa');

                    Array.from(AAs).forEach((AA) => {
                        let aaNode = this._doc.createElement('aa');
                        aaNode.setAttribute('title', AA.getAttribute('title'));

                        let aaStr = AA.textContent || AA.getAttribute('title');
                        aaNode.appendChild(this._doc.createTextNode(aaStr));

                        folder.appendChild(aaNode);
                    });

                }
            }

            entries.close();
        }).bind(this);


        let aaDir = ChaikaCore.getDataDir();
        aaDir.appendRelativePath("AA");

        if(!aaDir.exists()){
            aaDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
        }

        if(!aaDir.directoryEntries.hasMoreElements()){
            let uncategorized = aaDir.clone();
            uncategorized.appendRelativePath('Uncategorized.aa.xml');
            uncategorized.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0755);
        }

        this._doc = parser.parseFromString("<root/>", "text/xml");

        appendSubDir(this.getAATree(), aaDir, 0);
    },


    /**
     * データを保存する
     */
    _saveData: function(){
        let parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
        let serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);

        let aaDir = ChaikaCore.getDataDir();
        aaDir.appendRelativePath('AA');


        //Clear the folder
        let entries = aaDir.directoryEntries.QueryInterface(Ci.nsIDirectoryEnumerator);

        while(true){
            let entry = entries.nextFile;
            if(!entry) break;
            entry.remove(true);
        }

        entries.close();


        var visitDirectory = (function(parentNode, currentDir){
            ChaikaCore.logger.debug('visit:', parentNode.getAttribute('title'));

            let currentNode = parentNode.firstChild;

            if(!currentNode) return;

            if(currentNode.nodeName === 'aa'){
                let doc = parser.parseFromString('<aalist/>', 'text/xml');
                let root = doc.documentElement;

                do{
                    let title = currentNode.getAttribute('title');
                    let content = currentNode.textContent;
                    let aaNode = doc.createElement('aa');

                    aaNode.setAttribute('title', title);

                    if(title !== content){
                        aaNode.appendChild(doc.createCDATASection(content));
                    }

                    root.appendChild(aaNode);
                }while(currentNode = currentNode.nextSibling);

                let xmlFile = currentDir.clone().parent;
                xmlFile.appendRelativePath(parentNode.getAttribute('title') + '.aa.xml');

                ChaikaCore.logger.debug('Save aa.xml:', xmlFile.path);

                ChaikaCore.io.writeString(xmlFile, 'UTF-8', false, serializer.serializeToString(doc));
            }else{
                do{
                    let childDir = currentDir.clone();
                    childDir.appendRelativePath(currentNode.getAttribute('title'));

                    visitDirectory(currentNode, childDir);
                }while(currentNode = currentNode.nextSibling);
            }
        }).bind(this);

        visitDirectory(this.getAATree(), aaDir);
    },


    getAATree: function(){
        return this._doc.documentElement;
    }

};
