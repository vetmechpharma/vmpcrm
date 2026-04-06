"""
Test suite for Customer Change Password feature
Tests POST /api/customer/change-password endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
CUSTOMER_PHONE = "9999777766"
CUSTOMER_PASSWORD = "test123"
TEMP_PASSWORD = "newpass123"


class TestCustomerChangePassword:
    """Tests for POST /api/customer/change-password endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get customer token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        
    def get_customer_token(self, phone=CUSTOMER_PHONE, password=CUSTOMER_PASSWORD):
        """Helper to login and get customer token"""
        response = self.session.post(f"{BASE_URL}/api/customer/login", json={
            "phone": phone,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_change_password_no_auth(self):
        """Test change password without authentication returns 401/403"""
        response = self.session.post(f"{BASE_URL}/api/customer/change-password", json={
            "old_password": "test123",
            "new_password": "newpass123"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: No auth returns {response.status_code}")
    
    def test_change_password_missing_fields(self):
        """Test change password with missing fields returns 400"""
        token = self.get_customer_token()
        if not token:
            pytest.skip("Could not get customer token - check credentials")
        
        # Test missing old_password
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"new_password": "newpass123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for missing old_password, got {response.status_code}"
        data = response.json()
        assert "required" in data.get("detail", "").lower() or "old" in data.get("detail", "").lower()
        print(f"PASS: Missing old_password returns 400 - {data.get('detail')}")
        
        # Test missing new_password
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"old_password": "test123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for missing new_password, got {response.status_code}"
        data = response.json()
        assert "required" in data.get("detail", "").lower() or "new" in data.get("detail", "").lower()
        print(f"PASS: Missing new_password returns 400 - {data.get('detail')}")
        
        # Test empty body
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for empty body, got {response.status_code}"
        print(f"PASS: Empty body returns 400")
    
    def test_change_password_short_new_password(self):
        """Test change password with short new password (<6 chars) returns 400"""
        token = self.get_customer_token()
        if not token:
            pytest.skip("Could not get customer token - check credentials")
        
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"old_password": CUSTOMER_PASSWORD, "new_password": "abc"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        data = response.json()
        assert "6" in data.get("detail", "") or "character" in data.get("detail", "").lower()
        print(f"PASS: Short password returns 400 - {data.get('detail')}")
    
    def test_change_password_wrong_old_password(self):
        """Test change password with wrong old password returns 400"""
        token = self.get_customer_token()
        if not token:
            pytest.skip("Could not get customer token - check credentials")
        
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"old_password": "wrongpassword", "new_password": "newpass123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for wrong old password, got {response.status_code}"
        data = response.json()
        assert "incorrect" in data.get("detail", "").lower() or "current" in data.get("detail", "").lower()
        print(f"PASS: Wrong old password returns 400 - {data.get('detail')}")
    
    def test_change_password_success_and_revert(self):
        """Test successful password change and revert back to original"""
        # Step 1: Login with original password
        token = self.get_customer_token()
        if not token:
            pytest.skip("Could not get customer token - check credentials")
        print(f"PASS: Logged in with original password")
        
        # Step 2: Change password to new password
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"old_password": CUSTOMER_PASSWORD, "new_password": TEMP_PASSWORD},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200 for password change, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in data.get("message", "").lower()
        print(f"PASS: Password changed successfully - {data.get('message')}")
        
        # Step 3: Verify old password no longer works
        response = self.session.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 401, f"Expected 401 with old password, got {response.status_code}"
        print(f"PASS: Old password no longer works (401)")
        
        # Step 4: Login with new password
        new_token = self.get_customer_token(password=TEMP_PASSWORD)
        assert new_token is not None, "Failed to login with new password"
        print(f"PASS: Logged in with new password")
        
        # Step 5: Revert password back to original
        response = self.session.post(
            f"{BASE_URL}/api/customer/change-password",
            json={"old_password": TEMP_PASSWORD, "new_password": CUSTOMER_PASSWORD},
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert response.status_code == 200, f"Expected 200 for password revert, got {response.status_code}: {response.text}"
        print(f"PASS: Password reverted to original")
        
        # Step 6: Verify original password works again
        final_token = self.get_customer_token()
        assert final_token is not None, "Failed to login with original password after revert"
        print(f"PASS: Original password works again after revert")


class TestCustomerLogin:
    """Verify customer login works with test credentials"""
    
    def test_customer_login_success(self):
        """Test customer login with valid credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "customer" in data, "No customer data in response"
        assert data["customer"]["phone"] == CUSTOMER_PHONE
        print(f"PASS: Customer login successful - {data['customer']['name']}")
    
    def test_customer_login_invalid_credentials(self):
        """Test customer login with invalid credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASS: Invalid credentials returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
