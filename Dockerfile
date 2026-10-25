# The whole game as one service: Spring Boot serves the API at /api and the built terminal at /.
# Same origin, so the frontend needs no VITE_API_URL and the API needs no CORS. See DEPLOY.md.

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM maven:3.9.9-eclipse-temurin-21 AS api
WORKDIR /app
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src src
COPY --from=web /web/dist src/main/resources/static
# Tests need a live Postgres; they run locally with ./mvnw test.
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=api /app/target/earlysignal-api-*.jar app.jar
EXPOSE 8080
CMD ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
