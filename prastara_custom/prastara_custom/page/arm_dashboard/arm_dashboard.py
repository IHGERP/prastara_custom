from __future__ import unicode_literals
import base64
import io
import json
import zipfile
from html import escape

import frappe
from frappe import _
from frappe.utils import flt
from frappe.utils.pdf import get_pdf
from datetime import datetime, timedelta


def _get_payment_followup_config():
	"""Resolve the installed Sales Invoice payment follow-up child table and usable fields."""
	candidate_doctypes = [
		"Payment Followup",
		"Payment Folloup",
	]

	for doctype in candidate_doctypes:
		if frappe.db.exists("DocType", doctype):
			comment_field = None
			for fieldname in ("comments", "remarks", "notes"):
				if frappe.db.has_column(doctype, fieldname):
					comment_field = fieldname
					break

			return {
				"doctype": doctype,
				"table": f"tab{doctype.replace('`', '')}",
				"comment_field": comment_field,
				"has_method": frappe.db.has_column(doctype, "method"),
				"has_payment_extended_date": frappe.db.has_column(doctype, "payment_extended_date"),
				"has_followup_date_time": frappe.db.has_column(doctype, "followup_date_time"),
				"has_followup_by": frappe.db.has_column(doctype, "followup_by"),
			}

	return None


@frappe.whitelist()
def get_collection_data(filters=None):
	"""
	Get collection data for ARM Dashboard Collection Tracker
	Uses the payment report API from qcshr.controller.accounts_receivable
	"""
	if isinstance(filters, str):
		import json
		filters = json.loads(filters)

	if not filters:
		filters = {}

	# Default date range if not provided
	if not filters.get("from_date"):
		filters["from_date"] = frappe.utils.add_months(frappe.utils.today(), -1)
	if not filters.get("to_date"):
		filters["to_date"] = frappe.utils.today()

	branch_filter = filters.get("branch")

	# Call the existing payment report API
	from prastara_custom.controller.accounts_receivable import get_payment_report

	frappe.logger().info(f"=== Collection Data Request ===")
	frappe.logger().info(f"Filters: {filters}")
	print(f"DEBUG: get_collection_data filters: {filters}")

	payment_report_data = get_payment_report(
		branch=branch_filter,
		from_date=filters.get("from_date"),
		to_date=filters.get("to_date"),
		company=filters.get("company")
	)
	
	print(f"DEBUG: get_payment_report returned {len(payment_report_data.get('data', []))} branch records")
	if payment_report_data.get('data'):
		print(f"DEBUG: First branch record: {payment_report_data['data'][0]}")

	frappe.logger().info(f"Payment Report Response: {payment_report_data}")

	if payment_report_data.get('status') != 'success':
		frappe.throw("Failed to fetch payment report data")

	branch_data = payment_report_data.get('data', [])
	frappe.logger().info(f"Branch Data Count: {len(branch_data)}")
	if branch_data:
		frappe.logger().info(f"First Branch Sample: {branch_data[0]}")

	# Calculate totals
	totals = {
		'cash': 0,
		'card': 0,
		'cheque': 0,
		'credit': 0,
		'wire_transfer': 0,
		'pdc': 0,
		'total': 0
	}

	# Reformat the data and calculate totals
	formatted_branch_data = []
	for branch_rec in branch_data:
		cheque_amount = flt(branch_rec.get('cheque', 0))
		# The shared payment helper includes cheque rows in pdc as well.
		# Remove that overlap here so the dashboard follows the collection report split.
		pdc_amount = max(flt(branch_rec.get('pdc', 0)) - cheque_amount, 0)
		total_amount = max(flt(branch_rec.get('total', 0)) - cheque_amount, 0)

		formatted_branch_data.append({
			'branch': branch_rec.get('branch'),
			'pos_profile': branch_rec.get('pos', ''),
			'cash': flt(branch_rec.get('cash', 0)),
			'card': flt(branch_rec.get('card', 0)),
			'cheque': cheque_amount,
			'credit': flt(branch_rec.get('credit', 0)),
			'wire_transfer': flt(branch_rec.get('wired_transfer', 0)),
			'pdc': pdc_amount,
			'total': total_amount
		})

		totals['cash'] += flt(branch_rec.get('cash', 0))
		totals['card'] += flt(branch_rec.get('card', 0))
		totals['cheque'] += cheque_amount
		totals['credit'] += flt(branch_rec.get('credit', 0))
		totals['wire_transfer'] += flt(branch_rec.get('wired_transfer', 0))
		totals['pdc'] += pdc_amount
		totals['total'] += total_amount

	# Calculate branch count
	branch_count = len(formatted_branch_data)

	# Get today's collection
	today_collection = get_today_collection(company=filters.get("company"), branch=filters.get("branch"))

	return {
		'data': formatted_branch_data,
		'totals': totals,
		'branch_count': branch_count,
		'today_collection': today_collection,
		'filters': filters
	}


@frappe.whitelist()
def get_collection_data_old(filters=None):
	"""
	DEPRECATED: Old implementation kept for reference
	Get collection data for ARM Dashboard Collection Tracker
	Based on collection_report.py logic
	"""
	if isinstance(filters, str):
		import json
		filters = json.loads(filters)

	if not filters:
		filters = {}

	# Default date range if not provided
	if not filters.get("from_date"):
		filters["from_date"] = frappe.utils.add_months(frappe.utils.today(), -1)
	if not filters.get("to_date"):
		filters["to_date"] = frappe.utils.today()

	branch_filter = filters.get("branch")
	date_range = (filters.get("from_date"), filters.get("to_date"))

	# Build query based on whether branch is specified
	if branch_filter:
		documents = frappe.db.sql("""
			SELECT
				si.branch,
				sp.mode_of_payment,
				SUM(sp.amount) AS amount,
				0 AS pdc_amount
			FROM `tabSales Invoice` si
			JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent
			WHERE si.posting_date BETWEEN %s AND %s
				AND si.docstatus = 1
				AND si.branch = %s
			GROUP BY si.branch, sp.mode_of_payment

			UNION ALL

			SELECT
				po.branch,
				py.mode_of_payment,
				SUM(
					CASE
						WHEN py.mode_of_payment = 'Cheque'
							AND py.posting_date > CURDATE() THEN 0
						ELSE py.paid_amount
					END
				) AS amount,
				SUM(
					CASE
						WHEN py.mode_of_payment = 'Cheque'
							AND py.posting_date > CURDATE() THEN py.paid_amount
						ELSE 0
					END
				) AS pdc_amount
			FROM `tabPayment Entry` py
			JOIN `tabPOS Profile` po ON py.pos_profile = po.name
			WHERE py.posting_date BETWEEN %s AND %s
				AND py.payment_type = 'Receive'
				AND py.docstatus = 1
				AND po.branch = %s
			GROUP BY po.branch, py.mode_of_payment
		""", (date_range[0], date_range[1], branch_filter, date_range[0], date_range[1], branch_filter), as_dict=True)
	else:
		documents = frappe.db.sql("""
			SELECT
				si.branch,
				sp.mode_of_payment,
				SUM(sp.amount) AS amount,
				0 AS pdc_amount
			FROM `tabSales Invoice` si
			JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent
			WHERE si.posting_date BETWEEN %s AND %s
				AND si.docstatus = 1
			GROUP BY si.branch, sp.mode_of_payment

			UNION ALL

			SELECT
				po.branch,
				py.mode_of_payment,
				SUM(
					CASE
						WHEN py.mode_of_payment = 'Cheque'
							AND py.posting_date > CURDATE() THEN 0
						ELSE py.paid_amount
					END
				) AS amount,
				SUM(
					CASE
						WHEN py.mode_of_payment = 'Cheque'
							AND py.posting_date > CURDATE() THEN py.paid_amount
						ELSE 0
					END
				) AS pdc_amount
			FROM `tabPayment Entry` py
			JOIN `tabPOS Profile` po ON py.pos_profile = po.name
			WHERE py.posting_date BETWEEN %s AND %s
				AND py.payment_type = 'Receive'
				AND py.docstatus = 1
			GROUP BY po.branch, py.mode_of_payment
		""", (date_range[0], date_range[1], date_range[0], date_range[1]), as_dict=True)

	# Initialize dictionary to aggregate payment mode data by branch
	payment_data = {}
	totals = {
		'cash': 0,
		'card': 0,
		'cheque': 0,
		'credit': 0,
		'wire_transfer': 0,
		'pdc': 0,
		'total': 0
	}

	for record in documents:
		branch = record.get('branch') or "Unknown Branch"
		mode_of_payment = record.get('mode_of_payment')
		amount = record.get('amount', 0)
		pdc_amount = record.get('pdc_amount', 0)

		if branch not in payment_data:
			payment_data[branch] = {
				'cash': 0,
				'card': 0,
				'cheque': 0,
				'credit': 0,
				'wire_transfer': 0,
				'pdc': 0,
				'total': 0
			}

		if mode_of_payment:
			if "Cash" in mode_of_payment:
				payment_data[branch]['cash'] += amount
				totals['cash'] += amount
			elif "Card" in mode_of_payment:
				payment_data[branch]['card'] += amount
				totals['card'] += amount
			elif "Cheque" in mode_of_payment:
				payment_data[branch]['cheque'] += amount
				totals['cheque'] += amount
			elif "Credit" in mode_of_payment:
				payment_data[branch]['credit'] += amount
				totals['credit'] += amount
			elif "Wire Transfer" in mode_of_payment or "Wired Transfer" in mode_of_payment:
				payment_data[branch]['wire_transfer'] += amount
				totals['wire_transfer'] += amount

		payment_data[branch]['pdc'] += pdc_amount
		payment_data[branch]['total'] += amount + pdc_amount
		totals['pdc'] += pdc_amount
		totals['total'] += amount + pdc_amount

	# Compile branch-wise data
	branch_data = []
	for branch, payments in payment_data.items():
		pos_profile = frappe.db.get_value("POS Profile", {"branch": branch}, "name") or ""
		branch_data.append({
			'branch': branch,
			'pos_profile': pos_profile,
			'cash': payments['cash'],
			'card': payments['card'],
			'cheque': payments['cheque'],
			'credit': payments['credit'],
			'wire_transfer': payments['wire_transfer'],
			'pdc': payments['pdc'],
			'total': payments['total']
		})

	# Calculate branch count
	branch_count = len(payment_data)

	# Get today's collection
	today_collection = get_today_collection()

	response = {
		"data": branch_data,
		"totals": totals,
		"branch_count": len(branch_data),
		"today_collection": today_collection,
		"filters": filters
	}

	# Log to file for debugging
	try:
		with open('/home/erp-ihg/frappe-bench/apps/prastara_custom/prastara_custom/collection_debug.log', 'a') as f:
			import json
			f.write(f"\n--- {frappe.utils.now()} ---\n")
			f.write(f"Filters: {json.dumps(filters)}\n")
			f.write(f"Response Totals: {json.dumps(totals)}\n")
			f.write(f"Branch Count: {len(branch_data)}\n")
	except:
		pass

	return response


@frappe.whitelist()
def get_today_collection(company=None, branch=None):
	"""Get today's collection amount"""
	today = frappe.utils.today()

	conditions_si = ""
	conditions_pe = ""
	values_si = [today]
	values_pe = [today]

	if company:
		conditions_si += " AND si.company = %s"
		conditions_pe += " AND py.company = %s"
		values_si.append(company)
		values_pe.append(company)

	if branch:
		conditions_si += " AND si.branch = %s"
		# For Payment Entry, check POS Profile branch or custom_branch
		conditions_pe += " AND (po.branch = %s OR py.custom_branch = %s)"
		values_si.append(branch)
		values_pe.append(branch)
		values_pe.append(branch)

	# Sales Invoice payments
	si_amount = frappe.db.sql("""
		SELECT COALESCE(SUM(sp.amount), 0) as amount
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent
		WHERE si.posting_date = %s
			AND si.docstatus = 1
			{conditions_si}
	""".format(conditions_si=conditions_si), tuple(values_si), as_dict=True)[0].amount or 0

	# Payment Entry (excluding future PDC)
	pe_amount = frappe.db.sql("""
		SELECT COALESCE(SUM(
			CASE
				WHEN py.mode_of_payment = 'Cheque'
					AND py.posting_date > CURDATE() THEN 0
				ELSE py.paid_amount
			END
		), 0) as amount
		FROM `tabPayment Entry` py
		LEFT JOIN `tabPOS Profile` po ON py.pos_profile = po.name
		WHERE py.posting_date = %s
			AND py.payment_type = 'Receive'
			AND py.docstatus = 1
			{conditions_pe}
	""".format(conditions_pe=conditions_pe), tuple(values_pe), as_dict=True)[0].amount or 0

	return si_amount + pe_amount


@frappe.whitelist()
def get_pdc_data_deprecated(filters=None):
	"""
	DEPRECATED: This function has been replaced by the new get_pdc_data function (line 776+)
	which accepts detailed parameters (company, from_date, to_date, etc.)

	This old version is kept for reference only and is NOT being used since Python
	doesn't support function overloading - the new function overwrites this one.

	Get PDC (Post Dated Cheque) data
	"""
	if isinstance(filters, str):
		import json
		filters = json.loads(filters)

	if not filters:
		filters = {}

	today = frappe.utils.today()
	week_end = frappe.utils.add_days(today, 7)
	month_end = frappe.utils.add_months(today, 1)

	# Get all PDCs
	pdc_list = frappe.db.sql("""
		SELECT
			py.name as cheque_no,
			py.party_name as customer,
			py.paid_amount as amount,
			py.reference_date as due_date,
			py.posting_date,
			DATEDIFF(py.reference_date, CURDATE()) as days_to_due,
			CASE
				WHEN py.reference_date < CURDATE() THEN 'Overdue'
				WHEN py.reference_date <= %s THEN 'Due This Week'
				WHEN py.reference_date <= %s THEN 'Due This Month'
				ELSE 'Scheduled'
			END as status
		FROM `tabPayment Entry` py
		WHERE py.mode_of_payment = 'Cheque'
			AND py.reference_date IS NOT NULL
			AND py.reference_date > py.posting_date
			AND py.payment_type = 'Receive'
			AND py.docstatus = 1
		ORDER BY py.reference_date ASC
	""", (week_end, month_end), as_dict=True)

	# Calculate summaries
	due_this_week = sum(p.amount for p in pdc_list if p.status == 'Due This Week')
	due_this_month = sum(p.amount for p in pdc_list if p.status in ['Due This Week', 'Due This Month'])
	overdue = sum(p.amount for p in pdc_list if p.status == 'Overdue')

	return {
		'pdc_list': pdc_list[:10],  # Return top 10
		'due_this_week': due_this_week,
		'due_this_month': due_this_month,
		'overdue': overdue,
		'total_count': len(pdc_list)
	}


@frappe.whitelist()
def get_company_list():
	"""Get list of all companies"""
	companies = frappe.get_all('Company',
		fields=['name'],
		order_by='name'
	)
	return companies


@frappe.whitelist()
def get_branch_list():
	"""Get list of all branches"""
	branches = frappe.get_all('Branch',
		fields=['name'],
		order_by='name'
	)
	return branches


@frappe.whitelist()
def get_internal_customers():
	"""Get list of internal customer names (is_internal_customer = 1)"""
	customers = frappe.get_all('Customer',
		filters={'is_internal_customer': 1, 'disabled': 0},
		fields=['name']
	)
	return [c.name for c in customers]


@frappe.whitelist()
def get_customer_classification_sql(customer_names=None, company=None, sales_person=None, sales_team=None, internal_customer=None):
	"""Page-level proxy so arm_dashboard.js can call methods within this folder path."""
	from prastara_custom.controller.accounts_receivable import get_customer_classification_sql as _get_customer_classification_sql
	return _get_customer_classification_sql(
		customer_names=customer_names,
		company=company,
		sales_person=sales_person,
		sales_team=sales_team,
		internal_customer=internal_customer,
	)


