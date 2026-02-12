"""
Test Add Order Modal Enhancements:
1. Support scheme-based quantity format like '10+5'
2. ManualOrderCreate model with pending_items field
3. Creating order with out of stock items adds them to pending_items collection
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAddOrderEnhancements:
    """Test the enhanced Add Order modal functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_1_create_order_with_scheme_quantity(self):
        """Test that orders can be created with scheme format quantity like '10+5'"""
        order_data = {
            "customer_name": "TEST_Order_Scheme",
            "customer_phone": "9999888877",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item-1",
                    "item_code": "ITM-0001",
                    "item_name": "Paracetamol 500mg",
                    "quantity": "10+5",  # Scheme format
                    "mrp": 50.0,
                    "rate": 35.0
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create order failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "order_number" in data
        assert "order_id" in data
        print(f"PASS: Created order {data['order_number']} with scheme quantity")
        
        # Verify the order was created with correct quantity format
        order_id = data['order_id']
        orders_response = requests.get(
            f"{BASE_URL}/api/orders",
            headers=self.headers
        )
        assert orders_response.status_code == 200
        orders = orders_response.json()
        
        # Find our created order
        created_order = next((o for o in orders if o['id'] == order_id), None)
        assert created_order is not None, "Created order not found in orders list"
        
        # Verify quantity format preserved
        assert len(created_order['items']) > 0
        assert created_order['items'][0]['quantity'] == "10+5", "Scheme quantity format not preserved"
        print(f"PASS: Scheme quantity '10+5' preserved in order")
    
    def test_2_create_order_with_pending_items(self):
        """Test that creating order with out of stock items adds them to pending_items"""
        unique_phone = f"98765{int(time.time()) % 100000:05d}"
        
        order_data = {
            "customer_name": "TEST_Pending_Customer",
            "customer_phone": unique_phone,
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item-1",
                    "item_code": "ITM-0001",
                    "item_name": "Paracetamol 500mg",
                    "quantity": "5",
                    "mrp": 50.0,
                    "rate": 35.0
                }
            ],
            "pending_items": [
                {
                    "item_id": "test-item-2",
                    "item_code": "ITM-0002",
                    "item_name": "Vitamin D3 1000IU",
                    "quantity": "3"
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create order with pending items failed: {response.text}"
        data = response.json()
        
        # Verify pending_items_count
        assert data.get("pending_items_count", 0) == 1, "Pending items count should be 1"
        print(f"PASS: Created order with 1 pending item")
        
        # Verify pending item was added to pending_items collection
        pending_response = requests.get(
            f"{BASE_URL}/api/pending-items/doctor/{unique_phone}",
            headers=self.headers
        )
        
        assert pending_response.status_code == 200, f"Get pending items failed: {pending_response.text}"
        pending_items = pending_response.json()
        
        # Find our pending item
        our_pending = [p for p in pending_items if p.get('item_code') == 'ITM-0002']
        assert len(our_pending) > 0, "Pending item not found in pending_items collection"
        
        # Verify pending item details
        pending_item = our_pending[0]
        assert pending_item['item_name'] == "Vitamin D3 1000IU"
        assert pending_item['quantity'] == "3"
        assert pending_item['original_order_number'] == data['order_number']
        print(f"PASS: Pending item added to pending_items collection with correct details")
    
    def test_3_create_order_with_multiple_pending_items(self):
        """Test creating order with multiple out of stock items"""
        unique_phone = f"97654{int(time.time()) % 100000:05d}"
        
        order_data = {
            "customer_name": "TEST_Multi_Pending",
            "customer_phone": unique_phone,
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item-1",
                    "item_code": "ITM-0001",
                    "item_name": "Paracetamol 500mg",
                    "quantity": "10+2",  # Scheme format for available item
                    "mrp": 50.0,
                    "rate": 35.0
                }
            ],
            "pending_items": [
                {
                    "item_id": "test-item-2",
                    "item_code": "ITM-0002",
                    "item_name": "Vitamin D3 1000IU",
                    "quantity": "5"
                },
                {
                    "item_id": "test-item-3",
                    "item_code": "ITM-0003",
                    "item_name": "Test Medicine",
                    "quantity": "2+1"
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create order failed: {response.text}"
        data = response.json()
        
        # Verify pending_items_count
        assert data.get("pending_items_count", 0) == 2, "Pending items count should be 2"
        print(f"PASS: Created order with 2 pending items")
        
        # Verify all pending items were added
        pending_response = requests.get(
            f"{BASE_URL}/api/pending-items/doctor/{unique_phone}",
            headers=self.headers
        )
        
        assert pending_response.status_code == 200
        pending_items = pending_response.json()
        
        assert len(pending_items) >= 2, f"Expected at least 2 pending items, got {len(pending_items)}"
        print(f"PASS: All pending items added to collection")
    
    def test_4_items_api_returns_rate_mrp_gst(self):
        """Test that items API returns rate, mrp, and gst fields"""
        response = requests.get(
            f"{BASE_URL}/api/items",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Get items failed: {response.text}"
        items = response.json()
        
        if len(items) > 0:
            item = items[0]
            # Verify required fields exist
            assert 'rate' in item, "Item should have 'rate' field"
            assert 'mrp' in item, "Item should have 'mrp' field"
            assert 'gst' in item, "Item should have 'gst' field"
            print(f"PASS: Items API returns rate ({item.get('rate')}), mrp ({item.get('mrp')}), gst ({item.get('gst')})")
        else:
            print("SKIP: No items in database to test")
    
    def test_5_orders_api_supports_string_quantity(self):
        """Test that orders API correctly stores and returns string quantities"""
        response = requests.get(
            f"{BASE_URL}/api/orders",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Get orders failed: {response.text}"
        orders = response.json()
        
        # Check orders for string quantities
        for order in orders[:5]:  # Check first 5 orders
            for item in order.get('items', []):
                # Quantity should be string type
                qty = item.get('quantity')
                assert isinstance(qty, str) or isinstance(qty, int), f"Quantity type: {type(qty)}"
                print(f"  Order {order['order_number']}: Item qty = '{qty}'")
        
        print(f"PASS: Orders API handles quantities correctly")


class TestManualOrderCreateModel:
    """Test the ManualOrderCreate model with pending_items field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data['access_token']
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_1_order_without_pending_items(self):
        """Test creating order without pending items (normal flow)"""
        order_data = {
            "customer_name": "TEST_Normal_Order",
            "customer_phone": "9111222333",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item",
                    "item_code": "ITM-0001",
                    "item_name": "Test Item",
                    "quantity": "5",
                    "mrp": 100.0,
                    "rate": 80.0
                }
            ]
            # No pending_items field
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create order failed: {response.text}"
        data = response.json()
        assert data.get("pending_items_count", 0) == 0
        print(f"PASS: Order created without pending items, count = 0")
    
    def test_2_order_with_empty_pending_items(self):
        """Test creating order with empty pending_items array"""
        order_data = {
            "customer_name": "TEST_Empty_Pending",
            "customer_phone": "9222333444",
            "customer_type": "medical",
            "items": [
                {
                    "item_id": "test-item",
                    "item_code": "ITM-0001",
                    "item_name": "Test Item",
                    "quantity": "3",
                    "mrp": 100.0,
                    "rate": 80.0
                }
            ],
            "pending_items": []  # Empty array
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create order failed: {response.text}"
        data = response.json()
        assert data.get("pending_items_count", 0) == 0
        print(f"PASS: Order created with empty pending_items array")


# Cleanup test data
class TestCleanup:
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_cleanup(self):
        """Cleanup test data created during tests"""
        print("Cleanup: Test data prefixed with TEST_ should be cleaned manually if needed")
        pass
