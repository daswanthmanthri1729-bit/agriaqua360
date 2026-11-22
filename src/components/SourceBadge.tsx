import { useTranslation } from 'react-i18next';
import { Chip } from './Chip';
import type { IconName } from './Icon';

// Every number in Level 2 says where it came from; simulated data is never shown without this badge.
export type DataSource = 'sensor' | 'simulated' | 'manual' | 'api' | 'ai_estimate' | 'lab' | 'model';
const LOOK: Record<DataSource, { icon: IconName; tone: 'normal' | 'ai' | 'warning' | 'error' }> = {
  sensor: { icon: 'sensors', tone: 'normal' },
  simulated: { icon: 'science', tone: 'warning' },
  manual: { icon: 'edit-note', tone: 'normal' },
  api: { icon: 'cloud-download', tone: 'normal' },
  ai_estimate: { icon: 'auto-awesome', tone: 'ai' },
  lab: { icon: 'biotech', tone: 'normal' },
  model: { icon: 'public', tone: 'ai' },
};
export function SourceBadge({ source, label }: { source: DataSource; label?: string }) {
  const { t } = useTranslation();
  const l = LOOK[source] ?? LOOK.api;
  return <Chip icon={l.icon} tone={l.tone} label={label ?? t(`source.${source}`)} />;
}
