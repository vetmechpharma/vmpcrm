"""
Test MR Orders Module - Backend API Tests
Testing: MR Login, MR Dashboard, MR Customers, MR Items, MR Orders, Cancel Request
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"


class TestMRLogin:
    """MR Login endpoint tests"""
    
    def test_mr_login_success(self):
        """Test MR login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "mr" in data
        assert data["mr"]["phone"] == MR_PHONE
        assert data["mr"]["name"] == "Test MR"
        assert "id" in data["mr"]
        assert "state" in data["mr"]
        assert "districts" in data["mr"]
    
    def test_mr_login_invalid_password(self):
        """Test MR login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "Invalid" in response.json().get("detail", "")
    
    def test_mr_login_invalid_phone(self):
        """Test MR login with wrong phone"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "0000000000",
            "password": MR_PASSWORD
        })
        assert response.status_code == 401
    
    def test_mr_login_missing_credentials(self):
        """Test MR login with missing credentials"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "",
            "password": ""
        })
        assert response.status_code == 400


class TestMRDashboard:
    """MR Dashboard endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup_mr_token(self):
        """Get MR token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        if response.status_code == 200:
            self.mr_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.mr_token}"}
        else:
            pytest.skip("MR login failed")
    
    def test_mr_dashboard_success(self):
        """Test MR dashboard loads with stats"""
        response = requests.get(f"{BASE_URL}/api/mr/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Check all expected dashboard fields
        assert "doctors" in data
        assert "medicals" in data
        assert "agencies" in data
        assert "total_customers" in data
        assert "today_visits" in data
        assert "total_visits" in data
        assert "pending_followups" in data
        assert "overdue_followups" in data
        assert "active_decks" in data
    
    def test_mr_dashboard_unauthorized(self):
        """Test MR dashboard without auth"""
        response = requests.get(f"{BASE_URL}/api/mr/dashboard")
        assert response.status_code in [401, 403]


class TestMRCustomers:
    """MR Customers endpoint tests (territory-filtered)"""
    
    @pytest.fixture(autouse=True)
    def setup_mr_token(self):
        """Get MR token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        if response.status_code == 200:
            self.mr_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.mr_token}"}
        else:
            pytest.skip("MR login failed")
    
    def test_mr_customers_success(self):
        """Test MR customers list returns territory-filtered results"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check customer has expected fields
        if len(data) > 0:
            customer = data[0]
            assert "id" in customer
            assert "name" in customer
            assert "entity_type" in customer
    
    def test_mr_customers_search(self):
        """Test MR customers search functionality"""
        response = requests.get(f"{BASE_URL}/api/mr/customers?search=Dr", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_mr_customers_unauthorized(self):
        """Test MR customers without auth"""
        response = requests.get(f"{BASE_URL}/api/mr/customers")
        assert response.status_code in [401, 403]


class TestMRItems:
    """MR Items endpoint tests (excludes out-of-stock)"""
    
    @pytest.fixture(autouse=True)
    def setup_mr_token(self):
        """Get MR token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        if response.status_code == 200:
            self.mr_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.mr_token}"}
        else:
            pytest.skip("MR login failed")
    
    def test_mr_items_success(self):
        """Test MR items list returns available items"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned items should NOT be out of stock
        for item in data:
            assert item.get("out_of_stock") != True
    
    def test_mr_items_search_vitamin(self):
        """Test MR items search for 'vita' finds Vitamin D3"""
        response = requests.get(f"{BASE_URL}/api/mr/items?search=vita", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        vitamin_found = any("Vitamin" in item.get("item_name", "") for item in data)
        assert vitamin_found, "Vitamin D3 1000IU should be found when searching 'vita'"
    
    def test_mr_items_search_amox(self):
        """Test MR items search for 'amox' finds Amoxicillin"""
        response = requests.get(f"{BASE_URL}/api/mr/items?search=amox", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        amox_found = any("Amoxicillin" in item.get("item_name", "") for item in data)
        assert amox_found, "Amoxicillin 500mg should be found when searching 'amox'"
    
    def test_mr_items_unauthorized(self):
        """Test MR items without auth"""
        response = requests.get(f"{BASE_URL}/api/mr/items")
        assert response.status_code in [401, 403]


class TestMROrders:
    """MR Orders endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup_mr_token(self):
        """Get MR token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        if response.status_code == 200:
            self.mr_token = response.json()["access_token"]
            self.mr_data = response.json()["mr"]
            self.headers = {"Authorization": f"Bearer {self.mr_token}"}
        else:
            pytest.skip("MR login failed")
    
    def test_mr_orders_list_success(self):
        """Test MR orders list returns orders"""
        response = requests.get(f"{BASE_URL}/api/mr/orders", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check orders have MR source
        for order in data:
            assert order.get("source") == "mr"
            assert order.get("mr_id") == self.mr_data["id"]
    
    def test_mr_orders_create_success(self):
        """Test MR can create order on behalf of customer"""
        # First get a customer
        customers_resp = requests.get(f"{BASE_URL}/api/mr/customers", headers=self.headers)
        assert customers_resp.status_code == 200
        customers = customers_resp.json()
        assert len(customers) > 0, "No customers in MR territory"
        customer = customers[0]
        
        # Get an item
        items_resp = requests.get(f"{BASE_URL}/api/mr/items?search=vita", headers=self.headers)
        assert items_resp.status_code == 200
        items = items_resp.json()
        assert len(items) > 0, "No items available"
        item = items[0]
        
        # Create order with text quantity format
        order_data = {
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "customer_phone": customer.get("phone", ""),
            "customer_type": customer["entity_type"],
            "items": [{
                "item_id": item["id"],
                "item_code": item["item_code"],
                "item_name": item["item_name"],
                "quantity": "10+5",  # Test text-based quantity format
                "mrp": item.get("mrp", 0),
                "rate": item.get("rate_doctors", 0)
            }],
            "notes": "TEST_AUTO_ORDER - Backend API Test"
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/orders", headers=self.headers, json=order_data)
        assert response.status_code == 200
        data = response.json()
        assert "order_number" in data
        assert data["status"] == "pending"
        assert data["order_number"].startswith("ORD-")
    
    def test_mr_orders_create_no_items_fails(self):
        """Test MR order creation fails without items"""
        order_data = {
            "customer_name": "Test Customer",
            "customer_type": "doctor",
            "items": [],
            "notes": "TEST"
        }
        response = requests.post(f"{BASE_URL}/api/mr/orders", headers=self.headers, json=order_data)
        assert response.status_code == 400
    
    def test_mr_orders_create_no_customer_fails(self):
        """Test MR order creation fails without customer name"""
        order_data = {
            "customer_name": "",
            "customer_type": "doctor",
            "items": [{"item_id": "test", "item_code": "TEST", "item_name": "Test", "quantity": "1"}],
            "notes": "TEST"
        }
        response = requests.post(f"{BASE_URL}/api/mr/orders", headers=self.headers, json=order_data)
        assert response.status_code == 400
    
    def test_mr_orders_unauthorized(self):
        """Test MR orders without auth"""
        response = requests.get(f"{BASE_URL}/api/mr/orders")
        assert response.status_code in [401, 403]


class TestMRCancelRequest:
    """MR Cancel Request endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup_mr_token(self):
        """Get MR token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        if response.status_code == 200:
            self.mr_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.mr_token}"}
        else:
            pytest.skip("MR login failed")
    
    def test_mr_cancel_request_success(self):
        """Test MR can request cancellation of pending order"""
        # First create an order
        customers_resp = requests.get(f"{BASE_URL}/api/mr/customers", headers=self.headers)
        customers = customers_resp.json()
        if not customers:
            pytest.skip("No customers available")
        customer = customers[0]
        
        items_resp = requests.get(f"{BASE_URL}/api/mr/items", headers=self.headers)
        items = items_resp.json()
        if not items:
            pytest.skip("No items available")
        item = items[0]
        
        # Create order
        order_data = {
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "customer_phone": customer.get("phone", ""),
            "customer_type": customer["entity_type"],
            "items": [{
                "item_id": item["id"],
                "item_code": item["item_code"],
                "item_name": item["item_name"],
                "quantity": "5",
                "mrp": item.get("mrp", 0),
                "rate": 100
            }],
            "notes": "TEST_CANCEL_REQUEST - For cancel test"
        }
        create_resp = requests.post(f"{BASE_URL}/api/mr/orders", headers=self.headers, json=order_data)
        assert create_resp.status_code == 200
        order_id = create_resp.json()["id"]
        
        # Request cancellation
        cancel_resp = requests.post(
            f"{BASE_URL}/api/mr/orders/{order_id}/cancel-request",
            headers=self.headers,
            json={"reason": "TEST: Order placed by mistake"}
        )
        assert cancel_resp.status_code == 200
        assert "Cancellation request submitted" in cancel_resp.json().get("message", "")
    
    def test_mr_cancel_request_invalid_order(self):
        """Test MR cancel request for invalid order returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/mr/orders/invalid-order-id/cancel-request",
            headers=self.headers,
            json={"reason": "Test"}
        )
        assert response.status_code == 404


