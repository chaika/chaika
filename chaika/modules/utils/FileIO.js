/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["FileIO"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


this.FileIO = {

    Path: {
        get dataDir() {
            let path;

            if(Prefs.get('appoint_data_dir')){
                let userPath = Prefs.getFile('data_dir').path;

                if(OS.Path.basename(userPath) !== 'chaika'){
                    userPath = OS.Path.join(userPath, 'chaika');
                }

                path = userPath;
            }else{
                path = OS.Path.join(OS.Constants.Path.profileDir, 'chaika');
            }

            delete this.dataDir;
            return (this.dataDir = path);
        },


        get logDir() {
            let path = OS.Path.join(this.dataDir, 'chaika-logs');

            delete this.logDir;
            return (this.logDir = path);
        },


        get addonDir() {
            // Addon.getResourceURI() is possibly more robust way to get the add-on's directory,
            // but AddonManager API requires to access that information asynchronously.
            let relativePathes = [ 'extensions', 'chaika@chaika.xrea.jp' ];
            let path = OS.Path.join(OS.Constants.Path.profileDir, ...relativePathes);

            delete this.addonDir;
            return (this.addonDir = path);
        },


        get defaultsDir() {
            let relativePathes = [ 'chrome', 'content', 'chaika', 'defaults' ];
            let path = OS.Path.join(this.addonDir, ...relativePathes);

            delete this.defaultsDir;
            return (this.defaultsDir = path);
        }
    },


    readUnknownEncodingString(path, ...suspects) {
        let encoding = suspects.shift();

        return OS.File.read(path, { encoding })
               .then((text) => {
                   // If the text contains U+FFFD (REPLACEMENT CHARACTER),
                   // that means the specified encoding was wrong.
                   if(text.contains('\uFFFD')){
                       throw new Error('Wrong Encoding');
                   }

                   return text;
               }).catch(() => {
                   if(suspects.length > 0){
                       return this.readUnknownEncodingString(path, ...suspects);
                   }else{
                       throw new Error('Unknown Encoding.');
                   }
               });
    },


    /**
     * ファイラでファイルやディレクトリを開く
     * @param {nsIFile|String} aFile 開くファイルまたはディレクトリ
     * @return {Boolean} 成功したら真を返す
     */
    reveal(aFile) {
        if(!(aFile instanceof Ci.nsIFile)){
            let { FileUtils } = Cu.import('resource://gre/modules/FileUtils.jsm', {});

            aFile = new FileUtils.File(aFile);
        }

        try{
            // Open with native operating system API.
            aFile.reveal();
        }catch(ex){
            try{
                // Open with file:// protocol.
                let uri = Services.io.newFileURI(aFile);
                let protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                                        .getService(Ci.nsIExternalProtocolService);

                protocolService.loadUrl(uri);
            }catch(ex){
                Logger.error(ex);
            }
        }
    },


    /**
     * HTML実体参照にエンコードする
     * @param {String} aStr エンコードする文字列
     * @return {String} エンコード後の文字列
     */
    escapeHTML: function ChaikaCore_escapeHTML(aStr){
        return aStr.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#039;')
                   .replace(/\u00a9/g, '&copy;');
    },


    /**
     * HTML実体参照をデコードする
     * @param {String} aStr デコードする文字列
     * @return {String} デコード後の文字列
     */
    unescapeHTML: function ChaikaCore_unescapeHTML(aStr){
        return aStr.replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#039;/g, "'")
                   .replace(/&amp;/g, '&')
                   .replace(/&copy;/g, this.fromUTF8Octets('©'));
    },


    /**
     * UTF-8 バイト列から文字列へ変換する
     * @param {Octets} octets UTF-8 バイト列
     * @return 文字列
     * @note http://nanto.asablo.jp/blog/2006/10/23/572458 より
     */
    fromUTF8Octets: function(octets){
        return decodeURIComponent(escape(octets));
    },


    /**
     * 文字列から UTF-8 バイト列へ変換する
     * @param {String} string 文字列
     * @return UTF-8 バイト列
     * @note http://nanto.asablo.jp/blog/2006/10/23/572458 より
     */
    toUTF8Octets: function(string){
        return unescape(encodeURIComponent(string));
    }

};
