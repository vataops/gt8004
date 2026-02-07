---
allowed-tools: Bash(git status:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git diff:*), Bash(git log:*)
argument-hint: [commit-message]
description: Git commit and push to current branch
---

## Context

- Current git status: !`git status --short`
- Current branch: !`git branch --show-current`

## Your task

1. The Current branch should not be main. (By default, stg is recommended.)
2. Stage all changes with `git add .`
3. Analyze the staged changes and create an appropriate commit message
   - If `$ARGUMENTS` is provided, use it as the commit message
   - Otherwise, generate a commit message based on the changes
4. Commit and push to current branch
