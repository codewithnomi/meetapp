// Architecture rules (AC-F00-15, AC-F00-28): Atomic Design levels and backend layers.
// docs/engineering/frontend.md section 2 and docs/engineering/backend.md section 1.
/** The database package and the database libraries; only repositories may use them. */
const DATABASE = "(^|/)(packages/db/|@meetapp/db|drizzle-orm|postgres|pg)($|/)";
const LEVELS = ["atoms", "molecules", "organisms", "templates", "pages"];

/** A level may not import any higher level. */
const upward = LEVELS.slice(0, -1).map((level, index) => ({
  name: "atomic-no-upward-import",
  comment: `${level} may only import lower Atomic levels (frontend.md).`,
  severity: "error",
  from: { path: `/${level}/` },
  to: { path: `/(${LEVELS.slice(index + 1).join("|")})/` },
}));

module.exports = {
  forbidden: [
    ...upward,
    {
      name: "atomic-no-sibling-internals",
      comment: "Use another component only through its index.ts, never its internal files (frontend.md).",
      severity: "error",
      from: { path: "/(atoms|molecules|organisms|templates|pages)/([^/]+)/" },
      to: {
        path: "/(atoms|molecules|organisms|templates|pages)/[^/]+/",
        pathNot: ["/$1/$2/", "/(atoms|molecules|organisms|templates|pages)/[^/]+/index\\.tsx?$"],
      },
    },
    {
      name: "no-route-to-repository",
      comment: "Routes call services; only services use repositories (backend.md).",
      severity: "error",
      from: { path: "\\.routes\\.ts$" },
      to: { path: "\\.repository\\.ts$" },
    },
    {
      name: "no-route-to-db",
      comment: "Routes never touch the database; go through a service and a repository (backend.md).",
      severity: "error",
      from: { path: "\\.routes\\.ts$" },
      to: { path: DATABASE },
    },
    {
      name: "no-service-to-db",
      comment: "Services use repositories for data; they never query the database themselves (backend.md).",
      severity: "error",
      from: { path: "\\.service\\.ts$" },
      to: { path: DATABASE, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-service-to-routes",
      comment: "Services never know about HTTP (backend.md).",
      severity: "error",
      from: { path: "\\.service\\.ts$" },
      to: { path: "\\.routes\\.ts$" },
    },
    {
      name: "no-repository-to-upper-layers",
      comment: "Repositories only read and write the database (backend.md).",
      severity: "error",
      from: { path: "\\.repository\\.ts$" },
      to: { path: "\\.(service|routes)\\.ts$" },
    },
    {
      name: "no-circular",
      comment: "Circular imports make code hard to follow and test.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Fixtures break the rules on purpose; tests feed them to the tool directly.
    exclude: { path: "(^|/)(node_modules|dist|out|coverage|storybook-static)/|^tests/fixtures/|^docs/" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".mjs", ".json"] },
  },
};
