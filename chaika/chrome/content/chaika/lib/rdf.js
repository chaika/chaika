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
 * Portions created by the Initial Developer are Copyright (C) 2004
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


/**
 * RDF データソースを操作するブジェクト
 * @constructor
 */
function b2rRDF(aRdfURL){
	this._init(aRdfURL);
}


b2rRDF.prototype = {

// ********** ********* プロパティ ********** **********

	/**
	 * RDFデータソース
	 * @type nsIRDFDataSource
	 */
	get ds(){
		return this._ds;
	},

// ********** ********* メソッド ********** **********

	_init: function(aRDF){
		this._rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
					.getService(Components.interfaces.nsIRDFService);
		this._rdfCUtils = Components.classes["@mozilla.org/rdf/container-utils;1"]
					.getService(Components.interfaces.nsIRDFContainerUtils);

			// インメモリデータソース
		if(!aRDF){
			this._ds = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"]
						.createInstance(Components.interfaces.nsIRDFDataSource);
			return;
		}

		if(aRDF instanceof Components.interfaces.nsIRDFDataSource){
			this._ds = aRDF;
		}

		if(typeof(aRDF)=="string"){
				// 内蔵データソース
			if(aRDF.substring(0, 4)=="rdf:"){
				this._ds = this._rdfService.GetDataSource(aRDF);
				return;
			}

				// RDF の同期読み込み
			this._ds = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"]
						.createInstance(Components.interfaces.nsIRDFDataSource);
			var httpReq = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance(Components.interfaces.nsIXMLHttpRequest);
			var rdfParser = Components.classes["@mozilla.org/rdf/xml-parser;1"]
					.createInstance(Components.interfaces.nsIRDFXMLParser);
			try{
				httpReq.open("GET", aRDF, false);
				httpReq.send(null);
				rdfParser.parseString(this._ds, httpReq.channel.URI, httpReq.responseText);
			}catch(ex){
				this._ds = this._rdfService.GetDataSource(aRDF);
			}
		}
	},


	/**
	 * nsIRDFResource、nsIRDFContainer、リソースID のいずれかを受け取って
	 * nsIRDFResource を返す
	 * @param {variable} nsIRDFResource、nsIRDFContainer、リソースID のいずれか
	 * @return nsIRDFResource
	 */
	getResource: function(aResource){
		if(typeof(aResource) == "string") return this._rdfService.GetResource(aResource);
		if(aResource instanceof Components.interfaces.nsIRDFResource){
			return aResource;
		}
		if(aResource instanceof Components.interfaces.nsIRDFContainer){
			return aResource.Resource;
		}
		return this._rdfService.GetResource(aResource);
	},


	/**
	 * 目的語(Object)を設定する
	 * @param {variable} aSubject 主語(Subject)を示すリソース
	 * @param {variable} aPredicate 述語(Predicate)を示すリソース
	 * @param {variable} aObject 目的語(Object) を示すリソース
	 */
	setObject: function(aSubject, aPredicate, aObject, aType){
		var subject = this.getResource(aSubject);
		var predicate = this.getResource(aPredicate);
		var newObject;
		var compInterface;
		switch(aType){
			case "int":
				newObject = this._rdfService.GetIntLiteral(aObject);
				compInterface = Components.interfaces.nsIRDFInt;
				break;
			case "date":
				newObject = this._rdfService.GetDateLiteral(aObject);
				compInterface = Components.interfaces.nsIRDFDate;
				break;
			case "str":
			default:
				newObject = this._rdfService.GetLiteral(aObject);
				compInterface = Components.interfaces.nsIRDFLiteral;
				break;
		}
		var oldObject = this.ds.GetTarget(subject, predicate, true);
		if(oldObject){
			oldObject.QueryInterface(compInterface);
			if(newObject.Value != oldObject.Value){
				this.ds.Change(subject, predicate, oldObject, newObject);
			}
			return;
		}

		this.ds.Assert(subject, predicate, newObject, true);
	},


	/**
	 * 目的語(Object)を取得する
	 * @param {variable} aSubject 主語(Subject)を示すリソース
	 * @param {variable} aPredicate 述語(Predicate)を示すリソース
 	 * @return 目的語
	 */
	getObject: function(aSubject, aPredicate){
		var subject = this.getResource(aSubject);
		var predicate = this.getResource(aPredicate);
		var object = this.ds.GetTarget(subject, predicate, true);
		if(!object){ return null; }
		if(object instanceof Components.interfaces.nsIRDFLiteral){
			object.QueryInterface(Components.interfaces.nsIRDFLiteral);
		}
		if(object instanceof Components.interfaces.nsIRDFInt){
			object.QueryInterface(Components.interfaces.nsIRDFInt);
		}
		if(object instanceof Components.interfaces.nsIRDFDate){
			object.QueryInterface(Components.interfaces.nsIRDFDate);
		}
		return object.Value;
	},


	/**
	 * 指定した主語(Subject)に関連する文(Statement)を削除する
	 */
	deleteStatements: function(aSubject){
		var predicates = gRDF.ds.ArcLabelsOut(aSubject);
		while(predicates.hasMoreElements()){
			var predicate = predicates.getNext()
					.QueryInterface(Components.interfaces.nsIRDFResource);
			var object = this.ds.GetTarget(aSubject, predicate, true);
			this.ds.Unassert(aSubject, predicate, object);
		}
	},


	/**
	 * コンテナにリソースを格納する
	 * @param {variable} aResource リソース
	 * @param {variable} aParentContainer リソースを格納するコンテナ
	 * @return 作成した nsIRDFResource
	 */
	containerAppend: function(aResource, aParentContainer){
		var resource = this.getResource(aResource);
		var parentContainer = this.getContainer(aParentContainer);
		parentContainer.AppendElement(resource);
		return resource;
	},


	/**
	 * 指定したリソースのコンテナを返す
	 * @param {variable} aResource 作成するコンテナのリソース
	 * @return 指定した nsIRDFContainer
	 */
	getContainer: function(aResource){
		var containerRes = this.getResource(aResource);
		try{
			var rdfContainer = Components.classes["@mozilla.org/rdf/container;1"]
						.createInstance(Components.interfaces.nsIRDFContainer);
			rdfContainer.Init(this.ds, containerRes);
			return rdfContainer;
		}catch(ex){}
		return null;
	},


	/**
	 * 指定したリソースを含むコンテナを返す
	 * @param {variable} aResource リソース
	 * @return nsIRDFContainer
	 */
	getParentContainer: function(aResource){
		var properties = gRDF.ds.ArcLabelsIn(aResource);
		while(properties.hasMoreElements()){
			var property = properties.getNext()
					.QueryInterface(Components.interfaces.nsIRDFResource);
			if(this._rdfCUtils.IsOrdinalProperty(property)){
				var source = gRDF.ds.GetSource(property, aResource, true);
				return this.getContainer(source);
			}
		}
		return null;
	},


	/**
	 * 新しい順指定(Seq)コンテナを作成する
	 * @param {variable} aResource 作成するコンテナのリソース
	 * @return 作成した nsIRDFContainer
	 */
	makeSeqContainer: function(aResource){
		var containerRes = this.getResource(aResource);
		return this._rdfCUtils.MakeSeq(this.ds, containerRes);
	},


	/**
	 * コンテナの内容を削除
	 * @param {variable} aResource 内容を削除するコンテナのリソース
	 */
	clearContainer: function(aResource){
		var container = this.getContainer(aResource);
		while(container.GetCount()){
			container.RemoveElementAt(1, true);
		}
	},


	/**
	 * RDF データソースの XML ソースを返す
	 * @param {string} 追加する XML名前空間の接頭辞 (追加しないなら null)
	 * @param {string} 追加する XML名前空間の URI (追加しないなら null)
	 * @return XML ソース
	 */
	getXmlSource: function(aNsPrefix, aNsURL){
		var serializer = Components.classes["@mozilla.org/rdf/xml-serializer;1"]
					.createInstance(Components.interfaces.nsIRDFXMLSerializer);
		serializer.init(this.ds);

		if(aNsPrefix && aNsURL){
			var atomService = Components.classes["@mozilla.org/atom-service;1"]
					.getService(Components.interfaces.nsIAtomService);
			var prefix = atomService.getAtom(aNsPrefix);
			serializer.addNameSpace(prefix, aNsURL);
		}

		var outputStream = {
			data: new Array(),
			write: function(aBuffer, aCount){
				this.data.push(aBuffer);
				return aCount;
			}
		};

		serializer.QueryInterface(Components.interfaces.nsIRDFXMLSource)
						.Serialize(outputStream);
		return(outputStream.data.join(""));
	}

}
