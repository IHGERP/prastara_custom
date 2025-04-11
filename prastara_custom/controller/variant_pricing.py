# -*- coding: utf-8 -*-

from __future__ import unicode_literals
import frappe
import json
from frappe.model.mapper import get_mapped_doc
from frappe import _
from frappe.utils import flt, getdate,get_url, today, get_date_str, get_time, nowdate, get_first_day, get_last_day, add_months, get_link_to_form,date_diff
from datetime import datetime, timedelta,date
from erpnext.setup.doctype.holiday_list.holiday_list import is_holiday
from hrms.hr.utils import get_holiday_dates_for_employee


#Add employed days
def add_employed_days(salary_slip, method):
	salary_slip.total_employed_days = date_diff(salary_slip.end_date, salary_slip.joining_date)




#Stock Reconciliation
def mrp_values(stock_reconciliation, method):
	for d in stock_reconciliation.items:
		d.mrp_rate = frappe.get_value("Item Price", {"item_code":d.item_code, "price_list": "MRP"}, "price_list_rate")
		if d.mrp_rate:
			d.mrp_value = d.mrp_rate * d.current_qty
		d.qty_diff = float(d.qty) - abs(d.current_qty)

#Quotation holding with button

@frappe.whitelist()
def unhold_or_hold_quotation(docname):
    quotation = frappe.get_doc('Quotation', docname)
    
    # Check if the current status is 'Hold', if so, set it to the previous status
    if quotation.status == 'Hold':
        quotation.status = 'Open'
    else:
        # Save the current status before changing to 'Hold'
        quotation.prev_status = quotation.status
        quotation.status = 'Hold'
    
    quotation.save()
    frappe.msgprint(f"Quotation {quotation.name} status changed to {quotation.status}")
    return True



@frappe.whitelist()
def get_salary_details(data):
	
	ss = frappe.get_doc("Salary Structure",data)
	total = 0
	if ss.earnings:
		for i in ss.earnings:
			total += i.amount
		
		# frappe.errprint(total)
		return[total,ss.earnings]




@frappe.whitelist()
def get_salary_component_totals(salary_structure):
    query = """
        SELECT 
            SUM(sd.amount) AS total_amount
        FROM 
            `tabSalary Detail` sd
        JOIN 
            `tabSalary Structure` ss
        ON 
            sd.parent = ss.name
        WHERE 
            ss.name = %(salary_structure)s
            AND (
                sd.salary_component LIKE '%%Basic Salary%%' 
                OR sd.salary_component LIKE '%%House Rent Allowance%%' 
                OR sd.salary_component LIKE '%%Sundry Allowance%%'
            )
    """
    return frappe.db.sql(query, {"salary_structure": salary_structure}, as_dict=True)






#Stock Reconciliation
def mr_total(material_request, method):
	material_request.cost_total = 0
	material_request.sales_total = 0
	for d in material_request.items:
		if d.amount:
			material_request.cost_total += d.amount
		if d.saleable_rate:
			d.saleable_amount = d.saleable_rate * d.qty
			material_request.sales_total += d.saleable_rate * d.qty



# scheduler from hooks for sending mail

def get_email_for_warehouse():
	doc = frappe.get_all("Stock Ledger Entry",filters={"posting_date": today(),'is_cancelled':0}, fields="*")
	# doc = frappe.get_all("Stock Ledger Entry",filters={'posting_date':['between', ['20-11-2023', '21-11-2023']],"warehouse": "LW - SZR - POS Warehouse - LDW"}, fields="*")
	if doc:
		warehouse = []
		list1 = []
		item1 = []
		for i in doc:
			if i.warehouse not in warehouse:
				warehouse.append(i.warehouse)

		for i in warehouse:
			for j in doc:
				dict1 = {}
				if i == j.warehouse:
					if j.item_code not in item1:
						item1.append(j.item_code)				
						dict1["item"] = j.item_code
						# dict1["item_name"] = frappe.db.get_value("Item",{"name":j.item_code},"item_name")
						dict1["in_qty"] =  max(j.actual_qty, 0)
						dict1["out_qty"] =  min(j.actual_qty, 0)
						dict1["balance_qty"] =  j.qty_after_transaction
						dict1["voucher_type"] =  j.voucher_type
						dict1["voucher_number"] =  j.voucher_no
						list1.append(dict1)

			if list1:
									
				message = (_(" Hi ,<br><p>This email to provide you with an update on the incoming and outgoing quantities for each warehouse for the day {0}.</p><br>Here are the details:<br>")
				.format((today())))
				
				message += "<table style='border-collapse: collapse;'>"
				message += "<tr><th style='border: 1px solid black; padding: 5px;'>Warehouse</th><th style='border: 1px solid black; padding: 5px;'>Item Code</th><th style='border: 1px solid black; padding: 5px;'>Incoming Quantity</th><th style='border: 1px solid black; padding: 5px;'>Outgoing Quantity</th><th style='border: 1px solid black; padding: 5px;'>Balance Qty</th><th style='border: 1px solid black; padding: 5px;'>Voucher Type</th><th style='border: 1px solid black; padding: 5px;'>Voucher Number</th></tr>"
				
				for item in list1:
					message += f"<tr><td style='border: 1px solid black; padding: 5px;'>{i}</td><td style='border: 1px solid black; padding: 5px;'>{item['item']}</td><td style='border: 1px solid black; padding: 5px;'>{item['in_qty']}</td><td style='border: 1px solid black; padding: 5px;'>{item['out_qty']}</td><td style='border: 1px solid black; padding: 5px;'>{item['balance_qty']}</td><td style='border: 1px solid black; padding: 5px;'>{item['voucher_type']}</td><td style='border: 1px solid black; padding: 5px;'>{item['voucher_number']}</td></tr>"
				message += "</table>"
				
				message += "<br>Please review the above information and ensure that the inventory records are accurate.<br> Thank You"

				recipient1=frappe.db.get_value("Warehouse",{"name":i},"custom_showroom_manager")
				recipient2= frappe.db.get_value("Warehouse",{"name":i},"custom_warehouse_incharge")
				frappe.errprint(recipient1)
				frappe.errprint(recipient2)
				if recipient1 or recipient2:
					frappe.sendmail(
						recipients=[recipient1,recipient2],
						subject=(_("Daily Inventory Update - {0}").format((today()),doc)),
						message = message,
						now = True
					)
					
			list1 = []


@frappe.whitelist()
def overdue_opportunity():
    opportunities = frappe.get_all(
        "Opportunity",
        filters={
            "custom_committed_date_for_share_quotation": ["<", today()],
            "status": ["in", ["Open", "Replied"]]
        },
        fields=["name"]
    )
    frappe.errprint(opportunities) 

    if opportunities:
        for opp in opportunities:
            frappe.db.set_value("Opportunity", opp.name, "status", "Overdue")
        
        frappe.db.commit()



#Intercompany SI
@frappe.whitelist()
def create_pi_frm_si(si_name):
	si = frappe.get_doc("Sales Invoice", si_name)
	pi = frappe.new_doc("Purchase Invoice")
	pi.posting_date = si.posting_date
	pi.company = si.customer
	pi.naming_series = "PI-INTER-.YY.-.####"
	pi.supplier = si.company
	pi.buying_price_list = "Inter Company"
	pi.update_stock = 1
	po = frappe.get_doc("Purchase Order", frappe.get_value("Sales Order", si.sales_order, "inter_company_order_reference"))
	for item in si.items:
		for p_item in po.items:
			if p_item.item_code == item.item_code:
				pi.append("items",{
							"item_code": item.item_code,
							"qty":item.qty,
							"rate":item.rate,
							"warehouse":p_item.warehouse,
							"cost_center":frappe.get_value("Warehouse", item.warehouse, "cost_center"),
							"project": item.project,
							"purchase_order": po.name,
							"po_detail": p_item.name,
							#"schedule_date": item.schedule_date
							"sales_invoice_item": item.name

						})
	pi.save(ignore_permission=True)		


#Sales Invoice Trade Cost And Margin 

@frappe.whitelist()
def get_data(data):
	list1 = []
	dic1 = {}
	manufa = 0
	doc = frappe.get_doc("Sales Invoice",data)
	if doc.docstatus == 0:
		for i in doc.items:
			manufa = promo_price = 0
			stock =  frappe.db.sql("""SELECT 
				st.name FROM `tabStock Entry` st
				JOIN `tabStock Entry Detail` sc ON st.name = sc.parent
				WHERE st.docstatus = 1 and st.stock_entry_type = "Manufacture"  and sc.item_code = %s and sc.is_finished_item = 1 Group By sc.item_code """,(i.item_code),as_dict = True)
			if stock:
				manufa = frappe.db.get_value("Stock Ledger Entry",{"item_code":i.item_code,"voucher_type":"Stock Entry","voucher_no":stock[0].name},'valuation_rate')
			
			brand = frappe.db.get_value("Item",{"item_code":i.item_code},'brand',as_dict=1)
			promo_price = frappe.db.get_value("Item Price",{"item_code":i.item_code,"price_list":"Promo"},"price_list_rate")
			if brand:
				brand_grp = frappe.db.get_value("Brand",{"name":brand["brand"]},'brand_group',as_dict=1)
			
			
			if promo_price:
				cost = promo_price - ((promo_price * 30)/100)
			elif manufa != 0:
				cost = manufa + ((manufa * 10)/100)
			elif brand_grp:
				if "Trade" in brand_grp["brand_group"]:
					trade_price = frappe.db.get_value("Item Price",{"item_code":i.item_code,"price_list":"Trade Price"},"price_list_rate")
					cost = trade_price if trade_price else 0.0
				else:
					landing_cost = frappe.db.get_value("Item Price",{"item_code":i.item_code,"price_list":"Landing Cost"},"price_list_rate")
					cost = landing_cost if landing_cost else 0.0
			else:
				landing_cost = landing_cost = frappe.db.get_value("Item Price",{"item_code":i.item_code,"price_list":"Landing Cost"},"price_list_rate")
				cost = landing_cost if landing_cost else 0.0
			
			total_cost = i.qty * cost
			trade_margin = i.amount - total_cost
			dic1[i.item_code] = trade_margin
			dic1[i.item_code + "trade_cost"] = cost
		list1.append(dic1)
		frappe.errprint(list1)
		return list1



@frappe.whitelist()
def so_po_grand_total(doctype,data,po):
	if doctype == "Sales Invoice":
		doc = frappe.get_doc("Sales Invoice",data)
		invoice = frappe.db.get_value("Sales Order",{"name":doc.sales_order},'grand_total')
		# for i in invoice:
		# 	if i['grand_total']:
		# 		su += i['grand_total']
		if(invoice != doc.grand_total):
			frappe.msgprint(
			_("Both the sales order and the sales invoice should have the same grand total value."),alert=True
		)
			return doc.grand_total
		grand_total = frappe.db.get_value("Purchase Order",{"name":po},'grand_total')
		if(grand_total != doc.grand_total):
			frappe.msgprint(
			_("The changes made to the amounts of the items affect the grand total of the Sales Invoice. Therefore, these changes should also impact the corresponding Purchase Order {0} to ensure that both remain consistent").format(get_link_to_form("Purchase Order", po)),alert=True
		)
			return grand_total
	if doctype == "Purchase Invoice":
		doc = frappe.get_doc("Purchase Invoice",data)
		if doc.items:
			if doc.items[0].purchase_order:
				so = frappe.db.get_value("Sales Order",{"inter_company_order_reference":doc.items[0].purchase_order},'status')
				if so:
					if so == "Completed" or so == "Closed" :
						grand_total = frappe.db.get_value("Purchase Order",{"name":doc.items[0].purchase_order},'grand_total')
						if(grand_total != doc.grand_total) and doc.is_return == 0:
							frappe.msgprint(
							_("The changes made to the amounts of the items affect the grand total of the Purchase Invoice. Therefore, these changes should also impact the corresponding Purchase Order {0} to ensure that both remain consistent").format(get_link_to_form("Purchase Order", doc.items[0].purchase_order)),alert=True
						)
							return grand_total
					else:
						frappe.msgprint(_("Should complete the Sales Invoice first"))
						return so


@frappe.whitelist()
def po_value(data):
	if data:
		
		total = 0
		doc =  frappe.get_doc("Project",data)
		po = frappe.db.get_all("Purchase Order Item",filters = {"project":doc.name,"docstatus":1}, fields= ['base_net_amount','parent'])
		for i in po:
			name = frappe.db.get_value("Purchase Order",{"name":i.parent,"status":["!=","Closed"],"docstatus":1},"name")
			if name:
				total += i.base_net_amount
		frappe.errprint(total)
		return total


@frappe.whitelist()
def pi_value(data):
	if data:
		
		total = 0
		doc =  frappe.get_doc("Project",data)
		po = frappe.db.get_all("Purchase Invoice Item",
                       filters={"project": doc.name, 
                                "docstatus": 1, 
                                }, 
                       fields=['base_net_amount','purchase_order'])
		frappe.errprint(po)
		for i in po:
			if i.purchase_order == None:
				frappe.errprint("po")
				frappe.errprint(po)
				total += i.base_net_amount
				
		frappe.errprint("total")
		
		return total




@frappe.whitelist()
def document_sharing(data):
	if data:
		doc =  frappe.get_doc("Meeting Minutes",data)
		for attendee in doc.attendees:
			frappe.share.add('Meeting Minutes', data, user=attendee.attendees, read=1, write=1)

		frappe.errprint('MOM document shared with attendees.')


@frappe.whitelist()
def doc_sharing(doctype,data):
	frappe.errprint("fddjsfjsfljfjlewkj")
	if doctype == "Material Request":
		doc =  frappe.get_doc("Material Request",data)
		if doc.account_incharge:
			frappe.share.add('Material Request', data, user=doc.account_incharge, read=1, write=1,share=1)
		frappe.errprint('MOM document shared with attendees.')
	if doctype == "Sales Order":
		doc =  frappe.get_doc("Sales Order",data)
		frappe.errprint(doc.sales_team[0].sales_person)
		emp = (frappe.db.get_value("Sales Person",{"name":doc.sales_team[0].sales_person},"employee"))
		if emp:
			user_id = (frappe.db.get_value("Employee",{"name":emp},"user_id"))
			if user_id:
				frappe.share.add('Sales Order', data, user= user_id, read=1, write=1,share=1)

		frappe.errprint('MOM document shared with attendees.')



@frappe.whitelist()
def quote_sharing(data):
	if data:
		doc =  frappe.get_doc("Quotation",data)
		frappe.share.add('Quotation', data, user=doc.account_incharge, read=1, write=1,submit=1)

		frappe.errprint('MOM document shared with attendees.')
		
# CREATION OF DELIVERY NOTE FROM THE SALES INVOICE

def create_delivery_note(sales_invoice,method,target_doc=None):
	frappe.errprint("Sales INvoice Call")
	frappe.errprint(sales_invoice)
	if sales_invoice.is_return == 0 and sales_invoice.custom_disable_automation == 0 and sales_invoice.is_internal_customer == 0 and sales_invoice.is_replacement_invoice == 0 and (sales_invoice.company in ["LED WORLD LLC" , "IHG BRANDS LIGHTING LLC"]):
		def set_missing_values(source, target):
			frappe.errprint("set missing value")
			frappe.errprint(target_doc)
			target.run_method("set_missing_values")
			target.run_method("set_po_nos")
			target.run_method("calculate_taxes_and_totals")

		def update_item(source_doc, target_doc, source_parent):
			frappe.errprint("update item")
			target_doc.qty = flt(source_doc.qty) - flt(source_doc.delivered_qty)
			frappe.errprint("update item 1")
			target_doc.stock_qty = target_doc.qty * flt(source_doc.conversion_factor)
			frappe.errprint("update item 2")

			target_doc.base_amount = target_doc.qty * flt(source_doc.base_rate)
			frappe.errprint("update item 3")
			target_doc.amount = target_doc.qty * flt(source_doc.rate)
			frappe.errprint("update item 4")

		doclist = get_mapped_doc(
			
			"Sales Invoice",
			sales_invoice,
			{
				"Sales Invoice": {"doctype": "Delivery Note", "validation": {"docstatus": ["=", 1]}},
				"Sales Invoice Item": {
					"doctype": "Delivery Note Item",
					"field_map": {
						"name": "si_detail",
						"parent": "against_sales_invoice",
						"serial_no": "serial_no",
						"sales_order": "against_sales_order",
						"so_detail": "so_detail",
						"cost_center": "cost_center",
					},
					"postprocess": update_item,
					"condition": lambda doc: doc.delivered_by_supplier != 1,
				},
				"Sales Taxes and Charges": {"doctype": "Sales Taxes and Charges", "add_if_empty": True},
				"Sales Team": {
					"doctype": "Sales Team",
					"field_map": {"incentives": "incentives"},
					"add_if_empty": True,
				},
			},
			target_doc,
			set_missing_values,
		)
		frappe.errprint("mapped doc")
		

		doclist.save()
		doclist.submit()
		frappe.errprint(doclist.items)



#Intercompany material request
@frappe.whitelist()
def create_mr_po_so(mr_name):
	# from erpnext.stock.get_item_details import get_item_details
	# get_item_details(item)
	mr = frappe.get_doc("Material Request", mr_name)
	#frappe.errprint(mr_name)
	po = frappe.new_doc("Purchase Order")
	po.company = mr.company
	po.naming_series = "PO-INTER-.YY.-.####"
	po.supplier = mr.sister_company
	po.transaction_date = mr.transaction_date
	po.buying_price_list = "Standard Buying"
	#po.branch = mr.branch
	so = frappe.new_doc("Sales Order")
	so.company = mr.sister_company
	so.customer = mr.company
	so.branch = mr.branch
	so.naming_series = "SO-INTER-.YY.-.####"
	so.transaction_date = mr.transaction_date
	so.order_type = "Sales"
	so.po_no = mr.name
	so.selling_price_list = "Standard Buying"
	so.min_selling_price = "Standard Buying"
	so.promo_price_list = "Promo"
	so.payment_terms_template = "100% cash on delivery"
	so.inter_company_order_reference = po.name

	so.append("sales_team",{
					"sales_person": "Intercompany Sales",
					"allocated_percentage":100,
				})
	for item in mr.items:
		po.append("items",{
					"item_code": item.item_code,
					"qty":item.qty,
					"rate":item.rate,
					"warehouse":item.warehouse,
					"cost_center":frappe.get_value("Warehouse", item.warehouse, "cost_center"),
					"project": item.project,
					"material_request": mr.name,
					"material_request_item": item.name,
					"schedule_date": item.schedule_date,
					"description": item.description

				})
		if item.sister_warehouse:
			so.append("items",{
						"item_code": item.item_code,
						"qty":item.qty,
						"rate":item.rate,
						"warehouse":item.sister_warehouse,
						"cost_center":frappe.get_value("Warehouse", item.warehouse, "cost_center"),
						#"project": item.project,
						#"material_request": mr.name,
						#"material_request_item": item.id,
						"delivery_date": item.schedule_date,
						"description": item.description

					})
		else:
			 so.append("items",{
						"item_code": item.item_code,
						"qty":item.qty,
						"rate":item.rate,
						"warehouse":frappe.get_value("Company", frappe.get_value("Company", mr.company, "central_purchasing"), "default_warehouse"),
						"cost_center":frappe.get_value("Warehouse", item.warehouse, "cost_center"),
						#"project": item.project,
						#"material_request": mr.name,
						#"material_request_item": item.id,
						"delivery_date": item.schedule_date

					})
	
	po.save()
	so.inter_company_order_reference = po.name		
	so.save()
	frappe.msgprint("Created - " + str(so.name))
	for file_cgv in frappe.get_all("File", fields=["name", "file_name", "file_url", "is_private"],
		filters={"attached_to_name": mr.name, "attached_to_doctype": 'Material Request'}):
		ret = frappe.get_doc({
			"doctype": "File",
			"attached_to_doctype": 'Sales Order',
			"attached_to_name": so.name,
			"attached_to_field": None,
			"folder": 'Home/Attachments',
			"file_name": file_cgv.file_name,
			"file_url": file_cgv.file_url,
			"is_private": file_cgv.is_private,
			"content": None
		})
		ret.save()


	return mr





# Intercompany Sales & Purchase Invoice creations
def create_intercompany_invoices(sales_order, method):
	suppliers = []
	for item in sales_order.items:
		if item.auto_transfer:
			if item.internal_company not in suppliers:
				suppliers.append(item.internal_company)
	for sup in suppliers:
		pi = frappe.new_doc("Purchase Invoice")
		pi.company = sales_order.company
		pi.posting_date = sales_order.transaction_date
		pi.supplier = sup
		pi.due_date = sales_order.transaction_date
		pi.naming_series = "ACC-PINV-.YYYY.-"
		pi.update_stock = 1
		si = frappe.new_doc("Sales Invoice")
		si.company = sup
		si.customer = sales_order.company
		si.posting_date = sales_order.transaction_date
		si.due_date = sales_order.transaction_date
		si.naming_series = "ACC-SINV-.YYYY.-"
		si.update_stock = 1
		for item in sales_order.items:
			if item.internal_company == sup:
				pi.append("items",{
					"item_code": item.item_code,
					"qty":item.qty,
					"rate":item.rate,
					"warehouse":item.warehouse,
					"cost_center":frappe.get_value("Warehouse", item.warehouse, "cost_center")

				})
				si.append("items",{
					"item_code": item.item_code,
					"qty":item.qty,
					"rate":item.rate,
					"warehouse":item.sister_company,
					"cost_center": frappe.get_value("Warehouse", item.sister_company, "cost_center")
				})
		pi.save()
		pi.submit()
		si.save()
		si.submit()
		


	





@frappe.whitelist()
def get_emp_wd_previous():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	holidays = get_holiday_dates_for_employee(emp, get_first_day(pre_date), get_last_day(pre_date))
	absent = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(pre_date), get_last_day(pre_date))], "employee":emp, "status":"Absent", "docstatus":1}, fields=["status", "employee", "attendance_date"])
	wd = date_diff(get_last_day(pre_date), get_first_day(pre_date)) + 1 - len(holidays)
	#frappe.errprint(absent)
	return wd




@frappe.whitelist()
def get_emp_absent_previous():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	absent = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(pre_date), get_last_day(pre_date))], "employee":emp, "status":"Absent", "docstatus":1}, fields=["status", "employee", "attendance_date"])
	frappe.errprint(pre_date)
	return len(absent)


