"""
MR Module Phase 3 Tests - MR Orders API Testing
Tests: MR Items, MR Order Creation, MR Order History, Cancel Request, Admin Cancel Approval

MR Credentials: Phone: 9876543211, Password: mr123
Admin Credentials: Email: admin@vmpcrm.com, Password: admin123
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


# ============== FIXTURES ==============

@pytest.fixture(scope="module")
def mr_token():
    """Get MR auth token"""
    response = requests.post(f"{BASE_URL}/api/mr/login", json={
        "phone": "9876543211",
        "password": "mr123"
    })
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"Got MR token: {token[:30]}...")
        return token
    pytest.skip("MR Login failed - cannot proceed with authenticated tests")


@pytest.fixture(scope="module")
def mr_headers(mr_token):
    """Get MR auth headers"""
    return {"Authorization": f"Bearer {mr_token}"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@vmpcrm.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"Got Admin token: {token[:30]}...")
        return token
    pytest.skip("Admin Login failed - cannot proceed with authenticated tests")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get admin auth headers"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def territory_customer(mr_headers):
    """Get a customer from MR's territory for order testing"""
    response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
    if response.status_code == 200 and response.json():
        customer = response.json()[0]
        print(f"Territory customer: {customer['name']} ({customer['entity_type']})")
        return customer
    pytest.skip("No customers in MR territory - cannot test orders")


@pytest.fixture(scope="module")
def available_item(mr_headers):
    """Get an available item for ordering"""
    response = requests.get(f"{BASE_URL}/api/mr/items", headers=mr_headers)
    if response.status_code == 200 and response.json():
        item = response.json()[0]
        # API returns 'item_name' not 'name'
        item['name'] = item.get('item_name', item.get('name', 'Unknown'))
        print(f"Available item: {item['name']} ({item.get('item_code', 'no code')})")
        return item
    pytest.skip("No items available - cannot test orders")


# ============== MR ITEMS TESTS ==============

class TestMRItems:
    """MR Items API tests - GET /api/mr/items"""

    def test_get_mr_items_success(self, mr_headers):
        """GET /api/mr/items - Get available items for MR ordering"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers=mr_headers)
        print(f"MR Items response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} items available for ordering")
        
        if data:
            item = data[0]
            assert "id" in item
            assert "item_name" in item  # API returns item_name not name
            assert "mrp" in item
            print(f"Sample item: {item['item_name']} - MRP: {item.get('mrp')}")

    def test_get_mr_items_with_search(self, mr_headers):
        """GET /api/mr/items?search=... - Search items by name"""
        response = requests.get(f"{BASE_URL}/api/mr/items?search=a", headers=mr_headers)
        assert response.status_code == 200
        print(f"Search 'a' returned {len(response.json())} items")

    def test_get_mr_items_unauthorized(self):
        """GET /api/mr/items without token - should fail"""
        response = requests.get(f"{BASE_URL}/api/mr/items")
        assert response.status_code in [401, 403]

    def test_get_mr_items_excludes_out_of_stock(self, mr_headers):
        """GET /api/mr/items should exclude out of stock items"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers=mr_headers)
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            assert item.get('out_of_stock') != True
        print(f"Verified {len(data)} items are all in stock")


# ============== MR ORDER CREATION TESTS ==============

