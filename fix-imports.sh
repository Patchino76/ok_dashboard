#!/bin/bash
# Fix imports for Linux compatibility
echo "Fixing module imports for Linux compatibility..."

# Create symlinks for case-sensitive imports if needed
cd src/components/charts/trend
if [ -f "trendCalculation.ts" ] && [ ! -f "TrendCalculation.ts" ]; then
  ln -s trendCalculation.ts TrendCalculation.ts
  echo "Created symlink for trendCalculation.ts"
fi

if [ -f "trendVisualization.ts" ] && [ ! -f "TrendVisualization.ts" ]; then
  ln -s trendVisualization.ts TrendVisualization.ts
  echo "Created symlink for trendVisualization.ts"
fi

# Fix for lib/utils if needed
cd ../../../
if [ -d "lib" ] && [ -f "lib/utils.ts" ]; then
  echo "lib/utils.ts exists"
else
  mkdir -p lib
  echo "// Re-export utils for compatibility
export * from '../utils';
" > lib/utils.ts
  echo "Created lib/utils.ts"
fi

# Ensure hooks directory exists and has proper exports
if [ ! -d "hooks" ]; then
  mkdir -p hooks
  echo "// Re-export hooks
export * from '../lib/hooks';
" > hooks/index.ts
  echo "Created hooks/index.ts"
fi

echo "Import fixes completed. Now try building the project with npm run build"
