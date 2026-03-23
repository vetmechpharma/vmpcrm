"""
Test Rate/Unit field in order forms
- Backend: POST /api/mr/orders accepts custom rate per item
- Backend: POST /api/orders/manual/create accepts custom rate per item
- Backend: PUT /api/orders/{id}/items accepts updated rate values
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"

# Test data
TEST_CUSTOMER_ID = "25f49e98-4f62-4425-9a5f-ebd2f97fd8e6"
TEST_ITEM_AMX = {
    "id": "5f2ded6c-b7ed-4211-8ed5-bd678cd14383",
    "item_code": "AMX-500",
    "item_name": "Amoxicillin 500mg",
    "mrp": 120,
    "rate": 75.5
}
TEST_ITEM_VIT = {
    "id": "300279b6-60f2-4211-8ed5-bd678cd14383",
    "item_code": "ITM-0002",
    "item_name": "Vitamin D3 1000IU",
    "mrp": 250,
    "rate": 180
}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def mr_token():
    """Get MR authentication token"""
    response = requests.post(f"{BASE_URL}/api/mr/login", json={
        "phone": MR_PHONE,
        "password": MR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"MR authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def admin_client(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture
def mr_client(mr_token):
    """Session with MR auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {mr_token}"
    })
    return session


class TestOrderItemModel:
    """Test that OrderItem model accepts rate field"""
    
    def test_order_item_has_rate_field(self, admin_client):
        """Verify OrderItem model includes rate field by checking existing order"""
        response = admin_client.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        
        orders = response.json()
        if len(orders) > 0:
            # Check if items have rate field
            order = orders[0]
            if order.get('items') and len(order['items']) > 0:
                item = order['items'][0]
                assert 'rate' in item, "OrderItem should have 'rate' field"
                assert 'mrp' in item, "OrderItem should have 'mrp' field"
                print(f"✓ Order item has rate={item.get('rate')}, mrp={item.get('mrp')}")


class TestAdminManualOrderWithRate:
    """Test POST /api/orders/manual/create accepts custom rate per item"""
    
    def test_create_manual_order_with_custom_rate(self, admin_client):
        """Admin can create order with custom rate values"""
        custom_rate = 85.50  # Different from default rate
        
        order_data = {
            "customer_name": "TEST_Rate_Customer",
            "customer_phone": "9999888877",
            "customer_email": "test_rate@example.com",
            "customer_address": "Test Address",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "5",
                    "mrp": TEST_ITEM_AMX["mrp"],
                    "rate": custom_rate  # Custom rate
                }
            ]
        }
        
        response = admin_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        result = response.json()
        assert "order_number" in result, "Response should contain order_number"
        order_id = result.get("order_id")  # Note: API returns order_id, not id
        order_number = result.get("order_number")
        print(f"✓ Created order {order_number} with custom rate")
        
        # Verify the order was created with correct rate (get from list)
        get_response = admin_client.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200, f"Failed to get orders: {get_response.text}"
        
        orders = get_response.json()
        order = next((o for o in orders if o.get('id') == order_id), None)
        assert order is not None, f"Order {order_id} not found in list"
        assert len(order.get("items", [])) > 0, "Order should have items"
        
        item = order["items"][0]
        assert item["rate"] == custom_rate, f"Rate should be {custom_rate}, got {item['rate']}"
        assert item["mrp"] == TEST_ITEM_AMX["mrp"], f"MRP should be {TEST_ITEM_AMX['mrp']}, got {item['mrp']}"
        print(f"✓ Verified order item has rate={item['rate']}, mrp={item['mrp']}")
        
        # Cleanup - delete the test order
        delete_response = admin_client.delete(f"{BASE_URL}/api/orders/{order_id}")
        print(f"✓ Cleanup: deleted test order {order_number}")
        
        return order_id
    
    def test_create_manual_order_with_multiple_items_different_rates(self, admin_client):
        """Admin can create order with multiple items having different rates"""
        order_data = {
            "customer_name": "TEST_MultiRate_Customer",
            "customer_phone": "9999777766",
            "customer_email": "test_multirate@example.com",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "10+5",  # Scheme format
                    "mrp": TEST_ITEM_AMX["mrp"],
                    "rate": 70.00  # Custom rate 1
                },
                {
                    "item_id": TEST_ITEM_VIT["id"],
                    "item_code": TEST_ITEM_VIT["item_code"],
                    "item_name": TEST_ITEM_VIT["item_name"],
                    "quantity": "20",
                    "mrp": TEST_ITEM_VIT["mrp"],
                    "rate": 165.50  # Custom rate 2
                }
            ]
        }
        
        response = admin_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        result = response.json()
        order_id = result.get("order_id")  # Note: API returns order_id, not id
        order_number = result.get("order_number")
        print(f"✓ Created multi-item order {order_number}")
        
        # Verify rates (get from list)
        get_response = admin_client.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200
        
        orders = get_response.json()
        order = next((o for o in orders if o.get('id') == order_id), None)
        assert order is not None, f"Order {order_id} not found"
        assert len(order.get("items", [])) == 2, "Order should have 2 items"
        
        # Check first item
        item1 = order["items"][0]
        assert item1["rate"] == 70.00, f"Item 1 rate should be 70.00, got {item1['rate']}"
        assert item1["quantity"] == "10+5", f"Item 1 quantity should be '10+5', got {item1['quantity']}"
        
        # Check second item
        item2 = order["items"][1]
        assert item2["rate"] == 165.50, f"Item 2 rate should be 165.50, got {item2['rate']}"
        
        print(f"✓ Verified multiple items with different rates: {item1['rate']}, {item2['rate']}")
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/orders/{order_id}")
        print(f"✓ Cleanup: deleted test order {order_number}")


