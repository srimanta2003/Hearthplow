import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { ShiftSummaryModal } from './components/ShiftSummaryModal';
import { TitleOverlay } from './components/TitleOverlay';
import { WorkshopModal } from './components/WorkshopModal';
import { HearthplowEngine } from './game/engine';
import { DEFAULT_UPGRADES, HudSnapshot, UpgradeKey } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  day: 1,
  dayTitle: 'Morning Dusting',
  weatherLabel: 'Crisp Flurries',
  visibilityPercent: 95,
  isGusting: false,
  clearedPercent: 0,
  targetPercent: 85,
  timeRemaining: 95,
  coins: 0,
  shiftCoins: 0,
  score: 0,
  highScore: 0,
  comboCount: 0,
  comboMultiplier: 1,
  comboTimerRatio: 0,
  turboRatio: 1,
  isBoosting: false,
  maxCombo: 1,
  cratesFound: 0,
  cratesTotal: 5,
  upgrades: { ...DEFAULT_UPGRADES },
  muted: false,
  floatingEvent: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HearthplowEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [webglError, setWebglError] = useState(false);

  // Mount Three.js engine once inside isolated container ref so HUD updates never re-create WebGL
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    try {
      const engine = new HearthplowEngine(mount, (snapshot) => {
        setHud(snapshot);
      });
      engineRef.current = engine;
      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(true);
      return undefined;
    }
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewGame();
  }, []);

  const handleSelectDay = useCallback((day: number) => {
    engineRef.current?.previewDay(day);
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleOpenWorkshop = useCallback(() => {
    engineRef.current?.openWorkshop();
  }, []);

  const handleCloseWorkshop = useCallback((advanceIfCleared: boolean) => {
    engineRef.current?.closeWorkshop(advanceIfCleared);
  }, []);

  const handleBuyUpgrade = useCallback((key: UpgradeKey) => {
    engineRef.current?.buyUpgrade(key);
  }, []);

  const handleNextDay = useCallback(() => {
    engineRef.current?.startNextDay();
  }, []);

  const handleRetryDay = useCallback(() => {
    engineRef.current?.retryCurrentDay();
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#111b27]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Graceful WebGL Fallback */}
      {webglError && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#111b27] text-center">
          <div className="max-w-md rounded-2xl bg-[#162436] border border-[#d6e8f8]/20 p-6">
            <h1 className="font-display text-2xl font-bold text-[#f4f8fc] mb-2">WebGL Unavailable</h1>
            <p className="text-sm text-[#a8bfd4]">
              Hearthplow requires WebGL 3D graphics to render the snowy village. Please enable hardware acceleration or
              open this page in a modern WebGL-capable browser.
            </p>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {!webglError && hud.phase === 'title' && (
        <TitleOverlay
          hud={hud}
          onStart={handleStart}
          onSelectDay={handleSelectDay}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Gameplay HUD */}
      {!webglError && hud.phase !== 'title' && (
        <GameHud
          hud={hud}
          onOpenWorkshop={handleOpenWorkshop}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Upgrade Workshop Modal */}
      {!webglError && hud.phase === 'workshop' && (
        <WorkshopModal hud={hud} onBuyUpgrade={handleBuyUpgrade} onClose={handleCloseWorkshop} />
      )}

      {/* Pause / Victory / Sunset Modal */}
      {!webglError && (hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'sunset') && (
        <ShiftSummaryModal
          hud={hud}
          onResume={handleTogglePause}
          onOpenWorkshop={handleOpenWorkshop}
          onNextDay={handleNextDay}
          onRetryDay={handleRetryDay}
        />
      )}
    </main>
  );
}
