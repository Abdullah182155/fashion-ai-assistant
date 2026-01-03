"""
Backend router for virtual try-on using official Kolors API.
"""

import os
import base64
import tempfile
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel

from ..core.config import config
from ..services.kolors_client import KolorsAPIClient, KolorsAPIError


router = APIRouter(prefix="/api", tags=["Virtual Try-On"])


class TryOnResponse(BaseModel):
    """Response model for try-on endpoint"""
    success: bool
    result_image: Optional[str] = None  # base64 encoded
    task_id: Optional[str] = None
    message: str
    error: Optional[str] = None


def save_uploaded_file(upload_file: UploadFile) -> str:
    """Save uploaded file to temp directory"""
    suffix = Path(upload_file.filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = upload_file.file.read()
        tmp.write(content)
        return tmp.name


def cleanup_temp_file(file_path: str) -> None:
    """Remove temporary file"""
    try:
        if file_path and os.path.exists(file_path):
            os.unlink(file_path)
    except Exception as e:
        print(f"Warning: Failed to cleanup temp file {file_path}: {e}")


@router.get("/tryon/health")
async def tryon_health():
    """
    Check if virtual try-on service is configured and available.
    """
    if not config.VIRTUAL_TRYON_ENABLED:
        return {
            "status": "disabled",
            "message": "Virtual try-on feature is not enabled"
        }
    
    if not config.KOLORS_API_KEY:
        return {
            "status": "not_configured",
            "message": "Kolors API key not configured"
        }
    
    try:
        # Try to create client to validate API key format
        client = KolorsAPIClient(
            api_key=config.KOLORS_API_KEY,
            secret_key=config.KOLORS_SECRET_KEY,
            base_url=config.KOLORS_API_BASE_URL
        )
        return {
            "status": "ready",
            "message": "Virtual try-on service is ready",
            "api_url": config.KOLORS_API_BASE_URL,
            "model": config.KOLORS_MODEL_VERSION
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Configuration error: {str(e)}"
        }


@router.post("/tryon", response_model=TryOnResponse)
async def virtual_tryon(
    person_image: UploadFile = File(..., description="Person/model photo"),
    garment_product_id: Optional[str] = Form(None, description="Product ID from catalog"),
    garment_image: Optional[UploadFile] = File(None, description="Or upload garment image directly"),
    seed: int = Form(default=0),
    randomize_seed: bool = Form(default=True)
):
    """
    Generate virtual try-on using official Kolors API.
    
    Requires either garment_product_id OR garment_image.
    
    Flow:
    1. Validate and save user photo
    2. Get garment image (from catalog or upload)
    3. Call Kolors API (async task)
    4. Poll until complete
    5. Download and return result
    """
    
    # Check if feature is enabled
    if not config.VIRTUAL_TRYON_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Virtual try-on is currently disabled. Set VIRTUAL_TRYON_ENABLED=true in .env"
        )
    
    # Check API key is configured
    if not config.KOLORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Virtual try-on API not configured. Set KOLORS_API_KEY in .env"
        )
    
    # Validate we have garment source
    if not garment_product_id and not garment_image:
        raise HTTPException(
            status_code=400,
            detail="Must provide either garment_product_id or garment_image"
        )
    
    person_path = None
    garment_path = None
    result_path = None
    
    try:
        # Save person image
        person_path = save_uploaded_file(person_image)
        
        # Get garment image
        if garment_image:
            # Use uploaded garment
            garment_path = save_uploaded_file(garment_image)
        else:
            # Get from catalog
            garment_path = os.path.join(config.IMAGES_PATH, f"{garment_product_id}.jpg")
            
            if not os.path.exists(garment_path):
                raise HTTPException(
                    status_code=404,
                    detail=f"Garment image not found for product ID: {garment_product_id}"
                )
        
        # Create result directory if needed
        result_dir = Path(config.TRYON_RESULT_DIR)
        result_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize Kolors client
        client = KolorsAPIClient(
            api_key=config.KOLORS_API_KEY,
            secret_key=config.KOLORS_SECRET_KEY,
            base_url=config.KOLORS_API_BASE_URL
        )
        
        # Generate try-on result
        print(f"Starting try-on generation...")
        task_id = client.create_tryon_task(
            human_image=person_path,
            cloth_image=garment_path,
            model_name=config.KOLORS_MODEL_VERSION
        )
        print(f"Task created: {task_id}")
        
        # Wait for result
        print(f"Polling task status (timeout: {config.KOLORS_TIMEOUT}s)...")
        result_url = client.wait_for_result(
            task_id=task_id,
            timeout=config.KOLORS_TIMEOUT,
            poll_interval=config.KOLORS_POLL_INTERVAL
        )
        print(f"Result ready: {result_url}")
        
        # Download result
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_filename = f"tryon_{task_id}_{timestamp}.jpg"
        result_path = str(result_dir / result_filename)
        
        client.download_result_image(result_url, result_path)
        print(f"Result saved: {result_path}")
        
        # Encode result as base64
        with open(result_path, 'rb') as f:
            result_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        return TryOnResponse(
            success=True,
            result_image=result_base64,
            task_id=task_id,
            message="Try-on generated successfully"
        )
    
    except TimeoutError as e:
        print(f"Timeout error: {e}")
        raise HTTPException(
            status_code=504,
            detail=f"Try-on generation timed out after {config.KOLORS_TIMEOUT} seconds. Please try again."
        )
    
    except KolorsAPIError as e:
        error_msg = str(e)
        print(f"Kolors API error: {error_msg}")
        
        # Map specific errors to user-friendly messages
        if "1001" in error_msg or "Authentication" in error_msg:
            detail = "Invalid API key - please check KOLORS_API_KEY configuration"
        elif "1002" in error_msg or "Invalid parameters" in error_msg:
            detail = "Invalid image parameters - please check image quality"
        elif "1003" in error_msg or "Image format" in error_msg:
            detail = "Image format error - please use JPG or PNG"
        elif "1004" in error_msg or "Rate limit" in error_msg:
            detail = "API rate limit exceeded - please try again later"
        elif "5000" in error_msg or "Server error" in error_msg:
            detail = "Kolors server error - please try again later"
        else:
            detail = f"Try-on failed: {error_msg}"
        
        raise HTTPException(status_code=500, detail=detail)
    
    except HTTPException:
        raise
    
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Try-on failed: {str(e)}"
        )
    
    finally:
        # Cleanup temp files
        cleanup_temp_file(person_path)
        if garment_image:  # Only cleanup if we uploaded it
            cleanup_temp_file(garment_path)
