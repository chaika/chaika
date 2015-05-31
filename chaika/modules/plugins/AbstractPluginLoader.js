/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["AbstractPluginLoader"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
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
     * If not specified, {defaultsDir}/plugins/{name} will be used.
     * @type {String}
     * @optional
     */
    get systemDir() {
        delete this.systemDir;
        return (this.systemDir = OS.Path.join(FileIO.Path.defaltsDir, 'plugins', this.name));
    },


    /**
     * a path string of the directory in which third-party plugins are stored.
     * If not specified, {dataDir}/plugins/{name} will be used.
     * @type {String}
     * @optional
     */
    get userDir() {
        delete this.userDir;
        return (this.userDir = OS.Path.join(FileIO.Path.dataDir, 'plugins', this.name));
    },


    /**
     * a regular expression which specifies what should a name of plugin's main script file be like.
     * If not specified, /\.{name}\.js$/ will be used.
     * @type {RegExp}
     * @optional
     */
    get mainFileRegExp() {
        delete this.include;
        return (this.include = new RegExp(`\\.${this.name}\\.js$`));
    },


    plugins: {},


    packages: {},


    startup() {
        this._loadFromDir(this.systemDir);
        this._loadFromDir(this.userDir);
    },


    _loadFromDir(pluginsDirPath) {
        this._fetchPluginFolders(pluginsDirPath).then((plugins) => {
            return Promise.all(plugins.map((plugin) => this._load(plugin)));
        });
    },


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


    _load(pluginDir) {
        let packageJSON = OS.Path.join(pluginDir.path, 'package.json');

        // We use "packaqe" as a argument name instead of "package"
        // in order to avoid using the reserved word in strict mode.
        this._loadPackageJSON(packageJSON).then((packaqe) => {
            return this.packages[packaqe.id] = packaqe;
        }).then((packaqe) => {
            let sandbox = this._getSandboxWithPermissions(packaqe.permissions);
            let scriptPath = OS.Path.join(pluginDir.path, packaqe.src || 'main.js');

            Services.scriptloader.loadSubScriptWithOptions(
                OS.Path.toFileURI(scriptPath),
                {
                    target: sandbox,
                    charset: 'utf-8',
                    ignoreCache: true
                }
            );
        });
    },


    _loadPackageJSON(jsonPath) {
        return OS.File.read(jsonPath).then((content) => {
            return JSON.parse(content);
        });
    },


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
            wantComponents: permissions.components,
            wantGlobalProperties: permissions,
            wantXrays: !permissions['disable-xrays']
        };

        let sandbox = Cu.Sandbox(principal, options);

        const that = this;
        const utils = {
            exports: new Proxy({}, {
                set(obj, prop, value) {
                    that.plugins[prop] = value;
                }
            })
        };

        Cu.cloneInto(utils, sandbox, { cloneFunctions: true, wrapReflectors: true });

        return sandbox;
    }
};
