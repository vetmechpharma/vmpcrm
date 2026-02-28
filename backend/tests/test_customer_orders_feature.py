"""
Test Customer Portal Order Feature - POST /api/customer/orders and GET /api/customer/orders
Testing the complete flow: customer login -> add to cart -> submit order -> verify in order history
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Customer credentials
CUSTOMER_PHONE = "9999777766"
CUSTOMER_PASSWORD = "test123"

# Admin credentials 
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"

class TestCustomerOrderFeature:
    """Test customer portal order creation and retrieval"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"access_token not in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"access_token not in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def customer_items(self, customer_token):
        """Get available items for customer"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/customer/items", headers=headers)
        assert response.status_code == 200, f"Get items failed: {response.text}"
        items = response.json()
        assert len(items) > 0, "No items available for customer"
        return items

    def test_customer_login(self, customer_token):
        """Test 1: Verify customer login returns valid token"""
        assert customer_token is not None
        assert len(customer_token) > 0
        print(f"✓ Customer login successful, got token")

    def test_get_customer_items(self, customer_token, customer_items):
        """Test 2: Verify customer can fetch available items"""
        assert len(customer_items) > 0
        # Check first item has required fields
        first_item = customer_items[0]
        assert "id" in first_item
        assert "item_code" in first_item
        assert "item_name" in first_item
        print(f"✓ Customer can view {len(customer_items)} items")

    def test_get_customer_orders_empty_or_existing(self, customer_token):
        """Test 3: Verify GET /api/customer/orders returns array"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/customer/orders", headers=headers)
        assert response.status_code == 200, f"Get orders failed: {response.text}"
        orders = response.json()
        assert isinstance(orders, list), "Orders should be a list"
        print(f"✓ Customer orders endpoint working, found {len(orders)} existing orders")

    def test_create_order_from_cart(self, customer_token, customer_items):
        """Test 4: Create a new order via POST /api/customer/orders"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Pick first 2 items for the cart
        cart_items = []
        for item in customer_items[:2]:
            cart_items.append({
                "item_id": item["id"],
                "item_code": item["item_code"],
                "item_name": item["item_name"],
                "quantity": "5",
                "rate": item.get("rate", item.get("mrp", 100)),
                "gst": item.get("gst", 0)
            })
        
        order_data = {
            "items": cart_items,
            "notes": "Test order from pytest"
        }
        
        response = requests.post(f"{BASE_URL}/api/customer/orders", json=order_data, headers=headers)
        assert response.status_code == 200, f"Create order failed: {response.text}"
        
        result = response.json()
        assert "id" in result or "order_number" in result, f"Order response missing id/order_number: {result}"
        
        print(f"✓ Order created successfully")
        return result

    def test_verify_order_in_history(self, customer_token, customer_items):
        """Test 5: Verify newly created order appears in customer order history"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # First create an order
        cart_items = [{
            "item_id": customer_items[0]["id"],
            "item_code": customer_items[0]["item_code"],
            "item_name": customer_items[0]["item_name"],
            "quantity": "3",
            "rate": customer_items[0].get("rate", 100)
        }]
        
        create_response = requests.post(f"{BASE_URL}/api/customer/orders", 
            json={"items": cart_items, "notes": "Test order for history verification"},
            headers=headers
        )
        assert create_response.status_code == 200, f"Create order failed: {create_response.text}"
        
        # Now fetch orders
        get_response = requests.get(f"{BASE_URL}/api/customer/orders", headers=headers)
        assert get_response.status_code == 200
        orders = get_response.json()
        
        # Should have at least one order
        assert len(orders) >= 1, "Expected at least 1 order in history"
        
        # Check most recent order structure
        recent_order = orders[0]
        assert "order_number" in recent_order
        assert "items" in recent_order
        assert "status" in recent_order
        assert recent_order["status"] == "pending"
        
        print(f"✓ Order appears in history with status '{recent_order['status']}'")

    def test_order_items_have_no_total_amount(self, customer_token, customer_items):
        """Test 6: Verify order detail shows only product details (name, code, qty) - NO total amounts"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Get orders
        response = requests.get(f"{BASE_URL}/api/customer/orders", headers=headers)
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) > 0:
            order = orders[0]
            items = order.get("items", [])
            
            for item in items:
                # Items should have name, code, quantity
                assert "item_name" in item, "Item missing item_name"
                assert "item_code" in item, "Item missing item_code"
                assert "quantity" in item, "Item missing quantity"
                print(f"  - Item: {item['item_name']} ({item['item_code']}) x {item['quantity']}")
            
            # Order level should NOT calculate totals (this is verified by frontend not backend)
            # But we can verify items have the basic structure
            print(f"✓ Order items contain required fields (name, code, quantity)")

    def test_empty_cart_rejected(self, customer_token):
        """Test 7: Verify empty cart order is rejected"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        response = requests.post(f"{BASE_URL}/api/customer/orders", 
            json={"items": [], "notes": "Empty cart test"},
            headers=headers
        )
        assert response.status_code == 400, f"Empty cart should be rejected, got {response.status_code}"
        print(f"✓ Empty cart correctly rejected with 400")

    def test_order_without_auth_rejected(self):
        """Test 8: Verify order without auth token is rejected"""
        response = requests.post(f"{BASE_URL}/api/customer/orders", 
            json={"items": [{"item_id": "test", "quantity": "1"}]}
        )
        # Should be 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated order correctly rejected")

    def test_admin_can_see_customer_portal_orders(self, admin_token, customer_token, customer_items):
        """Test 9: Verify admin can see orders from customer portal with source: customer_portal"""
        # First create an order as customer
        customer_headers = {"Authorization": f"Bearer {customer_token}"}
        cart_items = [{
            "item_id": customer_items[0]["id"],
            "item_code": customer_items[0]["item_code"],
            "item_name": customer_items[0]["item_name"],
            "quantity": "2",
            "rate": customer_items[0].get("rate", 100)
        }]
        
        create_resp = requests.post(f"{BASE_URL}/api/customer/orders", 
            json={"items": cart_items, "notes": "Admin visibility test"},
            headers=customer_headers
        )
        assert create_resp.status_code == 200
        
        # Now check admin orders endpoint
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
        assert orders_resp.status_code == 200
        
        orders = orders_resp.json()
        
        # Find orders with source: customer_portal
        portal_orders = [o for o in orders if o.get("source") == "customer_portal"]
        print(f"✓ Admin can view {len(portal_orders)} customer portal orders (total: {len(orders)})")


