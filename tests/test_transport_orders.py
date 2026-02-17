"""
Test suite for Transport Management and Order Tracking features
Tests: Transport CRUD, Order transport updates, Orders list with transport info
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://drug-order-system.preview.emergentagent.com')

class TestTransportCRUD:
    """Transport CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created transport IDs for cleanup
        self.created_transport_ids = []
        
        yield
        
        # Cleanup - delete test transports
        for transport_id in self.created_transport_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/transports/{transport_id}")
            except:
                pass
    
    def test_create_transport_with_tracking_url(self):
        """Test creating a transport with tracking URL template"""
        transport_data = {
            "name": f"TEST_Transport_{uuid.uuid4().hex[:8]}",
            "tracking_url_template": "https://track.example.com/?awb={tracking_number}",
            "is_local": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/transports", json=transport_data)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["name"] == transport_data["name"], "Name should match"
        assert data["tracking_url_template"] == transport_data["tracking_url_template"], "Tracking URL template should match"
        assert data["is_local"] == False, "is_local should be False"
        assert "created_at" in data, "Response should contain created_at"
        
        self.created_transport_ids.append(data["id"])
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/transports")
        assert get_response.status_code == 200
        transports = get_response.json()
        created_transport = next((t for t in transports if t["id"] == data["id"]), None)
        assert created_transport is not None, "Created transport should be in list"
        assert created_transport["name"] == transport_data["name"]
    
    def test_create_local_transport(self):
        """Test creating a local supply transport (no tracking)"""
        transport_data = {
            "name": f"TEST_LocalSupply_{uuid.uuid4().hex[:8]}",
            "tracking_url_template": None,
            "is_local": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/transports", json=transport_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == transport_data["name"]
        assert data["is_local"] == True, "is_local should be True"
        assert data["tracking_url_template"] is None, "Local transport should have no tracking URL"
        
        self.created_transport_ids.append(data["id"])
    
    def test_list_transports(self):
        """Test listing all transports"""
        response = self.session.get(f"{BASE_URL}/api/transports")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify structure of each transport
        for transport in data:
            assert "id" in transport, "Transport should have id"
            assert "name" in transport, "Transport should have name"
            assert "is_local" in transport, "Transport should have is_local"
            assert "created_at" in transport, "Transport should have created_at"
    
    def test_delete_transport(self):
        """Test deleting a transport"""
        # First create a transport
        transport_data = {
            "name": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}",
            "is_local": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/transports", json=transport_data)
        assert create_response.status_code == 200
        transport_id = create_response.json()["id"]
        
        # Delete the transport
        delete_response = self.session.delete(f"{BASE_URL}/api/transports/{transport_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/transports")
        transports = get_response.json()
        deleted_transport = next((t for t in transports if t["id"] == transport_id), None)
        assert deleted_transport is None, "Deleted transport should not be in list"
    
    def test_non_admin_cannot_create_transport(self):
        """Test that non-admin users cannot create transports"""
        # Register a non-admin user
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_staff_{uuid.uuid4().hex[:8]}@test.com",
            "password": "testpass123",
            "name": "Test Staff",
            "role": "staff"
        })
        
        if register_response.status_code == 200:
            staff_token = register_response.json().get("access_token")
            staff_session = requests.Session()
            staff_session.headers.update({
                "Content-Type": "application/json",
                "Authorization": f"Bearer {staff_token}"
            })
            
            # Try to create transport as staff
            response = staff_session.post(f"{BASE_URL}/api/transports", json={
                "name": "TEST_Unauthorized",
                "is_local": False
            })
            
            assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"


