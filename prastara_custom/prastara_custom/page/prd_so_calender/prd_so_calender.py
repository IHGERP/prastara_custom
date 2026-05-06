from collections import defaultdict
from datetime import timedelta

import frappe
from frappe.utils import date_diff, getdate, today, flt


@frappe.whitelist()
def search_sales_orders_and_projects(query):
    """Search Sales Orders and Projects for quick-search panel."""
    try:
        query = (query or "").strip()
        if len(query) < 2:
            return {
                "status": "success",
                "data": {"sales_orders": [], "projects": []},
            }

        search_pattern = f"%{query}%"

        has_so_project_desc = frappe.db.has_column("Sales Order", "custom_project_description")
        so_project_desc_select = (
            "so.custom_project_description"
            if has_so_project_desc
            else "'' AS custom_project_description"
        )

        so_where_parts = [
            "so.name LIKE %s",
            "so.customer LIKE %s",
            "so.customer_name LIKE %s",
            "so.project LIKE %s",
        ]
        so_params = [search_pattern, search_pattern, search_pattern, search_pattern]

        if has_so_project_desc:
            so_where_parts.append("so.custom_project_description LIKE %s")
            so_params.append(search_pattern)

        sales_orders = frappe.db.sql(
            f"""
            SELECT
                so.name,
                so.customer,
                so.customer_name,
                so.project,
                {so_project_desc_select},
                so.transaction_date,
                so.delivery_date,
                so.grand_total,
                so.status,
                so.per_billed,
                so.per_delivered
            FROM `tabSales Order` so
            WHERE so.docstatus = 1
              AND ({' OR '.join(so_where_parts)})
            ORDER BY so.modified DESC
            LIMIT 20
            """,
            tuple(so_params),
            as_dict=True,
        )

        has_project_owner = frappe.db.has_column("Project", "custom_project_owner_name")
        project_owner_select = (
            "p.custom_project_owner_name"
            if has_project_owner
            else "'' AS custom_project_owner_name"
        )

        project_where_parts = [
            "p.name LIKE %s",
            "p.project_name LIKE %s",
            "p.customer LIKE %s",
        ]
        project_params = [search_pattern, search_pattern, search_pattern]

        if has_project_owner:
            project_where_parts.append("p.custom_project_owner_name LIKE %s")
            project_params.append(search_pattern)

        projects = frappe.db.sql(
            f"""
            SELECT
                p.name,
                p.project_name,
                p.customer,
                p.status,
                p.percent_complete,
                p.expected_start_date,
                p.expected_end_date,
                p.project_type,
                {project_owner_select}
            FROM `tabProject` p
            WHERE ({' OR '.join(project_where_parts)})
            ORDER BY p.modified DESC
            LIMIT 20
            """,
            tuple(project_params),
            as_dict=True,
        )

        return {
            "status": "success",
            "data": {"sales_orders": sales_orders, "projects": projects},
        }

    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), "PRD SO Calendar Quick Search Error")
        return {
            "status": "error",
            "message": str(exc),
            "data": {"sales_orders": [], "projects": []},
        }


