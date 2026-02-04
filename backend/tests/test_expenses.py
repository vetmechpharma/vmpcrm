"""
Test suite for Expenses Management feature
Tests: Expense Categories CRUD, Expenses CRUD, Monthly Stats, Filters
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
TEST_EMAIL = "admin@vmpcrm.com"
TEST_PASSWORD = "admin123"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL


class TestExpenseCategories:
    """Expense Categories CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_default_categories(self, auth_headers):
        """Test getting default expense categories - should have 6 defaults"""
        response = requests.get(f"{BASE_URL}/api/expense-categories", headers=auth_headers)
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list)
        
        # Check for 6 default categories
        default_names = ["Transport/Shipping", "Office Supplies", "Salaries", "Utilities", "Marketing", "Miscellaneous"]
        category_names = [cat["name"] for cat in categories]
        
        for name in default_names:
            assert name in category_names, f"Default category '{name}' not found"
        
        # Verify default categories have is_default=True
        default_cats = [cat for cat in categories if cat.get("is_default")]
        assert len(default_cats) >= 6, f"Expected at least 6 default categories, got {len(default_cats)}"
    
    def test_create_custom_category(self, auth_headers):
        """Test creating a custom expense category"""
        category_data = {
            "name": "TEST_Custom Category",
            "description": "Test custom category for testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/expense-categories", 
                                json=category_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == category_data["name"]
        assert data["description"] == category_data["description"]
        assert data["is_default"] == False
        assert "id" in data
        
        # Store for cleanup
        return data["id"]
    
    def test_delete_custom_category(self, auth_headers):
        """Test deleting a custom (non-default) category"""
        # First create a category to delete
        category_data = {
            "name": "TEST_ToDelete Category",
            "description": "Category to be deleted"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/expense-categories", 
                                       json=category_data, headers=auth_headers)
        assert create_response.status_code == 200
        category_id = create_response.json()["id"]
        
        # Delete the category
        delete_response = requests.delete(f"{BASE_URL}/api/expense-categories/{category_id}", 
                                         headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/expense-categories", headers=auth_headers)
        categories = get_response.json()
        category_ids = [cat["id"] for cat in categories]
        assert category_id not in category_ids
    
    def test_cannot_delete_default_category(self, auth_headers):
        """Test that default categories cannot be deleted"""
        # Get categories and find a default one
        response = requests.get(f"{BASE_URL}/api/expense-categories", headers=auth_headers)
        categories = response.json()
        
        default_cat = next((cat for cat in categories if cat.get("is_default")), None)
        assert default_cat is not None, "No default category found"
        
        # Try to delete it
        delete_response = requests.delete(f"{BASE_URL}/api/expense-categories/{default_cat['id']}", 
                                         headers=auth_headers)
        assert delete_response.status_code == 400
        assert "Cannot delete default" in delete_response.json().get("detail", "")


class TestExpensesCRUD:
    """Expenses CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def category_id(self, auth_headers):
        """Get a category ID for testing"""
        response = requests.get(f"{BASE_URL}/api/expense-categories", headers=auth_headers)
        categories = response.json()
        # Use Office Supplies category
        cat = next((c for c in categories if c["name"] == "Office Supplies"), categories[0])
        return cat["id"]
    
    def test_create_expense_with_all_fields(self, auth_headers, category_id):
        """Test creating an expense with all fields"""
        today = datetime.now().strftime('%Y-%m-%d')
        expense_data = {
            "category_id": category_id,
            "date": today,
            "amount": 1234.56,
            "payment_type": "cash",
            "payment_account": "company_account",
            "paid_by": "Test User",
            "reason": "TEST_Expense for testing purposes"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", 
                                json=expense_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["category_id"] == category_id
        assert data["date"] == today
        assert data["amount"] == 1234.56
        assert data["payment_type"] == "cash"
        assert data["payment_account"] == "company_account"
        assert data["paid_by"] == "Test User"
        assert data["reason"] == "TEST_Expense for testing purposes"
        assert data["is_auto_generated"] == False
        assert "id" in data
        
        return data["id"]
    
    def test_create_expense_card_payment(self, auth_headers, category_id):
        """Test creating expense with card payment type"""
        expense_data = {
            "category_id": category_id,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "amount": 500.00,
            "payment_type": "card",
            "payment_account": "admin_user",
            "paid_by": "Admin",
            "reason": "TEST_Card payment expense"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", 
                                json=expense_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["payment_type"] == "card"
        assert data["payment_account"] == "admin_user"
    
    def test_create_expense_upi_payment(self, auth_headers, category_id):
        """Test creating expense with UPI payment type"""
        expense_data = {
            "category_id": category_id,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "amount": 250.00,
            "payment_type": "upi",
            "payment_account": "employee_user",
            "paid_by": "Employee Name",
            "reason": "TEST_UPI payment expense"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", 
                                json=expense_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["payment_type"] == "upi"
        assert data["payment_account"] == "employee_user"
    
    def test_create_expense_net_banking(self, auth_headers, category_id):
        """Test creating expense with net banking payment type"""
        expense_data = {
            "category_id": category_id,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "amount": 10000.00,
            "payment_type": "net_banking",
            "payment_account": "company_account",
            "reason": "TEST_Net banking payment expense"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", 
                                json=expense_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["payment_type"] == "net_banking"
    
    def test_list_expenses(self, auth_headers):
        """Test listing all expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200
        
        expenses = response.json()
        assert isinstance(expenses, list)
        # Should have at least the test expenses we created
        assert len(expenses) >= 1
    
    def test_list_expenses_filter_by_date_range(self, auth_headers):
        """Test filtering expenses by date range"""
        today = datetime.now().strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        response = requests.get(f"{BASE_URL}/api/expenses", 
                               params={"start_date": yesterday, "end_date": today},
                               headers=auth_headers)
        assert response.status_code == 200
        
        expenses = response.json()
        assert isinstance(expenses, list)
        # All returned expenses should be within date range
        for exp in expenses:
            assert exp["date"] >= yesterday
            assert exp["date"] <= today
    
    def test_list_expenses_filter_by_category(self, auth_headers, category_id):
        """Test filtering expenses by category"""
        response = requests.get(f"{BASE_URL}/api/expenses", 
                               params={"category_id": category_id},
                               headers=auth_headers)
        assert response.status_code == 200
        
        expenses = response.json()
        assert isinstance(expenses, list)
        # All returned expenses should have the specified category
        for exp in expenses:
            assert exp["category_id"] == category_id
    
    def test_list_expenses_filter_by_payment_type(self, auth_headers):
        """Test filtering expenses by payment type"""
        response = requests.get(f"{BASE_URL}/api/expenses", 
                               params={"payment_type": "cash"},
                               headers=auth_headers)
        assert response.status_code == 200
        
        expenses = response.json()
        assert isinstance(expenses, list)
        for exp in expenses:
            assert exp["payment_type"] == "cash"
    
    def test_list_expenses_filter_by_payment_account(self, auth_headers):
        """Test filtering expenses by payment account"""
        response = requests.get(f"{BASE_URL}/api/expenses", 
                               params={"payment_account": "company_account"},
                               headers=auth_headers)
        assert response.status_code == 200
        
        expenses = response.json()
        assert isinstance(expenses, list)
        for exp in expenses:
            assert exp["payment_account"] == "company_account"
    
    def test_update_expense(self, auth_headers, category_id):
        """Test updating an expense"""
        # First create an expense
        expense_data = {
            "category_id": category_id,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "amount": 100.00,
            "payment_type": "cash",
            "payment_account": "company_account",
            "reason": "TEST_Original reason"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/expenses", 
                                       json=expense_data, headers=auth_headers)
        assert create_response.status_code == 200
        expense_id = create_response.json()["id"]
        
        # Update the expense
        update_data = {
            "amount": 200.00,
            "reason": "TEST_Updated reason",
            "payment_type": "card"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/expenses/{expense_id}", 
                                      json=update_data, headers=auth_headers)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["amount"] == 200.00
        assert updated["reason"] == "TEST_Updated reason"
        assert updated["payment_type"] == "card"
    
    def test_delete_expense(self, auth_headers, category_id):
        """Test deleting an expense"""
        # First create an expense
        expense_data = {
            "category_id": category_id,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "amount": 50.00,
            "payment_type": "cash",
            "payment_account": "company_account",
            "reason": "TEST_Expense to delete"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/expenses", 
                                       json=expense_data, headers=auth_headers)
        assert create_response.status_code == 200
        expense_id = create_response.json()["id"]
        
        # Delete the expense
        delete_response = requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", 
                                         headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify it's deleted - should not appear in list
        list_response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        expenses = list_response.json()
        expense_ids = [exp["id"] for exp in expenses]
        assert expense_id not in expense_ids


class TestExpenseStats:
    """Expense Statistics tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_monthly_stats(self, auth_headers):
        """Test getting monthly expense statistics"""
        response = requests.get(f"{BASE_URL}/api/expenses/stats/monthly", headers=auth_headers)
        assert response.status_code == 200
        
        stats = response.json()
        
        # Verify required fields
        assert "current_month_total" in stats
        assert "previous_month_total" in stats
        assert "change_percent" in stats
        assert "by_category" in stats
        assert "expense_count" in stats
        
        # Verify data types
        assert isinstance(stats["current_month_total"], (int, float))
        assert isinstance(stats["previous_month_total"], (int, float))
        assert isinstance(stats["change_percent"], (int, float))
        assert isinstance(stats["by_category"], dict)
        assert isinstance(stats["expense_count"], int)
    
    def test_stats_by_category_breakdown(self, auth_headers):
        """Test that stats include category breakdown"""
        response = requests.get(f"{BASE_URL}/api/expenses/stats/monthly", headers=auth_headers)
        assert response.status_code == 200
        
        stats = response.json()
        by_category = stats.get("by_category", {})
        
        # If there are expenses this month, by_category should have entries
        if stats["expense_count"] > 0:
            assert len(by_category) > 0, "Expected category breakdown for expenses"


class TestDashboardExpenseSummary:
    """Test Dashboard expense summary integration"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats_endpoint(self, auth_headers):
        """Test dashboard stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        
        stats = response.json()
        assert "total_doctors" in stats
        assert "by_status" in stats


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_cleanup_test_expenses(self, auth_headers):
        """Clean up TEST_ prefixed expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        expenses = response.json()
        
        deleted_count = 0
        for exp in expenses:
            if exp.get("reason", "").startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/expenses/{exp['id']}", 
                                                 headers=auth_headers)
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test expenses")
        assert True  # Always pass cleanup
    
    def test_cleanup_test_categories(self, auth_headers):
        """Clean up TEST_ prefixed categories"""
        response = requests.get(f"{BASE_URL}/api/expense-categories", headers=auth_headers)
        categories = response.json()
        
        deleted_count = 0
        for cat in categories:
            if cat.get("name", "").startswith("TEST_") and not cat.get("is_default"):
                delete_response = requests.delete(f"{BASE_URL}/api/expense-categories/{cat['id']}", 
                                                 headers=auth_headers)
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test categories")
        assert True  # Always pass cleanup


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
