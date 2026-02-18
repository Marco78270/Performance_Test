package scripts;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import java.util.*;

public abstract class BaseSeleniumScript {
    protected WebDriver driver;
    protected SikuliLite sikuli;
    protected Map<String, String> csvRow = Map.of();
    protected int browserIndex;
    protected int iteration;
    private final List<StepResult> steps = new ArrayList<>();

    public void setDriver(WebDriver driver) { this.driver = driver; }
    public void setSikuli(SikuliLite sikuli) { this.sikuli = sikuli; }
    public void setCsvRow(Map<String, String> csvRow) { this.csvRow = csvRow; }
    public void setBrowserIndex(int browserIndex) { this.browserIndex = browserIndex; }
    public void setIteration(int iteration) { this.iteration = iteration; }
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
