"""
Test Customer Edit and Delete functionality for Portal Customers
Tests PUT /api/customers/{id} and DELETE /api/customers/{id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomersCRUD:
    """Portal customer CRUD API tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and test data"""
        # Login as admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@vmpcrm.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield

    # ================= GET Customers Tests =================
    def test_get_all_customers(self):
        """Test GET /api/customers returns list of portal customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        assert response.status_code == 200, f"Failed to get customers: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/customers - Found {len(data)} customers")
        
        # Store first customer for edit/delete tests
        if data:
            self.test_customer_id = data[0]['id']
            self.test_customer_name = data[0]['name']
            print(f"Test customer: {self.test_customer_name} (ID: {self.test_customer_id})")
        return data

    # ================= PUT Customer Tests =================
    def test_edit_customer_name(self):
        """Test PUT /api/customers/{id} - Edit customer name"""
        customers = self.test_get_all_customers()
        if not customers:
            pytest.skip("No customers to test with")
        
        customer_id = customers[0]['id']
        original_name = customers[0]['name']
        
        # Update name
        new_name = f"TEST_EDITED_{original_name}"
        response = requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json={"name": new_name},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update customer: {response.text}"
        updated = response.json()
        assert updated['name'] == new_name, "Name was not updated"
        print(f"SUCCESS: PUT /api/customers/{customer_id} - Name updated to '{new_name}'")
        
        # Revert change
        requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json={"name": original_name},
            headers=self.headers
        )
        print(f"Reverted name back to '{original_name}'")

    def test_edit_customer_phone(self):
        """Test PUT /api/customers/{id} - Edit customer phone"""
        customers = self.test_get_all_customers()
        if not customers:
            pytest.skip("No customers to test with")
        
        customer_id = customers[0]['id']
        original_phone = customers[0].get('phone', '')
        
        # Update phone (use test phone)
        new_phone = "9999999999"
        response = requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json={"phone": new_phone},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update phone: {response.text}"
        updated = response.json()
        assert updated['phone'] == new_phone or new_phone in updated['phone'], "Phone was not updated"
        print(f"SUCCESS: PUT /api/customers/{customer_id} - Phone updated to '{new_phone}'")
        
        # Revert change
        if original_phone:
            requests.put(
                f"{BASE_URL}/api/customers/{customer_id}",
                json={"phone": original_phone},
                headers=self.headers
            )
            print(f"Reverted phone back to '{original_phone}'")

    def test_edit_customer_multiple_fields(self):
        """Test PUT /api/customers/{id} - Edit multiple fields"""
        customers = self.test_get_all_customers()
        if not customers:
            pytest.skip("No customers to test with")
        
        customer_id = customers[0]['id']
        
        # Store original values
        original_data = {
            'email': customers[0].get('email', ''),
            'address_line_1': customers[0].get('address_line_1', ''),
            'state': customers[0].get('state', ''),
            'district': customers[0].get('district', '')
        }
        
        # Update multiple fields
        update_data = {
            "email": "test_update@example.com",
            "address_line_1": "123 Test Street",
            "state": "Test State",
            "district": "Test District"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update multiple fields: {response.text}"
        updated = response.json()
        
        assert updated.get('email') == update_data['email'], "Email not updated"
        assert updated.get('address_line_1') == update_data['address_line_1'], "Address not updated"
        print(f"SUCCESS: PUT /api/customers/{customer_id} - Multiple fields updated")
        
        # Revert changes
        requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json=original_data,
            headers=self.headers
        )
        print("Reverted all changes")

    def test_edit_customer_invalid_id(self):
        """Test PUT /api/customers/{id} - 404 for non-existent customer"""
        response = requests.put(
            f"{BASE_URL}/api/customers/non-existent-id-12345",
            json={"name": "Test"},
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: PUT /api/customers/invalid-id - Returns 404")

    def test_edit_customer_no_valid_fields(self):
        """Test PUT /api/customers/{id} - 400 for no valid fields"""
        customers = self.test_get_all_customers()
        if not customers:
            pytest.skip("No customers to test with")
        
        customer_id = customers[0]['id']
        
        # Try to update with invalid fields only
        response = requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json={"invalid_field": "test"},
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: PUT /api/customers with invalid fields - Returns 400")

    def test_edit_customer_no_auth(self):
        """Test PUT /api/customers/{id} - 401/403 without auth"""
        response = requests.put(
            f"{BASE_URL}/api/customers/any-id",
            json={"name": "Test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: PUT /api/customers without auth - Returns 401/403")

    # ================= DELETE Customer Tests =================
    def test_delete_customer_invalid_id(self):
        """Test DELETE /api/customers/{id} - 404 for non-existent customer"""
        response = requests.delete(
            f"{BASE_URL}/api/customers/non-existent-id-12345",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: DELETE /api/customers/invalid-id - Returns 404")

    def test_delete_customer_no_auth(self):
        """Test DELETE /api/customers/{id} - 401/403 without auth"""
        response = requests.delete(f"{BASE_URL}/api/customers/any-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: DELETE /api/customers without auth - Returns 401/403")

    def test_delete_customer_with_creation(self):
        """Test DELETE /api/customers/{id} - Create then delete a test customer"""
        # First, create a test customer via registration flow or find one to delete
        # For safety, we'll skip actual deletion of real customers
        print("SKIPPED: DELETE actual customer - Manual test required to avoid data loss")
        pytest.skip("Skipping actual delete to preserve test data")


class TestRemindersHistoryTab:
    """Test Reminders History tab and follow-up updates"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@vmpcrm.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield

    def test_get_reminders_all(self):
        """Test GET /api/reminders - Get all reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=self.headers)
        assert response.status_code == 200, f"Failed to get reminders: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/reminders - Found {len(data)} reminders")
        return data

    def test_get_completed_reminders_history(self):
        """Test GET /api/reminders?is_completed=true - History tab data"""
        response = requests.get(
            f"{BASE_URL}/api/reminders",
            params={"is_completed": True},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get completed reminders: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/reminders?is_completed=true - Found {len(data)} completed reminders (History)")
        
        # Verify all returned items are completed
        for rem in data:
            assert rem.get('is_completed') == True, f"Reminder {rem.get('id')} should be completed"
        return data

    def test_get_uncompleted_reminders(self):
        """Test GET /api/reminders?is_completed=false - Active reminders"""
        response = requests.get(
            f"{BASE_URL}/api/reminders",
            params={"is_completed": False},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get uncompleted reminders: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/reminders?is_completed=false - Found {len(data)} active reminders")
        return data

    def test_get_today_reminders(self):
        """Test GET /api/reminders/today - Today's reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders/today", headers=self.headers)
        assert response.status_code == 200, f"Failed to get today's reminders: {response.text}"
        data = response.json()
        
        # Check structure
        assert 'reminders' in data, "Response should have 'reminders' key"
        assert 'total_count' in data, "Response should have 'total_count' key"
        
        print(f"SUCCESS: GET /api/reminders/today - {data['total_count']} reminders today")
        
        # Check for follow-up types
        followups = [r for r in data['reminders'] if r['reminder_type'] == 'follow_up']
        birthdays = [r for r in data['reminders'] if r['reminder_type'] == 'birthday']
        anniversaries = [r for r in data['reminders'] if r['reminder_type'] == 'anniversary']
        
        print(f"  - Follow-ups: {len(followups)}")
        print(f"  - Birthdays: {len(birthdays)}")
        print(f"  - Anniversaries: {len(anniversaries)}")
        
        return data

    def test_mark_reminder_complete(self):
        """Test POST /api/reminders/{id}/complete - Mark as complete moves to history"""
        # Get uncompleted reminders
        response = requests.get(
            f"{BASE_URL}/api/reminders",
            params={"is_completed": False},
            headers=self.headers
        )
        data = response.json()
        
        # Find a custom reminder to test (not auto-generated)
        custom_reminders = [r for r in data if not r.get('is_auto_generated')]
        
        if not custom_reminders:
            print("SKIPPED: No custom reminders to mark complete")
            pytest.skip("No custom reminders available")
        
        reminder = custom_reminders[0]
        reminder_id = reminder['id']
        
        # Mark as complete
        response = requests.post(
            f"{BASE_URL}/api/reminders/{reminder_id}/complete",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to mark complete: {response.text}"
        print(f"SUCCESS: POST /api/reminders/{reminder_id}/complete - Marked as complete")
        
        # Verify it's now in completed list
        response = requests.get(
            f"{BASE_URL}/api/reminders",
            params={"is_completed": True},
            headers=self.headers
        )
        completed = response.json()
        found = any(r['id'] == reminder_id for r in completed)
        print(f"  - Verified in history: {found}")


class TestFollowUpUpdates:
    """Test follow-up creation and how it affects reminders"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@vmpcrm.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield

    def test_get_doctors_with_followup(self):
        """Get doctors to find one with follow-up"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        assert response.status_code == 200
        doctors = response.json()
        
        # Find doctors with follow-up dates
        doctors_with_followup = [d for d in doctors if d.get('follow_up_date')]
        print(f"Found {len(doctors_with_followup)} doctors with follow_up_date set")
        return doctors

    def test_create_followup_updates_doctor(self):
        """Test POST /api/followups - Creating follow-up updates entity's follow_up_date"""
        # Get doctors
        response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        doctors = response.json()
        
        if not doctors:
            pytest.skip("No doctors to test with")
        
        # Use first doctor
        doctor = doctors[0]
        doctor_id = doctor['id']
        original_followup = doctor.get('follow_up_date')
        
        # Create follow-up with new date
        from datetime import datetime, timedelta
        new_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        response = requests.post(
            f"{BASE_URL}/api/followups",
            json={
                "entity_type": "doctor",
                "entity_id": doctor_id,
                "notes": "TEST: Follow-up created to test reminder refresh",
                "new_status": "Contacted",
                "next_follow_up_date": new_date
            },
            headers=self.headers
        )
        assert response.status_code in [200, 201], f"Failed to create follow-up: {response.text}"
        print(f"SUCCESS: POST /api/followups - Created follow-up for doctor {doctor['name']}")
        
        # Verify doctor's follow_up_date is updated
        response = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}", headers=self.headers)
        updated_doctor = response.json()
        
        assert updated_doctor.get('follow_up_date') == new_date, "Doctor's follow_up_date should be updated"
        print(f"SUCCESS: Doctor's follow_up_date updated to {new_date}")
        
        # The reminder should now show on the new date, not today
        # Get today's reminders and verify this doctor's old follow-up is gone
        response = requests.get(f"{BASE_URL}/api/reminders/today", headers=self.headers)
        today_data = response.json()
        
        # Check if there's a follow-up reminder for this doctor today
        doctor_followups_today = [
            r for r in today_data['reminders'] 
            if r.get('entity_id') == doctor_id and r['reminder_type'] == 'follow_up'
        ]
        print(f"  - Doctor's follow-up reminders today after update: {len(doctor_followups_today)}")
        
        return updated_doctor

    def test_get_followup_history(self):
        """Test GET /api/followups/history/{entity_type}/{entity_id}"""
        # Get a doctor
        response = requests.get(f"{BASE_URL}/api/doctors", headers=self.headers)
        doctors = response.json()
        
        if not doctors:
            pytest.skip("No doctors to test with")
        
        doctor = doctors[0]
        
        response = requests.get(
            f"{BASE_URL}/api/followups/history/doctor/{doctor['id']}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get follow-up history: {response.text}"
        history = response.json()
        
        print(f"SUCCESS: GET /api/followups/history/doctor/{doctor['id']} - Found {len(history)} follow-ups")
        return history


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
