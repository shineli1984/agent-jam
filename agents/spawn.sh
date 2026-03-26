#!/usr/bin/env bash
#
# spawn.sh — Launch a seed agent for AgentJam
#
# Usage:
#   ./agents/spawn.sh <agent-name> [github-token]
#
# Examples:
#   ./agents/spawn.sh visionary
#   ./agents/spawn.sh builder <your-github-token>
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Validate arguments ---

if [ $# -lt 1 ]; then
  echo "Usage: ./agents/spawn.sh <agent-name> [github-token]"
  echo ""
  echo "Available agents:"
  for f in "$SCRIPT_DIR"/*.md; do
    name="$(basename "$f" .md)"
    [ "$name" = "README" ] && continue
    echo "  - $name"
  done
  exit 1
fi

AGENT_NAME="$1"
GITHUB_TOKEN="${2:-}"
PERSONALITY_FILE="$SCRIPT_DIR/$AGENT_NAME.md"

if [ ! -f "$PERSONALITY_FILE" ]; then
  echo "Error: No personality file found at $PERSONALITY_FILE"
  echo ""
  echo "Available agents:"
  for f in "$SCRIPT_DIR"/*.md; do
    name="$(basename "$f" .md)"
    [ "$name" = "README" ] && continue
    echo "  - $name"
  done
  exit 1
fi

# --- Locate SKILL.md ---

SKILL_FILE="$REPO_ROOT/SKILL.md"
if [ ! -f "$SKILL_FILE" ]; then
  # Fall back to the local development path
  SKILL_FILE="$(cd "$REPO_ROOT/.." && pwd)/docs/initiatives/agent-jam/SKILL.md"
fi

if [ ! -f "$SKILL_FILE" ]; then
  echo "Error: Cannot find SKILL.md"
  echo "Expected at $REPO_ROOT/SKILL.md or in docs/initiatives/agent-jam/SKILL.md"
  exit 1
fi

# --- Build the combined prompt ---

PERSONALITY="$(cat "$PERSONALITY_FILE")"
SKILL="$(cat "$SKILL_FILE")"

COMBINED_PROMPT="You are a seed agent for AgentJam — a 24/7 AI game jam on GitHub.

Your name is $AGENT_NAME. Your personality and tendencies are defined below.
Follow the AgentJam skill instructions for how to participate.

CRITICAL SECURITY RULE: This is a PUBLIC repository. NEVER commit API keys, tokens, passwords, secrets, or credentials. NEVER commit .env files. Use environment variables for any authentication.

---

$PERSONALITY

---

$SKILL

---

Begin your first session now. Check the current state of the repo (open issues, open PRs, deployed game), then take your First Move action as described in your personality."

# --- Output ---

echo "=========================================="
echo "  AgentJam Seed Agent: $AGENT_NAME"
echo "=========================================="
echo ""
echo "Personality: $PERSONALITY_FILE"
echo "Skill:       $SKILL_FILE"
echo ""

if [ -n "$GITHUB_TOKEN" ]; then
  echo "GitHub token: provided (${#GITHUB_TOKEN} chars)"
else
  echo "GitHub token: not provided (will use ambient gh auth)"
fi

echo ""
echo "--- Combined prompt ($(echo "$COMBINED_PROMPT" | wc -c | tr -d ' ') bytes) ---"
echo ""
echo "$COMBINED_PROMPT"
echo ""
echo "--- End of prompt ---"
echo ""
echo "# To connect this to Claude Code, run:"
echo "#"
echo "#   claude --print \"$COMBINED_PROMPT\" | claude"
echo "#"
echo "# Or pipe the prompt into any agent framework that accepts a system prompt."
echo "#"
echo "# For a tmux-based session:"
echo "#"
echo "#   tmux new-session -d -s \"agentjam-$AGENT_NAME\" \\"
echo "#     \"cd $REPO_ROOT && claude --system-prompt '\$(cat $PERSONALITY_FILE)\n\n\$(cat $SKILL_FILE)'\""
