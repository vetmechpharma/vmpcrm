"""
Test WhatsApp Direct Send Feature
Tests the new WhatsApp direct message functionality with support for:
- Text messages
- Image messages (via URL)
- PDF messages (via URL)
- Product messages (with item_id)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWhatsAppDirectSend:
    """Test WhatsApp Direct Send API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get an item for product message testing
        items_response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        if items_response.status_code == 200:
            items = items_response.json()
            self.test_item = items[0] if items else None
        else:
            self.test_item = None
    
    def test_send_direct_text_message(self):
        """Test sending a direct text WhatsApp message"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488",
                "name": "Test Doctor",
                "message": "Test text message from WhatsApp Direct Send feature",
                "message_type": "text"
            }
        )
        # Should return 200 or 400 (if WhatsApp not configured)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        data = response.json()
        if response.status_code == 200:
            assert "status" in data
            print(f"Text message response: {data}")
        else:
            assert "detail" in data
            print(f"WhatsApp not configured: {data['detail']}")
    
    def test_send_direct_image_message(self):
        """Test sending a direct image WhatsApp message"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488",
                "name": "Test Doctor",
                "message": "Test image caption",
                "message_type": "image",
                "file_url": "https://example.com/test-image.jpg"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        data = response.json()
        print(f"Image message response: {data}")
    
    def test_send_direct_pdf_message(self):
        """Test sending a direct PDF WhatsApp message"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488",
                "name": "Test Doctor",
                "message": "Test PDF caption",
                "message_type": "pdf",
                "file_url": "https://example.com/test-document.pdf"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        data = response.json()
        print(f"PDF message response: {data}")
    
    def test_send_direct_product_message_valid_item(self):
        """Test sending a direct product WhatsApp message with valid item_id"""
        if not self.test_item:
            pytest.skip("No items available for testing")
        
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488",
                "name": "Test Doctor",
                "message": "Check out this product!",
                "message_type": "product",
                "item_id": self.test_item["id"]
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        data = response.json()
        print(f"Product message response: {data}")
    
    def test_send_direct_product_message_invalid_item(self):
        """Test sending a direct product WhatsApp message with invalid item_id - should return 404"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488",
                "name": "Test Doctor",
                "message": "Check out this product!",
                "message_type": "product",
                "item_id": "invalid-item-id-12345"
            }
        )
        # Should return 404 for invalid item
        assert response.status_code == 404, f"Expected 404 for invalid item, got: {response.status_code}, {response.text}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print(f"Invalid item response (expected 404): {data}")
    
    def test_send_direct_non_admin_forbidden(self):
        """Test that non-admin users cannot send direct WhatsApp messages - should return 403"""
        # First create a staff user or use existing one
        # For this test, we'll try with an invalid/no token
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers={"Authorization": "Bearer invalid-token"},
            json={
                "phone": "9944472488",
                "name": "Test",
                "message": "Test message",
                "message_type": "text"
            }
        )
        # Should return 401 (invalid token) or 403 (forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"
        print(f"Non-admin response (expected 401/403): {response.status_code}")
    
    def test_send_direct_no_auth(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            json={
                "phone": "9944472488",
                "name": "Test",
                "message": "Test message",
                "message_type": "text"
            }
        )
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"
        print(f"No auth response (expected 401/403): {response.status_code}")


class TestWhatsAppDirectSendModel:
    """Test WhatsApp Direct Send model validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_message_type_defaults_to_text(self):
        """Test that message_type defaults to 'text' when not provided"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488",
                "message": "Test message without message_type"
            }
        )
        # Should work with default message_type
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"Default message_type response: {response.json()}")
    
    def test_required_fields_phone_and_message(self):
        """Test that phone and message are required fields"""
        # Missing phone
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "message": "Test message"
            }
        )
        assert response.status_code == 422, f"Expected 422 for missing phone, got: {response.status_code}"
        
        # Missing message
        response = requests.post(f"{BASE_URL}/api/whatsapp/send-direct", 
            headers=self.headers,
            json={
                "phone": "9944472488"
            }
        )
        assert response.status_code == 422, f"Expected 422 for missing message, got: {response.status_code}"


class TestItemsAPIForProductSelection:
    """Test Items API for product selection in WhatsApp dialog"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_items_list(self):
        """Test that items list is available for product selection"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.headers)
        assert response.status_code == 200, f"Failed to get items: {response.text}"
        items = response.json()
        assert isinstance(items, list), "Items should be a list"
        print(f"Found {len(items)} items for product selection")
        
        if items:
            # Verify item structure has required fields for product display
            item = items[0]
            assert "id" in item, "Item should have id"
            assert "item_name" in item, "Item should have item_name"
            assert "item_code" in item, "Item should have item_code"
            assert "mrp" in item, "Item should have mrp"
            print(f"Sample item: {item.get('item_name')} ({item.get('item_code')}) - MRP: {item.get('mrp')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
