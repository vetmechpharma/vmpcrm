"""
Test suite for Ledger and WhatsApp features
- Outstanding balance display
- WhatsApp ledger sharing endpoint
- Reminders page APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOutstandingAPI:
    """Tests for outstanding balance API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_outstanding_all(self):
        """Test GET /api/outstanding returns all customer types"""
        response = requests.get(f"{BASE_URL}/api/outstanding", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check data structure for items
        if len(data) > 0:
            item = data[0]
            assert "customer_id" in item
            assert "customer_name" in item
            assert "customer_type" in item
            assert "outstanding" in item
            assert "opening_balance" in item
            assert "total_invoiced" in item
            assert "total_paid" in item
            print(f"Found {len(data)} customers with outstanding balances")
    
    def test_get_outstanding_doctor_type(self):
        """Test GET /api/outstanding?customer_type=doctor"""
        response = requests.get(f"{BASE_URL}/api/outstanding?customer_type=doctor", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All items should be doctors
        for item in data:
            assert item["customer_type"] == "doctor"
        print(f"Found {len(data)} doctors with outstanding balances")
    
    def test_get_outstanding_medical_type(self):
        """Test GET /api/outstanding?customer_type=medical"""
        response = requests.get(f"{BASE_URL}/api/outstanding?customer_type=medical", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for item in data:
            assert item["customer_type"] == "medical"
        print(f"Found {len(data)} medicals with outstanding balances")
    
    def test_get_outstanding_agency_type(self):
        """Test GET /api/outstanding?customer_type=agency"""
        response = requests.get(f"{BASE_URL}/api/outstanding?customer_type=agency", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for item in data:
            assert item["customer_type"] == "agency"
        print(f"Found {len(data)} agencies with outstanding balances")


class TestLedgerAPI:
    """Tests for ledger APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_ledger_for_doctor(self):
        """Test GET /api/ledger/doctor/{id} - get ledger for a doctor"""
        # First get a doctor with outstanding
        outstanding_resp = requests.get(f"{BASE_URL}/api/outstanding?customer_type=doctor", headers=self.headers)
        if outstanding_resp.status_code == 200 and len(outstanding_resp.json()) > 0:
            doctor = outstanding_resp.json()[0]
            doctor_id = doctor["customer_id"]
            
            response = requests.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}", headers=self.headers)
            assert response.status_code == 200
            data = response.json()
            
            # Validate ledger structure
            assert "customer" in data
            assert "entries" in data
            assert "total_debit" in data
            assert "total_credit" in data
            assert "closing_balance" in data
            
            print(f"Ledger for {data['customer']['name']}: Balance = {data['closing_balance']}")
        else:
            pytest.skip("No doctors with outstanding balance found")
    
    def test_whatsapp_ledger_endpoint_exists(self):
        """Test POST /api/ledger/{type}/{id}/whatsapp endpoint exists"""
        # Get a doctor with outstanding to test WhatsApp endpoint
        outstanding_resp = requests.get(f"{BASE_URL}/api/outstanding?customer_type=doctor", headers=self.headers)
        if outstanding_resp.status_code == 200 and len(outstanding_resp.json()) > 0:
            doctor = outstanding_resp.json()[0]
            doctor_id = doctor["customer_id"]
            
            # Test the endpoint - it may fail due to WhatsApp config but should return proper error
            response = requests.post(f"{BASE_URL}/api/ledger/doctor/{doctor_id}/whatsapp", headers=self.headers)
            
            # Endpoint should exist (not 404) - may be 400 if WhatsApp not configured
            assert response.status_code != 404, "WhatsApp ledger endpoint should exist"
            print(f"WhatsApp ledger endpoint returned status: {response.status_code}")
            
            if response.status_code == 400:
                # Expected if WhatsApp not configured
                data = response.json()
                assert "detail" in data
                print(f"WhatsApp error (expected): {data.get('detail')}")
            elif response.status_code == 200:
                # Successfully sent (WhatsApp configured)
                data = response.json()
                assert "message" in data
                print(f"WhatsApp sent: {data.get('message')}")
        else:
            pytest.skip("No doctors with outstanding balance found")


class TestRemindersAPI:
    """Tests for Reminders page APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_reminders_today(self):
        """Test GET /api/reminders/today - Today's reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders/today", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "reminders" in data
        assert "total_count" in data
        print(f"Today's reminders: {data['total_count']}")
    
    def test_get_reminders_all(self):
        """Test GET /api/reminders - All reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total reminders: {len(data)}")
    
    def test_get_reminders_incomplete(self):
        """Test GET /api/reminders?is_completed=false - Incomplete reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders?is_completed=false", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Incomplete reminders: {len(data)}")
    
    def test_create_reminder(self):
        """Test POST /api/reminders - Create a reminder"""
        reminder_data = {
            "title": "TEST_Reminder_for_testing",
            "description": "This is a test reminder",
            "reminder_type": "custom",
            "reminder_date": "2026-03-20",
            "priority": "moderate"
        }
        
        response = requests.post(f"{BASE_URL}/api/reminders", json=reminder_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["title"] == reminder_data["title"]
        
        reminder_id = data["id"]
        print(f"Created reminder: {reminder_id}")
        
        # Clean up - delete the test reminder
        delete_response = requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print("Test reminder deleted successfully")


class TestDoctorsWithOutstanding:
    """Tests to verify doctors page can show outstanding"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_doctors(self):
        """Test GET /api/doctors - Doctors list"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total doctors: {len(data)}")
    
    def test_doctor_dr_dhivahar_outstanding(self):
        """Test DR.DHIVAHAR has expected outstanding amount"""
        # Get outstanding for doctors
        outstanding_resp = requests.get(f"{BASE_URL}/api/outstanding?customer_type=doctor", headers=self.headers)
        assert outstanding_resp.status_code == 200
        
        doctors = outstanding_resp.json()
        dr_dhivahar = next((d for d in doctors if "DHIVAHAR" in d["customer_name"].upper()), None)
        
        if dr_dhivahar:
            assert dr_dhivahar["outstanding"] > 0, "DR.DHIVAHAR should have outstanding balance"
            print(f"DR.DHIVAHAR outstanding: ₹{dr_dhivahar['outstanding']}")
        else:
            print("DR.DHIVAHAR not in outstanding list (may have 0 balance)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
