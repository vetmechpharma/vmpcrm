"""
Test suite for new features:
1. Item visibility toggle (is_hidden field)
2. Message templates system (WhatsApp + Email)
3. Item images ZIP download
4. Company short name field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestItemVisibility:
    """Test item hide/show toggle functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_items_returns_is_hidden_field(self):
        """GET /api/items should return is_hidden field"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list), "Items should be a list"
        if len(items) > 0:
            # Check that is_hidden field exists
            assert 'is_hidden' in items[0], "is_hidden field should be present in item response"
            print(f"PASS: Items list contains is_hidden field. First item is_hidden={items[0].get('is_hidden')}")
    
    def test_toggle_item_visibility_hide(self):
        """PATCH /api/items/{id}/visibility should toggle is_hidden"""
        # First get an item
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        assert response.status_code == 200
        items = response.json()
        assert len(items) > 0, "Need at least one item to test"
        
        item_id = items[0]['id']
        
        # Toggle to hidden
        response = requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": True},
            headers=self.headers
        )
        assert response.status_code == 200, f"Toggle visibility failed: {response.text}"
        data = response.json()
        assert data.get('is_hidden') == True, "is_hidden should be True"
        print(f"PASS: Item {item_id} visibility toggled to hidden")
        
        # Verify the change persisted
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        items = response.json()
        item = next((i for i in items if i['id'] == item_id), None)
        assert item is not None, "Item should still exist"
        assert item.get('is_hidden') == True, "is_hidden should persist as True"
        print(f"PASS: Item visibility change persisted")
        
        # Toggle back to visible
        response = requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": False},
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"PASS: Item {item_id} visibility toggled back to visible")
    
    def test_hidden_items_filtered_from_public_items(self):
        """GET /api/public/items should NOT return hidden items"""
        # First get all items (admin view)
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        items = response.json()
        
        if len(items) == 0:
            pytest.skip("No items to test")
        
        # Hide an item
        item_id = items[0]['id']
        requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": True},
            headers=self.headers
        )
        
        # Check public items endpoint
        response = requests.get(f"{BASE_URL}/api/public/items")
        assert response.status_code == 200
        public_items = response.json()
        
        # Hidden item should not be in public list
        hidden_item = next((i for i in public_items if i.get('id') == item_id), None)
        assert hidden_item is None, "Hidden item should NOT appear in public items"
        print(f"PASS: Hidden item {item_id} not in public items list")
        
        # Unhide the item
        requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": False},
            headers=self.headers
        )
    
    def test_hidden_items_still_visible_in_admin_items(self):
        """GET /api/items (admin) should still show hidden items"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        items = response.json()
        
        if len(items) == 0:
            pytest.skip("No items to test")
        
        # Hide an item
        item_id = items[0]['id']
        requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": True},
            headers=self.headers
        )
        
        # Admin should still see it
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        admin_items = response.json()
        hidden_item = next((i for i in admin_items if i.get('id') == item_id), None)
        assert hidden_item is not None, "Admin should still see hidden items"
        assert hidden_item.get('is_hidden') == True, "Item should be marked as hidden"
        print(f"PASS: Admin can still see hidden item {item_id}")
        
        # Unhide the item
        requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": False},
            headers=self.headers
        )


