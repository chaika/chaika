/* See license.txt for terms of usage */

'use strict';

this.EXPORTED_SYMBOLS = ["Prefs"];

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Services } = Cu.import("resource://gre/modules/Services.jsm", {});


this.Prefs = {


    get branch(){
        delete this.branch;
        return (this.branch = Services.prefs.getBranch('extensions.chaika.'));
    },


    /**
     * Get the state of a preference, whose type is string, integer, or boolean.
     * @param {String} aPrefName The preference name to get.
     */
    get(aPrefName) {
        switch(this.branch.getPrefType(aPrefName)){

            case Services.prefs.PREF_STRING:
                return this.branch.getCharPref(aPrefName);

            case Services.prefs.PREF_INT:
                return this.branch.getIntPref(aPrefName);

            case Services.prefs.PREF_BOOL:
                return this.branch.getBoolPref(aPrefName);

            case Services.prefs.PREF_INVALID:
            default:
                throw new Error('The type of value is not string, integer, or boolean.');

        }
    },


    /**
     * Set the state of a preference, whose type is string, integer, or boolean.
     * @param {String} aPrefName The preference name to set.
     * @param {String|Number|Boolean} aValue The value to set.
     */
    set(aPrefName, aValue) {
        switch(this.branch.getPrefType(aPrefName)){

            case Services.prefs.PREF_STRING:
                return this.branch.setCharPref(aPrefName, aValue);

            case Services.prefs.PREF_INT:
                return this.branch.setIntPref(aPrefName, aValue);

            case Services.prefs.PREF_BOOL:
                return this.branch.setBoolPref(aPrefName, aValue);

            case Services.prefs.PREF_INVALID:
            default:
                throw new Error('The type of value is not string, integer, or boolean.');

        }
    },


    getUniChar(aPrefName) {
        return this.branch.getComplexValue(aPrefName, Ci.nsISupportsString).data;
    },


    setUniChar(aPrefName, aValue) {
        let ss = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        ss.data = aValue;

        return this.branch.setComplexValue(aPrefName, Ci.nsISupportsString, ss);
    },


    getFile(aPrefName) {
        return this.branch.getComplexValue(aPrefName, Ci.nsIFile);
    },


    setFile(aPrefName, aValue) {
        return this.branch.setComplexValue(aPrefName, Ci.nsIFile, aValue);
    }

};
