@echo off
echo === Building GatlingWeb native package ===

REM 0. Locate JDK (for jpackage and jlink)
set "JDK_HOME="
if defined JAVA_HOME (
    set "JDK_HOME=%JAVA_HOME%"
) else (
    for /d %%D in ("C:\Program Files\Java\jdk-*") do set "JDK_HOME=%%D"
)
if not defined JDK_HOME (
    echo ERROR: JDK not found. Set JAVA_HOME or install JDK in Program Files\Java
    exit /b 1
)
set "JPACKAGE=%JDK_HOME%\bin\jpackage"
echo Using JDK: %JDK_HOME%

REM 1. Build
echo [1/4] Building JAR...
cd backend
call mvn clean package -DskipTests
if errorlevel 1 (
    echo BUILD FAILED
    cd ..
    exit /b 1
)
cd ..

REM 2. Staging
echo [2/4] Preparing staging...
rmdir /s /q build 2>nul
mkdir build\staging
copy backend\target\gatling-web.jar build\staging\

REM 3. Create full runtime with jlink
echo [3/5] Creating full JRE runtime...
"%JDK_HOME%\bin\jlink" ^
  --module-path "%JDK_HOME%\jmods" ^
  --add-modules ALL-MODULE-PATH ^
  --output build\runtime ^
  --strip-debug ^
  --no-man-pages ^
  --no-header-files
if errorlevel 1 (
    echo JLINK FAILED
    exit /b 1
)

REM 4. jpackage
echo [4/5] Creating native image...
"%JPACKAGE%" ^
  --type app-image ^
  --name GatlingWeb ^
  --input build\staging ^
  --main-jar gatling-web.jar ^
  --main-class org.springframework.boot.loader.launch.JarLauncher ^
  --runtime-image build\runtime ^
  --java-options "-Dspring.datasource.url=jdbc:sqlite:$APPDIR/../gatlingweb.db" ^
  --java-options "-Dgatling.workspace=$APPDIR/../workspace" ^
  --java-options "-Dselenium.workspace=$APPDIR/../selenium-workspace" ^
  --java-options "-Dselenium.screenshots-dir=$APPDIR/../selenium-workspace/screenshots" ^
  --java-options "-Dserver.port=8080" ^
  --java-options "-Xmx512m" ^
  --app-version 2.1 ^
  --dest build
if errorlevel 1 (
    echo JPACKAGE FAILED
    exit /b 1
)

REM 5. Copy workspaces
echo [5/5] Copying workspaces...
xcopy /E /I /Q workspace build\GatlingWeb\workspace
xcopy /E /I /Q selenium-workspace build\GatlingWeb\selenium-workspace

REM 6. Cleanup temp dirs
rmdir /s /q build\staging 2>nul
rmdir /s /q build\runtime 2>nul

echo.
echo === Done! ===
echo Application: build\GatlingWeb\GatlingWeb.exe
echo.
