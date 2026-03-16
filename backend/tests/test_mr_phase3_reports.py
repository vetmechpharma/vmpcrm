"""
Test MR Phase 2 (PWA) and Phase 3 (MR Reports) functionality
- Phase 2: PWA manifest, service worker accessibility
- Phase 3: MR Reports API returns summary, mr_stats, visits, orders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPWAPhase2:
    """Phase 2 - PWA manifest and service worker tests"""
    
    def test_mr_manifest_accessible(self):
        """Test /mr-manifest.json is accessible and has correct structure"""
        response = requests.get(f"{BASE_URL}/mr-manifest.json")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'short_name' in data, "Missing short_name in manifest"
        assert 'name' in data, "Missing name in manifest"
        assert 'start_url' in data, "Missing start_url in manifest"
        assert 'scope' in data, "Missing scope in manifest"
        
        # Verify correct values
        assert data['start_url'] == '/mrvet/dashboard', f"start_url should be /mrvet/dashboard, got {data['start_url']}"
        assert data['scope'] == '/mrvet/', f"scope should be /mrvet/, got {data['scope']}"
        print(f"PWA Manifest: start_url={data['start_url']}, scope={data['scope']}")
    
    def test_service_worker_accessible(self):
        """Test /mr-sw.js service worker is accessible"""
        response = requests.get(f"{BASE_URL}/mr-sw.js")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content = response.text
        # Verify service worker contains caching strategies
        assert 'CACHE_VERSION' in content, "Service worker missing CACHE_VERSION"
        assert 'networkFirst' in content or 'network' in content.lower(), "Missing network-first caching strategy"
        assert 'cacheFirst' in content or 'cache' in content.lower(), "Missing cache-first caching strategy"
        assert 'install' in content, "Missing install event handler"
        assert 'activate' in content, "Missing activate event handler"
        assert 'fetch' in content, "Missing fetch event handler"
        print("Service worker contains required caching strategies")


class TestMRReportsPhase3:
    """Phase 3 - MR Reports API tests"""
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            data = response.json()
            # Admin auth returns access_token field (not token)
            return data.get('access_token') or data.get('token')
        pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")
    
    def test_mr_reports_endpoint_exists(self, admin_token):
        """Test GET /api/mr-reports returns data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"MR Reports API response status: {response.status_code}")
    
    def test_mr_reports_returns_required_fields(self, admin_token):
        """Test MR Reports returns summary, mr_stats, visits, orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required top-level fields
        assert 'summary' in data, "Missing 'summary' field in response"
        assert 'mr_stats' in data, "Missing 'mr_stats' field in response"
        assert 'visits' in data, "Missing 'visits' field in response"
        assert 'orders' in data, "Missing 'orders' field in response"
        assert 'total' in data, "Missing 'total' field in response"
        
        print(f"Response fields: summary, mr_stats, visits, orders, total - all present")
    
    def test_mr_reports_summary_structure(self, admin_token):
        """Test summary contains required stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        
        assert response.status_code == 200
        summary = response.json().get('summary', {})
        
        # Verify summary fields
        expected_fields = ['total_mrs', 'active_mrs', 'total_visits', 'today_visits', 'total_orders', 'pending_orders', 'states_covered']
        for field in expected_fields:
            assert field in summary, f"Missing '{field}' in summary"
        
        print(f"Summary: total_mrs={summary.get('total_mrs')}, active_mrs={summary.get('active_mrs')}, "
              f"total_visits={summary.get('total_visits')}, total_orders={summary.get('total_orders')}")
    
    def test_mr_reports_mr_stats_structure(self, admin_token):
        """Test mr_stats contains per-MR data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        
        assert response.status_code == 200
        mr_stats = response.json().get('mr_stats', [])
        
        assert isinstance(mr_stats, list), "mr_stats should be a list"
        
        if len(mr_stats) > 0:
            mr = mr_stats[0]
            expected_fields = ['id', 'name', 'status', 'total_visits', 'today_visits', 
                              'pending_followups', 'total_orders', 'cancelled_orders']
            for field in expected_fields:
                assert field in mr, f"Missing '{field}' in mr_stats item"
            print(f"MR Stats sample: name={mr.get('name')}, total_visits={mr.get('total_visits')}, total_orders={mr.get('total_orders')}")
        else:
            print("No MR stats data yet (empty list)")
    
    def test_mr_reports_visits_structure(self, admin_token):
        """Test visits array contains required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        
        assert response.status_code == 200
        visits = response.json().get('visits', [])
        
        assert isinstance(visits, list), "visits should be a list"
        
        if len(visits) > 0:
            v = visits[0]
            # Visit should have mr_name, entity_name, outcome, visit_date
            assert 'mr_name' in v, "Missing mr_name in visit"
            assert 'outcome' in v or 'visit_date' in v, "Visit missing expected fields"
            print(f"Visit sample: mr_name={v.get('mr_name')}, outcome={v.get('outcome')}")
        else:
            print("No visits data yet (empty list)")
    
    def test_mr_reports_orders_structure(self, admin_token):
        """Test orders array contains MR-placed orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        
        assert response.status_code == 200
        orders = response.json().get('orders', [])
        
        assert isinstance(orders, list), "orders should be a list"
        
        if len(orders) > 0:
            o = orders[0]
            # Order should have order_number, status, doctor_name
            assert 'order_number' in o, "Missing order_number in order"
            assert 'status' in o, "Missing status in order"
            print(f"Order sample: order_number={o.get('order_number')}, status={o.get('status')}, mr_name={o.get('mr_name')}")
        else:
            print("No MR orders data yet (empty list)")
    
    def test_mr_reports_filter_by_mr_id(self, admin_token):
        """Test filtering by mr_id parameter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get all MRs to find one to filter by
        response = requests.get(f"{BASE_URL}/api/mr-reports", headers=headers)
        assert response.status_code == 200
        mr_stats = response.json().get('mr_stats', [])
        
        if len(mr_stats) > 0:
            mr_id = mr_stats[0]['id']
            # Filter by this MR
            filtered_response = requests.get(f"{BASE_URL}/api/mr-reports?mr_id={mr_id}", headers=headers)
            assert filtered_response.status_code == 200
            print(f"Filtered by mr_id={mr_id}: status={filtered_response.status_code}")
        else:
            print("No MRs to filter by - skipping filter test")
    
    def test_mr_reports_filter_by_date_range(self, admin_token):
        """Test filtering by date range"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Filter by a date range
        from_date = "2025-01-01"
        to_date = "2026-12-31"
        response = requests.get(
            f"{BASE_URL}/api/mr-reports?from_date={from_date}&to_date={to_date}", 
            headers=headers
        )
        
        assert response.status_code == 200, f"Date filter failed: {response.status_code}"
        print(f"Date range filter ({from_date} to {to_date}): status={response.status_code}")
    
    def test_mr_reports_unauthorized_access(self):
        """Test MR Reports requires authentication"""
        response = requests.get(f"{BASE_URL}/api/mr-reports")
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"Unauthorized access correctly rejected: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
