// Temporary landing until Batch 2 replaces it with 09 · Main Dashboard.
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Header, LanguagePills, Screen } from '@/components';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function Home() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  return (
    <Screen>
      <Header hideBack right={<LanguagePills />} />
      <AppText variant="display">{t('home.welcome', { name: profile?.full_name ?? '' })}</AppText>
      <AppText variant="bodyLg" color={colors.textMuted}>{t('home.comingSoon')}</AppText>
      <Button variant="secondary" label={t('home.signOut')} iconLeft="logout" onPress={async () => { await signOut(); router.replace('/auth/login'); }} />
    </Screen>
  );
}
