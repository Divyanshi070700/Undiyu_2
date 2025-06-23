import requests
import json
import os
import sys
from typing import Dict, Any, List

# Get the backend URL from the frontend .env file
def get_backend_url():
    env_file_path = '/app/frontend/.env'
    backend_url = None
    
    with open(env_file_path, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.strip().split('=')[1].strip('"\'')
                break
    
    if not backend_url:
        print("Error: Could not find REACT_APP_BACKEND_URL in frontend/.env")
        sys.exit(1)
        
    return "{}/api".format(backend_url)

# Test class for API endpoints
class APITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
    
    def run_test(self, name: str, method: str, endpoint: str, data: Dict[str, Any] = None, expected_status: int = 200):
        url = "{}{}".format(self.base_url, endpoint)
        print("\n{}".format('='*80))
        print("Testing {}: {} {}".format(name, method, url))
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            else:
                raise ValueError("Unsupported HTTP method: {}".format(method))
            
            print("Status Code: {}".format(response.status_code))
            print("Response: {}".format(json.dumps(response.json(), indent=2)))
            
            success = response.status_code == expected_status
            result = {
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "success": success,
                "response": response.json() if response.headers.get('content-type') == 'application/json' else str(response.text)
            }
            
            self.results.append(result)
            return result
            
        except Exception as e:
            print("Error: {}".format(str(e)))
            result = {
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "success": False,
                "error": str(e)
            }
            self.results.append(result)
            return result
    
    def print_summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        success_count = sum(1 for r in self.results if r.get('success', False))
        total_count = len(self.results)
        
        print("Total Tests: {}".format(total_count))
        print("Successful: {}".format(success_count))
        print("Failed: {}".format(total_count - success_count))
        
        if total_count - success_count > 0:
            print("\nFailed Tests:")
            for result in self.results:
                if not result.get('success', False):
                    error_msg = result.get('error', 'Expected status {}, got {}'.format(
                        result.get('expected_status'), result.get('status_code')))
                    print("- {}: {}".format(result['name'], error_msg))
        
        return success_count == total_count

def main():
    backend_url = get_backend_url()
    print("Using backend URL: {}".format(backend_url))
    
    tester = APITester(backend_url)
    
    # Test 1: Health check endpoint
    tester.run_test(
        name="Health Check",
        method="GET",
        endpoint="/"
    )
    
    # Test 2: Get status checks
    tester.run_test(
        name="Get Status Checks",
        method="GET",
        endpoint="/status"
    )
    
    # Test 3: Create status check
    tester.run_test(
        name="Create Status Check",
        method="POST",
        endpoint="/status",
        data={"client_name": "Test Client"}
    )
    
    # Test 4: Create Razorpay order
    sample_cart = [
        {
            "id": "test123",
            "title": "Test Saree",
            "quantity": 1,
            "price": 500.0,
            "handle": "test-saree"
        }
    ]
    
    tester.run_test(
        name="Create Razorpay Order",
        method="POST",
        endpoint="/create-razorpay-order",
        data={
            "amount": 50000,
            "currency": "INR",
            "cart": sample_cart
        }
    )
    
    # Test 5: Verify payment
    tester.run_test(
        name="Verify Payment",
        method="POST",
        endpoint="/verify-payment",
        data={
            "razorpay_order_id": "order_123",
            "razorpay_payment_id": "pay_123",
            "razorpay_signature": "test_signature",
            "cart": sample_cart
        }
    )
    
    # Print summary
    all_passed = tester.print_summary()
    
    # Exit with appropriate status code
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()