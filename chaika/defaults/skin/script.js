$(document).ready(function(){

	if(document.location.href.indexOf("#")==-1){
		var newMark = $("#newMark");
		var pageTitle = $("#pageTitle");
		window.scrollTo(0, (newMark.offset().top - pageTitle.height() - 30));
	}

	ResCollapse.startup();
	AboneHandler.startup();
	Popup.startup();

});


var ResCollapse = {

	startup: function(){
		$(document).click(ResCollapse.toggleCollapse);
	},


	toggleCollapse: function(aEvent){
		var target = aEvent.originalTarget;
		if(!(target instanceof HTMLElement)) return;

		if(target.className != "resHeader"){
			target = ($(target).parents(".resHeader").get(0));
			if(!target) return;
		}

		var resContainer = $(target).parents(".resContainer");
		var isAbone = (resContainer.attr("isAbone") == "true");

		if(!isAbone) return;

		if(resContainer.attr("collapsed") == "true"){
			if(isAbone){
				resContainer.find(".resHeaderContent").show();
				resContainer.find(".resHeaderAboneContent").hide();
			}
			resContainer.children("dd").slideDown("fast");
			resContainer.attr("collapsed", "false");
		}else{
			if(isAbone){
				resContainer.find(".resHeaderContent").hide();
				resContainer.find(".resHeaderAboneContent").show();
			}
			resContainer.children("dd").slideUp("fast");
			resContainer.attr("collapsed", "true");
		}
	}

};


var AboneHandler = {

	startup: function(){
		document.addEventListener("b2raboneadd", AboneHandler, false);
	},

	handleEvent: function(aEvent){
		var aboneType = aEvent.detail;
		var aboneWord = aEvent.sourceEvent.type;
		var selecttorClassName = "";

		switch(aboneType){
			case 0:    // ChaikaAboneManager.ABONE_TYPE_NAME
				selecttorClassName = ".resName";
				break;
			case 1:    // ChaikaAboneManager.ABONE_TYPE_MAIL
				selecttorClassName = ".resMail";
				break;
			case 2:    // ChaikaAboneManager.ABONE_TYPE_ID
				selecttorClassName = ".resID";
				break;
			case 3:    // ChaikaAboneManager.ABONE_TYPE_WORD
				selecttorClassName = ".resBody";
				break;
			default:
				return;
		}

		var aboneResList = $(selecttorClassName).filter(function(){
			return $(this).text().indexOf(aboneWord) != -1
		}).parents("dl");
		aboneResList.attr("isAbone", "true").attr("collapsed", "true");
	}

};


var Popup = {

	POPUP_DELAY: 250,

	startup: function(){
		$(document).mouseover(Popup.mouseover);
		$(document).mouseout(Popup.mouseout);
	},

	mouseover: function(aEvent){
		var target = aEvent.originalTarget;
		if(!(target instanceof HTMLElement)) return;

		var className = target.className;
		if(className == "") return;


		if(className.substring(0,6) == "mesID_"){
			Popup.ID.mouseover.call(target, aEvent);
			return;
		}

		switch(className){
			case "resPointer":
				Popup.Res.mouseover.call(target, aEvent);
				break;
			case "resID":
			case "resMesID":
				Popup.ID.mouseover.call(target, aEvent);
				break;
			case "outLink":
				Popup.Image.mouseover.call(target, aEvent);
				break;

		}
	},

	mouseout: function(aEvent){
		var target = aEvent.originalTarget;
		if(!(target instanceof HTMLElement)) return;

		var className = target.className;
		if(className == "") return;

		if(target._popupTimeout){
			clearTimeout(target._popupTimeout);
			delete target._popupTimeout;
		}
	},


	showPopupDelay: function(aEvent, aPopupContent, aAddClassName){
			if(aPopupContent.length == 0) return;

			if(aEvent.relatedTarget && aEvent.relatedTarget.className == "popup"){
				return;
			}

			try{
				var popupInnerNode = $(document.createElement("div"))
						.addClass("popupInner").append(aPopupContent);
				if(aAddClassName){
					popupInnerNode.addClass(aAddClassName);
				}
			}catch(ex){
				dump(aAddClassName + " : " + ex +"\n");
				dump(aPopupContent.get() +"\n");
			}

			var popupNode = $(document.createElement("div"))
					.addClass("popup").append(popupInnerNode);
			popupNode.attr("id", "popup-" + Date.now());
			popupNode.appendTo("body");


			var winPageRight = window.innerWidth;
			var winPageBottom = window.innerHeight + window.window.scrollY;
			var x = winPageRight - (popupNode.width() + aEvent.pageX );
			var y = winPageBottom - (popupNode.outerHeight() + aEvent.pageY);

			popupNode.css("left", (aEvent.pageX - 25) + "px");
			if(y > 0){
				popupNode.css("top", (aEvent.pageY - 20) + "px");
			}else{
				popupNode.css("top", (winPageBottom - popupNode.outerHeight() - 5) + "px");
			}

		popupNode.hover(
			function(aEvent){
				var parent = $(aEvent.relatedTarget).parents(".popup");
				this._parentID = (parent.length != 0) ? parent.attr("id") : null;
			},

			function(aEvent){
				var parent = $(aEvent.relatedTarget).parents(".popup");
				if(parent.length != 0 && this._parentID != parent.attr("id")){
					return;
				}

				$(this).fadeOut("fast", function(){
					$(this).remove();
				});
		});
	}

};


