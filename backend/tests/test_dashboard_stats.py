"""
Test comprehensive dashboard statistics endpoint
Tests all sections: customers, orders, pending items, expenses, items, support tickets
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@vmpcrm.com", "password": "admin123"},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestComprehensiveStatsStructure:
    """Test the structure of comprehensive-stats response"""
    
    def test_endpoint_returns_200(self, headers):
        """Test that comprehensive-stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_response_has_all_required_sections(self, headers):
        """Test that response contains all required sections"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        data = response.json()
        
        required_sections = ['customers', 'orders', 'pending_items', 'expenses', 'items', 'support_tickets']
        for section in required_sections:
            assert section in data, f"Missing section: {section}"
    
    def test_requires_authentication(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}"


class TestCustomersStats:
    """Test customers section (doctors, medicals, agencies)"""
    
    def test_customers_has_doctors_medicals_agencies(self, headers):
        """Test customers section has all entity types"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        customers = response.json()['customers']
        
        assert 'doctors' in customers
        assert 'medicals' in customers
        assert 'agencies' in customers
        assert 'combined_by_status' in customers
        assert 'total_all' in customers
    
    def test_doctors_stats_structure(self, headers):
        """Test doctors stats has total and by_status breakdown"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        doctors = response.json()['customers']['doctors']
        
        assert 'total' in doctors
        assert 'by_status' in doctors
        assert isinstance(doctors['total'], int)
        assert isinstance(doctors['by_status'], dict)
        
        # Check all lead statuses are present
        expected_statuses = ['Customer', 'Contacted', 'Pipeline', 'Not Interested', 'Closed']
        for status in expected_statuses:
            assert status in doctors['by_status'], f"Missing status: {status}"
    
    def test_medicals_stats_structure(self, headers):
        """Test medicals stats has total and by_status breakdown"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        medicals = response.json()['customers']['medicals']
        
        assert 'total' in medicals
        assert 'by_status' in medicals
        assert isinstance(medicals['total'], int)
    
    def test_agencies_stats_structure(self, headers):
        """Test agencies stats has total and by_status breakdown"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        agencies = response.json()['customers']['agencies']
        
        assert 'total' in agencies
        assert 'by_status' in agencies
        assert isinstance(agencies['total'], int)
    
    def test_combined_status_calculation(self, headers):
        """Test combined_by_status is sum of all entity types"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        customers = response.json()['customers']
        
        combined = customers['combined_by_status']
        doctors_status = customers['doctors']['by_status']
        medicals_status = customers['medicals']['by_status']
        agencies_status = customers['agencies']['by_status']
        
        for status in ['Customer', 'Contacted', 'Pipeline', 'Not Interested', 'Closed']:
            expected = doctors_status.get(status, 0) + medicals_status.get(status, 0) + agencies_status.get(status, 0)
            assert combined.get(status, 0) == expected, f"Mismatch for {status}: expected {expected}, got {combined.get(status, 0)}"
    
    def test_total_all_calculation(self, headers):
        """Test total_all is sum of all entity totals"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        customers = response.json()['customers']
        
        expected_total = customers['doctors']['total'] + customers['medicals']['total'] + customers['agencies']['total']
        assert customers['total_all'] == expected_total, f"Expected {expected_total}, got {customers['total_all']}"


class TestOrdersStats:
    """Test orders section with status breakdown"""
    
    def test_orders_stats_structure(self, headers):
        """Test orders stats has total, by_status, recent_7_days"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        orders = response.json()['orders']
        
        assert 'total' in orders
        assert 'by_status' in orders
        assert 'recent_7_days' in orders
    
    def test_orders_all_statuses_present(self, headers):
        """Test all order statuses are present"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        by_status = response.json()['orders']['by_status']
        
        expected_statuses = ['pending', 'confirmed', 'ready_to_despatch', 'shipped', 'delivered', 'cancelled']
        for status in expected_statuses:
            assert status in by_status, f"Missing order status: {status}"
            assert isinstance(by_status[status], int)
    
    def test_orders_total_matches_sum_of_statuses(self, headers):
        """Test total orders equals sum of all statuses"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        orders = response.json()['orders']
        
        sum_statuses = sum(orders['by_status'].values())
        assert orders['total'] == sum_statuses, f"Total {orders['total']} != sum of statuses {sum_statuses}"


class TestPendingItemsStats:
    """Test pending items section with qty-wise stats"""
    
    def test_pending_items_stats_structure(self, headers):
        """Test pending items has total_items, total_quantity, by_item"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        pending = response.json()['pending_items']
        
        assert 'total_items' in pending
        assert 'total_quantity' in pending
        assert 'by_item' in pending
        
        assert isinstance(pending['total_items'], int)
        assert isinstance(pending['total_quantity'], int)
        assert isinstance(pending['by_item'], dict)
    
    def test_pending_items_by_item_sorted_by_quantity(self, headers):
        """Test by_item is sorted by quantity descending"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        by_item = response.json()['pending_items']['by_item']
        
        if len(by_item) > 1:
            values = list(by_item.values())
            for i in range(len(values) - 1):
                assert values[i] >= values[i + 1], "by_item should be sorted descending by quantity"


