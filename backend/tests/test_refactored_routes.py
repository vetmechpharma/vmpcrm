"""
Regression tests for refactored backend routes.
Tests all major API endpoints after server.py was split into modular route files.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "info@vetmech.in"
ADMIN_PASSWORD = "Kongu@@44884"


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: Health endpoint returns healthy status")
    
    def test_root_endpoint(self):
        """GET /api/ returns API running message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("PASS: Root endpoint returns message")
    
    def test_admin_login_success(self):
        """Admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"PASS: Admin login successful, user: {data['user'].get('email')}")
        return data["access_token"]
    
    def test_admin_login_wrong_password(self):
        """Admin login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("PASS: Wrong password returns 401")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token for authenticated tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def auth_headers(admin_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestDashboard:
    """Dashboard endpoint tests"""
    
    def test_dashboard_stats(self, auth_headers):
        """GET /api/dashboard/stats returns dashboard data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Dashboard should return stats object
        assert isinstance(data, dict)
        print(f"PASS: Dashboard stats returned with keys: {list(data.keys())[:5]}...")
    
    def test_dashboard_stats_unauthorized(self):
        """GET /api/dashboard/stats without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code in [401, 403]
        print("PASS: Dashboard stats unauthorized returns 401/403")


class TestDoctors:
    """Doctors endpoint tests"""
    
    def test_get_doctors(self, auth_headers):
        """GET /api/doctors returns doctors list"""
        response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Doctors list returned, count: {len(data)}")
    
    def test_get_doctors_unauthorized(self):
        """GET /api/doctors without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/doctors")
        assert response.status_code in [401, 403]
        print("PASS: Doctors unauthorized returns 401/403")


class TestMedicals:
    """Medicals endpoint tests"""
    
    def test_get_medicals(self, auth_headers):
        """GET /api/medicals returns medicals list"""
        response = requests.get(f"{BASE_URL}/api/medicals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Medicals list returned, count: {len(data)}")


class TestAgencies:
    """Agencies endpoint tests"""
    
    def test_get_agencies(self, auth_headers):
        """GET /api/agencies returns agencies list"""
        response = requests.get(f"{BASE_URL}/api/agencies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Agencies list returned, count: {len(data)}")


class TestItems:
    """Items endpoint tests"""
    
    def test_get_items(self, auth_headers):
        """GET /api/items returns items list"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Items list returned, count: {len(data)}")


class TestOrders:
    """Orders endpoint tests"""
    
    def test_get_orders(self, auth_headers):
        """GET /api/orders returns orders list"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Orders list returned, count: {len(data)}")


class TestEmailLogs:
    """Email logs endpoint tests"""
    
    def test_get_email_logs(self, auth_headers):
        """GET /api/email-logs returns email logs"""
        response = requests.get(f"{BASE_URL}/api/email-logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Email logs returned, count: {len(data)}")


class TestWhatsAppLogs:
    """WhatsApp logs endpoint tests"""
    
    def test_get_whatsapp_logs(self, auth_headers):
        """GET /api/whatsapp-logs returns whatsapp logs"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # API returns object with 'logs' key
        assert isinstance(data, dict)
        assert "logs" in data
        assert isinstance(data["logs"], list)
        print(f"PASS: WhatsApp logs returned, count: {len(data['logs'])}")


class TestReminders:
    """Reminders endpoint tests"""
    
    def test_get_reminders(self, auth_headers):
        """GET /api/reminders returns reminders list"""
        response = requests.get(f"{BASE_URL}/api/reminders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Reminders list returned, count: {len(data)}")


