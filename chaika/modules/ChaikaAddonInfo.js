/* See license.txt for terms of usage */


this.EXPORTED_SYMBOLS = ["ChaikaAddonInfo"];


this.ChaikaAddonInfo = {

    name: "chaika",
    version: "1",

    _init: function ChaikaAddonInfo_init(aAddon){
        this.name = aAddon.name;
        this.version = aAddon.version;
    }

};
