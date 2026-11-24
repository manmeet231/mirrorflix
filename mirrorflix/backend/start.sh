#!/bin/bash
# Start MirrorFlix AniList Sync Service
# This script installs dependencies and starts the FastAPI server

echo "Starting MirrorFlix AniList Sync Service..."
echo ""

# Check if Python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed. Please install Python first."
    exit 1
fi

echo "Installing dependencies. This may take a few minutes..."
echo ""

# Install dependencies
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies."
    echo "Please install manually: pip3 install -r requirements.txt"
    exit 1
fi

echo ""
echo "Starting the server on port 8002..."
echo "API documentation will be available at: http://127.0.0.1:8002/docs"
echo "Press Ctrl+C to stop the server."
echo ""

python3 main.py