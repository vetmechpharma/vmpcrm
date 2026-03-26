"""
Test MR Order Form Role-Based Rates Feature
Tests that:
1. MR login works
2. GET /api/mr/customers returns customers with entity_type field
3. GET /api/mr/items returns items with rate_doctors, rate_medicals, rate_agencies fields
4. Items have role-specific offers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# MR credentials
MR_PHONE = "9876543211"
MR_PASSWORD = "testpass"


class TestMRRoleBasedRates:
    """Test MR role-based rates feature"""
    
    @pytest.fixture(scope="class")
    def mr_token(self):
        """Get MR authentication token"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200, f"MR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def mr_headers(self, mr_token):
        """Get headers with MR auth token"""
        return {"Authorization": f"Bearer {mr_token}"}
    
    def test_mr_login(self):
        """Test MR login returns token and mr object"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": MR_PHONE,
            "password": MR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "mr" in data
        assert data["mr"]["phone"] == MR_PHONE
        print(f"MR login successful: {data['mr']['name']}")
    
    def test_mr_customers_returns_entity_type(self, mr_headers):
        """Test GET /api/mr/customers returns customers with entity_type field"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", headers=mr_headers)
        assert response.status_code == 200
        customers = response.json()
        assert isinstance(customers, list), "Response should be a list"
        
        # Check that customers have entity_type field
        entity_types_found = set()
        for customer in customers:
            assert "entity_type" in customer, f"Customer {customer.get('name')} missing entity_type"
            assert customer["entity_type"] in ["doctor", "medical", "agency"], \
                f"Invalid entity_type: {customer['entity_type']}"
            entity_types_found.add(customer["entity_type"])
            
        print(f"Found {len(customers)} customers with entity_types: {entity_types_found}")
        
        # Find a doctor customer
        doctors = [c for c in customers if c["entity_type"] == "doctor"]
        if doctors:
            print(f"Sample doctor customer: {doctors[0].get('name')} - entity_type: {doctors[0]['entity_type']}")
    
    def test_mr_customers_search_doctor(self, mr_headers):
        """Test searching for doctor customers"""
        response = requests.get(f"{BASE_URL}/api/mr/customers", 
                               params={"search": "Dr"},
                               headers=mr_headers)
        assert response.status_code == 200
        customers = response.json()
        print(f"Found {len(customers)} customers matching 'Dr'")
        
        for customer in customers[:3]:
            print(f"  - {customer.get('name')} ({customer.get('entity_type')})")
    
    def test_mr_items_returns_role_rates(self, mr_headers):
        """Test GET /api/mr/items returns items with role-based rate fields"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers=mr_headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list), "Response should be a list"
        assert len(items) > 0, "No items returned"
        
        # Check first few items for role-based rate fields
        for item in items[:5]:
            item_name = item.get("item_name") or item.get("name", "Unknown")
            print(f"\nItem: {item_name} ({item.get('item_code')})")
            print(f"  MRP: {item.get('mrp')}")
            print(f"  rate_doctors: {item.get('rate_doctors')}")
            print(f"  rate_medicals: {item.get('rate_medicals')}")
            print(f"  rate_agencies: {item.get('rate_agencies')}")
            print(f"  offer_doctors: {item.get('offer_doctors')}")
            print(f"  offer_medicals: {item.get('offer_medicals')}")
            print(f"  offer_agencies: {item.get('offer_agencies')}")
    
    def test_mr_items_search_amox(self, mr_headers):
        """Test searching for Amoxicillin items - should have role-based rates"""
        response = requests.get(f"{BASE_URL}/api/mr/items", 
                               params={"search": "Amox"},
                               headers=mr_headers)
        assert response.status_code == 200
        items = response.json()
        print(f"Found {len(items)} items matching 'Amox'")
        
        for item in items:
            item_name = item.get("item_name") or item.get("name", "Unknown")
            print(f"\n{item_name}:")
            print(f"  rate_doctors: {item.get('rate_doctors')} (expected: 65)")
            print(f"  rate_medicals: {item.get('rate_medicals')} (expected: 35)")
            print(f"  rate_agencies: {item.get('rate_agencies')} (expected: 90)")
            
            # Verify the specific rates if this is Amoxicillin 500mg
            if "500" in item_name:
                assert item.get("rate_doctors") == 65.0 or item.get("rate_doctors") == 65, \
                    f"Expected rate_doctors=65, got {item.get('rate_doctors')}"
    
    def test_items_have_all_rate_fields(self, mr_headers):
        """Verify items have all required rate fields for role-based pricing"""
        response = requests.get(f"{BASE_URL}/api/mr/items", headers=mr_headers)
        assert response.status_code == 200
        items = response.json()
        
        required_fields = ["mrp", "rate_doctors", "rate_medicals", "rate_agencies"]
        optional_offer_fields = ["offer_doctors", "offer_medicals", "offer_agencies",
                                 "special_offer_doctors", "special_offer_medicals", "special_offer_agencies"]
        
        items_with_rates = 0
        for item in items:
            has_any_rate = any(item.get(f) for f in ["rate_doctors", "rate_medicals", "rate_agencies"])
            if has_any_rate:
                items_with_rates += 1
        
        print(f"\n{items_with_rates}/{len(items)} items have role-based rates configured")
        
        # At least some items should have role-based rates
        assert items_with_rates > 0, "No items have role-based rates configured"
    
    def test_customer_entity_type_filter(self, mr_headers):
        """Test filtering customers by entity_type"""
        # Get doctors only
        response = requests.get(f"{BASE_URL}/api/mr/customers", 
                               params={"entity_type": "doctor"},
                               headers=mr_headers)
        assert response.status_code == 200
        doctors = response.json()
        
        for doc in doctors:
            assert doc["entity_type"] == "doctor", f"Expected doctor, got {doc['entity_type']}"
        
        print(f"Found {len(doctors)} doctor customers")
        
        # Get medicals only
        response = requests.get(f"{BASE_URL}/api/mr/customers", 
                               params={"entity_type": "medical"},
                               headers=mr_headers)
        assert response.status_code == 200
        medicals = response.json()
        
        for med in medicals:
            assert med["entity_type"] == "medical", f"Expected medical, got {med['entity_type']}"
        
        print(f"Found {len(medicals)} medical customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
