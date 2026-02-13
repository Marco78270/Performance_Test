package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class WikipediaSearchScript extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

        step("Ouvrir Wikipedia FR", () -> {
            driver.get("https://www.wikipedia.org/");
            wait.until(ExpectedConditions.titleContains("Wikipedia"));
        });

        step("Saisir 'Selenium' dans la recherche", () -> {
            WebElement searchInput = wait.until(ExpectedConditions.elementToBeClickable(
                By.name("search")));
            searchInput.click();
            searchInput.clear();
            searchInput.sendKeys("Selenium (informatique)");
            searchInput.sendKeys(Keys.ENTER);
        });

        step("Verifier la page Selenium", () -> {
            wait.until(ExpectedConditions.or(
                ExpectedConditions.urlContains("Selenium"),
                ExpectedConditions.urlContains("selenium")
            ));
            wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("#firstHeading, .mw-page-title-main")));
        });

        step("Naviguer vers la page Java", () -> {
            WebElement javaLink = wait.until(ExpectedConditions.elementToBeClickable(
                By.cssSelector("a[href*='Java']")));
            javaLink.click();
            wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("#firstHeading, .mw-page-title-main")));
        });
    }
}
