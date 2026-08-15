# -*- coding: utf-8 -*-

from __future__ import unicode_literals
import frappe
from frappe.utils import flt, getdate, today, get_date_str, get_time, nowdate, cint,get_link_to_form
from datetime import datetime, timedelta
from erpnext.setup.doctype.holiday_list.holiday_list import is_holiday
import itertools

class DuplicateAttendanceError(frappe.ValidationError):
	pass




@frappe.whitelist()
def cal_ot(attendance, method):
	if attendance.in_time and attendance.out_time:
		in_t = formatted_datetime(attendance.in_time)
		frappe.errprint(in_t)
		out_t = formatted_datetime(attendance.out_time)
		#frappe.errprint(t.time())
		
		attendance.working_hours = time_diff_in_hours(in_t, out_t)
		#frappe.errprint(attendance.total_working_hours)
		#frappe.errprint(attendance.working_hours)
		if attendance.working_hours > attendance.total_working_hours:
			attendance.ot = float(attendance.working_hours) - float(attendance.total_working_hours)
		   



@frappe.whitelist()
def manual_cal_ot():
	ot_list = frappe.get_all("Attendance", filters = {
						"attendance_date": ["between", ['01-02-2022', '03-03-2022']],
						"docstatus": 1
					}, fields = ["name"])
	for x in ot_list:
		att = frappe.get_doc("Attendance", x.name)
		if att.ot == 0:
			if att.working_hours > att.total_working_hours:
				att.ot = float(att.working_hours) - float(att.total_working_hours)
				frappe.db.set_value("Attendance", x.name, "ot", att.ot)

@frappe.whitelist()
def manual_late():
	ot_list = frappe.get_all("Attendance", filters = {
						"attendance_date": ["between", ['01-02-2022', '03-03-2022']],
						"docstatus": 1
					}, fields = ["name"])
	for x in ot_list:
		att = frappe.get_doc("Attendance", x.name)
		if att.out_time:
			if att.working_hours > att.total_working_hours:
				att.ot = float(att.working_hours) - float(att.total_working_hours)
				frappe.db.set_value("Attendance", x.name, "ot", att.ot)	


@frappe.whitelist()
def manual_clear_attendance_mark():
	frappe.errprint("test")
	ot_list = frappe.get_all("Employee Checkin", filters = {
						"date_qcs": '2022-03-10'
					}, fields = ["name"])
	frappe.errprint(ot_list)
	for x in ot_list:
		frappe.errprint(x.name)
		att = frappe.get_doc("Employee Checkin", x.name)
		att.attendance = ""
		att.save()			



def total_ot(salary_slip, method):
	ot_list = frappe.get_all("Attendance", filters = {
						"attendance_date": ["between", [salary_slip.start_date, salary_slip.end_date]],
						"employee": salary_slip.employee,
						"docstatus": 1
					}, fields = ["ot"])
	for x in ot_list:
		if x.ot:
			salary_slip.total_ot += x.ot




def time_diff_in_hours(start, end):
	return round((end-start).total_seconds() / 3600, 1)


def custom_hr_daily_hook():
	#daily_employee_checkin_skip_attendance()
	mark_last_sync_checkin()
#    holiday_attendance_and_overtime()


def custom_employee_checkin_script(employee_checkin, method):
	employee_checkin_date_from_time(employee_checkin)


def custom_attendance_script(attendance, method):
	shift_total_working_hours(attendance)
	#attendance_error_flag(attendance)


@frappe.whitelist()
def employee_checkin_date_from_time(employee_checkin):
	""" Convert the datetime field time to date """
	time = employee_checkin.time
	date = get_date_str(time)
	employee_checkin.set('date_qcs', date)


