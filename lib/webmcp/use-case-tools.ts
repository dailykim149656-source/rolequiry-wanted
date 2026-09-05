"use client";

import { useWebMCP } from "use-webmcp-tool";
import type { CaseStore } from "@/lib/case-store";
import { WEBMCP_INPUT_LIMITS } from "@/lib/webmcp/input-limits";
import {
  CASE_TOOL_CONTRACTS,
  getCaseState,
  getDecisionDossier,
  getRoleClaims,
  importRoleFromClaimsTool,
  recordInterviewAnswerTool,
  recordResearchEvidenceTool,
  selectDecisionChanger,
  setCandidatePrioritiesTool,
} from "@/lib/webmcp/tools";

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const answerSchema = {
  type: "object",
  properties: {
    stance: { type: "string", enum: ["SUPPORTS", "CHALLENGES", "NEUTRAL"] },
    text: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.text,
    },
    speakerRole: {
      type: "string",
      enum: ["RECRUITER", "HIRING_MANAGER", "TEAM_MEMBER", "OTHER"],
    },
  },
  required: ["stance", "text", "speakerRole"],
  additionalProperties: false,
} as const;

const researchSchema = {
  type: "object",
  properties: {
    stance: { type: "string", enum: ["SUPPORTS", "CHALLENGES", "NEUTRAL"] },
    summary: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.text,
    },
    sourceUrl: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.url,
    },
    sourceLabel: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.label,
    },
    sourceKind: {
      type: "string",
      enum: ["EMPLOYER_OFFICIAL", "FIRST_PERSON_EXPERIENCE", "OTHER_PUBLIC"],
    },
  },
  required: ["stance", "summary", "sourceUrl", "sourceLabel", "sourceKind"],
  additionalProperties: false,
} as const;

const importSchema = {
  type: "object",
  properties: {
    company: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.label,
    },
    role: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.label,
    },
    sourceUrl: {
      type: "string",
      minLength: 1,
      maxLength: WEBMCP_INPUT_LIMITS.url,
    },
    claims: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          dimension: {
            type: "string",
            description: "The single decision variable this claim models.",
            minLength: 1,
            maxLength: WEBMCP_INPUT_LIMITS.label,
          },
          employerStatement: {
            type: "string",
            description:
              "Only the minimal employer sentences that directly bear on this claim's decision variable. Never fold adjacent policy, benefits, or location prose into the same claim.",
            minLength: 1,
            maxLength: WEBMCP_INPUT_LIMITS.text,
          },
          unresolvedVariable: {
            type: "string",
            minLength: 1,
            maxLength: WEBMCP_INPUT_LIMITS.text,
          },
          measurableForm: {
            type: "string",
            minLength: 1,
            maxLength: WEBMCP_INPUT_LIMITS.text,
          },
        },
        required: [
          "dimension",
          "employerStatement",
          "unresolvedVariable",
          "measurableForm",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["company", "role", "claims"],
  additionalProperties: false,
} as const;

const prioritiesSchema = {
  type: "object",
  properties: {
    priorities: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          claimId: {
            type: "string",
            minLength: 1,
            maxLength: WEBMCP_INPUT_LIMITS.identifier,
          },
          importance: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          },
        },
        required: ["claimId", "importance"],
        additionalProperties: false,
      },
    },
  },
  required: ["priorities"],
  additionalProperties: false,
} as const;

export function useCaseWebMCPTools(store: CaseStore) {
  const [
    claimsContract,
    stateContract,
    selectContract,
    recordContract,
    importContract,
    researchContract,
    prioritiesContract,
    dossierContract,
  ] = CASE_TOOL_CONTRACTS;
  const claims = useWebMCP({
    name: claimsContract.name,
    description: claimsContract.description,
    inputSchema: emptySchema,
    annotations: claimsContract.annotations,
    execute: () => getRoleClaims(store),
  });
  const state = useWebMCP({
    name: stateContract.name,
    description: stateContract.description,
    inputSchema: emptySchema,
    annotations: stateContract.annotations,
    execute: () => getCaseState(store),
  });
  const select = useWebMCP({
    name: selectContract.name,
    description: selectContract.description,
    inputSchema: emptySchema,
    annotations: selectContract.annotations,
    execute: () => selectDecisionChanger(store),
  });
  const record = useWebMCP({
    name: recordContract.name,
    description: recordContract.description,
    inputSchema: answerSchema,
    annotations: recordContract.annotations,
    execute: (args: {
      stance: "SUPPORTS" | "CHALLENGES" | "NEUTRAL";
      text: string;
      speakerRole: "RECRUITER" | "HIRING_MANAGER" | "TEAM_MEMBER" | "OTHER";
    }) => recordInterviewAnswerTool(store, args),
  });
  const imported = useWebMCP({
    name: importContract.name,
    description: importContract.description,
    inputSchema: importSchema,
    annotations: importContract.annotations,
    execute: (args: {
      company: string;
      role: string;
      sourceUrl?: string;
      claims: Array<{
        dimension: string;
        employerStatement: string;
        unresolvedVariable: string;
        measurableForm: string;
      }>;
    }) => importRoleFromClaimsTool(store, args),
  });
  const research = useWebMCP({
    name: researchContract.name,
    description: researchContract.description,
    inputSchema: researchSchema,
    annotations: researchContract.annotations,
    execute: (args: {
      stance: "SUPPORTS" | "CHALLENGES" | "NEUTRAL";
      summary: string;
      sourceUrl: string;
      sourceLabel: string;
      sourceKind: "EMPLOYER_OFFICIAL" | "FIRST_PERSON_EXPERIENCE" | "OTHER_PUBLIC";
    }) => recordResearchEvidenceTool(store, args),
  });
  const priorities = useWebMCP({
    name: prioritiesContract.name,
    description: prioritiesContract.description,
    inputSchema: prioritiesSchema,
    annotations: prioritiesContract.annotations,
    execute: (args: {
      priorities: Array<{
        claimId: string;
        importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      }>;
    }) => setCandidatePrioritiesTool(store, args),
  });
  const dossier = useWebMCP({
    name: dossierContract.name,
    description: dossierContract.description,
    inputSchema: emptySchema,
    annotations: dossierContract.annotations,
    execute: () => getDecisionDossier(store),
  });

  return {
    claims,
    state,
    select,
    record,
    imported,
    research,
    priorities,
    dossier,
  };
}
