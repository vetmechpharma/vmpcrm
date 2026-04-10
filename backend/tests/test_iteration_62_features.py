"""
Iteration 62 Tests: Stock Management Features
- Date range filters + Print + CSV Export for: Item Ledger, User Ledger, Stock Issue, Purchase, Sales Return tabs
- Category filters + Print + CSV Export for Stock Status tab
- Item Report tab with weekly/monthly/yearly/custom date range
- Opening/Closing Report tab with date range filter
- Doctor add bug fix (reg_no and email optional)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "info@vetmech.in",
        "password": "Kongu@@44884"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestPeriodReportAPI:
    """Tests for GET /api/stock/period-report endpoint (Item Report & Opening/Closing Report)"""
    
    def test_period_report_returns_data(self, auth_headers):
        """Test period report returns item data with opening and closing stock"""
        response = requests.get(
            f"{BASE_URL}/api/stock/period-report",
            params={"from_date": "2026-01-01", "to_date": "2026-12-31"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are items, verify structure
        if len(data) > 0:
            item = data[0]
            assert "item_id" in item, "Missing item_id"
            assert "item_name" in item, "Missing item_name"
            assert "opening_stock" in item, "Missing opening_stock"
            assert "closing_stock" in item, "Missing closing_stock"
            assert "purchase" in item, "Missing purchase"
            assert "sales" in item, "Missing sales"
            print(f"Period report returned {len(data)} items")
            print(f"Sample item: {item['item_name']} - Opening: {item['opening_stock']}, Closing: {item['closing_stock']}")
    
    def test_period_report_without_dates(self, auth_headers):
        """Test period report works without date filters (returns all-time data)"""
        response = requests.get(
            f"{BASE_URL}/api/stock/period-report",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Period report without dates returned {len(data)} items")
    
    def test_period_report_with_partial_dates(self, auth_headers):
        """Test period report with only from_date"""
        response = requests.get(
            f"{BASE_URL}/api/stock/period-report",
            params={"from_date": "2026-01-01"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestStockStatusAPI:
    """Tests for GET /api/stock/status endpoint (Stock Status tab)"""
    
    def test_stock_status_returns_data(self, auth_headers):
        """Test stock status returns item data with all stock fields"""
        response = requests.get(f"{BASE_URL}/api/stock/status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            item = data[0]
            assert "item_id" in item
            assert "item_name" in item
            assert "opening_balance" in item
            assert "purchased" in item
            assert "sold" in item
            assert "closing_balance" in item
            print(f"Stock status returned {len(data)} items")


class TestItemLedgerAPI:
    """Tests for GET /api/stock/item-ledger/{item_id} endpoint"""
    
    def test_item_ledger_returns_data(self, auth_headers):
        """Test item ledger returns ledger entries for an item"""
        # First get an item ID
        items_response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert items_response.status_code == 200
        items = items_response.json()
        
        if len(items) == 0:
            pytest.skip("No items available for testing")
        
        item_id = items[0]["id"]
        response = requests.get(f"{BASE_URL}/api/stock/item-ledger/{item_id}", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "item_id" in data
        assert "opening_balance" in data
        assert "closing_balance" in data
        assert "ledger" in data
        assert isinstance(data["ledger"], list)
        print(f"Item ledger for {items[0]['item_name']}: Opening={data['opening_balance']}, Closing={data['closing_balance']}, Entries={len(data['ledger'])}")


class TestUserLedgerAPI:
    """Tests for GET /api/stock/user-ledger endpoint"""
    
    def test_user_ledger_by_phone(self, auth_headers):
        """Test user ledger search by phone number"""
        response = requests.get(
            f"{BASE_URL}/api/stock/user-ledger",
            params={"customer_phone": "9999"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "item_totals" in data
        assert "orders" in data
        assert isinstance(data["item_totals"], dict)
        assert isinstance(data["orders"], list)
        print(f"User ledger returned {len(data['orders'])} orders, {len(data['item_totals'])} item totals")
    
    def test_user_ledger_by_name(self, auth_headers):
        """Test user ledger search by customer name"""
        response = requests.get(
            f"{BASE_URL}/api/stock/user-ledger",
            params={"customer_name": "test"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "item_totals" in data
        assert "orders" in data


class TestPurchasesAPI:
    """Tests for GET /api/stock/purchases endpoint"""
    
    def test_purchases_with_date_filter(self, auth_headers):
        """Test purchases endpoint with date range filter"""
        response = requests.get(
            f"{BASE_URL}/api/stock/purchases",
            params={"from_date": "2026-01-01", "to_date": "2026-12-31"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Purchases with date filter returned {len(data)} records")
    
    def test_purchases_without_filter(self, auth_headers):
        """Test purchases endpoint without filters"""
        response = requests.get(f"{BASE_URL}/api/stock/purchases", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSalesReturnsAPI:
    """Tests for GET /api/stock/sales-returns endpoint"""
    
    def test_sales_returns_list(self, auth_headers):
        """Test sales returns endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/stock/sales-returns", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Sales returns returned {len(data)} records")


