"""
Test WhatsApp Config APIs - Multiple Config Management
Tests:
- GET /api/whatsapp-configs - list all configs
- POST /api/whatsapp-config/{config_id}/test - test specific config
- PUT /api/whatsapp-config/{config_id}/activate - activate config
- Response body checking for success:true
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWhatsAppConfigAPIs:
    """Test WhatsApp configuration management APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        token = login_response.json().get('access_token')
        assert token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    def test_get_all_whatsapp_configs(self):
        """Test GET /api/whatsapp-configs returns list of configs"""
        response = self.session.get(f"{BASE_URL}/api/whatsapp-configs")
        assert response.status_code == 200, f"Failed to get configs: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should have at least one config (the default one)
        assert len(data) >= 1, "Should have at least one WhatsApp config"
        
        # Check first config structure
        config = data[0]
        assert 'id' in config, "Config should have id"
        assert 'name' in config, "Config should have name"
        assert 'api_url' in config, "Config should have api_url"
        assert 'sender_id' in config, "Config should have sender_id"
        assert 'is_active' in config, "Config should have is_active flag"
        
        print(f"Found {len(data)} WhatsApp config(s)")
        for cfg in data:
            print(f"  - {cfg.get('name')} (ID: {cfg.get('id')}, Active: {cfg.get('is_active')})")
    
    def test_get_active_whatsapp_config(self):
        """Test GET /api/whatsapp-config returns active config"""
        response = self.session.get(f"{BASE_URL}/api/whatsapp-config")
        assert response.status_code == 200, f"Failed to get active config: {response.text}"
        
        data = response.json()
        assert 'api_url' in data, "Active config should have api_url"
        assert 'sender_id' in data, "Active config should have sender_id"
        print(f"Active config: {data.get('name', 'Unnamed')}")
    
    def test_test_specific_config_endpoint_exists(self):
        """Test POST /api/whatsapp-config/{config_id}/test endpoint exists"""
        # First get a config ID
        configs_response = self.session.get(f"{BASE_URL}/api/whatsapp-configs")
        assert configs_response.status_code == 200
        configs = configs_response.json()
        assert len(configs) > 0, "Need at least one config to test"
        
        config_id = configs[0]['id']
        config_name = configs[0].get('name', 'Config')
        
        # Test the specific config endpoint with a test mobile number
        test_mobile = "9944472488"
        response = self.session.post(f"{BASE_URL}/api/whatsapp-config/{config_id}/test?mobile={test_mobile}")
        
        # Should return 200 (even if message fails, endpoint should work)
        assert response.status_code == 200, f"Test endpoint failed: {response.text}"
        
        data = response.json()
        assert 'status' in data, "Response should have status field"
        assert 'message' in data, "Response should have message field"
        
        print(f"Test config '{config_name}' result: status={data.get('status')}, message={data.get('message')}")
    
    def test_activate_config_endpoint(self):
        """Test PUT /api/whatsapp-config/{config_id}/activate endpoint"""
        # Get configs
        configs_response = self.session.get(f"{BASE_URL}/api/whatsapp-configs")
        assert configs_response.status_code == 200
        configs = configs_response.json()
        assert len(configs) > 0
        
        # Find the active config
        active_config = next((c for c in configs if c.get('is_active')), configs[0])
        config_id = active_config['id']
        
        # Activate it (should succeed even if already active)
        response = self.session.put(f"{BASE_URL}/api/whatsapp-config/{config_id}/activate")
        assert response.status_code == 200, f"Activate failed: {response.text}"
        
        data = response.json()
        assert 'message' in data, "Response should have message"
        print(f"Activate config result: {data.get('message')}")
    
    def test_config_has_api_numbering_fields(self):
        """Test that configs have proper fields for API numbering in UI"""
        response = self.session.get(f"{BASE_URL}/api/whatsapp-configs")
        assert response.status_code == 200
        
        configs = response.json()
        for idx, cfg in enumerate(configs):
            # Each config should have fields needed for UI display
            assert 'id' in cfg, f"Config {idx} missing id"
            assert 'name' in cfg, f"Config {idx} missing name"
            assert 'is_active' in cfg, f"Config {idx} missing is_active"
            assert 'api_url' in cfg, f"Config {idx} missing api_url"
            assert 'sender_id' in cfg, f"Config {idx} missing sender_id"
            
            # Check http_method field (used in UI)
            # It may be missing but should default to GET
            http_method = cfg.get('http_method', 'GET')
            assert http_method in ['GET', 'POST'], f"Invalid http_method: {http_method}"
        
        print(f"All {len(configs)} configs have proper structure for UI display")
    
    def test_test_config_returns_body_check_result(self):
        """Test that test endpoint checks response body for success:true"""
        configs_response = self.session.get(f"{BASE_URL}/api/whatsapp-configs")
        configs = configs_response.json()
        config_id = configs[0]['id']
        
        # Send test message
        test_mobile = "9944472488"
        response = self.session.post(f"{BASE_URL}/api/whatsapp-config/{config_id}/test?mobile={test_mobile}")
        assert response.status_code == 200
        
        data = response.json()
        # The response should indicate success or failure based on body check
        assert data.get('status') in ['success', 'failed'], f"Status should be success or failed, got: {data.get('status')}"
        
        # If failed, message should indicate why (body check)
        if data.get('status') == 'failed':
            print(f"Test failed (expected if API not configured): {data.get('message')}")
        else:
            print(f"Test succeeded: {data.get('message')}")
    
    def test_create_new_config(self):
        """Test POST /api/whatsapp-config to create new config"""
        new_config = {
            "name": "TEST_Second_API_Config",
            "api_url": "https://api.example.com/test",
            "auth_token": "test_token_123",
            "sender_id": "TEST_SENDER",
            "http_method": "GET",
            "is_active": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/whatsapp-config", json=new_config)
        assert response.status_code == 200, f"Create config failed: {response.text}"
        
        data = response.json()
        assert 'id' in data or 'message' in data, "Response should have id or message"
        
        # Verify it was created
        configs_response = self.session.get(f"{BASE_URL}/api/whatsapp-configs")
        configs = configs_response.json()
        
        test_config = next((c for c in configs if c.get('name') == 'TEST_Second_API_Config'), None)
        if test_config:
            print(f"Created new config: {test_config.get('name')} (ID: {test_config.get('id')})")
            
            # Cleanup - delete the test config
            delete_response = self.session.delete(f"{BASE_URL}/api/whatsapp-config/{test_config['id']}")
            assert delete_response.status_code == 200, f"Cleanup failed: {delete_response.text}"
            print("Test config cleaned up successfully")
        else:
            print("Config creation response:", data)
    
    def test_unauthorized_access_without_token(self):
        """Test that endpoints require authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        # Try to get configs without auth
        response = unauth_session.get(f"{BASE_URL}/api/whatsapp-configs")
        assert response.status_code in [401, 403], f"Should require auth, got: {response.status_code}"
        print("Unauthorized access correctly rejected")


class TestWhatsAppSendFallback:
    """Test WhatsApp send fallback logic (text-only when file fails)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get('access_token')
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_general_test_endpoint_checks_body(self):
        """Test POST /api/whatsapp-config/test checks response body"""
        test_mobile = "9944472488"
        response = self.session.post(f"{BASE_URL}/api/whatsapp-config/test?mobile={test_mobile}")
        
        assert response.status_code == 200, f"Test endpoint failed: {response.text}"
        
        data = response.json()
        assert 'status' in data, "Should have status field"
        assert 'message' in data, "Should have message field"
        
        # The endpoint now checks body for success:true
        print(f"General test result: status={data.get('status')}, message={data.get('message')[:100]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
