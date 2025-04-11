// Copyright (c) 2025, PRASTARA DECORATION DESIGN L.L.C and contributors
// For license information, please see license.txt

frappe.ui.form.on('Permit Form', {
		refresh: function(frm) {
			
			if(frm.doc.workflow_state == "Pending CD Approval"){
				let options = ['amount','expiry_date']
	
			options.forEach(function(field) {
				frappe.meta.get_docfield("Permit Selection", field, frm.doc.name).read_only = 0;
			});
		}
		else{
			let options = ['amount','expiry_date']
			options.forEach(function(field) {
				frappe.meta.get_docfield("Permit Selection", field, frm.doc.name).read_only = 1;
			});
		}
	
		if(frm.doc.workflow_state == "Pending For Payment Approval" && frm.doc.paid_by == "Company"){
			frm.add_custom_button(__("Payment Entry Creation"), function() {
						frappe.call({
							args: {
								"name": frm.doc.name,
							},
							method: "prastara_custom.prastara_custom.doctype.permit.permit.production_payment_entry",
							callback: function(r) {
								var doclist = frappe.model.sync(r.message);
								frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
							}
						});
							
						}, __('Create'));
		}
	},
	sales_order: function(frm) {
		if (frm.doc.sales_order) {
			frm.set_query("item", "items",function() {
				return {
					query: "prastara_custom.controller.variant_pricing.get_sales_order_item",  
					filters: {
						parent: frm.doc.sales_order  
					}
				};
			});
		}
	},
	});
	
	frappe.ui.form.on('Permit Items', {
		item: function(frm, cdt, cdn) {
			var row = locals[cdt][cdn];
			if (row.item && frm.doc.sales_order) {
				frappe.call({
					method: "prastara_custom.controller.variant_pricing.get_rate",
					args: {
						
							parent: frm.doc.sales_order,
							item_code: row.item
					   
					},
					callback: function(r) {
						if (r.message) {
							console.log("fhfkjhe")
							console.log(r.message[0]['amount'])
							frappe.model.set_value('Permit Items',row.name,'rate', r.message[0]['rate']);
							frappe.model.set_value('Permit Items',row.name,'amount', r.message[0]['amount']);
							frappe.model.set_value('Permit Items',row.name,'qty', r.message[0]['qty']);
							frm.refresh_field('rate');
							frm.refresh_field('amount');
							frm.refresh_field('qty');
						} 
					}
				});
			} 
		}
	});
	