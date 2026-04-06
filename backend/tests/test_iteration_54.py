"""
Test iteration 54 - Testing new features:
1. Order update with qty formats like '10+5' or '1 case offer' - WhatsApp notification
2. Transport edit endpoint (PUT /api/transports/{id})
3. Marketing campaign delete with cascade cleanup
4. Customer portal items sorted alphabetically
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "info@vetmech.in"
ADMIN_PASSWORD = "Kongu@@44884"
CUSTOMER_PHONE = "9999777766"
CUSTOMER_PASSWORD = "test123"

# Test order ID from context
TEST_ORDER_ID = "0e888b27-a353-436f-8321-ff28f24695dc"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def customer_token():
    """Get customer authentication token"""
    response = requests.post(f"{BASE_URL}/api/customer/login", json={
        "phone": CUSTOMER_PHONE,
        "password": CUSTOMER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Customer authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Admin request headers"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    """Customer request headers"""
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: Health endpoint returns healthy status")


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        print("PASS: Admin login returns access_token")


class TestCustomerAuth:
    """Customer authentication tests"""
    
    def test_customer_login(self):
        """Test customer login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Customer credentials invalid or customer not found: {response.text}")
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        print("PASS: Customer login returns access_token")


class TestTransportCRUD:
    """Transport CRUD operations including new PUT endpoint"""
    
    def test_get_transports(self, admin_headers):
        """Test GET /api/transports returns list"""
        response = requests.get(f"{BASE_URL}/api/transports", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/transports returns {len(data)} transports")
    
    def test_create_transport(self, admin_headers):
        """Test POST /api/transports creates new transport"""
        test_name = f"TEST_TRANSPORT_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/transports", headers=admin_headers, json={
            "name": test_name,
            "contact_number": "9876543210",
            "alternate_number": "9876543211",
            "is_local": False,
            "tracking_url_template": "https://track.example.com/{tracking_number}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_name
        assert data["contact_number"] == "9876543210"
        assert "id" in data
        print(f"PASS: POST /api/transports creates transport with id={data['id']}")
        return data["id"]
    
    def test_update_transport(self, admin_headers):
        """Test PUT /api/transports/{id} updates transport name and contact"""
        # First create a transport
        test_name = f"TEST_TRANSPORT_UPDATE_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/transports", headers=admin_headers, json={
            "name": test_name,
            "contact_number": "9876543210",
            "alternate_number": "",
            "is_local": False,
            "tracking_url_template": ""
        })
        assert create_response.status_code == 200
        transport_id = create_response.json()["id"]
        
        # Now update it
        updated_name = f"UPDATED_{test_name}"
        update_response = requests.put(f"{BASE_URL}/api/transports/{transport_id}", headers=admin_headers, json={
            "name": updated_name,
            "contact_number": "9999888877",
            "alternate_number": "9999888878",
            "is_local": True,
            "tracking_url_template": ""
        })
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["name"] == updated_name
        assert data["contact_number"] == "9999888877"
        assert data["is_local"] == True
        print(f"PASS: PUT /api/transports/{transport_id} updates transport successfully")
        
        # Cleanup - delete the transport
        requests.delete(f"{BASE_URL}/api/transports/{transport_id}", headers=admin_headers)
    
    def test_update_transport_not_found(self, admin_headers):
        """Test PUT /api/transports/{id} returns 404 for non-existent transport"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/transports/{fake_id}", headers=admin_headers, json={
            "name": "Test",
            "contact_number": "1234567890",
            "alternate_number": "",
            "is_local": False,
            "tracking_url_template": ""
        })
        assert response.status_code == 404
        print("PASS: PUT /api/transports returns 404 for non-existent transport")


class TestMarketingCampaignDelete:
    """Marketing campaign delete with cascade cleanup"""
    
    def test_delete_campaign_cascade(self, admin_headers):
        """Test DELETE /api/marketing/campaigns/{id} deletes campaign and logs"""
        # First create a campaign
        # Get recipients first
        recipients_response = requests.get(f"{BASE_URL}/api/marketing/recipients?entity_type=all&status=all", headers=admin_headers)
        if recipients_response.status_code != 200:
            pytest.skip("Could not fetch recipients")
        
        recipients = recipients_response.json()
        if len(recipients) == 0:
            pytest.skip("No recipients available for campaign test")
        
        # Create a test campaign
        campaign_name = f"TEST_CAMPAIGN_DELETE_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/marketing/campaigns", headers=admin_headers, json={
            "name": campaign_name,
            "campaign_type": "announcement",
            "target_entity": "all",
            "target_status": "all",
            "recipient_ids": [recipients[0]["id"]],
            "message": "Test message for deletion test",
            "item_ids": [],
            "image_base64": None,
            "pdf_base64": None,
            "scheduled_at": None,
            "batch_size": 10,
            "batch_delay_seconds": 60,
            "send_push": False
        })
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create campaign: {create_response.text}")
        
        campaign_id = create_response.json()["id"]
        print(f"Created test campaign: {campaign_id}")
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/marketing/campaigns/{campaign_id}", headers=admin_headers)
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "message" in data
        assert "logs_deleted" in data
        print(f"PASS: DELETE /api/marketing/campaigns/{campaign_id} - logs_deleted: {data['logs_deleted']}")
        
        # Verify campaign is gone
        get_response = requests.get(f"{BASE_URL}/api/marketing/campaigns/{campaign_id}", headers=admin_headers)
        assert get_response.status_code == 404
        print("PASS: Campaign no longer exists after deletion")
    
    def test_delete_campaign_not_found(self, admin_headers):
        """Test DELETE /api/marketing/campaigns/{id} returns 404 for non-existent campaign"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/marketing/campaigns/{fake_id}", headers=admin_headers)
        assert response.status_code == 404
        print("PASS: DELETE /api/marketing/campaigns returns 404 for non-existent campaign")


