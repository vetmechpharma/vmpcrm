"""
Test suite for Analytics Reports API
Tests the GET /api/analytics/reports endpoint with various period parameters
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAnalyticsReports:
    """Analytics Reports endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_reports_default_period(self):
        """Test reports with default 6months period"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify period
        assert data.get('period') == '6months', "Default period should be 6months"
        
        # Verify summary structure
        summary = data.get('summary', {})
        assert 'total_revenue' in summary, "Missing total_revenue in summary"
        assert 'total_orders' in summary, "Missing total_orders in summary"
        assert 'total_payments' in summary, "Missing total_payments in summary"
        assert 'total_customers' in summary, "Missing total_customers in summary"
        assert 'entity_counts' in summary, "Missing entity_counts in summary"
        
        # Verify entity_counts structure
        entity_counts = summary.get('entity_counts', {})
        assert 'doctors' in entity_counts, "Missing doctors count"
        assert 'medicals' in entity_counts, "Missing medicals count"
        assert 'agencies' in entity_counts, "Missing agencies count"
        
        print(f"Default period test passed - Revenue: Rs.{summary['total_revenue']}, Orders: {summary['total_orders']}")
    
    def test_reports_1month_period(self):
        """Test reports with 1month period"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=1month", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get('period') == '1month', "Period should be 1month"
        print(f"1month period test passed - Orders: {data['summary']['total_orders']}")
    
    def test_reports_3months_period(self):
        """Test reports with 3months period"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=3months", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get('period') == '3months', "Period should be 3months"
        print(f"3months period test passed - Orders: {data['summary']['total_orders']}")
    
    def test_reports_1year_period(self):
        """Test reports with 1year period"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=1year", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get('period') == '1year', "Period should be 1year"
        print(f"1year period test passed - Orders: {data['summary']['total_orders']}")
    
    def test_reports_orders_over_time(self):
        """Test orders_over_time data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        orders_over_time = data.get('orders_over_time', [])
        assert isinstance(orders_over_time, list), "orders_over_time should be a list"
        
        if orders_over_time:
            first_entry = orders_over_time[0]
            assert 'month' in first_entry, "Missing month field"
            assert 'orders' in first_entry, "Missing orders field"
            assert 'revenue' in first_entry, "Missing revenue field"
            assert 'avg_value' in first_entry, "Missing avg_value field"
            print(f"orders_over_time test passed - {len(orders_over_time)} months of data")
    
    def test_reports_order_status_distribution(self):
        """Test order_status_distribution data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        order_status = data.get('order_status_distribution', [])
        assert isinstance(order_status, list), "order_status_distribution should be a list"
        
        if order_status:
            first_entry = order_status[0]
            assert 'status' in first_entry, "Missing status field"
            assert 'count' in first_entry, "Missing count field"
            print(f"order_status_distribution test passed - {len(order_status)} statuses")
    
    def test_reports_top_products(self):
        """Test top_products data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        top_products = data.get('top_products', [])
        assert isinstance(top_products, list), "top_products should be a list"
        
        if top_products:
            first_product = top_products[0]
            assert 'name' in first_product, "Missing name field"
            assert 'qty' in first_product, "Missing qty field"
            assert 'revenue' in first_product, "Missing revenue field"
            assert 'orders' in first_product, "Missing orders field"
            print(f"top_products test passed - {len(top_products)} products, top: {first_product['name']}")
    
    def test_reports_slow_movers(self):
        """Test slow_movers data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        slow_movers = data.get('slow_movers', [])
        assert isinstance(slow_movers, list), "slow_movers should be a list"
        
        if slow_movers:
            first_item = slow_movers[0]
            assert 'name' in first_item, "Missing name field"
            assert 'code' in first_item, "Missing code field"
            assert 'orders' in first_item, "Missing orders field"
            print(f"slow_movers test passed - {len(slow_movers)} items")
    
    def test_reports_top_doctors(self):
        """Test top_doctors data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        top_doctors = data.get('top_doctors', [])
        assert isinstance(top_doctors, list), "top_doctors should be a list"
        
        if top_doctors:
            first_doc = top_doctors[0]
            assert 'name' in first_doc, "Missing name field"
            assert 'revenue' in first_doc, "Missing revenue field"
            assert 'orders' in first_doc, "Missing orders field"
            print(f"top_doctors test passed - {len(top_doctors)} doctors")
    
    def test_reports_top_medicals(self):
        """Test top_medicals data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        top_medicals = data.get('top_medicals', [])
        assert isinstance(top_medicals, list), "top_medicals should be a list"
        print(f"top_medicals test passed - {len(top_medicals)} medicals")
    
    def test_reports_top_agencies(self):
        """Test top_agencies data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        top_agencies = data.get('top_agencies', [])
        assert isinstance(top_agencies, list), "top_agencies should be a list"
        print(f"top_agencies test passed - {len(top_agencies)} agencies")
    
    def test_reports_frequent_orderers(self):
        """Test frequent_orderers data structure (3+ orders)"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        frequent_orderers = data.get('frequent_orderers', [])
        assert isinstance(frequent_orderers, list), "frequent_orderers should be a list"
        
        if frequent_orderers:
            first_orderer = frequent_orderers[0]
            assert 'name' in first_orderer, "Missing name field"
            assert 'orders' in first_orderer, "Missing orders field"
            assert 'revenue' in first_orderer, "Missing revenue field"
            assert 'last_order' in first_orderer, "Missing last_order field"
            # Verify 3+ orders requirement
            assert first_orderer['orders'] >= 3, "Frequent orderers should have 3+ orders"
            print(f"frequent_orderers test passed - {len(frequent_orderers)} frequent orderers")
    
    def test_reports_dormant_customers(self):
        """Test dormant_customers data structure (30/60/90 days)"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        dormant = data.get('dormant_customers', {})
        assert isinstance(dormant, dict), "dormant_customers should be a dict"
        
        # Verify all three tabs exist
        assert '30_days' in dormant, "Missing 30_days dormant data"
        assert '60_days' in dormant, "Missing 60_days dormant data"
        assert '90_days' in dormant, "Missing 90_days dormant data"
        
        # Verify structure if data exists
        for key in ['30_days', '60_days', '90_days']:
            if dormant[key]:
                first_dormant = dormant[key][0]
                assert 'name' in first_dormant, f"Missing name in {key}"
                assert 'last_order' in first_dormant, f"Missing last_order in {key}"
                assert 'total_orders' in first_dormant, f"Missing total_orders in {key}"
                assert 'revenue' in first_dormant, f"Missing revenue in {key}"
        
        print(f"dormant_customers test passed - 30d:{len(dormant['30_days'])}, 60d:{len(dormant['60_days'])}, 90d:{len(dormant['90_days'])}")
    
    def test_reports_orders_by_day_of_week(self):
        """Test orders_by_day_of_week data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        orders_dow = data.get('orders_by_day_of_week', [])
        assert isinstance(orders_dow, list), "orders_by_day_of_week should be a list"
        
        if orders_dow:
            first_day = orders_dow[0]
            assert 'day' in first_day, "Missing day field"
            assert 'orders' in first_day, "Missing orders field"
            print(f"orders_by_day_of_week test passed - {len(orders_dow)} days with data")
    
    def test_reports_payment_modes(self):
        """Test payment_modes data structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports?period=6months", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        payment_modes = data.get('payment_modes', [])
        assert isinstance(payment_modes, list), "payment_modes should be a list"
        
        if payment_modes:
            first_mode = payment_modes[0]
            assert 'mode' in first_mode, "Missing mode field"
            assert 'total' in first_mode, "Missing total field"
            print(f"payment_modes test passed - {len(payment_modes)} payment modes")
    
    def test_reports_unauthorized(self):
        """Test reports endpoint without auth"""
        response = requests.get(f"{BASE_URL}/api/analytics/reports")
        assert response.status_code in [401, 403], f"Should be unauthorized: {response.status_code}"
        print("Unauthorized test passed")
    
    def test_reports_non_admin(self):
        """Test reports endpoint with non-admin user (if exists)"""
        # Try to login as staff user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "staff@vmpcrm.com",
            "password": "staff123"
        })
        
        if login_response.status_code == 200:
            staff_token = login_response.json()["access_token"]
            staff_headers = {"Authorization": f"Bearer {staff_token}"}
            
            response = requests.get(f"{BASE_URL}/api/analytics/reports", headers=staff_headers)
            assert response.status_code == 403, f"Non-admin should get 403: {response.status_code}"
            print("Non-admin test passed - correctly denied")
        else:
            print("Non-admin test skipped - no staff user exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
