/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["LocalServer"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { FileUtils } = Cu.import('resource://gre/modules/FileUtils.jsm', {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { HttpServer, HTTP_400, HTTP_404 } = Cu.import('resource://chaika-modules/libs/httpd.js', {});
let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


/**
 * Serving skin files and threads using httpd.js server.
 * @class
 */
let LocalServer = {

    /**
     * URL string representing this server.
     * @type {String}
     */
    get serverURL() {
        return 'http://127.0.0.1:' + Prefs.get('server.port');
    },


    _startup() {
        this._start(Prefs.get('server.port'));

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
     * Starting up the local server.
     * @param {Number} port the port upon which listening should happen.
     */
    _start(port) {
        this._listen(port);
        this._registerThreadHandler();
        this._registerSkinDirectory();
        this._registerThreadErrorHandler();
    },


    /**
     * Listening up the given port.
     * @param {Number} port the port upon which listening should happen.
     */
    _listen(port) {
        this._server = new HttpServer();

        // port randomization
        if(Prefs.get('server.port.randomization')){
            // Use one of the private ports
            port = 49513 + Math.floor(16000 * Math.random());
        }

        try{
            // Listen the port to establish the local server
            this._server.start(port);
            Logger.info("The local server is started, listening port " + port);

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


    /**
     * Stop listening the port.
     */
    _stop() {
        this._server.stop(() => {});

        Logger.info('The local server is stopped.');
    },


    _registerThreadHandler() {
        let iconPath = OS.Path.join(FileIO.Path.addonDir, 'chrome', 'content', 'chaika', 'icon.png');
        let iconFile = new FileUtils.File(iconPath);

        this._server.registerPrefixHandler('/thread/', ThreadHandler);
        this._server.registerFile('/icon.png', iconFile);
    },


    /**
     * Register the skin directory to this server.
     */
    _registerSkinDirectory() {
        let path = this._getSkinDir();
        let skinDir = new FileUtils.File(path);

        this._server.registerDirectory('/skin/', skinDir);

        Logger.debug('Registered skin dir: ' + path);
    },


    /**
     * Path of the skin directory.
     * If a user doesn't specify a skin, Default skin will be selected.
     * @return {String}
     */
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


    /**
     * Registering the error handlers that may occur in serving a thread HTML.
     */
    _registerThreadErrorHandler() {
        this._server.registerErrorHandler(400, ThreadErrorHandler[400]);
        this._server.registerErrorHandler(404, ThreadErrorHandler[404]);
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



/**
 * a handler for HTTP requests of a BBS thread.
 */
let ThreadHandler = {

    handle(request, response) {
        let url = request.path.replace(/^\/thread\//, '');

        if(!URLUtils.isThread(url)){
            // Send 400 Bad Request if the specified page is not a thread.
            throw HTTP_400;
        }

        response.processAsync();
        response.setHeader("Content-Type", "text/html; charset=Shift_JIS");

        //let thread = new Thread(threadURL);

        response.write(`${url} is a thread!`);
        response.finish();
    }

};



let ThreadErrorHandler = {

    /**
     * 400 Bad Request, in our cases this means
     * the user specified URL doesn't represent a thread page.
     */
    400(metadata, response) {
        response.setStatusLine('1.1', 400, 'Bad Request');
        response.setHeader("Content-Type", "text/html;charset=utf-8", false);

        let url = FileIO.escapeHTML(metadata.path.replace(/^\/thread\//, ''));
        let body = `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <link rel="shortcut icon" href="/icon.png" />
                    <title>400 Bad Request [chaika]</title>
                    <style>
                        body{
                            background-color: #eee;
                            color: black;
                            font-size: 13.5px;
                            margin: 1em 3em;
                        }
                        ul{
                            list-style-type: square;
                        }
                        p{
                            padding-left: 1em;
                        }
                        .url{
                            font-family: monospace;
                        }
                    </style>
                </head>
                <body>
                    <h1>400 Bad Request</h1>
                    <p>
                        指定された URL <span class="url">${url}</span>
                        はスレッドを表していないようです。
                    </p>
                    <h2>解決策</h2>
                    <ul>
                        <li><a href="${url}">chaika を用いないでページを表示する</a></li>
                    </ul>
                </body>
            </html>`;

          response.bodyOutputStream.write(body, body.length);
    }

};
