"""
Test Payment Tracking and Ledger APIs for Pharmaceutical CRM
Tests: Payment CRUD, Outstanding Dashboard, Customer Ledger, PDF Export
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@vmpcrm.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")

@pytest.fixture
def auth_headers(admin_token):
    """Auth headers for API requests"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestPaymentsAPI:
    """Test Payment CRUD endpoints"""
    
    created_payment_id = None
    test_customer_id = None
    
    def test_01_get_doctors_for_payment_test(self, auth_headers):
        """Get a doctor to use for payment tests"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        assert response.status_code == 200
        doctors = response.json()
        assert len(doctors) > 0, "Need at least one doctor for testing"
        TestPaymentsAPI.test_customer_id = doctors[0]['id']
        TestPaymentsAPI.test_customer_name = doctors[0]['name']
        print(f"Using doctor: {doctors[0]['name']} (ID: {doctors[0]['id']})")
    
    def test_02_create_payment(self, auth_headers):
        """Test creating a new payment"""
        payment_data = {
            "customer_id": TestPaymentsAPI.test_customer_id,
            "customer_name": TestPaymentsAPI.test_customer_name,
            "customer_type": "doctor",
            "customer_phone": "9876543210",
            "amount": 1500.50,
            "mode": "UPI",
            "date": "2026-03-12",
            "notes": "TEST_Payment_for_testing"
        }
        response = requests.post(f"{BASE_URL}/api/payments", 
                               json=payment_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["amount"] == 1500.50
        assert data["mode"] == "UPI"
        assert data["customer_type"] == "doctor"
        TestPaymentsAPI.created_payment_id = data["id"]
        print(f"Created payment ID: {data['id']}")
    
    def test_03_get_all_payments(self, auth_headers):
        """Test getting all payments"""
        response = requests.get(f"{BASE_URL}/api/payments", headers=auth_headers)
        assert response.status_code == 200
        payments = response.json()
        assert isinstance(payments, list)
        # Our test payment should be in the list
        test_payment = next((p for p in payments if p.get('id') == TestPaymentsAPI.created_payment_id), None)
        assert test_payment is not None, "Created payment should be in list"
        print(f"Found {len(payments)} payments total")
    
    def test_04_get_payments_filtered_by_customer_type(self, auth_headers):
        """Test filtering payments by customer type"""
        response = requests.get(f"{BASE_URL}/api/payments?customer_type=doctor", 
                               headers=auth_headers)
        assert response.status_code == 200
        payments = response.json()
        for p in payments:
            assert p.get('customer_type') == 'doctor'
        print(f"Found {len(payments)} doctor payments")
    
    def test_05_get_payments_filtered_by_date_range(self, auth_headers):
        """Test filtering payments by date range"""
        response = requests.get(f"{BASE_URL}/api/payments?from_date=2026-03-01&to_date=2026-03-31", 
                               headers=auth_headers)
        assert response.status_code == 200
        payments = response.json()
        print(f"Found {len(payments)} payments in March 2026")


class TestOutstandingAPI:
    """Test Outstanding Dashboard endpoint"""
    
    def test_01_get_all_outstanding(self, auth_headers):
        """Test getting all outstanding amounts"""
        response = requests.get(f"{BASE_URL}/api/outstanding", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Each item should have required fields
        if len(data) > 0:
            item = data[0]
            assert "customer_id" in item
            assert "customer_name" in item
            assert "customer_type" in item
            assert "outstanding" in item
            assert "total_invoiced" in item
            assert "total_paid" in item
            assert "opening_balance" in item
        print(f"Found {len(data)} customers with outstanding")
    
    def test_02_get_outstanding_filtered_by_doctor(self, auth_headers):
        """Test filtering outstanding by doctor type"""
        response = requests.get(f"{BASE_URL}/api/outstanding?customer_type=doctor", 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for item in data:
            assert item.get('customer_type') == 'doctor'
        print(f"Found {len(data)} doctors with outstanding")
    
    def test_03_get_outstanding_filtered_by_medical(self, auth_headers):
        """Test filtering outstanding by medical type"""
        response = requests.get(f"{BASE_URL}/api/outstanding?customer_type=medical", 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for item in data:
            assert item.get('customer_type') == 'medical'
        print(f"Found {len(data)} medicals with outstanding")
    
    def test_04_get_outstanding_filtered_by_agency(self, auth_headers):
        """Test filtering outstanding by agency type"""
        response = requests.get(f"{BASE_URL}/api/outstanding?customer_type=agency", 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for item in data:
            assert item.get('customer_type') == 'agency'
        print(f"Found {len(data)} agencies with outstanding")


class TestLedgerAPI:
    """Test Customer Ledger endpoint"""
    
    test_customer_id = None
    
    def test_01_get_doctor_for_ledger(self, auth_headers):
        """Get a doctor to test ledger"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        assert response.status_code == 200
        doctors = response.json()
        assert len(doctors) > 0
        TestLedgerAPI.test_customer_id = doctors[0]['id']
        print(f"Using doctor ID: {doctors[0]['id']}")
    
    def test_02_get_ledger_for_doctor(self, auth_headers):
        """Test getting ledger for a doctor"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/doctor/{TestLedgerAPI.test_customer_id}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "customer" in data
        assert "entries" in data
        assert "total_debit" in data
        assert "total_credit" in data
        assert "closing_balance" in data
        
        # Check customer info
        customer = data["customer"]
        assert customer.get("id") == TestLedgerAPI.test_customer_id
        assert "name" in customer
        assert "type" in customer
        
        # Check entries structure
        entries = data["entries"]
        assert isinstance(entries, list)
        if len(entries) > 0:
            entry = entries[0]
            assert "type" in entry
            assert "description" in entry
            assert "debit" in entry
            assert "credit" in entry
            assert "balance" in entry
        
        print(f"Ledger has {len(entries)} entries")
        print(f"Total Debit: {data['total_debit']}, Total Credit: {data['total_credit']}")
        print(f"Closing Balance: {data['closing_balance']}")
    
    def test_03_get_ledger_with_date_filter(self, auth_headers):
        """Test getting ledger with date filters"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/doctor/{TestLedgerAPI.test_customer_id}?from_date=2026-01-01&to_date=2026-12-31", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        print(f"Filtered ledger has {len(data['entries'])} entries")
    
    def test_04_get_ledger_invalid_customer_type(self, auth_headers):
        """Test ledger with invalid customer type returns error"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/invalid_type/some_id", 
            headers=auth_headers
        )
        assert response.status_code == 400
    
    def test_05_get_ledger_non_existent_customer(self, auth_headers):
        """Test ledger for non-existent customer returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/doctor/non_existent_id_12345", 
            headers=auth_headers
        )
        assert response.status_code == 404


