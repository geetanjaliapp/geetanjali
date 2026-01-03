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
  MiniPlayerSinglePlay,
  MiniPlayerAutoAdvance,
  MiniPlayerModeSelector,
  MiniPlayerStandard,
} from "./MiniPlayer/index";
