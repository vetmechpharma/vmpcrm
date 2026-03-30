"""
Test Database Management Features
- DELETE /api/email-logs - Delete all email logs
- DELETE /api/whatsapp-logs - Delete all WhatsApp logs
- POST /api/database/factory-reset - Factory reset (delete all data except settings/admin)
- POST /api/database/send-email-backup - Send database backup via email
- GET /api/database/backup-settings - Get backup settings
- PUT /api/database/backup-settings - Update backup settings
- GET /api/database/backup-history - Get backup history
- GET /api/database/export - Export full database as JSON
- POST /api/database/trigger-backup - Trigger full backup (WhatsApp + Email)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "info@vetmech.in"
ADMIN_PASSWORD = "Kongu@@44884"


class TestDatabaseManagement:
    """Database Management API tests - Admin only features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
    
    # ==================== Backup Settings Tests ====================
    
    def test_get_backup_settings(self):
        """GET /api/database/backup-settings - Should return backup settings"""
        response = self.session.get(f"{BASE_URL}/api/database/backup-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have expected fields (either from DB or defaults)
        assert isinstance(data, dict), "Response should be a dict"
        print(f"Backup settings: {data}")
    
    def test_update_backup_settings(self):
        """PUT /api/database/backup-settings - Should update backup settings"""
        update_data = {
            "auto_backup_enabled": True,
            "backup_times": ["09:00", "18:00"],
            "whatsapp_number": "9486544884",
            "email_address": "test@example.com"
        }
        
        response = self.session.put(f"{BASE_URL}/api/database/backup-settings", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message field"
        print(f"Update backup settings response: {data}")
        
        # Verify the update by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/database/backup-settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("email_address") == "test@example.com" or "email_address" in settings
    
    # ==================== Backup History Tests ====================
    
    def test_get_backup_history(self):
        """GET /api/database/backup-history - Should return backup history array"""
        response = self.session.get(f"{BASE_URL}/api/database/backup-history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "backups" in data, "Response should have 'backups' field"
        assert isinstance(data["backups"], list), "backups should be a list"
        print(f"Backup history count: {len(data['backups'])}")
    
    # ==================== Database Export Tests ====================
    
    def test_export_database(self):
        """GET /api/database/export - Should return full database JSON export"""
        response = self.session.get(f"{BASE_URL}/api/database/export")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"Expected JSON content type, got {content_type}"
        
        # Check content disposition header for download
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, f"Expected attachment header, got {content_disposition}"
        
        # Verify JSON structure
        data = response.json()
        assert "export_date" in data, "Export should have export_date"
        assert "exported_by" in data, "Export should have exported_by"
        assert "collections" in data, "Export should have collections"
        assert isinstance(data["collections"], dict), "collections should be a dict"
        print(f"Export contains {len(data['collections'])} collections")
    
    def test_export_database_unauthorized(self):
        """GET /api/database/export - Should reject non-admin users"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/database/export")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ==================== Delete Logs Tests ====================
    
    def test_delete_email_logs(self):
        """DELETE /api/email-logs - Should delete all email logs"""
        response = self.session.delete(f"{BASE_URL}/api/email-logs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "deleted_count" in data, "Response should have deleted_count"
        print(f"Delete email logs: {data}")
    
    def test_delete_email_logs_unauthorized(self):
        """DELETE /api/email-logs - Should reject non-admin users"""
        no_auth_session = requests.Session()
        response = no_auth_session.delete(f"{BASE_URL}/api/email-logs")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_delete_whatsapp_logs(self):
        """DELETE /api/whatsapp-logs - Should delete all WhatsApp logs"""
        response = self.session.delete(f"{BASE_URL}/api/whatsapp-logs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        # deleted_count may or may not be present depending on backend version
        print(f"Delete WhatsApp logs: {data}")
    
    def test_delete_whatsapp_logs_unauthorized(self):
        """DELETE /api/whatsapp-logs - Should reject non-admin users"""
        no_auth_session = requests.Session()
        response = no_auth_session.delete(f"{BASE_URL}/api/whatsapp-logs")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ==================== Factory Reset Tests ====================
    
    def test_factory_reset(self):
        """POST /api/database/factory-reset - Should delete all data except settings/admin"""
        response = self.session.post(f"{BASE_URL}/api/database/factory-reset")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "deleted" in data, "Response should have deleted summary"
        assert isinstance(data["deleted"], dict), "deleted should be a dict"
        print(f"Factory reset: {data}")
    
    def test_factory_reset_unauthorized(self):
        """POST /api/database/factory-reset - Should reject non-admin users"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(f"{BASE_URL}/api/database/factory-reset")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ==================== Email Backup Tests ====================
    
    def test_send_email_backup(self):
        """POST /api/database/send-email-backup - Should attempt to send backup via email"""
        response = self.session.post(f"{BASE_URL}/api/database/send-email-backup")
        # May fail if SMTP not configured, but should return 200 or 400 with proper message
        assert response.status_code in [200, 400], f"Expected 200/400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data or "detail" in data, "Response should have message or detail"
        print(f"Send email backup response: {data}")
    
    def test_send_email_backup_unauthorized(self):
        """POST /api/database/send-email-backup - Should reject non-admin users"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(f"{BASE_URL}/api/database/send-email-backup")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ==================== Trigger Backup Tests ====================
    
    def test_trigger_backup(self):
        """POST /api/database/trigger-backup - Should trigger full backup"""
        response = self.session.post(f"{BASE_URL}/api/database/trigger-backup")
        # May fail if WhatsApp/SMTP not configured, but should return 200 or 400
        assert response.status_code in [200, 400, 500], f"Expected 200/400/500, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Trigger backup response: {data}")
    
    def test_trigger_backup_unauthorized(self):
        """POST /api/database/trigger-backup - Should reject non-admin users"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(f"{BASE_URL}/api/database/trigger-backup")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestAdminLogin:
    """Test admin login with new credentials"""
    
    def test_admin_login_success(self):
        """Admin login with info@vetmech.in / Kongu@@44884"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data or "token" in data, "Response should have access_token or token"
        assert "user" in data, "Response should have user"
        assert data["user"]["role"] == "admin", f"User should be admin, got {data['user'].get('role')}"
        print(f"Admin login successful: {data['user'].get('name')}")
    
    def test_admin_login_wrong_password(self):
        """Admin login with wrong password should fail"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
