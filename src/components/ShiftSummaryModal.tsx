import { getDayConfig, HudSnapshot } from '../game/types';

interface ShiftSummaryModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onOpenWorkshop: () => void;
  onNextDay: () => void;
  onRetryDay: () => void;
}

export function ShiftSummaryModal({
  hud,
  onResume,
  onOpenWorkshop,
  onNextDay,
  onRetryDay,
}: ShiftSummaryModalProps) {
  const isPause = hud.phase === 'paused';
  const isVictory = hud.phase === 'victory';
  const nextForecast = getDayConfig(hud.day + 1);

  const heading = isPause
    ? 'Shift Paused'
    : isVictory
      ? `Day ${hud.day} Village Cleared`
      : `Day ${hud.day} Sunset Reached`;

  const subcopy = isPause
    ? `${hud.dayTitle} · ${hud.weatherLabel} (Visibility ${hud.visibilityPercent}%).`
    : isVictory
      ? `Next forecast: Day ${nextForecast.day} — ${nextForecast.weather.label} (${nextForecast.weather.baseVisibilityPercent}% visibility).`
      : 'Evening settled before the target was reached. Your earned coins are safely banked for upgrades.';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#0b131e]/72">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-title"
        className="w-full max-w-md rounded-2xl bg-[#132030] border border-[#d6e8f8]/20 shadow-2xl shadow-black/50 p-6"
      >
        <div className="mb-5">
          <p className="text-xs font-medium text-[#f59e0b] mb-1">
            Day {hud.day} · {hud.dayTitle} · {hud.weatherLabel}
          </p>
          <h2 id="summary-title" className="font-display text-2xl font-bold text-[#f4f8fc] tracking-tight">
            {heading}
          </h2>
          <p className="text-sm text-[#a8bfd4] mt-1.5 leading-relaxed">{subcopy}</p>
        </div>

        {/* Clean Tabular Shift Metrics */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 py-4 border-y border-[#d6e8f8]/12 mb-6">
          <div>
            <div className="text-xs text-[#9db4cc]">Village Cleared</div>
            <div className="font-mono text-xl font-bold text-[#f4f8fc] tabular-nums mt-0.5">
              {hud.clearedPercent}% <span className="text-xs font-normal text-[#8ea6bf]">/ {hud.targetPercent}%</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#9db4cc]">Shift Coins</div>
            <div className="font-mono text-xl font-bold text-[#f59e0b] tabular-nums mt-0.5">
              +{hud.shiftCoins.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#9db4cc]">Peak Combo</div>
            <div className="font-mono text-xl font-bold text-[#7dd3fc] tabular-nums mt-0.5">x{hud.maxCombo}</div>
          </div>
          <div>
            <div className="text-xs text-[#9db4cc]">Best Score</div>
            <div className="font-mono text-xl font-bold text-[#f4f8fc] tabular-nums mt-0.5">
              {hud.highScore.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="flex flex-col gap-2.5">
          {isPause && (
            <>
              <button
                type="button"
                onClick={onResume}
                className="w-full py-3 px-4 rounded-lg bg-[#d93829] hover:bg-[#e54435] text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                Resume Shift
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenWorkshop}
                  className="py-2.5 px-4 rounded-lg bg-[#1d3046] hover:bg-[#27405d] border border-[#d6e8f8]/15 text-sm font-medium text-[#f4f8fc] transition-colors cursor-pointer"
                >
                  Open Workshop
                </button>
                <button
                  type="button"
                  onClick={onRetryDay}
                  className="py-2.5 px-4 rounded-lg bg-[#18283a] hover:bg-[#22374f] border border-[#d6e8f8]/15 text-sm font-medium text-[#d4e3f2] transition-colors cursor-pointer"
                >
                  Restart Day
                </button>
              </div>
            </>
          )}

          {isVictory && (
            <>
              <button
                type="button"
                onClick={onNextDay}
                className="w-full py-3 px-4 rounded-lg bg-[#d93829] hover:bg-[#e54435] text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                Start Day {hud.day + 1}
              </button>
              <button
                type="button"
                onClick={onOpenWorkshop}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1d3046] hover:bg-[#27405d] border border-[#d6e8f8]/15 text-sm font-semibold text-[#f59e0b] transition-colors cursor-pointer"
              >
                Open Workshop ({hud.coins.toLocaleString()} Coins)
              </button>
            </>
          )}

          {!isPause && !isVictory && (
            <>
              <button
                type="button"
                onClick={onOpenWorkshop}
                className="w-full py-3 px-4 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-sm font-semibold text-[#111b27] transition-colors cursor-pointer"
              >
                Upgrade Truck ({hud.coins.toLocaleString()} Coins)
              </button>
              <button
                type="button"
                onClick={onRetryDay}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1d3046] hover:bg-[#27405d] border border-[#d6e8f8]/15 text-sm font-semibold text-[#f4f8fc] transition-colors cursor-pointer"
              >
                Retry Day {hud.day}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
