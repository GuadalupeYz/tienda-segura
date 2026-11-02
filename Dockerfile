FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Ejecutar como usuario sin privilegios (la imagen de node trae el usuario "node")
USER node
CMD ["node", "app.js"]
