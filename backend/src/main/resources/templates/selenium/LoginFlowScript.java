package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class __CLASS_NAME__ extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        step("Open login page", () -> {
            driver.get("__BASE_URL__/login");
        });

        step("Enter username", () -> {
            WebElement usernameField = wait.until(
                ExpectedConditions.presenceOfElementLocated(By.id("username")));
            usernameField.clear();
            usernameField.sendKeys("testuser");
        });

        step("Enter password", () -> {
            WebElement passwordField = driver.findElement(By.id("password"));
            passwordField.clear();
            passwordField.sendKeys("testpassword");
        });

        step("Submit login form", () -> {
            WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));
            submitBtn.click();
        });

        step("Verify redirect after login", () -> {
            wait.until(ExpectedConditions.not(
                ExpectedConditions.urlContains("/login")));
            String currentUrl = driver.getCurrentUrl();
            if (currentUrl.contains("/login")) {
                throw new AssertionError("Still on login page after submit");
            }
        });
    }
}
