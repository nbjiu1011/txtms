/**
 * Display — things that show state (chips, tags, panels, tables, empty states, toast).
 * Controls the user operates live in `shared/common`, which may use this layer (never the reverse).
 * The rich text editor/viewer is a separate entry (`@/shared/ui/rich-text`) so Quill's CSS is not
 * pulled into every screen.
 */
export { Icon, ICON_NAMES, TypeGlyph, EmptyArt } from "./icons/icons";
export type { IconName, IconProps, TypeGlyphName } from "./icons/icons";
export { Tag } from "./tag";
export type { TagProps, TagVariant } from "./tag";
export { StatusChip, TypeChip, RoundBadge } from "./chips";
export type { StatusChipProps, StatusTone, TypeChipProps, TypeTone } from "./chips";
export { Avatar, AvatarStack, avatarInitials } from "./avatar";
export type { AvatarProps, AvatarStackProps } from "./avatar";
export {
  Banner,
  Bar,
  KeyValueList,
  LockBar,
  Panel,
  PanelBody,
  PanelHeader,
  ReadOnlyBox,
  SaveIndicator,
} from "./surfaces";
export type { BannerProps, BannerTone, SaveState } from "./surfaces";
export { Empty, Kpi, KpiGrid, ListItem, ProgressTrack, Table, tableClasses } from "./data-display";
export type { EmptyProps, KpiProps, ListItemProps, TrackStep } from "./data-display";
export { ErrorDetails } from "./error-details";
export type { ErrorDetailsProps } from "./error-details";
export { BrandMark, Page, PageHeader } from "./layout";
export { Toaster, toast, useToastStore, TOAST_DURATION_MS } from "./toast";
