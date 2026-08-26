export type SignatureToken = {
  key: string;
  label: string;
};

export type ContentSignature = {
  movieId: string;
  version: string;
  metadataHash: string;
  theme: {
    genres: SignatureToken[];
    keywords: SignatureToken[];
    forms: SignatureToken[];
  };
  creators: {
    director?: SignatureToken;
    writers: SignatureToken[];
    cast: SignatureToken[];
    companies: SignatureToken[];
  };
  context: {
    year?: number;
    countries: SignatureToken[];
    languages: SignatureToken[];
  };
  format: {
    runtime?: number;
    mediaType: "movie" | "tv";
  };
  relations: {
    collection?: SignatureToken;
  };
  completeness: number;
};

export const FACETS = ["theme", "creators", "context", "format", "relations"] as const;
export type Facet = (typeof FACETS)[number];
export type FacetWeights = Record<Facet, number>;

export type FacetSimilarity = {
  value: number | null;
  evidence: number;
  reasons: string[];
};

export type SignatureSimilarity = {
  facets: Record<Facet, FacetSimilarity>;
  overall: number;
  evidence: number;
  reasons: string[];
};

