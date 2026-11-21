#!/bin/bash
# Serial v0.1.19 driver. One nextpnr at a time. Commits and pushes after every seed and after each fit pass.
set -euo pipefail
cd /workspace
export PATH="/opt/eda/oss-cad-suite/bin:/opt/eda/oss-cad-suite/py3bin:${PATH:-}"
export OSS_CAD_SUITE=/opt/eda/oss-cad-suite

commit_push() {
  local msg="$1"
  git add \
    fixtures/scp/v0119-industry-benchmark.json \
    fixtures/scp/v0119-pnr \
    docs/design/v0119-industry-benchmark.md \
    docs/design/v0119-reproduce.md
  if git diff --cached --quiet; then
    echo "nothing to commit: $msg"
    return 0
  fi
  git commit -m "$msg"
  git push
}

echo "BIT-EXACT $(date -Is)"
npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --bit-exact
commit_push "chore(scp): v0.1.19 bit-exact regression"

while IFS= read -r id; do
  [ -n "$id" ] || continue
  for seed in 1 2 3 4 5; do
    echo "SEED $id $seed $(date -Is)"
    npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only="$id" --seed="$seed"
    commit_push "chore(scp): v0.1.19 ECP5 ${id} seed ${seed}"
  done
  echo "FIT $id $(date -Is)"
  npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --only="$id" --fit
  commit_push "chore(scp): v0.1.19 ECP5 ${id} fit"
done < <(npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/bench-ecp5-v0119.ts --list)

echo "DONE $(date -Is)"
