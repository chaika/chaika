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


const FONT_PREVIEW = [
        "出されたご飯は残さず食べる。",
        "転んでも泣かない。",
        "おいらのギャグには大爆笑する。"].join("\n");
const AA_FONT_PREVIEW = [
        "　 ┌───────────────┐ ",
        "　 │ .右のAAのｽﾞﾚない環境が標準モナ.｜",
        "　 └──y────────────‐┘ ",
        " ∧＿∧　　　　　　| 　 　 |＼|／　|　　　　　｜ 　　｜",
        "（　´∀｀）　　　　　 | ∧ ∧  |/⌒ヽ、| ∧＿∧ | ∧∧ |",
        "（　　 　 つ 　 　 　 |(,,ﾟДﾟ)||,,ﾟ Θﾟ）|（； ´Д｀）|(=ﾟωﾟ)|"].join("\n");


var gThreadPane = {
    _initialized: false,

    startup: function(){
        this.initThreadFontList();
        this.initThreadAAFontList();
        document.getElementById("fontPreview").value = FONT_PREVIEW;
        document.getElementById("aaFontPreview").value = AA_FONT_PREVIEW;
        this._initialized = true;
        this.setFontPreviewBoxFont();
        this.setAAFontPreviewBoxFont();
    },

    initThreadFontList: function(){
        var lstThreadFontList = document.getElementById("lstThreadFontList");

        var fontEnumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
                .createInstance(Components.interfaces.nsIFontEnumerator);

        var fonts = fontEnumerator.EnumerateFonts("ja", "", {});
        fonts.sort();
        for(var i=0; i<fonts.length; i++){
            var item = lstThreadFontList.appendItem(fonts[i], fonts[i]);
        }

            // MenuList の Value と同じ MenuItem を選択
        var menuItems = lstThreadFontList.menupopup.childNodes;
        for(var i=0; i<menuItems.length; i++){
            if(menuItems[i].getAttribute("value") == lstThreadFontList.value){
                lstThreadFontList.selectedIndex = i;
            }
        }
            // 同じ MenuItem が無い場合は、デフォルトを選択
        if(lstThreadFontList.selectedIndex == -1){
                lstThreadFontList.selectedIndex = 1;
        }
    },


    initThreadAAFontList: function(){
        var lstThreadFontList = document.getElementById("lstThreadAAFontList");

        var fontEnumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
                .createInstance(Components.interfaces.nsIFontEnumerator);

        var fonts = fontEnumerator.EnumerateFonts("ja", "", {});
        fonts.sort();
        for(var i=0; i<fonts.length; i++){
            var item = lstThreadFontList.appendItem(fonts[i], fonts[i]);
        }

            // MenuList の Value と同じ MenuItem を選択
        var menuItems = lstThreadFontList.menupopup.childNodes;
        for(var i=0; i<menuItems.length; i++){
            if(menuItems[i].getAttribute("value") == lstThreadFontList.value){
                lstThreadFontList.selectedIndex = i;
            }
        }
            // 同じ MenuItem が無い場合は、デフォルトを選択
        if(lstThreadFontList.selectedIndex == -1){
                lstThreadFontList.selectedIndex = 1;
        }
    },


    openFontPreview: function(aAnchor, aPanelID){
        var panel = document.getElementById(aPanelID);
        panel.openPopup(aAnchor, "after_start", -40, 0, false);
    },


    setFontPreviewBoxFont: function(){
        if(!this._initialized) return;
        var fontPreview = document.getElementById("fontPreview");
        var fontSize = parseInt(document.getElementById("fontSize").value);
        var fontFamily = document.getElementById("lstThreadFontList").value;
        fontPreview.style.font = [fontSize, "px '", fontFamily, "'"].join("");
    },


    setAAFontPreviewBoxFont: function(){
        if(!this._initialized) return;
        var fontPreview = document.getElementById("aaFontPreview");
        var fontSize = parseInt(document.getElementById("aaFontSize").value);
        var lineHeight = (parseInt(document.getElementById("aaLineHeight").value) + fontSize);
        var fontFamily = document.getElementById("lstThreadAAFontList").value;
        fontPreview.style.font = [fontSize, "px/", lineHeight, "px '", fontFamily, "'"].join("");
    },


    openSkinDir: function(){
        var skinDir = ChaikaCore.getDataDir();
        skinDir.appendRelativePath("skin");
        ChaikaCore.io.reveal(skinDir);
    },

    openAboneManager: function(){
        ChaikaCore.browser.openWindow("chrome://chaika/content/settings/abone-manager.xul");
    },

    openAAManager: function(){
        ChaikaCore.browser.openWindow("chrome://chaika/content/settings/aa-manager.xul");
    }
};
