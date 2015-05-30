/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["HttpUtils"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
let { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm", {});
let { Prefs } = Cu.import('resource://chaika-modules/utils/Prefs.js', {});


let HttpUtils = {

    /**
     * chaika's user-agent
     * @type {Promise<String>}
     */
    get userAgent() {
        delete this.userAgent;

        let promise = new Promise((resolve) => {
            AddonManager.getAddonById('chaika@chaika.xrea.jp', (addon) => resolve(addon));
        });

        promise.then((chaika) => {
            let ph = Cc["@mozilla.org/network/protocol;1?name=http"]
                                        .getService(Ci.nsIHttpProtocolHandler);

            let oscpu = ph.oscpu;
            let appName = Services.appinfo.name;
            let appVersion = Services.appinfo.version;

            return `Monazilla/1.0.0 (${chaika.name}/${chaika.version};${oscpu};${appName}/${appVersion})`;
        });

        return (this.userAgent = promise);
    },


    /**
     * Making a given HTTP channnel proxied.
     * @param {nsIHttpChannel|nsIURI} target a HTTP channel or URI to be proxied.
     * @param {String} proxy a string representation of a proxy information.
     *                       Available values are "@direct", "@chaika" or "host:port",
     *                       where "@direct" means making sure the given request will go directly
     *                       to the Internet, "@chaika" means setting up a proxy specified
     *                       at the chaika's setting panel, and "host:port" means
     *                       get the connection proxied with a given proxy.
     * @note This method creates a new nsIHttpChannel instance,
     *       so keep in mind you should call this method
     *       before you make any customization to the channel.
     */
    proxify(target, proxy) {
        let hph = Services.io.getProtocolHandler("http").QueryInterface(Ci.nsIHttpProtocolHandler);
        let pps = Cc["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Ci.nsIProtocolProxyService);

        let directProxyInfo = pps.newProxyInfo("direct", "", -1, 0, 0, null);
        let proxyInfo;

        if(proxy === '@direct'){
            proxyInfo = directProxyInfo;
        }else{
            let proxyStr = proxy === '@chaika' ? Prefs.getUniChar('http_proxy_value') : proxy;
            proxyStr = proxyStr.replace(/\s/g, '');

            let [host, port] = proxyStr.split(':');
            port = Number.parseInt(port, 10);

            proxyInfo = pps.newProxyInfo('http', host, port, 0, 10, directProxyInfo);
        }

        return hph.newProxiedChannel(target.URI || target, proxyInfo, 0, null)
                  .QueryInterface(Ci.nsIHttpChannel);
    }
};
