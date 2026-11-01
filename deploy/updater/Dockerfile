# lintel-updater: see updater.mjs. Node, git and the Docker command line with compose.
FROM node:22-alpine
RUN apk add --no-cache git docker-cli docker-cli-compose
COPY updater.mjs /updater/updater.mjs
# The repository is mounted from the host, owned by someone else; git must still use it.
RUN git config --system --add safe.directory '*'
EXPOSE 8080
CMD ["node", "/updater/updater.mjs"]
