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

	
	if filters.get("employee") and not filters.get("branch") and not filters.get("company"):
		documents = frappe.db.sql("""SELECT 
					emp.name AS employee,
					emp.employee_name,
					emp.branch,
					emp.company,
					sa.salary_structure,
					MAX(sa.from_date) AS max_from_date,
					ss.name,
					ss.custom_wps_salary
				FROM `tabEmployee` emp
				LEFT JOIN (
					SELECT employee, MAX(from_date) AS max_from_date
					FROM `tabSalary Structure Assignment`
					WHERE docstatus = 1
					GROUP BY employee
				) sa_max ON emp.name = sa_max.employee
				LEFT JOIN `tabSalary Structure Assignment` sa ON emp.name = sa.employee AND sa.docstatus = 1 AND sa.from_date = sa_max.max_from_date
				LEFT JOIN `tabSalary Structure` ss ON sa.salary_structure = ss.name
				WHERE emp.status = 'Active' AND ss.docstatus = 1 AND emp.name = %s
				GROUP BY emp.name, emp.employee_name, emp.branch, emp.company, sa.salary_structure, ss.name""",(filters.get("employee")),as_dict = True)
	
	
	elif not filters.get("employee") and  filters.get("branch") and  not filters.get("company"):
		documents = frappe.db.sql("""SELECT 
					emp.name AS employee,
					emp.employee_name,
					emp.branch,
					emp.company,
					sa.salary_structure,
					MAX(sa.from_date) AS max_from_date,
					ss.name,
					ss.custom_wps_salary
				FROM `tabEmployee` emp
				LEFT JOIN (
					SELECT employee, MAX(from_date) AS max_from_date
					FROM `tabSalary Structure Assignment`
					WHERE docstatus = 1
					GROUP BY employee
				) sa_max ON emp.name = sa_max.employee
				LEFT JOIN `tabSalary Structure Assignment` sa ON emp.name = sa.employee AND sa.docstatus = 1 AND sa.from_date = sa_max.max_from_date
				LEFT JOIN `tabSalary Structure` ss ON sa.salary_structure = ss.name
				WHERE emp.status = 'Active' AND ss.docstatus = 1 AND emp.branch = %s
				GROUP BY emp.name, emp.employee_name, emp.branch, emp.company, sa.salary_structure, ss.name""",(filters.get("branch")),as_dict = True)
			
	
	elif not filters.get("employee") and not filters.get("branch") and  filters.get("company"):
		documents = frappe.db.sql("""SELECT 
			emp.name AS employee,
			emp.employee_name,
			emp.branch,
			emp.company,
			sa.salary_structure,
			MAX(sa.from_date) AS max_from_date,
			ss.name,
			ss.custom_wps_salary
		FROM `tabEmployee` emp
		LEFT JOIN (
			SELECT employee, MAX(from_date) AS max_from_date
			FROM `tabSalary Structure Assignment`
			WHERE docstatus = 1
			GROUP BY employee
		) sa_max ON emp.name = sa_max.employee
		LEFT JOIN `tabSalary Structure Assignment` sa ON emp.name = sa.employee AND sa.docstatus = 1 AND sa.from_date = sa_max.max_from_date
		LEFT JOIN `tabSalary Structure` ss ON sa.salary_structure = ss.name
		WHERE emp.status = 'Active' AND ss.docstatus = 1 AND emp.company = %s
		GROUP BY emp.name, emp.employee_name, emp.branch, emp.company, sa.salary_structure, ss.name""",(filters.get("company")),as_dict = True)
	
	else:
		documents = frappe.db.sql("""SELECT 
			emp.name AS employee,
			emp.employee_name,
			emp.branch,
			emp.company,
			sa.salary_structure,
			MAX(sa.from_date) AS max_from_date,
			ss.name,
			ss.custom_wps_salary
		FROM `tabEmployee` emp
		LEFT JOIN (
			SELECT employee, MAX(from_date) AS max_from_date
			FROM `tabSalary Structure Assignment`
			WHERE docstatus = 1
			GROUP BY employee
		) sa_max ON emp.name = sa_max.employee
		LEFT JOIN `tabSalary Structure Assignment` sa ON emp.name = sa.employee AND sa.docstatus = 1 AND sa.from_date = sa_max.max_from_date
		LEFT JOIN `tabSalary Structure` ss ON sa.salary_structure = ss.name
		WHERE emp.status = 'Active' AND ss.docstatus = 1
		GROUP BY emp.name, emp.employee_name, emp.branch, emp.company, sa.salary_structure, ss.name""",as_dict = True)

	
	if len(documents)!= 0:
		frappe.errprint(documents)	
		for i in range(len(documents)):
			sum = 0
			dict = {}
			dict['employee'] = documents[i].employee
			dict['employee_name'] = documents[i].employee_name
			dict['branch'] = documents[i].branch
			dict['company'] = documents[i].company
			dict['salary_stru'] = documents[i].salary_structure	
			dict['wps'] =  documents[i].custom_wps_salary
			frappe.errprint(documents[i].name)
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component":["like" ,"%Basic Salary%"]}, "amount"):
				dict['basic_salary'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like" ,"%Basic Salary%"]}, "amount")
				sum += dict['basic_salary']
			
			query = """
					SELECT amount FROM `tabSalary Detail`
					WHERE `tabSalary Detail`.salary_component LIKE %s
					AND `tabSalary Detail`.salary_component NOT LIKE %s
					AND `tabSalary Detail`.salary_component NOT LIKE %s
					AND `tabSalary Detail`.salary_component NOT LIKE %s
					AND `tabSalary Detail`.parent = %s
				"""
			bonus_amount = frappe.db.sql(query, ('%Bonus%', '%Overtime Bonus%', '%Fixed Bonus%', '%Holiday Bonus%', documents[i].name), as_dict=True)
			if bonus_amount:
				dict['bonus'] = bonus_amount[0].amount
				sum += dict['bonus']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Air Ticket%"]}, "amount"):
				dict['ait_ticket'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Air Ticket%"]}, "amount")
				# sum += dict['ait_ticket']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Fuel Allowance%"]}, "amount"):
				dict['fuel_allowance'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Fuel Allowance%"]}, "amount")
				sum += dict['fuel_allowance']

			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Other Allowance%"]}, "amount"):
				dict['other_allowance'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Other Allowance%"]}, "amount")
				sum += dict['other_allowance']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "% Gratuity%"]}, "formula"):
				dict['gratuity'] = "YES"
			else:
				dict['gratuity'] = "NO"
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Holiday Bonus%"]}, "amount"):
				dict['holiday_bonus'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Holiday Bonus%"]}, "amount")
				sum += dict['holiday_bonus']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Fixed Bonus%"]}, "amount"):
				dict['fixed_bonus'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Fixed Bonus%"]}, "amount")
				sum += dict['fixed_bonus']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%House Rent Allowance%"]}, "amount"):
				dict['house_rent'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%House Rent Allowance%"]}, "amount") 
				sum += dict['house_rent']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Overtime Bonus%"]}, "amount"):
				dict['ot_bonus'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Overtime Bonus%"]}, "amount") 
				sum += dict['ot_bonus']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Project Expense Allowance%"]}, "amount"):
				dict['project_expence'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Project Expense Allowance%"]}, "amount") 
				sum += dict['project_expence']

			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Pension to Emirati%"]}, "amount"):
				dict['pension_to_emirati'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Pension to Emirati%"]}, "amount") 
				sum += dict['pension_to_emirati']
			
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Sundry Allowance%"]}, "amount"):
				dict['sunday_allowance'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Sundry Allowance%"]}, "amount") 
				sum += dict['sunday_allowance']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Transporatation Allowance%"]}, "amount"):
				dict['transportation'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Transporatation Allowance%"]}, "amount") 
				sum += dict['transportation']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Vehicle Allowance%"]}, "amount"):
				dict['vehicle'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Vehicle Allowance%"]}, "amount") 
				sum += dict['vehicle']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Project Expense Allowance%"]}, "amount"):
				dict['project'] = frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Project Expense Allowance%"]}, "amount") 
				sum += dict['project']
			
			if frappe.db.get_value("Salary Detail", {"parent":documents[i].name,"salary_component": ["like", "%Leave Salary%"]}, "formula"):
				dict['leave_salary'] =  "YES"
			else:
				dict['leave_salary'] =  "NO"
			
			dict['total'] = sum

			data.append(dict)
		

	columns =  [
		{
		'fieldname': 'employee',
		'label': _('Employee'),
		'fieldtype': 'Link',
		'options':'Employee',
	},
	{
		'fieldname': 'employee_name',
		'label': _('Employee Name'),
		'fieldtype': 'Data',
	},
	{
		'fieldname': 'branch',
		'label': _('Branch'),
		'fieldtype': 'Link',
		'options':'Branch',
		
	},
	{
		'fieldname': 'company',
		'label': _('Company'),
		'fieldtype': 'Link',
		'options':'Company',
		
	},

	{
		'fieldname': 'salary_stru',
		'label': _('Salary Structure'),
		'fieldtype': 'Link',
		'options':'Salary Structure',
		
	},
	{
		'fieldname': 'basic_salary',
		'label': _('Basic Salary'),
		'fieldtype': 'Float',
		
	},
	{
		'fieldname': 'bonus',
		'label': _('Bonus'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'fixed_bonus',
		'label': _('Fixed Bonus'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'ait_ticket',
		'label': _('Air Ticket'),
		'fieldtype': 'Float',
	},
	# {
	# 	'fieldname': 'friday_ot',
	# 	'label': _('Friday OT'),
	# 	'fieldtype': 'Float',
	# },
	{
		'fieldname': 'fuel_allowance',
		'label': _('Fuel Allowance'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'other_allowance',
		'label': _('Other Allowance'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'gratuity',
		'label': _('Gratuity'),
		'fieldtype': 'Data',
	},
	{
		'fieldname': 'holiday_bonus',
		'label': _('Holiday Bonus'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'house_rent',
		'label': _('House Rent Allowance'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'ot_bonus',
		'label': _('Overtime Bonus'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'project_expence',
		'label': _('Project Expence'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'sunday_allowance',
		'label': _('Sunday Allowance'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'pension_to_emirati',
		'label': _('Pension to Emirati'),
		'fieldtype': 'Float',
	},

	{
		'fieldname': 'transportation',
		'label': _('Transportation'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'vehicle',
		'label': _('Vehicle Allowance'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'project',
		'label': _('Project Expense Allowance'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'leave_salary',
		'label': _('Leave Salary'),
		'fieldtype': 'Data',
	},
	
	{
		'fieldname': 'total',
		'label': _('Total'),
		'fieldtype': 'Float',
	},
	{
		'fieldname': 'wps',
		'label': _('WPS'),
		'fieldtype': 'Float',
	},
	]
	return columns, data

