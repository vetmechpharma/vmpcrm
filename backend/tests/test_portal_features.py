"""
Tests for Portal Customer Enhancements:
1. Duplicate mobile number check during customer registration
2. Portal Customer approval modal with full registration data
3. Send New Password functionality for approved customers
4. Send Portal Access button in Doctors/Medicals/Agencies pages
"""

import pytest
import requests
import os
import uuid
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDuplicateMobileCheck:
    """Test duplicate mobile number check during customer registration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin operations"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_duplicate_check_with_approved_portal_customer(self):
        """Test that registration is blocked for phone already approved in portal_customers"""
        # Get an existing approved customer
        customers_response = requests.get(f"{BASE_URL}/api/customers", 
                                          headers=self.headers,
                                          params={"status": "approved"})
        if customers_response.status_code == 200 and customers_response.json():
            existing_customer = customers_response.json()[0]
            phone = existing_customer.get('phone')
            
            # Try to send OTP for registration with same phone
            otp_response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
                "phone": phone,
                "purpose": "register"
            })
            
            # Should get error about phone already registered
            assert otp_response.status_code == 400, f"Expected 400 but got {otp_response.status_code}"
            response_data = otp_response.json()
            assert "already registered" in response_data.get("detail", "").lower() or "login instead" in response_data.get("detail", "").lower()
            print(f"PASS: Duplicate check blocked registration for approved phone: {phone}")
        else:
            pytest.skip("No approved customers found to test duplicate check")
    
    def test_duplicate_check_with_doctor_phone(self):
        """Test that registration is blocked for phone already in doctors collection"""
        # Get an existing doctor
        doctors_response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        if doctors_response.status_code == 200 and doctors_response.json():
            # Find a doctor without portal_customer_id (not already a portal customer)
            for doctor in doctors_response.json():
                if not doctor.get('is_portal_customer'):
                    phone = doctor.get('phone')
                    
                    # Try to send OTP for registration with same phone
                    otp_response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
                        "phone": phone,
                        "purpose": "register"
                    })
                    
                    # Should get error about phone registered as Doctor
                    assert otp_response.status_code == 400, f"Expected 400 but got {otp_response.status_code}"
                    response_data = otp_response.json()
                    assert "doctor" in response_data.get("detail", "").lower() or "already registered" in response_data.get("detail", "").lower()
                    print(f"PASS: Duplicate check blocked registration for doctor phone: {phone}")
                    return
            pytest.skip("No doctors without portal access found to test")
        else:
            pytest.skip("No doctors found to test duplicate check")
    
    def test_duplicate_check_with_medical_phone(self):
        """Test that registration is blocked for phone already in medicals collection"""
        medicals_response = requests.get(f"{BASE_URL}/api/medicals", headers=self.headers)
        if medicals_response.status_code == 200 and medicals_response.json():
            for medical in medicals_response.json():
                if not medical.get('is_portal_customer'):
                    phone = medical.get('phone')
                    
                    otp_response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
                        "phone": phone,
                        "purpose": "register"
                    })
                    
                    assert otp_response.status_code == 400, f"Expected 400 but got {otp_response.status_code}"
                    response_data = otp_response.json()
                    assert "medical" in response_data.get("detail", "").lower() or "already registered" in response_data.get("detail", "").lower()
                    print(f"PASS: Duplicate check blocked registration for medical phone: {phone}")
                    return
            pytest.skip("No medicals without portal access found to test")
        else:
            pytest.skip("No medicals found to test duplicate check")
    
    def test_duplicate_check_with_agency_phone(self):
        """Test that registration is blocked for phone already in agencies collection"""
        agencies_response = requests.get(f"{BASE_URL}/api/agencies", headers=self.headers)
        if agencies_response.status_code == 200 and agencies_response.json():
            for agency in agencies_response.json():
                if not agency.get('is_portal_customer'):
                    phone = agency.get('phone')
                    
                    otp_response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
                        "phone": phone,
                        "purpose": "register"
                    })
                    
                    assert otp_response.status_code == 400, f"Expected 400 but got {otp_response.status_code}"
                    response_data = otp_response.json()
                    assert "agency" in response_data.get("detail", "").lower() or "already registered" in response_data.get("detail", "").lower()
                    print(f"PASS: Duplicate check blocked registration for agency phone: {phone}")
                    return
            pytest.skip("No agencies without portal access found to test")
        else:
            pytest.skip("No agencies found to test duplicate check")
    
    def test_new_phone_can_register(self):
        """Test that a completely new phone number can send OTP for registration"""
        # Use a random phone number that shouldn't exist
        new_phone = f"99{random.randint(10000000, 99999999)}"
        
        otp_response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": new_phone,
            "purpose": "register"
        })
        
        # Should succeed (OTP sent)
        assert otp_response.status_code == 200, f"Expected 200 but got {otp_response.status_code}: {otp_response.text}"
        print(f"PASS: New phone number can send OTP: {new_phone}")


class TestSendNewPassword:
    """Test Send New Password functionality for portal customers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin operations"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_send_new_password_to_approved_customer(self):
        """Test sending new password to an approved portal customer"""
        # Get an approved customer
        customers_response = requests.get(f"{BASE_URL}/api/customers", 
                                          headers=self.headers,
                                          params={"status": "approved"})
        
        if customers_response.status_code == 200 and customers_response.json():
            customer = customers_response.json()[0]
            customer_id = customer.get('id')
            
            # Send new password
            response = requests.post(f"{BASE_URL}/api/customers/{customer_id}/send-new-password",
                                    headers=self.headers)
            
            assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
            response_data = response.json()
            
            # Should have either password_sent=True or password returned for manual sharing
            assert "password_sent" in response_data or "password" in response_data
            print(f"PASS: Send new password to approved customer: {customer.get('name')}")
            print(f"Response: {response_data}")
        else:
            pytest.skip("No approved customers found to test")
    
    def test_send_new_password_to_doctor(self):
        """Test sending portal access to an admin-created doctor"""
        doctors_response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        
        if doctors_response.status_code == 200 and doctors_response.json():
            doctor = doctors_response.json()[0]
            doctor_id = doctor.get('id')
            
            # Send portal access
            response = requests.post(f"{BASE_URL}/api/customers/{doctor_id}/send-new-password",
                                    headers=self.headers)
            
            assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
            response_data = response.json()
            
            assert "password_sent" in response_data or "password" in response_data
            print(f"PASS: Send portal access to doctor: {doctor.get('name')}")
            print(f"Response: {response_data}")
        else:
            pytest.skip("No doctors found to test")
    
    def test_send_new_password_to_medical(self):
        """Test sending portal access to an admin-created medical"""
        medicals_response = requests.get(f"{BASE_URL}/api/medicals", headers=self.headers)
        
        if medicals_response.status_code == 200 and medicals_response.json():
            medical = medicals_response.json()[0]
            medical_id = medical.get('id')
            
            response = requests.post(f"{BASE_URL}/api/customers/{medical_id}/send-new-password",
                                    headers=self.headers)
            
            assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
            response_data = response.json()
            
            assert "password_sent" in response_data or "password" in response_data
            print(f"PASS: Send portal access to medical: {medical.get('name')}")
        else:
            pytest.skip("No medicals found to test")
    
    def test_send_new_password_to_agency(self):
        """Test sending portal access to an admin-created agency"""
        agencies_response = requests.get(f"{BASE_URL}/api/agencies", headers=self.headers)
        
        if agencies_response.status_code == 200 and agencies_response.json():
            agency = agencies_response.json()[0]
            agency_id = agency.get('id')
            
            response = requests.post(f"{BASE_URL}/api/customers/{agency_id}/send-new-password",
                                    headers=self.headers)
            
            assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
            response_data = response.json()
            
            assert "password_sent" in response_data or "password" in response_data
            print(f"PASS: Send portal access to agency: {agency.get('name')}")
        else:
            pytest.skip("No agencies found to test")
    
    def test_send_new_password_invalid_id(self):
        """Test sending password to non-existent customer returns 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.post(f"{BASE_URL}/api/customers/{fake_id}/send-new-password",
                                headers=self.headers)
        
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}"
        print("PASS: Non-existent customer returns 404")
    
    def test_send_new_password_unauthorized(self):
        """Test that endpoint requires authentication"""
        fake_id = str(uuid.uuid4())
        
        response = requests.post(f"{BASE_URL}/api/customers/{fake_id}/send-new-password")
        
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print("PASS: Endpoint requires authentication")


class TestPortalCustomerDetails:
    """Test Portal Customer API returns full registration data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin operations"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_get_customers_returns_list(self):
        """Test GET /api/customers returns list of portal customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        
        assert response.status_code == 200
        customers = response.json()
        assert isinstance(customers, list)
        print(f"PASS: GET /api/customers returns {len(customers)} customers")
    
    def test_customer_has_full_details(self):
        """Test that customer data includes all registration fields"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        
        if response.status_code == 200 and response.json():
            customer = response.json()[0]
            
            # Check common fields exist
            required_fields = ['id', 'name', 'phone', 'role', 'status', 'customer_code']
            for field in required_fields:
                assert field in customer, f"Missing required field: {field}"
            
            # Check optional detailed fields
            optional_fields = ['email', 'alternate_phone', 'reg_no', 'dob', 'proprietor_name', 
                             'gst_number', 'drug_license', 'birthday', 'anniversary',
                             'address_line_1', 'address_line_2', 'state', 'district', 
                             'pincode', 'delivery_station']
            
            available_fields = [f for f in optional_fields if f in customer]
            print(f"PASS: Customer has {len(available_fields)} optional detail fields: {available_fields}")
            print(f"Customer data: {customer.get('name')}, role: {customer.get('role')}, status: {customer.get('status')}")
        else:
            pytest.skip("No customers found to verify details")
    
    def test_filter_by_status(self):
        """Test filtering customers by status"""
        for status in ['pending', 'approved', 'rejected']:
            response = requests.get(f"{BASE_URL}/api/customers", 
                                   headers=self.headers, 
                                   params={"status": status})
            
            assert response.status_code == 200
            customers = response.json()
            if customers:
                # All returned customers should have the filtered status
                for customer in customers:
                    assert customer.get('status') == status or customer.get('status') == f'pending_approval'
            print(f"PASS: Filter by status={status} returned {len(customers)} customers")
    
    def test_filter_by_role(self):
        """Test filtering customers by role"""
        for role in ['doctor', 'medical', 'agency']:
            response = requests.get(f"{BASE_URL}/api/customers", 
                                   headers=self.headers, 
                                   params={"role": role})
            
            assert response.status_code == 200
            customers = response.json()
            if customers:
                for customer in customers:
                    assert customer.get('role') == role
            print(f"PASS: Filter by role={role} returned {len(customers)} customers")
    
    def test_customer_approval_updates_status(self):
        """Test that approving a customer updates their status"""
        # Get a pending customer
        response = requests.get(f"{BASE_URL}/api/customers", 
                               headers=self.headers, 
                               params={"status": "pending"})
        
        if response.status_code == 200 and response.json():
            customer = response.json()[0]
            customer_id = customer.get('id')
            
            # Approve the customer
            approve_response = requests.put(f"{BASE_URL}/api/customers/{customer_id}/approve",
                                           headers=self.headers,
                                           json={"status": "approved"})
            
            assert approve_response.status_code == 200
            
            # Verify status changed
            verify_response = requests.get(f"{BASE_URL}/api/customers", 
                                          headers=self.headers,
                                          params={"status": "approved"})
            approved_customers = verify_response.json()
            approved_ids = [c.get('id') for c in approved_customers]
            
            assert customer_id in approved_ids, "Customer not found in approved list after approval"
            print(f"PASS: Customer {customer.get('name')} approved successfully")
        else:
            pytest.skip("No pending customers found to test approval")


