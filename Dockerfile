FROM node:24-alpine

WORKDIR /app

# O schema precisa estar presente antes do install, que gera o cliente do Prisma.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
