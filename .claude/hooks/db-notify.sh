#!/bin/bash
# DB 작업 감지 시 macOS 알림을 보내는 hook
# PreToolUse 이벤트에서 Bash, Edit, Write 도구에 대해 실행됨

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

notify() {
  local msg="$1"
  osascript -e "display notification \"$msg\" with title \"⚠️ DB Operation\" sound name \"Submarine\"" &>/dev/null
}

# Bash 명령어 감지
if [[ "$TOOL_NAME" == "Bash" ]]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

  # DB 관련 명령어 패턴
  if echo "$CMD" | grep -qiE '(psql|pg_dump|pg_restore|DROP\s+(TABLE|DATABASE|INDEX|SCHEMA)|ALTER\s+TABLE|CREATE\s+TABLE|TRUNCATE|DELETE\s+FROM|docker.*(compose|exec).*postgres)'; then
    notify "Bash: $(echo "$CMD" | head -c 80)"
  fi
fi

# Edit/Write 파일 경로 감지
if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

  if echo "$FILE_PATH" | grep -qiE '\.(sql)$|/migrations/|/migrate\.go$|/store/'; then
    notify "File: $(basename "$FILE_PATH")"
  fi
fi

exit 0
