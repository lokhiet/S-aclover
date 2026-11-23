export interface AuthorLink {
  name: string;
  url: string;
}

export interface AuthorData {
  id: string;
  name: string;
  fullName?: string;
  avatarEmoji: string;
  bio: string;
  fb?: AuthorLink;
  discords?: AuthorLink[];
  web?: AuthorLink;
  other?: AuthorLink;
  themeColor: string; // Tailwind gradient border/accent classes
}

export const authorsList: AuthorData[] = [];
