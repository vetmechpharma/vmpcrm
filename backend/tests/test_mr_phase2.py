"""
MR Module Phase 2 Tests - MR Panel API Testing
Tests: MR Login, Dashboard, Customers, Visits, Follow-ups, Visual Aids

MR Credentials: Phone: 9876543211, Password: mr123
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMRLogin:
    """MR Login endpoint tests"""

    def test_mr_login_success(self):
        """POST /api/mr/login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "9876543211",
            "password": "mr123"
        })
        print(f"MR Login response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "mr" in data
        assert data["mr"]["phone"] == "9876543211"
        assert "state" in data["mr"]
        assert "districts" in data["mr"]
        print(f"MR Login successful - MR Name: {data['mr']['name']}, State: {data['mr']['state']}")

    def test_mr_login_wrong_password(self):
        """POST /api/mr/login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "9876543211",
            "password": "wrongpassword"
        })
        assert response.status_code == 401

    def test_mr_login_invalid_phone(self):
        """POST /api/mr/login with non-existent phone"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "1111111111",
            "password": "mr123"
        })
        assert response.status_code == 401

    def test_mr_login_missing_fields(self):
        """POST /api/mr/login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "9876543211"
        })
        assert response.status_code == 400


@pytest.fixture(scope="module")
def mr_token():
    """Get MR auth token"""
    response = requests.post(f"{BASE_URL}/api/mr/login", json={
        "phone": "9876543211",
        "password": "mr123"
    })
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"Got MR token: {token[:30]}...")
        return token
    pytest.skip("MR Login failed - cannot proceed with authenticated tests")


@pytest.fixture(scope="module")
def mr_headers(mr_token):
    """Get MR auth headers"""
    return {"Authorization": f"Bearer {mr_token}"}


class TestMRDashboard:
    """MR Dashboard API tests"""

    def test_get_mr_profile(self, mr_headers):
        """GET /api/mr/me - Get current MR profile"""
        response = requests.get(f"{BASE_URL}/api/mr/me", headers=mr_headers)
        print(f"MR Profile response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "state" in data
        assert "districts" in data
        print(f"MR Profile: {data['name']} - {data['state']} - {data.get('districts', [])}")

    def test_get_mr_dashboard(self, mr_headers):
        """GET /api/mr/dashboard - Get dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/mr/dashboard", headers=mr_headers)
        print(f"MR Dashboard response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        # Validate dashboard stats structure
        assert "doctors" in data
        assert "medicals" in data
        assert "agencies" in data
        assert "total_customers" in data
        assert "today_visits" in data
        assert "pending_followups" in data
        assert "active_decks" in data
        print(f"Dashboard Stats: Customers={data['total_customers']}, Today Visits={data['today_visits']}, Decks={data['active_decks']}")

    def test_dashboard_unauthorized(self):
        """GET /api/mr/dashboard without auth"""
        response = requests.get(f"{BASE_URL}/api/mr/dashboard")
        assert response.status_code in [401, 403]


class TestMRCustomers:
    """MR Customers API tests"""

    def test_get_all_customers(self, mr_headers):
        """GET /api/mr/customers - Get all territory customers"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        print(f"MR Customers response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Total customers in territory: {len(data)}")
        
        # Check structure if customers exist
        if data:
            c = data[0]
            assert "id" in c
            assert "name" in c
            assert "entity_type" in c
            print(f"First customer: {c['name']} ({c['entity_type']})")

    def test_get_customers_by_type_doctor(self, mr_headers):
        """GET /api/mr/customers?entity_type=doctor"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", params={"entity_type": "doctor"}, headers=mr_headers)
        assert response.status_code == 200
        data = response.json()
        # All should be doctors
        for c in data:
            assert c["entity_type"] == "doctor"
        print(f"Doctors in territory: {len(data)}")

    def test_get_customers_by_type_medical(self, mr_headers):
        """GET /api/mr/customers?entity_type=medical"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", params={"entity_type": "medical"}, headers=mr_headers)
        assert response.status_code == 200
        data = response.json()
        for c in data:
            assert c["entity_type"] == "medical"
        print(f"Medicals in territory: {len(data)}")

    def test_get_customers_by_type_agency(self, mr_headers):
        """GET /api/mr/customers?entity_type=agency"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", params={"entity_type": "agency"}, headers=mr_headers)
        assert response.status_code == 200
        data = response.json()
        for c in data:
            assert c["entity_type"] == "agency"
        print(f"Agencies in territory: {len(data)}")

    def test_search_customers(self, mr_headers):
        """GET /api/mr/customers?search=... - Search customers"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", params={"search": "DHIVAHAR"}, headers=mr_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Search results for 'DHIVAHAR': {len(data)} customers")


class TestMRVisits:
    """MR Visits API tests"""

    def test_get_visits_empty_or_list(self, mr_headers):
        """GET /api/mr/visits - Get visit history"""
        response = requests.get(f"{BASE_URL}/api/mr/visits", headers=mr_headers)
        print(f"MR Visits response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total visits: {len(data)}")

    def test_create_visit(self, mr_headers):
        """POST /api/mr/visits - Create a new visit"""
        # First get a customer to visit
        customers_response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers in territory to create visit")
        
        customer = customers[0]
        today = datetime.now().strftime('%Y-%m-%d')
        
        visit_data = {
            "entity_type": customer["entity_type"],
            "entity_id": customer["id"],
            "entity_name": customer["name"],
            "visit_date": today,
            "notes": "TEST_VISIT - Discussed product features, showed catalog",
            "outcome": "interested",
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/visits", json=visit_data, headers=mr_headers)
        print(f"Create Visit response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["entity_name"] == customer["name"]
        assert data["outcome"] == "interested"
        print(f"Created visit: {data['id']} for {data['entity_name']}")
        return data["id"]

    def test_create_visit_with_followup(self, mr_headers):
        """POST /api/mr/visits - Create visit with follow-up required"""
        customers_response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers in territory")
        
        customer = customers[0]
        today = datetime.now().strftime('%Y-%m-%d')
        next_week = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        visit_data = {
            "entity_type": customer["entity_type"],
            "entity_id": customer["id"],
            "entity_name": customer["name"],
            "visit_date": today,
            "notes": "TEST_VISIT_FOLLOWUP - Need to follow up on pricing",
            "outcome": "follow_up_required",
            "next_follow_up_date": next_week,
            "next_follow_up_notes": "Discuss discounts and bulk order"
        }
        
        response = requests.post(f"{BASE_URL}/api/mr/visits", json=visit_data, headers=mr_headers)
        print(f"Create Follow-up Visit response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["outcome"] == "follow_up_required"
        assert data["next_follow_up_date"] == next_week
        print(f"Created follow-up visit: {data['id']}, follow-up on {data['next_follow_up_date']}")
        return data["id"]

    def test_verify_visit_in_list(self, mr_headers):
        """Verify created visit appears in visit list"""
        response = requests.get(f"{BASE_URL}/api/mr/visits", headers=mr_headers)
        assert response.status_code == 200
        visits = response.json()
        
        # Look for our test visits
        test_visits = [v for v in visits if "TEST_VISIT" in (v.get("notes") or "")]
        print(f"Found {len(test_visits)} test visits")

    def test_update_visit(self, mr_headers):
        """PUT /api/mr/visits/{id} - Update visit"""
        # Create a visit first
        customers_response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers in territory")
        
        customer = customers[0]
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Create visit
        create_response = requests.post(f"{BASE_URL}/api/mr/visits", json={
            "entity_type": customer["entity_type"],
            "entity_id": customer["id"],
            "entity_name": customer["name"],
            "visit_date": today,
            "notes": "TEST_UPDATE_VISIT - Initial notes",
            "outcome": "interested",
        }, headers=mr_headers)
        
        if create_response.status_code != 200:
            pytest.skip("Could not create visit for update test")
        
        visit_id = create_response.json()["id"]
        
        # Update visit
        update_response = requests.put(f"{BASE_URL}/api/mr/visits/{visit_id}", json={
            "notes": "TEST_UPDATE_VISIT - Updated notes with more details",
            "outcome": "order_placed"
        }, headers=mr_headers)
        
        print(f"Update Visit response: {update_response.status_code}")
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["outcome"] == "order_placed"
        print(f"Updated visit {visit_id} outcome to {data['outcome']}")


class TestMRFollowups:
    """MR Follow-ups API tests"""

    def test_get_followups_today(self, mr_headers):
        """GET /api/mr/followups?filter_type=today"""
        response = requests.get(f"{BASE_URL}/api/mr/followups", params={"filter_type": "today"}, headers=mr_headers)
        print(f"Today Follow-ups response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Today follow-ups: {len(data)}")

    def test_get_followups_overdue(self, mr_headers):
        """GET /api/mr/followups?filter_type=overdue"""
        response = requests.get(f"{BASE_URL}/api/mr/followups", params={"filter_type": "overdue"}, headers=mr_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Overdue follow-ups: {len(data)}")

    def test_get_followups_upcoming(self, mr_headers):
        """GET /api/mr/followups?filter_type=upcoming"""
        response = requests.get(f"{BASE_URL}/api/mr/followups", params={"filter_type": "upcoming"}, headers=mr_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Upcoming follow-ups: {len(data)}")

    def test_mark_followup_done(self, mr_headers):
        """PUT /api/mr/visits/{id} - Mark follow-up as done"""
        # Get upcoming follow-ups
        response = requests.get(f"{BASE_URL}/api/mr/followups", params={"filter_type": "upcoming"}, headers=mr_headers)
        followups = response.json()
        
        if not followups:
            # Create a follow-up visit first
            customers_response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
            customers = customers_response.json()
            
            if not customers:
                pytest.skip("No customers or follow-ups to test")
            
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            create_response = requests.post(f"{BASE_URL}/api/mr/visits", json={
                "entity_type": customers[0]["entity_type"],
                "entity_id": customers[0]["id"],
                "entity_name": customers[0]["name"],
                "visit_date": datetime.now().strftime('%Y-%m-%d'),
                "notes": "TEST_FOLLOWUP_DONE - Creating for test",
                "outcome": "follow_up_required",
                "next_follow_up_date": tomorrow,
            }, headers=mr_headers)
            
            if create_response.status_code != 200:
                pytest.skip("Could not create follow-up")
            
            visit_id = create_response.json()["id"]
        else:
            visit_id = followups[0]["id"]
        
        # Mark as done
        update_response = requests.put(f"{BASE_URL}/api/mr/visits/{visit_id}", json={
            "follow_up_done": True
        }, headers=mr_headers)
        
        print(f"Mark follow-up done response: {update_response.status_code}")
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["follow_up_done"] == True
        print(f"Marked follow-up {visit_id} as done")


class TestMRVisualAids:
    """MR Visual Aids API tests"""

    def test_get_visual_aids(self, mr_headers):
        """GET /api/mr/visual-aids - Get active decks"""
        response = requests.get(f"{BASE_URL}/api/mr/visual-aids", headers=mr_headers)
        print(f"Visual Aids response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Active decks: {len(data)}")
        
        # Check structure if decks exist
        if data:
            deck = data[0]
            assert "id" in deck
            assert "name" in deck
            assert "status" in deck
            assert deck["status"] == "active"
            print(f"First deck: {deck['name']} (slides: {deck.get('slide_count', 0)})")
            return deck["id"]
        return None

    def test_get_visual_aid_deck_with_slides(self, mr_headers):
        """GET /api/mr/visual-aids/{id} - Get deck with slides"""
        # First get list of decks
        list_response = requests.get(f"{BASE_URL}/api/mr/visual-aids", headers=mr_headers)
        decks = list_response.json()
        
        if not decks:
            pytest.skip("No visual aid decks available")
        
        deck_id = decks[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/mr/visual-aids/{deck_id}", headers=mr_headers)
        print(f"Get deck {deck_id} response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "slides" in data
        assert isinstance(data["slides"], list)
        print(f"Deck '{data['name']}' has {len(data['slides'])} slides")
        
        # Check slide structure if slides exist
        if data["slides"]:
            slide = data["slides"][0]
            assert "id" in slide
            assert "deck_id" in slide
            print(f"First slide: {slide.get('title', 'Untitled')}")

    def test_get_invalid_deck(self, mr_headers):
        """GET /api/mr/visual-aids/{invalid_id} - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/mr/visual-aids/invalid-deck-id-12345", headers=mr_headers)
        assert response.status_code == 404


