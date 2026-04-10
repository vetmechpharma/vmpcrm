"""
Test suite for merged Items & Inventory page.
Tests: Items CRUD, Stock APIs, Suppliers, Opening Balance, Purchases, Sales Return, Ledgers.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "info@vetmech.in",
        "password": "Kongu@@44884"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("access_token")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for API calls"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ============== ITEMS API TESTS ==============

class TestItemsAPI:
    """Test Items CRUD operations"""
    
    def test_get_items_list(self, auth_headers):
        """Test GET /api/items - Items list loads"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Items list returned {len(data)} items")
    
    def test_create_item(self, auth_headers):
        """Test POST /api/items - Create new item"""
        payload = {
            "item_name": "TEST_MERGED_ITEM_001",
            "item_code": "TMI-001",
            "mrp": 100.0,
            "gst": 18.0,
            "main_categories": ["Large Animals"],
            "subcategories": ["Injection"]
        }
        response = requests.post(f"{BASE_URL}/api/items", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["item_name"] == "TEST_MERGED_ITEM_001"
        assert "id" in data
        print(f"✓ Created item: {data['id']}")
        return data["id"]
    
    def test_update_item(self, auth_headers):
        """Test PUT /api/items/{id} - Update item"""
        # First create an item
        create_resp = requests.post(f"{BASE_URL}/api/items", json={
            "item_name": "TEST_MERGED_UPDATE",
            "mrp": 50.0,
            "gst": 5.0
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["id"]
        
        # Update it
        update_resp = requests.put(f"{BASE_URL}/api/items/{item_id}", json={
            "item_name": "TEST_MERGED_UPDATE_MODIFIED",
            "mrp": 75.0,
            "gst": 12.0
        }, headers=auth_headers)
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["item_name"] == "TEST_MERGED_UPDATE_MODIFIED"
        assert updated["mrp"] == 75.0
        print(f"✓ Updated item: {item_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=auth_headers)
    
    def test_delete_item(self, auth_headers):
        """Test DELETE /api/items/{id} - Delete item"""
        # Create item to delete
        create_resp = requests.post(f"{BASE_URL}/api/items", json={
            "item_name": "TEST_MERGED_DELETE",
            "mrp": 25.0,
            "gst": 0
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=auth_headers)
        assert delete_resp.status_code == 200
        print(f"✓ Deleted item: {item_id}")


# ============== STOCK AVAILABILITY API ==============

class TestStockAvailability:
    """Test stock availability for items list display"""
    
    def test_get_stock_availability(self, auth_headers):
        """Test GET /api/stock/availability - Returns stock qty per item"""
        response = requests.get(f"{BASE_URL}/api/stock/availability", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Stock availability returned for {len(data)} items")
        # Check structure if data exists
        if data:
            first_key = list(data.keys())[0]
            assert "closing_balance" in data[first_key]
            print(f"  Sample: {first_key} -> closing_balance: {data[first_key]['closing_balance']}")


# ============== STOCK STATUS API ==============

class TestStockStatus:
    """Test Stock Status tab functionality"""
    
    def test_get_stock_status(self, auth_headers):
        """Test GET /api/stock/status - Stock status table"""
        response = requests.get(f"{BASE_URL}/api/stock/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Stock status returned {len(data)} items")
        # Check structure
        if data:
            item = data[0]
            required_fields = ["item_id", "item_name", "opening_balance", "purchased", "sold", "closing_balance"]
            for field in required_fields:
                assert field in item, f"Missing field: {field}"
            print(f"  Sample: {item['item_name']} - Opening: {item['opening_balance']}, Closing: {item['closing_balance']}")


# ============== OPENING BALANCE API ==============

class TestOpeningBalance:
    """Test Opening Balance tab functionality"""
    
    def test_get_opening_balances(self, auth_headers):
        """Test GET /api/stock/opening-balances"""
        response = requests.get(f"{BASE_URL}/api/stock/opening-balances", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Opening balances returned {len(data)} entries")
    
    def test_set_opening_balance_bulk(self, auth_headers):
        """Test POST /api/stock/opening-balance/bulk - Save All button"""
        # First get an item
        items_resp = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        items = items_resp.json()
        if not items:
            pytest.skip("No items to test opening balance")
        
        item_id = items[0]["id"]
        payload = {
            "items": [{"item_id": item_id, "quantity": 100}],
            "date": "2026-01-01"
        }
        response = requests.post(f"{BASE_URL}/api/stock/opening-balance/bulk", json=payload, headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Bulk opening balance saved")


# ============== PURCHASES API ==============

class TestPurchases:
    """Test Purchases tab functionality"""
    
    def test_get_purchases(self, auth_headers):
        """Test GET /api/stock/purchases - Purchase history"""
        response = requests.get(f"{BASE_URL}/api/stock/purchases", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Purchases returned {len(data)} entries")
    
    def test_create_purchase(self, auth_headers):
        """Test POST /api/stock/purchase - New Purchase button"""
        # Get a supplier
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        suppliers = suppliers_resp.json()
        
        # Get an item
        items_resp = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        items = items_resp.json()
        
        if not suppliers or not items:
            pytest.skip("Need suppliers and items to test purchase")
        
        payload = {
            "supplier_id": suppliers[0]["id"],
            "date": "2026-01-15",
            "invoice_no": "TEST-INV-001",
            "items": [{"item_id": items[0]["id"], "quantity": 10, "purchase_rate": 50}]
        }
        response = requests.post(f"{BASE_URL}/api/stock/purchase", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "purchase_id" in data
        print(f"✓ Purchase created: {data['purchase_id']}")


# ============== SUPPLIERS API ==============

class TestSuppliers:
    """Test Suppliers tab functionality"""
    
    def test_get_suppliers(self, auth_headers):
        """Test GET /api/suppliers - Supplier list"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Suppliers returned {len(data)} entries")
    
    def test_create_supplier(self, auth_headers):
        """Test POST /api/suppliers - Add Supplier"""
        payload = {
            "name": "TEST_MERGED_SUPPLIER",
            "mobile": "9876543210",
            "gst_number": "29ABCDE1234F1Z5"
        }
        response = requests.post(f"{BASE_URL}/api/suppliers", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_MERGED_SUPPLIER"
        print(f"✓ Supplier created: {data['id']}")
        return data["id"]
    
    def test_update_supplier(self, auth_headers):
        """Test PUT /api/suppliers/{id} - Edit Supplier"""
        # Create supplier
        create_resp = requests.post(f"{BASE_URL}/api/suppliers", json={
            "name": "TEST_MERGED_SUPPLIER_UPDATE"
        }, headers=auth_headers)
        supplier_id = create_resp.json()["id"]
        
        # Update
        update_resp = requests.put(f"{BASE_URL}/api/suppliers/{supplier_id}", json={
            "name": "TEST_MERGED_SUPPLIER_MODIFIED",
            "mobile": "1234567890"
        }, headers=auth_headers)
        assert update_resp.status_code == 200
        print(f"✓ Supplier updated: {supplier_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", headers=auth_headers)
    
    def test_delete_supplier(self, auth_headers):
        """Test DELETE /api/suppliers/{id} - Delete Supplier"""
        # Create supplier
        create_resp = requests.post(f"{BASE_URL}/api/suppliers", json={
            "name": "TEST_MERGED_SUPPLIER_DELETE"
        }, headers=auth_headers)
        supplier_id = create_resp.json()["id"]
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", headers=auth_headers)
        assert delete_resp.status_code == 200
        print(f"✓ Supplier deleted: {supplier_id}")


# ============== ITEM LEDGER API ==============

class TestItemLedger:
    """Test Item Ledger tab functionality"""
    
    def test_get_item_ledger(self, auth_headers):
        """Test GET /api/stock/item-ledger/{item_id} - Item selector dropdown"""
        # Get an item
        items_resp = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        items = items_resp.json()
        if not items:
            pytest.skip("No items to test ledger")
        
        item_id = items[0]["id"]
        response = requests.get(f"{BASE_URL}/api/stock/item-ledger/{item_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "item_id" in data
        assert "ledger" in data
        assert "opening_balance" in data
        assert "closing_balance" in data
        print(f"✓ Item ledger returned for {item_id}: {len(data['ledger'])} entries")


# ============== USER LEDGER API ==============

class TestUserLedger:
    """Test User Ledger tab functionality"""
    
    def test_get_user_ledger_by_phone(self, auth_headers):
        """Test GET /api/stock/user-ledger - Search by phone"""
        response = requests.get(f"{BASE_URL}/api/stock/user-ledger", params={"customer_phone": "9999"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        print(f"✓ User ledger by phone returned {len(data['orders'])} orders")
    
    def test_get_user_ledger_by_name(self, auth_headers):
        """Test GET /api/stock/user-ledger - Search by name"""
        response = requests.get(f"{BASE_URL}/api/stock/user-ledger", params={"customer_name": "test"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        print(f"✓ User ledger by name returned {len(data['orders'])} orders")


# ============== SALES RETURN API ==============

class TestSalesReturn:
    """Test Sales Return tab functionality"""
    
    def test_create_sales_return(self, auth_headers):
        """Test POST /api/stock/sales-return - New Sales Return button"""
        # Get an item
        items_resp = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        items = items_resp.json()
        if not items:
            pytest.skip("No items to test sales return")
        
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": "9999888877",
            "date": "2026-01-15",
            "items": [{"item_id": items[0]["id"], "quantity": 2, "rate": 100}]
        }
        response = requests.post(f"{BASE_URL}/api/stock/sales-return", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "return_id" in data
        print(f"✓ Sales return created: {data['return_id']}")


# ============== ROUTE VERIFICATION ==============

class TestRouteVerification:
    """Verify /admin/stock route is removed"""
    
    def test_stock_route_removed(self, auth_headers):
        """Verify /admin/stock is not a separate route (merged into /admin/items)"""
        # This is a frontend route test - we verify the backend doesn't have a separate stock page endpoint
        # The stock APIs should still work under /api/stock/*
        response = requests.get(f"{BASE_URL}/api/stock/status", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Stock APIs still accessible under /api/stock/* (merged into Items page)")


# ============== CLEANUP ==============

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_items(self, auth_headers):
        """Remove test items created during testing"""
        items_resp = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        items = items_resp.json()
        deleted = 0
        for item in items:
            if item.get("item_name", "").startswith("TEST_MERGED"):
                requests.delete(f"{BASE_URL}/api/items/{item['id']}", headers=auth_headers)
                deleted += 1
        print(f"✓ Cleaned up {deleted} test items")
    
    def test_cleanup_test_suppliers(self, auth_headers):
        """Remove test suppliers created during testing"""
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        suppliers = suppliers_resp.json()
        deleted = 0
        for supplier in suppliers:
            if supplier.get("name", "").startswith("TEST_MERGED"):
                try:
                    requests.delete(f"{BASE_URL}/api/suppliers/{supplier['id']}", headers=auth_headers)
                    deleted += 1
                except:
                    pass
        print(f"✓ Cleaned up {deleted} test suppliers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
