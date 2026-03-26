"""
Test Customer Portal Pending Items Feature
Tests the GET /api/customer/pending-items endpoint for logged-in customers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerPendingItems:
    """Tests for customer portal pending items feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.customer_phone = "9688283839"
        self.customer_password = "test123"
        self.token = None
        
    def get_customer_token(self):
        """Login and get customer token"""
        response = requests.post(
            f"{BASE_URL}/api/customer/login",
            json={"phone": self.customer_phone, "password": self.customer_password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_customer_login_success(self):
        """Test customer login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/customer/login",
            json={"phone": self.customer_phone, "password": self.customer_password}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "customer" in data, "No customer data in response"
        assert data["customer"]["phone"] == self.customer_phone
        assert data["customer"]["name"] == "DR.DHIVAHAR"
        print(f"PASS: Customer login successful for {data['customer']['name']}")
    
    def test_get_pending_items_returns_items(self):
        """Test GET /api/customer/pending-items returns pending items for customer with pending items"""
        token = self.get_customer_token()
        assert token, "Failed to get customer token"
        
        response = requests.get(
            f"{BASE_URL}/api/customer/pending-items",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"API call failed: {response.text}"
        data = response.json()
        
        # DR.DHIVAHAR should have 2 pending items
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 2, f"Expected 2 pending items, got {len(data)}"
        
        # Verify item structure
        for item in data:
            assert "id" in item, "Missing id field"
            assert "item_id" in item, "Missing item_id field"
            assert "item_code" in item, "Missing item_code field"
            assert "item_name" in item, "Missing item_name field"
            assert "quantity" in item, "Missing quantity field"
            assert "original_order_number" in item, "Missing original_order_number field"
        
        print(f"PASS: Got {len(data)} pending items")
        for item in data:
            print(f"  - {item['item_name']} ({item['item_code']}) qty: {item['quantity']}")
    
    def test_pending_items_contains_vitamin_d3(self):
        """Test pending items contains Vitamin D3 1000IU"""
        token = self.get_customer_token()
        assert token, "Failed to get customer token"
        
        response = requests.get(
            f"{BASE_URL}/api/customer/pending-items",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        vitamin_d3 = next((item for item in data if "Vitamin D3" in item["item_name"]), None)
        assert vitamin_d3 is not None, "Vitamin D3 1000IU not found in pending items"
        assert vitamin_d3["item_code"] == "ITM-0002"
        assert vitamin_d3["quantity"] == "250"
        print(f"PASS: Found Vitamin D3 1000IU with qty {vitamin_d3['quantity']}")
    
    def test_pending_items_contains_paracetamol(self):
        """Test pending items contains Paracetamol 500mg"""
        token = self.get_customer_token()
        assert token, "Failed to get customer token"
        
        response = requests.get(
            f"{BASE_URL}/api/customer/pending-items",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        paracetamol = next((item for item in data if "Paracetamol" in item["item_name"]), None)
        assert paracetamol is not None, "Paracetamol 500mg not found in pending items"
        assert paracetamol["item_code"] == "ITM-0001"
        assert paracetamol["quantity"] == "10"
        print(f"PASS: Found Paracetamol 500mg with qty {paracetamol['quantity']}")
    
    def test_pending_items_unauthorized_without_token(self):
        """Test GET /api/customer/pending-items returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/customer/pending-items")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthorized access correctly rejected")
    
    def test_pending_items_invalid_token(self):
        """Test GET /api/customer/pending-items returns 401 with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/customer/pending-items",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Invalid token correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
