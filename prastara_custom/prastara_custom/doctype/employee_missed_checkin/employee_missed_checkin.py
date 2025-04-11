import frappe
from frappe.model.document import Document

class EmployeeMissedCheckin(Document):
	def validate(self):
		frappe.errprint("Leave application")
		if self.log_type == '':
			frappe.throw("Log Type is required for check-ins falling in the shift: 08:30 AM TO 06:00 PM")

		if self.workflow_state == "Approved":
			self.create_employee_checkin()
	
	def create_employee_checkin(self):
		frappe.errprint(self.employee)
		emp_doc = frappe.new_doc("Employee Checkin")
		emp_doc.employee = self.employee
		emp_doc.log_type = self.log_type
		emp_doc.time = self.time
		emp_doc.save()


