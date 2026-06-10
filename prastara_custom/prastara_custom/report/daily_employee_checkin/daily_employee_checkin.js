// Copyright (c) 2026, PRASTARA DECORATION DESIGN L.L.C and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Daily Employee Checkin"] = {
	"filters": [
        {
			"fieldname":"checkin_date",
			"label": __("Check In Date"),
			"fieldtype": "Date",
			"reqd": 1,
			"default": date.get_today() - 1
		}

	]
};