class TestOrderTransportUpdate:
    """Order transport update tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token and find an order to test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get existing orders
        orders_response = self.session.get(f"{BASE_URL}/api/orders")
        assert orders_response.status_code == 200
        self.orders = orders_response.json()
        
        # Get existing transports
        transports_response = self.session.get(f"{BASE_URL}/api/transports")
        assert transports_response.status_code == 200
        self.transports = transports_response.json()
    
    def test_update_order_with_transport_details(self):
        """Test updating an order with transport and tracking info"""
        if not self.orders:
            pytest.skip("No orders available for testing")
        
        order = self.orders[0]
        order_id = order["id"]
        
        # Get a transport to use
        transport = self.transports[0] if self.transports else None
        
        update_data = {
            "status": "shipped",
            "transport_id": transport["id"] if transport else None,
            "transport_name": transport["name"] if transport else "Manual Transport",
            "tracking_number": "TEST_TRK_" + uuid.uuid4().hex[:8],
            "tracking_url": "https://track.example.com/TEST123",
            "delivery_station": "Test Station",
            "payment_mode": "to_pay"
        }
        
        response = self.session.put(f"{BASE_URL}/api/orders/{order_id}/transport", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Order updated successfully"
        
        # Verify the update persisted
        get_response = self.session.get(f"{BASE_URL}/api/orders")
        assert get_response.status_code == 200
        
        updated_orders = get_response.json()
        updated_order = next((o for o in updated_orders if o["id"] == order_id), None)
        
        assert updated_order is not None, "Order should exist"
        assert updated_order["status"] == update_data["status"], "Status should be updated"
        assert updated_order["tracking_number"] == update_data["tracking_number"], "Tracking number should be updated"
        assert updated_order["delivery_station"] == update_data["delivery_station"], "Delivery station should be updated"
        assert updated_order["payment_mode"] == update_data["payment_mode"], "Payment mode should be updated"
    
    def test_update_order_status_only(self):
        """Test updating just the order status"""
        if len(self.orders) < 2:
            pytest.skip("Not enough orders for testing")
        
        order = self.orders[1]
        order_id = order["id"]
        
        update_data = {
            "status": "processing"
        }
        
        response = self.session.put(f"{BASE_URL}/api/orders/{order_id}/transport", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/orders")
        updated_orders = get_response.json()
        updated_order = next((o for o in updated_orders if o["id"] == order_id), None)
        
        assert updated_order["status"] == "processing"
    
    def test_update_nonexistent_order(self):
        """Test updating a non-existent order returns 404"""
        fake_order_id = str(uuid.uuid4())
        
        response = self.session.put(f"{BASE_URL}/api/orders/{fake_order_id}/transport", json={
            "status": "shipped"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestOrdersList:
    """Orders list with transport info tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_orders_list_contains_transport_fields(self):
        """Test that orders list includes transport-related fields"""
        response = self.session.get(f"{BASE_URL}/api/orders")
        
        assert response.status_code == 200
        
        orders = response.json()
        assert isinstance(orders, list)
        
        # Check that transport fields exist in response schema
        for order in orders:
            # These fields should exist (even if null)
            assert "transport_id" in order, "Order should have transport_id field"
            assert "transport_name" in order, "Order should have transport_name field"
            assert "tracking_number" in order, "Order should have tracking_number field"
            assert "tracking_url" in order, "Order should have tracking_url field"
            assert "delivery_station" in order, "Order should have delivery_station field"
            assert "payment_mode" in order, "Order should have payment_mode field"
    
    def test_orders_filter_by_status(self):
        """Test filtering orders by status"""
        # Get all orders first
        all_response = self.session.get(f"{BASE_URL}/api/orders")
        assert all_response.status_code == 200
        all_orders = all_response.json()
        
        if not all_orders:
            pytest.skip("No orders available")
        
        # Get a status that exists
        existing_status = all_orders[0]["status"]
        
        # Filter by that status
        filtered_response = self.session.get(f"{BASE_URL}/api/orders", params={"status": existing_status})
        assert filtered_response.status_code == 200
        
        filtered_orders = filtered_response.json()
        
        # All filtered orders should have the requested status
        for order in filtered_orders:
            assert order["status"] == existing_status, f"Order status should be {existing_status}"
    
    def test_orders_contain_required_fields(self):
        """Test that orders contain all required fields"""
        response = self.session.get(f"{BASE_URL}/api/orders")
        
        assert response.status_code == 200
        orders = response.json()
        
        required_fields = [
            "id", "order_number", "doctor_phone", "items", "status", "created_at"
        ]
        
        for order in orders:
            for field in required_fields:
                assert field in order, f"Order should have {field} field"
            
            # Verify items structure
            assert isinstance(order["items"], list), "Items should be a list"
            for item in order["items"]:
                assert "item_name" in item, "Item should have item_name"
                assert "quantity" in item, "Item should have quantity"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json().get("status") == "healthy"
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        assert "VMP CRM API" in response.json().get("message", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
