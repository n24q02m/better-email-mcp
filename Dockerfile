# Better Email MCP - Optimized for AI Agents
# Multi-target Dockerfile: `:stdio` (default for clients) + `:http` (self-hosted daemon).
# See spec 2026-04-30-multi-mode-stdio-http-architecture.md.
# syntax=docker/dockerfile:1

# Build stage (shared by both targets)
FROM oven/bun:1-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the package
RUN bun run build

# Base runtime stage (shared)
FROM node:24.15.0-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS base

LABEL org.opencontainers.image.source="https://github.com/n24q02m/better-email-mcp"
LABEL io.modelcontextprotocol.server.name="io.github.n24q02m/better-email-mcp"

# Copy built package from builder stage
COPY --from=builder /app/build /usr/local/lib/node_modules/@n24q02m/better-email-mcp/build
COPY --from=builder /app/bin /usr/local/lib/node_modules/@n24q02m/better-email-mcp/bin
COPY --from=builder /app/package.json /usr/local/lib/node_modules/@n24q02m/better-email-mcp/
COPY --from=builder /app/README.md /usr/local/lib/node_modules/@n24q02m/better-email-mcp/
COPY --from=builder /app/LICENSE /usr/local/lib/node_modules/@n24q02m/better-email-mcp/
COPY --from=builder /app/node_modules /usr/local/lib/node_modules/@n24q02m/better-email-mcp/node_modules

# Create symlink for CLI
RUN ln -s /usr/local/lib/node_modules/@n24q02m/better-email-mcp/bin/cli.mjs /usr/local/bin/better-email-mcp

# Set default environment variables
ENV NODE_ENV=production

# Run as non-root user for security
USER node

# stdio target: direct MCP SDK StdioServerTransport (no daemon hop).
# Intended for `docker run --rm -i n24q02m/better-email-mcp:stdio` from MCP clients.
FROM base AS stdio
ENV MCP_TRANSPORT=stdio
ENTRYPOINT ["node", "/usr/local/lib/node_modules/@n24q02m/better-email-mcp/bin/cli.mjs"]

# http target: HTTP daemon (runLocalServer). Self-hosted deployment.
FROM base AS http
ENV MCP_TRANSPORT=http
ENV TRANSPORT_MODE=http
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["node", "/usr/local/lib/node_modules/@n24q02m/better-email-mcp/bin/cli.mjs"]