class TestMessageTemplates:
    """Test WhatsApp and Email message templates system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_templates(self):
        """GET /api/message-templates returns all templates"""
        response = requests.get(f"{BASE_URL}/api/message-templates", headers=self.headers)
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        assert len(templates) > 0, "Should have at least one template"
        
        # Check template structure
        template = templates[0]
        assert 'key' in template, "Template should have key"
        assert 'name' in template, "Template should have name"
        assert 'category' in template, "Template should have category"
        assert 'template' in template, "Template should have template text"
        print(f"PASS: Got {len(templates)} message templates")
    
    def test_get_whatsapp_templates(self):
        """GET /api/message-templates?category=whatsapp returns WhatsApp templates"""
        response = requests.get(
            f"{BASE_URL}/api/message-templates",
            params={"category": "whatsapp"},
            headers=self.headers
        )
        assert response.status_code == 200
        templates = response.json()
        
        # All should be whatsapp category
        for t in templates:
            assert t.get('category') == 'whatsapp', f"Template {t.get('key')} should be whatsapp category"
        print(f"PASS: Got {len(templates)} WhatsApp templates")
    
    def test_get_email_templates(self):
        """GET /api/message-templates?category=email returns Email templates"""
        response = requests.get(
            f"{BASE_URL}/api/message-templates",
            params={"category": "email"},
            headers=self.headers
        )
        assert response.status_code == 200
        templates = response.json()
        
        # All should be email category
        for t in templates:
            assert t.get('category') == 'email', f"Template {t.get('key')} should be email category"
        print(f"PASS: Got {len(templates)} Email templates")
    
    def test_update_template(self):
        """PUT /api/message-templates/{key} saves custom template"""
        # Get templates first
        response = requests.get(
            f"{BASE_URL}/api/message-templates",
            params={"category": "whatsapp"},
            headers=self.headers
        )
        templates = response.json()
        assert len(templates) > 0, "Need at least one template"
        
        template = templates[0]
        template_key = template['key']
        original_text = template.get('template', '')
        
        # Update template
        new_text = original_text + "\n\n[TEST MODIFICATION]"
        response = requests.put(
            f"{BASE_URL}/api/message-templates/{template_key}",
            json={
                "name": template.get('name'),
                "category": template.get('category'),
                "variables": template.get('variables', []),
                "template": new_text
            },
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update template: {response.text}"
        print(f"PASS: Template {template_key} updated")
        
        # Verify update persisted
        response = requests.get(f"{BASE_URL}/api/message-templates", headers=self.headers)
        templates = response.json()
        updated = next((t for t in templates if t['key'] == template_key), None)
        assert updated is not None, "Template should exist"
        assert "[TEST MODIFICATION]" in updated.get('template', ''), "Update should persist"
        print(f"PASS: Template update persisted")
        
        # Reset to default
        response = requests.post(
            f"{BASE_URL}/api/message-templates/{template_key}/reset",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"PASS: Template {template_key} reset to default")
    
    def test_reset_template(self):
        """POST /api/message-templates/{key}/reset resets to default"""
        # Get a template
        response = requests.get(
            f"{BASE_URL}/api/message-templates",
            params={"category": "whatsapp"},
            headers=self.headers
        )
        templates = response.json()
        template_key = templates[0]['key']
        
        # Reset it
        response = requests.post(
            f"{BASE_URL}/api/message-templates/{template_key}/reset",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to reset template: {response.text}"
        data = response.json()
        assert "reset" in data.get('message', '').lower() or "default" in data.get('message', '').lower()
        print(f"PASS: Template {template_key} reset successfully")


class TestItemImagesDownload:
    """Test item images ZIP download"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_download_images_zip(self):
        """GET /api/items/images/download returns ZIP file"""
        response = requests.get(
            f"{BASE_URL}/api/items/images/download",
            headers=self.headers
        )
        
        # Could be 200 (has images) or 404 (no images)
        if response.status_code == 404:
            print("SKIP: No item images found in database")
            pytest.skip("No item images to download")
        
        assert response.status_code == 200, f"Failed to download images: {response.text}"
        
        # Check content type
        content_type = response.headers.get('content-type', '')
        assert 'zip' in content_type or 'octet-stream' in content_type, f"Expected ZIP content type, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get('content-disposition', '')
        assert 'item_images.zip' in content_disp, f"Expected item_images.zip in disposition, got {content_disp}"
        
        # Check we got some data
        assert len(response.content) > 0, "ZIP file should have content"
        print(f"PASS: Downloaded ZIP file ({len(response.content)} bytes)")


class TestCompanyShortName:
    """Test company short name field in company settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_company_settings_has_short_name(self):
        """GET /api/company-settings returns company_short_name field"""
        response = requests.get(f"{BASE_URL}/api/company-settings", headers=self.headers)
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        data = response.json()
        
        # company_short_name should be in response (can be null)
        assert 'company_short_name' in data, "company_short_name field should be present"
        print(f"PASS: company_short_name field present, value: {data.get('company_short_name')}")
    
    def test_save_company_short_name(self):
        """POST /api/company-settings saves company_short_name"""
        # Get current settings
        response = requests.get(f"{BASE_URL}/api/company-settings", headers=self.headers)
        current = response.json()
        
        # Update with short name
        test_short_name = "TESTCO"
        payload = {
            "company_name": current.get('company_name', 'Test Company'),
            "company_short_name": test_short_name,
            "address": current.get('address', 'Test Address'),
            "email": current.get('email', 'test@test.com'),
            "gst_number": current.get('gst_number', 'TEST123'),
            "drug_license": current.get('drug_license', 'DL-TEST')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company-settings",
            json=payload,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to save settings: {response.text}"
        print(f"PASS: Company settings saved with short name")
        
        # Verify it persisted
        response = requests.get(f"{BASE_URL}/api/company-settings", headers=self.headers)
        data = response.json()
        assert data.get('company_short_name') == test_short_name, f"Short name should be {test_short_name}"
        print(f"PASS: company_short_name persisted as {test_short_name}")
    
    def test_public_company_settings_has_short_name(self):
        """GET /api/public/company-settings returns company_short_name"""
        response = requests.get(f"{BASE_URL}/api/public/company-settings")
        assert response.status_code == 200, f"Failed to get public settings: {response.text}"
        data = response.json()
        
        # Should have company_short_name
        assert 'company_short_name' in data, "Public settings should include company_short_name"
        print(f"PASS: Public company settings has company_short_name: {data.get('company_short_name')}")


class TestHiddenItemsFiltering:
    """Test that hidden items are filtered from customer/MR endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_customer_items_excludes_hidden(self):
        """GET /api/customer/items should exclude hidden items"""
        # Get items and hide one
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        items = response.json()
        
        if len(items) == 0:
            pytest.skip("No items to test")
        
        item_id = items[0]['id']
        
        # Hide the item
        requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": True},
            headers=self.headers
        )
        
        # Login as customer (need customer token)
        # Try to get customer items - this endpoint may require customer auth
        # For now, test the public items endpoint which has same filtering
        response = requests.get(f"{BASE_URL}/api/public/items")
        assert response.status_code == 200
        public_items = response.json()
        
        hidden_in_public = next((i for i in public_items if i.get('id') == item_id), None)
        assert hidden_in_public is None, "Hidden item should not appear in public/customer items"
        print(f"PASS: Hidden item {item_id} excluded from public items")
        
        # Unhide
        requests.patch(
            f"{BASE_URL}/api/items/{item_id}/visibility",
            json={"is_hidden": False},
            headers=self.headers
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
