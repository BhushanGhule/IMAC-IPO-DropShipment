sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter"
], function (Controller, DateFormat, JSONModel, Fragment, Filter) {
	"use strict";

	return Controller.extend("DropShipment.Z_PU_IMACIPO_DS.controller.Master", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf DropShipment.Z_PU_IMACIPO_DS.view.Master
		 */
		onInit: function () {

			this.oRouter = this.getOwnerComponent().getRouter();
			this.oRouter.getRoute("master").attachPatternMatched(this._onMasterPatternMatched, this);
			this.oRouter.getRoute("detail").attachPatternMatched(this._onMasterPatternMatched, this);
			this.oModel = this.getOwnerComponent().getModel();
			this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			// Property to refresh the Inbox table
			oGlobalModel.setProperty("/Refresh", true);

			this.byId("ToggleButtonMyInbox").setText(this.i18n.getText("myDashboardHdr"));

		},

		_onMasterPatternMatched: function () {
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel"),
				sLayout = this.getOwnerComponent().getModel("ComponentModel").getProperty("/layout"),
				bRefresh = ((sLayout === "TwoColumnsBeginExpanded" || sLayout === "TwoColumnsMidExpanded") && this.getOwnerComponent().getModel(
					"MyInboxRequestModel").getProperty("/MyInboxRequests") > 0);
			if (oGlobalModel.getProperty("/Refresh") && !bRefresh) {
				this.readInboxRequests();
			}
			if(oGlobalModel.getProperty("/MyInbox") ===false){
				this.byId("DashboardSmartTable").getModel().refresh(true);
			}

		},
		// Method to read Inbox Requests
		readInboxRequests: function () {
			this.getView().setBusy(true);
			this.oModel.read("/MyInboxSet", {
				success: function (oData, oResponse) {
					this.getView().setBusy(false);
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
					this.getOwnerComponent().getModel("MyInboxRequestModel").setProperty("/MyInboxRequests", oData.results.length);
					this.getOwnerComponent().getModel("MyInboxRequestModel").setProperty("/MyInboxSet", oData.results);
					this.getOwnerComponent().getModel("GlobalModel").setProperty("/Refresh", false);
				}.bind(this),

				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						sap.m.MessageBox.error(sErrorText);
					}
					this.getView().setBusy(false);
				}.bind(this)
			});
		},
		// Event handler method for confirm event of ViewSettingsDialog
		// To handle the Sort operation
		handleRequestsSort: function (oEvent) {
			var bSort = false;
			if (oEvent.getSource().getSortDescending()) {
				bSort = true;
			}
			var aSortList = [],
				sSortingPath,
				fnGroup = false;
			aSortList = oEvent.getSource().getSortItems();
			switch (oEvent.getSource().getSelectedSortItem()) {
			case aSortList[0].getId():
				// Request Number
				sSortingPath = "RequestNumber";
				fnGroup = false;
				break;
			case aSortList[1].getId():
				// Creation Date
				sSortingPath = "CreatedOn";
				break;
			case aSortList[2].getId():
				// Request Status
				sSortingPath = "Plant";
				break;
			case aSortList[3].getId():
				sSortingPath = "RequestorName";
				break;
			case aSortList[4].getId():
				sSortingPath = "Status";
				break;
			default:
			}
			var oSorter = new sap.ui.model.Sorter({
				path: sSortingPath,
				descending: bSort,
				group: fnGroup
			});
			this.byId("MyInboxRequests").getBinding("items").sort(oSorter);
		},

		// Event handler method for liveChange event of SearchField
		// To handle Request List search
		onRequestListSearch: function (oEvent) {
			var sSearchString = oEvent.getSource().getValue();
			var oBindingObject = this.byId("MyInboxRequests").getBinding("items");
			var oFilters = [];
			if (sSearchString) {
				var filter = new Filter("RequestNumber", sap.ui.model.FilterOperator.Contains, sSearchString);
				oFilters.push(filter);
				filter = new Filter("CreatedOnText", sap.ui.model.FilterOperator.Contains, sSearchString);
				oFilters.push(filter);
				filter = new Filter("Plant", sap.ui.model.FilterOperator.Contains, sSearchString);
				oFilters.push(filter);
				filter = new Filter("AuthorTxt", sap.ui.model.FilterOperator.Contains, sSearchString);
				oFilters.push(filter);
				filter = new Filter("StatusTxt", sap.ui.model.FilterOperator.Contains, sSearchString);
				oFilters.push(filter);
				// filter = new Filter("OwnerT", sap.ui.model.FilterOperator.Contains, sSearchString);
				// oFilters.push(filter);
				var filters = new sap.ui.model.Filter(oFilters, false);
				oBindingObject.filter(filters);
			} else {
				oBindingObject.filter(oFilters);
			}
		},

		onRequestCreate: function (oEvent) {
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			oGlobalModel.setProperty("/Refresh", false);
			oGlobalModel.setProperty("/Load", true);
			this.oRouter.navTo("detail", {
				layout: "MidColumnFullScreen"
			});
		},

		// Event handler method for press event of Button
		// To open the Sort ViewSettingsDialog
		onRequestListSort: function () {
			if (!this.byId("ViewSettingsDialog")) {
				Fragment.load({
					id: this.getView().getId(),
					name: "DropShipment.Z_PU_IMACIPO_DS.view.fragment.ViewSettingsDialog",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					oDialog.open();
				}.bind(this));
			} else {
				this.byId("ViewSettingsDialog").open();
			}
		},

		// Event handler method for press event of Button
		// To refresh My Inbox request list
		onRequestListRefresh: function () {
			this.readInboxRequests();
		},

		onUpdateTables: function (oEvent) {
			this.oRouter.navTo("updatetables", {
				layout: "MidColumnFullScreen"
			});
		},
		onMassProcessing: function (oEvent) {
			this.oRouter.navTo("massprocessing", {
				layout: "MidColumnFullScreen"
			});
		},
		// Formatter method
		formatDate: function (dDate) {
			var dValue = new Date(dDate),
				oDateFormat = DateFormat.getDateTimeInstance({
					pattern: "MM/dd/yyyy",
					UTC: true
				});
			return oDateFormat.format(dValue).toString();
		},
		// Event handler method for press event of Button
		// To handle the navigation to Detail page when request is pressed in Inbox Table
		onRequestNavigation: function (oEvent) {
			// var oNextUIState = this.getOwnerComponent().getHelper().getNextUIState(1),
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			oGlobalModel.setProperty("/Refresh", true);
			var sSelectedRequestNumber = this.getOwnerComponent().getModel("MyInboxRequestModel").getProperty(oEvent.getSource().getBindingContext(
				"MyInboxRequestModel").getPath()).RequestNumber;
			oGlobalModel.setProperty("/Refresh", false);
			oGlobalModel.setProperty("/Load", true);
			this.oRouter.navTo("detail", {
				layout: "TwoColumnsMidExpanded",
				requestNumber: sSelectedRequestNumber
			});

		},
		// Method to display the dialog to display the Queue Owners
		onQueueOwnerLink: function (oEvent) {
			var sPath = "MyInboxRequestModel>" + oEvent.getSource().getBindingContext("MyInboxRequestModel").getPath(),
				oControl = oEvent.getSource();
			if (!this.byId("idPopOver")) {
				Fragment.load({
					id: this.getView().getId(),
					name: "DropShipment.Z_PU_IMACIPO_DS.view.fragment.QueueOwner",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					oDialog.bindElement(sPath);
					oDialog.openBy(oControl);
				}.bind(this));
			} else {
				this.byId("idPopOver").openBy(oControl);
			}
		},

		// Method to close the Queue Owner dialog
		onQueueOwnersAfterclose: function () {
			this.byId("idPopOver").close();
			this.byId("idPopOver").destroy();
		},
		onMyDashboardPress: function (oEvent) {
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			if (oEvent.getSource().getPressed()) {
				oGlobalModel.setProperty("/MyInbox", false);
				oEvent.getSource().setText(this.i18n.getText("myInboxHdr"));
				// this.getView().byId("DashboardSmartFilter").clear();
			} else {
				oGlobalModel.setProperty("/MyInbox", true);
				oEvent.getSource().setText(this.i18n.getText("myDashboardHdr"));
			}
		},
		onBeforeRebindTable: function (oEvent) {
			var aFilters = oEvent.getParameters().bindingParams.filters,
				iDays,
				aDateFilter = aFilters.filter(function (oItem) {
					return oItem.sPath === "CreatedOn";
				});
			if (aDateFilter.length > 0) {
				iDays = Math.round((oEvent.getParameters().bindingParams.filters[0].oValue2 - oEvent.getParameters().bindingParams.filters[0].oValue1) /
					(1000 * 3600 * 24));
			}
			if (iDays > 90) {
				sap.m.MessageToast.show(this.i18n.getText("filterErrorMsg"));
				oEvent.getParameters().bindingParams.preventTableBind = true;
			}
		},
		onDashboardItemSelect: function (oEvent) {
			// var sReqNum = oEvent.getParameters().listItem.getBindingContext().getObject().Reqnum;
			var sRequestNumber = oEvent.getSource().getBindingContext().getObject().RequestNo;
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			oGlobalModel.setProperty("/Refresh", false);
			oGlobalModel.setProperty("/Load", true);
			this.oRouter.navTo("detail", {
				layout: "TwoColumnsMidExpanded",
				requestNumber: sRequestNumber
			});
		},
	});

});