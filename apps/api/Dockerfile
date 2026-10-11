# syntax=docker/dockerfile:1
# The backend as a container image (AC-F00-39, design.md section 9). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t meetapp-api .
# Check it with `pnpm check:container` (health, non-root user, no .env, no secrets).
# Node runs the TypeScript directly; our own packages stay linked from their folders (as in development),
# because Node won't run TypeScript from inside node_modules.

# Pinned by version and digest (multi-platform index); updated by Dependabot.
ARG NODE_IMAGE=node:24.21.0-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

FROM ${NODE_IMAGE} AS install
WORKDIR /app
RUN corepack enable
# .dockerignore keeps .env files, node_modules, tests and docs out.
COPY . .
# Only the backend and the libraries it needs at run time; no install scripts.
RUN pnpm install --frozen-lockfile --prod --filter "@meetapp/api..." --ignore-scripts \
  && find apps/api packages/db packages/contracts -name "*.test.ts" -delete

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3000
WORKDIR /app
COPY --from=install /app/package.json ./package.json
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/packages/db ./packages/db
COPY --from=install /app/packages/contracts ./packages/contracts
COPY --from=install /app/apps/api ./apps/api
# The image's built-in non-root user; the files stay owned by root, so the app can't change itself.
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "./src/instrumentation.ts", "src/server.ts"]