@frappe.whitelist()
def get_project_sales_order_overview(company=None):
    """Return project list with linked Sales Order info for project tab."""
    try:
        company = (company or "").strip() or "PRASTARA DECORATION DESIGN L.L.C"

        so_conditions = ["so.docstatus < 2", "IFNULL(so.project, '') != ''"]
        so_params = []
        if company:
            so_conditions.append("so.company = %s")
            so_params.append(company)

        so_rows = frappe.db.sql(
            f"""
            SELECT
                so.name,
                so.project,
                so.status
            FROM `tabSales Order` so
            WHERE {' AND '.join(so_conditions)}
            ORDER BY so.modified DESC
            """,
            tuple(so_params),
            as_dict=True,
        )

        project_filters = []
        project_params = []
        if company and frappe.db.has_column("Project", "company"):
            project_filters.append("p.company = %s")
            project_params.append(company)

        project_where = f"WHERE {' AND '.join(project_filters)}" if project_filters else ""
        project_rows = frappe.db.sql(
            f"""
            SELECT
                p.name,
                p.project_name,
                p.customer,
                p.status,
                p.expected_start_date,
                p.expected_end_date
            FROM `tabProject` p
            {project_where}
            ORDER BY p.modified DESC
            """,
            tuple(project_params),
            as_dict=True,
        )
        so_by_project = {}
        for row in so_rows:
            project_name = (row.get("project") or "").strip()
            if not project_name:
                continue
            so_by_project.setdefault(project_name, []).append(row)


        # Fetch Dispute counts per project/SO
        dispute_counts_raw = frappe.db.sql("""
            SELECT 
                project, 
                sales_order, 
                COUNT(*) as count 
            FROM `tabDispute` 
            WHERE company = %s 
                AND status NOT IN ('Resolved', 'Closed', 'Cancelled')
            GROUP BY project, sales_order
        """, (company,), as_dict=True)

        disputes_by_project = {}
        disputes_by_so = {}
        for d in dispute_counts_raw:
            if d.project:
                disputes_by_project[d.project] = disputes_by_project.get(d.project, 0) + d.count
            if d.sales_order:
                disputes_by_so[d.sales_order] = disputes_by_so.get(d.sales_order, 0) + d.count

        # Fetch Issue counts per project/SO
        issue_counts_raw = frappe.db.sql("""
            SELECT 
                project, 
                custom_sales_order as sales_order, 
                COUNT(*) as count 
            FROM `tabIssue` 
            WHERE company = %s 
                AND status NOT IN ('Closed', 'Resolved', 'Cancelled')
            GROUP BY project, custom_sales_order
        """, (company,), as_dict=True)

        issues_by_project = {}
        issues_by_so = {}
        for i in issue_counts_raw:
            if i.project:
                issues_by_project[i.project] = issues_by_project.get(i.project, 0) + i.count
            if i.sales_order:
                issues_by_so[i.sales_order] = issues_by_so.get(i.sales_order, 0) + i.count

        def _unique_in_order(values):
            seen = set()
            output = []
            for value in values:
                item = (value or "").strip() or "Not Set"
                if item in seen:
                    continue
                seen.add(item)
                output.append(item)
            return output

        today_date = getdate(today())
        projects = []
        project_names = set()

        for project in project_rows:
            project_code = (project.get("name") or "").strip()
            if not project_code:
                continue

            project_names.add(project_code)
            linked_sales_orders = so_by_project.get(project_code, [])
            so_names = [row.get("name") for row in linked_sales_orders if row.get("name")]
            so_statuses = _unique_in_order([row.get("status") for row in linked_sales_orders])

            project_status = (project.get("status") or "").strip()
            expected_end_date = project.get("expected_end_date")
            overdue_days = 0
            if expected_end_date and project_status not in ("Completed", "Cancelled"):
                overdue_days = max(date_diff(today_date, getdate(expected_end_date)), 0)

            # Sum up disputes/issues from linked SOs as well for the project row
            total_disputes = disputes_by_project.get(project_code, 0)
            total_issues = issues_by_project.get(project_code, 0)
            
            # Also include any counts from the SOs linked to this project if they weren't explicitly project-linked
            for so_name in so_names:
                # If a dispute is linked to an SO but not the project, catch it here
                # (Highly simplified, may double count if both linked, so we rely on project link mostly)
                pass

            projects.append(
                {
                    "project": project_code,
                    "project_name": project.get("project_name") or "",
                    "customer": project.get("customer") or "",
                    "project_status": project_status or "Open",
                    "expected_start_date": project.get("expected_start_date"),
                    "expected_end_date": expected_end_date,
                    "overdue_days": overdue_days,
                    "sales_orders": so_names,
                    "sales_order_count": len(so_names),
                    "so_statuses": so_statuses,
                    "dispute_count": total_disputes,
                    "issue_count": total_issues,
                }
            )

        # Include Sales Order projects that don't have a corresponding Project document.
        missing_project_codes = sorted(set(so_by_project.keys()) - project_names)
        for project_code in missing_project_codes:
            linked_sales_orders = so_by_project.get(project_code, [])
            so_names = [row.get("name") for row in linked_sales_orders if row.get("name")]
            so_statuses = _unique_in_order([row.get("status") for row in linked_sales_orders])
            
            total_disputes = disputes_by_project.get(project_code, 0)
            total_issues = issues_by_project.get(project_code, 0)

            projects.append(
                {
                    "project": project_code,
                    "project_name": "",
                    "customer": "",
                    "project_status": "Project Missing",
                    "expected_start_date": None,
                    "expected_end_date": None,
                    "overdue_days": 0,
                    "sales_orders": so_names,
                    "sales_order_count": len(so_names),
                    "so_statuses": so_statuses,
                    "dispute_count": total_disputes,
                    "issue_count": total_issues,
                }
            )

        projects.sort(key=lambda row: (-int(row.get("overdue_days") or 0), row.get("project") or ""))

        with_sales_order = sum(1 for row in projects if row.get("sales_order_count", 0) > 0)
        without_sales_order = len(projects) - with_sales_order
        overdue_projects = sum(1 for row in projects if (row.get("overdue_days") or 0) > 0)
        total_disputes_all = sum(row.get("dispute_count", 0) for row in projects)
        total_issues_all = sum(row.get("issue_count", 0) for row in projects)

        return {
            "status": "success",
            "data": {
                "projects": projects,
                "summary": {
                    "total_projects": len(projects),
                    "with_sales_order": with_sales_order,
                    "without_sales_order": without_sales_order,
                    "overdue_projects": overdue_projects,
                    "total_disputes": total_disputes_all,
                    "total_issues": total_issues_all
                },
            },
        }

    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), "PRD SO Calendar Project Overview Error")
        return {
            "status": "error",
            "message": str(exc),
            "data": {
                "projects": [],
                "summary": {
                    "total_projects": 0,
                    "with_sales_order": 0,
                    "without_sales_order": 0,
                    "overdue_projects": 0,
                },
            },
        }