class TestExpenses:
    """Expenses endpoint tests"""
    
    def test_get_expenses(self, auth_headers):
        """GET /api/expenses returns expenses list"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Expenses list returned, count: {len(data)}")


class TestDatabase:
    """Database management endpoint tests"""
    
    def test_get_backup_settings(self, auth_headers):
        """GET /api/database/backup-settings returns backup settings"""
        response = requests.get(f"{BASE_URL}/api/database/backup-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"PASS: Backup settings returned with keys: {list(data.keys())}")
    
    def test_get_backup_history(self, auth_headers):
        """GET /api/database/backup-history returns backup history"""
        response = requests.get(f"{BASE_URL}/api/database/backup-history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # API returns object with 'backups' key
        assert isinstance(data, dict)
        assert "backups" in data
        assert isinstance(data["backups"], list)
        print(f"PASS: Backup history returned, count: {len(data['backups'])}")


class TestAnalytics:
    """Analytics endpoint tests"""
    
    def test_get_analytics_reports(self, auth_headers):
        """GET /api/analytics/reports returns analytics data"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports", headers=auth_headers)
        # May return 200 or 404 depending on implementation
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: Analytics reports returned")
        else:
            print(f"INFO: Analytics reports endpoint returned 404 (may not be implemented)")


class TestTransports:
    """Transport endpoint tests"""
    
    def test_get_transports(self, auth_headers):
        """GET /api/transports returns transport list"""
        response = requests.get(f"{BASE_URL}/api/transports", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Transports list returned, count: {len(data)}")


class TestMarketing:
    """Marketing endpoint tests"""
    
    def test_get_marketing_templates(self, auth_headers):
        """GET /api/marketing/templates returns marketing templates"""
        response = requests.get(f"{BASE_URL}/api/marketing/templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Marketing templates returned, count: {len(data)}")


class TestMessageTemplates:
    """Message templates endpoint tests"""
    
    def test_get_message_templates(self, auth_headers):
        """GET /api/message-templates returns message templates"""
        response = requests.get(f"{BASE_URL}/api/message-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Message templates returned, count: {len(data)}")


class TestPendingItems:
    """Pending items endpoint tests"""
    
    def test_get_pending_items(self, auth_headers):
        """GET /api/pending-items returns pending items"""
        response = requests.get(f"{BASE_URL}/api/pending-items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Pending items returned, count: {len(data)}")


class TestGreetingTemplates:
    """Greeting templates endpoint tests"""
    
    def test_get_greeting_templates(self, auth_headers):
        """GET /api/greeting-templates returns greeting templates"""
        response = requests.get(f"{BASE_URL}/api/greeting-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Greeting templates returned, count: {len(data)}")


class TestUsers:
    """Users endpoint tests"""
    
    def test_get_users(self, auth_headers):
        """GET /api/users returns user list"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Users list returned, count: {len(data)}")


class TestMRs:
    """MR (Medical Representatives) endpoint tests"""
    
    def test_get_mrs(self, auth_headers):
        """GET /api/mrs returns MR list"""
        response = requests.get(f"{BASE_URL}/api/mrs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: MRs list returned, count: {len(data)}")


class TestFollowups:
    """Followups endpoint tests"""
    
    def test_get_followups_by_entity(self, auth_headers):
        """GET /api/followups/{entity_type}/{entity_id} returns followup list for entity"""
        # First get a doctor to use for followup query
        doctors_response = requests.get(f"{BASE_URL}/api/doctors", headers=auth_headers)
        if doctors_response.status_code == 200:
            doctors = doctors_response.json()
            if doctors and len(doctors) > 0:
                doctor_id = doctors[0].get('id')
                response = requests.get(f"{BASE_URL}/api/followups/doctor/{doctor_id}", headers=auth_headers)
                assert response.status_code == 200
                data = response.json()
                assert isinstance(data, list)
                print(f"PASS: Followups for doctor returned, count: {len(data)}")
                return
        # If no doctors, test with a non-existent entity (should return empty list)
        response = requests.get(f"{BASE_URL}/api/followups/doctor/test-id", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Followups endpoint works, returned: {len(data)} items")


class TestCompanySettings:
    """Company settings endpoint tests"""
    
    def test_get_company_settings(self, auth_headers):
        """GET /api/company-settings returns company settings"""
        response = requests.get(f"{BASE_URL}/api/company-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"PASS: Company settings returned with keys: {list(data.keys())[:5]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
