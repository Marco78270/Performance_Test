package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;
import java.util.List;

public class __CLASS_NAME__ extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        step("Open homepage", () -> {
            driver.get("__BASE_URL__");
            wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        });

        step("Navigate to first link", () -> {
            List<WebElement> links = driver.findElements(By.tagName("a"));
            if (links.isEmpty()) {
                throw new AssertionError("No links found on the page");
            }
            String firstHref = links.get(0).getAttribute("href");
            if (firstHref != null && !firstHref.isEmpty()) {
                driver.get(firstHref);
            } else {
                links.get(0).click();
            }
        });

        step("Verify second page loaded", () -> {
            wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
            String currentUrl = driver.getCurrentUrl();
            if (currentUrl == null || currentUrl.isEmpty()) {
                throw new AssertionError("Failed to navigate to second page");
            }
        });

        step("Go back to homepage", () -> {
            driver.navigate().back();
            wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        });

        step("Verify returned to homepage", () -> {
            String currentUrl = driver.getCurrentUrl();
            if (!currentUrl.startsWith("__BASE_URL__")) {
                throw new AssertionError("Did not return to homepage. Current URL: " + currentUrl);
            }
        });
    }
}
