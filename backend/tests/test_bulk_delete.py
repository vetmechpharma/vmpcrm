"""
Test Bulk Delete functionality for Doctors, Medicals, and Agencies
Tests the POST endpoints: /api/doctors/bulk-delete, /api/medicals/bulk-delete, /api/agencies/bulk-delete
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBulkDeleteAPI:
    """Test bulk delete endpoints for all entity types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    # ============== DOCTORS BULK DELETE TESTS ==============
    
    def test_01_create_test_doctors_for_bulk_delete(self):
        """Create multiple doctors to test bulk delete"""
        self.doctor_ids = []
        for i in range(3):
            response = requests.post(f"{BASE_URL}/api/doctors", headers=self.headers, json={
                "name": f"TEST_BulkDoctor_{i+1}",
                "reg_no": f"REG-BULK-{i+1}",
                "address": "Test Address",
                "email": f"testbulkdoctor{i+1}@test.com",
                "phone": f"900000000{i}",
                "lead_status": "Pipeline"
            })
            assert response.status_code == 200, f"Failed to create doctor: {response.text}"
            self.doctor_ids.append(response.json()["id"])
            print(f"Created doctor: {response.json()['name']} with ID: {response.json()['id']}")
        
        print(f"Created {len(self.doctor_ids)} test doctors for bulk delete")
        # Store for use in other tests
        TestBulkDeleteAPI.test_doctor_ids = self.doctor_ids
    
    def test_02_doctors_bulk_delete_endpoint_exists(self):
        """Test that bulk delete endpoint exists and accepts POST"""
        # Use stored IDs from previous test
        doctor_ids = getattr(TestBulkDeleteAPI, 'test_doctor_ids', [])
        if not doctor_ids:
            pytest.skip("No doctor IDs available from previous test")
        
        # Test bulk delete with first 2 doctors
        response = requests.post(f"{BASE_URL}/api/doctors/bulk-delete", headers=self.headers, json=doctor_ids[:2])
        assert response.status_code == 200, f"Bulk delete failed: {response.text}"
        
        data = response.json()
        assert "message" in data or "deleted_count" in data
        assert data.get("deleted_count", 2) >= 2
        print(f"Bulk delete response: {data}")
    
    def test_03_doctors_bulk_delete_verifies_deletion(self):
        """Verify that bulk deleted doctors are actually removed"""
        doctor_ids = getattr(TestBulkDeleteAPI, 'test_doctor_ids', [])
        if not doctor_ids:
            pytest.skip("No doctor IDs available")
        
        # Check if first deleted doctor exists (should return 404)
        response = requests.get(f"{BASE_URL}/api/doctors/{doctor_ids[0]}", headers=self.headers)
        assert response.status_code == 404, f"Doctor should be deleted but got: {response.status_code}"
        print(f"Verified doctor {doctor_ids[0]} was deleted (404)")
    
    def test_04_doctors_bulk_delete_empty_list(self):
        """Test bulk delete with empty list returns error"""
        response = requests.post(f"{BASE_URL}/api/doctors/bulk-delete", headers=self.headers, json=[])
        assert response.status_code == 400, f"Expected 400 for empty list, got: {response.status_code}"
        print("Empty list correctly returns 400")
    
    # ============== MEDICALS BULK DELETE TESTS ==============
    
    def test_05_create_test_medicals_for_bulk_delete(self):
        """Create multiple medicals to test bulk delete"""
        self.medical_ids = []
        for i in range(3):
            response = requests.post(f"{BASE_URL}/api/medicals", headers=self.headers, json={
                "name": f"TEST_BulkMedical_{i+1}",
                "phone": f"910000000{i}",
                "proprietor_name": f"Test Proprietor {i+1}",
                "lead_status": "Pipeline"
            })
            assert response.status_code == 200, f"Failed to create medical: {response.text}"
            self.medical_ids.append(response.json()["id"])
            print(f"Created medical: {response.json()['name']} with ID: {response.json()['id']}")
        
        TestBulkDeleteAPI.test_medical_ids = self.medical_ids
        print(f"Created {len(self.medical_ids)} test medicals for bulk delete")
    
    def test_06_medicals_bulk_delete_endpoint_works(self):
        """Test medicals bulk delete endpoint"""
        medical_ids = getattr(TestBulkDeleteAPI, 'test_medical_ids', [])
        if not medical_ids:
            pytest.skip("No medical IDs available")
        
        response = requests.post(f"{BASE_URL}/api/medicals/bulk-delete", headers=self.headers, json=medical_ids[:2])
        assert response.status_code == 200, f"Bulk delete failed: {response.text}"
        
        data = response.json()
        assert "message" in data or "deleted_count" in data
        print(f"Medicals bulk delete response: {data}")
    
    def test_07_medicals_bulk_delete_verifies_deletion(self):
        """Verify that bulk deleted medicals are actually removed"""
        medical_ids = getattr(TestBulkDeleteAPI, 'test_medical_ids', [])
        if not medical_ids:
            pytest.skip("No medical IDs available")
        
        response = requests.get(f"{BASE_URL}/api/medicals/{medical_ids[0]}", headers=self.headers)
        assert response.status_code == 404, f"Medical should be deleted but got: {response.status_code}"
        print(f"Verified medical {medical_ids[0]} was deleted (404)")
    
    # ============== AGENCIES BULK DELETE TESTS ==============
    
    def test_08_create_test_agencies_for_bulk_delete(self):
        """Create multiple agencies to test bulk delete"""
        self.agency_ids = []
        for i in range(3):
            response = requests.post(f"{BASE_URL}/api/agencies", headers=self.headers, json={
                "name": f"TEST_BulkAgency_{i+1}",
                "phone": f"920000000{i}",
                "proprietor_name": f"Test Agency Owner {i+1}",
                "lead_status": "Pipeline"
            })
            assert response.status_code == 200, f"Failed to create agency: {response.text}"
            self.agency_ids.append(response.json()["id"])
            print(f"Created agency: {response.json()['name']} with ID: {response.json()['id']}")
        
        TestBulkDeleteAPI.test_agency_ids = self.agency_ids
        print(f"Created {len(self.agency_ids)} test agencies for bulk delete")
    
    def test_09_agencies_bulk_delete_endpoint_works(self):
        """Test agencies bulk delete endpoint"""
        agency_ids = getattr(TestBulkDeleteAPI, 'test_agency_ids', [])
        if not agency_ids:
            pytest.skip("No agency IDs available")
        
        response = requests.post(f"{BASE_URL}/api/agencies/bulk-delete", headers=self.headers, json=agency_ids[:2])
        assert response.status_code == 200, f"Bulk delete failed: {response.text}"
        
        data = response.json()
        assert "message" in data or "deleted_count" in data
        print(f"Agencies bulk delete response: {data}")
    
    def test_10_agencies_bulk_delete_verifies_deletion(self):
        """Verify that bulk deleted agencies are actually removed"""
        agency_ids = getattr(TestBulkDeleteAPI, 'test_agency_ids', [])
        if not agency_ids:
            pytest.skip("No agency IDs available")
        
        response = requests.get(f"{BASE_URL}/api/agencies/{agency_ids[0]}", headers=self.headers)
        assert response.status_code == 404, f"Agency should be deleted but got: {response.status_code}"
        print(f"Verified agency {agency_ids[0]} was deleted (404)")
    
    # ============== CLEANUP ==============
    
    def test_99_cleanup_remaining_test_data(self):
        """Clean up any remaining test data"""
        # Clean up remaining doctors
        doctor_ids = getattr(TestBulkDeleteAPI, 'test_doctor_ids', [])
        for doc_id in doctor_ids:
            requests.delete(f"{BASE_URL}/api/doctors/{doc_id}", headers=self.headers)
        
        # Clean up remaining medicals
        medical_ids = getattr(TestBulkDeleteAPI, 'test_medical_ids', [])
        for med_id in medical_ids:
            requests.delete(f"{BASE_URL}/api/medicals/{med_id}", headers=self.headers)
        
        # Clean up remaining agencies
        agency_ids = getattr(TestBulkDeleteAPI, 'test_agency_ids', [])
        for ag_id in agency_ids:
            requests.delete(f"{BASE_URL}/api/agencies/{ag_id}", headers=self.headers)
        
        print("Cleaned up remaining test data")
