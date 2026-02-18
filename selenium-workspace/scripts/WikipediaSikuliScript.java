package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

/**
 * Exemple hybride Selenium + SikuliLite sur Wikipedia.
 *
 * - Les steps "classiques" utilisent les selecteurs CSS / WebDriverWait
 * - Les steps "SikuliLite" utilisent la reconnaissance d'image (OpenCV)
 *   pour cliquer sur des elements visuels (logo, icones, boutons)
 *
 * Pre-requis : uploader les images suivantes via l'UI SikuliLite Images :
 *   - wikipedia_logo.png      : capture du globe Wikipedia sur la page d'accueil
 *   - wikipedia_searchbar.png : capture de la barre de recherche
 *   - wikipedia_search_btn.png: capture du bouton/icone de recherche (loupe)
 *   - wikipedia_lang_fr.png   : capture du lien "Francais" sur la page d'accueil
 */
public class WikipediaSikuliScript extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

        // --- Step 1 : Selenium classique - ouvrir la page ---
        step("Ouvrir Wikipedia", () -> {
            driver.get("https://www.wikipedia.org/");
            wait.until(ExpectedConditions.titleContains("Wikipedia"));
        });

        // --- Step 2 : SikuliLite - verifier la presence du logo ---
        step("Sikuli - Verifier le logo Wikipedia", () -> {
            sikuli.waitAndClick("wikipedia_logo.png", 10);
            // Clic sur le logo = retour accueil, on attend que la page se recharge
            wait.until(ExpectedConditions.titleContains("Wikipedia"));
        });

        // --- Step 4 : Selenium classique - saisir une recherche ---
        step("Selenium - Rechercher 'Tour Eiffel'", () -> {
            WebElement searchInput = wait.until(ExpectedConditions.elementToBeClickable(
                By.name("search")));
            searchInput.click();
            searchInput.clear();
            searchInput.sendKeys("Tour Eiffel");
            searchInput.sendKeys(Keys.ENTER);
        });

        // --- Step 5 : Selenium classique - verifier la page article ---
        step("Selenium - Verifier page Tour Eiffel", () -> {
            wait.until(ExpectedConditions.urlContains("Tour_Eiffel"));
            WebElement heading = wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("#firstHeading, .mw-page-title-main")));
            String title = heading.getText().toLowerCase();
            if (!title.contains("tour eiffel")) {
                throw new RuntimeException("Titre inattendu: " + title);
            }
        });

        // --- Step 6 : Selenium classique - verifier l'infobox ---
        step("Selenium - Verifier infobox presente", () -> {
            wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector(".infobox, .infobox_v2")));
        });

        // --- Step 7 : SikuliLite - verifier qu'une image specifique est visible ---
        step("Sikuli - Verifier presence image Tour Eiffel", () -> {
            // Verifie visuellement qu'une image de la Tour Eiffel apparait dans la page
            // (necessite un crop de l'image telle qu'elle apparait dans l'infobox)
            if (sikuli.exists("wikipedia_tour_eiffel.png", 0.7)) {
                // Image trouvee - OK
            } else {
                // En mode souple : on log mais on ne fail pas
                System.out.println("Image Tour Eiffel non trouvee visuellement (mode souple)");
            }
        });

        // --- Step 8 : Selenium classique - naviguer vers un lien interne ---
        step("Selenium - Cliquer lien Gustave Eiffel", () -> {
            WebElement link = wait.until(ExpectedConditions.elementToBeClickable(
                By.cssSelector("a[href*='/wiki/Gustave_Eiffel']")));
            link.click();
            wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("#firstHeading, .mw-page-title-main")));
        });

        // --- Step 9 : SikuliLite - utiliser la barre de recherche via image ---
        step("Sikuli - Cliquer sur la barre de recherche", () -> {
            sikuli.waitAndClick("wikipedia_searchbar.png", 10);
        });

        // --- Step 10 : SikuliLite type - saisir via Sikuli ---
        step("Sikuli - Saisir 'Paris' dans la recherche", () -> {
            sikuli.type("wikipedia_searchbar.png", "Paris");
            // Petit delai pour l'autocompletion
            try { Thread.sleep(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            driver.findElement(By.name("search")).sendKeys(Keys.ENTER);
        });

        // --- Step 11 : Selenium classique - verification finale ---
        step("Selenium - Verifier page Paris", () -> {
            wait.until(ExpectedConditions.or(
                ExpectedConditions.urlContains("Paris"),
                ExpectedConditions.urlContains("paris")
            ));
            wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("#firstHeading, .mw-page-title-main")));
        });
    }
}
