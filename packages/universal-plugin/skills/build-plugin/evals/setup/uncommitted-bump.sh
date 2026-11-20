#!/bin/sh
# The fixture commits plugin.json at 0.2.0; roll the commit back to 0.1.0 and leave the bump
# uncommitted, so the run starts from a source change that has not been built or committed.
set -e
sed 's/"version": "0.2.0"/"version": "0.1.0"/' plugin.json > plugin.json.tmp
mv plugin.json.tmp plugin.json
git commit -qam "chore: start at 0.1.0"
sed 's/"version": "0.1.0"/"version": "0.2.0"/' plugin.json > plugin.json.tmp
mv plugin.json.tmp plugin.json
