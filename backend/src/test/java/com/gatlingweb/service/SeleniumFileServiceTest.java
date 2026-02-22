package com.gatlingweb.service;

import com.gatlingweb.dto.SimulationFileDto;
import com.gatlingweb.selenium.service.SeleniumFileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class SeleniumFileServiceTest {

    @TempDir
    Path tempDir;

    private SeleniumFileService service;
    private Path scriptsDir;

    @BeforeEach
    void setUp() throws IOException {
        // SeleniumFileService resolves workspace + "/scripts"
        scriptsDir = tempDir.resolve("scripts");
        Files.createDirectories(scriptsDir);
        service = new SeleniumFileService(tempDir.toString());
    }

    @Test
    void listFiles_emptyDir_returnsEmptyList() throws IOException {
        List<SimulationFileDto> files = service.listFiles();
        assertThat(files).isEmpty();
    }

    @Test
    void createAndReadFile_succeeds() throws IOException {
        service.createFile("MyTest.java", "public class MyTest {}");
        String content = service.readFile("MyTest.java");
        assertThat(content).isEqualTo("public class MyTest {}");
    }

    @Test
    void createFile_alreadyExists_throws() throws IOException {
        service.createFile("Foo.java", "");
        assertThatThrownBy(() -> service.createFile("Foo.java", ""))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already exists");
    }

    @Test
    void deleteFile_succeeds() throws IOException {
        service.createFile("ToDelete.java", "content");
        service.deleteFile("ToDelete.java");
        assertThat(Files.exists(scriptsDir.resolve("ToDelete.java"))).isFalse();
    }

    @Test
    void renameFile_succeeds() throws IOException {
        service.createFile("OldName.java", "content");
        service.renameFile("OldName.java", "NewName.java");
        assertThat(Files.exists(scriptsDir.resolve("NewName.java"))).isTrue();
        assertThat(Files.exists(scriptsDir.resolve("OldName.java"))).isFalse();
    }

    @Test
    void pathTraversal_isBlocked() {
        assertThatThrownBy(() -> service.readFile("../../etc/passwd"))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("traversal");
    }

    @Test
    void listScriptClasses_findsClassExtendingBaseSeleniumScript() throws IOException {
        String content = "public class MyScript extends BaseSeleniumScript {}";
        service.createFile("MyScript.java", content);
        List<String> classes = service.listScriptClasses();
        assertThat(classes).contains("MyScript");
    }

    @Test
    void createDirectory_succeeds() throws IOException {
        service.createDirectory("subfolder");
        assertThat(Files.isDirectory(scriptsDir.resolve("subfolder"))).isTrue();
    }

    @Test
    void writeFile_updatesContent() throws IOException {
        service.createFile("Editable.java", "old");
        service.writeFile("Editable.java", "new content");
        assertThat(service.readFile("Editable.java")).isEqualTo("new content");
    }
}
