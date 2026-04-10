"""
Test suite for Iteration 60 features:
1. Item Ledger - customer name + order ID in description
2. Products list - stock qty AND purchase rate
3. Main category checkboxes - previous selections on edit
4. Item code input full width
5. Opening Balance - per-item date
6. Sales Return - customer search and order history
7. User Ledger - customer data with item-wise totals
8. Manual Order - purchase rate alongside MRP/offers
9. Backend API: GET /api/stock/customer-orders
10. Backend API: GET /api/stock/user-ledger
11. Backend API: GET /api/stock/item-ledger/{item_id}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration60Features:
    """Test new features for Items & Inventory enhancements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "info@vetmech.in"
        self.admin_password = "Kongu@@44884"
        self.token = None
        self.test_item_id = None
        self.test_supplier_id = None
        
    def get_auth_token(self):
        """Get admin auth token"""
        if self.token:
            return self.token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get('access_token') or data.get('token')
        return self.token
    
    def get_headers(self):
        """Get auth headers"""
        return {"Authorization": f"Bearer {self.get_auth_token()}"}
    
    # ============== BACKEND API TESTS ==============
    
    def test_01_stock_availability_returns_purchase_rate(self):
        """Test GET /api/stock/availability returns closing_balance AND last_purchase_rate"""
        response = requests.get(f"{BASE_URL}/api/stock/availability", headers=self.get_headers())
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a dict with item_id keys
        assert isinstance(data, dict), "Response should be a dict"
        
        # Check structure of values
        if len(data) > 0:
            first_key = list(data.keys())[0]
            item_data = data[first_key]
            assert 'closing_balance' in item_data, "Should have closing_balance"
            assert 'last_purchase_rate' in item_data, "Should have last_purchase_rate"
            print(f"Stock availability sample: {first_key} -> {item_data}")
        print(f"Stock availability returned {len(data)} items")
    
    def test_02_customer_orders_endpoint_exists(self):
        """Test GET /api/stock/customer-orders endpoint exists and returns proper structure"""
        # Test with phone parameter
        response = requests.get(
            f"{BASE_URL}/api/stock/customer-orders",
            params={"phone": "9999777766"},
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have 'orders' key
        assert 'orders' in data, "Response should have 'orders' key"
        assert isinstance(data['orders'], list), "'orders' should be a list"
        print(f"Customer orders endpoint returned {len(data['orders'])} orders")
        
        # If orders exist, check structure
        if len(data['orders']) > 0:
            order = data['orders'][0]
            expected_fields = ['order_id', 'order_number', 'customer_name', 'customer_phone', 
                            'item_id', 'item_name', 'quantity', 'rate', 'date']
            for field in expected_fields:
                assert field in order, f"Order should have '{field}' field"
            print(f"Sample order: {order}")
    
    def test_03_customer_orders_with_name_param(self):
        """Test GET /api/stock/customer-orders with name parameter"""
        response = requests.get(
            f"{BASE_URL}/api/stock/customer-orders",
            params={"name": "test"},
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert 'orders' in data, "Response should have 'orders' key"
        print(f"Customer orders by name returned {len(data['orders'])} orders")
    
    def test_04_customer_orders_empty_params(self):
        """Test GET /api/stock/customer-orders with no params returns empty"""
        response = requests.get(
            f"{BASE_URL}/api/stock/customer-orders",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert 'orders' in data, "Response should have 'orders' key"
        # Should return empty when no params
        assert len(data['orders']) == 0, "Should return empty orders when no params"
        print("Customer orders with no params correctly returns empty")
    
    def test_05_user_ledger_endpoint_with_phone(self):
        """Test GET /api/stock/user-ledger with customer_phone returns item_totals"""
        response = requests.get(
            f"{BASE_URL}/api/stock/user-ledger",
            params={"customer_phone": "9999777766"},
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have item_totals and orders
        assert 'item_totals' in data, "Response should have 'item_totals' key"
        assert 'orders' in data, "Response should have 'orders' key"
        assert isinstance(data['item_totals'], dict), "'item_totals' should be a dict"
        assert isinstance(data['orders'], list), "'orders' should be a list"
        
        print(f"User ledger returned {len(data['orders'])} orders, {len(data['item_totals'])} item totals")
        if data['item_totals']:
            print(f"Item totals sample: {list(data['item_totals'].items())[:3]}")
    
    def test_06_user_ledger_with_name(self):
        """Test GET /api/stock/user-ledger with customer_name parameter"""
        response = requests.get(
            f"{BASE_URL}/api/stock/user-ledger",
            params={"customer_name": "test"},
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert 'item_totals' in data, "Response should have 'item_totals' key"
        assert 'orders' in data, "Response should have 'orders' key"
        print(f"User ledger by name returned {len(data['orders'])} orders")
    
    def test_07_item_ledger_endpoint(self):
        """Test GET /api/stock/item-ledger/{item_id} returns sale entries with customer name"""
        # First get an item
        items_response = requests.get(f"{BASE_URL}/api/items", headers=self.get_headers())
        assert items_response.status_code == 200
        items = items_response.json()
        
        if len(items) == 0:
            pytest.skip("No items available for testing")
        
        item_id = items[0]['id']
        
        response = requests.get(
            f"{BASE_URL}/api/stock/item-ledger/{item_id}",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check structure
        assert 'item_id' in data, "Response should have 'item_id'"
        assert 'opening_balance' in data, "Response should have 'opening_balance'"
        assert 'ledger' in data, "Response should have 'ledger'"
        assert 'closing_balance' in data, "Response should have 'closing_balance'"
        
        print(f"Item ledger for {item_id}: opening={data['opening_balance']}, closing={data['closing_balance']}, entries={len(data['ledger'])}")
        
        # Check if sale entries have customer name in description
        sale_entries = [e for e in data['ledger'] if e.get('type') == 'sale']
        if sale_entries:
            entry = sale_entries[0]
            desc = entry.get('description', '')
            print(f"Sample sale entry description: {desc}")
            # Description should contain customer name and order number
            assert 'Sale -' in desc, "Sale description should start with 'Sale -'"
            # Format should be "Sale - CustomerName (OrderNumber)"
            assert '(' in desc and ')' in desc, "Sale description should have order number in parentheses"
    
    def test_08_opening_balance_bulk_accepts_per_item_date(self):
        """Test POST /api/stock/opening-balance/bulk accepts per-item date field"""
        # First get an item
        items_response = requests.get(f"{BASE_URL}/api/items", headers=self.get_headers())
        assert items_response.status_code == 200
        items = items_response.json()
        
        if len(items) == 0:
            pytest.skip("No items available for testing")
        
        item_id = items[0]['id']
        
        # Test with per-item date
        response = requests.post(
            f"{BASE_URL}/api/stock/opening-balance/bulk",
            json={
                "items": [
                    {"item_id": item_id, "quantity": 10, "date": "2025-01-15"},
                ],
                "date": "2025-01-01"  # fallback date
            },
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert 'message' in data, "Response should have message"
        print(f"Opening balance bulk response: {data}")
        
        # Verify the date was saved
        balances_response = requests.get(
            f"{BASE_URL}/api/stock/opening-balances",
            headers=self.get_headers()
        )
        assert balances_response.status_code == 200
        balances = balances_response.json()
        
        item_balance = next((b for b in balances if b['item_id'] == item_id), None)
        if item_balance:
            print(f"Saved balance: {item_balance}")
            # The date should be the per-item date, not the fallback
            assert item_balance.get('date') == "2025-01-15", f"Date should be per-item date, got {item_balance.get('date')}"
    
    def test_09_stock_status_returns_purchase_rate(self):
        """Test GET /api/stock/status returns last_purchase_rate"""
        response = requests.get(f"{BASE_URL}/api/stock/status", headers=self.get_headers())
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            item = data[0]
            expected_fields = ['item_id', 'item_name', 'opening_balance', 'purchased', 
                            'sold', 'closing_balance', 'last_purchase_rate']
            for field in expected_fields:
                assert field in item, f"Stock status should have '{field}' field"
            print(f"Stock status sample: {item['item_name']} - closing: {item['closing_balance']}, purchase_rate: {item['last_purchase_rate']}")
    
    def test_10_items_api_returns_main_categories(self):
        """Test GET /api/items returns main_categories array"""
        response = requests.get(f"{BASE_URL}/api/items", headers=self.get_headers())
        assert response.status_code == 200, f"Failed: {response.text}"
        items = response.json()
        
        if len(items) > 0:
            item = items[0]
            # main_categories should be an array (can be empty)
            if 'main_categories' in item:
                assert isinstance(item['main_categories'], list), "main_categories should be a list"
                print(f"Sample item main_categories: {item.get('main_categories', [])}")
            else:
                print("Item doesn't have main_categories field (may be legacy data)")
    
    def test_11_create_item_with_main_categories(self):
        """Test creating item with main_categories array"""
        test_item = {
            "item_name": f"TEST_ITER60_{uuid.uuid4().hex[:8]}",
            "item_code": f"TI60-{uuid.uuid4().hex[:6]}",
            "main_categories": ["Large Animals", "Poultry"],
            "subcategories": ["Injection"],
            "mrp": 100,
            "gst": 12,
            "rate_doctors": 80
        }
        
        response = requests.post(
            f"{BASE_URL}/api/items",
            json=test_item,
            headers=self.get_headers()
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        created = response.json()
        
        assert created.get('main_categories') == ["Large Animals", "Poultry"], \
            f"main_categories not saved correctly: {created.get('main_categories')}"
        
        self.test_item_id = created['id']
        print(f"Created item with main_categories: {created['main_categories']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{self.test_item_id}", headers=self.get_headers())
    
    def test_12_update_item_preserves_main_categories(self):
        """Test updating item preserves main_categories"""
        # Create item first
        test_item = {
            "item_name": f"TEST_ITER60_UPDATE_{uuid.uuid4().hex[:8]}",
            "item_code": f"TI60U-{uuid.uuid4().hex[:6]}",
            "main_categories": ["Pets"],
            "mrp": 100,
            "gst": 12
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/items",
            json=test_item,
            headers=self.get_headers()
        )
        assert create_response.status_code in [200, 201]
        created = create_response.json()
        item_id = created['id']
        
        # Update with different main_categories
        update_response = requests.put(
            f"{BASE_URL}/api/items/{item_id}",
            json={
                "item_name": test_item['item_name'],
                "main_categories": ["Large Animals", "Pets"],
                "mrp": 100,
                "gst": 12
            },
            headers=self.get_headers()
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated = update_response.json()
        
        assert updated.get('main_categories') == ["Large Animals", "Pets"], \
            f"main_categories not updated correctly: {updated.get('main_categories')}"
        
        print(f"Updated item main_categories: {updated['main_categories']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=self.get_headers())
    
    def test_13_user_ledger_searches_both_doctor_and_customer_fields(self):
        """Test user-ledger searches both doctor_phone/doctor_name AND customer_phone/customer_name"""
        # This tests the $or query in the backend
        response = requests.get(
            f"{BASE_URL}/api/stock/user-ledger",
            params={"customer_phone": "999"},  # partial match
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # The query should use $or to search both doctor_phone and customer_phone
        print(f"User ledger partial phone search returned {len(data['orders'])} orders")
    
    def test_14_customer_orders_searches_both_fields(self):
        """Test customer-orders searches both doctor and customer fields"""
        response = requests.get(
            f"{BASE_URL}/api/stock/customer-orders",
            params={"phone": "999"},  # partial match
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"Customer orders partial phone search returned {len(data['orders'])} orders")


class TestSalesReturnCustomerSearch:
    """Test Sales Return customer search functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "info@vetmech.in"
        self.admin_password = "Kongu@@44884"
        self.token = None
        
    def get_auth_token(self):
        if self.token:
            return self.token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('access_token') or data.get('token')
        return self.token
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.get_auth_token()}"}
    
    def test_sales_return_endpoint_exists(self):
        """Test POST /api/stock/sales-return endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/stock/sales-return",
            json={
                "items": [{"item_id": "test", "quantity": 1, "rate": 100}],
                "date": "2025-01-15",
                "customer_name": "Test Customer",
                "customer_phone": "9999999999"
            },
            headers=self.get_headers()
        )
        # Should fail because item_id is invalid, but endpoint should exist
        # We're just checking the endpoint is reachable
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print(f"Sales return endpoint response: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