class TestPWAAssets:
    """PWA Assets accessibility tests"""
    
    def test_mr_manifest_accessible(self):
        """Test PWA manifest is accessible"""
        response = requests.get(f"{BASE_URL}/mr-manifest.json")
        assert response.status_code == 200
        data = response.json()
        assert data["short_name"] == "MR Field App"
        assert data["start_url"] == "/mrvet/dashboard"
        assert data["scope"] == "/mrvet/"
        assert len(data["icons"]) >= 2
    
    def test_mr_service_worker_accessible(self):
        """Test PWA service worker file is accessible"""
        response = requests.get(f"{BASE_URL}/mr-sw.js")
        assert response.status_code == 200
        assert "text/javascript" in response.headers.get("content-type", "").lower() or \
               "application/javascript" in response.headers.get("content-type", "").lower()


class TestAdminMROrdersVisibility:
    """Admin can see MR orders with source badge"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_token(self):
        """Get Admin token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_admin_orders_shows_mr_source(self):
        """Test admin orders API returns MR source and mr_name fields"""
        response = requests.get(f"{BASE_URL}/api/orders?limit=20", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find an MR-placed order
        mr_orders = [o for o in data if o.get("source") == "mr"]
        if len(mr_orders) == 0:
            pytest.skip("No MR orders found to test")
        
        mr_order = mr_orders[0]
        assert mr_order["source"] == "mr"
        assert "mr_name" in mr_order
        assert mr_order["mr_name"] == "Test MR"
