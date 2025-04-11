// Copyright (c) 2025, PRASTARA DECORATION DESIGN L.L.C and contributors
// For license information, please see license.txt

frappe.ui.form.on('Leave Salary Request Form', {
	// Copyright (c) 2024, ParaLogic and contributors
// For license information, please see license.txt

	make_dashboard: function(frm) {
		var leave_details;
		let lwps;
		if (frm.doc.employee) {
			frappe.call({
				method: "hrms.hr.doctype.leave_application.leave_application.get_leave_details",
				async: false,
				args: {
					employee: frm.doc.employee,
					date: frm.doc.from_date || frm.doc.custom_posting_date
				},
				callback: function(r) {
					if (!r.exc && r.message['leave_allocation']) {
						leave_details = r.message['leave_allocation'];
					}
					
					
				}
			});
			$("div").remove(".form-dashboard-section.custom");
			frm.dashboard.add_section(
				frappe.render_template('leave_salary_request_dashboard', {
					data: leave_details
				}),
				__("Allocated Leaves")
			);
			frm.dashboard.show();
		
		}
	},

    employee: function(frm) {
		frm.trigger("make_dashboard");
		
	},
});
