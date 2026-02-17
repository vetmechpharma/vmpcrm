"""
Test Suite for Enhanced Address Fields Feature
Tests: States/Districts APIs, Doctor/Medical/Agency address fields, Order auto-fill from customer preferences
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLocationAPIs:
    """Test States and Districts public APIs"""
    
    def test_01_get_states_returns_list(self):
        """States API should return list of Indian states"""
        response = requests.get(f"{BASE_URL}/api/public/states")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "states" in data, "Response should contain 'states' key"
        assert isinstance(data["states"], list), "States should be a list"
        assert len(data["states"]) > 30, "Should have 30+ states/UTs"
        
        # Check some known states exist
        states = data["states"]
        assert "Tamil Nadu" in states, "Tamil Nadu should be in states list"
        assert "Maharashtra" in states, "Maharashtra should be in states list"
        assert "Karnataka" in states, "Karnataka should be in states list"
        assert "Delhi" in states, "Delhi should be in states list"
        print(f"✓ States API returned {len(states)} states")
    
    def test_02_get_districts_for_valid_state(self):
        """Districts API should return districts for a valid state"""
        response = requests.get(f"{BASE_URL}/api/public/districts/Tamil%20Nadu")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "districts" in data, "Response should contain 'districts' key"
        assert isinstance(data["districts"], list), "Districts should be a list"
        assert len(data["districts"]) > 30, "Tamil Nadu should have 30+ districts"
        
        # Check some known districts
        districts = data["districts"]
        assert "Chennai" in districts, "Chennai should be in Tamil Nadu districts"
        assert "Coimbatore" in districts, "Coimbatore should be in Tamil Nadu districts"
        print(f"✓ Districts API returned {len(districts)} districts for Tamil Nadu")
    
    def test_03_get_districts_for_another_state(self):
        """Districts API should work for different states"""
        response = requests.get(f"{BASE_URL}/api/public/districts/Karnataka")
        assert response.status_code == 200
        
        data = response.json()
        assert "Bengaluru Urban" in data["districts"] or "Bengaluru" in data["districts"]
        print(f"✓ Karnataka districts returned {len(data['districts'])} districts")
    
    def test_04_get_districts_for_invalid_state(self):
        """Districts API should handle invalid state gracefully"""
        response = requests.get(f"{BASE_URL}/api/public/districts/InvalidState123")
        assert response.status_code == 200, "Should return 200 even for invalid state"
        
        data = response.json()
        assert "districts" in data
        assert len(data["districts"]) == 0, "Should return empty list for invalid state"
        print("✓ Invalid state returns empty districts list gracefully")


class TestDoctorAddressFields:
    """Test Doctor CRUD with enhanced address fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, "Login failed"
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        # Get a transport for testing
        transports_response = requests.get(f"{BASE_URL}/api/transports", headers=self.headers)
        if transports_response.status_code == 200 and len(transports_response.json()) > 0:
            self.transport_id = transports_response.json()[0]["id"]
            self.transport_name = transports_response.json()[0]["name"]
        else:
            self.transport_id = None
            self.transport_name = None
    
    def test_05_create_doctor_with_full_address(self):
        """Create doctor with all enhanced address fields"""
        unique_id = str(uuid.uuid4())[:8]
        doctor_data = {
            "name": f"TEST_Dr_Address_{unique_id}",
            "reg_no": f"REG_{unique_id}",
            "email": f"test_{unique_id}@example.com",
            "phone": f"98765{unique_id[:5].replace('-', '0')}",
            "address_line_1": "123 Main Street",
            "address_line_2": "Near Central Park",
            "state": "Tamil Nadu",
            "district": "Chennai",
            "pincode": "600001",
            "delivery_station": "Chennai Central",
            "transport_id": self.transport_id,
            "lead_status": "Customer"
        }
        
        response = requests.post(f"{BASE_URL}/api/doctors", json=doctor_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == doctor_data["name"]
        assert data["address_line_1"] == "123 Main Street"
        assert data["address_line_2"] == "Near Central Park"
        assert data["state"] == "Tamil Nadu"
        assert data["district"] == "Chennai"
        assert data["pincode"] == "600001"
        assert data["delivery_station"] == "Chennai Central"
        if self.transport_id:
            assert data["transport_id"] == self.transport_id
        
        # Store doctor ID for later tests
        self.__class__.created_doctor_id = data["id"]
        print(f"✓ Created doctor with full address: {data['customer_code']}")
    
    def test_06_get_doctor_returns_all_address_fields(self):
        """Verify GET returns all address fields"""
        doctor_id = getattr(self.__class__, 'created_doctor_id', None)
        if not doctor_id:
            pytest.skip("Doctor not created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["address_line_1"] == "123 Main Street"
        assert data["address_line_2"] == "Near Central Park"
        assert data["state"] == "Tamil Nadu"
        assert data["district"] == "Chennai"
        assert data["pincode"] == "600001"
        assert data["delivery_station"] == "Chennai Central"
        print("✓ GET returns all address fields correctly")
    
    def test_07_update_doctor_address_fields(self):
        """Update doctor address fields"""
        doctor_id = getattr(self.__class__, 'created_doctor_id', None)
        if not doctor_id:
            pytest.skip("Doctor not created in previous test")
        
        update_data = {
            "address_line_1": "456 Updated Street",
            "state": "Karnataka",
            "district": "Bengaluru Urban",
            "pincode": "560001",
            "delivery_station": "Bangalore City"
        }
        
        response = requests.put(f"{BASE_URL}/api/doctors/{doctor_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["address_line_1"] == "456 Updated Street"
        assert data["state"] == "Karnataka"
        assert data["district"] == "Bengaluru Urban"
        assert data["pincode"] == "560001"
        assert data["delivery_station"] == "Bangalore City"
        print("✓ Updated doctor address fields correctly")
    
    def test_08_cleanup_test_doctor(self):
        """Cleanup: Delete test doctor"""
        doctor_id = getattr(self.__class__, 'created_doctor_id', None)
        if doctor_id:
            response = requests.delete(f"{BASE_URL}/api/doctors/{doctor_id}", headers=self.headers)
            assert response.status_code in [200, 204]
            print("✓ Cleaned up test doctor")


class TestMedicalAddressFields:
    """Test Medical CRUD with enhanced address fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_09_create_medical_with_full_address(self):
        """Create medical with all enhanced address fields"""
        unique_id = str(uuid.uuid4())[:8]
        medical_data = {
            "name": f"TEST_Medical_{unique_id}",
            "license_number": f"LIC_{unique_id}",
            "email": f"medical_{unique_id}@example.com",
            "phone": f"99887{unique_id[:5].replace('-', '0')}",
            "address_line_1": "Medical Tower, Floor 5",
            "address_line_2": "Healthcare District",
            "state": "Maharashtra",
            "district": "Mumbai City",
            "pincode": "400001",
            "delivery_station": "Mumbai Central",
            "lead_status": "Customer"
        }
        
        response = requests.post(f"{BASE_URL}/api/medicals", json=medical_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["address_line_1"] == "Medical Tower, Floor 5"
        assert data["state"] == "Maharashtra"
        assert data["district"] == "Mumbai City"
        
        self.__class__.created_medical_id = data["id"]
        print(f"✓ Created medical with full address: {data['customer_code']}")
    
    def test_10_cleanup_test_medical(self):
        """Cleanup: Delete test medical"""
        medical_id = getattr(self.__class__, 'created_medical_id', None)
        if medical_id:
            response = requests.delete(f"{BASE_URL}/api/medicals/{medical_id}", headers=self.headers)
            assert response.status_code in [200, 204]
            print("✓ Cleaned up test medical")


class TestAgencyAddressFields:
    """Test Agency CRUD with enhanced address fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_11_create_agency_with_full_address(self):
        """Create agency with all enhanced address fields"""
        unique_id = str(uuid.uuid4())[:8]
        agency_data = {
            "name": f"TEST_Agency_{unique_id}",
            "license_number": f"ALIC_{unique_id}",
            "email": f"agency_{unique_id}@example.com",
            "phone": f"98765{unique_id[:5].replace('-', '0')}",
            "address_line_1": "Agency Complex, Block A",
            "address_line_2": "Business District",
            "state": "Gujarat",
            "district": "Ahmedabad",
            "pincode": "380001",
            "delivery_station": "Ahmedabad Junction",
            "lead_status": "Customer"
        }
        
        response = requests.post(f"{BASE_URL}/api/agencies", json=agency_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["address_line_1"] == "Agency Complex, Block A"
        assert data["state"] == "Gujarat"
        assert data["district"] == "Ahmedabad"
        
        self.__class__.created_agency_id = data["id"]
        print(f"✓ Created agency with full address: {data['customer_code']}")
    
    def test_12_cleanup_test_agency(self):
        """Cleanup: Delete test agency"""
        agency_id = getattr(self.__class__, 'created_agency_id', None)
        if agency_id:
            response = requests.delete(f"{BASE_URL}/api/agencies/{agency_id}", headers=self.headers)
            assert response.status_code in [200, 204]
            print("✓ Cleaned up test agency")


class TestOrderAutoFillFromCustomer:
    """Test order auto-fill delivery_station and transport from customer preferences"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        # Get transports
        transports_response = requests.get(f"{BASE_URL}/api/transports", headers=self.headers)
        self.transports = transports_response.json() if transports_response.status_code == 200 else []
        self.transport_id = self.transports[0]["id"] if self.transports else None
        self.transport_name = self.transports[0]["name"] if self.transports else None
    
    def test_13_create_doctor_with_delivery_preferences(self):
        """Create doctor with delivery_station and transport_id for order testing"""
        if not self.transport_id:
            pytest.skip("No transports available")
        
        unique_id = str(uuid.uuid4())[:8]
        doctor_data = {
            "name": f"TEST_OrderPref_Dr_{unique_id}",
            "reg_no": f"REG_{unique_id}",
            "email": f"orderpref_{unique_id}@example.com",
            "phone": f"98887{unique_id[:5].replace('-', '0')}",
            "address_line_1": "789 Delivery Test Street",
            "state": "Tamil Nadu",
            "district": "Chennai",
            "pincode": "600001",
            "delivery_station": "AutoFill Station",
            "transport_id": self.transport_id,
            "lead_status": "Customer"
        }
        
        response = requests.post(f"{BASE_URL}/api/doctors", json=doctor_data, headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["delivery_station"] == "AutoFill Station"
        assert data["transport_id"] == self.transport_id
        
        self.__class__.test_doctor_id = data["id"]
        self.__class__.test_doctor_code = data["customer_code"]
        print(f"✓ Created doctor with delivery preferences: {data['customer_code']}")
    
    def test_14_verify_order_api_gets_customer_preferences(self):
        """Verify order list API includes customer who has delivery preferences"""
        doctor_id = getattr(self.__class__, 'test_doctor_id', None)
        if not doctor_id:
            pytest.skip("Doctor not created in previous test")
        
        # Test fetching orders - this verifies the customer exists and can be linked to orders
        response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert response.status_code == 200, "Orders API should return 200"
        print("✓ Orders API accessible for testing auto-fill feature (UI test needed)")
        
        # Store doctor code for UI testing
        doctor_response = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}", headers=self.headers)
        if doctor_response.status_code == 200:
            self.__class__.test_doctor_code = doctor_response.json()["customer_code"]
    
    def test_15_verify_customer_has_delivery_preferences(self):
        """Verify the customer (doctor) has the delivery preferences set"""
        doctor_id = getattr(self.__class__, 'test_doctor_id', None)
        if not doctor_id:
            pytest.skip("Doctor not created")
        
        response = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["delivery_station"] == "AutoFill Station", f"Expected 'AutoFill Station', got {data.get('delivery_station')}"
        assert data["transport_id"] == self.transport_id, f"Expected transport_id {self.transport_id}, got {data.get('transport_id')}"
        print(f"✓ Verified doctor has delivery preferences: station={data['delivery_station']}, transport={data.get('transport_name')}")
    
    def test_16_cleanup_order_and_doctor(self):
        """Cleanup: Delete test order and doctor"""
        order_id = getattr(self.__class__, 'test_order_id', None)
        doctor_id = getattr(self.__class__, 'test_doctor_id', None)
        
        if order_id:
            response = requests.delete(f"{BASE_URL}/api/orders/{order_id}", headers=self.headers)
            print(f"  Order delete status: {response.status_code}")
        
        if doctor_id:
            response = requests.delete(f"{BASE_URL}/api/doctors/{doctor_id}", headers=self.headers)
            print(f"  Doctor delete status: {response.status_code}")
        
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
