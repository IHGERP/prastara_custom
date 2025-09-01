# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt


from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import cint, flt


def execute(filters=None):
	data = []
	columns = []
	conditions = []

	if filters.project:
		conditions.append(" and `tabGL Entry`.project= '{0}'".format(filters.project))

	if filters.from_date:
		conditions.append(" and `tabProject`.creation >= '{0}'".format(filters.from_date))

	if filters.to_date:
		conditions.append(" and `tabProject`.creation <= '{0}'".format(filters.to_date))

	if filters.branch:
		conditions.append(" and `tabProject`.branch = '{0}'".format(filters.branch))
	
	if filters.company:
		conditions.append(" and `tabProject`.company = '{0}'".format(filters.company))

	if filters.customer:
		conditions.append(" and `tabProject`.customer = '{0}'".format(filters.customer))

	conditions_clause = " ".join(conditions)

	sql_query = """
		SELECT
				`tabGL Entry`.project as project,
				SUM(CASE WHEN `tabAccount`.root_type = 'Income' THEN `tabGL Entry`.credit - `tabGL Entry`.debit ELSE 0 END) as total_income,
				SUM(CASE WHEN `tabAccount`.root_type = 'Expense' THEN `tabGL Entry`.debit - `tabGL Entry`.credit ELSE 0 END) as total_expense,
				`tabProject`.project_name,`tabProject`.branch,`tabProject`.customer,`tabProject`.company,`tabProject`.status,`tabProject`.project_completion_date
			FROM
				`tabGL Entry`
			LEFT JOIN
				`tabAccount` ON `tabGL Entry`.account = `tabAccount`.name
				LEFT JOIN
				`tabProject` ON `tabGL Entry`.project = `tabProject`.name
			WHERE
				`tabGL Entry`.project IS NOT NULL {0}
			GROUP BY
				`tabGL Entry`.project
	""".format(conditions_clause)
	si_list = frappe.db.sql(sql_query, as_dict=1)
	frappe.errprint(si_list)

	if len(si_list)!= 0:
		float_precision = cint(frappe.db.get_default("float_precision")) or 2		
		for row in si_list:
			dict = {}	
			total_expense = jc_expense = 0
				
			dict['branch'] = row.branch
			dict['customer'] = row.customer
			dict['project'] = row.project
			dict['status'] = row.status
			dict['project_completion_date'] = row.project_completion_date
			dict['project_name'] = row.project_name
			dict['company'] = row.company
			dict['income'] = flt(row.total_income,float_precision)
			dict['expense'] = flt(row.total_expense,float_precision)
			if dict['expense']:
				total_expense += dict['expense']
			timesheet_expense = frappe.db.get_value("Project",{"name":row.project},"total_costing_amount")
			if timesheet_expense:
				dict['timesheet_expense'] = flt(timesheet_expense,float_precision)
				total_expense += timesheet_expense
			else:
				dict['timesheet_expense'] = flt(0,float_precision)
			job_card_expense = frappe.db.get_all("Stock Entry",filters = {"project":row.project,"stock_entry_type":"Manufacture","docstatus":1},fields='value_difference')
			for j in job_card_expense:
				if j['value_difference']:
					jc_expense += j['value_difference']
			if jc_expense:
				dict['job_card_expense'] = flt(jc_expense,float_precision)
				total_expense += jc_expense
			else:
				dict['job_card_expense'] = flt(0,float_precision)

			dict['total_expense'] = flt(total_expense,float_precision)
			dict['profit'] = flt((dict['income'] - dict['total_expense']),float_precision)
			if dict['total_expense'] > 0 and  dict['profit'] > 0:
				dict['profit%'] = flt((dict['profit']/dict['income']*100),float_precision)
			else:
				dict['profit%'] = 0

			data.append(dict)           	


	
	columns =  [
    {
    'fieldname': 'project',
    'label': _('Project'),
	'fieldtype': 'Link',
    'options':'Project',
	'width': 140
   },
    {
    'fieldname': 'project_name',
    'label': _('Project Name'),
    'fieldtype': 'Data',
	'width': 140
   },
   {
    'fieldname': 'branch',
    'label': _('Branch'),
    'fieldtype': 'Link',
    'options':'Branch',
	'width': 140
   },
   {
    'fieldname': 'company',
    'label': _('Company'),
    'fieldtype': 'Link',
    'options':'Company',
	'width': 140
   },
   {
    'fieldname': 'customer',
    'label': _('Customer'),
    'fieldtype': 'Link',
    'options':'Customer',
	'width': 140
   },
   {
    'fieldname': 'status',
    'label': _('Status'),
    'fieldtype': 'Data',
	'width': 140
   },
   {
       'fieldname': 'project_completion_date',
      'label': _('Completion Date'),
      'fieldtype': 'Date',
	  'width': 125
   },

   {
       'fieldname': 'income',
      'label': _('Income'),
      'fieldtype': 'Float',
	  'width': 125
   },
   {
       'fieldname': 'expense',
      'label': _('Expense'),
      'fieldtype': 'Float',
	  'width': 125
   },

   {
       'fieldname': 'timesheet_expense',
      'label': _('Timesheet Expense'),
      'fieldtype': 'Float',
	  'width': 125
   },

   {
       'fieldname': 'job_card_expense',
      'label': _('Job Card Expense'),
      'fieldtype': 'Float',
	  'width': 125
   },
   {
       'fieldname': 'total_expense',
      'label': _('Total Expense'),
      'fieldtype': 'Float',
	  'width': 125
   },
   {
       'fieldname': 'profit',
      'label': _('Profit'),
      'fieldtype': 'Float',
	  'width': 125
   },
    {
       'fieldname': 'profit%',
      'label': _('Profit%'),
      'fieldtype': 'Percentage',
	  'width': 125
   },
   
   ]
	return columns, data
	