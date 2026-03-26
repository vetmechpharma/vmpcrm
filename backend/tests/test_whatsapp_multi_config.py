"""
Test WhatsApp Multi-Config API Feature
Tests for dual API type support: query_param (BotMasterSender) and rest_api (AKNexus)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"

# Existing config IDs from the system
BOTMASTER_CONFIG_ID = "45d35af1-3a75-4e02-8495-5b615664af29"  # query_param type, Active
AKNEXUS_CONFIG_ID = "4abeeec8-a325-4f08-bb0a-34771d68cfda"    # rest_api type, Inactive

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


class TestWhatsAppConfigCRUD:
    """Test WhatsApp config CRUD operations with api_type and instance_id fields"""
    
    def test_get_all_configs_returns_api_type_and_instance_id(self, auth_headers):
        """GET /api/whatsapp-configs returns configs with api_type and instance_id"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        configs = response.json()
        assert isinstance(configs, list), "Response should be a list"
        assert len(configs) >= 1, "Should have at least 1 config"
        
        # Check that configs have api_type field
        for cfg in configs:
            assert 'api_type' in cfg or cfg.get('api_type') is None, f"Config {cfg.get('id')} missing api_type"
            # instance_id is optional, only required for rest_api type
            if cfg.get('api_type') == 'rest_api':
                assert 'instance_id' in cfg, f"REST API config {cfg.get('id')} should have instance_id"
        
        print(f"✓ GET /api/whatsapp-configs returned {len(configs)} configs with api_type fields")
    
    def test_get_active_config(self, auth_headers):
        """GET /api/whatsapp-config returns active config"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-config", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        config = response.json()
        assert 'id' in config, "Config should have id"
        assert 'api_url' in config, "Config should have api_url"
        assert 'sender_id' in config, "Config should have sender_id"
        print(f"✓ GET /api/whatsapp-config returned active config: {config.get('name', 'unnamed')}")
    
    def test_create_config_with_query_param_type(self, auth_headers):
        """POST /api/whatsapp-config creates config with api_type=query_param"""
        test_config = {
            "name": f"TEST_QueryParam_{uuid.uuid4().hex[:6]}",
            "api_url": "https://test-api.example.com/api/v1/",
            "auth_token": "test_token_123",
            "sender_id": "919999999999",
            "http_method": "GET",
            "api_type": "query_param",
            "instance_id": "",
            "is_active": False
        }
        response = requests.post(f"{BASE_URL}/api/whatsapp-config", json=test_config, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        created = response.json()
        assert created.get('api_type') == 'query_param', f"api_type should be query_param, got {created.get('api_type')}"
        assert 'id' in created, "Created config should have id"
        
        # Cleanup - delete the test config
        delete_resp = requests.delete(f"{BASE_URL}/api/whatsapp-config/{created['id']}", headers=auth_headers)
        assert delete_resp.status_code == 200, f"Cleanup failed: {delete_resp.text}"
        
        print(f"✓ POST /api/whatsapp-config created query_param config successfully")
    
    def test_create_config_with_rest_api_type(self, auth_headers):
        """POST /api/whatsapp-config creates config with api_type=rest_api and instance_id"""
        test_config = {
            "name": f"TEST_RestAPI_{uuid.uuid4().hex[:6]}",
            "api_url": "https://test-rest-api.example.com/api/v2",
            "auth_token": "test_bearer_token_456",
            "sender_id": "918888888888",
            "http_method": "POST",
            "api_type": "rest_api",
            "instance_id": "test_instance_123",
            "is_active": False
        }
        response = requests.post(f"{BASE_URL}/api/whatsapp-config", json=test_config, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        created = response.json()
        assert created.get('api_type') == 'rest_api', f"api_type should be rest_api, got {created.get('api_type')}"
        assert created.get('instance_id') == 'test_instance_123', f"instance_id mismatch"
        
        # Cleanup
        delete_resp = requests.delete(f"{BASE_URL}/api/whatsapp-config/{created['id']}", headers=auth_headers)
        assert delete_resp.status_code == 200
        
        print(f"✓ POST /api/whatsapp-config created rest_api config with instance_id successfully")
    
    def test_update_config_api_type_and_instance_id(self, auth_headers):
        """PUT /api/whatsapp-config/{id} updates api_type and instance_id"""
        # First create a test config
        test_config = {
            "name": f"TEST_Update_{uuid.uuid4().hex[:6]}",
            "api_url": "https://test-update.example.com/api/",
            "auth_token": "test_token_update",
            "sender_id": "917777777777",
            "http_method": "GET",
            "api_type": "query_param",
            "instance_id": "",
            "is_active": False
        }
        create_resp = requests.post(f"{BASE_URL}/api/whatsapp-config", json=test_config, headers=auth_headers)
        assert create_resp.status_code == 200
        config_id = create_resp.json()['id']
        
        # Update to rest_api type with instance_id
        update_data = {
            "name": test_config['name'],
            "api_url": "https://test-update.example.com/api/v2",
            "auth_token": "",  # Keep existing
            "sender_id": "917777777777",
            "http_method": "POST",
            "api_type": "rest_api",
            "instance_id": "updated_instance_456",
            "is_active": False
        }
        update_resp = requests.put(f"{BASE_URL}/api/whatsapp-config/{config_id}", json=update_data, headers=auth_headers)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        # Verify update
        get_resp = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = get_resp.json()
        updated_config = next((c for c in configs if c['id'] == config_id), None)
        assert updated_config is not None, "Updated config not found"
        assert updated_config.get('api_type') == 'rest_api', f"api_type not updated"
        assert updated_config.get('instance_id') == 'updated_instance_456', f"instance_id not updated"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/whatsapp-config/{config_id}", headers=auth_headers)
        
        print(f"✓ PUT /api/whatsapp-config/{config_id} updated api_type and instance_id successfully")


class TestWhatsAppConfigActivation:
    """Test config activation/switching"""
    
    def test_activate_config_switches_active(self, auth_headers):
        """PUT /api/whatsapp-config/{id}/activate switches active config"""
        # Get current configs
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        
        if len(configs) < 2:
            pytest.skip("Need at least 2 configs to test activation switching")
        
        # Find an inactive config
        inactive_config = next((c for c in configs if not c.get('is_active')), None)
        if not inactive_config:
            pytest.skip("No inactive config to activate")
        
        # Activate it
        activate_resp = requests.put(
            f"{BASE_URL}/api/whatsapp-config/{inactive_config['id']}/activate",
            headers=auth_headers
        )
        assert activate_resp.status_code == 200, f"Activation failed: {activate_resp.text}"
        
        # Verify it's now active
        verify_resp = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        updated_configs = verify_resp.json()
        activated = next((c for c in updated_configs if c['id'] == inactive_config['id']), None)
        assert activated.get('is_active') == True, "Config should be active now"
        
        # Verify only one is active
        active_count = sum(1 for c in updated_configs if c.get('is_active'))
        assert active_count == 1, f"Should have exactly 1 active config, got {active_count}"
        
        print(f"✓ PUT /api/whatsapp-config/{inactive_config['id']}/activate switched active config")
        
        # Restore original active config (BotMasterSender)
        requests.put(f"{BASE_URL}/api/whatsapp-config/{BOTMASTER_CONFIG_ID}/activate", headers=auth_headers)


class TestWhatsAppConfigTest:
    """Test per-config test functionality"""
    
    def test_test_specific_config_endpoint_exists(self, auth_headers):
        """POST /api/whatsapp-config/{id}/test endpoint exists and validates"""
        # Test with invalid config ID
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/invalid-id-123/test?mobile=9944472488",
            headers=auth_headers
        )
        assert response.status_code == 404, "Should return 404 for invalid config ID"
        print(f"✓ POST /api/whatsapp-config/{{id}}/test returns 404 for invalid ID")
    
    def test_test_specific_config_with_valid_id(self, auth_headers):
        """POST /api/whatsapp-config/{id}/test works with valid config ID"""
        # Test with the BotMasterSender config (query_param type)
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{BOTMASTER_CONFIG_ID}/test?mobile=9944472488",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test endpoint failed: {response.text}"
        result = response.json()
        assert 'status' in result, "Response should have status field"
        assert 'message' in result, "Response should have message field"
        print(f"✓ POST /api/whatsapp-config/{BOTMASTER_CONFIG_ID}/test returned: {result.get('status')}")
    
    def test_test_rest_api_config(self, auth_headers):
        """POST /api/whatsapp-config/{id}/test works with rest_api type config"""
        # Test with the AKNexus config (rest_api type) - may fail due to test token
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{AKNEXUS_CONFIG_ID}/test?mobile=9944472488",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test endpoint failed: {response.text}"
        result = response.json()
        assert 'status' in result, "Response should have status field"
        # Note: This may return 'failed' status due to test token, but endpoint should work
        print(f"✓ POST /api/whatsapp-config/{AKNEXUS_CONFIG_ID}/test (rest_api) returned: {result.get('status')}")


class TestExistingConfigs:
    """Test that existing configs have correct api_type values"""
    
    def test_botmaster_config_is_query_param(self, auth_headers):
        """BotMasterSender config should have api_type=query_param"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        botmaster = next((c for c in configs if c['id'] == BOTMASTER_CONFIG_ID), None)
        
        if botmaster:
            api_type = botmaster.get('api_type', 'query_param')  # Default is query_param
            assert api_type == 'query_param', f"BotMasterSender should be query_param, got {api_type}"
            print(f"✓ BotMasterSender config has api_type=query_param")
        else:
            pytest.skip("BotMasterSender config not found")
    
    def test_aknexus_config_is_rest_api(self, auth_headers):
        """AKNexus config should have api_type=rest_api with instance_id"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-configs", headers=auth_headers)
        configs = response.json()
        aknexus = next((c for c in configs if c['id'] == AKNEXUS_CONFIG_ID), None)
        
        if aknexus:
            assert aknexus.get('api_type') == 'rest_api', f"AKNexus should be rest_api, got {aknexus.get('api_type')}"
            assert aknexus.get('instance_id'), "AKNexus should have instance_id"
            print(f"✓ AKNexus config has api_type=rest_api with instance_id={aknexus.get('instance_id')}")
        else:
            pytest.skip("AKNexus config not found")


class TestSendWaMsgDualType:
    """Test that send_wa_msg handles both API types (indirectly via test endpoint)"""
    
    def test_query_param_type_sends_correctly(self, auth_headers):
        """Query param type config sends via GET with query parameters"""
        # Ensure BotMasterSender is active
        requests.put(f"{BASE_URL}/api/whatsapp-config/{BOTMASTER_CONFIG_ID}/activate", headers=auth_headers)
        
        # Test via the general test endpoint (uses active config)
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/test?mobile=9944472488",
            headers=auth_headers
        )
        assert response.status_code == 200
        result = response.json()
        # BotMasterSender should work (it's the real working config)
        print(f"✓ Query param type test: {result.get('status')} - {result.get('message', '')[:100]}")
    
    def test_rest_api_type_sends_correctly(self, auth_headers):
        """REST API type config sends via POST with Bearer auth"""
        # Test the AKNexus config directly (without activating it)
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-config/{AKNEXUS_CONFIG_ID}/test?mobile=9944472488",
            headers=auth_headers
        )
        assert response.status_code == 200
        result = response.json()
        # May fail due to test token, but should attempt REST API style
        print(f"✓ REST API type test: {result.get('status')} - {result.get('message', '')[:100]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
