package scripts;

import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.Point;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utilitaire OCR basé sur Tesseract pour lire du texte depuis des éléments
 * inaccessibles via le DOM Selenium (canvas HTML, images, etc.).
 *
 * Prérequis : fichiers tessdata dans selenium-workspace/tessdata/
 *   - eng.traineddata (anglais - requis)
 *   - fra.traineddata (français - optionnel)
 * Téléchargement : https://github.com/tesseract-ocr/tessdata_fast
 * (ou lancer package.bat qui les télécharge automatiquement)
 *
 * ── Exemples d'usage ────────────────────────────────────────────────────────
 *
 * // Lire le code d'un canvas ("Strip-12345")
 * WebElement canvas = driver.findElement(By.tagName("canvas"));
 * String code = ocr.readCode(canvas);          // → "Strip-12345"
 *
 * // Extraire tous les codes Strip-XXXXX présents dans le canvas
 * List<String> codes = ocr.findPattern(canvas, "Strip-\\d+");
 *
 * // Attendre qu'un code spécifique apparaisse
 * ocr.waitForCode(canvas, "Strip-12345", 10);
 *
 * // Lecture générale avec prétraitement automatique
 * String texte = ocr.readCanvas(canvas);
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
public class TesseractOCR {

    // Tesseract PSM constants (évite d'importer ITessAPI)
    private static final int PSM_AUTO        = 3;
    private static final int PSM_SINGLE_LINE = 7;
    private static final int PSM_SPARSE_TEXT = 11;

    private final WebDriver driver;
    private final Tesseract tesseract;
    private boolean preprocessing = true;

    public TesseractOCR(WebDriver driver, Path workspaceDir) {
        this.driver = driver;
        this.tesseract = new Tesseract();
        this.tesseract.setDatapath(resolveDataPath(workspaceDir));
        this.tesseract.setLanguage("eng");
        this.tesseract.setPageSegMode(PSM_AUTO);
    }

    // ─── Configuration ───────────────────────────────────────────────────────

    /** Changer la langue OCR (ex: "fra", "eng", "eng+fra"). */
    public void setLanguage(String lang) {
        tesseract.setLanguage(lang);
    }

    /**
     * Mode de segmentation de page (PSM) :
     *   3  = Auto (défaut)
     *   7  = Ligne unique       → codes courts type "Strip-12345"
     *   11 = Texte épars        → éléments dispersés dans un canvas
     */
    public void setPageSegMode(int mode) {
        tesseract.setPageSegMode(mode);
    }

    /** Variable Tesseract avancée (ex: setVariable("tessedit_char_whitelist", "0123456789")). */
    public void setVariable(String key, String value) {
        tesseract.setVariable(key, value);
    }

    /**
     * Active ou désactive le prétraitement d'image (mise à l'échelle + niveaux de gris).
     * Activé par défaut. Désactiver si l'image est déjà grande et contrastée.
     */
    public void setPreprocessing(boolean enabled) {
        this.preprocessing = enabled;
    }

    // ─── Méthodes principales ────────────────────────────────────────────────

    /**
     * Lit tout le texte visible sur la page courante (screenshot complet).
     */
    public String readScreen() {
        return doOcr(captureScreen());
    }

    /**
     * Lit le texte d'un canvas HTML en extrayant son contenu via JavaScript.
     * Méthode recommandée (canvas same-origin).
     *
     * @throws RuntimeException si cross-origin ou canvas vide
     */
    public String readCanvas(WebElement canvas) {
        return doOcr(prepareIfNeeded(captureCanvas(canvas)));
    }

    /**
     * Lit le texte d'un canvas en capturant sa zone visible à l'écran.
     * Alternative à readCanvas() pour les canvas cross-origin.
     */
    public String readCanvasRegion(WebElement canvas) {
        return doOcr(prepareIfNeeded(captureElement(canvas)));
    }

    /**
     * Lit le texte d'un élément WebElement (crop sur sa zone visible).
     */
    public String readElement(WebElement element) {
        return doOcr(prepareIfNeeded(captureElement(element)));
    }

