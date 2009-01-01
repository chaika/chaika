/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is bbs2chreader.
 *
 * The Initial Developer of the Original Code is
 * flyson.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson at users.sourceforge.jp>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://chaika-modules/ChaikaCore.js");


/**
 * シンプルなダウンローダオブジェクト
 * @constructor
 * @param {string} aURLSpec 保存する URL
 * @param {string} aFilePath 保存先ファイルパス
 */
function b2rDownloader(aURLSpec, aFilePath){
	this._urlSpec = aURLSpec;
	this._filePath = aFilePath;
	this._browserPersist = null;
	this._loading = false;
}

b2rDownloader.prototype = {

// ********** ********* 定数 ********** **********


	/**
	 * 不正な URL
	 * @const
	 * @type number
	 */
	ERROR_BAD_URL: 1,

	/**
	 * 不正なファイルパス
	 * @const
	 * @type number
	 */
	ERROR_BAD_FILE_PATH: 2,

	/**
	 * リクエストの失敗
	 * @const
	 * @type number
	 */
	ERROR_FAILURE: 3,

	/**
	 * タイムアウト
	 * @const
	 * @type number
	 */
	ERROR_NET_TIMEOUT: 4,

	/**
	 * 接続先が見付からない
	 * @const
	 * @type number
	 */
	ERROR_UNKNOWN_HOST: 5,

	/**
	 * キャッシュがない(オフライン)
	 * @const
	 * @type number
	 */
	ERROR_NOT_CACHED: 6,

	/**
	 * キャンセルされた
	 * @const
	 * @type number
	 */
	ERROR_CANCEL: 7,


// ********** ********* プロパティ ********** **********


	/**
	 * URL
	 * @type string
	 */
	get urlSpec(){ return this._urlSpec; },

	/**
	 * ファイルパス
	 * @type string
	 */
	get filePath(){ return this._filePath; },

	/**
	 * ダウンロード中なら真
	 * @type boolean
	 */
	get loading(){ return this._loading; },


// ********** ********* メソッド ********** **********

	/**
	 * ダウンロードを開始する
	 */
	download: function(){
		this._loading = false;
		if(this._browserPersist){
			this._browserPersist.cancelSave();
			this._browserPersist = null;
		}

		var ioService = XPC.getService("@mozilla.org/network/io-service;1", "nsIIOService");

		try{
			this._file = XPC.createInstance("@mozilla.org/file/local;1", "nsILocalFile");
			this._file.initWithPath(this.filePath);
			if(!this._file.parent.exists()){
				this._file.parent.create(Ci.nsILocalFile.DIRECTORY_TYPE, 0755);
			}
		}catch(ex){
			this.onError(this, this.ERROR_BAD_FILE_PATH);
			return;
		}

			// nsIURI の作成
		try{
			var fromURI = ioService.newURI(this.urlSpec, null, null);
		}catch(ex){
			this.onError(this, this.ERROR_BAD_URL);
			return;
		}

		this._browserPersist = XPC.createInstance("@mozilla.org/embedding/browser/nsWebBrowserPersist;1", "nsIWebBrowserPersist");
		this._browserPersist.persistFlags |= Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE
					| Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

		var httpChannel = ChaikaCore.getHttpChannel(fromURI);
		httpChannel.requestMethod = "GET";
		httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
		httpChannel.loadFlags |= Ci.nsIHttpChannel.LOAD_BYPASS_CACHE;
		httpChannel.notificationCallbacks = this._browserPersist;

		this._listener._context = this;
		this._browserPersist.progressListener = this._listener;
		this._browserPersist.saveChannel(httpChannel, this._file);
	},

	_listener: {
		onLocationChange : function(aWebProgress, aRequest, aLocation){},
		onProgressChange : function (aWebProgress, aRequest,
				aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress){

			if(aMaxTotalProgress == -1){
				this._context.onProgressChange(this._context, -1);
				return;
			}

			percentage = Math.floor(aCurTotalProgress / aMaxTotalProgress * 100);
			this._context.onProgressChange(this._context, percentage);
		},
		onSecurityChange: function(aWebProgress, aRequest, aState){},
		onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage){},
		onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus){
 				// nsNetError.h
 			const NS_ERROR_MODULE_NETWORK      = 2152398848;
 			const NS_ERROR_NET_TIMEOUT         = NS_ERROR_MODULE_NETWORK + 14;
 			const NS_ERROR_UNKNOWN_HOST        = NS_ERROR_MODULE_NETWORK + 30;
			const NS_ERROR_REDIRECT_LOOP       = NS_ERROR_MODULE_NETWORK + 31;
			const NS_ERROR_DOCUMENT_NOT_CACHED = NS_ERROR_MODULE_NETWORK + 70;

			if(aStateFlags & Ci.nsIWebProgressListener.STATE_START){
				this._context._loading = true;
				this._context.onStart(this._context);
			}else if(aStateFlags & Ci.nsIWebProgressListener.STATE_STOP){
				this._context._loading = false;
				if(aStatus==0 || aStatus==NS_ERROR_REDIRECT_LOOP){
					aRequest.QueryInterface(Ci.nsIHttpChannel);
					this._context.onStop(this._context, aRequest.responseStatus);
				}else{
						// XXX 詳細なエラーを出す
					this._context.onError(this._context, this._context.ERROR_FAILURE);
				}
			}
		},

		QueryInterface : function(aIID){
			if(aIID.equals(Components.interfaces.nsIWebProgressListener) ||
					aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
					aIID.equals(Components.interfaces.nsISupports)){
				return this;
			}
			throw Components.results.NS_NOINTERFACE;
		}
	},


	/**
	 * ダウンロードを中止する
	 * @param {boolean} aSilent 真ならエラーを返さない
	 */
	abort: function(aSilent){
		try{
			this._browserPersist.cancelSave();
			this._browserPersist = null;
		}catch(ex){}

		if(!aSilent) this.onError(this, this.ERROR_CANCEL);

		this._loading = false;
	},


// ********** ********* イベントハンドラ ********** **********


	/**
	 * ダウンロードの開始
	 * @param {b2rDownloader} aDownloader b2rDownloader
	 */
	onStart: function(aDownloader){},


	/**
	 * ダウンロードの終了
	 * @param {b2rDownloader} aDownloader b2rDownloader
	 * @param {number} aStatus リクエストの HTTP ステータス
	 */
	onStop: function(aDownloader, aStatus){},


	/**
	 * プログレスの変更
	 * @param {b2rDownloader} aDownloader b2rDownloader
	 * @param {number} aPercentage 進行率
	 */
	onProgressChange: function(aDownloader, aPercentage){},


	/**
	 * ダウンロードの失敗
	 * @param {b2rDownloader} aDownloader b2rDownloader
	 * @param {number} aErrorCode エラーコード(ERROR_XXX)
	 */
	onError: function(aDownloader, aErrorCode){}

}
