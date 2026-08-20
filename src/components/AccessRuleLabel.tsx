import type { ReactNode } from "react";
import {
  describeAccessRule,
  describeUpdateRule,
  type AccessRuleInfo,
  type RequireRuleInfo,
  type RestrictedAccessRuleInfo,
  type RuleRequirementInfo,
} from "../lib/accessRule";
import { Hash } from "./Hash";
import { JsonTree } from "./JsonTree";

function Joined({ items, sep }: { items: ReactNode[]; sep: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-ink-faint">{sep}</span>}
          {item}
        </span>
      ))}
    </span>
  );
}

function RequirementLabel({ req }: { req: RuleRequirementInfo }) {
  switch (req.kind) {
    case "Resource":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-ink-dim">
          holds <Hash value={req.address} className="text-xs" />
        </span>
      );
    case "NonFungible":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-ink-dim">
          holds NFT <Hash value={req.address} className="text-xs" />
        </span>
      );
    case "Component":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-ink-dim">
          called from <Hash value={req.address} className="text-xs" />
        </span>
      );
    case "Template":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-ink-dim">
          called from <Hash value={req.address} linkOverride={`/template/${req.address}`} className="text-xs" />
        </span>
      );
    default:
      return <span className="text-xs text-ink-faint">unrecognized requirement</span>;
  }
}

function RequireRuleLabel({ rule }: { rule: RequireRuleInfo }) {
  switch (rule.kind) {
    case "Require":
      return <RequirementLabel req={rule.requirement} />;
    case "AnyOf":
      return (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs">
          <span className="text-ink-faint">any of</span>
          <Joined items={rule.requirements.map((r, i) => <RequirementLabel key={i} req={r} />)} sep="," />
        </span>
      );
    case "AllOf":
      return (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs">
          <span className="text-ink-faint">all of</span>
          <Joined items={rule.requirements.map((r, i) => <RequirementLabel key={i} req={r} />)} sep="," />
        </span>
      );
    case "MOfN":
      return (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs">
          <span className="text-ink-faint">
            {rule.m} of {rule.requirements.length}
          </span>
          <Joined items={rule.requirements.map((r, i) => <RequirementLabel key={i} req={r} />)} sep="," />
        </span>
      );
    default:
      return <JsonTree data={rule.raw} />;
  }
}

function RestrictedLabel({ rule }: { rule: RestrictedAccessRuleInfo }) {
  switch (rule.kind) {
    case "Require":
      return <RequireRuleLabel rule={rule.rule} />;
    case "AnyOf":
      return (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs">
          <span className="text-ink-faint">any of</span>
          <Joined items={rule.rules.map((r, i) => <RestrictedLabel key={i} rule={r} />)} sep="," />
        </span>
      );
    case "AllOf":
      return (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs">
          <span className="text-ink-faint">all of</span>
          <Joined items={rule.rules.map((r, i) => <RestrictedLabel key={i} rule={r} />)} sep="," />
        </span>
      );
    default:
      return <JsonTree data={rule.raw} />;
  }
}

function AccessRuleInfoLabel({ info }: { info: AccessRuleInfo }) {
  switch (info.kind) {
    case "AllowAll":
      return <span className="text-xs text-success">Allow all</span>;
    case "DenyAll":
      return <span className="text-xs text-ink-faint">Deny all</span>;
    case "Restricted":
      return <RestrictedLabel rule={info.rule} />;
    default:
      return <JsonTree data={info.raw} />;
  }
}

/** Renders an `AccessRule` as a short, human-readable label -- "Allow all" / "Deny all" for the
 * common unrestricted cases, or a compact description of the requirement tree (who must hold what,
 * or where the call must originate from) for a `Restricted` one. */
export function AccessRuleLabel({ rule }: { rule: unknown }) {
  return <AccessRuleInfoLabel info={describeAccessRule(rule)} />;
}

/** Renders an `UpdateRule` -- who may change the access rule this update-rule guards. `Locked` means
 * the rule is permanently fixed; `Owner` defers to the resource/component's owner rule. */
export function UpdateRuleLabel({ rule }: { rule: unknown }) {
  const info = describeUpdateRule(rule);
  switch (info.kind) {
    case "Locked":
      return <span className="text-xs text-ink-faint">Locked</span>;
    case "Owner":
      return <span className="text-xs text-ink-dim">Owner may change</span>;
    case "AccessRule":
      return <AccessRuleInfoLabel info={info.rule} />;
    default:
      return <JsonTree data={info.raw} />;
  }
}
