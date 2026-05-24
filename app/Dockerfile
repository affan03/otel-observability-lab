FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p logs

EXPOSE 3001
EXPOSE 9464

CMD ["node", "--require", "./instrumentation.js", "index.js"]
