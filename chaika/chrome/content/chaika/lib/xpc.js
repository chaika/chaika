const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const XPC = {
	createInstance: function(aContractId, aInterface){
		return Components.classes[aContractId].createInstance(Components.interfaces[aInterface]);
	},
	getService: function(aContractId, aInterface){
	    return Components.classes[aContractId].getService(Components.interfaces[aInterface]);
	}
}
