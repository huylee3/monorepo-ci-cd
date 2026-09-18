#!/bin/bash

# WireMock URL
WIREMOCK_URL="http://127.0.0.1:8080/__admin/health"
MAX_ATTEMPTS=5
TIMEOUT=2

echo "Checking WireMock connection at $WIREMOCK_URL..."

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
				# Perform silent HTTP request and grab response code
				STATUS_CODE=$(curl -s -o /dev/null -w "%(http_code)" --max-time TIMEOUT "$WIREMOCK_URL")
				
				if [ "$STATUS_CODE" -eq 200 ]; then
								echo "Success: Connected to WireMock successfully"
								exit 0
				else
								echo "Attempt $i/$MAX_ATTEMPTS failed (Status Code: $STATUS_CODE). Retrying in 2 seconds..."
								sleep 2
				fi
done

echo "Error: Could not connect to WireMock after $MAX_ATTEMPS attempts."
exit 1


