import React from 'react';
import { Globe, Link2 } from 'lucide-react';
import type { SocialPlatform } from '../../types';

interface SocialPlatformIconProps {
  platform: SocialPlatform;
  className?: string;
}

export function SocialPlatformIcon({
  platform,
  className = 'w-3.5 h-3.5 flex-shrink-0',
}: SocialPlatformIconProps) {
  switch (platform) {
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
            fill="#1877F2"
          />
        </svg>
      );
    case 'discord':
      return (
        <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
          <path
            d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.51-5c.89-.65,1.76-1.34,2.58-2a75.59,75.59,0,0,0,73,0c.83.68,1.69,1.37,2.58,2a68.43,68.43,0,0,1-10.51,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,48.12,123.7,25.28,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"
            fill="#5865F2"
          />
        </svg>
      );
    case 'google_ai_studio':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" className="stroke-[#39755D] dark:stroke-[#A3BDA8]" strokeWidth="1.8" />
          <path d="M12 5.8L13.7 10.3L18.2 12L13.7 13.7L12 18.2L10.3 13.7L5.8 12L10.3 10.3L12 5.8Z" fill="#2563EB" className="dark:fill-[#60A5FA]" />
        </svg>
      );
    case 'gemini':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2C12.3 7.3 16.7 11.7 22 12C16.7 12.3 12.3 16.7 12 22C11.7 16.7 7.3 12.3 2 12C7.3 11.7 11.7 7.3 12 2Z"
            fill="#4F46E5"
            className="dark:fill-[#818CF8]"
          />
        </svg>
      );
    case 'google_drive':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8.5 3.5H15.5L21.5 14H14.5L8.5 3.5Z" fill="#F59E0B" />
          <path d="M2.5 14L6 20.5H18L21.5 14H9.5L6 20.5" fill="#10B981" opacity="0.2" />
          <path d="M8.5 3.5L2.5 14L6 20.5L12 10L8.5 3.5Z" fill="#10B981" />
          <path d="M6 20.5H18L21.5 14H9.7L6 20.5Z" fill="#3B82F6" />
        </svg>
      );
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.11.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.16 0 1.56-.01 2.81-.01 3.2 0 .31.21.67.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52V6.94a4.84 4.84 0 0 1-1-.25Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" className="stroke-[#C13584] dark:stroke-[#E58AB8]" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" className="stroke-[#C13584] dark:stroke-[#E58AB8]" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" className="stroke-[#C13584] dark:stroke-[#E58AB8]" />
        </svg>
      );
    case 'x':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z"
            fill="#EF4444"
          />
        </svg>
      );
    case 'weibo':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9.6 18.8c-3.9 0-7-1.9-7-4.4 0-1.4.8-2.9 2.3-4.2 1.8-1.6 3.9-2.2 4.9-1.3.4.3.5.9.3 1.6-.1.3.2.4.4.3 1.4-.6 2.8-.7 3.7-.1.7.5.8 1.3.3 2.2-.1.2.1.4.3.4 1.3.4 2.2 1.3 2.2 2.4 0 1.8-3.3 3.1-7.4 3.1Zm-.4-5.7c-1.8.2-3.2 1.2-3 2.4.1 1.1 1.6 1.8 3.4 1.6 1.8-.2 3.1-1.3 3-2.4-.2-1.1-1.7-1.8-3.4-1.6Z"
            fill="#E6162D"
          />
          <path
            d="M15.4 6.5a5.5 5.5 0 0 1 5.1 5.1M15.4 9a3 3 0 0 1 2.6 2.6"
            stroke="#F59E0B"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'reddit':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#FF4500" />
          <path
            d="M17.2 12.2c0-.7-.6-1.2-1.3-1.2-.3 0-.7.1-.9.4-.9-.6-2.1-1-3.4-1l.6-2.8 2 .4a.9.9 0 1 0 .2-.7l-2.3-.5a.4.4 0 0 0-.5.3l-.7 3.2c-1.4 0-2.6.4-3.5 1a1.2 1.2 0 0 0-2.1.8c0 .5.3.9.7 1.1 0 .2-.1.4-.1.6 0 2.3 2.7 4.2 6 4.2s6-1.9 6-4.2c0-.2 0-.4-.1-.6.4-.2.4-.6.4-1Zm-7.6 1.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm4.8 3c-.6.6-1.6.8-2.4.8s-1.8-.2-2.4-.8a.3.3 0 0 1 .4-.4c.4.4 1.2.6 2 .6s1.6-.2 2-.6a.3.3 0 0 1 .4.4Zm-.1-1.4a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case 'website':
      return <Globe className={`${className} text-[#39755D] dark:text-[#A3BDA8]`} />;
    default:
      return <Link2 className={`${className} text-[#39755D] dark:text-[#A3BDA8]`} />;
  }
}
