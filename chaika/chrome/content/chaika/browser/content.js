/* See license.txt for terms of usage */

/**
 * Frame Script
 */

var ChaikaBrowserContent = {

    init: function(){
        addMessageListener('chaika-skin-changed', this.handleMessage.bind(this));
        addMessageListener('chaika-post-finished', this.handleMessage.bind(this));
        addMessageListener('chaika-abone-data-add', this.handleMessage.bind(this));
        addMessageListener('chaika-abone-data-remove', this.handleMessage.bind(this));
    },


    handleMessage: function(message){
        if(!message.name.startsWith('chaika-')) return;
        if(!this.executeBrowserMenuCommand('_isChaika', content.location.href)) return;


        switch(message.name){
            case 'chaika-skin-changed':
                if(this.executeBrowserMenuCommand('_isThread', content.location.href)){
                    content.location.reload();
                }
                break;

            case 'chaika-post-finished':
                let postedThreadURL = new content.URL(message.data.url);

                if(content.location.pathname.contains(postedThreadURL.pathname)){
                    content.location.reload();
                }
                break;

            case 'chaika-abone-data-add':

                break;

            case 'chaika-abone-data-remove':

                break;

        }
    },


    executeBrowserMenuCommand: function(name, ...args){
        return sendSyncMessage('chaika-browser-menu-command', {
            name: name,
            args: args
        })[0];
    }

};


ChaikaBrowserContent.init();