@frappe.whitelist()
def get_sales_order_status(sales_order_names=None, company=None, branch=None, sales_person=None, sales_team=None, internal_customer=None):
	"""Page-level proxy for payment schedule section."""
	from prastara_custom.controller.accounts_receivable import get_sales_order_status as _get_sales_order_status
	return _get_sales_order_status(
		sales_order_names=sales_order_names,
		company=company,
		branch=branch,
		sales_person=sales_person,
		sales_team=sales_team,
		internal_customer=internal_customer,
	)


@frappe.whitelist()
def get_customer_outstandings_new(filters=None, customer=None, sales_person=None, sales_team=None, branch=None, group_by_customer=True, internal_customer=None, include_sales_person=False):
	"""Page-level proxy for AR main grid API."""
	from prastara_custom.controller.accounts_receivable import get_customer_outstandings_new as _get_customer_outstandings_new
	return _get_customer_outstandings_new(
		filters=filters,
		customer=customer,
		sales_person=sales_person,
		sales_team=sales_team,
		branch=branch,
		group_by_customer=group_by_customer,
		internal_customer=internal_customer,
		include_sales_person=include_sales_person,
	)


@frappe.whitelist()
def get_sales_person_data(invoice_numbers):
	"""Page-level proxy for sales person enrichment calls."""
	from prastara_custom.controller.accounts_receivable import get_sales_person_data as _get_sales_person_data
	return _get_sales_person_data(invoice_numbers)


@frappe.whitelist()
def get_pos_profiles():
	"""Get list of all POS profiles"""
	pos_profiles = frappe.get_all('POS Profile',
		fields=['name', 'branch'],
		order_by='name'
	)
	return pos_profiles


@frappe.whitelist()
def get_sales_persons(company=None):
	"""Get list of sales persons filtered by company (based on Sales Invoice transactions)"""
	if not company:
		# If no company specified, return all enabled sales persons
		sales_persons = frappe.get_all('Sales Person',
			filters={'enabled': 1},
			fields=['name', 'sales_person_name', 'parent_sales_person'],
			order_by='sales_person_name'
		)
		return sales_persons

	# Get sales persons who have transactions in the specified company
	sales_persons = frappe.db.sql("""
		SELECT DISTINCT
			sp.name,
			sp.sales_person_name,
			sp.parent_sales_person
		FROM `tabSales Person` sp
		INNER JOIN `tabSales Team` st ON st.sales_person = sp.name
		INNER JOIN `tabSales Invoice` si ON si.name = st.parent AND st.parenttype = 'Sales Invoice'
		WHERE sp.enabled = 1
			AND si.docstatus = 1
			AND si.company = %s
		ORDER BY sp.sales_person_name
	""", (company,), as_dict=True)

	return sales_persons


@frappe.whitelist()
def get_sales_teams(company=None):
	"""Get list of unique parent sales persons (teams) filtered by company"""
	if not company:
		# If no company specified, return all teams
		teams = frappe.db.sql("""
			SELECT DISTINCT parent_sales_person as name
			FROM `tabSales Person`
			WHERE parent_sales_person IS NOT NULL
				AND parent_sales_person != ''
			ORDER BY parent_sales_person
		""", as_dict=True)
		return teams

	# Get teams (parent sales persons) who have transactions in the specified company
	teams = frappe.db.sql("""
		SELECT DISTINCT st.parent_sales_person as name
		FROM `tabSales Team` st
		INNER JOIN `tabSales Invoice` si ON si.name = st.parent AND st.parenttype = 'Sales Invoice'
		WHERE st.parent_sales_person IS NOT NULL
			AND st.parent_sales_person != ''
			AND si.docstatus = 1
			AND si.company = %s
		ORDER BY st.parent_sales_person
	""", (company,), as_dict=True)

	return teams


@frappe.whitelist()
def get_collection_trends(filters=None):
	"""Get collection trends for charts"""
	if isinstance(filters, str):
		import json
		filters = json.loads(filters)

	if not filters:
		filters = {}

	# Get date range
	from_date = filters.get("from_date") or frappe.utils.add_months(frappe.utils.today(), -1)
	to_date = filters.get("to_date") or frappe.utils.today()

	# Build conditions
	conditions = ["si.posting_date BETWEEN %s AND %s", "si.docstatus = 1"]
	values = [from_date, to_date]

	if filters.get("company"):
		conditions.append("si.company = %s")
		values.append(filters.get("company"))

	where_clause = " AND ".join(conditions)

	# Get daily collection data
	daily_data = frappe.db.sql(f"""
		SELECT
			DATE(si.posting_date) as date,
			SUM(sp.amount) as amount
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent
		WHERE {where_clause}
		GROUP BY DATE(si.posting_date)
		ORDER BY date ASC
	""", tuple(values), as_dict=True)

	return daily_data


@frappe.whitelist()
def get_recent_activities(limit=10, company=None):
	"""Get recent collection activities"""
	conditions = ["py.payment_type = 'Receive'", "py.docstatus = 1", "py.posting_date >= CURDATE()"]
	values = []

	if company:
		conditions.append("py.company = %s")
		values.append(company)

	where_clause = " AND ".join(conditions)

	activities = frappe.db.sql(f"""
		SELECT
			py.posting_date,
			py.posting_time,
			po.branch,
			py.pos_profile,
			py.mode_of_payment,
			py.paid_amount as amount,
			py.name as invoice,
			TIMESTAMPDIFF(MINUTE, CONCAT(py.posting_date, ' ', py.posting_time), NOW()) as minutes_ago
		FROM `tabPayment Entry` py
		LEFT JOIN `tabPOS Profile` po ON py.pos_profile = po.name
		WHERE {where_clause}
		ORDER BY py.posting_date DESC, py.posting_time DESC
		LIMIT {{0}}
	""".format(limit), tuple(values), as_dict=True)

	return activities


@frappe.whitelist()
def get_overview_ar_summary(company=None, report_date=None, customer=None, branch=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    Get AR report summary for Overview section.
    Returns 5 summary values matching the Accounts Receivable report.
    """
    if not company:
        return {
            'total_invoiced': 0,
            'collection_against_invoice': 0,
            'credit_note': 0,
            'outstanding': 0,
            'unallocated_advance': 0
        }

    try:
        from erpnext.accounts.report.accounts_receivable.accounts_receivable import execute

        ar_report_date = report_date or frappe.utils.today()

        ar_filters = frappe._dict({
            'company': company,
            'report_date': ar_report_date,
            'ageing_based_on': 'Posting Date',
            'range1': 30,
            'range2': 60,
            'range3': 90,
            'range4': 120,
            'show_sales_person': 1,
        })

        if customer:
            ar_filters['customer'] = customer

        if sales_person:
            ar_filters['sales_person'] = sales_person

        columns, data, _, chart, _, skip_total_row = execute(ar_filters)

        # Post-filtering for branch and sales_team
        branch_vouchers = set()
        if branch:
            branch_invoices = frappe.get_all('Sales Invoice',
                filters={'branch': branch, 'docstatus': 1},
                pluck='name'
            )
            branch_vouchers = set(branch_invoices)

        sales_team_customers = set()
        if sales_team:
            team_results = frappe.db.sql("""
                SELECT DISTINCT si.customer
                FROM `tabSales Invoice` si
                INNER JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
                WHERE si.docstatus = 1 AND st.parent_sales_person = %s
            """, (sales_team,), as_dict=True)
            sales_team_customers = set(r.customer for r in team_results)

        # Get internal customers if filter is enabled
        internal_customer_list = set()
        internal_customer_val = str(internal_customer).lower() if internal_customer else ''
        filter_internal_yes = internal_customer_val in ['1', 'true', 'yes']
        filter_internal_no = internal_customer_val == 'no'

        if filter_internal_yes or filter_internal_no:
            internal_customers = frappe.get_all('Customer',
                filters={'is_internal_customer': 1, 'disabled': 0},
                pluck='name'
            )
            internal_customer_list = set(internal_customers)

        # Calculate summary from AR data
        total_invoiced = 0
        collection_against_invoice = 0
        credit_note_total = 0
        outstanding_total = 0
        unallocated_advance = 0

        for row in data:
            if not row:
                continue
            if row.get('bold'):
                continue

            party = row.get('party', '')

            # Apply internal customer filter
            if filter_internal_yes and party not in internal_customer_list:
                continue
            if filter_internal_no and party in internal_customer_list:
                continue

            # Apply branch filter
            if branch and row.get('voucher_type') == 'Sales Invoice':
                if row.get('voucher_no', '') not in branch_vouchers:
                    continue

            # Apply sales_team filter
            if sales_team and party not in sales_team_customers:
                continue

            invoiced = flt(row.get('invoiced', 0))
            paid = flt(row.get('paid', 0))
            credit_note_amt = flt(row.get('credit_note', 0))
            outstanding = flt(row.get('outstanding', 0))
            voucher_type = row.get('voucher_type', '')

            total_invoiced += invoiced
            credit_note_total += credit_note_amt

            if voucher_type == 'Sales Invoice':
                collection_against_invoice += paid
                outstanding_total += outstanding
            else:
                unallocated_advance += outstanding

        return {
            'total_invoiced': total_invoiced,
            'collection_against_invoice': collection_against_invoice,
            'credit_note': credit_note_total,
            'outstanding': outstanding_total,
            'unallocated_advance': unallocated_advance
        }

    except Exception as e:
        import traceback
        frappe.log_error(f"Error in get_overview_ar_summary: {str(e)}\n{traceback.format_exc()}")
        return {
            'total_invoiced': 0,
            'collection_against_invoice': 0,
            'credit_note': 0,
            'outstanding': 0,
            'unallocated_advance': 0
        }

@frappe.whitelist()
def get_intercompany_overdues(filters=None, company=None, report_date=None, customer=None, branch=None, sales_person=None, sales_team=None):
    """
    Get inter-company receivable data using the Accounts Receivable report.
    Filters by is_internal_customer = 1 on the Customer doctype.
    """
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)

    if not filters:
        filters = {}

    # Merge direct parameters into filters
    if company:
        filters['company'] = company
    if report_date:
        filters['report_date'] = report_date
    if customer:
        filters['customer'] = customer
    if branch:
        filters['branch'] = branch
    if sales_person:
        filters['sales_person'] = sales_person
    if sales_team:
        filters['sales_team'] = sales_team

    if not filters.get('company'):
        return {
            'data': [],
            'summary': {
                'total_invoiced': 0,
                'collection_against_invoice': 0,
                'credit_note': 0,
                'outstanding': 0,
                'unallocated_advance': 0
            }
        }

    try:
        from erpnext.accounts.report.accounts_receivable.accounts_receivable import execute
        from frappe.utils import flt, today

        # Get all active internal customers
        internal_customers = frappe.get_all('Customer',
            filters={'is_internal_customer': 1, 'disabled': 0},
            pluck='name'
        )

        if not internal_customers:
            return {
                'data': [],
                'summary': {k: 0 for k in ['total_invoiced', 'collection_against_invoice', 'credit_note', 'outstanding', 'unallocated_advance']}
            }

        internal_customers_set = set(internal_customers)

        # Report date
        report_date = filters.get('report_date') or today()

        # Base filters for AR report — IMPORTANT: no mass 'customer' filter
        ar_filters = frappe._dict({
            'company': filters.get('company'),
            'report_date': report_date,
            'ageing_based_on': 'Posting Date',
            'range1': 30,
            'range2': 60,
            'range3': 90,
            'range4': 120,
            'show_sales_person': 1,
        })

        # If specific single customer requested → apply it
        requested_customer = filters.get('customer')
        if requested_customer:
            if requested_customer in internal_customers_set:
                ar_filters['customer'] = requested_customer
            else:
                # Not internal → empty result
                return {
                    'data': [],
                    'summary': {k: 0 for k in ['total_invoiced', 'collection_against_invoice', 'credit_note', 'outstanding', 'unallocated_advance']}
                }

        # Optional: sales person filter
        if filters.get('sales_person'):
            ar_filters['sales_person'] = filters.get('sales_person')

        # Execute standard AR report
        columns, data, _, chart, _, skip_total_row = execute(ar_filters)

        # Prepare post-filters
        branch_filter = filters.get('branch')
        sales_team_filter = filters.get('sales_team')

        branch_vouchers = set()
        if branch_filter:
            branch_invoices = frappe.get_all('Sales Invoice',
                filters={'branch': branch_filter, 'docstatus': 1},
                pluck='name'
            )
            branch_vouchers = set(branch_invoices)

        sales_team_customers = set()
        if sales_team_filter:
            team_results = frappe.db.sql("""
                SELECT DISTINCT si.customer
                FROM `tabSales Invoice` si
                INNER JOIN `tabSales Team` st
                    ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
                WHERE si.docstatus = 1
                  AND st.parent_sales_person = %s
            """, (sales_team_filter,), as_dict=1)
            sales_team_customers = {r.customer for r in team_results}

        # Filter rows: only internal customers + branch/team if requested
        internal_data = []
        for row in data or []:
            if not row or row.get('bold') or row.get('is_total_row'):
                continue

            party = row.get('party') or row.get('customer') or ''
            if not party or party not in internal_customers_set:
                continue

            # Branch filter
            if branch_filter and row.get('voucher_type') == 'Sales Invoice':
                if row.get('voucher_no') not in branch_vouchers:
                    continue

            # Sales team filter
            if sales_team_filter and party not in sales_team_customers:
                continue

            internal_data.append(row)

        # Compute summary
        total_invoiced = collection_against_invoice = credit_note_total = 0
        outstanding_total = unallocated_advance = 0

        for row in internal_data:
            invoiced = flt(row.get('invoiced', 0))
            paid = flt(row.get('paid', 0))
            credit_note_amt = flt(row.get('credit_note', 0))
            outstanding = flt(row.get('outstanding', 0))
            vtype = row.get('voucher_type', '')

            total_invoiced += invoiced
            credit_note_total += credit_note_amt

            if vtype == 'Sales Invoice':
                collection_against_invoice += paid
                outstanding_total += outstanding
            else:
                # Advances / journal entries etc.
                unallocated_advance += outstanding

        # Format output rows
        formatted_data = []
        for row in internal_data:
            party = row.get('party') or row.get('customer') or ''
            represents_company = frappe.db.get_value('Customer', party, 'represents_company') or ''

            formatted_data.append({
                'posting_date': str(row.get('posting_date') or ''),
                'customer': party,
                'customer_name': row.get('party_name') or party,
                'voucher_type': row.get('voucher_type', ''),
                'voucher_no': row.get('voucher_no', ''),
                'due_date': str(row.get('due_date') or ''),
                'invoiced_amount': flt(row.get('invoiced', 0)),
                'paid_amount': flt(row.get('paid', 0)),
                'credit_note': flt(row.get('credit_note', 0)),
                'outstanding_amount': flt(row.get('outstanding', 0)),
                'age': row.get('age', 0),
                'range1': flt(row.get('range1', 0)),
                'range2': flt(row.get('range2', 0)),
                'range3': flt(row.get('range3', 0)),
                'range4': flt(row.get('range4', 0)),
                'range5': flt(row.get('range5', 0)),
                'internal_company': represents_company,
                'sales_person': row.get('sales_person', ''),
            })

        return {
            'data': formatted_data,
            'summary': {
                'total_invoiced': total_invoiced,
                'collection_against_invoice': collection_against_invoice,
                'credit_note': credit_note_total,
                'outstanding': outstanding_total,
                'unallocated_advance': unallocated_advance
            }
        }

    except Exception as e:
        import traceback
        err = str(e)
        tb = traceback.format_exc()
        short_err = (err + tb)[:500] + "..." if len(err + tb) > 500 else (err + tb)
        frappe.log_error(short_err, "Intercompany Overdues Error")
        return {
            'data': [],
            'summary': {k: 0 for k in ['total_invoiced', 'collection_against_invoice', 'credit_note', 'outstanding', 'unallocated_advance']},
            'error': err
        }


@frappe.whitelist()
def get_payment_followup(filters=None, company=None, report_date=None, customer=None, branch=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    Get payment followup data from the configured Sales Invoice follow-up child table.
    Returns both the raw followup timeline and a latest-per-invoice meeting tracker view.
    """
    import json
    from frappe.utils import flt, today, getdate, get_datetime

    if isinstance(filters, str):
        filters = json.loads(filters)

    if not filters:
        filters = {}

    if company:
        filters['company'] = company
    if report_date:
        filters['report_date'] = report_date
    if customer:
        filters['customer'] = customer
    if branch:
        filters['branch'] = branch
    if sales_person:
        filters['sales_person'] = sales_person
    if sales_team:
        filters['sales_team'] = sales_team
    if internal_customer is not None:
        filters['internal_customer'] = internal_customer

    empty_summary = {
        'total_followups': 0,
        'total_invoices': 0,
        'open_invoices': 0,
        'pending_followups': 0,
        'today_followups': 0,
        'broken_promises': 0,
        'due_today': 0,
        'due_this_week': 0,
        'no_commitment': 0,
        'recently_extended': 0,
        'closed_after_followup': 0,
        'action_required': 0,
        'total_outstanding': 0,
        'action_required_outstanding': 0
    }

    if not filters.get('company'):
        return {
            'data': [],
            'invoice_data': [],
            'summary': empty_summary
        }

    followup_config = _get_payment_followup_config()
    if not followup_config:
        return {
            'data': [],
            'invoice_data': [],
            'summary': empty_summary
        }

    try:
        base_date = getdate(filters.get('report_date') or today())

        def get_row_datetime(row):
            return get_datetime(row.get('followup_date_time') or row.get('creation'))

        def get_promise_date(row):
            if not row.get('payment_extended_date'):
                return None
            return getdate(row.get('payment_extended_date'))

        def get_commitment_window(promise_date):
            if not promise_date:
                return 'No commitment recorded', None

            delta = (promise_date - base_date).days
            if delta < 0:
                return f'Overdue by {abs(delta)} day(s)', delta
            if delta == 0:
                return 'Due today', delta
            if delta == 1:
                return 'Due tomorrow', delta
            return f'Due in {delta} day(s)', delta

        def get_status_details(outstanding, promise_date):
            if flt(outstanding) <= 0:
                return 'Closed', 'closed', 'Closed After Followup', 5
            if not promise_date:
                return 'No Commitment', 'no_commitment', 'Action Required', 2

            delta = (promise_date - base_date).days
            if delta < 0:
                return 'Broken Promise', 'broken_promise', 'Action Required', 0
            if delta == 0:
                return 'Due Today', 'due_today', 'Action Required', 1
            return 'Upcoming', 'upcoming', 'Upcoming Commitments', 3

        where_conditions = ["si.docstatus = 1", "si.company = %(company)s"]
        params = {'company': filters.get('company')}

        if filters.get('customer'):
            where_conditions.append("si.customer = %(customer)s")
            params['customer'] = filters.get('customer')

        if filters.get('branch'):
            where_conditions.append("si.branch = %(branch)s")
            params['branch'] = filters.get('branch')

        if filters.get('sales_person'):
            where_conditions.append("""
                EXISTS (
                    SELECT 1 FROM `tabSales Team` st
                    WHERE st.parent = si.name
                    AND st.parenttype = 'Sales Invoice'
                    AND st.sales_person = %(sales_person)s
                )
            """)
            params['sales_person'] = filters.get('sales_person')

        if filters.get('sales_team'):
            where_conditions.append("""
                EXISTS (
                    SELECT 1 FROM `tabSales Team` st
                    WHERE st.parent = si.name
                    AND st.parenttype = 'Sales Invoice'
                    AND st.sales_person IN (
                        SELECT sp.name FROM `tabSales Person` sp
                        WHERE sp.parent_sales_person = %(sales_team)s
                        OR sp.name = %(sales_team)s
                    )
                )
            """)
            params['sales_team'] = filters.get('sales_team')

        internal_customer_val = filters.get('internal_customer')
        if internal_customer_val:
            internal_val_lower = str(internal_customer_val).lower()
            if internal_val_lower in ['1', 'true', 'yes']:
                where_conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = si.customer AND c.is_internal_customer = 1)")
            elif internal_val_lower == 'no':
                where_conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = si.customer AND c.is_internal_customer = 1)")

        where_clause = " AND ".join(where_conditions)

        method_select = "pf.method" if followup_config.get('has_method') else "NULL"
        comment_select = f"pf.{followup_config['comment_field']}" if followup_config.get('comment_field') else "NULL"
        promise_select = "pf.payment_extended_date" if followup_config.get('has_payment_extended_date') else "NULL"
        followup_at_select = "pf.followup_date_time" if followup_config.get('has_followup_date_time') else "NULL"
        followup_by_select = "pf.followup_by" if followup_config.get('has_followup_by') else "NULL"
        order_expr = "COALESCE(pf.followup_date_time, pf.creation)" if followup_config.get('has_followup_date_time') else "pf.creation"

        query = f"""
            SELECT
                pf.name as followup_id,
                pf.parent as sales_invoice,
                {method_select} as method,
                {comment_select} as comments,
                {promise_select} as payment_extended_date,
                {followup_at_select} as followup_date_time,
                {followup_by_select} as followup_by,
                pf.creation,
                si.customer,
                si.customer_name,
                si.outstanding_amount as outstanding,
                si.posting_date,
                si.due_date,
                si.grand_total,
                (
                    SELECT GROUP_CONCAT(st.sales_person ORDER BY st.idx SEPARATOR ', ')
                    FROM `tabSales Team` st
                    WHERE st.parent = si.name
                    AND st.parenttype = 'Sales Invoice'
                ) as sales_persons
            FROM `{followup_config['table']}` pf
            INNER JOIN `tabSales Invoice` si ON pf.parent = si.name
            WHERE {where_clause}
            ORDER BY pf.parent, {order_expr} DESC, pf.creation DESC
        """

        data = frappe.db.sql(query, params, as_dict=True)

        invoice_map = {}
        today_followups = 0

        for row in data:
            row_datetime = get_row_datetime(row)
            promise_date = get_promise_date(row)

            row['sales_persons'] = row.get('sales_persons') or ''
            row['promise_delta_days'] = (promise_date - base_date).days if promise_date else None
            row['commitment_window'] = get_commitment_window(promise_date)[0]

            if row_datetime and getdate(row_datetime) == base_date:
                today_followups += 1

            invoice_map.setdefault(row['sales_invoice'], []).append(row)

        invoice_data = []
        summary = empty_summary.copy()
        summary['total_followups'] = len(data)
        summary['today_followups'] = today_followups

        for history_rows in invoice_map.values():
            history_rows = sorted(history_rows, key=get_row_datetime, reverse=True)
            latest = history_rows[0]
            outstanding = flt(latest.get('outstanding'))
            latest_promise_date = get_promise_date(latest)

            previous_promise_date = None
            for previous_row in history_rows[1:]:
                previous_promise_date = get_promise_date(previous_row)
                if previous_promise_date:
                    break

            extension_count = 0
            previous_seen_promise = None
            for history_row in sorted(history_rows, key=get_row_datetime):
                history_promise_date = get_promise_date(history_row)
                if not history_promise_date:
                    continue
                if previous_seen_promise and history_promise_date > previous_seen_promise:
                    extension_count += 1
                previous_seen_promise = history_promise_date

            commitment_window, promise_delta_days = get_commitment_window(latest_promise_date)
            status, status_code, focus_bucket, sort_priority = get_status_details(outstanding, latest_promise_date)
            was_recently_extended = bool(
                latest_promise_date and previous_promise_date and latest_promise_date > previous_promise_date and outstanding > 0
            )

            invoice_data.append({
                'sales_invoice': latest.get('sales_invoice'),
                'customer': latest.get('customer'),
                'customer_name': latest.get('customer_name'),
                'outstanding': outstanding,
                'posting_date': latest.get('posting_date'),
                'due_date': latest.get('due_date'),
                'grand_total': flt(latest.get('grand_total')),
                'sales_persons': latest.get('sales_persons') or '',
                'latest_method': latest.get('method'),
                'latest_comment': latest.get('comments'),
                'latest_promise_date': latest.get('payment_extended_date'),
                'latest_followup_at': latest.get('followup_date_time') or latest.get('creation'),
                'latest_followup_by': latest.get('followup_by'),
                'previous_promise_date': previous_promise_date,
                'followup_count': len(history_rows),
                'extension_count': extension_count,
                'was_recently_extended': was_recently_extended,
                'promise_delta_days': promise_delta_days,
                'commitment_window': commitment_window,
                'status': status,
                'status_code': status_code,
                'focus_bucket': focus_bucket,
                'sort_priority': sort_priority,
                'history': history_rows
            })

            summary['total_outstanding'] += max(outstanding, 0)
            if outstanding > 0:
                summary['open_invoices'] += 1

            if status_code == 'broken_promise':
                summary['broken_promises'] += 1
            elif status_code == 'due_today':
                summary['due_today'] += 1
            elif status_code == 'no_commitment':
                summary['no_commitment'] += 1
            elif status_code == 'closed':
                summary['closed_after_followup'] += 1

            if outstanding > 0 and latest_promise_date and promise_delta_days is not None:
                if promise_delta_days >= 0:
                    summary['pending_followups'] += 1
                if 1 <= promise_delta_days <= 7:
                    summary['due_this_week'] += 1

            if was_recently_extended:
                summary['recently_extended'] += 1

            if focus_bucket == 'Action Required':
                summary['action_required'] += 1
                summary['action_required_outstanding'] += outstanding

        invoice_data.sort(
            key=lambda row: (
                row.get('sort_priority', 99),
                row.get('promise_delta_days') if row.get('promise_delta_days') is not None else 999999,
                -flt(row.get('outstanding')),
                row.get('customer_name') or row.get('customer') or '',
                row.get('sales_invoice') or ''
            )
        )

        summary['total_invoices'] = len(invoice_data)

        return {
            'data': data,
            'invoice_data': invoice_data,
            'summary': summary
        }

    except Exception as e:
        import traceback
        err = str(e)
        tb = traceback.format_exc()
        short_err = (err + tb)[:500] + "..." if len(err + tb) > 500 else (err + tb)
        frappe.log_error(short_err, "Payment Followup Error")
        return {
            'data': [],
            'invoice_data': [],
            'summary': empty_summary,
            'error': err
        }


