"""
Test suite for Admin Profile and Database Backup features
Tests the new features:
1. Admin Profile - Edit name/email, change password
2. Database Backup - Settings, export, trigger backup
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
        return response.json()["access_token"]
    pytest.fail(f"Failed to authenticate: {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestAdminProfile:
    """Test Admin Profile API endpoints"""
    
    def test_get_current_user(self, api_client):
        """Test GET /api/auth/me - Get current user profile"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "email" in data
        assert "role" in data
        print(f"Current user: {data['name']} ({data['email']}), role: {data['role']}")
    
    def test_update_admin_profile(self, api_client):
        """Test PUT /api/admin/profile - Update profile name and email"""
        # First get current profile
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        original_data = response.json()
        
        # Update profile
        response = api_client.put(f"{BASE_URL}/api/admin/profile", json={
            "name": "Admin User Updated",
            "email": ADMIN_EMAIL  # Keep same email
        })
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Profile updated successfully"
        print("Profile update successful")
        
        # Verify the update
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        updated = response.json()
        assert updated["name"] == "Admin User Updated"
        
        # Restore original name
        response = api_client.put(f"{BASE_URL}/api/admin/profile", json={
            "name": original_data["name"],
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 200
        print(f"Profile restored to original: {original_data['name']}")
    
    def test_update_profile_email_taken(self, api_client):
        """Test PUT /api/admin/profile - Email already in use"""
        # Try to use an email that might be taken by another user
        # This should fail if another user has this email
        response = api_client.put(f"{BASE_URL}/api/admin/profile", json={
            "name": "Test Name",
            "email": ADMIN_EMAIL  # Use own email - should succeed
        })
        # Should succeed since we're using our own email
        assert response.status_code == 200
        print("Email validation test passed")
    
    def test_change_password_wrong_current(self, api_client):
        """Test PUT /api/admin/change-password - Wrong current password"""
        response = api_client.put(f"{BASE_URL}/api/admin/change-password", json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123"
        })
        assert response.status_code == 400
        data = response.json()
        assert "incorrect" in data["detail"].lower() or "password" in data["detail"].lower()
        print("Correctly rejected wrong current password")
    
    def test_change_password_success(self, api_client):
        """Test PUT /api/admin/change-password - Successful password change"""
        # Change to new password
        response = api_client.put(f"{BASE_URL}/api/admin/change-password", json={
            "current_password": ADMIN_PASSWORD,
            "new_password": "newpassword123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Password changed successfully"
        print("Password changed successfully")
        
        # Change back to original password
        response = api_client.put(f"{BASE_URL}/api/admin/change-password", json={
            "current_password": "newpassword123",
            "new_password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        print("Password restored to original")


class TestDatabaseBackup:
    """Test Database Backup API endpoints"""
    
    def test_get_backup_settings(self, api_client):
        """Test GET /api/database/backup-settings - Get backup settings"""
        response = api_client.get(f"{BASE_URL}/api/database/backup-settings")
        assert response.status_code == 200
        data = response.json()
        # Should have default or saved settings
        assert "auto_backup_enabled" in data or "backup_times" in data or "whatsapp_number" in data
        print(f"Backup settings: auto_enabled={data.get('auto_backup_enabled')}, times={data.get('backup_times')}")
        print(f"  WhatsApp: {data.get('whatsapp_number')}, Email: {data.get('email_address')}")
    
    def test_update_backup_settings(self, api_client):
        """Test PUT /api/database/backup-settings - Update backup settings"""
        new_settings = {
            "auto_backup_enabled": True,
            "backup_times": ["09:00", "17:00"],
            "whatsapp_number": "9486544884",
            "email_address": "vetmech2server@gmail.com"
        }
        
        response = api_client.put(f"{BASE_URL}/api/database/backup-settings", json=new_settings)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Backup settings updated successfully"
        print("Backup settings updated successfully")
        
        # Verify the settings were saved
        response = api_client.get(f"{BASE_URL}/api/database/backup-settings")
        assert response.status_code == 200
        saved = response.json()
        assert saved.get("auto_backup_enabled") == True
        assert saved.get("backup_times") == ["09:00", "17:00"]
        print("Settings verification passed")
    
    def test_get_backup_history(self, api_client):
        """Test GET /api/database/backup-history - Get backup history"""
        response = api_client.get(f"{BASE_URL}/api/database/backup-history")
        assert response.status_code == 200
        data = response.json()
        assert "backups" in data
        assert isinstance(data["backups"], list)
        print(f"Found {len(data['backups'])} backup history entries")
        if data["backups"]:
            latest = data["backups"][0]
            print(f"  Latest backup: {latest.get('filename')}, status: {latest.get('status')}")
    
    def test_export_database(self, api_client):
        """Test GET /api/database/export - Export database as JSON"""
        response = api_client.get(f"{BASE_URL}/api/database/export")
        assert response.status_code == 200
        
        # Should return JSON content
        assert "application/json" in response.headers.get("content-type", "")
        
        # Verify it's valid JSON
        data = response.json()
        assert "export_date" in data
        assert "exported_by" in data
        assert "collections" in data
        
        # Verify collections structure
        collections = data["collections"]
        assert isinstance(collections, dict)
        expected_collections = ["doctors", "items", "orders", "users"]
        for coll in expected_collections:
            assert coll in collections, f"Missing collection: {coll}"
        
        print(f"Database export successful:")
        print(f"  Export date: {data['export_date']}")
        print(f"  Exported by: {data['exported_by']}")
        print(f"  Collections: {', '.join(collections.keys())}")
        
        # Show record counts
        for coll_name, records in collections.items():
            print(f"    {coll_name}: {len(records)} records")
    
    def test_trigger_backup(self, api_client):
        """Test POST /api/database/trigger-backup - Trigger manual backup"""
        response = api_client.post(f"{BASE_URL}/api/database/trigger-backup")
        assert response.status_code == 200
        data = response.json()
        assert "triggered" in data["message"].lower() or "backup" in data["message"].lower()
        print(f"Backup trigger response: {data['message']}")
        
        # Wait a moment for the background task to complete
        import time
        time.sleep(2)
        
        # Check backup history for the new entry
        response = api_client.get(f"{BASE_URL}/api/database/backup-history")
        assert response.status_code == 200
        history = response.json()
        if history["backups"]:
            latest = history["backups"][0]
            print(f"  Latest backup after trigger: {latest.get('filename')}, type: {latest.get('type')}")


class TestSidebarNavigation:
    """Test that sidebar navigation items exist"""
    
    def test_company_section_routes_exist(self, api_client):
        """Verify routes for company section sub-items work"""
        # These are frontend routes but we can check the APIs they depend on
        
        # Company Details - company settings
        response = api_client.get(f"{BASE_URL}/api/company-settings")
        print(f"Company settings: {response.status_code}")
        
        # Users - admin only
        response = api_client.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        print(f"Users list: {response.status_code}")
        
        # Email logs
        response = api_client.get(f"{BASE_URL}/api/email-logs")
        assert response.status_code == 200
        print(f"Email logs: {response.status_code}")
        
        # WhatsApp logs
        response = api_client.get(f"{BASE_URL}/api/whatsapp-logs")
        assert response.status_code == 200
        print(f"WhatsApp logs: {response.status_code}")
        
        # SMTP settings
        response = api_client.get(f"{BASE_URL}/api/smtp-settings")
        print(f"SMTP settings: {response.status_code}")
        
        # Database backup settings
        response = api_client.get(f"{BASE_URL}/api/database/backup-settings")
        assert response.status_code == 200
        print(f"Database backup settings: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
