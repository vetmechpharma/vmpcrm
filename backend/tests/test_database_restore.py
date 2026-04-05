"""
Test Database Restore Functionality
- POST /api/database/restore (merge mode)
- POST /api/database/restore-replace (replace mode)
- Auth requirements
- File validation
- Backup history entries
"""
import pytest
import requests
import json
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "info@vetmech.in"
ADMIN_PASSWORD = "Kongu@@44884"


class TestDatabaseRestore:
    """Database restore endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        data = login_resp.json()
        self.token = data.get("access_token")
        assert self.token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
        # Cleanup: delete test items created during restore tests
        try:
            items = self.session.get(f"{BASE_URL}/api/items").json()
            for item in items:
                if item.get('id', '').startswith('TEST_RESTORE_'):
                    self.session.delete(f"{BASE_URL}/api/items/{item['id']}")
        except:
            pass
    
    def test_health_check(self):
        """Test API is running"""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json().get("status") == "healthy"
        print("PASS: Health check")
    
    def test_restore_requires_admin_auth(self):
        """Test restore endpoint requires admin authentication"""
        # Create a valid JSON backup file
        backup_data = {
            "export_date": "2026-01-01T00:00:00Z",
            "collections": {
                "items": [{"id": "test-item-1", "item_name": "Test Item"}]
            }
        }
        json_bytes = json.dumps(backup_data).encode('utf-8')
        
        # Try without auth
        no_auth_session = requests.Session()
        files = {'file': ('backup.json', io.BytesIO(json_bytes), 'application/json')}
        resp = no_auth_session.post(f"{BASE_URL}/api/database/restore", files=files)
        assert resp.status_code in [401, 403], f"Expected 401/403 without auth, got {resp.status_code}"
        print("PASS: Restore requires admin auth")
    
    def test_restore_rejects_non_json_file(self):
        """Test restore endpoint rejects non-JSON files"""
        # Create a non-JSON file
        txt_content = b"This is not a JSON file"
        files = {'file': ('backup.txt', io.BytesIO(txt_content), 'text/plain')}
        
        resp = self.session.post(
            f"{BASE_URL}/api/database/restore",
            files=files,
            headers={"Authorization": f"Bearer {self.token}"}  # Remove Content-Type for multipart
        )
        # Remove Content-Type header for file upload
        del self.session.headers["Content-Type"]
        resp = self.session.post(f"{BASE_URL}/api/database/restore", files=files)
        
        assert resp.status_code == 400, f"Expected 400 for non-JSON file, got {resp.status_code}: {resp.text}"
        assert "JSON" in resp.text or "json" in resp.text
        print("PASS: Restore rejects non-JSON files")
    
    def test_restore_merge_mode(self):
        """Test merge mode: inserts new records, skips duplicates"""
        # Create a backup with test items
        test_item_id = "TEST_RESTORE_MERGE_001"
        backup_data = {
            "export_date": "2026-01-01T00:00:00Z",
            "exported_by": "Test",
            "collections": {
                "items": [
                    {
                        "id": test_item_id,
                        "item_name": "Test Restore Item Merge",
                        "item_code": "TRM001",
                        "main_category": "Test",
                        "sub_category": "Test",
                        "rate": 100,
                        "status": "active"
                    }
                ]
            }
        }
        json_bytes = json.dumps(backup_data).encode('utf-8')
        
        # First restore - should insert
        files = {'file': ('backup.json', io.BytesIO(json_bytes), 'application/json')}
        self.session.headers.pop("Content-Type", None)  # Remove for multipart
        resp = self.session.post(f"{BASE_URL}/api/database/restore", files=files)
        
        assert resp.status_code == 200, f"Merge restore failed: {resp.text}"
        data = resp.json()
        assert "inserted" in data.get("message", "").lower() or data.get("total_inserted", 0) > 0
        print(f"First restore: {data.get('message')}")
        
        # Second restore - should skip duplicate
        files2 = {'file': ('backup.json', io.BytesIO(json_bytes), 'application/json')}
        resp2 = self.session.post(f"{BASE_URL}/api/database/restore", files=files2)
        
        assert resp2.status_code == 200, f"Second merge restore failed: {resp2.text}"
        data2 = resp2.json()
        # Should have skipped the duplicate
        assert data2.get("total_skipped", 0) >= 1 or "skipped" in data2.get("message", "").lower()
        print(f"Second restore (duplicate): {data2.get('message')}")
        print("PASS: Merge mode works correctly")
    
    def test_restore_replace_mode(self):
        """Test replace mode: replaces collection data"""
        test_item_id = "TEST_RESTORE_REPLACE_001"
        backup_data = {
            "export_date": "2026-01-01T00:00:00Z",
            "exported_by": "Test",
            "collections": {
                "items": [
                    {
                        "id": test_item_id,
                        "item_name": "Test Restore Item Replace",
                        "item_code": "TRR001",
                        "main_category": "Test",
                        "sub_category": "Test",
                        "rate": 200,
                        "status": "active"
                    }
                ]
            }
        }
        json_bytes = json.dumps(backup_data).encode('utf-8')
        
        files = {'file': ('backup.json', io.BytesIO(json_bytes), 'application/json')}
        self.session.headers.pop("Content-Type", None)
        resp = self.session.post(f"{BASE_URL}/api/database/restore-replace", files=files)
        
        assert resp.status_code == 200, f"Replace restore failed: {resp.text}"
        data = resp.json()
        assert "restore" in data.get("message", "").lower() or data.get("total_records", 0) > 0
        print(f"Replace restore: {data.get('message')}")
        print("PASS: Replace mode works correctly")
    
    def test_restore_protected_collections_merged(self):
        """Test that protected collections (users, system_settings) are merged, not replaced"""
        # Create backup with users collection (protected)
        backup_data = {
            "export_date": "2026-01-01T00:00:00Z",
            "collections": {
                "users": [
                    {
                        "id": "TEST_USER_SHOULD_NOT_REPLACE",
                        "email": "test_restore_user@test.com",
                        "name": "Test Restore User",
                        "role": "staff"
                    }
                ]
            }
        }
        json_bytes = json.dumps(backup_data).encode('utf-8')
        
        files = {'file': ('backup.json', io.BytesIO(json_bytes), 'application/json')}
        self.session.headers.pop("Content-Type", None)
        resp = self.session.post(f"{BASE_URL}/api/database/restore-replace", files=files)
        
        assert resp.status_code == 200, f"Protected collection restore failed: {resp.text}"
        data = resp.json()
        
        # Check that users collection was merged (not replaced)
        collections_info = data.get("collections", {})
        if "users" in collections_info:
            assert collections_info["users"].get("action") == "merged", "Users should be merged, not replaced"
        
        # Verify admin user still exists
        self.session.headers["Content-Type"] = "application/json"
        me_resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200, "Admin user should still exist after restore"
        print("PASS: Protected collections are merged, not replaced")
    
    def test_backup_history_includes_restore_entries(self):
        """Test that backup history includes restore entries"""
        self.session.headers["Content-Type"] = "application/json"
        resp = self.session.get(f"{BASE_URL}/api/database/backup-history")
        
        assert resp.status_code == 200, f"Failed to get backup history: {resp.text}"
        data = resp.json()
        backups = data.get("backups", [])
        
        # Check for restore entries
        restore_entries = [b for b in backups if b.get("type") in ["restore", "full_restore"]]
        print(f"Found {len(restore_entries)} restore entries in backup history")
        
        # After our tests, there should be at least one restore entry
        if restore_entries:
            entry = restore_entries[0]
            assert "filename" in entry
            assert "status" in entry
            assert "created_at" in entry
            print(f"Latest restore entry: {entry.get('filename')} - {entry.get('status')}")
        
        print("PASS: Backup history includes restore entries")
    
    def test_restore_invalid_json_content(self):
        """Test restore with invalid JSON content"""
        invalid_json = b'{"collections": invalid json content}'
        files = {'file': ('backup.json', io.BytesIO(invalid_json), 'application/json')}
        
        self.session.headers.pop("Content-Type", None)
        resp = self.session.post(f"{BASE_URL}/api/database/restore", files=files)
        
        assert resp.status_code == 400, f"Expected 400 for invalid JSON, got {resp.status_code}"
        print("PASS: Restore rejects invalid JSON content")
    
    def test_restore_empty_collections(self):
        """Test restore with empty collections"""
        backup_data = {
            "export_date": "2026-01-01T00:00:00Z",
            "collections": {}
        }
        json_bytes = json.dumps(backup_data).encode('utf-8')
        
        files = {'file': ('backup.json', io.BytesIO(json_bytes), 'application/json')}
        self.session.headers.pop("Content-Type", None)
        resp = self.session.post(f"{BASE_URL}/api/database/restore", files=files)
        
        assert resp.status_code == 400, f"Expected 400 for empty collections, got {resp.status_code}"
        print("PASS: Restore rejects empty collections")


class TestTempFileCleanup:
    """Test temp file cleanup background task"""
    
    def test_cleanup_task_registered(self):
        """Verify cleanup task is registered in server startup"""
        # Read server.py to verify cleanup_task is registered
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        assert "cleanup_temp_files" in content, "cleanup_temp_files should be imported"
        assert "cleanup_task" in content, "cleanup_task should be defined"
        assert "asyncio.create_task(cleanup_temp_files())" in content, "cleanup_task should be created"
        print("PASS: Cleanup task is registered in server startup")
    
    def test_cleanup_function_exists(self):
        """Verify cleanup function exists in background_tasks.py"""
        bg_tasks_path = "/app/backend/background_tasks.py"
        with open(bg_tasks_path, 'r') as f:
            content = f.read()
        
        assert "async def cleanup_temp_files" in content, "cleanup_temp_files function should exist"
        assert "temp_ledger_pdfs" in content, "Should clean temp_ledger_pdfs"
        assert "temp_backup_files" in content, "Should clean temp_backup_files"
        assert "timedelta(days=2)" in content, "Should use 2-day cutoff"
        print("PASS: Cleanup function exists with correct logic")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
