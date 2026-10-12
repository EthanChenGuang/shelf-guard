import React from 'react';
import { X } from 'lucide-react';
import { DetectedAnomaly, Language, ShelfCalibration } from '../types';
import { I18N } from '../lib/constants';
import { coverViewportStyle } from '../lib/frameBox';

const TYPE_STYLES: Record<DetectedAnomaly['type'], { box: string; badge: string }> = {
  MISSING: { box: 'border-2 border-sg-danger', badge: 'text-sg-danger' },
  MOVED: { box: 'border-2 border-sg-warning', badge: 'text-sg-warning' },
  ADDED: { box: 'border-2 border-sg-scan', badge: 'text-sg-scan' },
};

const LABEL_HALO = { textShadow: '0 0 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)' };

export interface InspectShelfCanvasProps {
  imageUrl: string;
  baseline: ShelfCalibration;
  activeAnomalies: DetectedAnomaly[];
  showArLayers: boolean;
  lang: Language;
  onDismissAnomaly?: (id: string, e: React.MouseEvent) => void;
  layout?: 'fill' | 'cover';
  coverViewport?: { width: number; height: number };
  className?: string;
  showingBaseline?: boolean;
}

export const InspectShelfCanvas: React.FC<InspectShelfCanvasProps> = ({
  imageUrl,
  baseline,
  activeAnomalies,
  showArLayers,
  lang,
  onDismissAnomaly,
  layout = 'fill',
  coverViewport,
  className = '',
  showingBaseline = false,
}) => {
  const t = I18N[lang];
  const badgeLabels: Record<DetectedAnomaly['type'], string> = {
    MISSING: t.missingBadgeShort,
    MOVED: t.movedBadgeShort,
    ADDED: t.addedBadgeShort,
  };

  const layoutStyle =
    layout === 'cover' && coverViewport
      ? coverViewportStyle(baseline.imageDimensions, coverViewport)
      : { width: '100%', height: '100%' };

  return (
    <div
      className={`relative overflow-hidden bg-slate-900 select-none [-webkit-touch-callout:none] ${className}`}
      style={layoutStyle}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="inspect-shelf-canvas"
      data-layout={layout}
      data-showing-baseline={showingBaseline ? 'true' : 'false'}
    >
      <img
        src={imageUrl}
        alt="Shelf Inspection Display"
        draggable={false}
        data-testid="inspect-comparison-image"
        className="w-full h-full object-fill pointer-events-none"
      />

      {showArLayers &&
        activeAnomalies.map((item) => {
          const styles = TYPE_STYLES[item.type];
          const top = item.boundingBox.y * 100;
          const left = item.boundingBox.x * 100;
          const width = item.boundingBox.width * 100;
          const height = item.boundingBox.height * 100;

          return (
            <div
              key={item.id}
              className={`ar-box absolute rounded-xl transition-all duration-200 ${styles.box}`}
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onDismissAnomaly ? (e) => onDismissAnomaly(item.id, e) : undefined}
            >
              <div
                className={`absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap font-mono-numbers text-[11px] font-bold ${styles.badge}`}
                style={LABEL_HALO}
                title={item.title}
              >
                <span>
                  {`${badgeLabels[item.type]} · ${(
                    ((item.score ?? item.confidence ?? 0) * 100)
                  ).toFixed(0)}%`}
                </span>
                {onDismissAnomaly && (
                  <button
                    type="button"
                    onClick={(e) => onDismissAnomaly(item.id, e)}
                    className="hover:opacity-80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
};
