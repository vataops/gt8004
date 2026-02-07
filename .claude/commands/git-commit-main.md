---
allowed-tools: Bash(git status:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git checkout:*), Bash(git merge:*), Bash(git diff:*), Bash(git log:*), Read, Glob, Grep, AskUserQuestion
argument-hint: [commit-message]
description: Git commit and push changes
---

## Context

- Current git status: !`git status --short`
- Current branch: !`git branch --show-current`

## Your task

### 1. Commit & Push (current branch)

1. Stage all changes with `git add .`
2. Analyze the staged changes and create an appropriate commit message
   - If `$ARGUMENTS` is provided, use it as the commit message
   - Otherwise, generate a commit message based on the changes
3. Commit and push to current branch

### 2. Merge to main

If current branch is NOT `main`:
1. Checkout to `main`
2. Merge the feature branch into `main`
3. Push `main` to origin
4. Checkout back to the feature branch
5. Report what was merged (commit count, summary of changes)
