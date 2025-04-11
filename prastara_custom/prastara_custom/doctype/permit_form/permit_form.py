# Copyright (c) 2025, PRASTARA DECORATION DESIGN L.L.C and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class PermitForm(Document):
	pass



@frappe.whitelist()
def production_payment_entry(name):
	prd = frappe.new_doc("Payment Entry")
	prd.custom_permit = name 
	prd.payment_type = "Pay" 
	prd.party_type = "Customer"
	# prd.insert()
	return prd
