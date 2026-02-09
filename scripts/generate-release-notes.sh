#!/usr/bin/env bash
set -euo pipefail

# BOTCHA Release Notes Generator
# Usage: ./scripts/generate-release-notes.sh v0.5.0 v0.5.1

if [ $# -lt 2 ]; then
  echo "Usage: $0 <previous-version> <new-version>"
  echo "Example: $0 v0.5.0 v0.5.1"
  exit 1
fi

PREV_VERSION=$1
NEW_VERSION=$2
OUTPUT_FILE="release-notes-${NEW_VERSION}.md"

echo "Generating release notes from ${PREV_VERSION} to ${NEW_VERSION}..."

# Get commit messages
COMMITS=$(git log ${PREV_VERSION}..${NEW_VERSION} --oneline)

# Get package versions
get_package_version() {
  local package_path=$1
  if [ -f "${package_path}/package.json" ]; then
    jq -r '.version' "${package_path}/package.json"
  else
    echo "N/A"
  fi
}

BOTCHA_VERSION=$(get_package_version "packages/core" || echo "N/A")
CF_VERSION=$(get_package_version "packages/cloudflare-workers" || echo "N/A")
CLI_VERSION=$(get_package_version "packages/cli" || echo "N/A")
LC_VERSION=$(get_package_version "packages/langchain" || echo "N/A")

# Extract categorized commits
FEATURES=$(echo "$COMMITS" | grep -E "^[a-f0-9]+ feat:" || true)
FIXES=$(echo "$COMMITS" | grep -E "^[a-f0-9]+ fix:" || true)
CHORES=$(echo "$COMMITS" | grep -E "^[a-f0-9]+ chore:" || true)
DOCS=$(echo "$COMMITS" | grep -E "^[a-f0-9]+ docs:" || true)
REFACTOR=$(echo "$COMMITS" | grep -E "^[a-f0-9]+ refactor:" || true)
PERF=$(echo "$COMMITS" | grep -E "^[a-f0-9]+ perf:" || true)

# Generate release notes
cat > "$OUTPUT_FILE" << EOF
# BOTCHA ${NEW_VERSION} - [TODO: Add Title]

> TODO: Add brief 1-2 sentence summary

## 🔥 Major Features

TODO: Highlight major features with examples

## 📦 Packages

| Package | Version | Changes |
|---------|---------|---------|
| [@dupecom/botcha](https://www.npmjs.com/package/@dupecom/botcha) | ${BOTCHA_VERSION} | TODO |
| [@dupecom/botcha-cloudflare](https://www.npmjs.com/package/@dupecom/botcha-cloudflare) | ${CF_VERSION} | TODO |
| [@dupecom/botcha-cli](https://www.npmjs.com/package/@dupecom/botcha-cli) | ${CLI_VERSION} | TODO |
| [@dupecom/botcha-langchain](https://www.npmjs.com/package/@dupecom/botcha-langchain) | ${LC_VERSION} | TODO |

## 📖 Full Changelog

### Features
EOF

# Add features
if [ -n "$FEATURES" ]; then
  echo "$FEATURES" | while read -r line; do
    echo "- ${line#* }" >> "$OUTPUT_FILE"
  done
else
  echo "- No new features in this release" >> "$OUTPUT_FILE"
fi

cat >> "$OUTPUT_FILE" << EOF

### Fixes
EOF

# Add fixes
if [ -n "$FIXES" ]; then
  echo "$FIXES" | while read -r line; do
    echo "- ${line#* }" >> "$OUTPUT_FILE"
  done
else
  echo "- No bug fixes in this release" >> "$OUTPUT_FILE"
fi

# Add other sections if not empty
if [ -n "$PERF" ]; then
  cat >> "$OUTPUT_FILE" << EOF

### Performance
EOF
  echo "$PERF" | while read -r line; do
    echo "- ${line#* }" >> "$OUTPUT_FILE"
  done
fi

if [ -n "$REFACTOR" ]; then
  cat >> "$OUTPUT_FILE" << EOF

### Refactoring
EOF
  echo "$REFACTOR" | while read -r line; do
    echo "- ${line#* }" >> "$OUTPUT_FILE"
  done
fi

if [ -n "$DOCS" ]; then
  cat >> "$OUTPUT_FILE" << EOF

### Documentation
EOF
  echo "$DOCS" | while read -r line; do
    echo "- ${line#* }" >> "$OUTPUT_FILE"
  done
fi

if [ -n "$CHORES" ]; then
  cat >> "$OUTPUT_FILE" << EOF

### Chores
EOF
  echo "$CHORES" | while read -r line; do
    echo "- ${line#* }" >> "$OUTPUT_FILE"
  done
fi

# Add footer
cat >> "$OUTPUT_FILE" << EOF

**Full Diff:** https://github.com/dupe-com/botcha/compare/${PREV_VERSION}...${NEW_VERSION}

---

**Live API:** https://botcha.ai  
**Docs:** https://botcha.ai/openapi.json  
**GitHub:** https://github.com/dupe-com/botcha  
**npm:** https://www.npmjs.com/package/@dupecom/botcha
EOF

echo "✅ Release notes generated: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Edit $OUTPUT_FILE to add details and examples"
echo "2. Create/update release: gh release create ${NEW_VERSION} --notes-file $OUTPUT_FILE"
echo "   or: gh release edit ${NEW_VERSION} --notes-file $OUTPUT_FILE"
