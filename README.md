# Gatling-Web

Plateforme web de tests de performance basee sur [Gatling](https://gatling.io/). Interface complete pour lancer, monitorer et analyser des tests de charge, avec metriques temps reel, comparaison de runs et gestion de seuils de performance.

![Java](https://img.shields.io/badge/Java-20-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-green)
![React](https://img.shields.io/badge/React-19-blue)
![Gatling](https://img.shields.io/badge/Gatling-3.10.5-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Fonctionnalites

- **Lancement de tests** - Configuration des utilisateurs, ramp-up, duree, limitation de bande passante
- **Monitoring temps reel** - Metriques Gatling en live via WebSocket (RPS, temps de reponse, percentiles, erreurs)
- **Monitoring infrastructure** - Collecte Prometheus (CPU, memoire, disque, reseau) des serveurs cibles
- **Editeur de simulations** - Editeur Monaco (syntaxe Scala) integre avec templates preconfigures
- **File d'attente** - Execution sequentielle des tests avec queue automatique
- **Historique & Tendances** - Historique pagine, graphiques de tendances par simulation
- **Comparaison** - Comparaison cote a cote de deux runs avec calcul des ecarts
- **Seuils de performance** - Profils de seuils (p95, taux d'erreur...) avec verdict PASSED/FAILED
- **Export PDF** - Rapports PDF des resultats et comparaisons
- **Gatling Recorder** - Lancement du recorder Gatling depuis l'interface

---

## Pre-requis

| Logiciel | Version | Lien de telechargement |
|----------|---------|----------------------|
| **Java JDK** | 20 ou superieur | [Adoptium Temurin JDK 20](https://adoptium.net/temurin/releases/?version=20) |
| **Apache Maven** | 3.9+ | [Maven Download](https://maven.apache.org/download.cgi) |
| **Node.js** | 20.x | [Node.js Downloads](https://nodejs.org/en/download/) |
| **Git** | 2.x | [Git Downloads](https://git-scm.com/downloads) |

> **Note** : Node.js est aussi installe automatiquement par le `frontend-maven-plugin` lors du build Maven complet. Une installation locale est uniquement necessaire pour le developpement frontend.

### Verification de l'installation

```bash
java -version       # javac 20.x.x ou superieur
mvn -version        # Apache Maven 3.9.x
node -version       # v20.x.x
git --version       # git version 2.x.x
```

---

## Installation

```bash
# Cloner le projet
git clone https://github.com/Marco78270/Performance_Test.git
cd Performance_Test
```

---

## Demarrage rapide

### Option 1 : Build complet et lancement (recommande)

Cette commande compile le backend, installe les dependances frontend, build le frontend et package le tout :

```bash
cd backend
mvn package -DskipTests
mvn spring-boot:run
```

L'application est accessible sur **http://localhost:8080**

### Option 2 : Mode developpement (hot-reload frontend)

Ouvrir **deux terminaux** :

**Terminal 1 - Backend :**
```bash
cd backend
mvn compile -DskipTests -Dskip.npm -Dskip.installnodenpm
mvn spring-boot:run
```

**Terminal 2 - Frontend (hot-reload) :**
```bash
cd frontend
npm install
npm run dev
```

Le frontend de developpement est accessible sur **http://localhost:5173** (proxy automatique vers le backend sur le port 8080).

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `cd backend && mvn package` | Build complet (backend + frontend) |
| `cd backend && mvn spring-boot:run` | Lancer l'application |
| `cd backend && mvn test` | Lancer les 75 tests unitaires |
| `cd backend && mvn compile -DskipTests -Dskip.npm -Dskip.installnodenpm` | Compiler le backend uniquement |
| `cd frontend && npm run dev` | Lancer le frontend en mode dev |
| `cd frontend && npm run build` | Builder le frontend uniquement |

---

## Architecture

```
Performance_Test/
|
|-- backend/                  # API Spring Boot
|   |-- src/main/java/        # Code source Java
|   |-- src/main/resources/   # Config, migrations Flyway, templates
|   |-- src/test/             # Tests unitaires (75 tests)
|   +-- pom.xml
|
|-- frontend/                 # Interface React
|   |-- src/
|   |   |-- api/              # Clients REST
|   |   |-- components/       # Composants reutilisables
|   |   |-- hooks/            # Hooks WebSocket
|   |   +-- pages/            # Pages de l'application
|   +-- package.json
|
|-- workspace/                # Projet Gatling standalone
|   |-- simulations/          # Fichiers de simulation Scala
|   +-- pom.xml               # Config Gatling Maven Plugin
|
+-- pom.xml                   # POM parent
```

### Stack technique

**Backend**
- Spring Boot 3.2.5 (Web, WebSocket, Data JPA, Validation)
- SQLite + Flyway pour les migrations
- WebSocket STOMP + SockJS pour le temps reel
- OpenHTMLtoPDF pour l'export PDF

**Frontend**
- React 19 + TypeScript + Vite 7
- Monaco Editor (editeur de code Scala)
- Recharts (graphiques de performance)
- STOMP.js + SockJS (WebSocket client)

**Moteur de test**
- Gatling 3.10.5 + Scala 2.13
- Gatling Maven Plugin 4.8.2

---

## Configuration

La configuration se fait via `backend/src/main/resources/application.yml` ou par variables d'environnement :

| Variable | Defaut | Description |
|----------|--------|-------------|
| `GATLING_WORKSPACE` | `../workspace` | Chemin vers le projet Gatling |
| `GATLING_TIMEOUT` | `30` | Timeout d'execution d'un test (minutes) |
| `server.port` | `8080` | Port du serveur |

---

## Tests

```bash
cd backend
mvn test -Dskip.npm -Dskip.installnodenpm
```

75 tests couvrant :
- **ThresholdService** - Evaluation des seuils de performance
- **SimulationLogParser** - Parsing des logs Gatling, reservoir sampling, percentiles
- **TestRunService** - Lancement, file d'attente, comparaison
- **MetricsPersistenceService** - Buffering et persistence des metriques
- **SimulationFileService** - Gestion des fichiers, protection path traversal
- **GatlingExecutionService** - Graceful shutdown

---

## Captures d'ecran

L'application propose 9 pages :

1. **Dashboard** - Lancement de tests avec parametres configurables
2. **Monitor** - Suivi temps reel des metriques Gatling et infrastructure
3. **Editeur** - Edition des simulations Scala avec coloration syntaxique
4. **Historique** - Liste paginee et triable de tous les runs
5. **Tendances** - Evolution des performances par simulation
6. **Comparaison** - Diff entre deux runs
7. **Seuils** - Configuration des profils de seuils
8. **Serveurs** - Gestion des serveurs monitores (Prometheus)
9. **Recorder** - Lancement du Gatling Recorder

---

## Contribuer

1. Fork le projet
2. Creer une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commiter (`git commit -m 'Ajout de ma fonctionnalite'`)
4. Push (`git push origin feature/ma-fonctionnalite`)
5. Ouvrir une Pull Request
