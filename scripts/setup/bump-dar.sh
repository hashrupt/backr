#!/usr/bin/env bash
# Bump DAR version and prepare for release
# Usage: ./scripts/setup/bump-dar.sh <version>
# Example: ./scripts/setup/bump-dar.sh 0.2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

VERSION="${1:?Usage: $0 <version> (e.g., 0.2.0)}"

DAML_YAML="${PROJECT_ROOT}/canton/daml/daml.yaml"
RELEASES_DIR="${PROJECT_ROOT}/canton/releases"

echo "=== Bumping Backr DAR to version ${VERSION} ==="

# Check daml.yaml exists
if [ ! -f "$DAML_YAML" ]; then
  echo "ERROR: daml.yaml not found at $DAML_YAML"
  exit 1
fi

# Update version in daml.yaml
echo "Updating version in daml.yaml..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/^version: .*/version: ${VERSION}/" "$DAML_YAML"
else
  sed -i "s/^version: .*/version: ${VERSION}/" "$DAML_YAML"
fi

# Build DAR
echo "Building DAR..."
cd "${PROJECT_ROOT}/canton/daml"
daml build

# Create releases directory
mkdir -p "$RELEASES_DIR"

# Copy DAR to releases
DAR_SOURCE="${PROJECT_ROOT}/canton/daml/.daml/dist/backr-${VERSION}.dar"
DAR_DEST="${RELEASES_DIR}/backr-${VERSION}.dar"

if [ ! -f "$DAR_SOURCE" ]; then
  echo "ERROR: Built DAR not found at $DAR_SOURCE"
  exit 1
fi

cp "$DAR_SOURCE" "$DAR_DEST"
echo "Copied DAR to $DAR_DEST"

# Also update the dars folder symlink/copy
cp "$DAR_SOURCE" "${PROJECT_ROOT}/canton/dars/backr-${VERSION}.dar"

echo ""
echo "=== DAR bump complete ==="
echo "Version: ${VERSION}"
echo "DAR file: ${DAR_DEST}"
echo ""
echo "Next steps:"
echo "  1. Commit the changes: git add -A && git commit -m 'Bump DAR to v${VERSION}'"
echo "  2. Create a tag: git tag v${VERSION}"
echo "  3. Push: git push origin main --tags"
