<!-- BEGIN:agent-skills -->
# Agent Skills Integration

This project uses production-grade engineering skills from [agent-skills](https://github.com/addyosmani/agent-skills).

## Core Rules

- If a task matches a skill, you MUST invoke it via the `skill` tool
- Skills are located in `../agent-skills/skills/<skill-name>/SKILL.md`
- Never implement directly if a skill applies
- Always follow the skill instructions exactly

## Intent → Skill Mapping

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation`, `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / failure → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactoring → `code-simplification`
- API design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`

## Lifecycle

- DEFINE → `spec-driven-development`
- PLAN → `planning-and-task-breakdown`
- BUILD → `incremental-implementation` + `test-driven-development`
- VERIFY → `debugging-and-error-recovery`
- REVIEW → `code-review-and-quality`
- SHIP → `shipping-and-launch`

The reference `agent-skills` is available in opencode for detailed docs.

<!-- END:agent-skills -->
