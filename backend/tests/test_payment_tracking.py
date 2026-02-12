"""
Test Payment Tracking in Order Shipping
Features to test:
1. Payment Mode dropdown shows To Pay and Paid options
2. When Paid is selected - Amount field, Paid By field, From Account dropdown
3. When To Pay is selected - Amount field only (stored for reference)
4. Payment amount shows in orders table
5. Payment amount shows in order details
6. When order shipped with Paid mode - expense auto-created in Transport/Shipping category
7. Expense includes correct amount, paid_by, and account info
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")


class TestPaymentTrackingAPI:
    """Test payment tracking in orders and auto expense creation"""
    
    auth_token = None
    test_order_id = None
    test_expense_id = None
    transport_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        """Setup - get auth token and ensure transport exists"""
        TestPaymentTrackingAPI.auth_token = auth_token
        
        # Get or create test transport
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = api_client.get(f"{BASE_URL}/api/transports", headers=headers)
        transports = response.json()
        
        if transports:
            TestPaymentTrackingAPI.transport_id = transports[0]['id']
        else:
            # Create a test transport
            create_resp = api_client.post(f"{BASE_URL}/api/transports", 
                headers=headers,
                json={"name": "TEST_Transport_Payment", "is_local": False})
            if create_resp.status_code == 200:
                TestPaymentTrackingAPI.transport_id = create_resp.json()['id']
    
    # Test 1: Create order for payment tracking test
    def test_01_create_order_for_payment_test(self, authenticated_client):
        """Create a test order to use for payment tracking tests"""
        order_data = {
            "customer_name": "TEST_Payment_Customer",
            "customer_phone": "9486544884",
            "customer_email": "test@payment.com",
            "customer_address": "Test Address",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item-1",
                    "item_code": "TEST-001",
                    "item_name": "Test Item for Payment",
                    "quantity": "5",
                    "mrp": 100.0,
                    "rate": 80.0
                }
            ]
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        data = response.json()
        TestPaymentTrackingAPI.test_order_id = data['id']
        
        assert 'id' in data
        assert 'order_number' in data
        print(f"Created test order: {data['order_number']} (ID: {data['id']})")
    
    # Test 2: Update to Ready to Despatch with "To Pay" payment mode
    def test_02_update_to_ready_with_to_pay_mode(self, authenticated_client):
        """Test updating order to ready_to_despatch with To Pay payment mode"""
        if not TestPaymentTrackingAPI.test_order_id:
            pytest.skip("No test order created")
        
        update_data = {
            "status": "ready_to_despatch",
            "transport_id": TestPaymentTrackingAPI.transport_id,
            "transport_name": "TEST_Transport",
            "delivery_station": "Test Station",
            "payment_mode": "to_pay",
            "payment_amount": 250.00,
            "boxes_count": 1
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/orders/{TestPaymentTrackingAPI.test_order_id}/status",
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed to update order: {response.text}"
        
        # Verify order has payment_mode and payment_amount
        order_resp = authenticated_client.get(f"{BASE_URL}/api/orders")
        orders = order_resp.json()
        test_order = next((o for o in orders if o['id'] == TestPaymentTrackingAPI.test_order_id), None)
        
        assert test_order is not None
        assert test_order['payment_mode'] == 'to_pay', f"Expected payment_mode='to_pay', got {test_order.get('payment_mode')}"
        assert test_order['payment_amount'] == 250.00, f"Expected payment_amount=250.00, got {test_order.get('payment_amount')}"
        
        print(f"Order updated with To Pay mode, amount: ₹{test_order['payment_amount']}")
    
    # Test 3: Create second order for Paid mode test
    def test_03_create_order_for_paid_mode(self, authenticated_client):
        """Create second order for testing Paid mode with expense creation"""
        order_data = {
            "customer_name": "TEST_Paid_Customer",
            "customer_phone": "9342704047",
            "customer_email": "paid@test.com",
            "customer_address": "Paid Test Address",
            "customer_type": "doctor",
            "items": [
                {
                    "item_id": "test-item-2",
                    "item_code": "TEST-002",
                    "item_name": "Test Item for Paid Mode",
                    "quantity": "10",
                    "mrp": 200.0,
                    "rate": 150.0
                }
            ]
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        # Store as second order for paid mode tests
        self.__class__.paid_order_id = data['id']
        self.__class__.paid_order_number = data['order_number']
        print(f"Created paid mode test order: {data['order_number']}")
    
    # Test 4: Update order to Ready to Despatch with "Paid" payment mode
    def test_04_update_to_ready_with_paid_mode(self, authenticated_client):
        """Test updating order with Paid mode - includes expense details"""
        paid_order_id = getattr(self.__class__, 'paid_order_id', None)
        if not paid_order_id:
            pytest.skip("No paid order created")
        
        update_data = {
            "status": "ready_to_despatch",
            "transport_id": TestPaymentTrackingAPI.transport_id,
            "transport_name": "Blue Dart",
            "delivery_station": "Mumbai Central",
            "payment_mode": "paid",
            "payment_amount": 500.00,
            "expense_paid_by": "John Admin",
            "expense_account": "company_account",
            "boxes_count": 2,
            "invoice_number": "INV-TEST-001",
            "invoice_date": datetime.now().strftime('%Y-%m-%d'),
            "invoice_value": 1500.00
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/orders/{paid_order_id}/status",
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify order has correct payment info
        order_resp = authenticated_client.get(f"{BASE_URL}/api/orders")
        orders = order_resp.json()
        test_order = next((o for o in orders if o['id'] == paid_order_id), None)
        
        assert test_order is not None
        assert test_order['payment_mode'] == 'paid', f"Expected 'paid', got {test_order.get('payment_mode')}"
        assert test_order['payment_amount'] == 500.00, f"Expected 500.00, got {test_order.get('payment_amount')}"
        assert test_order.get('expense_paid_by') == 'John Admin'
        assert test_order.get('expense_account') == 'company_account'
        
        print(f"Order updated with Paid mode - Amount: ₹500, Paid By: John Admin")
    
    # Test 5: Ship the Paid order and verify expense is auto-created
    def test_05_ship_order_creates_expense(self, authenticated_client):
        """Test that shipping a Paid order auto-creates expense entry"""
        paid_order_id = getattr(self.__class__, 'paid_order_id', None)
        paid_order_number = getattr(self.__class__, 'paid_order_number', None)
        if not paid_order_id:
            pytest.skip("No paid order created")
        
        # Ship the order
        ship_data = {
            "status": "shipped",
            "tracking_number": "TRACK12345"
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/orders/{paid_order_id}/status",
            json=ship_data
        )
        
        assert response.status_code == 200, f"Failed to ship: {response.text}"
        print(f"Order shipped with tracking: TRACK12345")
        
        # Check expenses for auto-created entry
        expenses_resp = authenticated_client.get(f"{BASE_URL}/api/expenses")
        assert expenses_resp.status_code == 200
        
        expenses = expenses_resp.json()
        
        # Find expense for this order
        auto_expense = None
        for exp in expenses:
            if exp.get('order_id') == paid_order_id and exp.get('is_auto_generated'):
                auto_expense = exp
                break
        
        assert auto_expense is not None, f"No auto-generated expense found for order {paid_order_number}"
        
        # Verify expense details
        assert auto_expense['amount'] == 500.00, f"Expected expense amount 500.00, got {auto_expense.get('amount')}"
        assert auto_expense['paid_by'] == 'John Admin', f"Expected paid_by 'John Admin', got {auto_expense.get('paid_by')}"
        assert auto_expense['payment_account'] == 'company_account'
        assert auto_expense['category_name'] == 'Transport/Shipping', f"Expected Transport/Shipping category, got {auto_expense.get('category_name')}"
        assert paid_order_number in auto_expense.get('reason', ''), f"Order number not in expense reason"
        
        TestPaymentTrackingAPI.test_expense_id = auto_expense['id']
        print(f"Auto-created expense verified - Amount: ₹{auto_expense['amount']}, Category: {auto_expense['category_name']}")
    
    # Test 6: Verify expense has correct transport details
    def test_06_expense_has_transport_details(self, authenticated_client):
        """Verify expense includes transport name and location"""
        if not TestPaymentTrackingAPI.test_expense_id:
            pytest.skip("No expense created")
        
        expenses_resp = authenticated_client.get(f"{BASE_URL}/api/expenses")
        expenses = expenses_resp.json()
        
        expense = next((e for e in expenses if e['id'] == TestPaymentTrackingAPI.test_expense_id), None)
        
        assert expense is not None
        assert expense.get('transport_name') == 'Blue Dart', f"Expected transport_name 'Blue Dart', got {expense.get('transport_name')}"
        assert expense.get('transport_location') == 'Mumbai Central'
        
        print(f"Expense transport details verified - {expense['transport_name']} at {expense['transport_location']}")
    
    # Test 7: Test To Pay order shipping does NOT create expense
    def test_07_to_pay_does_not_create_expense(self, authenticated_client):
        """Verify that To Pay orders do not auto-create expenses"""
        if not TestPaymentTrackingAPI.test_order_id:
            pytest.skip("No test order")
        
        # Get expenses count before shipping
        expenses_resp = authenticated_client.get(f"{BASE_URL}/api/expenses")
        initial_expenses = [e for e in expenses_resp.json() if e.get('order_id') == TestPaymentTrackingAPI.test_order_id]
        initial_count = len(initial_expenses)
        
        # Ship the To Pay order
        ship_data = {
            "status": "shipped",
            "tracking_number": "TOPAY12345"
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/orders/{TestPaymentTrackingAPI.test_order_id}/status",
            json=ship_data
        )
        
        assert response.status_code == 200
        
        # Check no new expense was created
        expenses_resp = authenticated_client.get(f"{BASE_URL}/api/expenses")
        final_expenses = [e for e in expenses_resp.json() if e.get('order_id') == TestPaymentTrackingAPI.test_order_id]
        final_count = len(final_expenses)
        
        assert final_count == initial_count, f"Expense was created for To Pay order! Before: {initial_count}, After: {final_count}"
        print("Verified: To Pay order does not create auto expense")
    
    # Test 8: Verify payment amount in order response
    def test_08_payment_amount_in_order_response(self, authenticated_client):
        """Verify payment_amount is returned in order GET response"""
        response = authenticated_client.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        
        orders = response.json()
        paid_order_id = getattr(self.__class__, 'paid_order_id', None)
        
        if paid_order_id:
            paid_order = next((o for o in orders if o['id'] == paid_order_id), None)
            assert paid_order is not None
            assert 'payment_amount' in paid_order, "payment_amount field missing in order response"
            assert paid_order['payment_amount'] == 500.00
            print(f"Payment amount in order response: ₹{paid_order['payment_amount']}")
        
        to_pay_order = next((o for o in orders if o['id'] == TestPaymentTrackingAPI.test_order_id), None)
        if to_pay_order:
            assert 'payment_amount' in to_pay_order
            assert to_pay_order['payment_amount'] == 250.00
            print(f"To Pay amount in order response: ₹{to_pay_order['payment_amount']}")
    
    # Test 9: Test expense account variations
    def test_09_expense_account_variations(self, authenticated_client):
        """Test different expense account values"""
        # Create order for testing
        order_data = {
            "customer_name": "TEST_Account_Variations",
            "customer_phone": "9944472488",
            "customer_email": "account@test.com",
            "customer_type": "doctor",
            "items": [{"item_id": "test-3", "item_code": "TEST-003", "item_name": "Account Test", "quantity": "1", "mrp": 50, "rate": 40}]
        }
        
        resp = authenticated_client.post(f"{BASE_URL}/api/orders", json=order_data)
        assert resp.status_code == 200
        order_id = resp.json()['id']
        
        # Update with cash account
        update_data = {
            "status": "ready_to_despatch",
            "transport_id": TestPaymentTrackingAPI.transport_id,
            "transport_name": "Local Transport",
            "payment_mode": "paid",
            "payment_amount": 100.00,
            "expense_paid_by": "Cash Tester",
            "expense_account": "cash"
        }
        
        resp = authenticated_client.put(f"{BASE_URL}/api/orders/{order_id}/status", json=update_data)
        assert resp.status_code == 200
        
        # Ship to trigger expense creation
        ship_resp = authenticated_client.put(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "shipped", "tracking_number": "CASH123"})
        assert ship_resp.status_code == 200
        
        # Verify expense has cash payment type
        expenses_resp = authenticated_client.get(f"{BASE_URL}/api/expenses")
        expenses = expenses_resp.json()
        
        cash_expense = next((e for e in expenses if e.get('order_id') == order_id), None)
        assert cash_expense is not None
        assert cash_expense['payment_account'] == 'cash'
        assert cash_expense['payment_type'] == 'cash'
        
        print(f"Cash expense verified - payment_type: {cash_expense['payment_type']}, payment_account: {cash_expense['payment_account']}")


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@vmpcrm.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.text}")


@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client
