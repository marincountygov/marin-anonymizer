# Local Anonymizer

Local Anonymizer is a browser-only MarinOS utility for replacing values in CSV, JSON, and XLSX files. Files are read, transformed, and downloaded locally. The page does not upload selected data.

## Run locally

Open `index.html` in a modern browser. No server, package manager, build step, or internet connection is required.

## Workflow

1. Drop one supported file anywhere on the page or select **Choose file**.
2. Choose an anonymization action for one or more fields.
3. Select **Anonymize and download**.
4. Review the downloaded file before sharing or using it.

## Supported input

- CSV with a header row
- JSON with a top-level array of objects
- XLSX; only the first worksheet is read

The XLSX output is a new data-only workbook. It does not preserve formulas, formatting, charts, or additional worksheets.

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

## Local dependencies

Runtime files are bundled under `libs/`:

- Papa Parse 5.4.1
- SheetJS 0.18.5
- CryptoJS 4.1.1
- Faker 3.1.0 browser build

Do not replace these files with runtime CDN references. The app includes compatibility code for the bundled Faker 3.1.0 API as well as newer Faker browser APIs.

## MarinOS integration

The package includes the MarinOS app shell, navigation, footer, feedback link, responsive behavior, light/dark color tokens, accessible status messages, and full-page drag-and-drop behavior modeled on Marin Zipper and Marin Unzipper.

This transfer package uses a self-contained compatible CSS baseline and system-font fallbacks. Before publishing into a repository that vendors Marin UI, replace `shared/app-brand.css`, `shared/app-shell.js`, `vendor/pico.min.css`, and `BRAND_VERSION` with the complete approved Marin UI release together. Then retest the app-specific files under `assets/`.

The Updates tab intentionally contains no repository link because a publication repository was not provided. Configure that link after the repository name and deployment URL are established.
