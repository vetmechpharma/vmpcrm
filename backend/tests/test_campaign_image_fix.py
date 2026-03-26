"""
Test suite for Campaign Image Fix and related features
- Campaign image endpoint returns proper binary image data (not base64 text)
- Item image endpoint supports JPEG format
- Ledger PDF token endpoint
- Login and basic API endpoints
- PWA icons verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendHealth:
    """Test backend health and startup"""
    
    def test_health_endpoint(self):
        """Backend health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health endpoint working")

class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_with_admin_credentials(self):
        """Login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("email") == "admin@vmpcrm.com"
        print("✓ Admin login successful")
        return data["access_token"]

class TestCampaignImageEndpoint:
    """Test campaign image endpoint - key fix for base64 decoding"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_campaign_image_returns_binary_webp(self, auth_token):
        """Campaign image endpoint returns proper binary WebP data (not base64 text)"""
        # First get a campaign with an image
        headers = {"Authorization": f"Bearer {auth_token}"}
        campaigns_response = requests.get(f"{BASE_URL}/api/marketing/campaigns", headers=headers)
        assert campaigns_response.status_code == 200, f"Failed to get campaigns: {campaigns_response.text}"
        
        data = campaigns_response.json()
        campaigns = data.get('campaigns', []) if isinstance(data, dict) else data
        campaign_with_image = None
        
        # Find a campaign with has_image=true
        for campaign in campaigns:
            if campaign.get('has_image'):
                campaign_with_image = campaign
                break
        
        if not campaign_with_image:
            # Try the known campaign ID from the test request
            campaign_id = "407fd846-09ee-4fc4-b3fe-187a345e8f93"
        else:
            campaign_id = campaign_with_image['id']
        
        response = requests.get(f"{BASE_URL}/api/marketing/campaigns/{campaign_id}/image")
        if response.status_code == 404:
            pytest.skip("No campaign with image found")
        assert response.status_code == 200, f"Failed to get campaign image: {response.text}"
        
        # Verify it's binary image data, not base64 text
        content = response.content
        content_type = response.headers.get('content-type', '')
        
        # Check content type
        assert 'image/webp' in content_type, f"Expected image/webp, got {content_type}"
        
        # WebP files start with RIFF header
        assert content[:4] == b'RIFF', f"Image data doesn't look like WebP. First 20 bytes: {content[:20]}"
        
        # Make sure it's not base64 text (base64 would be ASCII characters)
        try:
            # If this succeeds as ASCII text, it's likely base64 (wrong)
            text = content.decode('ascii')
            # If it looks like base64, fail
            if text.startswith('UklGR') or text.startswith('/9j/'):  # Common base64 prefixes
                pytest.fail("Image data appears to be base64 text, not binary data")
        except UnicodeDecodeError:
            # Good - binary data can't be decoded as ASCII
            pass
        
        print(f"✓ Campaign image returns binary WebP data ({len(content)} bytes)")
    
    def test_campaign_image_jpeg_format(self, auth_token):
        """Campaign image endpoint returns JPEG when ?fmt=jpg is used"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        campaigns_response = requests.get(f"{BASE_URL}/api/marketing/campaigns", headers=headers)
        assert campaigns_response.status_code == 200
        
        data = campaigns_response.json()
        campaigns = data.get('campaigns', []) if isinstance(data, dict) else data
        campaign_with_image = None
        
        for campaign in campaigns:
            if campaign.get('has_image'):
                campaign_with_image = campaign
                break
        
        if not campaign_with_image:
            campaign_id = "407fd846-09ee-4fc4-b3fe-187a345e8f93"
        else:
            campaign_id = campaign_with_image['id']
        
        response = requests.get(f"{BASE_URL}/api/marketing/campaigns/{campaign_id}/image?fmt=jpg")
        if response.status_code == 404:
            pytest.skip("No campaign with image found")
        
        assert response.status_code == 200, f"Failed to get campaign image as JPEG: {response.text}"
        
        content = response.content
        content_type = response.headers.get('content-type', '')
        
        # Check content type
        assert 'image/jpeg' in content_type, f"Expected image/jpeg, got {content_type}"
        
        # JPEG files start with FFD8FF
        assert content[:3] == b'\xff\xd8\xff', f"Image data doesn't look like JPEG. First 10 bytes: {content[:10].hex()}"
        
        print(f"✓ Campaign image returns binary JPEG data ({len(content)} bytes)")
    
    def test_campaign_image_404_for_nonexistent(self):
        """Campaign image returns 404 for non-existent campaign"""
        response = requests.get(f"{BASE_URL}/api/marketing/campaigns/nonexistent-id/image")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Campaign image returns 404 for non-existent campaign")

class TestItemImageEndpoint:
    """Test item image endpoint with JPEG format support"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_item_image_jpeg_format(self, auth_token):
        """Item image endpoint returns JPEG when ?fmt=jpg is used"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        items_response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        assert items_response.status_code == 200
        
        items = items_response.json()
        item_with_image = None
        
        for item in items:
            if item.get('image_url'):
                item_with_image = item
                break
        
        if not item_with_image:
            pytest.skip("No item with image found")
        
        item_id = item_with_image['id']
        
        # Test WebP format (default)
        response_webp = requests.get(f"{BASE_URL}/api/items/{item_id}/image")
        assert response_webp.status_code == 200
        assert 'image/webp' in response_webp.headers.get('content-type', '')
        print(f"✓ Item image returns WebP by default ({len(response_webp.content)} bytes)")
        
        # Test JPEG format
        response_jpg = requests.get(f"{BASE_URL}/api/items/{item_id}/image?fmt=jpg")
        assert response_jpg.status_code == 200
        
        content = response_jpg.content
        content_type = response_jpg.headers.get('content-type', '')
        
        assert 'image/jpeg' in content_type, f"Expected image/jpeg, got {content_type}"
        assert content[:3] == b'\xff\xd8\xff', f"Image data doesn't look like JPEG"
        
        print(f"✓ Item image returns JPEG with ?fmt=jpg ({len(content)} bytes)")

class TestLedgerPDFEndpoint:
    """Test ledger PDF token endpoint"""
    
    def test_ledger_pdf_404_for_invalid_token(self):
        """Ledger PDF endpoint returns 404 for invalid token"""
        response = requests.get(f"{BASE_URL}/api/ledger-pdf/invalid-token-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "not found" in data.get("detail", "").lower() or "expired" in data.get("detail", "").lower()
        print("✓ Ledger PDF returns 404 for invalid token")

class TestBasicEndpoints:
    """Test basic API endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_orders_endpoint(self, auth_token):
        """Orders endpoint returns list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200, f"Orders endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Orders should return a list"
        print(f"✓ Orders endpoint returns {len(data)} orders")
    
    def test_marketing_campaigns_endpoint(self, auth_token):
        """Marketing campaigns endpoint returns list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/marketing/campaigns", headers=headers)
        assert response.status_code == 200, f"Marketing campaigns endpoint failed: {response.text}"
        data = response.json()
        # Response is a dict with 'campaigns' key
        assert isinstance(data, dict), "Campaigns should return a dict"
        assert 'campaigns' in data, "Response should have 'campaigns' key"
        campaigns = data['campaigns']
        assert isinstance(campaigns, list), "campaigns should be a list"
        print(f"✓ Marketing campaigns endpoint returns {len(campaigns)} campaigns")