import frappe

@frappe.whitelist()
def get_disable_customer(customer_names=None, company=None, branch=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    API to classify customers as listed or non-listed using SQL, including credit limit (per company) and credit days.

    Args:
        customer_names (list, optional): List of customer names (e.g., ['Cust-001', 'Cust-002']).
        company (str, optional): The company name to fetch credit limit for (e.g., 'Your Company').
        branch (str, optional): The branch to filter by.
        sales_person (str, optional): The sales person to filter by.
        sales_team (str, optional): The sales team (parent sales person) to filter by.
        internal_customer (bool, optional): Filter by is_internal_customer field.

    Returns:
        dict: {'listed': [], 'non_listed': []}
    """
    # Validate inputs
    if customer_names and not isinstance(customer_names, list):
        frappe.throw("customer_names must be a list")
    if company and not isinstance(company, str):
        frappe.throw("company must be a string")

    # Build WHERE conditions
    where_conditions = ["c.disabled = 0", "c.is_frozen = 1"]

    # Internal customer filter - filter by is_internal_customer field
    if internal_customer:
        internal_val_lower = str(internal_customer).lower()
        if internal_val_lower in ['1', 'true', 'yes']:
            where_conditions.append("c.is_internal_customer = 1")
        elif internal_val_lower == 'no':
            where_conditions.append("(c.is_internal_customer = 0 OR c.is_internal_customer IS NULL)")

    if customer_names:
        where_conditions.append("c.name IN %(customer_names)s")

    if branch:
        where_conditions.append("c.custom_branch = %(branch)s")

    # Sales Person filter - check if customer has invoices with this sales person
    if sales_person:
        where_conditions.append("""
            EXISTS (
                SELECT 1 FROM `tabSales Invoice` si
                JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
                WHERE si.customer = c.name
                    AND si.docstatus = 1
                    AND st.sales_person = %(sales_person)s
            )
        """)

    # Sales Team filter - check if customer has invoices with this team
    if sales_team:
        where_conditions.append("""
            EXISTS (
                SELECT 1 FROM `tabSales Invoice` si
                JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
                WHERE si.customer = c.name
                    AND si.docstatus = 1
                    AND st.parent_sales_person = %(sales_team)s
            )
        """)

    where_clause = " AND ".join(where_conditions)

    query = f"""
        SELECT
            c.name,
            c.customer_name,
            c.customer_type,
            c.territory,
            c.customer_group,
            c.custom_is_listed_customer
        FROM
            `tabCustomer` c
        WHERE
            {where_clause}
    """

    # Convert customer_names to tuple for SQL IN clause
    params = {
        "customer_names": tuple(customer_names) if customer_names else None,
        "company": company,
        "branch": branch,
        "sales_person": sales_person,
        "sales_team": sales_team
    }
    
    try:
        # Execute query
        results = frappe.db.sql(query, params, as_dict=True)

        # For each customer, get outstanding and sales data
        for customer in results:
            # Get outstanding amount
            outstanding = frappe.db.sql("""
                SELECT COALESCE(SUM(outstanding_amount), 0) as outstanding
                FROM `tabSales Invoice`
                WHERE customer = %s
                    AND docstatus = 1
                    AND outstanding_amount > 0
            """, (customer.name,), as_dict=True)

            customer['outstanding'] = flt(outstanding[0].outstanding) if outstanding else 0

            # Get total sales (all time)
            total_sales = frappe.db.sql("""
                SELECT COALESCE(SUM(grand_total), 0) as total_sales
                FROM `tabSales Invoice`
                WHERE customer = %s
                    AND docstatus = 1
            """, (customer.name,), as_dict=True)

            customer['total_sales'] = flt(total_sales[0].total_sales) if total_sales else 0

            # Get total invoices count
            invoice_count = frappe.db.sql("""
                SELECT COUNT(*) as count
                FROM `tabSales Invoice`
                WHERE customer = %s
                    AND docstatus = 1
            """, (customer.name,), as_dict=True)

            customer['invoice_count'] = invoice_count[0].count if invoice_count else 0

            # Get credit limit for the specified company
            if company:
                credit_limit = frappe.db.sql("""
                    SELECT COALESCE(credit_limit, 0) as credit_limit
                    FROM `tabCustomer Credit Limit`
                    WHERE parent = %s
                        AND company = %s
                """, (customer.name, company), as_dict=True)
                customer['credit_limit'] = flt(credit_limit[0].credit_limit) if credit_limit else 0
            else:
                customer['credit_limit'] = 0

            # Set block reason as Frozen (since all are is_frozen = 1)
            customer['block_reason'] = 'Frozen'
            customer['on_hold'] = 0

        # Split into listed and non_listed based on custom_is_listed_customer field
        listed = [row for row in results if row.get('custom_is_listed_customer') == 1]
        non_listed = [row for row in results if row.get('custom_is_listed_customer') != 1]

        # Calculate summaries with proper handling of decimal values using flt() for precision
        total_outstanding = flt(sum(flt(c.get('outstanding', 0)) for c in results))
        total_sales = flt(sum(flt(c.get('total_sales', 0)) for c in results))

        return {
            "listed": listed,
            "non_listed": non_listed,
            "total_outstanding": total_outstanding,
            "total_sales": total_sales
        }
    except Exception as e:
        frappe.log_error(f"Error in get_disable_customer: {str(e)}")
        frappe.throw(f"Failed to fetch customer data: {str(e)}")

@frappe.whitelist()
def get_pdc_data(company=None, from_date=None, to_date=None, customer=None, branch=None, sales_team=None, sales_person=None, internal_customer=None):
	"""
	Get Post-Dated Cheque data for ARM Dashboard
	Returns PDC information with collection date and maturity date analysis
	"""
	try:
		frappe.logger().info(f"=== get_pdc_data called ===")
		frappe.logger().info(f"Parameters: company={company}, from_date={from_date}, to_date={to_date}, branch={branch}, internal_customer={internal_customer}")

		conditions = []
		values = []

		# Base condition: Mode of payment is Cheque (matches Collection Tracker logic)
		conditions.append("pe.mode_of_payment = 'Cheque'")
		conditions.append("pe.docstatus = 1")
		# Only show incoming cheques from customers (not outgoing Pay or Internal Transfer)
		conditions.append("pe.payment_type = 'Receive'")

		# Internal customer filter - filter by is_internal_customer field
		if internal_customer:
			internal_val_lower = str(internal_customer).lower()
			if internal_val_lower in ['1', 'true', 'yes']:
				conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = pe.party AND c.is_internal_customer = 1)")
			elif internal_val_lower == 'no':
				conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = pe.party AND c.is_internal_customer = 1)")
		# Note: We include ALL cheques (same day, back dated, post-dated) to match Collection Tracker
		# Reference date can be null, same as posting date, or different
		# Cleared cheques are included to match the total PDC amount shown in Collection Tracker

		# Company filter
		if company:
			conditions.append("pe.company = %s")
			values.append(company)
			frappe.logger().info(f"Adding company filter: {company}")

		# Customer filter
		if customer:
			conditions.append("pe.party = %s")
			values.append(customer)

		# Branch filter - check both POS Profile branch and custom_branch field
		if branch:
			conditions.append("(COALESCE(po.branch, pe.custom_branch) = %s)")
			values.append(branch)

		# Sales Person filter - check if customer has invoices with this sales person
		if sales_person:
			conditions.append("""
				EXISTS (
					SELECT 1 FROM `tabSales Invoice` si
					JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
					WHERE si.customer = pe.party
						AND si.docstatus = 1
						AND st.sales_person = %s
				)
			""")
			values.append(sales_person)

		# Sales Team filter - check if customer has invoices with this team
		if sales_team:
			conditions.append("""
				EXISTS (
					SELECT 1 FROM `tabSales Invoice` si
					JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
					WHERE si.customer = pe.party
						AND si.docstatus = 1
						AND st.parent_sales_person = %s
				)
			""")
			values.append(sales_team)

		# Date range for posting_date (collection date) - filters PDCs based on when they were collected
		# This matches the Collection Tracker PDC card logic
		if from_date:
			conditions.append("DATE(pe.posting_date) >= %s")
			values.append(from_date)
		if to_date:
			conditions.append("DATE(pe.posting_date) <= %s")
			values.append(to_date)

		where_clause = " AND ".join(conditions) if conditions else "1=1"

		frappe.logger().info(f"WHERE clause: {where_clause}")
		frappe.logger().info(f"Values: {values}")

		query = f"""
			SELECT
				pe.name as payment_entry,
				pe.posting_date,
				pe.reference_date as cheque_date,
				pe.reference_no as cheque_number,
				pe.posting_date as collection_date,
				pe.party_type,
				pe.party as customer,
				pe.party_name as customer_name,
				pe.paid_amount,
				pe.company,
				pe.remarks,
				pe.clearance_date,
				CASE
					WHEN pe.clearance_date IS NOT NULL THEN 'Cleared'
					WHEN pe.reference_date IS NULL THEN 'No Cheque Date'
					WHEN pe.reference_date < CURDATE() THEN 'Pending Clearance'
					WHEN pe.reference_date = CURDATE() THEN 'Due Today'
					WHEN pe.reference_date > CURDATE() THEN 'Future'
					ELSE 'Unknown'
				END as pdc_status,
				CASE
					WHEN pe.reference_date IS NOT NULL THEN DATEDIFF(pe.reference_date, CURDATE())
					ELSE 0
				END as days_to_maturity,
				DATEDIFF(CURDATE(), pe.posting_date) as days_in_hand,
				CASE
					WHEN pe.reference_date > pe.posting_date THEN 'Post-Dated'
					WHEN pe.reference_date = pe.posting_date THEN 'Same Day'
					WHEN pe.reference_date < pe.posting_date THEN 'Back Dated'
					WHEN pe.reference_date IS NULL THEN 'No Date'
					ELSE 'Unknown'
				END as cheque_type
			FROM `tabPayment Entry` pe
			LEFT JOIN `tabPOS Profile` po ON pe.pos_profile = po.name
			WHERE {where_clause}
			ORDER BY pe.posting_date DESC, pe.reference_date ASC, pe.creation DESC
		"""

		pdc_records = frappe.db.sql(query, values, as_dict=True)
		print(f"DEBUG: get_pdc_data returned {len(pdc_records)} records")
		for pdc in pdc_records:
			print(f"DEBUG: PDC Record: name={pdc.payment_entry}, company={pdc.company}, amount={pdc.paid_amount}")

		frappe.logger().info(f"Query returned {len(pdc_records)} PDC records")

		# Calculate summaries
		total_amount = 0
		in_hand_amount = 0
		due_today_amount = 0
		overdue_amount = 0
		future_amount = 0
		past_collected_amount = 0
		due_this_week_amount = 0
		due_this_month_amount = 0

		due_today_count = 0
		overdue_count = 0
		future_count = 0
		past_collected_count = 0
		due_this_week_count = 0
		due_this_month_count = 0

		today = frappe.utils.today()
		week_end = frappe.utils.add_days(today, 7)
		month_end = frappe.utils.add_months(today, 1)

		for pdc in pdc_records:
			total_amount += pdc.paid_amount
			in_hand_amount += pdc.paid_amount

			if pdc.pdc_status == 'Due Today':
				due_today_amount += pdc.paid_amount
				due_today_count += 1
			elif pdc.pdc_status == 'Pending Clearance':
				overdue_amount += pdc.paid_amount
				overdue_count += 1
				past_collected_amount += pdc.paid_amount
				past_collected_count += 1
			elif pdc.pdc_status == 'Future':
				future_amount += pdc.paid_amount
				future_count += 1

			# Check if due this week (including today)
			if pdc.cheque_date and str(pdc.cheque_date) >= today and str(pdc.cheque_date) <= week_end:
				due_this_week_amount += pdc.paid_amount
				due_this_week_count += 1

			# Check if due this month (including this week)
			if pdc.cheque_date and str(pdc.cheque_date) >= today and str(pdc.cheque_date) <= month_end:
				due_this_month_amount += pdc.paid_amount
				due_this_month_count += 1

		# Group by collection date
		collection_grouped = {}
		for pdc in pdc_records:
			col_date = str(pdc.collection_date)
			if col_date not in collection_grouped:
				collection_grouped[col_date] = {
					'date': col_date,
					'count': 0,
					'amount': 0,
					'pdcs': []
				}
			collection_grouped[col_date]['count'] += 1
			collection_grouped[col_date]['amount'] += pdc.paid_amount
			collection_grouped[col_date]['pdcs'].append(pdc)

		# Group by maturity/cheque date
		maturity_grouped = {}
		for pdc in pdc_records:
			mat_date = str(pdc.cheque_date)
			if mat_date not in maturity_grouped:
				maturity_grouped[mat_date] = {
					'date': mat_date,
					'count': 0,
					'amount': 0,
					'status': pdc.pdc_status,
					'pdcs': []
				}
			maturity_grouped[mat_date]['count'] += 1
			maturity_grouped[mat_date]['amount'] += pdc.paid_amount
			maturity_grouped[mat_date]['pdcs'].append(pdc)

		# Group by month (based on cheque_date/reference_date)
		from datetime import datetime
		month_grouped = {}
		for pdc in pdc_records:
			if pdc.cheque_date:
				# Extract year-month from cheque_date
				cheque_date_obj = datetime.strptime(str(pdc.cheque_date), '%Y-%m-%d')
				month_key = cheque_date_obj.strftime('%Y-%m')  # Format: "2025-01", "2025-02", etc.
				month_name = cheque_date_obj.strftime('%B %Y')  # Format: "January 2025", "February 2025"

				if month_key not in month_grouped:
					month_grouped[month_key] = {
						'month': month_name,
						'month_key': month_key,
						'count': 0,
						'amount': 0,
						'pdcs': []
					}
				month_grouped[month_key]['count'] += 1
				month_grouped[month_key]['amount'] += pdc.paid_amount
				month_grouped[month_key]['pdcs'].append(pdc)

		# Sort month_grouped by month_key (year-month)
		month_grouped_sorted = sorted(month_grouped.values(), key=lambda x: x['month_key'])

		return {
			'summary': {
				'total_count': len(pdc_records),
				'total_amount': total_amount,
				'in_hand_amount': in_hand_amount,
				'due_today_amount': due_today_amount,
				'due_today_count': due_today_count,
				'overdue_amount': overdue_amount,
				'overdue_count': overdue_count,
				'past_collected_amount': past_collected_amount,
				'past_collected_count': past_collected_count,
				'due_this_week_amount': due_this_week_amount,
				'due_this_week_count': due_this_week_count,
				'due_this_month_amount': due_this_month_amount,
				'due_this_month_count': due_this_month_count,
				'future_amount': future_amount,
				'future_count': future_count
			},
			'pdc_records': pdc_records,
			'collection_grouped': list(collection_grouped.values()),
			'maturity_grouped': list(maturity_grouped.values()),
			'month_grouped': month_grouped_sorted
		}

	except Exception as e:
		frappe.log_error(f"Error in get_pdc_data: {str(e)}")
		return {
			'summary': {},
			'pdc_records': [],
			'collection_grouped': [],
			'maturity_grouped': [],
			'month_grouped': []
		}


@frappe.whitelist()
def get_received_collection_data(
	company=None,
	from_date=None,
	to_date=None,
	customer=None,
	branch=None,
	sales_person=None,
	sales_team=None,
	internal_customer=None,
	mode_of_payment=None,
	min_received_amount=None,
	max_received_amount=None,
	age_bucket=None,
	overdue_bucket=None,
	outstanding_status=None,
	reference_status=None,
):
	"""Fetch invoice-level received collections from Payment Ledger Entry."""
	from frappe.utils import getdate, today

	def build_empty_response(mode_options=None):
		return {
			"summary": {
				"total_received": 0,
				"receipt_count": 0,
				"invoice_count": 0,
				"customer_count": 0,
				"avg_age_at_receipt_days": 0,
				"latest_receipt_date": None,
			},
			"invoice_data": [],
			"history_by_invoice": {},
			"filter_options": {
				"mode_of_payment": mode_options or [],
			},
		}

	def normalize_string_list(value):
		if value is None:
			return []

		if isinstance(value, (list, tuple, set)):
			items = value
		elif isinstance(value, str):
			text = value.strip()
			if not text:
				return []

			parsed = None
			if text[0] in ("[", "{", "\""):
				try:
					parsed = json.loads(text)
				except Exception:
					parsed = None

			if isinstance(parsed, (list, tuple, set)):
				items = parsed
			else:
				items = text.split(",")
		else:
			items = [value]

		result = []
		for item in items:
			item_text = str(item).strip()
			if item_text:
				result.append(item_text)
		result = [item for item in result if normalize_choice(item) != "all"]
		return result

	def normalize_choice(value):
		return str(value or "").strip().lower()

	def matches_age_bucket(days, bucket):
		bucket = normalize_choice(bucket)
		days = int(days or 0)

		if not bucket or bucket == "all":
			return True
		if bucket == "0-30":
			return 0 <= days <= 30
		if bucket == "31-60":
			return 31 <= days <= 60
		if bucket == "61-90":
			return 61 <= days <= 90
		if bucket == "91-120":
			return 91 <= days <= 120
		if bucket == "120+":
			return days >= 121

		return True

	def matches_overdue_bucket(days, bucket):
		bucket = normalize_choice(bucket)
		days = int(days or 0)

		if not bucket or bucket == "all":
			return True
		if bucket == "not due":
			return days <= 0
		if bucket == "1-30":
			return 1 <= days <= 30
		if bucket == "31-60":
			return 31 <= days <= 60
		if bucket == "61-90":
			return 61 <= days <= 90
		if bucket == "90+":
			return days >= 91

		return True

	if not company:
		return build_empty_response()

	try:
		from_date = getdate(from_date) if from_date else getdate(frappe.utils.month_start())
		to_date = getdate(to_date) if to_date else getdate(today())

		if from_date > to_date:
			from_date, to_date = to_date, from_date

		has_si_branch = frappe.db.has_column("Sales Invoice", "branch")
		has_si_custom_branch = frappe.db.has_column("Sales Invoice", "custom_branch")
		has_si_internal_flag = frappe.db.has_column("Sales Invoice", "is_internal_customer")

		branch_select = "''"
		if has_si_branch:
			branch_select = "si.branch"
		elif has_si_custom_branch:
			branch_select = "si.custom_branch"

		base_conditions = [
			"ple.voucher_type = 'Payment Entry'",
			"ple.against_voucher_type = 'Sales Invoice'",
			"ple.delinked = 0",
			"pe.docstatus = 1",
			"pe.payment_type = 'Receive'",
			"ple.company = %(company)s",
			"DATE(ple.posting_date) >= %(from_date)s",
			"DATE(ple.posting_date) <= %(to_date)s",
		]
		values = {
			"company": company,
			"from_date": from_date,
			"to_date": to_date,
		}

		if customer:
			base_conditions.append("si.customer = %(customer)s")
			values["customer"] = customer

		if branch and branch_select != "''":
			base_conditions.append(f"{branch_select} = %(branch)s")
			values["branch"] = branch

		if sales_person:
			base_conditions.append("""
				EXISTS (
					SELECT 1
					FROM `tabSales Team` st
					WHERE st.parent = si.name
						AND st.parenttype = 'Sales Invoice'
						AND st.sales_person = %(sales_person)s
				)
			""")
			values["sales_person"] = sales_person

		if sales_team:
			base_conditions.append("""
				EXISTS (
					SELECT 1
					FROM `tabSales Team` st
					WHERE st.parent = si.name
						AND st.parenttype = 'Sales Invoice'
						AND st.parent_sales_person = %(sales_team)s
				)
			""")
			values["sales_team"] = sales_team

		internal_val_lower = str(internal_customer).strip().lower() if internal_customer is not None else ""
		if internal_val_lower in ["1", "true", "yes"]:
			if has_si_internal_flag:
				base_conditions.append("""
					(
						COALESCE(si.is_internal_customer, 0) = 1
						OR EXISTS (
							SELECT 1
							FROM `tabCustomer` c
							WHERE c.name = si.customer AND c.is_internal_customer = 1
						)
					)
				""")
			else:
				base_conditions.append("""
					EXISTS (
						SELECT 1
						FROM `tabCustomer` c
						WHERE c.name = si.customer AND c.is_internal_customer = 1
					)
				""")
		elif internal_val_lower in ["0", "false", "no"]:
			if has_si_internal_flag:
				base_conditions.append("""
					(
						COALESCE(si.is_internal_customer, 0) = 0
						AND NOT EXISTS (
							SELECT 1
							FROM `tabCustomer` c
							WHERE c.name = si.customer AND c.is_internal_customer = 1
						)
					)
				""")
			else:
				base_conditions.append("""
					NOT EXISTS (
						SELECT 1
						FROM `tabCustomer` c
						WHERE c.name = si.customer AND c.is_internal_customer = 1
					)
				""")

		base_where_clause = " AND ".join(base_conditions)

		mode_options = [
			row.mode_of_payment
			for row in frappe.db.sql(f"""
				SELECT DISTINCT pe.mode_of_payment
				FROM `tabPayment Ledger Entry` ple
				INNER JOIN `tabPayment Entry` pe ON pe.name = ple.voucher_no
				INNER JOIN `tabSales Invoice` si ON si.name = ple.against_voucher_no
				WHERE {base_where_clause}
					AND COALESCE(TRIM(pe.mode_of_payment), '') != ''
				ORDER BY pe.mode_of_payment
			""", values, as_dict=True)
			if row.mode_of_payment
		]

		conditions = list(base_conditions)
		mode_values = normalize_string_list(mode_of_payment)
		if mode_values:
			if len(mode_values) == 1:
				conditions.append("COALESCE(pe.mode_of_payment, '') = %(mode_of_payment_single)s")
				values["mode_of_payment_single"] = mode_values[0]
			else:
				conditions.append("COALESCE(pe.mode_of_payment, '') IN %(mode_of_payment_list)s")
				values["mode_of_payment_list"] = tuple(mode_values)

		reference_status_normalized = normalize_choice(reference_status)
		if reference_status_normalized in ("with reference", "with_reference", "with-reference"):
			conditions.append("COALESCE(TRIM(pe.reference_no), '') != ''")
		elif reference_status_normalized in ("without reference", "without_reference", "without-reference"):
			conditions.append("COALESCE(TRIM(pe.reference_no), '') = ''")

		where_clause = " AND ".join(conditions)

		filtered_rows = frappe.db.sql(f"""
			SELECT
				ple.voucher_no AS payment_entry,
				DATE(ple.posting_date) AS receipt_date,
				ABS(ple.amount) AS received_amount,
				pe.mode_of_payment,
				pe.reference_no,
				pe.reference_date,
				pe.remarks,
				si.name AS invoice_no,
				si.customer,
				si.customer_name,
				DATE(si.posting_date) AS invoice_posting_date,
				DATE(si.due_date) AS due_date,
				si.grand_total AS invoice_total,
				si.outstanding_amount AS current_outstanding,
				{branch_select} AS branch,
				DATEDIFF(DATE(ple.posting_date), DATE(si.posting_date)) AS age_at_receipt_days,
				CASE
					WHEN si.due_date IS NULL THEN 0
					WHEN DATEDIFF(DATE(ple.posting_date), DATE(si.due_date)) > 0 THEN DATEDIFF(DATE(ple.posting_date), DATE(si.due_date))
					ELSE 0
				END AS overdue_at_receipt_days
			FROM `tabPayment Ledger Entry` ple
			INNER JOIN `tabPayment Entry` pe ON pe.name = ple.voucher_no
			INNER JOIN `tabSales Invoice` si ON si.name = ple.against_voucher_no
			WHERE {where_clause}
			ORDER BY ple.posting_date DESC, ple.creation DESC, ple.name DESC
		""", values, as_dict=True)

		if not filtered_rows:
			return build_empty_response(mode_options)

		invoice_names = sorted({row.invoice_no for row in filtered_rows if row.invoice_no})
		sales_team_map = {}
		if invoice_names:
			sales_team_rows = frappe.db.sql("""
				SELECT
					st.parent AS invoice_no,
					GROUP_CONCAT(DISTINCT NULLIF(st.sales_person, '') ORDER BY st.idx SEPARATOR ', ') AS sales_persons,
					GROUP_CONCAT(DISTINCT NULLIF(st.parent_sales_person, '') ORDER BY st.idx SEPARATOR ', ') AS sales_teams
				FROM `tabSales Team` st
				WHERE st.parenttype = 'Sales Invoice'
					AND st.parent IN %(invoice_names)s
				GROUP BY st.parent
			""", {"invoice_names": tuple(invoice_names)}, as_dict=True)
			sales_team_map = {
				row.invoice_no: {
					"sales_persons": row.sales_persons or "",
					"sales_teams": row.sales_teams or "",
				}
				for row in sales_team_rows
			}

		invoice_map = {}

		for row in filtered_rows:
			received_amount = flt(row.received_amount)
			age_at_receipt_days = int(row.age_at_receipt_days or 0)

			entry = invoice_map.setdefault(row.invoice_no, {
				"invoice_no": row.invoice_no,
				"customer": row.customer,
				"customer_name": row.customer_name or row.customer,
				"branch": row.branch or "",
				"invoice_posting_date": row.invoice_posting_date,
				"due_date": row.due_date,
				"invoice_total": flt(row.invoice_total),
				"current_outstanding": flt(row.current_outstanding),
				"received_in_period": 0,
				"receipt_count_in_period": 0,
				"age_sum_in_period": 0,
				"latest_receipt_date": None,
				"latest_receipt_amount": 0,
				"latest_age_at_receipt_days": 0,
				"latest_overdue_at_receipt_days": 0,
				"sales_persons": "",
				"sales_teams": "",
			})

			entry["received_in_period"] += received_amount
			entry["receipt_count_in_period"] += 1
			entry["age_sum_in_period"] += age_at_receipt_days

			if row.receipt_date and (entry["latest_receipt_date"] is None or row.receipt_date >= entry["latest_receipt_date"]):
				entry["latest_receipt_date"] = row.receipt_date
				entry["latest_receipt_amount"] = received_amount
				entry["latest_age_at_receipt_days"] = age_at_receipt_days
				entry["latest_overdue_at_receipt_days"] = int(row.overdue_at_receipt_days or 0)

		for invoice_no, invoice_row in invoice_map.items():
			sales_meta = sales_team_map.get(invoice_no, {})
			invoice_row["sales_persons"] = sales_meta.get("sales_persons", "")
			invoice_row["sales_teams"] = sales_meta.get("sales_teams", "")

			for key in ("invoice_posting_date", "due_date", "latest_receipt_date"):
				invoice_row[key] = str(invoice_row[key]) if invoice_row.get(key) else None

		min_received_amount = flt(min_received_amount) if min_received_amount not in (None, "") else None
		max_received_amount = flt(max_received_amount) if max_received_amount not in (None, "") else None
		outstanding_status_normalized = normalize_choice(outstanding_status)

		invoice_data = []
		for invoice_row in invoice_map.values():
			received_in_period = flt(invoice_row.get("received_in_period"))
			current_outstanding = flt(invoice_row.get("current_outstanding"))
			latest_age_at_receipt_days = int(invoice_row.get("latest_age_at_receipt_days") or 0)
			latest_overdue_at_receipt_days = int(invoice_row.get("latest_overdue_at_receipt_days") or 0)

			if min_received_amount is not None and received_in_period < min_received_amount:
				continue
			if max_received_amount is not None and received_in_period > max_received_amount:
				continue
			if not matches_age_bucket(latest_age_at_receipt_days, age_bucket):
				continue
			if not matches_overdue_bucket(latest_overdue_at_receipt_days, overdue_bucket):
				continue
			if outstanding_status_normalized == "open" and current_outstanding <= 0:
				continue
			if outstanding_status_normalized == "cleared" and current_outstanding > 0:
				continue

			invoice_data.append(invoice_row)

		invoice_data = sorted(
			invoice_data,
			key=lambda row: (
				row.get("latest_receipt_date") or "",
				row.get("latest_receipt_amount") or 0,
				row.get("invoice_no") or "",
			),
			reverse=True,
		)

		if not invoice_data:
			return build_empty_response(mode_options)

		filtered_invoice_names = sorted({row.get("invoice_no") for row in invoice_data if row.get("invoice_no")})

		history_rows = frappe.db.sql("""
			SELECT
				ple.voucher_no AS payment_entry,
				DATE(ple.posting_date) AS receipt_date,
				ABS(ple.amount) AS received_amount,
				pe.mode_of_payment,
				pe.reference_no,
				pe.reference_date,
				pe.remarks,
				si.name AS invoice_no,
				si.customer,
				si.customer_name,
				DATE(si.posting_date) AS invoice_posting_date,
				DATE(si.due_date) AS due_date,
				DATEDIFF(DATE(ple.posting_date), DATE(si.posting_date)) AS age_at_receipt_days,
				CASE
					WHEN si.due_date IS NULL THEN 0
					WHEN DATEDIFF(DATE(ple.posting_date), DATE(si.due_date)) > 0 THEN DATEDIFF(DATE(ple.posting_date), DATE(si.due_date))
					ELSE 0
				END AS overdue_at_receipt_days
			FROM `tabPayment Ledger Entry` ple
			INNER JOIN `tabPayment Entry` pe ON pe.name = ple.voucher_no
			INNER JOIN `tabSales Invoice` si ON si.name = ple.against_voucher_no
			WHERE ple.voucher_type = 'Payment Entry'
				AND ple.against_voucher_type = 'Sales Invoice'
				AND ple.delinked = 0
				AND pe.docstatus = 1
				AND pe.payment_type = 'Receive'
				AND ple.company = %(company)s
				AND si.name IN %(invoice_names)s
			ORDER BY si.name ASC, ple.posting_date DESC, ple.creation DESC, ple.name DESC
		""", {"company": company, "invoice_names": tuple(filtered_invoice_names)}, as_dict=True)

		history_by_invoice = {}
		for row in history_rows:
			history_by_invoice.setdefault(row.invoice_no, []).append({
				"payment_entry": row.payment_entry,
				"receipt_date": str(row.receipt_date) if row.receipt_date else None,
				"received_amount": flt(row.received_amount),
				"mode_of_payment": row.mode_of_payment or "",
				"reference_no": row.reference_no or "",
				"reference_date": str(row.reference_date) if row.reference_date else None,
				"remarks": row.remarks or "",
				"invoice_no": row.invoice_no,
				"customer": row.customer,
				"customer_name": row.customer_name or row.customer,
				"invoice_posting_date": str(row.invoice_posting_date) if row.invoice_posting_date else None,
				"due_date": str(row.due_date) if row.due_date else None,
				"age_at_receipt_days": int(row.age_at_receipt_days or 0),
				"overdue_at_receipt_days": int(row.overdue_at_receipt_days or 0),
			})

		filtered_invoice_name_set = set(filtered_invoice_names)
		summary_rows = [row for row in filtered_rows if row.invoice_no in filtered_invoice_name_set]
		customer_names = {row.get("customer") for row in invoice_data if row.get("customer")}
		total_received = sum(flt(row.received_amount) for row in summary_rows)
		total_age = sum(int(row.age_at_receipt_days or 0) for row in summary_rows)
		latest_receipt_date = None
		for row in summary_rows:
			if row.receipt_date and (latest_receipt_date is None or row.receipt_date > latest_receipt_date):
				latest_receipt_date = row.receipt_date

		return {
			"summary": {
				"total_received": total_received,
				"receipt_count": len(summary_rows),
				"invoice_count": len(invoice_data),
				"customer_count": len(customer_names),
				"avg_age_at_receipt_days": round(total_age / len(summary_rows), 1) if summary_rows else 0,
				"latest_receipt_date": str(latest_receipt_date) if latest_receipt_date else None,
			},
			"invoice_data": invoice_data,
			"history_by_invoice": history_by_invoice,
			"filter_options": {
				"mode_of_payment": mode_options,
			},
		}

	except Exception as e:
		frappe.log_error(
			message=f"Error in get_received_collection_data: {str(e)}",
			title="Received Collection Query Failure"
		)
		return build_empty_response()




import frappe
from frappe import _

@frappe.whitelist()
def get_proforma_invoice_orm(sales_order=None, company=None, customer=None, branch=None, account_incharge=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    Fetch proforma invoice details grouped by sales order with sum of gross_total.
    Args:
        sales_order (str, optional): The sales order ID to filter proforma invoices.
        company (str, required): The company to filter by (required).
        customer (str, optional): The customer to filter by.
        branch (str, optional): The branch to filter by.
        account_incharge (str, optional): The account incharge to filter by.
        sales_person (str, optional): The sales person to filter by (via Sales Order).
        sales_team (str, optional): The sales team (parent sales person) to filter by (via Sales Order).
        internal_customer (bool, optional): Filter by is_internal_customer field.
    Returns:
        list: List of dictionaries with sales_order, customer, branch, date, and total_gross_total.
    """
    try:
        # Validate required fields
        if not company:
            frappe.msgprint(_("Company is required to fetch proforma invoice data."))
            return []

        # Build base query with JOINs for sales person/team filtering
        from_clause = "`tabProforma Invoice` p"
        join_clauses = []

        # Always join Sales Order to fetch branch
        join_clauses.append("INNER JOIN `tabSales Order` so ON so.name = p.sales_order AND so.docstatus = 1")

        # If filtering by sales_person or sales_team, we need to join Sales Team
        if sales_person or sales_team:
            join_clauses.append("""
                INNER JOIN `tabSales Team` st ON st.parent = so.name AND st.parenttype = 'Sales Order'
            """)

        # Build WHERE conditions
        conditions = ["p.docstatus = 1 AND p.status != 'Invoiced'"]
        values = []

        # Sales Order filter
        if sales_order:
            conditions.append("p.sales_order = %s")
            values.append(sales_order)

        # Company filter - required
        conditions.append("p.company = %s")
        values.append(company)

        # Customer filter
        if customer:
            conditions.append("p.customer = %s")
            values.append(customer)

        # Branch filter - fetch from Proforma Invoice
        if branch:
            conditions.append("p.branch = %s")
            values.append(branch)

        # Account Incharge filter
        if account_incharge:
            conditions.append("p.account_incharge_name = %s")
            values.append(account_incharge)

        # Sales Person filter
        if sales_person:
            conditions.append("st.sales_person = %s")
            values.append(sales_person)

        # Sales Team filter (parent_sales_person)
        if sales_team:
            conditions.append("st.parent_sales_person = %s")
            values.append(sales_team)

        # Internal customer filter - filter by is_internal_customer field
        if internal_customer:
            internal_val_lower = str(internal_customer).lower()
            if internal_val_lower in ['1', 'true', 'yes']:
                conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = p.customer AND c.is_internal_customer = 1)")
            elif internal_val_lower == 'no':
                conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = p.customer AND c.is_internal_customer = 1)")

        # Combine FROM and JOIN clauses
        full_from_clause = from_clause
        if join_clauses:
            full_from_clause += " " + " ".join(join_clauses)

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT
                p.name as proforma_invoice,
                p.status as proforma_invoice_status,
                p.sales_order,
                p.customer,
                p.company,
                p.branch as branch,
                p.account_incharge_name as account_incharge,
                so.grand_total as so_amount,
                so.status as so_status,
                p.date,
                p.gross_total as total_gross_total,
                p.amount_received,
                (SELECT GROUP_CONCAT(DISTINCT si.name ORDER BY si.name SEPARATOR ', ')
                 FROM `tabSales Invoice Item` sii
                 INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
                 WHERE si.docstatus = 1
                 AND sii.sales_order = p.sales_order) as sales_invoice_no,
                (SELECT SUM(DISTINCT si.grand_total)
                 FROM `tabSales Invoice Item` sii
                 INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
                 WHERE si.docstatus = 1
                 AND sii.sales_order = p.sales_order) as sales_invoice_amount,
                (SELECT GROUP_CONCAT(DISTINCT si.status ORDER BY si.status SEPARATOR ', ')
                 FROM `tabSales Invoice Item` sii
                 INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
                 WHERE si.docstatus = 1
                 AND sii.sales_order = p.sales_order) as sales_invoice_status
            FROM
                {full_from_clause}
            WHERE
                {where_clause}
            ORDER BY
                p.date DESC
        """

        result = frappe.db.sql(query, tuple(values), as_dict=True)

        # Return empty list instead of throwing error if no results found
        if not result:
            return []

        return result

    except Exception as e:
        frappe.log_error(
            message=_("Error fetching proforma invoice: {0}").format(str(e)),
            title="Proforma Invoice Query Failure"
        )
        frappe.throw(_("An error occurred while fetching the proforma invoice: {0}").format(str(e)))

@frappe.whitelist()
def get_account_incharge_options(company=None):
    """
    Fetch unique account_incharge_name values from Proforma Invoice.
    Args:
        company (str, optional): Filter by company
    Returns:
        list: List of unique account_incharge_name values
    """
    try:
        conditions = ["p.docstatus = 1", "p.account_incharge_name IS NOT NULL", "p.account_incharge_name != ''"]
        values = []

        if company:
            conditions.append("p.company = %s")
            values.append(company)

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT DISTINCT p.account_incharge_name
            FROM `tabProforma Invoice` p
            WHERE {where_clause}
            ORDER BY p.account_incharge_name
        """

        result = frappe.db.sql(query, tuple(values), as_dict=True)

        # Return list of account_incharge_name values
        return [r.account_incharge_name for r in result if r.account_incharge_name]

    except Exception as e:
        frappe.log_error(f"Error fetching account incharge options: {str(e)}")
        return []


 

