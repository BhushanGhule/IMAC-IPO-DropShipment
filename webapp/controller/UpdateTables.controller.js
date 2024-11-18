sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/BusyIndicator",
	"sap/m/MessageToast",
	"sap/ui/export/library",
	"sap/ui/export/Spreadsheet"
], function (Controller, Busy, MessageToast, exportLibrary, Spreadsheet) {
	"use strict";

	return Controller.extend("DropShipment.Z_PU_IMACIPO_DS.controller.UpdateTables", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf DropShipment.Z_PU_IMACIPO_DS.view.UpdateTables
		 */
		onInit: function () {
			this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		onUpload: function () {
			var oFileUploader = this.getView().byId("fUploader");
			var oUpld = jQuery.sap.domById(oFileUploader.getId() + "-fu").files[0];
			if (oFileUploader.getValue()) {
				this.fnReadData(oUpld);
			} else {
				sap.m.MessageToast.show("Choose a File");
			}
		},
		fnReadData: function (file) {
			var aRowdata = [];
			var aRowDataRef = [];
			var vRowdata = [];
			if (file && window.FileReader) {
				var reader = new FileReader();
				var result = {};
				var data;
				var oBusy = new sap.m.BusyDialog();
				oBusy.open();
				reader.onload = function (e) {
					var data = e.target.result;
					var wb = XLSX.read(data, {
						type: 'binary'
					});
					var that = this;
					wb.SheetNames
						.forEach(function (sheetName) {
							if ((sheetName === this.i18n.getText("ShipToCode") && this.getView().byId("RB1-1").getSelected() === true) ||
								(sheetName === this.i18n.getText("CarrierAccount2") && this.getView().byId("RB1-2").getSelected() === true) ||
								(sheetName === this.i18n.getText("OriginDestinationPoint2") && this.getView().byId("RB1-3").getSelected() === true)) {
								aRowDataRef = XLSX.utils
									.sheet_to_row_object_array(wb.Sheets[sheetName]);
								if (aRowDataRef.length > 0) {
									result[sheetName] = aRowDataRef;
									Object.keys(aRowDataRef).forEach(function (item) {
										Object.keys(aRowDataRef[item]).forEach(function (key) {
											var replaced = key.replace(/ /g, '_');
											if (key !== replaced) {
												aRowDataRef[item][replaced] = aRowDataRef[item][key];
												delete aRowDataRef[item][key];
											}
										});
										aRowdata.push(aRowDataRef[item]);
									});
								}
							}

						}.bind(this));
					if (aRowdata.length !== 0) {
						oBusy.close();
						if (this.getView().byId("RB1-1").getSelected() === true) {
							this._handleBatchProcess(this, aRowdata, "ZIMACIPO_DS_SHIP");
						} else if (this.getView().byId("RB1-2").getSelected() === true) {
							this._handleBatchProcess(this, aRowdata, "ZIMACIPO_DS_CAR");
						} else if (this.getView().byId("RB1-3").getSelected() === true) {
							this._handleBatchProcess(this, aRowdata, "ZIMACIPO_DS_DEST");
						}

					} else {
						oBusy.close();
						sap.m.MessageToast.show("No Data");
					}
				}.bind(this);
				reader.readAsBinaryString(file);
			}
		},

		// // Update Tables
		_handleBatchProcess: function (that, oRowData, tableName) {
			Busy.show();
			var batchUrls = [];
			var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
			var oModel = new sap.ui.model.odata.ODataModel(url, true);
			var header = {};

			header.Action = tableName;
			header.CreatedOn = new Date();
			header.LastChangedOn = new Date();
			header.DateShipped = new Date();
			batchUrls.push(oModel.createBatchOperation("/HeaderSet", "POST", header));
			oRowData.forEach(function (Item) {

				if (that.getView().byId("RB1-1").getSelected() === true) {
					var Shiping = {};
					Shiping.Title = Item.Title;
					Shiping.ShipToAddress = Item.Ship_To_Address;
					Shiping.SoldToAddress = Item.Sold_To_Address;
					Shiping.ShipToCountry = Item.Ship_To_Country;
					Shiping.ShipToPostalCode = Item.Ship_To_Postal_Code;
					Shiping.InvoiceToCountry = Item.Invoice_To_Country;
					Shiping.InvoiceToPostalCode = Item.Invoice_To_Postal_Code;
					Shiping.IncotermValue = Item.Incoterm_Value;
					batchUrls.push(oModel.createBatchOperation("/ShipingSet", "POST", Shiping));
				} else if (that.getView().byId("RB1-2").getSelected() === true) {
					var carrier = {};
					carrier.Title = Item.Title;
					carrier.Incoterm = Item.Incoterm;
					carrier.PaidBy = Item.Paid_By;
					carrier.Carrier_ = Item.Carrier;
					carrier.ShipToCode = Item.Ship_To_Code;
					carrier.Site = Item.Site;
					batchUrls.push(oModel.createBatchOperation("/CarrierSet", "POST", carrier));
				} else if (that.getView().byId("RB1-3").getSelected() === true) {
					var Destination = {};
					Destination.Title = Item.Title;
					batchUrls.push(oModel.createBatchOperation("/DestinationSet", "POST", Destination));
				}
			});
			oModel.addBatchChangeOperations(batchUrls);
			oModel.setUseBatch(true);
			oModel.submitBatch(function (oData, oResponse) {
				if (oData.__batchResponses[0].response) {
					MessageToast.show(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
					Busy.hide();
				} else {
					var changeResponse = oData.__batchResponses[0].__changeResponses;
					changeResponse.forEach(function (Response) {
						if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Header") {
							var message = "Table " + Response.data.Action + " has been updated successfully";
							sap.m.MessageToast.show(message);
						}
					});
				}
				Busy.hide();
			}, function (error) {
				Busy.hide();
			});

		},
		onDownload: function () {
			Busy.show();
			var Entity = "";
			if (this.getView().byId("RB1-1").getSelected() === true) {
				Entity = "/ZPU_DS_IMACIPO_SHIP_F4";
			} else if (this.getView().byId("RB1-2").getSelected() === true) {
				Entity = "/ZPU_DS_IMACIPO_CARR_F4";
			} else if (this.getView().byId("RB1-3").getSelected() === true) {
				Entity = "/ZPU_DS_IMACIPO_DEST_F4";
			}
			var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
			var oModel = new sap.ui.model.odata.ODataModel(url, true);
			oModel.read(Entity, {
				success: function (oData) {
					this.onDownloadExcel(oData);
					Busy.hide();
				}.bind(this),
				error: function (oError) {
					Busy.hide();
				}
			});

		},
		onDownloadExcel: function (oData) {
			var aCols, aData, oSettings, oSheet, fileName, sheetName;
			aData = [];

			if (this.getView().byId("RB1-1").getSelected() === true) {
				aCols = this.createColumnZIMACIPO_DS_SHIP();
				fileName = this.i18n.getText("ZIMACIPO_DS_SHIP");
				sheetName = this.i18n.getText("ShipToCode");
				oData.results.forEach(function (Item) {
					aData.push({
						Title: Item.Title,
						ShipToAddress: Item.ShipToAddress,
						SoldToAddress: Item.SoldToAddress,
						ShipToCountry: Item.ShipToCountry,
						ShipToPostalCode: Item.ShipToPostalCode,
						InvoiceToCountry: Item.InvoiceToCountry,
						InvoiceToPostalCode: Item.InvoiceToPostalCode,
						IncotermValue: Item.IncotermValue
					});
				});
			} else if (this.getView().byId("RB1-2").getSelected() === true) {
				aCols = this.createColumnZIMACIPO_DS_CAR();
				fileName = this.i18n.getText("ZIMACIPO_DS_CAR");
				sheetName = this.i18n.getText("CarrierAccount2");
				oData.results.forEach(function (Item) {
					aData.push({
						Title: Item.Title,
						Incoterm: Item.Incoterm,
						Carrier: Item.Carrier,
						PaidBy: Item.PaidBy,
						ShipToCode: Item.ShipToCode,
						Site: Item.Site
					});
				});
			} else if (this.getView().byId("RB1-3").getSelected() === true) {
				aCols = this.createColumnZIMACIPO_DS_DEST();
				fileName = this.i18n.getText("ZIMACIPO_DS_DEST");
				sheetName = this.i18n.getText("OriginDestinationPoint2");
				oData.results.forEach(function (Item) {
					aData.push({
						Title: Item.Title
					});
				});
			}
			fileName = fileName + ".xlsx";
			oSettings = {
				workbook: {
					columns: aCols,
					context: {
						sheetName: sheetName
					}

				},
				dataSource: aData,
				fileName: fileName

			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build()
				.then(function () {

				})
				.finally(oSheet.destroy);

		},
		createColumnZIMACIPO_DS_SHIP: function () {
			var EdmType = exportLibrary.EdmType;
			return [{
				label: this.i18n.getText("Title"),
				property: "Title",
				type: EdmType.String,
				width: "10"
			}, {
				label: this.i18n.getText("ShipToAddress"),
				property: "ShipToAddress",
				type: EdmType.String,
				width: "60"
			}, {
				label: this.i18n.getText("SoldToAddress"),
				property: "SoldToAddress",
				type: EdmType.String,
				width: "60"
			}, {
				label: this.i18n.getText("ShipToCountry"),
				property: "ShipToCountry",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("ShipToPostalCode"),
				property: "ShipToPostalCode",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("InvoiceToCountry"),
				property: "InvoiceToCountry",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("InvoiceToPostalCode"),
				property: "InvoiceToPostalCode",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("IncotermValue"),
				property: "IncotermValue",
				type: EdmType.String,
				width: "20"
			}];
		},
		createColumnZIMACIPO_DS_CAR: function () {
			var EdmType = exportLibrary.EdmType;
			return [{
				label: this.i18n.getText("Title"),
				property: "Title",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("Incoterm2"),
				property: "Incoterm",
				type: EdmType.String,
				width: "60"
			}, {
				label: this.i18n.getText("PaidBy"),
				property: "PaidBy",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("Carrier"),
				property: "Carrier",
				type: EdmType.String,
				width: "50"
			}, {
				label: this.i18n.getText("ShipToCode"),
				property: "ShipToCode",
				type: EdmType.String,
				width: "20"
			}, {
				label: this.i18n.getText("Site"),
				property: "Site",
				type: EdmType.String,
				width: "10"
			}];
		},
		createColumnZIMACIPO_DS_DEST: function () {
			var EdmType = exportLibrary.EdmType;
			return [{
				label: this.i18n.getText("Title"),
				property: "Title",
				type: EdmType.String,
				width: "40"
			}];
		}
	});

});