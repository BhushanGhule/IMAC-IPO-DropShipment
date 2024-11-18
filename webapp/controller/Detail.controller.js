sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/BusyIndicator",
	"sap/ui/core/Fragment",
	"sap/ui/export/library",
	"sap/ui/export/Spreadsheet",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
], function (Controller, Busy, Fragment, exportLibrary, Spreadsheet, MessageToast, MessageBox) {
	"use strict";

	return Controller.extend("DropShipment.Z_PU_IMACIPO_DS.controller.Detail", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf DropShipment.Z_PU_IMACIPO_DS.view.Detail
		 */
		onInit: function () {
			this.oRouter = this.getOwnerComponent().getRouter();
			this.oModel = this.getOwnerComponent().getModel();
			// this.oWorkflowModel = this.getOwnerComponent().getModel("WorkflowSrv");
			this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this.oRouter.getRoute("master").attachPatternMatched(this._onRequestNumMatched, this);
			this.oRouter.getRoute("detail").attachPatternMatched(this._onRequestNumMatched, this);
			this._oView = this.getView();
			this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
			this.oDefaultModel = this._oComponent.getModel("defaultValueModel").getData();
		},

		// Master and Detail pattern match event handler
		_onRequestNumMatched: function (oEvent) {
			var sRequestNumber = oEvent.getParameter("arguments").requestNumber || "0";
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");

			if (!oGlobalModel.getProperty("/Load")) {
				return;
			}

			if ((this.getOwnerComponent().getModel("ComponentModel").getData().layout === "TwoColumnsBeginExpanded" ||
					this.getOwnerComponent().getModel("ComponentModel").getData().layout === "TwoColumnsMidExpanded") && sRequestNumber === "0") {
				if (sRequestFromPath !== "0") {
					return;
				}

			}

			if (sRequestNumber !== "0") {
				// Method to set request data in the detail page
				this.setRequestData(sRequestNumber);
			} else {
				// Method to set default data when create button is pressed in master page
				this._createNewRequest();
			}
		},

		_createNewRequest: function (oEvent) {
			this.oDefaultModel.Attachment.ErrorAttachments = 0;
			this.oDefaultModel.Attachment.SuccessAttachments = 0;
			this.oDefaultModel.Attachment.AttachmentUploadCounter = 10;
			this.oDefaultModel.Attachment.DontUpload = false;
			this.oDefaultModel.AdditionalFields.ShipToCodeIncoterm = "";
			this.oDefaultModel.SequenceNumber = 0;
			const DetailHeader = Object.assign({}, this.oDefaultModel.DetailHeaderInital);
			this.oDefaultModel.DetailHeader = DetailHeader;
			this.oDefaultModel.DetailItems = [];
			this.oDefaultModel.AttachmentList = [];
			this.oDefaultModel.Audit = [];
			this.oDefaultModel.Overview = [];
			this._DisplayButtonSettings("NewRequest");
			if (this.oDefaultModel.CarrierAll.length === 0) {
				this._getCarrier();
			} else {
				this.oDefaultModel.Carrier = [...new Set(this.oDefaultModel.CarrierAll.map(item => item.Title))];
			}
			this._refreshModel();
		},

		setRequestData: function (sRequestNumber) {
			Busy.show();
			var sPath = this.oModel.createKey("/ZPU_C_DS_REQ_HEAD", {
					"i_reqnum": sRequestNumber
				}),
				oRequestModel = this.getView().getModel("RequestModel"),
				oDetailViewModel = this.getOwnerComponent().getModel("DetailViewModel");
			this.readAttachments(sRequestNumber);
			this.oModel.read(sPath + "/Set", {
				urlParameters: {
					"$expand": "to_items,to_OverV,to_audit"
				},
				success: function (oData, oResponse) {
					this.oDefaultModel.DetailHeader = this.mapDetailHeader(oData);
					this.oDefaultModel.DetailItems = this.mapDetailItems(oData);
					this.oDefaultModel.Overview = oData.results[0].to_OverV.results;
					this.oDefaultModel.Audit = oData.results[0].to_audit.results;
					this._readShipToCodeIncoterm();
					this._DisplayButtonSettings("ExistingRequest");
					this.oDefaultModel.Carrier = [];
					this.oDefaultModel.Incoterm = [];
					this.oDefaultModel.CarrierAccountNumber = [];
					this.oDefaultModel.Attachment.ErrorAttachments = 0;
					this.oDefaultModel.Attachment.SuccessAttachments = 0;
					this.oDefaultModel.Carrier.push(this.oDefaultModel.DetailHeader.FreightPayableBy);
					this.oDefaultModel.Incoterm.push(this.oDefaultModel.DetailHeader.Incoterm);
					this.oDefaultModel.CarrierAccountNumber.push(this.oDefaultModel.DetailHeader.CarrierAccountNumber);
					this._refreshModel();
					Busy.hide();
				}.bind(this),
				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						MessageBox.error(sErrorText);
					}
					Busy.hide();
				}.bind(this)
			});
		},
		_readLog: function (sRequestNumber) {
			Busy.show();
			var sPath = this.oModel.createKey("/ZPU_C_DS_REQ_HEAD", {
				"i_reqnum": sRequestNumber
			});
			this.oModel.read(sPath + "/Set", {
				urlParameters: {
					"$expand": "to_OverV,to_audit"
				},
				success: function (oData, oResponse) {
					this.oDefaultModel.Overview = oData.results[0].to_OverV.results;
					this.oDefaultModel.Audit = oData.results[0].to_audit.results;
					this._refreshModel();
					Busy.hide();
				}.bind(this),
				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						MessageBox.error(sErrorText);
					}
					Busy.hide();
				}.bind(this)
			});
		},
		mapDetailHeader: function (oData) {
			var DetailHeader = {};
			DetailHeader.Remarks = oData.results[0].Remarks;
			DetailHeader.RequestNumber = oData.results[0].RequestNumber;
			DetailHeader.VendorCode = oData.results[0].VendorCode;
			DetailHeader.Message = oData.results[0].Message;
			DetailHeader.Plant = oData.results[0].Plant;
			DetailHeader.VendorName = oData.results[0].VendorName;
			DetailHeader.ShipperName = oData.results[0].ShipperName;
			DetailHeader.ShipperAddress = oData.results[0].ShipperAddress;
			DetailHeader.InvoiceType = oData.results[0].InvoiceType;
			DetailHeader.ShipToCode = oData.results[0].ShipToCode;
			DetailHeader.FreightPayableBy = oData.results[0].FreightPayableBy;
			DetailHeader.PaidBy = oData.results[0].PaidBy;
			DetailHeader.Incoterm = oData.results[0].Incoterm;
			DetailHeader.CarrierAccountNumber = oData.results[0].CarrierAccountNumber;
			DetailHeader.OriginDestinationPoint = oData.results[0].OriginDestinationPoint;
			DetailHeader.MethodOfTransport = oData.results[0].MethodOfTransport;
			DetailHeader.ServiceType = oData.results[0].ServiceType;
			DetailHeader.DateShipped = oData.results[0].DateShipped;
			DetailHeader.Currency = oData.results[0].Currency;
			DetailHeader.CINumber = oData.results[0].CINumber;
			DetailHeader.ShipToAddress = oData.results[0].ShipToAddress;
			DetailHeader.SoldToAddress = oData.results[0].SoldToAddress;
			DetailHeader.PalletCarton = oData.results[0].PalletCarton;
			DetailHeader.TotalShipmentCarton = oData.results[0].TotalShipmentCarton;
			DetailHeader.TotalGrossWeight = oData.results[0].TotalGrossWeight;
			DetailHeader.TotalVolumeMetricWeight = oData.results[0].TotalVolumeMetricWeight;
			DetailHeader.Measurement = oData.results[0].Measurement;
			DetailHeader.Status = oData.results[0].Status;
			DetailHeader.StatusText = oData.results[0].StatusText;
			DetailHeader.UserName = oData.results[0].UserName;
			DetailHeader.Author = oData.results[0].Author;
			DetailHeader.CreatedOn = oData.results[0].CreatedOn;
			DetailHeader.LastChangedBy = oData.results[0].LastChangedBy;
			DetailHeader.LastChangedByText = oData.results[0].LastChangedByText;
			DetailHeader.LastChangedOn = oData.results[0].LastChangedOn;
			DetailHeader.FinalIncoterms = oData.results[0].FinalIncoterms;
			DetailHeader.CIfileID = oData.results[0].CIfileID;
			return DetailHeader;
		},
		mapDetailItems: function (oData) {
			var DetailItems = [];
			oData.results[0].to_items.results.forEach(function (Item) {
				var DetailItem = {};
				DetailItem.OldNew = "OLD";
				DetailItem.POLineItem = Item.POLineItem;
				DetailItem.RequestNumber = Item.RequestNumber;
				DetailItem.SequenceNumber = Item.SequenceNumber;
				DetailItem.SitePO = Item.SitePO;
				DetailItem.ImacPO = Item.ImacPO;
				DetailItem.Material = Item.Material;
				DetailItem.PackingList = Item.PackingList;
				DetailItem.Description = Item.Description;
				DetailItem.Quantity = Item.Quantity;
				DetailItem.UOM = Item.UOM;
				DetailItem.HS = Item.HS;
				DetailItem.ECN = Item.ECN;
				DetailItem.COO = Item.COO;
				DetailItem.UnitPrice = Item.UnitPrice;
				DetailItem.NetWeight = Item.NetWeight;
				DetailItem.ExtendedPrice = Item.ExtendedPrice;
				DetailItem.Z03 = Item.Z03;
				DetailItem.Z411K = Item.Z411K;
				DetailItem.DN = Item.DN;
				DetailItem.Z643 = Item.Z643;
				DetailItem.SAPMessage = Item.SAPMessage;
				DetailItem.ValidationState = "Success";
				if (Item.SAPMessage !== "") {
					DetailItem.SAPMessage = JSON.parse(Item.SAPMessage);
					DetailItem.MsgCount = DetailItem.SAPMessage.length;
					DetailItem.SAPMessage.forEach(function (SAPMessage) {
						if (SAPMessage.type === "Error") {
							DetailItem.ValidationState = "Error";
						}
					});
				}
				DetailItems.push(DetailItem);
			});
			return DetailItems;
		},

		handleLiveChangeRemark: function (oEvent) {
			var oTextArea = oEvent.getSource(),
				iValueLength = oTextArea.getValue().length,
				iMaxLength = oTextArea.getMaxLength(),
				sState = iValueLength > iMaxLength ? "Error" : "None";
			oTextArea.setValueState(sState);
			oTextArea.setValueStateText(this.i18n.getText("maxLimitRemarksMsg"));
		},
		// Event handler method to enter full screen
		handleFullScreen: function () {
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel"),
				sRequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			oGlobalModel.setProperty("/Refresh", false);
			oGlobalModel.setProperty("/Load", false);
			var sNextLayout = this.getOwnerComponent().getModel("ComponentModel").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.oRouter.navTo("detail", {
				layout: sNextLayout,
				requestNumber: sRequestNumber
			});
		},

		// Event handler method to exit full screen
		handleExitFullScreen: function () {
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel"),
				sRequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			oGlobalModel.setProperty("/Refresh", false);
			oGlobalModel.setProperty("/Load", false);
			var sNextLayout = this.getOwnerComponent().getModel("ComponentModel").getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
			this.oRouter.navTo("detail", {
				layout: sNextLayout,
				requestNumber: sRequestNumber
			});
		},

		// Event handler method to close detail page
		handleClose: function () {
			var oGlobalModel = this.getOwnerComponent().getModel("GlobalModel");
			oGlobalModel.setProperty("/Refresh", true);
			var sNextLayout = this.getOwnerComponent().getModel("ComponentModel").getProperty("/actionButtonsInfo/midColumn/closeColumn");
			this.oRouter.navTo("master", {
				layout: sNextLayout
			});
		},

		// Event handler method for the event press of Button
		// Opens the Upload Text dialog for mass upload of items (via Paste)
		onUploadDataPress: function () {
			if (!this.byId("UploadTextAreaDialog")) {
				Fragment.load({
					id: this.getView().getId(),
					name: "DropShipment.Z_PU_IMACIPO_DS.view.fragment.UploadText",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					oDialog.open();
				}.bind(this));
			} else {
				this.byId("UploadTextAreaDialog").open();
			}
		},

		onShipToCodeChange: function (oEvent) {
			if (oEvent.getParameters("").value !== "") {
				var selectedItem = oEvent.getSource().getSelectedItem().getBindingContext().getModel().getProperty(oEvent.getSource().getSelectedItem()
					.getBindingContext().getPath());
				this.oDefaultModel.DetailHeader.ShipToAddress = selectedItem.ShipToAddress;
				this.oDefaultModel.DetailHeader.SoldToAddress = selectedItem.SoldToAddress;
				this.oDefaultModel.DetailHeader.Plant = oEvent.getParameters("").value.substring(0, 4);
				this.oDefaultModel.AdditionalFields.ShipToCodeIncoterm = selectedItem.IncotermValue;
			} else {
				this.oDefaultModel.DetailHeader.ShipToAddress = "";
				this.oDefaultModel.DetailHeader.SoldToAddress = "";
				this.oDefaultModel.DetailHeader.Plant = "";
				this.oDefaultModel.AdditionalFields.ShipToCodeIncoterm = "";
			}
			this._refreshModel();
			this._PaidBy();
			this._getFinalIncoterms();
			this.onFreightPayableByChange("ShipToCodeChange");
		},

		onVendorCodeChange: function (oEvent) {
			if (oEvent.getParameters("").value !== "") {
				var selectedItem = oEvent.getSource().getSelectedItem().getBindingContext("VendorListModel").getModel().getProperty(oEvent.getSource().getSelectedItem()
					.getBindingContext("VendorListModel").getPath());
				this.oDefaultModel.DetailHeader.VendorName = selectedItem.Name;
			} else {
				this.oDefaultModel.DetailHeader.VendorName = "";
			}
			this._refreshModel();
			this._PaidBy();
		},
		onFreightPayableByChange: function (oEvent) {
			var FreightPayableBy = this.getView().byId("iFreightPayableBy").getSelectedKey();
			if (oEvent !== "InitalLoad") {
				this.oDefaultModel.DetailHeader.PaidBy = "";
				if (oEvent !== "ShipToCodeChange") {
					this.oDefaultModel.DetailHeader.Incoterm = "";
				}
				if (oEvent === "ShipToCodeChange" && FreightPayableBy === "SITE") {
					this.oDefaultModel.DetailHeader.CarrierAccountNumber = "";
				}
			}
			// ********************Begin of Get Incoterm ******************************************************			
			this.oDefaultModel.Incoterm = this.oDefaultModel.CarrierAll.filter(function (value) {
				return value.Title === FreightPayableBy;
			}).map(function (value) {
				return value.Incoterm;
			});
			this.oDefaultModel.Incoterm = [...new Set(this.oDefaultModel.Incoterm.map((item) => item))];
			if (this.oDefaultModel.Incoterm.length === 1) {
				this.oDefaultModel.DetailHeader.Incoterm = this.oDefaultModel.Incoterm[0];
			}
			// ********************End of Get Incoterm ********************************************************		

			// ********************Begin of Get CarrierAccountNumber ******************************************************	
			if (FreightPayableBy === "SITE") {
				var Plant = this.oDefaultModel.DetailHeader.ShipToCode.slice(0, 4);
				this.oDefaultModel.CarrierAccountNumber = this.oDefaultModel.CarrierAll.filter(function (value) {
					return value.Title === FreightPayableBy, value.Site === Plant;
				}).map(function (value) {
					return value.Carrier;
				});
			} else {
				this.oDefaultModel.CarrierAccountNumber = this.oDefaultModel.CarrierAll.filter(function (value) {
					return value.Title === FreightPayableBy;
				}).map(function (value) {
					return value.Carrier;
				});
			}
			this.oDefaultModel.CarrierAccountNumber = [...new Set(this.oDefaultModel.CarrierAccountNumber.map((item) => item))];
			if (this.oDefaultModel.CarrierAccountNumber.length === 1) {
				this.oDefaultModel.DetailHeader.CarrierAccountNumber = this.oDefaultModel.CarrierAccountNumber[0];
			}
			// ********************End of Get CarrierAccountNumber ********************************************************			
			this._refreshModel();
			this._PaidBy();
			this._getFinalIncoterms();
		},
		_PaidBy: function (oEvent) {
			var FreightPayableBy = this.getView().byId("iFreightPayableBy").getSelectedKey();
			var PaidBy = "";
			if (FreightPayableBy === "IMAC") {
				PaidBy = "IMAC";
			} else if (FreightPayableBy === "SITE") {
				PaidBy = this.getView().byId("iShipToCodeComboBox").getSelectedKey().substring(0, 4);
			} else if (FreightPayableBy === "Supplier") {
				PaidBy = this.oDefaultModel.DetailHeader.VendorName;
			}
			this.oDefaultModel.DetailHeader.PaidBy = PaidBy;
			this._refreshModel();
		},
		onIncoterm: function (oEvent) {
			this._getFinalIncoterms();
		},
		onOriginDestinationPoint: function (oEvent) {
			this._getFinalIncoterms();
		},
		_getFinalIncoterms: function (oEvent) {
			var Incoterm = this.oDefaultModel.DetailHeader.Incoterm.substring(0, 3);
			if (Incoterm === "") {
				this.oDefaultModel.DetailHeader.FinalIncoterms = "";
			} else if (Incoterm === "FCA" || Incoterm === "CIF" || Incoterm === "DAP") {
				if (this.oDefaultModel.DetailHeader.OriginDestinationPoint !== "") {
					this.oDefaultModel.DetailHeader.FinalIncoterms = Incoterm + " " + this.oDefaultModel.DetailHeader.OriginDestinationPoint;
				} else {
					this.oDefaultModel.DetailHeader.FinalIncoterms = "";
				}
			} else if (Incoterm === "CPT") {
				if (this.oDefaultModel.AdditionalFields.ShipToCodeIncoterm !== "") {
					this.oDefaultModel.DetailHeader.FinalIncoterms = Incoterm + " " + this.oDefaultModel.AdditionalFields.ShipToCodeIncoterm;
				} else {
					this.oDefaultModel.DetailHeader.FinalIncoterms = "";
				}
			}
			this._refreshModel();
		},
		_refreshModel: function (oEvent) {
			this._oComponent.getModel("defaultValueModel").refresh(true);
		},
		_getCarrier: function (oEvent) {
			Busy.show();
			this.oModel.read("/ZPU_DS_IMACIPO_CARR_F4", {
				success: function (oData) {
					this.oDefaultModel.CarrierAll = oData.results;
					this.oDefaultModel.Carrier = [...new Set(this.oDefaultModel.CarrierAll.map(item => item.Title))];
					this._refreshModel();
					Busy.hide();
				}.bind(this),
				error: function (oError) {
					Busy.hide();
				}
			});
		},
		onUploadDataPress: function () {
			if (!this.byId("UploadTextAreaDialog")) {
				Fragment.load({
					id: this.getView().getId(),
					name: "DropShipment.Z_PU_IMACIPO_DS.view.fragment.UploadText",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					oDialog.open();
				}.bind(this));
			} else {
				this.byId("UploadTextAreaDialog").open();
			}
		},
		// Event handler method for the event press of Button
		// Reads the uploaded entries and added to the Item table
		onUploadText: function () {
			var oText = this.byId("TextUploadArea").getValue(),
				aTextTable = oText.split("\n"),
				aColumns = [],
				oDropShipItem;
			aTextTable.forEach(function (oRow) {
				aColumns = oRow.split("\t");
				var ImacPO = "",
					Description = "",
					UnitPrice = "",
					ExtendedPrice = "",
					RequestNumber = "";
				if (aColumns[10]) {
					ImacPO = aColumns[10];
				}
				if (aColumns[11]) {
					Description = aColumns[11];
				}
				if (aColumns[12]) {
					UnitPrice = aColumns[12];
				}
				if (aColumns[13]) {
					ExtendedPrice = aColumns[13];
				}
				if (this._containsOnlyNumbers(this.oDefaultModel.DetailHeader.RequestNumber) === true) {
					RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
				}
				oDropShipItem = {
					"RequestNumber": RequestNumber,
					"SequenceNumber": this.getSeqnum(),
					"POLineItem": aColumns[0],
					"SitePO": aColumns[1],
					"PackingList": aColumns[2],
					"Material": aColumns[3],
					"Quantity": this.onQuantityUpload(aColumns[4]),
					"UOM": aColumns[5],
					"HS": aColumns[6],
					"ECN": aColumns[7],
					"COO": aColumns[8],
					"NetWeight": this._formatDecimalNumber(aColumns[9]),
					"GUID": this._generateUUID(),
					"OldNew": "NEW",
					"ValidationState": "Success"
				};
				this.oDefaultModel.DetailItems.push(oDropShipItem);
			}.bind(this));
			for (var i = 0; i < this.oDefaultModel.DetailItems.length; i++) {
				if (this.oDefaultModel.DetailItems[i].POLineItem === "" || undefined &&
					this.oDefaultModel.DetailItems[i].SitePO === "" || undefined &&
					this.oDefaultModel.DetailItems[i].PackingList === "" || undefined &&
					this.oDefaultModel.DetailItems[i].Material === "" || undefined &&
					this.oDefaultModel.DetailItems[i].Quantity === "" || undefined &&
					this.oDefaultModel.DetailItems[i].UOM === "" || undefined &&
					this.oDefaultModel.DetailItems[i].HS === "" || undefined &&
					this.oDefaultModel.DetailItems[i].ECN === "" || undefined &&
					this.oDefaultModel.DetailItems[i].COO === "" || undefined &&
					this.oDefaultModel.DetailItems[i].NetWeight === "" || undefined
				) {
					this.oDefaultModel.DetailItems.splice(i, 1);
				}
			}
			this._refreshModel();
			this.byId("TextUploadArea").setValue("");
			this.byId("UploadTextAreaDialog").close();
		},

		// Event handler method for the event press of Button
		// Closes the Upload Dialog
		onCloseUploadText: function () {
			this.byId("UploadTextAreaDialog").close();
		},
		onDeleteAll: function (oEvent) {
			this.oDefaultModel.DetailItems = [];
			this._refreshModel();
			this._clearMessageFilterDropDown();
		},
		createColumnConfigItems: function () {
			var i18n = this.getView().getModel("i18n").getResourceBundle();
			var EdmType = exportLibrary.EdmType;
			return [{
				label: i18n.getText("POLineItem"),
				property: "POLineItem",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("SitePO"),
				property: "SitePO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("PackingList"),
				property: "PackingList",
				type: EdmType.String,
				width: "15"
			}, {
				label: i18n.getText("Material"),
				property: "Material",
				type: EdmType.String,
				width: "20"
			}, {
				label: i18n.getText("Quantity"),
				property: "Quantity",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("UOM"),
				property: "UOM",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("HS"),
				property: "HS",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("ECN"),
				property: "ECN",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("COO"),
				property: "COO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("NetWeight"),
				property: "NetWeight",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("ImacPO"),
				property: "ImacPO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("Description"),
				property: "Description",
				type: EdmType.String,
				width: "40"
			}, {
				label: i18n.getText("UnitPrice"),
				property: "UnitPrice",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("ExtendedPrice"),
				property: "ExtendedPrice",
				type: EdmType.String,
				width: "10"
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
			}];
		},
		createColumnConfigTemplate: function () {
			var i18n = this.getView().getModel("i18n").getResourceBundle();
			var EdmType = exportLibrary.EdmType;
			return [{
				label: i18n.getText("POLineItem"),
				property: "POLineItem",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("SitePO"),
				property: "SitePO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("PackingList"),
				property: "PackingList",
				type: EdmType.String,
				width: "15"
			}, {
				label: i18n.getText("Material"),
				property: "Material",
				type: EdmType.String,
				width: "20"
			}, {
				label: i18n.getText("Quantity"),
				property: "Quantity",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("UOM"),
				property: "UOM",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("HS"),
				property: "HS",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("ECN"),
				property: "ECN",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("COO"),
				property: "COO",
				type: EdmType.String,
				width: "10"
			}, {
				label: i18n.getText("NetWeight"),
				property: "NetWeight",
				type: EdmType.String,
				width: "10"
			}];
		},
		// Event handler method for the event press of Button
		// Downloads Excel Template for mass upload
		onDownloadTemplate: function () {
			var aCols, aData, oSettings, oSheet;
			aCols = this.createColumnConfigTemplate();
			aData = [];
			for (let i = 0; i < 6; i++) {
				aData.push({
					"UOM": "EA",
					"ECN": "EAR99"
				});
			}
			oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: aData,
				fileName: "Template.xlsx"
			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build()
				.then(function () {

				})
				.finally(oSheet.destroy);

		},
		onDownloadItems: function () {
			var aCols, aData, oSettings, oSheet;
			var EdmType = exportLibrary.EdmType;
			aCols = this.createColumnConfigItems();
			aCols.push({
				label: this.i18n.getText("ErrorMessage"),
				property: "ErrorMessage",
				type: EdmType.String,
				width: "100"
			});

			aData = [];
			this.oDefaultModel.DetailItems.forEach(function (Item) {
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
				fileName: "Items.xlsx"
			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build()
				.then(function () {

				})
				.finally(oSheet.destroy);
		},
		DropShipItemsAdd: function () {
			var RequestNumber = "";
			if (this._containsOnlyNumbers(this.oDefaultModel.DetailHeader.RequestNumber) === true) {
				RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			}
			var oNewItem = {
				"RequestNumber": RequestNumber,
				"SequenceNumber": this.getSeqnum(),
				"POLineItem": "",
				"SitePO": "",
				"ImacPO": "",
				"PackingList": "",
				"Material": "",
				"Description": "",
				"Quantity": "",
				"UOM": "EA",
				"HS": "",
				"ECN": "EAR99",
				"COO": "",
				"UnitPrice": "0.00000",
				"NetWeight": "",
				"OldNew": "NEW",
				"GUID": this._generateUUID(),
				"ValidationState": "Success"
			};
			this.oDefaultModel.DetailItems.push(oNewItem);
			this._refreshModel();
		},
		// Method to set row action template based on the request status
		setRowActionTemplate: function (bFlag) {
			var oTable = this.byId("DropShipItemsTable"),
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
							type: "Delete",
							press: function (oEvent) {
								var sPath = oEvent.getParameter("row").getBindingContext("defaultValueModel").getPath(),
									iIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1), 10);
								this.oDefaultModel.DetailItems.splice(iIndex, 1);
								this._refreshModel();
							}.bind(this)
						})
					]
				});
				oTable.setRowActionTemplate(oTemplate);
			} else {
				oTable.setRowActionCount(0);
				oTable.setRowActionTemplate(null);
			}
		},
		onCreatePress: function (oEvent) {
			var error;
			this.oDefaultModel.DetailHeader.Action = "Create";
			error = this._validate();
			if (error !== "X") {
				this._handleRemarkDialog(this);
			}
		},
		onDraftPress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "Draft";
			this._handleRemarkDialog(this);
		},
		onSubmitPress: function (oEvent) {
			var error;
			this.oDefaultModel.DetailHeader.Action = "Submit";
			error = this._validate();
			if (error !== "X") {
				this._handleRemarkDialog(this);
			}
		},
		onWithdrawPress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "WithdrawBuyer";
			this._handleRemarkDialog(this);
		},
		onCloseReopenPress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "CloseReopen";
			this._handleRemarkDialog(this);
		},
		onReopen: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "Reopen";
			this._handleRemarkDialog(this);
		},
		onWithdrawPressPost: function (oEvent) {
			Busy.show();
			var oEntry = {};
			oEntry.RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			oEntry.Remarks = this.oDefaultModel.DetailHeader.Remarks;
			this.oModel.create("/WithdrawSet", oEntry, {
				success: function (data) {
					Busy.hide();
					MessageBox.success(data.Message, {
						actions: [MessageBox.Action.OK],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (sAction) {
							Busy.hide();
							this.handleClose();
						}.bind(this)
					});

				}.bind(this),
				error: function (error) {
					Busy.hide();
					var errorText = JSON.parse(error.responseText);
					errorText = errorText.error.message.value;
					MessageToast.show(errorText);
				}
			});
		},
		onReopenPost: function (oEvent) {
			Busy.show();
			var oEntry = {};
			oEntry.RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			oEntry.Remarks = this.oDefaultModel.DetailHeader.Remarks;
			this.oModel.create("/ReopenSet", oEntry, {
				success: function (data) {
					Busy.hide();
					MessageBox.success(data.Message, {
						actions: [MessageBox.Action.OK],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (sAction) {
							Busy.hide();
							this.handleClose();
						}.bind(this)
					});

				}.bind(this),
				error: function (error) {
					Busy.hide();
					var errorText = JSON.parse(error.responseText);
					errorText = errorText.error.message.value;
					MessageToast.show(errorText);
				}
			});
		},
		onCloseReopenPost: function (oEvent) {
			Busy.show();
			var oEntry = {};
			oEntry.RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			oEntry.Remarks = this.oDefaultModel.DetailHeader.Remarks;
			this.oModel.create("/CloseReopenSet", oEntry, {
				success: function (data) {
					Busy.hide();
					MessageBox.success(data.Message, {
						actions: [MessageBox.Action.OK],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (sAction) {
							Busy.hide();
							this.handleClose();
						}.bind(this)
					});

				}.bind(this),
				error: function (error) {
					Busy.hide();
					var errorText = JSON.parse(error.responseText);
					errorText = errorText.error.message.value;
					MessageToast.show(errorText);
				}
			});
		},
		onSaveButtonPress: function (oEvent) {
			var error;
			this.oDefaultModel.DetailHeader.Action = "Save";
			error = this._validate();
			if (error !== "X") {
				this._handleBatchProcess(this);
			}
		},
		onApprovePress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "Approve";
			this._handleRemarkDialog(this);
		},
		onRejectPress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "Reject";
			this._handleRemarkDialog(this);
		},
		onClosePress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "Close";
			this._handleRemarkDialog(this);
		},
		onWithdrawLAPress: function (oEvent) {
			this.oDefaultModel.DetailHeader.Action = "WithdrawLA";
			this._handleRemarkDialog(this);
		},
		onPostingButtonPress: function (oEvent) {
			var error;
			var sAction = oEvent.getSource().data("action");
			this.oDefaultModel.DetailHeader.Action = sAction;
			error = this._validate();
			if (error !== "X") {
				this.oDefaultModel.DetailHeader.SingleProcessing = true;
				if (sAction === "DN") {
					this._postDN(sAction);
				} else {
					this._handleBatchProcess(this);
				}
			}
		},
		onValidate: function (oEvent) {
			var error;
			this.oDefaultModel.DetailHeader.Action = "Validate";
			error = this._validate();
			if (error !== "X") {
				this._handleBatchProcess(this);
			}
		},
		_validate: function () {
			var error = "",
				errorHeader = "",
				errorItem = "",
				NoItem = "";
			if (this.oDefaultModel.DetailItems.length === 0 ||
				(this.oDefaultModel.DetailHeader.FinalIncoterms === "" && this.oDefaultModel.DetailHeader
					.Action !== "Validate") ||
				(this.oDefaultModel.AttachmentList.length < 2 && this.oDefaultModel.DetailHeader
					.Action !== "Validate")) {
				NoItem = "X";
				if (this.oDefaultModel.DetailItems.length === 0) {
					MessageToast.show(this.i18n.getText("ItemsMessage"));
				} else if (this.oDefaultModel.AttachmentList.length < 2 && this.oDefaultModel.DetailHeader.Action !== "Validate") {
					MessageToast.show(this.i18n.getText("AttachmentMessage"));
				} else if (this.oDefaultModel.DetailHeader.FinalIncoterms === "" && this.oDefaultModel.DetailHeader
					.Action !== "Validate") {
					MessageToast.show(this.i18n.getText("FinalIncotermsMessage"));
				}
			} else {
				errorHeader = this._validateHeader();
				errorItem = this._validateItem();
				if (errorHeader === "X" || errorItem === "X") {
					error = "X";
					MessageToast.show(this.i18n.getText("HighlightedMessage"));
				}
			}
			if (NoItem === "X") {
				error = "X";
			}
			return error;
		},
		_validateHeader: function () {
			var error = "";
			if (this.oDefaultModel.DetailHeader.ShipperName === "") {
				this.oDefaultModel.ValueStateHeader.ShipperName = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.ShipperName = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.ShipperAddress === "") {
				this.oDefaultModel.ValueStateHeader.ShipperAddress = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.ShipperAddress = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.InvoiceType === "") {
				this.oDefaultModel.ValueStateHeader.InvoiceType = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.InvoiceType = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.ShipToCode === "") {
				this.oDefaultModel.ValueStateHeader.ShipToCode = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.ShipToCode = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.VendorCode === "") {
				this.oDefaultModel.ValueStateHeader.VendorCode = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.VendorCode = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.FreightPayableBy === "") {
				this.oDefaultModel.ValueStateHeader.FreightPayableBy = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.FreightPayableBy = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.Incoterm === "") {
				this.oDefaultModel.ValueStateHeader.Incoterm = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.Incoterm = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.CarrierAccountNumber === "") {
				this.oDefaultModel.ValueStateHeader.CarrierAccountNumber = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.CarrierAccountNumber = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.OriginDestinationPoint === "") {
				this.oDefaultModel.ValueStateHeader.OriginDestinationPoint = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.OriginDestinationPoint = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.MethodOfTransport === "") {
				this.oDefaultModel.ValueStateHeader.MethodOfTransport = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.MethodOfTransport = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.ServiceType === "") {
				this.oDefaultModel.ValueStateHeader.ServiceType = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.ServiceType = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.DateShipped === "" || this.oDefaultModel.DetailHeader.DateShipped === null) {
				this.oDefaultModel.ValueStateHeader.DateShipped = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.DateShipped = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.Currency === "") {
				this.oDefaultModel.ValueStateHeader.Currency = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.Currency = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.PalletCarton === "" || this.oDefaultModel.DetailHeader.PalletCarton <= 0) {
				this.oDefaultModel.ValueStateHeader.PalletCarton = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.PalletCarton = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.TotalShipmentCarton === "" || this.oDefaultModel.DetailHeader.TotalShipmentCarton <= 0) {
				this.oDefaultModel.ValueStateHeader.TotalShipmentCarton = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.TotalShipmentCarton = sap.ui.core.ValueState.None;
			}
			if (this.oDefaultModel.DetailHeader.TotalGrossWeight === "" || this.oDefaultModel.DetailHeader.TotalGrossWeight <= 0) {
				this.oDefaultModel.ValueStateHeader.TotalGrossWeight = sap.ui.core.ValueState.Error;
				error = "X";
			} else {
				this.oDefaultModel.ValueStateHeader.TotalGrossWeight = sap.ui.core.ValueState.None;
			}
			this._refreshModel();
			return error;
		},
		_validateItem: function () {
			var error = "";
			this.oDefaultModel.DetailItems.forEach(function (Item) {
				var ValueState = {
					POLineItem: "",
					SitePO: "",
					PackingList: "",
					Material: "",
					Quantity: "",
					UOM: "",
					HS: "",
					ECN: "",
					COO: "",
					NetWeight: ""
				};
				Item.ValueState = ValueState;
				if (Item.POLineItem === "" || Item.POLineItem <= 0) {
					Item.ValueState.POLineItem = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.POLineItem = sap.ui.core.ValueState.None;
				}
				if (Item.SitePO === "" || Item.SitePO <= 0) {
					Item.ValueState.SitePO = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.SitePO = sap.ui.core.ValueState.None;
				}
				if (Item.PackingList === "") {
					Item.ValueState.PackingList = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.PackingList = sap.ui.core.ValueState.None;
				}
				if (Item.Material === "") {
					Item.ValueState.Material = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.Material = sap.ui.core.ValueState.None;
				}
				if (Item.Quantity === "" || Item.Quantity <= 0) {
					Item.ValueState.Quantity = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.Quantity = sap.ui.core.ValueState.None;
				}
				if (Item.UOM === "") {
					Item.ValueState.UOM = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.UOM = sap.ui.core.ValueState.None;
				}
				if (Item.HS === "") {
					Item.ValueState.HS = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.HS = sap.ui.core.ValueState.None;
				}
				if (Item.ECN === "") {
					Item.ValueState.ECN = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.ECN = sap.ui.core.ValueState.None;
				}
				if (Item.COO === "") {
					Item.ValueState.COO = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.COO = sap.ui.core.ValueState.None;
				}
				if (Item.NetWeight === "") {
					Item.ValueState.NetWeight = sap.ui.core.ValueState.Error;
					error = "X";
				} else {
					Item.ValueState.NetWeight = sap.ui.core.ValueState.None;
				}
			});
			this._refreshModel();
			return error;
		},
		// This is used to open the dialog for the comments for approval/rejection.
		_handleRemarkDialog: function (that) {
			this.oDefaultModel.DetailHeader.Remarks = "";
			this._refreshModel();
			if (!this._remarkDialog) {
				this._remarkDialog = sap.ui.xmlfragment("DropShipment.Z_PU_IMACIPO_DS.view.fragment.Remark", this);
				this.getView().addDependent(this._remarkDialog);
			}
			this._remarkDialog.open();
		},
		onRemarksAfterclose: function (that) {
			this._remarkDialog.destroy();
			this._remarkDialog = undefined;
		},
		onSubmitRemarkBox: function (oEvent) {
			if (oEvent.getSource().getParent().getParent().getContent()[0].getValueState() === "Error") {
				MessageToast.show(this.i18n.getText("RemarksMessage"));
				return;
			} else if (this.oDefaultModel.DetailHeader.Action === "Reject" && this.oDefaultModel.DetailHeader.Remarks === "") {
				MessageToast.show(this.i18n.getText("CommentsMandatory"));
				return;
			} else if (this.oDefaultModel.DetailHeader.Action === "Close" && this.oDefaultModel.DetailHeader.Remarks === "") {
				MessageToast.show(this.i18n.getText("CommentsMandatory2"));
				return;
			} else if (this.oDefaultModel.DetailHeader.Action === "Reopen" && this.oDefaultModel.DetailHeader.Remarks === "") {
				MessageToast.show(this.i18n.getText("CommentsMandatoryReopen"));
				return;
			} else if (this.oDefaultModel.DetailHeader.Action === "CloseReopen" && this.oDefaultModel.DetailHeader.Remarks === "") {
				MessageToast.show(this.i18n.getText("CommentsMandatory2"));
				return;
			} else if (this.oDefaultModel.DetailHeader.Action === "Create" || this.oDefaultModel.DetailHeader.Action === "Draft" || this.oDefaultModel
				.DetailHeader.Action === "Submit") {
				this._remarkDialog.close();
				this._handleBatchProcess(this);
			} else if (this.oDefaultModel.DetailHeader.Action === "Approve" || this.oDefaultModel.DetailHeader.Action === "Reject" ||
				this.oDefaultModel.DetailHeader.Action === "WithdrawLA" || this.oDefaultModel.DetailHeader.Action === "Close") {
				this._handleWorkflowService(this);
				this._remarkDialog.close();
			} else if (this.oDefaultModel.DetailHeader.Action === "WithdrawBuyer") {
				this._remarkDialog.close();
				this.onWithdrawPressPost();
			} else if (this.oDefaultModel.DetailHeader.Action === "Reopen") {
				this._remarkDialog.close();
				this.onReopenPost();
			} else if (this.oDefaultModel.DetailHeader.Action === "CloseReopen") {
				this._remarkDialog.close();
				this.onCloseReopenPost();
			}
		},
		onRemarkBoxClose: function (oEvent) {
			this._remarkDialog.close();
		},
		_handleBatchProcess: function (that) {
			Busy.show();
			var batchUrls = [];
			var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
			var oModel = new sap.ui.model.odata.ODataModel(url, true);
			var header = {};
			header = Object.assign({}, this.oDefaultModel.DetailHeader);
			var Action = this.oDefaultModel.DetailHeader.Action;
			header.Action = this.oDefaultModel.DetailHeader.Action.toUpperCase();
			header.CreatedOn = new Date();
			header.LastChangedOn = new Date();
			delete header.StatusText;
			delete header.LastChangedByText;
			if (Action === "643") {
				var MyInboxSet = this.getOwnerComponent().getModel("MyInboxRequestModel").getData().MyInboxSet;
				var WorkItemId = MyInboxSet.filter(function (value) {
					return value.RequestNumber === header.RequestNumber;
				}).map(function (value) {
					return value.WorkitemId;
				})[0];
				this.oDefaultModel.DetailItems.forEach(function (Item) {
					Item.WorkitemId = WorkItemId;
				});
			}

			batchUrls.push(oModel.createBatchOperation("/HeaderSet", "POST", header));
			this.oDefaultModel.DetailItems.forEach(function (Item) {
				Item.SAPMessage = "";
				delete Item.ValueState;
				delete Item.MsgCount;
				delete Item.ValidationState;
				delete Item.ErrorMessage;
				batchUrls.push(oModel.createBatchOperation("/ItemsSet", "POST", Item));
			});

			oModel.addBatchChangeOperations(batchUrls);
			oModel.setUseBatch(true);
			oModel.submitBatch(function (oData, oResponse) {
				if (oData.__batchResponses[0].response) {
					MessageToast.show(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
					Busy.hide();
				} else {
					var changeResponse = oData.__batchResponses[0].__changeResponses;
					var DetailItems = [];
					var MsgCount = 0;
					changeResponse.forEach(function (Response) {
						if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Header") {
							this.oDefaultModel.DetailHeader = Response.data;
							this.oDefaultModel.DetailHeader.Action = Action;
						} else if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Items") {
							Response.data.ValidationState = "";
							if (Response.data.SAPMessage !== "") {
								Response.data.SAPMessage = JSON.parse(Response.data.SAPMessage);
								Response.data.SAPMessage.forEach(function (SAPMessage) {
									if (SAPMessage.type === "Error") {
										Response.data.ValidationState = "Error";
									}
								});
								Response.data.MsgCount = Response.data.SAPMessage.length;
								MsgCount = MsgCount + Response.data.MsgCount;
								var ValueState = {},
									i;
								Response.data.ValueState = ValueState;
								Response.data.ValueState.SitePO = "None"
								Response.data.ValueState.SitePOText = "";
								Response.data.ValueState.Material = "None";
								Response.data.ValueState.MaterialText = "";
								for (i = 0; i < Response.data.SAPMessage.length; i++) {
									if (Response.data.SAPMessage[i].fieldname === "SitePO" && Response.data.SAPMessage[i].message !== "") {
										Response.data.ValueState.SitePO = "Error";
										Response.data.ValueState.SitePOText = Response.data.SAPMessage[i].message;
									}
									if (Response.data.SAPMessage[i].fieldname === "Material" && Response.data.SAPMessage[i].message !== "") {
										Response.data.ValueState.Material = "Error";
										Response.data.ValueState.MaterialText = Response.data.SAPMessage[i].message;
									}
									if (Response.data.SAPMessage[i].type !== "Error") {
										Response.data.SAPMessage.splice(i, 1);
									}
								}

							}
							if (Response.data.ValidationState === "") {
								Response.data.ValidationState = "Success";
							}
							DetailItems.push(Response.data);
						}
					}.bind(this));
					this.oDefaultModel.DetailItems = DetailItems;
					this._refreshModel();
					if (this.oDefaultModel.DetailHeader.Action === "Create" || this.oDefaultModel.DetailHeader.Action === "Draft" || this.oDefaultModel
						.DetailHeader.Action === "Submit") {
						if (this.oDefaultModel.DetailHeader.SAPMessage === "") {
							if (MsgCount === 0) {
								this.uploadAttachmentsPostCreate();
							} else {
								MessageToast.show(this.i18n.getText("ValidationNotesError"));
							}
						} else {
							MessageToast.show(this.oDefaultModel.DetailHeader.SAPMessage);
						}
					} else if (this.oDefaultModel.DetailHeader.Action === "643") {
						var allClose = 0,
							NotClose = 0;
						this.oDefaultModel.DetailItems.forEach(function (item) {
							if (item.Close === true) {
								allClose = allClose + 1;
							} else {
								NotClose = NotClose + 1;
							}
						});
						if (allClose >= 0 && NotClose === 0) {
							MessageBox.success(this.i18n.getText("PostingDone"), {
								actions: [MessageBox.Action.OK],
								emphasizedAction: MessageBox.Action.OK,
								onClose: function (sAction) {
									Busy.hide();
									this.handleClose();
								}.bind(this)
							});
						}
					} else if (this.oDefaultModel.DetailHeader.Action === "Save") {
						if (this.oDefaultModel.DetailHeader.ChangesSaved === "X") {
							MessageToast.show(this.i18n.getText("ChangesSaved"));
						} else if (this.oDefaultModel.DetailHeader.ChangesSaved === "E") {
							MessageToast.show(this.i18n.getText("ErrorNOChangesSaved"));
						} else {
							MessageToast.show(this.i18n.getText("NOChangesSaved"));
						}
						if( this.oDefaultModel.DetailHeader.ChangesSaved === "X"){
						this.oDefaultModel.DetailItems.forEach(function (Item) {
							Item.OldNew = "OLD";
						});
						}
						this._refreshModel();
						this._readLog(this.oDefaultModel.DetailHeader.RequestNumber);
					} else if (this.oDefaultModel.DetailHeader.Action === "Z03" ||
						this.oDefaultModel.DetailHeader.Action === "411K" ||
						this.oDefaultModel.DetailHeader.Action === "DN" ||
						this.oDefaultModel.DetailHeader.Action === "643"
					) {
						if( this.oDefaultModel.DetailHeader.ChangesSaved === "X"){
						this.oDefaultModel.DetailItems.forEach(function (Item) {
							Item.OldNew = "OLD";
						});
						}
						this._refreshModel();
						this._readLog(this.oDefaultModel.DetailHeader.RequestNumber);
					}
				}
				Busy.hide();
			}.bind(this), function (error) {
				Busy.hide();
			});

		},
		_handleDeepEntityOneByOne: async function (that, Action, Item, Index) {
			this.getView().setBusy(true);
			return new Promise(async function (resolve, reject) {
				var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
				var oModel = new sap.ui.model.odata.ODataModel(url);
				var header = {};
				header = Object.assign({}, this.oDefaultModel.DetailHeader);
				var Action = this.oDefaultModel.DetailHeader.Action;
				header.Action = this.oDefaultModel.DetailHeader.Action.toUpperCase();
				header.LastChangedOn = new Date();
				delete header.StatusText;
				delete header.LastChangedByText;
				var Items = [];
				Items.push(Item);
				Item.SAPMessage = "";
				delete Item.ValueState;
				delete Item.MsgCount;
				delete Item.ValidationState;
				delete Item.ErrorMessage;
				var oCreateData = header;
				var customHeader = {
					"Content-Type": "application/json"
				};
				oModel.setUseBatch(true);
				this.oModel.setHeaders(customHeader);
				oCreateData.HeaderToItem = Items;
				this.oModel.create("/HeaderSet", oCreateData, {
					success: function (oData, oResponse) {
						this.getView().setBusy(false);
						if (oResponse.headers["sap-message"]) {
							if (JSON.parse(oResponse.headers["sap-message"]).severity === "error") {
								MessageToast.show(JSON.parse(oResponse.headers["sap-message"]).message);
							}
						} else {
							this.oDefaultModel.DetailItems[Index] = oData.HeaderToItem.results[0];
							this._refreshModel();
						}
					}.bind(this),
					error: function (oError) {
						if (oError.responseText) {
							var sErrorText = JSON.parse(oError.responseText).error.message.value;
							MessageBox.error(sErrorText);
						}
						this.getView().setBusy(false);
					}.bind(this)
				});

			}.bind(this));
		},
		_handleBatchProcessOneByOne: async function (that) {
			return new Promise(async function (resolve, reject) {
				Busy.show();
				var batchUrls = [];
				var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
				var oModel = new sap.ui.model.odata.ODataModel(url, true);
				var header = {};
				header = Object.assign({}, this.oDefaultModel.DetailHeader);
				var Action = this.oDefaultModel.DetailHeader.Action;
				header.Action = this.oDefaultModel.DetailHeader.Action.toUpperCase();
				header.LastChangedOn = new Date();
				delete header.StatusText;
				delete header.LastChangedByText;

				this.oDefaultModel.DetailItems.forEach(async function (Item, Index) {
					if (Item.Z03 !== "" && Item.Z411K !== "" && Item.DN === "") {
						batchUrls = [];
						batchUrls.push(oModel.createBatchOperation("/HeaderSet", "POST", header));
						Item.SAPMessage = "";
						delete Item.ValueState;
						delete Item.MsgCount;
						delete Item.ValidationState;
						delete Item.ErrorMessage;
						batchUrls.push(oModel.createBatchOperation("/ItemsSet", "POST", Item));
						oModel.addBatchChangeOperations(batchUrls);
					}
				}.bind(this));

				oModel.setUseBatch(true);
				oModel.submitBatch(async function (oData, oResponse) {
					if (oData.__batchResponses[0].response) {
						MessageToast.show(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
						Busy.hide();
						resolve();
					} else {
						var changeResponse = oData.__batchResponses[0].__changeResponses;
						var MsgCount = 0;
						var DetailItems = {};
						changeResponse.forEach(async function (Response) {
							if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Header") {
								this.oDefaultModel.DetailHeader = Response.data;
								this.oDefaultModel.DetailHeader.Action = Action;
							} else if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Items") {
								Response.data.ValidationState = "";
								if (Response.data.SAPMessage !== "") {
									Response.data.SAPMessage = JSON.parse(Response.data.SAPMessage);
									Response.data.SAPMessage.forEach(function (SAPMessage) {
										if (SAPMessage.type === "Error") {
											Response.data.ValidationState = "Error";
										}
									});
									Response.data.MsgCount = Response.data.SAPMessage.length;
									MsgCount = MsgCount + Response.data.MsgCount;
									var ValueState = {},
										i;
									Response.data.ValueState = ValueState;
									Response.data.ValueState.SitePO = "None"
									Response.data.ValueState.SitePOText = "";
									Response.data.ValueState.Material = "None";
									Response.data.ValueState.MaterialText = "";
									for (i = 0; i < Response.data.SAPMessage.length; i++) {
										if (Response.data.SAPMessage[i].fieldname === "SitePO" && Response.data.SAPMessage[i].message !== "") {
											Response.data.ValueState.SitePO = "Error";
											Response.data.ValueState.SitePOText = Response.data.SAPMessage[i].message;
										}
										if (Response.data.SAPMessage[i].fieldname === "Material" && Response.data.SAPMessage[i].message !== "") {
											Response.data.ValueState.Material = "Error";
											Response.data.ValueState.MaterialText = Response.data.SAPMessage[i].message;
										}
										if (Response.data.SAPMessage[i].type !== "Error") {
											Response.data.SAPMessage.splice(i, 1);
										}
									}
								}
								if (Response.data.ValidationState === "") {
									Response.data.ValidationState = "Success";
								}
							}
							DetailItems = Response.data;
						}.bind(this));
						// this.oDefaultModel.DetailItems[Index] = DetailItems;
						this.oDefaultModel.DetailItems = [];
						this.oDefaultModel.DetailItems.push(DetailItems);
						this._refreshModel();
						resolve();
					}
					Response.data
					Busy.hide();
				}.bind(this), function (error) {
					Busy.hide();
				});
			}.bind(this));
		},
		_handleBatchProcessOneByOneDN: async function () {
			Busy.show();
			var url = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/";
			var oModel = new sap.ui.model.odata.ODataModel(url, true);
			var header = Object.assign({}, this.oDefaultModel.DetailHeader);
			var Action = this.oDefaultModel.DetailHeader.Action.toUpperCase();
			header.Action = Action;
			header.LastChangedOn = new Date();
			delete header.StatusText;
			delete header.LastChangedByText;

			try {
				for (let index = 0; index < this.oDefaultModel.DetailItems.length; index++) {
					let Item = this.oDefaultModel.DetailItems[index];
					if (Item.Z03 !== "" && Item.Z411K !== "" && Item.DN === "") {
						var batchUrls = [];
						var batchHeaderUrl = oModel.createBatchOperation("/HeaderSet", "POST", header);
						batchUrls.push(batchHeaderUrl);

						Item.SAPMessage = "";
						Item.ItemIndex = index;
						delete Item.ValueState;
						delete Item.MsgCount;
						delete Item.ValidationState;
						delete Item.ErrorMessage;

						var batchItemUrl = oModel.createBatchOperation("/ItemsSet", "POST", Item);
						batchUrls.push(batchItemUrl);

						oModel.addBatchChangeOperations(batchUrls);

						await new Promise(function (resolve, reject) {
							oModel.submitBatch(function (oData, oResponse) {
								if (oData && oData.__batchResponses[0].response) {
									reject(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
								} else {
									var changeResponse = oData.__batchResponses[0].__changeResponses;
									var MsgCount = 0;
									var DetailItems = {};
									changeResponse.forEach(async function (Response) {
										if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Header") {
											this.oDefaultModel.DetailHeader = Response.data;
											this.oDefaultModel.DetailHeader.Action = Action;
										} else if (Response.data.__metadata.type === "ZOD_PU_IMACIPO_DS_SRV.Items") {
											Response.data.ValidationState = "";
											if (Response.data.SAPMessage !== "") {
												Response.data.SAPMessage = JSON.parse(Response.data.SAPMessage);
												Response.data.SAPMessage.forEach(function (SAPMessage) {
													if (SAPMessage.type === "Error") {
														Response.data.ValidationState = "Error";
													}
												});
												Response.data.MsgCount = Response.data.SAPMessage.length;
												MsgCount = MsgCount + Response.data.MsgCount;
												var ValueState = {},
													i;
												Response.data.ValueState = ValueState;
												Response.data.ValueState.SitePO = "None"
												Response.data.ValueState.SitePOText = "";
												Response.data.ValueState.Material = "None";
												Response.data.ValueState.MaterialText = "";
												for (i = 0; i < Response.data.SAPMessage.length; i++) {
													if (Response.data.SAPMessage[i].fieldname === "SitePO" && Response.data.SAPMessage[i].message !== "") {
														Response.data.ValueState.SitePO = "Error";
														Response.data.ValueState.SitePOText = Response.data.SAPMessage[i].message;
													}
													if (Response.data.SAPMessage[i].fieldname === "Material" && Response.data.SAPMessage[i].message !== "") {
														Response.data.ValueState.Material = "Error";
														Response.data.ValueState.MaterialText = Response.data.SAPMessage[i].message;
													}
													if (Response.data.SAPMessage[i].type !== "Error") {
														Response.data.SAPMessage.splice(i, 1);
													}
												}
											}
											if (Response.data.ValidationState === "") {
												Response.data.ValidationState = "Success";
											}
										}
										DetailItems = Response.data;

									}.bind(this));
									if( this.oDefaultModel.DetailHeader.ChangesSaved === "X"){
									DetailItems.OldNew = "OLD";
									}
									this.oDefaultModel.DetailItems[DetailItems.ItemIndex] = DetailItems;
									this._refreshModel();
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
		},
		_postDN: async function (Action) {
			this._handleBatchProcessOneByOneDN(this);
		},
		onTotalGrossWeight: function (oEvent) {
			var TotalGrossWeight = oEvent.getSource().getValue();
			oEvent.getSource().setValue(this._formatDecimalNumber(TotalGrossWeight));
		},
		onTotalVolumeMetricWeight: function (oEvent) {
			var TotalVolumeMetricWeight = oEvent.getSource().getValue();
			oEvent.getSource().setValue(this._formatDecimalNumber(TotalVolumeMetricWeight));
		},
		onPalletCarton: function (oEvent) {
			var PalletCarton = oEvent.getSource().getValue();
			// oEvent.getSource().setValue(this._formatNumber(PalletCarton, 7));
			var check = this._formatPalletCarton(PalletCarton);
			if (check === false) {
				oEvent.getSource().setValue("");
				MessageToast.show(this.i18n.getText("IncorrectPallet/Carton"));
			}
			if (PalletCarton === "0/0") {
				oEvent.getSource().setValue("");
				MessageToast.show(this.i18n.getText("IncorrectPallet/Carton"));
			}
		},
		_formatPalletCarton: function (PalletCarton) {
			var regex = /^\d+\/\d+$/i;
			return regex.test(PalletCarton);
		},
		onTotalShipmentCarton: function (oEvent) {
			var TotalShipmentCarton = oEvent.getSource().getValue();
			oEvent.getSource().setValue(this._formatNumber(TotalShipmentCarton, 3));
		},
		onPOLineItem: function (oEvent) {
			var POLineItem = oEvent.getSource().getValue();
			oEvent.getSource().setValue(this._formatNumber(POLineItem, 2));
		},
		onSitePO: function (oEvent) {
			var POLineItem = oEvent.getSource().getValue();
			oEvent.getSource().setValue(this._formatNumber(POLineItem, 10));
		},
		onQuantityUpload: function (value) {
			if (value !== undefined) {
				value = value.replace(/\,/g, '');
			}
			return this._formatNumber(value, 10);
		},
		onQuantity: function (oEvent) {
			var Quantity = oEvent.getSource().getValue();
			if (Quantity !== undefined) {
				Quantity = Quantity.replace(/\,/g, '');
			}
			oEvent.getSource().setValue(this._formatNumber(Quantity, 10));
		},
		onNetWeight: function (oEvent) {
			var NetWeight = oEvent.getSource().getValue();
			oEvent.getSource().setValue(this._formatDecimalNumber(NetWeight, 9));
		},
		_formatDecimalNumber: function (value) {
			if (value !== undefined) {
				value = value.replace(/\,/g, '');
			}			
			value = (Math.round(Number(value) * 1000) / 1000).toFixed(3);
			var oFormat = sap.ui.core.format.NumberFormat.getIntegerInstance({
				decimals: 3,
				precision: "9",
				groupingSeparator: "",
				decimalSeparator: ".",
				roundingMode: 'AWAY_FROM_ZERO'
			});
			if (value && oFormat.format(value).length <= 9 && oFormat.format(value) > 0) {
				return oFormat.format(value);
			} else {
				return oFormat.format("0");
			}
		},
		_formatNumber: function (value, numLength) {
			var oFormat = sap.ui.core.format.NumberFormat.getIntegerInstance({
				decimals: 0,
				precision: "7",
				groupingSeparator: ""
			});
			if (value && oFormat.format(value).length <= numLength && oFormat.format(value) > 0) {
				return oFormat.format(value);
			} else {
				if (oFormat.format(value) <= 0) {
					return oFormat.format("0");
				} else {
					return oFormat.format(value).slice(0, numLength);
				}
				MessageToast.show(this.i18n.getText("FieldLength"));

			}
		},
		getSeqnum: function (id) {
			var oCount = this.oDefaultModel.SequenceNumber;
			oCount = Number(oCount) + 1;
			oCount = oCount.toString();
			this.oDefaultModel.SequenceNumber = oCount;
			return oCount;
		},
		// Event Handler method of event press of Button
		// Loads the Message Popover dialog for the display of error messages
		onMessagePopOverPress: function (oEvent) {
			var oButton = oEvent.getSource();
			var aMessages = oEvent.getSource().getBindingContext("defaultValueModel").getObject().SAPMessage;
			this.oDefaultModel.messages = aMessages;
			this._refreshModel();
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
		},
		// This is a private function, triggered for adding attachment to the request.
		_handleCreateRequestAttachmentUpload: function (that) {
			if (this.oDefaultModel.AttachmentList.length > 0) {
				var AttachmentList = this.oDefaultModel.AttachmentList;
				for (var i = 0; i < AttachmentList.length; i++) {
					if (!AttachmentList[i].url) {
						var async_function = async function () {
							await that._updateAttachmentToServerAfterCreate(AttachmentList[i].data, that, AttachmentList[i].FileName, AttachmentList[i].FileName
								.split('.')[AttachmentList[i].FileName.split('.').length - 1]);
						}
						async_function();
					}
				}
			}
			var msgText = "";
			var oAction = this.oDefaultModel.DetailHeader.Action;
			if (oAction === "CREATE") {
				msgText = "Successfully created ";
			} else if (oAction === "RESUBMIT") {
				msgText = "Successfully submitted for approval ";
			} else if (oAction === "DRAFT") {
				msgText = "Successfully saved ";
			}
			if (that.errorAttachment === 0 && that.successAttachment === 0) {
				MessageBox.success(msgText + this.oDefaultModel.DetailHeader.RequestNumber, {
					actions: [MessageBox.Action.OK, ],
					emphasizedAction: MessageBox.Action.OK,
					onClose: function (sAction) {
						Busy.show();
						that.handleClose();
					}
				});
			} else {
				MessageBox.success(msgText + this.oDefaultModel.DetailHeader.RequestNumber +
					"\n Successful attachments = " + that.successAttachment + "\n Failed attachments = " + that.errorAttachment, {
						actions: [MessageBox.Action.OK, ],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (sAction) {
							Busy.show();
							that.handleClose();
							this.oDefaultModel
						}
					});
			}
			Busy.hide();
		},
		// Method to format the Request Number
		formatRequestNumer: function (sReqNum) {
			var sReqNumPrefix = "Request Number :";
			if (sReqNum === "0") {
				return sReqNumPrefix + " " + "<Yet to be assigned>";
			} else {
				return sReqNumPrefix + " " + sReqNum;
			}
		},
		// Event Handler method of event fileSizeExceeded of File Uploader
		onFileSizeExceed: function () {
			MessageToast.show(this.i18n.getText("maxFileSizeAllowedMsg"));
		},
		// Event Handler method of event typeMissmatch of File Uploader
		onTypeMissmatch: function () {
			MessageToast.show(this.i18n.getText("fileTypesMsg"));
		},

		// Event Handler method of event change of File Uploader
		onAttachmentChange: function (oEvent) {
			if (oEvent.getParameter("files")[0].size > 3145728) {
				MessageToast.show(this.i18n.getText("maxFileSizeAllowedMsg"));
				return;
			}

			if (this.oDefaultModel.DisplaySettings.editable === true && this.oDefaultModel.DetailHeader.Status !== "006" && this.oDefaultModel.DetailHeader
				.Status !== "010") {
				var oAttachment = {
					GUID: new Date().toString(),
					URL: "",
					FileName: oEvent.getParameter("files")[0].name,
					MIMEType: "",
					Data: oEvent.getParameter("files")[0]
				};
				// Restricting multiple attachments with same file name 
				if (!this.checkDuplicateAttachments(oEvent.getParameter("files")[0].name)) {
					this.oDefaultModel.AttachmentList.push(oAttachment);
					this.oDefaultModel.Attachment.AttachmentUploadCounter = this.oDefaultModel.Attachment.AttachmentUploadCounter - 1;
					this._refreshModel();
				} else {
					MessageBox.error(this.i18n.getText("mDuplicateAttachment", [oEvent.getParameter("files")[0].name]));
				}

			} else {
				// Restricting multiple attachments with same file name
				if (!this.checkDuplicateAttachments(oEvent.getParameter("files")[0].name)) {
					// Trigger Upload
					this.oDefaultModel.Attachment.AttachmentUploadCounter = this.oDefaultModel.Attachment.AttachmentUploadCounter - 1;
					this.uploadAttachmentsNonCreate(oEvent.getParameter("files")[0].name, oEvent.getParameter("files")[0]);
				} else {
					MessageBox.error(this.i18n.getText("mDuplicateAttachment", [oEvent.getParameter("files")[0].name]));
				}
			}

		},
		// Restricting multiple attachments with same file name
		checkDuplicateAttachments: function (sFileName) {
			var aAttachments = this.oDefaultModel.AttachmentList;
			var bAttachmentDuplicateFlag = false;
			for (var i = 0; i < aAttachments.length; i++) {
				if (aAttachments[i].FileName === sFileName) {
					bAttachmentDuplicateFlag = true;
					break;
				}
			}
			return bAttachmentDuplicateFlag;
		},
		// Method to handle the attachments upload
		uploadAttachmentsNonCreate: function (sFileName, oUploadedFile) {
			var aPromises = [],
				oAttachment = {
					"FileName": sFileName,
					"Data": oUploadedFile
				},
				sRequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			Busy.show();
			aPromises.push(this.uploadAttachments(oAttachment));
			Promise.all(aPromises).then(function () {
				Busy.hide();
				this.readAttachments(sRequestNumber);
				this.byId("AttachmentUploadCollection").clear();
				// this.readAuditData();
			}.bind(this), function () {
				Busy.hide();
				MessageToast.show("Attachment upload failed.");
				this.byId("AttachmentUploadCollection").clear();
			}.bind(this));
		},

		// Method to handle the attachments upload post Create
		uploadAttachmentsPostCreate: function () {
			var aAttachments = this.oDefaultModel.AttachmentList,
				aPromises = [];

			this.oDefaultModel.Attachment.ErrorAttachments = 0;
			this.oDefaultModel.Attachment.SuccessAttachments = 0;
			aAttachments.forEach(function (oAttachment) {
				if (!oAttachment.URL) {
					Busy.show();
					aPromises.push(this.uploadAttachments(oAttachment));
				}
			}.bind(this));

			var sDisplayMsg = "";
			// Message for respective actions
			if (this.oDefaultModel.DetailHeader.Action === "Create") {
				sDisplayMsg = this.i18n.getText("mCreate");
			} else if (this.oDefaultModel.DetailHeader.Action === "Submit") {
				sDisplayMsg = this.i18n.getText("mSubmit");
			} else if (this.oDefaultModel.DetailHeader.Action === "Draft") {
				sDisplayMsg = this.i18n.getText("mDraft");
			}

			Promise.all(aPromises).then(function () {
				this.byId("AttachmentUploadCollection").clear();
				if (this.oDefaultModel.Attachment.SuccessAttachments === 0 && this.oDefaultModel.Attachment.ErrorAttachments === 0) {
					MessageBox.success(sDisplayMsg + this.oDefaultModel.DetailHeader.RequestNumber, {
						actions: [MessageBox.Action.OK],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (sAction) {
							Busy.hide();
							this.handleClose();
						}.bind(this)
					});
				} else {
					MessageBox.success(sDisplayMsg + this.oDefaultModel.DetailHeader.RequestNumber +
						"\n Successful attachments = " + this.oDefaultModel.Attachment.SuccessAttachments + "\n Failed attachments = " +
						this.oDefaultModel.Attachment.ErrorAttachments, {
							actions: [MessageBox.Action.OK],
							emphasizedAction: MessageBox.Action.OK,
							onClose: function (sAction) {
								Busy.hide();
								this.handleClose();
							}.bind(this)
						});
				}
			}.bind(this), function () {
				this.byId("AttachmentUploadCollection").clear();
				Busy.hide();
			}.bind(this));
		},

		// Method to perform the Attachments upload
		uploadAttachments: function (oAttachment) {
			return new Promise(function (resolve, reject) {
				// return new Promise(function (resolve) {
				var oCustomerHeaderTokenfetch = new sap.m.UploadCollectionParameter({
						name: "x-csrf-token",
						value: this.oModel.getSecurityToken()
					}),
					sFileNameWithType = oAttachment.FileName,
					sFileType = sFileNameWithType.substr(sFileNameWithType.lastIndexOf(".") + 1),
					sFileName = sFileNameWithType.substr(0, sFileNameWithType.lastIndexOf(".")),
					sRequestNumber = this.oDefaultModel.DetailHeader.RequestNumber,
					sSlug = sRequestNumber + "|" + sFileName + "|" + sFileType;
				var header = {
					"x-csrf-token": oCustomerHeaderTokenfetch.getValue(),
					"slug": sSlug
				};
				jQuery.ajax({
					type: "POST",
					url: "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV/AttachmentSet",
					headers: header,
					cache: false,
					contentType: false,
					processData: false,
					data: oAttachment.Data,
					async: false,
					success: function (oEvent) {
						this.oDefaultModel.Attachment.SuccessAttachments = this.oDefaultModel.Attachment.SuccessAttachments + 1;
						resolve();
					}.bind(this),
					error: function (err) {
						this.oDefaultModel.Attachment.ErrorAttachments = this.oDefaultModel.Attachment.ErrorAttachments + 1;
						//		reject();
						resolve();
					}.bind(this)
				});
			}.bind(this));
		},
		// Method to read the attachments for the request number
		readAttachments: function (sRequestNumber) {

			var aFilters = [],
				oFilter = new sap.ui.model.Filter("RequestNumber", "EQ", sRequestNumber),
				aAttachments = [],
				sURL;
			var sPath;
			var RequestNumber = sRequestNumber;
			Busy.show();
			aFilters.push(oFilter);
			// Attachment Entity Set to return attachment details
			this.oModel.read("/AttachmentSet", {
				filters: aFilters,
				success: function (oData) {
					this.oDefaultModel.AttachmentList = oData.results;
					this.oDefaultModel.Attachment.AttachmentUploadCounter = 10 - this.oDefaultModel.AttachmentList.length;

					this.oDefaultModel.AttachmentList.forEach(function (oAttachment) {
						// To get the path
						var sPath = this.oModel.createKey("/AttachmentSet", {
							RequestNumber: oAttachment.RequestNumber,
							GUID: oAttachment.GUID,
							Referencefiletype: oAttachment.MIMEType,
							FileName: oAttachment.FileName
						});
						oAttachment.URL = "/sap/opu/odata/sap/ZOD_PU_IMACIPO_DS_SRV" + sPath + "/$value";
					}.bind(this));
					this._refreshModel();
					Busy.hide();
					this._readLog(RequestNumber);
				}.bind(this),
				error: function (oError) {
					if (oError.responseText) {
						var sErrorText = JSON.parse(oError.responseText).error.message.value;
						MessageBox.error(sErrorText);
					}
					Busy.hide();
				}.bind(this)
			});
		},
		// Event Handler method of event fileDeleted of Upload Collection
		onFileDeleted: function (oEvent) {
			var oDeleteItemSelected = oEvent.getParameter("documentId"),
				sRequestNum = this.oDefaultModel.DetailHeader.RequestNumber,
				oAttachmentObject = {};
			if (sRequestNum !== "") {
				this.oDefaultModel.AttachmentList.forEach(function (oAttachmentItem) {
					if (oAttachmentItem.GUID === oDeleteItemSelected) {
						oAttachmentObject = oAttachmentItem;
						return;
					}
				});
				if (oAttachmentObject.URL !== "") {
					var sPath = this.oModel.createKey("/AttachmentSet", {
						RequestNumber: oAttachmentObject.RequestNumber,
						GUID: oAttachmentObject.GUID,
						Referencefiletype: oAttachmentObject.MIMEType,
						FileName: oAttachmentObject.FileName
					});
					Busy.show();
					this.oModel.remove(sPath, {
						success: function (data) {
							this.readAttachments(sRequestNum);
							// this.readAuditData();
							Busy.hide();
						}.bind(this),
						error: function (oError) {
							if (oError.responseText) {
								var sErrorText = JSON.parse(oError.responseText).error.message.value;
								MessageBox.error(sErrorText);
							}
							Busy.hide();;
						}.bind(this)
					});
				} else {
					this.oDefaultModel.AttachmentList.forEach(function (oAttachmentItem, iIndex, object) {
						if (oAttachmentItem.GUID === oDeleteItemSelected) {
							this.oDefaultModel.AttachmentList.splice(iIndex, 1);
							this.oDefaultModel.Attachment.AttachmentUploadCounter = this.oDefaultModel.Attachment.AttachmentUploadCounter + 1;
							return;
						}
					}.bind(this));

				}
			} else {
				this.oDefaultModel.AttachmentList.forEach(function (oAttachmentItem, iIndex, object) {
					if (oAttachmentItem.GUID === oDeleteItemSelected) {
						this.oDefaultModel.AttachmentList.splice(iIndex, 1);
						this.oDefaultModel.Attachment.AttachmentUploadCounter = this.oDefaultModel.Attachment.AttachmentUploadCounter + 1;
						return;
					}
				}.bind(this));
			}
			this._refreshModel();
		},
		_DisplayButtonSettings: function (ActionType) {
			var UserDetails = this.getOwnerComponent().getModel("UserDetailsModel").getData();
			var Status = this.oDefaultModel.DetailHeader.Status;
			this.oDefaultModel.DisplaySettings.ApproveButton = false;
			this.oDefaultModel.DisplaySettings.CreateButton = false;
			this.oDefaultModel.DisplaySettings.DraftButton = false;
			this.oDefaultModel.DisplaySettings.RejectButton = false;
			this.oDefaultModel.DisplaySettings.SubmitButton = false;
			this.oDefaultModel.DisplaySettings.WithdrawButton = false;
			this.oDefaultModel.DisplaySettings.Z03Button = false;
			this.oDefaultModel.DisplaySettings._411KButton = false;
			this.oDefaultModel.DisplaySettings.DNButton = false;
			this.oDefaultModel.DisplaySettings._643Button = false;
			this.oDefaultModel.DisplaySettings.SaveButton = false;
			this.oDefaultModel.DisplaySettings.PrintCIButton = false;
			this.oDefaultModel.DisplaySettings.PrintCIButton = false;
			this.oDefaultModel.DisplaySettings.SellerVisible = true;
			this.oDefaultModel.DisplaySettings.WithdrawLAButton = false;
			this.oDefaultModel.DisplaySettings.CloseButton = false;
			this.oDefaultModel.DisplaySettings.AttachmentDeleteButton = false;
			this.oDefaultModel.DisplaySettings.Reopen = false;
			this.oDefaultModel.DisplaySettings.CloseReopenButton = false;
			this.setRowActionTemplate(false);
			this.oDefaultModel.DisplaySettings.editable = false;
			if (ActionType === "NewRequest") {
				if (UserDetails.Buyer === true) {
					this.oDefaultModel.DisplaySettings.editable = true;
					this.oDefaultModel.DisplaySettings.CreateButton = true;
					this.oDefaultModel.DisplaySettings.DraftButton = true;
					this.oDefaultModel.DisplaySettings.SellerVisible = false;
					this.oDefaultModel.DisplaySettings.AttachmentDeleteButton = true;
					this.setRowActionTemplate(true);
				}
			} else if (ActionType === "ExistingRequest") {
				if ((Status === "002" || Status === "007") && UserDetails.Buyer === true) {
					this.oDefaultModel.DisplaySettings.editable = true;
					this.setRowActionTemplate(true);
					this.oDefaultModel.DisplaySettings.DraftButton = true;
					this.oDefaultModel.DisplaySettings.SubmitButton = true;
					this.oDefaultModel.DisplaySettings.WithdrawButton = true;
					this.oDefaultModel.DisplaySettings.AttachmentDeleteButton = true;
					this.onFreightPayableByChange("InitalLoad");
					this._getCarrier();
				} else if (Status === "003" && (UserDetails.LogisticsAnalyst === true || UserDetails.SME === true)) {
					if (this._checkWorkIemNoExists() === true) {
						this.oDefaultModel.DisplaySettings.ApproveButton = true;
						this.oDefaultModel.DisplaySettings.RejectButton = true;
					}
				} else if (Status === "004" && (UserDetails.PuMgr === true || UserDetails.PuLogLeader === true || UserDetails.SME === true)) {
					if (this._checkWorkIemNoExists() === true) {
						this.oDefaultModel.DisplaySettings.ApproveButton = true;
						this.oDefaultModel.DisplaySettings.RejectButton = true;
					}
				} else if (Status === "005" && (UserDetails.LogisticsMgr === true || UserDetails.PuLogLeader === true || UserDetails.SME === true)) {
					if (this._checkWorkIemNoExists() === true) {
						this.oDefaultModel.DisplaySettings.ApproveButton = true;
						this.oDefaultModel.DisplaySettings.RejectButton = true;
					}
				} else if (Status === "006" && (UserDetails.LogisticsAnalyst === true || UserDetails.SME === true)) {
					if (this._checkWorkIemNoExists() === true) {
						this.oDefaultModel.DisplaySettings.editable = true;
						this.oDefaultModel.DisplaySettings.Z03Button = true;
						this.oDefaultModel.DisplaySettings._411KButton = true;
						this.oDefaultModel.DisplaySettings.DNButton = true;
						this.oDefaultModel.DisplaySettings._643Button = true;
						this.oDefaultModel.DisplaySettings.SaveButton = true;
						this.oDefaultModel.DisplaySettings.PrintCIButton = true;
						this.oDefaultModel.DisplaySettings.WithdrawLAButton = true;
						this.oDefaultModel.DisplaySettings.CloseButton = true;
						this.setRowActionTemplate(true);
						this._getCarrier();
					}
				} else if (Status === "008" && (UserDetails.LogisticsAnalyst === true || UserDetails.SME === true)) {
					this.oDefaultModel.DisplaySettings.Reopen = true;
				} else if (Status === "010" && (UserDetails.LogisticsAnalyst === true || UserDetails.SME === true)) {
					this.oDefaultModel.DisplaySettings.editable = true;
					this.oDefaultModel.DisplaySettings.SaveButton = true;
					this.oDefaultModel.DisplaySettings.PrintCIButton = true;
					this.oDefaultModel.DisplaySettings.CloseReopenButton = true;
					this.oDefaultModel.DisplaySettings.AttachmentDeleteButton = true;
					this.setRowActionTemplate(true);
					this._getCarrier();
				}
				if (Status === "003" || Status === "004" || Status === "005" || Status === "006") {
					if (this._DisplayAttachmentSettings() === true) {
						this.oDefaultModel.DisplaySettings.AttachmentDeleteButton = true;
					}
				}
			}

			this._refreshModel();
		},
		_DisplayAttachmentSettings: function (ActionType) {
			var RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			var myInboxRecords = this.getOwnerComponent().getModel("MyInboxRequestModel").oData.MyInboxSet;
			var QueueOwner = myInboxRecords.filter(function (value) {
				return value.RequestNumber === RequestNumber;
			}).map(function (value) {
				return value.QueueOwner;
			})[0];
			return QueueOwner;
		},
		_handleWorkflowService: function (that) {
			Busy.show();
			var RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			var myInboxRecords = this.getOwnerComponent().getModel("MyInboxRequestModel").oData.MyInboxSet;
			var WorkItemId = myInboxRecords.filter(function (value) {
				return value.RequestNumber === RequestNumber;
			}).map(function (value) {
				return value.WorkitemId;
			})[0];

			// that._oComponent.getModel("defaultValueModel").getData().WorkItemId = WorkItemId;
			var decisionKey;
			switch (this.oDefaultModel.DetailHeader.Action) {
			case 'Approve':
				decisionKey = '0001';
				break;
			case 'Reject':
				decisionKey = '0002';
				break;
			case 'WithdrawLA':
				decisionKey = '0004';
				break;
			case 'Close':
				decisionKey = '0005';
				break;
			}

			this.getOwnerComponent().getModel('WorkflowSrv').callFunction("/ApplyDecision", {
				method: "POST",
				urlParameters: {
					workitem_id: WorkItemId,
					dec_key: decisionKey,
					comments: this.oDefaultModel.DetailHeader.Remarks
				},
				success: function (data) {
					this.handleClose();
					Busy.hide();
				}.bind(this),
				error: function (error) {
					Busy.hide();
					var errorText = JSON.parse(error.responseText);
					errorText = errorText.error.message.value;
					MessageToast.show(errorText);
				}
			});

		},
		onPrintCIButtonPress: function (oEvent) {
			Busy.show();
			var oEntry = {};
			oEntry.RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			this.oModel.create("/PrintCISet", oEntry, {
				success: function (data) {
					Busy.hide();
					this.readAttachments(oEntry.RequestNumber);
					this._readLog(oEntry.RequestNumber);
					MessageToast.show(data.Message);

				}.bind(this),
				error: function (error) {
					Busy.hide();
					var errorText = JSON.parse(error.responseText);
					errorText = errorText.error.message.value;
					MessageToast.show(errorText);
				}
			});

		},
		handleMessageFilterChange: function (oEvent) {
			var sFilterOption = oEvent.getParameter("value"),
				sFilterValue = sFilterOption,
				oFilter, aFilter = [];
			if (sFilterOption) {
				// Set filters based on the Success or Error
				oFilter = new sap.ui.model.Filter("ValidationState", sap.ui.model.FilterOperator.EQ, sFilterValue);
				this.byId("DropShipItemsTable").getBinding().filter(oFilter);
			} else {

				// Reset the filter
				this.byId("DropShipItemsTable").getBinding().filter(aFilter);
			}
			this.byId("DropShipItemsTable").getColumns().forEach(function (oColumn) {
				if (oColumn.getFiltered()) {
					oColumn.setFiltered(false);
					oColumn.setFilterValue(null);
				}

			});
		},
		_clearMessageFilterDropDown: function (oEvent) {
			if (this.oDefaultModel.DetailItems.length === 0) {
				this.byId("MessageFilterDropDown").setSelectedKey("");
				var aFilter = [];
				this.byId("DropShipItemsTable").getBinding().filter(aFilter);
				this.byId("DropShipItemsTable").getColumns().forEach(function (oColumn) {
					if (oColumn.getFiltered()) {
						oColumn.setFiltered(false);
						oColumn.setFilterValue(null);
					}
				});
			}

		},
		_readShipToCodeIncoterm: function (oEvent) {
			var ShipToCode = this.oDefaultModel.DetailHeader.ShipToCode;
			if (ShipToCode !== "") {
				var sPath = this.oModel.createKey("/ZPU_DS_IMACIPO_SHIP_F4", {
					Title: ShipToCode
				});
				this.oModel.read(sPath, {
					success: function (data) {
						this.oDefaultModel.AdditionalFields.ShipToCodeIncoterm = data.IncotermValue;
						this._refreshModel();
						this._getFinalIncoterms();
						Busy.hide();
					}.bind(this),
					error: function (oError) {
						if (oError.responseText) {
							var sErrorText = JSON.parse(oError.responseText).error.message.value;
							MessageBox.error(sErrorText);
						}
						Busy.hide();;
					}.bind(this)
				});
			}
		},
		_checkWorkIemNoExists: function (oEvent) {
			var RequestNumber = this.oDefaultModel.DetailHeader.RequestNumber;
			var myInboxRecords = this.getOwnerComponent().getModel("MyInboxRequestModel").oData.MyInboxSet;
			var WorkItemId = myInboxRecords.filter(function (value) {
				return value.RequestNumber === RequestNumber;
			}).map(function (value) {
				return value.WorkitemId;
			})[0];
			if (WorkItemId !== undefined && WorkItemId !== "") {
				return true;
			} else {
				return false;
			}
		},
		_containsOnlyNumbers: function (str) {
			return /^\d+$/.test(str);
		},
		// Generate UUID
		_generateUUID: function (str) {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r = Math.random() * 16 | 0,
					v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		}
	});

});