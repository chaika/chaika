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
let { Thread } = Cu.import('resource://chaika-modules/Thread.js', {});
let { ThreadFetcher } = Cu.import('resource://chaika-modules/ThreadFetcher.js', {});
let { ThreadParser } = Cu.import('resource://chaika-modules/ThreadParser.js', {});
let { ThreadBuilder } = Cu.import('resource://chaika-modules/ThreadBuilder.js', {});
let { ChaikaAboneManager } = Cu.import('resource://chaika-modules/ChaikaAboneManager.js', {});
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
     * @param {Number} port The port upon which listening should happen.
     */
    _start(port) {
        this._listen(port);
        this._registerThreadHandler();
        this._registerSkinDirectory();
        this._registerThreadErrorHandler();
    },


    /**
     * Listening up the given port.
     * @param {Number} port The port upon which listening should happen.
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

        if(url.contains('DEBUG_STATUS_400')){
            throw HTTP_400;
        }

        if(url.contains('DEBUG_STATUS_404')){
            throw HTTP_404;
        }


        response.processAsync();
        response.setHeader("Content-Type", "text/html; charset=utf-8");

        let writer = new this.ThreadWriter(url, response);

        writer.write().then(() => {
            response.finish();
        });
    },
};



/**
 * Writing the content of the thread which has the given url, to the response.
 * @param  {String} url      a url for a therad to write.
 * @param  {nsIHttpResponse} response a HTTP response to which the thread will be written
 * @constructor
 */
ThreadHandler.ThreadWriter = function(url, response) {
    /**
     * a url string that represents this thread.
     * @type {String}
     */
    this.url = url;

    /**
     * HTTP Response
     * @type {nsIHttpResponse}
     */
    this.response = response;

    /**
     * Thread
     * @type {Thread}
     */
    this.thread = new Thread(url);

    /**
     * Counter of number of posts in this thread.
     * @type {Object}
     */
    this._postCounters = {
        local: 0,
        fetched: 0,
        displayed: 0,
    };
};

ThreadHandler.ThreadWriter.prototype = {

    statusText: {
        OK: "(｀・ω・´)「OK」",
        ARCHIVED: "( ｰωｰ)「DAT 落ち」",
        NOT_MODIFIED: "( ｰωｰ)「新着なし」",
        OFFLINE: "( ｰωｰ)「オフライン」",
        LOG_PICKUP: "( ｰωｰ)「ログピックアップモード」",
        LOG_COLLAPSED: "(´・ω・`)「あぼーん発生。スレッドのログを削除した後再読み込みして下さい。」",
        NETWORK_ERROR: "(´・ω・`)「ネットワークエラー」",
        ERROR: "(´・ω・`)「エラー」",
    },


    /**
     * Write the given range of or specified posts of this thread to the response's output.
     * @return {Promise<void>}
     */
    write() {
        this.fetcher = new ThreadFetcher(this.thread);
        this.parser = new ThreadParser(this.thread);
        this.builder = new ThreadBuilder(this.thread, LocalServer.serverURL);

        // Load both local and remote sources of this thread here asynchronously
        // so that they are processed parallely.
        let option = { encoding: 'Shift_JIS' };
        let localPosts = OS.File.read(this.thread.source, option).then((content) => {
            return this.parser.parseChunk(FileIO.toUTF8Octets(content));
        });
        let remotePosts = this.fetcher.fetch(this.thread).then((content) => {
            return this.parser.parseChunk(FileIO.toUTF8Octets(content));
        });


        // the title of this thread is available in the local/remote source or at the database.
        let sources = [
            this.thread.metadata.get('title'),
            localPosts.then((posts) => this.parser.parsePost(posts[0]).title),
            remotePosts.then((posts) => this.parser.parsePost(posts[0]).title)
        ];

        return this._fetchTitle(sources).then((title) => {
            //this.thread.metadata.set({ title });
            return this.builder.buildHeader(title);
        }).then((headerHTML) => {
            return this.response.write(headerHTML);
        }).then(() => {
            return Promise.all([
                localPosts.then((posts) => this._buildPosts(posts, true)),
                remotePosts.then((posts) => this._buildPosts(posts, false))
            ]);
        }).then(([local, remote]) => {
            return this.response.write(local.concat(remote).join(''));
        }).then(() => {
            return this._getFetchStatus();
        }).then((status) => {
            return this.builder.buildFooter(status);
        }).then((footerHTML) => {
            return this.response.write(footerHTML);
        }).catch((err) => {
            Cu.reportError(err);
            this.response.write(err);
        });
    },


    _fetchTitle(sources) {
        if(sources.length <= 0){
            return Promise.reject('chaika was not able to obtain the title of this thread.');
        }

        let source = sources.shift();

        return source.then((title) => {
            if(title){
                return title;
            }else{
                return this._fetchTitle(sources);
            }
        }).catch((err) => {
            Cu.reportError(err);
            return this._fetchTitle(sources);
        });
    },


    /**
     * Building HTML strings parallely from a given text
     * that represents a series of posts. (e.g., a part of a dat)
     * @param  {String}  text  A text consists of a series of posts on this thread.
     * @param  {Boolean} isLocal true if the text is came from the local source file.
     * @return {Promise<String>}
     */
    _buildPosts(posts, isLocal) {
        // Store the number of posts to replace <XXRESCOUNT/> tags in Footer.html later.
        if(isLocal){
            this._postCounters.local = posts.length;
        }else{
            this._postCounters.fetched = posts.length;
        }

        return this.thread.filter.apply(posts, isLocal).then((postsToShow) => {
            this._postCounters.displayed += postsToShow.length;

            return Promise.all(postsToShow.map((post, index) => {
                return this._buildPost(post, index, isLocal);
            }));
        });
    },


    /**
     * Building HTML strings from a text that
     * represents a one post. (e.g., a one-line of a dat file)
     * @param  {String} post  Text representing a one post.
     * @param {Number} index
     * @return {Promise<String>}
     */
    _buildPost(post, index, isLocal) {
        return this.thread.metadata.get('title').then((title) => {
            let postJSON = this.parser.parsePost(post);

            // Add some metadata which is not written in the source file.
            postJSON.number = index + 1;
            postJSON.new = !isLocal;
            postJSON.title = title;
            postJSON.thread_url = this.thread.url;
            postJSON.board_url = this.thread.board.url;

            return postJSON;
        }).then((postJSON) => {
            // Determining whether this post should aboned or not.
            let hitNGData = ChaikaAboneManager.shouldAbone(postJSON);

            if(hitNGData !== undefined){
                postJSON.aboned = true;
                postJSON.ngdata = hitNGData;
            }

            return postJSON;
        }).then((postJSON) => {
            return this.builder.buildPost(postJSON);
        });
    },


    /**
     * Returns some status information about this fetchting and writing the thread.
     * @return {Promise<StatusInfo>}
     */
    _getFetchStatus() {
        return OS.File.stat(this.thread.source).then((fileStat) => {
            return {
                datSize: fileStat.size,
                datSizeKB: Math.round(fileStat.size / 1024),
                statusText: this.statusText[this.fetcher.stat.statusText],
                newResCount: this._postCounters.fetched,
                allResCount: this._postCounters.local + this._postCounters.fetched,
                getResCount: this._postCounters.displayed,
            };
        });
    }

};



