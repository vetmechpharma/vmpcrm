"""
Test Special Offer 2 API - /api/items/offers/active
Tests for the new Special Offer 2 feature that shows items on MR and Customer dashboards
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOffersActiveAPI:
    """Tests for GET /api/items/offers/active endpoint"""
    
    def test_offers_active_returns_items_with_special_offer_2(self):
        """Test that endpoint returns items with special_offer_2 set"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2, "Should return at least 2 items with special_offer_2"
        
        # Verify each item has required fields
        for item in data:
            assert 'id' in item
            assert 'item_name' in item
            assert 'item_code' in item
            assert 'offer' in item  # This is the special_offer_2 text
            assert item['offer'], "Offer text should not be empty"
            print(f"Item: {item['item_code']} - Offer: {item['offer']}")
    
    def test_offers_active_with_role_doctor(self):
        """Test that ?role=doctor returns doctor-specific special_offer_2"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 2
        
        # Check for expected doctor offers
        offers = {item['item_code']: item for item in data}
        
        # Paracetamol should have doctor offer
        if 'ITM-0001' in offers:
            assert 'Near Expiry' in offers['ITM-0001']['offer']
            assert offers['ITM-0001']['description'], "Description should be present"
            print(f"Doctor offer for ITM-0001: {offers['ITM-0001']['offer']}")
        
        # Amoxicillin should have doctor offer
        if 'AMX-500' in offers:
            assert 'Launch Offer' in offers['AMX-500']['offer']
            print(f"Doctor offer for AMX-500: {offers['AMX-500']['offer']}")
    
    def test_offers_active_with_role_medical(self):
        """Test that ?role=medical returns medical-specific special_offer_2"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=medical")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 2
        
        offers = {item['item_code']: item for item in data}
        
        # Medical offers should be different from doctor offers
        if 'ITM-0001' in offers:
            # Medical offer should mention "Buy 10 Get 10" not "50% Off"
            assert 'Buy 10' in offers['ITM-0001']['offer'] or 'Near Expiry' in offers['ITM-0001']['offer']
            print(f"Medical offer for ITM-0001: {offers['ITM-0001']['offer']}")
    
    def test_offers_response_includes_description(self):
        """Test that response includes description field"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            assert 'description' in item
            # At least some items should have descriptions
            if item['item_code'] == 'ITM-0001':
                assert item['description'], "Paracetamol should have description"
                print(f"Description for {item['item_code']}: {item['description']}")
    
    def test_offers_response_includes_rate_and_mrp(self):
        """Test that response includes rate and mrp fields"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            assert 'mrp' in item
            assert 'rate' in item
            assert isinstance(item['mrp'], (int, float))
            assert isinstance(item['rate'], (int, float))
            print(f"{item['item_code']}: MRP={item['mrp']}, Rate={item['rate']}")
    
    def test_vitamin_d3_not_in_offers(self):
        """Test that Vitamin D3 (without special_offer_2) is NOT returned"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active")
        assert response.status_code == 200
        
        data = response.json()
        item_codes = [item['item_code'] for item in data]
        
        # Vitamin D3 (ITM-0002) should NOT be in the list
        assert 'ITM-0002' not in item_codes, "Vitamin D3 should NOT appear in offers (no special_offer_2)"
        print(f"Items in offers: {item_codes}")
        print("Vitamin D3 (ITM-0002) correctly excluded from offers")
    
    def test_offers_response_includes_image_url(self):
        """Test that response includes image_url field"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active")
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            assert 'image_url' in item
            # image_url can be null or a valid path
            if item['image_url']:
                assert item['image_url'].startswith('/api/items/')
                print(f"{item['item_code']} has image: {item['image_url']}")


class TestOffersRoleFiltering:
    """Tests for role-based filtering of special_offer_2"""
    
    def test_doctor_and_medical_offers_are_different(self):
        """Test that doctor and medical roles return different offers"""
        doctor_resp = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        medical_resp = requests.get(f"{BASE_URL}/api/items/offers/active?role=medical")
        
        assert doctor_resp.status_code == 200
        assert medical_resp.status_code == 200
        
        doctor_data = {item['item_code']: item['offer'] for item in doctor_resp.json()}
        medical_data = {item['item_code']: item['offer'] for item in medical_resp.json()}
        
        # At least one item should have different offers for doctor vs medical
        different_found = False
        for code in doctor_data:
            if code in medical_data and doctor_data[code] != medical_data[code]:
                different_found = True
                print(f"{code} - Doctor: {doctor_data[code]}")
                print(f"{code} - Medical: {medical_data[code]}")
        
        assert different_found, "Doctor and medical offers should be different for at least one item"
    
    def test_default_role_uses_doctor(self):
        """Test that no role parameter defaults to doctor offers"""
        no_role_resp = requests.get(f"{BASE_URL}/api/items/offers/active")
        doctor_resp = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        
        assert no_role_resp.status_code == 200
        assert doctor_resp.status_code == 200
        
        no_role_data = {item['item_code']: item['offer'] for item in no_role_resp.json()}
        doctor_data = {item['item_code']: item['offer'] for item in doctor_resp.json()}
        
        # Should be the same
        assert no_role_data == doctor_data, "Default should use doctor offers"
        print("Default role correctly uses doctor offers")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
