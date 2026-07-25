// Next ships declarations for CSS *modules* (`*.module.css`, see
// next/types/global.d.ts) but not for plain stylesheets, so a side-effect
// import like `import './globals.css'` in app/layout.tsx has no type for
// TypeScript to resolve. Newer TS versions report that as TS2882 ("Cannot find
// module or type declarations for side-effect import"), which surfaces in the
// editor even though the project's own `tsc` and the Next build both accept it
// (Next resolves CSS through its bundler, not TypeScript).
//
// The import itself is required — it's what loads Tailwind and the global
// theme. This declaration just tells TypeScript such a module exists.
declare module '*.css'
