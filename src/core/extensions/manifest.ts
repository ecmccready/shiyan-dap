/**
 * Aethel Node extension manifest contract v1.
 *
 * This validates declarations only. It does not load extension code, grant
 * credentials, create a sandbox, or authorize execution. Those remain host
 * responsibilities and must be enforced at the execution boundary.
 */
export const EXTENSION_API_VERSION = "aethel.extension/v1" as const;

export const EXTENSION_CAPABILITIES = [
  "repository.read",
  "repository.propose_change",
  "evidence.read",
  "evidence.write",
  "experience.read",
  "experience.propose",
  "workbench.execute",
] as const;

export type ExtensionCapability = (typeof EXTENSION_CAPABILITIES)[number];
export type ExtensionMode = "read-only" | "propose" | "execute";

export interface ExtensionManifestV1 {
  api_version: typeof EXTENSION_API_VERSION;
  id: string;
  name: string;
  version: string;
  entrypoint: string;
  mode: ExtensionMode;
  capabilities: ExtensionCapability[];
  data_scopes: string[];
  tenant_isolation: "required";
  human_approval: boolean;
  output_contracts: string[];
}

export type ManifestValidation =
  | { valid: true; manifest: ExtensionManifestV1 }
  | { valid: false; errors: string[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const uniqueStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty) && new Set(value).size === value.length;
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function validateExtensionManifest(value: unknown): ManifestValidation {
  const errors: string[] = [];
  if (!isObject(value)) return { valid: false, errors: ["Manifest must be a JSON object."] };

  const allowedKeys = new Set([
    "api_version", "id", "name", "version", "entrypoint", "mode",
    "capabilities", "data_scopes", "tenant_isolation", "human_approval",
    "output_contracts",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(\`Unknown manifest field: \${key}\`);
  }

  if (value.api_version !== EXTENSION_API_VERSION) errors.push("api_version must be aethel.extension/v1.");
  if (!nonEmpty(value.id) || !ID.test(value.id)) errors.push("id must be a lowercase identifier using letters, digits, dots or hyphens.");
  if (!nonEmpty(value.name) || value.name.length > 100) errors.push("name must contain 1–100 characters.");
  if (!nonEmpty(value.version) || !VERSION.test(value.version)) errors.push("version must be a valid semantic version.");
  const entrypoint = value.entrypoint;
  if (!nonEmpty(entrypoint) || entrypoint.startsWith("/") || entrypoint.includes("\\\\") ||
      entrypoint.split("/").some((part) => part === "." || part === "..")) {
    errors.push("entrypoint must be a relative path without traversal segments.");
  }
  if (value.mode !== "read-only" && value.mode !== "propose" && value.mode !== "execute") {
    errors.push("mode must be read-only, propose or execute.");
  }
  if (!uniqueStrings(value.capabilities)) {
    errors.push("capabilities must be a unique array of non-empty strings.");
  } else {
    for (const capability of value.capabilities) {
      if (!(EXTENSION_CAPABILITIES as readonly string[]).includes(capability)) {
        errors.push(\`Unsupported capability: \${capability}\`);
      }
    }
  }
  if (!uniqueStrings(value.data_scopes) || value.data_scopes.some((scope) => scope === "*" || scope.includes(".."))) {
    errors.push("data_scopes must be explicit, unique scopes; wildcard and traversal scopes are forbidden.");
  }
  if (value.tenant_isolation !== "required") errors.push("tenant_isolation must be required.");
  if (typeof value.human_approval !== "boolean") errors.push("human_approval must be boolean.");
  if (!uniqueStrings(value.output_contracts)) errors.push("output_contracts must be a unique array of non-empty contract identifiers.");

  if (value.mode === "read-only" && Array.isArray(value.capabilities) &&
      value.capabilities.some((capability) => ["repository.propose_change", "evidence.write", "experience.propose", "workbench.execute"].includes(String(capability)))) {
    errors.push("read-only extensions cannot declare write, proposal or execution capabilities.");
  }
  if (value.mode === "execute" && value.human_approval !== true) {
    errors.push("execute-mode extensions must require human approval in v1.");
  }
  if (value.mode !== "execute" && Array.isArray(value.capabilities) &&
      value.capabilities.includes("workbench.execute")) {
    errors.push("workbench.execute requires execute mode.");
  }

  if (errors.length) return { valid: false, errors };
  return { valid: true, manifest: value as unknown as ExtensionManifestV1 };
}
