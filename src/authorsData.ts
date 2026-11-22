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
    id: "bac-si-ki-cuc",
    name: "Bác Sĩ Kì Cục",
    avatarEmoji: "🩺",
    bio: "Bác sĩ chữa lành tâm hồn với những câu lệnh độc đáo và đầy bất ngờ.",
    fb: {
      name: "Bác Sĩ Kì Cục",
      url: "https://www.facebook.com/profile.php?id=61590752636576"
    },
    discords: [
      {
        name: "love love",
        url: "https://discord.com/channels/1471102126909554731/1493676437780172830"
      },
      {
        name: "Bệnh viện tâm thần Cố thị",
        url: "https://discord.com/channels/1126502177775566929/1501630298302189621"
      }
    ],
    web: {
      name: "Viện Tâm Thần Cố Thị - KHU BỆNH VIỆN",
      url: "https://bacsi-kycuc.github.io/BenhVienCoThi/?fbclid=IwY2xjawSblFZleHRuA2FlbQIxMABicmlkETF4R0h3VktwcGZWWTh4ejVDc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHtLA-FOCa2KD59J6m7TgbkMS5pQ46deEwQQtMubOU690xZ3OZiFsBiIk59TM_aem_sKkjzXXZKDcKvo73y2LsMQ"
    },
    other: {
      name: "Viện Tâm Thần Cố Thị - TRẠI CAI NGHIỆN",
      url: "https://bacsi-kycuc.github.io/TraiCaiNghienCoThi/"
    },
    themeColor: "from-emerald-500 to-teal-500"
  },
  {
    id: "tinh-am",
    name: "Tinh Âm",
    avatarEmoji: "🎵",
    bio: "Góc nhỏ chia sẻ tam quan độc đáo và những ý tưởng sáng tạo tuyệt vời.",
    fb: {
      name: "Góc Tam Quan Lệch Của Tinh Âm",
      url: "https://www.facebook.com/profile.php?id=61584075151050&locale=vi_VN"
    },
    discords: [
      {
        name: "🌸Vườn Nhỏ Dưới Tán Anh Đào🌸",
        url: "https://discord.gg/DchJQH2z"
      }
    ],
    themeColor: "from-pink-500 to-rose-500"
  },
  {
    id: "may-do-nhip-tim-mc",
    name: "Máy đo nhịp tim MC",
    avatarEmoji: "💓",
    bio: "Đo lường từng nhịp đập cảm xúc qua những kịch bản hấp dẫn.",
    fb: {
      name: "Máy đo nhịp tim MC",
      url: "https://www.facebook.com/profile.php?id=61584680827026&locale=vi_VN"
    },
    web: {
      name: "Máy đo nhịp tim MC",
      url: "https://may-do-nhip-tim-mc.github.io/harem/?fbclid=IwY2xjawSY-dVleHRuA2FlbQIxMABicmlkETFLYlY4a3VCdXA2RmRJVjFQc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHr5jSUHbL7DzJn4voMJ79D9Q5N0r8RSxPZHY0A0WuD5NLMCFQCGnWTrNIfK7_aem_yQxTA1t3XWzd7Zwuzi2XxA"
    },
    themeColor: "from-red-500 to-pink-500"
  },
  {
    id: "meo-churri-mun",
    name: "Méo / Churri Mun",
    avatarEmoji: "🐱",
    bio: "Thánh đường trú ẩn lý thú dành cho hội yêu mèo và những tâm hồn tự do.",
    fb: {
      name: "Tiệm coffee bự của méo",
      url: "https://www.facebook.com/profile.php?id=61582199260408#"
    },
    discords: [
      {
        name: "Vô Danh Điện 🦋",
        url: "https://discord.gg/8xgXG3J5a"
      }
    ],
    web: {
      name: "The Little Sanctuary - Thánh đường nhỏ bé",
      url: "https://ai.studio/apps/9f19328f-a2a9-46b9-8802-cd6c4c050dbf"
    },
    themeColor: "from-violet-500 to-indigo-500"
  },
  {
    id: "joylibees",
    name: "Joylibees",
    fullName: "Joylibees (ăn gà luộc không / thèm gà rán)",
    avatarEmoji: "🍗",
    bio: "Nơi tôn vinh ẩm thực và những kịch bản chọn lựa đầy kịch tính.",
    fb: {
      name: "Ăn Gà Luộc Không",
      url: "https://www.facebook.com/profile.php?id=61586353350114&locale=vi_VN"
    },
    discords: [
      {
        name: "love love",
        url: "https://discord.com/channels/1471102126909554731/1483818648039719012"
      }
    ],
    web: {
      name: "Menu Chọn Chồng",
      url: "https://joylibees-menu-ch-n-ch-ng-196632396214.asia-southeast1.run.app/?fbclid=IwY2xjawSY_EdicmlkETFLYlY4a3VCdXA2RmRJVjFQc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHl0Y5qC_Bxws1DeUStJHi5eYrKKS_ic8JN8PZxBr5YQs_qq-4MFZeL_M4g-T"
    },
    themeColor: "from-amber-500 to-orange-500"
  },
  {
    id: "mong-hon-tuong-luyen",
    name: "Mộng hồn tương luyến liễu hoa âm",
    avatarEmoji: "🌺",
    bio: "Gieo mầm những giấc mơ đẹp đẽ và các giai điệu tâm hồn say đắm.",
    fb: {
      name: "Mộng hồn tương luyến liễu hoa âm",
      url: "https://www.facebook.com/profile.php?id=61576199620930#"
    },
    themeColor: "from-fuchsia-500 to-pink-500"
  },
  {
    id: "cua-hang-bup-be",
    name: "Cửa Hàng Búp Bê",
    avatarEmoji: "🧸",
    bio: "Không gian của những giấc mơ thơ thơ bé, búp bê tinh xảo và câu chuyện cổ tích.",
    fb: {
      name: "Cửa Hàng Búp Bê",
      url: "https://www.facebook.com/profile.php?id=61584401920175#"
    },
    themeColor: "from-sky-400 to-indigo-500"
  },
  {
    id: "noi-cam-heo-phuong-tay",
    name: "Nồi cám heo của Phương Tây",
    avatarEmoji: "🍲",
    bio: "Yêu thích sự hỗn độn dễ thương và thế giới ảo tràn đầy màu sắc.",
    fb: {
      name: "Nồi cám heo của Phương Tây",
      url: "https://www.facebook.com/profile.php?id=61588896835656#"
    },
    discords: [
      {
        name: "🌸Vườn Nhỏ Dưới Tán Anh Đào🌸",
        url: "https://discord.gg/DchJQH2z"
      }
    ],
    themeColor: "from-yellow-500 to-amber-600"
  },
  {
    id: "komorebi",
    name: "Komorebi",
    avatarEmoji: "☀️",
    bio: "Những vạt nắng len lỏi qua kẽ lá, mang lại cảm giác ấm áp và bình yên vô tận.",
    fb: {
      name: "Những tia nắng của Komorebi",
      url: "https://www.facebook.com/komorebiharuko"
    },
    discords: [
      {
        name: "my little corner",
        url: "https://discord.com/channels/1471580356183326904/1471742606600962153"
      }
    ],
    themeColor: "from-lime-500 to-emerald-500"
  },
  {
    id: "may-tao-chong-yeu",
    name: "Máy tạo chồng yêu",
    avatarEmoji: "🤖",
    bio: "Thiết kế và mô phỏng hình mẫu lý tưởng cho riêng tâm hồn bạn.",
    fb: {
      name: "Máy tạo chồng yêu",
      url: "https://www.facebook.com/profile.php?id=61565680241178"
    },
    other: {
      name: "Tổng hợp link docs nhân vật",
      url: "https://drive.google.com/drive/folders/1aQUzVsQevy-ZUIDZs44P3q7DnoWrPAMy?fbclid=IwY2xjawSZAWJleHRuA2FlbQIxMABicmlkETFLYlY4a3VCdXA2RmRJVjFQc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHqDr8JtHvlzPRYheJmTCr-hHVLsvHnsa5U45bCoIFsAvKQUiRelfbusKsxs3_aem_gSRLiDw9tHPLszDGgsT_6w"
    },
    themeColor: "from-blue-500 to-rose-400"
  },
  {
    id: "toai-cuu-ky",
    name: "Toái Cửu Kỳ",
    avatarEmoji: "🧱",
    bio: "Tác giả của các kịch bản ngọt cưng chiều, bọc bảo bối dầy vò tâm can.",
    fb: {
      name: "Toái Cửu Kỳ",
      url: "https://www.facebook.com/khanngocky"
    },
    themeColor: "from-orange-500 to-amber-600"
  }
];