    /**
     * Lit le texte d'une région de l'écran (coordonnées CSS absolues en px).
     */
    public String readRegion(int x, int y, int width, int height) {
        BufferedImage screen = captureScreen();
        double dpr = getDevicePixelRatio();
        int px = clamp((int)(x * dpr), 0, screen.getWidth() - 1);
        int py = clamp((int)(y * dpr), 0, screen.getHeight() - 1);
        int pw = clamp((int)(width  * dpr), 1, screen.getWidth()  - px);
        int ph = clamp((int)(height * dpr), 1, screen.getHeight() - py);
        return doOcr(prepareIfNeeded(screen.getSubimage(px, py, pw, ph)));
    }

    // ─── Détection de codes (Strip-XXXXX, identifiants, etc.) ───────────────

    /**
     * Lit un code alphanumérique court depuis un canvas (ex: "Strip-12345").
     * Utilise PSM_SINGLE_LINE et un prétraitement renforcé pour maximiser
     * la précision sur les petits textes de canvas.
     *
     * @return le code détecté, nettoyé des espaces parasites
     */
    public String readCode(WebElement canvas) {
        BufferedImage img = prepareForCode(captureCanvas(canvas));
        int prevMode = PSM_AUTO;
        tesseract.setPageSegMode(PSM_SINGLE_LINE);
        // Whitelist : lettres, chiffres, tiret, underscore
        tesseract.setVariable("tessedit_char_whitelist",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.");
        try {
            return doOcr(img).replaceAll("\\s+", " ").trim();
        } finally {
            tesseract.setPageSegMode(prevMode);
            tesseract.setVariable("tessedit_char_whitelist", "");
        }
    }

    /**
     * Même que readCode() mais utilise la capture d'écran (fallback cross-origin).
     */
    public String readCodeRegion(WebElement canvas) {
        BufferedImage img = prepareForCode(captureElement(canvas));
        tesseract.setPageSegMode(PSM_SINGLE_LINE);
        tesseract.setVariable("tessedit_char_whitelist",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.");
        try {
            return doOcr(img).replaceAll("\\s+", " ").trim();
        } finally {
            tesseract.setPageSegMode(PSM_AUTO);
            tesseract.setVariable("tessedit_char_whitelist", "");
        }
    }

    /**
     * Extrait toutes les occurrences correspondant à un pattern regex dans le canvas.
     *
     * Exemple : findPattern(canvas, "Strip-\\d+") → ["Strip-12345", "Strip-99"]
     */
    public List<String> findPattern(WebElement canvas, String regex) {
        String text = readCanvas(canvas);
        return extractMatches(text, regex);
    }

    /**
     * Extrait tous les codes de type "Strip-NNNNN" présents dans le canvas.
     * Retourne null si aucun code trouvé.
     */
    public String findStripCode(WebElement canvas) {
        List<String> matches = findPattern(canvas, "Strip-\\d+");
        return matches.isEmpty() ? null : matches.get(0);
    }

    /**
     * Extrait tous les codes de type "Strip-NNNNN" présents dans le canvas.
     */
    public List<String> findAllStripCodes(WebElement canvas) {
        return findPattern(canvas, "Strip-\\d+");
    }

    // ─── Vérification / Attente ──────────────────────────────────────────────

    /** Vérifie si un texte est présent sur la page courante. */
    public boolean hasText(String text) {
        return readScreen().contains(text);
    }

    /** Vérifie si un texte est présent dans un canvas. */
    public boolean hasTextInCanvas(WebElement canvas, String text) {
        return readCanvas(canvas).contains(text);
    }

    /**
     * Attend qu'un texte apparaisse sur la page (screenshot complet).
     *
     * @throws RuntimeException si timeout dépassé
     */
    public void waitForText(String text, int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (hasText(text)) return;
            sleep(500);
        }
        throw new RuntimeException("OCR: texte '" + text + "' non trouve apres " + timeoutSeconds + "s");
    }

    /**
     * Attend qu'un texte apparaisse dans un canvas.
     *
     * @throws RuntimeException si timeout dépassé
     */
    public void waitForTextInCanvas(WebElement canvas, String text, int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (hasTextInCanvas(canvas, text)) return;
            sleep(500);
        }
        throw new RuntimeException("OCR: texte '" + text + "' non trouve dans canvas apres " + timeoutSeconds + "s");
    }

