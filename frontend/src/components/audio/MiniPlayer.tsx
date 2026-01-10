/**
 * MiniPlayer - Re-export from sub-components directory
 *
 * This file maintains backward compatibility for direct imports.
 * The component has been refactored into sub-components in ./MiniPlayer/
 *
 * @see ./MiniPlayer/index.tsx for the main component
 */

export {
  MiniPlayer,
  MiniPlayerPlayButton,
  MiniPlayerActive,
  MiniPlayerModeSelector,
  MiniPlayerStandard,
  // Legacy (deprecated - use MiniPlayerActive)
  MiniPlayerSinglePlay,
  MiniPlayerAutoAdvance,
  MiniPlayerStudyMode,
} from "./MiniPlayer/index";
