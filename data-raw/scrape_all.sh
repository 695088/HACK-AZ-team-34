#!/bin/bash

# Run all course scrapers with delays to avoid 429 rate limiting
SCRIPT="scraper.py"
DELAY=200  # seconds between requests

courses=(
  "BCOM 212 bcom212_reviews.json"
  "BCOM 214 bcom214_reviews.json"
  "BCOM 314R bcom314_reviews.json"
  "BNAD 100 bnad100_reviews.json"
  "BNAD 200 bnad200_reviews.json"
  "BNAD 201 bnad201_reviews.json"
  "BNAD 240 bnad240_reviews.json"
  "BNAN 276 bnan276_reviews.json"
  "BNAN 277 bnan277_reviews.json"
  "BNAD 293A bnad293a_reviews.json"
  "BNAD 301 bnad301_reviews.json"
  "BNAD 302 bnad302_reviews.json"
  "BNAD 303 bnad303_reviews.json"
  "BNAD 304 bnad304_reviews.json"
  "BNAD 393A bnad393a_reviews.json"
  "BNAD 449 bnad449_reviews.json"
  "BNAD 450 bnad450_reviews.json"
)

total=${#courses[@]}
count=0

for entry in "${courses[@]}"; do
  read -r subject number out <<< "$entry"
  count=$((count + 1))
  echo "[$count/$total] Scraping $subject $number -> $out"

  python3 "$SCRIPT" --subject "$subject" --number "$number" --out "$out"

  if [ $? -ne 0 ]; then
    echo "  ERROR scraping $subject $number — skipping"
  else
    echo "  Done."
  fi

  if [ $count -lt $total ]; then
    echo "  Waiting ${DELAY}s..."
    sleep $DELAY
  fi
done

echo ""
echo "All done! ($total courses attempted)"