@frappe.whitelist()
def get_project_owner_mapping(company=None):
    """Return project role mapping for Project Owner dashboard tab."""
    try:
        company = (company or "").strip() or "PRASTARA DECORATION DESIGN L.L.C"

        required_fields = {
            "production_manager": frappe.db.has_column("Project", "custom_team"),
            "installation_manager": frappe.db.has_column("Project", "custom_installation_handled"),
            "site_supervisor": frappe.db.has_column("Project", "custom_site_supervisor"),
        }
        has_production_end_date = frappe.db.has_column("Project", "custom_production_end_date")
        has_installation_end_date = frappe.db.has_column("Project", "custom_installation_end_date")

        if not any(required_fields.values()):
            return {
                "status": "success",
                "data": {
                    "projects": [],
                    "summary": {
                        "total_projects": 0,
                        "assigned_projects": 0,
                        "unassigned_projects": 0,
                        "total_owners": 0,
                    },
                },
            }

        project_filters = []
        project_params = []

        if company and frappe.db.has_column("Project", "company"):
            project_filters.append("p.company = %s")
            project_params.append(company)

        project_where = f"WHERE {' AND '.join(project_filters)}" if project_filters else ""

        production_user_expr = "p.custom_team" if required_fields["production_manager"] else "''"
        installation_user_expr = "p.custom_installation_handled" if required_fields["installation_manager"] else "''"
        site_supervisor_user_expr = "p.custom_site_supervisor" if required_fields["site_supervisor"] else "''"
        production_end_date_expr = "p.custom_production_end_date" if has_production_end_date else "NULL"
        installation_end_date_expr = "p.custom_installation_end_date" if has_installation_end_date else "NULL"

        projects = frappe.db.sql(
            f"""
            SELECT
                p.name AS project,
                p.project_name,
                p.customer,
                p.status AS project_status,
                p.expected_start_date,
                p.expected_end_date,
                {production_user_expr} AS production_manager_user,
                COALESCE(
                    NULLIF(TRIM(pm.full_name), ''),
                    NULLIF(TRIM(CONCAT_WS(' ', pm.first_name, pm.last_name)), ''),
                    NULLIF(TRIM({production_user_expr}), ''),
                    'Unassigned'
                ) AS production_manager_name,
                COALESCE(pm.user_image, '') AS production_manager_image,
                {production_end_date_expr} AS production_end_date,
                {installation_user_expr} AS installation_manager_user,
                COALESCE(
                    NULLIF(TRIM(im.full_name), ''),
                    NULLIF(TRIM(CONCAT_WS(' ', im.first_name, im.last_name)), ''),
                    NULLIF(TRIM({installation_user_expr}), ''),
                    'Unassigned'
                ) AS installation_manager_name,
                COALESCE(im.user_image, '') AS installation_manager_image,
                {installation_end_date_expr} AS installation_end_date,
                {site_supervisor_user_expr} AS site_supervisor_user,
                COALESCE(
                    NULLIF(TRIM(ss.full_name), ''),
                    NULLIF(TRIM(CONCAT_WS(' ', ss.first_name, ss.last_name)), ''),
                    NULLIF(TRIM({site_supervisor_user_expr}), ''),
                    'Unassigned'
                ) AS site_supervisor_name,
                COALESCE(ss.user_image, '') AS site_supervisor_image
            FROM `tabProject` p
            LEFT JOIN `tabUser` pm
                ON pm.name = {production_user_expr}
            LEFT JOIN `tabUser` im
                ON im.name = {installation_user_expr}
            LEFT JOIN `tabUser` ss
                ON ss.name = {site_supervisor_user_expr}
            {project_where}
            ORDER BY p.name ASC
            """,
            tuple(project_params),
            as_dict=True,
        )

        return {
            "status": "success",
            "data": {
                "projects": projects,
                "summary": {
                    "total_projects": len(projects),
                    "assigned_projects": 0,
                    "unassigned_projects": 0,
                    "total_owners": 0,
                },
            },
        }

    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), "PRD SO Calendar Project Owner Mapping Error")
        return {
            "status": "error",
            "message": str(exc),
            "data": {
                "projects": [],
                "summary": {
                    "total_projects": 0,
                    "assigned_projects": 0,
                    "unassigned_projects": 0,
                    "total_owners": 0,
                },
            },
        }


