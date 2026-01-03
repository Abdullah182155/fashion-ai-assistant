#!/usr/bin/env python3
"""
Test script for Kolors Virtual Try-On official API.

Usage:
    export KOLORS_API_KEY="your_api_key"
    python scripts/test_kolors_api.py path/to/person.jpg path/to/garment.jpg
"""

import sys
import os
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.services.kolors_client import KolorsAPIClient, KolorsAPIError


def test_kolors_api(person_image_path: str, garment_image_path: str):
    """Test Kolors API integration"""
    
    print("=" * 60)
    print("KOLORS VIRTUAL TRY-ON API TEST")
    print("=" * 60)
    
    # Check API key
    api_key = os.getenv("KOLORS_API_KEY")
    if not api_key:
        print("\n❌ ERROR: KOLORS_API_KEY environment variable not set")
        print("\nUsage:")
        print("  export KOLORS_API_KEY='your_api_key'")
        print(f"  python {sys.argv[0]} person.jpg garment.jpg")
        sys.exit(1)
    
    print(f"\n✅ API Key: {api_key[:10]}...{api_key[-4:]}")
    
    # Validate image files
    if not os.path.exists(person_image_path):
        print(f"\n❌ ERROR: Person image not found: {person_image_path}")
        sys.exit(1)
    
    if not os.path.exists(garment_image_path):
        print(f"\n❌ ERROR: Garment image not found: {garment_image_path}")
        sys.exit(1)
    
    print(f"\n📸 Person image: {person_image_path}")
    print(f"👗 Garment image: {garment_image_path}")
    
    try:
        # Initialize client
        print("\n🔧 Initializing Kolors API client...")
        client = KolorsAPIClient(
            api_key=api_key,
            base_url=os.getenv("KOLORS_API_BASE_URL", "https://api.kolors.com")
        )
        print("✅ Client initialized")
        
        # Validate images
        print("\n🔍 Validating images...")
        client._validate_image(person_image_path)
        print(f"  ✅ Person image valid")
        client._validate_image(garment_image_path)
        print(f"  ✅ Garment image valid")
        
        # Create task
        print("\n🚀 Creating try-on task...")
        start_time = time.time()
        task_id = client.create_tryon_task(
            human_image=person_image_path,
            cloth_image=garment_image_path
        )
        print(f"✅ Task created: {task_id}")
        
        # Poll for result
        print(f"\n⏳ Polling for result (timeout: 60s)...")
        poll_start = time.time()
        
        while True:
            elapsed = time.time() - poll_start
            status_data = client.get_task_status(task_id)
            task_status = status_data.get('task_status')
            
            print(f"  [{elapsed:.1f}s] Status: {task_status}")
            
            if task_status == 'succeed':
                result_url = status_data['task_result']['images'][0]['url']
                print(f"\n✅ Generation complete!")
                print(f"  Time taken: {time.time() - start_time:.1f} seconds")
                print(f"  Result URL: {result_url}")
                
                # Download result
                print(f"\n📥 Downloading result...")
                result_path = "test_tryon_result.jpg"
                client.download_result_image(result_url, result_path)
                print(f"✅ Result saved: {result_path}")
                
                total_time = time.time() - start_time
                print(f"\n" + "=" * 60)
                print(f"✅ TEST SUCCESSFUL!")
                print(f"   Total time: {total_time:.1f} seconds")
                print(f"   Result: {result_path}")
                print("=" * 60)
                break
            
            elif task_status == 'failed':
                error_msg = status_data.get('task_status_msg', 'Unknown error')
                print(f"\n❌ Task failed: {error_msg}")
                sys.exit(1)
            
            elif task_status in ['submitted', 'processing']:
                time.sleep(2)
            
            else:
                print(f"\n❌ Unknown status: {task_status}")
                sys.exit(1)
            
            if elapsed > 60:
                print(f"\n❌ Timeout after 60 seconds")
                sys.exit(1)
    
    except KolorsAPIError as e:
        print(f"\n❌ Kolors API Error: {e}")
        sys.exit(1)
    
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python test_kolors_api.py <person_image> <garment_image>")
        print("\nExample:")
        print("  export KOLORS_API_KEY='your_api_key'")
        print("  python test_kolors_api.py person.jpg garment.jpg")
        sys.exit(1)
    
    person_img = sys.argv[1]
    garment_img = sys.argv[2]
    
    test_kolors_api(person_img, garment_img)
