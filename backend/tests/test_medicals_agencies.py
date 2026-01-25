"""
Test suite for Medicals and Agencies CRUD operations
Tests: Create, Read, Update, Delete, Notes, Mark Contacted, Auto-generated codes
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@vmpcrm.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestMedicalsCRUD:
    """Test Medicals CRUD operations"""
    
    created_medical_id = None
    created_note_id = None
    
    def test_create_medical_with_all_fields(self, api_client):
        """Test creating a medical store with all fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Medical Store {unique_id}",
            "proprietor_name": "Test Proprietor",
            "gst_number": "22AAAAA0000A1Z5",
            "drug_license": "DL123456",
            "address": "123 Test Street",
            "state": "Karnataka",
            "district": "Bangalore",
            "pincode": "560001",
            "email": f"test_{unique_id}@medical.com",
            "phone": f"98765{unique_id[:5]}",
            "alternate_phone": "9876543211",
            "lead_status": "Pipeline"
        }
        
        response = api_client.post(f"{BASE_URL}/api/medicals", json=payload)
        assert response.status_code == 200, f"Create medical failed: {response.text}"
        
        data = response.json()
        TestMedicalsCRUD.created_medical_id = data["id"]
        
        # Verify response data
        assert data["name"] == payload["name"]
        assert data["proprietor_name"] == payload["proprietor_name"]
        assert data["gst_number"] == payload["gst_number"]
        assert data["drug_license"] == payload["drug_license"]
        assert data["phone"] == payload["phone"]
        assert data["lead_status"] == "Pipeline"
        
        # Verify auto-generated code format MED-XXXX
        assert data["customer_code"].startswith("MED-"), f"Expected MED-XXXX format, got {data['customer_code']}"
        assert len(data["customer_code"]) == 8, f"Expected 8 chars (MED-XXXX), got {len(data['customer_code'])}"
        
        print(f"✓ Created medical with code: {data['customer_code']}")
    
    def test_get_medical_by_id(self, api_client):
        """Test getting a single medical by ID"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID from create test"
        
        response = api_client.get(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}")
        assert response.status_code == 200, f"Get medical failed: {response.text}"
        
        data = response.json()
        assert data["id"] == TestMedicalsCRUD.created_medical_id
        assert data["customer_code"].startswith("MED-")
        print(f"✓ Retrieved medical: {data['name']}")
    
    def test_list_medicals(self, api_client):
        """Test listing all medicals"""
        response = api_client.get(f"{BASE_URL}/api/medicals")
        assert response.status_code == 200, f"List medicals failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Expected at least 1 medical"
        
        # Verify all have MED-XXXX codes
        for medical in data:
            assert medical["customer_code"].startswith("MED-"), f"Invalid code: {medical['customer_code']}"
        
        print(f"✓ Listed {len(data)} medicals")
    
    def test_list_medicals_with_search(self, api_client):
        """Test searching medicals"""
        response = api_client.get(f"{BASE_URL}/api/medicals", params={"search": "TEST_Medical"})
        assert response.status_code == 200, f"Search medicals failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Search returned {len(data)} results")
    
    def test_list_medicals_with_status_filter(self, api_client):
        """Test filtering medicals by status"""
        response = api_client.get(f"{BASE_URL}/api/medicals", params={"status": "Pipeline"})
        assert response.status_code == 200, f"Filter medicals failed: {response.text}"
        
        data = response.json()
        for medical in data:
            assert medical["lead_status"] == "Pipeline"
        
        print(f"✓ Status filter returned {len(data)} Pipeline medicals")
    
    def test_update_medical(self, api_client):
        """Test updating a medical"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID from create test"
        
        update_payload = {
            "name": "TEST_Updated Medical Store",
            "lead_status": "Contacted",
            "priority": "high"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}",
            json=update_payload
        )
        assert response.status_code == 200, f"Update medical failed: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Updated Medical Store"
        assert data["lead_status"] == "Contacted"
        assert data["priority"] == "high"
        
        # Verify with GET
        get_response = api_client.get(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}")
        get_data = get_response.json()
        assert get_data["name"] == "TEST_Updated Medical Store"
        
        print(f"✓ Updated medical successfully")
    
    def test_add_note_to_medical(self, api_client):
        """Test adding a note to a medical"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID from create test"
        
        note_payload = {"note": "TEST_This is a test note for medical"}
        
        response = api_client.post(
            f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}/notes",
            json=note_payload
        )
        assert response.status_code == 200, f"Add note failed: {response.text}"
        
        data = response.json()
        TestMedicalsCRUD.created_note_id = data["id"]
        
        assert data["note"] == note_payload["note"]
        assert data["medical_id"] == TestMedicalsCRUD.created_medical_id
        assert "created_by" in data
        
        print(f"✓ Added note to medical")
    
    def test_get_medical_notes(self, api_client):
        """Test getting notes for a medical"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID from create test"
        
        response = api_client.get(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}/notes")
        assert response.status_code == 200, f"Get notes failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        print(f"✓ Retrieved {len(data)} notes for medical")
    
    def test_mark_medical_contacted(self, api_client):
        """Test marking a medical as contacted (sets follow-up to 25 days)"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID from create test"
        
        response = api_client.put(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}/contact")
        assert response.status_code == 200, f"Mark contacted failed: {response.text}"
        
        data = response.json()
        assert "follow_up_date" in data
        assert data["message"] == "Contact updated successfully"
        
        # Verify the medical was updated
        get_response = api_client.get(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}")
        get_data = get_response.json()
        assert get_data["last_contact_date"] is not None
        assert get_data["follow_up_date"] is not None
        
        print(f"✓ Marked medical as contacted, follow-up: {data['follow_up_date']}")
    
    def test_delete_medical_note(self, api_client):
        """Test deleting a note from a medical"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID"
        assert TestMedicalsCRUD.created_note_id, "No note ID"
        
        response = api_client.delete(
            f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}/notes/{TestMedicalsCRUD.created_note_id}"
        )
        assert response.status_code == 200, f"Delete note failed: {response.text}"
        
        print(f"✓ Deleted note from medical")
    
    def test_delete_medical(self, api_client):
        """Test deleting a medical"""
        assert TestMedicalsCRUD.created_medical_id, "No medical ID from create test"
        
        response = api_client.delete(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}")
        assert response.status_code == 200, f"Delete medical failed: {response.text}"
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/medicals/{TestMedicalsCRUD.created_medical_id}")
        assert get_response.status_code == 404
        
        print(f"✓ Deleted medical successfully")


