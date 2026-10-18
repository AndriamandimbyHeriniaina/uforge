FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 3001
ENV COMPILER_CACHE_DIR=/cache
CMD ["node", "src/server.mjs"]
