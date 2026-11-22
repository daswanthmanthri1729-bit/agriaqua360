import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Chip } from '@/components';
import { formatDate, today } from '@/lib/dates';
import type { Animal, Vaccination } from '@/types/database';
import { colors } from '@/theme';
import { useCompleteVaccination } from './api';
import { animalLabel } from './AnimalRow';
import { vaccState } from './vaccination';

const TONE = { done: 'normal', overdue: 'error', due_soon: 'warning', scheduled: 'ai', missed: 'error' } as const;

export function VaccRow({ v, showAnimal }: { v: Vaccination & { animal?: Pick<Animal, 'name' | 'tag_id' | 'species'> | null }; showAnimal?: boolean }) {
  const { t, i18n } = useTranslation();
  const complete = useCompleteVaccination();
  const state = vaccState(v, today());
  const date = v.given_on ?? v.due_on;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="labelLg">{v.vaccine_name}{showAnimal && v.animal ? ` · ${t(`livestock.species.${v.animal.species}`)} ${animalLabel(v.animal)}` : ''}</AppText>
        <AppText variant="bodySm" color={colors.textMuted}>
          {[date && `${t(v.given_on ? 'livestock.givenOn' : 'livestock.dueOn')} ${formatDate(date, i18n.language)}`, v.dose].filter(Boolean).join(' • ')}
        </AppText>
      </View>
      {state === 'done' ? <Chip label={t('livestock.vacc.done')} icon="check" /> : (
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Chip tone={TONE[state]} label={t(`livestock.vacc.${state}`)} />
          <Button compact variant="secondary" label={t('livestock.markGiven')} loading={complete.isPending} onPress={() => complete.mutate(v)} />
        </View>
      )}
    </View>
  );
}
