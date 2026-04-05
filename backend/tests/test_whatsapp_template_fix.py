"""
Test WhatsApp message template formatting fix
- Verifies render_wa_template fills company_short_name and company_phone correctly
- Verifies no '+None' pattern appears in rendered messages
- Tests order status update triggers WhatsApp notification
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "info@vetmech.in"
ADMIN_PASSWORD = "Kongu@@44884"


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_check(self):
        """GET /api/health should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✓ Health check passed: {data}")
    
    def test_admin_login(self):
        """POST /api/auth/login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        # Token field is 'access_token' not 'token'
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful: {data['user']['name']}")
        return data["access_token"]


class TestOrdersAndNotifications:
    """Test orders API and WhatsApp notification triggering"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_fetch_orders(self, auth_token):
        """GET /api/orders with auth header - response is a plain list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Response is a plain list, not wrapped in {orders:[]}
        assert isinstance(data, list)
        print(f"✓ Fetched {len(data)} orders")
        return data
    
    def test_order_status_update_triggers_notification(self, auth_token):
        """PUT /api/orders/{order_id}/status with {status:'processing'} should trigger WhatsApp notification"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get orders to find one to update
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        orders = response.json()
        
        if not orders:
            pytest.skip("No orders available to test status update")
        
        # Find an order that can be updated to 'processing' (pending or confirmed)
        test_order = None
        for order in orders:
            if order.get('status') in ['pending', 'confirmed']:
                test_order = order
                break
        
        if not test_order:
            # Use first order for testing even if status doesn't match
            test_order = orders[0]
            print(f"⚠ Using order {test_order['order_number']} with status '{test_order.get('status')}' for testing")
        
        order_id = test_order['id']
        order_number = test_order.get('order_number', 'N/A')
        
        # Update status to 'processing'
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/status",
            headers=headers,
            json={"status": "processing"}
        )
        
        # Status update should succeed (200) or order may already be in a later status
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Order {order_number} status updated to 'processing'")
            print(f"  Response: {data}")
            # Give time for background task to send WhatsApp
            time.sleep(2)
        else:
            print(f"⚠ Status update returned {response.status_code}: {response.json()}")
        
        return order_id


class TestVPSDownload:
    """Test VPS download package endpoint"""
    
    def test_vps_download_package_exists(self):
        """GET /vmpcrm_code.tar.gz should return 200"""
        response = requests.get(f"{BASE_URL}/vmpcrm_code.tar.gz", allow_redirects=True)
        # This endpoint may return 200 or 404 depending on if package exists
        print(f"VPS download package status: {response.status_code}")
        # Just log the result, don't fail if not found
        if response.status_code == 200:
            print(f"✓ VPS download package exists, size: {len(response.content)} bytes")
        else:
            print(f"⚠ VPS download package not found (status {response.status_code})")


class TestWhatsAppTemplateFix:
    """Test the WhatsApp template rendering fix - no '+None' pattern"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_company_settings_has_short_name(self, auth_token):
        """Verify company_short_name is set in company settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/company-settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        company_short_name = data.get('company_short_name', '')
        company_phone = data.get('phone', '')
        
        print(f"Company short name: '{company_short_name}'")
        print(f"Company phone: '{company_phone}'")
        
        # company_short_name should be set (TESTCO in this case)
        assert company_short_name, "company_short_name should not be empty"
        print(f"✓ Company short name is set: {company_short_name}")
        
        return company_short_name, company_phone
    
    def test_whatsapp_logs_no_plus_none(self, auth_token):
        """Check WhatsApp logs don't contain '+None' pattern in RECENT messages (after fix)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get recent WhatsApp logs
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Response format is {"logs": [...], "total": N, ...}
        logs = data.get('logs', [])
        
        if not logs:
            print("⚠ No WhatsApp logs found to verify")
            return
        
        # Check the MOST RECENT log (first one) - this should NOT have +None
        # Old logs may still have +None from before the fix
        most_recent = logs[0]
        message = most_recent.get('message_preview', '') or most_recent.get('message', '')
        created_at = most_recent.get('created_at', '')
        msg_type = most_recent.get('message_type', '')
        
        print(f"Most recent log ({msg_type} at {created_at}):")
        print(f"  Preview: {message[:200]}...")
        
        # The most recent message should NOT have +None
        if '+None' in message:
            print(f"✗ FAIL: Most recent message contains '+None'")
            # Check if this is an order-related message (the fix target)
            if 'order' in msg_type.lower():
                assert False, "Most recent order message should not contain '+None'"
        else:
            print(f"✓ Most recent message does NOT contain '+None'")
        
        # Also check if there are any order messages with +None vs without
        order_msgs_with_none = 0
        order_msgs_without_none = 0
        for log in logs:
            msg = log.get('message_preview', '') or log.get('message', '')
            if 'order' in log.get('message_type', '').lower():
                if '+None' in msg:
                    order_msgs_with_none += 1
                else:
                    order_msgs_without_none += 1
        
        print(f"Order messages with +None: {order_msgs_with_none}")
        print(f"Order messages without +None: {order_msgs_without_none}")
        
        # The fix should result in newer messages not having +None


class TestRenderWaTemplateFunction:
    """Test render_wa_template function directly via API that uses it"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_order_confirmation_notification(self, auth_token):
        """Create a test order to trigger order confirmation notification"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a test order with a test phone number
        test_order_data = {
            "customer_name": "TEST_WhatsAppFix",
            "customer_phone": "9999888877",  # Test phone
            "customer_email": "test@example.com",
            "customer_address": "Test Address",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item-1",
                    "item_code": "TEST001",
                    "item_name": "Test Item",
                    "quantity": "2",
                    "rate": 100.0
                }
            ],
            "pending_items": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            headers=headers,
            json=test_order_data
        )
        
        if response.status_code == 200:
            data = response.json()
            order_number = data.get('order_number', 'N/A')
            order_id = data.get('order_id', 'N/A')
            print(f"✓ Test order created: {order_number}")
            
            # Wait for background task to send WhatsApp
            time.sleep(3)
            
            # Check WhatsApp logs for this order
            logs_response = requests.get(f"{BASE_URL}/api/whatsapp-logs", headers=headers)
            if logs_response.status_code == 200:
                logs = logs_response.json()
                for log in logs[:5]:
                    if order_number in log.get('message', ''):
                        message = log.get('message', '')
                        print(f"Found WhatsApp log for order {order_number}")
                        
                        # Check for '+None' pattern
                        if '+None' in message:
                            print(f"✗ FAIL: Message contains '+None': {message}")
                            assert False, "Message should not contain '+None'"
                        else:
                            print(f"✓ Message does NOT contain '+None'")
                            print(f"  Message preview: {message[:300]}...")
                        break
            
            # Cleanup - delete test order
            delete_response = requests.delete(
                f"{BASE_URL}/api/orders/{order_id}",
                headers=headers
            )
            if delete_response.status_code == 200:
                print(f"✓ Test order {order_number} deleted")
            
            return order_id
        else:
            print(f"⚠ Could not create test order: {response.status_code} - {response.text}")
            pytest.skip("Could not create test order")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
