/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"DropShipment/Z_PU_IMACIPO_DS/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});