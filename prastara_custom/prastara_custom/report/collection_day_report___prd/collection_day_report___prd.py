# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from datetime import date
from datetime import timedelta,datetime

def execute(filters=None):
	data = []
	columns = []
	list1 = []
	
	if filters.get("branch") and  filters.get("from_date"):
		documents = frappe.db.sql("""SELECT si.branch,sp.mode_of_payment,sp.amount FROM `tabSales Invoice` si INNER JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent WHERE  si.posting_date = %s  and si.docstatus=1 and si.branch = %s """,(filters.get("from_date"),filters.get("branch")),as_dict = True)
		document = frappe.db.sql("""SELECT py.name,py.posting_date,py.pos_profile,py.mode_of_payment,py.paid_amount,po.branch FROM `tabPayment Entry` py INNER JOIN `tabPOS Profile` po ON py.pos_profile = po.name WHERE  py.posting_date = %s  and py.payment_type="Receive" and py.docstatus = 1 and po.branch = %s """,(filters.get("from_date"),filters.get("branch")),as_dict = True)
	else:
		documents = frappe.db.sql("""SELECT si.branch,sp.mode_of_payment,sp.amount FROM `tabSales Invoice` si INNER JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent WHERE  si.posting_date = %s and si.docstatus=1 """,(filters.get("from_date")),as_dict = True)
		document = frappe.db.sql("""SELECT py.name,py.posting_date,py.pos_profile,py.mode_of_payment,py.paid_amount,po.branch FROM `tabPayment Entry` py INNER JOIN `tabPOS Profile` po ON py.pos_profile = po.name WHERE  py.posting_date = %s and py.payment_type="Receive" and py.docstatus = 1 """,(filters.get("from_date")),as_dict = True)
	
	today = date.today()
	creation_doc  = (frappe.db.get_list('Payment Entry', filters={'posting_date':filters.get("from_date")},fields = "*"))
	
	if len(documents or document or creation_doc)!= 0:
		for i in range(len(documents)):
			if documents[i].branch not in list1:
				list1.append(documents[i].branch)
		for j in range(len(document)):
			if document[j].branch not in list1:
				list1.append(document[j].branch)
		for m  in range(len(creation_doc)):
			if filters.get("branch"):
				doc = frappe.db.get_value("POS Profile",{"name":creation_doc[m].pos_profile,"branch":filters.get("branch")},"branch")
			else:
				doc = frappe.db.get_value("POS Profile",{"name":creation_doc[m].pos_profile,},"branch")
			if doc not in list1:
				list1.append(doc) 
		
		for k in list1:
			cash = card = wired_transfer = credit = cheque = pdc =  0
			dict = {}
			for i in range(len(documents)):
				if k == documents[i].branch:
					
					if ("Cash" in documents[i].mode_of_payment):
						cash += documents[i].amount
					elif ("Card" in documents[i].mode_of_payment):
						card += documents[i].amount
					elif ("Cheque" in documents[i].mode_of_payment):
						cheque += documents[i].amount
					elif ("Credit" in documents[i].mode_of_payment):
						credit += documents[i].amount
					elif ("Wire Transfer" in documents[i].mode_of_payment):
							wired_transfer += documents[i].paid_amount

					
			for j in range(len(document)):
				if k == document[j].branch:
					if document[j].pos_profile:
						if (document[j].mode_of_payment):
							if ("Cash" in document[j].mode_of_payment):
								cash += document[j].paid_amount
							elif ("Card" in document[j].mode_of_payment):
								card += document[j].paid_amount
							elif ("Credit" in document[j].mode_of_payment):
								credit += document[j].paid_amount
							elif ("Wire Transfer" in document[j].mode_of_payment):
								wired_transfer += document[j].paid_amount

			for m in range(len(creation_doc)):
				doc = frappe.db.get_value("POS Profile",{"name":creation_doc[m].pos_profile,},"branch")
				if k == doc:
					if creation_doc[m].pos_profile:
						if (creation_doc[m].mode_of_payment):
							if ("Cheque" in creation_doc[m].mode_of_payment):
								
								if creation_doc[m].posting_date > (creation_doc[m].creation).date():
									if creation_doc[m].posting_date > today:
										pdc += creation_doc[m].paid_amount									
									else:
										cheque += creation_doc[m].paid_amount
								else:
									cheque += creation_doc[m].paid_amount
				
										
			if k:
				dict['branch'] = k
				dict['cash'] = cash	
				dict['card'] = card	
				dict['pdc'] = pdc	
				dict['cheque'] = cheque		
				dict['credit'] = credit		
				dict['wired_transfer'] = wired_transfer
				dict['total'] = cash + 	card +	pdc + cheque + credit + wired_transfer
				data.append(dict)
	
	
	columns =  [
		{
			'fieldname': 'branch',
			'label': _('Branch'),
			'fieldtype': 'Link',
			'options':'Branch',
			'width':158
		},
		{
			'fieldname': 'cash',
			'label': _('Cash'),
			'fieldtype': 'Float',
			'width':148			
		},

		{
			'fieldname': 'card',
			'label': _('Card'),
			'fieldtype': 'Float',
			'width':148
		},
		{
			'fieldname': 'cheque',
			'label': _('Cheque'),
			'fieldtype': 'Float',
			'width':150
			
		},
		{
			'fieldname': 'pdc',
			'label': _('PDC'),
			'fieldtype': 'Float',
			'width':150
			
		},
		{
			'fieldname': 'wired_transfer',
			'label': _('Wired Transfer'),
			'fieldtype': 'Float',
			'width':150
		},
		{
			'fieldname': 'credit',
			'label': _('Credit'),
			'fieldtype': 'Float',
			'width':150
		},
		{
			'fieldname': 'total',
			'label': _('Total'),
			'fieldtype': 'Float',
			'width':150
		},


   ]
	return columns, data

