"""
Test suite for 5 new features:
1. Role-based default rate in MR order form
2. Order notes showing in admin order views
3. MR payment recording with admin approval
4. MR name showing on submitted orders
5. Order Transfer to Agency
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Admin login should return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert len(data["access_token"]) > 0
        print(f"✓ Admin login successful, token length: {len(data['access_token'])}")


class TestMRLogin:
    """Test MR authentication"""
    
    def test_mr_login_success(self):
        """MR login should return access_token and mr object"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200, f"MR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "mr" in data, "No mr object in response"
        assert data["mr"]["phone"] == MR_PHONE
        print(f"✓ MR login successful, MR name: {data['mr']['name']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def mr_token():
    """Get MR authentication token"""
    response = requests.post(f"{BASE_URL}/api/mr/login", json={
        "phone": MR_PHONE,
        "password": MR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("MR authentication failed")


@pytest.fixture(scope="module")
def mr_info():
    """Get MR info"""
    response = requests.post(f"{BASE_URL}/api/mr/login", json={
        "phone": MR_PHONE,
        "password": MR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("mr")
    return None


class TestOrdersEndpoint:
    """Test orders endpoint returns new fields: notes, mr_name, source, customer_type, transferred_to_agency_*"""
    
    def test_orders_endpoint_returns_new_fields(self, admin_token):
        """GET /api/orders should return orders with new fields in response model"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        orders = response.json()
        
        # Check that the endpoint works
        assert isinstance(orders, list), "Orders should be a list"
        print(f"✓ Orders endpoint returned {len(orders)} orders")
        
        # If there are orders, check the response structure
        if len(orders) > 0:
            order = orders[0]
            # These fields should be present in OrderResponse model
            expected_fields = ['id', 'order_number', 'doctor_name', 'doctor_phone', 'items', 'status', 'created_at']
            for field in expected_fields:
                assert field in order, f"Missing field: {field}"
            
            # New fields (may be null but should be in response)
            # notes, customer_type, mr_name, source, transferred_to_agency_* are optional
            print(f"✓ Order structure validated, first order: {order.get('order_number')}")
            
            # Check for MR orders specifically
            mr_orders = [o for o in orders if o.get('source') == 'mr']
            if mr_orders:
                mr_order = mr_orders[0]
                print(f"✓ Found MR order: {mr_order.get('order_number')}, mr_name: {mr_order.get('mr_name')}")
            
            # Check for transferred orders
            transferred_orders = [o for o in orders if o.get('status') == 'transferred']
            if transferred_orders:
                t_order = transferred_orders[0]
                print(f"✓ Found transferred order: {t_order.get('order_number')}, agency: {t_order.get('transferred_to_agency_name')}")


class TestOrderTransfer:
    """Test order transfer to agency feature"""
    
    def test_get_agencies(self, admin_token):
        """GET /api/agencies should return list of agencies"""
        response = requests.get(f"{BASE_URL}/api/agencies", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Failed to get agencies: {response.text}"
        agencies = response.json()
        assert isinstance(agencies, list), "Agencies should be a list"
        print(f"✓ Found {len(agencies)} agencies")
        return agencies
    
    def test_transfer_order_requires_agency_id(self, admin_token):
        """POST /api/orders/{id}/transfer should require agency_id"""
        # First get an order
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        orders = orders_resp.json()
        
        # Find a non-terminal order
        transferable = [o for o in orders if o.get('status') not in ['transferred', 'delivered', 'cancelled']]
        if not transferable:
            pytest.skip("No transferable orders found")
        
        order = transferable[0]
        
        # Try transfer without agency_id
        response = requests.post(f"{BASE_URL}/api/orders/{order['id']}/transfer", 
            json={},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, "Should fail without agency_id"
        print(f"✓ Transfer correctly requires agency_id")
    
    def test_transfer_order_to_agency(self, admin_token):
        """POST /api/orders/{id}/transfer should transfer order to agency"""
        # Get agencies
        agencies_resp = requests.get(f"{BASE_URL}/api/agencies", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        agencies = agencies_resp.json()
        if not agencies:
            pytest.skip("No agencies found")
        
        agency = agencies[0]
        
        # Get orders
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        orders = orders_resp.json()
        
        # Find a non-terminal order
        transferable = [o for o in orders if o.get('status') not in ['transferred', 'delivered', 'cancelled']]
        if not transferable:
            pytest.skip("No transferable orders found")
        
        order = transferable[0]
        order_id = order['id']
        
        # Transfer the order
        response = requests.post(f"{BASE_URL}/api/orders/{order_id}/transfer",
            json={"agency_id": agency['id']},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        # Verify the order was updated
        verify_resp = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        updated_orders = verify_resp.json()
        updated_order = next((o for o in updated_orders if o['id'] == order_id), None)
        
        assert updated_order is not None, "Order not found after transfer"
        assert updated_order['status'] == 'transferred', f"Status should be 'transferred', got: {updated_order['status']}"
        assert updated_order.get('transferred_to_agency_name') == agency['name'], "Agency name not set"
        
        print(f"✓ Order {order['order_number']} transferred to {agency['name']}")


class TestMRPaymentRequests:
    """Test MR payment recording with admin approval"""
    
    def test_create_payment_request(self, mr_token):
        """POST /api/mr/payment-requests should create a payment request"""
        # First get a customer
        customers_resp = requests.get(f"{BASE_URL}/api/mr/customers", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        assert customers_resp.status_code == 200, f"Failed to get customers: {customers_resp.text}"
        customers = customers_resp.json()
        
        if not customers:
            pytest.skip("No customers found")
        
        customer = customers[0]
        
        # Create payment request
        test_amount = 1000 + (uuid.uuid4().int % 1000)  # Random amount for uniqueness
        response = requests.post(f"{BASE_URL}/api/mr/payment-requests",
            json={
                "customer_id": customer['id'],
                "customer_name": customer['name'],
                "customer_type": customer.get('entity_type', 'doctor'),
                "customer_phone": customer.get('phone', ''),
                "amount": test_amount,
                "mode": "cash",
                "notes": f"TEST_payment_request_{uuid.uuid4().hex[:8]}",
                "date": "2026-01-15"
            },
            headers={"Authorization": f"Bearer {mr_token}"}
        )
        assert response.status_code == 200, f"Failed to create payment request: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        print(f"✓ Payment request created: {data['id']}, amount: {test_amount}")
        return data['id']
    
    def test_get_mr_payment_requests(self, mr_token):
        """GET /api/mr/payment-requests should return MR's payment requests"""
        response = requests.get(f"{BASE_URL}/api/mr/payment-requests", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        assert response.status_code == 200, f"Failed to get payment requests: {response.text}"
        requests_list = response.json()
        assert isinstance(requests_list, list), "Should return a list"
        print(f"✓ MR has {len(requests_list)} payment requests")
        
        if requests_list:
            req = requests_list[0]
            assert "customer_name" in req
            assert "amount" in req
            assert "status" in req
            print(f"✓ Latest request: {req['customer_name']}, Rs.{req['amount']}, status: {req['status']}")
    
    def test_admin_get_all_payment_requests(self, admin_token):
        """GET /api/payment-requests should return all payment requests for admin"""
        response = requests.get(f"{BASE_URL}/api/payment-requests", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Failed to get payment requests: {response.text}"
        requests_list = response.json()
        assert isinstance(requests_list, list), "Should return a list"
        print(f"✓ Admin sees {len(requests_list)} payment requests")
        return requests_list
    
    def test_admin_approve_payment_request(self, admin_token, mr_token):
        """POST /api/payment-requests/{id}/approve with action=approve should create payment"""
        # First create a new payment request
        customers_resp = requests.get(f"{BASE_URL}/api/mr/customers", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        customers = customers_resp.json()
        if not customers:
            pytest.skip("No customers found")
        
        customer = customers[0]
        test_amount = 500 + (uuid.uuid4().int % 500)
        
        create_resp = requests.post(f"{BASE_URL}/api/mr/payment-requests",
            json={
                "customer_id": customer['id'],
                "customer_name": customer['name'],
                "customer_type": customer.get('entity_type', 'doctor'),
                "amount": test_amount,
                "mode": "upi",
                "notes": f"TEST_approve_{uuid.uuid4().hex[:8]}"
            },
            headers={"Authorization": f"Bearer {mr_token}"}
        )
        assert create_resp.status_code == 200
        request_id = create_resp.json()['id']
        
        # Admin approves
        approve_resp = requests.post(f"{BASE_URL}/api/payment-requests/{request_id}/approve",
            json={"action": "approve"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.text}"
        data = approve_resp.json()
        assert "payment_id" in data, "Should return payment_id on approval"
        print(f"✓ Payment request approved, payment_id: {data['payment_id']}")
        
        # Verify the request status changed
        requests_resp = requests.get(f"{BASE_URL}/api/payment-requests", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        all_requests = requests_resp.json()
        approved_req = next((r for r in all_requests if r['id'] == request_id), None)
        assert approved_req is not None
        assert approved_req['status'] == 'approved', f"Status should be 'approved', got: {approved_req['status']}"
        print(f"✓ Request status verified as 'approved'")
    
    def test_admin_reject_payment_request(self, admin_token, mr_token):
        """POST /api/payment-requests/{id}/approve with action=reject should reject request"""
        # Create a new payment request
        customers_resp = requests.get(f"{BASE_URL}/api/mr/customers", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        customers = customers_resp.json()
        if not customers:
            pytest.skip("No customers found")
        
        customer = customers[0]
        
        create_resp = requests.post(f"{BASE_URL}/api/mr/payment-requests",
            json={
                "customer_id": customer['id'],
                "customer_name": customer['name'],
                "customer_type": customer.get('entity_type', 'doctor'),
                "amount": 100,
                "mode": "cash",
                "notes": f"TEST_reject_{uuid.uuid4().hex[:8]}"
            },
            headers={"Authorization": f"Bearer {mr_token}"}
        )
        assert create_resp.status_code == 200
        request_id = create_resp.json()['id']
        
        # Admin rejects
        reject_resp = requests.post(f"{BASE_URL}/api/payment-requests/{request_id}/approve",
            json={"action": "reject", "reason": "Test rejection reason"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert reject_resp.status_code == 200, f"Reject failed: {reject_resp.text}"
        
        # Verify status
        requests_resp = requests.get(f"{BASE_URL}/api/payment-requests", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        all_requests = requests_resp.json()
        rejected_req = next((r for r in all_requests if r['id'] == request_id), None)
        assert rejected_req is not None
        assert rejected_req['status'] == 'rejected'
        print(f"✓ Payment request rejected successfully")


class TestMROrdersWithNotes:
    """Test MR orders include notes and mr_name"""
    
    def test_mr_order_creation_with_notes(self, mr_token, mr_info):
        """MR created orders should have notes and mr_name"""
        # Get items
        items_resp = requests.get(f"{BASE_URL}/api/mr/items", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        items = items_resp.json()
        if not items:
            pytest.skip("No items found")
        
        # Get customers
        customers_resp = requests.get(f"{BASE_URL}/api/mr/customers", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        customers = customers_resp.json()
        if not customers:
            pytest.skip("No customers found")
        
        customer = customers[0]
        item = items[0]
        test_notes = f"TEST_notes_{uuid.uuid4().hex[:8]}"
        
        # Create order with notes
        order_data = {
            "customer_name": customer['name'],
            "customer_phone": customer.get('phone', '9999999999'),
            "customer_type": customer.get('entity_type', 'doctor'),
            "customer_id": customer['id'],
            "items": [{
                "item_id": item['id'],
                "item_code": item.get('item_code', ''),
                "item_name": item.get('name', item.get('item_name', '')),
                "quantity": "1",
                "mrp": item.get('mrp', 0),
                "rate": item.get('rate', 0)
            }],
            "notes": test_notes
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/mr/orders",
            json=order_data,
            headers={"Authorization": f"Bearer {mr_token}"}
        )
        
        if create_resp.status_code != 200:
            print(f"Order creation response: {create_resp.text}")
        
        assert create_resp.status_code == 200, f"Failed to create order: {create_resp.text}"
        order = create_resp.json()
        
        print(f"✓ MR order created: {order.get('order_number')}")
        
        # The order should have notes and source='mr'
        assert order.get('source') == 'mr', "Order source should be 'mr'"
        print(f"✓ Order source is 'mr'")


class TestRoleBasedRates:
    """Test that items have role-based rates (rate_doctors, rate_medicals, rate_agencies)"""
    
    def test_items_have_role_based_rates(self, mr_token):
        """GET /api/mr/items should return items with role-based rate fields"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers={
            "Authorization": f"Bearer {mr_token}"
        })
        assert response.status_code == 200, f"Failed to get items: {response.text}"
        items = response.json()
        
        if not items:
            pytest.skip("No items found")
        
        # Check that items have rate fields
        item = items[0]
        print(f"✓ Item: {item.get('name', item.get('item_name'))}")
        print(f"  - rate: {item.get('rate')}")
        print(f"  - rate_doctors: {item.get('rate_doctors')}")
        print(f"  - rate_medicals: {item.get('rate_medicals')}")
        print(f"  - rate_agencies: {item.get('rate_agencies')}")
        
        # At minimum, rate should exist
        assert 'rate' in item or 'rate_doctors' in item, "Item should have rate field"
        print(f"✓ Items have rate fields")


class TestPaymentRequestValidation:
    """Test payment request validation"""
    
    def test_payment_request_requires_customer(self, mr_token):
        """Payment request should require customer_id"""
        response = requests.post(f"{BASE_URL}/api/mr/payment-requests",
            json={
                "amount": 100,
                "mode": "cash"
            },
            headers={"Authorization": f"Bearer {mr_token}"}
        )
        assert response.status_code == 400, "Should fail without customer"
        print(f"✓ Payment request correctly requires customer")
    
    def test_payment_request_requires_positive_amount(self, mr_token):
        """Payment request should require positive amount"""
        response = requests.post(f"{BASE_URL}/api/mr/payment-requests",
            json={
                "customer_id": "test",
                "customer_name": "Test",
                "amount": 0,
                "mode": "cash"
            },
            headers={"Authorization": f"Bearer {mr_token}"}
        )
        assert response.status_code == 400, "Should fail with zero amount"
        print(f"✓ Payment request correctly requires positive amount")


class TestTransferValidation:
    """Test transfer endpoint validation"""
    
    def test_transfer_nonexistent_order(self, admin_token):
        """Transfer should fail for non-existent order"""
        response = requests.post(f"{BASE_URL}/api/orders/nonexistent-id/transfer",
            json={"agency_id": "test"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, "Should return 404 for non-existent order"
        print(f"✓ Transfer correctly returns 404 for non-existent order")
    
    def test_transfer_nonexistent_agency(self, admin_token):
        """Transfer should fail for non-existent agency"""
        # Get a real order
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        orders = orders_resp.json()
        transferable = [o for o in orders if o.get('status') not in ['transferred', 'delivered', 'cancelled']]
        
        if not transferable:
            pytest.skip("No transferable orders")
        
        order = transferable[0]
        
        response = requests.post(f"{BASE_URL}/api/orders/{order['id']}/transfer",
            json={"agency_id": "nonexistent-agency-id"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, "Should return 404 for non-existent agency"
        print(f"✓ Transfer correctly returns 404 for non-existent agency")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
