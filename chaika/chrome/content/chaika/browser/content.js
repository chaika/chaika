/* See license.txt for terms of usage */

/**
 * Frame Script
 */

var ChaikaBrowserContent = {

    init: function(){
        addMessageListener('chaika-skin-changed', this.handleMessage.bind(this));
        addMessageListener('chaika-post-finished', this.handleMessage.bind(this));
        addMessageListener('chaika-abone-data-added', this.handleMessage.bind(this));
        addMessageListener('chaika-abone-data-removed', this.handleMessage.bind(this));
    },


    handleMessage: function(message){
        if(!message.name.startsWith('chaika-')) return;
        if(!this.executeBrowserMenuCommand('_isChaika', content.location.href)) return;


        switch(message.name){
            case 'chaika-skin-changed':
            case 'chaika-post-finished':
                if(this.executeBrowserMenuCommand('_isThread', content.location.href)){
                    content.location.reload();
                }
                break;

            case 'chaika-abone-data-added':

                break;

            case 'chaika-abone-data-removed':

                break;

        }
    },


    executeBrowserMenuCommand: function(name, ...args){
        return sendSyncMessage('chaika-browser-menu-command', {
            name: name,
            args: args
        })[0];
    }

}


ChaikaBrowserContent.init();
