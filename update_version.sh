#!/bin/bash

# Generate version timestamp
VERSION="v$(date '+%Y%m%d.%H%M%S')"

# Update version in meta tag
sed -i '' "s/content=\"v[0-9]*\.[0-9]*\"/content=\"$VERSION\"/g" app.html

# Update visible version in header
sed -i '' "s/>v[0-9]*\.[0-9]*</>$VERSION</g" app.html

echo "Updated version to $VERSION"