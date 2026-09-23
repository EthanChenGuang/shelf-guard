#!/usr/bin/env bash
# Generate golden JPEG fixtures for vision worker integration tests (D-28).
set -euo pipefail
DIR="public/test-fixtures"
mkdir -p "$DIR"
SHELF="#121212"
PRODUCT="#EEEEEE"

base="$DIR/_base.png"
convert -size 1080x1920 "xc:${SHELF}" "$base"

draw_tier_products() {
  local file=$1
  convert "$file" \
    -fill "$PRODUCT" \
    -draw "rectangle 140,90 420,520" \
    -draw "rectangle 560,90 840,520" \
    -draw "rectangle 140,610 420,840" \
    -draw "rectangle 560,610 840,840" \
    -draw "rectangle 140,930 420,1160" \
    -draw "rectangle 560,930 840,1160" \
    -draw "rectangle 140,1250 420,1470" \
    -draw "rectangle 560,1250 840,1470" \
    "$file"
}

draw_tier_products "$base"
convert "$base" -quality 95 "$DIR/baseline-aligned.jpg"

# Tier 4 right product removed (rowIndex 3 MISSING)
convert "$base" \
  -fill "$SHELF" \
  -draw "rectangle 560,1250 840,1470" \
  -quality 95 "$DIR/capture-missing.jpg"

# Tier 2 left product translated 120px right (rowIndex 1 MOVED)
convert "$base" \
  -fill "$SHELF" -draw "rectangle 140,610 420,840" \
  -fill "$PRODUCT" -draw "rectangle 260,610 540,840" \
  -quality 95 "$DIR/capture-displaced.jpg"

rm -f "$base"
echo "Generated fixtures in $DIR"
