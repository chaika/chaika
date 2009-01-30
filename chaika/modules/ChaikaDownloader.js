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
 * The Original Code is chaika.
 *
 * The Initial Developer of the Original Code is
 * chaika.xrea.jp
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson.moz at gmail.com>
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


EXPORTED_SYMBOLS = ["ChaikaDownloader"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");


const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const PR_PERMS_DIR = 0755;
const PR_PERMS_FILE = 0644;

// nsNetError.h
const NS_ERROR_MODULE_NETWORK      = 2152398848;
const NS_ERROR_NET_TIMEOUT         = NS_ERROR_MODULE_NETWORK + 14;
const NS_ERROR_UNKNOWN_HOST        = NS_ERROR_MODULE_NETWORK + 30;
const NS_ERROR_REDIRECT_LOOP       = NS_ERROR_MODULE_NETWORK + 31;
const NS_ERROR_DOCUMENT_NOT_CACHED = NS_ERROR_MODULE_NETWORK + 70;


/** @ignore */
function makeException(aResult){
	var stack = Components.stack.caller.caller;
	return new Components.Exception("exception", aResult, stack);
}


/**
 * シンプルなダウンローダオブジェクト。
 * @constructor
 * @param {nsIURL} aURL 保存する URL
 * @param {nsILocalFile} aLocalFile 保存先ファイル
 */
function ChaikaDownloader(aURL, aLocalFile){
	if(!(aURL instanceof Ci.nsIURL)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}
	if(!(aLocalFile instanceof Ci.nsILocalFile)){
		throw makeException(Cr.NS_ERROR_INVALID_POINTER);
	}

	this.url = aURL;
	this.file = aLocalFile;

	this._tempFile = null;
	this._browserPersist = null;
	this.loading = false;
}


ChaikaDownloader.prototype = {

	/**
	 * ダウンロード元 URL。
	 * @type nsIURL
	 */
	url: null,


	/**
	 * ダウンロード先ファイル。
	 * @type nsILocalFile
	 */
	file: null,


	/**
	 * ダウンロードを開始する。
	 */
	download: function ChaikaDownloader_download(){
		this.loading = false;
		if(this._browserPersist){
			this._browserPersist.cancelSave();
			this._browserPersist = null;
		}

		try{
			if(!this.file.parent.exists()){
				this.file.parent.create(Ci.nsILocalFile.DIRECTORY_TYPE, PR_PERMS_DIR);
			}

			this._tempFile = this.file.clone();
			this._tempFile.createUnique(Ci.nsILocalFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);

		}catch(ex){
			ChaikaCore.logger.error(ex);
			this.onError(this, ChaikaDownloader.ERROR_BAD_FILE);
			return;
		}

		this._browserPersist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(Ci.nsIWebBrowserPersist);
		this._browserPersist.persistFlags |=
					Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE |
					Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
					Ci.nsIWebBrowserPersist.PERSIST_FLAGS_CLEANUP_ON_FAILURE |
					Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

		var httpChannel = ChaikaCore.getHttpChannel(this.url);
		httpChannel.requestMethod = "GET";
		httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
		httpChannel.loadFlags |= Ci.nsIHttpChannel.LOAD_BYPASS_CACHE;
		httpChannel.notificationCallbacks = this._browserPersist;

		this._listener._context = this;
		this._browserPersist.progressListener = this._listener;
		this._browserPersist.saveChannel(httpChannel, this._tempFile);
	},


	/**
	 * ダウンロードを監視する nsIWebProgressListener 実装。
	 * @private
	 */
	_listener: {
		/** @private */
		onLocationChange: function(aWebProgress, aRequest, aLocation){},
		/** @private */
		onSecurityChange: function(aWebProgress, aRequest, aState){},
		/** @private */
		onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage){},


		/** @private */
		onProgressChange: function ChaikaDownloader__listener_onProgressChange(
								aWebProgress, aRequest,	aCurSelfProgress,
								aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress){

			var percentage = -1;
			if(aMaxTotalProgress != -1){
				percentage = Math.floor(aCurTotalProgress / aMaxTotalProgress * 100);
			}
			this._context.onProgressChange(this._context, percentage);
		},


		/** @private */
		onStateChange: function ChaikaDownloader__listener_onStateChange(
								aWebProgress, aRequest, aStateFlags, aStatus){

			if(aStateFlags & Ci.nsIWebProgressListener.STATE_START){
				this._context.loading = true;
				this._context.onStart(this._context);
			}else if(aStateFlags & Ci.nsIWebProgressListener.STATE_STOP){
				this._context.loading = false;
				aRequest.QueryInterface(Ci.nsIHttpChannel);

				if(aStatus==0 || aStatus==NS_ERROR_REDIRECT_LOOP){
					this._context._saveFile();
					this._context.onStop(this._context, aRequest.responseStatus);
				}else{
					ChaikaCore.logger.error([aRequest.URI.spec,
							aStateFlags.toString(16), aStatus.toString(16)]);
						// TODO 詳細なエラーを出す
					this._context.onError(this._context, ChaikaDownloader.ERROR_FAILURE);

					try{
						var tempFile = this._context._tempFile.clone().QueryInterface(Ci.nsILocalFile);
						if(tempFile.exists()){
							tempFile.remove(false);
							ChaikaCore.logger.debug("Remove File: " + tempFile.path);
						}
					}catch(ex){
						this._context.onError(ex);
					}
				}
			}
		},


		/** @private */
		QueryInterface: XPCOMUtils.generateQI([
			Ci.nsIWebProgressListener,
			Ci.nsISupportsWeakReference,
			Ci.nsISupports
		])
	},


	/**
	 * ダウンロード終了時に Temp ファイルを削除、コピーを行う。
	 * @private
	 */
	_saveFile: function ChaikaDownloader__saveFile(){
		this._tempFile = this._tempFile.clone().QueryInterface(Ci.nsILocalFile);

		try{
			if(this._tempFile.fileSize == 0){
				ChaikaCore.logger.debug("Empty File: " + this._tempFile.path);
			}

				// temp ファイルを ファイルに上書き
			if(!this.file.equals(this._tempFile)){
				this._tempFile.moveTo(this.file.parent, this.file.leafName);
				this._tempFile = null;
				this.file = this.file.clone().QueryInterface(Ci.nsILocalFile);
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
		}

	},


	/**
	 * ダウンロードを中止する。
	 * @param {Boolean} aSilent 真なら ERROR_CANCEL エラーを発生させない。
	 */
	abort: function ChaikaDownloader_abort(aSilent){
		try{
			this._browserPersist.cancelSave();
			this._browserPersist = null;
		}catch(ex){}

		if(!aSilent) this.onError(this, ChaikaDownloader.ERROR_CANCEL);

		this._clearEventHandler();

		this.loading = false;
	},


	_clearEventHandler: function ChaikaDownloader__clearEventHandler(){
		this.onStart = function(aDownloader){};
		this.onStop = function(aDownloader, aStatus){};
		this.onProgressChange = function(aDownloader, aPercentage){};
		this.onError = function(aDownloader, aErrorCode){};
	},

	/**
	 * ダウンロード開始時に呼ばれる。
	 * @param {ChaikaDownloader} aDownloader
	 */
	onStart: function(aDownloader){},
	/**
	 * ダウンロード終了時に呼ばれる。
	 * @param {ChaikaDownloader} aDownloader
	 * @param {Number} aStatus リクエストの HTTP ステータス
	 */
	onStop: function(aDownloader, aStatus){},
	/**
	 * プログレスの変更時に呼ばれる。
	 * @param {ChaikaDownloader} aDownloader
	 * @param {Number} aPercentage 進行率
	 */
	onProgressChange: function(aDownloader, aPercentage){},
	/**
	 * ダウンロードの失敗時に呼ばれる。
	 * @param {ChaikaDownloader} aDownloader
	 * @param {Number} aErrorCode エラーコード(ERROR_XXX)
	 */
	onError: function(aDownloader, aErrorCode){}

};


/**
 * 不正な URL。
 * @constant
 */
ChaikaDownloader.ERROR_BAD_URL      = 1;
/**
 * 不正なファイル。
 * @constant
 */
ChaikaDownloader.ERROR_BAD_FILE     = 2;
/**
 * リクエストの失敗。
 * @constant
 */
ChaikaDownloader.ERROR_FAILURE      = 3;
/**
 * タイムアウト。
 * @constant
 */
ChaikaDownloader.ERROR_NET_TIMEOUT  = 4;
/**
 * 接続先が見付からない。
 * @constant
 */
ChaikaDownloader.ERROR_UNKNOWN_HOST = 5;
/**
 * キャッシュがない(オフライン)。
 * @constant
 */
ChaikaDownloader.ERROR_NOT_CACHED   = 6;
/**
 * キャンセルされた。
 * @constant
 */
ChaikaDownloader.ERROR_CANCEL       = 7;
