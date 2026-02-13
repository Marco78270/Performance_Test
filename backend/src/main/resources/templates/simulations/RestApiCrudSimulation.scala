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

  val baseScn = scenario("REST API CRUD Test")
    // CREATE
    .exec(
      http("POST Create Resource")
        .post("/api/resources")
        .body(StringBody("""{"name": "resource-${java.util.UUID.randomUUID()}", "description": "Load test item"}""")).asJson
        .check(status.is(201))
        .check(jsonPath("$.id").saveAs("resourceId"))
    )
    .pause(500.milliseconds, 1.second)

    // READ
    .exec(
      http("GET Resource")
        .get("/api/resources/${resourceId}")
        .check(status.is(200))
        .check(jsonPath("$.id").exists)
    )
    .pause(500.milliseconds, 1.second)

    // UPDATE
    .exec(
      http("PUT Update Resource")
        .put("/api/resources/${resourceId}")
        .body(StringBody("""{"name": "updated-resource", "description": "Updated by load test"}""")).asJson
        .check(status.is(200))
    )
    .pause(500.milliseconds, 1.second)

    // DELETE
    .exec(
      http("DELETE Resource")
        .delete("/api/resources/${resourceId}")
        .check(status.in(200, 204))
    )
    .pause(500.milliseconds, 1.second)

    // LIST
    .exec(
      http("GET All Resources")
        .get("/api/resources")
        .check(status.is(200))
    )

  val scn = if (loop) {
    scenario("REST API CRUD Test (Loop)")
      .during(testDuration.seconds) { exec(baseScn) }
  } else { baseScn }

  val injection = if (useRampUp) {
    scn.inject(rampUsers(users).during(rampUpDuration.seconds))
  } else {
    scn.inject(atOnceUsers(users))
  }

  setUp(injection).protocols(httpProtocol)
}