import frappe
from frappe import _

@frappe.whitelist()
def get_quotation_list(account_incharge=None, company=None, branch=None, team=None, internal_customer=None):
    """
    Fetch a list of quotations with specified fields, filtered by optional parameters.
    Base Filters:
        - docstatus = 1
        - workflow_state in ('Pipeline A', 'Pipeline B', 'Pipeline C')
        - status not in ('Expired', 'Lost', 'Ordered', 'Partially Ordered', 'Closed')
    Additional Filters (optional):
        - account_incharge: Filter by specific account incharge.
        - company: Filter by specific company.
        - branch: Filter by specific branch.
        - team: Filter team-wise by fetching account_incharges from IHG Team's Sales Team Members child table.
        - internal_customer: Filter by is_internal_customer field.
    Returns:
        list: List of dictionaries containing name, grand_total, account_incharge, branch, company,
              transaction_date, status, and sales_team (team name from IHG Team doctype).
    """
    try:
        # Validate table existence
        # if not frappe.db.exists("DocType", "IHG Team"):
        #     frappe.msgprint(_("DocType 'IHG Team' does not exist. Please check the configuration."))
        #     return []

        # # Validate input parameters
        # if account_incharge and not frappe.db.exists("User", account_incharge):
        #     frappe.msgprint(_("Account Incharge {0} does not exist.").format(account_incharge))
        #     return []
        # if company and not frappe.db.exists("Company", company):
        #     frappe.msgprint(_("Company {0} does not exist.").format(company))
        #     return []
        # if branch and not frappe.db.exists("Branch", branch):
        #     frappe.msgprint(_("Branch {0} does not exist.").format(branch))
        #     return []
        # if team and not frappe.db.exists("IHG Team", team):
        #     frappe.msgprint(_("Team {0} does not exist.").format(team))
        #     return []

        # Base query with base fields + sales_team subquery
        base_query = """
            SELECT 
                q.name,
                q.grand_total,
                q.account_incharge,
                q.branch,
                q.company,
                q.transaction_date,
                q.status,
                q.custom_sales_team,
				q.workflow_state
            FROM 
                `tabQuotation` q
            WHERE 
                q.docstatus = 1
                AND q.workflow_state IN ('Pipeline A', 'Pipeline B', 'Pipeline C')
                AND q.status NOT IN ('Expired', 'Lost', 'Ordered', 'Partially Ordered', 'Closed')
        """
        
        # Dynamic conditions for additional filters
        conditions = []
        params = []
        
        # Filter by account_incharge if provided
        if account_incharge:
            conditions.append("AND q.account_incharge = %s")
            params.append(account_incharge)
        
        # Filter by company if provided
        if company:
            conditions.append("AND q.company = %s")
            params.append(company)
        
        # Filter by branch if provided
        if branch:
            conditions.append("AND q.branch = %s")
            params.append(branch)
        
        if team:
            conditions.append("AND q.custom_sales_team = %s")
            params.append(team)

        # Internal customer filter - filter by is_internal_customer field
        if internal_customer:
            internal_val_lower = str(internal_customer).lower()
            if internal_val_lower in ['1', 'true', 'yes']:
                conditions.append("AND EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = q.party_name AND c.is_internal_customer = 1)")
            elif internal_val_lower == 'no':
                conditions.append("AND NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = q.party_name AND c.is_internal_customer = 1)")

        # Append conditions to the query
        if conditions:
            base_query += " " + " ".join(conditions)

        # Add ordering
        base_query += " ORDER BY q.transaction_date DESC"
        
        # Log query for debugging
        frappe.log_error(f"Query: {base_query}\nParams: {params}", "Quotation List Debug")
        
        # Execute the query
        result = frappe.db.sql(base_query, tuple(params), as_dict=True)

        # Return empty array if no results - let the frontend handle the display
        if not result:
            return []

        return result

    except Exception as e:
        frappe.log_error(
            message=_("Error fetching quotation list: {0}").format(str(e)),
            title="Quotation List Query Failure"
        )
        frappe.msgprint(_("An error occurred while fetching the quotation list: {0}").format(str(e)))
        return []