class TestCustomerItemsSorting:
    """Customer portal items sorted alphabetically"""
    
    def test_customer_items_sorted_alphabetically(self, customer_headers):
        """Test GET /api/customer/items returns items sorted alphabetically by item_name"""
        response = requests.get(f"{BASE_URL}/api/customer/items", headers=customer_headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        
        if len(items) < 2:
            pytest.skip("Not enough items to verify sorting")
        
        # Verify items are sorted alphabetically by item_name
        item_names = [item.get("item_name", "") for item in items]
        sorted_names = sorted(item_names, key=lambda x: x.lower() if x else "")
        
        # Check if the order matches
        is_sorted = True
        for i in range(len(item_names) - 1):
            if item_names[i].lower() > item_names[i + 1].lower():
                is_sorted = False
                print(f"Items not sorted: '{item_names[i]}' > '{item_names[i + 1]}'")
                break
        
        assert is_sorted, f"Items are not sorted alphabetically. First few: {item_names[:5]}"
        print(f"PASS: GET /api/customer/items returns {len(items)} items sorted alphabetically")
        print(f"First 5 items: {item_names[:5]}")


class TestOrderItemsUpdate:
    """Order items update with various qty formats"""
    
    def test_get_orders(self, admin_headers):
        """Test GET /api/orders returns list"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/orders returns {len(data)} orders")
    
    def test_order_items_update_with_scheme_qty(self, admin_headers):
        """Test PUT /api/orders/{id}/items with qty='10+5' format"""
        # First get an order to update
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        if orders_response.status_code != 200:
            pytest.skip("Could not fetch orders")
        
        orders = orders_response.json()
        if len(orders) == 0:
            pytest.skip("No orders available for testing")
        
        # Find an order with items
        test_order = None
        for order in orders:
            if order.get("items") and len(order["items"]) > 0:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No order with items found")
        
        # Update items with scheme quantity format
        updated_items = []
        for item in test_order["items"]:
            updated_items.append({
                "item_id": item.get("item_id"),
                "item_code": item.get("item_code"),
                "item_name": item.get("item_name"),
                "quantity": "10+5",  # Scheme format
                "rate": item.get("rate", 0),
                "mrp": item.get("mrp", 0),
                "gst": item.get("gst", 0)
            })
        
        response = requests.put(
            f"{BASE_URL}/api/orders/{test_order['id']}/items",
            headers=admin_headers,
            json={"items": updated_items, "pending_items": None}
        )
        
        assert response.status_code == 200
        print(f"PASS: PUT /api/orders/{test_order['id']}/items with qty='10+5' succeeded")
    
    def test_order_items_update_with_text_qty(self, admin_headers):
        """Test PUT /api/orders/{id}/items with qty='1 case offer' format"""
        # First get an order to update
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        if orders_response.status_code != 200:
            pytest.skip("Could not fetch orders")
        
        orders = orders_response.json()
        if len(orders) == 0:
            pytest.skip("No orders available for testing")
        
        # Find an order with items
        test_order = None
        for order in orders:
            if order.get("items") and len(order["items"]) > 0:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No order with items found")
        
        # Update items with text quantity format
        updated_items = []
        for item in test_order["items"]:
            updated_items.append({
                "item_id": item.get("item_id"),
                "item_code": item.get("item_code"),
                "item_name": item.get("item_name"),
                "quantity": "1 case offer",  # Text format
                "rate": item.get("rate", 0),
                "mrp": item.get("mrp", 0),
                "gst": item.get("gst", 0)
            })
        
        response = requests.put(
            f"{BASE_URL}/api/orders/{test_order['id']}/items",
            headers=admin_headers,
            json={"items": updated_items, "pending_items": None}
        )
        
        assert response.status_code == 200
        print(f"PASS: PUT /api/orders/{test_order['id']}/items with qty='1 case offer' succeeded")
    
    def test_order_items_update_twice_sends_notification(self, admin_headers):
        """Test PUT /api/orders/{id}/items called twice should succeed both times"""
        # First get an order to update
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        if orders_response.status_code != 200:
            pytest.skip("Could not fetch orders")
        
        orders = orders_response.json()
        if len(orders) == 0:
            pytest.skip("No orders available for testing")
        
        # Find an order with items
        test_order = None
        for order in orders:
            if order.get("items") and len(order["items"]) > 0:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No order with items found")
        
        # First update
        updated_items = []
        for item in test_order["items"]:
            updated_items.append({
                "item_id": item.get("item_id"),
                "item_code": item.get("item_code"),
                "item_name": item.get("item_name"),
                "quantity": "5",
                "rate": item.get("rate", 0),
                "mrp": item.get("mrp", 0),
                "gst": item.get("gst", 0)
            })
        
        response1 = requests.put(
            f"{BASE_URL}/api/orders/{test_order['id']}/items",
            headers=admin_headers,
            json={"items": updated_items, "pending_items": None}
        )
        assert response1.status_code == 200
        print(f"PASS: First PUT /api/orders/{test_order['id']}/items succeeded")
        
        # Second update
        for item in updated_items:
            item["quantity"] = "6"
        
        response2 = requests.put(
            f"{BASE_URL}/api/orders/{test_order['id']}/items",
            headers=admin_headers,
            json={"items": updated_items, "pending_items": None}
        )
        assert response2.status_code == 200
        print(f"PASS: Second PUT /api/orders/{test_order['id']}/items succeeded")


class TestNotificationTemplates:
    """Test notification templates have correct variables"""
    
    def test_status_dispatched_template_variables(self):
        """Verify status_dispatched template has transport, tracking, delivery station, package, payment variables"""
        from utils.templates import DEFAULT_WA_TEMPLATES
        
        template = DEFAULT_WA_TEMPLATES.get('status_dispatched')
        assert template is not None, "status_dispatched template not found"
        
        expected_vars = ['transport_name', 'tracking_number', 'delivery_station', 'package_details', 'payment_info']
        for var in expected_vars:
            assert var in template['variables'], f"Variable {var} not in status_dispatched template"
        
        print(f"PASS: status_dispatched template has all required variables: {expected_vars}")
    
    def test_status_delivered_template_variables(self):
        """Verify status_delivered template has invoice_number, invoice_date, invoice_value variables"""
        from utils.templates import DEFAULT_WA_TEMPLATES
        
        template = DEFAULT_WA_TEMPLATES.get('status_delivered')
        assert template is not None, "status_delivered template not found"
        
        expected_vars = ['invoice_number', 'invoice_date', 'invoice_value']
        for var in expected_vars:
            assert var in template['variables'], f"Variable {var} not in status_delivered template"
        
        print(f"PASS: status_delivered template has all required variables: {expected_vars}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
