import { X } from 'lucide-react';
import { getUpgradeCost, HudSnapshot, UPGRADE_SPECS, UpgradeKey } from '../game/types';

interface WorkshopModalProps {
  hud: HudSnapshot;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onClose: (advanceIfCleared: boolean) => void;
}

export function WorkshopModal({ hud, onBuyUpgrade, onClose }: WorkshopModalProps) {
  const shiftAlreadyCleared = hud.clearedPercent >= hud.targetPercent;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#0b131e]/75">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workshop-title"
        className="w-full max-w-2xl rounded-2xl bg-[#132030] border border-[#d6e8f8]/20 shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[#d6e8f8]/14">
          <div>
            <h2 id="workshop-title" className="font-display text-2xl font-bold text-[#f4f8fc] tracking-tight">
              Alpine Plow Workshop
            </h2>
            <p className="text-xs text-[#9db4cc] mt-0.5">
              Upgrades mount directly onto your snowplow truck · Press keys 1–5 to buy
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-[#9db4cc]">Available Coins</div>
              <div className="font-mono text-xl font-bold text-[#f59e0b] tabular-nums">
                {hud.coins.toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClose(false)}
              aria-label="Close workshop"
              className="p-2 rounded-lg bg-[#1c2e44] hover:bg-[#263d58] text-[#d4e3f2] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Upgrade Rows (Clean Hairline Dividers, Zero Nested Card Clutter) */}
        <div className="divide-y divide-[#d6e8f8]/10 px-6 max-h-[62vh] overflow-y-auto">
          {UPGRADE_SPECS.map((spec) => {
            const level = hud.upgrades[spec.key];
            const isMax = level >= spec.maxLevel;
            const cost = getUpgradeCost(spec, level);
            const canAfford = !isMax && hud.coins >= cost;

            return (
              <div key={spec.key} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-[#9db4cc]">[{spec.shortcut}]</span>
                    <h3 className="font-display text-base font-semibold text-[#f4f8fc]">{spec.name}</h3>
                    <span className="text-xs font-mono text-[#7dd3fc] tabular-nums">
                      {spec.formatStat(level)}
                      {!isMax && <span className="text-[#9db4cc]"> → {spec.formatStat(level + 1)}</span>}
                    </span>
                  </div>
                  <p className="text-xs text-[#a5bbd1] mt-1 leading-relaxed">{spec.description}</p>

                  {/* Segmented Level Progress Bar */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {Array.from({ length: spec.maxLevel }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 w-8 rounded-xs ${
                          idx < level ? 'bg-[#f59e0b]' : 'bg-[#25384f]'
                        }`}
                      />
                    ))}
                    <span className="text-[11px] font-mono text-[#9db4cc] ml-1.5 tabular-nums">
                      Lvl {level}/{spec.maxLevel}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyUpgrade(spec.key)}
                    className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap min-w-[116px] ${
                      isMax
                        ? 'bg-[#1c2c3f] text-[#7e96ae] cursor-default'
                        : canAfford
                          ? 'bg-[#f59e0b] hover:bg-[#fbbf24] text-[#111b27] cursor-pointer'
                          : 'bg-[#1b2b3d] text-[#7c93aa] cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'Maxed Out' : `${cost} Coins`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#d6e8f8]/14 bg-[#0f1a28]">
          {shiftAlreadyCleared ? (
            <button
              type="button"
              onClick={() => onClose(true)}
              className="px-5 py-2.5 rounded-lg bg-[#d93829] hover:bg-[#e54435] text-sm font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Start Day {hud.day + 1}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-5 py-2.5 rounded-lg bg-[#d93829] hover:bg-[#e54435] text-sm font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Return to Village
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