@frappe.whitelist()
def get_emp_ot_previous():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	ot = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(pre_date), get_last_day(pre_date))], "employee":emp, "status":"Present", "docstatus":1}, fields=["ot", "attendance_date"])
	#frappe.errprint(ot)
	ot_total = 0
	for x in ot:
		ot_total += x.ot
	#frappe.errprint(ot_total)
	return round(ot_total, 2)

@frappe.whitelist()
def get_emp_late_previous():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	ot = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(pre_date), get_last_day(pre_date))], "employee":emp, "status":"Present", "docstatus":1}, fields=["total_missed_hours"])
	ot_total = 0
	for x in ot:
		ot_total += x.total_missed_hours
	#frappe.errprint(ot_total)
	return ot_total

@frappe.whitelist()
def get_emp_leave_previous():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	leaves = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(pre_date), get_last_day(pre_date))], "employee":emp, "status":"On Leave", "docstatus":1}, fields=["status", "attendance_date"])
	#frappe.errprint(leaves)
	return len(leaves)




@frappe.whitelist()
def get_emp_wd_current():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	holidays = get_holiday_dates_for_employee(emp, get_first_day(nowdate()), get_last_day(nowdate()))
	absent = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(nowdate()), get_last_day(nowdate()))], "employee":emp, "status":"Absent", "docstatus":1}, fields=["status", "employee", "attendance_date"])
	wd = date_diff(get_last_day(nowdate()), get_first_day(nowdate())) + 1 - len(holidays)
	#frappe.errprint(absent)
	return wd


@frappe.whitelist()
def get_emp_absent_current():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	absent = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(nowdate()), get_last_day(nowdate()))], "employee":emp, "status":"Absent", "docstatus":1}, fields=["status", "employee", "attendance_date"])
	#frappe.errprint(absent)
	return len(absent)

@frappe.whitelist()
def get_emp_ot_current():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	ot = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(nowdate()), get_last_day(nowdate()))], "employee":emp, "status":"Present", "docstatus":1}, fields=["ot", "attendance_date"])
	#frappe.errprint(ot)
	ot_total = 0
	for x in ot:
		ot_total += x.ot
	#frappe.errprint(ot_total)
	return round(ot_total, 2)

@frappe.whitelist()
def get_emp_late_current():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	ot = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(nowdate()), get_last_day(nowdate()))], "employee":emp, "status":"Present", "docstatus":1}, fields=["total_missed_hours"])
	ot_total = 0
	for x in ot:
		ot_total += x.total_missed_hours
	#frappe.errprint(ot_total)
	return ot_total

@frappe.whitelist()
def get_emp_leave_current():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	leaves = frappe.get_all("Attendance", filters = {"attendance_date":["between", (get_first_day(nowdate()), get_last_day(nowdate()))], "employee":emp, "status":"On Leave", "docstatus":1}, fields=["status", "attendance_date"])
	#frappe.errprint(leaves)
	return len(leaves)




@frappe.whitelist()
def get_emp_absent_last_month():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	absent = frappe.get_all("Attendance", filters = {"attendance_date":[">=", get_first_day(nowdate())], "employee":emp, "attendance_date":["<=", get_last_day(nowdate())], "status":"Absent"})
	frappe.errprint(get_first_day(nowdate()))
	frappe.errprint(get_last_day(nowdate()))
	return len(absent)

@frappe.whitelist()
def get_emp_working_days():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	absent = frappe.get_all("Attendance", filters = {"attendance_date":[">=", get_first_day(nowdate())], "employee":emp, "attendance_date":["<=", get_last_day(nowdate())], "status":"Absent"})
	frappe.errprint(get_first_day(nowdate()))
	frappe.errprint(get_last_day(nowdate()))
	return len(absent)





# Salesperson Dashboard

@frappe.whitelist()
def get_this_month_sales_report():

	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
			SUM(si.grand_total) AS total_sales
		FROM 
			`tabSales Invoice` si
		INNER JOIN
			`tabSales Team` st
		ON si.name = st.parent
		WHERE 
			si.docstatus = 1 
			AND si.is_return = 0 
			AND si.is_internal_customer = 0 
			AND si.posting_date BETWEEN %s AND %s
			AND st.sales_person = %s
			
		GROUP BY 
			st.sales_person

				""",((get_first_day(nowdate()),get_last_day(nowdate()),sales_man[0]['name'])),as_dict=True)
	# frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])



@frappe.whitelist()
def get_prv_month_sales_report():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
			SUM(si.grand_total) AS total_sales
		FROM 
			`tabSales Invoice` si
		INNER JOIN
			`tabSales Team` st
		ON si.name = st.parent
		WHERE 
			si.docstatus = 1 
			AND si.is_return = 0 
			AND si.is_internal_customer = 0 
			AND si.posting_date BETWEEN %s AND %s
			AND st.sales_person = %s
			
		GROUP BY 
			st.sales_person

				""",((get_first_day(pre_date), get_last_day(pre_date),sales_man[0]['name'])),as_dict=True)
	# frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])
	

@frappe.whitelist()
def get_this_month_sales_count():

	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
		COUNT(si.grand_total) AS total_sales
		FROM 
			`tabSales Invoice` si
		INNER JOIN
			`tabSales Team` st
		ON si.name = st.parent
		WHERE 
			si.docstatus = 1 
			AND si.is_return = 0 
			AND si.is_internal_customer = 0 
			AND si.posting_date BETWEEN %s AND %s
			AND st.sales_person = %s
			
		GROUP BY 
			st.sales_person

				""",((get_first_day(nowdate()),get_last_day(nowdate()),sales_man[0]['name'])),as_dict=True)
	# frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])

	


@frappe.whitelist()
def get_prv_month_sales_count():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
			COUNT(si.grand_total) AS total_sales
		FROM 
			`tabSales Invoice` si
		INNER JOIN
			`tabSales Team` st
		ON si.name = st.parent
		WHERE 
			si.docstatus = 1 
			AND si.is_return = 0 
			AND si.is_internal_customer = 0 
			AND si.posting_date BETWEEN %s AND %s
			AND st.sales_person = %s
			
		GROUP BY 
			st.sales_person

				""",((get_first_day(pre_date), get_last_day(pre_date),sales_man[0]['name'])),as_dict=True)
	# frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])
	


@frappe.whitelist()
def get_outstanding():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
        SUM(pl.amount) AS total_sales
    FROM 
        `tabPayment Ledger Entry` pl
    JOIN
        `tabSales Invoice` si 
    ON pl.against_voucher_no = si.name
    INNER JOIN
        `tabSales Team` st
    ON si.name = st.parent
    WHERE 
        pl.against_voucher_type = 'Sales Invoice'
        AND pl.docstatus = 1
        AND si.docstatus = 1 
        AND si.is_return = 0 
        AND si.is_internal_customer = 0 
        AND st.sales_person = %s
    GROUP BY 
        st.sales_person

				""",(sales_man[0]['name']),as_dict=True)
	frappe.errprint("fgghh")
	frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])
	


@frappe.whitelist()
def get_customer_outstanding():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
        SUM(pl.amount) AS total_sales,
		pl.party
    FROM 
        `tabPayment Ledger Entry` pl
    JOIN
        `tabSales Invoice` si 
    ON pl.against_voucher_no = si.name
    INNER JOIN
        `tabSales Team` st
    ON si.name = st.parent
    WHERE 
        pl.against_voucher_type = 'Sales Invoice'
        AND pl.docstatus = 1
        AND si.docstatus = 1 
        AND si.is_return = 0 
        AND si.is_internal_customer = 0 
        AND st.sales_person = %s
    GROUP BY 
        st.sales_person,pl.party

				""",(sales_man[0]['name']),as_dict=True)
	frappe.errprint("fgghh")
	frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])
	

@frappe.whitelist()
def get_sales_order_sum():
    emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
    sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
    frappe.errprint(sales_man)

    pre_date = frappe.db.sql("""  SELECT 
        SUM(si.grand_total) AS total_sales
        FROM 
            `tabSales Order` si
        INNER JOIN
            `tabSales Team` st
        ON si.name = st.parent
        WHERE 
            si.docstatus = 1 
            AND si.is_internal_customer = 0 
            AND st.sales_person = %s
            AND si.status IN ('To Deliver and Bill', 'To Bill')
            
        GROUP BY 
            st.sales_person

                """,((sales_man[0]['name'])),as_dict=True)
    # frappe.errprint(pre_date[0]['total_sales'])
    if pre_date:
        return (pre_date[0]['total_sales'])
	

@frappe.whitelist()
def get_sales_order_open_sales():
    emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
    sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
    frappe.errprint(sales_man)

    pre_date = frappe.db.sql("""  SELECT 
        SUM(si.grand_total) AS total_sales
        FROM 
            `tabSales Order` si
        INNER JOIN
            `tabSales Team` st
        ON si.name = st.parent
        WHERE 
            si.docstatus = 1 
            AND si.is_internal_customer = 0 
            AND st.sales_person = %s
            AND si.status IN ('To Deliver and Bill', 'To Bill','To Deliver')
            
        GROUP BY 
            st.sales_person

                """,((sales_man[0]['name'])),as_dict=True)
    # frappe.errprint(pre_date[0]['total_sales'])
    if pre_date:
        return (pre_date[0]['total_sales'])
	

@frappe.whitelist()
def get_sales_order_oredred():
    emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
    sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
    frappe.errprint(sales_man)

    pre_date = frappe.db.sql("""  SELECT 
        count(si.grand_total) AS total_sales
        FROM 
            `tabQuotation` si
        WHERE 
            si.docstatus = 1 
           
            AND si.owner = %s
            AND si.status IN ('Ordered')
            
        GROUP BY 
            si.owner

                """,((frappe.session.user)),as_dict=True)
    # frappe.errprint(pre_date[0]['total_sales'])
    if pre_date:
        return (pre_date[0]['total_sales'])
	


@frappe.whitelist()
def get_sales_order_oredred_sum():
    emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
    sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
    frappe.errprint(sales_man)

    pre_date = frappe.db.sql("""  SELECT 
        sum(si.grand_total) AS total_sales
        FROM 
            `tabQuotation` si
        WHERE 
            si.docstatus = 1 
           
            AND si.owner = %s
            AND si.status IN ('Ordered')
            
        GROUP BY 
            si.owner

                """,((frappe.session.user)),as_dict=True)
    # frappe.errprint(pre_date[0]['total_sales'])
    if pre_date:
        return (pre_date[0]['total_sales'])
	

@frappe.whitelist()
def credit_note():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	sales_man = frappe.get_all("Sales Person", filters = {"employee":emp, "enabled":1}, fields=["name"])
	frappe.errprint(sales_man)

	pre_date = frappe.db.sql("""  SELECT 
			sum(si.grand_total) AS total_sales
		FROM 
			`tabSales Invoice` si
		INNER JOIN
			`tabSales Team` st
		ON si.name = st.parent
		WHERE 
			si.docstatus = 1 
			AND si.is_return = 1 
			AND si.is_internal_customer = 0 
			AND st.sales_person = %s
			
		GROUP BY 
			st.sales_person

				""",((sales_man[0]['name'])),as_dict=True)
	# frappe.errprint(pre_date[0]['total_sales'])
	if pre_date:
		return (pre_date[0]['total_sales'])



#Dashboard of Sales Manager

@frappe.whitelist()
def get_this_month_team_sales_report():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)
			pre_date = frappe.db.sql("""
				SELECT 
					SUM(so.grand_total) AS total_sales
				FROM 
					`tabSales Invoice` so
				LEFT JOIN
					`tabSales Team` st
				ON
					st.parent = so.name
				WHERE 
					so.docstatus = 1 
					AND so.is_internal_customer = 0
					AND so.is_return = 0
					AND so.is_replacement_invoice = 0
					AND so.posting_date BETWEEN %s AND %s
					AND st.sales_person IN %s
			""",(get_first_day(nowdate()),get_last_day(nowdate()),tuple(list1)),as_dict=True)
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def get_last_month_team_sales_report():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)
		
			pre_date = frappe.db.sql("""
					SELECT 
						SUM(so.grand_total) AS total_sales
					FROM 
						`tabSales Invoice` so
					LEFT JOIN
						`tabSales Team` st
					ON
						st.parent = so.name
					WHERE 
						so.docstatus = 1 
						AND so.is_internal_customer = 0
						AND so.is_return = 0
						AND so.is_replacement_invoice = 0
						AND so.posting_date BETWEEN %s AND %s
						AND st.sales_person IN %s
				""",((get_first_day(pre_date), get_last_day(pre_date),tuple(list1))),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])

@frappe.whitelist()
def get_this_month_team_sales_order_report():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)
			pre_date = frappe.db.sql("""
				SELECT 
					SUM(so.grand_total) AS total_sales
				FROM 
					`tabSales Order` so
				LEFT JOIN
					`tabSales Team` st
				ON
					st.parent = so.name
				WHERE 
					so.docstatus = 1 
					AND so.is_internal_customer = 0
					AND so.transaction_date BETWEEN %s AND %s
					AND st.sales_person IN %s
			""",(get_first_day(nowdate()),get_last_day(nowdate()),tuple(list1)),as_dict=True)
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def get_last_month_team_sales_order_report():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)
		
			pre_date = frappe.db.sql("""
					SELECT 
						SUM(so.grand_total) AS total_sales
					FROM 
						`tabSales Order` so
					LEFT JOIN
						`tabSales Team` st
					ON
						st.parent = so.name
					WHERE 
						so.docstatus = 1 
						AND so.is_internal_customer = 0
						AND so.transaction_date BETWEEN %s AND %s
						AND st.sales_person IN %s
				""",((get_first_day(pre_date), get_last_day(pre_date),tuple(list1))),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])

@frappe.whitelist()
def get_this_month_team_sales_order_count():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)
			pre_date = frappe.db.sql("""
				SELECT 
					COUNT(so.grand_total) AS total_sales
				FROM 
					`tabSales Order` so
				LEFT JOIN
					`tabSales Team` st
				ON
					st.parent = so.name
				WHERE 
					so.docstatus = 1 
					AND so.is_internal_customer = 0
					AND so.transaction_date BETWEEN %s AND %s
					AND st.sales_person IN %s
			""",(get_first_day(nowdate()),get_last_day(nowdate()),tuple(list1)),as_dict=True)
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def get_last_month_team_sales_order_count():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)
		
			pre_date = frappe.db.sql("""
					SELECT 
						Count(so.grand_total) AS total_sales
					FROM 
						`tabSales Order` so
					LEFT JOIN
						`tabSales Team` st
					ON
						st.parent = so.name
					WHERE 
						so.docstatus = 1 
						AND so.is_internal_customer = 0
						AND so.transaction_date BETWEEN %s AND %s
						AND st.sales_person IN %s
				""",((get_first_day(pre_date), get_last_day(pre_date),tuple(list1))),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])
	


@frappe.whitelist()
def get_last_month_team_quotation_count():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["employee"])
		
		if team:
			list1 = []
			for i in team:
				user = frappe.db.get_value("Employee",{"name":i['employee']},"user_id")

				if user not in list1:
					list1.append(user)
			frappe.errprint(list1)
		
			pre_date = frappe.db.sql("""
					SELECT 
						Count(qt.grand_total) AS total_sales
					FROM 
						`tabQuotation` qt
					WHERE 
						qt.docstatus = 1 
						AND qt.transaction_date BETWEEN %s AND %s
						AND qt.account_incharge IN %s
				""",((get_first_day(pre_date), get_last_day(pre_date),tuple(list1))),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def get_this_month_team_quotation_count():
	pre_date = add_months(nowdate(), -1)
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["employee"])
		
		if team:
			list1 = []
			for i in team:
				user = frappe.db.get_value("Employee",{"name":i['employee']},"user_id")

				if user not in list1:
					list1.append(user)
			frappe.errprint(list1)
		
			pre_date = frappe.db.sql("""
					SELECT 
						Count(qt.grand_total) AS total_sales
					FROM 
						`tabQuotation` qt
					WHERE 
						qt.docstatus = 1 
						AND qt.transaction_date BETWEEN %s AND %s
						AND qt.account_incharge IN %s
				""",((get_first_day(nowdate()),get_last_day(nowdate()),tuple(list1))),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])



@frappe.whitelist()
def get_team_outstanding():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)

			pre_date = frappe.db.sql("""  SELECT 
				SUM(pl.amount) AS total_sales
			FROM 
				`tabPayment Ledger Entry` pl
			JOIN
				`tabSales Invoice` si 
			ON pl.against_voucher_no = si.name
			INNER JOIN
				`tabSales Team` st
			ON si.name = st.parent
			WHERE 
				pl.against_voucher_type = 'Sales Invoice'
				AND pl.docstatus = 1
				AND si.docstatus = 1 
				AND si.is_return = 0 
				AND si.is_internal_customer = 0 
				AND st.sales_person IN %s

						""",([tuple(list1)]),as_dict=True)
			frappe.errprint("fgghh")
			frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def team_credit_note():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)

			pre_date = frappe.db.sql("""  SELECT 
					sum(si.grand_total) AS total_sales
				FROM 
					`tabSales Invoice` si
				INNER JOIN
					`tabSales Team` st
				ON si.name = st.parent
				WHERE 
					si.docstatus = 1 
					AND si.is_return = 1 
					AND si.is_internal_customer = 0 
					AND st.sales_person IN %s

						""",([tuple(list1)]),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])

@frappe.whitelist()
def get_team_sales_order_oredred_sum():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["employee"])
		
		if team:
			list1 = []
			for i in team:
				user = frappe.db.get_value("Employee",{"name":i['employee']},"user_id")

				if user not in list1:
					list1.append(user)
			frappe.errprint(list1)

			pre_date = frappe.db.sql("""  SELECT 
				sum(si.grand_total) AS total_sales
				FROM 
					`tabQuotation` si
				WHERE 
					si.docstatus = 1 
				
					AND si.account_incharge IN %s
					AND si.status IN ('Ordered')

						""",([tuple(list1)]),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def get_team_sales_order_oredred_count():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["employee"])
		
		if team:
			list1 = []
			for i in team:
				user = frappe.db.get_value("Employee",{"name":i['employee']},"user_id")

				if user not in list1:
					list1.append(user)
			frappe.errprint(list1)

			pre_date = frappe.db.sql("""  SELECT 
				COUNT(si.grand_total) AS total_sales
				FROM 
					`tabQuotation` si
				WHERE 
					si.docstatus = 1 
				
					AND si.account_incharge IN %s
					AND si.status IN ('Ordered')

						""",([tuple(list1)]),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])


@frappe.whitelist()
def get_sales_order_open_team_sales():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)

			pre_date = frappe.db.sql("""  SELECT 
				SUM(si.grand_total) AS total_sales
				FROM 
					`tabSales Order` si
				INNER JOIN
					`tabSales Team` st
				ON si.name = st.parent
				WHERE 
					si.docstatus = 1 
					AND si.is_internal_customer = 0 
					AND st.sales_person IN %s
					AND si.status IN ('To Deliver and Bill', 'To Bill','To Deliver')

						""",([tuple(list1)]),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])

@frappe.whitelist()
def get_team_sales_order_sum():
	emp = frappe.db.get_value("Employee", {"user_id":frappe.session.user}, "name")
	frappe.errprint(emp)
	sales_man = frappe.db.get_value("Sales Person",{"custom_parent_head_id":emp, "enabled":1,"is_group":1},"name")
	frappe.errprint(sales_man)
	if sales_man:
		team = frappe.get_all("Sales Person", filters = {"custom_parent_head":sales_man, "enabled":1}, fields=["name"])
		
		if team:
			list1 = []
			for i in team:
				if i['name'] not in list1:
					list1.append(i['name'])
			frappe.errprint(list1)

			pre_date = frappe.db.sql("""  SELECT 
				SUM(si.grand_total) AS total_sales
				FROM 
					`tabSales Order` si
				INNER JOIN
					`tabSales Team` st
				ON si.name = st.parent
				WHERE 
					si.docstatus = 1 
					AND si.is_internal_customer = 0 
					AND st.sales_person IN %s
					AND si.status IN ('To Deliver and Bill', 'To Bill')

						""",([tuple(list1)]),as_dict=True)
			# frappe.errprint(pre_date[0]['total_sales'])
			if pre_date:
				return (pre_date[0]['total_sales'])
			

	
	



		








# Filter applied for the srq type

@frappe.whitelist()
def get_srq_type(doctype, txt, searchfield, start, page_len, filters):
   return frappe.db.sql("""SELECT name FROM `tabSRQ Type` WHERE disable = 0 and name like '{0}%'""".format(txt))


# Quotation Minimum price check