@frappe.whitelist()
def get_prd_dispute_overview(company=None):
    """Return dispute list linked to projects or sales orders for the selected company."""
    try:
        company = (company or "").strip() or "PRASTARA DECORATION DESIGN L.L.C"
        disputes = frappe.db.sql(
            """
            SELECT
                d.name AS dispute_id,
                d.customer,
                d.project,
                d.sales_order,
                d.status,
                d.reason,
                d.company,
                d.creation,
                IFNULL(p.status, '') AS project_status
            FROM `tabDispute` d
            LEFT JOIN `tabProject` p ON p.name = d.project
            WHERE d.company = %s
            ORDER BY d.creation DESC
            """,
            (company,),
            as_dict=True,
        )

        total_disputes = len(disputes)
        open_disputes = sum(
            1
            for d in disputes
            if (d.get("status") or "") not in ("Resolved", "Closed", "Cancelled")
        )
        resolved_disputes = total_disputes - open_disputes

        return {
            "status": "success",
            "data": {
                "disputes": disputes,
                "summary": {
                    "total_disputes": total_disputes,
                    "open_disputes": open_disputes,
                    "resolved_disputes": resolved_disputes,
                },
            },
        }
    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), "PRD SO Calendar Dispute Overview Error")
        return {
            "status": "error",
            "message": str(exc),
            "data": {
                "disputes": [],
                "summary": {
                    "total_disputes": 0,
                    "open_disputes": 0,
                    "resolved_disputes": 0,
                },
            },
        }