@frappe.whitelist()
def daily_employee_checkin_skip_attendance():
	auto_skip_attendance = frappe.db.get_single_value('QCS UAE HR Settings', 'daily_employee_checkin_skip_attendance')
	if auto_skip_attendance == 1:
		yesterday = getdate(today()) - timedelta(days=1)
		tolerance = frappe.db.get_single_value('QCS UAE HR Settings', 'employee_checkin_correction_tolerance')
		employee_list = active_employee_list()
		for employee in employee_list:
			log_list = employee_checkin_list(employee.name, yesterday)
			if log_list:
				for employee_checkin in log_list:
					count = len(log_list)
					if count > 1:
						i = 0
						while i < (count-1):
							time_in = get_time(log_list[i]["time"])
							time_out = get_time(log_list[i+1]["time"])
							i += 1
							if not time_in == time_out:
								diff_secs = (formatted_time(time_out) - formatted_time(time_in)).total_seconds()
								if diff_secs < tolerance:
									frappe.db.set_value('Employee Checkin', log_list[i]["name"], 'skip_auto_attendance', 1, update_modified=False)
							else:
								frappe.db.delete('Employee Checkin', {
									'name': log_list[i]["name"]
								})


@frappe.whitelist()
def mark_last_sync_checkin():
	"""Marks Last Sync Checkin using Daily Hook"""
	auto_last_sync_of_checkin = frappe.db.get_single_value('QCS UAE HR Settings', 'auto_last_sync_of_checkin')
	if auto_last_sync_of_checkin == 1:
		today_date = str(getdate(nowdate())) + " 00:00:00"
		sync_datetime = datetime.strptime(today_date, "%Y-%m-%d %H:%M:%S")
		shift_details = frappe.db.get_all('Shift Type', filters={
			'enable_auto_attendance': 1
			},
			fields=['last_sync_of_checkin', 'enable_auto_attendance', 'name']
		)
		for shift in shift_details:
			frappe.db.set_value('Shift Type', shift.name, 'last_sync_of_checkin', sync_datetime, update_modified=False)


@frappe.whitelist()
def shift_total_working_hours(attendance):
	shift = attendance.shift
	total_working_hours = flt(frappe.db.get_value('Shift Type', shift, 'total_working_hours_ihg'), precision=2)
	attendance.set('total_working_hours', total_working_hours)


#@frappe.whitelist()
#def attendance_error_flag(attendance):
#	if attendance.status == 'Present':
#		working_hours = flt(attendance.working_hours, precision=2)
#		total_working_hours = flt(attendance.total_working_hours, precision=2)
#		if total_working_hours > working_hours:
#			attendance.set('has_error_qcs', 1)


#@frappe.whitelist()
#def attendance_overtime(attendance):
#	overtime_enabled = frappe.db.get_single_value('QCS UAE HR Settings', 'enable_overtime')
#	overtime_threshold = flt(frappe.db.get_single_value('QCS UAE HR Settings', 'overtime_hours'), precision=2)
#	if overtime_enabled == 1:
#		working_hours = flt(attendance.working_hours, precision=2)
#		overtime_qcs = attendance.overtime_qcs
#		if working_hours > overtime_threshold and overtime_qcs == 1:
#			overtime = working_hours - overtime_threshold
#			attendance.set('system_overtime_qcs', flt(overtime, precision=2))
#			attendance.set('has_overtime_qcs', 1)





@frappe.whitelist()
def active_employee_list():
	employee_list = frappe.get_all('Employee', filters={
							'status': 'Active'
						},
						fields=['name', 'employee_name', 'company', 'date_of_joining', 'default_shift', 'holiday_list', 'designation']
					)
	return employee_list


@frappe.whitelist()
def employee_checkin_list(employee_name, date):
	corrected_employee_checkin_list = frappe.get_all('Employee Checkin', filters={
											'employee': employee_name,
											'date_qcs': ['=', date],
											'skip_auto_attendance': 0
										},
										fields=['time', 'employee', 'name'],
										order_by='time'
										)
	return corrected_employee_checkin_list


def formatted_datetime(timestamp):
	string_time = str(timestamp)
	trimmed_time = string_time.split(".")[0]
	format_time = datetime.strptime(str(trimmed_time), "%Y-%m-%d %H:%M:%S")
	return format_time


def formatted_time(timestamp):
	string_time = str(timestamp)
	trimmed_time = string_time.split(".")[0]
	format_time = datetime.strptime(str(trimmed_time), "%H:%M:%S")
	return format_time


