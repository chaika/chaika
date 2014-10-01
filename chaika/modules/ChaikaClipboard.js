/* See license.txt for terms of usage */


EXPORTED_SYMBOLS = ["ChaikaClipboard"];


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


/** @ignore */
function makeException(aResult){
    var stack = Components.stack.caller.caller;
    return new Components.Exception("exception", aResult, stack);
}


/**
 * クリップボード操作オブジェクト
 * @class
 */
var ChaikaClipboard = {


    _getTransferable: function(){
        var nsTransferable = Components.Constructor("@mozilla.org/widget/transferable;1", "nsITransferable");
        var res = nsTransferable();

        res.init(null);

        return res;
    },


    /**
     * クリップボードの文字列を取得する。
     * @return {String} クリップボードの文字列
     */
    getString: function ChaikaClipboard_getString(){
        var clipBoard = Cc["@mozilla.org/widget/clipboard;1"].getService(Ci.nsIClipboard);
        var transferable = this._getTransferable();

        transferable.addDataFlavor("text/unicode");

        var resultStr = null;

        if(!this.hasStringData()){
            return resultStr;
        }

        try{
            var transferData = {};
            clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
            transferable.getTransferData("text/unicode", transferData, {});
            resultStr = transferData.value.QueryInterface(Ci.nsISupportsString).data;
        }catch(ex){
            throw makeException(ex.result);
        }

        return resultStr;
    },


    /**
     * 取得可能な文字列がクリップボードにあるか判定する。
     * @return {Boolean} 文字列があれば真
     */
    hasStringData: function ChaikaClipboard_hasStringData(){
        const kGlobalClipboard = Ci.nsIClipboard.kGlobalClipboard;
        var clipboard = Cc["@mozilla.org/widget/clipboard;1"].getService(Ci.nsIClipboard);

        return clipboard.hasDataMatchingFlavors(["text/unicode"], 1, kGlobalClipboard);
    },


    /**
     * クリップボードに文字列をコピーする
     * @param {String} aCopyString コピーする文字列
     * @return {String} コピーした文字列
     */
    setString: function ChaikaClipboard_setString(aCopyString){
        var copyString = new String(aCopyString);
        var clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
                    .getService(Ci.nsIClipboardHelper);
        try{
            clipboardHelper.copyString(copyString);
        }catch(ex){
            throw makeException(ex.result);
        }
        return copyString;
    }

};
