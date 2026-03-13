#!/bin/bash

# Render build script for frontend
echo "Installing dependencies..."
npm install

echo "Building Next.js app..."
npm run build

echo "Build complete"