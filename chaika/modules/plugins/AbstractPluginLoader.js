/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["AbstractPluginLoader"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { Task } = Cu.import('resource://gre/modules/Task.jsm', {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
let { HttpUtils } = Cu.import('resource://chaika-modules/utils/HttpUtils.js', {});
let { FileIO } = Cu.import('resource://chaika-modules/utils/FileIO.js', {});
let { Logger } = Cu.import("resource://chaika-modules/utils/Logger.js", {});


let AbstractPluginLoader = {

    /**
     * name for this type of plugins. e.g.) "search" for search plugins.
     * @type {String}
     */
    name: '',


    /**
     * a path string of the directory in which system-side plugins are stored.
     * If not overridden, {defaultsDir}/plugins/{name} will be used.
     * @type {String}
     * @optional
     */
    get systemDir() {
        return OS.Path.join(FileIO.Path.defaultsDir, 'plugins', this.name);
    },


    /**
     * a path string of the directory in which third-party plugins are stored.
     * If not overridden, {dataDir}/plugins/{name} will be used.
     * @type {String}
     * @optional
     */
    get userDir() {
        return OS.Path.join(FileIO.Path.dataDir, 'plugins', this.name);
    },


    /**
     * a namespace for references to each plugin's body objects defined in main.js
     * @type {Object}
     */
    plugins: {},


    /**
     * a namespace for references to each plugin's package objects defined in package.json
     * @type {Object}
     */
    packages: {},


    startup() {
        return Promise.all([
            OS.File.makeDir(this.systemDir, { from: FileIO.Path.defaultsDir }),
            OS.File.makeDir(this.userDir, { from: FileIO.Path.dataDir })
        ]).then(() => {
            return this._loadFromDir(this.systemDir);
        }).then(() => {
            return this._loadFromDir(this.userDir);
        }).catch((err) => {
            Cu.reportError(err);
        });
    },


    /**
     * Loading all plugins under a given directory.
     * @param  {String} pluginsDirPath a path string
     * @return {Promise<void>}
     */
    _loadFromDir(pluginsDirPath) {
        this._fetchPluginFolders(pluginsDirPath).then((plugins) => {
            return Promise.all(plugins.map((plugin) => this._load(plugin)));
        }).catch((err) => {
            Cu.reportError(err);
        });
    },


    /**
     * Fetchting all plugin folders under a given directory.
     * @param  {String} pluginsDirPath a path string
     * @return {Promise<Array<File>>} an array of plugin folders.
     */
    _fetchPluginFolders(pluginsDirPath) {
        let iterator = new OS.File.DirectoryIterator(pluginsDirPath);
        let pluginFolders = [];

        return iterator.forEach((entry) => {
            if(entry.isDir){
                pluginFolders.push(entry);
            }
        }).then(() => {
            iterator.close();

            return pluginFolders;
        });
    },


    /**
     * Loading a given plugin to `this.plugins` using a sandbox with some restrictions
     * that are defined in "permissions" of package.json.
     * @param  {String} pluginDir a path string
     * @return {Promise<void>}
     */
    _load(pluginDir) {
        let packagePath = OS.Path.join(pluginDir.path, 'package.json');

        return Task.spawn((function* (){
            // We use "packaqe" as a variable's name instead of "package"
            // in order to avoid using the reserved word in strict mode.
            let packaqe = yield this._loadPackageJSON(packagePath);
            let sandbox = yield this._getSandboxWithPermissions(packaqe.permissions);
            let scriptPath = OS.Path.join(pluginDir.path, 'main.js');

            Services.scriptloader.loadSubScriptWithOptions(
                OS.Path.toFileURI(scriptPath),
                {
                    target: sandbox,
                    charset: 'utf-8',
                    ignoreCache: true
                }
            );

            // Export
            this.packages[packaqe.id] = packaqe;
            this.plugins[packaqe.id] = sandbox[sandbox.EXPORTED_SYMBOL];
        }).bind(this));
    },


    /**
     * Loading package.json and returns the result of parsing.
     * @param  {String} jsonPath a path string to load.
     * @return {Object}          loaded JSON object
     */
    _loadPackageJSON(jsonPath) {
        return OS.File.read(jsonPath, { encoding: 'utf-8' }).then((content) => {
            return JSON.parse(content);
        });
    },


    /**
     * Creating a sandbox with a given principal and extra permissions.
     * @param  {Object} permissions
     * @return {nsISandbox}
     */
    _getSandboxWithPermissions(permissions) {
        let principal;

        if(permissions.system){
            principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
        }else if(Array.isArray(permissions['cross-domain-content'])){
            principal = permissions['cross-domain-content'];
        }else{
            principal = Cc["@mozilla.org/nullprincipal;1"].createInstance(Ci.nsIPrincipal);
        }

        let options = {
            sandboxName: `chaika-plugins-${this.name}`,
            wantExportHelpers: true,
            wantComponents: !!permissions.components,
            wantGlobalProperties: permissions['global-props'] || [],
        };

        let sandbox = Cu.Sandbox(principal, options);

        return HttpUtils.userAgent.then((userAgent) => {
            sandbox.CHAIKA_USER_AGENT = Cu.cloneInto(userAgent, sandbox, { cloneFunctions: true });

            return sandbox;
        });
    }
};
