/* See license.txt for terms of usage */


EXPORTED_SYMBOLS = ["ChaikaAddonInfo"];


var ChaikaAddonInfo = {

    name: "chaika",
    version: "1",

    _init: function ChaikaAddonInfo_init(aAddon){
        this.name = aAddon.name;
        this.version = aAddon.version;
    }

};
