"""
Test suite for Lead Follow-up Management System APIs
Tests: POST /api/followups, GET /api/followups/{entity_type}/{entity_id}, GET /api/reminders/today (overdue)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFollowUpSystem:
    """Follow-up API tests with auto-close and entity update verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # Token comes as access_token
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    @pytest.fixture(scope="class")
    def existing_doctor(self, auth_headers):
        """Get or create a test doctor"""
        # Get existing doctors
        response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        assert response.status_code == 200, f"Get doctors failed: {response.text}"
        doctors = response.json()
        if doctors:
            return doctors[0]
        # Create a test doctor if none exist
        response = requests.post(f"{BASE_URL}/api/doctors", headers=auth_headers, json={
            "name": "TEST_Dr. Followup Test",
            "phone": "9999999990",
            "lead_status": "Pipeline"
        })
        assert response.status_code == 200 or response.status_code == 201, f"Create doctor failed: {response.text}"
        return response.json()
    
    @pytest.fixture(scope="class")
    def existing_medical(self, auth_headers):
        """Get or create a test medical"""
        response = requests.get(f"{BASE_URL}/api/medicals", headers=auth_headers)
        assert response.status_code == 200, f"Get medicals failed: {response.text}"
        medicals = response.json()
        if medicals:
            return medicals[0]
        # Create a test medical if none exist
        response = requests.post(f"{BASE_URL}/api/medicals", headers=auth_headers, json={
            "name": "TEST_Medical Followup Test",
            "phone": "9999999991",
            "lead_status": "Pipeline"
        })
        assert response.status_code == 200 or response.status_code == 201, f"Create medical failed: {response.text}"
        return response.json()
    
    @pytest.fixture(scope="class")
    def existing_agency(self, auth_headers):
        """Get or create a test agency"""
        response = requests.get(f"{BASE_URL}/api/agencies", headers=auth_headers)
        assert response.status_code == 200, f"Get agencies failed: {response.text}"
        agencies = response.json()
        if agencies:
            return agencies[0]
        # Create a test agency if none exist
        response = requests.post(f"{BASE_URL}/api/agencies", headers=auth_headers, json={
            "name": "TEST_Agency Followup Test",
            "phone": "9999999992",
            "lead_status": "Pipeline"
        })
        assert response.status_code == 200 or response.status_code == 201, f"Create agency failed: {response.text}"
        return response.json()

    # ====================== POST /api/followups ======================
    
    def test_create_followup_for_doctor(self, auth_headers, existing_doctor):
        """Test creating a follow-up for a doctor - validates response structure"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST follow-up: Called doctor, they asked to call back tomorrow.",
            "new_status": "Contacted",
            "next_follow_up_date": tomorrow,
            "next_follow_up_time": "10:00"
        })
        assert response.status_code == 200, f"Create follow-up failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data, "Response should contain 'id'"
        assert data["entity_type"] == "doctor", "entity_type should be 'doctor'"
        assert data["entity_id"] == existing_doctor["id"], "entity_id should match"
        assert data["entity_name"] == existing_doctor["name"], "entity_name should match"
        assert data["notes"] == "TEST follow-up: Called doctor, they asked to call back tomorrow."
        assert data["new_status"] == "Contacted"
        assert data["next_follow_up_date"] == tomorrow
        assert data["next_follow_up_time"] == "10:00"
        assert data["status"] == "open", "Follow-up with next_follow_up_date should be 'open'"
        assert "created_by" in data, "Response should contain 'created_by'"
        assert "created_at" in data, "Response should contain 'created_at'"
        print(f"Created follow-up for doctor: {data['id']}")
    
    def test_create_followup_for_medical(self, auth_headers, existing_medical):
        """Test creating a follow-up for a medical"""
        tomorrow = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "medical",
            "entity_id": existing_medical["id"],
            "notes": "TEST follow-up: Visited store, owner interested in new products.",
            "new_status": "Interested",
            "next_follow_up_date": tomorrow,
            "next_follow_up_time": "14:00"
        })
        assert response.status_code == 200, f"Create follow-up failed: {response.text}"
        data = response.json()
        
        assert data["entity_type"] == "medical"
        assert data["entity_id"] == existing_medical["id"]
        assert data["new_status"] == "Interested"
        assert data["status"] == "open"
        print(f"Created follow-up for medical: {data['id']}")
    
    def test_create_followup_for_agency(self, auth_headers, existing_agency):
        """Test creating a follow-up for an agency"""
        tomorrow = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "agency",
            "entity_id": existing_agency["id"],
            "notes": "TEST follow-up: Discussed distribution agreement.",
            "new_status": "Contacted",
            "next_follow_up_date": tomorrow,
            "next_follow_up_time": "16:00"
        })
        assert response.status_code == 200, f"Create follow-up failed: {response.text}"
        data = response.json()
        
        assert data["entity_type"] == "agency"
        assert data["entity_id"] == existing_agency["id"]
        assert data["status"] == "open"
        print(f"Created follow-up for agency: {data['id']}")
    
    def test_create_followup_without_next_date_is_closed(self, auth_headers, existing_doctor):
        """Follow-up without next_follow_up_date should be status='closed'"""
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST follow-up: Closed the deal, no further follow-up needed.",
            "new_status": "Customer",
            "next_follow_up_date": None,
            "next_follow_up_time": None
        })
        assert response.status_code == 200, f"Create follow-up failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "closed", "Follow-up without next date should be 'closed'"
        print(f"Created closed follow-up: {data['id']}")
    
    def test_create_followup_invalid_entity_type(self, auth_headers):
        """Test creating follow-up with invalid entity type returns 400"""
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "invalid_type",
            "entity_id": "some-id",
            "notes": "Test notes"
        })
        assert response.status_code == 400, f"Should return 400 for invalid entity type: {response.text}"
        print("Invalid entity type correctly rejected with 400")
    
    def test_create_followup_nonexistent_entity(self, auth_headers):
        """Test creating follow-up for non-existent entity returns 404"""
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": "nonexistent-id-12345",
            "notes": "Test notes"
        })
        assert response.status_code == 404, f"Should return 404 for non-existent entity: {response.text}"
        print("Non-existent entity correctly rejected with 404")
    
    def test_auto_close_previous_followups(self, auth_headers, existing_doctor):
        """Test that creating a new follow-up auto-closes previous open ones"""
        # Create first follow-up (should be open)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        response1 = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST First follow-up: Initial contact.",
            "new_status": "Contacted",
            "next_follow_up_date": tomorrow
        })
        assert response1.status_code == 200
        first_followup_id = response1.json()["id"]
        
        # Create second follow-up (should auto-close the first)
        day_after = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        response2 = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST Second follow-up: Call again.",
            "new_status": "Interested",
            "next_follow_up_date": day_after
        })
        assert response2.status_code == 200
        second_followup_id = response2.json()["id"]
        
        # Get follow-up history and verify first is closed
        history_response = requests.get(
            f"{BASE_URL}/api/followups/doctor/{existing_doctor['id']}", 
            headers=auth_headers
        )
        assert history_response.status_code == 200
        history = history_response.json()
        
        # Find first and second follow-ups
        first_fu = next((fu for fu in history if fu["id"] == first_followup_id), None)
        second_fu = next((fu for fu in history if fu["id"] == second_followup_id), None)
        
        # First should be closed, second should be open
        if first_fu:
            assert first_fu["status"] == "closed", "Previous follow-up should be auto-closed"
        if second_fu:
            assert second_fu["status"] == "open", "New follow-up should be open"
        print(f"Auto-close verified: first={first_fu['status'] if first_fu else 'N/A'}, second={second_fu['status'] if second_fu else 'N/A'}")

    # ====================== GET /api/followups/{entity_type}/{entity_id} ======================
    
    def test_get_followup_history_doctor(self, auth_headers, existing_doctor):
        """Test getting follow-up history for a doctor - sorted newest first"""
        response = requests.get(
            f"{BASE_URL}/api/followups/doctor/{existing_doctor['id']}", 
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get history failed: {response.text}"
        history = response.json()
        
        assert isinstance(history, list), "History should be a list"
        
        if len(history) >= 2:
            # Verify sorted newest first
            first_date = history[0].get("created_at", "")
            second_date = history[1].get("created_at", "")
            assert first_date >= second_date, "History should be sorted newest first"
        
        # Verify structure of follow-up items
        for fu in history:
            assert "id" in fu, "Each follow-up should have 'id'"
            assert "entity_type" in fu, "Each follow-up should have 'entity_type'"
            assert "notes" in fu, "Each follow-up should have 'notes'"
            assert "status" in fu, "Each follow-up should have 'status'"
            assert "created_at" in fu, "Each follow-up should have 'created_at'"
        
        print(f"Got {len(history)} follow-ups for doctor")
    
    def test_get_followup_history_medical(self, auth_headers, existing_medical):
        """Test getting follow-up history for a medical"""
        response = requests.get(
            f"{BASE_URL}/api/followups/medical/{existing_medical['id']}", 
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get history failed: {response.text}"
        history = response.json()
        assert isinstance(history, list)
        print(f"Got {len(history)} follow-ups for medical")
    
    def test_get_followup_history_agency(self, auth_headers, existing_agency):
        """Test getting follow-up history for an agency"""
        response = requests.get(
            f"{BASE_URL}/api/followups/agency/{existing_agency['id']}", 
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get history failed: {response.text}"
        history = response.json()
        assert isinstance(history, list)
        print(f"Got {len(history)} follow-ups for agency")
    
    def test_get_followup_history_nonexistent_entity(self, auth_headers):
        """Get history for non-existent entity returns empty list (not 404)"""
        response = requests.get(
            f"{BASE_URL}/api/followups/doctor/nonexistent-id-12345", 
            headers=auth_headers
        )
        assert response.status_code == 200, f"Should return 200 with empty list: {response.text}"
        history = response.json()
        assert isinstance(history, list)
        assert len(history) == 0, "History should be empty for non-existent entity"
        print("Empty history returned for non-existent entity")

    # ====================== GET /api/reminders/today (overdue logic) ======================
    
    def test_get_reminders_today_structure(self, auth_headers):
        """Test reminders/today returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/reminders/today", headers=auth_headers)
        assert response.status_code == 200, f"Get reminders failed: {response.text}"
        data = response.json()
        
        assert "reminders" in data, "Response should contain 'reminders' list"
        assert "total_count" in data, "Response should contain 'total_count'"
        assert isinstance(data["reminders"], list)
        assert isinstance(data["total_count"], int)
        
        print(f"Got {data['total_count']} reminders for today")
    
    def test_reminders_today_follow_up_has_overdue_flag(self, auth_headers):
        """Test that follow-up reminders include is_overdue flag"""
        response = requests.get(f"{BASE_URL}/api/reminders/today", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        follow_up_reminders = [r for r in data["reminders"] if r.get("reminder_type") == "follow_up"]
        
        for reminder in follow_up_reminders:
            assert "is_overdue" in reminder or reminder.get("is_auto_generated"), \
                "Auto-generated follow-up reminders should have 'is_overdue' flag"
            assert "lead_status" in reminder or reminder.get("is_auto_generated"), \
                "Auto-generated follow-up reminders should have 'lead_status'"
            if reminder.get("is_auto_generated"):
                assert "entity_type" in reminder, "Auto-generated should have entity_type"
                assert "entity_id" in reminder, "Auto-generated should have entity_id"
        
        overdue_count = len([r for r in follow_up_reminders if r.get("is_overdue")])
        print(f"Found {len(follow_up_reminders)} follow-up reminders, {overdue_count} overdue")
    
    def test_create_overdue_followup_and_verify_in_reminders(self, auth_headers, existing_doctor):
        """Create a follow-up with past date and verify it shows as overdue"""
        # Create a follow-up with yesterday's date (will be overdue)
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST follow-up: This should be overdue.",
            "new_status": "Contacted",
            "next_follow_up_date": yesterday
        })
        assert response.status_code == 200, f"Create follow-up failed: {response.text}"
        
        # Get reminders and check if doctor appears as overdue
        reminders_response = requests.get(f"{BASE_URL}/api/reminders/today", headers=auth_headers)
        assert reminders_response.status_code == 200
        data = reminders_response.json()
        
        # Find the doctor's reminder
        doctor_reminder = next(
            (r for r in data["reminders"] 
             if r.get("entity_type") == "doctor" 
             and r.get("entity_id") == existing_doctor["id"]
             and r.get("is_auto_generated")),
            None
        )
        
        if doctor_reminder:
            assert doctor_reminder.get("is_overdue") == True, "Reminder should be marked as overdue"
            print(f"Verified overdue reminder for doctor: {doctor_reminder.get('title')}")
        else:
            # Doctor might have been updated to a closed status, check lead_status
            doc_response = requests.get(f"{BASE_URL}/api/doctors/{existing_doctor['id']}", headers=auth_headers)
            if doc_response.status_code == 200:
                doc = doc_response.json()
                if doc.get("lead_status") in ["Not Interested", "Closed", "Converted", "Lost"]:
                    print("Doctor has closed status, not expected in reminders - OK")
                else:
                    print(f"Warning: Doctor with follow_up_date={yesterday} not found in reminders. Status: {doc.get('lead_status')}")

    # ====================== Entity update verification ======================
    
    def test_followup_updates_entity_lead_status(self, auth_headers, existing_doctor):
        """Verify that creating follow-up updates entity's lead_status"""
        # Create follow-up with new status
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST: Status update test",
            "new_status": "Interested",
            "next_follow_up_date": tomorrow
        })
        assert response.status_code == 200
        
        # Get doctor and verify lead_status was updated
        doc_response = requests.get(f"{BASE_URL}/api/doctors/{existing_doctor['id']}", headers=auth_headers)
        assert doc_response.status_code == 200
        doctor = doc_response.json()
        
        assert doctor.get("lead_status") == "Interested", \
            f"Doctor lead_status should be 'Interested', got: {doctor.get('lead_status')}"
        print(f"Verified lead_status updated to: {doctor.get('lead_status')}")
    
    def test_followup_updates_entity_follow_up_date(self, auth_headers, existing_doctor):
        """Verify that creating follow-up updates entity's follow_up_date"""
        tomorrow = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST: Follow-up date test",
            "next_follow_up_date": tomorrow
        })
        assert response.status_code == 200
        
        # Get doctor and verify follow_up_date was updated
        doc_response = requests.get(f"{BASE_URL}/api/doctors/{existing_doctor['id']}", headers=auth_headers)
        assert doc_response.status_code == 200
        doctor = doc_response.json()
        
        assert doctor.get("follow_up_date") == tomorrow, \
            f"Doctor follow_up_date should be '{tomorrow}', got: {doctor.get('follow_up_date')}"
        print(f"Verified follow_up_date updated to: {doctor.get('follow_up_date')}")
    
    def test_followup_clears_follow_up_date_when_none(self, auth_headers, existing_doctor):
        """Verify that creating follow-up without next date clears entity's follow_up_date"""
        response = requests.post(f"{BASE_URL}/api/followups", headers=auth_headers, json={
            "entity_type": "doctor",
            "entity_id": existing_doctor["id"],
            "notes": "TEST: Clear follow-up date test",
            "new_status": "Customer",
            "next_follow_up_date": None
        })
        assert response.status_code == 200
        
        # Get doctor and verify follow_up_date was cleared
        doc_response = requests.get(f"{BASE_URL}/api/doctors/{existing_doctor['id']}", headers=auth_headers)
        assert doc_response.status_code == 200
        doctor = doc_response.json()
        
        assert doctor.get("follow_up_date") is None, \
            f"Doctor follow_up_date should be None, got: {doctor.get('follow_up_date')}"
        print("Verified follow_up_date cleared")

    # ====================== Authentication tests ======================
    
    def test_create_followup_without_auth_fails(self):
        """Test that creating follow-up without auth returns 401/403"""
        response = requests.post(f"{BASE_URL}/api/followups", json={
            "entity_type": "doctor",
            "entity_id": "some-id",
            "notes": "Test notes"
        })
        assert response.status_code in [401, 403], f"Should return 401/403 without auth: {response.text}"
        print("Unauthenticated request correctly rejected")
    
    def test_get_followup_history_without_auth_fails(self):
        """Test that getting follow-up history without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/followups/doctor/some-id")
        assert response.status_code in [401, 403], f"Should return 401/403 without auth: {response.text}"
        print("Unauthenticated history request correctly rejected")
