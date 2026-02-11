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
    .contentTypeHeader("application/json")
    .userAgentHeader("Gatling Load Test")

  val baseScn = scenario("HTTP POST JSON Test")
    .exec(
      http("POST Create Item")
        .post("/api/items")
        .body(StringBody("""{"name": "test-item", "value": 42}""")).asJson
        .check(status.is(201))
        .check(jsonPath("$.id").saveAs("itemId"))
    )
    .pause(1, 2)
    .exec(
      http("GET Created Item")
        .get("/api/items/${itemId}")
        .check(status.is(200))
        .check(jsonPath("$.name").is("test-item"))
    )
    .pause(500.milliseconds, 1.second)

  val scn = if (loop) {
    scenario("HTTP POST JSON Test (Loop)")
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