def quote_min_check(quotation, method):
	price_list_total = {}
	total_base = 0
	total_mrp = 0
	total_rrp = 0
	total_project = 0
	total_trade = 0
	total_min = 0
	total_sale = 0
	if "Master Management" not in frappe.get_roles(frappe.session.user) and "Price Adjustment Controller" not in frappe.get_roles(frappe.session.user):
		for item in quotation.items:
			if item.promo_rate:
				if item.rate < item.promo_rate:
					frappe.throw("Pricing less than Promotion Rate for " + str(item.item_code))
			elif item.promo_rate == 0 and item.min_price_list_rate :
				if item.rate < item.min_price_list_rate:
					frappe.throw("Pricing less than MRP for " + str(item.item_code))
	if "Master Management" not in frappe.get_roles(frappe.session.user) and "Price Adjustment Controller" in frappe.get_roles(frappe.session.user):
		for item in quotation.items:
			if item.promo_rate:
				if item.rate < item.promo_rate:
					frappe.throw("Pricing less than Promotion Rate for " + str(item.item_code))
			elif item.promo_rate == 0 and item.min_price_list_rate :
				if item.rate < item.project_price_:
					frappe.throw("Pricing less than Project price for " + str(item.item_code))




	# if "Master Management" not in frappe.get_roles(frappe.session.user):
	# 	#frappe.errprint(frappe.get_roles(frappe.session.user))
	# 	last_selling_price_customer = 0
	# 	total_min_price = 0
	# 	for item in quotation.items:
			
	# 		item.min_price_list_rate = frappe.db.get_value("Item Price", {"price_list":quotation.min_pricelist, "item_code":item.item_code}, "price_list_rate")
	# 		if item.min_price_list_rate:
	# 			total_min_price += item.min_price_list_rate
	# 		if item.promo_rate == 0 and item.min_price_list_rate:
	# 			if item.rate < item.min_price_list_rate:
	# 					frappe.throw("Pricing less than MRP " + str(item.item_code))
	# 			# if item.promo_rate > 0:
	# 			# 	if item.rate < item.promo_rate:
	# 			# 		frappe.throw("Pricing less than Promo Rate for " + str(item.item_code))
	# 			# if item.promo_rate == 0:
	# 			# 	if item.rate < item.min_price_list_rate:
	# 			# 		frappe.throw("Pricing less than MRP " + str(item.item_code))
			
	# 	# if total_min_price > quotation.net_total:
	# 	# 	frappe.throw("Pricing less than Total MRP. Please check discount")
	# if "Price Adjustment Controller" not in frappe.get_roles(frappe.session.user):
	# 	for item in quotation.items:
	# 		project_price = frappe.db.get_value("Item Price", {"price_list":"Project MRP", "item_code":item.item_code}, "price_list_rate")
	# 		if project_price and item.promo_rate == 0:
	# 				if item.rate < item.project_price_:
	# 					frappe.throw("Pricing less than Project MRP for " + str(item.item_code))

			
			#frappe.errprint(prices)
	for item in quotation.items:
		item.p_compare = ""
		prices = frappe.get_all("Item Price", filters={"item_code":item.item_code, "selling":1}, fields=["price_list", "price_list_rate"])
		for z in prices:
			#frappe.errprint(z)
			if item.rate > 0:
				item.p_compare += str(z.price_list) + ": " + str("{:.2f}".format(((item.rate * item.qty) - (z.price_list_rate * item.qty)))) + " | " 
				if z.price_list == "Landing Cost":
					total_base += z.price_list_rate * item.qty
				if z.price_list == "Trade Price":
					total_trade += z.price_list_rate * item.qty
				if z.price_list == "Project MRP":
					total_project += z.price_list_rate * item.qty
				if z.price_list == "MRP":
					total_mrp += z.price_list_rate * item.qty
				if z.price_list == "RRP":
					total_rrp += z.price_list_rate * item.qty
	
		query_p = frappe.db.sql("""
			select
				qp.party_name, qc.rate
			from `tabQuotation` qp, `tabQuotation Item` qc
			where
				qp.name = qc.parent and
				qp.docstatus = 1 and
				qc.item_code = %s and
				qp.party_name = %s
			order by qp.transaction_date asc
		""", (item.item_code, quotation.party_name), as_dict = 1)
		#frappe.errprint(query_p[0].rate)
		if query_p:
			item.last_selling_price_customer = query_p[0].rate
	
	#frappe.errprint(total_base)
	if quotation.total > 0:
		quotation.ihg_margins = ""
		quotation.ihg_margins += "Landing Cost : " + str("{:.2f}".format((quotation.total - total_base))) + " | "
		quotation.ihg_margins += "Trade Price : " + str("{:.2f}".format((quotation.total - total_trade))) + " | "  
		quotation.ihg_margins += "Project MRP : " + str("{:.2f}".format((quotation.total - total_project))) + " | " 
		quotation.ihg_margins += "MRP :  " + str("{:.2f}".format((quotation.total - total_mrp))) + " | " 
		quotation.ihg_margins += "RRP : " + str("{:.2f}".format((quotation.total - total_rrp))) + " | "

		

	#l_rate = frappe.db.sql(query_p, as_dict=1)


def create_variant_pricing(item, method):
	#frappe.errprint("func-called")
	if item.variant_of:
		vi = frappe.get_doc("Item", item.variant_of)
		if vi.variant_pricing:
			#frappe.errprint("variant-table")
			for x in vi.variant_pricing:
				ip = frappe.new_doc("Item Price")
				ip.item_code = item.item_code
				ip.price_list = x.price_list
				ip.price_list_rate = x.rate
				ip.save()


def change_variant_pricing(item, method):
	if item.has_variants:
		v_list = frappe.get_all("Item", filters={"variant_of":item.item_code}, fields=["item_code"])
		if v_list:
			for z in v_list:
				ip = frappe.get_all("Item Price", filters={"item_code":z.item_code}, fields=["name"])
				if ip:
					for x in ip:
						item_price = frappe.get_doc("Item Price", x.name)
						for y in item.variant_pricing:
							if y.price_list == item_price.price_list:
								item_price.price_list_rate = y.rate
								item_price.save()
				else:
					for x in item.variant_pricing:
						ip = frappe.new_doc("Item Price")
						ip.item_code = z.item_code
						ip.price_list = x.price_list
						ip.price_list_rate = x.rate
						ip.save()

def copy_variant_values(item, method):
	if item.variant_of:
		for x in item.attributes:
			i_field = frappe.get_value("Item Attribute", x.attribute, "item_field_map")
			if i_field:
				frappe.db.set_value("Item", item.name, i_field, x.attribute_value)





def create_attr_description(item, method):
	if item.custom_custom_descripton == 0:		
		item.description = ""
		category = ""
		for x in item.category:
			category += str(x.category_list)
		dt = frappe.get_meta('Item')
		item.description += "Category:" + category + "<br>"
		for x in dt.fields:
			
			if x.fieldname not in ["item_code", "item_name", "description", "percent_complete", "image", "data_url", "barcodes","gst_hsn_code",
			"product_assistant", "seo_specialist", "product_executive", "logistics", "price_management", "technical_spec", "photography", "senior_inspecition",
			"barcodes", "supplier_items", "uoms", "attributes", "variant_pricing", "item_defaults", "app_image_1", "app_image_2", "app_image_3", "app_image_4", "app_image_5",
			"variant_based_on", "item_default", "category", "is_purchase_item", "is_sales_item", "allow_alternative_item", "stock_uom", "is_stock_item", "grant_commission",
			"documents", "naming_series", "is_fixed_asset", "auto_create_assets", "asset_category", "art_no", "include_item_in_manufacturing", "end_of_life", "default_material_request_type", "valuation_rate", "price_generation", "item_group", "turn_off_time", "country_of_orgin", "country_of_origin", "style", "trending_search", "variant_of", "brand_abbr", "web_keywords", "category", "published_in_website", "last_purchase_rate", "bought_together", "accessories", "similar_range", "must_use", "published_in_ledworld", "published_in_ihg", "published_in_desroch", "product_type","local_item","service_item,","bespoke_item","ihg_industry_item","metroplus_items","promotion_item","new_arrival"]:
				if item.get(x.fieldname):
					item.description += x.label + ": " + str(item.get(x.fieldname)) + "<br>" 
					frappe.errprint(item.description)




# Creation of prodcut details document

# def create_product_details(item_price, method):
# 	if item_price.doctype == "Item" and item_price.is_stock_item:
# 		creation_of_product_details(item_price)
	
# 	if item_price.doctype == "Item Price" and item_price.price_list in ["RRP","Promo"]:
# 		creation_of_product_details(item_price)

# def creation_of_product_details(data):
# 	if frappe.db.exists(data.doctype, {'item_code': data.item_code}):

# 		if frappe.db.exists("Product Details", {'item_code': data.item_code}):

# 			doc = frappe.get_doc("Product Details",data.item_code)
# 			if doc:
# 				frappe.errprint("is exist")
# 				if data.doctype == "Item":
# 					doc.brand = data.brand
# 					doc.category_list = data.category_list
# 					doc.product_type = data.product_type
# 					doc.description = data.description

# 				if data.doctype == "Item Price":
# 					if data.price_list == "RRP":
# 						doc.rrp = data.price_list_rate
# 					if data.price_list == "Promo":
# 						doc.promo = data.price_list_rate

# 				doc.save()

# 		else:
# 			frappe.errprint("is not exist")
# 			doc =  frappe.new_doc("Product Details")
# 			if data.doctype == "Item":
# 				doc.item_code = data.item_code
# 				doc.item_name = data.item_name
# 				doc.brand = data.brand
# 				doc.category_list = data.category_list
# 				doc.product_type = data.product_type
# 				doc.description = data.description
# 			if data.doctype == "Item Price":
# 					doc.item_code = data.item_code
# 					if data.price_list == "RRP":
# 						doc.rrp = data.price_list_rate
# 					if data.price_list == "Promo":
# 						doc.promo = data.price_list_rate

# 			doc.save()




@frappe.whitelist()
def copy_image_from_variant_template(variant_of):
	image_url = frappe.db.get_value('Item', variant_of, 'image')
	return image_url

@frappe.whitelist()
def submit_proforma_invoice(name):
	sales_order = frappe.db.get_value("Sales Invoice",{"name":name},"sales_order")
	if sales_order:
		proforma = frappe.db.get_value("Proforma Invoice",{"sales_order":sales_order},"name")
		if proforma:
			doc = frappe.get_doc("Proforma Invoice",proforma)
			if doc.docstatus == 1:
				frappe.db.set(doc, "status", "Invoiced")
				# return doc

@frappe.whitelist()
def get_cost_center(data,name):
	doc = frappe.get_doc("Stock Entry",name)
	for i in doc.items:
		if i.cost_center == "":
			i.cost_center = data



# CUSTOMER CREDIT LIMIT
@frappe.whitelist()
def get_credit_limit(data,docname):
	max_date = {}
	frappe.errprint("Call")
	today = date.today()
	if docname == "Sales Order":
		doc = frappe.get_doc("Sales Order",data)
		condition = doc.custom_bypass_credit_limit == 0 and doc.custom_payment_type != "Cash"
		grnd_value = doc.grand_total
	else:
		doc = frappe.get_doc("Sales Invoice",data)
		condition = doc.custom_bypass_credit_limit == 0
		grnd_value = doc.outstanding_amount

	value = 0
	if condition:
		credit_amount = frappe.db.get_value("Credit Limit",{"parent":doc.customer,"company":doc.company},"credit_limit_amount")
		credit_days = frappe.db.get_value("Credit Limit",{"parent":doc.customer,"company":doc.company},"credit_limit_days")
		customer_type = frappe.db.get_value("Credit Limit",{"parent":doc.customer,"company":doc.company},"custom_customer_type")
		frappe.errprint(customer_type)
		
		if docname == "Sales Invoice":
			if customer_type == "Cash":
				
				if doc.grand_total != doc.paid_amount:
					frappe.errprint(doc.doctype)

					return["customer_type",doc.customer,doc.grand_total]


		# CHECKING CREDIT AMOUNT
				
		ple = frappe.db.sql(
					"""
						SELECT
						SUM(ple.amount) As amount
						FROM
							`tabPayment Ledger Entry` ple
						WHERE
							ple.party = %s
							AND ple.company = %s
							AND ple.posting_date <= %s

				""",(doc.customer,doc.company,today),
					as_dict=1,
				)
		frappe.errprint("Payment Ledger Entry")
		frappe.errprint(ple)


		if docname == "Sales Order":
			so = frappe.db.get_all("Sales Order",filters = {"docstatus":1,"status":["in",["To Bill","To Deliver and Bill"]],"customer":doc.customer,"company":doc.company},fields = ["grand_total","per_billed"])
			frappe.errprint("Sales Order")
			frappe.errprint(so)
			if so:
				for i in so:
					frappe.errprint(i["grand_total"])
					value = i["grand_total"] - (i["grand_total"] * i["per_billed"])
			# grand = frappe.db.get_value("Sales Order",{"name":doc.name},"grand_total")
		total_value = ple[0]['amount'] + value + grnd_value
		frappe.errprint("grand Value")
		frappe.errprint(value)
		frappe.errprint("credit_amount")
		frappe.errprint(grnd_value)

		if total_value:
			if total_value > credit_amount:
				return ["credit_amount",doc.customer,total_value,credit_amount]
		

		# CHECKING CREDIT DAYS

		ple = frappe.db.sql(
					"""
						SELECT
							ple.against_voucher_no,SUM(ple.amount) As amount
						FROM
							`tabPayment Ledger Entry` ple
						WHERE
							ple.party = %s
						AND ple.company = %s
						
						GROUP BY
							ple.against_voucher_no


				""",(doc.customer,doc.company),
					as_dict=1,
				)
		frappe.errprint("Payment Ledger Entry")
		frappe.errprint(ple)
		for i in ple:
			if i.amount > 0:
				posting_date = frappe.db.get_all("Sales Invoice",filters = {"name":i.against_voucher_no,"company":doc.company},fields = "posting_date")
				if posting_date:					
					frappe.errprint(i.against_voucher_no)
					frappe.errprint("Posting Date")
					frappe.errprint(posting_date)
					date_values = [date['posting_date'] for date in posting_date]
					max_date[i.against_voucher_no] = (today - (max(date_values))).days
				frappe.errprint("Min Posting Date")
				frappe.errprint(max_date)
				
		if max_date:
			day= min(max_date.values())
			max_keys = [key for key, value in max_date.items() if value == day]
			frappe.errprint("Max Day")
			frappe.errprint(day)
			# frappe.errprint(max_keys)
			if day > credit_days:
				frappe.errprint("Credit Date")
				frappe.errprint(credit_days)
				return ["credit_days",doc.customer,day,credit_days]
	



def validate_variants(item, method):
	frappe.errprint("validate Variant")
	flag = 0
	if item.variant_of:
		for x in item.attributes:
			at_spec = frappe.get_doc("Item Attribute", x.attribute)
			
			for y in at_spec.item_attribute_values:
				
				if y.attribute_value == x.attribute_value:
					for z in item.attributes:
						if z.attribute == y.dependent_attribute:
							if z.attribute_value != y.value:			
								frappe.errprint(str(x.attribute) + str(x.attribute_value + str(y.dependent_attribute) + str(y.value)))
								flag = 1
	#if flag == 1:
	#	validated = False
	#	frappe.throw("Wrong Item Combination")


def image_from_variant_template(item, method):
	item.image = frappe.db.get_value('Item', item.variant_of, 'image')
#sales invoice item price fetching (trade, landing , promo)

def change_sales_price(sales_invoice, method):
	for item in sales_invoice.items:
		item.trade_price = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Trade Price"}, "price_list_rate")
		item.promo_price = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Promo"}, "price_list_rate")
		item.landing_cost = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Landing Cost"}, "price_list_rate")


def si_min_check(sales_invoice, method):
	if sales_invoice.is_internal_customer != 1:
		
		if "Sales Price Override" not in frappe.get_roles(frappe.session.user):
		#if frappe.get_roles(frappe.session.user) != "Accounts Manager":
			for item in sales_invoice.items:
				#item.rrp = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.selling_price_list}, "price_list_rate")
				#item.min_rate = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.min_selling_price}, "price_list_rate")
				#item.promo_price_list = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.promo_price_list}, "price_list_rate")
				if item.item_code != "Production Supply Installation":
					if item.min_rate or item.promo_rate:
						if item.promo_rate > 0:
							if item.rate < item.promo_rate:
								frappe.throw("Pricing less than Promo Rate for - " + str(item.item_code))
						if item.promo_rate == 0:
							if item.rate < item.min_rate:
								frappe.throw("Pricing less than MRP for - " + str(item.item_code)) 


def add_pricelist_prices(sales_invoice, method):
	for item in sales_invoice.items:
		item.rrp = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.selling_price_list}, "price_list_rate")
		item.min_rate = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.min_selling_price}, "price_list_rate")
		item.promo_rate = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.promo_price_list}, "price_list_rate")




def change_prices(sales_invoice, method):
	for item in sales_invoice.items:
		item.min_rate = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":sales_invoice.min_selling_price}, "price_list_rate")
		

def change_quote_price(quotation, method):
	for item in quotation.items:
		if quotation.conversion_rate == 1:
			item.min_price_list_rate = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":quotation.min_pricelist}, "price_list_rate")
			item.project_price_ = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Project MRP"}, "price_list_rate")
			item.trade_price = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Trade Price"}, "price_list_rate")
			item.standard_buying = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Standard Buying"}, "price_list_rate")
			item.landing_cost = frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Landing Cost"}, "price_list_rate")
		else:
			item.min_price_list_rate = quotation.conversion_rate * frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":quotation.min_pricelist}, "price_list_rate") if frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":quotation.min_pricelist}, "price_list_rate") else 0.0
			item.project_price_ = quotation.conversion_rate * frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Project MRP"}, "price_list_rate") if frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Project MRP"}, "price_list_rate") else 0.0
			item.trade_price = quotation.conversion_rate * frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Trade Price"}, "price_list_rate") if frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Trade Price"}, "price_list_rate") else 0.0
			item.standard_buying = quotation.conversion_rate * frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Standard Buying"}, "price_list_rate") if frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Standard Buying"}, "price_list_rate") else 0.0
			item.landing_cost = quotation.conversion_rate * frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Landing Cost"}, "price_list_rate") if frappe.get_value("Item Price", {"item_code": item.item_code, "price_list":"Landing Cost"}, "price_list_rate") else 0.0


def so_min_check(sales_order, method):
	for item in sales_order.items:
		if item.item_code != "Production Supply Installation":
			if item.min_rate or item.promo_rate:
				if item.promo_rate > 0:
					if item.rate < item.promo_rate:
						frappe.throw("Pricing less than Promo Rate for - " + str(item.item_code))
				if item.promo_rate == 0:
					if item.rate < item.min_rate:
						frappe.throw("Pricing less than MRP for - " + str(item.item_code)) 



def po_mr_head(purchase_order, method):
	mr_list = []
	purchase_order.mr_list = " "
	for item in purchase_order.items:
		if item.material_request not in mr_list:
			mr_list.append(item.material_request)
	if mr_list:
		
		for item in mr_list:
			#frappe.errprint(item)
			purchase_order.mr_list += str(item) + ", "



#API for PWA application
@frappe.whitelist()
def response(message, data, success, status_code):
	frappe.clear_messages()
	"""
	Params: message, status code
	"""
	frappe.local.response["message"] = message
	frappe.local.response["data"] = data
	frappe.local.response["success"] = success
	frappe.local.response["http_status_code"] = status_code
	return

@frappe.whitelist()
def get_product_details(item_code=None, item_name=None, brand=None, category=None, promotion=None, published_in_desroch=None, price_list=None, start=0, page_length=20, sorting=None):
	"""
	Used to get all Items.
	Filters will be applied on %like% for item_code and item_name
	default page length is set as 20
	"""
	try:
		item_data = []
		#Setting common filters for item
		item_filter = { 'disabled': 0, 'is_stock_item': 1, 'has_variants': 0}
		item_filter['item_group'] = ['not in', ('Metroplus Items', 'Unapproved Items', 'IT Assets')]
		if frappe.db.exists("Item", { 'disabled': 0, 'is_stock_item': 1 }):
			#To search item by item_code
			if item_code:
				item_filter['item_code'] = ['like', '%'+item_code+'%']
			#To search item by brand
			if brand:
				item_filter['brand'] = ['like', '%'+brand+'%']
			#To search item by category
			if category:
				item_filter['category_list'] = category
			#To search item by promotions
			if promotion:
				item_filter['promotion_item'] = promotion
			#To get item by desroch
			if published_in_desroch:
				item_filter['published_in_desroch'] = published_in_desroch
			#To search item by item_name
			if item_name:
				item_filter['item_name'] = ['like', '%'+item_name+'%']
			item_list = frappe.db.get_list("Item", filters=item_filter, start=start, page_length=page_length)
			#item_list = frappe.db.get_list("Item", start=start, page_length=page_length)
			for item in item_list:
				#Appending results together
				if get_item_data(item.name, price_list):
					item_data.append(get_item_data(item.name, price_list))
			
			

		if item_data:
			if sorting == "asc":
				item_data = sorted(item_data.items(), key=lambda x:x['product_stock'])

			if sorting == "desc":
				item_data = sorted(item_data.items(), key=lambda x:x['product_stock'], reverse=True)
			return response( "Success.", item_data, True, 200)
		else:
			return response( "No Products found!", {}, False, 400)

	except Exception as e:
		frappe.log_error(frappe.get_traceback())
		return response(e, {}, False, 400)


@frappe.whitelist()
def get_item_data(item_code, price_list="RRP"):
	"""
		Used to Get Individual Item datails with image, item_code, item_name, price and stock
		Default price_list is set as RRP, if other price_list are passed as argument, It will override.
	"""
	query = """
		select
			itm.image as product_image,
			itm.item_code as product_code,
			itm.item_name as product_name
		from
			`tabItem` as itm
		where
			itm.disabled = 0 AND
			itm.item_group != 'Unapproved Items' AND
			itm.item_group != 'Metroplus Items' AND
			itm.item_group != 'IT Assets' AND
			itm.is_stock_item = 1 AND
			itm.has_variants=0 AND
			itm.name = %(item_code)s
	"""
	return_data = frappe.db.sql(query.format(), { 'item_code': item_code }, as_dict=True)
	if return_data:
		#Adding product_price key
		return_data[0]['product_price'] = get_item_price(item_code, price_list)
		# #Adding product_price key
		return_data[0]['product_price_promo'] = get_item_price(item_code, "Promo")
		return_data[0]['product_price_MRP'] = get_item_price(item_code, "MRP")
		#Adding product_stock key
		return_data[0]['product_stock'] = get_item_stock_qty(item_code)
		return return_data[0]
	else:
		return []

@frappe.whitelist()
def get_item_data_promotions(item_code, price_list="Promo"):
	"""
		Used to Get Individual Item datails with image, item_code, item_name, price and stock
		Default price_list is set as RRP, if other price_list are passed as argument, It will override.
	"""
	query = """
		select
			itm.image as product_image,
			itm.item_code as product_code,
			itm.item_name as product_name
		from
			`tabItem` as itm
		where
			itm.disabled = 0 AND
			itm.item_group != 'Unapproved Items' AND
			itm.item_group != 'Metroplus Items' AND
			itm.item_group != 'IT Assets' AND
			itm.is_stock_item = 1 AND
			itm.name = %(item_code)s
	"""
	return_data = frappe.db.sql(query.format(), { 'item_code': item_code }, as_dict=True)
	if return_data:
		#Adding product_price key
		return_data[0]['product_price'] = get_item_price(item_code, price_list)
		#Adding product_price key
		return_data[0]['product_price_promo'] = get_item_price(item_code, "Promo")
		#Adding product_stock key
		# return_data[0]['product_stock'] = get_item_stock_qty(item_code,)
		return return_data[0]
	else:
		return []

