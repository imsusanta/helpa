import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Files that still reach for the raw service-role client and have not yet been
 * migrated onto scopedAdmin(). This list is tenant-isolation debt: every entry
 * is a file where a query may run without an account_id filter.
 *
 * Do not add to it. Entries are deleted as call sites migrate, so the length of
 * this array is the remaining migration surface.
 */
const UNSCOPED_SERVICE_ROLE_DEBT = [
  // Service-role client factories, superseded by src/lib/supabase/scoped-admin.ts.
  "src/lib/automations/admin-client.ts",
  "src/lib/flows/admin-client.ts",
  // Inline service-role clients.
  // NOTE: square brackets are escaped because ESLint `files` globs are
  // minimatch patterns, where an unescaped [id] is a character class and
  // would silently fail to match the literal Next.js dynamic-segment folder.
  "src/app/api/whatsapp/webhook/route.ts",
  "src/app/api/whatsapp/config/route.ts",
  "src/app/api/appointments/\\[id\\]/pdf/route.ts",
  "src/mcp/utils.ts",
  // Reads the key for its own key-derivation fallback chain.
  "src/lib/whatsapp/encryption.ts",
  // Committed one-off developer scripts, not application code.
  "scratch/**",
  // supabaseAdmin() consumers.
  "src/app/api/account/ai/route.ts",
  "src/app/api/admin/metrics/route.ts",
  "src/app/api/admin/plans/route.ts",
  "src/app/api/admin/settings/route.ts",
  "src/app/api/admin/tenants/route.ts",
  "src/app/api/appointments/notify/route.ts",
  "src/app/api/automations/\\[id\\]/duplicate/route.ts",
  "src/app/api/automations/\\[id\\]/route.ts",
  "src/app/api/automations/cron/route.ts",
  "src/app/api/automations/route.ts",
  "src/app/api/cron/campaigns/route.ts",
  "src/app/api/cron/reminders/route.ts",
  "src/app/api/flows/\\[id\\]/activate/route.ts",
  "src/app/api/flows/\\[id\\]/route.ts",
  "src/app/api/flows/cron/route.ts",
  "src/app/api/flows/route.ts",
  "src/app/api/lab-reports/notify/route.ts",
  "src/app/api/whatsapp/send/route.ts",
  "src/lib/automations/engine.ts",
  "src/lib/automations/meta-send.ts",
  "src/lib/automations/steps-tree.ts",
  "src/lib/flows/engine.ts",
  "src/lib/flows/meta-send.ts",
  "src/lib/saas/subscription.ts",
  "src/lib/whatsapp/ai.ts",
];

const NO_RAW_ADMIN_MESSAGE =
  "Raw service-role clients bypass RLS. Use scopedAdmin(accountId) from @/lib/supabase/scoped-admin instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Tenant isolation: the service-role key bypasses RLS, so only
  // src/lib/supabase/scoped-admin.ts may touch it directly.
  {
    name: "wacrm/no-raw-service-role",
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/lib/automations/admin-client",
                "**/lib/flows/admin-client",
                "./admin-client",
                "../admin-client",
              ],
              importNames: ["supabaseAdmin"],
              message: NO_RAW_ADMIN_MESSAGE,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // Reading the service-role key means minting an unscoped client.
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message: NO_RAW_ADMIN_MESSAGE,
        },
        {
          selector: "CallExpression[callee.name='supabaseAdmin']",
          message: NO_RAW_ADMIN_MESSAGE,
        },
      ],
    },
  },

  // scoped-admin.ts is the sanctioned owner of the service-role credential.
  {
    name: "wacrm/scoped-admin-exemption",
    files: ["src/lib/supabase/scoped-admin.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },

  // Pre-existing debt, tracked above. Warn so it stays visible in lint output
  // without failing the build on code that has not been migrated yet.
  {
    name: "wacrm/unscoped-service-role-debt",
    files: UNSCOPED_SERVICE_ROLE_DEBT,
    rules: {
      "no-restricted-imports": "warn",
      "no-restricted-syntax": "warn",
    },
  },

  // Tests may mock the legacy factories while the migration is in flight.
  {
    name: "wacrm/test-exemption",
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored minified opus-recorder encoder worker (served statically).
    "public/opus/**",
  ]),
]);

export default eslintConfig;
