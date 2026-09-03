# MarinOS fonts

Font binaries are not included in this transfer package. The CSS uses accessible system-font fallbacks.

Before publishing in a repository that vendors the complete Marin UI release, restore the approved local font files at:

- `vendor/fonts/Jost-wght.ttf`
- `vendor/fonts/open-sans/OpenSans-VariableFont_wdth,wght.woff2`
- `vendor/fonts/open-sans/OFL.txt`

Copy the complete versioned `shared/`, `vendor/`, and `BRAND_VERSION` bundle together from the approved Marin UI release rather than updating individual shared files.
