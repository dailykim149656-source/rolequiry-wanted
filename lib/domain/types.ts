export const CLAIM_KIND = {
  EMPLOYER_POLICY: "EMPLOYER_POLICY",
  LIVED_EXPERIENCE: "LIVED_EXPERIENCE",
} as const;
export type ClaimKind = (typeof CLAIM_KIND)[keyof typeof CLAIM_KIND];

export const AUTHORITY_SCOPE = {
  EMPLOYER_STATED: "EMPLOYER_STATED",
  REPORTED_EXPERIENCE: "REPORTED_EXPERIENCE",
  CANDIDATE_SPECIFIC_ANSWER: "CANDIDATE_SPECIFIC_ANSWER",
} as const;
export type AuthorityScope =
  (typeof AUTHORITY_SCOPE)[keyof typeof AUTHORITY_SCOPE];

export const IMPORTANCE = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type Importance = (typeof IMPORTANCE)[keyof typeof IMPORTANCE];

export type CandidatePriorityInput = {
  readonly claimId: string;
  readonly importance: Importance;
};

export const EVIDENCE_STANCE = {
  SUPPORTS: "SUPPORTS",
  CHALLENGES: "CHALLENGES",
  NEUTRAL: "NEUTRAL",
} as const;
export type EvidenceStance =
  (typeof EVIDENCE_STANCE)[keyof typeof EVIDENCE_STANCE];

export const EVIDENCE_PROVENANCE = {
  CASE_INPUT: "CASE_INPUT",
  CANDIDATE_REPORTED: "CANDIDATE_REPORTED",
  AGENT_REPORTED: "AGENT_REPORTED",
} as const;
export type EvidenceProvenance =
  (typeof EVIDENCE_PROVENANCE)[keyof typeof EVIDENCE_PROVENANCE];

export const EVIDENCE_VERIFICATION = {
  VERIFIED: "VERIFIED",
  INSUFFICIENT: "INSUFFICIENT",
  REJECTED: "REJECTED",
} as const;
export type EvidenceVerificationStatus =
  (typeof EVIDENCE_VERIFICATION)[keyof typeof EVIDENCE_VERIFICATION];

export const SPEAKER_ROLE = {
  RECRUITER: "RECRUITER",
  HIRING_MANAGER: "HIRING_MANAGER",
  TEAM_MEMBER: "TEAM_MEMBER",
  OTHER: "OTHER",
} as const;
export type SpeakerRole = (typeof SPEAKER_ROLE)[keyof typeof SPEAKER_ROLE];

export const CLAIM_STATUS = {
  UNVERIFIED: "UNVERIFIED",
  SUPPORTED: "SUPPORTED",
  MATERIAL_AMBIGUITY: "MATERIAL_AMBIGUITY",
  CHALLENGED: "CHALLENGED",
} as const;
export type ClaimStatus = (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];

export const CASE_ORIGIN = {
  DEMO_FIXTURE: "DEMO_FIXTURE",
  AGENT_IMPORTED: "AGENT_IMPORTED",
} as const;
export type CaseOrigin = (typeof CASE_ORIGIN)[keyof typeof CASE_ORIGIN];

export const SOURCE_KIND = {
  EMPLOYER_POSTING: "EMPLOYER_POSTING",
  REPORTED_EXPERIENCE: "REPORTED_EXPERIENCE",
  INTERVIEW: "INTERVIEW",
} as const;
export type SourceKind = (typeof SOURCE_KIND)[keyof typeof SOURCE_KIND];

export const RESEARCH_SOURCE_KIND = {
  EMPLOYER_OFFICIAL: "EMPLOYER_OFFICIAL",
  FIRST_PERSON_EXPERIENCE: "FIRST_PERSON_EXPERIENCE",
} as const;
export type ResearchSourceKind =
  (typeof RESEARCH_SOURCE_KIND)[keyof typeof RESEARCH_SOURCE_KIND];

export type ResearchEvidenceInput = {
  readonly claimId: string;
  readonly stance: EvidenceStance;
  readonly text: string;
  readonly sourceKind: ResearchSourceKind;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly verificationStatus?: EvidenceVerificationStatus;
};

export type Evidence = {
  readonly id: string;
  readonly scope: AuthorityScope;
  readonly stance: EvidenceStance;
  readonly text: string;
  readonly speakerRole?: SpeakerRole;
  readonly sourceKind?: SourceKind;
  readonly sourceLabel?: string;
  readonly synthetic?: boolean;
  readonly sourceUrl?: string;
  readonly provenance?: EvidenceProvenance;
  readonly verificationStatus?: EvidenceVerificationStatus;
  readonly roleMatch?: boolean;
  readonly locationMatch?: boolean;
  readonly recency?: number;
  readonly specificity?: number;
  readonly clusterId?: string;
  readonly publishedAt?: string;
  readonly retrievedAt?: string;
  readonly sourceTitle?: string;
  readonly sourceCategory?: string;
};

export type SourceClaim = {
  readonly id: string;
  readonly dimension: string;
  readonly employerStatement: string;
  readonly importance: Importance;
  readonly unresolvedVariable: string;
  readonly measurableForm: string;
  readonly evidence: readonly Evidence[];
  readonly kind?: ClaimKind;
  readonly importanceSetByCandidate?: boolean;
};

export type RoleCase = {
  readonly id: string;
  readonly company: string;
  readonly role: string;
  readonly sourceUrl?: string;
  readonly jobPostingUrl?: string;
  readonly companyWebsite?: string;
  readonly employerDomain?: string;
  readonly origin: CaseOrigin;
  readonly claims: readonly SourceClaim[];
};

export type DerivedClaim = {
  readonly id: string;
  readonly dimension: string;
  readonly employerStatement: string;
  readonly importance: Importance;
  readonly candidatePrioritySet: boolean;
  readonly kind: ClaimKind;
  readonly unresolvedVariable: string;
  readonly measurableForm: string;
  readonly evidence: readonly Evidence[];
  readonly unresolvedness: number;
  readonly tension: number;
  readonly probeEligible: boolean;
  readonly probePriority: number;
  readonly status: ClaimStatus;
};

export type DerivedCase = {
  readonly id: string;
  readonly company: string;
  readonly role: string;
  readonly origin: CaseOrigin;
  readonly claims: readonly DerivedClaim[];
  readonly topProbeId: string | null;
};

export type InterviewAnswerInput = {
  readonly claimId: string;
  readonly stance: EvidenceStance;
  readonly text: string;
  readonly speakerRole: SpeakerRole;
};

export type ImportedClaimInput = {
  readonly dimension: string;
  readonly employerStatement: string;
  readonly unresolvedVariable: string;
  readonly measurableForm: string;
};

export type ImportedRoleInput = {
  readonly company: string;
  readonly role: string;
  readonly sourceUrl?: string;
  readonly jobPostingUrl?: string;
  readonly companyWebsite?: string;
  readonly employerDomain?: string;
  readonly claims: readonly ImportedClaimInput[];
};
