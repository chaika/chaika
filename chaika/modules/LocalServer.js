/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["LocalServer"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { FileUtils } = Cu.import('resource://gre/modules/FileUtils.jsm', {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { HttpServer } = Cu.import('resource://chaika-modules/libs/httpd.js', {});
let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


let LocalServer = {

    get serverURL() {
        return 'http://127.0.0.1:' + Prefs.get('server.port');
    },


    _startup() {
        this._start(Prefs.get('server.port'));
        this._registerSkinDirectory();

        Prefs.branch.addObserver('server.port', this, false);
        Prefs.branch.addObserver('thread_skin', this, false);
    },


    _quit() {
        Prefs.branch.removeObserver('server.port', this, false);
        Prefs.branch.removeObserver('thread_skin', this, false);

        this._stop();

        // Restore the original port number.
        if(this._origPort){
            Prefs.set('server.port', this._origPort);
        }
    },


    /**
     * Starting up the local server, listening up the given port.
     *
     * @param {Number} port the port upon which listening should happen.
     */
    _start(port) {
        this._server = new HttpServer();

        // port randomization
        if(Prefs.get('server.port.randomization')){
            // Use one of the private ports
            port = 49513 + Math.floor(16000 * Math.random());
        }

        try{
            // Listen the port to establish the local server
            this._server.start(port);
            Logger.info("Start listening port " + port);

            // Save the original port number to restore it later
            let origPort = Prefs.get('server.port');

            if(port !== origPort){
                this._origPort = origPort;
                Prefs.set('server.port', port);
            }
        }catch(ex){
            // Listening this port was rejected.
            if(Prefs.get('server.port.retry')){
                Logger.info('Fail to listen port ' + port + '. Try another one.');

                // Retry with another port number.
                this._start(port + 1);
            }else{
                Logger.fatal('Cannot establish the local server bacause port ' + port +
                             ' is not available!');
                this._stop();
            }
        }
    },


    _stop() {
        this._server.stop();
    },


    _registerSkinDirectory() {
        let path = this._getSkinDir();
        let skinDir = new FileUtils.File(path);

        this._server.registerDirectory('/skin/', skinDir);

        Logger.debug('Registered skin dir: ' + path);
    },


    _getSkinDir() {
        let path;
        let skinName = Prefs.getUniChar('thread_skin');

        if(skinName){
            path = OS.Path.join(FileIO.Path.dataDir, 'skin', skinName);
        }else{
            // Default skin
            path = OS.Path.join(FileIO.Path.defaultsDir, 'skin');
        }

        return path;
    },


    observe(aSubject, aTopic, aData) {
        switch(aData){
            case 'server.port': {
                this._stop();
                this._start(Prefs.get('server.port'));
            }
            break;

            case 'thread_skin': {
                this._registerSkinDirectory();
            }
            break;
        }
    }

};
