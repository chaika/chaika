function b2rBbsmenuTreeView(){
	this._items = new Array();
	this._viewItems = new Array();
}

b2rBbsmenuTreeView.prototype = {

	get items(){
		return this._items;
	},

	get viewItems(){
		return this._viewItems;
	},

	get searchString(){
		return this._searchString;
	},
	set searchString(aValue){
		this._searchString = aValue;
		this._searchMode = (aValue != "");

		this._treeBox.rowCountChanged(0, - this.rowCount);
		this._refreshItems();
		this._treeBox.rowCountChanged(0, this.rowCount);
		
		return aValue;
	},

	get searchMode(){
		return this._searchMode;
	},
	
	init: function(){
		this._atomService = Components.classes["@mozilla.org/atom-service;1"]
				.getService(Components.interfaces.nsIAtomService);
		this._searchMode = false;
		this._items = new Array();

		var openedCategories = gTreeBbsMenu.getAttribute("openedCategories");
		openedCategories = openedCategories.split(" ");
		openedCategories = openedCategories.map(function(aElement, aIndex, aArray){
			return decodeURI(aElement);
		});
		for(var i=0; i<arguments.length; i++){
			var doc = arguments[i];
			if(doc.documentElement.localName != "bbsmenu") continue;
			doc.documentElement._item = null;
			var allElements = doc.documentElement.getElementsByTagName("*");
			for(var j=0; j<allElements.length; j++){
				var element = allElements[j];
				var item = {};
				item.title = element.getAttribute("title");
				item.url = element.getAttribute("url");
				item.type = element.getAttribute("type");
				item.isSeparator = (element.localName == "separator");
				item.isContainer = (element.localName == "category");
				item.isOpen = ((item.isContainer) && (openedCategories.indexOf(item.title) != -1));
				element._item = item;
				item.parent = (element.parentNode._item) ? element.parentNode._item : null;
				item.level = (item.parent) ? item.parent.level + 1 : 0;
				this._items.push(item);
			}
		}
		this._refreshItems();
	},
	
	_refreshItems: function(){
		this._viewItems = new Array();

		if(this.searchMode){
			var unicodeNormalizer  = Components.classes["@mozilla.org/intl/unicodenormalizer;1"]
					.createInstance(Components.interfaces.nsIUnicodeNormalizer);
			var normalizedStr = {};

			var searchString = this.searchString.toLowerCase();
			unicodeNormalizer.NormalizeUnicodeNFKC(searchString, normalizedStr);
			searchString = normalizedStr.value;

			var items = this.items;
			for(var i=0; i<items.length; i++){
				var item = items[i];
				if(item.isContainer) continue;
				var title = item.title.toLowerCase();
				unicodeNormalizer.NormalizeUnicodeNFKC(title, normalizedStr);				
				title = normalizedStr.value;
				if(title.indexOf(searchString) != -1)
					this._viewItems.push(item);
			}
			return;
		}
		
		for(var i=0; i<this.items.length; i++){
			var item = this.items[i];
			var view = true;
			var parent = item.parent;
			
			for(var parent=item.parent; parent!=null; parent=parent.parent){
				if(!parent.isOpen) view = false;
			}
			if(view) this._viewItems.push(item);
		}
	},

	persistOpenedCategories: function(){
		var openedCategories = new Array();
		this.viewItems.forEach(function(aElement, aIndex, aArray){
			if(aElement.isOpen) this.push(encodeURI(aElement.title));
		}, openedCategories);
		gTreeBbsMenu.setAttribute("openedCategories", openedCategories.join(" "));
	},


// ********** ********* implements nsITreeView ********** **********

	get rowCount(){
		return this.viewItems.length;
	},
	
	selection: null,

	getCellText : function(aRow, aCol){
		if(this.viewItems[aRow].isSeparator) return "";
		return this.viewItems[aRow][aCol.id];
	},

	setTree: function(aTree){
		this._treeBox = aTree;
	},

	cycleHeader: function(aCol, aElement){
	},

	getRowProperties: function(aIndex, aProperties){},
	getCellProperties: function(aRow, aCol, aProperties){
		if(this.viewItems[aRow].isSeparator) return;
		if(aCol.primary){
			aProperties.AppendElement(this._atomService.getAtom("Name"));
			var type = this.viewItems[aRow].type;
			if(type)
				aProperties.AppendElement(this._atomService.getAtom("type-" + type));
		}
	},
	getColumnProperties: function(aCol, aColElement, aProperties){},
	isContainer: function(aRow){
		return this.viewItems[aRow].isContainer;
	},
	isContainerOpen: function(aRow){
		if(this.viewItems[aRow].isContainer){
			return this.viewItems[aRow].isOpen;
		}
		return false;
	},
	isContainerEmpty: function(aRow){
		return false;
	},
	isSeparator: function(aRow){
		return this.viewItems[aRow].isSeparator;	
	},
	isSorted: function(aRow){},
	canDropOn: function(aIndex){},
	canDropBeforeAfter: function(aIndex, aBefore){},
	drop: function(aIndex, aOrientation){},
	getParentIndex: function getParentIndex(aIndex){
		if(this.searchMode) return -1;
		if(this.viewItems[aIndex].isContainer) return -1;

		var parent = this.viewItems[aIndex].parent;
		if(!parent) return -1;
		return this.viewItems.indexOf(parent);
	},
	hasNextSibling: function(aIndex, aAfterIndex){
		if(this.searchMode) return false;
		if(aIndex + 1 == this.viewItems.length) return false;

		var item = this.viewItems[aIndex];
		if(item.isContainer){
			for(var i=aIndex+1; i<this.viewItems.length; i++){
				if(item.parent == this.viewItems[i].parent) return true;
			}
			return false;
		}else if(item.level == this.viewItems[aIndex+1].level){
			return true;
		}
		return false;
	},
 	getLevel: function(aIndex){
		if(this.searchMode) return 0;
		return this.viewItems[aIndex].level;
	},
	getImageSrc: function(aRow, aCol){},
	getProgressMode: function(aRow, aCol){},
	getCellValue: function(aRow, aCol){},
	selectionChanged: function(){},
	cycleCell: function(aRow, aCol){},
	isEditable: function(aRow, aCol){},
	setCellText: function(aRow, aCol, aValue){},
	toggleOpenState: function(aIndex){
		var category = this.viewItems[aIndex];
		category.isOpen = !category.isOpen;
		var lastCount = this.rowCount;
		this._refreshItems();
		var delta = this.rowCount - lastCount;
		this._treeBox.rowCountChanged(aIndex + 1, delta);
		this._treeBox.invalidateRow(aIndex);		
	},
	performAction: function(aAction){},
	performActionOnRow: function(aAction, aRow){},
	performActionOnCell: function(aAction, aRow, aCol){}
}