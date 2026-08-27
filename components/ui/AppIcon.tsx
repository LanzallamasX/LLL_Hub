import type { SVGProps } from "react";

export type AppIconName =
  | "plus"
  | "search"
  | "filter"
  | "edit"
  | "check"
  | "close"
  | "archive"
  | "trash"
  | "arrowRight"
  | "shield"
  | "key"
  | "eye"
  | "eyeOff"
  | "policy"
  | "users"
  | "balance"
  | "absence"
  | "calendar"
  | "note"
  | "person"
  | "settings"
  | "info"
  | "mail"
  | "clock"
  | "bell"
  | "download"
  | "location";

export function AppIcon({
  name,
  className = "h-4 w-4",
  ...props
}: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  const content = (() => {
    switch (name) {
      case "plus":
        return <path d="M12 5v14M5 12h14" />;
      case "search":
        return (
          <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </>
        );
      case "filter":
        return (
          <>
            <path d="M4 6h16M7 12h10M10 18h4" />
          </>
        );
      case "edit":
        return (
          <>
            <path d="m14.5 5.5 4 4" />
            <path d="m4 20 3.8-.8L19 8a2 2 0 0 0-3-3L4.8 16.2 4 20Z" />
          </>
        );
      case "check":
        return <path d="m5 12 4 4L19 6" />;
      case "close":
        return <path d="M6 6l12 12M18 6 6 18" />;
      case "archive":
        return (
          <>
            <path d="M4 7h16v13H4z" />
            <path d="M3 4h18v3H3zM9 11h6" />
          </>
        );
      case "trash":
        return (
          <>
            <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
            <path d="M10 11v5M14 11v5" />
          </>
        );
      case "arrowRight":
        return <path d="M5 12h14m-5-5 5 5-5 5" />;
      case "shield":
        return (
          <>
            <path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z" />
            <path d="m9 12 2 2 4-4" />
          </>
        );
      case "key":
        return (
          <>
            <circle cx="8" cy="15" r="4" />
            <path d="m11 12 8-8M15 8l2 2M17 6l2 2" />
          </>
        );
      case "eye":
        return (
          <>
            <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" />
            <circle cx="12" cy="12" r="2.3" />
          </>
        );
      case "eyeOff":
        return (
          <>
            <path d="M3 12s3.2-5 9-5 9 5 9 5a15 15 0 0 1-2.1 2.4" />
            <path d="M9.8 16.7A10.5 10.5 0 0 1 3 12M4 4l16 16" />
          </>
        );
      case "policy":
        return (
          <>
            <path d="M7 3.5h8l4 4V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
            <path d="M15 3.5V8h4M9 13h6M9 17h4" />
          </>
        );
      case "users":
        return (
          <>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.5-3.6 2.4-5.5 5.5-5.5s5 1.9 5.5 5.5M15.5 6.2a2.7 2.7 0 0 1 0 5.3M17 13.8c2 .7 3.1 2.4 3.5 5.2" />
          </>
        );
      case "balance":
        return (
          <>
            <path d="M4 19v-5M10 19v-9M16 19V6M3 21h18" />
            <path d="m4 10 5-4 5 1 6-4" />
          </>
        );
      case "absence":
        return (
          <>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 9h17M8.5 14h7" />
          </>
        );
      case "calendar":
        return (
          <>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 9h17m-12 4h2m3 0h2m3 0h2m-8 4h2m3 0h2" />
          </>
        );
      case "note":
        return (
          <>
            <path d="M6 3.5h12a2 2 0 0 1 2 2V15l-5 5H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
            <path d="M15 20v-5h5M8 8h8M8 12h5" />
          </>
        );
      case "person":
        return (
          <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.5 20c.6-4.2 2.8-6.3 6.5-6.3s5.9 2.1 6.5 6.3" />
          </>
        );
      case "settings":
        return (
          <>
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </>
        );
      case "info":
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.2v.1" />
          </>
        );
      case "mail":
        return (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
          </>
        );
      case "clock":
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        );
      case "bell":
        return (
          <>
            <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 8H3c0-1 3-1 3-8Z" />
            <path d="M10 20h4" />
          </>
        );
      case "download":
        return (
          <>
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
            <path d="M5 19h14" />
          </>
        );
      case "location":
        return (
          <>
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </>
        );
    }
  })();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {content}
    </svg>
  );
}
