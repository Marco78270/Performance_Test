package scripts;

import nu.pattern.OpenCV;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferByte;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Path;

public class SikuliLite {

    static {
        OpenCV.loadLocally();
    }

    private final WebDriver driver;
    private final Path imagesDir;
    private double defaultConfidence = 0.8;

    public SikuliLite(WebDriver driver, Path imagesDir) {
        this.driver = driver;
        this.imagesDir = imagesDir;
    }

    public void setDefaultConfidence(double confidence) {
        this.defaultConfidence = confidence;
    }

    // --- Public API ---

    public void click(String imageName) {
        click(imageName, defaultConfidence);
    }

    public void click(String imageName, double confidence) {
        Match match = find(imageName, confidence);
        clickAt(match.centerX(), match.centerY());
    }

    public void waitAndClick(String imageName, int timeoutSeconds) {
        waitAndClick(imageName, timeoutSeconds, defaultConfidence);
    }

    public void waitAndClick(String imageName, int timeoutSeconds, double confidence) {
        Match match = waitFor(imageName, timeoutSeconds, confidence);
        clickAt(match.centerX(), match.centerY());
    }

    public void doubleClick(String imageName) {
        doubleClick(imageName, defaultConfidence);
    }

    public void doubleClick(String imageName, double confidence) {
        Match match = find(imageName, confidence);
        doubleClickAt(match.centerX(), match.centerY());
    }

    public boolean exists(String imageName) {
        return exists(imageName, defaultConfidence);
    }

    public boolean exists(String imageName, double confidence) {
        try {
            find(imageName, confidence);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    public Match find(String imageName) {
        return find(imageName, defaultConfidence);
    }

    public Match find(String imageName, double confidence) {
        Mat screenshot = captureScreenshot();
        Mat template = loadTemplate(imageName);
        try {
            return matchTemplate(screenshot, template, confidence, imageName);
        } finally {
            screenshot.release();
            template.release();
        }
    }

    public void type(String imageName, String text) {
        type(imageName, text, defaultConfidence);
    }

    public void type(String imageName, String text, double confidence) {
        click(imageName, confidence);
        new Actions(driver).sendKeys(text).perform();
    }

    public void dragAndDrop(String srcImage, String destImage) {
        dragAndDrop(srcImage, destImage, defaultConfidence);
    }

    public void dragAndDrop(String srcImage, String destImage, double confidence) {
        Match src = find(srcImage, confidence);
        Match dest = find(destImage, confidence);
        int srcX = src.centerX();
        int srcY = src.centerY();
        int destX = dest.centerX();
        int destY = dest.centerY();
        new Actions(driver)
            .moveToLocation(srcX, srcY)
            .clickAndHold()
            .moveToLocation(destX, destY)
            .release()
            .perform();
    }

    // --- Match record ---

    public record Match(int x, int y, int width, int height, double score) {
        public int centerX() { return x + width / 2; }
        public int centerY() { return y + height / 2; }
    }

    // --- Internal ---

    private Match waitFor(String imageName, int timeoutSeconds, double confidence) {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        RuntimeException lastError = null;
        while (System.currentTimeMillis() < deadline) {
            try {
                return find(imageName, confidence);
            } catch (RuntimeException e) {
                lastError = e;
                try { Thread.sleep(500); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting for " + imageName, ie);
                }
            }
        }
        throw new RuntimeException("Timeout waiting for '" + imageName + "' after " + timeoutSeconds + "s", lastError);
    }

    private Mat captureScreenshot() {
        byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(png));
            return bufferedImageToMat(img);
        } catch (Exception e) {
            throw new RuntimeException("Failed to capture screenshot", e);
        }
    }

    private Mat loadTemplate(String imageName) {
        File file = imagesDir.resolve(imageName).toFile();
        if (!file.exists()) {
            throw new RuntimeException("SikuliLite: image not found: " + file.getAbsolutePath());
        }
        Mat template = Imgcodecs.imread(file.getAbsolutePath(), Imgcodecs.IMREAD_COLOR);
        if (template.empty()) {
            throw new RuntimeException("SikuliLite: failed to load image: " + file.getAbsolutePath());
        }
        return template;
    }

    private Match matchTemplate(Mat screenshot, Mat template, double confidence, String imageName) {
        Mat result = new Mat();
        try {
            Imgproc.matchTemplate(screenshot, template, result, Imgproc.TM_CCOEFF_NORMED);
            Core.MinMaxLocResult mmr = Core.minMaxLoc(result);
            if (mmr.maxVal < confidence) {
                throw new RuntimeException(
                    "SikuliLite: '" + imageName + "' not found (best score: " +
                    String.format("%.3f", mmr.maxVal) + ", required: " + confidence + ")");
            }
            // Adjust coordinates for device pixel ratio
            double dpr = getDevicePixelRatio();
            int x = (int) (mmr.maxLoc.x / dpr);
            int y = (int) (mmr.maxLoc.y / dpr);
            int w = (int) (template.cols() / dpr);
            int h = (int) (template.rows() / dpr);
            return new Match(x, y, w, h, mmr.maxVal);
        } finally {
            result.release();
        }
    }

    private double getDevicePixelRatio() {
        try {
            Object ratio = ((JavascriptExecutor) driver).executeScript("return window.devicePixelRatio || 1");
            return ((Number) ratio).doubleValue();
        } catch (Exception e) {
            return 1.0;
        }
    }

    private void clickAt(int x, int y) {
        new Actions(driver).moveToLocation(x, y).click().perform();
    }

    private void doubleClickAt(int x, int y) {
        new Actions(driver).moveToLocation(x, y).doubleClick().perform();
    }

    private static Mat bufferedImageToMat(BufferedImage img) {
        // Convert to 3-channel BGR
        BufferedImage converted = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_3BYTE_BGR);
        converted.getGraphics().drawImage(img, 0, 0, null);
        byte[] pixels = ((DataBufferByte) converted.getRaster().getDataBuffer()).getData();
        Mat mat = new Mat(converted.getHeight(), converted.getWidth(), CvType.CV_8UC3);
        mat.put(0, 0, pixels);
        return mat;
    }
}
