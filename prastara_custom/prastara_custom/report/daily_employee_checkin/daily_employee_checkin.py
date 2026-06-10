# Copyright (c) 2022, QCS and contributors
# For license information, please see license.txt


from itertools import groupby

import frappe, datetime
from frappe import _
from datetime import date
from frappe.utils import add_days, get_timedelta, get_time, time_diff


def execute(filters=None):
    #columns, data = [], []
    columns = get_columns()
    data = get_data(filters)
    #data = get_employees(filters)
    return columns, data


def get_columns():
    columns = [{
        'label': _('Employee'),
        'fieldtype': 'Link',
        'fieldname': 'employee',
        'width': 120,
        'options': 'Employee'
    }, {
        'label': _('Employee Name'),
        'fieldtype': 'Data',
        'fieldname': 'employee_name',
        'width': 240
    },{
        'label': _('Company'),
        'fieldtype': 'Link',
        'fieldname': 'company',
        'width': 130,
        'options': 'Company'
    }, 
    {
        'label': _('Branch'),
        'fieldtype': 'Link',
        'fieldname': 'branch',
        'width': 130,
        'options': 'Branch'
    },
    {
        'label': _('Status'),
        'fieldtype': 'Data',
        'fieldname': 'status',
        'width': 130,
    },
    {
        'label': _('Checkin Time'),
        'fieldtype': 'Data',
        'fieldname': 'checkin_time',
        'width': 130,
    },
        {
        'label': _('Checkout Time'),
        'fieldtype': 'Data',
        'fieldname': 'checkout_time',
        'width': 130,
    },
    
    ]

    return columns

def get_data(filters):
    data = []
    emp_list = frappe.get_all('Employee', filters={'status':'active'}, fields=['name', 'employee_name', 'company', 'branch'])
    ntime = None
    otime = None
    row = frappe._dict()
    for item in emp_list:
        frappe.errprint(item.name)
        ntime = None
        otime = None
        if frappe.get_all('Employee Checkin', filters={'date_qcs':filters.checkin_date, 'employee':item.name, 'log_type':'In' }, fields=['time']):
            emp_checkin = frappe.get_all('Employee Checkin', filters={'date_qcs':filters.checkin_date, 'employee':item.name, 'log_type':'In'}, fields=['time','employee'], order_by='time')
            frappe.errprint(emp_checkin)
            
            ntime = str(emp_checkin[0].time)
            #time_object = datetime.datetime.strptime(ntime[11:], '%H:%M:%S').time()
        if frappe.get_all('Employee Checkin', filters={'date_qcs':filters.checkin_date, 'employee':item.name, 'log_type':'Out' }, fields=['time']):
            emp_checkout = frappe.get_all('Employee Checkin', filters={'date_qcs':filters.checkin_date, 'employee':item.name, 'log_type':'Out'}, fields=['time','employee'], order_by='time')
            otime = str(emp_checkout[len(emp_checkout)-1].time)
            #ctime = get_time(ntime[11:])
            #ntime = ntime.time()
            frappe.errprint(emp_checkout)
    
        if ntime != None and otime != None: 
            row = [item.name, item.employee_name, item.company, item.branch ,"Present", ntime[11:], otime[11:]]
            frappe.errprint(row)
        elif ntime == None and otime != None: 
            row = [item.name, item.employee_name, item.company, item.branch, "No Checkin", '-', otime[11:]]
        elif ntime != None and otime == None: 
            row = [item.name, item.employee_name, item.company, item.branch, "No Checkout", ntime[11:], '-']
        elif frappe.get_all('Attendance', filters={'attendance_date':filters.checkin_date, 'employee':item.name}, fields=['status']):
            row = [item.name, item.employee_name, item.company, item.branch, "On Leave", "-", "-"]
        else:
            row = [item.name, item.employee_name, item.company, item.branch ,"None", "-", "-"]
        #frappe.errprint(row)
        data.append(row)
        #frappe.errprint(data)
    #frappe.errprint(data)	
    return data

def get_employees(filters):
    conditions = get_conditions(filters)
    return frappe.db.sql("""select name, employee_name 
    from tabEmployee where status = 'Active' %s""" % conditions, as_list=1)	

def get_conditions(filters):
    conditions = ""

    

    return conditions