class TestAdminUpdateOrderItemsRate:
    """Test PUT /api/orders/{id}/items accepts updated rate values"""
    
    def test_update_order_item_rate(self, admin_client):
        """Admin can update rate values on existing order items"""
        # First create an order
        order_data = {
            "customer_name": "TEST_UpdateRate_Customer",
            "customer_phone": "9999666655",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "10",
                    "mrp": TEST_ITEM_AMX["mrp"],
                    "rate": 75.00  # Original rate
                }
            ]
        }
        
        create_response = admin_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert create_response.status_code == 200, f"Failed to create order: {create_response.text}"
        
        result = create_response.json()
        order_id = result.get("order_id")  # Note: API returns order_id, not id
        order_number = result.get("order_number")
        print(f"✓ Created order {order_number} for rate update test")
        
        # Now update the rate
        new_rate = 68.50
        update_data = {
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "10",
                    "mrp": TEST_ITEM_AMX["mrp"],
                    "rate": new_rate  # Updated rate
                }
            ]
        }
        
        update_response = admin_client.put(f"{BASE_URL}/api/orders/{order_id}/items", json=update_data)
        assert update_response.status_code == 200, f"Failed to update order items: {update_response.text}"
        print(f"✓ Updated order items with new rate")
        
        # Verify the rate was updated (get from list)
        get_response = admin_client.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200
        
        orders = get_response.json()
        order = next((o for o in orders if o.get('id') == order_id), None)
        assert order is not None, f"Order {order_id} not found"
        item = order["items"][0]
        assert item["rate"] == new_rate, f"Rate should be {new_rate}, got {item['rate']}"
        print(f"✓ Verified rate updated from 75.00 to {item['rate']}")
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/orders/{order_id}")
        print(f"✓ Cleanup: deleted test order {order_number}")


