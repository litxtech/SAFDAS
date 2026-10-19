import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { z } from 'zod';
import {
  SpotButton,
  SpotCheck,
  SpotField,
  SpotGlass,
  SpotShell,
  SpotStepProgress,
  spot,
  spotEnter,
  spotFade,
} from '@/components/auth/SpotAuth';
import { openPolicy } from '@/components/legal/PolicyLinks';
import { POLICY_VERSION, REQUIRED_POLICIES } from '@/content/policies';
import { useT } from '@/i18n';
import { authRedirectTo } from '@/lib/authDeepLink';
import { setPendingSignupEmail } from '@/lib/pendingSignup';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const USERNAME = /^[a-z0-9_]{3,20}$/i;

const schema = z
  .object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    username: z.string().regex(USERNAME),
    email: z.string().email(),
    password: z.string().min(8),
    confirm: z.string(),
    terms: z.literal(true),
    privacy: z.literal(true),
    childSafety: z.literal(true),
  })
  .refine((value) => value.password === value.confirm, { path: ['confirm'] });

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function RegisterScreen() {
  const t = useT();
  const show = useToastStore((state) => state.show);
  const { reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
    terms: false,
    privacy: false,
    childSafety: false,
  });
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const usernameCheckToken = useRef(0);
  const set = (key: keyof typeof form) => (value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const usernameValid = USERNAME.test(form.username.trim());
  const identityChecks = [
    form.firstName.trim().length >= 2,
    form.lastName.trim().length >= 2,
    usernameValid && usernameStatus === 'available',
  ];
  const accountChecks = [
    z.string().email().safeParse(form.email.trim()).success,
    form.password.length >= 8,
    form.password.length >= 8 && form.password === form.confirm,
  ];
  const consentChecks = [form.terms, form.privacy, form.childSafety];
  const checks = step === 0 ? identityChecks : step === 1 ? accountChecks : consentChecks;
  const fraction = checks.filter(Boolean).length / checks.length;
  const ready = fraction === 1;
  const hints = [t('stepIdentityHint'), t('stepAccountHint'), t('stepConsentHint')];
  const stepLabels = [t('stepIdentity'), t('stepAccount'), t('stepConsent')];

  useEffect(() => {
    const raw = form.username.trim().toLowerCase();
    if (!raw) {
      setUsernameStatus('idle');
      return;
    }
    if (!USERNAME.test(raw)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const token = ++usernameCheckToken.current;
    const timer = setTimeout(() => {
      void requireSupabase()
        .rpc('username_available', { candidate: raw })
        .then(({ data, error }) => {
          if (token !== usernameCheckToken.current) return;
          if (error) {
            // RPC yoksa/geçici hata: formu kilitleme; submit'te tekrar kontrol edilir.
            setUsernameStatus('available');
            return;
          }
          setUsernameStatus(data === false ? 'taken' : 'available');
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [form.username]);

  function usernameError() {
    if (!form.username.trim()) return undefined;
    if (usernameStatus === 'invalid' || !usernameValid) return t('usernameRule');
    if (usernameStatus === 'taken') return t('usernameTaken');
    return undefined;
  }

  function goBack() {
    if (step > 0) setStep((current) => current - 1);
    else router.back();
  }

  function next() {
    if (step === 0 && usernameStatus === 'taken') {
      show(t('usernameTaken'), 'error');
      return;
    }
    if (step === 0 && usernameStatus === 'checking') {
      show(t('usernameChecking'), 'info');
      return;
    }
    if (!ready) {
      if (step === 1 && form.password !== form.confirm) show(t('passwordMismatch'), 'error');
      else if (step === 2) show(t('requiredPolicies'), 'error');
      else show(t('checkFields'), 'error');
      return;
    }
    if (step < 2) setStep((current) => current + 1);
    else void submit();
  }

  async function submit() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      show(form.terms && form.privacy && form.childSafety ? t('checkFields') : t('requiredPolicies'), 'error');
      return;
    }
    const displayName = `${parsed.data.firstName.trim()} ${parsed.data.lastName.trim()}`;
    const username = parsed.data.username.trim().toLowerCase();
    setLoading(true);
    try {
      const client = requireSupabase();
      const { data: available } = await client.rpc('username_available', { candidate: username });
      if (available === false) {
        setUsernameStatus('taken');
        setStep(0);
        show(t('usernameTaken'), 'error');
        return;
      }

      const { data, error } = await client.auth.signUp({
        email: parsed.data.email.trim(),
        password: parsed.data.password,
        options: {
          emailRedirectTo: authRedirectTo(),
          data: {
            first_name: parsed.data.firstName.trim(),
            last_name: parsed.data.lastName.trim(),
            full_name: displayName,
            display_name: displayName,
            username,
            accepted_terms: true,
            accepted_privacy: true,
            accepted_child_safety: true,
            accepted_policies_at: new Date().toISOString(),
            policy_version: POLICY_VERSION,
          },
        },
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes('database error saving new user') || message.includes('profiles')) {
          show(t('signupDbError'), 'error');
        } else if (message.includes('already registered') || message.includes('user already')) {
          show(t('emailAlreadyRegistered'), 'error');
        } else {
          show(error.message, 'error');
        }
        return;
      }
      if (!data.session) {
        const email = parsed.data.email.trim();
        setPendingSignupEmail(email);
        show(t('verifyLinkSent'), 'success');
        router.replace({ pathname: '/(auth)/otp', params: { email } });
      } else {
        setPendingSignupEmail(null);
        router.replace('/');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SpotShell scroll onBack={goBack}>
      <StatusBar style="light" />

      <Animated.View entering={spotFade(40, reduceMotion)} style={styles.header}>
        <Text style={styles.kicker}>SAFDAŞ</Text>
        <Text style={styles.title}>{t('register')}</Text>
        <Text style={styles.subtitle}>{hints[step]}</Text>
      </Animated.View>

      <Animated.View entering={spotEnter(120, reduceMotion)}>
        <SpotGlass strong>
          <SpotStepProgress labels={stepLabels} step={step} fraction={fraction} />

          <Animated.View
            key={`step-${step}`}
            entering={reduceMotion ? undefined : FadeIn.duration(220)}
            exiting={reduceMotion ? undefined : FadeOut.duration(160)}
            style={styles.stepBody}
          >
            {step === 0 ? (
              <>
                <SpotField label={t('firstName')} autoComplete="given-name" value={form.firstName} onChangeText={set('firstName')} />
                <SpotField label={t('lastName')} autoComplete="family-name" value={form.lastName} onChangeText={set('lastName')} />
                <View style={styles.usernameWrap}>
                  <SpotField
                    label={t('username')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    value={form.username}
                    onChangeText={(value) => set('username')(value.replace(/\s+/g, '').toLowerCase())}
                    error={usernameError()}
                  />
                  {usernameStatus === 'checking' ? (
                    <View style={styles.usernameHint}>
                      <ActivityIndicator size="small" color={spot.accent} />
                      <Text style={styles.usernameHintText}>{t('usernameChecking')}</Text>
                    </View>
                  ) : null}
                  {usernameStatus === 'available' ? (
                    <Text style={styles.usernameOk}>{t('usernameAvailable')}</Text>
                  ) : null}
                </View>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <SpotField
                  label={t('email')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={form.email}
                  onChangeText={set('email')}
                />
                <SpotField
                  label={t('password')}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  value={form.password}
                  onChangeText={set('password')}
                />
                <SpotField
                  label={t('confirmPassword')}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  value={form.confirm}
                  onChangeText={set('confirm')}
                  error={form.confirm.length > 0 && form.password !== form.confirm ? t('passwordMismatch') : undefined}
                />
              </>
            ) : null}

            {step === 2 ? (
              <View style={styles.consent}>
                <Text style={styles.consentIntro}>{t('requiredPolicies')}</Text>
                {REQUIRED_POLICIES.map((policy) => {
                  const key = policy.slug === 'safety' ? 'childSafety' : policy.slug;
                  const value = form[key as 'terms' | 'privacy' | 'childSafety'];
                  return (
                    <SpotCheck
                      key={policy.slug}
                      label={t(policy.accept)}
                      value={value}
                      onChange={set(key as 'terms' | 'privacy' | 'childSafety')}
                      linkLabel={`${t('readPolicy')} · ${t(policy.label)}`}
                      onLink={() => openPolicy(policy.slug)}
                    />
                  );
                })}
              </View>
            ) : null}
          </Animated.View>

          <SpotButton
            label={step === 2 ? t('register') : t('continueAction')}
            onPress={next}
            loading={loading}
            disabled={!ready || loading || (step === 0 && usernameStatus === 'checking')}
          />

          {step > 0 ? (
            <SpotButton label={t('back')} variant="ghost" onPress={() => setStep((current) => current - 1)} />
          ) : null}
        </SpotGlass>
      </Animated.View>

      <Animated.View entering={spotEnter(240, reduceMotion)} style={styles.footer}>
        <Text style={styles.footerMuted}>{t('haveAccount')}</Text>
        <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={8}>
          <Text style={styles.footerLink}>{t('login')}</Text>
        </Pressable>
      </Animated.View>
    </SpotShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginTop: 4, marginBottom: 2 },
  kicker: {
    color: spot.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: spot.ink,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  subtitle: {
    color: spot.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
  },
  stepBody: { gap: 14 },
  usernameWrap: { gap: 6 },
  usernameHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 2 },
  usernameHintText: { color: spot.dim, fontSize: 13, fontWeight: '600' },
  usernameOk: { color: spot.accent, fontSize: 13, fontWeight: '700', paddingLeft: 2 },
  consent: { gap: 10 },
  consentIntro: { color: spot.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    minHeight: 40,
  },
  footerMuted: { color: spot.dim, fontSize: 13, fontWeight: '600' },
  footerLink: { color: spot.accent, fontSize: 14, fontWeight: '800' },
});