    /**
     * Attend qu'un code spécifique apparaisse dans le canvas (via readCode).
     *
     * @throws RuntimeException si timeout dépassé
     */
    public void waitForCode(WebElement canvas, String expectedCode, int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        String lastRead = "";
        while (System.currentTimeMillis() < deadline) {
            lastRead = readCode(canvas);
            if (lastRead.contains(expectedCode)) return;
            sleep(500);
        }
        throw new RuntimeException(
            "OCR: code '" + expectedCode + "' non trouve apres " + timeoutSeconds + "s" +
            " (derniere lecture: '" + lastRead + "')");
    }

    /**
     * Attend qu'un pattern regex apparaisse dans le canvas.
     * Retourne la première correspondance trouvée.
     */
    public String waitForPattern(WebElement canvas, String regex, int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            List<String> matches = findPattern(canvas, regex);
            if (!matches.isEmpty()) return matches.get(0);
            sleep(500);
        }
        throw new RuntimeException(
            "OCR: pattern '" + regex + "' non trouve dans canvas apres " + timeoutSeconds + "s");
    }

    // ─── Prétraitement d'image ───────────────────────────────────────────────

    /**
     * Prétraitement standard (si preprocessing=true) :
     *   1. Fond blanc (gestion de la transparence)
     *   2. Mise à l'échelle ×2 si image petite
     *   3. Conversion en niveaux de gris
     */
    private BufferedImage prepareIfNeeded(BufferedImage src) {
        return preprocessing ? preprocess(src, false) : src;
    }

    /**
     * Prétraitement renforcé pour les codes courts :
     *   1. Fond blanc
     *   2. Mise à l'échelle aggressive (×3 ou ×4 si petite)
     *   3. Niveaux de gris
     *   4. Seuillage Otsu (binarisation) pour maximiser le contraste
     */
    private BufferedImage prepareForCode(BufferedImage src) {
        return preprocess(src, true);
    }

    private BufferedImage preprocess(BufferedImage src, boolean aggressive) {
        // 1. Fond blanc (gère la transparence des canvas ARGB)
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g0 = rgb.createGraphics();
        g0.setColor(Color.WHITE);
        g0.fillRect(0, 0, src.getWidth(), src.getHeight());
        g0.drawImage(src, 0, 0, null);
        g0.dispose();

        // 2. Mise à l'échelle — Tesseract préfère ~300 DPI, les canvas sont ~72-96 DPI
        int h = rgb.getHeight();
        int scale;
        if (aggressive) {
            scale = (h < 30) ? 6 : (h < 60) ? 4 : (h < 120) ? 3 : (h < 200) ? 2 : 1;
        } else {
            scale = (h < 50) ? 4 : (h < 100) ? 3 : (h < 200) ? 2 : 1;
        }

        BufferedImage scaled;
        if (scale > 1) {
            int sw = rgb.getWidth() * scale;
            int sh = rgb.getHeight() * scale;
            scaled = new BufferedImage(sw, sh, BufferedImage.TYPE_INT_RGB);
            Graphics2D g1 = scaled.createGraphics();
            g1.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g1.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g1.drawImage(rgb, 0, 0, sw, sh, null);
            g1.dispose();
        } else {
            scaled = rgb;
        }

        // 3. Niveaux de gris
        BufferedImage gray = new BufferedImage(scaled.getWidth(), scaled.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g2 = gray.createGraphics();
        g2.drawImage(scaled, 0, 0, null);
        g2.dispose();

        if (!aggressive) return gray;

        // 4. Seuillage Otsu pour le mode code (binarisation adaptive)
        return otsuThreshold(gray);
    }

    /** Seuillage Otsu : calcule le seuil optimal et binarise l'image. */
    private BufferedImage otsuThreshold(BufferedImage gray) {
        int w = gray.getWidth(), h = gray.getHeight();
        int total = w * h;

        // Histogramme
        int[] hist = new int[256];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                hist[gray.getRaster().getSample(x, y, 0)]++;

        // Otsu : maximiser la variance inter-classes
        double sum = 0;
        for (int i = 0; i < 256; i++) sum += i * hist[i];

        double sumB = 0, wB = 0, maxVar = 0;
        int threshold = 128;
        for (int t = 0; t < 256; t++) {
            wB += hist[t];
            if (wB == 0) continue;
            double wF = total - wB;
            if (wF == 0) break;
            sumB += t * hist[t];
            double mB = sumB / wB;
            double mF = (sum - sumB) / wF;
            double var = wB * wF * (mB - mF) * (mB - mF);
            if (var > maxVar) { maxVar = var; threshold = t; }
        }

        // Appliquer le seuil → image binaire (0=noir, 255=blanc)
        BufferedImage binary = new BufferedImage(w, h, BufferedImage.TYPE_BYTE_GRAY);
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++) {
                int v = gray.getRaster().getSample(x, y, 0);
                binary.getRaster().setSample(x, y, 0, v >= threshold ? 255 : 0);
            }
        return binary;
    }

    // ─── Capture d'écran ─────────────────────────────────────────────────────

    private BufferedImage captureScreen() {
        byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
        try {
            return ImageIO.read(new ByteArrayInputStream(png));
        } catch (Exception e) {
            throw new RuntimeException("OCR: echec capture ecran", e);
        }
    }

    private BufferedImage captureCanvas(WebElement canvas) {
        String dataUrl = (String) ((JavascriptExecutor) driver)
            .executeScript("return arguments[0].toDataURL('image/png');", canvas);

        if (dataUrl == null || !dataUrl.startsWith("data:image/png;base64,")) {
            throw new RuntimeException(
                "OCR: impossible de lire le canvas via toDataURL " +
                "(verifier que le canvas est same-origin et non vide). " +
                "Utiliser readCanvasRegion() ou readCodeRegion() en alternative.");
        }
        try {
            String base64 = dataUrl.substring("data:image/png;base64,".length());
            byte[] bytes = java.util.Base64.getDecoder().decode(base64);
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            throw new RuntimeException("OCR: echec decodage image canvas", e);
        }
    }

    private BufferedImage captureElement(WebElement element) {
        byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
        try {
            BufferedImage full = ImageIO.read(new ByteArrayInputStream(png));
            double dpr = getDevicePixelRatio();
            Point loc = element.getLocation();
            Dimension size = element.getSize();
            int x = clamp((int)(loc.getX()       * dpr), 0, full.getWidth()  - 1);
            int y = clamp((int)(loc.getY()       * dpr), 0, full.getHeight() - 1);
            int w = clamp((int)(size.getWidth()  * dpr), 1, full.getWidth()  - x);
            int h = clamp((int)(size.getHeight() * dpr), 1, full.getHeight() - y);
            return full.getSubimage(x, y, w, h);
        } catch (Exception e) {
            throw new RuntimeException("OCR: echec capture element", e);
        }
    }

    // ─── OCR ─────────────────────────────────────────────────────────────────

    private String doOcr(BufferedImage image) {
        try {
            return tesseract.doOCR(image).trim();
        } catch (TesseractException e) {
            throw new RuntimeException("OCR: echec reconnaissance (" + e.getMessage() + ")", e);
        }
    }

    // ─── Utilitaires ─────────────────────────────────────────────────────────

    private List<String> extractMatches(String text, String regex) {
        List<String> results = new ArrayList<>();
        Matcher m = Pattern.compile(regex).matcher(text);
        while (m.find()) results.add(m.group());
        return results;
    }

    private double getDevicePixelRatio() {
        try {
            Object ratio = ((JavascriptExecutor) driver)
                .executeScript("return window.devicePixelRatio || 1");
            return ((Number) ratio).doubleValue();
        } catch (Exception e) {
            return 1.0;
        }
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static void sleep(long ms) {
        try { Thread.sleep(ms); }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted", e);
        }
    }

    private static String resolveDataPath(Path workspaceDir) {
        // 1. Répertoire tessdata dans le workspace (prioritaire)
        Path workspaceTessdata = workspaceDir.resolve("tessdata");
        if (workspaceTessdata.toFile().isDirectory()) {
            return workspaceTessdata.toAbsolutePath().toString();
        }
        // 2. Variable d'environnement TESSDATA_PREFIX
        String envPath = System.getenv("TESSDATA_PREFIX");
        if (envPath != null && new File(envPath).isDirectory()) {
            return envPath;
        }
        // 3. Installation Tesseract Windows par défaut
        File winInstall = new File("C:/Program Files/Tesseract-OCR/tessdata");
        if (winInstall.isDirectory()) {
            return winInstall.getAbsolutePath();
        }
        // Fallback : workspace (Tesseract lèvera une erreur claire si absent)
        return workspaceTessdata.toAbsolutePath().toString();
    }
}
