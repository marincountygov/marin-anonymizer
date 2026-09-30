# Marin Anonymizer

Marin Anonymizer is a browser-only MarinOS utility for replacing values in CSV, JSON, and XLSX files. Files are read, transformed, and downloaded locally. The page does not upload selected data.

## Run locally

Clone or download this repository's files and either place them on your webserver or open index.html from your computer's file system.

No package manager or build step is required. File processing remains local to the browser. The shared MarinOS shell may use an internet connection to load the MarinOS catalog and recent repository updates; those optional interface features do not receive the selected file or its contents.

## Workflow

1. Drop one supported file anywhere on the page or select **Choose file**.
2. For XLSX files, choose one worksheet or **All worksheets**.
3. Choose an anonymization action for one or more fields. When multiple worksheets are selected, a rule applies to every matching field name across those worksheets.
4. Select **Anonymize and download**.
5. Review the downloaded file before sharing or using it.

## Supported input

- CSV with a header row
- JSON with a top-level array of objects
- XLSX with one or more worksheets; choose one worksheet or all worksheets after opening the file

The XLSX output is a new data-only workbook. When all worksheets are selected, the output remains one XLSX file with the selected worksheet names, order, and hidden state. It does not preserve formulas, formatting, charts, or other workbook features.

## Anonymization actions

- **Hash with SHA-256:** repeatable pseudonymous value
- **Redact:** `---REDACTED---`
- **Synthetic full name**
- **Synthetic email address**
- **Synthetic phone number**
- **Synthetic street address**
- **Synthetic past date**

Repeated source values in the same field receive the same synthetic replacement during one download. Synthetic mappings are not stored and will differ after a reload or a later download.

## Important security limitation

SHA-256 hashing is pseudonymization, not guaranteed anonymization. Common or predictable source values can be guessed by hashing candidate values and comparing the result. This app does not determine whether a dataset is legally or operationally safe to release.

## Security

Marin Anonymizer follows the [MarinOS security standard](https://github.com/marincountygov/marin-digital-standards/blob/main/security/standard.md). See [`SECURITY.md`](SECURITY.md) to report an issue, the app's own `#security` section for a plain-language summary, or **Important security limitation** above for what anonymization in this app does and does not guarantee.

## Local dependencies

Runtime files are bundled under `libs/`:

- Papa Parse 5.4.1
- SheetJS 0.18.5
- CryptoJS 4.1.1
- Faker 3.1.0 browser build

Do not replace these files with runtime CDN references. The app includes compatibility code for the bundled Faker 3.1.0 API as well as newer Faker browser APIs.

## MarinOS integration

Marin Anonymizer vendors Marin App Shell under `vendor/marinos/`. The pinned shell version is recorded in `marin.yml`.

The shell provides the MarinOS banner and catalog menu, application header, standard About, Security, Accessibility, and Updates sections, navigation, footer, Feedback control, responsive behavior, shared design tokens, and common accessibility infrastructure. Application-specific behavior and styling remain in `assets/app.js` and `assets/app.css`.

Do not edit files under `vendor/marinos/` in this repository. Upgrade the shell by replacing that complete directory with a tagged shell release and updating `platform.shell` in `marin.yml`. The app-level fonts remain under `vendor/fonts/`.
