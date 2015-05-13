/* See license.txt for terms of usage */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

Cu.import('resource://chaika-modules/ChaikaCore.js');
Cu.import("resource://chaika-modules/ChaikaContentReplacer.js");

var gWarnings = [];


function startup(){
    document.getElementById('select-file-btn').addEventListener('command', selectFile, false);

    window.sizeToContent();
}


function shutdown(){
    document.getElementById('select-file-btn').removeEventListener('command', selectFile, false);
}


function onDialogAccept(){
    gWarnings = [];

    document.getElementById('replacestr-text').value
            .split(/[\r\n]+/)
            .map((line) => convertToReplaceData(line))
            .filter((replaceData) => !!replaceData)
            .forEach((replaceData) => ChaikaContentReplacer.add(replaceData));

    if(gWarnings.length > 0){
        window.alert('変換中に' + gWarnings.length + '件の警告が見つかりました.\n' +
                     '詳しくはブラウザコンソールを参照してください.');
        gWarnings.forEach((warning) => ChaikaCore.logger.warning(warning));
    }
}


function selectFile(){
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

    fp.init(window, "ReplaceStr.txt を選択してください", Ci.nsIFilePicker.modeOpen);
    fp.appendFilters(Ci.nsIFilePicker.filterText);

    if (fp.show() !== Ci.nsIFilePicker.returnOK) return;

    let selectedFile = fp.file.QueryInterface(Ci.nsIFile);

    document.getElementById('replacestr-path').value = selectedFile.path;
    document.getElementById('replacestr-text').value =
        ChaikaCore.io.readUnknownEncodingString(selectedFile, false, 'Shift_JIS', 'utf-8');
}


function convertToReplaceData(line){
    // 空行
    if(!line || /^\s*$/.test(line)) return null;


    // comment
    // ; ' # // で始まる行
    // [TAB]<> /<>// で始まる行 (Jane View 用)
    if(/^(?:;|\/\/|#|'|\t<>|\/<>\/\/)/.test(line)) return null;


    // [TAB] 【TAB】
    if(document.getElementById('replace-tab').checked){
        line = line.replace(/(?:\[TAB\]|【TAB】)/gi, '\t');
    }


    // analyze

    //<ex>置換対象の文字列[TAB]置換文字列[TAB]置換対象[TAB]<n>対象URL/タイトル
    let [searchText, replaceText, target, url] = line.split('\t');
    let searchTextFlag,  // <ex>, <rx>, etc.
        urlFlag;  // <0>, <1>, etc.

    searchText = searchText.replace(/^<[a-z12]*?>/, '');
    searchTextFlag = RegExp.lastMatch;

    url = (url || '').replace(/^<(\d)>/, '');
    urlFlag = RegExp.$1 - 0 || 0;


    // convert
    let replaceData = {};

    replaceData.title = line;
    replaceData.match = 'any';
    replaceData.global = true;
    replaceData.replaceText = replaceText;

    switch(searchTextFlag){
        // <ex2>: case-sensitive string
        case '<ex2>':
            replaceData.searchText = searchText;
            replaceData.regexp = false;
            replaceData.ignoreCase = false;
            break;

        // <rx> or <>: case-insensitive regexp
        case '<rx>':
        case '<>':
            replaceData.searchText = searchText;
            replaceData.regexp = true;
            replaceData.ignoreCase = true;
            break;

        // <rx2>: case-sensitive regexp
        case '<rx2>':
            replaceData.searchText = searchText;
            replaceData.regexp = true;
            replaceData.ignoreCase = false;
            break;

        // <ex> or not specified: case-insensitive string
        case searchText.startsWith('<ex>'):
        default:
            replaceData.searchText = searchText;
            replaceData.regexp = false;
            replaceData.ignoreCase = true;
            break;
    }


    if(!target || target === 'all'){
        target = 'msg';
        gWarnings.push('置換の対象を「すべて」から「本文」に変更しました. ' +
                       '手動で適切な置換対象に変更する必要があるかもしれません.\n' + line);
    }

    if(target === 'date'){
        gWarnings.push('置換の対象が「日付」になっています. ' +
                       'chaika では正しく動作しない可能性があります. ' +
                       '詳しくはオンラインヘルプをご参照ください.\n' + line);
    }

    replaceData.target = target;
    replaceData.rules = [];


    if(url){
        // 仕様では「url/タイトル」と定義されているので、どちらなのかは判断できない
        // よってどちらのルールも追加しておく

        let ruleURL = {};

        ruleURL.query = url;
        ruleURL.condition = [ 'contains', 'notContain', 'equals', 'notEqual', 'contains', 'notContain'][urlFlag];
        ruleURL.regexp = urlFlag >= 4;
        ruleURL.ignoreCase = true;
        ruleURL.target = 'thread_url';

        replaceData.rules.push(ruleURL);

        let ruleTitle = JSON.parse(JSON.stringify(ruleURL));
        ruleTitle.target = 'title';

        replaceData.rules.push(ruleTitle);
    }


    return replaceData;
}
