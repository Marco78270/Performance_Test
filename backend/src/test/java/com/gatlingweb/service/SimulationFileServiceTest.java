package com.gatlingweb.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class SimulationFileServiceTest {

    @TempDir
    Path tempDir;

    private SimulationFileService service;

    @BeforeEach
    void setUp() {
        // SimulationFileService resolves workspace + "/simulations"
        service = new SimulationFileService(tempDir.toString());
    }

    @Test
    void readFile_normalPath_succeeds() throws IOException {
        Path simDir = tempDir.resolve("simulations");
        Files.createDirectories(simDir);
        Files.writeString(simDir.resolve("Test.scala"), "class Test extends Simulation");

        String content = service.readFile("Test.scala");
        assertThat(content).isEqualTo("class Test extends Simulation");
    }

    @Test
    void readFile_pathTraversal_throwsSecurityException() {
        assertThatThrownBy(() -> service.readFile("../../etc/passwd"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("Path traversal");
    }

    @Test
    void readFile_dotDotInMiddle_throwsSecurityException() {
        assertThatThrownBy(() -> service.readFile("foo/../../bar"))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    void createFile_normalPath_creates() throws IOException {
        Path simDir = tempDir.resolve("simulations");
        Files.createDirectories(simDir);

        service.createFile("NewSim.scala", "package example");
        assertThat(Files.readString(simDir.resolve("NewSim.scala"))).isEqualTo("package example");
    }

    @Test
    void createFile_alreadyExists_throwsIllegalArgument() throws IOException {
        Path simDir = tempDir.resolve("simulations");
        Files.createDirectories(simDir);
        Files.writeString(simDir.resolve("Existing.scala"), "content");

        assertThatThrownBy(() -> service.createFile("Existing.scala", "new content"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void listSimulationClasses_parsesPackageAndClassName() throws IOException {
        Path simDir = tempDir.resolve("simulations").resolve("example");
        Files.createDirectories(simDir);
        Files.writeString(simDir.resolve("MySim.scala"),
                "package example\n\nimport io.gatling.core.Predef._\n\nclass MySim extends Simulation {\n}");

        List<String> classes = service.listSimulationClasses();
        assertThat(classes).containsExactly("example.MySim");
    }

    @Test
    void listSimulationClasses_noPackage_classOnly() throws IOException {
        Path simDir = tempDir.resolve("simulations");
        Files.createDirectories(simDir);
        Files.writeString(simDir.resolve("NoPackageSim.scala"),
                "class NoPackageSim extends Simulation {}");

        List<String> classes = service.listSimulationClasses();
        assertThat(classes).containsExactly("NoPackageSim");
    }

    @Test
    void deleteFile_existingFile_deletes() throws IOException {
        Path simDir = tempDir.resolve("simulations");
        Files.createDirectories(simDir);
        Path file = simDir.resolve("ToDelete.scala");
        Files.writeString(file, "content");

        service.deleteFile("ToDelete.scala");
        assertThat(Files.exists(file)).isFalse();
    }

    @Test
    void renameFile_normalCase_renames() throws IOException {
        Path simDir = tempDir.resolve("simulations");
        Files.createDirectories(simDir);
        Files.writeString(simDir.resolve("OldName.scala"), "content");

        service.renameFile("OldName.scala", "NewName.scala");
        assertThat(Files.exists(simDir.resolve("OldName.scala"))).isFalse();
        assertThat(Files.readString(simDir.resolve("NewName.scala"))).isEqualTo("content");
    }
}