class TestDoctorsMedicalsAgenciesListWithPortalFlag:
    """Test that Doctors/Medicals/Agencies list shows portal customer flag"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin operations"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_doctors_list_has_portal_flag(self):
        """Test doctors list includes is_portal_customer and portal_customer_id fields"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        
        assert response.status_code == 200
        doctors = response.json()
        
        if doctors:
            doctor = doctors[0]
            assert 'is_portal_customer' in doctor, "Doctor missing is_portal_customer field"
            print(f"PASS: Doctors list has is_portal_customer field. First doctor: {doctor.get('name')}, portal: {doctor.get('is_portal_customer')}")
        else:
            pytest.skip("No doctors found")
    
    def test_medicals_list_has_portal_flag(self):
        """Test medicals list includes is_portal_customer field"""
        response = requests.get(f"{BASE_URL}/api/medicals", headers=self.headers)
        
        assert response.status_code == 200
        medicals = response.json()
        
        if medicals:
            medical = medicals[0]
            assert 'is_portal_customer' in medical, "Medical missing is_portal_customer field"
            print(f"PASS: Medicals list has is_portal_customer field. First medical: {medical.get('name')}, portal: {medical.get('is_portal_customer')}")
        else:
            pytest.skip("No medicals found")
    
    def test_agencies_list_has_portal_flag(self):
        """Test agencies list includes is_portal_customer field"""
        response = requests.get(f"{BASE_URL}/api/agencies", headers=self.headers)
        
        assert response.status_code == 200
        agencies = response.json()
        
        if agencies:
            agency = agencies[0]
            assert 'is_portal_customer' in agency, "Agency missing is_portal_customer field"
            print(f"PASS: Agencies list has is_portal_customer field. First agency: {agency.get('name')}, portal: {agency.get('is_portal_customer')}")
        else:
            pytest.skip("No agencies found")