class TestAgenciesCRUD:
    """Test Agencies CRUD operations"""
    
    created_agency_id = None
    created_note_id = None
    
    def test_create_agency_with_all_fields(self, api_client):
        """Test creating an agency with all fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Distribution Agency {unique_id}",
            "proprietor_name": "Test Agency Owner",
            "gst_number": "33BBBBB0000B2Y6",
            "drug_license": "DL789012",
            "address": "456 Agency Road",
            "state": "Tamil Nadu",
            "district": "Chennai",
            "pincode": "600001",
            "email": f"test_{unique_id}@agency.com",
            "phone": f"87654{unique_id[:5]}",
            "alternate_phone": "8765432100",
            "lead_status": "Pipeline"
        }
        
        response = api_client.post(f"{BASE_URL}/api/agencies", json=payload)
        assert response.status_code == 200, f"Create agency failed: {response.text}"
        
        data = response.json()
        TestAgenciesCRUD.created_agency_id = data["id"]
        
        # Verify response data
        assert data["name"] == payload["name"]
        assert data["proprietor_name"] == payload["proprietor_name"]
        assert data["gst_number"] == payload["gst_number"]
        assert data["drug_license"] == payload["drug_license"]
        assert data["phone"] == payload["phone"]
        assert data["lead_status"] == "Pipeline"
        
        # Verify auto-generated code format AGY-XXXX
        assert data["customer_code"].startswith("AGY-"), f"Expected AGY-XXXX format, got {data['customer_code']}"
        assert len(data["customer_code"]) == 8, f"Expected 8 chars (AGY-XXXX), got {len(data['customer_code'])}"
        
        print(f"✓ Created agency with code: {data['customer_code']}")
    
    def test_get_agency_by_id(self, api_client):
        """Test getting a single agency by ID"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID from create test"
        
        response = api_client.get(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}")
        assert response.status_code == 200, f"Get agency failed: {response.text}"
        
        data = response.json()
        assert data["id"] == TestAgenciesCRUD.created_agency_id
        assert data["customer_code"].startswith("AGY-")
        print(f"✓ Retrieved agency: {data['name']}")
    
    def test_list_agencies(self, api_client):
        """Test listing all agencies"""
        response = api_client.get(f"{BASE_URL}/api/agencies")
        assert response.status_code == 200, f"List agencies failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Expected at least 1 agency"
        
        # Verify all have AGY-XXXX codes
        for agency in data:
            assert agency["customer_code"].startswith("AGY-"), f"Invalid code: {agency['customer_code']}"
        
        print(f"✓ Listed {len(data)} agencies")
    
    def test_list_agencies_with_search(self, api_client):
        """Test searching agencies"""
        response = api_client.get(f"{BASE_URL}/api/agencies", params={"search": "TEST_Distribution"})
        assert response.status_code == 200, f"Search agencies failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Search returned {len(data)} results")
    
    def test_list_agencies_with_status_filter(self, api_client):
        """Test filtering agencies by status"""
        response = api_client.get(f"{BASE_URL}/api/agencies", params={"status": "Pipeline"})
        assert response.status_code == 200, f"Filter agencies failed: {response.text}"
        
        data = response.json()
        for agency in data:
            assert agency["lead_status"] == "Pipeline"
        
        print(f"✓ Status filter returned {len(data)} Pipeline agencies")
    
    def test_update_agency(self, api_client):
        """Test updating an agency"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID from create test"
        
        update_payload = {
            "name": "TEST_Updated Distribution Agency",
            "lead_status": "Contacted",
            "priority": "high"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}",
            json=update_payload
        )
        assert response.status_code == 200, f"Update agency failed: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Updated Distribution Agency"
        assert data["lead_status"] == "Contacted"
        assert data["priority"] == "high"
        
        # Verify with GET
        get_response = api_client.get(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}")
        get_data = get_response.json()
        assert get_data["name"] == "TEST_Updated Distribution Agency"
        
        print(f"✓ Updated agency successfully")
    
    def test_add_note_to_agency(self, api_client):
        """Test adding a note to an agency"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID from create test"
        
        note_payload = {"note": "TEST_This is a test note for agency"}
        
        response = api_client.post(
            f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}/notes",
            json=note_payload
        )
        assert response.status_code == 200, f"Add note failed: {response.text}"
        
        data = response.json()
        TestAgenciesCRUD.created_note_id = data["id"]
        
        assert data["note"] == note_payload["note"]
        assert data["agency_id"] == TestAgenciesCRUD.created_agency_id
        assert "created_by" in data
        
        print(f"✓ Added note to agency")
    
    def test_get_agency_notes(self, api_client):
        """Test getting notes for an agency"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID from create test"
        
        response = api_client.get(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}/notes")
        assert response.status_code == 200, f"Get notes failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        print(f"✓ Retrieved {len(data)} notes for agency")
    
    def test_mark_agency_contacted(self, api_client):
        """Test marking an agency as contacted (sets follow-up to 25 days)"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID from create test"
        
        response = api_client.put(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}/contact")
        assert response.status_code == 200, f"Mark contacted failed: {response.text}"
        
        data = response.json()
        assert "follow_up_date" in data
        assert data["message"] == "Contact updated successfully"
        
        # Verify the agency was updated
        get_response = api_client.get(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}")
        get_data = get_response.json()
        assert get_data["last_contact_date"] is not None
        assert get_data["follow_up_date"] is not None
        
        print(f"✓ Marked agency as contacted, follow-up: {data['follow_up_date']}")
    
    def test_delete_agency_note(self, api_client):
        """Test deleting a note from an agency"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID"
        assert TestAgenciesCRUD.created_note_id, "No note ID"
        
        response = api_client.delete(
            f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}/notes/{TestAgenciesCRUD.created_note_id}"
        )
        assert response.status_code == 200, f"Delete note failed: {response.text}"
        
        print(f"✓ Deleted note from agency")
    
    def test_delete_agency(self, api_client):
        """Test deleting an agency"""
        assert TestAgenciesCRUD.created_agency_id, "No agency ID from create test"
        
        response = api_client.delete(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}")
        assert response.status_code == 200, f"Delete agency failed: {response.text}"
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/agencies/{TestAgenciesCRUD.created_agency_id}")
        assert get_response.status_code == 404
        
        print(f"✓ Deleted agency successfully")


class TestTasksForMedicalsAgencies:
    """Test Tasks creation for Medicals and Agencies"""
    
    medical_id = None
    agency_id = None
    medical_task_id = None
    agency_task_id = None
    
    def test_create_medical_for_task(self, api_client):
        """Create a medical for task testing"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Task Medical {unique_id}",
            "phone": f"11111{unique_id[:5]}"
        }
        response = api_client.post(f"{BASE_URL}/api/medicals", json=payload)
        assert response.status_code == 200
        TestTasksForMedicalsAgencies.medical_id = response.json()["id"]
        print(f"✓ Created medical for task testing")
    
    def test_create_agency_for_task(self, api_client):
        """Create an agency for task testing"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Task Agency {unique_id}",
            "phone": f"22222{unique_id[:5]}"
        }
        response = api_client.post(f"{BASE_URL}/api/agencies", json=payload)
        assert response.status_code == 200
        TestTasksForMedicalsAgencies.agency_id = response.json()["id"]
        print(f"✓ Created agency for task testing")
    
    def test_create_task_for_medical(self, api_client):
        """Test creating a task for a medical"""
        assert TestTasksForMedicalsAgencies.medical_id, "No medical ID"
        
        payload = {
            "medical_id": TestTasksForMedicalsAgencies.medical_id,
            "title": "TEST_Follow up with medical store",
            "description": "Call to discuss new products",
            "due_date": "2026-02-15",
            "priority": "high"
        }
        
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200, f"Create task failed: {response.text}"
        
        data = response.json()
        TestTasksForMedicalsAgencies.medical_task_id = data["id"]
        assert data["title"] == payload["title"]
        assert data["priority"] == "high"
        assert data["status"] == "pending"
        
        print(f"✓ Created task for medical")
    
    def test_create_task_for_agency(self, api_client):
        """Test creating a task for an agency"""
        assert TestTasksForMedicalsAgencies.agency_id, "No agency ID"
        
        payload = {
            "agency_id": TestTasksForMedicalsAgencies.agency_id,
            "title": "TEST_Follow up with agency",
            "description": "Discuss distribution agreement",
            "due_date": "2026-02-20",
            "priority": "moderate"
        }
        
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200, f"Create task failed: {response.text}"
        
        data = response.json()
        TestTasksForMedicalsAgencies.agency_task_id = data["id"]
        assert data["title"] == payload["title"]
        assert data["priority"] == "moderate"
        
        print(f"✓ Created task for agency")
    
    def test_get_tasks_for_medical(self, api_client):
        """Test getting tasks filtered by medical_id"""
        assert TestTasksForMedicalsAgencies.medical_id, "No medical ID"
        
        response = api_client.get(f"{BASE_URL}/api/tasks", params={"medical_id": TestTasksForMedicalsAgencies.medical_id})
        assert response.status_code == 200, f"Get tasks failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        print(f"✓ Retrieved {len(data)} tasks for medical")
    
    def test_get_tasks_for_agency(self, api_client):
        """Test getting tasks filtered by agency_id"""
        assert TestTasksForMedicalsAgencies.agency_id, "No agency ID"
        
        response = api_client.get(f"{BASE_URL}/api/tasks", params={"agency_id": TestTasksForMedicalsAgencies.agency_id})
        assert response.status_code == 200, f"Get tasks failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        print(f"✓ Retrieved {len(data)} tasks for agency")
    
    def test_cleanup_tasks_and_entities(self, api_client):
        """Cleanup test data"""
        # Delete tasks
        if TestTasksForMedicalsAgencies.medical_task_id:
            api_client.delete(f"{BASE_URL}/api/tasks/{TestTasksForMedicalsAgencies.medical_task_id}")
        if TestTasksForMedicalsAgencies.agency_task_id:
            api_client.delete(f"{BASE_URL}/api/tasks/{TestTasksForMedicalsAgencies.agency_task_id}")
        
        # Delete entities
        if TestTasksForMedicalsAgencies.medical_id:
            api_client.delete(f"{BASE_URL}/api/medicals/{TestTasksForMedicalsAgencies.medical_id}")
        if TestTasksForMedicalsAgencies.agency_id:
            api_client.delete(f"{BASE_URL}/api/agencies/{TestTasksForMedicalsAgencies.agency_id}")
        
        print(f"✓ Cleaned up test data")


class TestExistingData:
    """Test existing data in database (MED-0001, AGY-0001)"""
    
    def test_existing_medical_exists(self, api_client):
        """Verify existing medical MED-0001 exists"""
        response = api_client.get(f"{BASE_URL}/api/medicals")
        assert response.status_code == 200
        
        data = response.json()
        med_codes = [m["customer_code"] for m in data]
        
        # Check if MED-0001 or any MED- code exists
        has_med = any(code.startswith("MED-") for code in med_codes)
        assert has_med, f"No MED-XXXX codes found. Codes: {med_codes}"
        
        print(f"✓ Found medical codes: {[c for c in med_codes if c.startswith('MED-')]}")
    
    def test_existing_agency_exists(self, api_client):
        """Verify existing agency AGY-0001 exists"""
        response = api_client.get(f"{BASE_URL}/api/agencies")
        assert response.status_code == 200
        
        data = response.json()
        agy_codes = [a["customer_code"] for a in data]
        
        # Check if AGY-0001 or any AGY- code exists
        has_agy = any(code.startswith("AGY-") for code in agy_codes)
        assert has_agy, f"No AGY-XXXX codes found. Codes: {agy_codes}"
        
        print(f"✓ Found agency codes: {[c for c in agy_codes if c.startswith('AGY-')]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
