/**
 * Tailwind v4 is CSS-first — there is no tailwind.config.js. Theme tokens live
 * in `@theme` inside src/app/(app)/globals.css.
 *
 * That stylesheet is imported ONLY by the (app) root layout, never by a shared
 * parent, so Tailwind's preflight reset can never reach the Payload admin panel.
 * See src/app/(payload)/custom.scss.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
