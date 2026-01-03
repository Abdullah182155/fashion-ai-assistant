"""
Official Kolors Virtual Try-On API Client.

Uses the official Kolors REST API with Bearer token authentication
and async task-based processing.
"""

import os
import time
import base64
import requests
from typing import Optional, Dict, Any
from pathlib import Path
from PIL import Image


class KolorsAPIError(Exception):
    """Custom exception for Kolors API errors"""
    pass


class KolorsAPIClient:
    """Client for Kolors Virtual Try-On official API"""
    
    # Error code meanings
    ERROR_CODES = {
        0: "Success",
        1001: "Authentication failed",
        1002: "Invalid parameters",
        1003: "Image format error",
        1004: "Rate limit exceeded",
        5000: "Server error"
    }
    
import jwt
import time

class KolorsAPIClient:
    """Client for Kolors Virtual Try-On official API"""
    
    # Error code meanings
    ERROR_CODES = {
        0: "Success",
        1001: "Authentication failed",
        1002: "Invalid parameters",
        1003: "Image format error",
        1004: "Rate limit exceeded",
        5000: "Server error"
    }
    
    def __init__(self, api_key: str, secret_key: Optional[str] = None, base_url: str = "https://api.kolors.com"):
        """
        Initialize Kolors API client.
        
        Args:
            api_key: Access Key (AK) or Bearer token
            secret_key: Secret Key (SK) - required if api_key is an Access Key
            base_url: Base URL for Kolors API
        """
        if not api_key:
            raise ValueError("API key is required")
        
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
        # Generate token if SK is provided
        if self.secret_key:
            token = self._generate_token()
            self._token_expiry = time.time() + 1800  # refresh in 30 mins
        else:
            token = api_key
            self._token_expiry = float('inf')  # never expires manually provided token
            
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
        self.session.timeout = 30

    def _generate_token(self) -> str:
        """Generate JWT token using AK/SK (HS256)"""
        headers = {
            "alg": "HS256",
            "typ": "JWT"
        }
        payload = {
            "iss": self.api_key,
            "exp": int(time.time()) + 3600,  # 1 hour expiry
            "nbf": int(time.time()) - 5      # valid from 5s ago
        }
        token = jwt.encode(payload, self.secret_key, headers=headers)
        return token

    def _refresh_token_if_needed(self):
        """Check and refresh token if close to expiry"""
        if self.secret_key and time.time() > self._token_expiry:
            token = self._generate_token()
            self.session.headers.update({'Authorization': f'Bearer {token}'})
            self._token_expiry = time.time() + 1800
    
    def _encode_image_to_base64(self, image_path: str) -> str:
        """
        Convert image file to base64 string (NO prefix).
        
        Args:
            image_path: Path to image file
            
        Returns:
            Pure base64 string without data URI prefix
        """
        with open(image_path, 'rb') as f:
            image_data = f.read()
        return base64.b64encode(image_data).decode('utf-8')
    
    def _validate_and_process_image(self, image_path: str) -> None:
        """
        Validate and automatically fix image to meet Kolors API requirements.
        
        Requirements:
        - Format: jpg, jpeg, or png
        - Dimensions >= 300x300
        - Size < 10MB
        - File must exist
        
        This method will:
        - Upscale images smaller than 300x300
        - Compress images larger than 10MB
        - Convert incompatible formats to JPEG
        
        Args:
            image_path: Path to image file which may be modified in place
            
        Raises:
            ValueError: If image is completely invalid/corrupt
        """
        path = Path(image_path)
        
        # Check file exists
        if not path.exists():
            raise ValueError(f"Image file not found: {image_path}")
        
        try:
            # Open image to check dimensions and format
            with Image.open(image_path) as img:
                # Convert RGBA to RGB if needed
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                
                width, height = img.size
                
                # Check dimensions - Upscale if too small
                if width < 300 or height < 300:
                    print(f"Warning: Image too small ({width}x{height}). Upscaling to min 300px...")
                    
                    # Calculate new size maintaining aspect ratio
                    ratio = max(300/width, 300/height)
                    new_width = int(width * ratio)
                    new_height = int(height * ratio)
                    
                    # Resize with high quality resampling
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    img.save(image_path, quality=95)
                    
                # Check file size - Compress if too large
                file_size = path.stat().st_size
                max_size = 10 * 1024 * 1024  # 10MB
                
                if file_size > max_size:
                    print(f"Warning: Image too large ({file_size/1024/1024:.1f}MB). Compressing...")
                    # Save with reduced quality until size is acceptable
                    quality = 90
                    while path.stat().st_size > max_size and quality > 10:
                        img.save(image_path, quality=quality)
                        quality -= 10
                
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError(f"Invalid image file: {str(e)}")
    
    def create_tryon_task(
        self,
        human_image: str,
        cloth_image: str,
        model_name: str = "kolors-virtual-try-on-v1"
    ) -> str:
        """
        Create a virtual try-on task.
        
        Args:
            human_image: Path to person image OR base64 string OR URL
            cloth_image: Path to garment image OR base64 string OR URL
            model_name: Model version to use
            
        Returns:
            task_id for polling
            
        Raises:
            KolorsAPIError: If API request fails
        """
        # Determine if inputs are paths or already base64/URLs
        def process_image_input(img_input: str) -> str:
            if img_input.startswith('http://') or img_input.startswith('https://'):
                return img_input  # Already a URL
            elif Path(img_input).exists():
                # It's a file path - validate/process and encode
                self._validate_and_process_image(img_input)
                return self._encode_image_to_base64(img_input)
            else:
                # Assume it's already base64
                return img_input
        
        human_b64 = process_image_input(human_image)
        cloth_b64 = process_image_input(cloth_image)
        
        # Create request payload
        payload = {
            "model_name": model_name,
            "human_image": human_b64,
            "cloth_image": cloth_b64
        }
        
        # Make API request
        url = f"{self.base_url}/v1/images/kolors-virtual-try-on"
        
        try:
            response = self.session.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Check response code
            code = data.get('code', -1)
            if code != 0:
                error_msg = self.ERROR_CODES.get(code, f"Unknown error (code {code})")
                message = data.get('message', error_msg)
                raise KolorsAPIError(f"{message} (code: {code})")
            
            # Extract task_id
            task_data = data.get('data', {})
            task_id = task_data.get('task_id')
            
            if not task_id:
                raise KolorsAPIError("No task_id in response")
            
            return task_id
            
        except requests.exceptions.RequestException as e:
            raise KolorsAPIError(f"API request failed: {str(e)}")
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get status of a try-on task.
        
        Args:
            task_id: Task ID from create_tryon_task
            
        Returns:
            Full response data dict including task_status and task_result
            
        Raises:
            KolorsAPIError: If API request fails
        """
        url = f"{self.base_url}/v1/images/kolors-virtual-try-on/{task_id}"
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            data = response.json()
            
            # Check response code
            code = data.get('code', -1)
            if code != 0:
                error_msg = self.ERROR_CODES.get(code, f"Unknown error (code {code})")
                message = data.get('message', error_msg)
                raise KolorsAPIError(f"{message} (code: {code})")
            
            return data.get('data', {})
            
        except requests.exceptions.RequestException as e:
            raise KolorsAPIError(f"Status check failed: {str(e)}")
    
    def wait_for_result(
        self,
        task_id: str,
        timeout: int = 60,
        poll_interval: int = 2
    ) -> str:
        """
        Poll task status until completion.
        
        Args:
            task_id: Task ID to poll
            timeout: Max seconds to wait
            poll_interval: Seconds between polls
            
        Returns:
            URL of result image
            
        Raises:
            TimeoutError: If task doesn't complete in time
            KolorsAPIError: If task fails
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status_data = self.get_task_status(task_id)
            task_status = status_data.get('task_status')
            
            if task_status == 'succeed':
                # Extract result image URL
                task_result = status_data.get('task_result', {})
                images = task_result.get('images', [])
                
                if not images:
                    raise KolorsAPIError("No result images in response")
                
                return images[0].get('url')
            
            elif task_status == 'failed':
                error_msg = status_data.get('task_status_msg', 'Task failed')
                raise KolorsAPIError(f"Try-on generation failed: {error_msg}")
            
            elif task_status in ['submitted', 'processing']:
                # Still processing, wait and retry
                time.sleep(poll_interval)
            
            else:
                # Unknown status
                raise KolorsAPIError(f"Unknown task status: {task_status}")
        
        raise TimeoutError(f"Task {task_id} did not complete within {timeout} seconds")
    
    def download_result_image(self, image_url: str, save_path: str) -> str:
        """
        Download result image from URL.
        
        Args:
            image_url: URL of generated image
            save_path: Local path to save image
            
        Returns:
            Path where image was saved
            
        Raises:
            KolorsAPIError: If download fails
        """
        try:
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # Ensure directory exists
            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Save image
            with open(save_path, 'wb') as f:
                f.write(response.content)
            
            return save_path
            
        except Exception as e:
            raise KolorsAPIError(f"Failed to download result: {str(e)}")
    
    def generate_tryon(
        self,
        human_image_path: str,
        cloth_image_path: str,
        save_path: Optional[str] = None
    ) -> str:
        """
        High-level method to generate try-on result.
        
        Combines: create task → wait for result → download image
        
        Args:
            human_image_path: Path to person image
            cloth_image_path: Path to garment image
            save_path: Where to save result (optional)
            
        Returns:
            Local path to result image
            
        Raises:
            KolorsAPIError: If any step fails
            TimeoutError: If generation times out
        """
        # Create task
        task_id = self.create_tryon_task(human_image_path, cloth_image_path)
        
        # Wait for result
        result_url = self.wait_for_result(task_id)
        
        # Download result
        if save_path is None:
            save_path = f"tryon_result_{task_id}.jpg"
        
        return self.download_result_image(result_url, save_path)