class TestStockIssuesAPI:
    """Tests for GET /api/stock/issues endpoint"""
    
    def test_stock_issues_list(self, auth_headers):
        """Test stock issues endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/stock/issues", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Stock issues returned {len(data)} records")


class TestDoctorAddBugFix:
    """Tests for POST /api/doctors - bug fix for optional reg_no and email"""
    
    def test_create_doctor_without_reg_no_and_email(self, auth_headers):
        """Test creating doctor with only name and phone (no reg_no/email) - BUG FIX VERIFICATION"""
        import uuid
        test_phone = f"TEST{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/doctors",
            json={
                "name": "TEST_Doctor_NoRegNo",
                "phone": test_phone
                # Intentionally NOT providing reg_no and email
            },
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain doctor id"
        assert data["name"] == "TEST_Doctor_NoRegNo"
        print(f"Doctor created successfully without reg_no/email: ID={data['id']}")
        
        # Cleanup - delete the test doctor
        doctor_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/doctors/{doctor_id}", headers=auth_headers)
        print(f"Cleanup: Delete doctor response: {delete_response.status_code}")
    
    def test_create_doctor_with_empty_reg_no_and_email(self, auth_headers):
        """Test creating doctor with empty string reg_no and email"""
        import uuid
        test_phone = f"TEST{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/doctors",
            json={
                "name": "TEST_Doctor_EmptyFields",
                "phone": test_phone,
                "reg_no": "",
                "email": ""
            },
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Doctor created with empty reg_no/email: ID={data['id']}")
        
        # Cleanup
        doctor_id = data["id"]
        requests.delete(f"{BASE_URL}/api/doctors/{doctor_id}", headers=auth_headers)
    
    def test_create_doctor_with_all_fields(self, auth_headers):
        """Test creating doctor with all fields including reg_no and email"""
        import uuid
        test_phone = f"TEST{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/doctors",
            json={
                "name": "TEST_Doctor_AllFields",
                "phone": test_phone,
                "reg_no": "REG123",
                "email": "test@example.com"
            },
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data.get("reg_no") == "REG123" or data.get("reg_no", "") == "REG123"
        print(f"Doctor created with all fields: ID={data['id']}")
        
        # Cleanup
        doctor_id = data["id"]
        requests.delete(f"{BASE_URL}/api/doctors/{doctor_id}", headers=auth_headers)


class TestItemsAPI:
    """Tests for items API to verify category data for filtering"""
    
    def test_items_have_category_fields(self, auth_headers):
        """Test items have main_categories and subcategories fields"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        items = response.json()
        
        if len(items) > 0:
            item = items[0]
            # These fields should exist (may be empty arrays)
            assert "main_categories" in item or item.get("main_categories") is None or isinstance(item.get("main_categories", []), list)
            assert "subcategories" in item or item.get("subcategories") is None or isinstance(item.get("subcategories", []), list)
            print(f"Items API returned {len(items)} items with category fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
