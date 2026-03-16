"""
Test PWA manifest separation between MR app and User app
- MR app: /mrvet/* uses /mr-manifest.json
- User app: /* uses /manifest.json
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestStaticAssets:
    """Test static file accessibility for PWA resources"""

    def test_mr_manifest_accessible(self):
        """MR manifest should be accessible at /mr-manifest.json"""
        response = requests.get(f"{BASE_URL}/mr-manifest.json")
        assert response.status_code == 200, f"MR manifest not accessible: {response.status_code}"
        data = response.json()
        assert data is not None
        print(f"✓ MR manifest accessible: {response.status_code}")

    def test_user_manifest_accessible(self):
        """User manifest should be accessible at /manifest.json"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"User manifest not accessible: {response.status_code}"
        data = response.json()
        assert data is not None
        print(f"✓ User manifest accessible: {response.status_code}")

    def test_mr_icon_192_accessible(self):
        """MR 192px icon should be accessible"""
        response = requests.get(f"{BASE_URL}/mr-icon-192.png")
        assert response.status_code == 200, f"MR icon 192 not accessible: {response.status_code}"
        assert 'image/png' in response.headers.get('Content-Type', ''), "MR icon 192 not PNG"
        print(f"✓ MR icon 192px accessible: {response.headers.get('Content-Type')}")

    def test_mr_icon_512_accessible(self):
        """MR 512px icon should be accessible"""
        response = requests.get(f"{BASE_URL}/mr-icon-512.png")
        assert response.status_code == 200, f"MR icon 512 not accessible: {response.status_code}"
        assert 'image/png' in response.headers.get('Content-Type', ''), "MR icon 512 not PNG"
        print(f"✓ MR icon 512px accessible: {response.headers.get('Content-Type')}")

    def test_user_icon_192_accessible(self):
        """User 192px icon should be accessible"""
        response = requests.get(f"{BASE_URL}/icons/icon-192.png")
        assert response.status_code == 200, f"User icon 192 not accessible: {response.status_code}"
        assert 'image/png' in response.headers.get('Content-Type', ''), "User icon 192 not PNG"
        print(f"✓ User icon 192px accessible: {response.headers.get('Content-Type')}")

    def test_user_icon_512_accessible(self):
        """User 512px icon should be accessible"""
        response = requests.get(f"{BASE_URL}/icons/icon-512.png")
        assert response.status_code == 200, f"User icon 512 not accessible: {response.status_code}"
        assert 'image/png' in response.headers.get('Content-Type', ''), "User icon 512 not PNG"
        print(f"✓ User icon 512px accessible: {response.headers.get('Content-Type')}")

    def test_mr_service_worker_accessible(self):
        """MR service worker should be accessible at /mr-sw.js"""
        response = requests.get(f"{BASE_URL}/mr-sw.js")
        assert response.status_code == 200, f"MR SW not accessible: {response.status_code}"
        assert 'javascript' in response.headers.get('Content-Type', '').lower() or response.text.startswith('const'), "MR SW not JS"
        print(f"✓ MR service worker accessible: {response.status_code}")

    def test_user_service_worker_accessible(self):
        """User service worker should be accessible at /sw.js"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"User SW not accessible: {response.status_code}"
        assert 'javascript' in response.headers.get('Content-Type', '').lower() or response.text.startswith('const'), "User SW not JS"
        print(f"✓ User service worker accessible: {response.status_code}")


class TestMRManifestContent:
    """Test MR manifest has correct values"""

    @pytest.fixture
    def mr_manifest(self):
        response = requests.get(f"{BASE_URL}/mr-manifest.json")
        return response.json()

    def test_mr_manifest_name(self, mr_manifest):
        """MR manifest name should be 'MR Field App - VMP Pharma'"""
        assert mr_manifest.get('name') == 'MR Field App - VMP Pharma', f"Wrong name: {mr_manifest.get('name')}"
        print(f"✓ MR manifest name: {mr_manifest.get('name')}")

    def test_mr_manifest_short_name(self, mr_manifest):
        """MR manifest short_name should be 'MR Field App'"""
        assert mr_manifest.get('short_name') == 'MR Field App', f"Wrong short_name: {mr_manifest.get('short_name')}"
        print(f"✓ MR manifest short_name: {mr_manifest.get('short_name')}")

    def test_mr_manifest_start_url(self, mr_manifest):
        """MR manifest start_url should be '/mrvet/login'"""
        assert mr_manifest.get('start_url') == '/mrvet/login', f"Wrong start_url: {mr_manifest.get('start_url')}"
        print(f"✓ MR manifest start_url: {mr_manifest.get('start_url')}")

    def test_mr_manifest_scope(self, mr_manifest):
        """MR manifest scope should be '/mrvet/'"""
        assert mr_manifest.get('scope') == '/mrvet/', f"Wrong scope: {mr_manifest.get('scope')}"
        print(f"✓ MR manifest scope: {mr_manifest.get('scope')}")

    def test_mr_manifest_theme_color(self, mr_manifest):
        """MR manifest theme_color should be '#0c3c60'"""
        assert mr_manifest.get('theme_color') == '#0c3c60', f"Wrong theme_color: {mr_manifest.get('theme_color')}"
        print(f"✓ MR manifest theme_color: {mr_manifest.get('theme_color')}")

    def test_mr_manifest_icons(self, mr_manifest):
        """MR manifest should have correct icon paths"""
        icons = mr_manifest.get('icons', [])
        icon_sources = [icon.get('src') for icon in icons]
        assert '/mr-icon-192.png' in icon_sources, f"Missing 192px icon: {icon_sources}"
        assert '/mr-icon-512.png' in icon_sources, f"Missing 512px icon: {icon_sources}"
        print(f"✓ MR manifest icons: {icon_sources}")


class TestUserManifestContent:
    """Test User manifest has correct values"""

    @pytest.fixture
    def user_manifest(self):
        response = requests.get(f"{BASE_URL}/manifest.json")
        return response.json()

    def test_user_manifest_name(self, user_manifest):
        """User manifest name should be 'VMP CRM - Customer Portal'"""
        assert user_manifest.get('name') == 'VMP CRM - Customer Portal', f"Wrong name: {user_manifest.get('name')}"
        print(f"✓ User manifest name: {user_manifest.get('name')}")

    def test_user_manifest_short_name(self, user_manifest):
        """User manifest short_name should be 'VMP CRM'"""
        assert user_manifest.get('short_name') == 'VMP CRM', f"Wrong short_name: {user_manifest.get('short_name')}"
        print(f"✓ User manifest short_name: {user_manifest.get('short_name')}")

    def test_user_manifest_start_url(self, user_manifest):
        """User manifest start_url should be '/login'"""
        assert user_manifest.get('start_url') == '/login', f"Wrong start_url: {user_manifest.get('start_url')}"
        print(f"✓ User manifest start_url: {user_manifest.get('start_url')}")

    def test_user_manifest_scope(self, user_manifest):
        """User manifest scope should be '/'"""
        assert user_manifest.get('scope') == '/', f"Wrong scope: {user_manifest.get('scope')}"
        print(f"✓ User manifest scope: {user_manifest.get('scope')}")

    def test_user_manifest_theme_color(self, user_manifest):
        """User manifest theme_color should be '#1e7a4d'"""
        assert user_manifest.get('theme_color') == '#1e7a4d', f"Wrong theme_color: {user_manifest.get('theme_color')}"
        print(f"✓ User manifest theme_color: {user_manifest.get('theme_color')}")

    def test_user_manifest_icons(self, user_manifest):
        """User manifest should have correct icon paths"""
        icons = user_manifest.get('icons', [])
        icon_sources = [icon.get('src') for icon in icons]
        assert '/icons/icon-192.png' in icon_sources, f"Missing 192px icon: {icon_sources}"
        assert '/icons/icon-512.png' in icon_sources, f"Missing 512px icon: {icon_sources}"
        print(f"✓ User manifest icons: {icon_sources}")


class TestAuthEndpoints:
    """Test MR and Admin login endpoints still work"""

    def test_mr_login_endpoint(self):
        """MR login should work with test credentials"""
        response = requests.post(f"{BASE_URL}/api/mr/login", json={
            "phone": "9876543211",
            "password": "testpass"
        })
        assert response.status_code == 200, f"MR login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert 'token' in data or 'access_token' in data, f"No token in response: {data}"
        print(f"✓ MR login works: {response.status_code}")

    def test_admin_login_endpoint(self):
        """Admin login should work with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@vmpcrm.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert 'token' in data or 'access_token' in data, f"No token in response: {data}"
        print(f"✓ Admin login works: {response.status_code}")