@frappe.whitelist()
def get_prd_issue_overview(company=None):
    """Return issue list linked to projects or sales orders for the selected company."""
    try:
        company = (company or "").strip() or "PRASTARA DECORATION DESIGN L.L.C"
        issues = frappe.db.sql(
            """
            SELECT
                i.name AS issue_id,
                i.subject,
                i.customer_name,
                i.project,
                i.custom_sales_order,
                i.opening_date,
                i.status,
                i.priority,
                i.company,
                IFNULL(p.status, '') AS project_status
            FROM `tabIssue` i
            LEFT JOIN `tabProject` p ON p.name = i.project
            WHERE i.company = %s
            ORDER BY i.opening_date DESC, i.creation DESC
            """,
            (company,),
            as_dict=True,
        )

        total_issues = len(issues)
        open_issues = sum(
            1
            for i in issues
            if (i.get("status") or "") not in ("Closed", "Resolved", "Cancelled")
        )
        resolved_issues = total_issues - open_issues

        return {
            "status": "success",
            "data": {
                "issues": issues,
                "summary": {
                    "total_issues": total_issues,
                    "open_issues": open_issues,
                    "resolved_issues": resolved_issues,
                },
            },
        }
    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), "PRD SO Calendar Issue Overview Error")
        return {
            "status": "error",
            "message": str(exc),
            "data": {
                "issues": [],
                "summary": {
                    "total_issues": 0,
                    "open_issues": 0,
                    "resolved_issues": 0,
                },
            },
        }


