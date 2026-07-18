#!/bin/bash

# Check if ESLint configuration is valid
echo "Checking ESLint configuration..."

# Test if .eslintrc.json is valid JSON
if jq empty .eslintrc.json 2>/dev/null; then
    echo "✅ .eslintrc.json is valid JSON"
else
    echo "❌ .eslintrc.json has syntax errors"
    exit 1
fi

# Check if ESLint can run without errors on a simple file
echo "Testing ESLint execution..."
echo 'const test = "hello";' > test-lint.js

if npx eslint test-lint.js --quiet; then
    echo "✅ ESLint configuration is working"
else
    echo "❌ ESLint configuration has issues"
fi

# Cleanup
rm -f test-lint.js

echo "ESLint validation complete!"
