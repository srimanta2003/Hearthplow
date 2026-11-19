import { Volume2, VolumeX } from 'lucide-react';
import { getDayConfig, HudSnapshot } from '../game/types';

interface TitleOverlayProps {
  hud: HudSnapshot;
  onStart: () => void;
  onSelectDay: (day: number) => void;
  onToggleMute: () => void;
}

const DAY_CHOICES = [1, 2, 3, 4].map((d) => getDayConfig(d));

export function TitleOverlay({ hud, onStart, onSelectDay, onToggleMute }: TitleOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Subtle left-side contrast scrim so typography reads crisply over snowy daylight */}
      <div
        className="absolute inset-y-0 left-0 w-full md:w-[58%] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(13, 21, 32, 0.84) 0%, rgba(13, 21, 32, 0.56) 58%, rgba(13, 21, 32, 0) 100%)',
        }}
      />

      {/* Top corner audio control */}
      <div className="relative z-10 flex items-center justify-end p-6">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#132030]/90 border border-[#d6e8f8]/20 text-sm font-medium text-[#e6f0fa] hover:bg-[#1c2e44] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hud.muted ? <VolumeX className="w-4 h-4 text-[#9db4cc]" /> : <Volume2 className="w-4 h-4 text-[#f59e0b]" />}
          <span>{hud.muted ? 'Sound Off' : 'Sound On'}</span>
        </button>
      </div>

      {/* Main Title Lockup over calm negative space */}
      <div className="relative z-10 px-8 md:px-14 max-w-xl my-auto">
        {/* Bespoke Inline SVG Brand Emblem Lockup */}
        <div className="mb-5">
          <svg
            viewBox="0 0 420 112"
            className="w-[310px] sm:w-[390px] h-auto overflow-visible"
            role="img"
            aria-label="Hearthplow"
          >
            {/* Alpine mountain ridge + curved snowplow blade crest */}
            <g transform="translate(2, 6)">
              <path
                d="M6 52 L28 18 L46 42 L62 24 L82 52 Z"
                fill="#1d324a"
                stroke="#d6e8f8"
                strokeOpacity="0.45"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Snow caps */}
              <path d="M28 18 L21 30 L28 27 L34 31 Z" fill="#f4f8fc" />
              <path d="M62 24 L56 34 L62 31 L68 35 Z" fill="#f4f8fc" />
              {/* Warm red plow scoop curve */}
              <path
                d="M10 58 C30 50, 56 50, 82 58 L78 67 C54 60, 32 60, 14 67 Z"
                fill="#d93829"
              />
              {/* Amber hearth lantern diamond */}
              <polygon points="46,4 52,12 46,20 40,12" fill="#f59e0b" />
            </g>

            {/* Wordmark */}
            <text
              x="98"
              y="58"
              fill="#f4f8fc"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="48"
              letterSpacing="-1.2"
            >
              HEARTHPLOW
            </text>
            <text
              x="100"
              y="84"
              fill="#b7cce2"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="500"
              fontSize="14.5"
              letterSpacing="0.4"
            >
              Cozy Alpine Snow-Plowing Village
            </text>
          </svg>
        </div>

        <p className="text-[15px] leading-relaxed text-[#d4e3f2] max-w-md mb-6">
          Clear Hearthstone Square before sunset, chain combo streaks through deep drifts, and brave shifting snow
          density and alpine fog across escalating storm days.
        </p>

        {/* Interactive Day & Weather Selector (live previews 3D fog & snow density) */}
        <div className="mb-6 max-w-md">
          <div className="flex items-center justify-between text-xs text-[#b7cce2] mb-2">
            <span>Starting Shift Weather</span>
            <span className="font-mono tabular-nums text-[#7dd3fc]">
              {hud.weatherLabel} · Vis {hud.visibilityPercent}%
            </span>
          </div>
          <div className="pointer-events-auto grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#101b29]/90 border border-[#d6e8f8]/15">
            {DAY_CHOICES.map((cfg) => {
              const active = hud.day === cfg.day;
              return (
                <button
                  key={cfg.day}
                  type="button"
                  onClick={() => onSelectDay(cfg.day)}
                  className={`px-2 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#223852] text-[#f4f8fc] shadow-sm'
                      : 'text-[#9db4cc] hover:text-[#e6f0fa] hover:bg-[#172638]'
                  }`}
                >
                  Day {cfg.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={onStart}
            className="pointer-events-auto px-7 py-3.5 rounded-lg bg-[#d93829] hover:bg-[#e54435] active:scale-[0.98] text-[#fffaf5] font-semibold text-base tracking-tight shadow-lg shadow-black/30 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            Start Day {hud.day}
          </button>

          {hud.highScore > 0 && (
            <div className="flex items-center gap-2.5 text-xs text-[#b8cde2] font-mono tabular-nums">
              <span>Best {hud.highScore.toLocaleString()}</span>
              <span aria-hidden="true">·</span>
              <span>{hud.coins.toLocaleString()} Coins Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Flat single control-hint footer line */}
      <div className="relative z-10 px-8 md:px-14 pb-6 pt-4">
        <p className="text-xs text-[#b7cce2]/90 tracking-wide">
          WASD / Arrows Drive <span className="mx-1.5 opacity-50">·</span> Drag Mouse to Steer{' '}
          <span className="mx-1.5 opacity-50">·</span> Space Boost <span className="mx-1.5 opacity-50">·</span> U
          Workshop <span className="mx-1.5 opacity-50">·</span> Esc Pause
        </p>
      </div>
    </div>
  );
}