class TestMROrderCreation:
    """MR Order creation tests - POST /api/mr/orders"""

    def test_create_mr_order_success(self, mr_headers, territory_customer, available_item):
        """POST /api/mr/orders - Create order for customer"""
        order_data = {
            "customer_id": territory_customer["id"],
            "customer_name": territory_customer["name"],
            "customer_phone": territory_customer.get("phone", "9999999999"),
            "customer_type": territory_customer["entity_type"],
            "items": [{
                "item_id": available_item["id"],
                "item_code": available_item.get("item_code", ""),
                "item_name": available_item["name"],
                "quantity": 2,
                "rate": available_item.get("mrp", 100),
                "mrp": available_item.get("mrp", 100)
            }],
            "notes": "TEST_MR_ORDER - Auto test order"
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/orders", json=order_data, headers=mr_headers)
        print(f"Create MR Order response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "order_number" in data
        assert data["status"] == "pending"
        print(f"Order created: {data['order_number']}")
        
        # Store for subsequent tests
        pytest.created_order_id = data["id"]
        pytest.created_order_number = data["order_number"]

    def test_create_mr_order_missing_items(self, mr_headers, territory_customer):
        """POST /api/mr/orders without items - should fail"""
        order_data = {
            "customer_id": territory_customer["id"],
            "customer_name": territory_customer["name"],
            "customer_phone": territory_customer.get("phone", ""),
            "customer_type": territory_customer["entity_type"],
            "items": []
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/orders", json=order_data, headers=mr_headers)
        assert response.status_code == 400
        print("Correctly rejected order with no items")

    def test_create_mr_order_missing_customer_name(self, mr_headers, available_item):
        """POST /api/mr/orders without customer name - should fail"""
        order_data = {
            "customer_id": "some-id",
            "customer_name": "",
            "customer_phone": "9999999999",
            "customer_type": "doctor",
            "items": [{
                "item_id": available_item["id"],
                "item_code": available_item.get("item_code", ""),
                "item_name": available_item["name"],
                "quantity": 1,
                "rate": 100,
                "mrp": 100
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/orders", json=order_data, headers=mr_headers)
        assert response.status_code == 400
        print("Correctly rejected order without customer name")


# ============== MR ORDER HISTORY TESTS ==============

class TestMROrderHistory:
    """MR Order history tests - GET /api/mr/orders"""

    def test_get_mr_orders_success(self, mr_headers):
        """GET /api/mr/orders - Get MR's order history"""
        response = requests.get(f"{BASE_URL}/api/mr/orders", headers=mr_headers)
        print(f"MR Orders response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} orders in MR history")
        
        if data:
            order = data[0]
            assert "id" in order
            assert "order_number" in order
            assert "status" in order
            assert "items" in order
            print(f"Latest order: {order['order_number']} - Status: {order['status']}")

    def test_get_mr_orders_unauthorized(self):
        """GET /api/mr/orders without token - should fail"""
        response = requests.get(f"{BASE_URL}/api/mr/orders")
        assert response.status_code in [401, 403]

    def test_verify_created_order_in_history(self, mr_headers):
        """Verify that created order appears in MR's order history"""
        if not hasattr(pytest, 'created_order_number'):
            pytest.skip("No order created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/mr/orders", headers=mr_headers)
        assert response.status_code == 200
        
        orders = response.json()
        order_numbers = [o["order_number"] for o in orders]
        assert pytest.created_order_number in order_numbers
        print(f"Verified order {pytest.created_order_number} in MR history")

    def test_mr_order_has_source_field(self, mr_headers):
        """Verify MR orders have source='mr' field"""
        response = requests.get(f"{BASE_URL}/api/mr/orders", headers=mr_headers)
        assert response.status_code == 200
        
        orders = response.json()
        if orders:
            for order in orders[:5]:
                assert order.get("source") == "mr"
                assert "mr_id" in order or order.get("source") == "mr"
        print(f"Verified source='mr' for MR orders")


# ============== MR CANCEL REQUEST TESTS ==============

class TestMRCancelRequest:
    """MR Cancel request tests - POST /api/mr/orders/{id}/cancel-request"""

    def test_create_order_for_cancel_test(self, mr_headers, territory_customer, available_item):
        """Create a new order specifically for cancellation testing"""
        order_data = {
            "customer_id": territory_customer["id"],
            "customer_name": territory_customer["name"],
            "customer_phone": territory_customer.get("phone", "9999999999"),
            "customer_type": territory_customer["entity_type"],
            "items": [{
                "item_id": available_item["id"],
                "item_code": available_item.get("item_code", ""),
                "item_name": available_item["name"],
                "quantity": 1,
                "rate": available_item.get("mrp", 100),
                "mrp": available_item.get("mrp", 100)
            }],
            "notes": "TEST_CANCEL_ORDER - For cancellation testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/orders", json=order_data, headers=mr_headers)
        assert response.status_code == 200
        
        data = response.json()
        pytest.cancel_test_order_id = data["id"]
        pytest.cancel_test_order_number = data["order_number"]
        print(f"Created order for cancel test: {data['order_number']}")

    def test_mr_cancel_request_success(self, mr_headers):
        """POST /api/mr/orders/{id}/cancel-request - Request cancellation"""
        if not hasattr(pytest, 'cancel_test_order_id'):
            pytest.skip("No order created for cancel test")
        
        response = requests.post(
            f"{BASE_URL}/api/mr/orders/{pytest.cancel_test_order_id}/cancel-request",
            json={"reason": "TEST: Customer changed mind"},
            headers=mr_headers
        )
        print(f"Cancel request response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"Cancel request submitted: {data['message']}")

    def test_verify_cancel_requested_flag(self, mr_headers):
        """Verify that order has cancel_requested=true after request"""
        if not hasattr(pytest, 'cancel_test_order_id'):
            pytest.skip("No order for cancel test")
        
        response = requests.get(f"{BASE_URL}/api/mr/orders", headers=mr_headers)
        assert response.status_code == 200
        
        orders = response.json()
        order = next((o for o in orders if o["id"] == pytest.cancel_test_order_id), None)
        assert order is not None
        assert order.get("cancel_requested") == True
        print(f"Verified cancel_requested=True for order {order['order_number']}")

    def test_mr_cancel_request_not_found(self, mr_headers):
        """POST /api/mr/orders/invalid-id/cancel-request - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/mr/orders/invalid-order-id-12345/cancel-request",
            json={"reason": "Test"},
            headers=mr_headers
        )
        assert response.status_code == 404


# ============== ADMIN CANCEL APPROVAL TESTS ==============

class TestAdminCancelApproval:
    """Admin cancel approval tests - POST /api/orders/{id}/approve-cancel"""

    def test_admin_view_orders_with_mr_source(self, admin_headers):
        """GET /api/orders - Admin sees MR orders with source indicator"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        print(f"Admin Orders response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        mr_orders = [o for o in data if o.get("source") == "mr"]
        print(f"Found {len(mr_orders)} MR orders in admin view")
        
        if mr_orders:
            order = mr_orders[0]
            assert "mr_id" in order or "mr_name" in order
            print(f"MR Order sample: {order['order_number']} - MR: {order.get('mr_name', 'N/A')}")

    def test_admin_view_cancel_requested_orders(self, admin_headers):
        """GET /api/orders - Admin sees orders with cancel_requested=true"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        cancel_requested = [o for o in data if o.get("cancel_requested") == True]
        print(f"Found {len(cancel_requested)} orders with pending cancellation requests")

    def test_admin_approve_cancel_success(self, admin_headers, mr_headers, territory_customer, available_item):
        """POST /api/orders/{id}/approve-cancel with action=approve"""
        # First create a new order and request cancellation
        order_data = {
            "customer_id": territory_customer["id"],
            "customer_name": territory_customer["name"],
            "customer_phone": territory_customer.get("phone", "9999999999"),
            "customer_type": territory_customer["entity_type"],
            "items": [{
                "item_id": available_item["id"],
                "item_code": available_item.get("item_code", ""),
                "item_name": available_item["name"],
                "quantity": 1,
                "rate": 100,
                "mrp": 100
            }],
            "notes": "TEST_APPROVE_CANCEL"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/mr/orders", json=order_data, headers=mr_headers)
        assert create_resp.status_code == 200
        order_id = create_resp.json()["id"]
        
        # Request cancellation
        cancel_req_resp = requests.post(
            f"{BASE_URL}/api/mr/orders/{order_id}/cancel-request",
            json={"reason": "Testing approval"},
            headers=mr_headers
        )
        assert cancel_req_resp.status_code == 200
        
        # Admin approves
        approve_resp = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/approve-cancel",
            json={"action": "approve"},
            headers=admin_headers
        )
        print(f"Admin approve cancel response: {approve_resp.status_code} - {approve_resp.text[:100]}")
        assert approve_resp.status_code == 200
        
        # Verify order is now cancelled
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        orders = orders_resp.json()
        order = next((o for o in orders if o["id"] == order_id), None)
        assert order is not None
        assert order["status"] == "cancelled"
        print(f"Verified order {order['order_number']} is now cancelled")

    def test_admin_reject_cancel_success(self, admin_headers, mr_headers, territory_customer, available_item):
        """POST /api/orders/{id}/approve-cancel with action=reject"""
        # Create order and request cancellation
        order_data = {
            "customer_id": territory_customer["id"],
            "customer_name": territory_customer["name"],
            "customer_phone": territory_customer.get("phone", "9999999999"),
            "customer_type": territory_customer["entity_type"],
            "items": [{
                "item_id": available_item["id"],
                "item_code": available_item.get("item_code", ""),
                "item_name": available_item["name"],
                "quantity": 1,
                "rate": 100,
                "mrp": 100
            }],
            "notes": "TEST_REJECT_CANCEL"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/mr/orders", json=order_data, headers=mr_headers)
        assert create_resp.status_code == 200
        order_id = create_resp.json()["id"]
        
        # Request cancellation
        cancel_req_resp = requests.post(
            f"{BASE_URL}/api/mr/orders/{order_id}/cancel-request",
            json={"reason": "Testing rejection"},
            headers=mr_headers
        )
        assert cancel_req_resp.status_code == 200
        
        # Admin rejects
        reject_resp = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/approve-cancel",
            json={"action": "reject"},
            headers=admin_headers
        )
        print(f"Admin reject cancel response: {reject_resp.status_code}")
        assert reject_resp.status_code == 200
        
        # Verify cancel_requested is now false
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        orders = orders_resp.json()
        order = next((o for o in orders if o["id"] == order_id), None)
        assert order is not None
        assert order.get("cancel_requested") != True
        assert order["status"] == "pending"  # Still pending, not cancelled
        print(f"Verified order {order['order_number']} cancel request rejected, status: {order['status']}")

    def test_admin_approve_cancel_invalid_action(self, admin_headers):
        """POST /api/orders/{id}/approve-cancel with invalid action"""
        if not hasattr(pytest, 'created_order_id'):
            pytest.skip("No order available")
        
        response = requests.post(
            f"{BASE_URL}/api/orders/{pytest.created_order_id}/approve-cancel",
            json={"action": "invalid"},
            headers=admin_headers
        )
        assert response.status_code == 400

    def test_admin_approve_cancel_order_not_found(self, admin_headers):
        """POST /api/orders/invalid-id/approve-cancel - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/orders/invalid-order-id-12345/approve-cancel",
            json={"action": "approve"},
            headers=admin_headers
        )
        assert response.status_code == 404


# ============== REGRESSION TESTS ==============

class TestMRDashboardRegression:
    """Regression tests to ensure existing MR features still work"""

    def test_mr_dashboard_still_works(self, mr_headers):
        """GET /api/mr/dashboard - Dashboard should still work"""
        response = requests.get(f"{BASE_URL}/api/mr/dashboard", headers=mr_headers)
        assert response.status_code == 200
        print("MR Dashboard regression: PASS")

    def test_mr_customers_still_works(self, mr_headers):
        """GET /api/mr/customers - Customers should still work"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        assert response.status_code == 200
        print("MR Customers regression: PASS")

    def test_mr_visits_still_works(self, mr_headers):
        """GET /api/mr/visits - Visits should still work"""
        response = requests.get(f"{BASE_URL}/api/mr/visits", headers=mr_headers)
        assert response.status_code == 200
        print("MR Visits regression: PASS")

    def test_mr_followups_still_works(self, mr_headers):
        """GET /api/mr/followups - Follow-ups should still work"""
        response = requests.get(f"{BASE_URL}/api/mr/followups?filter_type=all", headers=mr_headers)
        assert response.status_code == 200
        print("MR Follow-ups regression: PASS")

    def test_mr_visual_aids_still_works(self, mr_headers):
        """GET /api/mr/visual-aids - Visual aids should still work"""
        response = requests.get(f"{BASE_URL}/api/mr/visual-aids", headers=mr_headers)
        assert response.status_code == 200
        print("MR Visual Aids regression: PASS")


# ============== ADMIN ORDERS REGRESSION ==============

class TestAdminOrdersRegression:
    """Regression tests for admin orders page"""

    def test_admin_orders_list_works(self, admin_headers):
        """GET /api/orders - Admin orders list should work"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        assert response.status_code == 200
        print(f"Admin Orders list: {len(response.json())} orders")

    def test_admin_orders_filter_by_status(self, admin_headers):
        """GET /api/orders?status=pending - Filter works"""
        response = requests.get(f"{BASE_URL}/api/orders?status=pending", headers=admin_headers)
        assert response.status_code == 200
        pending = response.json()
        print(f"Pending orders: {len(pending)}")
        for order in pending:
            assert order["status"] == "pending"
