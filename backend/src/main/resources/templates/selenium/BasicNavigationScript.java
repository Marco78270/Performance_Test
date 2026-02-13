package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class __CLASS_NAME__ extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        step("Open homepage", () -> {
            driver.get("__BASE_URL__");
        });

        step("Verify page title", () -> {
            String title = driver.getTitle();
            if (title == null || title.isEmpty()) {
                throw new AssertionError("Page title is empty");
            }
        });

        step("Check page loaded", () -> {
            wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
        });

        step("Verify no errors in page", () -> {
            String source = driver.getPageSource();
            if (source.contains("500 Internal Server Error")) {
                throw new AssertionError("Page contains server error");
            }
        });
    }
}
