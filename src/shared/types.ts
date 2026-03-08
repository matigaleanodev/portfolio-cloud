export type LambdaResponse = {
  statusCode: number;
  body: string;
};

export type LambdaEvent = {
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export type Subscriber = {
  email: string;
  createdAt: string;
};

export type EditorialKnowledgeLink = {
  label: string;
  url: string;
  icon?: string;
};

export type EditorialProjectEntry = {
  slug: string;
  title: string;
  excerpt: string;
  stack?: string[];
  links?: EditorialKnowledgeLink[];
  highlights?: string[];
  searchText?: string;
};

export type EditorialPostEntry = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags?: string[];
  canonicalUrl?: string;
  summary?: string;
  searchText?: string;
};

export type EditorialKnowledgeArtifact = {
  generatedAt: string;
  projects?: EditorialProjectEntry[];
  posts?: EditorialPostEntry[];
};

export type EditorialKnowledgeSource = {
  repository: string;
  artifactPath: string;
};

export type EditorialKnowledgeRelease = Pick<ReleaseManifest, "generatedAt" | "siteUrl">;

export type PublishedEditorialKnowledgeArtifact = {
  version: 1;
  generatedAt: string;
  source: EditorialKnowledgeSource;
  release?: EditorialKnowledgeRelease;
  contentHash: string;
  knowledge: EditorialKnowledgeArtifact;
};

export type OgGenerationInput = {
  slug: string;
  title: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

export type NotifyPostInput = {
  title: string;
  url: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

export type ReleasePost = {
  slug: string;
  title: string;
  date: string;
  canonicalPath: string;
};

export type ReleaseManifest = {
  generatedAt: string;
  siteUrl: string;
  content: {
    posts: ReleasePost[];
  };
};

export type GenerateOgEvent = Partial<OgGenerationInput>;

export type NotifyPostEvent = Partial<NotifyPostInput>;

export type ProcessReleaseEvent = {
  manifest?: ReleaseManifest;
};

export type ProcessReleaseInvocation = ProcessReleaseEvent | ReleaseManifest;

export type PublishChatKnowledgeEvent = {
  artifact?: EditorialKnowledgeArtifact;
  release?: EditorialKnowledgeRelease;
  source?: Partial<EditorialKnowledgeSource>;
};

export type PublishChatKnowledgeInvocation =
  | PublishChatKnowledgeEvent
  | EditorialKnowledgeArtifact;