@frappe.whitelist()
def get_payment_schedule_summary(company=None, from_date=None, to_date=None, customer=None, branch=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    Get Payment Schedule-based summary for ARM Dashboard
    This uses due_date from Payment Schedule child table instead of Sales Invoice due_date

    Args:
        company: Company name (required)
        from_date: Start date for payment schedule due_date (default: 1st of current month)
        to_date: End date for payment schedule due_date (default: last day of current month)
        customer: Filter by customer
        branch: Filter by branch
        sales_person: Filter by sales person
        sales_team: Filter by sales team
        internal_customer: Filter by is_internal_customer field

    Returns:
        Payment schedule data with totals for Due Today, Due This Week, Due This Month
    """
    try:
        from prastara_custom.controller.accounts_receivable import get_payment_schedule_data

        result = get_payment_schedule_data(
            company=company,
            from_date=from_date,
            to_date=to_date,
            customer=customer,
            branch=branch,
            sales_person=sales_person,
            sales_team=sales_team,
            min_outstanding=0,
            internal_customer=internal_customer
        )

        return result

    except Exception as e:
        frappe.log_error(
            message=_("Error fetching payment schedule data: {0}").format(str(e)),
            title="Payment Schedule Query Failure"
        )
        return {
            "data": [],
            "totals": {},
            "error": str(e)
        }

@frappe.whitelist()
def get_dispute_data(company=None, customer=None, branch=None, sales_person=None, sales_team=None, reference_type=None, internal_customer=None):
    """
    Fetch dispute data from Dispute doctype with filtering options.

    Args:
        company (str, required): Filter by company (required)
        customer (str, optional): Filter by customer
        branch (str, optional): Filter by branch
        sales_person (str, optional): Filter by sales person
        sales_team (str, optional): Filter by sales team
        reference_type (str, optional): Filter by reference type (Sales Invoice, Sales Order, Project)
        internal_customer (bool, optional): Filter by is_internal_customer field

    Returns:
        list: List of dispute records grouped by reference type
    """
    try:
        # Validate required fields
        if not company:
            frappe.msgprint(_("Company is required to fetch dispute data."))
            return []

        # Build the query with filters
        conditions = []
        values = []

        # Add filters - company is required
        conditions.append("d.company = %s")
        values.append(company)

        if customer:
            conditions.append("d.customer = %s")
            values.append(customer)

        if branch:
            conditions.append("d.branch = %s")
            values.append(branch)

        if sales_person:
            conditions.append("d.sales_person = %s")
            values.append(sales_person)

        # Sales Team filter - check if the referenced document (Sales Order/Sales Invoice) has this team
        if sales_team:
            conditions.append("""
                (
                    (d.reference = 'Sales Order' AND EXISTS (
                        SELECT 1 FROM `tabSales Team` st
                        WHERE st.parent = d.sales_order
                        AND st.parenttype = 'Sales Order'
                        AND st.parent_sales_person = %s
                    ))
                    OR
                    (d.reference = 'Sales Invoice' AND EXISTS (
                        SELECT 1 FROM `tabSales Team` st
                        WHERE st.parent = d.sales_invoice
                        AND st.parenttype = 'Sales Invoice'
                        AND st.parent_sales_person = %s
                    ))
                    OR
                    (d.reference = 'Project')
                )
            """)
            # Add sales_team value twice for the two EXISTS subqueries
            values.append(sales_team)
            values.append(sales_team)

        if reference_type:
            conditions.append("d.reference = %s")
            values.append(reference_type)

        # Internal customer filter - filter by is_internal_customer field
        if internal_customer:
            internal_val_lower = str(internal_customer).lower()
            if internal_val_lower in ['1', 'true', 'yes']:
                conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = d.customer AND c.is_internal_customer = 1)")
            elif internal_val_lower == 'no':
                conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = d.customer AND c.is_internal_customer = 1)")

        # Build WHERE clause
        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Query to get disputes from Dispute doctype
        query = f"""
            SELECT
                d.name as dispute_id,
                d.reference,
                d.customer,
                d.sales_invoice,
                d.sales_order,
                d.project,
                d.branch,
                d.date as dispute_date,
                d.reason,
                d.status,
                d.company,
                d.sales_person,
                IFNULL(d.outstanding_amount_of_invoice, 0) as outstanding_amount
            FROM
                `tabDispute` d
            WHERE
                {where_clause}
            ORDER BY
                d.date DESC, d.creation DESC
        """

        result = frappe.db.sql(query, tuple(values), as_dict=True)

        if not result:
            return []

        return result

    except Exception as e:
        frappe.log_error(
            message=_("Error fetching dispute data: {0}").format(str(e)),
            title="Dispute Data Query Failure"
        )
        return []


@frappe.whitelist()
def get_overdue_advance_progressive_bills(company=None, customer=None, branch=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    Fetch overdue advance/progressive bills from Sales Invoice.
    Filters invoices where:
    - docstatus = 1
    - item_code from Sales Invoice Item is in ['PROGRESS PAYMENT', 'ADVANCE PAYMENT']
    - Also fetches related Sales Order data

    Args:
        company (str, optional): Filter by company
        customer (str, optional): Filter by customer
        branch (str, optional): Filter by branch
        sales_person (str, optional): Filter by sales person
        sales_team (str, optional): Filter by sales team
        internal_customer (bool, optional): Filter by is_internal_customer field

    Returns:
        dict: Contains list of invoices with Sales Order details
    """
    try:
        # Debug logging to file
        import datetime
        with open('/tmp/overdue_api_debug.log', 'a') as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"Time: {datetime.datetime.now()}\n")
            f.write(f"User: {frappe.session.user}\n")
            f.write(f"Company param: '{company}'\n")
            f.write(f"Request method: {frappe.request.method if frappe.request else 'N/A'}\n")
            f.write(f"Request path: {frappe.request.path if frappe.request else 'N/A'}\n")

        # Build the query with filters
        conditions = []
        values = []

        # Base conditions
        conditions.append("si.docstatus = 1")
        conditions.append("si.status = 'Overdue'")
        conditions.append("sii.item_code IN ('PROGRESS PAYMENT', 'ADVANCE PAYMENT')")
        conditions.append("sii.rate > 0")
        conditions.append("sii.qty > 0")

        # Company filter
        if company:
            conditions.append("si.company = %s")
            values.append(company)

        # Customer filter
        if customer:
            conditions.append("si.customer = %s")
            values.append(customer)

        # Branch filter
        if branch:
            conditions.append("si.branch = %s")
            values.append(branch)

        # Sales Person filter
        if sales_person:
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM `tabSales Team` st
                    WHERE st.parent = si.name
                    AND st.parenttype = 'Sales Invoice'
                    AND st.sales_person = %s
                )
            """)
            values.append(sales_person)

        # Sales Team filter
        if sales_team:
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM `tabSales Team` st
                    WHERE st.parent = si.name
                    AND st.parenttype = 'Sales Invoice'
                    AND st.parent_sales_person = %s
                )
            """)
            values.append(sales_team)

        # Internal customer filter - filter by is_internal_customer field
        if internal_customer:
            internal_val_lower = str(internal_customer).lower()
            if internal_val_lower in ['1', 'true', 'yes']:
                conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = si.customer AND c.is_internal_customer = 1)")
            elif internal_val_lower == 'no':
                conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = si.customer AND c.is_internal_customer = 1)")

        # Build WHERE clause
        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Query to get advance/progressive bills with Sales Order details
        query = f"""
            SELECT
                si.name as invoice_id,
                si.customer,
                si.customer_name,
                si.grand_total as invoice_grand_total,
                si.sales_order,
                so.grand_total as so_grand_total,
                CASE
                    WHEN so.grand_total IS NOT NULL AND so.grand_total > 0
                    THEN so.grand_total - si.grand_total
                    ELSE 0
                END as balance_to_be_paid,
                CASE
                    WHEN so.grand_total > 0 THEN (si.grand_total / so.grand_total) * 100
                    ELSE 0
                END as percentage_against_so,
                si.posting_date,
                si.due_date,
                si.outstanding_amount,
                si.company,
                si.branch as branch,
                si.status as workflow_state,
                (SELECT GROUP_CONCAT(DISTINCT st.sales_person ORDER BY st.sales_person SEPARATOR ', ')
                 FROM `tabSales Team` st
                 WHERE st.parent = si.name
                 AND st.parenttype = 'Sales Invoice') as sales_person
            FROM
                `tabSales Invoice` si
            INNER JOIN
                `tabSales Invoice Item` sii ON sii.parent = si.name
            LEFT JOIN
                `tabSales Order` so ON so.name = si.sales_order
            WHERE
                {where_clause}
            GROUP BY
                si.name
            ORDER BY
                si.posting_date DESC
        """

        result = frappe.db.sql(query, tuple(values), as_dict=True)

        # Debug logging - write to file
        with open('/tmp/overdue_debug.log', 'a') as f:
            f.write(f"\n=== {frappe.utils.now()} ===\n")
            f.write(f"User: {frappe.session.user}\n")
            f.write(f"Company: {company}\n")
            f.write(f"WHERE clause: {where_clause}\n")
            f.write(f"Values: {values}\n")
            f.write(f"Records returned: {len(result)}\n")

        # Calculate totals
        total_invoice_amount = sum(flt(r.invoice_grand_total) for r in result)
        total_so_amount = sum(flt(r.so_grand_total) for r in result if r.so_grand_total)
        total_balance_to_be_paid = sum(flt(r.outstanding_amount) for r in result)

       
        return {
            "data": result,
            "summary": {
                "total_count": len(result),
                "total_invoice_amount": total_invoice_amount,
                "total_so_amount": total_so_amount,
                "total_balance_to_be_paid": total_balance_to_be_paid
            },
        }
	

    except Exception as e:
        frappe.log_error(
            message=_("Error fetching overdue advance/progressive bills: {0}").format(str(e)),
            title="Overdue Advance/Progressive Bills Query Failure"
        )
        return {
            "data": [],
            "summary": {
                "total_count": 0,
                "total_invoice_amount": 0,
                "total_so_amount": 0,
                "total_balance_to_be_paid": 0
            }
        }
