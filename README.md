# emilsuliman.com

Angular 21 single-page portfolio. `npm start` for the dev server, `npm run build` for production (`dist/emil-final/browser`).

## Performance notes (keep these when adding content)

- **Images:** export at the size they are shown (≈2× for retina), as `.webp` or `.jpg`. Don't commit originals or editor backups (`*~` is git-ignored now) — everything in `src/assets` gets deployed.
- **Videos:** ship `.mp4` (H.264, `-movflags +faststart`) — it plays everywhere, including iPhone. The slider uses `<file>.mp4` first and falls back to `<file>.webm`, so add both with the same name.
- **Lottie:** images embedded in a Lottie JSON should be small WebP (the timeline logos are shown at ~80 px). Lottie is loaded on demand (`lottie_light`, SVG renderer, no expressions) — avoid After Effects expressions or switch the import to `lottie_svg`.
- **Heavy sections load late:** the timeline animations load when the section approaches, the case slider and the footer whale render `@defer (on viewport)`.
- **Fonts are self-hosted** (`src/assets/fonts`), no Google Fonts request (faster, and GDPR-safe in Germany).

### Server (nginx) — please add

The Lottie JSON files are currently served **uncompressed** (timeline.json alone is 1.7 MB; gzipped it is 0.23 MB):

```nginx
gzip on;
gzip_comp_level 6;
gzip_min_length 1024;
gzip_types application/json application/javascript text/css image/svg+xml font/woff2;

# hashed build files never change → cache for a year
location ~* \.(?:js|css|woff2)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
# assets keep their names → cache, but revalidate
location /assets/ {
    add_header Cache-Control "public, max-age=604800";
}
```

---

## Angular CLI reference

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
