export type Modality = 'document' | 'image' | 'table' | 'dataset' | 'scan';

export type TrustTier = 'verified' | 'uncertain' | 'compromised';

export type EpistemicVerdict = 'ANSWERABLE' | 'CONTESTED' | 'INSUFFICIENT_EVIDENCE';

export interface AdversarialFlag {
  code: string;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  excerpt?: string;
}

export interface EvidenceSource {
  id: string;
  title: string;
  filename: string;
  modality: Modality;
  mimeType: string;
  sha256: string;
  ingestedAt: string;
  originAuthority: string;
  textContent?: string;
  binaryDataUrl?: string;
  deterministicFlags: AdversarialFlag[];
}

export interface SourceAssessment {
  sourceId: string;
  reliabilityScore: number;
  trustTier: TrustTier;
  adversarialDetected: boolean;
  manipulationSignals: string[];
  rationale: string;
}

export interface ResolvedEntity {
  id: string;
  canonicalName: string;
  entityType:
    | 'Organization'
    | 'Person'
    | 'Shipment'
    | 'Batch'
    | 'Facility'
    | 'DocumentRef'
    | 'Account'
    | 'Event';
  aliases: string[];
  sourceIds: string[];
  resolutionNote: string;
}

export interface EvidenceClaim {
  id: string;
  sourceId: string;
  subjectEntityId: string;
  predicate: string;
  objectValue: string;
  timestamp?: string;
  excerpt: string;
  confidence: number;
  status: 'verified' | 'contested' | 'rejected';
}

export interface GraphConflict {
  id: string;
  title: string;
  severity: 'critical' | 'major' | 'minor';
  claimIds: string[];
  sourceIds: string[];
  modalitiesInvolved: Modality[];
  description: string;
  resolutionAssessment: string;
  winningClaimId?: string;
  unresolved: boolean;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: 'EXTRACTED_FROM' | 'REFERS_TO' | 'CORROBORATES' | 'CONTRADICTS' | 'SUPERSEDES';
  label: string;
}

export interface EvidenceGraph {
  builtAt: string;
  modelUsed: string;
  summary: string;
  sourceAssessments: SourceAssessment[];
  entities: ResolvedEntity[];
  claims: EvidenceClaim[];
  conflicts: GraphConflict[];
  edges: GraphEdge[];
  coverageGaps: string[];
}

export interface QueryCitation {
  claimId?: string;
  sourceId: string;
  quote: string;
  weight: 'primary' | 'contested' | 'discounted';
}

export interface QueryAnswer {
  id: string;
  question: string;
  askedAt: string;
  verdict: EpistemicVerdict;
  answer: string;
  truthSummary: string[];
  conflictSummary: string[];
  unreliableOrIgnored: string[];
  missingEvidence: string[];
  citations: QueryCitation[];
  confidence: number;
}

export interface CaseWorkspace {
  id: string;
  title: string;
  domain: string;
  description: string;
  isPreset: boolean;
  suggestedQuestions: string[];
  sources: EvidenceSource[];
  graph: EvidenceGraph | null;
  graphStale: boolean;
  queries: QueryAnswer[];
  updatedAt: string;
}
