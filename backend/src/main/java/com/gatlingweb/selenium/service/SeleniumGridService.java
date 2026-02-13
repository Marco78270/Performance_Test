package com.gatlingweb.selenium.service;

import com.gatlingweb.selenium.repository.AppSettingRepository;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SeleniumGridService {

    private static final Logger log = LoggerFactory.getLogger(SeleniumGridService.class);

    private static final Map<String, String> DRIVER_SETTING_KEYS = Map.of(
        "chrome", "driver.chrome.path",
        "firefox", "driver.firefox.path",
        "edge", "driver.edge.path"
    );

    private static final Map<String, String> SYSTEM_PROPERTY_KEYS = Map.of(
        "chrome", "webdriver.chrome.driver",
        "firefox", "webdriver.gecko.driver",
        "edge", "webdriver.edge.driver"
    );

    private final AppSettingRepository settingRepository;
    private final Map<String, Boolean> driverSetup = new ConcurrentHashMap<>();
    private volatile String lastError;

    public SeleniumGridService(AppSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    public synchronized void ensureRunning() {
        // No-op: drivers are setup lazily in createDriver()
    }

    private synchronized void setupDriver(String browser) {
        if (driverSetup.containsKey(browser)) return;
        try {
            String settingKey = DRIVER_SETTING_KEYS.get(browser);
            String localPath = settingKey != null
                ? settingRepository.findById(settingKey).map(s -> s.getValue()).orElse(null)
                : null;

            if (localPath != null && !localPath.isBlank() && new File(localPath).isFile()) {
                String sysProp = SYSTEM_PROPERTY_KEYS.get(browser);
                log.info("Using local {} driver: {}", browser, localPath);
                System.setProperty(sysProp, localPath);
            } else {
                log.info("Setting up {} driver via WebDriverManager...", browser);
                switch (browser) {
                    case "chrome" -> WebDriverManager.chromedriver().setup();
                    case "firefox" -> WebDriverManager.firefoxdriver().setup();
                    case "edge" -> WebDriverManager.edgedriver().setup();
                }
            }
            driverSetup.put(browser, true);
            log.info("{} driver ready", browser);
        } catch (Exception e) {
            log.warn("Failed to setup {} driver: {}", browser, e.getMessage());
            lastError = browser + ": " + e.getMessage();
            driverSetup.put(browser, false);
            throw new RuntimeException("Failed to setup " + browser + " driver: " + e.getMessage(), e);
        }
    }

    public WebDriver createDriver(String browser, boolean headless) {
        String b = browser.toLowerCase();
        // Only setup the requested driver
        if (!Boolean.TRUE.equals(driverSetup.get(b))) {
            setupDriver(b);
        }
        WebDriver driver = switch (b) {
            case "firefox" -> {
                FirefoxOptions opts = new FirefoxOptions();
                if (headless) opts.addArguments("--headless");
                opts.addArguments("--width=1920");
                opts.addArguments("--height=1080");
                yield new FirefoxDriver(opts);
            }
            case "edge" -> {
                EdgeOptions opts = new EdgeOptions();
                if (headless) opts.addArguments("--headless=new");
                opts.addArguments("--window-size=1920,1080");
                yield new EdgeDriver(opts);
            }
            default -> {
                ChromeOptions opts = new ChromeOptions();
                if (headless) opts.addArguments("--headless=new");
                opts.addArguments("--window-size=1920,1080");
                opts.addArguments("--no-sandbox");
                opts.addArguments("--disable-dev-shm-usage");
                yield new ChromeDriver(opts);
            }
        };
        driver.manage().window().setSize(new org.openqa.selenium.Dimension(1920, 1080));
        return driver;
    }

    public void invalidateDriverCache() {
        log.info("Invalidating driver setup cache");
        driverSetup.clear();
    }

    public String getGridUrl() {
        return "local";
    }

    public boolean isRunning() {
        return true;
    }

    public String getStatus() {
        if (driverSetup.isEmpty()) {
            return "READY";
        }
        boolean anyReady = driverSetup.values().stream().anyMatch(v -> v);
        return anyReady ? "READY" : "ERROR";
    }

    public String getLastError() {
        return lastError;
    }

    public void shutdown() {
        // Nothing to stop for local drivers
    }
}
