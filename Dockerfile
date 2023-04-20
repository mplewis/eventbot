FROM node:18.16.0 as build

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY . .
RUN pnpm build

########################################

FROM node:18.16.0 as deps

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

########################################

FROM node:18.16.0 as prod

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY templates/ ./templates

CMD ["node", "dist/index.js"]
