/// <reference types="vite/client" />

// Side-effect CSS imports exist only in the web entry point; TypeScript needs to
// be told they are modules rather than missing files.
declare module "*.css";
