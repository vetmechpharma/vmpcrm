"""
Stock & Inventory Module Tests
Tests: Suppliers CRUD, Opening Balances, Purchases, Returns, Stock Status, Ledgers, Availability
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "info@vetmech.in"
ADMIN_PASSWORD = "Kongu@@44884"

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_STOCK_"


@pytest.fixture(scope="module")
def auth_session():
    """Module-level auth session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login to get token
    login_response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code != 200:
        pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    token = login_response.json().get("access_token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def test_item(auth_session):
    """Get a test item for use in tests"""
    response = auth_session.get(f"{BASE_URL}/api/items")
    if response.status_code != 200 or not response.json():
        pytest.skip("No items available for testing")
    return response.json()[0]


# Track created suppliers for cleanup
created_supplier_ids = []


@pytest.fixture(scope="module", autouse=True)
def cleanup(auth_session):
    """Cleanup test data after all tests"""
    yield
    # Cleanup created suppliers
    for supplier_id in created_supplier_ids:
        try:
            auth_session.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        except:
            pass


# ============== SUPPLIER TESTS ==============

def test_01_get_suppliers_requires_auth():
    """GET /api/suppliers - requires authentication"""
    response = requests.get(f"{BASE_URL}/api/suppliers")
    assert response.status_code in [401, 403]
    print("PASS: GET /api/suppliers requires auth")


def test_02_get_suppliers_with_auth(auth_session):
    """GET /api/suppliers - returns list with auth"""
    response = auth_session.get(f"{BASE_URL}/api/suppliers")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    print(f"PASS: GET /api/suppliers returns {len(response.json())} suppliers")


def test_03_create_supplier(auth_session):
    """POST /api/suppliers - create supplier with name and mobile"""
    supplier_data = {
        "name": f"{TEST_PREFIX}Supplier_{uuid.uuid4().hex[:6]}",
        "mobile": "9876543210",
        "address": "Test Address",
        "gst_number": "29ABCDE1234F1Z5"
    }
    
    response = auth_session.post(f"{BASE_URL}/api/suppliers", json=supplier_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "id" in data
    assert data["name"] == supplier_data["name"]
    assert data["mobile"] == supplier_data["mobile"]
    assert data["status"] == "active"
    
    created_supplier_ids.append(data["id"])
    print(f"PASS: Created supplier {data['name']} with ID {data['id']}")
    
    # Verify persistence with GET
    get_response = auth_session.get(f"{BASE_URL}/api/suppliers")
    assert get_response.status_code == 200
    suppliers = get_response.json()
    found = any(s["id"] == data["id"] for s in suppliers)
    assert found, "Created supplier not found in list"
    print("PASS: Supplier persisted and found in GET list")


def test_04_create_supplier_requires_name(auth_session):
    """POST /api/suppliers - name is required"""
    response = auth_session.post(f"{BASE_URL}/api/suppliers", json={"mobile": "1234567890"})
    assert response.status_code == 400
    print("PASS: Supplier creation requires name")


def test_05_update_supplier(auth_session):
    """PUT /api/suppliers/{id} - update supplier"""
    # First create a supplier
    supplier_data = {
        "name": f"{TEST_PREFIX}UpdateTest_{uuid.uuid4().hex[:6]}",
        "mobile": "1111111111"
    }
    create_response = auth_session.post(f"{BASE_URL}/api/suppliers", json=supplier_data)
    assert create_response.status_code == 200
    supplier_id = create_response.json()["id"]
    created_supplier_ids.append(supplier_id)
    
    # Update the supplier
    update_data = {
        "name": f"{TEST_PREFIX}Updated_{uuid.uuid4().hex[:6]}",
        "mobile": "2222222222",
        "gst_number": "NEW_GST_123"
    }
    update_response = auth_session.put(f"{BASE_URL}/api/suppliers/{supplier_id}", json=update_data)
    assert update_response.status_code == 200
    
    # Verify update with GET
    get_response = auth_session.get(f"{BASE_URL}/api/suppliers")
    suppliers = get_response.json()
    updated = next((s for s in suppliers if s["id"] == supplier_id), None)
    assert updated is not None
    assert updated["mobile"] == "2222222222"
    print(f"PASS: Supplier updated successfully")


def test_06_update_nonexistent_supplier(auth_session):
    """PUT /api/suppliers/{id} - returns 404 for nonexistent"""
    response = auth_session.put(f"{BASE_URL}/api/suppliers/nonexistent-id", json={"name": "Test"})
    assert response.status_code == 404
    print("PASS: Update nonexistent supplier returns 404")


# ============== OPENING BALANCE TESTS ==============

def test_10_get_opening_balances(auth_session):
    """GET /api/stock/opening-balances - returns list"""
    response = auth_session.get(f"{BASE_URL}/api/stock/opening-balances")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    print(f"PASS: GET opening balances returns {len(response.json())} items")


def test_11_set_opening_balance(auth_session, test_item):
    """POST /api/stock/opening-balance - set opening balance for an item"""
    balance_data = {
        "item_id": test_item["id"],
        "quantity": 100,
        "date": "2025-01-01"
    }
    
    response = auth_session.post(f"{BASE_URL}/api/stock/opening-balance", json=balance_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["item_id"] == test_item["id"]
    assert data["quantity"] == 100
    print(f"PASS: Set opening balance for item {test_item['id']}")
    
    # Verify persistence
    get_response = auth_session.get(f"{BASE_URL}/api/stock/opening-balances")
    balances = get_response.json()
    found = any(b["item_id"] == test_item["id"] for b in balances)
    assert found, "Opening balance not persisted"
    print("PASS: Opening balance persisted")


def test_12_set_opening_balance_requires_item_id(auth_session):
    """POST /api/stock/opening-balance - item_id is required"""
    response = auth_session.post(f"{BASE_URL}/api/stock/opening-balance", json={"quantity": 50})
    assert response.status_code == 400
    print("PASS: Opening balance requires item_id")


def test_13_set_opening_balance_bulk(auth_session, test_item):
    """POST /api/stock/opening-balance/bulk - set opening balances"""
    bulk_data = {
        "items": [{"item_id": test_item["id"], "quantity": 50}],
        "date": "2025-01-01"
    }
    
    response = auth_session.post(f"{BASE_URL}/api/stock/opening-balance/bulk", json=bulk_data)
    assert response.status_code == 200
    assert "items" in response.json().get("message", "")
    print(f"PASS: Bulk opening balance set")


# ============== PURCHASE TESTS ==============

def test_20_get_purchases(auth_session):
    """GET /api/stock/purchases - returns purchase history"""
    response = auth_session.get(f"{BASE_URL}/api/stock/purchases")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    print(f"PASS: GET purchases returns {len(response.json())} records")


def test_21_create_purchase(auth_session, test_item):
    """POST /api/stock/purchase - record purchase with supplier, items, rates"""
    # Create a test supplier first
    supplier_data = {"name": f"{TEST_PREFIX}PurchaseSupplier_{uuid.uuid4().hex[:6]}", "mobile": "5555555555"}
    supplier_response = auth_session.post(f"{BASE_URL}/api/suppliers", json=supplier_data)
    assert supplier_response.status_code == 200
    supplier_id = supplier_response.json()["id"]
    created_supplier_ids.append(supplier_id)
    
    purchase_data = {
        "supplier_id": supplier_id,
        "date": "2025-01-15",
        "invoice_no": f"INV-{uuid.uuid4().hex[:6]}",
        "notes": "Test purchase",
        "items": [
            {"item_id": test_item["id"], "quantity": 25, "purchase_rate": 150.00}
        ]
    }
    
    response = auth_session.post(f"{BASE_URL}/api/stock/purchase", json=purchase_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "purchase_id" in data
    assert len(data.get("transactions", [])) == 1
    print(f"PASS: Purchase recorded with ID {data['purchase_id']}")
    
    # Verify in purchase history
    get_response = auth_session.get(f"{BASE_URL}/api/stock/purchases")
    purchases = get_response.json()
    found = any(p.get("purchase_id") == data["purchase_id"] for p in purchases)
    assert found, "Purchase not found in history"
    print("PASS: Purchase persisted in history")


def test_22_create_purchase_requires_supplier(auth_session, test_item):
    """POST /api/stock/purchase - supplier is required"""
    response = auth_session.post(f"{BASE_URL}/api/stock/purchase", json={
        "items": [{"item_id": test_item["id"], "quantity": 10}]
    })
    assert response.status_code == 400
    print("PASS: Purchase requires supplier")


def test_23_create_purchase_requires_items(auth_session):
    """POST /api/stock/purchase - at least one item required"""
    # Create supplier
    supplier_response = auth_session.post(f"{BASE_URL}/api/suppliers", json={
        "name": f"{TEST_PREFIX}NoItems_{uuid.uuid4().hex[:6]}"
    })
    supplier_id = supplier_response.json()["id"]
    created_supplier_ids.append(supplier_id)
    
    response = auth_session.post(f"{BASE_URL}/api/stock/purchase", json={
        "supplier_id": supplier_id,
        "items": []
    })
    assert response.status_code == 400
    print("PASS: Purchase requires at least one item")


# ============== PURCHASE RETURN TESTS ==============

def test_30_create_purchase_return(auth_session, test_item):
    """POST /api/stock/purchase-return - record purchase return"""
    # Create supplier
    supplier_response = auth_session.post(f"{BASE_URL}/api/suppliers", json={
        "name": f"{TEST_PREFIX}ReturnSupplier_{uuid.uuid4().hex[:6]}"
    })
    supplier_id = supplier_response.json()["id"]
    created_supplier_ids.append(supplier_id)
    
    return_data = {
        "supplier_id": supplier_id,
        "date": "2025-01-16",
        "notes": "Defective items",
        "items": [
            {"item_id": test_item["id"], "quantity": 5, "rate": 150.00}
        ]
    }
    
    response = auth_session.post(f"{BASE_URL}/api/stock/purchase-return", json=return_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "return_id" in data
    print(f"PASS: Purchase return recorded with ID {data['return_id']}")


# ============== SALES RETURN TESTS ==============

def test_40_create_sales_return(auth_session, test_item):
    """POST /api/stock/sales-return - record sales return"""
    return_data = {
        "customer_name": "Test Customer",
        "customer_phone": "9999888877",
        "order_id": "ORD-TEST-001",
        "date": "2025-01-17",
        "notes": "Customer returned",
        "items": [
            {"item_id": test_item["id"], "quantity": 2, "rate": 200.00}
        ]
    }
    
    response = auth_session.post(f"{BASE_URL}/api/stock/sales-return", json=return_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "return_id" in data
    print(f"PASS: Sales return recorded with ID {data['return_id']}")


def test_41_sales_return_requires_items(auth_session):
    """POST /api/stock/sales-return - at least one item required"""
    response = auth_session.post(f"{BASE_URL}/api/stock/sales-return", json={
        "customer_name": "Test",
        "items": []
    })
    assert response.status_code == 400
    print("PASS: Sales return requires at least one item")


# ============== STOCK STATUS TESTS ==============

def test_50_get_stock_status(auth_session):
    """GET /api/stock/status - returns stock status with closing balance"""
    response = auth_session.get(f"{BASE_URL}/api/stock/status")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    
    if data:
        # Verify structure of stock status
        item = data[0]
        required_fields = ['item_id', 'item_name', 'opening_balance', 'purchased', 
                         'purchase_returned', 'sold', 'sales_returned', 'closing_balance']
        for field in required_fields:
            assert field in item, f"Missing field: {field}"
        
        # Verify closing balance calculation
        # closing = opening + purchased + sales_returned - sold - purchase_returned
        expected_closing = (item['opening_balance'] + item['purchased'] + 
                          item['sales_returned'] - item['sold'] - item['purchase_returned'])
        assert item['closing_balance'] == expected_closing, "Closing balance calculation incorrect"
        print(f"PASS: Stock status calculation verified for {item['item_name']}")
    
    print(f"PASS: GET stock status returns {len(data)} items")


def test_51_get_stock_status_for_specific_item(auth_session, test_item):
    """GET /api/stock/status?item_id=xxx - returns status for specific item"""
    response = auth_session.get(f"{BASE_URL}/api/stock/status", params={"item_id": test_item["id"]})
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    if data:
        assert len(data) == 1
        assert data[0]["item_id"] == test_item["id"]
    print(f"PASS: Stock status for specific item works")


# ============== ITEM LEDGER TESTS ==============

def test_60_get_item_ledger(auth_session, test_item):
    """GET /api/stock/item-ledger/{item_id} - returns credit/debit ledger"""
    response = auth_session.get(f"{BASE_URL}/api/stock/item-ledger/{test_item['id']}")
    assert response.status_code == 200
    
    data = response.json()
    assert "item_id" in data
    assert "opening_balance" in data
    assert "ledger" in data
    assert "closing_balance" in data
    assert isinstance(data["ledger"], list)
    
    # Verify ledger entry structure if entries exist
    if data["ledger"]:
        entry = data["ledger"][0]
        required_fields = ['date', 'type', 'description', 'credit', 'debit', 'balance']
        for field in required_fields:
            assert field in entry, f"Missing ledger field: {field}"
    
    print(f"PASS: Item ledger returns {len(data['ledger'])} entries")


# ============== USER LEDGER TESTS ==============

def test_70_get_user_ledger_by_name(auth_session):
    """GET /api/stock/user-ledger?customer_name=xyz - returns user-wise ledger"""
    response = auth_session.get(f"{BASE_URL}/api/stock/user-ledger", params={"customer_name": "test"})
    assert response.status_code == 200
    
    data = response.json()
    assert "item_totals" in data
    assert "orders" in data
    assert isinstance(data["orders"], list)
    print(f"PASS: User ledger by name returns {len(data['orders'])} orders")


def test_71_get_user_ledger_by_phone(auth_session):
    """GET /api/stock/user-ledger?customer_phone=xxx - returns user-wise ledger"""
    response = auth_session.get(f"{BASE_URL}/api/stock/user-ledger", params={"customer_phone": "9999"})
    assert response.status_code == 200
    
    data = response.json()
    assert "item_totals" in data
    assert "orders" in data
    print(f"PASS: User ledger by phone works")


# ============== STOCK AVAILABILITY TESTS ==============

def test_80_get_stock_availability(auth_session):
    """GET /api/stock/availability - returns item availability map"""
    response = auth_session.get(f"{BASE_URL}/api/stock/availability")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, dict)
    
    # Verify structure if items exist
    if data:
        item_id = list(data.keys())[0]
        item_data = data[item_id]
        assert "closing_balance" in item_data
        assert "last_purchase_rate" in item_data
    
    print(f"PASS: Stock availability returns {len(data)} items")


# ============== DELETE SUPPLIER TESTS ==============

def test_90_delete_supplier_without_purchases(auth_session):
    """DELETE /api/suppliers/{id} - can delete supplier without purchases"""
    # Create a supplier
    supplier_response = auth_session.post(f"{BASE_URL}/api/suppliers", json={
        "name": f"{TEST_PREFIX}DeleteMe_{uuid.uuid4().hex[:6]}"
    })
    supplier_id = supplier_response.json()["id"]
    
    # Delete it
    delete_response = auth_session.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
    assert delete_response.status_code == 200
    
    # Verify deletion
    get_response = auth_session.get(f"{BASE_URL}/api/suppliers")
    suppliers = get_response.json()
    found = any(s["id"] == supplier_id for s in suppliers)
    assert not found, "Supplier still exists after deletion"
    print("PASS: Supplier deleted successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
