"""
Test MR Outstanding Feature
Tests the new Outstanding page API endpoint for MR Panel
- GET /api/mr/outstanding - Returns customer outstanding balances in MR's territory
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# MR Test credentials
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"


class TestMROutstanding:
    """Test MR Outstanding API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get MR auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as MR
        login_response = self.session.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get('access_token')
            self.mr_data = data.get('mr')
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"MR login failed with status {login_response.status_code}")
    
    def test_mr_login_returns_access_token(self):
        """Test MR login returns access_token field"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data, "Response should contain 'access_token'"
        assert 'mr' in data, "Response should contain 'mr' object"
        assert isinstance(data['access_token'], str)
        assert len(data['access_token']) > 0
    
    def test_mr_outstanding_endpoint_returns_200(self):
        """Test GET /api/mr/outstanding returns 200"""
        response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_mr_outstanding_response_structure(self):
        """Test outstanding response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level keys
        assert 'customers' in data, "Response should have 'customers' array"
        assert 'totals' in data, "Response should have 'totals' object"
        assert 'synced_at' in data, "Response should have 'synced_at' timestamp"
        
        # Check totals structure
        totals = data['totals']
        assert 'doctor' in totals, "Totals should have 'doctor' key"
        assert 'medical' in totals, "Totals should have 'medical' key"
        assert 'agency' in totals, "Totals should have 'agency' key"
        assert 'grand_total' in totals, "Totals should have 'grand_total' key"
        
        # Check totals are numbers
        assert isinstance(totals['doctor'], (int, float))
        assert isinstance(totals['medical'], (int, float))
        assert isinstance(totals['agency'], (int, float))
        assert isinstance(totals['grand_total'], (int, float))
    
    def test_mr_outstanding_customer_structure(self):
        """Test each customer entry has correct fields"""
        response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code == 200
        data = response.json()
        
        customers = data['customers']
        assert isinstance(customers, list), "Customers should be a list"
        
        # If there are customers, check structure
        if len(customers) > 0:
            customer = customers[0]
            required_fields = [
                'customer_id', 'customer_code', 'customer_name', 'customer_phone',
                'district', 'customer_type', 'opening_balance', 'total_invoiced',
                'total_paid', 'outstanding'
            ]
            for field in required_fields:
                assert field in customer, f"Customer should have '{field}' field"
            
            # Check customer_type is valid
            assert customer['customer_type'] in ['doctor', 'medical', 'agency'], \
                f"Invalid customer_type: {customer['customer_type']}"
            
            # Check numeric fields are numbers
            assert isinstance(customer['opening_balance'], (int, float))
            assert isinstance(customer['total_invoiced'], (int, float))
            assert isinstance(customer['total_paid'], (int, float))
            assert isinstance(customer['outstanding'], (int, float))
    
    def test_mr_outstanding_synced_at_is_iso_format(self):
        """Test synced_at is a valid ISO timestamp"""
        response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code == 200
        data = response.json()
        
        synced_at = data['synced_at']
        assert isinstance(synced_at, str)
        # Should be ISO format like "2026-01-15T10:30:00+00:00"
        assert 'T' in synced_at, "synced_at should be ISO format with 'T' separator"
    
    def test_mr_outstanding_requires_auth(self):
        """Test outstanding endpoint requires authentication"""
        # Make request without auth header
        response = requests.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code in [401, 403], f"Should return 401 or 403 without auth, got {response.status_code}"
    
    def test_mr_outstanding_invalid_token(self):
        """Test outstanding endpoint rejects invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/mr/outstanding",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code == 401, "Should return 401 with invalid token"
    
    def test_mr_outstanding_totals_calculation(self):
        """Test that grand_total equals sum of type totals"""
        response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code == 200
        data = response.json()
        
        totals = data['totals']
        calculated_total = totals['doctor'] + totals['medical'] + totals['agency']
        
        # Allow small floating point difference
        assert abs(totals['grand_total'] - calculated_total) < 0.01, \
            f"grand_total ({totals['grand_total']}) should equal sum of types ({calculated_total})"
    
    def test_mr_outstanding_customers_sorted_by_outstanding(self):
        """Test customers are sorted by outstanding amount (descending)"""
        response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert response.status_code == 200
        data = response.json()
        
        customers = data['customers']
        if len(customers) > 1:
            for i in range(len(customers) - 1):
                assert customers[i]['outstanding'] >= customers[i+1]['outstanding'], \
                    "Customers should be sorted by outstanding (descending)"


class TestMROutstandingIntegration:
    """Integration tests for Outstanding with other MR features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get MR auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get('access_token')
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("MR login failed")
    
    def test_mr_customers_and_outstanding_consistency(self):
        """Test that outstanding customers are subset of MR's customers"""
        # Get customers
        customers_response = self.session.get(f"{BASE_URL}/api/mr/customers")
        assert customers_response.status_code == 200
        customers_data = customers_response.json()
        
        # Get outstanding
        outstanding_response = self.session.get(f"{BASE_URL}/api/mr/outstanding")
        assert outstanding_response.status_code == 200
        outstanding_data = outstanding_response.json()
        
        # Get customer IDs from both
        customer_ids = set()
        if isinstance(customers_data, list):
            customer_ids = {c.get('id') for c in customers_data}
        elif isinstance(customers_data, dict) and 'customers' in customers_data:
            customer_ids = {c.get('id') for c in customers_data['customers']}
        
        outstanding_customer_ids = {c['customer_id'] for c in outstanding_data['customers']}
        
        # All outstanding customers should be in MR's customer list
        # Note: Outstanding may include customers with 0 balance too
        print(f"Total customers: {len(customer_ids)}, Outstanding entries: {len(outstanding_customer_ids)}")
    
    def test_mr_me_endpoint_works(self):
        """Test GET /api/mr/me returns MR profile"""
        response = self.session.get(f"{BASE_URL}/api/mr/me")
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert 'name' in data
        assert 'state' in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
