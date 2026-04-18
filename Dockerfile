# Better Email MCP - Optimized for AI Agents
# syntax=docker/dockerfile:1

# Use Bun as the builder
FROM oven/bun:1-alpine@sha256:26d8996560ca94eab9ce48afc0c7443825553c9a851f40ae574d47d20906826d AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the package
RUN bun run build

# Minimal image for runtime
FROM node:24.15.0-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f

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

# Expose HTTP port (used when TRANSPORT_MODE=http)
EXPOSE 8080

# Run as non-root user for security
USER node

# Set entrypoint
ENTRYPOINT ["better-email-mcp"]