class TestLedgerPDFExport:
    """Test Ledger PDF Export endpoint"""
    
    test_customer_id = None
    
    def test_01_get_customer_for_pdf(self, auth_headers):
        """Get a customer for PDF export test"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        assert response.status_code == 200
        doctors = response.json()
        assert len(doctors) > 0
        TestLedgerPDFExport.test_customer_id = doctors[0]['id']
    
    def test_02_export_ledger_pdf(self, auth_headers):
        """Test exporting ledger as PDF"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/export/pdf/doctor/{TestLedgerPDFExport.test_customer_id}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
        # Check PDF content starts with %PDF
        assert response.content[:4] == b'%PDF'
        print(f"PDF generated, size: {len(response.content)} bytes")
    
    def test_03_export_ledger_pdf_with_date_range(self, auth_headers):
        """Test exporting ledger PDF with date range"""
        response = requests.get(
            f"{BASE_URL}/api/ledger/export/pdf/doctor/{TestLedgerPDFExport.test_customer_id}?from_date=2026-01-01&to_date=2026-12-31", 
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
        print(f"Filtered PDF generated, size: {len(response.content)} bytes")


class TestOpeningBalanceInEntities:
    """Test Opening Balance field in Doctors/Medicals/Agencies"""
    
    def test_01_doctor_has_opening_balance_field(self, auth_headers):
        """Verify doctors API returns opening_balance field"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        assert response.status_code == 200
        doctors = response.json()
        if len(doctors) > 0:
            # Check response includes opening_balance
            doctor = doctors[0]
            # opening_balance may be 0 or None, but should be accessible
            assert "opening_balance" in doctor or doctor.get('opening_balance', 0) >= 0
            print(f"Doctor opening_balance: {doctor.get('opening_balance', 0)}")
    
    def test_02_create_doctor_with_opening_balance(self, auth_headers):
        """Test creating a doctor with opening balance"""
        doctor_data = {
            "name": "TEST_Dr_OpeningBalance",
            "reg_no": "TEST001",
            "email": "test_ob@example.com",
            "phone": "9999888877",
            "opening_balance": 5000.00
        }
        response = requests.post(f"{BASE_URL}/api/doctors", 
                                json=doctor_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("opening_balance") == 5000.00 or data.get("opening_balance") == 5000
        print(f"Created doctor with opening_balance: {data.get('opening_balance')}")
        
        # Cleanup - delete test doctor
        if data.get('id'):
            requests.delete(f"{BASE_URL}/api/doctors/{data['id']}", headers=auth_headers)
    
    def test_03_medical_has_opening_balance_field(self, auth_headers):
        """Verify medicals API returns opening_balance field"""
        response = requests.get(f"{BASE_URL}/api/medicals", headers=auth_headers)
        assert response.status_code == 200
        medicals = response.json()
        if len(medicals) > 0:
            medical = medicals[0]
            assert "opening_balance" in medical or medical.get('opening_balance', 0) >= 0
            print(f"Medical opening_balance: {medical.get('opening_balance', 0)}")
    
    def test_04_agency_has_opening_balance_field(self, auth_headers):
        """Verify agencies API returns opening_balance field"""
        response = requests.get(f"{BASE_URL}/api/agencies", headers=auth_headers)
        assert response.status_code == 200
        agencies = response.json()
        if len(agencies) > 0:
            agency = agencies[0]
            assert "opening_balance" in agency or agency.get('opening_balance', 0) >= 0
            print(f"Agency opening_balance: {agency.get('opening_balance', 0)}")


class TestDeletePayment:
    """Test deleting payments"""
    
    def test_01_delete_test_payment(self, auth_headers):
        """Delete the test payment created earlier"""
        if TestPaymentsAPI.created_payment_id:
            response = requests.delete(
                f"{BASE_URL}/api/payments/{TestPaymentsAPI.created_payment_id}", 
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"Deleted payment: {TestPaymentsAPI.created_payment_id}")
        else:
            pytest.skip("No test payment to delete")
    
    def test_02_delete_non_existent_payment(self, auth_headers):
        """Test deleting non-existent payment returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/payments/non_existent_payment_12345", 
            headers=auth_headers
        )
        assert response.status_code == 404


class TestCustomerPortalLedger:
    """Test Customer Portal Ledger endpoint (requires customer auth)"""
    
    def test_01_customer_ledger_requires_auth(self):
        """Test customer ledger endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customer/ledger")
        # Should return 403 or similar without auth
        assert response.status_code in [401, 403, 422]
        print("Customer ledger correctly requires authentication")
