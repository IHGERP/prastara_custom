import frappe
import json
from datetime import datetime, timedelta
import random

@frappe.whitelist()
def test_dashboard_data():
    """Generate test data for ARM Dashboard"""

    # Generate sample data for testing
    test_data = {
        "total_outstanding": 15250000,  # 15.25 Cr
        "overdue_amount": 3450000,      # 34.5 L
        "dso": 45,                      # Days Sales Outstanding
        "collection_efficiency": 82.5,  # Percentage

        # Change indicators (percentage from last month)
        "outstanding_change": 12.5,
        "overdue_change": -5.2,
        "dso_change": 0,
        "efficiency_change": 2.1,

        # Trend data for charts
        "trend_data": [
            {"month": "Apr 2024", "outstanding": 13500000, "collections": 8200000},
            {"month": "May 2024", "outstanding": 14200000, "collections": 9100000},
            {"month": "Jun 2024", "outstanding": 14800000, "collections": 8900000},
            {"month": "Jul 2024", "outstanding": 15250000, "collections": 9500000},
        ],

        # Aging distribution
        "aging_data": {
            "0-30": 8500000,    # 55.7%
            "31-60": 3200000,   # 21.0%
            "61-90": 2100000,   # 13.8%
            "90+": 1450000      # 9.5%
        },

        # Top customers with outstanding
        "top_customers": [
            {
                "customer": "CUST-001",
                "customer_name": "ABC Industries Ltd",
                "outstanding_amount": 2500000,
                "overdue_days": 15,
                "last_payment_date": "2024-07-10"
            },
            {
                "customer": "CUST-002",
                "customer_name": "XYZ Corp",
                "outstanding_amount": 1850000,
                "overdue_days": 45,
                "last_payment_date": "2024-06-20"
            },
            {
                "customer": "CUST-003",
                "customer_name": "PQR Enterprises",
                "outstanding_amount": 1200000,
                "overdue_days": 92,
                "last_payment_date": "2024-04-15"
            },
            {
                "customer": "CUST-004",
                "customer_name": "LMN Solutions",
                "outstanding_amount": 950000,
                "overdue_days": 8,
                "last_payment_date": "2024-07-18"
            },
            {
                "customer": "CUST-005",
                "customer_name": "DEF Technologies",
                "outstanding_amount": 750000,
                "overdue_days": 67,
                "last_payment_date": "2024-05-25"
            }
        ]
    }

    return test_data

@frappe.whitelist()
def test_sales_person_data():
    """Generate test sales person data for ARM Dashboard"""

    test_data = {
        "top_collector": {
            "name": "John Smith",
            "amount": 5200000
        },
        "best_rate": {
            "name": "Sarah Johnson",
            "rate": 89.5
        },
        "fastest": {
            "name": "Mike Chen",
            "days": 28
        },

        "sales_persons": [
            {
                "sales_person": "John Smith",
                "territory": "North Zone",
                "total_outstanding": 5200000,
                "collections_mtd": 3200000,
                "collection_rate": 85.2,
                "avg_collection_days": 35,
                "customer_count": 45,
                "overdue_amount": 1200000
            },
            {
                "sales_person": "Sarah Johnson",
                "territory": "South Zone",
                "total_outstanding": 4800000,
                "collections_mtd": 2950000,
                "collection_rate": 89.5,
                "avg_collection_days": 32,
                "customer_count": 38,
                "overdue_amount": 850000
            },
            {
                "sales_person": "Mike Chen",
                "territory": "East Zone",
                "total_outstanding": 3200000,
                "collections_mtd": 2100000,
                "collection_rate": 78.3,
                "avg_collection_days": 28,
                "customer_count": 32,
                "overdue_amount": 950000
            },
            {
                "sales_person": "Lisa Wong",
                "territory": "West Zone",
                "total_outstanding": 2050000,
                "collections_mtd": 1450000,
                "collection_rate": 82.1,
                "avg_collection_days": 38,
                "customer_count": 28,
                "overdue_amount": 450000
            }
        ]
    }

    return test_data

# Function to validate dashboard functionality
def validate_dashboard():
    """Validate that the dashboard can load basic data"""

    try:
        # Test the API endpoints
        outstanding_data = test_dashboard_data()
        sales_person_data = test_sales_person_data()

        print("✅ Dashboard data validation successful")
        print(f"   - Total Outstanding: ₹{outstanding_data['total_outstanding']:,}")
        print(f"   - Top Customers: {len(outstanding_data['top_customers'])}")
        print(f"   - Sales Persons: {len(sales_person_data['sales_persons'])}")

        return True

    except Exception as e:
        print(f"❌ Dashboard validation failed: {str(e)}")
        return False

if __name__ == "__main__":
    validate_dashboard()