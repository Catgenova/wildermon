#!/bin/bash
# Whether the code of this commit has passed the rules already, for a live run of `island.yml` (its `already` job).
#
# Asked for: a live run that does not test again what has passed already. A push runs the whole suite; the live run
# dispatched after it used to run it all again over the same code. This looks through the workflow's latest runs for
# one over the same code -- the same tree but for the built site, which `build-site.yml` makes from it and commits on
# its own -- and says `tested=true` when the newest such run that has finished passed its rules. One still going is
# waited for, up to WAIT_MINUTES. Anything else, a failure to ask included, says `tested=false`, and the rules run
# here as they always did.
set -u
out() { echo "tested=$1" >> "$GITHUB_OUTPUT"; echo "tested=$1: $2"; exit 0; }

WAIT_MINUTES=${WAIT_MINUTES:-60}
# The built site, which is made from the rest and pushed by a bot after it.
BUILT=(':(exclude)index.html' ':(exclude)account.html' ':(exclude)wildermon.html' ':(exclude)assets'
       ':(exclude)icons' ':(exclude)manifest.webmanifest')

# Whether a commit carries the same code as this one.
same() {
  git cat-file -e "$1^{commit}" 2>/dev/null || git fetch -q --depth=200 origin "$1" 2>/dev/null || return 1
  git diff --quiet "$1" "$GITHUB_SHA" -- . "${BUILT[@]}"
}

# Whether a run passed its rules: every shard of them passed, or it let them off because they had passed already
# (its `already` job said so, and its rules shards were all skipped).
rules_passed() {
  local jobs
  jobs=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$1/jobs?per_page=100" --jq '[.jobs[] | {name, conclusion}]') || return 1
  jq -e '[.[] | select(.name | startswith("The rules"))] as $r
    | ($r | length) > 0 and (
        ($r | all(.conclusion == "success"))
        or (($r | all(.conclusion == "skipped"))
            and any(.[]; .name == "Whether this code has passed already" and .conclusion == "success")))' <<< "$jobs" > /dev/null
}

deadline=$(( $(date +%s) + WAIT_MINUTES * 60 ))
while :; do
  runs=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/island.yml/runs?per_page=40" \
    --jq '.workflow_runs[] | "\(.id) \(.head_sha) \(.status) \(.conclusion)"') || out false "could not list the runs"
  going=""
  while read -r id sha status conclusion; do
    [ "$id" = "$GITHUB_RUN_ID" ] && continue
    same "$sha" || continue
    if [ "$status" != "completed" ]; then
      going="$id"
      continue
    fi
    # The newest finished run over this code decides: its rules passed, or they did not.
    if rules_passed "$id"; then out true "run $id over ${sha:0:7} passed its rules"; fi
    [ -n "$going" ] && break
    out false "run $id over ${sha:0:7} did not pass its rules"
  done <<< "$runs"
  [ -z "$going" ] && out false "no run over this code"
  [ "$(date +%s)" -ge "$deadline" ] && out false "run $going over this code still going after $WAIT_MINUTES minutes"
  echo "Waiting on run $going over this code."
  sleep 30
done
