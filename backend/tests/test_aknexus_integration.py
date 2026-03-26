"""
Test AKNexus WhatsApp Business API Integration
Tests for AKNexus as second WhatsApp provider with REST API style (POST with access_token in body)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"

# Config IDs
AKNEXUS_CONFIG_ID = "4abeeec8-a325-4f08-bb0a-34771d68cfda"
BOTMASTER_CONFIG_ID = "45d35af1-3a75-4e02-8495-5b615664af29"

# Test phone number
TEST_PHONE = "9944472488"

# AKNexus credentials
AKNEXUS_ACCESS_TOKEN = "69bb937459e3f"
AKNEXUS_INSTANCE_ID = "69BCCA1F058AB"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestAKNexusConfigExists:
    """Verify AKNexus config exists with correct settings"""
    
    def test_aknexus_config_exists_with_rest_api_type(self, auth_headers):
        """AKNexus config should exist with api_type=rest_api"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get configs: {response.text}"
        
        configs = response.json()
        aknexus = next((c for c in configs if c['id'] == AKNEXUS_CONFIG_ID), None)
        
        assert aknexus is not None, "AKNexus config not found"
        assert aknexus.get('api_type') == 'rest_api', f"Expected api_type=rest_api, got {aknexus.get('api_type')}"
        print(f"✓ AKNexus config exists with api_type=rest_api")
    
    def test_aknexus_config_has_correct_instance_id(self, auth_headers):
        """AKNexus config should have instance_id=69BCCA1F058AB"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        aknexus = next((c for c in configs if c['id'] == AKNEXUS_CONFIG_ID), None)
        
        assert aknexus is not None, "AKNexus config not found"
        assert aknexus.get('instance_id') == AKNEXUS_INSTANCE_ID, \
            f"Expected instance_id={AKNEXUS_INSTANCE_ID}, got {aknexus.get('instance_id')}"
        print(f"✓ AKNexus config has correct instance_id={AKNEXUS_INSTANCE_ID}")
    
    def test_aknexus_config_is_active(self, auth_headers):
        """AKNexus config should be the active config"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-config", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get active config: {response.text}"
        
        active_config = response.json()
        assert active_config.get('id') == AKNEXUS_CONFIG_ID, \
            f"Expected AKNexus to be active, got {active_config.get('name')}"
        assert active_config.get('is_active') == True, "AKNexus should be active"
        print(f"✓ AKNexus is the active config")


