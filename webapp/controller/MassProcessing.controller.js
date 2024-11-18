sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/BusyIndicator",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/export/library",
	"sap/ui/export/Spreadsheet"
], function (Controller, Busy, MessageBox, MessageToast, Fragment, exportLibrary, Spreadsheet) {
	"use strict";

	return Controller.extend("DropShipment.Z_PU_IMACIPO_DS.controller.MassProcessing", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf DropShipment.Z_PU_IMACIPO_DS.view.MassProcessing
		 */
		onInit: function () {
			this.oModel = this.getOwnerComponent().getModel();
			this.oRouter = this.getOwnerComponent().getRouter();
			this.oRouter.getRoute("massprocessing").attachPatternMatched(this._getMassProcessing, this);
			this._oView = this.getView();
			this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
			this.oDefaultModel = this._oComponent.getModel("defaultValueModel").getData();
			this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this.setRowActionTemplate(true);
		},

		_getMassProcessing: function (oEvent) {
			Busy.show();
			this.oModel.read("/MassProcessingSet", {
				success: function (oData) {
					this.oDefaultModel.MassProcessingSet = oData.results;
					this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
						Item.ValidationState = "Success";
						if (Item.SAPMessage !== "") {
							Item.SAPMessage = JSON.parse(Item.SAPMessage);
							Item.MsgCount = Item.SAPMessage.length;
							Item.SAPMessage.forEach(function (SAPMessage) {
								if (SAPMessage.type === "Error") {
									Item.ValidationState = "Error";
								}
							});
						}
					});
					this._oComponent.getModel("defaultValueModel").refresh(true);
					Busy.hide();
				}.bind(this),
				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						MessageBox.error(sErrorText);
					}
					Busy.hide();
				}
			});

		},
		onActionButtonPress: function (oEvent) {
			var sAction = oEvent.getSource().data("action");
			if (sAction === "DN") {
				this._postDN(sAction);
			} else {
				this._handleBatchProcess(sAction);
			}

		},
		onSelectAll: function (oEvent) {
			var Selected = oEvent.getParameter("selected");
			this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
				Item.Check = Selected;
			});
			this._oComponent.getModel("defaultValueModel").refresh(true);
			this._setSelectedRows();
		},
		onSelectSingle: function (oEvent) {
			this._setSelectedRows();
		},
		_handleBatchProcess: function (Action) {
			var selectedCount = 0;
			this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
				if (Item.Check === true) {
					selectedCount = selectedCount + 1;
				}
			});
			if (selectedCount === 0) {
				MessageToast.show(this.i18n.getText("NoItemSelected"));
			} else {
				Busy.show();
				var batchUrls = [];
				var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
				var oModel = new sap.ui.model.odata.ODataModel(url, true);
				var header = {};
				header.Action = Action;
				header.CreatedOn = new Date();
				header.LastChangedOn = new Date();
				header.DateShipped = new Date();

				batchUrls.push(oModel.createBatchOperation("/HeaderSet", "POST", header));

				var MassProcessingSet = this.oDefaultModel.MassProcessingSet;
				this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
					Item.SAPMessage = "";
					delete Item.MsgCount;
					delete Item.ValidationState;
					delete Item.ErrorMessage;
					batchUrls.push(oModel.createBatchOperation("/MassProcessingSet", "POST", Item));
				});

				oModel.addBatchChangeOperations(batchUrls);
				oModel.setUseBatch(true);
				oModel.submitBatch(function (oData, oResponse) {
					if (oData.__batchResponses[0].response) {
						MessageToast.show(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
						Busy.hide();
					} else {
						var changeResponse = oData.__batchResponses[0].__changeResponses;
						var MsgCount = 0,
							Close;
						this.oDefaultModel.MassProcessingSet = [];
						changeResponse.forEach(function (Response) {
							if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.MassProcessing") {
								Response.data.ValidationState = "Success";
								if (Response.data.SAPMessage !== "") {
									var i;
									Response.data.SAPMessage = JSON.parse(Response.data.SAPMessage);
									for (i = 0; i < Response.data.SAPMessage.length; i++) {
										if (Response.data.SAPMessage[i].type !== "Error") {
											Response.data.SAPMessage.splice(i, 1);
										}
									}
									Response.data.MsgCount = Response.data.SAPMessage.length;
								} else {
									Response.data.SAPMessage = [];
									Response.data.MsgCount = Response.data.SAPMessage.length;
								}
								if (Response.data.Close === true) {
									Close = Response.data.Close;
								}
								if (typeof Response.data.SAPMessage === "object") {
									Response.data.SAPMessage.forEach(function (SAPMessage) {
										if (SAPMessage.type = "Error") {
											Response.data.ValidationState = "Error";
										}
									});
								}
								this.oDefaultModel.MassProcessingSet.push(Response.data);
							}
						}.bind(this));
						this._oComponent.getModel("defaultValueModel").refresh(true);
						this._setSelectedRows();
						if (Close === true) {
							this._getMassProcessing();
						}
					}
					Busy.hide();
				}.bind(this), function (error) {
					Busy.hide();
				});
			}
		},
		_postDN: function (Action) {
			this._handleBatchProcessOneByOneDN(this,Action);
		},

		_handleDeepEntityOneByOne: function (that, Action, Item, Index) {
			Busy.show();
			return new Promise(function (resolve, reject) {
				var batchUrls = [];
				var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
				var oModel = new sap.ui.model.odata.ODataModel(url, true);
				var header = {};
				header.Action = Action;
				header.CreatedOn = new Date();
				header.LastChangedOn = new Date();
				header.DateShipped = new Date();
				header.RequestNumber = Item.RequestNumber;
				Item.SAPMessage = "";
				delete Item.MsgCount;
				delete Item.ValidationState;
				delete Item.ErrorMessage;
				var oCreateData = header;
				var MassProcessing = [];
				MassProcessing.push(Item);
				oCreateData.HeaderToMassProcessing = MassProcessing;
				oModel.create("/HeaderSet", oCreateData, {
					success: function (oData, oResponse) {
						if (oResponse.headers["sap-message"]) {
							if (JSON.parse(oResponse.headers["sap-message"]).severity === "error") {
								MessageToast.show(JSON.parse(oResponse.headers["sap-message"]).message);
							}
						} else {
							that.oDefaultModel.MassProcessingSet[Index] = oData.HeaderToMassProcessing.results[0];
							that._oComponent.getModel("defaultValueModel").refresh(true);
						}
						resolve();
						Busy.hide();
					}.bind(that),
					error: function (oError) {
						if (oError.responseText) {
							var sErrorText = JSON.parse(oError.responseText).error.message.value;
							MessageBox.error(sErrorText);
						}
						resolve();
						Busy.hide();
					}.bind(that)
				});
			}.bind(that));
		},
		_handleBatchProcessOneByOneDN: async function (that,Action) {
			var selectedCount = 0;
			this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
				if (Item.Check === true) {
					selectedCount = selectedCount + 1;
				}
			});
			if (selectedCount === 0) {
				MessageToast.show(this.i18n.getText("NoItemSelected"));
			} else {
				Busy.show();
				var batchUrls = [];
				var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
				var oModel = new sap.ui.model.odata.ODataModel(url, true);
				var header = {};
				header.Action = Action;
				header.CreatedOn = new Date();
				header.LastChangedOn = new Date();
				header.DateShipped = new Date();
				try {
					for (let index = 0; index < this.oDefaultModel.MassProcessingSet.length; index++) {
						let Item = this.oDefaultModel.MassProcessingSet[index];
						if (Item.Check === true && Item.Z03 !== "" && Item.Z411K !== "" && Item.DN === "") {
							header.RequestNumber = Item.RequestNumber;
							var batchUrls = [];
							var batchHeaderUrl = oModel.createBatchOperation("/HeaderSet", "POST", header);
							batchUrls.push(batchHeaderUrl);

							Item.ItemIndex = index;
							Item.SAPMessage = "";
							delete Item.MsgCount;
							delete Item.ValidationState;
							delete Item.ErrorMessage;

							var batchItemUrl = oModel.createBatchOperation("/MassProcessingSet", "POST", Item);
							batchUrls.push(batchItemUrl);

							oModel.addBatchChangeOperations(batchUrls);

							await new Promise(function (resolve, reject) {
								oModel.submitBatch(function (oData, oResponse) {
									if (oData && oData.__batchResponses[0].response) {
										reject(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
									} else {
										var changeResponse = oData.__batchResponses[0].__changeResponses;
										var MsgCount = 0,
											Close;
										changeResponse.forEach(function (Response) {
											if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.MassProcessing") {
												Response.data.ValidationState = "Success";
												if (Response.data.SAPMessage !== "") {
													var i;
													Response.data.SAPMessage = JSON.parse(Response.data.SAPMessage);
													for (i = 0; i < Response.data.SAPMessage.length; i++) {
														if (Response.data.SAPMessage[i].type !== "Error") {
															Response.data.SAPMessage.splice(i, 1);
														}
													}
													Response.data.MsgCount = Response.data.SAPMessage.length;
												} else {
													Response.data.SAPMessage = [];
													Response.data.MsgCount = Response.data.SAPMessage.length;
												}
												if (Response.data.Close === true) {
													Close = Response.data.Close;
												}
												if (typeof Response.data.SAPMessage === "object") {
													Response.data.SAPMessage.forEach(function (SAPMessage) {
														if (SAPMessage.type = "Error") {
															Response.data.ValidationState = "Error";
														}
													});
												}
												this.oDefaultModel.MassProcessingSet[Response.data.ItemIndex] = Response.data;
											}
										}.bind(this));
										this._oComponent.getModel("defaultValueModel").refresh(true);
										this._setSelectedRows();
										if (Close === true) {
											this._getMassProcessing();
										}
										resolve();
									}
								}.bind(this), function (error) {
									reject(error);
								});
							}.bind(this));
						}
					}
					Busy.hide();
				} catch (error) {
					Busy.hide();
					MessageToast.show("Error occurred: " + error);
				}
			}
		},
		_handleBatchProcessOneByOne: function (Action, Item, Index) {
			var selectedCount = 0;
			this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
				if (Item.Check === true) {
					selectedCount = selectedCount + 1;
				}
			});
			if (selectedCount === 0) {
				MessageToast.show(this.i18n.getText("NoItemSelected"));
			} else {
				Busy.show();
				var batchUrls = [];
				var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
				var oModel = new sap.ui.model.odata.ODataModel(url, true);
				var header = {};
				header.Action = Action;
				header.CreatedOn = new Date();
				header.LastChangedOn = new Date();
				header.DateShipped = new Date();

				batchUrls.push(oModel.createBatchOperation("/HeaderSet", "POST", header));

				var MassProcessingSet = this.oDefaultModel.MassProcessingSet;

				Item.SAPMessage = "";
				delete Item.MsgCount;
				delete Item.ValidationState;
				delete Item.ErrorMessage;
				batchUrls.push(oModel.createBatchOperation("/MassProcessingSet", "POST", Item));

				oModel.addBatchChangeOperations(batchUrls);
				oModel.setUseBatch(true);
				oModel.submitBatch(function (oData, oResponse) {
					if (oData.__batchResponses[0].response) {
						MessageToast.show(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
						Busy.hide();
					} else {
						var changeResponse = oData.__batchResponses[0].__changeResponses;
						var MsgCount = 0,
							Close;
						changeResponse.forEach(function (Response) {
							if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.MassProcessing") {
								Response.data.ValidationState = "Success";
								if (Response.data.SAPMessage !== "") {
									var i;
									Response.data.SAPMessage = JSON.parse(Response.data.SAPMessage);
									for (i = 0; i < Response.data.SAPMessage.length; i++) {
										if (Response.data.SAPMessage[i].type !== "Error") {
											Response.data.SAPMessage.splice(i, 1);
										}
									}
									Response.data.MsgCount = Response.data.SAPMessage.length;
								} else {
									Response.data.SAPMessage = [];
									Response.data.MsgCount = Response.data.SAPMessage.length;
								}
								if (Response.data.Close === true) {
									Close = Response.data.Close;
								}
								if (typeof Response.data.SAPMessage === "object") {
									Response.data.SAPMessage.forEach(function (SAPMessage) {
										if (SAPMessage.type = "Error") {
											Response.data.ValidationState = "Error";
										}
									});
								}
								//								this.oDefaultModel.MassProcessingSet.push(Response.data);
								this.oDefaultModel.MassProcessingSet[Index] = Response.data;
							}
						}.bind(this));
						this._oComponent.getModel("defaultValueModel").refresh(true);
						this._setSelectedRows();
						if (Close === true) {
							this._getMassProcessing();
						}
					}
					Busy.hide();
				}.bind(this), function (error) {
					Busy.hide();
				});
			}
		},
		setRowActionTemplate: function (bFlag) {
			var oTable = this.byId("iMassProcessingTable"),
				oTemplate;
			if (bFlag) {
				oTable.setRowActionCount(1);
				oTemplate = oTable.getRowActionTemplate();
				if (oTemplate) {
					oTemplate.destroy();
					oTemplate = null;
				}
				oTemplate = new sap.ui.table.RowAction({
					items: [
						new sap.ui.table.RowActionItem({
							type: "Navigation",
							press: this._navigateToDetailScreen.bind(this)
						})
					]
				});
				oTable.setRowActionTemplate(oTemplate);
			} else {
				oTable.setRowActionCount(0);
				oTable.setRowActionTemplate(null);
			}
		},
		_navigateToDetailScreen: function (oEvent) {
			// var sReqNum = oEvent.getParameters().listItem.getBindingContext().getObject().Reqnum;
			var sRequestNumber = oEvent.getParameter("row").getBindingContext("defaultValueModel").getObject().RequestNumber;
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			oGlobalModel.setProperty("/Refresh", false);
			oGlobalModel.setProperty("/Load", true);
			this.oRouter.navTo("detail", {
				layout: "MidColumnFullScreen",
				requestNumber: sRequestNumber
			});
		},
		onMessagePopOverPress: function (oEvent) {
			var oButton = oEvent.getSource();
			var aMessages = oEvent.getSource().getBindingContext("defaultValueModel").getObject().SAPMessage;
			this.oDefaultModel.messages = aMessages;
			if (!this.byId("MessagePopOverItems")) {
				Fragment.load({
					id: this.getView().getId(),
					name: "DropShipment.Z_PU_IMACIPO_DS.view.fragment.MessagePopOver",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					this.byId("MessagePopOverItems").openBy(oButton);
				}.bind(this));
			} else {
				if (this.byId("MessagePopOverItems").isOpen()) {
					this.byId("MessagePopOverItems").close();
				} else {
					this.byId("MessagePopOverItems").openBy(oButton);
				}
			}
			this._oComponent.getModel("defaultValueModel").refresh(true);
		},
		createColumnConfig: function () {
			var i18n = this.getView().getModel("i18n").getResourceBundle();
			var EdmType = exportLibrary.EdmType;
			return [{
				label: i18n.getText("RequestNumber"),
				property: "RequestNumber",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("PolineItem"),
				property: "POLineItem",
				type: EdmType.String,
				width: "5"
			}, {
				label: i18n.getText("CreatedBy"),
				property: "CreatedBy",
				type: EdmType.String,
				width: "30"
			}, {
				label: i18n.getText("SitePO"),
				property: "SitePO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("ImacPO"),
				property: "ImacPO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("VendorCode"),
				property: "VendorCode",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("Part"),
				property: "Part",
				type: EdmType.String,
				width: "40"
			}, {
				label: i18n.getText("Quantity"),
				property: "Quantity",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("SAPPOStatus"),
				property: "SAPPOStatus",
				type: EdmType.String,
				width: "20"
			}, {
				label: i18n.getText("Z03"),
				property: "Z03",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("411K"),
				property: "Z411K",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("DN"),
				property: "DN",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("643"),
				property: "Z643",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("CINumber"),
				property: "CINumber",
				type: EdmType.String,
				width: "20"
			}];
		},
		onDownloadItems: function () {
			var aCols, aData, oSettings, oSheet;
			var EdmType = exportLibrary.EdmType;
			aCols = this.createColumnConfig();
			aCols.push({
				label: this.i18n.getText("ErrorMessage"),
				property: "ErrorMessage",
				type: EdmType.String,
				width: "100"
			});
			aData = [];
			this.oDefaultModel.MassProcessingSet.forEach(function (Item) {
				var Item2 = Item;
				var Message = "";
				if (typeof Item.SAPMessage === "object") {
					Item.SAPMessage.forEach(function (SAPMessage) {
						Message = Message + SAPMessage.message + "\r\n";
					})
				}
				Item2.ErrorMessage = Message;
				aData.push(Item2);
			});
			oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: aData,
				fileName: "MassProcessing.xlsx"
			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build()
				.then(function () {

				})
				.finally(oSheet.destroy);
		},
		_setSelectedRows: function () {
			var oTable = this.getView().byId("iMassProcessingTable");
			oTable.getRows().forEach(function (row) {
				var currentRow = row;
				var check = false;
				currentRow.getCells().forEach(function (cell) {
					if (cell.getMetadata()._sClassName === "sap.m.CheckBox") {
						check = cell.getSelected();
					}
				}.bind(this));
				currentRow._setSelected(check);
			}.bind(this));
		},
		handleMessageFilterChange: function (oEvent) {
			var sFilterOption = oEvent.getParameter("value"),
				sFilterValue = sFilterOption,
				oFilter, aFilter = [];
			if (sFilterOption) {
				// Set filters based on the Success or Error
				oFilter = new sap.ui.model.Filter("ValidationState", sap.ui.model.FilterOperator.EQ, sFilterValue);
				this.byId("iMassProcessingTable").getBinding().filter(oFilter);
			} else {

				// Reset the filter
				this.byId("iMassProcessingTable").getBinding().filter(aFilter);
			}
			this.byId("iMassProcessingTable").getColumns().forEach(function (oColumn) {
				if (oColumn.getFiltered()) {
					oColumn.setFiltered(false);
					oColumn.setFilterValue(null);
				}

			});
		},
	});

});