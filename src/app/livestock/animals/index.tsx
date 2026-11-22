// 27 · Animal Management
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, ChoiceChips, EmptyState, ErrorState, Header, LoadingList, TextField } from '@/components';
import { useAnimals } from '@/features/livestock/api';
import { AnimalRow, SPECIES_EMOJI } from '@/features/livestock/AnimalRow';
import { SPECIES } from '@/features/livestock/schemas';
import type { Species } from '@/types/database';
import { colors, space } from '@/theme';

export default function AnimalManagement() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ species?: Species }>();
  const animals = useAnimals();
  const [species, setSpecies] = useState<'all' | Species>(params.species ?? 'all');
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const list = (animals.data ?? []).filter((a) => (species === 'all' || a.species === species) && (!s || [a.name, a.tag_id, a.breed].some((x) => x?.toLowerCase().includes(s))));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <FlatList
        data={animals.isLoading || animals.error ? [] : list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: space.md, gap: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: 4 }}>
            <Header title={t('livestock.allAnimals')} />
            <TextField label={t('livestock.search')} icon="search" placeholder={t('livestock.search')} value={q} onChangeText={setQ} />
            <ChoiceChips scroll value={species} onChange={setSpecies}
              options={[{ value: 'all', label: t('crops.all') }, ...SPECIES.map((x) => ({ value: x, label: `${SPECIES_EMOJI[x]} ${t(`livestock.species.${x}`)}` }))]} />
          </View>
        }
        renderItem={({ item }) => <AnimalRow a={item} onPress={() => router.push(`/livestock/animals/${item.id}`)} />}
        ListEmptyComponent={
          animals.isLoading ? <LoadingList height={88} /> : animals.error ? <ErrorState onRetry={() => animals.refetch()} /> : animals.data?.length ? (
            <AppText variant="bodyMd" color={colors.textMuted} align="center">{t('livestock.noMatch')}</AppText>
          ) : <EmptyState icon="pets" title={t('livestock.emptyTitle')} text={t('livestock.emptyText')} action={t('livestock.addAnimal')} onAction={() => router.push('/livestock/animals/new')} />
        }
      />
      {!!animals.data?.length && (
        <View style={{ position: 'absolute', right: space.md, bottom: space.lg }}>
          <Button label={t('livestock.addAnimal')} iconLeft="add" onPress={() => router.push({ pathname: '/livestock/animals/new', params: species !== 'all' ? { species } : {} })} />
        </View>
      )}
    </SafeAreaView>
  );
}
