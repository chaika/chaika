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

Components.utils.import('resource://chaika-modules/ChaikaSearch.js');


var gBbsmenuPane = {

    startup: function(){
        this._createEngineMenu();
    },

    _createEngineMenu: function(){
        let menulist = document.getElementById('searchEngineList');
        let menupopup = document.createElement('menupopup');

        ChaikaSearch.plugins.forEach(plugin => {
            let menuitem = document.createElement('menuitem');

            menuitem.setAttribute('label', plugin.name);
            menuitem.setAttribute('value', plugin.id);

            if(!plugin.search){
                menuitem.setAttribute('disabled', 'true');
            }

            menupopup.appendChild(menuitem);
        });

        menulist.appendChild(menupopup);

        let selectedItem = document.querySelector('menuitem[value="' + menulist.value + '"]');
        menulist.selectedItem = selectedItem;
    },

    openSearchPluginDir: function(){
        var pluginDir = ChaikaCore.getDataDir();
        pluginDir.appendRelativePath("search");
        ChaikaCore.io.reveal(pluginDir);
    },

    resetBBSMenuURL: function(){
        var pref = document.getElementById("extensions.chaika.bbsmenu.bbsmenu_html_url");
        pref.value = pref.defaultValue;
    },

    addFavoriteBoard: function(){
        let favBoardFile = ChaikaCore.getDataDir();
        favBoardFile.appendRelativePath('favorite_boards.xml');

        if(ChaikaCore.pref.getBool('bbsmenu.open_favs_in_scratchpad')){
            try{
                var { ScratchpadManager } =
                    Components.utils.import('resource:///modules/devtools/scratchpad-manager.jsm', {});
            }catch(ex){
                // Firefox 44+ (See https://bugzilla.mozilla.org/show_bug.cgi?id=912121)
                var { ScratchpadManager } =
                    Components.utils.import('resource://devtools/client/scratchpad/scratchpad-manager.jsm', {});
            }
            let win = ScratchpadManager.openScratchpad();

            win.addEventListener('load', () => {
                win.Scratchpad.addObserver({
                    onReady: () => {
                        win.Scratchpad.removeObserver(this);
                        win.Scratchpad.importFromFile(favBoardFile, false, () => {
                            win.Scratchpad.editor.setMode({ name: 'xml' });
                        });
                    }
                });
            });
        }else{
            this._openFile(favBoardFile);
        }
    }

};
