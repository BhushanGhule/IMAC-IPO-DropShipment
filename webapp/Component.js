sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"DropShipment/Z_PU_IMACIPO_DS/model/models",
	"sap/f/FlexibleColumnLayoutSemanticHelper",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/BusyIndicator"
], function (UIComponent, Device, models, FlexibleColumnLayoutSemanticHelper, JSONModel, Busy) {
	"use strict";

	return UIComponent.extend("DropShipment.Z_PU_IMACIPO_DS.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// Setting Component Model - for setting UI States
			var oModel = new JSONModel();
			this.setModel(oModel, "ComponentModel");

			// Setting Global Model - for setting View properties
			this.setModel(models.createGlobalModel(), "GlobalModel");

			//Fetch User Details
			this.getUserDetails();
		},
		getHelper: function () {
			var oFCL = this.getRootControl().byId("fcl"),
				oParams = jQuery.sap.getUriParameters(),
				oSettings = {
					defaultTwoColumnLayoutType: sap.f.LayoutType.TwoColumnsMidExpanded,
					defaultThreeColumnLayoutType: sap.f.LayoutType.ThreeColumnsMidExpanded,
					mode: oParams.get("mode"),
					initialColumnsCount: oParams.get("initial"),
					maxColumnsCount: oParams.get("max")
				};

			return FlexibleColumnLayoutSemanticHelper.getInstanceFor(oFCL, oSettings);
		},
		getUserDetails: function () {
			var RequestNumber = "";
			this.getModel().read("/UserDetailsSet('" + RequestNumber + "')", {
				success: function (oData) {
					//Set User Model		
					Busy.show();
					var UserDetails = new JSONModel({
						Uname: oData.Uname,
						Buyer: oData.Buyer,
						PuMgr: oData.PuMgr,
						PuLogLeader: oData.PuLogLeader,
						LogisticsMgr: oData.LogisticsMgr,
						LogisticsAnalyst: oData.LogisticsAnalyst,
						SME: oData.SME
					});
					this.setModel(UserDetails, "UserDetailsModel");
					//Set My Inbox Model 	
					var oMyInboxModel = new JSONModel({
						"MyInboxRequests": 0,
						items: []
					});
					oMyInboxModel.setSizeLimit(10000);
					this.setModel(oMyInboxModel, "MyInboxRequestModel");
					this.getRouter().initialize();
					this.readInboxRequests(this);
					this.readVendorList(this);
				}.bind(this),
				error: function (oError) {
					// enable routing
					this.getRouter().initialize();
				}
			});
		},
	//	Method to read Inbox Requests
		readInboxRequests: function (that) {
			that.getModel().read("/MyInboxSet", {
				success: function (oData, oResponse) {
					// Sets Inbox Request Count
					oData.results.forEach(function (Item) {
						var date = Item.CreatedOn.toLocaleDateString().split("/");
						var mm, dd, yyyy;
						date.forEach(function (date, index) {
							if (date.length === 1) {
								date = "0" + date;
							}
							if (index === 0) {
								mm = date;
							}
							if (index === 1) {
								dd = date;
							}
							if (index === 2) {
								yyyy = date;
							}
						});
						Item.CreatedOnText = mm + "/" + dd + "/" + yyyy;
					});
					that.getModel("MyInboxRequestModel").setProperty("/MyInboxSet", oData.results);
				}.bind(that),
				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						sap.m.MessageBox.error(sErrorText);
					}
				}.bind(that)
			});
		},
		readVendorList: function (that) {
			that.getModel().read("/ZPU_DS_IMACIPO_VENDOR_F4", {
				success: function (oData, oResponse) {
					var oVendorListModel = new JSONModel({});
					oVendorListModel.setSizeLimit(10000);
					that.setModel(oVendorListModel, "VendorListModel");
					oData.results.sort(function (a, b) {
						return a.Lifnr - b.Lifnr;
					});
					that.getModel("VendorListModel").setProperty("/VendorList", oData.results);
					Busy.hide();
				}.bind(that),
				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						sap.m.MessageBox.error(sErrorText);
					}
				}.bind(that)
			});
		}		
	});
});