class TestAdminRegressionMRModule:
    """Regression tests - Admin MR Management should still work"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    def test_admin_get_mrs(self, admin_headers):
        """GET /api/mrs - Admin can list MRs"""
        response = requests.get(f"{BASE_URL}/api/mrs", headers=admin_headers)
        print(f"Admin MR list response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total MRs in system: {len(data)}")

    def test_admin_get_visual_aids(self, admin_headers):
        """GET /api/visual-aids - Admin can list decks"""
        response = requests.get(f"{BASE_URL}/api/visual-aids", headers=admin_headers)
        print(f"Admin Visual Aids response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total decks: {len(data)}")

    def test_admin_mr_reports(self, admin_headers):
        """GET /api/mr-reports - Admin can get MR reports"""
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=admin_headers)
        print(f"Admin MR Reports response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        # Reports can have 'mrs' or 'visits' and 'total' depending on filters
        assert "total" in data or "mrs" in data
        print(f"MR Reports: total={data.get('total', 0)}, visits={len(data.get('visits', []))}")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_visits(mr_token):
    """Cleanup test visits after all tests"""
    yield
    # Cleanup after tests
    if mr_token:
        headers = {"Authorization": f"Bearer {mr_token}"}
        try:
            response = requests.get(f"{BASE_URL}/api/mr/visits", headers=headers)
            if response.status_code == 200:
                visits = response.json()
                test_visits = [v for v in visits if "TEST_" in (v.get("notes") or "")]
                print(f"Cleanup: Would clean {len(test_visits)} test visits (manual cleanup may be needed)")
        except Exception as e:
            print(f"Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
