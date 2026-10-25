# The whole game as one container: Spring Boot serves the API at /api and the built terminal at /,
# and the GP forecast job runs alongside it. Same origin, so no VITE_API_URL and no CORS.
# Sized for a 512 MB free instance (Render). See DEPLOY.md.

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

FROM python:3.12-slim
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="$JAVA_HOME/bin:$PATH"
COPY --from=eclipse-temurin:21-jre /opt/java/openjdk $JAVA_HOME
WORKDIR /app
COPY ml/requirements.txt ml/requirements.txt
RUN pip install --no-cache-dir -r ml/requirements.txt
COPY ml/ ml/
COPY --from=api /app/target/earlysignal-api-*.jar app.jar
COPY start.sh .
# Heap capped so Java + the Python worker fit in 512 MB. Override JAVA_OPTS on bigger instances.
ENV JAVA_OPTS="-Xmx220m -Xss512k -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
EXPOSE 8080
CMD ["sh", "start.sh"]
