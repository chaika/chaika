/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["Logger"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { Log } = Cu.import("resource://gre/modules/Log.jsm", {});


this.Logger = {

    init: function(){
        if(this._initialized){
            return;
        }

        this._level = Services.prefs.getIntPref('extensions.chaika.logger.level');

        // if the level representation is old, let's migrate it.
        if(0 <= this._level && this._level <= 4){
            this._migrate();
        }

        // Get a logger
        this._logger = Log.repository.getLogger('chaika');
        this._logger.level = this._level;
        this._logger.addAppender(new Log.ConsoleAppender(new Formatter()));

        Services.prefs.addObserver("extensions.chaika.logger.level", this, false);

        this._initialized = true;
    },


    uninit: function(){
        Services.prefs.removeObserver("extensions.chaika.logger.level", this, false);
    },


    _migrate: function(){
        let label = [ 'Fatal', 'Error', 'Warn', 'Info', 'Debug' ];

        this._level = Log.Level[label[this._level]] || Log.Level.WARN;
        Services.prefs.setIntPref('extensions.chaika.logger.level', this._level);
    },


    observe: function(aSubject, aTopic, aData){
        if(aData === 'extensions.chaika.logger.level'){
            this._level = Services.prefs.getIntPref('extensions.chaika.logger.level');
        }
    },


    fatal: function(...params){
        this._logger.fatal(...params);
    },

    error: function(...params){
        this._logger.error(...params);
    },

    warn: function(...params){
        this._logger.warn(...params);
    },

    info: function(...params){
        this._logger.info(...params);
    },

    config: function(...params){
        this._logger.config(...params);
    },

    debug: function(...params){
        this._logger.debug(...params);
    },

    trace: function(...params){
        this._logger.trace(...params);
    },

};


function Formatter(){
}

Formatter.prototype = Object.create(Log.BasicFormatter.prototype, {

    format: {
        value: function(message){
            let caller = this._getCallerFrame(Components.stack);
            let callerDesc = '[unknown:0]';

            if(caller){
                callerDesc = '[' + caller.name + ':' + caller.lineNumber + ']';
            }

            return '[' + message.time + ']' +
                   callerDesc + '\t' +
                   message.levelDesc + '\t' +
                   this.formatText(message);
        }
    },

    _getCallerFrame: {
        value: function(frame){
            while(frame){
                if(frame.filename &&
                   !frame.filename.endsWith('Logger.js') &&
                   !frame.filename.endsWith('Log.jsm')){
                        return frame;
                }

                frame = frame.caller;
            }

            return null;
        }
    }

});


Logger.init();
