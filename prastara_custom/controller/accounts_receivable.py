from __future__ import unicode_literals
import frappe
import json
from frappe.model.mapper import get_mapped_doc
from frappe import _
from frappe.utils import flt, getdate,get_url, today, get_date_str, get_time, nowdate, get_first_day, get_last_day, add_months, get_link_to_form,date_diff
from datetime import datetime, timedelta,date
from erpnext.setup.doctype.holiday_list.holiday_list import is_holiday
from hrms.hr.utils import get_holiday_dates_for_employee




import frappe
from frappe import _
from frappe.utils import today, getdate, flt
from frappe.desk.reportview import build_match_conditions

@frappe.whitelist()
def get_accounts_receivable_summary(filters=None):
    """API to get Accounts Receivable Summary data.
    Args:
        filters (dict): e.g., {"report_date": "2025-09-20", "company": "Your Company", "ageing_range": [30, 60, 90, 120]}
    Returns:
        dict: {"columns": [column definitions], "data": [row data]}
    """
    # Parse filters
    if isinstance(filters, str):
        filters = frappe.parse_json(filters)
    filters = filters or {}
    report_date = getdate(filters.get("report_date") or today())
    company = filters.get("company")
    ageing_range = filters.get("ageing_range") or [30, 60, 90, 120]

    # Validate ageing range
    if not all(isinstance(x, int) and x > 0 for x in ageing_range) or ageing_range != sorted(ageing_range):
        frappe.throw(_("Ageing ranges must be a sorted list of positive integers"))

    # Validate company if provided
    if company and not frappe.db.exists("Company", company):
        frappe.throw(_("Invalid company: {0}").format(company))

    # Define columns
    columns = [
        {"label": _("Customer"), "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 150},
        {"label": _("Customer Name"), "fieldname": "customer_name", "fieldtype": "Data", "width": 150},
        {"label": _("Credit Limit"), "fieldname": "credit_limit", "fieldtype": "Currency", "width": 120, "options": "currency"},
        {"label": _("Outstanding Amount"), "fieldname": "outstanding_amount", "fieldtype": "Currency", "width": 120, "options": "currency"}
    ]
    # Add ageing range columns dynamically
    for i, days in enumerate(ageing_range, 1):
        columns.append({
            "label": _(f"{0 if i==1 else ageing_range[i-2] + 1}-{days}"),
            "fieldname": f"range{i}",
            "fieldtype": "Currency",
            "width": 100,
            "options": "currency"
        })
    columns.append({
        "label": _("Current"),
        "fieldname": "current",
        "fieldtype": "Currency",
        "width": 100,
        "options": "currency"
    })
    columns.append({
        "label": _("120+"),
        "fieldname": "overdue_beyond_range",
        "fieldtype": "Currency",
        "width": 100,
        "options": "currency"
    })
    columns.append({
        "label": _("Total"),
        "fieldname": "total",
        "fieldtype": "Currency",
        "width": 100,
        "options": "currency"
    })

    # Build query conditions
    conditions = build_match_conditions("Customer")
    if company:
        conditions += " and si.company = %(company)s"
    query_filters = {"company": company} if company else {}

    # Fetch outstanding invoices with sales order reference
    invoices = frappe.db.sql("""
        SELECT 
            si.customer as party, 
            si.customer_name as party_name, 
            si.outstanding_amount, 
            si.posting_date, 
            si.sales_order,
            si.company
        FROM `tabSales Invoice` si
        WHERE si.docstatus = 1 and si.outstanding_amount > 0 {conditions}
    """.format(conditions=conditions), query_filters, as_dict=1)

    # Fetch payment schedules for linked sales orders
    sales_orders = [inv.sales_order for inv in invoices if inv.sales_order]
    payment_schedules = []
    if sales_orders:
        payment_schedules = frappe.db.sql("""
            SELECT 
                ps.parent as sales_order,
                ps.due_date,
                ps.payment_amount
            FROM `tabPayment Schedule` ps
            WHERE ps.parent IN %(sales_orders)s
        """, {"sales_orders": sales_orders}, as_dict=1)

    # Group payment schedules by sales order
    payment_schedule_dict = {}
    for ps in payment_schedules:
        if ps.sales_order not in payment_schedule_dict:
            payment_schedule_dict[ps.sales_order] = []
        payment_schedule_dict[ps.sales_order].append({
            "due_date": ps.due_date,
            "payment_amount": flt(ps.payment_amount)
        })

    # Fetch credit limits and customer names for the filtered company
    credit_limit_conditions = "WHERE ccl.parenttype = 'Customer'"
    if company:
        credit_limit_conditions += " AND ccl.company = %(company)s"
    else:
        # If no company filter, include all customers but log a warning
        frappe.log_error("No company filter provided; fetching all credit limits.", "Accounts Receivable Summary")
    customers = frappe.db.sql("""
        SELECT 
            ccl.parent as customer, 
            c.name as customer_name, 
            ccl.credit_limit
        FROM `tabCustomer Credit Limit` ccl
        JOIN `tabCustomer` c ON ccl.parent = c.name
        {conditions}
    """.format(conditions=credit_limit_conditions), query_filters, as_dict=1)
    
    # Create a dictionary for quick lookup of credit limits and customer names
    customer_dict = {c.customer: {"customer_name": c.customer_name, "credit_limit": flt(c.credit_limit)} for c in customers}

    # Aggregate data by customer
    data_dict = {}
    # Initialize with all customers from credit limits
    for customer, info in customer_dict.items():
        data_dict[customer] = {
            "customer": customer,
            "customer_name": info["customer_name"],
            "credit_limit": info["credit_limit"],
            "outstanding_amount": 0.0,
            **{f"range{i+1}": 0.0 for i in range(len(ageing_range))},
            "current": 0.0,
            "overdue_beyond_range": 0.0,
            "total": 0.0
        }

    # Process invoices
    for inv in invoices:
        party = inv.party
        # Skip invoices if company filter is set and doesn't match
        if company and inv.company != company:
            continue
        # Initialize customer if not already in data_dict
        if party not in data_dict:
            customer_name = inv.party_name or frappe.db.get_value("Customer", party, "customer_name")
            data_dict[party] = {
                "customer": party,
                "customer_name": customer_name,
                "credit_limit": customer_dict.get(party, {}).get("credit_limit", 0.0),
                "outstanding_amount": 0.0,
                **{f"range{i+1}": 0.0 for i in range(len(ageing_range))},
                "current": 0.0,
                "overdue_beyond_range": 0.0,
                "total": 0.0
            }

        outstanding = flt(inv.outstanding_amount)
        # Update totals
        data_dict[party]["outstanding_amount"] += outstanding
        data_dict[party]["total"] += outstanding

        # Get payment schedules for the sales order
        schedules = payment_schedule_dict.get(inv.sales_order, []) if inv.sales_order else []
        if not schedules:
            # Fallback to posting_date if no payment schedule
            due_date = inv.posting_date
            days_overdue = (report_date - getdate(due_date)).days
            if days_overdue <= 0:
                data_dict[party]["current"] += outstanding
            elif days_overdue <= ageing_range[0]:
                data_dict[party]["range1"] += outstanding
            elif days_overdue <= ageing_range[1]:
                data_dict[party]["range2"] += outstanding
            elif days_overdue <= ageing_range[2]:
                data_dict[party]["range3"] += outstanding
            elif days_overdue <= ageing_range[3]:
                data_dict[party]["range4"] += outstanding
            else:
                data_dict[party]["overdue_beyond_range"] += outstanding
        else:
            # Prorate outstanding amount across payment schedules
            total_schedule_amount = sum(s["payment_amount"] for s in schedules)
            if total_schedule_amount > 0:
                for schedule in schedules:
                    # Calculate portion of outstanding amount for this schedule
                    portion = outstanding * (schedule["payment_amount"] / total_schedule_amount)
                    due_date = schedule["due_date"]
                    if not due_date:
                        due_date = inv.posting_date
                    days_overdue = (report_date - getdate(due_date)).days
                    if days_overdue <= 0:
                        data_dict[party]["current"] += portion
                    elif days_overdue <= ageing_range[0]:
                        data_dict[party]["range1"] += portion
                    elif days_overdue <= ageing_range[1]:
                        data_dict[party]["range2"] += portion
                    elif days_overdue <= ageing_range[2]:
                        data_dict[party]["range3"] += portion
                    elif days_overdue <= ageing_range[3]:
                        data_dict[party]["range4"] += portion
                    else:
                        data_dict[party]["overdue_beyond_range"] += portion
            else:
                # If total_schedule_amount is 0, use posting_date
                due_date = inv.posting_date
                days_overdue = (report_date - getdate(due_date)).days
                if days_overdue <= 0:
                    data_dict[party]["current"] += outstanding
                elif days_overdue <= ageing_range[0]:
                    data_dict[party]["range1"] += outstanding
                elif days_overdue <= ageing_range[1]:
                    data_dict[party]["range2"] += outstanding
                elif days_overdue <= ageing_range[2]:
                    data_dict[party]["range3"] += outstanding
                elif days_overdue <= ageing_range[3]:
                    data_dict[party]["range4"] += outstanding
                else:
                    data_dict[party]["overdue_beyond_range"] += outstanding

    # Convert to list and sort by outstanding amount
    data = list(data_dict.values())
    data.sort(key=lambda x: x["outstanding_amount"], reverse=True)

    # Optional: Add payment terms logic if filter enabled
    if filters.get("based_on_payment_terms"):
        # Placeholder for additional payment terms logic
        pass

    return {
        "columns": columns,
        "data": data,
        "report_name": "Accounts Receivable Summary"
    }





import frappe
from frappe import _
from datetime import datetime
from dateutil import parser

@frappe.whitelist(allow_guest=False)
def get_receivables_summary1(customer=None, filter_date=None):
    """
    API to fetch customer receivables from Sales Order payment schedules.
    Filters by customer and date, returns unpaid amounts with aging buckets.

    Args:
        customer (str, optional): Customer ID to filter (e.g., 'CUST123').
        filter_date (str, optional): Date to calculate receivables and aging (YYYY-MM-DD).
                                    Defaults to today.

    Returns:
        list: Receivables data grouped by customer with aging summary and details.

    Example:
        POST /api/method/qcshr.controller.accounts_receivable.get_receivables_summary1
        {
            "customer": "CUST123",
            "filter_date": "2025-09-20"
        }
    """
    # Parse filter_date or use today
    if filter_date:
        try:
            filter_date = parser.parse(filter_date).date()
        except ValueError:
            frappe.throw(_("Invalid filter_date format. Use YYYY-MM-DD."), title="Invalid Input", exc=frappe.exceptions.ValidationError)
    else:
        filter_date = datetime.now().date()

    # Build query for Sales Order payment schedules
    conditions = ["ps.outstanding > 0", "so.docstatus = 1", f"ps.due_date <= '{filter_date}'"]
    if customer:
        conditions.append(f"so.customer = '{frappe.db.escape(customer)}'")

    query = """
        SELECT
            so.customer AS customer_id,
            so.customer_name,
            so.name AS order_id,
            ps.name AS schedule_id,
            ps.payment_term AS term,
            ps.due_date,
            ps.payment_amount AS amount,
            ps.outstanding AS outstanding_amount
        FROM `tabSales Order` so
        JOIN `tabPayment Schedule` ps ON so.name = ps.parent
        WHERE {conditions}
        ORDER BY so.customer, ps.due_date
    """.format(conditions=" AND ".join(conditions))

    try:
        results = frappe.db.sql(query, as_dict=True)
    except Exception as e:
        frappe.log_error(message=str(e), title="Receivables Query Error")
        frappe.throw(_("Error executing query: {0}").format(str(e)), title="Database Error")

    # Group results by customer and calculate aging
    receivables = {}
    for row in results:
        customer_id = row.customer_id
        if customer_id not in receivables:
            receivables[customer_id] = {
                "customer_id": customer_id,
                "customer_name": row.customer_name,
                "total_receivable": 0.0,
                "aging_summary": {
                    "0-30": 0.0,
                    "31-60": 0.0,
                    "61-90": 0.0,
                    "91-120": 0.0,
                    "120+": 0.0
                },
                "details": []
            }

        # Calculate aging bucket
        days_overdue = (filter_date - row.due_date).days
        if days_overdue <= 30:
            aging_bucket = "0-30"
        elif days_overdue <= 60:
            aging_bucket = "31-60"
        elif days_overdue <= 90:
            aging_bucket = "61-90"
        elif days_overdue <= 120:
            aging_bucket = "91-120"
        else:
            aging_bucket = "120+"

        # Update receivables
        receivables[customer_id]["total_receivable"] += row.outstanding_amount
        receivables[customer_id]["aging_summary"][aging_bucket] += row.outstanding_amount
        receivables[customer_id]["details"].append({
            "customer_id": row.customer_id,
            "customer_name": row.customer_name,
            "order_id": row.order_id,
            "schedule_id": row.schedule_id,
            "term": row.term,
            "due_date": row.due_date.strftime("%Y-%m-%d"),
            "amount": row.outstanding_amount,
            "aging_bucket": aging_bucket
        })

    # Convert receivables dict to list for response
    response = list(receivables.values())

    # Log success for debugging
    frappe.log_error(message=f"Receivables fetched for customer: {customer}, date: {filter_date}, results: {len(response)}", title="Receivables API Success")

    return response










import frappe
from frappe import _
from frappe.utils import getdate, nowdate, cint, add_days, get_first_day, get_last_day
from erpnext.accounts.report.accounts_receivable.accounts_receivable import ReceivablePayableReport
from collections import defaultdict

class CustomerOutstandingReport(ReceivablePayableReport):
    def __init__(self, filters=None):
        super().__init__(filters)
        self.party_type = "Customer"
        self.filters.party_type = "Customer"
        self.account_type = "Receivable"
        self.filters.account_type = "Receivable"
        # Set default ageing ranges
        self.filters.setdefault("range1", 30)
        self.filters.setdefault("range2", 60)
        self.filters.setdefault("range3", 90)
        self.filters.setdefault("range4", 120)
        # Cache customer credit limits
        self.credit_limits = self.get_credit_limits()
        # Set dates for filtering
        self.today = getdate(nowdate())
        self.yesterday = add_days(self.today, -1)
        self.month_start = get_first_day(self.today)
        self.month_end = get_last_day(self.today)

    def get_credit_limits(self):
        """Fetch credit limits for customers in the specified company."""
        credit_limits = frappe.db.sql(
            """
            select parent as customer, credit_limit
            from `tabCustomer Credit Limit`
            where company = %s and parenttype = 'Customer'
            """,
            self.filters.company,
            as_dict=1,
        )
        result = {d.customer: d.credit_limit for d in credit_limits}
        if not result:
            frappe.log_error(
                title="No Credit Limits Found",
                message=f"No credit limits found for company: {self.filters.company}"
            )
        return result

    def run(self):
        args = {
            "party_type": "Customer",
            "naming_by": ["Selling Settings", "cust_master_name"],
            "account_type": "Receivable",
        }
        return super().run(args)

    def get_columns(self):
        self.account_type = "Receivable"
        self.columns = []
        self.add_column("Posting Date", fieldtype="Date")
        self.add_column(
            label=_("Customer"),
            fieldname="party",
            fieldtype="Link",
            options="Customer",
            width=180,
        )
        self.add_column(
            label=_("Parent Customer"),
            fieldname="custom_parent_customer",
            fieldtype="Link",
            options="Customer",
            width=180,
        )
        self.add_column(
            label="Receivable Account",
            fieldname="party_account",
            fieldtype="Link",
            options="Account",
            width=180,
        )
        if self.party_naming_by == "Naming Series":
            self.add_column(
                _("Customer Name"),
                fieldname="customer_name",
                fieldtype="Data",
            )
        self.add_column(label=_("Cost Center"), fieldname="cost_center", fieldtype="Data")
        self.add_column(label=_("Voucher Type"), fieldname="voucher_type", fieldtype="Data")
        self.add_column(
            label=_("Voucher No"),
            fieldname="voucher_no",
            fieldtype="Dynamic Link",
            options="voucher_type",
            width=180,
        )
        self.add_column(label="Due Date", fieldtype="Date")
        self.add_column(_("Invoiced Amount"), fieldname="invoiced")
        self.add_column(_("Paid Amount"), fieldname="paid")
        self.add_column(_("Credit Note"), fieldname="credit_note")
        self.add_column(_("Outstanding Amount"), fieldname="outstanding")
        self.add_column(
            label=_("Currency"),
            fieldname="currency",
            fieldtype="Link",
            options="Currency",
            width=80,
        )
        self.add_column(
            label=_("Branch"),
            fieldname="branch",
            fieldtype="Link",
            options="Branch",
            width=180,
        )
        self.add_column(
            label=_("Credit Limit"),
            fieldname="credit_limit",
            fieldtype="Currency",
            width=120,
        )
        # Add ageing columns
        self.setup_ageing_columns()

    def setup_ageing_columns(self):
        self.ageing_column_labels = []
        self.add_column(label=_("Age (Days)"), fieldname="age", fieldtype="Int", width=80)
        for i, label in enumerate(
            [
                f"0-{self.filters['range1']}",
                f"{cint(self.filters['range1']) + 1}-{self.filters['range2']}",
                f"{cint(self.filters['range2']) + 1}-{self.filters['range3']}",
                f"{cint(self.filters['range3']) + 1}-{self.filters['range4']}",
                f"{cint(self.filters['range4']) + 1}-Above",
            ]
        ):
            self.add_column(label=label, fieldname=f"range{i + 1}")
            self.ageing_column_labels.append(label)

    def get_chart_data(self):
        self.chart = None  # Skip chart generation

    def get_invoice_details(self):
        self.invoice_details = frappe._dict()
        # Fetch Sales Invoice details including branch and due_date
        si_list = frappe.db.sql(
            """
            select si.name, si.posting_date, si.po_no, si.project, si.branch, si.due_date as invoice_due_date, si.customer
            from `tabSales Invoice` si
            where si.posting_date <= %s and si.docstatus = 1
            """,
            self.filters.report_date,
            as_dict=1,
        )
        for d in si_list:
            self.invoice_details.setdefault(d.name, d)

        # Fetch due date from Sales Order's Payment Schedule
        si_so_mapping = frappe.db.sql(
            """
            select si.name as invoice_name, si.customer, so.name as sales_order, min(ps.due_date) as so_due_date
            from `tabSales Invoice` si
            left join `tabSales Invoice Item` sii on sii.parent = si.name
            left join `tabSales Order` so on so.name = sii.sales_order
            left join `tabPayment Schedule` ps on ps.parent = so.name
            where si.posting_date <= %s and si.docstatus = 1
            group by si.name, si.customer
            """,
            self.filters.report_date,
            as_dict=1,
        )
        for d in si_so_mapping:
            due_date = d.so_due_date or self.invoice_details.get(d.invoice_name, {}).get("invoice_due_date")
            self.invoice_details.setdefault(d.invoice_name, {}).update({"due_date": due_date})
            if not due_date:
                frappe.log_error(
                    title="No Due Date Found",
                    message=f"Invoice: {d.invoice_name}, Customer: {d.customer}, Sales Order: {d.sales_order}, SO Due Date: {d.so_due_date}, Invoice Due Date: {self.invoice_details.get(d.invoice_name, {}).get('invoice_due_date')}"
                )

        # Fetch Journal Entry details (if any)
        journal_entries = frappe.db.sql(
            """
            select name, due_date, bill_no, bill_date
            from `tabJournal Entry`
            where posting_date <= %s
            """,
            self.filters.report_date,
            as_dict=1,
        )
        for je in journal_entries:
            if je.bill_no:
                self.invoice_details.setdefault(je.name, je)

        # Fetch Sales Team for Sales Invoices
        if self.filters.show_sales_person:
            sales_team = frappe.db.sql(
                """
                select parent, sales_person
                from `tabSales Team`
                where parenttype = 'Sales Invoice'
                """,
                as_dict=1,
            )
            for d in sales_team:
                self.invoice_details.setdefault(d.parent, {}).setdefault("sales_team", []).append(
                    d.sales_person
                )

    def set_ageing(self, row):
        # Calculate ageing based on due_date from Sales Order's Payment Schedule or Sales Invoice
        entry_date = row.due_date or row.posting_date
        if not row.due_date:
            frappe.log_error(
                title="No Due Date for Ageing",
                message=f"Invoice: {row.voucher_no}, Customer: {row.party}, Due Date: {row.due_date}, Posting Date: {row.posting_date}"
            )
        self.get_ageing_data(entry_date, row)
        # Clear ageing buckets if due date is in the future
        if getdate(entry_date) > getdate(self.filters.report_date):
            row.age = 0
            row.range1 = row.range2 = row.range3 = row.range4 = row.range5 = 0.0
        row.total_due = row.range1 + row.range2 + row.range3 + row.range4 + row.range5

@frappe.whitelist(allow_guest=False)
def get_customer_outstandings(company, report_date=None, customer=None, branch=None, sales_person=None, sales_team=None, include_sales_person=False):
    if not company:
        frappe.throw(_("Company is required"))

    # Validate customer if provided
    if customer and not frappe.db.exists("Customer", customer):
        frappe.throw(_("Invalid Customer: {0}").format(customer))

    filters = frappe._dict({
        "company": company,
        "report_date": getdate(report_date or nowdate()),
        "party_type": "Customer",
        "group_by_party": 0,
        "show_future_payments": 0,
        "based_on_payment_terms": 0,
        "account_type": "Receivable",
        "range1": 30,
        "range2": 60,
        "range3": 90,
        "range4": 120,
    })

    if customer:
        filters.customer = customer
    if branch:
        filters.branch = branch

    # Log filter for debugging
    frappe.log_error(f"Customer filter applied: {filters.customer}")

    report = CustomerOutstandingReport(filters)
    columns, data, message, chart, report_summary, skip_total_row = report.run()

    # Log number of rows for debugging
    frappe.log_error(f"Rows returned: {len(data)}")

    customer_groups = defaultdict(lambda: {
        "customer_name": "",
        "custom_parent_customer": "",
        "credit_limit": 0.0,
        "invoices": [],
        "has_outstanding": False
    })

    due_today = 0.0
    due_yesterday = 0.0
    due_this_month = 0.0

    for row in data:
        if not isinstance(row, dict) or not row.get("party"):
            continue
        if customer and row.get("party") != customer:
            continue  # Skip rows that don't match the customer filter

        party = row["party"]
        group = customer_groups[party]

        if not group["customer_name"]:
            group["customer_name"] = row.get("customer_name", "")
            group["custom_parent_customer"] = row.get("custom_parent_customer", "")
            group["credit_limit"] = report.credit_limits.get(party, 0.0)
            if not group["credit_limit"]:
                frappe.log_error(
                    title="No Credit Limit for Customer",
                    message=f"Customer: {party}, Company: {company}"
                )

        # Fetch sales team data based on voucher (only if include_sales_person is True or filters are set)
        sales_team_data = []
        sales_person_val = None
        sales_team_val = None

        if include_sales_person or sales_person or sales_team:
            voucher_no = row.get("voucher_no")
            voucher_type = row.get("voucher_type")

            if voucher_no and voucher_type:
                if voucher_type == "Sales Invoice":
                    sales_team_data = frappe.db.sql("""
                        SELECT
                            sales_person,
                            parent_sales_person,
                            allocated_percentage
                        FROM `tabSales Team`
                        WHERE parent = %s
                            AND parenttype = 'Sales Invoice'
                        ORDER BY allocated_percentage DESC
                    """, (voucher_no,), as_dict=True)

                    if sales_team_data:
                        sales_person_val = sales_team_data[0].get('sales_person')
                        sales_team_val = sales_team_data[0].get('parent_sales_person')
                else:
                    try:
                        doc = frappe.get_doc(voucher_type, voucher_no)
                        if hasattr(doc, 'sales_person'):
                            sales_person_val = doc.sales_person
                        if sales_person_val:
                            parent_sp = frappe.db.get_value('Sales Person', sales_person_val, 'parent_sales_person')
                            if parent_sp:
                                sales_team_val = parent_sp
                    except Exception as e:
                        frappe.log_error(f"Error fetching sales person for {voucher_type} {voucher_no}: {str(e)}")

        if sales_person or sales_team:
            matches_filter = False
            if sales_person:
                if sales_person_val == sales_person:
                    matches_filter = True
                elif sales_team_data:
                    for team_member in sales_team_data:
                        if team_member.get('sales_person') == sales_person:
                            matches_filter = True
                            break
            if sales_team and not matches_filter:
                if sales_team_val == sales_team:
                    matches_filter = True
                elif sales_team_data:
                    for team_member in sales_team_data:
                        if team_member.get('parent_sales_person') == sales_team:
                            matches_filter = True
                            break
            if not matches_filter:
                continue

        invoice_details = {
            "voucher_no": row.get("voucher_no"),
            "voucher_type": row.get("voucher_type"),
            "posting_date": row.get("posting_date"),
            "due_date": row.get("due_date"),
            "branch": row.get("branch", ""),
            "invoiced": row.get("invoiced", 0.0),
            "paid": row.get("paid", 0.0),
            "credit_note": row.get("credit_note", 0.0),
            "outstanding": row.get("outstanding", 0.0),
            "age": row.get("age", 0),
            "range1": row.get("range1", 0.0),
            "range2": row.get("range2", 0.0),
            "range3": row.get("range3", 0.0),
            "range4": row.get("range4", 0.0),
            "range5": row.get("range5", 0.0),
        }

        if include_sales_person:
            invoice_details["sales_person"] = sales_person_val
            invoice_details["sales_team"] = sales_team_val
            invoice_details["sales_team_data"] = sales_team_data

        group["invoices"].append(invoice_details)

        if invoice_details["outstanding"] != 0:
            group["has_outstanding"] = True

        if row.get("due_date") and row.get("outstanding", 0) != 0:
            due_date = getdate(row["due_date"])
            outstanding_amt = row.get("outstanding", 0.0)
            if due_date == report.today:
                due_today += outstanding_amt
            if due_date == report.yesterday:
                due_yesterday += outstanding_amt
            if report.month_start <= due_date <= report.month_end:
                due_this_month += outstanding_amt

    outstandings = []
    for party, group in customer_groups.items():
        if customer and party != customer:
            continue  # Only include the specified customer
        if group["has_outstanding"] or customer:
            outstanding = {
                "customer": party,
                "customer_name": group["customer_name"],
                "parent_customer": group["custom_parent_customer"],
                "company": company,
                "credit_limit": group["credit_limit"],
                "invoices": group["invoices"],
            }
            outstandings.append(outstanding)

    return {
        "data": outstandings,
        "due_today": due_today,
        "due_yesterday": due_yesterday,
        "due_this_month": due_this_month
    }

# ARM Dashboard Server Methods

import frappe
from frappe import _


@frappe.whitelist()
def get_sales_person_data(invoice_numbers):
	"""
	Fetch sales person data from Sales Team child table for given invoices

	Args:
		invoice_numbers: List of invoice numbers or comma-separated string

	Returns:
		List of sales team records with parent, sales_person, allocated_percentage
	"""

	# Handle both list and string inputs
	if isinstance(invoice_numbers, str):
		# Handle JSON string or comma-separated values
		try:
			import json
			invoice_numbers = json.loads(invoice_numbers)
		except:
			invoice_numbers = [inv.strip() for inv in invoice_numbers.split(',')]

	if not invoice_numbers:
		return []

	# Use frappe.db.sql with proper permissions context
	# This runs with system privileges and bypasses permission issues
	sales_team_data = frappe.db.sql("""
		SELECT
			parent,
			sales_person,
			allocated_percentage
		FROM `tabSales Team`
		WHERE
			parent IN %(invoice_numbers)s
			AND parenttype = 'Sales Invoice'
			AND docstatus < 2
		ORDER BY parent, allocated_percentage DESC
	""", {
		'invoice_numbers': invoice_numbers
	}, as_dict=True)

	return sales_team_data





import datetime
import json

@frappe.whitelist(allow_guest=False)
def get_payment_report(branch=None, from_date=None, to_date=None, company=None):
    """
    API to fetch payment report data based on branch and date range.
    Args:
        branch (str): Branch filter (optional)
        from_date (str): Start date in YYYY-MM-DD or DD-MM-YYYY format
        to_date (str): End date in YYYY-MM-DD or DD-MM-YYYY format
        company (str): Company filter (optional)
    Returns:
        dict: Report data with columns and data
    """
    try:
        # Validate date parameters
        if not from_date or not to_date:
            frappe.throw(_("from_date and to_date are required parameters."))

        def parse_date(date_str):
            # Try parsing YYYY-MM-DD first
            from datetime import datetime as dt
            try:
                return dt.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
            except ValueError:
                # Try parsing DD-MM-YYYY
                try:
                    return dt.strptime(date_str, '%d-%m-%Y').strftime('%Y-%m-%d')
                except ValueError:
                    frappe.throw(_("Invalid date format. Use YYYY-MM-DD or DD-MM-YYYY."))

        try:
            from_date = parse_date(from_date)
            to_date = parse_date(to_date)
        except ValueError as e:
            frappe.throw(_("Invalid date format. Use YYYY-MM-DD or DD-MM-YYYY."))

        data = []
        columns = []

        # Prepare company condition
        company_condition_si = ""
        company_condition_py = ""
        query_values = []
        
        if company:
            company_condition_si = "AND si.company = %s"
            company_condition_py = "AND py.company = %s"
        
        print(f"DEBUG: get_payment_report company={company}")
        print(f"DEBUG: company_condition_si='{company_condition_si}'")
        print(f"DEBUG: company_condition_py='{company_condition_py}'")

        if branch:
            branch_filter = branch
            date_range = (from_date, to_date)
            
            # Prepare values for the query
            # Query 1: date range (2), branch (1), company (1 if exists)
            # Query 2: date range (2), branch (1), company (1 if exists)
            
            values_q1 = [date_range[0], date_range[1], branch_filter]
            if company:
                values_q1.append(company)
                
            values_q2 = [date_range[0], date_range[1], branch_filter]
            if company:
                values_q2.append(company)
                
            query_values = values_q1 + values_q2

            # Combined query for Sales Invoice and Payment Entry
            documents = frappe.db.sql(f"""
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
                    {company_condition_si}
                GROUP BY si.branch, sp.mode_of_payment
                
                UNION ALL
                
                SELECT 
                    COALESCE(po.branch, py.custom_branch) as branch,
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
                            WHEN py.mode_of_payment = 'Cheque' THEN py.paid_amount
                            ELSE 0
                        END
                    ) AS pdc_amount
                FROM `tabPayment Entry` py
                LEFT JOIN `tabPOS Profile` po ON py.pos_profile = po.name
                WHERE py.posting_date BETWEEN %s AND %s
                    AND py.payment_type = 'Receive'
                    AND py.docstatus = 1
                    AND COALESCE(po.branch, py.custom_branch) = %s
                    {company_condition_py}
                GROUP BY COALESCE(po.branch, py.custom_branch), py.mode_of_payment
            """, tuple(query_values), as_dict=True)
        else:
            date_range = (from_date, to_date)
            
            # Prepare values for the query
            # Query 1: date range (2), company (1 if exists)
            # Query 2: date range (2), company (1 if exists)
            
            values_q1 = [date_range[0], date_range[1]]
            if company:
                values_q1.append(company)
                
            values_q2 = [date_range[0], date_range[1]]
            if company:
                values_q2.append(company)
                
            query_values = values_q1 + values_q2

            print(f"DEBUG: get_payment_report query values: {query_values}")
            documents = frappe.db.sql(f"""
                SELECT 
                    si.branch,
                    sp.mode_of_payment,
                    SUM(sp.amount) AS amount,
                    0 AS pdc_amount
                FROM `tabSales Invoice` si
                JOIN `tabSales Invoice Payment` sp ON si.name = sp.parent
                WHERE si.posting_date BETWEEN %s AND %s
                    AND si.docstatus = 1
                    {company_condition_si}
                GROUP BY si.branch, sp.mode_of_payment
                
                UNION ALL
                
                SELECT 
                    COALESCE(po.branch, py.custom_branch) as branch,
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
                            WHEN py.mode_of_payment = 'Cheque' THEN py.paid_amount
                            ELSE 0
                        END
                    ) AS pdc_amount
                FROM `tabPayment Entry` py
                LEFT JOIN `tabPOS Profile` po ON py.pos_profile = po.name
                WHERE py.posting_date BETWEEN %s AND %s
                    AND py.payment_type = 'Receive'
                    AND py.docstatus = 1
                    {company_condition_py}
                GROUP BY COALESCE(po.branch, py.custom_branch), py.mode_of_payment
            """, tuple(query_values), as_dict=True)
            print(f"DEBUG: get_payment_report results count: {len(documents)}")
            if documents:
                print(f"DEBUG: First record sample: {documents[0]}")

        # Initialize dictionary to aggregate payment mode data by branch
        payment_data = {}
        print(f"DEBUG: Processing {len(documents)} documents")
        for record in documents:
            branch_key = record.get('branch') or "Unknown Branch"
            mode_of_payment = record.get('mode_of_payment')
            amount = record.get('amount', 0)
            pdc_amount = record.get('pdc_amount', 0)
            
            print(f"DEBUG: Record: branch={branch_key}, mode={mode_of_payment}, amount={amount}, pdc={pdc_amount}")

            if branch_key not in payment_data:
                payment_data[branch_key] = {
                    'cash': 0,
                    'card': 0,
                    'cheque': 0,
                    'credit': 0,
                    'wired_transfer': 0,
                    'pdc': 0,
                    'total': 0
                }

            if mode_of_payment:
                if "Cash" in mode_of_payment:
                    payment_data[branch_key]['cash'] += amount
                elif "Card" in mode_of_payment:
                    payment_data[branch_key]['card'] += amount
                elif "Cheque" in mode_of_payment:
                    payment_data[branch_key]['cheque'] += amount
                elif "Credit" in mode_of_payment:
                    payment_data[branch_key]['credit'] += amount
                elif "Wire Transfer" in mode_of_payment:
                    payment_data[branch_key]['wired_transfer'] += amount
                
            payment_data[branch_key]['pdc'] += pdc_amount
            payment_data[branch_key]['total'] += amount + pdc_amount

        # Compile final data
        for branch_key, payments in payment_data.items():
            pos_profile = frappe.db.get_value("POS Profile", {"branch": branch_key}, "name") or " "
            data.append({
                'branch': branch_key,
                'pos': pos_profile,
                'cash': payments['cash'],
                'card': payments['card'],
                'cheque': payments['cheque'],
                'credit': payments['credit'],
                'wired_transfer': payments['wired_transfer'],
                'pdc': payments['pdc'],
                'total': payments['total']
            })

        # Define columns
        columns = [
            {'fieldname': 'branch', 'label': _('Branch'), 'fieldtype': 'Link', 'options': 'Branch', 'width': 150},
            {'fieldname': 'pos', 'label': _('POS Profile'), 'fieldtype': 'Link', 'options': 'POS Profile', 'width': 150},
            {'fieldname': 'cash', 'label': _('Cash'), 'fieldtype': 'Float', 'width': 100},
            {'fieldname': 'card', 'label': _('Card'), 'fieldtype': 'Float', 'width': 100},
            {'fieldname': 'cheque', 'label': _('Cheque'), 'fieldtype': 'Float', 'width': 100},
            {'fieldname': 'pdc', 'label': _('PDC'), 'fieldtype': 'Float', 'width': 100},
            {'fieldname': 'wired_transfer', 'label': _('Wired Transfer'), 'fieldtype': 'Float', 'width': 100},
            {'fieldname': 'credit', 'label': _('Credit'), 'fieldtype': 'Float', 'width': 100},
            {'fieldname': 'total', 'label': _('Total'), 'fieldtype': 'Float', 'width': 100}
        ]

        return {
            'status': 'success',
            'data': data,
            'columns': columns
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Payment Report API Error")
        frappe.throw(_("An error occurred while generating the report: {0}").format(str(e)))




import frappe

@frappe.whitelist()
def get_customer_classification_sql(customer_names=None, company=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    API to classify customers as listed or non-listed using SQL, including credit limit (per company) and credit days.

    Args:
        customer_names (list, optional): List of customer names (e.g., ['Cust-001', 'Cust-002']).
        company (str, optional): The company name to fetch credit limit for (e.g., 'Your Company').
        sales_person (str, optional): Filter by sales person from Sales Team child table.
        sales_team (str, optional): Filter by sales team (parent_sales_person) from Sales Team child table.
        internal_customer (bool/str, optional): Filter by internal customers only (is_internal_customer=1).

    Returns:
        dict: {'listed': [], 'non_listed': []}
    """

    # If sales_person or sales_team filter is provided, first get the list of customers that match
    if sales_person or sales_team:
        sales_filter_query = """
            SELECT DISTINCT si.customer
            FROM `tabSales Invoice` si
            INNER JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
            WHERE si.docstatus = 1
        """
        sales_conditions = []
        sales_params = {}

        if company:
            sales_conditions.append("si.company = %(company)s")
            sales_params["company"] = company

        if sales_person:
            sales_conditions.append("st.sales_person = %(sales_person)s")
            sales_params["sales_person"] = sales_person

        if sales_team:
            sales_conditions.append("st.parent_sales_person = %(sales_team)s")
            sales_params["sales_team"] = sales_team

        if sales_conditions:
            sales_filter_query += " AND " + " AND ".join(sales_conditions)

        # Get customers matching sales filter
        filtered_customers = frappe.db.sql(sales_filter_query, sales_params, as_dict=True)
        sales_filtered_customer_names = [row['customer'] for row in filtered_customers]

        # Intersect with provided customer_names if any
        if customer_names:
            customer_names = list(set(customer_names) & set(sales_filtered_customer_names))
        else:
            customer_names = sales_filtered_customer_names

        # If no customers match, return empty result
        if not customer_names:
            return {"listed": [], "non_listed": []}

    # Build query dynamically based on whether customer_names filter is provided
    query = """
        SELECT
            c.name,
            c.customer_name,
            c.customer_type,
            c.territory,
            c.customer_group,
            cl.credit_limit,
            cl.company,
            COALESCE(cl.credit_limit, 0) AS credit_limit,
            CASE
                WHEN c.custom_is_listed_customer = 1 THEN 'listed'
                ELSE 'non_listed'
            END AS classification
        FROM
            `tabCustomer` c
        LEFT JOIN
            `tabCustomer Credit Limit` cl
            ON cl.parent = c.name
            AND cl.company = %(company)s
        WHERE
            c.disabled = 0
    """

    params = {"company": company}

    # Add customer_names filter only if provided
    if customer_names:
        query += " AND c.name IN %(customer_names)s"
        params["customer_names"] = tuple(customer_names)

    # Add internal_customer filter - filter by is_internal_customer field
    if internal_customer:
        internal_val_lower = str(internal_customer).lower()
        if internal_val_lower in ['1', 'true', 'yes']:
            query += " AND c.is_internal_customer = 1"
        elif internal_val_lower == 'no':
            query += " AND (c.is_internal_customer = 0 OR c.is_internal_customer IS NULL)"

    # Execute query
    results = frappe.db.sql(query, params, as_dict=True)

    # Split into listed and non_listed
    listed = [row for row in results if row.classification == 'listed']
    non_listed = [row for row in results if row.classification == 'non_listed']

    # Remove classification field from output
    for row in listed + non_listed:
        row.pop('classification', None)

    return {
        "listed": listed,
        "non_listed": non_listed
    }








import frappe

@frappe.whitelist()
def get_disable_customer(customer_names=None, company=None):
    """
    API to classify customers as listed or non-listed using SQL, including credit limit (per company) and credit days.
    
    Args:
        customer_names (list, optional): List of customer names (e.g., ['Cust-001', 'Cust-002']).
        company (str, optional): The company name to fetch credit limit for (e.g., 'Your Company').
    
    Returns:
        dict: {'listed': [], 'non_listed': []}
    """
    # Validate inputs
    if customer_names and not isinstance(customer_names, list):
        frappe.throw("customer_names must be a list")
    if company and not isinstance(company, str):
        frappe.throw("company must be a string")

    query = """
        SELECT 
            c.name,
            c.customer_name,
            c.customer_type,
            c.territory,
            c.customer_group,
            COALESCE(cl.credit_limit, 0) AS credit_limit,
            cl.company,
            cl.credit_limit
        FROM 
            `tabCustomer` c
        LEFT JOIN 
            `tabCustomer Credit Limit` cl
            ON cl.parent = c.name
            AND cl.company = %(company)s
        WHERE 
            c.disabled = 1
            AND (%(customer_names)s IS NULL OR c.name IN (%(customer_names)s))
    """
    
    # Convert customer_names to tuple for SQL IN clause
    params = {
        "customer_names": tuple(customer_names) if customer_names else None,
        "company": company
    }
    
    try:
        # Execute query
        results = frappe.db.sql(query, params, as_dict=True)
        
        # Split into listed and non_listed based on customer_type (adjust logic as needed)
        listed = [row for row in results if row.customer_type == 'Company']
        non_listed = [row for row in results if row.customer_type != 'Company']
        
        return {
            "listed": listed,
            "non_listed": non_listed
        }
    except Exception as e:
        frappe.log_error(f"Error in get_disable_customer: {str(e)}")
        frappe.throw(f"Failed to fetch customer data: {str(e)}")








import frappe
from frappe import _
from frappe.utils import today, add_days, add_months, add_years, getdate, flt
from datetime import datetime
from collections import defaultdict

@frappe.whitelist(allow_guest=False)
def get_cash_flow(company=None, period="Daily", payment_mode=None, from_date=None, to_date=None):
    """
    API to fetch cash flow data in ERPNext using SQL queries.
    
    Args:
        company (str, optional): Company name or None for all.
        period (str): 'Daily', 'Weekly', 'Monthly', 'Yearly'. Default: 'Daily'.
        payment_mode (str, optional): 'Cash', 'Card', 'CDC', 'Bank Transfer' or None for all.
        from_date (str, optional): Start date YYYY-MM-DD or DD-MM-YYYY. Auto-calculated if None.
        to_date (str, optional): End date YYYY-MM-DD or DD-MM-YYYY. Defaults to today if None.
    
    Returns:
        dict: {
            'filters': {...},  # Applied filters
            'summary': {...},  # Mode-wise totals, net, % share, growth, and date
            'company_comparison': [...],  # List of company dicts
            'inflows': [...],  # List of inflow transactions
            'outflows': [...],  # List of outflow transactions
            'previous_period': {...}  # For growth comparison
        }
    """
    # Convert date strings to datetime.date objects
    if from_date:
        try:
            from_date = getdate(from_date)  # Handles DD-MM-YYYY or YYYY-MM-DD
        except Exception as e:
            frappe.throw(_("Invalid from_date format: {0}").format(str(e)))
    if to_date:
        try:
            to_date = getdate(to_date)  # Handles DD-MM-YYYY or YYYY-MM-DD
        except Exception as e:
            frappe.throw(_("Invalid to_date format: {0}").format(str(e)))
    
    # Validate and set date range
    if not from_date or not to_date:
        to_date = getdate(to_date or today())
        if period == "Daily":
            from_date = to_date
        elif period == "Weekly":
            from_date = add_days(to_date, -6)  # 7-day week including to_date
        elif period == "Monthly":
            from_date = add_months(to_date, -1)
        elif period == "Yearly":
            from_date = add_years(to_date, -1)
        else:
            frappe.throw(_("Invalid period: {0}").format(period))
    
    from_date = getdate(from_date)
    to_date = getdate(to_date)
    
    # Previous period for comparison
    prev_from_date = None
    prev_to_date = None
    if period in ["Daily", "Weekly"]:
        prev_from_date = add_days(from_date, -1)
        prev_to_date = add_days(to_date, -1)
    elif period == "Monthly":
        prev_from_date = add_months(from_date, -1)
        prev_to_date = add_months(to_date, -1)
    elif period == "Yearly":
        prev_from_date = add_years(from_date, -1)
        prev_to_date = add_years(to_date, -1)
    
    # Allowed modes mapping (adjust to your Mode of Payment DocType names)
    allowed_modes = {
        "Cash": "Cash",
        "Card": "Credit Card",
        "CDC": "Cheque",
        "Bank Transfer": "Bank Transfer"
    }
    if payment_mode and payment_mode not in allowed_modes:
        frappe.throw(_("Invalid payment mode: {0}").format(payment_mode))
    
    # Companies filter
    companies = []
    if company:
        companies = [company]
    else:
        companies = [d.name for d in frappe.get_all("Company", fields=["name"])]
    
    # Fetch inflows and outflows
    inflows = _get_inflows_sql(from_date, to_date, companies, payment_mode, allowed_modes)
    outflows = _get_outflows_sql(from_date, to_date, companies, payment_mode, allowed_modes)
    prev_inflows = _get_inflows_sql(prev_from_date, prev_to_date, companies, payment_mode, allowed_modes) if prev_from_date else []
    prev_outflows = _get_outflows_sql(prev_from_date, prev_to_date, companies, payment_mode, allowed_modes) if prev_to_date else []
    
    # Calculate summaries
    summary = _calculate_summary(inflows, outflows, from_date if period == "Daily" else None)
    prev_summary = _calculate_summary(prev_inflows, prev_outflows, prev_from_date if period == "Daily" else None)
    summary['growth'] = _calculate_growth(summary, prev_summary)
    
    # Company comparison
    company_comparison = _get_company_comparison(inflows, outflows, companies)
    
    return {
        'filters': {
            'company': company,
            'period': period,
            'payment_mode': payment_mode,
            'from_date': from_date.strftime('%Y-%m-%d') if from_date else None,
            'to_date': to_date.strftime('%Y-%m-%d') if to_date else None
        },
        'summary': summary,
        'company_comparison': company_comparison,
        'inflows': inflows,
        'outflows': outflows,
        'previous_period': {
            'from_date': prev_from_date.strftime('%Y-%m-%d') if prev_from_date else None,
            'to_date': prev_to_date.strftime('%Y-%m-%d') if prev_to_date else None,
            'summary': prev_summary
        }
    }

def _get_inflows_sql(from_date, to_date, companies, payment_mode, allowed_modes):
    """Fetch inflow transactions using SQL."""
    query = """
        SELECT
            pe.posting_date AS date,
            pe.company,
            COALESCE(pe.mode_of_payment, 'Unknown') AS mode_of_payment,
            COALESCE(pe.party_name, pe.party) AS customer_name,
            pe.reference_no AS invoice_reference,
            pe.paid_amount AS amount_received,
            CASE WHEN pe.clearance_date IS NOT NULL THEN 'Cleared' ELSE 'Pending' END AS status
        FROM
            `tabPayment Entry` pe
        WHERE
            pe.payment_type = 'Receive'
            AND pe.party_type = 'Customer'
            AND pe.docstatus = 1
            AND pe.posting_date >= %(from_date)s
            AND pe.posting_date <= %(to_date)s
    """
    params = {
        "from_date": from_date,
        "to_date": to_date
    }
    
    if companies:
        query += " AND pe.company IN %(companies)s"
        params["companies"] = tuple(companies)
    
    if payment_mode:
        query += " AND pe.mode_of_payment = %(mode_of_payment)s"
        params["mode_of_payment"] = allowed_modes[payment_mode]
    
    query += " ORDER BY pe.posting_date ASC"
    
    return frappe.db.sql(query, params, as_dict=True)

def _get_outflows_sql(from_date, to_date, companies, payment_mode, allowed_modes):
    """Fetch outflow transactions using SQL."""
    query = """
        SELECT
            pe.posting_date AS date,
            pe.company,
            COALESCE(pe.mode_of_payment, 'Unknown') AS mode_of_payment,
            COALESCE(pe.party_name, pe.party) AS vendor_name,
            '' AS expense_category,  -- Placeholder: Map via reference_no if needed
            pe.paid_amount AS amount_paid,
            CASE WHEN pe.clearance_date IS NOT NULL THEN 'Cleared' ELSE 'Pending' END AS status
        FROM
            `tabPayment Entry` pe
        WHERE
            pe.payment_type = 'Pay'
            AND pe.party_type = 'Supplier'
            AND pe.docstatus = 1
            AND pe.posting_date >= %(from_date)s
            AND pe.posting_date <= %(to_date)s
    """
    params = {
        "from_date": from_date,
        "to_date": to_date
    }
    
    if companies:
        query += " AND pe.company IN %(companies)s"
        params["companies"] = tuple(companies)
    
    if payment_mode:
        query += " AND pe.mode_of_payment = %(mode_of_payment)s"
        params["mode_of_payment"] = allowed_modes[payment_mode]
    
    query += " ORDER BY pe.posting_date ASC"
    
    return frappe.db.sql(query, params, as_dict=True)

def _calculate_summary(inflows, outflows, specific_date=None):
    """Calculate mode-wise summary, including specific date if provided."""
    inflow_by_mode = defaultdict(float)
    outflow_by_mode = defaultdict(float)
    total_inflow = 0
    total_outflow = 0
    
    for inflow in inflows:
        mode = inflow['mode_of_payment']
        amount = flt(inflow['amount_received'])
        inflow_by_mode[mode] += amount
        total_inflow += amount
    
    for outflow in outflows:
        mode = outflow['mode_of_payment']
        amount = flt(outflow['amount_paid'])
        outflow_by_mode[mode] += amount
        total_outflow += amount
    
    modes = list(set(list(inflow_by_mode.keys()) + list(outflow_by_mode.keys())))
    if not modes:
        modes = list({"Cash", "Credit Card", "Cheque", "Bank Transfer", "Unknown"})
    
    summary_data = []
    for mode in modes:
        inflow_amt = inflow_by_mode[mode]
        outflow_amt = outflow_by_mode[mode]
        net = inflow_amt - outflow_amt
        inflow_pct = (inflow_amt / total_inflow * 100) if total_inflow else 0
        outflow_pct = (outflow_amt / total_outflow * 100) if total_outflow else 0
        
        summary_data.append({
            "mode": mode,
            "inflow": inflow_amt,
            "outflow": outflow_amt,
            "net_flow": net,
            "inflow_share_pct": round(inflow_pct, 2),
            "outflow_share_pct": round(outflow_pct, 2)
        })
    
    summary = {
        "mode_summary": summary_data,
        "total_inflow": total_inflow,
        "total_outflow": total_outflow,
        "net_cash_flow": total_inflow - total_outflow
    }
    
    if specific_date:
        summary["date"] = specific_date.strftime('%Y-%m-%d')
    
    return summary

def _calculate_growth(current_summary, prev_summary):
    """Calculate % growth vs previous period."""
    curr_total_in = current_summary['total_inflow']
    prev_total_in = prev_summary['total_inflow']
    inflow_growth = ((curr_total_in - prev_total_in) / prev_total_in * 100) if prev_total_in else 0
    
    curr_total_out = current_summary['total_outflow']
    prev_total_out = prev_summary['total_outflow']
    outflow_growth = ((curr_total_out - prev_total_out) / prev_total_out * 100) if prev_total_out else 0
    
    net_growth = ((current_summary['net_cash_flow'] - prev_summary['net_cash_flow']) / abs(prev_summary['net_cash_flow']) * 100) if prev_summary['net_cash_flow'] else 0
    
    mode_growth = {}
    for item in current_summary['mode_summary']:
        mode = item['mode']
        prev_item = next((p for p in prev_summary['mode_summary'] if p['mode'] == mode), None)
        if prev_item:
            inflow_g = ((item['inflow'] - prev_item['inflow']) / prev_item['inflow'] * 100) if prev_item['inflow'] else 0
            mode_growth[mode] = {'inflow_growth': round(inflow_g, 2)}
    
    return {
        "total_inflow_growth_pct": round(inflow_growth, 2),
        "total_outflow_growth_pct": round(outflow_growth, 2),
        "net_growth_pct": round(net_growth, 2),
        "mode_growth": mode_growth
    }

def _get_company_comparison(inflows, outflows, companies):
    """Company-wise comparison."""
    inflow_by_company = defaultdict(float)
    outflow_by_company = defaultdict(float)
    
    for inflow in inflows:
        inflow_by_company[inflow['company']] += flt(inflow['amount_received'])
    for outflow in outflows:
        outflow_by_company[outflow['company']] += flt(outflow['amount_paid'])
    
    total_inflow = sum(inflow_by_company.values())
    total_outflow = sum(outflow_by_company.values())
    
    comparison = []
    for comp in companies:
        in_amt = inflow_by_company[comp]
        out_amt = outflow_by_company[comp]
        net = in_amt - out_amt
        in_contrib = (in_amt / total_inflow * 100) if total_inflow else 0
        
        comparison.append({
            "company": comp,
            "inflow": in_amt,
            "outflow": out_amt,
            "net_flow": net,
            "contribution_pct": round(in_contrib, 2)
        })
    
    return comparison






import frappe
from frappe import _
from frappe.utils import getdate

@frappe.whitelist(allow_guest=False)
def get_cash_flow1(
    company,
    from_date,
    to_date,
    cost_center=None,
    account=None,
    mode_of_payment=None,
    branch=None
):
    """
    Fetch detailed cash flow (inflows/outflows) with filters for company, period, cost center, account, mode of payment, and branch.
    Returns total inflows, outflows, and transaction details.
    """
    # Validate mandatory filters
    if not company or not from_date or not to_date:
        frappe.throw(_("Company, From Date, and To Date are mandatory."))
    
    try:
        getdate(from_date)
        getdate(to_date)
    except ValueError:
        frappe.throw(_("Invalid date format. Use YYYY-MM-DD."))

    # Initialize response
    response = {
        "total_inflows": 0.0,
        "total_outflows": 0.0,
        "transactions": []
    }

    # Build GL Entry filters for cash/bank accounts
    gl_filters = [
        ["company", "=", company],
        ["posting_date", ">=", from_date],
        ["posting_date", "<=", to_date],
        ["account", "in", frappe.db.sql_list("""
            SELECT name FROM `tabAccount`
            WHERE account_type IN ('Cash', 'Bank')
            AND company = %s
        """, company)]
    ]

    # Optional filters
    if cost_center:
        gl_filters.append(["cost_center", "=", cost_center])
    if account:
        gl_filters.append(["account", "=", account])
    if branch and frappe.db.exists("Custom Field", {"dt": "GL Entry", "fieldname": "branch"}):
        gl_filters.append(["branch", "=", branch])

    # Fetch GL Entries for cash flow
    gl_entries = frappe.get_all(
        "GL Entry",
        fields=[
            "name", "posting_date", "account", "debit", "credit",
            "voucher_type", "voucher_no", "party_type", "party",
            "cost_center", "remarks"
        ],
        filters=gl_filters,
        order_by="posting_date asc"
    )

    # Fetch linked Payment Entries for mode of payment
    payment_modes = {}
    if gl_entries:
        voucher_nos = [entry["voucher_no"] for entry in gl_entries if entry["voucher_type"] == "Payment Entry"]
        if voucher_nos:
            payment_entries = frappe.get_all(
                "Payment Entry",
                fields=["name", "mode_of_payment", "payment_type", "paid_amount", "received_amount"],
                filters=[["name", "in", voucher_nos]]
            )
            payment_modes = {pe["name"]: pe for pe in payment_entries}

    # Process transactions and calculate totals
    for entry in gl_entries:
        # Filter by mode of payment (if specified)
        if mode_of_payment and entry["voucher_type"] == "Payment Entry":
            payment = payment_modes.get(entry["voucher_no"], {})
            if payment.get("mode_of_payment") != mode_of_payment:
                continue

        # Calculate totals
        response["total_inflows"] += entry["credit"]
        response["total_outflows"] += entry["debit"]

        # Add transaction details
        transaction = {
            "transaction_id": entry["name"],
            "date": entry["posting_date"],
            "account": entry["account"],
            "inflow": entry["credit"],
            "outflow": entry["debit"],
            "voucher_type": entry["voucher_type"],
            "voucher_no": entry["voucher_no"],
            "party_type": entry["party_type"],
            "party": entry["party"],
            "cost_center": entry["cost_center"],
            "mode_of_payment": payment_modes.get(entry["voucher_no"], {}).get("mode_of_payment", ""),
            "remarks": entry["remarks"]
        }
        response["transactions"].append(transaction)

    # Round totals
    response["total_inflows"] = round(response["total_inflows"], 2)
    response["total_outflows"] = round(response["total_outflows"], 2)

    return response



import frappe
from collections import defaultdict
from frappe.utils import getdate, nowdate

@frappe.whitelist()
def get_sales_order_status(sales_order_names=None, company=None, sales_person=None, sales_team=None, internal_customer=None):
    """
    API to fetch a sales order, its payment schedules, and determine if it is paid, overdue, or due.

    - 'Paid': If outstanding == 0 (grand_total - advance_paid == 0).
    - 'Overdue': If outstanding > 0 and any payment schedule due_date < current date.
    - 'Due': If outstanding > 0 and no overdue payment schedules.

    Args:
        sales_order_names (str, optional): Single sales order name (e.g., 'SO--00084').
        company (str, optional): Filter by company name (e.g., 'LED WORLD LLC').
        sales_person (str, optional): Filter by sales person from Sales Team child table.
        sales_team (str, optional): Filter by sales team (parent_sales_person) from Sales Team child table.
        internal_customer (bool, optional): Filter by is_internal_customer field.

    Returns:
        list: List of dicts with sales order details, payment_schedule (list), outstanding, and computed_status.
    """
    # Validate sales_order_names is a string
    if sales_order_names and not isinstance(sales_order_names, str):
        frappe.throw("sales_order_names must be a single string (e.g., 'SO--00084')")

    # Base query for sales orders
    query = """
        SELECT
            so.name,
            so.customer,
            so.customer_name,
            so.transaction_date,
            so.delivery_date,
            so.grand_total,
            so.advance_paid,
            so.company,
            so.status AS erpnext_status
        FROM
            `tabSales Order` so
        WHERE
            so.docstatus = 1
            AND so.status NOT IN ('Completed', 'Closed', 'Cancelled')
    """

    # Parameters for positional placeholders
    values = []
    conditions = []

    # Add company filter if provided
    if company:
        conditions.append("so.company = %s")
        values.append(company)

    # Add sales_order_names filter if provided
    if sales_order_names:
        conditions.append("so.name = %s")
        values.append(sales_order_names)

    # Add sales person/team filters by joining with Sales Team child table
    if sales_person or sales_team:
        query = """
            SELECT
                so.name,
                so.customer,
                so.customer_name,
                so.transaction_date,
                so.delivery_date,
                so.grand_total,
                so.advance_paid,
                so.company,
                so.status AS erpnext_status
            FROM
                `tabSales Order` so
            INNER JOIN
                `tabSales Team` st ON st.parent = so.name AND st.parenttype = 'Sales Order'
            WHERE
                so.docstatus = 1
                AND so.status NOT IN ('Completed', 'Closed', 'Cancelled')
        """

        if sales_person:
            conditions.append("st.sales_person = %s")
            values.append(sales_person)

        if sales_team:
            conditions.append("st.parent_sales_person = %s")
            values.append(sales_team)

    # Add internal customer filter if provided
    if internal_customer:
        internal_val_lower = str(internal_customer).lower()
        if internal_val_lower in ['1', 'true', 'yes']:
            conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = so.customer AND c.is_internal_customer = 1)")
        elif internal_val_lower == 'no':
            conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = so.customer AND c.is_internal_customer = 1)")

    # Append conditions to query
    if conditions:
        query += " AND " + " AND ".join(conditions)

    try:
        # Execute query for sales orders
        sales_orders = frappe.db.sql(query, tuple(values), as_dict=True)
    except Exception as e:
        frappe.log_error(f"SQL Error in get_sales_order_status: {str(e)}", "Sales Order Status API")
        frappe.throw(f"Error executing query: {str(e)}")

    if not sales_orders:
        return []

    # Get all relevant sales order names
    so_names = [so['name'] for so in sales_orders]

    # Query for payment schedules
    ps_query = """
        SELECT 
            parent,
            due_date,
            payment_amount,
            base_payment_amount,
            invoice_portion,
            description,
            mode_of_payment
        FROM 
            `tabPayment Schedule`
        WHERE 
            parenttype = 'Sales Order'
            AND parent IN %s
        ORDER BY parent, due_date
    """

    try:
        payment_schedules = frappe.db.sql(ps_query, (tuple(so_names),), as_dict=True)
    except Exception as e:
        frappe.log_error(f"SQL Error in payment schedule query: {str(e)}", "Sales Order Status API")
        frappe.throw(f"Error fetching payment schedules: {str(e)}")

    # Group payment schedules by parent and convert due_date to datetime.date
    ps_grouped = defaultdict(list)
    for ps in payment_schedules:
        due_date = getdate(ps['due_date']) if ps['due_date'] else None
        ps_grouped[ps['parent']].append({
            'due_date': due_date,
            'payment_amount': ps['payment_amount'],
            'base_payment_amount': ps['base_payment_amount'],
            'invoice_portion': ps['invoice_portion'],
            'description': ps['description'],
            'mode_of_payment': ps['mode_of_payment']
        })

    # Compute status for each sales order
    today = getdate(nowdate())
    for so in sales_orders:
        so['outstanding'] = so['grand_total'] - (so['advance_paid'] or 0)
        so['payment_schedule'] = ps_grouped.get(so['name'], [])
        
        has_overdue = any(ps['due_date'] < today for ps in so['payment_schedule'] if ps['due_date'])
        
        if so['outstanding'] == 0:
            so['computed_status'] = 'Paid'
        elif has_overdue:
            so['computed_status'] = 'Overdue'
        else:
            so['computed_status'] = 'Due'

    return sales_orders






import frappe
from frappe import _

@frappe.whitelist()  # Remove allow_guest=True for authenticated access only
def get_filtered_items(item_code=None, brand=None, category=None):
    """
    API to fetch items from Item doctype with their prices from Item Price doctype.
    Filters items by item_code, brand, and category, and fetches price_list_rate for RRP, MRP, and Promo price lists.
    
    Args:
        item_code (str): Partial or full item code to filter items.
        brand (str): Partial or full brand name to filter items.
        category (str): Category to filter items (assumed to be item_group).
    
    Returns:
        JSON response with list of items and their prices.
    """
    try:
        # Base SQL query with LEFT JOIN to fetch prices for RRP, MRP, and Promo
        query = """
            SELECT 
                i.item_code, 
                i.item_name, 
                i.brand, 
                i.category_list,
                i.item_group, 
                i.stock_uom, 
                i.short_descrition
            FROM `tabItem` i
            WHERE i.disabled = 0 AND i.is_stock_item = 1 AND i.brand = 'DESROCH'
        """
        
        # Initialize conditions and parameters
        conditions = []
        params = {}

        # Add filter for item_code (LIKE search)
        if item_code:
            conditions.append("i.item_code LIKE %(item_code)s")
            params['item_code'] = f'%{item_code}%'

        # Add filter for brand (LIKE search)
        if brand:
            conditions.append("i.brand LIKE %(brand)s")
            params['brand'] = f'%{brand}%'

        # Add filter for category (exact match, assuming item_group)
        if category:
            conditions.append("i.item_group = %(category)s")
            params['category'] = category

        # Append conditions to query if any
        if conditions:
            query += " AND " + " AND ".join(conditions)

        # Group by item fields to avoid duplicate rows and add sorting
        query += """
            GROUP BY i.item_code, i.item_name, i.brand, i.item_group, i.stock_uom, i.description
            ORDER BY i.item_code ASC
        """

        # Execute the SQL query
        items = frappe.db.sql(query, params, as_dict=True)

        # Return response
        return {
            'status': 'success',
            'data': items,
            'message': f'Found {len(items)} items'
        }

    except Exception as e:
        # Log error and return failure response
        frappe.log_error(f"Error in get_filtered_items: {str(e)}")
        return {
            'status': 'error',
            'data': [],
            'message': f'Error fetching items: {str(e)}'
        }
   




# Copyright (c) 2015, Frappe Technologies Pvt. Ltd.
# License: GNU General Public License v3. See license.txt

from collections import defaultdict

import frappe
from frappe import _
from frappe.utils import add_days, get_first_day, get_last_day, getdate, nowdate

@frappe.whitelist(allow_guest=False)
def get_customer_outstandings1(
    company,
    report_date=None,
    customer=None,
    branch=None,
    sales_person=None,
    sales_team=None,
    include_sales_person=False,
    finance_book=None,
    cost_center=None,
    customer_group=None,
    territory=None,
    custom_parent_customer=None,
    payment_terms_template=None,
    sales_partner=None,
    party_account=None
):
    if not company:
        frappe.throw(_("Company is required"))

    # Validate customer if provided
    if customer and not frappe.db.exists("Customer", customer):
        frappe.throw(_("Invalid Customer: {0}").format(customer))

    filters = frappe._dict({
        "company": company,
        "report_date": getdate(report_date or nowdate()),
        "party_type": "Customer",
        "group_by_party": 0,
        "show_future_payments": 0,
        "based_on_payment_terms": 0,
        "account_type": "Receivable",
        "range1": 30,
        "range2": 60,
        "range3": 90,
        "range4": 120,
    })

    # Add all possible filters
    if customer:
        filters.customer = customer
    if branch:
        filters.branch = branch
    if sales_person:
        filters.sales_person = sales_person
    elif sales_team:
        filters.sales_person = sales_team
    if finance_book:
        filters.finance_book = finance_book
    if cost_center:
        filters.cost_center = cost_center
    if customer_group:
        filters.customer_group = customer_group
    if territory:
        filters.territory = territory
    if custom_parent_customer:
        filters.custom_parent_customer = custom_parent_customer
    if payment_terms_template:
        filters.payment_terms_template = payment_terms_template
    if sales_partner:
        filters.sales_partner = sales_partner
    if party_account:
        filters.party_account = party_account

    # Log filter summary
    filter_summary = (
        f"company: {company}, customer: {customer}, branch: {branch}, sales_person: {sales_person}, "
        f"sales_team: {sales_team}, finance_book: {finance_book}, cost_center: {cost_center}, "
        f"customer_group: {customer_group}, territory: {territory}, custom_parent_customer: {custom_parent_customer}, "
        f"payment_terms_template: {payment_terms_template}, sales_partner: {sales_partner}, party_account: {party_account}"
    )
    frappe.log_error(message=filter_summary, title="Filters Applied")

    # Pass required args to run
    args = {
        "party_type": "Customer",
        "naming_by": ["Selling Settings", "cust_master_name"],
    }

    report = ReceivablePayableReport(filters)
    columns, data, message, chart, report_summary, skip_total_row = report.run(args)

    # Log number of rows
    frappe.log_error(message=f"Rows returned: {len(data)}", title="Row Count")

    customer_groups = defaultdict(lambda: {
        "customer_name": "",
        "custom_parent_customer": "",
        "credit_limit": 0.0,
        "invoices": [],
        "has_outstanding": False
    })

    # Compute due dates based on current date
    today = getdate(nowdate())
    yesterday = add_days(today, -1)
    month_start = get_first_day(today)
    month_end = get_last_day(today)

    # Initialize totals
    due_today = 0.0
    due_yesterday = 0.0
    due_this_month = 0.0
    total_invoiced = 0.0
    total_paid = 0.0
    total_credit_note = 0.0
    total_outstanding = 0.0
    total_range1 = 0.0
    total_range2 = 0.0
    total_range3 = 0.0
    total_range4 = 0.0
    total_range5 = 0.0
    total_future_amount = 0.0
    total_remaining_balance = 0.0

    # Debug logging for invoiced, paid, and credit_note amounts
    invoiced_rows = []
    paid_rows = []
    credit_note_rows = []

    for row in data:
        if not isinstance(row, dict) or not row.get("party"):
            continue
        if customer and row.get("party") != customer:
            continue

        party = row["party"]
        group = customer_groups[party]

        if not group["customer_name"]:
            group["customer_name"] = row.get("customer_name", "")
            group["custom_parent_customer"] = row.get("custom_parent_customer", "")
            group["credit_limit"] = frappe.db.get_value(
                "Customer Credit Limit",
                {"parent": party, "parenttype": "Customer", "company": company},
                "credit_limit"
            ) or 0.0
            if not group["credit_limit"]:
                frappe.log_error(
                    message=f"Customer: {party}, Company: {company}",
                    title="No Credit Limit"
                )

        # Fetch sales team data only if include_sales_person is True
        sales_team_data = []
        sales_person_val = None
        sales_team_val = None

        if include_sales_person:
            voucher_no = row.get("voucher_no")
            voucher_type = row.get("voucher_type")
            if voucher_no and voucher_type:
                if voucher_type == "Sales Invoice":
                    sales_team_data = frappe.db.sql("""
                        SELECT
                            sales_person,
                            parent_sales_person,
                            allocated_percentage
                        FROM `tabSales Team`
                        WHERE parent = %s
                            AND parenttype = 'Sales Invoice'
                        ORDER BY allocated_percentage DESC
                    """, (voucher_no,), as_dict=True)
                    if sales_team_data:
                        sales_person_val = sales_team_data[0].get('sales_person')
                        sales_team_val = sales_team_data[0].get('parent_sales_person')
                else:
                    try:
                        doc = frappe.get_doc(voucher_type, voucher_no)
                        if hasattr(doc, 'sales_person'):
                            sales_person_val = doc.sales_person
                        if sales_person_val:
                            parent_sp = frappe.db.get_value('Sales Person', sales_person_val, 'parent_sales_person')
                            if parent_sp:
                                sales_team_val = parent_sp
                    except Exception as e:
                        frappe.log_error(
                            message=f"Error fetching sales person for {voucher_type} {voucher_no}: {str(e)}",
                            title="Sales Person Error"
                        )

        invoice_details = {
            "voucher_no": row.get("voucher_no"),
            "voucher_type": row.get("voucher_type"),
            "posting_date": row.get("posting_date"),
            "due_date": row.get("due_date"),
            "branch": row.get("branch", ""),
            "invoiced": row.get("invoiced", 0.0),
            "paid": row.get("paid", 0.0),
            "credit_note": row.get("credit_note", 0.0),
            "outstanding": row.get("outstanding", 0.0),
            "age": row.get("age", 0),
            "range1": row.get("range1", 0.0),
            "range2": row.get("range2", 0.0),
            "range3": row.get("range3", 0.0),
            "range4": row.get("range4", 0.0),
            "range5": row.get("range5", 0.0),
            "future_amount": row.get("future_amount", 0.0),
            "remaining_balance": row.get("remaining_balance", 0.0),
        }

        if include_sales_person:
            invoice_details["sales_person"] = sales_person_val
            invoice_details["sales_team"] = sales_team_val
            invoice_details["sales_team_data"] = sales_team_data

        group["invoices"].append(invoice_details)

        if invoice_details["outstanding"] != 0:
            group["has_outstanding"] = True

        # Accumulate totals
        invoiced_amount = row.get("invoiced", 0.0)
        total_invoiced += invoiced_amount
        paid_amount = row.get("paid", 0.0)
        total_paid += paid_amount
        credit_note_amount = row.get("credit_note", 0.0)
        total_credit_note += credit_note_amount
        total_outstanding += row.get("outstanding", 0.0)
        total_range1 += row.get("range1", 0.0)
        total_range2 += row.get("range2", 0.0)
        total_range3 += row.get("range3", 0.0)
        total_range4 += row.get("range4", 0.0)
        total_range5 += row.get("range5", 0.0)
        total_future_amount += row.get("future_amount", 0.0)
        total_remaining_balance += row.get("remaining_balance", 0.0)

        # Log invoiced, paid, and credit_note amounts for debugging
        if invoiced_amount != 0:
            invoiced_rows.append({
                "voucher_no": row.get("voucher_no"),
                "voucher_type": row.get("voucher_type"),
                "party": row.get("party"),
                "invoiced": invoiced_amount,
                "branch": row.get("branch", ""),
                "sales_person": sales_person_val,
                "sales_team": sales_team_val
            })
        if paid_amount != 0:
            paid_rows.append({
                "voucher_no": row.get("voucher_no"),
                "voucher_type": row.get("voucher_type"),
                "party": row.get("party"),
                "paid": paid_amount,
                "branch": row.get("branch", ""),
                "sales_person": sales_person_val,
                "sales_team": sales_team_val
            })
        if credit_note_amount != 0:
            credit_note_rows.append({
                "voucher_no": row.get("voucher_no"),
                "voucher_type": row.get("voucher_type"),
                "party": row.get("party"),
                "credit_note": credit_note_amount
            })

        if row.get("due_date") and row.get("outstanding", 0) != 0:
            due_date = getdate(row["due_date"])
            outstanding_amt = row.get("outstanding", 0.0)
            if due_date == today:
                due_today += outstanding_amt
            if due_date == yesterday:
                due_yesterday += outstanding_amt
            if month_start <= due_date <= month_end:
                due_this_month += outstanding_amt

    # Log invoiced, paid, and credit_note rows
    frappe.log_error(
        message=f"Invoiced rows (limited): {invoiced_rows[:50]}",
        title="Invoiced Rows"
    )
    frappe.log_error(
        message=f"Paid rows (limited): {paid_rows[:50]}",
        title="Paid Rows"
    )
    frappe.log_error(
        message=f"Credit note rows (limited): {credit_note_rows[:50]}",
        title="Credit Note Rows"
    )
    frappe.log_error(
        message=f"Total invoiced: {total_invoiced}, Total paid: {total_paid}, Total credit note: {total_credit_note}",
        title="Total Invoiced, Paid, and Credit Note"
    )

    outstandings = []
    for party, group in customer_groups.items():
        if customer and party != customer:
            continue
        if group["has_outstanding"] or customer:
            outstanding = {
                "customer": party,
                "customer_name": group["customer_name"],
                "parent_customer": group["custom_parent_customer"],
                "company": company,
                "credit_limit": group["credit_limit"],
                "invoices": group["invoices"],
            }
            outstandings.append(outstanding)

    return {
        "data": outstandings,
        "due_today": due_today,
        "due_yesterday": due_yesterday,
        "due_this_month": due_this_month,
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_credit_note": total_credit_note,
        "total_outstanding": total_outstanding,
        "total_range1": total_range1,
        "total_range2": total_range2,
        "total_range3": total_range3,
        "total_range4": total_range4,
        "total_range5": total_range5,
        "total_future_amount": total_future_amount,
        "total_remaining_balance": total_remaining_balance
    }


# @frappe.whitelist()
# def get_customer_outstandings_new(filters=None, customer=None, sales_person=None, sales_team=None, branch=None, group_by_customer=True):
#     from erpnext.accounts.report.accounts_receivable.accounts_receivable import execute, ReceivablePayableReport
#     from collections import defaultdict
#     from frappe.utils import flt

#     # Monkey patch ReceivablePayableReport to handle missing fields
#     original_init = ReceivablePayableReport.__init__
#     def patched_init(self, filters=None):
#         original_init(self, filters)
#         # Ensure account_type is set (needed for patched_get_return_entries)
#         self.account_type = (filters or {}).get("account_type", "Receivable")
#         # Handle missing receivable_payable_fetch_method field
#         try:
#             self.ple_fetch_method = (
#                 frappe.db.get_single_value("Accounts Settings", "receivable_payable_fetch_method")
#                 or "Buffered Cursor"
#             )
#         except Exception:
#             self.ple_fetch_method = "Buffered Cursor"

#     original_get_return_entries = ReceivablePayableReport.get_return_entries
#     def patched_get_return_entries(self):
#         # Check if update_outstanding_for_self field exists
#         doctype = "Sales Invoice" if self.account_type == "Receivable" else "Purchase Invoice"
#         try:
#             meta = frappe.get_meta(doctype)
#             has_field = 'update_outstanding_for_self' in [f.fieldname for f in meta.fields]
#         except Exception:
#             has_field = False

#         if not has_field:
#             # Field doesn't exist, use original logic without this filter
#             filters = {
#                 "is_return": 1,
#                 "docstatus": 1,
#                 "company": self.filters.company,
#             }
#             or_filters = {}
#             for party_type in self.party_type:
#                 from frappe.utils.data import scrub
#                 party_field = scrub(party_type)
#                 if self.filters.get(party_field):
#                     or_filters.update({party_field: self.filters.get(party_field)})
#             self.return_entries = frappe._dict(
#                 frappe.get_all(
#                     doctype, filters=filters, or_filters=or_filters, fields=["name", "return_against"], as_list=1
#                 )
#             )
#         else:
#             # Field exists, use original method
#             original_get_return_entries(self)

#     # Apply patches
#     ReceivablePayableReport.__init__ = patched_init
#     ReceivablePayableReport.get_return_entries = patched_get_return_entries

#     # Parse filters
#     if isinstance(filters, str):
#         filters = frappe.parse_json(filters)
#     filters = filters or {}

#     # Set default values
#     if not filters.get("company"):
#         filters["company"] = frappe.db.get_single_value("Global Defaults", "default_company")
#     if not filters.get("report_date"):
#         filters["report_date"] = frappe.utils.today()
#     if not filters.get("ageing_based_on"):
#         filters["ageing_based_on"] = "Due Date"
#     filters.setdefault("range1", 30)
#     filters.setdefault("range2", 60)
#     filters.setdefault("range3", 90)
#     filters.setdefault("range4", 120)
#     # IMPORTANT: Use group_by_party=False to get ALL transaction details
#     # group_by_party=True returns customer summaries which can be incomplete
#     filters["group_by_party"] = False

#     # Handle customer filter
#     if customer:
#         filters["party"] = [customer]
#     elif filters.get("customer"):
#         if isinstance(filters["customer"], str):
#             filters["party"] = [filters["customer"]]
#         else:
#             filters["party"] = filters["customer"]

#     filter_sales_person = sales_person or filters.get("sales_person")
#     filter_sales_team = sales_team or filters.get("sales_team")
#     filter_branch = branch or filters.get("branch")

#     # Execute the report
#     try:
#         columns, data, message, chart, report_summary, skip_total_row = execute(filters)
#     except Exception as e:
#         frappe.log_error(frappe.get_traceback(), "get_customer_outstandings_new Error")
#         frappe.throw(_("Error fetching customer outstandings: {0}").format(str(e)))

#     totals = {
#         "invoiced": 0.0, "paid": 0.0, "credit_note": 0.0, "outstanding": 0.0,
#         "range1": 0.0, "range2": 0.0, "range3": 0.0, "range4": 0.0, "range5": 0.0,
#         "future_amount": 0.0, "remaining_balance": 0.0
#     }
#     total_row_found = False
#     total_row_values = {}  # Store Total row for comparison only

#     customer_data = defaultdict(lambda: {
#         "customer": "", "customer_name": "", "territory": "", "customer_group": "",
#         "credit_limit": 0.0, "sales_persons": set(), "sales_teams": set(),
#         "invoices": [], "totals": totals.copy()
#     })

#     sales_invoices = set(row.get("voucher_no") for row in data if isinstance(row, dict) and row.get("voucher_type") == "Sales Invoice" and row.get("voucher_no"))

#     # Fetch sales team and branch data
#     sales_team_map = {}
#     if sales_invoices:
#         sales_team_data = frappe.db.sql("""
#             SELECT parent, sales_person, parent_sales_person, allocated_percentage
#             FROM `tabSales Team`
#             WHERE parent IN %(invoices)s AND parenttype = 'Sales Invoice'
#             ORDER BY parent, allocated_percentage DESC
#         """, {"invoices": tuple(sales_invoices)}, as_dict=True)
#         for st in sales_team_data:
#             sales_team_map.setdefault(st.parent, []).append(st)

#     branch_map = {}
#     invoice_totals = {}
#     if sales_invoices:
#         si_data = frappe.db.sql("""
#             SELECT name, branch, grand_total
#             FROM `tabSales Invoice`
#             WHERE name IN %(vouchers)s
#         """, {"vouchers": tuple(sales_invoices)}, as_dict=True)
#         branch_map = {si.name: si.branch for si in si_data}
#         invoice_totals = {si.name: flt(si.grand_total, 2) for si in si_data}

#     detail_rows = []
#     skipped_rows = []
#     skipped_rows_with_amounts = []

#     for row in data:
#         # Track rows that are skipped
#         if not row:
#             continue

#         if isinstance(row, dict) and not row.get("party"):
#             # This row has no party - might have amounts that should be included
#             if row.get("invoiced") or row.get("outstanding"):
#                 skipped_rows_with_amounts.append({
#                     "reason": "No party",
#                     "invoiced": row.get("invoiced", 0),
#                     "outstanding": row.get("outstanding", 0),
#                     "voucher_type": row.get("voucher_type"),
#                     "voucher_no": row.get("voucher_no")
#                 })
#             continue

#         if isinstance(row, dict) and row.get("bold") and row.get("party") == "Total":
#             # Store Total row for logging/comparison, but don't use it for calculations
#             for field in totals.keys():
#                 if field in row and row[field]:
#                     total_row_values[field] = flt(row[field], 2)
#             total_row_found = True
#             log_message = (
#                 f"Found Total row for company={filters.get('company')}:\n"
#                 f"invoiced={row.get('invoiced', 0)}\n"
#                 f"outstanding={row.get('outstanding', 0)}\n"
#                 f"paid={row.get('paid', 0)}\n"
#                 f"credit_note={row.get('credit_note', 0)}\n"
#                 f"range1={row.get('range1', 0)}\n"
#                 f"range2={row.get('range2', 0)}\n"
#                 f"range3={row.get('range3', 0)}\n"
#                 f"range4={row.get('range4', 0)}\n"
#                 f"range5={row.get('range5', 0)}\n"
#                 f"NOTE: Total row stored but NOT used for calculations"
#             )
#             frappe.log_error(title="AR Total Row Debug", message=log_message)
#             continue

#         if isinstance(row, dict):
#             if customer and row.get("party") != customer:
#                 skipped_rows.append({"reason": "Customer filter", "party": row.get("party")})
#                 continue

#             voucher_no = row.get("voucher_no")
#             row["branch"] = branch_map.get(voucher_no) if voucher_no else None

#             if row.get("voucher_type") == "Sales Invoice" and voucher_no:
#                 sales_team_list = sales_team_map.get(voucher_no, [])
#                 if sales_team_list:
#                     primary_sp = sales_team_list[0]
#                     row["sales_person"] = primary_sp.get("sales_person")
#                     row["sales_team"] = primary_sp.get("parent_sales_person")
#                     row["sales_team_members"] = sales_team_list
#                 else:
#                     row["sales_person"] = None
#                     row["sales_team"] = None
#                     row["sales_team_members"] = []

#             if filter_sales_person:
#                 if row.get("voucher_type") == "Sales Invoice":
#                     sales_team_list = row.get("sales_team_members", [])
#                     has_sales_person = (
#                         row.get("sales_person") == filter_sales_person or
#                         any(member.get("sales_person") == filter_sales_person for member in sales_team_list)
#                     )
#                     if not has_sales_person:
#                         continue
#                 else:
#                     continue

#             if filter_sales_team:
#                 if row.get("voucher_type") == "Sales Invoice":
#                     sales_team_list = row.get("sales_team_members", [])
#                     has_sales_team = (
#                         row.get("sales_team") == filter_sales_team or
#                         any(member.get("parent_sales_person") == filter_sales_team for member in sales_team_list)
#                     )
#                     if not has_sales_team:
#                         continue
#                 else:
#                     continue

#             if filter_branch:
#                 if row.get("voucher_type") == "Sales Invoice":
#                     if row.get("branch") != filter_branch:
#                         continue
#                 else:
#                     continue

#             detail_rows.append(row)

#             if group_by_customer and row.get("party"):
#                 customer_id = row.get("party")
#                 cust_group = customer_data[customer_id]
#                 if not cust_group["customer"]:
#                     cust_group["customer"] = customer_id
#                     cust_group["customer_name"] = row.get("customer_name", "")
#                     cust_group["territory"] = row.get("territory", "")
#                     cust_group["customer_group"] = row.get("customer_group", "")
#                     cust_group["credit_limit"] = frappe.db.get_value(
#                         "Customer Credit Limit",
#                         {"parent": customer_id, "parenttype": "Customer", "company": filters.get("company")},
#                         "credit_limit"
#                     ) or 0.0

#                 if row.get("sales_person"):
#                     cust_group["sales_persons"].add(row.get("sales_person"))
#                 if row.get("sales_team"):
#                     cust_group["sales_teams"].add(row.get("sales_team"))

#                 cust_group["invoices"].append(row)
#                 for field in totals.keys():
#                     if field in row and row[field]:
#                         cust_group["totals"][field] += flt(row[field], 2)

#     # Calculate totals from the appropriate row level to match AR report exactly
#     # The AR report may return BOTH customer-level summary rows AND voucher-level detail rows
#     # We should sum ONLY the customer summaries to avoid double-counting

#     totals = {
#         "invoiced": 0.0, "paid": 0.0, "credit_note": 0.0, "outstanding": 0.0,
#         "range1": 0.0, "range2": 0.0, "range3": 0.0, "range4": 0.0, "range5": 0.0,
#         "future_amount": 0.0, "remaining_balance": 0.0
#     }

#     customer_level_rows = []
#     voucher_level_rows = []

#     for row in detail_rows:
#         voucher_type = row.get("voucher_type")
#         voucher_no = row.get("voucher_no")

#         # Check if this is a customer-level summary row (no voucher details)
#         if not voucher_type or not voucher_no:
#             customer_level_rows.append(row)
#         else:
#             voucher_level_rows.append(row)

#     # Decide which rows to sum based on what's available
#     # IMPORTANT: The customer-level summaries can be incomplete/incorrect
#     # So prefer voucher-level details if available (sum from unique vouchers to avoid double-counting)
#     # Otherwise fall back to customer summaries

#     if voucher_level_rows:
#         # Sum from unique vouchers to avoid double-counting if same invoice appears multiple times
#         unique_vouchers_for_totals = {}
#         rows_without_voucher = []

#         for row in voucher_level_rows:
#             voucher_type = row.get("voucher_type")
#             voucher_no = row.get("voucher_no")

#             if voucher_type and voucher_no:
#                 voucher_key = f"{voucher_type}::{voucher_no}"
#                 if voucher_key not in unique_vouchers_for_totals:
#                     unique_vouchers_for_totals[voucher_key] = {}
#                     for field in totals.keys():
#                         unique_vouchers_for_totals[voucher_key][field] = 0.0

#                 for field in totals.keys():
#                     unique_vouchers_for_totals[voucher_key][field] += flt(row.get(field, 0), 2)
#             else:
#                 # Track rows without voucher details but with amounts
#                 has_amount = any(flt(row.get(field, 0), 2) != 0 for field in totals.keys())
#                 if has_amount:
#                     rows_without_voucher.append(row)

#         # Sum the unique vouchers
#         for voucher_data in unique_vouchers_for_totals.values():
#             for field in totals.keys():
#                 totals[field] += flt(voucher_data[field], 2)

#         # Also sum rows without voucher details (opening balance, adjustments, etc.)
#         for row in rows_without_voucher:
#             for field in totals.keys():
#                 totals[field] += flt(row.get(field, 0), 2)

#         # Log rows without voucher details if any
#         if rows_without_voucher:
#             missing_total = sum(flt(r.get("invoiced", 0), 2) for r in rows_without_voucher)
#             missing_log = (
#                 f"Rows without voucher details for company={filters.get('company')}:\n"
#                 f"Count: {len(rows_without_voucher)}\n"
#                 f"Total invoiced: {missing_total}\n"
#                 f"These might be opening balances or adjustments\n"
#                 f"Sample (first 5):\n"
#             )
#             for r in rows_without_voucher[:5]:
#                 missing_log += (
#                     f"  Party: {r.get('party')}, "
#                     f"Invoiced: {r.get('invoiced', 0)}, "
#                     f"Outstanding: {r.get('outstanding', 0)}\n"
#                 )
#             frappe.log_error(title="AR Rows Without Voucher", message=missing_log)
#     else:
#         # Fall back to customer summaries if no voucher details available
#         for row in customer_level_rows:
#             for field in totals.keys():
#                 totals[field] += flt(row.get(field, 0), 2)

#     # Log what we found
#     if customer_level_rows:
#         customer_log = (
#             f"Customer-level summary rows found for company={filters.get('company')}:\n"
#             f"Count: {len(customer_level_rows)}\n"
#             f"This is NORMAL when AR report uses group_by_party=True\n"
#             f"These rows contain customer totals, not individual invoices\n"
#             f"Sample (first 5):\n"
#         )
#         for r in customer_level_rows[:5]:
#             customer_log += (
#                 f"  Party: {r.get('party')}, "
#                 f"Invoiced: {r.get('invoiced', 0)}, "
#                 f"Outstanding: {r.get('outstanding', 0)}\n"
#             )
#         frappe.log_error(title="AR Customer Summary Rows", message=customer_log)

#     # For backward compatibility, also track unique vouchers
#     unique_vouchers = {}
#     for row in voucher_level_rows:
#         voucher_type = row.get("voucher_type")
#         voucher_no = row.get("voucher_no")
#         voucher_key = f"{voucher_type}::{voucher_no}"

#         if voucher_key not in unique_vouchers:
#             unique_vouchers[voucher_key] = {
#                 "voucher_type": voucher_type,
#                 "voucher_no": voucher_no,
#                 "invoiced": 0.0,
#                 "paid": 0.0, "credit_note": 0.0, "outstanding": 0.0,
#                 "range1": 0.0, "range2": 0.0, "range3": 0.0, "range4": 0.0, "range5": 0.0,
#                 "future_amount": 0.0, "remaining_balance": 0.0
#             }
#         for field in totals.keys():
#             unique_vouchers[voucher_key][field] += flt(row.get(field, 0), 2)

#     unique_invoices = {
#         v["voucher_no"]: v for v in unique_vouchers.values()
#         if v["voucher_type"] == "Sales Invoice"
#     }

#     # Log sample vouchers for debugging
#     if unique_vouchers:
#         sample_vouchers = list(unique_vouchers.items())[:5]
#         sample_log = "Sample voucher calculations:\n"
#         for voucher_key, voucher_data in sample_vouchers:
#             sample_log += (
#                 f"{voucher_key}: "
#                 f"invoiced={voucher_data['invoiced']}, "
#                 f"outstanding={voucher_data['outstanding']}, "
#                 f"paid={voucher_data['paid']}\n"
#             )
#         frappe.log_error(title="AR Sample Vouchers", message=sample_log)

#     # Compare calculated totals with Total row (if found) for debugging
#     if total_row_found and total_row_values:
#         comparison_message = f"Totals Comparison for company={filters.get('company')}:\n"
#         for field in ["invoiced", "outstanding", "paid", "range5"]:
#             calc_val = totals.get(field, 0)
#             total_row_val = total_row_values.get(field, 0)
#             diff = calc_val - total_row_val
#             comparison_message += f"{field}: Calculated={calc_val}, Total Row={total_row_val}, Diff={diff}\n"
#         frappe.log_error(title="AR Totals Comparison", message=comparison_message)

#     formatted_columns = [
#         {
#             "label": col.get("label"),
#             "fieldname": col.get("fieldname"),
#             "fieldtype": col.get("fieldtype"),
#             "options": col.get("options"),
#             "width": col.get("width")
#         } if isinstance(col, dict) else col
#         for col in columns
#     ]

#     response = {
#         "columns": formatted_columns,
#         "totals": totals,
#         "filters_applied": filters,
#         "record_count": len(detail_rows)
#     }

#     if group_by_customer:
#         customer_summary = []
#         formatted_customer_data = []
#         for customer_id, cust_data in customer_data.items():
#             sales_persons_list = sorted(list(cust_data["sales_persons"])) if cust_data["sales_persons"] else []
#             sales_teams_list = sorted(list(cust_data["sales_teams"])) if cust_data["sales_teams"] else []
#             formatted_cust_data = {
#                 "customer": cust_data["customer"],
#                 "customer_name": cust_data["customer_name"],
#                 "territory": cust_data["territory"],
#                 "customer_group": cust_data["customer_group"],
#                 "credit_limit": cust_data["credit_limit"],
#                 "sales_persons": sales_persons_list,
#                 "sales_teams": sales_teams_list,
#                 "invoices": cust_data["invoices"],
#                 "totals": {k: flt(v, 2) for k, v in cust_data["totals"].items()}
#             }
#             formatted_customer_data.append(formatted_cust_data)
#             customer_summary.append({
#                 "customer": cust_data["customer"],
#                 "customer_name": cust_data["customer_name"],
#                 "territory": cust_data["territory"],
#                 "customer_group": cust_data["customer_group"],
#                 "credit_limit": cust_data["credit_limit"],
#                 "sales_persons": sales_persons_list,
#                 "sales_teams": sales_teams_list,
#                 "invoice_count": len(cust_data["invoices"]),
#                 "totals": {k: flt(v, 2) for k, v in cust_data["totals"].items()}
#             })

#         customer_summary.sort(key=lambda x: x["totals"]["outstanding"], reverse=True)
#         response["data"] = formatted_customer_data
#         response["customer_summary"] = customer_summary
#         response["customer_count"] = len(customer_data)
#     else:
#         response["data"] = detail_rows

#     # Count detail rows by voucher type
#     voucher_type_counts = {}
#     for row in detail_rows:
#         vtype = row.get("voucher_type", "Unknown")
#         voucher_type_counts[vtype] = voucher_type_counts.get(vtype, 0) + 1

#     # Log skipped rows with amounts
#     if skipped_rows_with_amounts:
#         total_skipped_invoiced = sum(r["invoiced"] for r in skipped_rows_with_amounts)
#         total_skipped_outstanding = sum(r["outstanding"] for r in skipped_rows_with_amounts)
#         skipped_log = (
#             f"SKIPPED ROWS WITH AMOUNTS for company={filters.get('company')}:\n"
#             f"Total skipped invoiced: {total_skipped_invoiced}\n"
#             f"Total skipped outstanding: {total_skipped_outstanding}\n"
#             f"Count: {len(skipped_rows_with_amounts)}\n"
#             f"Details:\n"
#         )
#         for r in skipped_rows_with_amounts[:10]:  # Show first 10
#             skipped_log += f"  {r}\n"
#         frappe.log_error(title="AR Skipped Rows", message=skipped_log)

#     # Log the final totals being returned to the dashboard
#     rows_without_voucher_count = len(rows_without_voucher) if 'rows_without_voucher' in locals() else 0
#     if voucher_level_rows:
#         source_description = f"unique vouchers (n={len(unique_vouchers_for_totals) if 'unique_vouchers_for_totals' in locals() else 0}) + rows without voucher (n={rows_without_voucher_count})"
#     else:
#         source_description = f"customer-level summaries (n={len(customer_level_rows)})"

#     log_message = (
#         f"API Response Totals for company={filters.get('company')}:\n"
#         f"SOURCE: Summing {source_description}\n"
#         f"invoiced={totals.get('invoiced', 0)}\n"
#         f"outstanding={totals.get('outstanding', 0)}\n"
#         f"paid={totals.get('paid', 0)}\n"
#         f"range1={totals.get('range1', 0)}\n"
#         f"range2={totals.get('range2', 0)}\n"
#         f"range3={totals.get('range3', 0)}\n"
#         f"range4={totals.get('range4', 0)}\n"
#         f"range5={totals.get('range5', 0)}\n"
#         f"detail_rows_count={len(detail_rows)}\n"
#         f"customer_level_rows={len(customer_level_rows)}\n"
#         f"voucher_level_rows={len(voucher_level_rows)}\n"
#         f"unique_vouchers_summed={len(unique_vouchers_for_totals) if 'unique_vouchers_for_totals' in locals() else 0}\n"
#         f"rows_without_voucher={rows_without_voucher_count}\n"
#         f"skipped_rows_count={len(skipped_rows_with_amounts)}\n"
#         f"voucher_type_counts={voucher_type_counts}\n"
#         f"total_row_found={total_row_found}"
#     )
#     frappe.log_error(title="AR API Response", message=log_message)

#     return response



@frappe.whitelist()
def get_customer_outstandings_new(filters=None, customer=None, sales_person=None, sales_team=None, branch=None, group_by_customer=True, internal_customer=None, include_sales_person=False):
    """
    API to get detailed customer outstanding data similar to Accounts Receivable Report.
    Can be filtered by customer, sales person, sales team, branch and returns data grouped by customer.

    Args:
        filters (dict): Filter parameters including:
            - company (str): Company name (required)
            - report_date (str): Report date (default: today)
            - party_type (str): Party Type (default: "Customer")
            - party (list): List of specific parties/customers
            - customer_group (list): Customer groups
            - territory (str): Territory filter
            - sales_person (str): Sales person filter (can also be passed as direct parameter)
            - sales_team (str): Sales team filter (can also be passed as direct parameter)
            - branch (str): Branch filter (can also be passed as direct parameter)
            - cost_center (str): Cost center filter
            - ageing_based_on (str): "Posting Date" or "Due Date" (default: "Posting Date")
            - range1, range2, range3, range4 (int): Ageing ranges (default: 30, 60, 90, 120)
            - based_on_payment_terms (bool): Split by payment terms
            - show_future_payments (bool): Show future payments
            - show_delivery_notes (bool): Show linked delivery notes
            - show_sales_person (bool): Show sales person
            - show_remarks (bool): Show remarks
        customer (str): Single customer filter (alternative to filters.party)
        sales_person (str): Sales person ID to filter by (alternative to filters.sales_person)
        sales_team (str): Sales team/parent sales person ID to filter by (alternative to filters.sales_team)
        branch (str): Branch ID to filter by (alternative to filters.branch)
        group_by_customer (bool): If True, returns data grouped by customer (default: True)
        internal_customer (bool): If True, only include internal customers (is_internal_customer=1)
        include_sales_person (bool): If True, include sales person data (default: False)

    Returns:
        dict: {
            "columns": [column definitions],
            "data": [customer-wise grouped data] or [detailed row data],
            "totals": {aggregated totals for all columns},
            "customer_summary": [customer-wise summary] (if group_by_customer=True)
        }
    """
    from prastara_custom.prastara_custom.report.ihg_customer_outstanding.ihg_customer_outstanding import execute
    from collections import defaultdict

    # Parse filters
    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    filters = filters or {}

    # Set default values
    if not filters.get("company"):
        filters["company"] = frappe.db.get_single_value("Global Defaults", "default_company")

    if not filters.get("report_date"):
        filters["report_date"] = today()

    if not filters.get("ageing_based_on"):
        filters["ageing_based_on"] = "Posting Date"

    # Set default ageing ranges
    filters.setdefault("range1", 30)
    filters.setdefault("range2", 60)
    filters.setdefault("range3", 90)
    filters.setdefault("range4", 120)

    # Enable group_by_party to get the Total row with correct totals
    filters.setdefault("group_by_party", True)

    # Handle customer filter
    if customer:
        # Single customer filter takes precedence
        filters["party"] = [customer]
    elif filters.get("customer"):
        # Support 'customer' key in filters
        if isinstance(filters["customer"], str):
            filters["party"] = [filters["customer"]]
        else:
            filters["party"] = filters["customer"]

    # Store sales person, sales team, and branch filters for post-processing
    # (ERPNext report doesn't support filtering by sales team/parent_sales_person or branch)
    filter_sales_person = sales_person or filters.get("sales_person")
    filter_sales_team = sales_team or filters.get("sales_team")
    filter_branch = branch or filters.get("branch")

    # Handle internal_customer filter - get list of internal customers
    filter_internal_customer = internal_customer
    internal_customer_list = set()
    filter_internal_val = str(filter_internal_customer).lower() if filter_internal_customer else ''
    filter_internal_yes = filter_internal_val in ['1', 'true', 'yes']
    filter_internal_no = filter_internal_val == 'no'

    if filter_internal_yes or filter_internal_no:
        # Get all internal customers
        internal_customers = frappe.get_all('Customer',
            filters={'is_internal_customer': 1, 'disabled': 0},
            pluck='name'
        )
        internal_customer_list = set(internal_customers)
        if filter_internal_yes and not internal_customer_list:
            # No internal customers found, return empty result
            return {
                "columns": [],
                "data": [],
                "totals": {
                    "invoiced": 0.0,
                    "paid": 0.0,
                    "credit_note": 0.0,
                    "outstanding": 0.0,
                    "range1": 0.0,
                    "range2": 0.0,
                    "range3": 0.0,
                    "range4": 0.0,
                    "range5": 0.0,
                    "future_amount": 0.0,
                    "remaining_balance": 0.0,
                },
                "record_count": 0
            }

    # Execute the report
    try:
        columns, data, message, chart, report_summary, skip_total_row = execute(filters)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_customer_outstandings_new Error")
        frappe.throw(_("Error fetching customer outstandings: {0}").format(str(e)))

    # Calculate totals for all currency fields
    # NOTE: These will be extracted from the "Total" row (bold row) in the report data
    # Do NOT sum all rows as that causes double counting (invoices + payments)
    totals = {
        "invoiced": 0.0,
        "paid": 0.0,
        "credit_note": 0.0,
        "outstanding": 0.0,
        "range1": 0.0,
        "range2": 0.0,
        "range3": 0.0,
        "range4": 0.0,
        "range5": 0.0,
        "future_amount": 0.0,
        "remaining_balance": 0.0,
    }

    # Flag to track if we found the total row
    total_row_found = False

    # Initialize customer-wise grouping
    customer_data = defaultdict(lambda: {
        "customer": "",
        "customer_name": "",
        "territory": "",
        "customer_group": "",
        "credit_limit": 0.0,
        "sales_persons": set(),  # Track unique sales persons for this customer
        "sales_teams": set(),    # Track unique sales teams for this customer
        "invoices": [],
        "totals": {
            "invoiced": 0.0,
            "paid": 0.0,
            "credit_note": 0.0,
            "outstanding": 0.0,
            "range1": 0.0,
            "range2": 0.0,
            "range3": 0.0,
            "range4": 0.0,
            "range5": 0.0,
            "future_amount": 0.0,
            "remaining_balance": 0.0,
        }
    })

    # Collect all Sales Invoice vouchers for sales person and branch lookup
    sales_invoices = set()
    for row in data:
        if isinstance(row, dict) and row.get("voucher_type") == "Sales Invoice" and row.get("voucher_no"):
            sales_invoices.add(row.get("voucher_no"))

    # Fetch sales team data for all sales invoices in one query
    sales_team_map = {}
    if sales_invoices:
        sales_team_data = frappe.db.sql("""
            SELECT
                parent,
                sales_person,
                parent_sales_person,
                allocated_percentage
            FROM `tabSales Team`
            WHERE parent IN %(invoices)s
                AND parenttype = 'Sales Invoice'
            ORDER BY parent, allocated_percentage DESC
        """, {"invoices": tuple(sales_invoices)}, as_dict=True)

        # Map invoice to sales team data
        for st in sales_team_data:
            if st.parent not in sales_team_map:
                sales_team_map[st.parent] = []
            sales_team_map[st.parent].append(st)

    # Fetch branch data for Sales Invoices only
    branch_map = {}
    if sales_invoices:
        si_branches = frappe.db.sql("""
            SELECT name, branch
            FROM `tabSales Invoice`
            WHERE name IN %(vouchers)s
        """, {"vouchers": tuple(sales_invoices)}, as_dict=True)

        for si in si_branches:
            branch_map[si.name] = si.branch

    # Process data and calculate totals
    detail_rows = []
    for row in data:
        # Skip empty rows (separator rows between customer groups)
        if not row or (isinstance(row, dict) and not row.get("party")):
            continue

        # Extract totals from the bold "Total" row (this is the correct total from ERPNext report)
        # Note: With group_by_party enabled, we get multiple bold rows (one per customer + one grand Total)
        # We want the grand "Total" row where party == "Total"
        if isinstance(row, dict) and row.get("bold"):
            # Check if this is the grand Total row
            if row.get("party") == "Total":
                # This is the grand total row - extract the totals
                for field in totals.keys():
                    if field in row and row[field]:
                        totals[field] = flt(row[field])
                total_row_found = True
            # Skip adding all bold rows to detail_rows (they're subtotals/totals, not data)
            continue

        if isinstance(row, dict):
            # Filter by customer if specified
            if customer and row.get("party") != customer:
                continue

            # Add branch info to each row
            voucher_no = row.get("voucher_no")
            if voucher_no and voucher_no in branch_map:
                row["branch"] = branch_map.get(voucher_no)
            else:
                row["branch"] = None

            # Add sales person and sales team info to each invoice row
            if row.get("voucher_type") == "Sales Invoice" and voucher_no:
                sales_team_list = sales_team_map.get(voucher_no, [])

                if sales_team_list:
                    # Get primary sales person (highest allocation)
                    primary_sp = sales_team_list[0]
                    row["sales_person"] = primary_sp.get("sales_person")
                    row["sales_team"] = primary_sp.get("parent_sales_person")
                    row["sales_team_members"] = sales_team_list
                else:
                    row["sales_person"] = None
                    row["sales_team"] = None
                    row["sales_team_members"] = []

            # Filter by sales person if specified
            if filter_sales_person:
                # Check if this invoice matches the sales person filter
                if row.get("voucher_type") == "Sales Invoice":
                    # Check primary sales person or any team member
                    sales_team_list = row.get("sales_team_members", [])
                    has_sales_person = (
                        row.get("sales_person") == filter_sales_person or
                        any(member.get("sales_person") == filter_sales_person for member in sales_team_list)
                    )
                    if not has_sales_person:
                        continue
                else:
                    # Non-Sales Invoice vouchers are excluded when filtering by sales person
                    continue

            # Filter by sales team if specified
            if filter_sales_team:
                # Check if this invoice matches the sales team filter
                if row.get("voucher_type") == "Sales Invoice":
                    # Check primary sales team or any team member's parent
                    sales_team_list = row.get("sales_team_members", [])
                    has_sales_team = (
                        row.get("sales_team") == filter_sales_team or
                        any(member.get("parent_sales_person") == filter_sales_team for member in sales_team_list)
                    )
                    if not has_sales_team:
                        continue
                else:
                    # Non-Sales Invoice vouchers are excluded when filtering by sales team
                    continue

            # Filter by branch if specified
            if filter_branch:
                # Check if this invoice matches the branch filter
                if row.get("voucher_type") == "Sales Invoice":
                    # Check if branch matches
                    if row.get("branch") != filter_branch:
                        continue
                else:
                    # Non-Sales Invoice vouchers are excluded when filtering by branch
                    continue

            # Filter by internal customer if specified
            if filter_internal_yes:
                # Only include rows where party is an internal customer
                if row.get("party") not in internal_customer_list:
                    continue
            elif filter_internal_no:
                # Only include rows where party is NOT an internal customer
                if row.get("party") in internal_customer_list:
                    continue

            detail_rows.append(row)

            # Group by customer if enabled
            if group_by_customer and row.get("party"):
                customer_id = row.get("party")
                cust_group = customer_data[customer_id]

                # Set customer details (once per customer)
                if not cust_group["customer"]:
                    cust_group["customer"] = customer_id
                    cust_group["customer_name"] = row.get("customer_name", "")
                    cust_group["territory"] = row.get("territory", "")
                    cust_group["customer_group"] = row.get("customer_group", "")
                    # Fetch credit limit for this customer
                    cust_group["credit_limit"] = frappe.db.get_value(
                        "Customer Credit Limit",
                        {"parent": customer_id, "parenttype": "Customer", "company": filters.get("company")},
                        "credit_limit"
                    ) or 0.0

                # Track sales persons and teams for this customer
                if row.get("sales_person"):
                    cust_group["sales_persons"].add(row.get("sales_person"))
                if row.get("sales_team"):
                    cust_group["sales_teams"].add(row.get("sales_team"))

                # Add invoice to customer's invoices list
                cust_group["invoices"].append(row)

                # Update customer totals
                for field in totals.keys():
                    if field in row and row[field]:
                        cust_group["totals"][field] += flt(row[field])

    # If filters were applied (sales_person, sales_team, branch, customer, internal_customer), we need to recalculate totals
    # because we filtered rows AFTER extracting the total row
    if filter_sales_person or filter_sales_team or filter_branch or customer or filter_internal_yes or filter_internal_no:
        # Recalculate totals from filtered detail_rows
        # IMPORTANT: Only sum from Sales Invoice rows to avoid double counting
        # (Payment Entry, Journal Entry rows show negative amounts that are already reflected in invoice outstanding)
        totals = {
            "invoiced": 0.0,
            "paid": 0.0,
            "credit_note": 0.0,
            "outstanding": 0.0,
            "range1": 0.0,
            "range2": 0.0,
            "range3": 0.0,
            "range4": 0.0,
            "range5": 0.0,
            "future_amount": 0.0,
            "remaining_balance": 0.0,
        }
        for row in detail_rows:
            # Only sum from Sales Invoice rows to avoid double-counting
            if row.get("voucher_type") == "Sales Invoice":
                for field in totals.keys():
                    if field in row and row[field]:
                        totals[field] += flt(row[field])

    # Format column definitions for API response
    formatted_columns = []
    for col in columns:
        if isinstance(col, dict):
            formatted_columns.append({
                "label": col.get("label"),
                "fieldname": col.get("fieldname"),
                "fieldtype": col.get("fieldtype"),
                "options": col.get("options"),
                "width": col.get("width")
            })
        else:
            formatted_columns.append(col)

    # Prepare response
    response = {
        "columns": formatted_columns,
        "totals": totals,
        "filters_applied": filters,
        "record_count": len(detail_rows)
    }

    if group_by_customer:
        # Convert customer_data to list for response and convert sets to lists
        customer_summary = []
        formatted_customer_data = []

        for customer_id, cust_data in customer_data.items():
            # Convert sets to sorted lists
            sales_persons_list = sorted(list(cust_data["sales_persons"])) if cust_data["sales_persons"] else []
            sales_teams_list = sorted(list(cust_data["sales_teams"])) if cust_data["sales_teams"] else []

            # Create formatted customer data entry
            formatted_cust_data = {
                "customer": cust_data["customer"],
                "customer_name": cust_data["customer_name"],
                "territory": cust_data["territory"],
                "customer_group": cust_data["customer_group"],
                "credit_limit": cust_data["credit_limit"],
                "sales_persons": sales_persons_list,
                "sales_teams": sales_teams_list,
                "invoices": cust_data["invoices"],
                "totals": cust_data["totals"]
            }
            formatted_customer_data.append(formatted_cust_data)

            # Create summary entry
            customer_summary.append({
                "customer": cust_data["customer"],
                "customer_name": cust_data["customer_name"],
                "territory": cust_data["territory"],
                "customer_group": cust_data["customer_group"],
                "credit_limit": cust_data["credit_limit"],
                "sales_persons": sales_persons_list,
                "sales_teams": sales_teams_list,
                "invoice_count": len(cust_data["invoices"]),
                "totals": cust_data["totals"]
            })

        # Sort by outstanding amount (descending)
        customer_summary.sort(key=lambda x: x["totals"]["outstanding"], reverse=True)

        response["data"] = formatted_customer_data
        response["customer_summary"] = customer_summary
        response["customer_count"] = len(customer_data)
    else:
        # Return detailed rows without grouping
        response["data"] = detail_rows

    return response



@frappe.whitelist()
def get_payment_schedule_data(
    company=None,
    from_date=None,
    to_date=None,
    customer=None,
    branch=None,
    sales_person=None,
    sales_team=None,
    min_outstanding=0,
    internal_customer=None
):
    """
    Fetch accounts receivable data based on Payment Schedule due dates

    This method queries the Payment Schedule child table instead of main Sales Invoice due_date.
    Each invoice can have multiple payment terms with different due dates.

    Args:
        company: Company name (required)
        from_date: Start date for due_date filter (default: 1st of current month)
        to_date: End date for due_date filter (default: last day of current month)
        customer: Filter by specific customer
        branch: Filter by branch
        sales_person: Filter by sales person
        sales_team: Filter by sales team (parent_sales_person)
        min_outstanding: Minimum outstanding amount (default: 0)
        internal_customer: Filter by is_internal_customer field

    Returns:
        dict with payment schedule data grouped by customer and invoice
    """
    from collections import defaultdict

    # Validate required parameters
    if not company:
        frappe.throw(_("Company is required"))

    # Set default date range to current month if not provided
    today = getdate(nowdate())
    if not from_date:
        from_date = get_first_day(today)
    if not to_date:
        to_date = get_last_day(today)

    from_date = getdate(from_date)
    to_date = getdate(to_date)

    # Build WHERE conditions
    conditions = []
    values = {
        "company": company,
        "from_date": from_date,
        "to_date": to_date,
        "min_outstanding": flt(min_outstanding)
    }

    conditions.append("si.docstatus = 1")  # Submitted only
    conditions.append("si.company = %(company)s")
    conditions.append("ps.due_date BETWEEN %(from_date)s AND %(to_date)s")
    conditions.append("(ps.payment_amount - ps.paid_amount - IFNULL(ps.discounted_amount, 0)) > %(min_outstanding)s")

    # Customer filter
    if customer:
        conditions.append("si.customer = %(customer)s")
        values["customer"] = customer

    # Branch filter
    if branch:
        conditions.append("si.branch = %(branch)s")
        values["branch"] = branch

    # Sales Person filter - check Sales Team child table
    if sales_person:
        conditions.append("""
            EXISTS (
                SELECT 1 FROM `tabSales Team` st
                WHERE st.parent = si.name
                AND st.parenttype = 'Sales Invoice'
                AND st.sales_person = %(sales_person)s
            )
        """)
        values["sales_person"] = sales_person

    # Sales Team filter - check parent_sales_person
    if sales_team:
        conditions.append("""
            EXISTS (
                SELECT 1 FROM `tabSales Team` st
                WHERE st.parent = si.name
                AND st.parenttype = 'Sales Invoice'
                AND st.parent_sales_person = %(sales_team)s
            )
        """)
        values["sales_team"] = sales_team

    # Internal customer filter - filter by is_internal_customer field
    if internal_customer:
        internal_val_lower = str(internal_customer).lower()
        if internal_val_lower in ['1', 'true', 'yes']:
            conditions.append("EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = si.customer AND c.is_internal_customer = 1)")
        elif internal_val_lower == 'no':
            conditions.append("NOT EXISTS (SELECT 1 FROM `tabCustomer` c WHERE c.name = si.customer AND c.is_internal_customer = 1)")

    where_clause = " AND ".join(conditions)

    # Main query to fetch payment schedule data
    query = f"""
        SELECT
            si.name as invoice_no,
            si.customer,
            si.customer_name,
            si.posting_date,
            si.status,
            si.branch,
            si.grand_total,
            si.outstanding_amount as invoice_outstanding,
            si.territory,
            si.customer_group,
            si.company,
            ps.name as payment_schedule_name,
            ps.due_date,
            ps.payment_term,
            ps.payment_amount,
            ps.paid_amount,
            IFNULL(ps.discounted_amount, 0) as discounted_amount,
            (ps.payment_amount - ps.paid_amount - IFNULL(ps.discounted_amount, 0)) as outstanding,
            ps.description,
            DATEDIFF(CURDATE(), ps.due_date) as age_days
        FROM `tabSales Invoice` si
        INNER JOIN `tabPayment Schedule` ps ON ps.parent = si.name AND ps.parenttype = 'Sales Invoice'
        WHERE {where_clause}
        ORDER BY si.customer, si.posting_date, ps.due_date
    """

    payment_schedule_data = frappe.db.sql(query, values, as_dict=True)

    # Debug logging
    frappe.log_error(
        title="Payment Schedule Query Debug",
        message=f"""
        Company: {company}
        From Date: {from_date}
        To Date: {to_date}
        Customer: {customer}
        Branch: {branch}
        Sales Person: {sales_person}
        Sales Team: {sales_team}
        Total Rows Found: {len(payment_schedule_data)}
        Query: {query}
        Values: {values}
        """
    )

    # Fetch Sales Team data for all invoices
    invoice_list = list(set([d.invoice_no for d in payment_schedule_data]))
    sales_team_map = {}

    if invoice_list:
        sales_team_data = frappe.db.sql("""
            SELECT
                parent as invoice_no,
                sales_person,
                parent_sales_person as sales_team,
                allocated_percentage
            FROM `tabSales Team`
            WHERE parent IN %(invoices)s
            AND parenttype = 'Sales Invoice'
            ORDER BY parent, allocated_percentage DESC
        """, {"invoices": invoice_list}, as_dict=True)

        for st in sales_team_data:
            if st.invoice_no not in sales_team_map:
                sales_team_map[st.invoice_no] = []
            sales_team_map[st.invoice_no].append(st)

    # Fetch customer credit limits
    credit_limit_map = {}
    customer_list = list(set([d.customer for d in payment_schedule_data]))

    if customer_list:
        credit_limits = frappe.db.sql("""
            SELECT
                parent as customer,
                credit_limit
            FROM `tabCustomer Credit Limit`
            WHERE parent IN %(customers)s
            AND company = %(company)s
        """, {"customers": customer_list, "company": company}, as_dict=True)

        credit_limit_map = {cl.customer: cl.credit_limit for cl in credit_limits}

    # Group data by customer
    customer_data = defaultdict(lambda: {
        "customer": "",
        "customer_name": "",
        "territory": "",
        "customer_group": "",
        "credit_limit": 0.0,
        "total_outstanding": 0.0,
        "invoices": defaultdict(lambda: {
            "invoice_no": "",
            "posting_date": None,
            "status": "",
            "branch": "",
            "grand_total": 0.0,
            "invoice_outstanding": 0.0,
            "sales_persons": [],
            "sales_teams": [],
            "payment_schedules": []
        })
    })

    # Calculate totals and summaries
    totals = {
        "due_today": 0.0,
        "due_this_week": 0.0,
        "due_this_month": 0.0,
        "total_outstanding": 0.0,
        "total_invoiced": 0.0,
        "count_schedules": 0,
        "count_invoices": 0,
        "count_customers": 0
    }

    today = getdate(nowdate())
    week_end = add_days(today, 7)
    month_start = get_first_day(today)
    month_end = get_last_day(today)

    for row in payment_schedule_data:
        customer_id = row.customer
        invoice_no = row.invoice_no

        # Initialize customer data
        if not customer_data[customer_id]["customer"]:
            customer_data[customer_id]["customer"] = customer_id
            customer_data[customer_id]["customer_name"] = row.customer_name
            customer_data[customer_id]["territory"] = row.territory
            customer_data[customer_id]["customer_group"] = row.customer_group
            customer_data[customer_id]["credit_limit"] = credit_limit_map.get(customer_id, 0.0)

        # Initialize invoice data
        invoice_data = customer_data[customer_id]["invoices"][invoice_no]
        if not invoice_data["invoice_no"]:
            invoice_data["invoice_no"] = invoice_no
            invoice_data["posting_date"] = row.posting_date
            invoice_data["status"] = row.status
            invoice_data["branch"] = row.branch
            invoice_data["grand_total"] = row.grand_total
            invoice_data["invoice_outstanding"] = row.invoice_outstanding

            # Add sales team data
            sales_team_list = sales_team_map.get(invoice_no, [])
            invoice_data["sales_persons"] = list(set([st.sales_person for st in sales_team_list if st.sales_person]))
            invoice_data["sales_teams"] = list(set([st.sales_team for st in sales_team_list if st.sales_team]))

        # Add payment schedule entry
        payment_schedule = {
            "payment_schedule_name": row.payment_schedule_name,
            "due_date": row.due_date,
            "payment_term": row.payment_term,
            "payment_amount": row.payment_amount,
            "paid_amount": row.paid_amount,
            "discounted_amount": row.discounted_amount,
            "outstanding": row.outstanding,
            "description": row.description,
            "age_days": row.age_days
        }
        invoice_data["payment_schedules"].append(payment_schedule)

        # Update customer total outstanding
        customer_data[customer_id]["total_outstanding"] += row.outstanding

        # Update global totals
        totals["total_outstanding"] += row.outstanding
        totals["total_invoiced"] += row.payment_amount
        totals["count_schedules"] += 1

        # Calculate due today, this week, this month
        due_date = getdate(row.due_date)
        outstanding = row.outstanding

        if due_date == today:
            totals["due_today"] += outstanding

        if today <= due_date <= week_end:
            totals["due_this_week"] += outstanding

        if month_start <= due_date <= month_end:
            totals["due_this_month"] += outstanding

    # Convert to list format
    result_data = []
    for customer_id, cust_data in customer_data.items():
        customer_record = {
            "customer": cust_data["customer"],
            "customer_name": cust_data["customer_name"],
            "territory": cust_data["territory"],
            "customer_group": cust_data["customer_group"],
            "credit_limit": cust_data["credit_limit"],
            "total_outstanding": cust_data["total_outstanding"],
            "invoices": []
        }

        for invoice_no, inv_data in cust_data["invoices"].items():
            customer_record["invoices"].append({
                "invoice_no": inv_data["invoice_no"],
                "posting_date": inv_data["posting_date"],
                "status": inv_data["status"],
                "branch": inv_data["branch"],
                "grand_total": inv_data["grand_total"],
                "invoice_outstanding": inv_data["invoice_outstanding"],
                "sales_persons": inv_data["sales_persons"],
                "sales_teams": inv_data["sales_teams"],
                "payment_schedules": inv_data["payment_schedules"]
            })

        result_data.append(customer_record)

    # Sort by outstanding amount
    result_data.sort(key=lambda x: x["total_outstanding"], reverse=True)

    # Update counts
    totals["count_customers"] = len(result_data)
    totals["count_invoices"] = len(invoice_list)

    # Debug logging for totals
    frappe.log_error(
        title="Payment Schedule Totals Debug",
        message=f"""
        Due Today: {totals['due_today']}
        Due This Week: {totals['due_this_week']}
        Due This Month: {totals['due_this_month']}
        Total Outstanding: {totals['total_outstanding']}
        Total Invoiced: {totals['total_invoiced']}
        Count Schedules: {totals['count_schedules']}
        Count Invoices: {totals['count_invoices']}
        Count Customers: {totals['count_customers']}
        """
    )

    return {
        "data": result_data,
        "totals": totals,
        "filters_applied": {
            "company": company,
            "from_date": from_date,
            "to_date": to_date,
            "customer": customer,
            "branch": branch,
            "sales_person": sales_person,
            "sales_team": sales_team
        },
        "date_range": {
            "from_date": from_date,
            "to_date": to_date,
            "today": today,
            "week_end": week_end,
            "month_start": month_start,
            "month_end": month_end
        }
    }




@frappe.whitelist()
def get_expired_trade_licenses(supplier):
    buffer_days = 7
    today = frappe.utils.today()
    expiry_limit = frappe.utils.add_days(today, buffer_days)

    result = frappe.db.sql("""
        SELECT
            sup.supplier_name,
            doc.name AS document_row,
            doc.date
        FROM `tabSupplier` sup
        INNER JOIN `tabSupplier Documents` doc ON sup.name = doc.parent
        WHERE sup.name = %(supplier)s
          AND doc.documents = 'Trade License Copy'
          AND doc.date IS NOT NULL
          AND doc.date <= %(expiry_limit)s
        ORDER BY doc.date
    """, {
        "supplier": supplier,
        "expiry_limit": expiry_limit
    }, as_dict=True)

    if not result:
        return ""

    lines = []
    for row in result:
        date_str = frappe.format(row.date, {"fieldtype": "Date"})
        lines.append(f"• Trade License expiring on <strong>{date_str}</strong> (Doc: {row.document_row})")

    return f"<strong>Warning: Trade License(s) expiring soon for {result[0].supplier_name}:</strong><br><br>" + "<br>".join(lines)
    
    

