
Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import('resource://chaika-modules/ChaikaAA.js');


var gAAManager = {

    startup: function(){
        this._initTree();
    },


    shutdown: function(){


    },


    _initTree: function(){
        let tree = document.getElementById("aaTree");

        tree.builder.datasource = ChaikaAA.getAAXML();
        tree.builder.rebuild();
    }


};
