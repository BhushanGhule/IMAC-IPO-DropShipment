function initModel() {
	var sUrl = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
	var oModel = new sap.ui.model.odata.ODataModel(sUrl, true);
	sap.ui.getCore().setModel(oModel);
}