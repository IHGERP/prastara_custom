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
        frappe.log_error(frappe.get_traceback(), "Metro SO Calendar Quick Search Error")
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
        frappe.log_error(frappe.get_traceback(), "Metro SO Calendar Project Overview Error")
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


