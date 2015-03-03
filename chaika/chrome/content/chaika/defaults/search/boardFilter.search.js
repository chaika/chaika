/* See license.txt for terms of usage */

Components.utils.import("resource://chaika-modules/ChaikaBBSMenu.js");


var BoardFilter = {

    id: '99.chaika.filter.board',

    name: '板名フィルタ',

    version: '2.0.0',

    charset: 'utf-8',

    url: null,

    search: function(query){
        return ChaikaBBSMenu.getXML().then((xml) => {
            let results = xml.querySelectorAll('[title*="' + query + '"]');

            return Array.slice(results).map((node) => {
                return {
                    title: node.getAttribute('title'),
                    url: node.getAttribute('url')
                };
            });
        });
    },

};
