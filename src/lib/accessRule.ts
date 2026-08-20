// Decodes the general-purpose `AccessRule` enum used for resource permissions, component method
// access, and owner rules -- `tari_template_lib_types::access_rules::{AccessRule, RestrictedAccessRule,
// RequireRule, RuleRequirement, UpdateRule}` (crates/template_lib_types/src/access_rules.rs). Distinct
// from the stealth-output `SpendCondition`'s `AtomicCondition::AccessRule` atom (see spendCondition.ts),
// which wraps this same `AccessRule` type as its payload but is decoded separately since it lives in a
// different enclosing shape (a MAST leaf, not a resource/component permission set).

export type RuleRequirementInfo =
  | { kind: "Resource"; address: string }
  | { kind: "NonFungible"; address: string }
  | { kind: "Component"; address: string }
  | { kind: "Template"; address: string }
  | { kind: "unknown"; raw: unknown };

export function describeRuleRequirement(req: unknown): RuleRequirementInfo {
  if (req && typeof req === "object") {
    if ("Resource" in req) return { kind: "Resource", address: String((req as { Resource: unknown }).Resource) };
    if ("NonFungibleAddress" in req) return { kind: "NonFungible", address: String((req as { NonFungibleAddress: unknown }).NonFungibleAddress) };
    if ("ScopedToComponent" in req) return { kind: "Component", address: String((req as { ScopedToComponent: unknown }).ScopedToComponent) };
    if ("ScopedToTemplate" in req) return { kind: "Template", address: String((req as { ScopedToTemplate: unknown }).ScopedToTemplate) };
  }
  return { kind: "unknown", raw: req };
}

export type RequireRuleInfo =
  | { kind: "Require"; requirement: RuleRequirementInfo }
  | { kind: "AnyOf"; requirements: RuleRequirementInfo[] }
  | { kind: "AllOf"; requirements: RuleRequirementInfo[] }
  | { kind: "MOfN"; m: number; requirements: RuleRequirementInfo[] }
  | { kind: "unknown"; raw: unknown };

export function describeRequireRule(rule: unknown): RequireRuleInfo {
  if (rule && typeof rule === "object") {
    if ("Require" in rule) return { kind: "Require", requirement: describeRuleRequirement((rule as { Require: unknown }).Require) };
    if ("AnyOf" in rule) return { kind: "AnyOf", requirements: ((rule as { AnyOf: unknown[] }).AnyOf ?? []).map(describeRuleRequirement) };
    if ("AllOf" in rule) return { kind: "AllOf", requirements: ((rule as { AllOf: unknown[] }).AllOf ?? []).map(describeRuleRequirement) };
    if ("MOfN" in rule) {
      const [m, reqs] = (rule as { MOfN: [number, unknown[]] }).MOfN;
      return { kind: "MOfN", m, requirements: (reqs ?? []).map(describeRuleRequirement) };
    }
  }
  return { kind: "unknown", raw: rule };
}

export type RestrictedAccessRuleInfo =
  | { kind: "Require"; rule: RequireRuleInfo }
  | { kind: "AnyOf"; rules: RestrictedAccessRuleInfo[] }
  | { kind: "AllOf"; rules: RestrictedAccessRuleInfo[] }
  | { kind: "unknown"; raw: unknown };

export function describeRestrictedAccessRule(rule: unknown): RestrictedAccessRuleInfo {
  if (rule && typeof rule === "object") {
    if ("Require" in rule) return { kind: "Require", rule: describeRequireRule((rule as { Require: unknown }).Require) };
    if ("AnyOf" in rule) return { kind: "AnyOf", rules: ((rule as { AnyOf: unknown[] }).AnyOf ?? []).map(describeRestrictedAccessRule) };
    if ("AllOf" in rule) return { kind: "AllOf", rules: ((rule as { AllOf: unknown[] }).AllOf ?? []).map(describeRestrictedAccessRule) };
  }
  return { kind: "unknown", raw: rule };
}

export type AccessRuleInfo =
  | { kind: "AllowAll" }
  | { kind: "DenyAll" }
  | { kind: "Restricted"; rule: RestrictedAccessRuleInfo }
  | { kind: "unknown"; raw: unknown };

export function describeAccessRule(rule: unknown): AccessRuleInfo {
  if (rule === "AllowAll") return { kind: "AllowAll" };
  if (rule === "DenyAll") return { kind: "DenyAll" };
  if (rule && typeof rule === "object" && "Restricted" in rule) {
    return { kind: "Restricted", rule: describeRestrictedAccessRule((rule as { Restricted: unknown }).Restricted) };
  }
  return { kind: "unknown", raw: rule };
}

export type UpdateRuleInfo =
  | { kind: "Locked" }
  | { kind: "Owner" }
  | { kind: "AccessRule"; rule: AccessRuleInfo }
  | { kind: "unknown"; raw: unknown };

export function describeUpdateRule(rule: unknown): UpdateRuleInfo {
  if (rule === "Locked") return { kind: "Locked" };
  if (rule === "Owner") return { kind: "Owner" };
  if (rule && typeof rule === "object" && "AccessRule" in rule) {
    return { kind: "AccessRule", rule: describeAccessRule((rule as { AccessRule: unknown }).AccessRule) };
  }
  return { kind: "unknown", raw: rule };
}
