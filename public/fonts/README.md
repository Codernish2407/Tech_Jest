# Bundled website fonts

Unmodified WOFF2 files from this project's existing Next.js-generated Google Fonts cache:

- Manrope, variable weights 200–800.
- Source Serif 4, weight 600.

The `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, and `vietnamese` subsets and original fallback metrics are preserved in `src/app/fonts.css`. Only the Latin files are preloaded; the browser requests other subsets as needed. No font download is required during the build.

Both families use the SIL Open Font License 1.1; see `OFL.txt`. Upstream notices:

- https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt
- https://github.com/google/fonts/blob/main/ofl/sourceserif4/OFL.txt
- https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md

The existing TTF files under `src/app/_og/` are still used only for generated preview images.