@frappe.whitelist()
def get_item_price(item_code, price_list):
	"""
		Used to Get Last updated Item Price for an item.
		Can be filter by price_list
	"""
	product_price = 0
	if frappe.db.exists("Item Price", { 'item_code': item_code, 'price_list': price_list }):
		item_price = frappe.get_last_doc("Item Price", { 'item_code': item_code, 'price_list': price_list })
		if item_price:
			product_price = item_price.price_list_rate
	return product_price

def get_item_stock_qty(item_code):
	"""
		Used to Get total stock of an item in all warehouses.
	"""
	query = """
		select
			SUM(b.actual_qty) as product_stock
		from
			`tabBin` as b
		where
			b.item_code = %(item_code)s 
	"""
	return_data = frappe.db.sql(query.format(), { 'item_code': item_code }, as_dict=True)
	if return_data and return_data[0].product_stock:
		return return_data[0].product_stock
	else:
		return 0

@frappe.whitelist()
def get_item_by_barcode(barcode):
	"""
		Used to GET Item by searching barcode.
	"""
	try:
		query = """
			select
				ib.parent as item_code,
				ib.barcode as barcode
			from
				`tabItem Barcode` as ib
			where
				ib.barcode = %(barcode)s
		"""
		return_data = frappe.db.sql(query.format(), { 'barcode': barcode }, as_dict=True)
		if return_data:
			return response( "Success.", return_data[0], True, 200)
		else:
			return response( "No Products found!", {}, False, 400)
	except Exception as e:
		frappe.log_error(frappe.get_traceback())
		return response(e, {}, False, 400)

@frappe.whitelist()
def get_similar_products(item_code, page_length=10):
	"""
		Used to GET Similar Item by Brand, Category, Group Etc..
	"""
	try:
		item_data = []
		if frappe.db.exists("Item", item_code):
			item_doc = frappe.get_doc("Item", item_code)
			category_list = item_doc.category_list if item_doc.category_list else ""
			category = item_doc.category if item_doc.category else ""
			sub_category = item_doc.sub_category if item_doc.sub_category else ""
			brand = item_doc.brand if item_doc.brand else ""
			series = item_doc.series if item_doc.series else ""
			query = """
				select
					name
				from
					`tabItem`
				where
					disabled = 0 AND
					is_stock_item = 1 AND
					name != %(item_code)s AND (
						( category_list = %(category_list)s AND category_list<>'' ) OR
						( category = %(category)s AND category<>'' ) OR
						( sub_category = %(sub_category)s AND sub_category<>'') OR
						( brand = %(brand)s AND brand<>'') OR
						( series = %(series)s AND series<>'' )
					)
			"""
			query += "LIMIT " + str(page_length)
			return_data = frappe.db.sql(query.format(), { 'item_code': item_code, 'category_list': category_list, 'category': category, 'sub_category': sub_category, 'brand': brand, 'series': series, 'page_length': page_length }, as_dict=True)
			for item in return_data:
				#Appending results together
				if get_item_data(item.name, "RRP"):
					item_data.append(get_item_data(item.name, "RRP"))
			if item_data:
				return response( "Success.", item_data, True, 200)
			else:
				return response( "No Products found!", {}, False, 400)
		else:
			return response( "No Products found!", {}, False, 400)
	except Exception as e:
		frappe.log_error(frappe.get_traceback())
		return response(e, {}, False, 400)


@frappe.whitelist()
def get_item_by_brand():
	
		return_data = frappe.db.sql("""SELECT brand FROM `tabBrand`""",as_dict=True)
		if return_data:
			return response( "Success.", return_data, True, 200)
		else:
			return response( "No Products found!", {}, False, 400)
	
		
@frappe.whitelist()
def get_total_number_of_items(disabled=0, is_stock_item=1, brand=None, category=None, promotion=None):
	"""
		Used to get Total count of items
	"""
	try:
		total_count = 0
		item_filter = { 'disabled': disabled, 'is_stock_item': is_stock_item }
		if frappe.db.exists("Item", { 'disabled': disabled, 'is_stock_item': is_stock_item }):
			#To search item by brand
			if brand:
				item_filter['brand'] = ['like', '%'+brand+'%']
			#To search item by category
			if category:
				item_filter['category_list'] = category
			#To search item by promotions
			if promotion:
				item_filter['promotion_item'] = promotion
			total_count = frappe.db.count('Item', filters=item_filter)
		return response( "Success.", { 'total_count': total_count }, True, 200)

	except Exception as e:
		frappe.log_error(frappe.get_traceback())
		return response(e, {}, False, 400)


#Final API function for IHG Scan App

@frappe.whitelist()
def get_products_14(item_code = None,description = None,page_number=1, page_size=10, sort_order='asc', sort_type = 'price_list_rate', min_stock=None, max_stock=None,min_price = None,max_price = None, brand = [], showStockOnly = None, category = [], showPromotion = None):
    
	page_number = int(page_number)
	page_size = int(page_size)
	
	
	stock_filter = ''
	having_conditions = []
	if min_stock is not None:
		having_conditions.append('SUM(b.actual_qty) >= {min_stock}'.format(min_stock=int(min_stock)))
	if max_stock is not None:
		having_conditions.append('SUM(b.actual_qty) <= {max_stock}'.format(max_stock=int(max_stock)))
	if min_price is not None:
		having_conditions.append('ip.price_list_rate >= {min_price}'.format(min_price=int(min_price)))
	if max_price is not None:
		having_conditions.append('ip.price_list_rate <= {max_price}'.format(max_price=int(max_price)))
	if item_code:
		having_conditions.append("i.item_code LIKE '%{}%'".format(item_code))
	if description:
		having_conditions.append("i.description LIKE '%{}%'".format(description))
	if showStockOnly:
		having_conditions.append("SUM(b.actual_qty) > 0")
	if category:
		categories = category.split(',')
		categories = ["i.category_list LIKE '%{}%'".format(c) for c in categories]
		having_conditions.append("({})".format(' OR '.join(categories)))
	if brand:
		brands = brand.split(',')
		brands = ["i.brand LIKE '%{}%'".format(b) for b in brands]
		having_conditions.append("({})".format(' OR '.join(brands)))

	# filter by ware house
	#  ware house is in tabBin table 
	# Item table hasMany association with tabBin table


	if having_conditions:
		stock_filter = ' HAVING ' + ' AND '.join(having_conditions)
	
	start_index = (page_number - 1) * page_size
	end_index = start_index + page_size
	
	
	total_rows = frappe.db.count('Item')

	# if sort order is price_list_rate
	if sort_type == 'price_list_rate':
		sort_field = 'ip.price_list_rate ' + sort_order

	# if sort order is stock
	if sort_type == 'stock':
		sort_field = 'SUM(b.actual_qty) ' + sort_order
		
	query = frappe.db.sql('''
        SELECT
            i.item_code,
            i.description AS description,i.category_list,i.brand,
	    	i.image AS Image,ip.price_list_rate,
		    SUM(b.actual_qty) AS Stock
        FROM
            `tabItem` i
	     INNER JOIN
            `tabItem Price` ip ON i.name = ip.item_code
		INNER JOIN
		       `tabBin` b ON b.item_code = i.name
		
		WHERE ip.price_list = "RRP" AND i.disabled = 0
		       
        GROUP BY
        
		       i.item_code
       		 {stock_filter}
		ORDER BY
            {sort_field}
        LIMIT
            {start_index}, {page_size}
    '''.format(stock_filter=stock_filter,sort_field=sort_field, start_index=start_index, page_size=page_size),as_dict = True)


	if showPromotion:
		records = []
		for i in query:
			promo = frappe.db.get_value("Item Price", {"item_code": i.item_code, "price_list":"Promo"}, "price_list_rate")
			if promo:
				i["promo"] = promo
				records.append(i)
		query = records

	
	response = {
        'page_size': page_size,
        'page_number': page_number,
        'total_pages': (total_rows + page_size - 1) // page_size,
        'total_rows': total_rows,
        'page_rows': len(query),
        'items': query
    }
	
	return response



@frappe.whitelist()
def get_products_1(item_code = None,description = None,page_number=1, page_size=10, sort_order='asc', sort_type = 'price_list_rate', min_stock=None, max_stock=None,min_price = None,max_price = None, brand = None, showStockOnly = None, category = None, showPromotion = None,upcoming = None,new = None):
    
	page_number = int(page_number)
	page_size = int(page_size)
	
	
	stock_filter = ''
	having_conditions = []
	if min_stock is not None:
		having_conditions.append('SUM(b.actual_qty) >= {min_stock}'.format(min_stock=int(min_stock)))
	if max_stock is not None:
		having_conditions.append('SUM(b.actual_qty) <= {max_stock}'.format(max_stock=int(max_stock)))
	if min_price is not None:
		having_conditions.append('ip.price_list_rate >= {min_price}'.format(min_price=int(min_price)))
	if max_price is not None:
		having_conditions.append('ip.price_list_rate <= {max_price}'.format(max_price=int(max_price)))
	if item_code:
		having_conditions.append("i.item_code LIKE '%{}%'".format(item_code))
	if upcoming:
		having_conditions.append('upcoming_qty > 0')
	if description:
		having_conditions.append("i.description LIKE '%{}%'".format(description))
	if showStockOnly:
		having_conditions.append("SUM(b.actual_qty) > 0")
	if category:
		categories = category.split(',')
		categories = ["i.category_list LIKE '%{}%'".format(c) for c in categories]
		having_conditions.append("({})".format(' OR '.join(categories)))
	if brand:
		brands = brand.split(',')
		brands = ["i.brand LIKE '%{}%'".format(b) for b in brands]
		having_conditions.append("({})".format(' OR '.join(brands)))

	# filter by ware house
	#  ware house is in tabBin table 
	# Item table hasMany association with tabBin table


	if having_conditions:
		stock_filter = ' HAVING ' + ' AND '.join(having_conditions)
	
	start_index = (page_number - 1) * page_size
	end_index = start_index + page_size
	
	
	total_rows = frappe.db.count('Item')

	# if sort order is price_list_rate
	if sort_type == 'price_list_rate':
		sort_field = 'ip.price_list_rate ' + sort_order

	# if sort order is stock
	if sort_type == 'stock':
		sort_field = 'SUM(b.actual_qty) ' + sort_order
	
	if showPromotion is not None:
		price_list_condition = ('ip.price_list = "Promo"')
	else:
		price_list_condition = ('ip.price_list = "RRP"')


	query = frappe.db.sql('''
		WITH latest_schedule_dates AS (
			SELECT
				pi.item_code,
				MAX(pi.schedule_date) AS latest_schedule_date,
				(SUM(pi.qty) - SUM(pi.received_qty)) AS upcoming_qty
			FROM `tabPurchase Order` po
			JOIN `tabPurchase Order Item` pi ON po.name = pi.parent
			WHERE po.docstatus = 1 AND po.status = 'To Receive and Bill' AND po.is_internal_supplier = 0
			GROUP BY pi.item_code
		),
		new_schedule_dates AS (
			SELECT
				pri.item_code,
				MAX(pr.posting_date) AS new_schedule_date
				
			FROM `tabPurchase Receipt` pr
			JOIN `tabPurchase Receipt Item` pri ON pr.name = pri.parent
			WHERE pr.docstatus = 1
			GROUP BY pri.item_code
		)
		SELECT
			i.item_code AS "item_code",
			i.description AS "Description",
			i.image AS Image,
			i.category_list,
			i.product_type,
			i.short_descrition AS "short_descripion",
			i.brand AS "Brand",
			SUM(b.actual_qty) AS "Stock",
			ip.price_list_rate,
			lsd.latest_schedule_date,
			lsd.upcoming_qty,		
			nsd.new_schedule_date
		FROM
			`tabItem` AS i
		LEFT JOIN (
			SELECT
				item_code,
				SUM(actual_qty) AS actual_qty
			FROM
				`tabBin`
			GROUP BY
				item_code
		) AS b ON i.item_code = b.item_code
		LEFT JOIN
			`tabItem Price` AS ip ON i.name = ip.item_code
		LEFT JOIN
			latest_schedule_dates lsd ON i.item_code = lsd.item_code
		LEFT JOIN
			new_schedule_dates nsd ON i.item_code = nsd.item_code
		WHERE
			{price_list_condition}
							
		GROUP BY
				
					i.item_code
					{stock_filter}
				ORDER BY
					{sort_field}
				LIMIT
					{start_index}, {page_size}
		'''.format(price_list_condition=price_list_condition,stock_filter=stock_filter,sort_field=sort_field, start_index=start_index, page_size=page_size),as_dict =  True)
	if showPromotion is not None:
		for i in query:
			rrp = frappe.db.get_value("Item Price", {"item_code": i.item_code, "price_list":"RRP"}, "price_list_rate")
			promo = frappe.db.get_value("Item Price", {"item_code": i.item_code, "price_list":"Promo"}, "price_list_rate")
			if rrp:
				i["price_list_rate"] = rrp
				i["promo"] = promo
		
	else:

		for i in query:
			rrp = frappe.db.get_value("Item Price", {"item_code": i.item_code, "price_list":"Promo"}, "price_list_rate")
			if rrp:
				i["promo"] = rrp
			
		
		


	response = {
        'page_size': page_size,
        'page_number': page_number,
        'total_pages': (total_rows + page_size - 1) // page_size,
        'total_rows': total_rows,
        'page_rows': len(query),
        'items': query
    }
	
	return response


@frappe.whitelist()
def get_quotation_item_history(doc):
    if doc.get("item_code") and doc.get("customer"):
        filters = {
            "item_code": doc.item_code,
            "customer": doc.customer,
        }
        quotation_items = frappe.get_list("Quotation Item", filters=filters, order_by="creation desc", limit=5)
        data = []
        for item in quotation_items:
            data.append({
                "quotation_no": item.parent,
                "quoted_price": item.rate,
                "quantity": item.qty,
            })
        return data
    else:
        return []

@frappe.whitelist()
def get_item_prices(item_code, currency, customer=None, company=None):
    item_code = "'{0}'".format(item_code)
    currency = "'{0}'".format(currency)

    # Handle potential absence of 'unique_records' setting
    unique_records_value = frappe.db.get_value('CSF TZ Settings', None, 'unique_records')
    if unique_records_value is not None:
        unique_records = int(unique_records_value)
    else:
        unique_records = 0  # Or any other appropriate default

    prices_list = []
    unique_price_list = []
    max_records = 20

    if customer:
        conditions = " and SI.customer = '%s'" % customer
    else:
        conditions = ""

    query = """ SELECT SI.name, SI.posting_date, SI.customer, SIT.item_code, SIT.qty, SIT.rate
                 FROM `tabSales Invoice` AS SI 
                 INNER JOIN `tabSales Invoice Item` AS SIT ON SIT.parent = SI.name
                 WHERE 
                    SIT.item_code = {0} 
                    AND SIT.parent = SI.name
                    AND SI.docstatus=%s 
                    AND SI.currency = {2}
                    AND SI.is_return != 1
                    AND SI.company = '{3}'
                    {1}
                 ORDER by SI.posting_date DESC""".format(item_code, conditions, currency, company) % (1)

    items = frappe.db.sql(query, as_dict=True)
    for item in items:
        item_dict = {
            "name": item.item_code,
            "item_code": item.item_code,
            "price": item.rate,
            "date": item.posting_date,
            "invoice": item.name,
            "customer": item.customer,
            "qty": item.qty,
        }
        if unique_records == 1 and item.rate not in unique_price_list and len(prices_list) <= max_records:
            unique_price_list.append(item.rate)
            prices_list.append(item_dict)
        elif unique_records != 1 and item.rate and len(prices_list) <= max_records:
            prices_list.append(item_dict)
    return prices_list



@frappe.whitelist()
def get_item_prices_quotation(item_code, currency, customer=None, company=None):
    item_code = "'{0}'".format(item_code)
    currency = "'{0}'".format(currency)

    # Handle potential absence of 'unique_records' setting
    unique_records_value = frappe.db.get_value('CSF TZ Settings', None, 'unique_records')
    if unique_records_value is not None:
        unique_records = int(unique_records_value)
    else:
        unique_records = 0  # Or any other appropriate default

    prices_list = []
    unique_price_list = []
    max_records = 20

    if customer:
        conditions = " and SI.party_name = '%s'" % customer
    else:
        conditions = ""

    query = """ SELECT SI.name, SI.transaction_date, SI.party_name, SIT.item_code, SIT.qty, SIT.rate
                 FROM `tabQuotation` AS SI 
                 INNER JOIN `tabQuotation Item` AS SIT ON SIT.parent = SI.name
                 WHERE 
                    SIT.item_code = {0} 
                    AND SIT.parent = SI.name
                    AND SI.docstatus=%s 
                    AND SI.currency = {2}
                    AND SI.company = '{3}'
                    {1}
                 ORDER by SI.transaction_date DESC""".format(item_code, conditions, currency, company) % (1)

    items = frappe.db.sql(query, as_dict=True)
    for item in items:
        item_dict = {
            "name": item.item_code,
            "item_code": item.item_code,
            "price": item.rate,
            "date": item.transaction_date,
            "invoice": item.name,
            "customer": item.party_name,
            "qty": item.qty,
        }
        if unique_records == 1 and item.rate not in unique_price_list and len(prices_list) <= max_records:
            unique_price_list.append(item.rate)
            prices_list.append(item_dict)
        elif unique_records != 1 and item.rate and len(prices_list) <= max_records:
            prices_list.append(item_dict)
    return prices_list


import frappe

@frappe.whitelist(allow_guest=True)
def get_employees():
    employees = frappe.get_all('Employee', fields=['name', 'employee_name', 'designation', 'department', 'image'])
    return employees
def get_catalogs():
    catalogs = frappe.get_all('Catalogs and Profiles', fields=['name', 'cover_image', 'data_6'])

    for catalog in catalogs:
        # Add the full URL for the cover image and PDF
        catalog['cover_image_url'] = frappe.utils.get_url() + catalog['cover_image']
        catalog['pdf_url'] = frappe.utils.get_url() + catalog['data_6']

    return catalogs

@frappe.whitelist(allow_guest=True)
def get_items(page=1, page_size=10):
    # Convert page and page_size to integers
    page = int(page)
    page_size = int(page_size)
    
    # Calculate the offset and limit
    offset = (page - 1) * page_size
    limit = page_size
    
    # Query to fetch item details along with stock quantity with pagination
    items = frappe.db.sql("""
        SELECT
            i.item_code,
            i.item_name,
            i.description,
            i.image,
            i.brand,
            i.category,
            IFNULL(b.actual_qty, 0) AS stock_qty
        FROM
            `tabItem` i
        LEFT JOIN
            `tabBin` b ON i.item_code = b.item_code
        ORDER BY
            i.item_code
        LIMIT %s OFFSET %s
        """, (limit, offset), as_dict=True)
    
    # Get total count of items for pagination info
    total_items = frappe.db.count('Item')
    
    return {
        'items': items,
        'total_items': total_items,
        'page': page,
        'page_size': page_size
    }
@frappe.whitelist()
def get_product_details():
    try:
        query = """
        SELECT 
            product.item_code,
            product.item_name,
            product.brand,
            product.category,
            product.product_type,
            product.description,
            product.rrp,
            product.promo,
            total_qty.total_qty
        FROM 
            `tabProduct Details` AS product
        LEFT JOIN 
            (SELECT 
                item_code, 
                SUM(actual_qty) AS total_qty 
             FROM 
                `tabBin`
             GROUP BY 
                item_code
            ) AS total_qty
        ON 
            product.item_code = total_qty.item_code
        GROUP BY 
            product.item_code
        LIMIT 1000;
        """

        data = frappe.db.sql(query, as_dict=True)
        return data

    except Exception as e:
        frappe.throw(_("Error fetching product details: {0}").format(str(e)))
import frappe

@frappe.whitelist()
def get_conversion_ratio(customer):
	frappe.errprint("conversion_ratio")
	total_quotations = 0
	ordered_quotations = 0
	# Query to get the total number of quotations for the customer
	total_quotations_query = frappe.db.sql("""
        SELECT COUNT(*) FROM `tabQuotation`
        WHERE party_name = %s
        AND docstatus = 1
    """, (customer), as_dict=True)
	if total_quotations_query:
		total_quotations = total_quotations_query[0]['COUNT(*)']
	# Query to get the number of ordered quotations for the customer
	ordered_quotations_query = frappe.db.sql("""
        SELECT COUNT(*) FROM `tabQuotation`
        WHERE party_name = %s
        AND docstatus = 1
        AND status = 'Ordered'
    """, (customer), as_dict=True)
	if ordered_quotations_query:
		ordered_quotations = ordered_quotations_query[0]['COUNT(*)']
	# Calculate conversion ratio
	if total_quotations > 0:
		conversion_ratio = (ordered_quotations / total_quotations) * 100
		frappe.errprint("conversion_ratio")
		frappe.errprint(conversion_ratio)
	else:
		conversion_ratio = 0
	return {
        'conversion_ratio': conversion_ratio
    }



@frappe.whitelist()
def get_so_item(doctype, txt, searchfield, start, page_len, filters):
    parent = filters.get("parent")

    frappe.errprint(f"Fetching items for Sales Order: {parent}")
    results = frappe.db.sql("""
        SELECT item_code 
        FROM `tabSales Order Item` 
        WHERE parent = %(parent)s 
        AND item_code LIKE %(txt)s
    """, {
        "parent": parent,
        "txt": "%%%s%%" % txt 
    })
# AND item_code = 'Permit Service Charges'
    frappe.errprint(f"Results: {results}")
    return results


@frappe.whitelist()
def get_sales_order_item(doctype, txt, searchfield, start, page_len, filters):
    parent = filters.get("parent")

    frappe.errprint(f"Fetching items for Sales Order: {parent}")
    results = frappe.db.sql("""
        SELECT so.item_code
        FROM `tabSales Order Item` so
		JOIN `tabItem` it
		ON it.name = so.item_code
        WHERE so.parent = %(parent)s 
		AND it.custom_is_permit_charge_ = 1
        AND so.item_code LIKE %(txt)s
    """, {
        "parent": parent,
        "txt": "%%%s%%" % txt 
    })
# AND item_code = 'Permit Service Charges'
    frappe.errprint(f"Results: {results}")
    return results



@frappe.whitelist()
def get_rate(parent,item_code):
    frappe.errprint(f"Fetching items for Sales Order: {parent}")

    results = frappe.db.sql("""
        SELECT amount,rate,qty
        FROM `tabSales Order Item` 
        WHERE parent = %(parent)s 
        AND item_code =  %(item_code)s
    """, {
        "parent": parent,
        "item_code": item_code 
    },as_dict =1)
    return results


