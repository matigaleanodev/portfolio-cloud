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
