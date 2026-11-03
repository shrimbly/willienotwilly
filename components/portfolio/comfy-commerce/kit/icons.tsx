import type { ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

// Comfy Commerce's icon set, ported from web/src/lib/icons.tsx. The glyphs are
// ICONCINO (CC0), vendored in the product as web/src/assets/iconcino/*.svg and
// copied here path for path. The few the product keeps on lucide-react are
// re-exported at the bottom, as the product's module does.

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Glyph size in px (default 18, the product's ICON size). */
  size?: number | string;
};

/**
 * One ICONCINO glyph. The SVGs draw a 2px stroke in a 24px viewBox, so at the
 * product's 18px the stroke renders at exactly 1.5px, the product's rule
 * ("18px glyph, true 1.5px stroke, centred in a 24px box"). The stroke is
 * fixed, as the product's wrapper ignores a lucide strokeWidth. Decorative
 * by default (aria-hidden); the button or label around it carries the name.
 */
function iconcino(d: string | string[]) {
  const paths = typeof d === "string" ? [d] : d;
  return function Icon({ size = 18, className, ...rest }: IconProps) {
    return (
      <svg
        aria-hidden
        focusable="false"
        {...rest}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("shrink-0", className)}
      >
        {paths.map((p) => (
          <path key={p} d={p} />
        ))}
      </svg>
    );
  };
}

