"""
Test module for Birthday/Anniversary Greeting Templates System
Tests CRUD operations, validation, seeding, and logs for greeting templates.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGreetingTemplatesAPI:
    """Tests for Greeting Templates CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Create headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    # ========== GET /api/greeting-templates ==========
    
    def test_get_all_templates_returns_seeded_templates(self, auth_headers):
        """Verify that pre-seeded templates exist (15 templates: 8 birthday, 7 anniversary)"""
        response = requests.get(f"{BASE_URL}/api/greeting-templates", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 15, f"Expected at least 15 seeded templates, got {len(data)}"
        
        # Verify template structure
        if len(data) > 0:
            template = data[0]
            assert "id" in template, "Template should have id"
            assert "type" in template, "Template should have type"
            assert "message" in template, "Template should have message"
            assert "is_active" in template, "Template should have is_active"
        
        print(f"✓ GET /api/greeting-templates returned {len(data)} templates")
    
    def test_get_templates_count_by_type(self, auth_headers):
        """Verify 8 birthday and 7 anniversary templates are seeded"""
        response = requests.get(f"{BASE_URL}/api/greeting-templates", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        birthday_count = len([t for t in data if t.get('type') == 'birthday'])
        anniversary_count = len([t for t in data if t.get('type') == 'anniversary'])
        
        # Verify seeded counts (at least what was seeded, might have more from tests)
        assert birthday_count >= 8, f"Expected at least 8 birthday templates, got {birthday_count}"
        assert anniversary_count >= 7, f"Expected at least 7 anniversary templates, got {anniversary_count}"
        
        print(f"✓ Template counts: {birthday_count} birthday, {anniversary_count} anniversary")
    
    def test_get_templates_filter_by_type(self, auth_headers):
        """Verify filter by type query parameter works"""
        # Filter birthday
        response = requests.get(f"{BASE_URL}/api/greeting-templates?type=birthday", headers=auth_headers)
        assert response.status_code == 200
        birthday_templates = response.json()
        for t in birthday_templates:
            assert t['type'] == 'birthday', f"Filter returned wrong type: {t['type']}"
        
        # Filter anniversary
        response = requests.get(f"{BASE_URL}/api/greeting-templates?type=anniversary", headers=auth_headers)
        assert response.status_code == 200
        anniversary_templates = response.json()
        for t in anniversary_templates:
            assert t['type'] == 'anniversary', f"Filter returned wrong type: {t['type']}"
        
        print(f"✓ Type filter works: {len(birthday_templates)} birthday, {len(anniversary_templates)} anniversary filtered")
    
    def test_templates_have_placeholders(self, auth_headers):
        """Verify templates contain {customer_name} placeholder"""
        response = requests.get(f"{BASE_URL}/api/greeting-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        templates_with_placeholder = [t for t in data if '{customer_name}' in t.get('message', '')]
        assert len(templates_with_placeholder) > 0, "At least some templates should have {customer_name} placeholder"
        
        print(f"✓ {len(templates_with_placeholder)} templates contain {{customer_name}} placeholder")
    
    def test_get_templates_without_auth_fails(self):
        """Verify unauthenticated access fails"""
        response = requests.get(f"{BASE_URL}/api/greeting-templates")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /api/greeting-templates without auth correctly returns 401/403")
    
    # ========== POST /api/greeting-templates ==========
    
    def test_create_template_success(self, auth_headers):
        """Create a new greeting template"""
        payload = {
            "type": "birthday",
            "message": "TEST_TEMPLATE: Happy Birthday {customer_name}! Best wishes from {company_name}.",
            "image_url": "https://example.com/test-image.jpg",
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/greeting-templates", json=payload, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["type"] == "birthday"
        assert "TEST_TEMPLATE" in data["message"]
        assert data["is_active"] == True
        assert data["image_url"] == "https://example.com/test-image.jpg"
        
        # Store for cleanup
        TestGreetingTemplatesAPI.created_template_id = data["id"]
        
        print(f"✓ Created template with id: {data['id']}")
    
    def test_create_anniversary_template(self, auth_headers):
        """Create an anniversary template"""
        payload = {
            "type": "anniversary",
            "message": "TEST_ANNIVERSARY: Congratulations {customer_name}! Celebrating another milestone. - {company_name}",
            "is_active": False
        }
        
        response = requests.post(f"{BASE_URL}/api/greeting-templates", json=payload, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "anniversary"
        assert data["is_active"] == False
        
        TestGreetingTemplatesAPI.anniversary_template_id = data["id"]
        print(f"✓ Created anniversary template: {data['id']}")
    
    def test_create_template_without_auth_fails(self):
        """Verify creation without auth fails"""
        payload = {"type": "birthday", "message": "Test message {customer_name}"}
        response = requests.post(f"{BASE_URL}/api/greeting-templates", json=payload)
        assert response.status_code in [401, 403]
        print("✓ POST without auth correctly returns 401/403")
    
    # ========== PUT /api/greeting-templates/{id} ==========
    
    def test_update_template_message(self, auth_headers):
        """Update template message"""
        template_id = getattr(TestGreetingTemplatesAPI, 'created_template_id', None)
        if not template_id:
            pytest.skip("No template ID from previous create test")
        
        payload = {
            "message": "TEST_TEMPLATE_UPDATED: New message for {customer_name} from {company_name}!"
        }
        
        response = requests.put(f"{BASE_URL}/api/greeting-templates/{template_id}", json=payload, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "TEST_TEMPLATE_UPDATED" in data["message"]
        
        print(f"✓ Updated template message")
    
    def test_update_template_toggle_active(self, auth_headers):
        """Toggle template active status"""
        template_id = getattr(TestGreetingTemplatesAPI, 'created_template_id', None)
        if not template_id:
            pytest.skip("No template ID from previous create test")
        
        # First get current status
        response = requests.get(f"{BASE_URL}/api/greeting-templates", headers=auth_headers)
        templates = response.json()
        current_template = next((t for t in templates if t['id'] == template_id), None)
        current_active = current_template['is_active'] if current_template else True
        
        # Toggle it
        payload = {"is_active": not current_active}
        response = requests.put(f"{BASE_URL}/api/greeting-templates/{template_id}", json=payload, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == (not current_active)
        
        print(f"✓ Toggled active from {current_active} to {not current_active}")
    
    def test_update_template_image_url(self, auth_headers):
        """Update template image URL"""
        template_id = getattr(TestGreetingTemplatesAPI, 'created_template_id', None)
        if not template_id:
            pytest.skip("No template ID")
        
        payload = {"image_url": "https://example.com/new-image.png"}
        response = requests.put(f"{BASE_URL}/api/greeting-templates/{template_id}", json=payload, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["image_url"] == "https://example.com/new-image.png"
        
        print("✓ Updated image_url")
    
    def test_update_nonexistent_template_returns_404(self, auth_headers):
        """Update non-existent template should fail"""
        response = requests.put(
            f"{BASE_URL}/api/greeting-templates/nonexistent-id-123",
            json={"message": "test"},
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✓ Update non-existent template returns 404")
    
    # ========== DELETE /api/greeting-templates/{id} ==========
    
    def test_delete_template(self, auth_headers):
        """Delete a template"""
        template_id = getattr(TestGreetingTemplatesAPI, 'anniversary_template_id', None)
        if not template_id:
            pytest.skip("No anniversary template ID")
        
        response = requests.delete(f"{BASE_URL}/api/greeting-templates/{template_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify it's deleted
        response = requests.get(f"{BASE_URL}/api/greeting-templates", headers=auth_headers)
        templates = response.json()
        deleted = next((t for t in templates if t['id'] == template_id), None)
        assert deleted is None, "Template should be deleted"
        
        print(f"✓ Deleted template {template_id}")
    
    def test_delete_nonexistent_template_returns_404(self, auth_headers):
        """Delete non-existent template should fail"""
        response = requests.delete(
            f"{BASE_URL}/api/greeting-templates/nonexistent-id-456",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✓ Delete non-existent template returns 404")
    
    # ========== GET /api/greeting-logs ==========
    
    def test_get_greeting_logs(self, auth_headers):
        """Get greeting logs"""
        response = requests.get(f"{BASE_URL}/api/greeting-logs", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Logs might be empty if no greetings have been sent
        if len(data) > 0:
            log = data[0]
            assert "contact_name" in log or "greeting_type" in log
        
        print(f"✓ GET /api/greeting-logs returned {len(data)} logs")
    
    def test_get_greeting_logs_with_limit(self, auth_headers):
        """Get greeting logs with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/greeting-logs?limit=5", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5, f"Expected max 5 logs, got {len(data)}"
        
        print(f"✓ GET /api/greeting-logs with limit=5 returned {len(data)} logs")
    
    def test_get_greeting_logs_without_auth_fails(self):
        """Verify unauthenticated access to logs fails"""
        response = requests.get(f"{BASE_URL}/api/greeting-logs")
        assert response.status_code in [401, 403]
        print("✓ GET /api/greeting-logs without auth correctly returns 401/403")
    
    # ========== Cleanup ==========
    
    def test_cleanup_test_templates(self, auth_headers):
        """Cleanup test templates created during tests"""
        template_id = getattr(TestGreetingTemplatesAPI, 'created_template_id', None)
        if template_id:
            requests.delete(f"{BASE_URL}/api/greeting-templates/{template_id}", headers=auth_headers)
            print(f"✓ Cleaned up test template: {template_id}")
        else:
            print("✓ No test templates to cleanup")


class TestGreetingTemplatesValidation:
    """Test validation and edge cases for greeting templates"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Login failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_template_contains_company_name_placeholder(self, auth_headers):
        """Verify templates can have {company_name} placeholder"""
        payload = {
            "type": "birthday",
            "message": "Happy Birthday {customer_name}! From {company_name}",
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/greeting-templates", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "{company_name}" in data["message"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/greeting-templates/{data['id']}", headers=auth_headers)
        print("✓ Template with {company_name} placeholder created successfully")
    
    def test_template_type_options(self, auth_headers):
        """Verify only birthday and anniversary types work"""
        # Birthday should work
        response = requests.post(f"{BASE_URL}/api/greeting-templates", json={
            "type": "birthday",
            "message": "Test {customer_name}"
        }, headers=auth_headers)
        assert response.status_code == 200
        requests.delete(f"{BASE_URL}/api/greeting-templates/{response.json()['id']}", headers=auth_headers)
        
        # Anniversary should work
        response = requests.post(f"{BASE_URL}/api/greeting-templates", json={
            "type": "anniversary",
            "message": "Test {customer_name}"
        }, headers=auth_headers)
        assert response.status_code == 200
        requests.delete(f"{BASE_URL}/api/greeting-templates/{response.json()['id']}", headers=auth_headers)
        
        print("✓ Both birthday and anniversary types work")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
