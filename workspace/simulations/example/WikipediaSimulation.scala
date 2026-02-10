package example

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class WikipediaSimulation extends Simulation {

  // Paramètres configurables via -D
  val users: Int = Integer.getInteger("gatling.users", 5)
  val useRampUp: Boolean = System.getProperty("gatling.rampUp", "true").toBoolean
  val rampUpDuration: Int = Integer.getInteger("gatling.rampUpDuration", 10)
  val testDuration: Int = Integer.getInteger("gatling.duration", 20)
  val loop: Boolean = System.getProperty("gatling.loop", "true").toBoolean

  val httpProtocol = http
    .baseUrl("https://fr.wikipedia.org")
    .acceptHeader("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
    .acceptLanguageHeader("fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3")
    .acceptEncodingHeader("gzip, deflate, br")
    .userAgentHeader("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0")
    .disableCaching // Désactive le cache pour avoir des requêtes fraîches à chaque fois

  // Scénario de base
  val baseScn = scenario("Wikipedia Search Test")
    // Étape 1: Charger la page d'accueil Wikipedia FR
    .exec(
      http("1 - Page d'accueil Wikipedia")
        .get("/wiki/Wikip%C3%A9dia:Accueil_principal")
        .check(status.is(200))
        .check(css("input#searchInput").exists)
    )
    .pause(1, 3)

    // Étape 2: Rechercher "Test de performance" via l'API de suggestions
    .exec(
      http("2 - API suggestions recherche")
        .get("/w/rest.php/v1/search/title")
        .queryParam("q", "Test de performance")
        .queryParam("limit", "10")
        .check(status.is(200))
    )
    .pause(500.milliseconds, 1.second)

    // Étape 3: Accéder à la page "Test de performance"
    .exec(
      http("3 - Page Test de performance")
        .get("/wiki/Test_de_performance")
        .check(status.is(200))
        .check(css("h1#firstHeading").exists)
    )
    .pause(1, 2)

    // Étape 4: Vérifier un lien interne
    .exec(
      http("4 - Page Logiciel")
        .get("/wiki/Logiciel")
        .check(status.is(200))
        .check(css("h1#firstHeading").exists)
    )

  // Scénario avec loop si activé
  val scn = if (loop) {
    scenario("Wikipedia Search Test (Loop)")
      .during(testDuration.seconds) {
        exec(baseScn)
      }
  } else {
    baseScn
  }

  // Injection
  val injection = if (useRampUp) {
    scn.inject(rampUsers(users).during(rampUpDuration.seconds))
  } else {
    scn.inject(atOnceUsers(users))
  }

  setUp(injection).protocols(httpProtocol)
}
