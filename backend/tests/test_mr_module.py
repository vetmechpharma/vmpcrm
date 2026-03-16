"""
Backend tests for MR (Medical Representative) Module - Phase 1
Tests: MR CRUD, Visual Aid CRUD, Slide management, MR Reports
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMRModuleBackend:
    """Test MR Module Backend APIs"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

    # ============== MR CRUD TESTS ==============
    
    def test_get_states(self):
        """Test GET /api/public/states - Location API for MR territory"""
        response = requests.get(f"{BASE_URL}/api/public/states")
        assert response.status_code == 200
        data = response.json()
        assert "states" in data
        assert len(data["states"]) > 0
        # Check for common states
        states = data["states"]
        assert "Tamil Nadu" in states or any("Tamil" in s for s in states)
        print(f"PASS: GET /api/public/states - {len(states)} states returned")
    
    def test_get_districts(self):
        """Test GET /api/public/districts/{state} - Districts for state"""
        response = requests.get(f"{BASE_URL}/api/public/districts/Tamil Nadu")
        assert response.status_code == 200
        data = response.json()
        assert "districts" in data
        districts = data["districts"]
        assert len(districts) > 0
        print(f"PASS: GET /api/public/districts/Tamil Nadu - {len(districts)} districts returned")
    
    def test_get_mrs_list(self, headers):
        """Test GET /api/mrs - List all MRs"""
        response = requests.get(f"{BASE_URL}/api/mrs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/mrs - {len(data)} MRs returned")
        return data
    
    def test_create_mr(self, headers):
        """Test POST /api/mrs - Create new MR"""
        mr_data = {
            "name": "TEST_MR John Doe",
            "phone": "9876543210",
            "email": "test.mr@example.com",
            "password": "testpass123",
            "state": "Tamil Nadu",
            "districts": ["Chennai", "Coimbatore"],
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/mrs", json=mr_data, headers=headers)
        
        # May fail if duplicate phone
        if response.status_code == 400 and "already exists" in response.text:
            # Delete existing and retry
            mrs = requests.get(f"{BASE_URL}/api/mrs?search=9876543210", headers=headers).json()
            if mrs:
                requests.delete(f"{BASE_URL}/api/mrs/{mrs[0]['id']}", headers=headers)
            response = requests.post(f"{BASE_URL}/api/mrs", json=mr_data, headers=headers)
        
        assert response.status_code == 200, f"Create MR failed: {response.text}"
        data = response.json()
        assert data["name"] == mr_data["name"]
        assert data["phone"] == mr_data["phone"]
        assert data["state"] == mr_data["state"]
        assert data["districts"] == mr_data["districts"]
        assert data["status"] == "active"
        assert "id" in data
        print(f"PASS: POST /api/mrs - MR created with id {data['id']}")
        return data
    
    def test_get_mr_by_id(self, headers):
        """Test GET /api/mrs/{id} - Get single MR"""
        # First get list
        mrs = requests.get(f"{BASE_URL}/api/mrs", headers=headers).json()
        if not mrs:
            pytest.skip("No MRs to test")
        
        mr_id = mrs[0]["id"]
        response = requests.get(f"{BASE_URL}/api/mrs/{mr_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == mr_id
        print(f"PASS: GET /api/mrs/{mr_id} - MR retrieved")
    
    def test_update_mr(self, headers):
        """Test PUT /api/mrs/{id} - Update MR"""
        # Find test MR
        mrs = requests.get(f"{BASE_URL}/api/mrs?search=TEST_MR", headers=headers).json()
        if not mrs:
            pytest.skip("Test MR not found")
        
        mr_id = mrs[0]["id"]
        update_data = {
            "name": "TEST_MR John Doe Updated",
            "districts": ["Chennai", "Coimbatore", "Madurai"]
        }
        response = requests.put(f"{BASE_URL}/api/mrs/{mr_id}", json=update_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert "Madurai" in data["districts"]
        print(f"PASS: PUT /api/mrs/{mr_id} - MR updated successfully")
    
    def test_search_mrs(self, headers):
        """Test GET /api/mrs with search parameter"""
        response = requests.get(f"{BASE_URL}/api/mrs?search=TEST_MR", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/mrs?search=TEST_MR - {len(data)} results")
    
    def test_mr_duplicate_phone_prevented(self, headers):
        """Test that duplicate phone numbers are prevented"""
        # Try to create MR with same phone
        mrs = requests.get(f"{BASE_URL}/api/mrs", headers=headers).json()
        if not mrs:
            pytest.skip("No MRs to test duplicate")
        
        existing_phone = mrs[0]["phone"]
        mr_data = {
            "name": "TEST_Duplicate MR",
            "phone": existing_phone,
            "password": "test123",
            "state": "Kerala",
            "districts": []
        }
        response = requests.post(f"{BASE_URL}/api/mrs", json=mr_data, headers=headers)
        assert response.status_code == 400
        assert "already exists" in response.text.lower()
        print(f"PASS: Duplicate phone check working")

    # ============== VISUAL AID TESTS ==============
    
    def test_get_visual_aid_decks(self, headers):
        """Test GET /api/visual-aids - List all decks"""
        response = requests.get(f"{BASE_URL}/api/visual-aids", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/visual-aids - {len(data)} decks returned")
        return data
    
    def test_create_visual_aid_deck(self, headers):
        """Test POST /api/visual-aids - Create new deck"""
        deck_data = {
            "name": "TEST_Large Animal Injections Deck",
            "deck_type": "category",
            "category": "Large Animals",
            "description": "Visual aids for Large Animal injection products",
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/visual-aids", json=deck_data, headers=headers)
        assert response.status_code == 200, f"Create deck failed: {response.text}"
        data = response.json()
        assert data["name"] == deck_data["name"]
        assert data["deck_type"] == "category"
        assert data["category"] == "Large Animals"
        assert "id" in data
        print(f"PASS: POST /api/visual-aids - Deck created with id {data['id']}")
        return data
    
    def test_get_deck_by_id(self, headers):
        """Test GET /api/visual-aids/{id} - Get single deck with slides"""
        decks = requests.get(f"{BASE_URL}/api/visual-aids", headers=headers).json()
        if not decks:
            pytest.skip("No decks to test")
        
        deck_id = decks[0]["id"]
        response = requests.get(f"{BASE_URL}/api/visual-aids/{deck_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == deck_id
        assert "slides" in data
        print(f"PASS: GET /api/visual-aids/{deck_id} - Deck retrieved with {len(data.get('slides', []))} slides")
    
    def test_update_visual_aid_deck(self, headers):
        """Test PUT /api/visual-aids/{id} - Update deck"""
        # Find test deck
        decks = requests.get(f"{BASE_URL}/api/visual-aids", headers=headers).json()
        test_decks = [d for d in decks if d["name"].startswith("TEST_")]
        if not test_decks:
            pytest.skip("Test deck not found")
        
        deck_id = test_decks[0]["id"]
        update_data = {
            "description": "Updated description for testing",
            "status": "draft"
        }
        response = requests.put(f"{BASE_URL}/api/visual-aids/{deck_id}", json=update_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == update_data["description"]
        print(f"PASS: PUT /api/visual-aids/{deck_id} - Deck updated")
    
    def test_create_deck_subcategory_type(self, headers):
        """Test creating subcategory type deck"""
        deck_data = {
            "name": "TEST_Poultry Powder Products",
            "deck_type": "subcategory",
            "category": "Poultry",
            "subcategory": "Powder",
            "description": "Powder products for poultry",
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/visual-aids", json=deck_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deck_type"] == "subcategory"
        assert data["subcategory"] == "Powder"
        print(f"PASS: POST /api/visual-aids - Subcategory deck created")
    
    def test_create_deck_custom_type(self, headers):
        """Test creating custom type deck"""
        deck_data = {
            "name": "TEST_Custom Sales Presentation",
            "deck_type": "custom",
            "description": "Custom presentation deck",
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/visual-aids", json=deck_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deck_type"] == "custom"
        print(f"PASS: POST /api/visual-aids - Custom deck created")

    # ============== SLIDE MANAGEMENT TESTS ==============
    
    def test_add_slide_to_deck(self, headers):
        """Test POST /api/visual-aids/{id}/slides - Add slide with image"""
        # Get a test deck
        decks = requests.get(f"{BASE_URL}/api/visual-aids", headers=headers).json()
        test_decks = [d for d in decks if d["name"].startswith("TEST_")]
        if not test_decks:
            pytest.skip("No test deck found")
        
        deck_id = test_decks[0]["id"]
        
        # Create a valid 100x100 RGB PNG image for testing
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA80lEQVR4nO3bsQ2AMBAEQRvRf8u4AQI2MpZmKjitPv35DL66dg84iViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYwb17wLs5/vhh67ICsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArGCBTRpAsm+p1siAAAAAElFTkSuQmCC"
        
        slide_data = {
            "title": "TEST_Slide 1",
            "image_base64": test_image_base64
        }
        response = requests.post(f"{BASE_URL}/api/visual-aids/{deck_id}/slides", json=slide_data, headers=headers)
        assert response.status_code == 200, f"Add slide failed: {response.text}"
        data = response.json()
        assert data["title"] == slide_data["title"]
        assert data["deck_id"] == deck_id
        assert "image_webp" in data
        print(f"PASS: POST /api/visual-aids/{deck_id}/slides - Slide added")
        return data
    
    def test_delete_slide_from_deck(self, headers):
        """Test DELETE /api/visual-aids/{deck_id}/slides/{slide_id}"""
        # Get deck with slides
        decks = requests.get(f"{BASE_URL}/api/visual-aids", headers=headers).json()
        test_decks = [d for d in decks if d["name"].startswith("TEST_")]
        if not test_decks:
            pytest.skip("No test deck found")
        
        deck_id = test_decks[0]["id"]
        deck_detail = requests.get(f"{BASE_URL}/api/visual-aids/{deck_id}", headers=headers).json()
        slides = deck_detail.get("slides", [])
        
        if not slides:
            # Add a slide first to test delete
            test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA80lEQVR4nO3bsQ2AMBAEQRvRf8u4AQI2MpZmKjitPv35DL66dg84iViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYwb17wLs5/vhh67ICsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArECsQKxArGCBTRpAsm+p1siAAAAAElFTkSuQmCC"
            requests.post(f"{BASE_URL}/api/visual-aids/{deck_id}/slides", 
                          json={"title": "Delete Test", "image_base64": test_image_base64}, 
                          headers=headers)
            deck_detail = requests.get(f"{BASE_URL}/api/visual-aids/{deck_id}", headers=headers).json()
            slides = deck_detail.get("slides", [])
        
        if not slides:
            pytest.skip("No slides to delete")
        
        slide_id = slides[0]["id"]
        response = requests.delete(f"{BASE_URL}/api/visual-aids/{deck_id}/slides/{slide_id}", headers=headers)
        assert response.status_code == 200
        print(f"PASS: DELETE /api/visual-aids/{deck_id}/slides/{slide_id} - Slide deleted")

    # ============== MR REPORTS TESTS ==============
    
    def test_get_mr_reports(self, headers):
        """Test GET /api/mr-reports - Get MR activity reports"""
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "visits" in data
        assert "total" in data
        print(f"PASS: GET /api/mr-reports - {data['total']} visits returned")
    
    def test_get_mr_reports_with_filter(self, headers):
        """Test GET /api/mr-reports with MR filter"""
        # Get an MR to filter by
        mrs = requests.get(f"{BASE_URL}/api/mrs", headers=headers).json()
        if not mrs:
            pytest.skip("No MRs to filter by")
        
        mr_id = mrs[0]["id"]
        response = requests.get(f"{BASE_URL}/api/mr-reports?mr_id={mr_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "visits" in data
        print(f"PASS: GET /api/mr-reports?mr_id={mr_id} - Filtered results returned")

    # ============== CLEANUP TESTS ==============
    
    def test_delete_mr(self, headers):
        """Test DELETE /api/mrs/{id} - Delete test MR"""
        mrs = requests.get(f"{BASE_URL}/api/mrs?search=TEST_MR", headers=headers).json()
        if not mrs:
            pytest.skip("No test MRs to delete")
        
        for mr in mrs:
            response = requests.delete(f"{BASE_URL}/api/mrs/{mr['id']}", headers=headers)
            assert response.status_code == 200
            print(f"PASS: DELETE /api/mrs/{mr['id']} - MR deleted")
    
    def test_delete_visual_aid_decks(self, headers):
        """Test DELETE /api/visual-aids/{id} - Delete test decks"""
        decks = requests.get(f"{BASE_URL}/api/visual-aids", headers=headers).json()
        test_decks = [d for d in decks if d["name"].startswith("TEST_")]
        
        for deck in test_decks:
            response = requests.delete(f"{BASE_URL}/api/visual-aids/{deck['id']}", headers=headers)
            assert response.status_code == 200
            print(f"PASS: DELETE /api/visual-aids/{deck['id']} - Deck deleted")
    
    def test_delete_nonexistent_mr(self, headers):
        """Test DELETE /api/mrs/{id} - Should return 404 for non-existent"""
        response = requests.delete(f"{BASE_URL}/api/mrs/nonexistent-id-12345", headers=headers)
        assert response.status_code == 404
        print(f"PASS: 404 returned for non-existent MR")
    
    def test_delete_nonexistent_deck(self, headers):
        """Test DELETE /api/visual-aids/{id} - Should return 404"""
        response = requests.delete(f"{BASE_URL}/api/visual-aids/nonexistent-id-12345", headers=headers)
        assert response.status_code == 404
        print(f"PASS: 404 returned for non-existent deck")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