class TestPWAIcons:
    """Test PWA icons are accessible"""
    
    def test_customer_pwa_icon_192(self):
        """Customer PWA icon 192x192 is accessible"""
        response = requests.get(f"{BASE_URL}/icons/icon-192.png")
        assert response.status_code == 200, f"Icon 192 not found: {response.status_code}"
        content = response.content
        # PNG files start with specific header
        assert content[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG file"
        print(f"✓ Customer PWA icon-192.png accessible ({len(content)} bytes)")
    
    def test_customer_pwa_icon_512(self):
        """Customer PWA icon 512x512 is accessible"""
        response = requests.get(f"{BASE_URL}/icons/icon-512.png")
        assert response.status_code == 200, f"Icon 512 not found: {response.status_code}"
        content = response.content
        assert content[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG file"
        print(f"✓ Customer PWA icon-512.png accessible ({len(content)} bytes)")
    
    def test_mr_pwa_icon_192(self):
        """MR PWA icon 192x192 is accessible"""
        response = requests.get(f"{BASE_URL}/mr-icon-192.png")
        assert response.status_code == 200, f"MR Icon 192 not found: {response.status_code}"
        content = response.content
        assert content[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG file"
        print(f"✓ MR PWA mr-icon-192.png accessible ({len(content)} bytes)")
    
    def test_mr_pwa_icon_512(self):
        """MR PWA icon 512x512 is accessible"""
        response = requests.get(f"{BASE_URL}/mr-icon-512.png")
        assert response.status_code == 200, f"MR Icon 512 not found: {response.status_code}"
        content = response.content
        assert content[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG file"
        print(f"✓ MR PWA mr-icon-512.png accessible ({len(content)} bytes)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
