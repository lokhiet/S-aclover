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

export const authorsList: AuthorData[] = [
  {
    id: "thy-nguyen",
    name: "Thy Nguyễn",
    avatarEmoji: "🌸",
    bio: "Tác giả của nhân vật Bạc Đình Kiêu với những kịch bản gương vỡ lại lành, truy thê đầy cảm xúc.",
    fb: {
      name: "Nhà nhỏ của Thy",
      url: "https://www.facebook.com/profile.php?id=61573951613374"
    },
    discords: [
      {
        name: "Khu tự trị của Thy",
        url: "https://discord.com/channels/1488591016431714377/1488702915169357895"
      }
    ],
    themeColor: "from-emerald-500 to-teal-500"
  }
];
