FROM node:24-alpine

WORKDIR /app

ENV PORT=3000

COPY --chown=node:node package.json package-lock.json ./
RUN chown node:node /app
USER node
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
COPY --chown=node:node certs/ca.pem ./certs/ca.pem

EXPOSE 3000

CMD ["npm", "start"]