@frappe.whitelist()
def get_project_data(branch=None, customer=None, company=None, start_date=None, end_date=None, project_name=None, project=None, status=None):
    try:
        query = """
            SELECT 
                name AS project, 
                project_name, 
                status,
                customer, 
                branch, 
                company, 
                expected_start_date, 
                expected_end_date,
                custom_project_owner_name
            FROM 
                `tabProject`
            WHERE 
                1=1
        """
        conditions = []
        
        if branch:
            conditions.append(f"branch = '{branch}'")
        if company:
            conditions.append(f"company = '{company}'")
        if customer:
            conditions.append(f"customer = '{customer}'")
        if project_name:
            conditions.append(f"project_name LIKE '%{project_name}%'")
        if project:
            conditions.append(f"name = '{project}'")
        if status:
            conditions.append(f"status = '{status}'")
        
        # Adjusting date filtering to check for proper logic
        if start_date and end_date:
            conditions.append(f"expected_end_date BETWEEN '{start_date}' AND '{end_date}'")
        elif start_date:
            conditions.append(f"expected_end_date >= '{start_date}'")
        elif end_date:
            conditions.append(f"expected_end_date <= '{end_date}'")

        if conditions:
            query += " AND " + " AND ".join(conditions)

        # Log the generated query for debugging
        frappe.logger().info(f"Generated SQL Query: {query}")
        
        projects = frappe.db.sql(query, as_dict=True)
        
        return {"status": "success", "data": projects}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Error fetching project data"))
        return {"status": "error", "message": str(e)}

# @frappe.whitelist()
# def get_project_details(project_id):
# 	project = frappe.get_doc("Project", project_id)
# 	if project:
# 		frappe.errprint(project)
# 		return {
#             "status": "success",
#             "data": {
# 				"project":project.name,
#                 "project_name": project.project_name,
#                 "customer": project.customer,
#                 "branch": project.branch,
#                 "company": project.company,
#                 "status": project.status,
#                 "expected_start_date": project.expected_start_date,
#                 "expected_end_date": project.expected_end_date,
#                 "custom_project_owner_name": project.custom_project_owner_name,
#                 # Add any other fields you need
#             }
#         }
# 	else:
# 		return {
#             "status": "error",
#             "message": "Project not found."
#         }
# @frappe.whitelist()
# def get_project_details(project_id):
#     project = frappe.get_doc("Project", project_id)
    
#     if project:
#         # Fetch sales orders linked to the project
#         sales_orders = frappe.get_all("Sales Order", filters={"project": project_id}, fields=["name"])
        
#         # Initialize an empty list to hold order details
#         order_details = []
        
#         for order in sales_orders:
#             # Fetch items in the sales order
#             order_items = frappe.get_all("Sales Order Item", filters={"parent": order.name}, 
#                                           fields=["item_code", "qty"])
#             for item in order_items:
#                 # Fetch item details to get the image
#                 item_doc = frappe.get_doc("Item", item.item_code)
#                 order_details.append({
#                     "sales_order": order.name,
#                     "item_code": item.item_code,
#                     "qty": item.qty,
#                     "image": item_doc.image  # Assuming 'image' is the field name for item images
#                 })
        
#         return {
#             "status": "success",
#             "data": {
#                 "project": project.name,
#                 "project_name": project.project_name,
#                 "customer": project.customer,
#                 "branch": project.branch,
#                 "company": project.company,
#                 "status": project.status,
#                 "expected_start_date": project.expected_start_date,
#                 "expected_end_date": project.expected_end_date,
#                 "custom_project_owner_name": project.custom_project_owner_name,
#                 "sales_orders": order_details  # Include the sales order details here
#             }
#         }
#     else:
#         return {
#             "status": "error",
#             "message": "Project not found."
#         }
# @frappe.whitelist()
# def get_project_details(project_id):
#     project = frappe.get_doc("Project", project_id)
    
#     if project:
#         # Fetch sales orders linked to the project
#         sales_orders = frappe.get_all("Sales Order", filters={"project": project_id}, fields=["name"])
        
#         # Initialize an empty list to hold order details
#         order_details = []
        
#         for order in sales_orders:
#             # Fetch items in the sales order
#             order_items = frappe.get_all("Sales Order Item", filters={"parent": order.name}, 
#                                           fields=["item_code", "qty"])
#             for item in order_items:
#                 # Fetch item details to get the image
#                 item_doc = frappe.get_doc("Item", item.item_code)
#                 order_details.append({
#                     "sales_order": order.name,
#                     "item_code": item.item_code,
#                     "qty": item.qty,
#                     "image": item_doc.image  # Assuming 'image' is the field name for item images
#                 })
        
#         return {
#             "status": "success",
#             "data": {
#                 "project": project.name,
#                 "project_name": project.project_name,
#                 "customer": project.customer,
#                 "branch": project.branch,
#                 "company": project.company,
#                 "status": project.status,
#                 "expected_start_date": project.expected_start_date,
#                 "expected_end_date": project.expected_end_date,
#                 "custom_project_owner_name": project.custom_project_owner_name,
#                 "sales_orders": order_details  # Include the sales order details here
#             }
#         }
#     else:
#         return {
#             "status": "error",
#             "message": "Project not found."
#         }
@frappe.whitelist()
def get_sales_order_data(statuses=None, display_type='count'):
    """
    Fetch sales orders grouped by month with filter by status for a specific company and non-internal customers.
    
    Parameters:
        statuses (str): Comma-separated list of statuses to filter by.
        display_type (str): "count" for order count, "amount" for total amount.
        
    Returns:
        List of dictionaries with month, status, and respective count or total.
    """
    # Convert statuses to a list, or use None if not provided
    status_list = statuses.split(',') if statuses else None
    
    # Base query to fetch Sales Order data
    field = "COUNT(name)" if display_type == 'count' else "SUM(grand_total)"
    
    query = f"""
        SELECT 
            DATE_FORMAT(delivery_date, '%%M %%Y') AS month,
            status,
            {field} AS value
        FROM 
            `tabSales Order`
        WHERE 
            docstatus = 1
            AND company = 'METROPLUS ADVERTISING LLC'
            AND is_internal_customer = 0
    """
    
    # Add status filtering if statuses are provided
    if status_list:
        query += " AND status IN %(statuses)s"
    
    # Group by month and status and order by month (delivery_date)
    query += " GROUP BY month, status ORDER BY MIN(delivery_date) ASC"
    
    # Execute the query
    data = frappe.db.sql(query, {'statuses': status_list}, as_dict=True)
    
    # Process and return data
    return data

@frappe.whitelist()
def get_project_details1(project_id):
	project = frappe.get_doc("Project", project_id)
	if project:
		# Fetch related Sales Orders
		sales_orders = frappe.get_all(
            "Sales Order",
            filters={"project": project.name},
            fields=["name as sales_order","status"]
        )
		sales_order_details = []
		for order in sales_orders:
			# Fetch items for each sales order
			items = frappe.get_all(
                "Sales Order Item",
                filters={"parent": order.sales_order},
                fields=["item_code", "qty", "image"]
            )
			sales_order_details.append({
                "sales_order": order.sales_order,
				"status":order.status,
                "items": items
			})
		# Fetch related Purchase Orders
		# purchase_orders = frappe.get_all("Purchase Order", filters={"project": project.name}, fields=["name as purchase_order", "status"])
		# Fetch related Material Requests
		material_requests = frappe.get_all("Material Request", filters={"project": project.name}, fields=["name as material_request", "status"])
		delivery_note = frappe.get_all("Delivery Note", filters={"project": project.name}, fields=["name as delivery_note", "status"])
		# Fetch related Work Orders
		work_orders = frappe.get_all("Work Order", filters={"project": project.name}, fields=["name as work_order", "status"])
		# Fetch related Job Cards
		job_cards = frappe.get_all("Job Card", filters={"project": project.name}, fields=["name as job_card", "status"])
		sales_invoice = frappe.get_all("Sales Invoice", filters={"project": project.name}, fields=["name as sales_invoice", "status"])
		
		purchase_orders = frappe.db.sql("""
				SELECT 
					po.status,po.name as purchase_order
				FROM `tabPurchase Order` po
				JOIN `tabPurchase Order Item` pi ON po.name = pi.parent
				WHERE pi.project = %s
				GROUP BY po.name
			""", (project.name), as_dict=True)
		
		income_entries = frappe.db.sql("""
				SELECT 
					gl.account, 
					SUM(gl.credit - gl.debit) AS amount
				FROM `tabGL Entry` gl
				JOIN `tabAccount` acc ON gl.account = acc.name
				WHERE gl.project = %s
			""", (project.name), as_dict=True)
		
		
		expense_entries = frappe.db.sql("""
				SELECT 
					gl.account, 
					SUM(gl.debit - gl.credit) AS amount
				FROM `tabGL Entry` gl
				JOIN `tabAccount` acc ON gl.account = acc.name
				WHERE gl.project = %s AND acc.root_type = 'Expense'
				GROUP BY gl.account
			""", (project.name), as_dict=True)
		
		if income_entries:
			total_income = sum(entry["amount"] for entry in income_entries)
			income_acc_list = {entry['account']: entry['amount'] for entry in income_entries}
		if expense_entries:
			total_expense = sum(entry["amount"] for entry in expense_entries)
			accounts_list = {entry['account']: entry['amount'] for entry in expense_entries}
		frappe.errprint(accounts_list)
		
		profit_loss = total_income - total_expense

		# Calculate profit margin percentage
		profit_margin_percentage = (profit_loss / total_income * 100) if total_income > 0 else 0


		return {
            "status": "success",
            "data": {
                "project": project.name,
                "project_name": project.project_name,
                "customer": project.customer,
                "branch": project.branch,
                "company": project.company,
                "status": project.status,
                "expected_start_date": project.expected_start_date,
                "expected_end_date": project.expected_end_date,
                "custom_project_owner_name": project.custom_project_owner_name,
                "sales_orders": sales_order_details,
                "purchase_orders": purchase_orders,
				"delivery_note":delivery_note,
                "material_requests": material_requests,
                "work_orders": work_orders,
                "job_cards": job_cards,
				"sales_invoice":sales_invoice,
				"total_income": total_income,
				"total_expense":total_expense,
				"profit_loss":profit_loss,
				"profit_margin_percentage":profit_margin_percentage,
				"income_acc_list":income_entries,
				"accounts_list":expense_entries

            }
        }
	else:
		return {
            "status": "error",
            "message": "Project not found."
        }

