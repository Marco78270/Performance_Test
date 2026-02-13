package scripts;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import java.util.*;

public abstract class BaseSeleniumScript {
    protected WebDriver driver;
    private final List<StepResult> steps = new ArrayList<>();

    public void setDriver(WebDriver driver) { this.driver = driver; }
    public List<StepResult> getSteps() { return steps; }

    public abstract void execute() throws Exception;

    protected void step(String name, Runnable action) {
        long start = System.currentTimeMillis();
        try {
            action.run();
            steps.add(new StepResult(name, System.currentTimeMillis() - start, true, null));
        } catch (Exception e) {
            steps.add(new StepResult(name, System.currentTimeMillis() - start, false, e.getMessage()));
            throw new RuntimeException(e);
        }
    }

    public record StepResult(String name, long durationMs, boolean passed, String error) {}
}
