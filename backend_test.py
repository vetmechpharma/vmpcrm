#!/usr/bin/env python3
"""
VMP CRM Backend API Testing Suite
Tests all CRUD operations, authentication, and email functionality
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class VMPCRMTester:
    def __init__(self, base_url: str = "https://medipro-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.user_role = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data
        self.test_user_email = f"test_admin_{datetime.now().strftime('%H%M%S')}@vmpcrm.com"
        self.test_user_password = "TestPass123!"
        self.test_user_name = "Test Admin User"
        
        self.test_doctor_data = {
            "name": "Dr. John Smith",
            "reg_no": "REG-12345",
            "address": "123 Medical Street, Health City, HC 12345",
            "email": "dr.john@example.com",
            "phone": "+91 9876543210",
            "lead_status": "Pipeline",
            "dob": "1980-05-15"
        }
        
        self.created_doctor_id = None

    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED - {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200) -> tuple:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                return False, f"Unsupported method: {method}", None
            
            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return success, f"Status: {response.status_code}", response_data
            
        except Exception as e:
            return False, f"Request failed: {str(e)}", None

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, details, data = self.make_request('GET', '')
        self.log_result("Root endpoint", success, details, data)
        
        # Test health endpoint
        success, details, data = self.make_request('GET', 'health')
        self.log_result("Health check", success, details, data)

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        user_data = {
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": self.test_user_name,
            "role": "admin"
        }
        
        success, details, data = self.make_request('POST', 'auth/register', user_data)
        
        if success and data and 'access_token' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.user_role = data['user']['role']
            self.log_result("User registration", True, f"User created with ID: {self.user_id}")
        else:
            self.log_result("User registration", False, details, data)

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        success, details, data = self.make_request('POST', 'auth/login', login_data)
        
        if success and data and 'access_token' in data:
            self.token = data['access_token']
            self.log_result("User login", True, "Login successful")
        else:
            self.log_result("User login", False, details, data)

    def test_get_current_user(self):
        """Test get current user endpoint"""
        print("\n🔍 Testing Get Current User...")
        
        success, details, data = self.make_request('GET', 'auth/me')
        
        if success and data and 'email' in data:
            self.log_result("Get current user", True, f"User: {data['email']}")
        else:
            self.log_result("Get current user", False, details, data)

    def test_create_doctor(self):
        """Test doctor creation"""
        print("\n🔍 Testing Doctor Creation...")
        
        # Try both 200 and 201 status codes
        success, details, data = self.make_request('POST', 'doctors', self.test_doctor_data, 200)
        if not success:
            success, details, data = self.make_request('POST', 'doctors', self.test_doctor_data, 201)
        
        if success and data and 'id' in data:
            self.created_doctor_id = data['id']
            customer_code = data.get('customer_code', '')
            if customer_code.startswith('VMP-'):
                self.log_result("Create doctor", True, f"Doctor created with code: {customer_code}")
            else:
                self.log_result("Create doctor", False, f"Invalid customer code format: {customer_code}", data)
        else:
            self.log_result("Create doctor", False, f"{details} - Response: {data}", data)

    def test_get_doctors(self):
        """Test get all doctors"""
        print("\n🔍 Testing Get All Doctors...")
        
        success, details, data = self.make_request('GET', 'doctors')
        
        if success and isinstance(data, list):
            self.log_result("Get all doctors", True, f"Retrieved {len(data)} doctors")
        else:
            self.log_result("Get all doctors", False, details, data)

    def test_get_single_doctor(self):
        """Test get single doctor"""
        print("\n🔍 Testing Get Single Doctor...")
        
        if not self.created_doctor_id:
            self.log_result("Get single doctor", False, "No doctor ID available")
            return
        
        success, details, data = self.make_request('GET', f'doctors/{self.created_doctor_id}')
        
        if success and data and 'id' in data:
            self.log_result("Get single doctor", True, f"Retrieved doctor: {data['name']}")
        else:
            self.log_result("Get single doctor", False, details, data)

    def test_update_doctor(self):
        """Test doctor update"""
        print("\n🔍 Testing Doctor Update...")
        
        if not self.created_doctor_id:
            self.log_result("Update doctor", False, "No doctor ID available")
            return
        
        update_data = {
            "name": "Dr. John Smith Updated",
            "lead_status": "Customer"
        }
        
        success, details, data = self.make_request('PUT', f'doctors/{self.created_doctor_id}', update_data)
        
        if success and data and data.get('name') == update_data['name']:
            self.log_result("Update doctor", True, "Doctor updated successfully")
        else:
            self.log_result("Update doctor", False, details, data)

    def test_search_doctors(self):
        """Test doctor search functionality"""
        print("\n🔍 Testing Doctor Search...")
        
        # Search by name
        search_params = {"search": "John"}
        success, details, data = self.make_request('GET', 'doctors', search_params)
        
        if success and isinstance(data, list):
            self.log_result("Search doctors by name", True, f"Found {len(data)} doctors")
        else:
            self.log_result("Search doctors by name", False, details, data)

    def test_filter_doctors_by_status(self):
        """Test doctor filtering by status"""
        print("\n🔍 Testing Doctor Status Filter...")
        
        filter_params = {"status": "Customer"}
        success, details, data = self.make_request('GET', 'doctors', filter_params)
        
        if success and isinstance(data, list):
            self.log_result("Filter doctors by status", True, f"Found {len(data)} customers")
        else:
            self.log_result("Filter doctors by status", False, details, data)

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n🔍 Testing Dashboard Stats...")
        
        success, details, data = self.make_request('GET', 'dashboard/stats')
        
        if success and data and 'total_doctors' in data and 'by_status' in data:
            self.log_result("Dashboard stats", True, f"Total doctors: {data['total_doctors']}")
        else:
            self.log_result("Dashboard stats", False, details, data)

    def test_smtp_config(self):
        """Test SMTP configuration (admin only)"""
        print("\n🔍 Testing SMTP Configuration...")
        
        if self.user_role != 'admin':
            self.log_result("SMTP config (non-admin)", True, "Skipped - user is not admin")
            return
        
        # Test get SMTP config
        success, details, data = self.make_request('GET', 'smtp-config')
        self.log_result("Get SMTP config", success, details, data)
        
        # Test create SMTP config
        smtp_data = {
            "smtp_server": "smtp.gmail.com",
            "smtp_port": 587,
            "smtp_username": "test@example.com",
            "smtp_password": "test_password",
            "from_email": "noreply@vmpcrm.com",
            "from_name": "VMP CRM Test"
        }
        
        success, details, data = self.make_request('POST', 'smtp-config', smtp_data)
        self.log_result("Create SMTP config", success, details, data)

    def test_send_email(self):
        """Test email sending functionality"""
        print("\n🔍 Testing Email Sending...")
        
        if not self.created_doctor_id:
            self.log_result("Send email", False, "No doctor ID available")
            return
        
        email_data = {
            "doctor_id": self.created_doctor_id,
            "subject": "Test Email from VMP CRM",
            "body": "This is a test email sent from the VMP CRM system.",
            "is_html": False
        }
        
        success, details, data = self.make_request('POST', 'send-email', email_data)
        
        if success and data and 'message' in data:
            self.log_result("Send email", True, "Email queued successfully")
        else:
            self.log_result("Send email", False, details, data)

    def test_email_logs(self):
        """Test email logs retrieval"""
        print("\n🔍 Testing Email Logs...")
        
        success, details, data = self.make_request('GET', 'email-logs')
        
        if success and isinstance(data, list):
            self.log_result("Get email logs", True, f"Retrieved {len(data)} email logs")
        else:
            self.log_result("Get email logs", False, details, data)

    def test_delete_doctor(self):
        """Test doctor deletion (run last)"""
        print("\n🔍 Testing Doctor Deletion...")
        
        if not self.created_doctor_id:
            self.log_result("Delete doctor", False, "No doctor ID available")
            return
        
        success, details, data = self.make_request('DELETE', f'doctors/{self.created_doctor_id}', expected_status=200)
        
        if success and data and 'message' in data:
            self.log_result("Delete doctor", True, "Doctor deleted successfully")
        else:
            self.log_result("Delete doctor", False, details, data)

    def test_invalid_endpoints(self):
        """Test error handling for invalid endpoints"""
        print("\n🔍 Testing Error Handling...")
        
        # Test invalid doctor ID
        success, details, data = self.make_request('GET', 'doctors/invalid-id', expected_status=404)
        self.log_result("Invalid doctor ID (404)", success, details, data)
        
        # Test unauthorized access (without token)
        old_token = self.token
        self.token = None
        success, details, data = self.make_request('GET', 'doctors', expected_status=403)
        if not success:
            success, details, data = self.make_request('GET', 'doctors', expected_status=401)
        self.log_result("Unauthorized access (401/403)", success, details, data)
        self.token = old_token

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting VMP CRM Backend API Tests...")
        print(f"🎯 Target URL: {self.base_url}")
        
        try:
            # Basic health checks
            self.test_health_check()
            
            # Authentication tests
            self.test_user_registration()
            self.test_user_login()
            self.test_get_current_user()
            
            # Doctor CRUD tests
            self.test_create_doctor()
            self.test_get_doctors()
            self.test_get_single_doctor()
            self.test_update_doctor()
            self.test_search_doctors()
            self.test_filter_doctors_by_status()
            
            # Dashboard and stats
            self.test_dashboard_stats()
            
            # SMTP and email tests
            self.test_smtp_config()
            self.test_send_email()
            self.test_email_logs()
            
            # Error handling
            self.test_invalid_endpoints()
            
            # Cleanup (delete test doctor)
            self.test_delete_doctor()
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {str(e)}")
            return False
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        print("="*60)

def main():
    """Main test runner"""
    tester = VMPCRMTester()
    
    success = tester.run_all_tests()
    tester.print_summary()
    
    # Return appropriate exit code
    if tester.tests_passed == tester.tests_run and tester.tests_run > 0:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())