@frappe.whitelist()
def get_sales_orders():
    try:
        # Define common filters for base query
        base_filters = {
            "company": "METROPLUS ADVERTISING LLC",
            "status": ["not in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0
        }

        # Get date boundaries for the current month
        current_month_start = get_first_day(nowdate())
        current_month_end = get_last_day(nowdate())

        # Define date filters for previous, current, and future months
        previous_months_filters = {**base_filters, "delivery_date": ["<", current_month_start]}
        current_month_filters = {**base_filters, "delivery_date": ["between", [current_month_start, current_month_end]]}
        future_months_filters = {**base_filters, "delivery_date": [">", current_month_end]}

        # Function to calculate per_bill safely
        def calculate_per_bill(orders):
            return sum(order["grand_total"] * (1 - (order.get("per_billed", 0) / 100)) for order in orders)

        # Query and aggregate data for each period
        previous_months_orders = frappe.get_all("Sales Order", filters=previous_months_filters, fields=["grand_total", "per_billed"])
        current_month_orders = frappe.get_all("Sales Order", filters=current_month_filters, fields=["grand_total", "per_billed"])
        future_months_orders = frappe.get_all("Sales Order", filters=future_months_filters, fields=["grand_total", "per_billed"])

        # Calculate counts and totals for previous, current, and future periods
        previous_count = len(previous_months_orders)
        previous_total = sum(order["grand_total"] for order in previous_months_orders)
        prev_per_bill = calculate_per_bill(previous_months_orders)

        current_count = len(current_month_orders)
        current_total = sum(order["grand_total"] for order in current_month_orders)
        current_per_bill = calculate_per_bill(current_month_orders)

        future_count = len(future_months_orders)
        future_total = sum(order["grand_total"] for order in future_months_orders)
        future_per_bill = calculate_per_bill(future_months_orders)

        # Define filters for "Hold" status sales orders
        hold_status_filters = {
            "company": "METROPLUS ADVERTISING LLC",
            "status": "On Hold",
            "docstatus": 1,
            "is_internal_customer": 0
        }

        # Query sales orders with "Hold" status
        hold_status_orders = frappe.get_all("Sales Order", filters=hold_status_filters, fields=["grand_total", "per_billed"])

        # Calculate count and total for "Hold" status orders
        hold_count = len(hold_status_orders)
        hold_total = sum(order["grand_total"] for order in hold_status_orders)
        hold_per_bill = calculate_per_bill(hold_status_orders)

        # Query all sales orders based on the base filter for total summary
        all_sales_orders = frappe.get_all("Sales Order", filters=base_filters, fields=["grand_total", "per_billed"])

        # Calculate overall count and total for all matching sales orders
        all_orders_count = len(all_sales_orders)
        all_orders_total = sum(order["grand_total"] for order in all_sales_orders)
        all_per_bill = calculate_per_bill(all_sales_orders)

        # Define filters for completed sales orders within the current month
        completed_status_filters = {
            "company": "METROPLUS ADVERTISING LLC",
            "status": ["in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
            "delivery_date": ["between", [current_month_start, current_month_end]]
        }

        # Query sales orders with "Completed" or "Closed" status for the current month
        completed_orders = frappe.get_all("Sales Order", filters=completed_status_filters, fields=["grand_total", "per_billed"])

        # Calculate count and total for completed sales orders in the current month
        completed_count = len(completed_orders)
        completed_total = sum(order["grand_total"] for order in completed_orders)
        completed_per_bill = calculate_per_bill(completed_orders)

        # Fetch all sales orders with initial details
        sales_orders = frappe.get_all(
            "Sales Order",
            fields=["name", "customer", "delivery_date", "status", "grand_total", "payment_terms_template", "per_delivered", "per_billed", "project", "transaction_date", "branch"],
            filters=base_filters
        )

        # Calculate "To Bill" amount and add sales person information to each sales order
        for so in sales_orders:
            so['to_bill_amount'] = so['grand_total'] - (so['grand_total'] * (so.get('per_billed', 0) / 100))
            
            # Fetch sales team details
            sales_team = frappe.get_all(
                "Sales Team",
                filters={"parenttype": "Sales Order", "parent": so['name']},
                fields=["sales_person"]
            )
            
            # If there are sales team members, fetch employee details from Sales Person table
            if sales_team:
                sales_person_ids = [st['sales_person'] for st in sales_team]
                sales_person_details = frappe.get_all(
                    "Sales Person",
                    filters={"name": ["in", sales_person_ids]},
                    fields=["employee", "department"]
                )
                
                # Map employee and image details to the sales orders
                so['sales_person_info'] = []
                for sp in sales_person_details:
                    so['sales_person_info'].append({
                        "employee": sp.get("employee"),
                        "department": sp.get("department")
                    })
            else:
                so['sales_person_info'] = []

        # Return data with additional summaries
        return {
            "status": "success",
            "data": sales_orders,
            "summaries": {
                "all_sales_orders": {"count": all_orders_count, "total": all_orders_total, "per_bill": all_per_bill},
                "previous_months": {"count": previous_count, "total": previous_total, "per_bill": prev_per_bill},
                "current_month": {"count": current_count, "total": current_total, "per_bill": current_per_bill},
                "future_months": {"count": future_count, "total": future_total, "per_bill": future_per_bill},
                "hold_status": {"count": hold_count, "total": hold_total, "per_bill": hold_per_bill},
                "completed_orders_current_month": {"count": completed_count, "total": completed_total, "per_bill": completed_per_bill}
            }
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Error fetching sales orders"))
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def get_sales_orders1(sales_team=None, sales_person=None):
    try:
        base_filters = {
            "company": "METROPLUS ADVERTISING LLC",
            "status": ["not in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
        }

        if sales_team:
            # Get salespersons under the given sales team
            sales_persons = frappe.get_all(
                "Sales Person",
                filters={"parent_sales_person": sales_team},
                fields=["name"]
            )
            # Extract salesperson names
            sales_person_names = [sp["name"] for sp in sales_persons]

            if sales_person_names:
                # Find sales orders linked to these salespersons
                sales_order_names = frappe.get_all(
                    "Sales Team",
                    filters={"sales_person": ["in", sales_person_names]},
                    fields=["parent"]
                )
                sales_order_names = [so["parent"] for so in sales_order_names]

                if sales_order_names:
                    base_filters["name"] = ["in", sales_order_names]
                else:
                    # No sales orders found for the sales team
                    return {
                        "status": "success",
                        "data": [],
                        "sales_team": sales_team,
                        "summaries": {}
                    }
            else:
                # No salespersons found for the sales team
                return {
                    "status": "success",
                    "data": [],
                    "sales_team": sales_team,
                    "summaries": {}
                }

        # Get the list of Sales Order names that match the sales_person
        if sales_person:
            sales_order_names = frappe.get_all(
                "Sales Team",
                filters={"sales_person": sales_person},
                fields=["parent"]
            )
            # Extract the parent sales order names
            sales_order_names = [so["parent"] for so in sales_order_names]

            if sales_order_names:
                base_filters["name"] = ["in", sales_order_names]
            else:
                # If no sales orders are found for the salesperson, return early
                return {
                    "status": "success",
                    "data": [],
                    "summaries": {}
                }

        # Get date boundaries for the current month
        current_month_start = get_first_day(nowdate())
        current_month_end = get_last_day(nowdate())

        # Define date filters for previous, current, and future months
        previous_months_filters = {**base_filters, "delivery_date": ["<", current_month_start]}
        current_month_filters = {**base_filters, "delivery_date": ["between", [current_month_start, current_month_end]]}
        future_months_filters = {**base_filters, "delivery_date": [">", current_month_end]}
        hold_status_filters = {**base_filters, "status": "On Hold","is_internal_customer":0}

        # Function to calculate per_bill safely
        def calculate_per_bill(orders):
            return sum(order["grand_total"] * (1 - (order.get("per_billed", 0) / 100)) for order in orders)

        # Query and aggregate data for each period
        previous_months_orders = frappe.get_all("Sales Order", filters=previous_months_filters, fields=["grand_total", "per_billed"])
        current_month_orders = frappe.get_all("Sales Order", filters=current_month_filters, fields=["grand_total", "per_billed"])
        future_months_orders = frappe.get_all("Sales Order", filters=future_months_filters, fields=["grand_total", "per_billed"])

        # Calculate counts and totals for previous, current, and future periods
        previous_count = len(previous_months_orders)
        previous_total = sum(order["grand_total"] for order in previous_months_orders)
        prev_per_bill = calculate_per_bill(previous_months_orders)

        current_count = len(current_month_orders)
        current_total = sum(order["grand_total"] for order in current_month_orders)
        current_per_bill = calculate_per_bill(current_month_orders)

        future_count = len(future_months_orders)
        future_total = sum(order["grand_total"] for order in future_months_orders)
        future_per_bill = calculate_per_bill(future_months_orders)

        # Query sales orders with "Hold" status
        hold_status_orders = frappe.get_all("Sales Order", filters=hold_status_filters, fields=["grand_total", "per_billed"])

        # Calculate count and total for "Hold" status orders
        hold_count = len(hold_status_orders)
        hold_total = sum(order["grand_total"] for order in hold_status_orders)
        hold_per_bill = calculate_per_bill(hold_status_orders)

        # Query all sales orders based on the base filter for total summary
        all_sales_orders = frappe.get_all("Sales Order", filters=base_filters, fields=["grand_total", "per_billed"])

        # Calculate overall count and total for all matching sales orders
        all_orders_count = len(all_sales_orders)
        all_orders_total = sum(order["grand_total"] for order in all_sales_orders)
        all_per_bill = calculate_per_bill(all_sales_orders)

        # Define filters for completed sales orders within the current month
        completed_status_filters = {
            "company": "METROPLUS ADVERTISING LLC",
            "status": ["in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
            "delivery_date": ["between", [current_month_start, current_month_end]]
        }

        # Query sales orders with "Completed" or "Closed" status for the current month
        completed_orders = frappe.get_all("Sales Order", filters=completed_status_filters, fields=["grand_total", "per_billed"])

        # Calculate count and total for completed sales orders in the current month
        completed_count = len(completed_orders)
        completed_total = sum(order["grand_total"] for order in completed_orders)
        completed_per_bill = calculate_per_bill(completed_orders)

        # Fetch all sales orders with initial details
        sales_orders = frappe.get_all(
            "Sales Order",
            fields=["name", "customer", "delivery_date", "status", "grand_total", "payment_terms_template", "per_delivered", "per_billed", "project", "transaction_date"],
            filters=base_filters
        )

        # Calculate "To Bill" amount and add sales person information to each sales order
        for so in sales_orders:
            so['to_bill_amount'] = so['grand_total'] - (so['grand_total'] * (so.get('per_billed', 0) / 100))
            sales_team = frappe.get_all(
                "Sales Team",
                filters={"parenttype": "Sales Order", "parent": so['name']},
                fields=["sales_person"]
            )
            so['sales_person'] = [st['sales_person'] for st in sales_team]

        # Return data with additional summaries
        return {
            "status": "success",
            "data": sales_orders,
            "summaries": {
                "all_sales_orders": {"count": all_orders_count, "total": all_orders_total, "per_bill": all_per_bill},
                "previous_months": {"count": previous_count, "total": previous_total, "per_bill": prev_per_bill},
                "current_month": {"count": current_count, "total": current_total, "per_bill": current_per_bill},
                "future_months": {"count": future_count, "total": future_total, "per_bill": future_per_bill},
                "hold_status": {"count": hold_count, "total": hold_total, "per_bill": hold_per_bill},
                "completed_orders_current_month": {"count": completed_count, "total": completed_total, "per_bill": completed_per_bill}
            }
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Error fetching sales orders"))
        return {
            "status": "error",
            "message": str(e)
        }



@frappe.whitelist()
def get_daily_sales_summary(branch=None, sales_person=None, company=None):
    frappe.errprint(f"Branch: {branch}, Sales Person: {sales_person}, Company: {company}")
    try:
        # Base filters
        base_filters = {
            "si.docstatus": 1,
            "si.is_internal_customer": 0,
        }

        # Initialize additional conditions and values for query parameters
        additional_conditions = []
        values = []

        # Add conditions for branch, sales person, and company
        if branch:
            additional_conditions.append("si.branch = %s")
            values.append(branch)
        if sales_person:
            additional_conditions.append("st.sales_person = %s")
            values.append(sales_person)
        if company:
            additional_conditions.append("si.company = %s")
            values.append(company)

        # Combine conditions for the SQL query
        conditions = " AND ".join(additional_conditions) if additional_conditions else "1=1"

        # Query for pre_date summary
        pre_date = frappe.db.sql(f"""
            SELECT 
                SUM(si.grand_total) AS daily_total,
                st.sales_person,              
                sp.custom_monthly_target AS total_target,
                spn.employee,
                emp.image,
                emp.employee_name,
                emp.name AS emp,
                si.posting_date
            FROM 
                `tabSales Invoice` si
            JOIN
                `tabSales Team` st ON si.name = st.parent
            JOIN
                `tabSales Person Target` sp ON st.sales_person = sp.sales_person
            JOIN
                `tabSales Person` spn ON spn.name = st.sales_person
            JOIN
                `tabEmployee` emp ON emp.name = spn.employee
            WHERE 
                sp.docstatus = 1 AND
                si.docstatus = 1 AND 
                si.is_internal_customer = 0 AND {conditions}
            GROUP BY 
                st.sales_person, si.posting_date
            ORDER BY 
                st.sales_person
        """, values, as_dict=True)

        # Query for daily sales data
        sales_data = frappe.db.sql(f"""
            SELECT 
                si.posting_date,
                si.company,
                si.branch,
                SUM(si.grand_total) AS daily_total,
                SUM(payment_summary.amount) AS amount,
				bt.monthly_target AS branch_target
            FROM 
                `tabSales Invoice` si
            LEFT JOIN 
                `tabSales Team` st ON si.name = st.parent
			 LEFT JOIN 
                `tabBranch Target` bt ON si.branch = bt.branch
            LEFT JOIN 
                (
                    SELECT 
                        against_voucher_no, 
                        SUM(amount) AS amount
                    FROM 
                        `tabPayment Ledger Entry`
                    GROUP BY 
                        against_voucher_no
                ) AS payment_summary ON payment_summary.against_voucher_no = si.name
            WHERE 
                {conditions} AND 
                si.docstatus = 1 AND 
                si.is_internal_customer = 0
            GROUP BY 
                si.posting_date, si.company, si.branch
            ORDER BY 
                si.posting_date
        """, values, as_dict=True)

        # Consolidated employee data for `pre_date` if sales_person is provided
        if sales_person:
            target = frappe.db.get_value("Sales Person Target", {"sales_person": sales_person}, "custom_monthly_target")
            emp_data = frappe.db.get_value("Sales Person", {"name": sales_person}, ["employee", "name"], as_dict=True)

        # Return results
        return {
            "status": "success",
            "data": sales_data,
            "pre_date": pre_date,
            "branch": branch,
            "sales_person": sales_person,
            "company": company
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Error fetching daily sales summary"))
        return {
            "status": "error",
            "message": str(e)
        }


@frappe.whitelist()
def get_daywise_profit_loss(start_date, end_date):
    data = frappe.db.sql("""
        SELECT 
            gl.posting_date AS posting_date,
            acc.account_name AS account_name,
            acc.parent_account AS parent_account,
            acc.root_type AS root_type,
            SUM(gl.credit) AS total_credit,
            SUM(gl.debit) AS total_debit,
            CASE 
                WHEN acc.root_type = 'Income' THEN SUM(gl.credit - gl.debit)
                WHEN acc.root_type = 'Expense' THEN SUM(gl.debit - gl.credit)
                ELSE 0
            END AS profit_loss
        FROM 
            `tabGL Entry` gl
        JOIN 
            `tabAccount` acc ON gl.account = acc.name
        WHERE 
            gl.posting_date BETWEEN %s AND %s
            AND gl.docstatus < 2
        GROUP BY 
            gl.posting_date, acc.account_name, acc.parent_account, acc.root_type
        ORDER BY 
            gl.posting_date ASC, acc.root_type ASC, acc.account_name ASC
    """, (start_date, end_date), as_dict=True)

    result = []

    # Process the data to organize by date, root_type (Income/Expense), and account
    daywise_data = {}

    for row in data:
        date_str = str(row.posting_date)  # Convert the posting_date to string to use as the key
        
        account_data = {
            "account_name": row.account_name,
            "credit": flt(row.total_credit),
            "debit": flt(row.total_debit),
            "profit_loss": flt(row.profit_loss)
        }

        if date_str not in daywise_data:
            daywise_data[date_str] = {
                "date": date_str,
                "income": [],
                "expense": [],
                "net_profit_loss": 0.00
            }

        if row.root_type == "Income":
            daywise_data[date_str]["income"].append(account_data)
            daywise_data[date_str]["net_profit_loss"] += flt(row.profit_loss)

        elif row.root_type == "Expense":
            daywise_data[date_str]["expense"].append(account_data)
            daywise_data[date_str]["net_profit_loss"] -= flt(row.profit_loss)

    # Convert the dictionary values to a list
    result = list(daywise_data.values())

    return result


@frappe.whitelist()
def get_collection_summary(branch=None):
    frappe.errprint(f"Branch: {branch}")  # Debugging line
    
    try:
        sales_data = frappe.db.sql(f"""
            SELECT 
                si.branch,
                sp.mode_of_payment,
                si.posting_date,
                SUM(sp.amount) AS amount
            FROM `tabSales Invoice` si
            JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent
            WHERE si.docstatus = 1
            GROUP BY si.branch, sp.mode_of_payment, si.posting_date
            UNION ALL
            SELECT 
                po.branch,
                py.mode_of_payment,
                py.posting_date,
                SUM(py.paid_amount) AS amount
            FROM `tabPayment Entry` py
            JOIN `tabPOS Profile` po ON py.pos_profile = po.name
            WHERE py.payment_type = 'Receive'
                AND py.docstatus = 1
            GROUP BY po.branch, py.mode_of_payment, py.posting_date
        """, as_dict=True)

        # Initialize a dictionary to store aggregated payment data by branch and date
        result = {}

        for record in sales_data:
            branch = record['branch']
            posting_date = record['posting_date']
            mode_of_payment = record['mode_of_payment']
            amount = record['amount']

            if branch not in result:
                result[branch] = {}

            if posting_date not in result[branch]:
                result[branch][posting_date] = {
                    'cash': 0,
                    'card': 0,
                    'cheque': 0,
                    'credit': 0,
                    'wired_transfer': 0,
                    'pdc': 0,
                    'total': 0
                }

            # Add the amount to the correct payment mode
            if mode_of_payment:
                if "Cash" in mode_of_payment:
                    result[branch][posting_date]['cash'] += amount
                elif "Card" in mode_of_payment:
                    result[branch][posting_date]['card'] += amount
                elif "Cheque" in mode_of_payment:
                    frappe.errprint("posting_date")
                    if posting_date <= (datetime.strptime(frappe.utils.today(), "%Y-%m-%d").date()):
                        result[branch][posting_date]['cheque'] += amount
                    else:
                        result[branch][posting_date]['pdc'] += amount
                elif "Credit" in mode_of_payment:
                    result[branch][posting_date]['credit'] += amount
                elif "Wire Transfer" in mode_of_payment:
                    result[branch][posting_date]['wired_transfer'] += amount

            result[branch][posting_date]['total'] += amount

        # Flatten the result into a list for easy presentation
        final_data = []
        for branch, dates in result.items():
            for posting_date, amounts in dates.items():
                final_data.append({
                    'branch': branch,
                    'pos_profile': frappe.db.get_value("POS Profile", {"branch": branch}, "name") or " ",
                    'posting_date': posting_date,
                    'cash': amounts['cash'],
                    'card': amounts['card'],
                    'cheque': amounts['cheque'],
                    'credit': amounts['credit'],
                    'wired_transfer': amounts['wired_transfer'],
                    'pdc': amounts['pdc'],
                    'total': amounts['total']
                })

        # Return results
        return {
            "status": "success",
            "data": final_data,
        }
    
    except Exception as e:
        # Log error and return message
        frappe.log_error(frappe.get_traceback(), _("Error fetching daily sales summary"))
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def get_monthly_data(year, month):
    return frappe.db.sql("""
        SELECT branch, 
               SUM(grand_total) AS cash, 
        FROM `tabSales Invoice` 
        WHERE YEAR(posting_date) = %s AND MONTH(posting_date) = %s
        GROUP BY branch
    """, (year, month), as_dict=True)
@frappe.whitelist()
def get_delivery_schedule():
    try:
        # Fetch all records from the Delivery Schedule doctype
        delivery_schedule_entries = frappe.get_all(
            "Delivery Schedule",
            fields=["*"]  # Fetch all fields; you can specify specific fields if needed
        )
        return {"status": "success", "data": delivery_schedule_entries}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to fetch delivery schedule"))
        return {"status": "error", "message": str(e)}
import frappe

@frappe.whitelist()
def get_workflow_summary(filters=None):
    """
    Fetch the summary and list of documents in various workflow states.
    """
    if filters:
        filters = frappe.parse_json(filters)
    else:
        filters = {}

    doctype_list = [
        "Final Settlement",
        "Employee Salary Increment",
        "Leave Airticket Request",
        "Promotion",
        "Contract Renewal Form",
        "Onboarding Form",
        "Request Form",
        "Appointment Letter",
        "Payroll Entry",
        "Performance Appraisal Form",
        "Loan Application",
        "Additional Duty",
        "Supplier Quotation"
    ]

    result = []
    for doctype in doctype_list:
        states = frappe.get_all(
            doctype, 
            fields=["workflow_state", "COUNT(*) as count"], 
            filters=filters, 
            group_by="workflow_state"
        )
        result.append({
            "doctype": doctype,
            "states": states
        })

    return result


@frappe.whitelist()
def get_sales_orders_ldw(sales_team=None, sales_person=None):
    try:
        base_filters = {
            "company": "LED WORLD LLC",
			"branch":"LEDWORLD - PROJECTS",
            "status": ["not in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
        }

        if sales_team:
            
            sales_persons = frappe.get_all(
                "Sales Person",
                filters={"parent_sales_person": sales_team},
                fields=["name"]
            )
           
            sales_person_names = [sp["name"] for sp in sales_persons]

            if sales_person_names:
                
                sales_order_names = frappe.get_all(
                    "Sales Team",
                    filters={"sales_person": ["in", sales_person_names]},
                    fields=["parent"]
                )
                sales_order_names = [so["parent"] for so in sales_order_names]

                if sales_order_names:
                    base_filters["name"] = ["in", sales_order_names]
                else:
                    
                    return {
                        "status": "success",
                        "data": [],
                        "sales_team": sales_team,
                        "summaries": {}
                    }
            else:
               
                return {
                    "status": "success",
                    "data": [],
                    "sales_team": sales_team,
                    "summaries": {}
                }

       
        if sales_person:
            sales_order_names = frappe.get_all(
                "Sales Team",
                filters={"sales_person": sales_person},
                fields=["parent"]
            )
           
            sales_order_names = [so["parent"] for so in sales_order_names]

            if sales_order_names:
                base_filters["name"] = ["in", sales_order_names]
            else:
                # If no sales orders are found for the salesperson, return early
                return {
                    "status": "success",
                    "data": [],
                    "summaries": {}
                }

        
        current_month_start = get_first_day(nowdate())
        current_month_end = get_last_day(nowdate())

        
        previous_months_filters = {**base_filters, "delivery_date": ["<", current_month_start]}
        current_month_filters = {**base_filters, "delivery_date": ["between", [current_month_start, current_month_end]]}
        future_months_filters = {**base_filters, "delivery_date": [">", current_month_end]}
        hold_status_filters = {**base_filters, "status": "On Hold","is_internal_customer":0}

       
        def calculate_per_bill(orders):
            return sum(order["grand_total"] * (1 - (order.get("per_billed", 0) / 100)) for order in orders)

        
        previous_months_orders = frappe.get_all("Sales Order", filters=previous_months_filters, fields=["grand_total", "per_billed"])
        current_month_orders = frappe.get_all("Sales Order", filters=current_month_filters, fields=["grand_total", "per_billed"])
        future_months_orders = frappe.get_all("Sales Order", filters=future_months_filters, fields=["grand_total", "per_billed"])

       
        previous_count = len(previous_months_orders)
        previous_total = sum(order["grand_total"] for order in previous_months_orders)
        prev_per_bill = calculate_per_bill(previous_months_orders)

        current_count = len(current_month_orders)
        current_total = sum(order["grand_total"] for order in current_month_orders)
        current_per_bill = calculate_per_bill(current_month_orders)

        future_count = len(future_months_orders)
        future_total = sum(order["grand_total"] for order in future_months_orders)
        future_per_bill = calculate_per_bill(future_months_orders)

        
        hold_status_orders = frappe.get_all("Sales Order", filters=hold_status_filters, fields=["grand_total", "per_billed"])

        
        hold_count = len(hold_status_orders)
        hold_total = sum(order["grand_total"] for order in hold_status_orders)
        hold_per_bill = calculate_per_bill(hold_status_orders)

        
        all_sales_orders = frappe.get_all("Sales Order", filters=base_filters, fields=["grand_total", "per_billed"])

      
        all_orders_count = len(all_sales_orders)
        all_orders_total = sum(order["grand_total"] for order in all_sales_orders)
        all_per_bill = calculate_per_bill(all_sales_orders)

        
        completed_status_filters = {
            "company": "LED WORLD LLC",
			"branch":"LEDWORLD - PROJECTS",
            "status": ["not in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
            "delivery_date": ["between", [current_month_start, current_month_end]]
        }

        
        completed_orders = frappe.get_all("Sales Order", filters=completed_status_filters, fields=["grand_total", "per_billed"])

        
        completed_count = len(completed_orders)
        completed_total = sum(order["grand_total"] for order in completed_orders)
        completed_per_bill = calculate_per_bill(completed_orders)

        
        sales_orders = frappe.get_all(
            "Sales Order",
            fields=["name", "customer", "delivery_date", "status", "grand_total", "payment_terms_template", "per_delivered", "per_billed", "project", "transaction_date"],
            filters=base_filters
        )

        
        for so in sales_orders:
            so['to_bill_amount'] = so['grand_total'] - (so['grand_total'] * (so.get('per_billed', 0) / 100))
            sales_team = frappe.get_all(
                "Sales Team",
                filters={"parenttype": "Sales Order", "parent": so['name']},
                fields=["sales_person"]
            )
            so['sales_person'] = [st['sales_person'] for st in sales_team]

        return {
            "status": "success",
            "data": sales_orders,
            "summaries": {
                "all_sales_orders": {"count": all_orders_count, "total": all_orders_total, "per_bill": all_per_bill},
                "previous_months": {"count": previous_count, "total": previous_total, "per_bill": prev_per_bill},
                "current_month": {"count": current_count, "total": current_total, "per_bill": current_per_bill},
                "future_months": {"count": future_count, "total": future_total, "per_bill": future_per_bill},
                "hold_status": {"count": hold_count, "total": hold_total, "per_bill": hold_per_bill},
                "completed_orders_current_month": {"count": completed_count, "total": completed_total, "per_bill": completed_per_bill}
            }
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Error fetching sales orders"))
        return {
            "status": "error",
            "message": str(e)
        }



@frappe.whitelist()
def get_sales_order_data_ldw(statuses=None, display_type='count'):
    status_list = statuses.split(',') if statuses else None
    field = "COUNT(name)" if display_type == 'count' else "SUM(grand_total)"
    
    query = f"""
        SELECT 
            DATE_FORMAT(delivery_date, '%%M %%Y') AS month,
            status,
            {field} AS value
        FROM 
            `tabSales Order`
        WHERE 
            docstatus = 1
			AND company = 'LED WORLD LLC'
            AND branch = 'LEDWORLD - PROJECTS'
            AND is_internal_customer = 0
    """
    
    if status_list:
        query += " AND status IN %(statuses)s"
    query += " GROUP BY month, status ORDER BY MIN(delivery_date) ASC"
    data = frappe.db.sql(query, {'statuses': status_list}, as_dict=True)
    return data

@frappe.whitelist()
def production_design_creation(name):
	prd = frappe.new_doc("Production Design")
	prd.design_number = name  
	# prd.insert()
	return prd

# Fast Moving List
@frappe.whitelist()
def get_fast_moving_products(limit=1000):
    """
    Fetch the top N fast-moving products based on a refined score, item details, and actual stock.
    
    Args:
    limit (int): Number of products to fetch. Default is 1000.
    
    Returns:
    List[Dict]: A list of dictionaries containing product details, including actual stock.
    """
    query = """
        SELECT 
            sii.item_code AS `Item Code`,
            sii.item_name AS `Item Name`,
            sii.description AS `Description`,
            sii.stock_uom AS `UOM`,
            SUM(sii.qty) AS `Total Quantity Sold`,
            COUNT(DISTINCT sii.parent) AS `Transaction Count`,
            (COUNT(DISTINCT sii.parent) * SUM(sii.qty))/1000 AS `Fast-Moving Score`,
            ti.brand AS `Brand`,
            ti.category AS `Category`,
            ti.image AS `Image`,
            (SELECT COALESCE(SUM(actual_qty), 0) 
             FROM `tabBin` 
             WHERE item_code = sii.item_code) AS `Actual Stock`
        FROM 
            `tabSales Invoice Item` sii
        JOIN 
            `tabSales Invoice` si ON sii.parent = si.name
        INNER JOIN
            `tabItem` ti ON sii.item_code = ti.item_code
        WHERE 
            si.docstatus = 1
            AND ti.is_stock_item = 1
            AND si.is_internal_customer = 0
        GROUP BY 
            sii.item_code, sii.item_name, sii.description, sii.stock_uom, ti.brand, ti.category, ti.image
        ORDER BY 
            `Fast-Moving Score` DESC
        LIMIT %s
    """
    products = frappe.db.sql(query, (limit,), as_dict=True)
    return products

@frappe.whitelist()
def get_salary_provision(employee, from_date, to_date):
    data = frappe.db.sql("""
        SELECT 
            SUM(gl.credit - gl.debit) AS total_payable_leave_salary
        FROM 
            `tabGL Entry` gl
        WHERE 
            gl.party_type = 'Employee'
            AND gl.party = %s
            AND gl.posting_date BETWEEN %s AND %s
            AND gl.is_cancelled = 'No'
            AND gl.account LIKE 'L: Staff Leave Salary Payable%%'
    """, (employee, from_date, to_date), as_dict=True)

    # Log the query result for debugging
    frappe.errprint(data[0]["total_payable_leave_salary"])

    # Return the result or 0 if no data found
    return data[0]["total_payable_leave_salary"] if data and data[0]["total_payable_leave_salary"] else 0

@frappe.whitelist()
def leave_history(employee, from_date, to_date):
    data = frappe.db.sql("""
        SELECT 
            COALESCE(leave_type, 'None') AS leave_type,
            status, 
            COUNT(*) AS count
        FROM 
            `tabAttendance`
        WHERE 
            employee = %s
            AND attendance_date BETWEEN %s AND %s
            AND docstatus = 1
        GROUP BY 
            leave_type, status
        ORDER BY 
            leave_type, status;
    """, (employee, from_date, to_date), as_dict=True)

    # Log the query result for debugging
    frappe.errprint(data)

    # Return the summarized data
    return data
    



@frappe.whitelist()
def get_salary_provision_for_airticket(employee, from_date, to_date):
    data = frappe.db.sql("""
        SELECT 
            SUM(gl.credit - gl.debit) AS total_payable_leave_salary
        FROM 
            `tabGL Entry` gl
        WHERE 
            gl.party_type = 'Employee'
            AND gl.party = %s
            AND gl.posting_date BETWEEN %s AND %s
            AND gl.is_cancelled = 'No'
            AND gl.account LIKE 'L: Staff Leave Tickets Payable%%'
    """, (employee, from_date, to_date), as_dict=True)

    # Log the query result for debugging
    frappe.errprint(data[0]["total_payable_leave_salary"])

    # Return the result or 0 if no data found
    return data[0]["total_payable_leave_salary"] if data and data[0]["total_payable_leave_salary"] else 0




def create_additional_salary(leave_salary_request, method):
	if (leave_salary_request.workflow_state == "Pending Additional Salary Creation" and leave_salary_request.docstatus == 1):
		frappe.errprint("hefkjerfgkj")
		new_doc = frappe.new_doc("Additional Salary")
		new_doc.update({
			"custom_leave_salary_request":leave_salary_request.name,
			"employee": leave_salary_request.employee,
			"payroll_date":leave_salary_request.payroll_date,
			"salary_component":leave_salary_request.salary_component,
			"company":leave_salary_request.company,
			"amount":leave_salary_request.salary_to_be_paid,
			"overwrite_salary_structure_amount" : 0
		})
		new_doc.save()
		new_doc.submit()

		frappe.db.set_value("Leave Salary Request",leave_salary_request.name,"workflow_state","Pending Employee Signature")
		frappe.db.set_value("Leave Salary Request",leave_salary_request.name,"custom_additional_salary",new_doc.name)
		leave_salary_request.reload()


def create_additional_salary_for_airticket(airticket_request_form, method):
	if (airticket_request_form.workflow_state == "Pending Additional Salary Creation" and airticket_request_form.docstatus == 1):
		frappe.errprint("hefkjerfgkj")
		new_doc = frappe.new_doc("Additional Salary")
		new_doc.update({
			"custom_leave_airticket_request":airticket_request_form.name,
			"employee": airticket_request_form.employee,
			"payroll_date":airticket_request_form.payroll_date,
			"salary_component":airticket_request_form.salary_component,
			"company":airticket_request_form.company,
			"amount":airticket_request_form.salary_to_be_paid,
			"overwrite_salary_structure_amount" : 0
		})
		new_doc.save()
		new_doc.submit()

		frappe.db.set_value("Airticket Request Form",airticket_request_form.name,"workflow_state","Pending Employee Signature")
		frappe.db.set_value("Airticket Request Form",airticket_request_form.name,"custom_additional_salary",new_doc.name)
		
		airticket_request_form.reload()



import json
import frappe

@frappe.whitelist()
def get_promotion_items(start=0, page_length=20, filters=None):
    start = int(start)
    page_length = int(page_length)

    # If filters is a string, try to parse it as JSON
    if isinstance(filters, str):
        try:
            filters = json.loads(filters)
        except json.JSONDecodeError:
            frappe.throw("Invalid filter format")

    category_filters = filters.get('category_filters', {})
    price_list_filters = filters.get('price_list_filters', {})

    item_filters = []  # Filters for the Item Price table
    category_conditions = []  # Filters for the Item table
    values = {}

    # Build filters for the Item Price table
    if price_list_filters.get('item_code'):
        if isinstance(price_list_filters['item_code'], list):
            item_filters.append("ip.item_code IN %(item_codes)s")
            values['item_codes'] = price_list_filters['item_code']
        elif isinstance(price_list_filters['item_code'], str):
            item_filters.append("ip.item_code LIKE %(item_code)s")
            values['item_code'] = f"%{price_list_filters['item_code']}%"

    if price_list_filters.get('brand'):
        if isinstance(price_list_filters['brand'], list):
            item_filters.append("ip.brand IN %(brands)s")
            values['brands'] = price_list_filters['brand']
        elif isinstance(price_list_filters['brand'], str):
            item_filters.append("ip.brand LIKE %(brand)s")
            values['brand'] = f"%{price_list_filters['brand']}%"

    if 'min_price' in filters and 'max_price' in filters:
        item_filters.append("ip.price_list_rate BETWEEN %(min_price)s AND %(max_price)s")
        values['min_price'] = filters['min_price']
        values['max_price'] = filters['max_price']

    if price_list_filters.get('item_description'):
        item_filters.append("ip.item_description LIKE %(item_description)s")
        values['item_description'] = f"%{price_list_filters['item_description']}%"

    # Build filters for the Item table (specific to category_list)
    if category_filters.get('category_list'):
        if isinstance(category_filters['category_list'], list):
            category_conditions.append("i.category_list IN %(category_list)s")
            values['category_list'] = category_filters['category_list']
        elif isinstance(category_filters['category_list'], str):
            category_conditions.append("i.category_list LIKE %(category)s")
            values['category'] = f"%{category_filters['category_list']}%"

    # Construct the WHERE clauses
    item_filters_clause = " AND ".join(item_filters) if item_filters else "1=1"
    category_filters_clause = " AND ".join(category_conditions) if category_conditions else "1=1"

    # SQL query with dynamic filters
    query = f"""
        SELECT 
            ip.item_code, 
            ip.price_list_rate, 
            ip.item_name, 
            ip.brand, 
            ip.uom, 
            ip.item_description,
            i.name AS item_name_from_item, 
            i.image, 
            i.category_list
        FROM 
            `tabItem Price` ip
        JOIN 
            `tabItem` i 
        ON 
            ip.item_code = i.name
        WHERE 
            ip.price_list = 'Promo' 
            AND {item_filters_clause}
            AND {category_filters_clause}
        ORDER BY 
            ip.modified ASC
        LIMIT 
            %(start)s, %(page_length)s
    """

    values.update({'start': start, 'page_length': page_length})

    # Execute the query
    item_prices = frappe.db.sql(query, values=values, as_dict=True)

    # Extract item codes
    item_codes = [item['item_code'] for item in item_prices]

    # Fetch corresponding RRP prices
    rrp_prices = frappe.get_all(
        'Item Price',
        filters={'price_list': 'RRP', 'item_code': ['in', item_codes]},
        fields=['item_code', 'price_list_rate'],
    )

    # Map RRP prices to item codes
    rrp_price_map = {price['item_code']: price['price_list_rate'] for price in rrp_prices}

    # Combine item price, details, and RRP price
    for price in item_prices:
        price['image'] = price.get('image', '/assets/frappe/images/no-image.svg')
        price['item_category'] = price.get('category_list', 'Unknown Category')
        price['rrp_price'] = rrp_price_map.get(price['item_code'], 'Not Available')

    return item_prices


@frappe.whitelist()
def get_barcode(item_code):
	frappe.errprint("df")
	if item_code:
		bc = frappe.db.get_value("Item Barcode",{"parent":item_code},"barcode")
		if bc:
			return bc


import frappe

def validate_leave_application(doc, method):
    if doc.status == "On Leave":
        # Check for an approved Leave Application
        leave_application = frappe.db.exists(
            "Leave Application",
            {
                "employee": doc.employee,
                "docstatus": 1,  # Submitted
                "status": "Approved",
                "from_date": ["<=", doc.attendance_date],
                "to_date": [">=", doc.attendance_date],
            }
        )
        
        if not leave_application:
            frappe.throw(
                f"No approved Leave Application exists for {doc.employee} on {doc.attendance_date}. Please create one before saving.",
                frappe.ValidationError,
            )

from frappe.utils import date_diff, today

@frappe.whitelist()
def get_outstanding_invoices():
    # Fetch outstanding invoices with optimized query
    outstanding_invoices = frappe.db.sql("""
        SELECT
            ple.against_voucher_no AS invoice_number,
            SUM(ple.amount) AS outstanding_amount,
            si.customer,
            si.company,
            si.branch,
            si.posting_date,
            si.grand_total,
            GROUP_CONCAT(st.sales_person) AS sales_persons
        FROM
            `tabPayment Ledger Entry` ple
        INNER JOIN
            `tabSales Invoice` si ON ple.against_voucher_no = si.name
        LEFT JOIN
            `tabSales Team` st ON st.parent = si.name
        WHERE
            ple.against_voucher_type = 'Sales Invoice'
            AND si.docstatus = 1
            AND si.is_internal_customer = 0
        GROUP BY
            ple.against_voucher_no
        HAVING
            outstanding_amount != 0
    """, as_dict=True)

    categorized_invoices = []

    for invoice in outstanding_invoices:
        # Calculate age in days
        invoice_date = invoice.get("posting_date")
        age_days = date_diff(today(), invoice_date)

        # Categorize based on outstanding amount
        outstanding_amount = invoice.get("outstanding_amount")
        if outstanding_amount < 1000:
            category = "Below 1,000"
        elif 1000 <= outstanding_amount < 10000:
            category = "1,000 to 10,000"
        elif 10000 <= outstanding_amount < 20000:
            category = "10,000 to 20,000"
        elif 20000 <= outstanding_amount < 30000:
            category = "20,000 to 30,000"
        elif 30000 <= outstanding_amount < 40000:
            category = "30,000 to 40,000"
        elif 40000 <= outstanding_amount < 50000:
            category = "40,000 to 50,000"
        elif 50000 <= outstanding_amount < 60000:
            category = "50,000 to 60,000"
        elif 60000 <= outstanding_amount < 70000:
            category = "60,000 to 70,000"
        elif 70000 <= outstanding_amount < 80000:
            category = "70,000 to 80,000"
        elif 80000 <= outstanding_amount < 90000:
            category = "80,000 to 90,000"
        elif 90000 <= outstanding_amount <= 100000:
            category = "90,000 to 100,000"
        else:
            category = "Above 100,000"

        # Append categorized data
        categorized_invoices.append({
            "invoice_number": invoice.get("invoice_number"),
            "customer": invoice.get("customer"),
            "company": invoice.get("company"),
            "branch": invoice.get("branch"),
            "posting_date": invoice_date,
            "age_days": age_days,
            "grand_total": invoice.get("grand_total"),
            "outstanding_amount": outstanding_amount,
            "sales_persons": invoice.get("sales_persons"),
            "category": category
        })

    return categorized_invoices



@frappe.whitelist()
def get_ldw_project_sales_orders(sales_team=None, sales_person=None, branch=None):
    try:
        base_filters = {
            "company": "LED WORLD LLC",
            "status": ["not in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
        }

        if branch:
            base_filters["branch"] = branch  # Adding branch filter

        if sales_team:
            # Get salespersons under the given sales team
            sales_persons = frappe.get_all(
                "Sales Person",
                filters={"parent_sales_person": sales_team},
                fields=["name"]
            )
            sales_person_names = [sp["name"] for sp in sales_persons]

            if sales_person_names:
                sales_order_names = frappe.get_all(
                    "Sales Team",
                    filters={"sales_person": ["in", sales_person_names]},
                    fields=["parent"]
                )
                sales_order_names = [so["parent"] for so in sales_order_names]

                if sales_order_names:
                    base_filters["name"] = ["in", sales_order_names]
                else:
                    return {"status": "success", "data": [], "sales_team": sales_team, "summaries": {}}
            else:
                return {"status": "success", "data": [], "sales_team": sales_team, "summaries": {}}

        if sales_person:
            sales_order_names = frappe.get_all(
                "Sales Team",
                filters={"sales_person": sales_person},
                fields=["parent"]
            )
            sales_order_names = [so["parent"] for so in sales_order_names]

            if sales_order_names:
                base_filters["name"] = ["in", sales_order_names]
            else:
                return {"status": "success", "data": [], "summaries": {}}

        current_month_start = get_first_day(nowdate())
        current_month_end = get_last_day(nowdate())

        previous_months_filters = {**base_filters, "delivery_date": ["<", current_month_start]}
        current_month_filters = {**base_filters, "delivery_date": ["between", [current_month_start, current_month_end]]}
        future_months_filters = {**base_filters, "delivery_date": [">", current_month_end]}
        hold_status_filters = {**base_filters, "status": "On Hold", "is_internal_customer": 0}

        def calculate_per_bill(orders):
            return sum(order["grand_total"] * (1 - (order.get("per_billed", 0) / 100)) for order in orders)

        previous_months_orders = frappe.get_all("Sales Order", filters=previous_months_filters, fields=["grand_total", "per_billed"])
        current_month_orders = frappe.get_all("Sales Order", filters=current_month_filters, fields=["grand_total", "per_billed"])
        future_months_orders = frappe.get_all("Sales Order", filters=future_months_filters, fields=["grand_total", "per_billed"])

        previous_count = len(previous_months_orders)
        previous_total = sum(order["grand_total"] for order in previous_months_orders)
        prev_per_bill = calculate_per_bill(previous_months_orders)

        current_count = len(current_month_orders)
        current_total = sum(order["grand_total"] for order in current_month_orders)
        current_per_bill = calculate_per_bill(current_month_orders)

        future_count = len(future_months_orders)
        future_total = sum(order["grand_total"] for order in future_months_orders)
        future_per_bill = calculate_per_bill(future_months_orders)

        hold_status_orders = frappe.get_all("Sales Order", filters=hold_status_filters, fields=["grand_total", "per_billed"])

        hold_count = len(hold_status_orders)
        hold_total = sum(order["grand_total"] for order in hold_status_orders)
        hold_per_bill = calculate_per_bill(hold_status_orders)

        all_sales_orders = frappe.get_all("Sales Order", filters=base_filters, fields=["grand_total", "per_billed"])

        all_orders_count = len(all_sales_orders)
        all_orders_total = sum(order["grand_total"] for order in all_sales_orders)
        all_per_bill = calculate_per_bill(all_sales_orders)

        completed_status_filters = {
            "company": "LED WORLD LLC",
            "status": ["in", ["Completed", "Closed"]],
            "docstatus": 1,
            "is_internal_customer": 0,
            "delivery_date": ["between", [current_month_start, current_month_end]]
        }

        if branch:
            completed_status_filters["branch"] = branch  # Adding branch filter for completed sales orders

        completed_orders = frappe.get_all("Sales Order", filters=completed_status_filters, fields=["grand_total", "per_billed"])

        completed_count = len(completed_orders)
        completed_total = sum(order["grand_total"] for order in completed_orders)
        completed_per_bill = calculate_per_bill(completed_orders)

        sales_orders = frappe.get_all(
            "Sales Order",
            fields=["name", "customer", "branch","delivery_date", "status", "grand_total", "payment_terms_template", "per_delivered", "per_billed", "project", "transaction_date"],
            filters=base_filters
        )

        for so in sales_orders:
            so['to_bill_amount'] = so['grand_total'] - (so['grand_total'] * (so.get('per_billed', 0) / 100))
            sales_team = frappe.get_all(
                "Sales Team",
                filters={"parenttype": "Sales Order", "parent": so['name']},
                fields=["sales_person"]
            )
            so['sales_person'] = [st['sales_person'] for st in sales_team]

        return {
            "status": "success",
            "data": sales_orders,
            "summaries": {
                "all_sales_orders": {"count": all_orders_count, "total": all_orders_total, "per_bill": all_per_bill},
                "previous_months": {"count": previous_count, "total": previous_total, "per_bill": prev_per_bill},
                "current_month": {"count": current_count, "total": current_total, "per_bill": current_per_bill},
                "future_months": {"count": future_count, "total": future_total, "per_bill": future_per_bill},
                "hold_status": {"count": hold_count, "total": hold_total, "per_bill": hold_per_bill},
                "completed_orders_current_month": {"count": completed_count, "total": completed_total, "per_bill": completed_per_bill}
            }
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Error fetching sales orders"))
        return {
            "status": "error",
            "message": str(e)
        }
#last sales and purchase data

@frappe.whitelist(allow_guest=False)
def get_item_data_sales_purchase(item_code):
    """
    API to fetch item data including total sales qty/value, total purchase qty/value,
    last 10 sales (with customer), last 10 purchases (with supplier), and supplier purchase details.
    
    Args:
        item_code (str): The Item Code for which data is requested
    
    Returns:
        dict: Contains total sales, total purchases, last 10 sales, last 10 purchases, and supplier details
    """
    if not item_code:
        frappe.throw(_("Item Code is required"))

    # Total Sales Quantity and Value from Sales Invoice
    sales_data = frappe.db.sql("""
        SELECT 
            SUM(sii.qty) AS total_sales_qty,
            SUM(sii.amount) AS total_sales_value
        FROM 
            `tabSales Invoice Item` sii
        INNER JOIN 
            `tabSales Invoice` si ON sii.parent = si.name
        WHERE 
            sii.item_code = %s
            AND si.docstatus = 1
            AND si.is_internal_customer = 0
    """, (item_code,), as_dict=True)[0]

    # Total Purchase Quantity and Value from Purchase Invoice
    purchase_data = frappe.db.sql("""
        SELECT 
            SUM(pii.qty) AS total_purchase_qty,
            SUM(pii.amount) AS total_purchase_value
        FROM 
            `tabPurchase Invoice Item` pii
        INNER JOIN 
            `tabPurchase Invoice` pi ON pii.parent = pi.name
        WHERE 
            pii.item_code = %s
            AND pi.docstatus = 1
            AND pi.is_internal_supplier = 0
    """, (item_code,), as_dict=True)[0]

    # Last 10 Sales from Sales Invoice with Customer
    last_sales = frappe.db.sql("""
        SELECT 
            si.name AS invoice_name,
            si.posting_date AS date,
            sii.qty AS qty,
            sii.amount AS amount,
            si.customer AS customer_code,
            c.customer_name AS customer_name
        FROM 
            `tabSales Invoice Item` sii
        INNER JOIN 
            `tabSales Invoice` si ON sii.parent = si.name
        LEFT JOIN 
            `tabCustomer` c ON si.customer = c.name
        WHERE 
            sii.item_code = %s
            AND si.docstatus = 1
            AND si.is_internal_customer = 0
        ORDER BY 
            si.posting_date DESC, si.creation DESC
        LIMIT 10
    """, (item_code,), as_dict=True)

    # Last 10 Purchases from Purchase Invoice with Supplier
    last_purchases = frappe.db.sql("""
        SELECT 
            pi.name AS invoice_name,
            pi.posting_date AS date,
            pii.qty AS qty,
            pii.amount AS amount,
            pi.supplier AS supplier_code,
            s.supplier_name AS supplier_name
        FROM 
            `tabPurchase Invoice Item` pii
        INNER JOIN 
            `tabPurchase Invoice` pi ON pii.parent = pi.name
        LEFT JOIN 
            `tabSupplier` s ON pi.supplier = s.name
        WHERE 
            pii.item_code = %s
            AND pi.docstatus = 1
            AND pi.is_internal_supplier = 0
        ORDER BY 
            pi.posting_date DESC, pi.creation DESC
        LIMIT 10
    """, (item_code,), as_dict=True)

    # Supplier Purchase Details
    supplier_details = frappe.db.sql("""
        SELECT 
            s.supplier_name AS supplier_name,
            MIN(pii.rate) AS purchase_low_price,
            MAX(pii.rate) AS purchase_high_price,
            MAX(pi.posting_date) AS last_purchase_date,
            SUM(pii.qty) AS total_qty_bought
        FROM 
            `tabPurchase Invoice Item` pii
        INNER JOIN 
            `tabPurchase Invoice` pi ON pii.parent = pi.name
        LEFT JOIN 
            `tabSupplier` s ON pi.supplier = s.name
        WHERE 
            pii.item_code = %s
            AND pi.docstatus = 1
            AND pi.is_internal_supplier = 0
        GROUP BY 
            pi.supplier, s.supplier_name
        ORDER BY 
            s.supplier_name
    """, (item_code,), as_dict=True)

    # Prepare the response
    response = {
        "total_sales_qty": sales_data.get("total_sales_qty") or 0,
        "total_sales_value": sales_data.get("total_sales_value") or 0,
        "total_purchase_qty": purchase_data.get("total_purchase_qty") or 0,
        "total_purchase_value": purchase_data.get("total_purchase_value") or 0,
        "last_10_sales": last_sales,
        "last_10_purchases": last_purchases,
        "supplier_details": supplier_details
    }

    return response
#above code has last sales and purchase data
@frappe.whitelist()
def get_sales_order_ldw_data(statuses=None, display_type='count'):
    """
    Fetch sales orders grouped by month with filter by status for a specific company and non-internal customers.
    
    Parameters:
        statuses (str): Comma-separated list of statuses to filter by.
        display_type (str): "count" for order count, "amount" for total amount.
        
    Returns:
        List of dictionaries with month, status, and respective count or total.
    """
    # Convert statuses to a list, or use None if not provided
    status_list = statuses.split(',') if statuses else None
    
    # Base query to fetch Sales Order data
    field = "COUNT(name)" if display_type == 'count' else "SUM(grand_total)"
    
    query = f"""
        SELECT 
            DATE_FORMAT(delivery_date, '%%M %%Y') AS month,
            status,
            {field} AS value
        FROM 
            `tabSales Order`
        WHERE 
            docstatus = 1
            AND company = 'LED WORLD LLC'
            AND is_internal_customer = 0
    """
    
    # Add status filtering if statuses are provided
    if status_list:
        query += " AND status IN %(statuses)s"
    
    # Group by month and status and order by month (delivery_date)
    query += " GROUP BY month, status ORDER BY MIN(delivery_date) ASC"
    
    # Execute the query
    data = frappe.db.sql(query, {'statuses': status_list}, as_dict=True)
    
    # Process and return data
    return data


@frappe.whitelist()
def get_purchase_sales_data(item_code):
    """
    Fetch totals and last 10 records for purchases and sales for a given item code.
    """
    try:
        # Fetch total purchased quantity
        purchase_total = frappe.db.sql("""
            SELECT SUM(qty) as total_purchased
            FROM `tabPurchase Invoice Item`
            WHERE item_code = %s AND parent_docstatus = 1
        """, (item_code), as_dict=True)[0].total_purchased or 0

        # Fetch total sold quantity
        sales_total = frappe.db.sql("""
            SELECT SUM(qty) as total_sold
            FROM `tabSales Invoice Item`
            WHERE item_code = %s AND parent_docstatus = 1
        """, (item_code), as_dict=True)[0].total_sold or 0

        # Calculate sale-to-purchase ratio
        ratio = (sales_total / purchase_total) if purchase_total > 0 else 0

        # Fetch last 10 purchases
        purchases = frappe.db.get_list(
            'Purchase Invoice Item',
            filters={'item_code': item_code, 'parent_docstatus': 1},
            fields=['parent', 'qty', 'rate', 'posting_date'],
            order_by='posting_date desc',
            limit_page_length=10
        )

        # Fetch last 10 sales
        sales = frappe.db.get_list(
            'Sales Invoice Item',
            filters={'item_code': item_code, 'parent_docstatus': 1},
            fields=['parent', 'qty', 'rate', 'posting_date'],
            order_by='posting_date desc',
            limit_page_length=10
        )

        return {
            'total_purchased': purchase_total,
            'total_sold': sales_total,
            'ratio': ratio,
            'purchases': purchases or [],
            'sales': sales or []
        }
    except Exception as e:
        frappe.log_error(f"Error fetching purchase/sales data for {item_code}: {str(e)}")
        return {
            'total_purchased': 'Error',
            'total_sold': 'Error',
            'ratio': 'Error',
            'purchases': [],
            'sales': []
        }

#Ovetime Allocation Control
import frappe
from frappe.utils import time_diff_in_hours
@frappe.whitelist()
def validate_overtime(employee, ot_date, from_time, to_time, ot_hours):
    """
    Validates overtime hours based on Employee Check-in/Check-out logs.
    Ensures OT hours match actual worked hours.
    """

    # Convert ot_hours to a float (ensures numeric comparison)
    ot_hours = flt(ot_hours)

    # Fetch all Employee Check-ins for the given date
    checkins = frappe.db.sql("""
        SELECT time, log_type FROM `tabEmployee Checkin`
        WHERE employee = %s AND DATE(time) = %s
        ORDER BY time ASC
    """, (employee, ot_date), as_dict=True)

    if not checkins:
        frappe.throw(f"No check-in/check-out records found for {employee} on {ot_date}")

    # Calculate total worked hours based on check-in/check-out pairs
    total_worked_hours = 0
    last_check_in = None

    for entry in checkins:
        if entry["log_type"] == "IN":
            last_check_in = entry["time"]
        elif entry["log_type"] == "OUT" and last_check_in:
            total_worked_hours += time_diff_in_hours(entry["time"], last_check_in)
            last_check_in = None  # Reset after processing

    # Calculate actual overtime worked
    actual_ot = max(0, flt(total_worked_hours) - 9.5)  # Assuming 8 hours as standard shift

    # Validation: Ensure OT hours do not exceed actual worked hours
    if ot_hours > actual_ot:
        frappe.throw(f"Overtime hours exceed actual worked hours! Max OT: {actual_ot:.2f} hours.")

    # Validation: Ensure OT is within valid time
    if from_time and to_time:
        entered_ot_duration = time_diff_in_hours(to_time, from_time)
        if flt(entered_ot_duration) != ot_hours:
            frappe.throw(f"Entered OT hours ({ot_hours}) do not match the actual OT duration ({entered_ot_duration:.2f} hours).")

    # Validation: Prevent OT on Holidays and Weekends
    is_holiday = frappe.db.exists("Holiday", {"holiday_date": ot_date})
    if is_holiday:
        frappe.throw(f"{ot_date} is a holiday. Overtime cannot be allocated.")

    return {"status": "success", "message": f"Overtime validated successfully for {employee} on {ot_date}"}


#Above code has overtime allocation codes 



@frappe.whitelist()
def get_leave_salary_payment(doc):
	sal_slip = frappe.get_doc("Salary Slip",doc)
	frappe.errprint("sal_slip")
	# if not sal_slip.custom_basicsahra:
	sal_stru = frappe.db.get_value("Salary Structure",{"name":sal_slip.salary_structure},"custom_basicsahra")
	if sal_stru:
		frappe.errprint(sal_stru)
		frappe.db.set_value("Salary Slip", sal_slip.name, "custom_basicsahra", sal_stru)
		sal_slip.reload()

# apps/qcshr/qcshr/controller/variant_pricing.py
import frappe

@frappe.whitelist()
def reorder_products(page=1, per_page=20, item_code=None, brand=None, category=None):
    page = int(page)
    per_page = int(per_page)
    offset = (page - 1) * per_page

    # Base query with dynamic WHERE clause
    query = """
    SELECT 
        mso.item_code AS item_code, 
        mso.brand AS brand, 
        mso.category AS category, 
        mso.actual_stock_required AS actual_qty_required,
        mso.min_stock AS min_stock,
        COALESCE(SUM(b.actual_qty), 0) AS current_qty,
        (mso.actual_stock_required - COALESCE(SUM(b.actual_qty), 0)) AS reorder_suggested,
        COALESCE(po_data.order_qty, 0) AS order_qty
    FROM 
        `tabMinimum Stock Order` mso
    LEFT JOIN 
        `tabBin` b ON mso.item_code = b.item_code
    LEFT JOIN (
        SELECT 
            poi.item_code,
            SUM(poi.qty - poi.received_qty) AS order_qty
        FROM 
            `tabPurchase Order Item` poi
        INNER JOIN 
            `tabPurchase Order` po ON poi.parent = po.name 
                AND po.docstatus = 1 
                AND po.is_internal_supplier = 0 
                AND po.status NOT IN ('Closed', 'Completed')
        GROUP BY 
            poi.item_code
    ) po_data ON mso.item_code = po_data.item_code
    """

    # Build WHERE conditions dynamically
    conditions = []
    params = []
    if item_code:
        conditions.append("mso.item_code = %s")
        params.append(item_code)
    if brand:
        conditions.append("mso.brand = %s")
        params.append(brand)
    if category:
        conditions.append("mso.category = %s")
        params.append(category)

    # Add WHERE clause if filters are present
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    # Add GROUP BY, HAVING, ORDER BY, and LIMIT
    query += """
    GROUP BY 
        mso.item_code, mso.brand, mso.category, mso.actual_stock_required, mso.min_stock, mso.disable
    HAVING 
        COALESCE(SUM(b.actual_qty), 0) < mso.min_stock
    ORDER BY 
        mso.brand, mso.category, (COALESCE(SUM(b.actual_qty), 0) - mso.min_stock) ASC
    LIMIT %s OFFSET %s
    """
    params.extend([per_page, offset])

    # Execute the query
    data = frappe.db.sql(query, tuple(params), as_dict=True)

    # Count total records with the same filters
    count_query = """
    SELECT COUNT(*) as total
    FROM (
        SELECT 
            mso.item_code
        FROM 
            `tabMinimum Stock Order` mso
        LEFT JOIN 
            `tabBin` b ON mso.item_code = b.item_code
    """
    if conditions:
        count_query += " WHERE " + " AND ".join(conditions)
    count_query += """
        GROUP BY 
            mso.item_code, mso.brand, mso.category, mso.actual_stock_required, mso.min_stock, mso.disable
        HAVING 
            COALESCE(SUM(b.actual_qty), 0) < mso.min_stock
    ) as temp
    """
    total = frappe.db.sql(count_query, tuple(params[:-2]) if conditions else (), as_dict=True)[0].total

    # Update image URLs to HTTPS
    for row in data:
        item = frappe.get_doc("Item", row.item_code)
        if item.image and item.image.startswith('http://'):
            row["image"] = item.image.replace('http://', 'https://')
        elif item.image:
            row["image"] = item.image
        else:
            row["image"] = "/assets/erpnext/images/default-image.jpg"

    return {
        "message": data,
        "total": total,
        "page": page,
        "per_page": per_page
    }

@frappe.whitelist()
def get_context(context):
    """Prepare context for the sales-performance page."""
    filters = frappe.form_dict  # Get filters from URL query params
    context.sales_data = get_sales_data(filters)
    context.csrf_token = frappe.sessions.get_csrf_token()
    return context

@frappe.whitelist()
def get_sales_data(filters=None):
    """Fetch sales target data with HTTPS image URLs."""
    # Handle stringified filters from frontend
    if isinstance(filters, str):
        filters = json.loads(filters)
    if not filters:
        filters = {}
    
    conditions = get_conditions(filters)
    from_date = getdate(filters.get("from_date")) if filters.get("from_date") else getdate().replace(day=1)
    to_date = getdate(filters.get("to_date")) if filters.get("to_date") else getdate()
    
    # Fetch sales targets
    sales_targets = frappe.db.sql(f"""
        SELECT 
            sp.name as sales_person, 
            sp.parent_sales_person as sales_team,
            st.company, 
            st.branch, 
            st.monthly_target, 
            st.from_date, 
            st.to_date
        FROM 
            `tabSales Target` st
        JOIN `tabSales Person` sp ON sp.name = st.sales_person
        WHERE 
            {conditions}
            AND st.to_date >= %(from_date)s 
            AND st.from_date <= %(to_date)s
    """, {"from_date": from_date, "to_date": to_date, **filters}, as_dict=1)
    
    result = []
    site_url = get_url()  # Ensures HTTPS if site is configured for it
    
    for target in sales_targets:
        sales_person = target.sales_person
        sales_team = target.sales_team
        entry_from = getdate(target.from_date)
        entry_to = getdate(target.to_date)
        
        effective_start = max(from_date, entry_from)
        effective_end = min(to_date, entry_to)
        
        num_months = ((effective_end.year - effective_start.year) * 12 + effective_end.month - effective_start.month) + 1
        
        # Fetch sales and payment data
        sales_data = frappe.db.sql("""
            SELECT SUM(si.grand_total) as total_sales,
                   COALESCE(SUM(CAST(p.amount AS DECIMAL(10, 2))), 0) AS total_payment
            FROM `tabSales Invoice` si
            LEFT JOIN `tabPayment Ledger Entry` p ON p.voucher_no = si.name AND p.docstatus = 1
            LEFT JOIN `tabSales Team` st ON st.parent = si.name
            WHERE 
                si.docstatus = 1
                AND si.posting_date BETWEEN %(effective_start)s AND %(effective_end)s
                AND st.sales_person = %(sales_person)s
        """, {"effective_start": effective_start, "effective_end": effective_end, "sales_person": sales_person}, as_dict=1)
        
        overall_payment_data = frappe.db.sql("""
            SELECT COALESCE(SUM(CAST(p.amount AS DECIMAL(10, 2))), 0) AS overall_total_payment
            FROM `tabPayment Ledger Entry` p
            LEFT JOIN `tabSales Invoice` si ON p.voucher_no = si.name
            LEFT JOIN `tabSales Team` st ON st.parent = si.name
            WHERE 
                p.docstatus = 1
                AND st.sales_person = %(sales_person)s
        """, {"sales_person": sales_person}, as_dict=1)
        
        total_sales = sales_data[0].total_sales if sales_data and sales_data[0].total_sales else 0
        total_payment = sales_data[0].total_payment if sales_data and sales_data[0].total_payment else 0
        overall_total_payment = overall_payment_data[0].overall_total_payment if overall_payment_data and overall_payment_data[0].overall_total_payment else 0
        
        # Fetch employee image
        employee = frappe.db.get_value("Sales Person", sales_person, "employee")
        employee_image = f"{site_url}/files/default-avatar.png"
        if employee:
            image = frappe.db.get_value("Employee", employee, "image")
            if image and not image.startswith(('http://', 'https://')):
                employee_image = f"{site_url}{image}"
            elif image:
                employee_image = image
        
        row = {
            'sales_person': sales_person,
            'sales_team': sales_team,
            'company': target.company,
            'branch': target.branch,
            'target': target.monthly_target,
            'month_count': num_months,
            'total_target': target.monthly_target * num_months,
            'total_sales': total_sales,
            'total_payment': total_payment,
            'overall_total_payment': overall_total_payment,
            'period_start': effective_start,
            'period_end': effective_end,
            'achievement': (total_sales / (target.monthly_target * num_months) * 100) if (target.monthly_target * num_months) else 0,
            'employee_image': employee_image
        }
        result.append(row)
    
    # Add total row
    if result:
        target_sum = sum(d['target'] for d in result)
        month_count_sum = sum(d['month_count'] for d in result)
        total_target_sum = sum(d['total_target'] for d in result)
        total_sales_sum = sum(d['total_sales'] for d in result)
        total_payment_sum = sum(d['total_payment'] for d in result)
        avg_achievement = sum(d['achievement'] for d in result) / len(result)
        
        result.append({
            'sales_person': 'Total',
            'sales_team': '',
            'company': '',
            'branch': '',
            'target': target_sum,
            'month_count': month_count_sum,
            'total_target': total_target_sum,
            'total_sales': total_sales_sum,
            'total_payment': total_payment_sum,
            'achievement': avg_achievement,
            'period_start': '',
            'period_end': '',
            'employee_image': ''
        })
    
    return result

@frappe.whitelist()
def get_conditions(filters):
    conditions = []
    if filters.get("company"):
        conditions.append("st.company = %(company)s")
    if filters.get("branch"):
        conditions.append("st.branch = %(branch)s")
    if filters.get("sales_person"):
        conditions.append("st.sales_person = %(sales_person)s")
    if filters.get("team"):
        conditions.append("sp.parent_sales_person = %(team)s")
    return " AND ".join(conditions) if conditions else "1=1"


import frappe
from frappe import _
from frappe.utils import getdate, date_diff
from datetime import datetime
from dateutil.relativedelta import relativedelta

def execute(filters=None):
    columns = get_columns()
    data = get_page(filters or {})
    return columns, data

def get_columns():
    return [
        {"label": _("Sales Order"), "fieldname": "name", "fieldtype": "Data", "width": 100},
        {"label": _("Created Date"), "fieldname": "creation", "fieldtype": "Date", "width": 100},
        {"label": _("Customer"), "fieldname": "customer", "fieldtype": "Data", "width": 150},
        {"label": _("Company"), "fieldname": "company", "fieldtype": "Data", "width": 120},
        {"label": _("Branch"), "fieldname": "branch", "fieldtype": "Data", "width": 100},
        {"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 100},
        {"label": _("Grand Total"), "fieldname": "grand_total", "fieldtype": "Currency", "width": 120},
        {"label": _("Invoice Amount"), "fieldname": "invoice_amount", "fieldtype": "Currency", "width": 120},
        {"label": _("Advance Payment"), "fieldname": "advance_payment", "fieldtype": "Currency", "width": 120},
        {"label": _("Project"), "fieldname": "project", "fieldtype": "Data", "width": 100},
        {"label": _("Delivery Date"), "fieldname": "delivery_date", "fieldtype": "Date", "width": 100},
        {"label": _("Sales Person"), "fieldname": "sales_person", "fieldtype": "Data", "width": 150},
        {"label": _("% Delivered"), "fieldname": "per_delivered", "fieldtype": "Percent", "width": 150},
        {"label": _("% Billed"), "fieldname": "per_billed", "fieldtype": "Percent", "width": 150},
        {"label": _("Outstanding Amount"), "fieldname": "outstanding_amount", "fieldtype": "Currency", "width": 120},
        {"label": _("Overdue Days"), "fieldname": "overdue_days", "fieldtype": "Int", "width": 100},
        {"label": _("Customer Credit Limit"), "fieldname": "credit_limit", "fieldtype": "Currency", "width": 120},
        {"label": _("Advance Invoice Outstanding"), "fieldname": "advance_outstanding", "fieldtype": "Currency", "width": 120},
        {"label": _("Sales Person Status"), "fieldname": "sales_person_status", "fieldtype": "Data", "width": 100},
        {"label": _("Remarks"), "fieldname": "remarks", "fieldtype": "Data", "width": 300}
    ]
@frappe.whitelist()
def get_page(filters):
    base_query = """
        SELECT 
            so.name,
            so.creation as creation,
            so.customer,
            so.status,
            so.company,
            so.branch as branch,
            so.project as project,
            so.grand_total as grand_total,
            (so.grand_total * so.per_billed) / 100 as invoice_amount,
            so.per_delivered,
            so.per_billed,
            so.delivery_date as delivery_date,
            GROUP_CONCAT(DISTINCT st.sales_person) as sales_person,
            COALESCE(ple.outstanding_amount, 0) as outstanding_amount,
            COALESCE(advance.advance_payment, 0) as advance_payment,
            CASE 
                WHEN so.delivery_date < CURDATE() 
                THEN DATEDIFF(CURDATE(), so.delivery_date)
                ELSE 0 
            END as overdue_days,
            ccl.credit_limit as credit_limit,
            COALESCE(advance.advance_outstanding, 0) as advance_outstanding,
            CASE 
                WHEN COALESCE(sp.enabled, 0) = 1 THEN 'Enabled'
                ELSE 'Disabled'
            END as sales_person_status
        FROM 
            `tabSales Order` so
        LEFT JOIN 
            `tabSales Team` st ON so.name = st.parent
        LEFT JOIN 
            `tabSales Invoice` si ON so.name = si.sales_order
        LEFT JOIN 
            `tabCustomer Credit Limit` ccl ON so.customer = ccl.parent 
            AND so.company = ccl.company
        LEFT JOIN 
            `tabSales Person` sp ON st.sales_person = sp.name
        LEFT JOIN (
            SELECT 
                ple.company,
                ple.party,
                SUM(ple.amount) AS outstanding_amount
            FROM 
                `tabPayment Ledger Entry` ple
            WHERE 
                ple.against_voucher_type = 'Sales Invoice'
            GROUP BY 
                ple.company,
                ple.party
            HAVING 
                SUM(ple.amount) != 0
        ) ple ON so.customer = ple.party AND so.company = ple.company
        LEFT JOIN (
            SELECT 
                si.sales_order,
                SUM(sii.amount) as advance_payment,
                SUM(ple2.amount) as advance_outstanding
            FROM 
                `tabSales Invoice Item` sii
            INNER JOIN 
                `tabSales Invoice` si ON sii.parent = si.name
            LEFT JOIN 
                `tabPayment Ledger Entry` ple2 ON si.name = ple2.against_voucher_no
                AND ple2.voucher_type = 'Sales Invoice'
            WHERE 
                si.sales_order IS NOT NULL
                AND sii.item_code LIKE '%%payment%%'
            GROUP BY 
                si.sales_order
        ) advance ON so.name = advance.sales_order
        WHERE 
            so.docstatus = 1
            AND so.is_internal_customer = 0
            AND so.status IN ('To Deliver', 'To Bill', 'To Deliver and Bill')
    """
    
    conditions = []
    params = {}
    
    if filters.get("company"):
        conditions.append("so.company = %(company)s")
        params["company"] = filters["company"]
    if filters.get("branch"):
        conditions.append("so.branch = %(branch)s")
        params["branch"] = filters["branch"]
    if filters.get("customer"):
        conditions.append("so.customer = %(customer)s")
        params["customer"] = filters["customer"]
    
    if conditions:
        query = base_query + " AND " + " AND ".join(conditions)
    else:
        query = base_query
    
    query += " GROUP BY so.name"
    
    data = frappe.db.sql(query, params, as_dict=True)
    
    filtered_data = []
    remarks_filter = filters.get("remarks", [])
    today = datetime.now().date()
    one_month_ago = today - relativedelta(months=1)
    
    for row in data:
        remarks = []
        if row["overdue_days"] > 0:
            remarks.append("Delivery Date Due")
        if row["outstanding_amount"] > (row["credit_limit"] or 0):
            remarks.append("Non-Credit Client Risk")
        if row["advance_payment"] > 0 and row["advance_outstanding"] > 0:
            remarks.append("Advance Payment Not Yet Paid")
        if row["sales_person_status"] == "Disabled":
            remarks.append("Inactive Salesperson")
        if row["per_delivered"] == 100 and row["per_billed"] < 100:
            remarks.append("100% Delivery Done, Invoice Not Yet Made")
        if not row["project"]:
            remarks.append("Project Not Yet Open")
        
        row["remarks"] = "; ".join(remarks) if remarks else ""
        
        if not remarks_filter or any(remark in remarks_filter for remark in remarks):
            filtered_data.append(row)
    
    return filtered_data

@frappe.whitelist()
def get_dashboard_data(filters=None):
    filters = frappe.parse_json(filters) if filters else {}
    columns, data = execute(filters)
    
    # Chart data preparation
    chart_data = {
        "status_distribution": frappe.db.sql("""
            SELECT status, COUNT(*) as count
            FROM `tabSales Order`
            WHERE docstatus = 1 
            AND is_internal_customer = 0
            AND status IN ('To Deliver', 'To Bill', 'To Deliver and Bill')
            GROUP BY status
        """, as_dict=True),
        "monthly_outstanding": frappe.db.sql("""
            SELECT 
                DATE_FORMAT(so.creation, '%Y-%m') as month, 
                SUM(COALESCE(ple.outstanding_amount, 0)) as amount
            FROM 
                `tabSales Order` so
            LEFT JOIN (
                SELECT 
                    ple.company,
                    ple.party,
                    SUM(ple.amount) AS outstanding_amount
                FROM 
                    `tabPayment Ledger Entry` ple
                WHERE 
                    ple.against_voucher_type = 'Sales Invoice'
                GROUP BY 
                    ple.company,
                    ple.party
                HAVING 
                    SUM(ple.amount) != 0
            ) ple ON so.customer = ple.party AND so.company = ple.company
            WHERE 
                so.docstatus = 1 
                AND so.is_internal_customer = 0
                AND so.status IN ('To Deliver', 'To Bill', 'To Deliver and Bill')
            GROUP BY 
                DATE_FORMAT(so.creation, '%Y-%m')
            ORDER BY 
                month
        """, as_dict=True)
    }
    
    # Convert status_distribution to a dictionary for chart compatibility
    status_dict = {row["status"]: row["count"] for row in chart_data["status_distribution"]}
    chart_data["status_distribution"] = status_dict
    
    return {
        "columns": columns,
        "data": data,
        "chart_data": chart_data
    }

# Server Script: get_available_employees
@frappe.whitelist()
# Server Script: get_available_employees
# Server Script: get_available_employees
def get_available_employees():
    # Get parameters from the request
    doc_name = frappe.form_dict.get('doc_name')
    from_date = frappe.form_dict.get('from_date')
    to_date = frappe.form_dict.get('to_date')
    from_time = frappe.form_dict.get('from_time')
    to_time = frappe.form_dict.get('to_time')

    # Validate required fields
    if not from_date or not to_date:
        return {
            'status': 'error',
            'message': 'From Date and To Date are required.'
        }

    # Set default times if not provided
    from_time = from_time or '00:00:00'
    to_time = to_time or '23:59:59'

    # Convert dates and times
    try:
        from_date = frappe.utils.getdate(from_date)
        to_date = frappe.utils.getdate(to_date)
        from_time = frappe.utils.get_time(from_time)
        to_time = frappe.utils.get_time(to_time)
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Invalid date or time format: {str(e)}'
        }

    # Get all active employees
    employees = frappe.get_all(
        'Employee',
        filters={
            'company': 'METROPLUS ADVERTISING LLC',
            'branch': 'METROPLUS OPERATION',
            'status': 'Active'
        },
        fields=['name', 'employee_name', 'designation', 'image'],
        order_by='designation asc'
    )

    if not employees:
        return {
            'status': 'error',
            'message': 'No active employees found for METROPLUS ADVERTISING LLC, METROPLUS OPERATION.'
        }

    # Get existing team members in current document if it exists
    current_team = []
    if doc_name and frappe.db.exists('Project Work Schedule', doc_name):
        current_team = frappe.get_all(
            'Project Work Schedule Teams',
            filters={'parent': doc_name},
            fields=['employee']
        )
    current_team_employees = set(team.employee for team in current_team)

    # Get existing schedules from other documents
    team_schedules = frappe.get_all(
        'Project Work Schedule Teams',
        filters={
            'parent': ['!=', doc_name],
            'docstatus': ['!=', 2]
        },
        fields=['employee', 'parent']
    )

    # Create availability map
    availability_map = {}
    
    # Check current document first
    for emp in current_team_employees:
        availability_map[emp] = {
            'is_available': False,
            'conflict': 'Already assigned'
        }

    # Check other schedules
    for schedule in team_schedules:
        if schedule.employee in availability_map:  # Skip if already marked from current doc
            continue
            
        parent = frappe.get_doc('Project Work Schedule', schedule.parent)
        schedule_from_date = frappe.utils.getdate(parent.from_date)
        schedule_to_date = frappe.utils.getdate(parent.to_date)
        schedule_from_time = frappe.utils.get_time(parent.from_time or '00:00:00')
        schedule_to_time = frappe.utils.get_time(parent.to_time or '23:59:59')

        if (
            (from_date <= schedule_to_date and to_date >= schedule_from_date) and
            (from_time <= schedule_to_time and to_time >= schedule_from_time)
        ):
            project_desc = parent.get('project_description') or f"Schedule {parent.name}"
            availability_map[schedule.employee] = {
                'is_available': False,
                'conflict': f'"{project_desc}"'
            }

    # Prepare response
    employee_list = []
    for emp in employees:
        availability = availability_map.get(emp.name, {'is_available': True})
        employee_list.append({
            'name': emp.name,
            'employee_name': emp.employee_name,
            'designation': emp.designation,
            'image': emp.image,
            'is_available': availability['is_available'],
            'conflict': availability.get('conflict') if not availability['is_available'] else None
        })

    return {
        'status': 'success',
        'employees': employee_list
    }

# Make the function available as an API endpoint
frappe.whitelist(allow_guest=False)
def endpoint():
    return get_available_employees()

# Set this as the main function for the API
response = endpoint()