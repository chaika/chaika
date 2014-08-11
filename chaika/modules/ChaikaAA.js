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
 * Portions created by the Initial Developer are Copyright (C) 2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson.moz at gmail.com>
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


EXPORTED_SYMBOLS = ["ChaikaAA"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://chaika-modules/ChaikaCore.js");

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;


var ChaikaAA = {

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

                    Array.slice(AAs).forEach((AA) => {
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

        this._doc = parser.parseFromString("<root/>", "text/xml");

        appendSubDir(this.getAAXML(), aaDir, 0);
    },


    /**
     * データを保存する
     */
    _saveData: function(){
        let parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
        let serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);

        let aaDir = ChaikaCore.getDataDir();
        aaDir.appendRelativePath('AA');

        aaDir.clone().remove(true);
        aaDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);


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

        visitDirectory(this.getAAXML(), aaDir);
    },


    getAAXML: function(){
        return this._doc.documentElement;
    }

};
