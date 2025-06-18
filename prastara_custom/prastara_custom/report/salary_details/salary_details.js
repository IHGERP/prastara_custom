// Copyright (c) 2025, PRASTARA DECORATION DESIGN L.L.C and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Salary Details"] = {
	"filters": [
		{
			"fieldname":"employee",
			"label":__("Employe"),
			"fieldtype":"Link",
			"options":"Employee",
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
	],
};
