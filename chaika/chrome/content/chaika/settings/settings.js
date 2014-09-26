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

Components.utils.import("resource://chaika-modules/ChaikaCore.js");


function startup(){
    var paneID = window.location.hash.substring(1);

    if(paneID){
        let paneElement = document.getElementById(paneID);

        if(paneElement && paneElement.localName === "prefpane"){
            document.documentElement.showPane(paneElement);
        }
    }

    adjustWindowSize();
    window.addEventListener('paneload', adjustWindowSize, false);
}


function shutdown(){
    window.removeEventListener('paneload', adjustWindowSize, false);
}


function adjustWindowSize(){
    //Mac ではタブ切り替えの際に自動的にウィンドウの高さが調節されるため, sizeToContent を毎回呼び出すと表示が崩れる.
    //一方, Windows ではウィンドウの高さが調整されないため, 毎回 sizeToContent を呼ぶ必要がある.
    //高さが自動調節されるかどうかは, タブを切り替える前後で高さが変わっているかどうかを調べることで判別できる.
    if(!window._previousInnerHeight || window.innerHeight === window._previousInnerHeight){
        window.sizeToContent();
        window._previousInnerHeight = window.innerHeight;
    }
}


function setContainerDisabled(aPref, aContainerID, aEnabledValue){
    var prefValue = document.getElementById(aPref).value;
    var container = document.getElementById(aContainerID);

    container.disabled = (prefValue !== aEnabledValue);

    var childNodes = container.getElementsByTagName("*");

    Array.slice(childNodes).forEach((node) => {
        node.disabled = (prefValue !== aEnabledValue);
    });
}
