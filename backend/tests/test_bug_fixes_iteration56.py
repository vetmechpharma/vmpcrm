"""
Test Bug Fixes - Iteration 56
Tests for:
1. Customer login and session persistence
2. Customer profile fetch - GET /api/customer/profile
3. Customer push notification subscribe endpoint
4. Customer change password (regression check)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerAuth:
    """Customer authentication and session tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.customer_phone = "9999777766"
        self.customer_password = "test123"
        self.token = None
    
    def test_customer_login_success(self):
        """Test customer login returns token and customer data"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": self.customer_phone,
            "password": self.customer_password
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "access_token not in response"
        assert "customer" in data, "customer not in response"
        assert data["customer"]["phone"] == self.customer_phone
        assert data["customer"]["role"] == "doctor"
        assert "customer_code" in data["customer"]
        
        # Store token for other tests
        self.__class__.token = data["access_token"]
        print(f"Login successful, token length: {len(data['access_token'])}")
    
    def test_customer_login_invalid_credentials(self):
        """Test customer login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": self.customer_phone,
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        assert "Invalid" in response.json().get("detail", "")


class TestCustomerProfile:
    """Customer profile endpoint tests - Bug fix verification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "9999777766",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
        else:
            pytest.skip("Could not get auth token")
    
    def test_customer_profile_endpoint_exists(self):
        """Test GET /api/customer/profile returns correct data (was /api/portal/profile - BUG FIX)"""
        response = requests.get(
            f"{BASE_URL}/api/customer/profile",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "phone" in data
        assert "role" in data
        assert "customer_code" in data
        assert data["phone"] == "9999777766"
        print(f"Profile fetched: {data['name']} ({data['customer_code']})")
    
    def test_customer_profile_without_auth(self):
        """Test profile endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customer/profile")
        
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_old_portal_profile_endpoint_not_used(self):
        """Verify /api/portal/profile does NOT exist (was the bug)"""
        response = requests.get(
            f"{BASE_URL}/api/portal/profile",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        # This endpoint should NOT exist - it was the bug
        assert response.status_code == 404, "Old /api/portal/profile should not exist"
        print("Confirmed: /api/portal/profile returns 404 (correct behavior)")


class TestCustomerPushNotifications:
    """Customer push notification subscribe endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "9999777766",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
        else:
            pytest.skip("Could not get auth token")
    
    def test_customer_push_subscribe_endpoint(self):
        """Test POST /api/customer/push/subscribe works with customer token"""
        response = requests.post(
            f"{BASE_URL}/api/customer/push/subscribe",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "subscription": {
                    "endpoint": "https://test-endpoint.example.com/push/test-iter56",
                    "keys": {"p256dh": "test-key", "auth": "test-auth"}
                }
            }
        )
        
        assert response.status_code == 200, f"Push subscribe failed: {response.text}"
        assert "Subscribed" in response.json().get("message", "")
        print("Customer push subscribe successful")
    
    def test_customer_push_subscribe_without_auth(self):
        """Test push subscribe requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/customer/push/subscribe",
            json={
                "subscription": {
                    "endpoint": "https://test-endpoint.example.com/push/noauth",
                    "keys": {"p256dh": "test", "auth": "test"}
                }
            }
        )
        
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_customer_push_subscribe_invalid_subscription(self):
        """Test push subscribe validates subscription data"""
        response = requests.post(
            f"{BASE_URL}/api/customer/push/subscribe",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"subscription": {}}  # Missing endpoint
        )
        
        assert response.status_code == 400, "Should reject invalid subscription"


class TestCustomerChangePassword:
    """Customer change password tests - Regression check"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "9999777766",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
        else:
            pytest.skip("Could not get auth token")
    
    def test_change_password_wrong_old_password(self):
        """Test change password with wrong old password"""
        response = requests.post(
            f"{BASE_URL}/api/customer/change-password",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"old_password": "wrongpassword", "new_password": "newtest123"}
        )
        
        assert response.status_code == 400
        assert "incorrect" in response.json().get("detail", "").lower()
    
    def test_change_password_missing_fields(self):
        """Test change password with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/customer/change-password",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"old_password": "test123"}  # Missing new_password
        )
        
        assert response.status_code == 400
        assert "required" in response.json().get("detail", "").lower()
    
    def test_change_password_short_password(self):
        """Test change password with short new password"""
        response = requests.post(
            f"{BASE_URL}/api/customer/change-password",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"old_password": "test123", "new_password": "abc"}
        )
        
        assert response.status_code == 400
        assert "6 characters" in response.json().get("detail", "")
    
    def test_change_password_without_auth(self):
        """Test change password requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"old_password": "test123", "new_password": "newtest123"}
        )
        
        assert response.status_code in [401, 403], "Should require authentication"


class TestVAPIDKey:
    """VAPID key endpoint test"""
    
    def test_vapid_key_endpoint(self):
        """Test VAPID public key endpoint"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        
        assert response.status_code == 200
        data = response.json()
        assert "public_key" in data
        assert len(data["public_key"]) > 0
        print(f"VAPID key available: {data['public_key'][:20]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
