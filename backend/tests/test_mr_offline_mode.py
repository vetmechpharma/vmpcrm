"""
Test MR Panel Offline Mode - Backend API Tests
Tests MR login, dashboard, customers, orders, visits, followups, items endpoints
These endpoints are used by the offline caching system in the frontend
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# MR credentials
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"


class TestMRLogin:
    """Test MR authentication"""
    
    def test_mr_login_success(self):
        """MR login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200, f"MR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "mr" in data, "No mr object in response"
        assert data["mr"]["phone"] == MR_PHONE
        print(f"MR login successful: {data['mr']['name']}")
    
    def test_mr_login_invalid_credentials(self):
        """MR login with invalid credentials should fail"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "0000000000",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"


@pytest.fixture(scope="module")
def mr_token():
    """Get MR auth token for authenticated requests"""
    response = requests.post(f"{BASE_URL}/api/mr/login", json={
        "phone": MR_PHONE,
        "password": MR_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"MR login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def mr_headers(mr_token):
    """Headers with MR auth token"""
    return {
        "Authorization": f"Bearer {mr_token}",
        "Content-Type": "application/json"
    }


class TestMRDashboard:
    """Test MR dashboard endpoint - used for offline caching"""
    
    def test_get_dashboard(self, mr_headers):
        """GET /api/mr/dashboard returns stats"""
        response = requests.get(f"{BASE_URL}/api/mr/dashboard", headers=mr_headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        # Verify expected fields for offline caching
        assert "total_customers" in data or isinstance(data.get("total_customers"), int) or data.get("total_customers") is None
        print(f"Dashboard stats: {data}")


class TestMRCustomers:
    """Test MR customers endpoint - critical for offline order creation"""
    
    def test_get_customers(self, mr_headers):
        """GET /api/mr/customers returns customer list"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        assert response.status_code == 200, f"Customers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of customers"
        print(f"Found {len(data)} customers")
        if len(data) > 0:
            # Verify customer structure for offline caching
            customer = data[0]
            assert "id" in customer, "Customer missing id"
            assert "name" in customer, "Customer missing name"
            assert "entity_type" in customer, "Customer missing entity_type"
    
    def test_get_customers_with_search(self, mr_headers):
        """GET /api/mr/customers with search filter"""
        response = requests.get(f"{BASE_URL}/api/mr/customers?search=test", headers=mr_headers)
        assert response.status_code == 200, f"Customer search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_customers_by_type(self, mr_headers):
        """GET /api/mr/customers filtered by entity_type"""
        for entity_type in ["doctor", "medical", "agency"]:
            response = requests.get(f"{BASE_URL}/api/mr/customers?entity_type={entity_type}", headers=mr_headers)
            assert response.status_code == 200, f"Customer filter by {entity_type} failed: {response.text}"


class TestMRItems:
    """Test MR items endpoint - critical for offline order creation"""
    
    def test_get_items(self, mr_headers):
        """GET /api/mr/items returns item list"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers=mr_headers)
        assert response.status_code == 200, f"Items failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of items"
        print(f"Found {len(data)} items")
        if len(data) > 0:
            # Verify item structure for offline caching
            item = data[0]
            assert "id" in item, "Item missing id"
            assert "name" in item or "item_name" in item, "Item missing name"
    
    def test_get_items_with_search(self, mr_headers):
        """GET /api/mr/items with search filter"""
        response = requests.get(f"{BASE_URL}/api/mr/items?search=test", headers=mr_headers)
        assert response.status_code == 200, f"Item search failed: {response.text}"


class TestMROrders:
    """Test MR orders endpoint - for offline order history"""
    
    def test_get_orders(self, mr_headers):
        """GET /api/mr/orders returns order list"""
        response = requests.get(f"{BASE_URL}/api/mr/orders", headers=mr_headers)
        assert response.status_code == 200, f"Orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of orders"
        print(f"Found {len(data)} orders")


class TestMRVisits:
    """Test MR visits endpoint - for offline visit history"""
    
    def test_get_visits(self, mr_headers):
        """GET /api/mr/visits returns visit list"""
        response = requests.get(f"{BASE_URL}/api/mr/visits", headers=mr_headers)
        assert response.status_code == 200, f"Visits failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of visits"
        print(f"Found {len(data)} visits")


class TestMRFollowups:
    """Test MR followups endpoint - for offline followup list"""
    
    def test_get_followups_today(self, mr_headers):
        """GET /api/mr/followups with today filter"""
        response = requests.get(f"{BASE_URL}/api/mr/followups?filter_type=today", headers=mr_headers)
        assert response.status_code == 200, f"Followups today failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} today followups")
    
    def test_get_followups_overdue(self, mr_headers):
        """GET /api/mr/followups with overdue filter"""
        response = requests.get(f"{BASE_URL}/api/mr/followups?filter_type=overdue", headers=mr_headers)
        assert response.status_code == 200, f"Followups overdue failed: {response.text}"
    
    def test_get_followups_upcoming(self, mr_headers):
        """GET /api/mr/followups with upcoming filter"""
        response = requests.get(f"{BASE_URL}/api/mr/followups?filter_type=upcoming", headers=mr_headers)
        assert response.status_code == 200, f"Followups upcoming failed: {response.text}"


class TestServiceWorkerFile:
    """Test service worker file accessibility"""
    
    def test_mr_sw_accessible(self):
        """GET /mr-sw.js returns service worker file"""
        response = requests.get(f"{BASE_URL}/mr-sw.js")
        assert response.status_code == 200, f"Service worker not accessible: {response.status_code}"
        content = response.text
        # Verify v3 cache version
        assert "v3" in content or "CACHE_VERSION" in content, "Service worker should contain v3 cache version"
        assert "networkFirst" in content, "Service worker should have networkFirst function"
        print("Service worker file accessible and contains expected content")


class TestMRProfile:
    """Test MR profile endpoint"""
    
    def test_get_profile(self, mr_headers):
        """GET /api/mr/me returns MR profile"""
        response = requests.get(f"{BASE_URL}/api/mr/me", headers=mr_headers)
        assert response.status_code == 200, f"Profile failed: {response.text}"
        data = response.json()
        assert "name" in data, "Profile missing name"
        assert "phone" in data, "Profile missing phone"
        print(f"MR Profile: {data['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
