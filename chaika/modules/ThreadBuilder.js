/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["ThreadBuilder"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { OS, TextEncoder, TextDecoder } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


let Templates = {

    init() {
        if(this._skinName === undefined){
            this._skinName = Prefs.get('thread_skin');
            this._updateTemplates();
        }
    },


    /**
     * Path of the skin directory.
     * If a user doesn't specify a skin, Default skin will be selected.
     * @return {String}
     */
    _getSkinDir() {
        let path;

        if(this._skinName){
            path = OS.Path.join(FileIO.Path.dataDir, 'skin', this._skinName);
        }else{
            // Default skin
            path = OS.Path.join(FileIO.Path.defaultsDir, 'skin');
        }

        return path;
    },


    _updateTemplates() {
        let files = [
            'Header',
            'Footer',
            'Res',
            'NewRes',
            'NGRes',
            'NGNewRes',
            'NewMark',
        ];

        files.forEach((name) => {
            let path = OS.Path.join(this._getSkinDir(), name + '.html');

            this[name] = OS.File.read(path, { encoding: 'Shift_JIS' });
        });
    }
};



function ThreadBuilder(thread, serverURL){
    this._thread = thread;
    this._serverURL = serverURL;
    this._encoder = new TextEncoder('utf-8');
    this._decoder = new TextDecoder('Shift_JIS');
}

ThreadBuilder.prototype = {

    /**
     * Converting a encoding of given string from utf-8 to Shift_JIS.
     * @param  {String} utfString a string whose encoding is utf-8.
     * @return {String}           Converted string.
     */
    _toSJIS(utfString) {
        return this._decoder(this._encoder(utfString));
    },


    /**
     * Replacing tags which are used in the all templates.
     * @param  {String} template HTML strings of a template under replacing.
     * @return {String}          HTML strings replaced common tags with real values.
     */
    _replaceCommonTags(template) {
        let skinPath = this._serverURL + '/skin/';
        let threadPath = this._serverURL + '/thread/';
        let fontName = Prefs.getUniChar("thread_font_name");
        let fontSize = Prefs.get("thread_font_size");
        let aaFontName = Prefs.getUniChar("thread_aa_font_name");
        let aaFontSize = Prefs.get("thread_aa_font_size");
        let aaLineSpace = Prefs.get("thread_aa_line_space");

        fontName = this._toSJIS(fontName);
        aaFontName = this._toSJIS(aaFontName);

        return template.replace(/<SKINPATH\/>/g, skinPath)
                       .replace(/<THREADURL\/>/g, this._thread.url)
                       .replace(/<BOARDURL\/>/g, this._thread.board.url)
                       .replace(/<SERVERURL\/>/g, threadPath)
                       .replace(/<FONTNAME\/>/g, "\'" + fontName + "\'")
                       .replace(/<FONTSIZE\/>/g, fontSize + "px")
                       .replace(/<AAFONTNAME\/>/g, "\'" + aaFontName + "\'")
                       .replace(/<AAFONTSIZE\/>/g, aaFontSize + "px")
                       .replace(/<AALINEHEIGHT\/>/g, aaFontSize + aaLineSpace + "px");
    },


    /**
     * Build HTML strings of the header.
     * @param  {String} title a title of a thread.
     * @return {String}       HTML strings
     */
    buildHeader(title) {
        return Templates.Header.then((template) => {
            return this._replaceCommonTags(template)
                       .replace(/<THREADNAME\/>/g, title);
        });
    },


    buildFooter(status) {
        return Templates.Footer.then((template) => {
            // Make sure there is at least a one <STATUS/> tag in the footer's tempalte
            // for backward compatibility
            if(!template.contains('<STATUS/>')){
                template = '<p class="info"><STATUS/></p>\n' + template;
            }

            return template.replace(/<STATUS\/>/g, status.statusText)
                           .replace(/<SIZE\/>/g, status.datSize)
                           .replace(/<SIZEKB\/>/g, status.datSizeKB)
                           .replace(/<GETRESCOUNT\/>/g, status.getResCount)
                           .replace(/<NEWRESCOUNT\/>/g, status.newResCount)
                           .replace(/<ALLRESCOUNT\/>/g, status.allResCount);
        });
    },


    buildPost(post) {
        let tempName = (post.aboned ? 'NG' : '') +
                       (post.new ? 'New' : '') +
                       'Res';

        return Templates[tempName].then((template) => {
            let ngdata = this._toSJIS(FileIO.escapeHTML(post.ngdata.title || post.ngdata));

            return template.replace(/<PLAINNUMBER\/>/g, post.number)
                           .replace(/<NUMBER\/>/g, post.number)
                           .replace(/<NAME\/>/g, post.name)
                           .replace(/<MAIL\/>/g, post.mail)
                           .replace(/<MAILNAME\/>/g, post.mailname)
                           .replace(/<DATE\/>/g, post.date)
                           .replace(/<ID\/>/g, post.id)
                           .replace(/<IDCOLOR\/>/g, post.idcolor)
                           .replace(/<IDBACKGROUNDCOLOR\/>/g, post.idbgcolor)
                           .replace(/<IP\/>/g, post.ip)
                           .replace(/<HOST\/>/g, post.host)
                           .replace(/<BEID\/>/g, post.belink)  // <BEID/> is actually represents a Be link.
                           .replace(/<BENUMBER\/>/g, post.be)
                           .replace(/<BEBASEID\/>/g, post.basebe)
                           .replace(/<MESSAGE\/>/g, post.msg)
                           .replace(/<NGDATA\/>/g, ngdata)
                           .replace(/<ABONEWORD\/>/g, ngdata);  // Chaika Abone Helper-compatible
        });
    },


};



Templates.init();
