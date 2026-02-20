"""
Tests for OTP and Fallback OTP functionality
- POST /api/customer/send-otp - Generate and send OTP via WhatsApp
- POST /api/customer/verify-otp - Verify OTP (both regular and fallback)
- GET /api/fallback-otps - Get list of fallback OTPs (admin only)
- POST /api/fallback-otps - Create new fallback OTP (admin only)
- PUT /api/fallback-otps/{id}/toggle - Toggle OTP active status
- DELETE /api/fallback-otps/{id} - Delete fallback OTP
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vmpcrm.com"
ADMIN_PASSWORD = "admin123"
TEST_PHONE = f"999988{str(uuid.uuid4())[:4].replace('-', '0')}"  # Unique test phone
TEST_OTP = "4567"  # Test fallback OTP


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login to get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Admin login successful, role: {data['user']['role']}")
        return data["access_token"]


class TestSendOTP:
    """Test send-otp endpoint"""
    
    def test_send_otp_success(self):
        """Test sending OTP to a valid phone number"""
        response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": "9999888877",
            "purpose": "register"
        })
        # Should succeed even if WhatsApp delivery fails
        assert response.status_code == 200, f"Send OTP failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["phone"] == "9999888877"
        print(f"✓ OTP send request successful: {data['message']}")
    
    def test_send_otp_invalid_phone(self):
        """Test sending OTP to invalid phone number"""
        response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": "123",
            "purpose": "register"
        })
        assert response.status_code == 400
        print("✓ Invalid phone number correctly rejected")
    
    def test_send_otp_reset_password_nonexistent(self):
        """Test reset password for non-existent user"""
        response = requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": "1111111111",
            "purpose": "reset_password"
        })
        assert response.status_code == 404
        print("✓ Reset password for non-existent user correctly returns 404")


class TestVerifyOTP:
    """Test verify-otp endpoint"""
    
    def test_verify_otp_invalid(self):
        """Test verifying wrong OTP"""
        # First send OTP
        requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": "9999888866",
            "purpose": "register"
        })
        
        # Try to verify with wrong OTP
        response = requests.post(f"{BASE_URL}/api/customer/verify-otp", json={
            "phone": "9999888866",
            "otp": "0000",
            "purpose": "register"
        })
        assert response.status_code == 400
        print("✓ Invalid OTP correctly rejected")
    
    def test_verify_otp_no_stored_otp(self):
        """Test verifying OTP when none was sent"""
        response = requests.post(f"{BASE_URL}/api/customer/verify-otp", json={
            "phone": "1234567890",
            "otp": "1234",
            "purpose": "register"
        })
        assert response.status_code == 400
        print("✓ OTP verification without stored OTP correctly rejected")


class TestFallbackOTPCRUD:
    """Test Fallback OTP CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_get_fallback_otps_unauthorized(self):
        """Test getting fallback OTPs without auth"""
        response = requests.get(f"{BASE_URL}/api/fallback-otps")
        assert response.status_code in [401, 403]
        print("✓ Unauthorized access to fallback OTPs correctly rejected")
    
    def test_get_fallback_otps_authorized(self, admin_token):
        """Test getting fallback OTPs with admin auth"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/fallback-otps", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} fallback OTPs")
    
    def test_create_fallback_otp(self, admin_token):
        """Test creating a new fallback OTP"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/fallback-otps", 
            headers=headers,
            json={"otp": TEST_OTP}
        )
        
        if response.status_code == 400 and "already exists" in response.text:
            # OTP already exists, try with different value
            response = requests.post(f"{BASE_URL}/api/fallback-otps", 
                headers=headers,
                json={"otp": str(int(TEST_OTP) + 1).zfill(4)}
            )
        
        assert response.status_code == 200, f"Create OTP failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "otp" in data
        assert data["is_active"] == True
        print(f"✓ Created fallback OTP: {data['otp']}")
        return data["id"]
    
    def test_create_fallback_otp_invalid_format(self, admin_token):
        """Test creating OTP with invalid format"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test non-digit OTP
        response = requests.post(f"{BASE_URL}/api/fallback-otps", 
            headers=headers,
            json={"otp": "abcd"}
        )
        assert response.status_code == 400
        
        # Test wrong length OTP
        response = requests.post(f"{BASE_URL}/api/fallback-otps", 
            headers=headers,
            json={"otp": "12345"}
        )
        assert response.status_code == 400
        print("✓ Invalid OTP format correctly rejected")
    
    def test_toggle_fallback_otp(self, admin_token):
        """Test toggling fallback OTP status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create an OTP
        unique_otp = str(int(TEST_OTP) + 10).zfill(4)
        create_response = requests.post(f"{BASE_URL}/api/fallback-otps", 
            headers=headers,
            json={"otp": unique_otp}
        )
        
        if create_response.status_code != 200:
            # Use existing OTP for toggle test
            list_response = requests.get(f"{BASE_URL}/api/fallback-otps", headers=headers)
            if list_response.status_code == 200 and len(list_response.json()) > 0:
                otp_id = list_response.json()[0]["id"]
            else:
                pytest.skip("No OTPs available for toggle test")
        else:
            otp_id = create_response.json()["id"]
        
        # Toggle the OTP
        response = requests.put(f"{BASE_URL}/api/fallback-otps/{otp_id}/toggle", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "is_active" in data
        print(f"✓ Toggled OTP status to: {data['is_active']}")
    
    def test_delete_fallback_otp(self, admin_token):
        """Test deleting a fallback OTP"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create OTP first
        unique_otp = str(int(TEST_OTP) + 20).zfill(4)
        create_response = requests.post(f"{BASE_URL}/api/fallback-otps", 
            headers=headers,
            json={"otp": unique_otp}
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create OTP for delete test")
        
        otp_id = create_response.json()["id"]
        
        # Delete the OTP
        response = requests.delete(f"{BASE_URL}/api/fallback-otps/{otp_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/fallback-otps", headers=headers)
        otps = get_response.json()
        assert not any(o["id"] == otp_id for o in otps)
        print("✓ Fallback OTP deleted successfully")
    
    def test_delete_nonexistent_otp(self, admin_token):
        """Test deleting non-existent OTP"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.delete(f"{BASE_URL}/api/fallback-otps/nonexistent-id", headers=headers)
        assert response.status_code == 404
        print("✓ Delete non-existent OTP correctly returns 404")


class TestFallbackOTPVerification:
    """Test fallback OTP verification flow"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_verify_with_fallback_otp(self, admin_token):
        """Test verifying with a fallback OTP"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First ensure we have an active fallback OTP
        fallback_otp = "1234"
        create_response = requests.post(f"{BASE_URL}/api/fallback-otps", 
            headers=headers,
            json={"otp": fallback_otp}
        )
        
        if create_response.status_code != 200:
            # Get existing active OTP
            list_response = requests.get(f"{BASE_URL}/api/fallback-otps", headers=headers)
            if list_response.status_code == 200:
                active_otps = [o for o in list_response.json() if o.get("is_active")]
                if active_otps:
                    fallback_otp = active_otps[0]["otp"]
                else:
                    pytest.skip("No active fallback OTPs available")
            else:
                pytest.skip("Could not get fallback OTPs")
        
        # Send OTP to a test phone (generates regular OTP)
        test_phone = "9998887776"
        requests.post(f"{BASE_URL}/api/customer/send-otp", json={
            "phone": test_phone,
            "purpose": "register"
        })
        
        # Verify using fallback OTP instead of the one sent
        response = requests.post(f"{BASE_URL}/api/customer/verify-otp", json={
            "phone": test_phone,
            "otp": fallback_otp,
            "purpose": "register"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("verified") == True
        print(f"✓ Fallback OTP '{fallback_otp}' verification successful")


class TestSeedDefaultOTPs:
    """Test seeding default OTPs"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_seed_default_otps(self, admin_token):
        """Test seeding default fallback OTPs"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/fallback-otps/seed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "total_default" in data
        assert data["total_default"] == 11  # 11 default OTPs
        print(f"✓ Seed OTPs: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