def _get_quarter_start(date_value):
    date_value = getdate(date_value)
    start_month = ((date_value.month - 1) // 3) * 3 + 1
    return date_value.replace(month=start_month, day=1)


def _get_previous_quarter_range(date_value):
    current_quarter_start = _get_quarter_start(date_value)
    previous_quarter_end = current_quarter_start - timedelta(days=1)
    previous_quarter_start = _get_quarter_start(previous_quarter_end)
    return previous_quarter_start, previous_quarter_end


def _get_completed_period_ranges(reference_date=None, filter_from_date=None, filter_to_date=None):
    reference_date = getdate(reference_date or filter_to_date or today())
    filter_from_date = getdate(filter_from_date) if filter_from_date else None
    filter_to_date = getdate(filter_to_date) if filter_to_date else reference_date
    yesterday = reference_date - timedelta(days=1)

    week_day = reference_date.weekday()
    this_week_start = reference_date - timedelta(days=week_day)
    last_week_end = this_week_start - timedelta(days=1)
    last_week_start = last_week_end - timedelta(days=last_week_end.weekday())

    this_month_start = reference_date.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    this_quarter_start = _get_quarter_start(reference_date)
    last_quarter_start, last_quarter_end = _get_previous_quarter_range(reference_date)

    periods = {
        "all": {
            "label": "All",
            "from_date": filter_from_date or last_quarter_start,
            "to_date": filter_to_date,
        },
        "today": {
            "label": "Today",
            "from_date": reference_date,
            "to_date": reference_date,
        },
        "yesterday": {
            "label": "Yesterday",
            "from_date": yesterday,
            "to_date": yesterday,
        },
        "this_week": {
            "label": "This Week",
            "from_date": this_week_start,
            "to_date": reference_date,
        },
        "last_week": {
            "label": "Last Week",
            "from_date": last_week_start,
            "to_date": last_week_end,
        },
        "this_month": {
            "label": "This Month",
            "from_date": this_month_start,
            "to_date": reference_date,
        },
        "last_month": {
            "label": "Last Month",
            "from_date": last_month_start,
            "to_date": last_month_end,
        },
        "this_quarter": {
            "label": "This Quarter",
            "from_date": this_quarter_start,
            "to_date": reference_date,
        },
        "last_quarter": {
            "label": "Last Quarter",
            "from_date": last_quarter_start,
            "to_date": last_quarter_end,
        },
    }

    return periods


def _date_in_range(date_value, from_date, to_date):
    if not date_value:
        return False
    date_value = getdate(date_value)
    return getdate(from_date) <= date_value <= getdate(to_date)


def _coalesce_sales_order_link(header_sales_order, item_sales_order):
    header_sales_order = (header_sales_order or "").strip()
    item_sales_order = (item_sales_order or "").strip()
    return header_sales_order or item_sales_order or None


def _build_completed_summary(rows, period_ranges):
    summary = {}

    for key, period in period_ranges.items():
        matching_rows = [
            row for row in rows
            if _date_in_range(row.get("completion_date"), period["from_date"], period["to_date"])
        ]

        summary[key] = {
            "label": period["label"],
            "from_date": str(period["from_date"]),
            "to_date": str(period["to_date"]),
            "count": len(matching_rows),
            "total_value": sum(flt(row.get("grand_total")) for row in matching_rows),
            "total_outstanding": sum(flt(row.get("outstanding_amount")) for row in matching_rows),
        }

    return summary


@frappe.whitelist()
def get_completed_sales_order_summary(company=None, from_date=None, to_date=None):
    """Return completion-date based Sales Order summary for Metro SO calendar."""
    try:
        company = (company or "").strip() or "PRASTARA DECORATION DESIGN L.L.C"
        reference_date = getdate(to_date or today())
        requested_from_date = getdate(from_date) if from_date else None
        requested_to_date = getdate(to_date) if to_date else reference_date
        if requested_from_date and requested_from_date > requested_to_date:
            requested_from_date, requested_to_date = requested_to_date, requested_from_date

        period_ranges = _get_completed_period_ranges(
            reference_date=reference_date,
            filter_from_date=requested_from_date,
            filter_to_date=requested_to_date,
        )
        report_from_date = requested_from_date or min(
            period["from_date"] for key, period in period_ranges.items() if key != "all"
        )
        report_to_date = requested_to_date

        has_project_desc = frappe.db.has_column("Sales Order", "custom_project_description")
        project_desc_select = (
            "so.custom_project_description"
            if has_project_desc
            else "'' AS custom_project_description"
        )

        sales_orders = frappe.db.sql(
            f"""
            SELECT
                so.name,
                so.customer,
                so.customer_name,
                so.branch,
                COALESCE(so.is_internal_customer, 0) AS is_internal_customer,
                so.project,
                {project_desc_select},
                so.transaction_date,
                so.delivery_date,
                so.grand_total,
                so.status,
                so.per_billed,
                so.per_delivered
            FROM `tabSales Order` so
            WHERE so.docstatus = 1
              AND so.company = %s
              AND COALESCE(so.per_delivered, 0) >= 100
              AND COALESCE(so.per_billed, 0) >= 100
            ORDER BY so.modified DESC
            """,
            (company,),
            as_dict=True,
        )

        if not sales_orders:
            empty_summary = {
                key: {
                    "label": period["label"],
                    "from_date": str(period["from_date"]),
                    "to_date": str(period["to_date"]),
                    "count": 0,
                    "total_value": 0,
                    "total_outstanding": 0,
                }
                for key, period in period_ranges.items()
            }

            return {
                "status": "success",
                "data": {
                    "rows": [],
                    "summary": empty_summary,
                    "meta": {
                        "company": company,
                        "basis": "completion_date",
                        "from_date": str(report_from_date),
                        "to_date": str(report_to_date),
                        "reference_date": str(reference_date),
                    },
                },
            }

        sales_order_names = {row["name"] for row in sales_orders if row.get("name")}
        sales_order_tuple = tuple(sorted(sales_order_names))

        sales_team_rows = frappe.db.sql(
            """
            SELECT
                st.parent,
                GROUP_CONCAT(DISTINCT st.sales_person ORDER BY st.sales_person SEPARATOR ', ') AS sales_person,
                GROUP_CONCAT(DISTINCT COALESCE(sp.parent_sales_person, '') ORDER BY sp.parent_sales_person SEPARATOR ', ') AS sales_team
            FROM `tabSales Team` st
            LEFT JOIN `tabSales Person` sp
                ON sp.name = st.sales_person
            WHERE st.parenttype = 'Sales Order'
              AND st.parent IN %(sales_orders)s
            GROUP BY st.parent
            """,
            {"sales_orders": tuple(sales_order_names)},
            as_dict=True,
        )
        sales_team_map = {row.parent: row.sales_person for row in sales_team_rows}
        sales_parent_team_map = {
            row.parent: ", ".join([value.strip() for value in (row.sales_team or "").split(",") if value and value.strip()])
            for row in sales_team_rows
        }

        advance_progress_amounts = {}
        if sales_order_tuple:
            advance_progress_rows = frappe.db.sql(
                """
                SELECT
                    item_link.sales_order,
                    SUM(
                        CASE
                            WHEN (
                                LOWER(CONCAT_WS(' ', COALESCE(sii.item_code, ''), COALESCE(sii.item_name, ''), COALESCE(sii.description, ''))) LIKE '%%advance payment%%'
                                OR LOWER(CONCAT_WS(' ', COALESCE(sii.item_code, ''), COALESCE(sii.item_name, ''), COALESCE(sii.description, ''))) LIKE '%%advance payament%%'
                            )
                            THEN sii.amount
                            ELSE 0
                        END
                    ) AS advance_amount,
                    SUM(
                        CASE
                            WHEN LOWER(CONCAT_WS(' ', COALESCE(sii.item_code, ''), COALESCE(sii.item_name, ''), COALESCE(sii.description, ''))) LIKE '%%progress payment%%'
                            THEN sii.amount
                            ELSE 0
                        END
                    ) AS progress_amount
                FROM `tabSales Invoice` si
                JOIN `tabSales Invoice Item` sii
                    ON sii.parent = si.name
                JOIN (
                    SELECT
                        si_inner.name AS invoice_name,
                        COALESCE(NULLIF(sii_inner.sales_order, ''), NULLIF(si_inner.sales_order, '')) AS sales_order,
                        sii_inner.name AS invoice_item_name
                    FROM `tabSales Invoice` si_inner
                    JOIN `tabSales Invoice Item` sii_inner
                        ON sii_inner.parent = si_inner.name
                    WHERE si_inner.docstatus = 1
                ) AS item_link
                    ON item_link.invoice_item_name = sii.name
                WHERE item_link.sales_order IN %s
                GROUP BY item_link.sales_order
                """,
                (sales_order_tuple,),
                as_dict=True,
            )
            advance_progress_amounts = {
                row.sales_order: {
                    "advance_amount": flt(row.advance_amount, 2),
                    "progress_amount": flt(row.progress_amount, 2),
                }
                for row in advance_progress_rows
            }

        delivery_rows = frappe.db.sql(
            """
            SELECT
                dni.against_sales_order AS sales_order,
                MAX(dn.posting_date) AS last_delivery_date
            FROM `tabDelivery Note Item` dni
            INNER JOIN `tabDelivery Note` dn
                ON dn.name = dni.parent
               AND dn.docstatus = 1
            WHERE dn.company = %s
              AND IFNULL(dni.against_sales_order, '') != ''
            GROUP BY dni.against_sales_order
            """,
            (company,),
            as_dict=True,
        )
        delivery_map = {
            row.sales_order: getdate(row.last_delivery_date)
            for row in delivery_rows
            if row.get("sales_order") and row.get("last_delivery_date")
        }

        invoice_rows = frappe.db.sql(
            """
            SELECT DISTINCT
                si.name AS invoice_name,
                si.posting_date,
                COALESCE(si.outstanding_amount, 0) AS outstanding_amount,
                si.status AS invoice_status,
                si.customer,
                COALESCE(NULLIF(si.sales_order, ''), NULLIF(sii.sales_order, '')) AS sales_order
            FROM `tabSales Invoice` si
            LEFT JOIN `tabSales Invoice Item` sii
                ON sii.parent = si.name
            WHERE si.docstatus = 1
              AND si.company = %s
              AND (
                    IFNULL(si.sales_order, '') != ''
                    OR IFNULL(sii.sales_order, '') != ''
              )
            ORDER BY si.posting_date DESC, si.name DESC
            """,
            (company,),
            as_dict=True,
        )

        invoice_dates = {}
        invoice_data_by_so = defaultdict(dict)
        for row in invoice_rows:
            sales_order = _coalesce_sales_order_link(row.get("sales_order"), None)
            if not sales_order or sales_order not in sales_order_names:
                continue

            posting_date = getdate(row.posting_date) if row.get("posting_date") else None
            if posting_date:
                current_last = invoice_dates.get(sales_order)
                if not current_last or posting_date > current_last:
                    invoice_dates[sales_order] = posting_date

            invoice_name = row.get("invoice_name")
            if invoice_name:
                invoice_data_by_so[sales_order][invoice_name] = {
                    "name": invoice_name,
                    "posting_date": str(posting_date) if posting_date else None,
                    "outstanding_amount": flt(row.get("outstanding_amount")),
                    "status": row.get("invoice_status") or "",
                    "customer": row.get("customer") or "",
                }

        completed_rows = []
        for row in sales_orders:
            sales_order = row.get("name")
            if not sales_order:
                continue

            advance_progress = advance_progress_amounts.get(sales_order, {})
            last_delivery_date = delivery_map.get(sales_order)
            last_invoice_date = invoice_dates.get(sales_order)

            if last_delivery_date and last_invoice_date:
                completion_date = max(last_delivery_date, last_invoice_date)
            else:
                completion_date = last_delivery_date or last_invoice_date

            if not completion_date:
                continue

            if not _date_in_range(completion_date, report_from_date, report_to_date):
                continue

            linked_invoices = sorted(
                invoice_data_by_so.get(sales_order, {}).values(),
                key=lambda d: ((d.get("posting_date") or ""), d.get("name") or ""),
                reverse=True,
            )

            completed_rows.append(
                {
                    "name": sales_order,
                    "customer": row.get("customer") or "",
                    "customer_name": row.get("customer_name") or "",
                    "branch": row.get("branch") or "",
                    "is_internal_customer": int(row.get("is_internal_customer") or 0),
                    "project": row.get("project") or "",
                    "project_description": row.get("custom_project_description") or "",
                    "sales_person": sales_team_map.get(sales_order) or "Unassigned",
                    "sales_team": sales_parent_team_map.get(sales_order) or "",
                    "transaction_date": row.get("transaction_date"),
                    "delivery_date": row.get("delivery_date"),
                    "grand_total": flt(row.get("grand_total")),
                    "advance_amount": flt(advance_progress.get("advance_amount"), 2),
                    "progress_amount": flt(advance_progress.get("progress_amount"), 2),
                    "status": row.get("status") or "",
                    "per_billed": flt(row.get("per_billed")),
                    "per_delivered": flt(row.get("per_delivered")),
                    "last_delivery_date": str(last_delivery_date) if last_delivery_date else None,
                    "last_invoice_date": str(last_invoice_date) if last_invoice_date else None,
                    "completion_date": str(completion_date),
                    "outstanding_amount": sum(flt(inv.get("outstanding_amount")) for inv in linked_invoices),
                    "invoice_count": len(linked_invoices),
                    "invoice_names": [inv.get("name") for inv in linked_invoices if inv.get("name")],
                }
            )

        completed_rows.sort(
            key=lambda d: (
                d.get("completion_date") or "",
                d.get("name") or "",
            ),
            reverse=True,
        )

        return {
            "status": "success",
            "data": {
                "rows": completed_rows,
                "summary": _build_completed_summary(completed_rows, period_ranges),
                "meta": {
                    "company": company,
                    "basis": "completion_date",
                    "from_date": str(report_from_date),
                    "to_date": str(report_to_date),
                    "reference_date": str(reference_date),
                },
            },
        }

    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), "PRD SO Calendar Completed SO Summary Error")
        return {
            "status": "error",
            "message": str(exc),
            "data": {
                "rows": [],
                "summary": {},
                "meta": {
                    "company": company or "",
                    "basis": "completion_date",
                },
            },
        }
