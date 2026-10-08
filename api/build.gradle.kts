plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.txtms"
version = "0.0.1-SNAPSHOT"
description = "TX TMS API"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

val jjwtVersion = "0.13.0"
val springdocVersion = "3.1.1"
val poiVersion = "5.5.1"

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.flywaydb:flyway-mysql")
	implementation("io.jsonwebtoken:jjwt-api:$jjwtVersion")
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")
	implementation("org.apache.poi:poi-ooxml:$poiVersion")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:$jjwtVersion")
	runtimeOnly("io.jsonwebtoken:jjwt-jackson:$jjwtVersion")
	// The JDBC URL scheme picks the driver and the Hibernate dialect: jdbc:mariadb:// (production) or jdbc:mysql://.
	runtimeOnly("org.mariadb.jdbc:mariadb-java-client")
	runtimeOnly("com.mysql:mysql-connector-j")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile> {
	options.compilerArgs.add("-parameters")
	options.encoding = "UTF-8"
}

// `build` runs unit tests only (no database needed).
tasks.test {
	useJUnitPlatform {
		excludeTags("integration")
	}
}

// TEST_DB_URL from the environment, else from api/.env (where scripts/dev-mariadb.ps1 writes it).
val testDbUrl: Provider<String> = providers.environmentVariable("TEST_DB_URL").orElse(provider {
	val env = file(".env")
	if (!env.isFile) "default" else env.readLines().firstOrNull { it.startsWith("TEST_DB_URL=") }
		?.substringAfter('=')?.trim() ?: "default"
})

// Integration tests run against the project-local MariaDB 10.11 (TEST_DB_URL, database txtms_test).
tasks.register<Test>("integrationTest") {
	description = "Runs integration tests against the local MariaDB test database."
	group = "verification"
	testClassesDirs = sourceSets.test.get().output.classesDirs
	classpath = sourceSets.test.get().runtimeClasspath
	useJUnitPlatform {
		includeTags("integration")
	}
	// Declare the DB location as an input so switching databases never reuses an old result.
	inputs.property("testDbUrl", testDbUrl)
	// The database state is outside Gradle's view; never treat this task as up to date.
	outputs.upToDateWhen { false }
	shouldRunAfter(tasks.test)
	testLogging {
		events("failed")
		exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
	}
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	// Local development runs with demo data enabled.
	systemProperty("spring.profiles.active", System.getProperty("spring.profiles.active") ?: "dev")
}
