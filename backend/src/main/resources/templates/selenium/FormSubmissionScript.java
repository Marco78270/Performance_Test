package scripts;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class __CLASS_NAME__ extends BaseSeleniumScript {

    @Override
    public void execute() throws Exception {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        step("Open form page", () -> {
            driver.get("__BASE_URL__/form");
        });

        step("Fill text input", () -> {
            WebElement nameField = wait.until(
                ExpectedConditions.presenceOfElementLocated(By.id("name")));
            nameField.clear();
            nameField.sendKeys("John Doe");
        });

        step("Fill email input", () -> {
            WebElement emailField = driver.findElement(By.id("email"));
            emailField.clear();
            emailField.sendKeys("john@example.com");
        });

        step("Select dropdown option", () -> {
            WebElement selectEl = driver.findElement(By.id("category"));
            Select select = new Select(selectEl);
            select.selectByIndex(1);
        });

        step("Check checkbox", () -> {
            WebElement checkbox = driver.findElement(By.id("agree"));
            if (!checkbox.isSelected()) {
                checkbox.click();
            }
        });

        step("Submit form", () -> {
            WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));
            submitBtn.click();
        });

        step("Verify submission success", () -> {
            wait.until(ExpectedConditions.or(
                ExpectedConditions.presenceOfElementLocated(By.className("success")),
                ExpectedConditions.presenceOfElementLocated(By.className("alert-success"))
            ));
        });
    }
}
