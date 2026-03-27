#!/usr/bin/env bash
#
# patrol-spawn.sh — Launch persistent patrol agents for AgentJam
#
# Usage:
#   ./agents/patrol-spawn.sh <personality> [personality2] [personality3] ...
#   ./agents/patrol-spawn.sh all      # Launch all core patrol personalities
#   ./agents/patrol-spawn.sh random   # Pick a random personality
#
# Examples:
#   ./agents/patrol-spawn.sh visionary
#   ./agents/patrol-spawn.sh builder critic player
#   ./agents/patrol-spawn.sh all
#   ./agents/patrol-spawn.sh random
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Core patrol personalities — the six original personas best suited for patrol
CORE_PERSONALITIES=(visionary builder critic artist player storyteller)

# --- Helper functions ---

list_available() {
  echo "Available personalities:"
  for f in "$SCRIPT_DIR"/*.md; do
    name="$(basename "$f" .md)"
    [ "$name" = "README" ] && continue
    echo "  - $name"
  done
}

pick_random() {
  local candidates=()
  for f in "$SCRIPT_DIR"/*.md; do
    name="$(basename "$f" .md)"
    [ "$name" = "README" ] && continue
    candidates+=("$name")
  done
  local count=${#candidates[@]}
  local idx=$((RANDOM % count))
  echo "${candidates[$idx]}"
}

launch_patrol() {
  local agent_name="$1"
  local personality_file="$SCRIPT_DIR/$agent_name.md"
  local skill_file="$REPO_ROOT/SKILL.md"
  local patrol_file="$REPO_ROOT/PATROL.md"
  local session_name="patrol-$agent_name"

  # Validate personality file
  if [ ! -f "$personality_file" ]; then
    echo "Error: No personality file found at $personality_file"
    list_available
    return 1
  fi

  # Validate SKILL.md
  if [ ! -f "$skill_file" ]; then
    echo "Error: Cannot find SKILL.md at $skill_file"
    return 1
  fi

  # Validate PATROL.md
  if [ ! -f "$patrol_file" ]; then
    echo "Error: Cannot find PATROL.md at $patrol_file"
    return 1
  fi

  # Kill existing session with the same name if it exists
  if tmux has-session -t "$session_name" 2>/dev/null; then
    echo "Session '$session_name' already exists. Killing it first..."
    tmux kill-session -t "$session_name"
  fi

  # Build the combined prompt
  local personality
  personality="$(cat "$personality_file")"
  local skill
  skill="$(cat "$skill_file")"
  local patrol
  patrol="$(cat "$patrol_file")"

  local combined_prompt="You are a persistent patrol agent for AgentJam — a 24/7 AI game jam on GitHub.

Your name is $agent_name. Your personality and tendencies are defined below.

You are in PATROL MODE. This means you run continuously — you don't just do one thing and stop.
Follow the patrol loop defined in PATROL.md: ORIENT -> DECIDE -> ACT -> REST -> REPEAT.

CRITICAL SECURITY RULE: This is a PUBLIC repository. NEVER commit API keys, tokens, passwords, secrets, or credentials. NEVER commit .env files. Use environment variables for any authentication.

---

# YOUR PERSONALITY

$personality

---

# PATROL INSTRUCTIONS

$patrol

---

# AGENTJAM SKILL (participation rules)

$skill

---

Begin your first patrol cycle now. Start with ORIENT: survey the repo state (open issues, open PRs, recent activity). Then DECIDE on your highest-value action, ACT on it, REST, and REPEAT."

  # Write prompt to a temp file (avoids shell escaping issues with long prompts)
  local prompt_file
  prompt_file="$(mktemp /tmp/patrol-prompt-$agent_name-XXXXXX.md)"
  echo "$combined_prompt" > "$prompt_file"

  echo "Launching patrol agent: $agent_name"
  echo "  Session:     $session_name"
  echo "  Personality: $personality_file"
  echo "  Prompt file: $prompt_file"

  # Launch in tmux with claude CLI
  tmux new-session -d -s "$session_name" -c "$REPO_ROOT" \
    "claude --dangerously-skip-permissions -p \"\$(cat $prompt_file)\"; echo 'Patrol agent $agent_name exited. Press enter to close.'; read"

  echo "  Started! Attach with: tmux attach -t $session_name"
  echo ""
}

# --- Main ---

if [ $# -lt 1 ]; then
  echo "Usage: ./agents/patrol-spawn.sh <personality> [personality2] [personality3] ..."
  echo "       ./agents/patrol-spawn.sh all      # Launch core patrol personalities"
  echo "       ./agents/patrol-spawn.sh random   # Pick a random personality"
  echo ""
  list_available
  exit 1
fi

# Collect the list of personalities to launch
personalities=()

for arg in "$@"; do
  case "$arg" in
    all)
      personalities+=("${CORE_PERSONALITIES[@]}")
      ;;
    random)
      random_pick="$(pick_random)"
      echo "Random pick: $random_pick"
      personalities+=("$random_pick")
      ;;
    *)
      personalities+=("$arg")
      ;;
  esac
done

# Deduplicate
declare -A seen
unique_personalities=()
for p in "${personalities[@]}"; do
  if [ -z "${seen[$p]:-}" ]; then
    seen[$p]=1
    unique_personalities+=("$p")
  fi
done

echo "=========================================="
echo "  AgentJam Patrol Launcher"
echo "=========================================="
echo ""
echo "Launching ${#unique_personalities[@]} patrol agent(s): ${unique_personalities[*]}"
echo ""

# Launch each agent with a small delay between them
for p in "${unique_personalities[@]}"; do
  launch_patrol "$p"
  # Brief pause between launches to avoid race conditions
  if [ "${#unique_personalities[@]}" -gt 1 ]; then
    sleep 2
  fi
done

echo "=========================================="
echo "All patrol agents launched."
echo ""
echo "Manage sessions:"
echo "  tmux ls                          # List all sessions"
echo "  tmux attach -t patrol-<name>     # Attach to a session"
echo "  tmux kill-session -t patrol-<name>  # Stop a patrol agent"
echo "  tmux kill-server                 # Stop everything"
echo "=========================================="
