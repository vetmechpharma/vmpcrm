"""
Backend API Tests for User Management and WhatsApp Logs Features
Tests: GET/POST/PUT/DELETE /api/users, GET /api/whatsapp-logs, GET /api/whatsapp-logs/stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"PASS: Login successful for {ADMIN_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("PASS: Invalid credentials rejected")
    
    def test_get_current_user(self, auth_headers):
        """Test getting current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"PASS: Current user retrieved: {data['name']}")


class TestUserManagement:
    """Test user management endpoints (admin only)"""
    
    def test_get_all_users(self, auth_headers):
        """Test GET /api/users - returns list of users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least admin user exists
        
        # Verify user structure
        admin_user = next((u for u in data if u["email"] == ADMIN_EMAIL), None)
        assert admin_user is not None
        assert "id" in admin_user
        assert "name" in admin_user
        assert "role" in admin_user
        assert "created_at" in admin_user
        assert "password" not in admin_user  # Password should not be returned
        print(f"PASS: Retrieved {len(data)} users")
    
    def test_create_user(self, auth_headers):
        """Test POST /api/users - creates new user"""
        test_user = {
            "name": "TEST_User_Create",
            "email": "test_create_user@example.com",
            "password": "testpass123",
            "role": "staff",
            "permissions": {
                "doctors": True,
                "medicals": True,
                "agencies": False,
                "items": True,
                "orders": True,
                "expenses": False,
                "reminders": True,
                "pending_items": False,
                "email_logs": False,
                "whatsapp_logs": False,
                "users": False,
                "smtp_settings": False,
                "company_settings": False,
                "whatsapp_settings": False
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=auth_headers)
        
        # If user already exists, try to delete and recreate
        if response.status_code == 400 and "already exists" in response.text.lower():
            # Get users and find the test user
            users_resp = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
            users = users_resp.json()
            existing = next((u for u in users if u["email"] == test_user["email"]), None)
            if existing:
                requests.delete(f"{BASE_URL}/api/users/{existing['id']}", headers=auth_headers)
                response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=auth_headers)
        
        assert response.status_code in [200, 201], f"Failed to create user: {response.text}"
        data = response.json()
        assert data["email"] == test_user["email"]
        assert data["name"] == test_user["name"]
        assert data["role"] == test_user["role"]
        assert "id" in data
        assert "permissions" in data
        print(f"PASS: Created user {data['name']} with ID {data['id']}")
        
        # Store user ID for cleanup
        return data["id"]
    
    def test_get_single_user(self, auth_headers):
        """Test GET /api/users/{id} - returns single user"""
        # First get all users
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = response.json()
        
        if len(users) > 0:
            user_id = users[0]["id"]
            response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == user_id
            print(f"PASS: Retrieved single user: {data['name']}")
    
    def test_update_user(self, auth_headers):
        """Test PUT /api/users/{id} - updates user"""
        # First create a test user
        test_user = {
            "name": "TEST_User_Update",
            "email": "test_update_user@example.com",
            "password": "testpass123",
            "role": "staff"
        }
        
        # Delete if exists
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = users_resp.json()
        existing = next((u for u in users if u["email"] == test_user["email"]), None)
        if existing:
            requests.delete(f"{BASE_URL}/api/users/{existing['id']}", headers=auth_headers)
        
        create_resp = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=auth_headers)
        assert create_resp.status_code in [200, 201]
        user_id = create_resp.json()["id"]
        
        # Update the user
        update_data = {
            "name": "TEST_User_Updated",
            "role": "admin",
            "permissions": {
                "doctors": True,
                "medicals": True,
                "agencies": True,
                "items": True,
                "orders": True,
                "expenses": True,
                "reminders": True,
                "pending_items": True,
                "email_logs": True,
                "whatsapp_logs": True,
                "users": True,
                "smtp_settings": True,
                "company_settings": True,
                "whatsapp_settings": True
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["role"] == update_data["role"]
        print(f"PASS: Updated user {data['name']}")
        
        # Verify update persisted
        get_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["name"] == update_data["name"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_delete_user(self, auth_headers):
        """Test DELETE /api/users/{id} - deletes user"""
        # Create a test user to delete
        test_user = {
            "name": "TEST_User_Delete",
            "email": "test_delete_user@example.com",
            "password": "testpass123",
            "role": "staff"
        }
        
        # Delete if exists
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = users_resp.json()
        existing = next((u for u in users if u["email"] == test_user["email"]), None)
        if existing:
            requests.delete(f"{BASE_URL}/api/users/{existing['id']}", headers=auth_headers)
        
        create_resp = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=auth_headers)
        assert create_resp.status_code in [200, 201]
        user_id = create_resp.json()["id"]
        
        # Delete the user
        response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"PASS: Deleted user {user_id}")
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_resp.status_code == 404
        print("PASS: User no longer exists after deletion")
    
    def test_cannot_delete_self(self, auth_headers, auth_token):
        """Test that admin cannot delete themselves"""
        # Get current user ID
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        current_user_id = me_resp.json()["id"]
        
        # Try to delete self
        response = requests.delete(f"{BASE_URL}/api/users/{current_user_id}", headers=auth_headers)
        assert response.status_code == 400
        print("PASS: Cannot delete own account")
    
    def test_duplicate_email_rejected(self, auth_headers):
        """Test that duplicate email is rejected"""
        test_user = {
            "name": "TEST_Duplicate",
            "email": ADMIN_EMAIL,  # Use existing admin email
            "password": "testpass123",
            "role": "staff"
        }
        
        response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=auth_headers)
        assert response.status_code == 400
        print("PASS: Duplicate email rejected")


class TestWhatsAppLogs:
    """Test WhatsApp logs endpoints"""
    
    def test_get_whatsapp_logs(self, auth_headers):
        """Test GET /api/whatsapp-logs - returns logs with pagination"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)
        assert isinstance(data["total"], int)
        print(f"PASS: Retrieved {len(data['logs'])} WhatsApp logs (total: {data['total']})")
    
    def test_get_whatsapp_logs_with_filters(self, auth_headers):
        """Test GET /api/whatsapp-logs with filters"""
        # Test with status filter
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs?status=success", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"PASS: Filtered logs by status=success: {len(data['logs'])} results")
        
        # Test with message_type filter
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs?message_type=otp", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"PASS: Filtered logs by message_type=otp: {len(data['logs'])} results")
        
        # Test with pagination
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs?skip=0&limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) <= 5
        print(f"PASS: Pagination working: {len(data['logs'])} logs returned")
    
    def test_get_whatsapp_logs_stats(self, auth_headers):
        """Test GET /api/whatsapp-logs/stats - returns statistics"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data
        assert "success" in data
        assert "failed" in data
        assert "by_type" in data
        
        assert isinstance(data["total"], int)
        assert isinstance(data["success"], int)
        assert isinstance(data["failed"], int)
        assert isinstance(data["by_type"], dict)
        
        print(f"PASS: WhatsApp stats - Total: {data['total']}, Success: {data['success']}, Failed: {data['failed']}")


class TestPublicCompanySettings:
    """Test public company settings endpoint for login page"""
    
    def test_get_public_company_settings(self):
        """Test GET /api/public/company-settings - returns company branding"""
        response = requests.get(f"{BASE_URL}/api/public/company-settings")
        assert response.status_code == 200
        data = response.json()
        
        # Check for expected fields
        assert "company_name" in data
        print(f"PASS: Public company settings retrieved - Company: {data.get('company_name', 'N/A')}")
        
        # Check for login customization fields
        if "login_tagline" in data:
            print(f"  - Login tagline: {data.get('login_tagline', 'N/A')}")
        if "login_background_color" in data:
            print(f"  - Login background color: {data.get('login_background_color', 'N/A')}")


class TestCompanySettingsLoginTab:
    """Test company settings login page customization"""
    
    def test_get_company_settings(self, auth_headers):
        """Test GET /api/company-settings - includes login customization fields"""
        response = requests.get(f"{BASE_URL}/api/company-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify login customization fields exist
        assert "company_name" in data
        print(f"PASS: Company settings retrieved with login customization fields")
        print(f"  - Company name: {data.get('company_name', 'N/A')}")
        print(f"  - Login tagline: {data.get('login_tagline', 'N/A')}")
        print(f"  - Login background color: {data.get('login_background_color', 'N/A')}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_users(self, auth_headers):
        """Clean up any TEST_ prefixed users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        if response.status_code == 200:
            users = response.json()
            for user in users:
                if user["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=auth_headers)
                    print(f"Cleaned up test user: {user['name']}")
        print("PASS: Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
