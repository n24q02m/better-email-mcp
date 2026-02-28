# Contributing to Better Email MCP

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [Bun](https://bun.sh/) latest
- [mise](https://mise.jdx.dev/) (recommended)

## Setup

```bash
git clone https://github.com/n24q02m/better-email-mcp.git
cd better-email-mcp
mise run setup    # or: bun install
```

## Development Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes and test:
   ```bash
   bun test            # Run tests
   bun run check       # Lint + type check
   bun run dev         # Dev server with watch
   ```

3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add attachment preview support
   fix: handle IMAP connection timeout gracefully
   ```

4. Push and open a Pull Request against `main`

## Project Structure

```
src/
  init-server.ts              # Server entry point, env validation
  docs/                       # Markdown docs served as MCP resources
  tools/
    registry.ts               # Tool registration + routing
    composite/                # One file per domain (messages, folders, attachments, send)
    helpers/                  # errors, config, html-utils, imap-client, smtp-client
```

## Code Style

- **Formatter**: [Biome](https://biomejs.dev/) (2-space indent, single quotes, no semicolons)
- **Linting**: Biome rules + TypeScript strict mode
- **Line width**: 120 characters
- **Test framework**: [Vitest](https://vitest.dev/)

## Testing

- Write tests for all new functionality
- Place tests co-located with source in `src/`
- Use `*.test.ts` naming convention

```bash
bun test              # Run all tests
bun run test:watch    # Watch mode
bun run test:coverage # With coverage
```

## Pull Request Guidelines

- Fill out the PR template completely
- Ensure all CI checks pass
- Keep PRs focused on a single concern
- Update documentation if behavior changes
- Add tests for new functionality

## Release Process

Releases are automated via [python-semantic-release](https://python-semantic-release.readthedocs.io/)
and triggered through the CD workflow. Version bumps are determined by commit messages.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
