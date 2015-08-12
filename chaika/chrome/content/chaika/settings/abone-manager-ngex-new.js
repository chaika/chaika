/* See license.txt for terms of usage */

Components.utils.import('resource://chaika-modules/ChaikaCore.js');
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");


var gEditor;


function startup(){
    gEditor = document.getElementById('ngex-editor');

    gEditor.setAutoNaming(true);
    gEditor._setExpirePreset('today', true);

    if('arguments' in window &&
       window.arguments.length > 0 &&
       typeof window.arguments[0] === 'object'){
            gEditor.populateData(window.arguments[0]);
    }

    window.sizeToContent();
}


function shutdown(){
}


function onDialogAccept(){
    if(gEditor._enableAutoNaming){
        gEditor.setLabel();
    }

    ChaikaAboneManager.ex.add(gEditor.getNgData());
}
