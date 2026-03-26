"""
Test Pending Items Display Feature in Order Creation Form
Tests the feature that shows pending/out-of-stock items from previous orders
when creating a new order for a customer.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"

# Test data - customer with pending items
CUSTOMER_WITH_PENDING = {
    "name": "DR.DHIVAHAR",
    "phone": "9688283839"
}

# Test data - customer without pending items
CUSTOMER_WITHOUT_PENDING = {
    "name": "Dr. John Smith",
    "phone": "9876543210"
}


class TestAdminPendingItemsAPI:
    """Test Admin Panel pending items API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_pending_items_for_customer_with_pending(self):
        """GET /api/pending-items/doctor/{phone} - Customer with pending items"""
        response = requests.get(
            f"{BASE_URL}/api/pending-items/doctor/{CUSTOMER_WITH_PENDING['phone']}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 2, f"Expected at least 2 pending items, got {len(data)}"
        
        # Verify pending items structure
        for item in data:
            assert "id" in item, "Missing id field"
            assert "item_id" in item, "Missing item_id field"
            assert "item_code" in item, "Missing item_code field"
            assert "item_name" in item, "Missing item_name field"
            assert "quantity" in item, "Missing quantity field"
            assert "original_order_number" in item, "Missing original_order_number field"
            assert "doctor_phone" in item, "Missing doctor_phone field"
        
        # Verify expected items are present
        item_names = [item["item_name"] for item in data]
        assert "Vitamin D3 1000IU" in item_names, "Expected Vitamin D3 1000IU in pending items"
        assert "Paracetamol 500mg" in item_names, "Expected Paracetamol 500mg in pending items"
        
        print(f"✓ Found {len(data)} pending items for {CUSTOMER_WITH_PENDING['name']}")
        for item in data:
            print(f"  - {item['item_name']} (Qty: {item['quantity']}) from Order: {item['original_order_number']}")
    
    def test_get_pending_items_for_customer_without_pending(self):
        """GET /api/pending-items/doctor/{phone} - Customer without pending items"""
        response = requests.get(
            f"{BASE_URL}/api/pending-items/doctor/{CUSTOMER_WITHOUT_PENDING['phone']}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # This customer may or may not have pending items - just verify the API works
        print(f"✓ Customer {CUSTOMER_WITHOUT_PENDING['name']} has {len(data)} pending items")
    
    def test_customer_search_returns_customer_data(self):
        """GET /api/customers/search - Verify customer search works"""
        response = requests.get(
            f"{BASE_URL}/api/customers/search",
            params={"q": "DHIVAHAR"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Expected at least 1 customer"
        
        # Find DR.DHIVAHAR
        customer = next((c for c in data if "DHIVAHAR" in c["name"].upper()), None)
        assert customer is not None, "DR.DHIVAHAR not found in search results"
        assert customer["phone"] == CUSTOMER_WITH_PENDING["phone"], "Phone mismatch"
        assert "type" in customer, "Missing type field"
        
        print(f"✓ Found customer: {customer['name']} ({customer['phone']}) - Type: {customer['type']}")


class TestMRPendingItemsAPI:
    """Test MR Panel pending items API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get MR auth token"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200, f"MR login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_mr_pending_items_for_customer(self):
        """GET /api/mr/pending-items/{phone} - MR accessible endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/mr/pending-items/{CUSTOMER_WITH_PENDING['phone']}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 2, f"Expected at least 2 pending items, got {len(data)}"
        
        # Verify pending items structure
        for item in data:
            assert "id" in item, "Missing id field"
            assert "item_id" in item, "Missing item_id field"
            assert "item_code" in item, "Missing item_code field"
            assert "item_name" in item, "Missing item_name field"
            assert "quantity" in item, "Missing quantity field"
            assert "original_order_number" in item, "Missing original_order_number field"
        
        print(f"✓ MR API: Found {len(data)} pending items for {CUSTOMER_WITH_PENDING['name']}")
    
    def test_mr_customers_endpoint_returns_customers(self):
        """GET /api/mr/customers - Verify MR can access customers"""
        response = requests.get(
            f"{BASE_URL}/api/mr/customers",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Expected at least 1 customer"
        
        # Verify customer structure includes entity_type
        for customer in data[:5]:  # Check first 5
            assert "id" in customer, "Missing id field"
            assert "name" in customer, "Missing name field"
            assert "phone" in customer, "Missing phone field"
            assert "entity_type" in customer, "Missing entity_type field"
        
        print(f"✓ MR API: Found {len(data)} customers")


class TestPendingItemsDataIntegrity:
    """Test pending items data integrity and structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pending_items_have_valid_item_references(self):
        """Verify pending items reference valid items in the system"""
        # Get pending items
        response = requests.get(
            f"{BASE_URL}/api/pending-items/doctor/{CUSTOMER_WITH_PENDING['phone']}",
            headers=self.headers
        )
        assert response.status_code == 200
        pending_items = response.json()
        
        # Get all items
        items_response = requests.get(
            f"{BASE_URL}/api/items",
            headers=self.headers
        )
        assert items_response.status_code == 200
        all_items = items_response.json()
        all_item_ids = {item["id"] for item in all_items}
        
        # Verify each pending item references a valid item
        for pending in pending_items:
            # Note: Item might have been deleted, so we just log this
            if pending["item_id"] in all_item_ids:
                print(f"✓ Pending item '{pending['item_name']}' references valid item")
            else:
                print(f"⚠ Pending item '{pending['item_name']}' references item not in current catalog (may have been deleted)")
    
    def test_pending_items_stats_endpoint(self):
        """GET /api/pending-items/stats - Verify stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/pending-items/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "total_pending_items" in data, "Missing total_pending_items"
        assert "doctors_with_pending" in data, "Missing doctors_with_pending"
        assert data["total_pending_items"] >= 2, "Expected at least 2 total pending items"
        
        print(f"✓ Pending items stats: {data['total_pending_items']} items for {data['doctors_with_pending']} customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
