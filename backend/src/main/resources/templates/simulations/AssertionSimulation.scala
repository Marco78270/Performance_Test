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
    .acceptHeader("application/json, text/html, */*")
    .userAgentHeader("Gatling Load Test")

  val baseScn = scenario("Assertion Test")
    .exec(
      http("GET Home")
        .get("/")
        .check(status.is(200))
    )
    .pause(1, 2)
    .exec(
      http("GET API Endpoint")
        .get("/api/data")
        .check(status.in(200, 304))
    )
    .pause(500.milliseconds, 1.second)

  val scn = if (loop) {
    scenario("Assertion Test (Loop)")
      .during(testDuration.seconds) { exec(baseScn) }
  } else { baseScn }

  val injection = if (useRampUp) {
    scn.inject(rampUsers(users).during(rampUpDuration.seconds))
  } else {
    scn.inject(atOnceUsers(users))
  }

  {
    val setup = setUp(injection)
      .protocols(httpProtocol)
      .assertions(
        global.responseTime.percentile(95).lt(500),
        global.responseTime.percentile(99).lt(1000),
        global.successfulRequests.percent.gt(99.0),
        forAll.responseTime.max.lt(5000)
      )
    if (testDuration > 0) setup.maxDuration(testDuration.seconds)
  }
}
