"""
Fashion AI Chatbot - FastAPI Backend
Main application entry point with startup events.
"""

import os
import pickle
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import config
from .routers.search import router as search_router
from .routers.products import router as products_router
from .routers.voice import router as voice_router
from .routers.tryon import router as tryon_router
from .utils.embeddings import load_clip_model
from .utils.faiss_manager import faiss_manager
from .services.llm_service import initialize_llms
from .services.workflow import get_compiled_app


def build_dynamic_vocabulary(dataframe: pd.DataFrame):
    """
    Extracts fashion keywords from dataset columns.
    Ported from FP.ipynb.
    """
    print("\n🔧 Building dynamic vocabulary from dataset...")
    
    # Check for cache
    if os.path.exists(config.VOCABULARY_CACHE_PATH):
        try:
            with open(config.VOCABULARY_CACHE_PATH, 'rb') as f:
                vocab_data = pickle.load(f)
                config.DYNAMIC_FASHION_ITEMS.update(vocab_data.get('items', set()))
                config.DYNAMIC_COLORS.update(vocab_data.get('colors', set()))
                config.DYNAMIC_BRANDS.update(vocab_data.get('brands', set()))
                config.DYNAMIC_GENDERS.update(vocab_data.get('genders', set()))
            print(f"   ✅ Loaded vocabulary from cache: {config.VOCABULARY_CACHE_PATH}")
            
            sample_items = list(config.DYNAMIC_FASHION_ITEMS)[:10]
            sample_colors = list(config.DYNAMIC_COLORS)[:10]
            print(f"   Sample items: {', '.join(sample_items)}")
            print(f"   Sample colors: {', '.join(sample_colors)}")
            return
        except Exception as e:
            print(f"   ⚠️ Failed to load vocabulary cache: {e}")
            # Fallthrough to rebuild
    
    if 'articleType' in dataframe.columns:
        items = dataframe['articleType'].dropna().str.lower().str.strip().unique()
        config.DYNAMIC_FASHION_ITEMS.update(items)
        print(f"   ✓ {len(items)} article types detected")
    
    if 'baseColour' in dataframe.columns:
        colors = dataframe['baseColour'].dropna().str.lower().str.strip().unique()
        config.DYNAMIC_COLORS.update(colors)
        print(f"   ✓ {len(colors)} colors detected")
    
    if 'brandName' in dataframe.columns:
        brands = dataframe['brandName'].dropna().str.lower().str.strip().unique()
        config.DYNAMIC_BRANDS.update(brands)
        print(f"   ✓ {len(brands)} brands detected")
    
    if 'productDisplayName' in dataframe.columns:
        products = dataframe['productDisplayName'].dropna().str.lower().str.strip().unique()
        config.DYNAMIC_BRANDS.update(products)
        print(f"   ✓ {len(products)} product names detected")
    
    if 'gender' in dataframe.columns:
        genders = dataframe['gender'].dropna().str.lower().str.strip().unique()
        config.DYNAMIC_GENDERS.update(genders)
        print(f"   ✓ {len(genders)} genders detected: {', '.join(genders)}")
        
    # Save to cache
    try:
        vocab_data = {
            'items': config.DYNAMIC_FASHION_ITEMS,
            'colors': config.DYNAMIC_COLORS,
            'brands': config.DYNAMIC_BRANDS,
            'genders': config.DYNAMIC_GENDERS
        }
        with open(config.VOCABULARY_CACHE_PATH, 'wb') as f:
            pickle.dump(vocab_data, f)
        print(f"   💾 Saved vocabulary to cache: {config.VOCABULARY_CACHE_PATH}")
    except Exception as e:
        print(f"   ⚠️ Failed to save vocabulary cache: {e}")
    
    sample_items = list(config.DYNAMIC_FASHION_ITEMS)[:10]
    sample_colors = list(config.DYNAMIC_COLORS)[:10]
    print(f"\n   Sample items: {', '.join(sample_items)}")
    print(f"   Sample colors: {', '.join(sample_colors)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - runs on startup and shutdown."""
    
    # ========== STARTUP ==========
    print("=" * 80)
    print("🎨 FASHION AI CHATBOT - STARTING UP")
    print("=" * 80)
    
    config.print_status()
    
    # Validate configuration
    if not config.validate():
        print("❌ Configuration validation failed!")
        # Continue anyway for development
    
    # Load CLIP model
    load_clip_model()
    
    # Initialize LLMs (optional, may be slow)
    print("\n🔧 Initializing LLMs (this may take a moment)...")
    try:
        initialize_llms()
    except Exception as e:
        print(f"⚠️ LLM initialization failed: {e}")
        print("   Continuing without local LLMs...")
    
    # Load dataset
    # Load dataset
    df_with_images = pd.DataFrame()
    dataset_loaded_from_cache = False
    
    print(f"\n📊 Loading dataset...")
    
    # Try loading from cache first
    if os.path.exists(config.DATASET_CACHE_PATH):
        try:
            print(f"   Loading from cache: {config.DATASET_CACHE_PATH}")
            df_with_images = pd.read_pickle(config.DATASET_CACHE_PATH)
            dataset_loaded_from_cache = True
            print(f"   ✅ Cached Dataset: {len(df_with_images)} valid images")
        except Exception as e:
            print(f"   ⚠️ Failed to load dataset cache: {e}")
            dataset_loaded_from_cache = False

    if not dataset_loaded_from_cache:
        print(f"   Loading from CSV: {config.STYLES_CSV}...")
        try:
            df = pd.read_csv(config.STYLES_CSV, on_bad_lines='skip')
            
            # Build image paths (Slow operation)
            df['image_path'] = df.apply(
                lambda r: os.path.join(config.IMAGES_PATH, f"{r['id']}.jpg")
                if os.path.exists(os.path.join(config.IMAGES_PATH, f"{r['id']}.jpg")) else None,
                axis=1
            )
            df['image_id'] = df['id'].astype(str)
            df_with_images = df[df['image_path'].notna()].copy()
            
            print(f"   ✅ Loaded from CSV: {df.shape[0]} rows, {len(df_with_images)} valid images")
            
            # Save to cache
            if not df_with_images.empty:
                try:
                    df_with_images.to_pickle(config.DATASET_CACHE_PATH)
                    print(f"   💾 Saved dataset to cache: {config.DATASET_CACHE_PATH}")
                except Exception as e:
                    print(f"   ⚠️ Failed to save dataset cache: {e}")
            
        except Exception as e:
            print(f"❌ Failed to load dataset: {e}")
            df_with_images = pd.DataFrame()
        
    # Build vocabulary
    build_dynamic_vocabulary(df_with_images)
    
    # Load or build FAISS index
    if not faiss_manager.load_from_disk():
        print("\n🔨 Building new FAISS index...")
        if len(df_with_images) > 0:
            if faiss_manager.build_index(df_with_images):
                faiss_manager.save_to_disk()
            else:
                print("❌ Failed to build FAISS index")
        else:
            print("❌ No data available to build index")
    
    # Compile workflow
    print("\n🔗 Compiling LangGraph workflow...")
    get_compiled_app()
    
    print("\n" + "=" * 80)
    print("✅ FASHION AI CHATBOT - READY")
    print(f"   API: http://localhost:{config.BACKEND_PORT}")
    print(f"   Health: http://localhost:{config.BACKEND_PORT}/api/health")
    print(f"   Search: POST http://localhost:{config.BACKEND_PORT}/api/search")
    print("=" * 80 + "\n")
    
    yield  # Application runs here
    
    # ========== SHUTDOWN ==========
    print("\n🛑 Fashion AI Chatbot shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Fashion AI Chatbot",
    description="AI-powered fashion search with CLIP, FAISS, and Gemini",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for images
if os.path.exists(config.IMAGES_PATH):
    app.mount("/images", StaticFiles(directory=config.IMAGES_PATH), name="images")

# Include routers
# Include routers
app.include_router(search_router)
app.include_router(products_router)
app.include_router(voice_router)
app.include_router(tryon_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Fashion AI Chatbot",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs"
    }
