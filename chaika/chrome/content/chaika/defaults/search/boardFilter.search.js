/* See license.txt for terms of usage */

Components.utils.import("resource://chaika-modules/ChaikaCore.js");

try{
    //Firefox 25+
    Components.utils.import("resource://gre/modules/Promise.jsm");
}catch(ex){
    //Firefox 24
    Components.utils.import("resource://gre/modules/commonjs/sdk/core/promise.js");
}


var BoardFilter = {

    id: '03.chaika.filter.board',

    name: '板名フィルタ',

    version: '1.0.0',

    updateURL: '%%ChaikaDefaultsDir%%/search/boardFilter.search.js',

    charset: 'utf-8',

    url: null,

    search: function(term){
        this._defer = Promise.defer();

        const sql = [
            "SELECT title, url, path, board_type FROM bbsmenu",
            "WHERE is_category=0 AND x_normalize(title) LIKE x_normalize(?1)"
        ].join("\n");

        let storage = ChaikaCore.storage;
        let statement = storage.createStatement(sql);
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
            storage.commitTransaction();
        }

        this._defer.resolve(results);
        return this._defer.promise;
    },

};