@frappe.whitelist()
def get_salesperson_wise_data(company=None, from_date=None, to_date=None, branch=None, sales_team=None, sales_person=None, internal_customer=None):
	"""
	Get Sales Person wise outstanding data for ARM Dashboard
	Returns sales person information with their outstanding invoices and employee photos
	"""
	try:
		followup_config = _get_payment_followup_config()
		followup_comment_field = followup_config.get("comment_field") if followup_config else None
		followup_order_expr = "COALESCE(pf.followup_date_time, pf.creation)" if followup_config and followup_config.get("has_followup_date_time") else "pf.creation"

		conditions = []
		values = []
		
		# Base condition
		conditions.append("si.docstatus = 1")
		conditions.append("si.status != 'Paid'")
		conditions.append("si.outstanding_amount > 0")
		
		# Company filter
		if company:
			conditions.append("si.company = %s")
			values.append(company)
		
		# Branch filter
		if branch:
			conditions.append("si.custom_branch = %s")
			values.append(branch)
		
		# Sales Team filter
		if sales_team:
			conditions.append("st.parent_sales_person = %s")
			values.append(sales_team)
		
		# Sales Person filter
		if sales_person:
			conditions.append("st.sales_person = %s")
			values.append(sales_person)
		
		# Date range filter
		if from_date:
			conditions.append("si.posting_date >= %s")
			values.append(from_date)
		if to_date:
			conditions.append("si.posting_date <= %s")
			values.append(to_date)

		# Internal customer filter - based on invoice customer classification
		# Prefer Sales Invoice flag when available and fallback to Customer master flag.
		internal_val_lower = str(internal_customer).strip().lower() if internal_customer is not None else ''
		if internal_val_lower in ['1', 'true', 'yes']:
			conditions.append("""
				(
					COALESCE(si.is_internal_customer, 0) = 1
					OR EXISTS (
						SELECT 1
						FROM `tabCustomer` c
						WHERE c.name = si.customer AND c.is_internal_customer = 1
					)
				)
			""")
		elif internal_val_lower in ['0', 'false', 'no']:
			conditions.append("""
				(
					COALESCE(si.is_internal_customer, 0) = 0
					AND NOT EXISTS (
						SELECT 1
						FROM `tabCustomer` c
						WHERE c.name = si.customer AND c.is_internal_customer = 1
					)
				)
			""")

		where_clause = " AND ".join(conditions) if conditions else "1=1"

		# Query to get sales person wise outstanding
		query = f"""
			SELECT 
				COALESCE(NULLIF(st.sales_person, ''), 'No Sales Person') as sales_person,
				sp.employee,
				emp.image as employee_photo,
				emp.employee_name,
				COUNT(DISTINCT si.name) as invoice_count,
				SUM(si.outstanding_amount) as total_outstanding,
				SUM(CASE WHEN DATEDIFF(CURDATE(), si.posting_date) > 0 THEN si.outstanding_amount ELSE 0 END) as overdue_amount,
				SUM(CASE WHEN DATEDIFF(CURDATE(), si.posting_date) <= 0 THEN si.outstanding_amount ELSE 0 END) as not_due_amount
			FROM `tabSales Invoice` si
			LEFT JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
			LEFT JOIN `tabSales Person` sp ON sp.name = st.sales_person
			LEFT JOIN `tabEmployee` emp ON emp.name = sp.employee
			WHERE {where_clause}
			GROUP BY COALESCE(NULLIF(st.sales_person, ''), 'No Sales Person'), sp.employee, emp.image, emp.employee_name
			ORDER BY total_outstanding DESC
		"""
		
		salesperson_data = frappe.db.sql(query, values, as_dict=True)
		
		# Get detailed invoices for each sales person
		detailed_data = []
		for sp in salesperson_data:
			payment_followup_select = "NULL as payment_followup_comment"
			if followup_comment_field and followup_config:
				payment_followup_select = f"""(
						SELECT pf.{followup_comment_field}
						FROM `{followup_config['table']}` pf
						WHERE pf.parent = si.name
						ORDER BY {followup_order_expr} DESC, pf.creation DESC
						LIMIT 1
					) as payment_followup_comment"""

			detail_query = f"""
				SELECT 
					si.name as invoice_no,
					si.posting_date,
					si.due_date,
					si.customer,
					si.customer_name,
					si.grand_total,
					si.outstanding_amount,
					{payment_followup_select},
					DATEDIFF(CURDATE(), si.posting_date) as aging_days,
					CASE
						WHEN DATEDIFF(CURDATE(), si.posting_date) > 0 THEN 'Overdue'
						ELSE 'Not Due'
					END as status
				FROM `tabSales Invoice` si
				LEFT JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
				WHERE {where_clause}
					AND (
						st.sales_person = %s
						OR (%s = 'No Sales Person' AND st.sales_person IS NULL)
					)
				ORDER BY si.posting_date ASC
			"""
			
			invoices = frappe.db.sql(detail_query, values + [sp.sales_person, sp.sales_person], as_dict=True)
			
			detailed_data.append({
				'sales_person': sp.sales_person,
				'employee': sp.employee,
				'employee_photo': sp.employee_photo,
				'employee_name': sp.employee_name,
				'invoice_count': sp.invoice_count,
				'total_outstanding': sp.total_outstanding,
				'overdue_amount': sp.overdue_amount,
				'not_due_amount': sp.not_due_amount,
				'invoices': invoices
			})
		
		# Calculate summary
		total_outstanding = sum([sp.total_outstanding for sp in salesperson_data])
		total_overdue = sum([sp.overdue_amount for sp in salesperson_data])
		total_not_due = sum([sp.not_due_amount for sp in salesperson_data])
		total_invoices = sum([sp.invoice_count for sp in salesperson_data])
		
		return {
			'summary': salesperson_data,
			'detailed': detailed_data,
			'totals': {
				'total_outstanding': total_outstanding,
				'total_overdue': total_overdue,
				'total_not_due': total_not_due,
				'total_invoices': total_invoices,
				'salesperson_count': len(salesperson_data)
			}
		}
		
	except Exception as e:
		frappe.log_error(
			message=f"Error fetching sales person wise data: {str(e)}",
			title="Sales Person Wise Query Failure"
		)
		return {
			'summary': [],
			'detailed': [],
			'totals': {
				'total_outstanding': 0,
				'total_overdue': 0,
				'total_not_due': 0,
				'total_invoices': 0,
				'salesperson_count': 0
			}
		}


