package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class LoginScript extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

        // Colonnes injectées automatiquement depuis LoginScript.csv
        String username = csvRow.getOrDefault("username", "");
        String password = csvRow.getOrDefault("password", "");

        step("Ouvrir la page de login [" + username + "]", () -> {
            driver.get("https://mon-app.example.com/login");
            wait.until(ExpectedConditions.titleContains("Login"));
        });

        step("Saisir le username", () -> {
            WebElement field = wait.until(
                ExpectedConditions.elementToBeClickable(By.id("username")));
            field.clear();
            field.sendKeys(username);
        });

        step("Saisir le password", () -> {
            WebElement field = driver.findElement(By.id("password"));
            field.clear();
            field.sendKeys(password);
        });

        step("Cliquer sur Se connecter", () -> {
            driver.findElement(By.cssSelector("button[type='submit']")).click();
            wait.until(ExpectedConditions.urlContains("/dashboard"));
        });

        step("Vérifier le dashboard", () -> {
            wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector(".welcome-message, h1")));
        });

        step("Se déconnecter", () -> {
            driver.findElement(By.id("logout-btn")).click();
            wait.until(ExpectedConditions.urlContains("/login"));
        });
    }
}
