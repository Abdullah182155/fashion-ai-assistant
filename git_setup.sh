#!/bin/bash

# Git Setup Script for NTI_FP1
# Run this in your WSL terminal

echo "🚀 Starting Git Setup..."

# Initialize Git
if [ -d ".git" ]; then
    echo "⚠️  Git repository already initialized. Cleaning up..."
    rm -rf .git
    git init
    echo "✅ Git re-initialized."
else
    git init
    echo "✅ Git initialized."
fi

# Configure Remote and Buffer
echo "🌍 Configuring Remote and Buffer..."
git remote add origin https://github.com/Abdullah182155/fashion-ai-assistant.git
git config http.postBuffer 524288000
git config user.email "you@example.com" # Replace or rely on global
git config user.name "Your Name"       # Replace or rely on global

# --- Commit 1: Project Root & Config ---
echo "📦 Creating Commit 1: Project Root & Config..."
git add .gitignore README.md run.bat run.sh docker-compose.yml git_setup.sh
git commit -m "chore: initial project setup with config and scripts"

# --- Commit 2: Backend Base ---
echo "🐍 Creating Commit 2: Backend Base..."
if [ -f "backend/requirements.txt" ]; then git add backend/requirements.txt; fi
if [ -f "backend/.env.example" ]; then git add backend/.env.example; fi
git commit -m "feat(backend): add dependencies and environment config"

# --- Commit 3: Backend Logic ---
echo "🧠 Creating Commit 3: Backend Logic..."
if [ -d "backend/app" ]; then git add backend/app; fi
# backend/saved_audio and backend/vector_db are ignored now, so we skip adding them explicitly.

if [ -f "backend/__init__.py" ]; then git add backend/__init__.py; fi
git commit -m "feat(backend): add core application logic"

# --- Commit 4: Frontend Base ---
echo "🎨 Creating Commit 4: Frontend Base..."
if [ -f "frontend/package.json" ]; then git add frontend/package.json; fi
if [ -f "frontend/.env.example" ]; then git add frontend/.env.example; fi
git commit -m "feat(frontend): add package.json and environment config"

# --- Commit 5: Frontend Logic ---
echo "⚛️ Creating Commit 5: Frontend Logic..."
if [ -d "frontend/public" ]; then git add frontend/public; fi
if [ -f "frontend/server.js" ]; then git add frontend/server.js; fi
if [ -f "frontend/embed.js" ]; then git add frontend/embed.js; fi
git commit -m "feat(frontend): add widget UI, server, and embed script"

# --- Commit 6: Data & Assets ---
echo "📊 Creating Commit 6: Data & Assets..."
if [ -f "FP.ipynb" ]; then git add FP.ipynb; fi
if [ -d "UI" ]; then git add UI/; fi
git commit -m "chore: add notebooks and UI assets"

# --- catch all rest ---
echo "🧹 Checking for remaining files..."
git add .
git commit -m "chore: add remaining project files" || echo "No remaining files to commit."

# --- Branching Strategy ---
echo "🌿 Setting up Branching Strategy..."
git branch -m main
git checkout -b develop
echo "✅ Created 'develop' branch."

# Push to remote
echo "🚀 Pushing to remote..."
git push -u origin main
git push -u origin develop

echo "🎉 Git setup and push complete!"
