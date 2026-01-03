"""
Configuration module for Fashion AI Chatbot Backend.
Ported from FP.ipynb with environment variable support.
"""

import os
import random
from pathlib import Path
from dotenv import load_dotenv
import torch

# Load environment variables
load_dotenv()

class Config:
    """Configuration class with all settings from the notebook."""
    
    # Base paths
    BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # project root
    DATA_PATH = os.getenv("DATA_PATH", str(BASE_DIR / "data"))
    IMAGES_PATH = os.path.join(DATA_PATH, "images")
    STYLES_CSV = os.path.join(DATA_PATH, "styles.csv")
    
    # Vector DB persistence
    VECTOR_DB_PATH = str(Path(__file__).resolve().parent.parent.parent / "vector_db")
    FAISS_INDEX_FILE = os.path.join(VECTOR_DB_PATH, "faiss_index.bin")
    METADATA_FILE = os.path.join(VECTOR_DB_PATH, "metadata.pkl")
    # Cache paths
    DATASET_CACHE_PATH = os.path.join(VECTOR_DB_PATH, "dataset_cache.pkl")
    VOCABULARY_CACHE_PATH = os.path.join(VECTOR_DB_PATH, "vocabulary_cache.pkl")
    
    # Device configuration
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Model names
    CLASSIFIER_MODEL = "EnasEmad/fashion_cls"  # Binary classifier: fashion or not
    WHISPER_MODEL = "openai/whisper-small.en"  # STT model for voice input (English optimized)
    CLIP_MODEL = "patrickjohncyh/fashion-clip"
    
    # LLM Settings
    CLASSIFIER_TEMP = 0.1
    MAX_TOKENS_CLASSIFIER = 20
    
    # Image Validation Thresholds
    FASHION_SCORE_THRESHOLD = 0.20
    #NON_FASHION_THRESHOLD = 0.30
    #HIGH_CONFIDENCE_THRESHOLD = 0.70
    #SIMILARITY_WARNING_THRESHOLD = 0.25
    
    # Text Intent Classification
    #TEXT_FASHION_THRESHOLD = 0.3
    #TEXT_SEARCH_THRESHOLD = 0.5
    
    # Hybrid Search Weights
    TEXT_WEIGHT = 0.60  # 60% for text when both present
    IMAGE_WEIGHT = 0.40  # 40% for image when both present
    IMAGE_ONLY_WEIGHT = 1.0  # 100% for image-only search
    TEXT_ONLY_WEIGHT = 1.0  # 100% for text-only search
    
    # Search Settings
    FAISS_MAX_ITEMS = 44419
    #SEARCH_DEFAULT_K = 5
    INDEX_BATCH_SIZE = 1000
    
    # API Settings
    BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
    FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "3000"))
    
    # Kolors Virtual Try-On Official API
    KOLORS_API_KEY = os.getenv("KOLORS_API_KEY", "")
    KOLORS_SECRET_KEY = os.getenv("KOLORS_SECRET_KEY", "")
    KOLORS_API_BASE_URL = os.getenv("KOLORS_API_BASE_URL", "https://api.kolors.com")
    KOLORS_MODEL_VERSION = os.getenv("KOLORS_MODEL_VERSION", "kolors-virtual-try-on-v1")
    KOLORS_TIMEOUT = int(os.getenv("KOLORS_TIMEOUT", "60"))
    KOLORS_POLL_INTERVAL = int(os.getenv("KOLORS_POLL_INTERVAL", "2"))
    
    # Virtual Try-On Settings
    VIRTUAL_TRYON_ENABLED = os.getenv("VIRTUAL_TRYON_ENABLED", "false").lower() == "true"
    TRYON_RESULT_DIR = os.getenv("TRYON_RESULT_DIR", "./tryon_results")
  # seconds
    
    # Gemini API
    # Gemini API
    _GEMINI_API_KEYS_STR = os.getenv("GEMINI_API_KEY", "AIzaSyAlW_JoOoVb5pzt8B9_peZbfxVeqi0QJOw")
    GEMINI_API_KEYS = [k.strip() for k in _GEMINI_API_KEYS_STR.split(",") if k.strip()]
    GEMINI_MODEL = "gemini-2.5-flash-lite"
    
    @classmethod
    def get_gemini_api_key(cls) -> str:
        """Get a random Gemini API key from the pool."""
        if not cls.GEMINI_API_KEYS:
            return ""
        return random.choice(cls.GEMINI_API_KEYS)
    
    # Dynamic Vocabulary (populated at runtime from dataset)
    DYNAMIC_FASHION_ITEMS: set = set()
    DYNAMIC_COLORS: set = set()
    DYNAMIC_BRANDS: set = set()
    DYNAMIC_GENDERS: set = set()
    
    @classmethod
    def validate(cls) -> bool:
        """Validate required configuration."""
        errors = []
        
        if not os.path.exists(cls.DATA_PATH):
            errors.append(f"DATA_PATH does not exist: {cls.DATA_PATH}")
        
        if not os.path.exists(cls.STYLES_CSV):
            errors.append(f"STYLES_CSV does not exist: {cls.STYLES_CSV}")
        
        if not cls.GEMINI_API_KEYS:
            errors.append("GEMINI_API_KEY is not set")
        
        if errors:
            for error in errors:
                print(f"❌ Config Error: {error}")
            return False
        
        return True
    
    @classmethod
    def print_status(cls):
        """Print configuration status."""
        print("=" * 80)
        print("🎨 FASHION AI CHATBOT - CONFIGURATION")
        print("=" * 80)
        print(f"   Device: {cls.DEVICE}")
        print(f"   Data Path: {cls.DATA_PATH}")
        print(f"   Vector DB: {cls.VECTOR_DB_PATH}")
        print(f"   Backend Port: {cls.BACKEND_PORT}")
        print(f"   CLIP Model: {cls.CLIP_MODEL}")
        print(f"   Gemini Model: {cls.GEMINI_MODEL}")
        print(f"   Image-Only Search: {cls.IMAGE_ONLY_WEIGHT*100}% image")
        print(f"   Text-Only Search: {cls.TEXT_ONLY_WEIGHT*100}% text")
        print(f"   Hybrid Search: {cls.TEXT_WEIGHT*100}% text, {cls.IMAGE_WEIGHT*100}% image")
        print("=" * 80)


# Global config instance
config = Config()
