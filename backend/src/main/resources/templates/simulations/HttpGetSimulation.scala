package __PACKAGE__

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class __CLASS_NAME__ extends Simulation {

  // Configurable parameters via -D system properties
  val users: Int = Integer.getInteger("gatling.users", 5)
  val useRampUp: Boolean = System.getProperty("gatling.rampUp", "true").toBoolean
  val rampUpDuration: Int = Integer.getInteger("gatling.rampUpDuration", 10)
  val testDuration: Int = Integer.getInteger("gatling.duration", 30)
  val loop: Boolean = System.getProperty("gatling.loop", "true").toBoolean

  val httpProtocol = http
    .baseUrl("__BASE_URL__")
    .acceptHeader("application/json, text/html, */*")
    .acceptEncodingHeader("gzip, deflate")
    .userAgentHeader("Gatling Load Test")

  val baseScn = scenario("HTTP GET Test")
    .exec(
      http("GET Home")
        .get("/")
        .check(status.is(200))
    )
    .pause(1, 3)
    .exec(
      http("GET API Health")
        .get("/api/health")
        .check(status.in(200, 404))
    )
    .pause(500.milliseconds, 2.seconds)

  val scn = if (loop) {
    scenario("HTTP GET Test (Loop)")
      .during(testDuration.seconds) { exec(baseScn) }
  } else { baseScn }

  val injection = if (useRampUp) {
    scn.inject(rampUsers(users).during(rampUpDuration.seconds))
  } else {
    scn.inject(atOnceUsers(users))
  }

  {
    val setup = setUp(injection).protocols(httpProtocol)
    if (testDuration > 0) setup.maxDuration(testDuration.seconds)
  }
}