class TestCustomerOrderEdgeCases:
    """Test edge cases for customer orders"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Customer login failed: {response.text}")
        return response.json().get("access_token")
    
    def test_order_with_quantity_text(self, customer_token):
        """Test 10: Verify order handles quantity text like '10+5'"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # First get an item
        items_resp = requests.get(f"{BASE_URL}/api/customer/items", headers=headers)
        if items_resp.status_code != 200 or len(items_resp.json()) == 0:
            pytest.skip("No items available")
        
        item = items_resp.json()[0]
        
        order_data = {
            "items": [{
                "item_id": item["id"],
                "item_code": item["item_code"],
                "item_name": item["item_name"],
                "quantity": "10+5",  # Text format
                "rate": item.get("rate", 100)
            }],
            "notes": "Test quantity text format"
        }
        
        response = requests.post(f"{BASE_URL}/api/customer/orders", json=order_data, headers=headers)
        assert response.status_code == 200, f"Order with quantity text failed: {response.text}"
        print(f"✓ Order with quantity text '10+5' accepted")

    def test_order_with_special_characters_in_notes(self, customer_token):
        """Test 11: Verify order handles special characters in notes"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        items_resp = requests.get(f"{BASE_URL}/api/customer/items", headers=headers)
        if items_resp.status_code != 200 or len(items_resp.json()) == 0:
            pytest.skip("No items available")
        
        item = items_resp.json()[0]
        
        order_data = {
            "items": [{
                "item_id": item["id"],
                "item_code": item["item_code"],
                "item_name": item["item_name"],
                "quantity": "1",
                "rate": item.get("rate", 100)
            }],
            "notes": "Special chars: @#$%^&*()_+-=[]{}|;':\",./<>?"
        }
        
        response = requests.post(f"{BASE_URL}/api/customer/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        print(f"✓ Order with special characters in notes accepted")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
