#!/bin/sh
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=server_dist