class TestExpensesStats:
    """Test expenses section with monthly comparison"""
    
    def test_expenses_stats_structure(self, headers):
        """Test expenses has current/previous month, change_percent, by_category"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        expenses = response.json()['expenses']
        
        assert 'current_month_total' in expenses
        assert 'previous_month_total' in expenses
        assert 'change_percent' in expenses
        assert 'by_category' in expenses
        assert 'by_payment_type' in expenses
    
    def test_expenses_values_are_numeric(self, headers):
        """Test expenses values are numeric"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        expenses = response.json()['expenses']
        
        assert isinstance(expenses['current_month_total'], (int, float))
        assert isinstance(expenses['previous_month_total'], (int, float))
        assert isinstance(expenses['change_percent'], (int, float))


class TestItemsStats:
    """Test items section with categories, most/least ordered, stale items"""
    
    def test_items_stats_structure(self, headers):
        """Test items has total, categories, most_ordered, least_ordered, stale"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        items = response.json()['items']
        
        assert 'total' in items
        assert 'by_main_category' in items
        assert 'by_subcategory' in items
        assert 'most_ordered' in items
        assert 'least_ordered' in items
        assert 'no_orders_30_days' in items
        assert 'stale_count' in items
    
    def test_most_ordered_items_structure(self, headers):
        """Test most_ordered items have item_name and order_count"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        most_ordered = response.json()['items']['most_ordered']
        
        if len(most_ordered) > 0:
            for item in most_ordered:
                assert 'item_name' in item
                assert 'order_count' in item
    
    def test_least_ordered_items_structure(self, headers):
        """Test least_ordered items have item_name, item_code, order_count"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        least_ordered = response.json()['items']['least_ordered']
        
        if len(least_ordered) > 0:
            for item in least_ordered:
                assert 'item_name' in item
                assert 'item_code' in item
                assert 'order_count' in item
    
    def test_stale_items_structure(self, headers):
        """Test no_orders_30_days items have item_name and item_code"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        stale = response.json()['items']['no_orders_30_days']
        
        if len(stale) > 0:
            for item in stale:
                assert 'item_name' in item
                assert 'item_code' in item


class TestSupportTicketsStats:
    """Test support tickets section with status breakdown"""
    
    def test_support_tickets_stats_structure(self, headers):
        """Test support_tickets has total, by_status, recent_7_days"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        tickets = response.json()['support_tickets']
        
        assert 'total' in tickets
        assert 'by_status' in tickets
        assert 'recent_7_days' in tickets
    
    def test_support_tickets_all_statuses_present(self, headers):
        """Test all ticket statuses are present"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        by_status = response.json()['support_tickets']['by_status']
        
        expected_statuses = ['open', 'in_progress', 'resolved', 'closed']
        for status in expected_statuses:
            assert status in by_status, f"Missing ticket status: {status}"
    
    def test_support_tickets_total_matches_sum(self, headers):
        """Test total tickets equals sum of all statuses"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        tickets = response.json()['support_tickets']
        
        sum_statuses = sum(tickets['by_status'].values())
        assert tickets['total'] == sum_statuses, f"Total {tickets['total']} != sum of statuses {sum_statuses}"


class TestExpectedValues:
    """Test expected values based on database content"""
    
    def test_doctors_count(self, headers):
        """Verify doctors count matches expected value"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        doctors_total = response.json()['customers']['doctors']['total']
        
        # Verify against /api/doctors endpoint
        doctors_response = requests.get(f"{BASE_URL}/api/doctors", headers=headers)
        actual_count = len(doctors_response.json())
        
        assert doctors_total == actual_count, f"Dashboard shows {doctors_total}, actual is {actual_count}"
    
    def test_medicals_count(self, headers):
        """Verify medicals count matches expected value"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        medicals_total = response.json()['customers']['medicals']['total']
        
        # Verify against /api/medicals endpoint
        medicals_response = requests.get(f"{BASE_URL}/api/medicals", headers=headers)
        actual_count = len(medicals_response.json())
        
        assert medicals_total == actual_count, f"Dashboard shows {medicals_total}, actual is {actual_count}"
    
    def test_agencies_count(self, headers):
        """Verify agencies count matches expected value"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        agencies_total = response.json()['customers']['agencies']['total']
        
        # Verify against /api/agencies endpoint
        agencies_response = requests.get(f"{BASE_URL}/api/agencies", headers=headers)
        actual_count = len(agencies_response.json())
        
        assert agencies_total == actual_count, f"Dashboard shows {agencies_total}, actual is {actual_count}"
    
    def test_orders_count(self, headers):
        """Verify orders count matches expected value"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        orders_total = response.json()['orders']['total']
        
        # Verify against /api/orders endpoint
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        actual_count = len(orders_response.json())
        
        assert orders_total == actual_count, f"Dashboard shows {orders_total}, actual is {actual_count}"
    
    def test_items_count(self, headers):
        """Verify items count matches expected value"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        items_total = response.json()['items']['total']
        
        # Verify against /api/items endpoint
        items_response = requests.get(f"{BASE_URL}/api/items", headers=headers)
        actual_count = len(items_response.json())
        
        assert items_total == actual_count, f"Dashboard shows {items_total}, actual is {actual_count}"
    
    def test_pending_items_count(self, headers):
        """Verify pending items count matches expected value"""
        response = requests.get(f"{BASE_URL}/api/dashboard/comprehensive-stats", headers=headers)
        pending_count = response.json()['pending_items']['total_items']
        
        # Verify against /api/pending-items endpoint
        pending_response = requests.get(f"{BASE_URL}/api/pending-items", headers=headers)
        actual_count = len(pending_response.json())
        
        assert pending_count == actual_count, f"Dashboard shows {pending_count}, actual is {actual_count}"