@frappe.whitelist()
def get_completed_sales_orders_data(company=None, branch=None, sales_team=None, sales_person=None, internal_customer=None):
	"""
	Get completed Sales Orders for the ARM dashboard completed tab.

	Completion is derived from the later of:
	- latest submitted Delivery Note posting_date linked to the Sales Order
	- latest submitted Sales Invoice posting_date linked to the Sales Order

	Outstanding is currently derived from distinct submitted Sales Invoice.outstanding_amount
	linked to the Sales Order to avoid double counting invoice item rows.
	"""
	try:
		conditions = [
			"so.docstatus = 1",
			"IFNULL(so.per_delivered, 0) = 100",
			"IFNULL(so.per_billed, 0) = 100"
		]
		values = []

		branch_field = None
		if frappe.db.has_column("Sales Order", "branch"):
			branch_field = "so.branch"
		elif frappe.db.has_column("Sales Order", "custom_branch"):
			branch_field = "so.custom_branch"

		branch_select = branch_field if branch_field else "''"

		if company:
			conditions.append("so.company = %s")
			values.append(company)

		if branch and branch_field:
			conditions.append(f"{branch_field} = %s")
			values.append(branch)

		if sales_team:
			conditions.append("""
				EXISTS (
					SELECT 1
					FROM `tabSales Team` st_filter
					WHERE st_filter.parent = so.name
						AND st_filter.parenttype = 'Sales Order'
						AND st_filter.parent_sales_person = %s
				)
			""")
			values.append(sales_team)

		if sales_person:
			conditions.append("""
				EXISTS (
					SELECT 1
					FROM `tabSales Team` st_filter
					WHERE st_filter.parent = so.name
						AND st_filter.parenttype = 'Sales Order'
						AND st_filter.sales_person = %s
				)
			""")
			values.append(sales_person)

		internal_val_lower = str(internal_customer).strip().lower() if internal_customer is not None else ''
		has_so_internal_flag = frappe.db.has_column("Sales Order", "is_internal_customer")
		if internal_val_lower in ['1', 'true', 'yes']:
			if has_so_internal_flag:
				conditions.append("""
					(
						COALESCE(so.is_internal_customer, 0) = 1
						OR EXISTS (
							SELECT 1
							FROM `tabCustomer` c
							WHERE c.name = so.customer AND c.is_internal_customer = 1
						)
					)
				""")
			else:
				conditions.append("""
					EXISTS (
						SELECT 1
						FROM `tabCustomer` c
						WHERE c.name = so.customer AND c.is_internal_customer = 1
					)
				""")
		elif internal_val_lower in ['0', 'false', 'no']:
			if has_so_internal_flag:
				conditions.append("""
					(
						COALESCE(so.is_internal_customer, 0) = 0
						AND NOT EXISTS (
							SELECT 1
							FROM `tabCustomer` c
							WHERE c.name = so.customer AND c.is_internal_customer = 1
						)
					)
				""")
			else:
				conditions.append("""
					NOT EXISTS (
						SELECT 1
						FROM `tabCustomer` c
						WHERE c.name = so.customer AND c.is_internal_customer = 1
					)
				""")

		where_clause = " AND ".join(conditions) if conditions else "1=1"

		query = f"""
			SELECT *
			FROM (
				SELECT
					so.name AS sales_order,
					so.customer,
					so.customer_name,
					{branch_select} AS branch,
					COALESCE(st_info.sales_person, 'No Sales Person') AS sales_person,
					COALESCE(st_info.parent_sales_person, '') AS sales_team,
					so.grand_total,
					COALESCE(inv_outstanding.invoice_count, 0) AS invoice_count,
					COALESCE(inv_outstanding.invoice_names, '') AS invoice_names,
					COALESCE(inv_outstanding.outstanding_amount, 0) AS outstanding_amount,
					delivery_info.last_delivery_date,
					invoice_info.last_invoice_date,
					CASE
						WHEN delivery_info.last_delivery_date IS NULL THEN invoice_info.last_invoice_date
						WHEN invoice_info.last_invoice_date IS NULL THEN delivery_info.last_delivery_date
						WHEN delivery_info.last_delivery_date >= invoice_info.last_invoice_date THEN delivery_info.last_delivery_date
						ELSE invoice_info.last_invoice_date
					END AS completion_date
				FROM `tabSales Order` so
				LEFT JOIN (
					SELECT
						st.parent AS sales_order,
						GROUP_CONCAT(DISTINCT NULLIF(st.sales_person, '') ORDER BY st.idx SEPARATOR ', ') AS sales_person,
						GROUP_CONCAT(DISTINCT NULLIF(st.parent_sales_person, '') ORDER BY st.idx SEPARATOR ', ') AS parent_sales_person
					FROM `tabSales Team` st
					WHERE st.parenttype = 'Sales Order'
					GROUP BY st.parent
				) st_info
					ON st_info.sales_order = so.name
				LEFT JOIN (
					SELECT
						dni.against_sales_order AS sales_order,
						MAX(dn.posting_date) AS last_delivery_date
					FROM `tabDelivery Note Item` dni
					INNER JOIN `tabDelivery Note` dn
						ON dn.name = dni.parent
						AND dn.docstatus = 1
					WHERE IFNULL(dni.against_sales_order, '') != ''
					GROUP BY dni.against_sales_order
				) delivery_info
					ON delivery_info.sales_order = so.name
				LEFT JOIN (
					SELECT
						sii.sales_order AS sales_order,
						MAX(si.posting_date) AS last_invoice_date
					FROM `tabSales Invoice Item` sii
					INNER JOIN `tabSales Invoice` si
						ON si.name = sii.parent
						AND si.docstatus = 1
					WHERE IFNULL(sii.sales_order, '') != ''
					GROUP BY sii.sales_order
				) invoice_info
					ON invoice_info.sales_order = so.name
				LEFT JOIN (
					SELECT
						distinct_invoice.sales_order,
						COUNT(*) AS invoice_count,
						SUM(distinct_invoice.outstanding_amount) AS outstanding_amount,
						GROUP_CONCAT(distinct_invoice.invoice_name ORDER BY distinct_invoice.posting_date DESC SEPARATOR ', ') AS invoice_names
					FROM (
						SELECT DISTINCT
							sii.sales_order AS sales_order,
							si.name AS invoice_name,
							si.posting_date,
							COALESCE(si.outstanding_amount, 0) AS outstanding_amount
						FROM `tabSales Invoice Item` sii
						INNER JOIN `tabSales Invoice` si
							ON si.name = sii.parent
							AND si.docstatus = 1
						WHERE IFNULL(sii.sales_order, '') != ''
					) distinct_invoice
					GROUP BY distinct_invoice.sales_order
				) inv_outstanding
					ON inv_outstanding.sales_order = so.name
				WHERE {where_clause}
			) completed_orders
			WHERE completed_orders.completion_date IS NOT NULL
			ORDER BY completed_orders.completion_date DESC, completed_orders.sales_order DESC
		"""

		rows = frappe.db.sql(query, tuple(values), as_dict=True)

		total_completed_value = sum(flt(row.get("grand_total")) for row in rows)
		total_outstanding = sum(flt(row.get("outstanding_amount")) for row in rows)

		return {
			"rows": rows,
			"totals": {
				"sales_order_count": len(rows),
				"total_completed_value": total_completed_value,
				"total_outstanding": total_outstanding
			}
		}

	except Exception as e:
		frappe.log_error(
			message=f"Error fetching completed sales orders data: {str(e)}",
			title="Completed Sales Orders Query Failure"
		)
		return {
			"rows": [],
			"totals": {
				"sales_order_count": 0,
				"total_completed_value": 0,
				"total_outstanding": 0
			}
		}

@frappe.whitelist()
def global_search(query, company=None):
	"""
	Global search across customers, invoices, PDCs, and sales persons
	"""
	try:
		query = f"%{query}%"
		results = {
			'customers': [],
			'invoices': [],
			'pdcs': [],
			'sales_persons': []
		}
		
		# Search Customers
		customer_conditions = ["(c.customer_name LIKE %s OR c.name LIKE %s)"]
		customer_values = [query, query]
		
		if company:
			customer_conditions.append("c.company = %s")
			customer_values.append(company)
		
		customer_query = f"""
			SELECT 
				c.name,
				c.customer_name,
				COALESCE(SUM(si.outstanding_amount), 0) as outstanding_amount
			FROM `tabCustomer` c
			LEFT JOIN `tabSales Invoice` si ON si.customer = c.name AND si.docstatus = 1 AND si.outstanding_amount > 0
			WHERE {' AND '.join(customer_conditions)}
			GROUP BY c.name, c.customer_name
			LIMIT 10
		"""
		
		results['customers'] = frappe.db.sql(customer_query, customer_values, as_dict=True)
		
		# Search Invoices
		invoice_conditions = ["si.name LIKE %s", "si.docstatus = 1"]
		invoice_values = [query]
		
		if company:
			invoice_conditions.append("si.company = %s")
			invoice_values.append(company)
		
		invoice_query = f"""
			SELECT 
				si.name,
				si.customer,
				si.customer_name,
				si.outstanding_amount,
				si.posting_date
			FROM `tabSales Invoice` si
			WHERE {' AND '.join(invoice_conditions)}
			ORDER BY si.posting_date DESC
			LIMIT 10
		"""
		
		results['invoices'] = frappe.db.sql(invoice_query, invoice_values, as_dict=True)
		
		# Search PDCs
		pdc_conditions = [
			"(pe.reference_no LIKE %s OR pe.name LIKE %s)",
			"pe.mode_of_payment = 'Cheque'",
			"pe.docstatus = 1",
			"pe.payment_type = 'Receive'"
		]
		pdc_values = [query, query]
		
		if company:
			pdc_conditions.append("pe.company = %s")
			pdc_values.append(company)
		
		pdc_query = f"""
			SELECT 
				pe.name,
				pe.reference_no,
				pe.party,
				pe.paid_amount,
				pe.reference_date
			FROM `tabPayment Entry` pe
			WHERE {' AND '.join(pdc_conditions)}
			ORDER BY pe.reference_date DESC
			LIMIT 10
		"""
		
		results['pdcs'] = frappe.db.sql(pdc_query, pdc_values, as_dict=True)
		
		# Search Sales Persons
		sp_conditions = ["(sp.name LIKE %s OR sp.sales_person_name LIKE %s OR emp.employee_name LIKE %s)"]
		sp_values = [query, query, query]
		
		sp_query = f"""
			SELECT 
				sp.name,
				sp.sales_person_name,
				sp.employee,
				emp.employee_name
			FROM `tabSales Person` sp
			LEFT JOIN `tabEmployee` emp ON emp.name = sp.employee
			WHERE {' AND '.join(sp_conditions)}
			LIMIT 10
		"""
		
		results['sales_persons'] = frappe.db.sql(sp_query, sp_values, as_dict=True)
		
		return results
		
	except Exception as e:
		frappe.log_error(
			message=f"Error in global search: {str(e)}",
			title="Global Search Error"
		)
		return {
			'customers': [],
			'invoices': [],
			'pdcs': [],
			'sales_persons': []
		}


