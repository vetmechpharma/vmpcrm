"""
Test Stock Edit/Delete functionality for Sales Return and Stock Issue
Tests the following features:
- GET /api/stock/sales-returns - Get sales return records
- PUT /api/stock/transaction/{id} - Update a transaction record
- DELETE /api/stock/transaction/{id} - Delete a transaction record
- GET /api/stock/issues - Get stock issue records
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "info@vetmech.in",
            "password": "Kongu@@44884"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_admin_login(self, auth_token):
        """Test admin login works"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Admin login successful, token length: {len(auth_token)}")


class TestSalesReturnAPI:
    """Sales Return API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "info@vetmech.in",
            "password": "Kongu@@44884"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_item(self, auth_headers):
        """Create a test item for transactions"""
        item_data = {
            "item_name": f"TEST_STOCK_EDIT_{uuid.uuid4().hex[:8]}",
            "item_code": f"TSE{uuid.uuid4().hex[:6]}",
            "category": "Test",
            "unit": "pcs",
            "gst": 18
        }
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=auth_headers)
        if response.status_code == 200:
            return response.json()
        return None
    
    def test_get_sales_returns(self, auth_headers):
        """Test GET /api/stock/sales-returns returns list"""
        response = requests.get(f"{BASE_URL}/api/stock/sales-returns", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/stock/sales-returns returned {len(data)} records")
    
    def test_create_sales_return(self, auth_headers, test_item):
        """Test creating a sales return for edit/delete testing"""
        if not test_item:
            pytest.skip("No test item available")
        
        sales_return_data = {
            "item_id": test_item["id"],
            "customer_name": "TEST_CUSTOMER",
            "customer_phone": "9999888877",
            "date": "2025-01-15",
            "notes": "Test sales return for edit/delete",
            "items": [{
                "item_id": test_item["id"],
                "quantity": 5,
                "rate": 100,
                "gst_percent": 18
            }]
        }
        response = requests.post(f"{BASE_URL}/api/stock/sales-return", json=sales_return_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create sales return: {response.text}"
        print(f"✓ Created sales return successfully")
        return response.json()


class TestStockIssueAPI:
    """Stock Issue API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "info@vetmech.in",
            "password": "Kongu@@44884"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_item(self, auth_headers):
        """Create a test item for transactions"""
        item_data = {
            "item_name": f"TEST_STOCK_ISSUE_{uuid.uuid4().hex[:8]}",
            "item_code": f"TSI{uuid.uuid4().hex[:6]}",
            "category": "Test",
            "unit": "pcs",
            "gst": 18
        }
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=auth_headers)
        if response.status_code == 200:
            return response.json()
        return None
    
    def test_get_stock_issues(self, auth_headers):
        """Test GET /api/stock/issues returns list"""
        response = requests.get(f"{BASE_URL}/api/stock/issues", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/stock/issues returned {len(data)} records")
    
    def test_create_stock_issue(self, auth_headers, test_item):
        """Test creating a stock issue for edit/delete testing"""
        if not test_item:
            pytest.skip("No test item available")
        
        stock_issue_data = {
            "item_id": test_item["id"],
            "quantity": 3,
            "reason": "Damage",
            "date": "2025-01-15",
            "notes": "Test stock issue for edit/delete"
        }
        response = requests.post(f"{BASE_URL}/api/stock/issue", json=stock_issue_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create stock issue: {response.text}"
        print(f"✓ Created stock issue successfully")
        return response.json()


class TestTransactionEditDelete:
    """Test PUT and DELETE for transactions"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "info@vetmech.in",
            "password": "Kongu@@44884"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_item(self, auth_headers):
        """Create a test item for transactions"""
        item_data = {
            "item_name": f"TEST_TXN_EDIT_{uuid.uuid4().hex[:8]}",
            "item_code": f"TTE{uuid.uuid4().hex[:6]}",
            "category": "Test",
            "unit": "pcs",
            "gst": 18
        }
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=auth_headers)
        if response.status_code == 200:
            return response.json()
        return None
    
    def test_create_and_update_sales_return(self, auth_headers, test_item):
        """Test creating and updating a sales return"""
        if not test_item:
            pytest.skip("No test item available")
        
        # Create sales return
        sales_return_data = {
            "item_id": test_item["id"],
            "customer_name": "TEST_UPDATE_CUSTOMER",
            "customer_phone": "9999777766",
            "date": "2025-01-15",
            "notes": "Original notes",
            "items": [{
                "item_id": test_item["id"],
                "quantity": 5,
                "rate": 100,
                "gst_percent": 18
            }]
        }
        create_response = requests.post(f"{BASE_URL}/api/stock/sales-return", json=sales_return_data, headers=auth_headers)
        assert create_response.status_code == 200, f"Failed to create: {create_response.text}"
        
        # Get the created transaction ID from sales returns list
        list_response = requests.get(f"{BASE_URL}/api/stock/sales-returns", headers=auth_headers)
        returns = list_response.json()
        test_return = next((r for r in returns if r.get('customer_name') == 'TEST_UPDATE_CUSTOMER'), None)
        
        if not test_return:
            pytest.skip("Could not find created sales return")
        
        txn_id = test_return['id']
        
        # Update the transaction
        update_data = {
            "quantity": 10,
            "rate": 150,
            "gst_percent": 12,
            "notes": "Updated notes"
        }
        update_response = requests.put(f"{BASE_URL}/api/stock/transaction/{txn_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/stock/sales-returns", headers=auth_headers)
        updated_returns = verify_response.json()
        updated_return = next((r for r in updated_returns if r.get('id') == txn_id), None)
        
        assert updated_return is not None, "Updated return not found"
        assert updated_return.get('quantity') == 10, f"Quantity not updated: {updated_return.get('quantity')}"
        assert updated_return.get('notes') == "Updated notes", f"Notes not updated: {updated_return.get('notes')}"
        
        print(f"✓ PUT /api/stock/transaction/{txn_id} updated successfully")
        
        # Cleanup - delete the transaction
        delete_response = requests.delete(f"{BASE_URL}/api/stock/transaction/{txn_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        print(f"✓ DELETE /api/stock/transaction/{txn_id} deleted successfully")
    
    def test_create_and_update_stock_issue(self, auth_headers, test_item):
        """Test creating and updating a stock issue"""
        if not test_item:
            pytest.skip("No test item available")
        
        # Create stock issue
        stock_issue_data = {
            "item_id": test_item["id"],
            "quantity": 3,
            "reason": "Damage",
            "date": "2025-01-15",
            "notes": "Original issue notes"
        }
        create_response = requests.post(f"{BASE_URL}/api/stock/issue", json=stock_issue_data, headers=auth_headers)
        assert create_response.status_code == 200, f"Failed to create: {create_response.text}"
        
        # Get the created transaction ID from stock issues list
        list_response = requests.get(f"{BASE_URL}/api/stock/issues", headers=auth_headers)
        issues = list_response.json()
        test_issue = next((i for i in issues if i.get('notes') == 'Original issue notes'), None)
        
        if not test_issue:
            pytest.skip("Could not find created stock issue")
        
        txn_id = test_issue['id']
        
        # Update the transaction
        update_data = {
            "quantity": 7,
            "reason": "Breakage",
            "notes": "Updated issue notes"
        }
        update_response = requests.put(f"{BASE_URL}/api/stock/transaction/{txn_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/stock/issues", headers=auth_headers)
        updated_issues = verify_response.json()
        updated_issue = next((i for i in updated_issues if i.get('id') == txn_id), None)
        
        assert updated_issue is not None, "Updated issue not found"
        assert updated_issue.get('quantity') == 7, f"Quantity not updated: {updated_issue.get('quantity')}"
        assert updated_issue.get('reason') == "Breakage", f"Reason not updated: {updated_issue.get('reason')}"
        
        print(f"✓ PUT /api/stock/transaction/{txn_id} (stock issue) updated successfully")
        
        # Cleanup - delete the transaction
        delete_response = requests.delete(f"{BASE_URL}/api/stock/transaction/{txn_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        print(f"✓ DELETE /api/stock/transaction/{txn_id} (stock issue) deleted successfully")
    
    def test_delete_nonexistent_transaction(self, auth_headers):
        """Test deleting a non-existent transaction returns 404"""
        fake_id = f"nonexistent_{uuid.uuid4().hex}"
        response = requests.delete(f"{BASE_URL}/api/stock/transaction/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ DELETE non-existent transaction returns 404")
    
    def test_update_nonexistent_transaction(self, auth_headers):
        """Test updating a non-existent transaction returns 404"""
        fake_id = f"nonexistent_{uuid.uuid4().hex}"
        update_data = {"quantity": 10}
        response = requests.put(f"{BASE_URL}/api/stock/transaction/{fake_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ PUT non-existent transaction returns 404")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "info@vetmech.in",
            "password": "Kongu@@44884"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_cleanup_test_items(self, auth_headers):
        """Clean up test items created during testing"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        if response.status_code == 200:
            items = response.json()
            test_items = [i for i in items if i.get('item_name', '').startswith('TEST_')]
            for item in test_items:
                requests.delete(f"{BASE_URL}/api/items/{item['id']}", headers=auth_headers)
            print(f"✓ Cleaned up {len(test_items)} test items")
