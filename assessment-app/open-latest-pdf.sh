#!/bin/bash
# Open the most recently generated test PDF

LATEST_PDF=$(ls -t test-assessment-*.pdf 2>/dev/null | head -1)

if [ -z "$LATEST_PDF" ]; then
    echo "No test PDFs found. Generate one first at http://localhost:3000/test-pdf.html"
else
    echo "Opening: $LATEST_PDF"
    open "$LATEST_PDF"
fi