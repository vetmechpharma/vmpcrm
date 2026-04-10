"""
Test Customer Ledger Feature - Iteration 63
Tests for:
- Customer search across doctors/medicals/agencies
- GET /api/ledger/{type}/{id} - returns entries with orders, payments, sales_return types with ref_id
- PUT /api/customer-opening-balance/{type}/{id} - updates opening balance
- Date range filtering
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module-level session and token to avoid rate limiting
_session = None
_token = None

def get_authenticated_session():
    """Get or create authenticated session"""
    global _session, _token
    
    if _session is None or _token is None:
        _session = requests.Session()
        _session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = _session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "info@vetmech.in",
            "password": "Kongu@@44884"
        })
        
        if login_response.status_code == 429:
            # Rate limited, wait and retry
            time.sleep(60)
            login_response = _session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "info@vetmech.in",
                "password": "Kongu@@44884"
            })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        _token = login_response.json().get("access_token")  # Note: field is access_token, not token
        _session.headers.update({"Authorization": f"Bearer {_token}"})
        print(f"✓ Admin login successful, token obtained")
    
    return _session


class TestCustomerLedger:
    """Customer Ledger API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get authenticated session"""
        self.session = get_authenticated_session()
    
    def test_01_search_doctors(self):
        """Test searching doctors"""
        response = self.session.get(f"{BASE_URL}/api/doctors", params={"search": "Test"})
        assert response.status_code == 200, f"Doctor search failed: {response.text}"
        data = response.json()
        print(f"✓ Doctor search returned {len(data)} results")
    
    def test_02_search_medicals(self):
        """Test searching medicals"""
        response = self.session.get(f"{BASE_URL}/api/medicals", params={"search": "Test"})
        assert response.status_code == 200, f"Medical search failed: {response.text}"
        data = response.json()
        print(f"✓ Medical search returned {len(data)} results")
    
    def test_03_search_agencies(self):
        """Test searching agencies"""
        response = self.session.get(f"{BASE_URL}/api/agencies", params={"search": "Test"})
        assert response.status_code == 200, f"Agency search failed: {response.text}"
        data = response.json()
        print(f"✓ Agency search returned {len(data)} results")
    
    def test_04_get_all_doctors_for_ledger(self):
        """Get all doctors to find one for ledger testing"""
        response = self.session.get(f"{BASE_URL}/api/doctors")
        assert response.status_code == 200, f"Get doctors failed: {response.text}"
        doctors = response.json()
        assert len(doctors) > 0, "No doctors found in database"
        print(f"✓ Found {len(doctors)} doctors, first: {doctors[0].get('name')}")
    
    def test_05_get_ledger_for_doctor(self):
        """Test GET /api/ledger/doctor/{id} - returns ledger with entries"""
        # First get a doctor
        doctors_response = self.session.get(f"{BASE_URL}/api/doctors")
        assert doctors_response.status_code == 200
        doctors = doctors_response.json()
        assert len(doctors) > 0, "No doctors found"
        
        doctor = doctors[0]
        doctor_id = doctor.get('id')
        
        # Get ledger
        response = self.session.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}")
        assert response.status_code == 200, f"Get ledger failed: {response.text}"
        
        ledger = response.json()
        
        # Validate ledger structure
        assert 'customer' in ledger, "Ledger missing 'customer' field"
        assert 'entries' in ledger, "Ledger missing 'entries' field"
        assert 'total_debit' in ledger, "Ledger missing 'total_debit' field"
        assert 'total_credit' in ledger, "Ledger missing 'total_credit' field"
        assert 'closing_balance' in ledger, "Ledger missing 'closing_balance' field"
        
        # Validate customer info
        customer = ledger['customer']
        assert 'id' in customer, "Customer missing 'id'"
        assert 'name' in customer, "Customer missing 'name'"
        assert 'opening_balance' in customer, "Customer missing 'opening_balance'"
        
        # Check entries have required fields
        for entry in ledger['entries']:
            assert 'type' in entry, "Entry missing 'type'"
            assert 'description' in entry, "Entry missing 'description'"
            assert 'debit' in entry, "Entry missing 'debit'"
            assert 'credit' in entry, "Entry missing 'credit'"
            assert 'balance' in entry, "Entry missing 'balance'"
            # ref_id should be present for non-opening_balance entries
            if entry['type'] != 'opening_balance':
                assert 'ref_id' in entry, f"Entry type '{entry['type']}' missing 'ref_id'"
        
        print(f"✓ Ledger for {customer['name']}: {len(ledger['entries'])} entries, closing balance: {ledger['closing_balance']}")
    
    def test_06_get_ledger_with_date_filter(self):
        """Test ledger with date range filter"""
        # Get a doctor
        doctors_response = self.session.get(f"{BASE_URL}/api/doctors")
        doctors = doctors_response.json()
        doctor_id = doctors[0].get('id')
        
        # Get ledger with date filter
        response = self.session.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}", params={
            "from_date": "2024-01-01",
            "to_date": "2026-12-31"
        })
        assert response.status_code == 200, f"Get ledger with date filter failed: {response.text}"
        
        ledger = response.json()
        print(f"✓ Ledger with date filter: {len(ledger['entries'])} entries")
    
    def test_07_update_opening_balance(self):
        """Test PUT /api/customer-opening-balance/doctor/{id}"""
        # Get a doctor
        doctors_response = self.session.get(f"{BASE_URL}/api/doctors")
        doctors = doctors_response.json()
        doctor = doctors[0]
        doctor_id = doctor.get('id')
        
        # Get current opening balance
        ledger_before = self.session.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}").json()
        old_ob = ledger_before['customer'].get('opening_balance', 0)
        
        # Update opening balance
        new_ob = 5000.50
        response = self.session.put(
            f"{BASE_URL}/api/customer-opening-balance/doctor/{doctor_id}",
            json={"opening_balance": new_ob}
        )
        assert response.status_code == 200, f"Update opening balance failed: {response.text}"
        
        result = response.json()
        assert 'opening_balance' in result, "Response missing 'opening_balance'"
        assert result['opening_balance'] == new_ob, f"Opening balance not updated correctly"
        
        # Verify by getting ledger again
        ledger_after = self.session.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}").json()
        assert ledger_after['customer']['opening_balance'] == new_ob, "Opening balance not persisted"
        
        # Restore original opening balance
        self.session.put(
            f"{BASE_URL}/api/customer-opening-balance/doctor/{doctor_id}",
            json={"opening_balance": old_ob}
        )
        
        print(f"✓ Opening balance updated from {old_ob} to {new_ob} and restored")
    
    def test_08_ledger_entry_types(self):
        """Test that ledger returns correct entry types"""
        # Get a doctor
        doctors_response = self.session.get(f"{BASE_URL}/api/doctors")
        doctors = doctors_response.json()
        doctor_id = doctors[0].get('id')
        
        # Get ledger
        response = self.session.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}")
        ledger = response.json()
        
        # Check entry types
        entry_types = set(e['type'] for e in ledger['entries'])
        valid_types = {'opening_balance', 'invoice', 'order', 'payment', 'sales_return'}
        
        for etype in entry_types:
            assert etype in valid_types, f"Invalid entry type: {etype}"
        
        print(f"✓ Entry types found: {entry_types}")
    
    def test_09_ledger_running_balance(self):
        """Test that running balance is calculated correctly"""
        # Get a doctor
        doctors_response = self.session.get(f"{BASE_URL}/api/doctors")
        doctors = doctors_response.json()
        doctor_id = doctors[0].get('id')
        
        # Get ledger
        response = self.session.get(f"{BASE_URL}/api/ledger/doctor/{doctor_id}")
        ledger = response.json()
        
        # Verify running balance calculation
        running_balance = 0
        for entry in ledger['entries']:
            running_balance += entry['debit'] - entry['credit']
            assert abs(entry['balance'] - running_balance) < 0.01, f"Running balance mismatch at entry: {entry['description']}"
        
        # Verify closing balance matches last entry balance
        if ledger['entries']:
            assert abs(ledger['closing_balance'] - ledger['entries'][-1]['balance']) < 0.01, "Closing balance doesn't match last entry"
        
        print(f"✓ Running balance calculation verified")
    
    def test_10_ledger_for_medical(self):
        """Test ledger for medical customer type"""
        # Get a medical
        medicals_response = self.session.get(f"{BASE_URL}/api/medicals")
        if medicals_response.status_code != 200:
            pytest.skip("No medicals endpoint")
        
        medicals = medicals_response.json()
        if not medicals:
            pytest.skip("No medicals in database")
        
        medical_id = medicals[0].get('id')
        
        # Get ledger
        response = self.session.get(f"{BASE_URL}/api/ledger/medical/{medical_id}")
        assert response.status_code == 200, f"Get medical ledger failed: {response.text}"
        
        ledger = response.json()
        assert ledger['customer']['type'] == 'medical', "Customer type should be 'medical'"
        
        print(f"✓ Medical ledger: {len(ledger['entries'])} entries")
    
    def test_11_ledger_for_agency(self):
        """Test ledger for agency customer type"""
        # Get an agency
        agencies_response = self.session.get(f"{BASE_URL}/api/agencies")
        if agencies_response.status_code != 200:
            pytest.skip("No agencies endpoint")
        
        agencies = agencies_response.json()
        if not agencies:
            pytest.skip("No agencies in database")
        
        agency_id = agencies[0].get('id')
        
        # Get ledger
        response = self.session.get(f"{BASE_URL}/api/ledger/agency/{agency_id}")
        assert response.status_code == 200, f"Get agency ledger failed: {response.text}"
        
        ledger = response.json()
        assert ledger['customer']['type'] == 'agency', "Customer type should be 'agency'"
        
        print(f"✓ Agency ledger: {len(ledger['entries'])} entries")
    
    def test_12_invalid_customer_type(self):
        """Test ledger with invalid customer type returns error"""
        response = self.session.get(f"{BASE_URL}/api/ledger/invalid_type/some_id")
        assert response.status_code in [400, 404], f"Should return error for invalid type: {response.status_code}"
        print(f"✓ Invalid customer type returns {response.status_code}")
    
    def test_13_nonexistent_customer(self):
        """Test ledger for non-existent customer returns 404"""
        response = self.session.get(f"{BASE_URL}/api/ledger/doctor/nonexistent_id_12345")
        assert response.status_code == 404, f"Should return 404 for non-existent customer: {response.status_code}"
        print(f"✓ Non-existent customer returns 404")
    
    def test_14_outstanding_api(self):
        """Test GET /api/outstanding returns customer outstanding amounts"""
        response = self.session.get(f"{BASE_URL}/api/outstanding")
        assert response.status_code == 200, f"Get outstanding failed: {response.text}"
        
        outstanding = response.json()
        assert isinstance(outstanding, list), "Outstanding should be a list"
        
        # Check structure if there are results
        if outstanding:
            item = outstanding[0]
            assert 'customer_id' in item, "Missing customer_id"
            assert 'customer_name' in item, "Missing customer_name"
            assert 'customer_type' in item, "Missing customer_type"
            assert 'outstanding' in item, "Missing outstanding"
        
        print(f"✓ Outstanding API: {len(outstanding)} customers with outstanding")
    
    def test_15_outstanding_filter_by_type(self):
        """Test outstanding API with customer type filter"""
        response = self.session.get(f"{BASE_URL}/api/outstanding", params={"customer_type": "doctor"})
        assert response.status_code == 200, f"Get outstanding with filter failed: {response.text}"
        
        outstanding = response.json()
        for item in outstanding:
            assert item['customer_type'] == 'doctor', f"Filter not working: got {item['customer_type']}"
        
        print(f"✓ Outstanding filter by type: {len(outstanding)} doctors")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
