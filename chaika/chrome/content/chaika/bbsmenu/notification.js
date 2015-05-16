/* See license.txt for terms of usage */


(function(global){
    "use strict";


    function NotificationService(notifier){
        this._notifier = notifier;
    }

    NotificationService.prototype = {

        _notify: function(aLevel, aMessage, aTimeout){
            let notification = this._notifier.appendNotification(
                aMessage, null, null, aLevel, null
            );

            if(aTimeout){
                setTimeout(() => { this.remove(notification); }, aTimeout);
            }

            return notification;
        },

        clear: function(){
            this._notifier.removeAllNotifications(false);
        },

        remove: function(aNode){
            this._notifier.removeNotification(aNode);
        },

        info: function(aMessage, aTimeout){
            return this._notify(this._notifier.PRIORITY_INFO_MEDIUM, aMessage, aTimeout);
        },

        warn: function(aMessage, aTimeout){
            return this._notify(this._notifier.PRIORITY_WARNING_MEDIUM, aMessage, aTimeout);
        },

        critical: function(aMessage, aTimeout){
            return this._notify(this._notifier.PRIORITY_CRITICAL_MEDIUM_MEDIUM, aMessage, aTimeout);
        },

    };


    // ---- Export ------------------------------------------
    global.NotificationService = NotificationService;

})((this || 0).self || global);
