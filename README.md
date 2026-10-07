# SchoolCare

Application de bureau de gestion scolaire : élèves, inscriptions, dossiers et
documents PDF. Fonctionne **hors ligne**, avec une base de données locale.

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Identifiants de connexion](#identifiants-de-connexion)
- [Où sont stockées les données](#où-sont-stockées-les-données)
- [Sauvegarde et restauration](#sauvegarde-et-restauration)
- [Commandes](#commandes)
- [Architecture](#architecture)
- [Base de données et migrations](#base-de-données-et-migrations)
- [Sécurité](#sécurité)
- [Packaging](#packaging)
- [Dépannage](#dépannage)
- [Ce qui reste à faire](#ce-qui-reste-à-faire)

## Démarrage rapide

```bash
npm install
npm run dev
```

`npm run dev` lance Vite puis Electron : la fenêtre s'ouvre automatiquement et
l'interface se recharge à chaque modification.

## Identifiants de connexion

L'application démarre sur un écran de connexion. Un compte d'administration est
créé automatiquement :

| Compte | Mot de passe initial |
| --- | --- |
| `admin@schoolcare.local` | `SchoolCare2026!` |

> **Ce mot de passe doit être changé.** L'application l'impose à la première
> connexion : vous ne pouvez pas accéder aux données avant d'en avoir défini un
> autre (8 caractères minimum).

Les mots de passe sont dérivés en **PBKDF2-SHA512, 210 000 itérations**, avec un
sel aléatoire par compte. Ils ne sont jamais stockés en clair.

## Où sont stockées les données

Tout est dans le dossier de données utilisateur d'Electron :

| Système | Emplacement |
| --- | --- |
| Windows | `%APPDATA%\SchoolCare\` |
| macOS | `~/Library/Application Support/SchoolCare/` |
| Linux | `~/.config/SchoolCare/` |

```
schoolcare.db            # base SQLite (mode WAL)
schoolcare.db-wal        # journal d'écriture, présent pendant l'exécution
backups/                 # sauvegardes automatiques et copies de sécurité
```

Les données ne quittent **jamais** la machine : aucun serveur, aucune
télémétrie.

## Sauvegarde et restauration

Une sauvegarde automatique est créée **une fois par jour** au démarrage, et les
sept dernières sont conservées.

La page **Paramètres** permet de :

- créer une sauvegarde immédiate ;
- enregistrer une copie à l'emplacement de votre choix, pour l'archiver sur un
  autre support ;
- restaurer une sauvegarde : le fichier est d'abord vérifié (en-tête SQLite et
  présence des tables attendues), l'application affiche le nombre d'élèves et de
  classes qu'il contient, puis demande confirmation. Une copie de sécurité de la
  base actuelle est systématiquement créée avant remplacement, et l'application
  redémarre.

> Une sauvegarde dans `backups/` ne protège pas d'une panne de disque. Copiez
> régulièrement un export sur un support externe.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Développement avec rechargement à chaud |
| `npm test` | Suite de tests automatisés (50 tests) |
| `npm run test:build` | Compile seulement la suite de tests |
| `npm run build` | Vérification des types puis build de production |
| `npm run typecheck` | `tsc` sur le renderer, le processus principal et les tests |
| `npm run lint` | ESLint |
| `npm run clean` | Supprime `dist/` et `dist-electron/` |
| `npm run electron` | Lance l'application déjà compilée |
| `npm run dist:win` | Installeur Windows (NSIS) dans `release/` |
| `npm run dist:mac` | Image disque macOS |
| `npm run dist:linux` | AppImage Linux |

## Tests

```bash
npm test
```

Les 50 tests couvrent le socle de données, c'est-à-dire tout ce qui peut
corrompre ou perdre des informations :

| Suite | Ce qui est vérifié |
| --- | --- |
| **Migrations** | Création d'une base neuve, migration d'une base v2 réelle sans perte de données, idempotence, rollback d'une migration en échec, activation des clés étrangères et du mode WAL |
| **Mots de passe** | Dérivation PBKDF2, sel aléatoire, comparaison à temps constant, caractères Unicode, robustesse face à un hachage corrompu |
| **Authentification** | Verrouillage après 5 échecs, expiration après 30 min d'inactivité, changement de mot de passe imposé puis rotation, comptes désactivés |
| **Élèves** | CRUD, validation des entrées (noms, classes, dates réelles dont années bissextiles), attribution des matricules, filtres et recherche, journal d'audit avant/après |
| **Sauvegardes** | Création, inspection, refus d'un fichier étranger, rétention, restauration complète, export |

Quelques principes :

- **Aucune dépendance de test.** Le harnais tient en une centaine de lignes
  (`tests/harness.ts`) et les tests tournent sous **Node seul** : Node 24 fournit
  `node:sqlite`, le même moteur que celui utilisé par l'application.
- **Chaque suite travaille sur sa propre base**, dans un dossier temporaire
  (`SCHOOLCARE_USER_DATA`). La base réelle n'est jamais ouverte.
- **Le code de production est testé tel quel** : pas de doublure, pas de
  `NODE_ENV` particulier. L'horloge est simulée (`node:test` mock timers) pour
  les délais, jamais attendue réellement.
- Le temps d'exécution (~1 min) est dominé par le PBKDF2 réel : 210 000
  itérations par vérification de mot de passe.

## Architecture

```
electron/                 # processus principal (Node, accès disque et base)
  main.ts                 # fenêtres, verrou d'instance unique, CSP
  ipc.ts                  # handlers IPC + garde-fou d'authentification
  preload.ts              # pont contextBridge -> window.schoolCare
  runtime.ts              # dossier de données, mode empaqueté (hors Electron)
  auth/
    password.ts           # dérivation PBKDF2
    session.ts            # session, verrouillage, rôles
  db/
    index.ts              # ouverture de la base, WAL, fermeture propre
    schema.ts             # schéma de base (version 1)
    migrations.ts         # migrations versionnées (PRAGMA user_version)
    students.ts           # élèves, classes, journal d'audit
    backup.ts             # sauvegarde, inspection, restauration
    seed.ts               # jeu de démonstration (développement uniquement)

src/                      # renderer (React)
  App.tsx                 # barrière d'authentification + routes
  navigation.ts           # sections et sous-pages
  components/             # coquille de l'interface
  pages/                  # écrans (auth, students, settings)
  pdf/                    # documents PDF (react-pdf)
  services/              # appels IPC + export PDF
  lib/labels.ts           # libellés et messages d'erreur partagés
  types/models.ts         # types partagés entre les deux processus

tests/                    # suite de tests (exécutée par Node)
  harness.ts              # micro-harnais d'assertions
  helpers.ts              # isolation des données, schéma historique v2
  *.test.ts               # migrations, mots de passe, auth, élèves, sauvegardes
```

`electron/runtime.ts` isole les dépendances à Electron : le socle de données
(et donc les tests) fonctionne aussi bien dans Electron que sous Node seul.

Le renderer n'a **aucun accès** à Node : tout passe par `window.schoolCare`,
exposé par le preload avec `contextIsolation` activé.

## Base de données et migrations

Le schéma est versionné via `PRAGMA user_version`. Au démarrage, l'application
applique les migrations manquantes dans une transaction : une migration qui
échoue est annulée et l'application affiche une erreur au lieu de démarrer sur
des données incohérentes.

Versions actuelles :

| Version | Contenu |
| --- | --- |
| 1 | Schéma de base : rôles, utilisateurs, classes, élèves |
| 2 | `students.updated_at` + table `audit_log` |
| 3 | Horodatages en millisecondes (précision à la seconde insuffisante) |
| 4 | Authentification : `password_hash`, `must_change_password`, `last_login_at` |

**Pour faire évoluer le schéma**, ajoutez une entrée à la fin du tableau
`migrations` dans `electron/db/migrations.ts`. Ne modifiez **jamais** une
migration déjà livrée : les bases installées ne la rejoueraient pas.

### Journal d'audit

Chaque création, modification et suppression d'élève est enregistrée dans
`audit_log` avec l'utilisateur connecté, l'action et, pour les modifications, la
valeur avant et après. La fiche élève affiche cet historique.

### Pagination

La liste des élèves est paginée côté base : seules les lignes affichées sont
chargées (`LIMIT`/`OFFSET`), avec un comptage séparé pour connaître le total. La
taille de page est réglable (25, 50, 100 ou 200 lignes).

L'export d'une liste sans sélection charge volontairement l'intégralité du filtre
et non la page courante : un PDF « liste des élèves » couvre toujours tout le
résultat du filtre. Le compteur `x–y sur N` indique exactement ce qui est
affiché.

## Sécurité

- `contextIsolation: true`, `nodeIntegration: false` — le renderer ne voit pas
  Node.
- Toutes les opérations sur les données exigent une session authentifiée
  (garde-fou centralisé dans `electron/ipc.ts`).
- Verrouillage après 5 tentatives échouées (30 secondes) et après 30 minutes
  d'inactivité.
- Requêtes SQL **entièrement paramétrées**.
- Content-Security-Policy restrictive en production (aucune origine distante).
- Verrou d'instance unique : deux processus ne peuvent pas écrire dans la même
  base.

## Packaging

```bash
npm run dist:win
```

Les icônes sont générées par `make-icons.py` (nécessite Pillow) :

```bash
python make-icons.py
```

Il produit `public/icon.png` (Linux), `public/icons.ico` (Windows) et
`public/icon.iconset/` — ce dernier doit être converti en `.icns` sur macOS :

```bash
iconutil -c icns public/icon.iconset -o public/icon.icns
```

## Dépannage

**La fenêtre reste blanche / `window.schoolCare` est `undefined`.**
Le preload n'a pas été chargé. `electron/preload.ts` est compilé en CommonJS
mais doit porter l'extension `.cjs` : `vite.config.ts` force
`entryFileNames: 'preload.cjs'`. Un fichier `.mjs` contenant du `require()` est
refusé par Electron.

**`SyntaxError: The requested module 'electron' does not provide an export named
'BrowserWindow'`.**
La variable d'environnement `ELECTRON_RUN_AS_NODE` est définie : Electron
démarre alors en mode Node et n'expose pas ses API. Retirez-la :

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

**`Error invoking remote method ... Session expirée`.**
La session a expiré (30 minutes d'inactivité) ou l'application a redémarré.
Reconnectez-vous.

**Base inaccessible au démarrage.**
L'application affiche un message explicite plutôt qu'une fenêtre vide. Vérifiez
l'espace disque et les droits sur le dossier de données, ou restaurez une
sauvegarde.

## Ce qui reste à faire

- [ ] CRUD complet des classes (aujourd'hui en lecture seule et sans écran)
- [ ] Écrans Absences, Infirmerie, Parents, Statistiques, Salaires, Factures
- [ ] Gestion des utilisateurs dans l'interface (rôles `teacher`, `parent`,
      `student` existent en base mais ne sont pas exploitables)
- [ ] Recherche globale et notifications (boutons retirés, ils étaient inertes)
- [ ] Signature de code pour Windows et macOS
- [ ] Les messages d'erreur et l'interface sont uniquement en français