class TestAKNexusAPITest:
    """Test AKNexus API via test endpoints"""
    
    def test_active_config_test_sends_via_aknexus(self, auth_headers):
        """POST /api/whatsapp-config/test should send via AKNexus (active config)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/test?mobile={TEST_PHONE}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test failed: {response.text}"
        
        result = response.json()
        assert result.get('status') == 'success', f"Expected success, got {result.get('status')}"
        
        # Verify AKNexus response format (status: success, message: Message sent successfully)
        response_text = result.get('response', '')
        assert '"status": "success"' in response_text or '"status":"success"' in response_text, \
            f"Response should contain AKNexus success format"
        print(f"✓ Active config test sends via AKNexus successfully")
    
    def test_per_config_test_aknexus(self, auth_headers):
        """POST /api/whatsapp-config/{aknexus_id}/test should send via AKNexus"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{AKNEXUS_CONFIG_ID}/test?mobile={TEST_PHONE}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test failed: {response.text}"
        
        result = response.json()
        assert result.get('status') == 'success', f"Expected success, got {result.get('status')}"
        assert 'AKNexus' in result.get('message', ''), "Message should mention AKNexus"
        print(f"✓ Per-config test for AKNexus sends successfully")
    
    def test_per_config_test_botmaster(self, auth_headers):
        """POST /api/whatsapp-config/{botmaster_id}/test should send via BotMasterSender"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{BOTMASTER_CONFIG_ID}/test?mobile={TEST_PHONE}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test failed: {response.text}"
        
        result = response.json()
        assert result.get('status') == 'success', f"Expected success, got {result.get('status')}"
        
        # Verify BotMasterSender response format (success: true)
        response_text = result.get('response', '')
        assert '"success":true' in response_text or '"success": true' in response_text, \
            f"Response should contain BotMasterSender success format"
        print(f"✓ Per-config test for BotMasterSender sends successfully")


class TestAKNexusResponseFormat:
    """Test that campaign success check handles AKNexus response format"""
    
    def test_aknexus_response_contains_status_success(self, auth_headers):
        """AKNexus response should contain status:success for campaign success check"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{AKNEXUS_CONFIG_ID}/test?mobile={TEST_PHONE}",
            headers=auth_headers
        )
        result = response.json()
        response_text = result.get('response', '')
        
        # Campaign success check looks for: "status":"success" or "status": "success"
        has_status_success = '"status":"success"' in response_text or '"status": "success"' in response_text
        assert has_status_success, f"AKNexus response should contain status:success for campaign handling"
        print(f"✓ AKNexus response format compatible with campaign success check")
    
    def test_botmaster_response_contains_success_true(self, auth_headers):
        """BotMasterSender response should contain success:true for campaign success check"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{BOTMASTER_CONFIG_ID}/test?mobile={TEST_PHONE}",
            headers=auth_headers
        )
        result = response.json()
        response_text = result.get('response', '')
        
        # Campaign success check looks for: "success":true or "success": true
        has_success_true = '"success":true' in response_text or '"success": true' in response_text
        assert has_success_true, f"BotMasterSender response should contain success:true for campaign handling"
        print(f"✓ BotMasterSender response format compatible with campaign success check")


class TestDualConfigDisplay:
    """Test that both configs are returned correctly"""
    
    def test_get_all_configs_returns_both(self, auth_headers):
        """GET /api/whatsapp-configs should return both AKNexus and BotMasterSender"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        assert response.status_code == 200
        
        configs = response.json()
        config_ids = [c['id'] for c in configs]
        
        assert AKNEXUS_CONFIG_ID in config_ids, "AKNexus config should be in list"
        assert BOTMASTER_CONFIG_ID in config_ids, "BotMasterSender config should be in list"
        print(f"✓ Both configs returned: {len(configs)} total")
    
    def test_aknexus_has_rest_api_fields(self, auth_headers):
        """AKNexus config should have REST API specific fields"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        aknexus = next((c for c in configs if c['id'] == AKNEXUS_CONFIG_ID), None)
        
        assert aknexus.get('api_type') == 'rest_api', "Should have api_type=rest_api"
        assert aknexus.get('instance_id') == AKNEXUS_INSTANCE_ID, "Should have correct instance_id"
        assert aknexus.get('http_method') == 'POST', "Should have http_method=POST"
        print(f"✓ AKNexus has REST API fields: api_type=rest_api, instance_id={AKNEXUS_INSTANCE_ID}")
    
    def test_botmaster_has_query_param_fields(self, auth_headers):
        """BotMasterSender config should have query_param type"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        botmaster = next((c for c in configs if c['id'] == BOTMASTER_CONFIG_ID), None)
        
        # BotMasterSender may not have api_type set (defaults to query_param)
        api_type = botmaster.get('api_type', 'query_param')
        assert api_type == 'query_param', f"Should have api_type=query_param, got {api_type}"
        assert botmaster.get('http_method') == 'GET', "Should have http_method=GET"
        print(f"✓ BotMasterSender has query_param fields: api_type=query_param, http_method=GET")


class TestConfigActivation:
    """Test config activation switching"""
    
    def test_only_one_config_active(self, auth_headers):
        """Only one config should be active at a time"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        
        active_count = sum(1 for c in configs if c.get('is_active'))
        assert active_count == 1, f"Should have exactly 1 active config, got {active_count}"
        print(f"✓ Only 1 config is active")
    
    def test_aknexus_is_currently_active(self, auth_headers):
        """AKNexus should be the currently active config"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        
        aknexus = next((c for c in configs if c['id'] == AKNEXUS_CONFIG_ID), None)
        assert aknexus.get('is_active') == True, "AKNexus should be active"
        
        botmaster = next((c for c in configs if c['id'] == BOTMASTER_CONFIG_ID), None)
        assert botmaster.get('is_active') == False, "BotMasterSender should be inactive"
        print(f"✓ AKNexus is active, BotMasterSender is inactive")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