Popup.Res = {

	mouseover: function(aEvent){
		if(this._popupTimeout){
			clearTimeout(this._popupTimeout);
		}

		var startRes = 0;
		var endRes = 0;
		if(this.text.match(/>>?(\d{1,4})-(\d{1,4})/)){
			startRes = parseInt(RegExp.$1);
			endRes = parseInt(RegExp.$2);
		}else if(this.text.match(/>>?(\d{1,4})/)){
			startRes = parseInt(RegExp.$1);
		}

		var popupContent = Popup.Res.createContent(startRes, endRes);

		this._popupTimeout = setTimeout(Popup.showPopupDelay, Popup.POPUP_DELAY,
				aEvent, popupContent, "ResPopup");
	},


	createContent: function(aStart, aEnd){
		var resNodes;

		if(aStart < aEnd){ // 複数ポップアップ
			if(aStart < 1) aStart = 1;
			if(aEnd > 1001) aEnd = 1001;
			const POPUP_LIMIT = 20;
			var tmpStart = aStart;
			var omitRes = 0;
			if((aEnd - aStart) > POPUP_LIMIT){
				aStart = aEnd - POPUP_LIMIT;
				omitRes = aStart - tmpStart;
			}
			var resIDList = "";
			for(var i = aStart; i<=aEnd; i++){
				resIDList += "#res" + i +",";
			}

			resNodes = $(resIDList).clone(true).removeAttr("id");
			if(resNodes.length > 0 && omitRes > 0){
				resNodes = $(document.createElement("p")).text(omitRes + "件省略").add(resNodes);
			}

		}else{ // 通常ポップアップ
			resNodes = $("#res" + aStart).clone(true).removeAttr("id");
		}

		return resNodes;
	}

};


Popup.ID = {

	mouseover: function(aEvent){
		var resID = $(this).attr("resID");
		if(!resID){
			resID = $(this).parents().attr("resID");
		}
		var resNumber = $(this).attr("resNumber");

		var popupContent = $("dl[resID='" + resID + "']").not($(this).parents("dl"))
				.clone(true).removeAttr("id");
		if(popupContent.length == 0){
			popupContent = $(document.createElement("p")).text("このレスのみ");
		}

		this._popupTimeout = setTimeout(Popup.showPopupDelay,  Popup.POPUP_DELAY,
				aEvent, popupContent, "IDPopup");
	}

};


Popup.Image = {

	mouseover: function(aEvent){

		var imageURL = this.href;
		if(!(/\.(gif|jpe?g|png)$/i).test(imageURL)) return;

		var image = $(document.createElement("img"));

		image.click(function(){
			$(this).toggleClass("small");
		});

		image.error(function(){
			$(this).parents().addClass("loadError");
		});

		var popupContent = $(document.createElement("div"));
		popupContent.append(image);

		image.addClass("small");
		image.attr("src", imageURL);

		this._popupTimeout = setTimeout(Popup.showPopupDelay,  Popup.POPUP_DELAY,
				aEvent, popupContent, "imagePopup");
	}

};
