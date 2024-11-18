sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device"
], function (JSONModel, Device) {
	"use strict";

	return {

		createDeviceModel: function () {
			var oModel = new JSONModel(Device);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},

		createGlobalModel: function () {
			var sUserId = (sap.ushell.Container.getService("UserInfo").getId() === "DEFAULT_USER") ? "3145260" :
				sap.ushell.Container.getService("UserInfo").getId();
			var sUserFName = (sUserId === "3145260") ? "Bhushan" : sap.ushell.Container.getService("UserInfo").getUser().getFirstName(),  // DEFAULT
				sUserLName = (sUserId === "3145260") ? "Ghule" : sap.ushell.Container.getService("UserInfo").getUser().getLastName(); // USER
			var oModel = new JSONModel({
				"Refresh": false,
				"Load": true,
				"UserId": sUserId,
				"UserName": sUserFName + " " + sUserLName,
				"MyInbox": true,
				"MessageFilters": {
					items: [{
						"Key": "S",
						"Text": "Success"
					}, {
						"Key": "E",
						"Text": "Error"
					}]
				}
			});
			return oModel;
		},

	};
});