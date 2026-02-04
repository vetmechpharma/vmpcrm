"""
Backend API tests for Reminders System
Tests: CRUD operations, today's reminders, mark complete, delete
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRemindersAPI:
    """Test Reminders API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store today's date for tests
        self.today = datetime.now().strftime('%Y-%m-%d')
        self.tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # ============== GET /api/reminders/today ==============
    
    def test_get_today_reminders_returns_200(self):
        """GET /api/reminders/today should return 200"""
        response = self.session.get(f"{BASE_URL}/api/reminders/today")
        assert response.status_code == 200
        data = response.json()
        assert 'date' in data
        assert 'total_count' in data
        assert 'reminders' in data
        assert isinstance(data['reminders'], list)
        print(f"SUCCESS: GET /api/reminders/today - {data['total_count']} reminders")
    
    def test_today_reminders_structure(self):
        """Today's reminders should have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/reminders/today")
        assert response.status_code == 200
        data = response.json()
        
        if data['reminders']:
            reminder = data['reminders'][0]
            assert 'id' in reminder
            assert 'title' in reminder
            assert 'reminder_type' in reminder
            assert 'reminder_date' in reminder
            assert 'priority' in reminder
            assert 'is_completed' in reminder
            assert 'is_auto_generated' in reminder
            print(f"SUCCESS: Reminder structure validated - {reminder['title']}")
    
    # ============== POST /api/reminders ==============
    
    def test_create_reminder_follow_up(self):
        """POST /api/reminders - create follow-up reminder"""
        payload = {
            "title": "TEST_Follow-up Call",
            "description": "Test follow-up reminder",
            "reminder_type": "follow_up",
            "reminder_date": self.today,
            "priority": "high"
        }
        response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['title'] == payload['title']
        assert data['reminder_type'] == 'follow_up'
        assert data['priority'] == 'high'
        assert data['is_completed'] == False
        assert data['is_auto_generated'] == False
        assert 'id' in data
        
        # Store for cleanup
        self.created_reminder_id = data['id']
        print(f"SUCCESS: Created follow-up reminder - ID: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
    
    def test_create_reminder_birthday(self):
        """POST /api/reminders - create birthday reminder"""
        payload = {
            "title": "TEST_Birthday Reminder",
            "description": "Test birthday",
            "reminder_type": "birthday",
            "reminder_date": self.tomorrow,
            "priority": "moderate"
        }
        response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['reminder_type'] == 'birthday'
        print(f"SUCCESS: Created birthday reminder - ID: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
    
    def test_create_reminder_anniversary(self):
        """POST /api/reminders - create anniversary reminder"""
        payload = {
            "title": "TEST_Anniversary Reminder",
            "reminder_type": "anniversary",
            "reminder_date": self.tomorrow,
            "priority": "low"
        }
        response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['reminder_type'] == 'anniversary'
        print(f"SUCCESS: Created anniversary reminder - ID: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
    
    def test_create_reminder_custom(self):
        """POST /api/reminders - create custom reminder"""
        payload = {
            "title": "TEST_Custom Reminder",
            "description": "Custom test reminder",
            "reminder_type": "custom",
            "reminder_date": self.today,
            "reminder_time": "14:30",
            "priority": "moderate"
        }
        response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['reminder_type'] == 'custom'
        assert data['reminder_time'] == '14:30'
        print(f"SUCCESS: Created custom reminder with time - ID: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
    
    def test_create_reminder_with_entity(self):
        """POST /api/reminders - create reminder linked to entity"""
        payload = {
            "title": "TEST_Entity Linked Reminder",
            "reminder_type": "follow_up",
            "reminder_date": self.today,
            "entity_type": "doctor",
            "entity_name": "Test Doctor",
            "priority": "high"
        }
        response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['entity_type'] == 'doctor'
        assert data['entity_name'] == 'Test Doctor'
        print(f"SUCCESS: Created entity-linked reminder - ID: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
    
    # ============== GET /api/reminders ==============
    
    def test_get_all_reminders(self):
        """GET /api/reminders - get all reminders"""
        response = self.session.get(f"{BASE_URL}/api/reminders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/reminders - {len(data)} reminders")
    
    def test_get_reminders_filter_incomplete(self):
        """GET /api/reminders?is_completed=false - filter incomplete"""
        response = self.session.get(f"{BASE_URL}/api/reminders", params={"is_completed": False})
        assert response.status_code == 200
        data = response.json()
        
        # All returned should be incomplete
        for rem in data:
            assert rem['is_completed'] == False
        print(f"SUCCESS: Filtered incomplete reminders - {len(data)} found")
    
    def test_get_reminders_filter_by_type(self):
        """GET /api/reminders?reminder_type=follow_up - filter by type"""
        # First create a follow-up reminder
        payload = {
            "title": "TEST_Filter Type Reminder",
            "reminder_type": "follow_up",
            "reminder_date": self.today,
            "priority": "moderate"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert create_resp.status_code == 200
        created_id = create_resp.json()['id']
        
        # Filter by type
        response = self.session.get(f"{BASE_URL}/api/reminders", params={"reminder_type": "follow_up"})
        assert response.status_code == 200
        data = response.json()
        
        # All returned should be follow_up type
        for rem in data:
            assert rem['reminder_type'] == 'follow_up'
        print(f"SUCCESS: Filtered by type - {len(data)} follow-up reminders")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{created_id}")
    
    # ============== POST /api/reminders/{id}/complete ==============
    
    def test_mark_reminder_complete(self):
        """POST /api/reminders/{id}/complete - mark as complete"""
        # Create a reminder first
        payload = {
            "title": "TEST_Complete Me",
            "reminder_type": "custom",
            "reminder_date": self.today,
            "priority": "low"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()['id']
        
        # Mark as complete
        complete_resp = self.session.post(f"{BASE_URL}/api/reminders/{reminder_id}/complete")
        assert complete_resp.status_code == 200
        assert complete_resp.json()['message'] == "Reminder marked as completed"
        
        # Verify it's marked complete
        get_resp = self.session.get(f"{BASE_URL}/api/reminders")
        reminders = get_resp.json()
        found = [r for r in reminders if r['id'] == reminder_id]
        if found:
            assert found[0]['is_completed'] == True
        
        print(f"SUCCESS: Marked reminder as complete - ID: {reminder_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
    
    def test_mark_nonexistent_reminder_complete(self):
        """POST /api/reminders/{id}/complete - 404 for nonexistent"""
        response = self.session.post(f"{BASE_URL}/api/reminders/nonexistent-id-12345/complete")
        assert response.status_code == 404
        print("SUCCESS: 404 returned for nonexistent reminder complete")
    
    # ============== DELETE /api/reminders/{id} ==============
    
    def test_delete_reminder(self):
        """DELETE /api/reminders/{id} - delete reminder"""
        # Create a reminder first
        payload = {
            "title": "TEST_Delete Me",
            "reminder_type": "custom",
            "reminder_date": self.tomorrow,
            "priority": "low"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()['id']
        
        # Delete it
        delete_resp = self.session.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json()['message'] == "Reminder deleted successfully"
        
        # Verify it's gone
        get_resp = self.session.get(f"{BASE_URL}/api/reminders")
        reminders = get_resp.json()
        found = [r for r in reminders if r['id'] == reminder_id]
        assert len(found) == 0
        
        print(f"SUCCESS: Deleted reminder - ID: {reminder_id}")
    
    def test_delete_nonexistent_reminder(self):
        """DELETE /api/reminders/{id} - 404 for nonexistent"""
        response = self.session.delete(f"{BASE_URL}/api/reminders/nonexistent-id-12345")
        assert response.status_code == 404
        print("SUCCESS: 404 returned for nonexistent reminder delete")
    
    # ============== PUT /api/reminders/{id} ==============
    
    def test_update_reminder(self):
        """PUT /api/reminders/{id} - update reminder"""
        # Create a reminder first
        payload = {
            "title": "TEST_Update Me",
            "reminder_type": "custom",
            "reminder_date": self.today,
            "priority": "low"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()['id']
        
        # Update it
        update_payload = {
            "title": "TEST_Updated Title",
            "priority": "high"
        }
        update_resp = self.session.put(f"{BASE_URL}/api/reminders/{reminder_id}", json=update_payload)
        assert update_resp.status_code == 200
        data = update_resp.json()
        
        assert data['title'] == "TEST_Updated Title"
        assert data['priority'] == "high"
        
        print(f"SUCCESS: Updated reminder - ID: {reminder_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
    
    # ============== Today's Reminders with Auto-Generated ==============
    
    def test_today_reminders_includes_manual(self):
        """Today's reminders should include manual reminders for today"""
        # Create a reminder for today
        payload = {
            "title": "TEST_Today Manual Reminder",
            "reminder_type": "custom",
            "reminder_date": self.today,
            "priority": "moderate"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()['id']
        
        # Get today's reminders
        today_resp = self.session.get(f"{BASE_URL}/api/reminders/today")
        assert today_resp.status_code == 200
        data = today_resp.json()
        
        # Should include our manual reminder
        found = [r for r in data['reminders'] if r['id'] == reminder_id]
        assert len(found) == 1
        assert found[0]['is_auto_generated'] == False
        
        print(f"SUCCESS: Today's reminders includes manual reminder")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
    
    # ============== WhatsApp Summary (without actual send) ==============
    
    def test_whatsapp_summary_endpoint_exists(self):
        """POST /api/reminders/send-whatsapp-summary - endpoint exists"""
        # This will likely fail due to WhatsApp not being configured, but endpoint should exist
        response = self.session.post(f"{BASE_URL}/api/reminders/send-whatsapp-summary")
        # Should return 400 (not configured) or 200 (success), not 404
        assert response.status_code in [200, 400]
        print(f"SUCCESS: WhatsApp summary endpoint exists - Status: {response.status_code}")


class TestRemindersIntegration:
    """Integration tests for Reminders with other entities"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        self.today = datetime.now().strftime('%Y-%m-%d')
    
    def test_reminder_with_doctor_entity(self):
        """Create reminder linked to doctor entity"""
        # Get a doctor first
        doctors_resp = self.session.get(f"{BASE_URL}/api/doctors")
        assert doctors_resp.status_code == 200
        doctors = doctors_resp.json()
        
        if doctors:
            doctor = doctors[0]
            payload = {
                "title": f"TEST_Follow-up with {doctor['name']}",
                "reminder_type": "follow_up",
                "reminder_date": self.today,
                "entity_type": "doctor",
                "entity_id": doctor['id'],
                "entity_name": doctor['name'],
                "priority": "high"
            }
            response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
            assert response.status_code == 200
            data = response.json()
            
            assert data['entity_type'] == 'doctor'
            assert data['entity_id'] == doctor['id']
            print(f"SUCCESS: Created reminder linked to doctor {doctor['name']}")
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
        else:
            print("SKIP: No doctors available for integration test")
    
    def test_reminder_with_medical_entity(self):
        """Create reminder linked to medical entity"""
        # Get a medical first
        medicals_resp = self.session.get(f"{BASE_URL}/api/medicals")
        assert medicals_resp.status_code == 200
        medicals = medicals_resp.json()
        
        if medicals:
            medical = medicals[0]
            payload = {
                "title": f"TEST_Follow-up with {medical['name']}",
                "reminder_type": "follow_up",
                "reminder_date": self.today,
                "entity_type": "medical",
                "entity_id": medical['id'],
                "entity_name": medical['name'],
                "priority": "moderate"
            }
            response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
            assert response.status_code == 200
            data = response.json()
            
            assert data['entity_type'] == 'medical'
            print(f"SUCCESS: Created reminder linked to medical {medical['name']}")
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
        else:
            print("SKIP: No medicals available for integration test")
    
    def test_reminder_with_agency_entity(self):
        """Create reminder linked to agency entity"""
        # Get an agency first
        agencies_resp = self.session.get(f"{BASE_URL}/api/agencies")
        assert agencies_resp.status_code == 200
        agencies = agencies_resp.json()
        
        if agencies:
            agency = agencies[0]
            payload = {
                "title": f"TEST_Follow-up with {agency['name']}",
                "reminder_type": "follow_up",
                "reminder_date": self.today,
                "entity_type": "agency",
                "entity_id": agency['id'],
                "entity_name": agency['name'],
                "priority": "low"
            }
            response = self.session.post(f"{BASE_URL}/api/reminders", json=payload)
            assert response.status_code == 200
            data = response.json()
            
            assert data['entity_type'] == 'agency'
            print(f"SUCCESS: Created reminder linked to agency {agency['name']}")
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/reminders/{data['id']}")
        else:
            print("SKIP: No agencies available for integration test")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
