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
const PR_RDONLY = 0x01;
const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_APPEND = 0x10;
const PR_TRUNCATE = 0x20;

// nsNetError.h
const NS_ERROR_MODULE_NETWORK      = 2152398848;
const NS_BINDING_ABORTED           = NS_ERROR_MODULE_NETWORK + 2;
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

		try{
			try{
				if(!this.file.parent.exists()){
					this.file.parent.create(Ci.nsILocalFile.DIRECTORY_TYPE, PR_PERMS_DIR);
				}
			}catch(ex){
				ChaikaCore.logger.error(ex);
				this.onError(this, ChaikaDownloader.ERROR_BAD_FILE);
				return;
			}
		}catch(ex){
			ChaikaCore.logger.error(ex);
			this.onError(this, ChaikaDownloader.ERROR_BAD_FILE);
			return;
		}

		this.wrappedJSObject = this;

		this._httpChannel = ChaikaCore.getHttpChannel(this.url);
		this._httpChannel.requestMethod = "GET";
		this._httpChannel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
		this._httpChannel.loadFlags |= Ci.nsIHttpChannel.LOAD_BYPASS_CACHE;
		this._httpChannel.asyncOpen(this._listener, this);
	},


	_listener: {

		onStartRequest: function (aRequest, aContext) {
			var context = aContext.wrappedJSObject;

			context.loading = true;
			context.onStart(context);

			this._data = [];
		},


		onDataAvailable: function (aRequest, aContext, aStream, aSourceOffset, aLength) {
			if(aLength == 0) return;

			var context = aContext.wrappedJSObject;

			aRequest.QueryInterface(Ci.nsIHttpChannel);
			var httpStatus = aRequest.responseStatus;


			if(aRequest.contentLength != -1){
				var percentage = Math.floor((aSourceOffset * 100.0) / aRequest.contentLength);
				context.onProgressChange(context, percentage);
			}


			var inputStream = Cc["@mozilla.org/binaryinputstream;1"]
					.createInstance(Ci.nsIBinaryInputStream);
			inputStream.setInputStream(aStream);
			this._data.push(inputStream.readBytes(aLength));
		},


		onStopRequest: function (aRequest, aContext, aStatus){
			var context = aContext.wrappedJSObject;
			context.loading = false;

			aRequest.QueryInterface(Ci.nsIHttpChannel);


			if(Components.isSuccessCode(aStatus)) {
				try{
					var outputStream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
						.createInstance(Ci.nsIFileOutputStream)
							.QueryInterface(Ci.nsISafeOutputStream);
					var ioFlag = PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE;
					outputStream.init(context.file, ioFlag, PR_PERMS_FILE, 0);

					var data = this._data.join("");
					outputStream.write(data, data.length);
					outputStream.finish();
					outputStream.close();
				}catch(ex){
					ChaikaCore.logger.error(ex);
				}
				context.onStop(context, aRequest.responseStatus);
			}else if(aStatus == NS_BINDING_ABORTED){
				// キャンセル
			}else{
				ChaikaCore.logger.error([aRequest.URI.spec, aStatus.toString(16)]);
						// TODO 詳細なエラーを出す
				context.onError(context, ChaikaDownloader.ERROR_FAILURE);
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
	 * ダウンロードを中止する。
	 * @param {Boolean} aSilent 真なら ERROR_CANCEL エラーを発生させない。
	 */
	abort: function ChaikaDownloader_abort(aSilent){
		try{
			this._httpChannel.cancel(NS_BINDING_ABORTED);
			this._httpChannel = null;
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