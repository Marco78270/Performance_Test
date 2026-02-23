@echo off
setlocal EnableDelayedExpansion

echo ==========================================================
echo   GatlingWeb - Build package natif (100%% offline-ready)
echo ==========================================================
echo.

REM -------------------------------------------------------
REM 0. Localiser le JDK
REM -------------------------------------------------------
set "JDK_HOME="
if defined JAVA_HOME (
    set "JDK_HOME=%JAVA_HOME%"
) else (
    for /d %%D in ("C:\Program Files\Java\jdk-*") do set "JDK_HOME=%%D"
)
if not defined JDK_HOME (
    echo ERREUR : JDK introuvable.
    echo Definir JAVA_HOME ou installer le JDK dans Program Files\Java
    exit /b 1
)
echo JDK : %JDK_HOME%
echo.

REM -------------------------------------------------------
REM 1. Build frontend avec Node.js local (pas de download)
REM -------------------------------------------------------
echo [1/6] Build frontend...
where node >nul 2>&1
if errorlevel 1 (
    echo ERREUR : Node.js non installe.
    echo Installer Node.js LTS : https://nodejs.org
    echo Ou via winget          : winget install OpenJS.NodeJS.LTS
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo        Node.js : %%v
for /f "tokens=*" %%v in ('npm --version')  do echo        npm     : %%v

cd frontend
echo        npm install...
call npm install --prefer-offline --loglevel=warn
if errorlevel 1 (
    echo ERREUR : npm install echoue.
    cd ..
    exit /b 1
)
echo        npm run build...
call npm run build
if errorlevel 1 (
    echo ERREUR : npm run build echoue.
    cd ..
    exit /b 1
)
cd ..
echo        Frontend OK.
echo.

REM -------------------------------------------------------
REM 2. Build backend JAR (frontend deja construit, on
REM    desactive le frontend-maven-plugin pour eviter
REM    tout telechargement Node.js)
REM -------------------------------------------------------
echo [2/6] Build backend JAR...
cd backend
call mvn clean package -DskipTests -Dskip.npm -Dskip.installnodenpm
if errorlevel 1 (
    echo ERREUR : Maven build echoue.
    cd ..
    exit /b 1
)
cd ..
echo        Backend OK.
echo.

REM -------------------------------------------------------
REM 3. Tessdata OCR (telecharge une seule fois, puis offline)
REM -------------------------------------------------------
echo [3/6] Verification tessdata Tesseract OCR...
set TESSDATA_DIR=selenium-workspace\tessdata

if not exist "%TESSDATA_DIR%\eng.traineddata" (
    echo        eng.traineddata absent - telechargement en cours...
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata' -OutFile '%TESSDATA_DIR%\eng.traineddata' -UseBasicParsing" 2>nul
    if exist "%TESSDATA_DIR%\eng.traineddata" (
        echo        eng.traineddata OK ^(%.0f Mo^)
    ) else (
        echo        AVERTISSEMENT : impossible de telecharger eng.traineddata.
        echo        Telechargez manuellement depuis :
        echo        https://github.com/tesseract-ocr/tessdata_fast
        echo        et placez dans : %TESSDATA_DIR%\
    )
) else (
    echo        eng.traineddata OK
)

if not exist "%TESSDATA_DIR%\fra.traineddata" (
    echo        fra.traineddata absent - telechargement en cours...
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/fra.traineddata' -OutFile '%TESSDATA_DIR%\fra.traineddata' -UseBasicParsing" 2>nul
    if exist "%TESSDATA_DIR%\fra.traineddata" (
        echo        fra.traineddata OK
    ) else (
        echo        AVERTISSEMENT : fra.traineddata non telecharge ^(optionnel^).
    )
) else (
    echo        fra.traineddata OK
)
echo.

REM -------------------------------------------------------
REM 4. Staging
REM -------------------------------------------------------
echo [4/6] Preparation staging...
rmdir /s /q build 2>nul
mkdir build\staging
copy backend\target\gatling-web.jar build\staging\ >nul
echo        Staging OK.
echo.

REM -------------------------------------------------------
REM 5. JRE autonome via jlink
REM -------------------------------------------------------
echo [5/6] Creation JRE embarque ^(jlink^)...
"%JDK_HOME%\bin\jlink" ^
  --module-path "%JDK_HOME%\jmods" ^
  --add-modules ALL-MODULE-PATH ^
  --output build\runtime ^
  --strip-debug ^
  --no-man-pages ^
  --no-header-files
if errorlevel 1 (
    echo ERREUR : jlink echoue.
    exit /b 1
)
echo        JRE OK.
echo.

REM -------------------------------------------------------
REM 6. Executable natif via jpackage
REM -------------------------------------------------------
echo [6/6] Creation executable natif ^(jpackage^)...
"%JDK_HOME%\bin\jpackage" ^
  --type app-image ^
  --name GatlingWeb ^
  --input build\staging ^
  --main-jar gatling-web.jar ^
  --main-class org.springframework.boot.loader.launch.JarLauncher ^
  --runtime-image build\runtime ^
  --java-options "-Dgatling.workspace=$APPDIR/../workspace" ^
  --java-options "-Dselenium.workspace=$APPDIR/../selenium-workspace" ^
  --java-options "-Dselenium.screenshots-dir=$APPDIR/../selenium-workspace/screenshots" ^
  --java-options "-Dserver.port=8080" ^
  --java-options "-Xmx512m" ^
  --app-version 2.4 ^
  --dest build
if errorlevel 1 (
    echo ERREUR : jpackage echoue.
    exit /b 1
)

REM Copie workspaces (tessdata inclus car dans selenium-workspace)
xcopy /E /I /Q workspace build\GatlingWeb\workspace >nul
xcopy /E /I /Q selenium-workspace build\GatlingWeb\selenium-workspace >nul

REM Nettoyage temporaire
rmdir /s /q build\staging 2>nul
rmdir /s /q build\runtime 2>nul

echo.
echo ==========================================================
echo   Package cree avec succes - 100%% offline-ready
echo ==========================================================
echo   Executable : build\GatlingWeb\GatlingWeb.exe
echo   Tessdata   : build\GatlingWeb\selenium-workspace\tessdata\
echo ==========================================================
echo.