/**
 * a Error handler that may cause in fetchting and writing a thread's content.
 * @class
 */
let ThreadErrorHandler = {

    /**
     * 400 Bad Request, in our cases this means
     * the specified url doesn't represent a thread page.
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
                            line-height: 1.8
                        }
                        ul{
                            list-style-type: square;
                        }
                        .url{
                            font-family: monospace;
                        }
                    </style>
                </head>
                <body>
                    <h1>400 Bad Request</h1>
                    <section>
                        <h2>原因</h2>
                        <ul>
                            <li>
                                指定された URL <span class="url">${url}</span>
                                はスレッドを表していないようです。
                            </li>
                        </ul>
                    </section>
                    <section>
                        <h2>解決策</h2>
                        <ul>
                            <li><a href="${url}">chaika を用いないでページを表示する</a></li>
                        </ul>
                    </section>
                </body>
            </html>`;

          response.bodyOutputStream.write(body, body.length);
    },


    /**
     * 404 Not Found, in our cases this means
     * we can't find any appropriate sources for the specified url.
     */
    404(metadata, response) {
        response.setStatusLine('1.1', 404, 'Not Found');
        response.setHeader("Content-Type", "text/html;charset=utf-8", false);

        let url = FileIO.escapeHTML(metadata.path.replace(/^\/thread\//, ''));
        let body = `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <link rel="shortcut icon" href="/icon.png" />
                    <title>404 Not Found [chaika]</title>
                    <style>
                        body{
                            background-color: #eee;
                            color: black;
                            font-size: 13.5px;
                            margin: 1em 3em;
                            line-height: 1.8;
                        }
                        ul{
                            list-style-type: square;
                        }
                        .url{
                            font-family: monospace;
                        }
                    </style>
                </head>
                <body>
                    <h1>404 Not Found</h1>
                    <section>
                        <h2>原因</h2>
                        <ul>
                            <li>
                                指定されたスレッド <span class="url">${url}</span>
                                のデータを掲示板から取得することができませんでした。
                                これには以下の原因が考えられます。
                                <ul>
                                    <li>
                                        chaika からのアクセスが制限されている。
                                    </li>
                                    <li>
                                        いわゆる dat 落ちなどが発生してスレッドがアーカイブ化されており、
                                        chaika からはそのデータが取得できない状態にある。
                                    </li>
                                    <li>
                                        スレッドが削除された。または、URL に誤りがある。
                                    </li>
                                    <li>
                                        読み込まれているスレッド取得プラグインの
                                        いずれにも対応していない掲示板である。
                                    </li>
                                </ul>
                            </li>
                            <li>
                                chaika のログフォルダには該当するスレッドがありませんでした。
                            </li>
                        </ul>
                    </section>
                    <section>
                        <h2>解決策</h2>
                        <ul>
                            <li>
                                <a href="${url}?chaika_force_browser=1">chaika を用いないでスレッドを表示する</a>
                            </li>
                            <li>
                                <a href="https://www.google.co.jp/search?q=${encodeURIComponent(url)}">
                                    スレッドの URL を Google で検索する
                                </a>
                            </li>
                            <li>
                                <a href="#">掲示板に対するプラグインを探す</a>
                            </li>
                            <li>
                                <a href="#">
                                    スレッドのデータ(dat ファイルなど)を入手して chaika で閲覧する
                                </a>
                            </li>
                        </ul>
                    </section>
                </body>
            </html>`;

          response.bodyOutputStream.write(body, body.length);
    },
};
