"""
Test Push Notification APIs
- GET /api/push/vapid-key - returns VAPID public key
- POST /api/push/subscribe - registers push subscription
- POST /api/push/unsubscribe - removes subscription
- POST /api/push/send - sends push to specified audience
- GET /api/push/subscriptions - returns subscription stats
- POST /api/customer/push/subscribe - registers customer push subscription
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPushNotificationAPIs:
    """Test Web Push Notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@vmpcrm.com"
        self.admin_password = "admin123"
        self.admin_token = None
        self.test_subscription = {
            "endpoint": f"https://fcm.googleapis.com/fcm/send/test-{uuid.uuid4()}",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.admin_token:
            return self.admin_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            self.admin_token = response.json().get("access_token")
            return self.admin_token
        pytest.skip("Admin authentication failed")
        
    def get_customer_token(self):
        """Get or create a customer token for testing"""
        # First try to login with existing test customer
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "9999999999"
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None

    # ============== VAPID KEY TESTS ==============
    
    def test_get_vapid_key_returns_public_key(self):
        """GET /api/push/vapid-key should return VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "public_key" in data, "Response should contain 'public_key'"
        assert data["public_key"] is not None, "Public key should not be None"
        assert len(data["public_key"]) > 50, "Public key should be a valid VAPID key"
        print(f"✓ VAPID public key returned: {data['public_key'][:30]}...")

    # ============== PUSH SUBSCRIBE TESTS ==============
    
    def test_push_subscribe_requires_auth(self):
        """POST /api/push/subscribe should require authentication"""
        response = requests.post(f"{BASE_URL}/api/push/subscribe", json={
            "subscription": self.test_subscription,
            "user_type": "admin"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Push subscribe requires authentication")
    
    def test_push_subscribe_success(self):
        """POST /api/push/subscribe should register subscription"""
        token = self.get_admin_token()
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "subscription": self.test_subscription,
                "user_type": "admin"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"✓ Push subscription registered: {data.get('message')}")
    
    def test_push_subscribe_invalid_subscription(self):
        """POST /api/push/subscribe should reject invalid subscription"""
        token = self.get_admin_token()
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "subscription": {},  # Invalid - no endpoint
                "user_type": "admin"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid subscription rejected")

    # ============== PUSH UNSUBSCRIBE TESTS ==============
    
    def test_push_unsubscribe_requires_auth(self):
        """POST /api/push/unsubscribe should require authentication"""
        response = requests.post(f"{BASE_URL}/api/push/unsubscribe", json={
            "endpoint": self.test_subscription["endpoint"]
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Push unsubscribe requires authentication")
    
    def test_push_unsubscribe_success(self):
        """POST /api/push/unsubscribe should remove subscription"""
        token = self.get_admin_token()
        
        # First subscribe
        requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "subscription": self.test_subscription,
                "user_type": "admin"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Then unsubscribe
        response = requests.post(
            f"{BASE_URL}/api/push/unsubscribe",
            json={"endpoint": self.test_subscription["endpoint"]},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"✓ Push unsubscription successful: {data.get('message')}")

    # ============== PUSH SEND TESTS ==============
    
    def test_push_send_requires_auth(self):
        """POST /api/push/send should require authentication"""
        response = requests.post(f"{BASE_URL}/api/push/send", json={
            "title": "Test",
            "body": "Test message",
            "audience": "all"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Push send requires authentication")
    
    def test_push_send_requires_admin(self):
        """POST /api/push/send should require admin role"""
        # Try with customer token if available
        customer_token = self.get_customer_token()
        if not customer_token:
            pytest.skip("No customer token available for test")
        
        response = requests.post(
            f"{BASE_URL}/api/push/send",
            json={
                "title": "Test",
                "body": "Test message",
                "audience": "all"
            },
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        # Customer token may not work with admin endpoint
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Push send requires admin role")
    
    def test_push_send_success(self):
        """POST /api/push/send should send push notifications"""
        token = self.get_admin_token()
        
        response = requests.post(
            f"{BASE_URL}/api/push/send",
            json={
                "title": "Test Notification",
                "body": "This is a test push notification",
                "url": "/admin",
                "audience": "admins"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "sent_count" in data, "Response should contain sent_count"
        print(f"✓ Push notification sent: {data.get('message')}, sent_count: {data.get('sent_count')}")
    
    def test_push_send_to_customers(self):
        """POST /api/push/send should send to customers audience"""
        token = self.get_admin_token()
        
        response = requests.post(
            f"{BASE_URL}/api/push/send",
            json={
                "title": "Customer Notification",
                "body": "Test message for customers",
                "url": "/",
                "audience": "customers"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "sent_count" in data
        print(f"✓ Push sent to customers: sent_count={data.get('sent_count')}")
    
    def test_push_send_to_mr(self):
        """POST /api/push/send should send to MR audience"""
        token = self.get_admin_token()
        
        response = requests.post(
            f"{BASE_URL}/api/push/send",
            json={
                "title": "MR Notification",
                "body": "Test message for MRs",
                "url": "/mrvet/",
                "audience": "mr"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "sent_count" in data
        print(f"✓ Push sent to MRs: sent_count={data.get('sent_count')}")

    # ============== PUSH SUBSCRIPTIONS STATS TESTS ==============
    
    def test_push_subscriptions_requires_auth(self):
        """GET /api/push/subscriptions should require authentication"""
        response = requests.get(f"{BASE_URL}/api/push/subscriptions")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Push subscriptions stats requires authentication")
    
    def test_push_subscriptions_returns_stats(self):
        """GET /api/push/subscriptions should return subscription stats"""
        token = self.get_admin_token()
        
        response = requests.get(
            f"{BASE_URL}/api/push/subscriptions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Stats should be a dict with user_type counts
        assert isinstance(data, dict), "Response should be a dictionary"
        print(f"✓ Push subscription stats: {data}")

    # ============== CUSTOMER PUSH SUBSCRIBE TESTS ==============
    
    def test_customer_push_subscribe_requires_auth(self):
        """POST /api/customer/push/subscribe should require customer token"""
        response = requests.post(f"{BASE_URL}/api/customer/push/subscribe", json={
            "subscription": self.test_subscription
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Customer push subscribe requires authentication")
    
    def test_customer_push_subscribe_success(self):
        """POST /api/customer/push/subscribe should register customer subscription"""
        customer_token = self.get_customer_token()
        if not customer_token:
            pytest.skip("No customer token available for test")
        
        test_sub = {
            "endpoint": f"https://fcm.googleapis.com/fcm/send/customer-test-{uuid.uuid4()}",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customer/push/subscribe",
            json={"subscription": test_sub},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Customer push subscription registered: {data.get('message')}")


class TestMarketingPushIntegration:
    """Test Marketing campaign with push notification option"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@vmpcrm.com"
        self.admin_password = "admin123"
        self.admin_token = None
        
    def get_admin_token(self):
        if self.admin_token:
            return self.admin_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            self.admin_token = response.json().get("access_token")
            return self.admin_token
        pytest.skip("Admin authentication failed")
    
    def test_marketing_campaign_accepts_send_push_field(self):
        """Marketing campaign creation should accept send_push field"""
        token = self.get_admin_token()
        
        # Get items for campaign
        items_response = requests.get(
            f"{BASE_URL}/api/items",
            headers={"Authorization": f"Bearer {token}"}
        )
        if items_response.status_code != 200:
            pytest.skip("No items available for campaign test")
        
        items_data = items_response.json()
        # Handle both list and dict response formats
        items = items_data if isinstance(items_data, list) else items_data.get('items', [])
        if not items:
            pytest.skip("No items available for campaign test")
        
        item_ids = [str(items[0].get('_id') or items[0].get('id'))] if items else []
        
        # Create campaign with send_push - include all required fields
        campaign_data = {
            "name": f"TEST_Push_Campaign_{uuid.uuid4().hex[:8]}",
            "item_ids": item_ids,
            "send_whatsapp": False,
            "send_push": True,  # This is the new field being tested
            "campaign_type": "product_announcement",
            "target_entity": "doctors",
            "target_status": "all",
            "recipient_ids": [],
            "message": "Test push notification campaign"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/marketing/campaigns",
            json=campaign_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Campaign creation should succeed (or at least not fail due to send_push field)
        # 422 would indicate send_push is not accepted, 200/201 means success
        assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"✓ Marketing campaign accepts send_push field, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
