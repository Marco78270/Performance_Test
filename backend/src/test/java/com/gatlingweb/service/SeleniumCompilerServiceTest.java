package com.gatlingweb.service;

import com.gatlingweb.selenium.service.SeleniumCompilerService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.*;

class SeleniumCompilerServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void getClassesDir_returnsTargetClasses() {
        SeleniumCompilerService service = new SeleniumCompilerService(tempDir.toString());
        Path classesDir = service.getClassesDir();
        assertThat(classesDir).isAbsolute();
        assertThat(classesDir.toString()).endsWith("target" + java.io.File.separator + "classes");
    }

    @Test
    void compile_withNoPomXml_returnsFailed() {
        // tempDir has no pom.xml, so mvn compile will fail
        SeleniumCompilerService service = new SeleniumCompilerService(tempDir.toString());
        SeleniumCompilerService.CompileResult result = service.compile();
        assertThat(result.success()).isFalse();
        assertThat(result.output()).isNotEmpty();
    }

    @Test
    void compileResult_record_accessors() {
        SeleniumCompilerService.CompileResult result = new SeleniumCompilerService.CompileResult(true, java.util.List.of("BUILD SUCCESS"));
        assertThat(result.success()).isTrue();
        assertThat(result.output()).containsExactly("BUILD SUCCESS");
    }

    @Test
    void compile_invalidWorkspace_returnsFailed() {
        SeleniumCompilerService service = new SeleniumCompilerService("/nonexistent/workspace/path");
        SeleniumCompilerService.CompileResult result = service.compile();
        assertThat(result.success()).isFalse();
        assertThat(result.output()).isNotEmpty();
    }
}
