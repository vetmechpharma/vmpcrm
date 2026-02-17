"""
Customer Portal Feature Tests - Registration, Login, Admin Customer Management, Support Tickets, Role-based Pricing
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerPortalAPIs:
    """Test Customer Portal APIs"""
    
    token = None
    customer_id = None
    test_phone = "9876543210"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        TestCustomerPortalAPIs.token = response.json()["access_token"]
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    # ===== Customer OTP & Registration Tests =====
    
    def test_01_customer_send_otp(self):
        """Test POST /api/customer/send-otp - Send OTP for registration"""
        response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": "9999000011",
            "purpose": "register"
        })
        assert response.status_code == 200, f"Send OTP failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["phone"] == "9999000011"
        print("✓ test_01_customer_send_otp: OTP sent successfully")
    
    def test_02_customer_send_otp_invalid_phone(self):
        """Test POST /api/customer/send-otp with invalid phone"""
        response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": "123",
            "purpose": "register"
        })
        assert response.status_code == 400, f"Expected 400 for invalid phone: {response.text}"
        print("✓ test_02_customer_send_otp_invalid_phone: Correctly rejects invalid phone")
    
    def test_03_customer_login_invalid_credentials(self):
        """Test POST /api/customer/login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "9999999999",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401 for invalid credentials: {response.text}"
        print("✓ test_03_customer_login_invalid_credentials: Correctly returns 401")
    
    # ===== Admin Customer List Tests =====
    
    def test_04_get_customers_list(self):
        """Test GET /api/customers - Admin customer list"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.get_headers())
        assert response.status_code == 200, f"Get customers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ test_04_get_customers_list: Returned {len(data)} customers")
    
    def test_05_get_customers_unauthenticated(self):
        """Test GET /api/customers without auth token"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth: {response.text}"
        print("✓ test_05_get_customers_unauthenticated: Correctly requires authentication")
    
    def test_06_get_customers_with_filters(self):
        """Test GET /api/customers with status and role filters"""
        # Test with status filter
        response = requests.get(f"{BASE_URL}/api/customers?status=pending_approval", headers=self.get_headers())
        assert response.status_code == 200, f"Filter by status failed: {response.text}"
        
        # Test with role filter
        response = requests.get(f"{BASE_URL}/api/customers?role=doctor", headers=self.get_headers())
        assert response.status_code == 200, f"Filter by role failed: {response.text}"
        
        # Test with search filter
        response = requests.get(f"{BASE_URL}/api/customers?search=test", headers=self.get_headers())
        assert response.status_code == 200, f"Filter by search failed: {response.text}"
        
        print("✓ test_06_get_customers_with_filters: All filters work correctly")
    
    # ===== Support Tickets Tests =====
    
    def test_07_get_support_tickets(self):
        """Test GET /api/support/tickets - Admin support tickets list"""
        response = requests.get(f"{BASE_URL}/api/support/tickets", headers=self.get_headers())
        assert response.status_code == 200, f"Get support tickets failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ test_07_get_support_tickets: Returned {len(data)} tickets")
    
    def test_08_get_support_tickets_unauthenticated(self):
        """Test GET /api/support/tickets without auth"""
        response = requests.get(f"{BASE_URL}/api/support/tickets")
        assert response.status_code in [401, 403], f"Expected 401/403: {response.text}"
        print("✓ test_08_get_support_tickets_unauthenticated: Correctly requires auth")
    
    def test_09_get_support_tickets_with_filters(self):
        """Test GET /api/support/tickets with filters"""
        # Filter by status
        response = requests.get(f"{BASE_URL}/api/support/tickets?status=open", headers=self.get_headers())
        assert response.status_code == 200, f"Filter by status failed: {response.text}"
        
        # Filter by priority
        response = requests.get(f"{BASE_URL}/api/support/tickets?priority=high", headers=self.get_headers())
        assert response.status_code == 200, f"Filter by priority failed: {response.text}"
        
        print("✓ test_09_get_support_tickets_with_filters: Filters work correctly")
    
    # ===== Items/Products Tests =====
    
    def test_10_get_items(self):
        """Test GET /api/items - Admin items list"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.get_headers())
        assert response.status_code == 200, f"Get items failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ test_10_get_items: Returned {len(data)} items")
    
    def test_11_create_item_with_role_pricing(self):
        """Test POST /api/items - Create item with role-based pricing"""
        item_data = {
            "item_name": "TEST_Portal_Item",
            "item_code": "TEST-PORTAL-001",
            "mrp": 100.00,
            "rate": 80.00,
            "gst": 12,
            "main_categories": ["Large Animals"],
            "subcategories": ["Injection"],
            "composition": "Test Composition",
            "offer": "10% off",
            "special_offer": "Buy 10 get 1 free",
            # Role-based pricing
            "rate_doctors": 75.00,
            "offer_doctors": "Doctor special 15% off",
            "special_offer_doctors": "Buy 20 get 3 free",
            "rate_medicals": 70.00,
            "offer_medicals": "Medical store 20% off",
            "special_offer_medicals": "Bulk pricing available",
            "rate_agencies": 65.00,
            "offer_agencies": "Agency 25% off",
            "special_offer_agencies": "Distributor pricing"
        }
        
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=self.get_headers())
        assert response.status_code == 200, f"Create item failed: {response.text}"
        data = response.json()
        
        # Verify role-based pricing fields
        assert data.get("rate_doctors") == 75.00, "Doctor rate not saved"
        assert data.get("rate_medicals") == 70.00, "Medical rate not saved"
        assert data.get("rate_agencies") == 65.00, "Agency rate not saved"
        
        TestCustomerPortalAPIs.item_id = data["id"]
        print("✓ test_11_create_item_with_role_pricing: Item created with role-based pricing")
    
    def test_12_get_item_verifies_role_pricing(self):
        """Test GET /api/items/{id} - Verify role-based pricing is returned"""
        if not hasattr(TestCustomerPortalAPIs, 'item_id'):
            pytest.skip("No test item created")
        
        response = requests.get(f"{BASE_URL}/api/items/{TestCustomerPortalAPIs.item_id}", headers=self.get_headers())
        assert response.status_code == 200, f"Get item failed: {response.text}"
        data = response.json()
        
        # Verify all role-based pricing fields
        assert "rate_doctors" in data
        assert "rate_medicals" in data
        assert "rate_agencies" in data
        assert "offer_doctors" in data
        assert "offer_medicals" in data
        assert "offer_agencies" in data
        
        print("✓ test_12_get_item_verifies_role_pricing: Role-based pricing fields present")
    
    def test_13_update_item_role_pricing(self):
        """Test PUT /api/items/{id} - Update role-based pricing"""
        if not hasattr(TestCustomerPortalAPIs, 'item_id'):
            pytest.skip("No test item created")
        
        update_data = {
            "rate_doctors": 78.00,
            "rate_medicals": 73.00,
            "rate_agencies": 68.00,
            "special_offer_doctors": "Updated offer for doctors"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/items/{TestCustomerPortalAPIs.item_id}", 
            json=update_data, 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Update item failed: {response.text}"
        data = response.json()
        
        assert data.get("rate_doctors") == 78.00
        assert data.get("rate_medicals") == 73.00
        assert data.get("rate_agencies") == 68.00
        
        print("✓ test_13_update_item_role_pricing: Role-based pricing updated successfully")
    
    # ===== Transports API (for customer registration) =====
    
    def test_14_get_transports(self):
        """Test GET /api/transports - Required for customer registration form"""
        response = requests.get(f"{BASE_URL}/api/transports", headers=self.get_headers())
        assert response.status_code == 200, f"Get transports failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ test_14_get_transports: Returned {len(data)} transports")
    
    # ===== States/Districts API (for customer registration) =====
    
    def test_15_get_states(self):
        """Test GET /api/public/states - Required for customer registration"""
        response = requests.get(f"{BASE_URL}/api/public/states")
        assert response.status_code == 200, f"Get states failed: {response.text}"
        data = response.json()
        assert "states" in data
        assert len(data["states"]) > 0
        print(f"✓ test_15_get_states: Returned {len(data['states'])} states")
    
    def test_16_get_districts(self):
        """Test GET /api/public/districts/{state} - Required for customer registration"""
        response = requests.get(f"{BASE_URL}/api/public/districts/Maharashtra")
        assert response.status_code == 200, f"Get districts failed: {response.text}"
        data = response.json()
        assert "districts" in data
        assert len(data["districts"]) > 0
        print(f"✓ test_16_get_districts: Returned {len(data['districts'])} districts for Maharashtra")
    
    # ===== Cleanup =====
    
    def test_99_cleanup(self):
        """Clean up test data"""
        if hasattr(TestCustomerPortalAPIs, 'item_id'):
            response = requests.delete(
                f"{BASE_URL}/api/items/{TestCustomerPortalAPIs.item_id}",
                headers=self.get_headers()
            )
            print(f"✓ test_99_cleanup: Deleted test item")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
