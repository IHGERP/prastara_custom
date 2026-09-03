from __future__ import unicode_literals
import frappe
from frappe import _
from datetime import date


def execute(filters=None):
	filters = filters or {}

	columns = get_columns()
	data = []

	from_date = filters.get("from_date")
	to_date = filters.get("to_date")
	branch = filters.get("branch")
	company = filters.get("company")

	if not from_date or not to_date:
		return columns, data

	si_conditions = [
		"si.posting_date BETWEEN %s AND %s",
		"si.docstatus = 1",
	]
	si_values = [from_date, to_date]

	pe_conditions = [
		"py.posting_date BETWEEN %s AND %s",
		"py.payment_type = 'Receive'",
		"py.docstatus = 1",
	]
	pe_values = [from_date, to_date]

	if branch:
		si_conditions.append("si.branch = %s")
		si_values.append(branch)

		pe_conditions.append("COALESCE(po.branch, py.custom_branch) = %s")
		pe_values.append(branch)

	if company:
		si_conditions.append("si.company = %s")
		si_values.append(company)

		pe_conditions.append("py.company = %s")
		pe_values.append(company)

	documents = frappe.db.sql(
		"""
		SELECT
			si.posting_date,
			si.company,
			si.branch,
			sp.mode_of_payment,
			sp.amount
		FROM `tabSales Invoice` si
		INNER JOIN `tabSales Invoice Payment` sp
			ON si.name = sp.parent
		WHERE {conditions}
		""".format(conditions=" AND ".join(si_conditions)),
		si_values,
		as_dict=True,
	)

	payment_entries = frappe.db.sql(
		"""
		SELECT
			py.name,
			py.posting_date,
			py.creation,
			py.company,
			py.pos_profile,
			COALESCE(po.branch, py.custom_branch) AS branch,
			py.mode_of_payment,
			py.paid_amount
		FROM `tabPayment Entry` py
		LEFT JOIN `tabPOS Profile` po
			ON py.pos_profile = po.name
		WHERE {conditions}
		""".format(conditions=" AND ".join(pe_conditions)),
		pe_values,
		as_dict=True,
	)

	grouped = {}
	today = date.today()

	def get_row(company, branch):
		key = (company or "", branch or "")
		if key not in grouped:
			grouped[key] = {
				"company": company,
				"branch": branch,
				"cash": 0,
				"card": 0,
				"cheque": 0,
				"pdc": 0,
				"wired_transfer": 0,
				"credit": 0,
				"total": 0,
			}
		return grouped[key]

	for row in documents:
		out = get_row(row.company, row.branch)
		mode = row.mode_of_payment or ""
		amount = row.amount or 0

		if "Cash" in mode:
			out["cash"] += amount
		elif "Card" in mode:
			out["card"] += amount
		elif "Cheque" in mode:
			out["cheque"] += amount
		elif "Credit" in mode:
			out["credit"] += amount
		elif "Wire Transfer" in mode:
			out["wired_transfer"] += amount

	for row in payment_entries:
		out = get_row(row.company, row.branch)
		mode = row.mode_of_payment or ""
		amount = row.paid_amount or 0

		if "Cash" in mode:
			out["cash"] += amount
		elif "Card" in mode:
			out["card"] += amount
		elif "Credit" in mode:
			out["credit"] += amount
		elif "Wire Transfer" in mode:
			out["wired_transfer"] += amount
		elif "Cheque" in mode:
			if row.posting_date and row.creation and row.posting_date > row.creation.date() and row.posting_date > today:
				out["pdc"] += amount
			else:
				out["cheque"] += amount

	for row in grouped.values():
		row["total"] = (
			row["cash"]
			+ row["card"]
			+ row["cheque"]
			+ row["pdc"]
			+ row["wired_transfer"]
			+ row["credit"]
		)
		data.append(row)

	data = sorted(data, key=lambda d: (d.get("company") or "", d.get("branch") or ""))

	return columns, data


def get_columns():
	return [
		{
			"fieldname": "company",
			"label": _("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"width": 180,
		},
		{
			"fieldname": "branch",
			"label": _("Branch"),
			"fieldtype": "Link",
			"options": "Branch",
			"width": 160,
		},
		{
			"fieldname": "cash",
			"label": _("Cash"),
			"fieldtype": "Float",
			"width": 130,
		},
		{
			"fieldname": "card",
			"label": _("Card"),
			"fieldtype": "Float",
			"width": 130,
		},
		{
			"fieldname": "cheque",
			"label": _("Cheque"),
			"fieldtype": "Float",
			"width": 130,
		},
		{
			"fieldname": "pdc",
			"label": _("PDC"),
			"fieldtype": "Float",
			"width": 130,
		},
		{
			"fieldname": "wired_transfer",
			"label": _("Wired Transfer"),
			"fieldtype": "Float",
			"width": 150,
		},
		{
			"fieldname": "credit",
			"label": _("Credit"),
			"fieldtype": "Float",
			"width": 130,
		},
		{
			"fieldname": "total",
			"label": _("Total"),
			"fieldtype": "Float",
			"width": 140,
		},
	]