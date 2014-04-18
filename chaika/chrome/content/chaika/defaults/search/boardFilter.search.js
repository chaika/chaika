Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");

try{
    //Firefox 25+
    Components.utils.import("resource://gre/modules/Promise.jsm");
}catch(ex){
    //Firefox 24
    Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js");
}

//Polyfill for Firefox 24
//Copied from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function(predicate) {
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                if (i in list) {
                    value = list[i];
                    if (predicate.call(thisArg, value, i, list)) {
                        return value;
                    }
                }
            }
            return undefined;
        }
    });
}


var BoardFilter = {

    id: 'chaika.filter.board',

    name: '板名フィルタ',

    charset: 'utf-8',

    url: null,

    search: function(term){
        this._defer = Promise.defer();

        const sql = [
            "SELECT title, url, path, board_type FROM bbsmenu",
            "WHERE is_category=0 AND x_normalize(title) LIKE x_normalize(?1)"
        ].join("\n");

        let statement = ChaikaCore.storage.createStatement(sql);
        let results = [];

        storage.beginTransaction();

        try{
            statement.bindStringParameter(0, "%" + term + "%");

            while(statement.executeStep()){
                let title = statement.getString(0);
                let url = statement.getString(1);
                let path = statement.getString(2);
                let boardType = statement.getInt32(3);

                results.push({
                    title: title,
                    url: url,
                    type: boardType,
                });
            }
        }catch(ex){
            ChaikaCore.logger.error(ex);
        }finally{
            statement.reset();
            statement.finalize();
            ChaikaCore.storage.commitTransaction();
        }

        setTimeout(function(){ this._defer.resolve(results); }, 0);
        return this._defer.promise;
    },

}
