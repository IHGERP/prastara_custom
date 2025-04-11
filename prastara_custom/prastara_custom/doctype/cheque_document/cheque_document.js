// Copyright (c) 2023, ParaLogic and contributors
// For license information, please see license.txt

frappe.ui.form.on('Cheque Document', {
	// refresh: function(frm) {

	// }
	party:function(frm){
		frm.fields_dict["payment_entry"].get_query = function (doc) {
			return {
				
				filters: {
					"party": doc.party,
				},
			};
		};
	}
});
