// Copyright (c) 2025, PRASTARA DECORATION DESIGN L.L.C and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Project Profit And Loss Report"] = {
	"filters": [
		{
			"fieldname":"project",
			"label":__("Project"),
			"fieldtype":"Link",
			"options":"Project",
			// "reqd": 1
		},

		{
			"fieldname":"branch",
			"label":__("Branch"),
			"fieldtype":"Link",
			"options":"Branch",
		},
		{
			"fieldname":"company",
			"label":__("Company"),
			"fieldtype":"Link",
			"options":"Company",
		},
		{
			"fieldname":"customer",
			"label":__("Customer"),
			"fieldtype":"Link",
			"options":"Customer",
		},
		{
			"fieldname":"from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			"reqd": 1
		},
		{
			"fieldname":"to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		},

	],
}