/* See license.txt for terms of usage */

'use strict';

Components.utils.import("resource://chaika-modules/ChaikaBBSMenu.js");

let EXPORTED_SYMBOL = "BoardFilter";

let BoardFilter = {

    charset: 'utf-8',

    url: null,

    search: function(query){
        return ChaikaBBSMenu.getXML().then((xml) => {
            let results = xml.querySelectorAll('[title*="' + query + '"]');

            return Array.from(results).map((node) => {
                return {
                    title: node.getAttribute('title'),
                    url: node.getAttribute('url')
                };
            });
        });
    },

};
