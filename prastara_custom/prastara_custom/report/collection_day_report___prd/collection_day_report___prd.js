// Copyright (c) 2026, PRASTARA DECORATION DESIGN L.L.C and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Collection Day Report - PRD"] = {
	"filters": [
		{
			"fieldname":"branch",
			"label":__("Branch"),
			"fieldtype":"Link",
			"options":"Branch",
		},
		{
			"fieldname":"from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(),),
			"reqd": 1
		},
		
	],
};