def tardiness_attendance(attendance, method):
	if attendance.in_time and attendance.out_time and attendance.custom_remove_missed_hours != 1:
		shift_in = frappe.db.get_value("Shift Type", attendance.shift, "start_time")
		shift_out = frappe.db.get_value("Shift Type", attendance.shift, "end_time")
		late_entry_grace = frappe.db.get_value("Shift Type", attendance.shift, "late_entry_grace_period")
		#value = datetime.timedelta(0, 64800)
		frappe.errprint("test-tardiness")
		
		actual_in = datetime.combine(datetime.strptime(str(attendance.attendance_date), "%Y-%m-%d").date(), (datetime.min + shift_in).time())
		actual_out = datetime.combine(datetime.strptime(str(attendance.attendance_date), "%Y-%m-%d").date(), (datetime.min + shift_out).time())
		actual_in = actual_in + timedelta(minutes=cint(late_entry_grace))
		attendance.test_sample = actual_in
		attendance.early_mins = 0
		attendance.late_min = 0
		frappe.errprint(actual_in)
		frappe.errprint(attendance.in_time)
		frappe.errprint(attendance.out_time)
		if attendance.in_time:
			#datetime.combine(datetime.strptime(str(attendance.in_time), "%Y-%m-%d %H:%M:%S")
			if actual_in < datetime.strptime(str(attendance.in_time), "%Y-%m-%d %H:%M:%S"):
				frappe.errprint(attendance.employee)
				frappe.errprint(attendance.attendance_date)
				frappe.errprint(attendance.in_time)
				frappe.errprint(actual_in)
				attendance.late_min = time_diff_in_hours(actual_in, datetime.strptime(str(attendance.in_time), "%Y-%m-%d %H:%M:%S"))
				frappe.errprint(attendance.late_min)
			else:
				attendance.late_min = 0

		if attendance.out_time:
			#datetime.combine(datetime.strptime(str(attendance.out_time), "%Y-%m-%d %H:%M:%S")
			if actual_out > datetime.strptime(str(attendance.out_time), "%Y-%m-%d %H:%M:%S"):
				attendance.early_mins = time_diff_in_hours(datetime.strptime(str(attendance.out_time), "%Y-%m-%d %H:%M:%S"), actual_out)
			else:
				attendance.early_mins = 0

		# if attendance.late_min or attendance.early_mins:
		# 	attendance.total_missed_hours = float(attendance.late_min) + float(attendance.early_mins)

		flexible_timing = frappe.db.get_value("Employee", attendance.employee, "flexible_timing") or 0

		if cint(flexible_timing):
			attendance.total_missed_hours = 0
		elif attendance.late_min or attendance.early_mins:
			attendance.total_missed_hours = float(attendance.late_min) + float(attendance.early_mins)

	#frappe.errprint(actual_in)
	#if attendance.in_time:


def check_duplicate_entry(attendance, method):
    Attendance = frappe.qb.DocType("Attendance")
    query = (
        frappe.qb.from_(Attendance)
        .select(Attendance.name)
        .where(
            (Attendance.employee == attendance.employee)
            & (Attendance.docstatus < 2)
            & (Attendance.attendance_date == attendance.attendance_date)
        )
    )
    if attendance.shift:
        query = query.where(
            ((Attendance.shift.isnull()) | (Attendance.shift == ""))
            | (
                ((Attendance.shift.isnotnull()) | (Attendance.shift != "")) 
                & (Attendance.shift == attendance.shift)
            )
        )

    duplicate = query.run(pluck=True)
    if duplicate:
        frappe.throw(
            _(
                "Attendance for employee {0} is already marked for the date {1}: {2} so please check the date of attendance for this employee"
            ).format(
                frappe.bold(attendance.employee),
                frappe.bold(format_date(attendance.attendance_date)),
                get_link_to_form("Attendance", duplicate[0]),
            ),
            title=_("Duplicate Attendance"),
            exc=DuplicateAttendanceError,
        )