/** iconcino/activity.svg */
export const Activity = iconcino("M3.0156 6V10H6.99999M3.0156 10L6.34315 6.34315C9.46734 3.21895 14.5327 3.21895 17.6569 6.34315C20.781 9.46734 20.781 14.5327 17.6569 17.6569C14.5327 20.781 9.46734 20.781 6.34315 17.6569C5.55928 16.873 4.97209 15.9669 4.58158 15M12 9V13L15 14.5");
/** iconcino/arrow-left-right.svg */
export const ArrowLeftRight = iconcino("M6 13L3 16L6 19M3 16H11C12.6569 16 14 14.6569 14 13V12M10 12V11C10 9.34315 11.3431 8 13 8H21M18 5L21 8L18 11");
/** iconcino/arrow-left.svg */
export const ArrowLeft = iconcino("M11 18L5 12L11 6M5 12H19");
/** iconcino/arrow-right.svg */
export const ArrowRight = iconcino("M13 18L19 12L13 6M19 12H5");
/** iconcino/bookmark.svg */
export const Bookmark = iconcino("M6 6C6 4.89543 6.89543 4 8 4H16C17.1046 4 18 4.89543 18 6V18.7268C18 19.5969 16.9657 20.0519 16.3243 19.4639L12 15.5L7.67573 19.4639C7.03432 20.0519 6 19.5969 6 18.7268V6Z");
/** iconcino/check.svg */
export const Check = iconcino("M19.5 7L9 17.5L5 13.5");
/** iconcino/chevron-down.svg */
export const ChevronDown = iconcino("M6 9L11.2929 14.2929C11.6834 14.6834 12.3166 14.6834 12.7071 14.2929L18 9");
/** iconcino/chevron-left.svg */
export const ChevronLeft = iconcino("M15 18L9.70711 12.7071C9.31658 12.3166 9.31658 11.6834 9.70711 11.2929L15 6");
/** iconcino/chevron-right.svg */
export const ChevronRight = iconcino("M9 6L14.2929 11.2929C14.6834 11.6834 14.6834 12.3166 14.2929 12.7071L9 18");
/** iconcino/cloud.svg */
export const Cloud = iconcino("M1 14C1 16.6888 3.12231 18.8818 5.78311 18.9954L19.1996 18.9951C21.316 18.8911 23 17.1422 23 15C23 12.7909 21.2091 11 19 11L18.9293 11.001C18.4445 7.60822 15.5268 5 12 5C9.20316 5 6.78942 6.64027 5.66806 9.01084C3.06139 9.18169 1 11.3501 1 14Z");
/** iconcino/file-json.svg */
export const FileJson = iconcino("M8 7.99997L3 12L8 16M16 16L21 12L16 7.99997");
/** iconcino/flask-conical.svg */
export const FlaskConical = iconcino("M10 4V10L5.20285 16.8531C4.27496 18.1786 5.22327 20 6.84131 20H17.1587C18.7767 20 19.725 18.1786 18.7972 16.8531L14 10V4M10 4H14M10 4H8M14 4H16");
/** iconcino/hard-drive.svg */
export const HardDrive = iconcino("M6 12C6 9.77915 7.2066 7.84012 9 6.80269M18 11.8027C18 14.0235 16.7934 15.9626 15 17M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z");
/** iconcino/image-up.svg */
export const ImageUp = iconcino("M13 5H9.32843C8.79799 5 8.28929 5.21071 7.91421 5.58579L7.08579 6.41421C6.71071 6.78929 6.20201 7 5.67157 7H4C2.89543 7 2 7.89543 2 9L2 19C2 20.1046 2.89543 21 4 21H18C19.1046 21 20 20.1046 20 19V12M17 5H23M20 8V2M11 18C13.2091 18 15 16.2091 15 14C15 11.7909 13.2091 10 11 10C8.79086 10 7 11.7909 7 14C7 16.2091 8.79086 18 11 18Z");
/** iconcino/images.svg */
export const Images = iconcino("M4 17L7.58959 13.7694C8.38025 13.0578 9.58958 13.0896 10.3417 13.8417L11.5 15L15.0858 11.4142C15.8668 10.6332 17.1332 10.6332 17.9142 11.4142L20 13.5M11 9C11 9.55228 10.5523 10 10 10C9.44772 10 9 9.55228 9 9C9 8.44772 9.44772 8 10 8C10.5523 8 11 8.44772 11 9ZM6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z");
/** iconcino/key-round.svg */
export const KeyRound = iconcino("M12 13.5V16.5M8 9V6C8 3.79086 9.79086 2 12 2C14.2091 2 16 3.79086 16 6V9M7 21H17C18.1046 21 19 20.1046 19 19V11C19 9.89543 18.1046 9 17 9H7C5.89543 9 5 9.89543 5 11V19C5 20.1046 5.89543 21 7 21Z");
/** iconcino/link2.svg */
export const Link2 = iconcino("M10 8H7C4.79086 8 3 9.79086 3 12C3 14.2091 4.79086 16 7 16H10M14 8H17C19.2091 8 21 9.79086 21 12C21 14.2091 19.2091 16 17 16H14M9 12H15");
/** iconcino/list-checks.svg */
export const ListChecks = iconcino("M3 11H13M3 7H13M3 15H9M12.9315 15.3314L15.4929 17.8929C15.8834 18.2834 16.5166 18.2834 16.9071 17.8929L21.641 13.159");
/** iconcino/maximize2.svg */
export const Maximize2 = iconcino("M6 15V16C6 17.1046 6.89543 18 8 18H9M18 15V16C18 17.1046 17.1046 18 16 18H15M6 9V8C6 6.89543 6.89543 6 8 6H9M18 9V8C18 6.89543 17.1046 6 16 6H15");
/** iconcino/monitor-smartphone.svg */
export const MonitorSmartphone = iconcino("M3 19H21M6 17H18C19.1046 17 20 16.1046 20 15V8C20 6.89543 19.1046 6 18 6H6C4.89543 6 4 6.89543 4 8V15C4 16.1046 4.89543 17 6 17Z");
/** iconcino/monitor.svg */
export const Monitor = iconcino("M9 21H12M15 21H12M12 21V18M12 18H19C20.1046 18 21 17.1046 21 16V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V16C3 17.1046 3.89543 18 5 18H12Z");
/** iconcino/moon.svg */
export const Moon = iconcino("M19.5761 14.5765C18.7677 14.8513 17.9013 15.0003 17 15.0003C12.5817 15.0003 9 11.4186 9 7.00029C9 6.09888 9.14908 5.23229 9.42394 4.42383C6.26952 5.49607 4 8.48301 4 12C4 16.4183 7.58172 20 12 20C15.5169 20 18.5037 17.7307 19.5761 14.5765Z");
/** iconcino/move-right.svg */
export const MoveRight = iconcino("M16 17L21 12L16 7M21 12H3");
/** iconcino/notebook-pen.svg */
export const NotebookPen = iconcino("M19 9L13 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V9ZM13 3V8C13 8.55228 13.4477 9 14 9H19M9 13H15M9 17H15");
/** iconcino/octagon-x.svg */
export const OctagonX = iconcino("M12 16H12.01M12 8V12M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z");
/** iconcino/pencil.svg */
export const Pencil = iconcino("M15 7.50002L17.5 10M7.5 20L19.25 8.25002C19.9404 7.55967 19.9404 6.44038 19.25 5.75002C18.5596 5.05967 17.4404 5.05967 16.75 5.75002L5 17.5V20H7.5ZM7.5 20H15.8787C17.0503 20 18 19.0503 18 17.8787C18 17.3161 17.7765 16.7765 17.3787 16.3787L17 16M4.5 5.00002C6.5 3.00002 10 4.00002 10 6.00002C10 8.50006 4 8.50006 4 11.0001C4 11.876 4.53314 12.5256 5.22583 13.0001");
/** iconcino/play.svg */
export const Play = iconcino("M8 17.259V6.74104C8 5.96925 8.83721 5.48837 9.50387 5.87726L19.2596 11.5681C19.5904 11.761 19.5904 12.2389 19.2596 12.4319L9.50387 18.1227C8.83721 18.5116 8 18.0308 8 17.259Z");
/** iconcino/plus.svg */
export const Plus = iconcino("M12 6V18M18 12H6");
/** iconcino/refresh-cw.svg */
export const RefreshCw = iconcino("M20.9844 6V10H17M20.9844 10L17.6569 6.34315C14.5327 3.21895 9.46734 3.21895 6.34315 6.34315C3.21895 9.46734 3.21895 14.5327 6.34315 17.6569C9.46734 20.781 14.5327 20.781 17.6569 17.6569C18.4407 16.873 19.0279 15.9669 19.4184 15");
/** iconcino/rotate-ccw.svg */
export const RotateCcw = iconcino("M5 13C5 16.866 8.13401 20 12 20C15.866 20 19 16.866 19 13C19 9.13401 15.866 6 12 6H7M10 9L7 6L10 3");
/** iconcino/search.svg */
export const Search = iconcino("M13.3891 13.3891L19 19M9.5 15C12.5376 15 15 12.5376 15 9.5C15 6.46243 12.5376 4 9.5 4C6.46243 4 4 6.46243 4 9.5C4 12.5376 6.46243 15 9.5 15Z");
/** iconcino/shield-check.svg */
export const ShieldCheck = iconcino("M4 5L4.69699 5.07744C7.14576 5.34953 9.60878 4.70802 11.6137 3.27594L12 3L12.3863 3.27594C14.3912 4.70802 16.8542 5.34953 19.303 5.07744L20 5V12.0557C20 15.0859 18.288 17.856 15.5777 19.2111L12 21L8.42229 19.2111C5.71202 17.856 4 15.0859 4 12.0557V5Z");
/** iconcino/sparkles.svg */
export const Sparkles = iconcino("M12 3C12 7.97056 7.97056 12 3 12C7.97056 12 12 16.0294 12 21C12 16.0294 16.0294 12 21 12C16.0294 12 12 7.97056 12 3Z");
/** iconcino/store.svg */
export const Store = iconcino("M20 11.6211V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V11.6211M16 4L16.5 9.75C16.5 10.9926 17.5074 12 18.75 12C19.906 12 20.8584 11.1282 20.9856 10.0062C21.0048 9.83688 20.9782 9.66657 20.9352 9.50173L19.89 5.49516C19.6603 4.6145 18.8649 4 17.9548 4H6.04519C5.13506 4 4.3397 4.6145 4.10996 5.49516L3.06477 9.50173C3.02176 9.66657 2.99524 9.83688 3.01442 10.0062C3.14157 11.1282 4.09397 12 5.25 12C6.49264 12 7.5 10.9926 7.5 9.75M8 4L7.5 9.75C7.5 10.9926 8.50736 12 9.75 12C10.9926 12 12 10.9926 12 9.75M12 9.75C12 10.9926 13.0074 12 14.25 12C15.4926 12 16.5 10.9926 16.5 9.75M12 9.75V4");
/** iconcino/sun.svg */
export const Sun = iconcino("M5 12H3M12 5V3M21 12H19M12 21V19M16.9496 16.9498L18.3638 18.364M5.63602 5.63608L7.05023 7.05029M16.9496 7.0502L18.3638 5.63599M5.63602 18.3639L7.05023 16.9497M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z");
/** iconcino/trash2.svg */
export const Trash2 = iconcino("M6 5H18M9 5C10.5769 3.16026 13.4231 3.16026 15 5M9 20H15C16.1046 20 17 19.1046 17 18V9C17 8.44772 16.5523 8 16 8H8C7.44772 8 7 8.44772 7 9V18C7 19.1046 7.89543 20 9 20Z");
/** iconcino/triangle-alert.svg */
export const TriangleAlert = iconcino("M12 15H12.01M12 12V9M4.98207 19H19.0179C20.5615 19 21.5233 17.3256 20.7455 15.9923L13.7276 3.96153C12.9558 2.63852 11.0442 2.63852 10.2724 3.96153L3.25452 15.9923C2.47675 17.3256 3.43849 19 4.98207 19Z");
/** iconcino/undo2.svg */
export const Undo2 = iconcino("M14.5 20L15.3182 19.1429C18.9628 15.3247 16.2565 9 10.9781 9H6M10 5L6 9L10 13");
/** iconcino/unplug.svg */
export const Unplug = iconcino("M9 8H8C7.44772 8 7 8.44772 7 9V12.3333C7 12.7661 7.14036 13.1871 7.4 13.5333L9.6 16.4667C9.85964 16.8129 10 17.2339 10 17.6667V19C10 20.1046 10.8954 21 12 21C13.1046 21 14 20.1046 14 19V17.6667C14 17.2339 14.1404 16.8129 14.4 16.4667L16.6 13.5333C16.8596 13.1871 17 12.7661 17 12.3333V9C17 8.44772 16.5523 8 16 8H15M9 8V4M9 8H15M15 8V4");
/** iconcino/upload-cloud.svg */
export const UploadCloud = iconcino("M7 19L5.78311 18.9954C3.12231 18.8818 1 16.6888 1 14C1 11.3501 3.06139 9.18169 5.66806 9.01084C6.78942 6.64027 9.20316 5 12 5C15.5268 5 18.4445 7.60822 18.9293 11.001L19 11C21.2091 11 23 12.7909 23 15C23 17.1422 21.316 18.8911 19.1996 18.9951L17 19M12 20V12M9 15L12 12L15 15");
/** iconcino/wand2.svg */
export const Wand2 = iconcino(["M10 4C10 7.31371 7.31371 10 4 10C7.31371 10 10 12.6863 10 16C10 12.6863 12.6863 10 16 10C12.6863 10 10 7.31371 10 4Z", "M17.5 15C17.5 16.3807 16.3807 17.5 15 17.5C16.3807 17.5 17.5 18.6193 17.5 20C17.5 18.6193 18.6193 17.5 20 17.5C18.6193 17.5 17.5 16.3807 17.5 15Z"]);
/** iconcino/workflow.svg */
export const Workflow = iconcino("M9.99994 15.9999H16.9999M13.9999 19L16.9999 15.9999L13.9999 12.9999M10.9999 7.99994H20.9999M18 10.9999L20.9999 7.99994L18 5M4 16H4.01M5 8H5.01M8 8H8.01M7 16H7.01");
/** iconcino/x.svg */
export const X = iconcino("M6 6L18 18M18 6L6 18");

// No ICONCINO equivalent in the product either: it keeps these on lucide-react.
export { BookmarkCheck, BookmarkPlus, Box, Crop, Download, LayoutGrid, List, Rows3, Settings } from "lucide-react";

/** The product's lucide call-site props, for the lucide re-exports above (`<Download {...ICON} />`): 18px at a true 1.5px stroke. */
export const ICON = { size: 18, strokeWidth: 1.5, absoluteStrokeWidth: true } as const;

/** The product's 24px icon box: every 18px glyph sits centred in one. */
export function IconBox({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex size-6 shrink-0 items-center justify-center", className)}>{children}</span>;
}