class TestMROrderWithRate:
    """Test POST /api/mr/orders accepts custom rate per item"""
    
    def test_mr_create_order_with_custom_rate(self, mr_client, admin_client):
        """MR can create order with custom rate values"""
        custom_rate = 72.00
        
        # First get a customer from MR's assigned area
        customers_response = mr_client.get(f"{BASE_URL}/api/mr/customers")
        if customers_response.status_code != 200:
            pytest.skip("Could not get MR customers")
        
        customers = customers_response.json()
        if len(customers) == 0:
            pytest.skip("No customers available for MR")
        
        customer = customers[0]
        
        order_data = {
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "customer_phone": customer.get("phone", "9999555544"),
            "customer_type": customer.get("entity_type", "doctor"),
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "8",
                    "mrp": TEST_ITEM_AMX["mrp"],
                    "rate": custom_rate  # Custom rate
                }
            ],
            "notes": "TEST_MR_Rate_Order"
        }
        
        response = mr_client.post(f"{BASE_URL}/api/mr/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create MR order: {response.text}"
        
        result = response.json()
        order_id = result.get("id")  # MR API returns 'id', not 'order_id'
        order_number = result.get("order_number")
        
        # Verify the order was created with correct rate (use admin to get full order details)
        get_response = admin_client.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200, f"Failed to get orders: {get_response.text}"
        
        orders = get_response.json()
        order = next((o for o in orders if o.get('id') == order_id), None)
        assert order is not None, f"Order {order_id} not found"
        assert len(order.get("items", [])) > 0, "Order should have items"
        
        item = order["items"][0]
        assert item["rate"] == custom_rate, f"Rate should be {custom_rate}, got {item['rate']}"
        assert item["mrp"] == TEST_ITEM_AMX["mrp"], f"MRP should be {TEST_ITEM_AMX['mrp']}, got {item['mrp']}"
        assert order.get("source") == "mr", "Order source should be 'mr'"
        print(f"✓ Verified MR order item has rate={item['rate']}, mrp={item['mrp']}, source=mr")
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/orders/{order_id}")
        print(f"✓ Cleanup: deleted test order {order_number}")
    
    def test_mr_create_order_with_zero_rate(self, mr_client, admin_client):
        """MR can create order with zero rate (free sample)"""
        # Get a customer
        customers_response = mr_client.get(f"{BASE_URL}/api/mr/customers")
        if customers_response.status_code != 200:
            pytest.skip("Could not get MR customers")
        
        customers = customers_response.json()
        if len(customers) == 0:
            pytest.skip("No customers available for MR")
        
        customer = customers[0]
        
        order_data = {
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "customer_phone": customer.get("phone", "9999444433"),
            "customer_type": customer.get("entity_type", "doctor"),
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "5",
                    "mrp": TEST_ITEM_AMX["mrp"],
                    "rate": 0  # Zero rate (free sample)
                }
            ],
            "notes": "TEST_MR_Free_Sample"
        }
        
        response = mr_client.post(f"{BASE_URL}/api/mr/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create MR order: {response.text}"
        
        result = response.json()
        order_id = result.get("id")  # MR API returns 'id', not 'order_id'
        order_number = result.get("order_number")
        
        # Verify
        get_response = admin_client.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200
        
        orders = get_response.json()
        order = next((o for o in orders if o.get('id') == order_id), None)
        assert order is not None, f"Order {order_id} not found"
        item = order["items"][0]
        assert item["rate"] == 0, f"Rate should be 0, got {item['rate']}"
        print(f"✓ Verified zero rate order: rate={item['rate']}")
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/orders/{order_id}")
        print(f"✓ Cleanup: deleted test order {order_number}")


class TestMRPFieldImmutability:
    """Test that MRP field is stored correctly and separate from rate"""
    
    def test_mrp_stored_separately_from_rate(self, admin_client):
        """MRP and rate are stored as separate fields"""
        custom_rate = 65.00
        mrp_value = TEST_ITEM_AMX["mrp"]  # 120
        
        order_data = {
            "customer_name": "TEST_MRP_Separate",
            "customer_phone": "9999333322",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": TEST_ITEM_AMX["id"],
                    "item_code": TEST_ITEM_AMX["item_code"],
                    "item_name": TEST_ITEM_AMX["item_name"],
                    "quantity": "10",
                    "mrp": mrp_value,
                    "rate": custom_rate
                }
            ]
        }
        
        response = admin_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200
        
        result = response.json()
        order_id = result.get("order_id")  # Note: API returns order_id, not id
        
        # Verify both fields are stored correctly (get from list)
        get_response = admin_client.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200
        
        orders = get_response.json()
        order = next((o for o in orders if o.get('id') == order_id), None)
        assert order is not None, f"Order {order_id} not found"
        item = order["items"][0]
        
        assert item["mrp"] == mrp_value, f"MRP should be {mrp_value}, got {item['mrp']}"
        assert item["rate"] == custom_rate, f"Rate should be {custom_rate}, got {item['rate']}"
        assert item["mrp"] != item["rate"], "MRP and rate should be different values"
        
        print(f"✓ MRP ({item['mrp']}) and rate ({item['rate']}) stored separately")
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/orders/{order_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
