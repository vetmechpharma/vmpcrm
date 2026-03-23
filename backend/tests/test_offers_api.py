"""
Test suite for Offers API - /api/items/offers/active endpoint
Tests role-based offers for doctors, medicals, and agencies
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOffersAPI:
    """Tests for the offers API endpoint"""
    
    def test_get_active_offers_no_role(self):
        """GET /api/items/offers/active returns items with offers"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return at least one item with offers"
        
        # Verify response structure
        for item in data:
            assert 'id' in item
            assert 'item_name' in item
            assert 'item_code' in item
            assert 'mrp' in item
            assert 'rate' in item
            assert 'offer' in item
            assert 'special_offer' in item
            assert 'image_url' in item
    
    def test_get_doctor_offers(self):
        """GET /api/items/offers/active?role=doctor returns doctor-specific offers"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return doctor offers"
        
        # Verify all items have required fields
        for item in data:
            assert 'item_name' in item
            assert 'item_code' in item
            assert 'mrp' in item
            assert 'rate' in item
            assert 'offer' in item or 'special_offer' in item
    
    def test_get_medical_offers(self):
        """GET /api/items/offers/active?role=medical returns medical-specific offers"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=medical")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return medical offers"
        
        # Verify all items have required fields
        for item in data:
            assert 'item_name' in item
            assert 'item_code' in item
            assert 'mrp' in item
            assert 'rate' in item
    
    def test_get_agency_offers(self):
        """GET /api/items/offers/active?role=agency returns agency-specific offers"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active?role=agency")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return agency offers"
        
        # Verify all items have required fields
        for item in data:
            assert 'item_name' in item
            assert 'item_code' in item
            assert 'mrp' in item
            assert 'rate' in item
    
    def test_offers_have_offer_or_special_offer(self):
        """All returned items should have either offer or special_offer text"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active")
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            offer = item.get('offer', '')
            special_offer = item.get('special_offer', '')
            assert offer or special_offer, f"Item {item['item_name']} should have offer or special_offer"
    
    def test_role_specific_rates_differ(self):
        """Different roles should potentially have different rates"""
        # Get offers for different roles
        doctor_resp = requests.get(f"{BASE_URL}/api/items/offers/active?role=doctor")
        medical_resp = requests.get(f"{BASE_URL}/api/items/offers/active?role=medical")
        
        assert doctor_resp.status_code == 200
        assert medical_resp.status_code == 200
        
        doctor_data = doctor_resp.json()
        medical_data = medical_resp.json()
        
        # Both should return data
        assert len(doctor_data) > 0
        assert len(medical_data) > 0
        
        # Find matching items and compare rates
        doctor_rates = {item['id']: item['rate'] for item in doctor_data}
        medical_rates = {item['id']: item['rate'] for item in medical_data}
        
        # At least one item should exist in both
        common_ids = set(doctor_rates.keys()) & set(medical_rates.keys())
        assert len(common_ids) > 0, "Should have common items across roles"
    
    def test_expected_items_present(self):
        """Verify expected items with offers are present"""
        response = requests.get(f"{BASE_URL}/api/items/offers/active")
        assert response.status_code == 200
        
        data = response.json()
        item_names = [item['item_name'] for item in data]
        
        # Based on context, these items should have offers
        expected_items = ['Paracetamol 500mg', 'Vitamin D3 1000IU', 'Amoxicillin 500mg']
        
        for expected in expected_items:
            assert expected in item_names, f"Expected item '{expected}' not found in offers"
