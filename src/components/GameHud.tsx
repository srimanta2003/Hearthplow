import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Volume2, VolumeX, Wrench } from 'lucide-react';
import { getUpgradeCost, HudSnapshot, UPGRADE_SPECS } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onOpenWorkshop: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GameHud({ hud, onOpenWorkshop, onTogglePause, onToggleMute }: GameHudProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Keyboard shortcut 'H' to collapse/expand bottom dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat && hud.phase === 'playing') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase]);

  const affordableCount = UPGRADE_SPECS.reduce((acc, spec) => {
    const lvl = hud.upgrades[spec.key];
    if (lvl >= spec.maxLevel) return acc;
    return hud.coins >= getUpgradeCost(spec, lvl) ? acc + 1 : acc;
  }, 0);

  const progressRatio = Math.min(100, Math.round((hud.clearedPercent / Math.max(1, hud.targetPercent)) * 100));
  const lowTime = hud.timeRemaining <= 15;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Top Perimeter Status Clusters */}
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        {/* Top-Left: Day Shift, Cleared Progress & Daylight Clock */}
        <div className="bg-[#121e2c]/92 border border-[#d6e8f8]/18 rounded-xl px-4 py-3 min-w-[232px] max-w-[290px] shadow-md shadow-black/25">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div className="flex items-center gap-1.5 text-xs text-[#9db4cc] truncate">
              <span className="font-semibold text-[#f4f8fc]">Day {hud.day}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{hud.dayTitle}</span>
            </div>
            <span
              className={`font-mono text-sm font-semibold tabular-nums shrink-0 ${
                lowTime ? 'text-[#f87171]' : 'text-[#f4f8fc]'
              }`}
            >
              {formatClock(hud.timeRemaining)}
            </span>
          </div>

          {/* Snow Clear Progress Bar */}
          <div className="w-full h-2 rounded-sm bg-[#223449] overflow-hidden mb-1.5">
            <div
              className="h-full bg-[#38bdf8] transition-transform duration-150 origin-left"
              style={{ transform: `scaleX(${Math.max(0.01, progressRatio / 100)})` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#9db4cc] font-mono tabular-nums">
            <span>
              Cleared <strong className="text-[#f4f8fc]">{hud.clearedPercent}%</strong> / {hud.targetPercent}%
            </span>
            <span>
              Crates {hud.cratesFound}/{hud.cratesTotal}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-[#d6e8f8]/12 flex items-center justify-between gap-2 text-[11px] text-[#9db4cc]">
            <span className="truncate">
              {hud.weatherLabel}
              {hud.isGusting && <span className="text-[#f59e0b]"> · Gust</span>}
            </span>
            <span
              className={`font-mono tabular-nums shrink-0 ${
                hud.visibilityPercent <= 45 ? 'text-[#fbbf24]' : 'text-[#b7cce2]'
              }`}
            >
              Vis {hud.visibilityPercent}%
            </span>
          </div>
        </div>

        {/* Top-Right: Coins, Score & Live Combo Multiplier */}
        <div className="bg-[#121e2c]/92 border border-[#d6e8f8]/18 rounded-xl px-4 py-3 min-w-[200px] shadow-md shadow-black/25 text-right">
          <div className="flex items-baseline justify-end gap-4">
            <div>
              <div className="text-[11px] text-[#9db4cc]">Coins</div>
              <div className="font-mono text-lg font-bold text-[#f59e0b] tabular-nums leading-tight">
                {hud.coins.toLocaleString()}
              </div>
            </div>
            <div className="h-7 w-px bg-[#d6e8f8]/15" />
            <div>
              <div className="text-[11px] text-[#9db4cc]">Score</div>
              <div className="font-mono text-lg font-bold text-[#f4f8fc] tabular-nums leading-tight">
                {hud.score.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Combo Streak Bar */}
          <div className="mt-2 pt-2 border-t border-[#d6e8f8]/12">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#9db4cc]">Combo</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  hud.comboMultiplier >= 5
                    ? 'text-[#f59e0b]'
                    : hud.comboMultiplier >= 2
                      ? 'text-[#7dd3fc]'
                      : 'text-[#8ea6bf]'
                }`}
              >
                x{hud.comboMultiplier}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-sm bg-[#223449] overflow-hidden">
              <div
                className={`h-full origin-left ${hud.comboMultiplier >= 5 ? 'bg-[#f59e0b]' : 'bg-[#7dd3fc]'}`}
                style={{ transform: `scaleX(${hud.comboTimerRatio})` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transient Non-Blocking Event Callout (Combo Tier / Cocoa Crate / Snowman) */}
      {hud.floatingEvent && (
        <div
          key={hud.floatingEvent.id}
          className="fixed top-24 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-[#121e2c]/90 border border-[#f59e0b]/40 shadow-md"
        >
          <span
            className={`font-display text-sm font-bold tracking-tight ${
              hud.floatingEvent.tone === 'gold'
                ? 'text-[#fbbf24]'
                : hud.floatingEvent.tone === 'combo'
                  ? 'text-[#7dd3fc]'
                  : 'text-[#f4f8fc]'
            }`}
          >
            {hud.floatingEvent.text}
          </span>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center transition-transform duration-200 ease-out"
        style={{ transform: `translate(-50%, ${dockCollapsed ? 'calc(100% - 26px)' : '0px'})` }}
      >
        {/* Collapse Toggle Handle */}
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          aria-label={dockCollapsed ? 'Show controls dock' : 'Hide controls dock'}
          className="pointer-events-auto inline-flex items-center gap-1 px-3 py-1 rounded-t-lg bg-[#121e2c]/92 border border-b-0 border-[#d6e8f8]/18 text-[11px] font-medium text-[#b7cce2] hover:text-[#f4f8fc] cursor-pointer whitespace-nowrap"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Controls' : 'Hide'}</span>
        </button>

        {/* Horizontal Dock Body */}
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-4 px-4 py-2.5 rounded-xl bg-[#121e2c]/94 border border-[#d6e8f8]/18 shadow-lg shadow-black/35 max-w-[94vw]">
          {/* Turbo Boiler Meter */}
          <div className="flex items-center gap-2.5 min-w-[126px] sm:min-w-[154px]">
            <span className="text-xs font-medium text-[#b7cce2] whitespace-nowrap shrink-0">Turbo</span>
            <div className="flex-1 h-2.5 rounded-sm bg-[#223449] overflow-hidden">
              <div
                className={`h-full origin-left ${hud.isBoosting ? 'bg-[#f97316]' : 'bg-[#f59e0b]'}`}
                style={{ transform: `scaleX(${Math.max(0.02, hud.turboRatio)})` }}
              />
            </div>
            <span className="text-[11px] font-mono text-[#9db4cc] hidden sm:inline whitespace-nowrap">Space</span>
          </div>

          <div className="h-5 w-px bg-[#d6e8f8]/15 shrink-0" />

          {/* Workshop Action */}
          <button
            type="button"
            onClick={onOpenWorkshop}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1d3046] hover:bg-[#27405d] border border-[#d6e8f8]/18 text-xs font-semibold text-[#f4f8fc] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>
              Workshop{affordableCount > 0 ? ` (${affordableCount})` : ''}
            </span>
          </button>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#18283a] hover:bg-[#22374f] border border-[#d6e8f8]/15 text-xs font-medium text-[#d6e5f4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-3.5 h-3.5 text-[#9db4cc]" /> : <Volume2 className="w-3.5 h-3.5 text-[#f59e0b]" />}
            <span className="hidden sm:inline">{hud.muted ? 'Muted' : 'Audio'}</span>
          </button>

          {/* Pause Toggle */}
          <button
            type="button"
            onClick={onTogglePause}
            aria-label="Pause shift"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#18283a] hover:bg-[#22374f] border border-[#d6e8f8]/15 text-xs font-medium text-[#d6e5f4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>
    </div>
  );
}