@frappe.whitelist()
def get_customer_outstanding_clearance_data(company=None, branch=None, from_type=None, status=None, internal_customer=None):
	"""
	Fetch Customer Outstanding Clearence data for ARM Dashboard.

	Args:
		company (str, optional): Filter by company
		branch (str, optional): Filter by branch
		from_type (str, optional): Filter by from_type (outstanding type)
		status (str, optional): Filter by status
		internal_customer (bool, optional): Filter by is_internal_customer field

	Returns:
		dict: Contains list of clearance records and summary data
	"""
	try:
		# Build the query with filters
		conditions = []
		values = []

		# Company filter
		if company:
			conditions.append("coc.company = %s")
			values.append(company)

		# Branch filter
		if branch:
			conditions.append("coc.branch = %s")
			values.append(branch)

		# From type filter
		if from_type:
			conditions.append("coc.from_type = %s")
			values.append(from_type)

		# Status filter
		if status:
			conditions.append("coc.status = %s")
			values.append(status)

		# Internal customer filter - filter by is_internal_customer field
		if internal_customer:
			internal_val_lower = str(internal_customer).lower()
			if internal_val_lower in ['1', 'true', 'yes']:
				conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = coc.customer AND c.is_internal_customer = 1)")
			elif internal_val_lower == 'no':
				conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = coc.customer AND c.is_internal_customer = 1)")

		# Build WHERE clause
		where_clause = " AND ".join(conditions) if conditions else "1=1"

		# Query to get customer outstanding clearance records
		query = f"""
			SELECT
				coc.name,
				coc.company,
				coc.branch,
				coc.customer,
				coc.date,
				coc.reason,
				coc.grand_total,
				coc.from_type,
				coc.status,
				coc.docstatus,
				coc.workflow_state,
				IFNULL(c.is_frozen, 0) as is_frozen
			FROM
				`tabCustomer Outstanding Clearence` coc
			LEFT JOIN `tabCustomer` c ON c.name = coc.customer
			WHERE
				{where_clause}
			ORDER BY
				coc.date DESC, coc.creation DESC
		"""

		result = frappe.db.sql(query, tuple(values), as_dict=True)

		# Calculate summary
		total_records = len(result)
		total_amount = sum(flt(r.get('grand_total', 0)) for r in result)
		pending_count = sum(1 for r in result if r.get('docstatus') == 0)
		approved_count  = sum(1 for r in result if r.get('docstatus') == 1)

		# Group by workflow_state and sum grand_total
		workflow_summary = {}
		for r in result:
			ws = r.get('workflow_state') or 'Draft'
			if ws not in workflow_summary:
				workflow_summary[ws] = {'workflow_state': ws, 'grand_total': 0}
			workflow_summary[ws]['grand_total'] += flt(r.get('grand_total', 0))

		workflow_summary_list = sorted(workflow_summary.values(), key=lambda x: x['grand_total'], reverse=True)

		return {
			"data": result,
			"summary": {
				"total_records": total_records,
				"total_amount": total_amount,
				"pending_count": pending_count,
				"approved_count": approved_count
			},
			"workflow_summary": workflow_summary_list
		}

	except Exception as e:
		frappe.log_error(
			message=f"Error fetching customer outstanding clearance data: {str(e)}",
			title="Customer Outstanding Clearance Query Failure"
		)
		return {
			"data": [],
			"summary": {
				"total_records": 0,
				"total_amount": 0,
				"pending_count": 0,
				"approved_count": 0
			}
		}


@frappe.whitelist()
def get_cheque_document_data(company=None, branch=None, workflow_state=None, purpose=None, cheque_type=None, internal_customer=None):
	"""
	Fetch Cheque Document data foAging Analysisr ARM Dashboard.

	Args:
		company (str, optional): Filter by company
		branch (str, optional): Filter by branch
		workflow_state (str, optional): Filter by workflow_state
		purpose (str, optional): Filter by purpose
		cheque_type (str, optional): Filter by type
		internal_customer (bool, optional): Filter by is_internal_customer field

	Returns:
		dict: Contains list of cheque document records and summary data
	"""
	try:
		# Build the query with filters
		conditions = ["cd.party_type = 'Customer'"]
		values = []

		# Company filter
		if company:
			conditions.append("cd.company = %s")
			values.append(company)

		# Branch filter
		if branch:
			conditions.append("cd.branch = %s")
			values.append(branch)

		# Workflow state filter
		if workflow_state:
			conditions.append("cd.workflow_state = %s")
			values.append(workflow_state)

		# Purpose filter
		if purpose:
			conditions.append("cd.purpose = %s")
			values.append(purpose)

		# Type filter
		if cheque_type:
			conditions.append("cd.type = %s")
			values.append(cheque_type)

		# Internal customer filter - filter by is_internal_customer field
		if internal_customer:
			internal_val_lower = str(internal_customer).lower()
			if internal_val_lower in ['1', 'true', 'yes']:
				conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = cd.party AND c.is_internal_customer = 1)")
			elif internal_val_lower == 'no':
				conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = cd.party AND c.is_internal_customer = 1)")

		# Build WHERE clause
		where_clause = " AND ".join(conditions) if conditions else "1=1"

		# Query to get cheque document records
		query = f"""
			SELECT
				cd.name,
				cd.date,
				cd.company,
				cd.branch,
				cd.type,
				cd.party,
				cd.party_name,
				cd.purpose,
				cd.remarks,
				cd.amount,
				cd.workflow_state,
				cd.docstatus,
				cd.cheque_reference_number,
				cd.cheque_issue_date,
				cd.cheque_expiry_date
			FROM
				`tabCheque Document` cd
			WHERE
				{where_clause}
			ORDER BY
				cd.date DESC, cd.creation DESC
		"""

		result = frappe.db.sql(query, tuple(values), as_dict=True)

		# Calculate summary
		total_records = len(result)
		total_amount = sum(flt(r.get('amount', 0)) for r in result)

		# Group by workflow_state for summary
		workflow_summary = {}
		for r in result:
			ws = r.get('workflow_state') or 'No Status'
			if ws not in workflow_summary:
				workflow_summary[ws] = {'count': 0, 'amount': 0}
			workflow_summary[ws]['count'] += 1
			workflow_summary[ws]['amount'] += flt(r.get('amount', 0))

		# Group by type for summary
		type_summary = {}
		for r in result:
			t = r.get('type') or 'No Type'
			if t not in type_summary:
				type_summary[t] = {'count': 0, 'amount': 0}
			type_summary[t]['count'] += 1
			type_summary[t]['amount'] += flt(r.get('amount', 0))

		# Get unique values for filters
		unique_workflow_states = list(set(r.get('workflow_state') for r in result if r.get('workflow_state')))
		unique_purposes = list(set(r.get('purpose') for r in result if r.get('purpose')))
		unique_types = list(set(r.get('type') for r in result if r.get('type')))

		return {
			"data": result,
			"summary": {
				"total_records": total_records,
				"total_amount": total_amount,
				"workflow_summary": workflow_summary,
				"type_summary": type_summary
			},
			"filter_options": {
				"workflow_states": sorted(unique_workflow_states),
				"purposes": sorted(unique_purposes),
				"types": sorted(unique_types)
			}
		}

	except Exception as e:
		frappe.log_error(
			message=f"Error fetching cheque document data: {str(e)}",
			title="Cheque Document Query Failure"
		)
		return {
			"data": [],
			"summary": {
				"total_records": 0,
				"total_amount": 0,
				"workflow_summary": {},
				"type_summary": {}
			},
			"filter_options": {
				"workflow_states": [],
				"purposes": [],
				"types": []
			}
		}


@frappe.whitelist()
def get_credit_limit_metadata(company=None, customers=None):
	"""Return company-wise credit limit rows using only the custom `Credit Limit` child table."""
	import json

	if isinstance(customers, str):
		try:
			customers = json.loads(customers)
		except ValueError:
			customers = [value.strip() for value in customers.split(",") if value.strip()]

	customers = [value for value in (customers or []) if value]
	if not customers:
		return {"company": company, "customers": {}}

	customer_records = frappe.get_all(
		"Customer",
		filters={"name": ["in", customers]},
		fields=[
			"name",
			"customer_name",
			"territory",
			"customer_group",
			"payment_terms",
			"custom_parent_customer",
		],
		limit_page_length=0,
	)

	customer_meta = frappe.get_meta("Customer")
	custom_credit_limit_field = customer_meta.get_field("custom_credit_limit")
	child_doctype = "Credit Limit"

	if not (
		custom_credit_limit_field
		and custom_credit_limit_field.fieldtype in ("Table", "Table MultiSelect")
		and custom_credit_limit_field.options == child_doctype
	):
		return {"company": company, "customers": {}, "source_doctype": child_doctype}

	credit_limit_rows = frappe.get_all(
		child_doctype,
		filters={"parent": ["in", customers], "parenttype": "Customer"},
		fields=["parent", "company", "credit_limit_amount", "credit_limit_days"],
		order_by="parent asc, company asc",
		limit_page_length=0,
	)

	customer_map = {}
	for customer in customer_records:
		customer_map[customer.name] = {
			"customer_name": customer.customer_name or customer.name,
			"territory": customer.territory or "",
			"customer_group": customer.customer_group or "",
			"payment_terms": customer.payment_terms or "",
			"custom_parent_customer": customer.custom_parent_customer or "",
			"credit_limit_rows": [],
			"selected_company_credit_limit": 0,
			"selected_company_credit_days": 0,
			"has_selected_company_limit": 0,
			"has_any_credit_limit": 0,
			"credit_limit_source": child_doctype,
		}

	for row in credit_limit_rows:
		row_company = row.company or ""
		row_credit_limit = flt(row.credit_limit_amount)
		row_credit_days = flt(row.credit_limit_days)

		entry = customer_map.setdefault(
			row.parent,
			{
				"customer_name": row.parent,
				"territory": "",
				"customer_group": "",
				"payment_terms": "",
				"custom_parent_customer": "",
				"credit_limit_rows": [],
				"selected_company_credit_limit": 0,
				"selected_company_credit_days": 0,
				"has_selected_company_limit": 0,
				"has_any_credit_limit": 0,
				"credit_limit_source": child_doctype,
			},
		)

		entry["credit_limit_rows"].append(
			{
				"company": row_company,
				"credit_limit": row_credit_limit,
				"credit_limit_days": row_credit_days,
			}
		)
		entry["has_any_credit_limit"] = 1

		if company and row_company == company:
			entry["selected_company_credit_limit"] = row_credit_limit
			entry["selected_company_credit_days"] = row_credit_days
			entry["has_selected_company_limit"] = 1

		elif not company and not entry["has_selected_company_limit"]:
			entry["selected_company_credit_limit"] = row_credit_limit
			entry["selected_company_credit_days"] = row_credit_days
			entry["has_selected_company_limit"] = 1

	return {"company": company, "customers": customer_map, "source_doctype": child_doctype}


def _sanitize_export_filename(value):
	value = (value or "sales_person").strip()
	safe = "".join(ch if ch.isalnum() else "_" for ch in value)
	safe = safe.strip("_")
	return safe or "sales_person"


def _build_sales_person_credit_limit_pdf_html(sales_person, company, report_date, rows):
	total_outstanding = sum(flt(row.get("outstanding")) for row in rows)
	total_over_limit = sum(flt(row.get("over_limit_amount")) for row in rows)
	total_beyond_days = sum(flt(row.get("outstanding_beyond_credit_days")) for row in rows)
	generated_on = frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M:%S")

	def money(value):
		return frappe.format_value(flt(value), {"fieldtype": "Currency"})

	table_rows = "".join([
		f"""
			<tr>
				<td>{escape((row.get('customer_name') or row.get('customer') or '-'))}</td>
				<td>{escape(row.get('branch') or '-')}</td>
				<td style="text-align: right;">{money(row.get('credit_limit'))}</td>
				<td style="text-align: center;">{escape(str(int(flt(row.get('credit_limit_days') or 0))))}</td>
				<td style="text-align: right;">{money(row.get('outstanding'))}</td>
				<td style="text-align: right;">{money(row.get('over_limit_amount'))}</td>
				<td style="text-align: right;">{money(row.get('outstanding_beyond_credit_days'))}</td>
				<td style="text-align: center;">{escape(str(int(flt(row.get('max_age') or 0))))}</td>
				<td style="text-align: center;">{escape(row.get('status') or '-')}</td>
			</tr>
		"""
		for row in rows
	]) or '<tr><td colspan="9" style="text-align: center;">No customer data found for this sales person.</td></tr>'

	return f"""
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<style>
				body {{ font-family: Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; }}
				.page {{ padding: 24px 28px; }}
				.header {{ display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }}
				.header h1 {{ margin: 0 0 6px 0; font-size: 24px; color: #0f172a; }}
				.header-meta {{ color: #475569; font-size: 12px; line-height: 1.6; }}
				.kpi-grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }}
				.kpi {{ background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; }}
				.kpi-label {{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 6px; }}
				.kpi-value {{ font-size: 20px; font-weight: 700; color: #0f172a; }}
				.section {{ background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; }}
				.section h2 {{ margin: 0 0 12px 0; font-size: 16px; color: #0f172a; }}
				table {{ width: 100%; border-collapse: collapse; }}
				th, td {{ border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; vertical-align: top; }}
				th {{ background: #e2e8f0; color: #0f172a; text-align: left; }}
			</style>
		</head>
		<body>
			<div class="page">
				<div class="header">
					<div>
						<h1>Sales Person Credit Limit Detail</h1>
						<div class="header-meta">
							<div><strong>Sales Person:</strong> {escape(sales_person or '-')}</div>
							<div><strong>Company:</strong> {escape(company or '-')}</div>
						</div>
					</div>
					<div class="header-meta">
						<div><strong>Report Date:</strong> {escape(report_date or frappe.utils.today())}</div>
						<div><strong>Generated On:</strong> {escape(generated_on)}</div>
						<div><strong>Customers:</strong> {len(rows)}</div>
					</div>
				</div>

				<div class="kpi-grid">
					<div class="kpi"><div class="kpi-label">Customers</div><div class="kpi-value">{len(rows)}</div></div>
					<div class="kpi"><div class="kpi-label">Total Outstanding</div><div class="kpi-value">{money(total_outstanding)}</div></div>
					<div class="kpi"><div class="kpi-label">Above Limit</div><div class="kpi-value">{money(total_over_limit)}</div></div>
					<div class="kpi"><div class="kpi-label">Beyond Days</div><div class="kpi-value">{money(total_beyond_days)}</div></div>
				</div>

				<div class="section">
					<h2>Customer Summary</h2>
					<table>
						<thead>
							<tr>
								<th>Customer</th>
								<th>Branch</th>
								<th style="text-align: right;">Credit Limit</th>
								<th style="text-align: center;">Credit Days</th>
								<th style="text-align: right;">Outstanding</th>
								<th style="text-align: right;">Above Limit</th>
								<th style="text-align: right;">Beyond Days</th>
								<th style="text-align: center;">Oldest Age</th>
								<th style="text-align: center;">Status</th>
							</tr>
						</thead>
						<tbody>{table_rows}</tbody>
					</table>
				</div>
			</div>
		</body>
		</html>
	"""


@frappe.whitelist()
def download_credit_limit_sales_person_pdfs(payload=None):
	if isinstance(payload, str):
		payload = json.loads(payload)

	payload = payload or {}
	sales_persons = [value for value in (payload.get("sales_persons") or []) if value]
	reports = payload.get("reports") or []
	company = payload.get("company")
	report_date = payload.get("report_date")

	if not sales_persons or not reports:
		frappe.throw(_("No sales person PDF data received."))

	report_map = {}
	for entry in reports:
		name = (entry.get("sales_person") or "").strip()
		rows = entry.get("rows") or []
		if name and rows:
			report_map[name] = rows

	pdf_files = []
	for sales_person in sales_persons:
		rows = report_map.get(sales_person, [])
		if not rows:
			continue

		html = _build_sales_person_credit_limit_pdf_html(sales_person, company, report_date, rows)
		pdf_content = get_pdf(html, {"orientation": "Landscape"})
		filename = f"{_sanitize_export_filename(sales_person)}_credit_limit_{frappe.utils.today()}.pdf"
		pdf_files.append((filename, pdf_content))

	if not pdf_files:
		frappe.throw(_("No PDF content could be generated for the selected sales persons."))

	if len(pdf_files) == 1:
		filename, filecontent = pdf_files[0]
		return {
			"filename": filename,
			"mimetype": "application/pdf",
			"content": base64.b64encode(filecontent).decode("utf-8"),
		}

	zip_buffer = io.BytesIO()
	with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
		for filename, filecontent in pdf_files:
			zip_file.writestr(filename, filecontent)

	return {
		"filename": f"sales_person_credit_limit_pdfs_{frappe.utils.today()}.zip",
		"mimetype": "application/zip",
		"content": base64.b64encode(zip_buffer.getvalue()).decode("utf-8"),
	}
