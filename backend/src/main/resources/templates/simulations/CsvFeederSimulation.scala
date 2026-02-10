package __PACKAGE__

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class __CLASS_NAME__ extends Simulation {

  val users: Int = Integer.getInteger("gatling.users", 5)
  val useRampUp: Boolean = System.getProperty("gatling.rampUp", "true").toBoolean
  val rampUpDuration: Int = Integer.getInteger("gatling.rampUpDuration", 10)
  val testDuration: Int = Integer.getInteger("gatling.duration", 30)
  val loop: Boolean = System.getProperty("gatling.loop", "true").toBoolean

  val httpProtocol = http
    .baseUrl("__BASE_URL__")
    .acceptHeader("application/json")
    .userAgentHeader("Gatling Load Test")

  // CSV file should be placed in src/test/resources/data/
  // Format: username,password
  val csvFeeder = csv("data/users.csv").circular

  val baseScn = scenario("CSV Feeder Test")
    .feed(csvFeeder)
    .exec(
      http("Login with ${username}")
        .post("/api/login")
        .body(StringBody("""{"username": "${username}", "password": "${password}"}""")).asJson
        .check(status.is(200))
    )
    .pause(1, 3)
    .exec(
      http("GET Profile")
        .get("/api/profile")
        .check(status.is(200))
    )
    .pause(500.milliseconds, 1.second)

  val scn = if (loop) {
    scenario("CSV Feeder Test (Loop)")
      .during(testDuration.seconds) { exec(baseScn) }
  } else { baseScn }

  val injection = if (useRampUp) {
    scn.inject(rampUsers(users).during(rampUpDuration.seconds))
  } else {
    scn.inject(atOnceUsers(users))
  }

  setUp(injection).protocols(httpProtocol)
}
