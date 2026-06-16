'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '@/app/context/SettingsContext';
import { useTranslation } from '@/lib/useTranslation';

const ONBOARDING_KEY = 'blindtest_onboarding_done';

const LANGUAGES = [
  { id: 'en' as const, label: 'EN', name: 'English', flag: '🇬🇧' },
  { id: 'pt' as const, label: 'PT', name: 'Português', flag: '🇵🇹' },
  { id: 'fr' as const, label: 'FR', name: 'Français', flag: '🇫🇷' },
  { id: 'es' as const, label: 'ES', name: 'Español', flag: '🇪🇸' },
];

const ALL_THEMES = [
  { id: 'dark' as const, label: 'Dark', emoji: '🌙' },
  { id: 'light' as const, label: 'Light', emoji: '☀️' },
  { id: 'noir' as const, label: 'Neon Noir', emoji: '🌃' },
  { id: 'synthwave' as const, label: 'Synthwave', emoji: '🌅' },
  { id: 'terminal' as const, label: 'Terminal', emoji: '💻' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function OnboardingTakeover() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [phase, setPhase] = useState<'enter' | 'steps' | 'complete'>('enter');
  const [step, setStep] = useState(0);
  const [volumeSlider, setVolumeSlider] = useState(false);
  const [tested, setTested] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [show, setShow] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState<any[]>([]);
  const [quizPlayed, setQuizPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const quizAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setShow(true);
  }, []);

  useEffect(() => {
    if (step === 2 && !quizData) {
      fetch('/api/onboarding/quiz')
        .then(r => r.json())
        .then(data => {
          setQuizData(data);
          setShuffledOptions(shuffle(data.options));
        })
        .catch(() => {});
    }
  }, [step, quizData]);

  const stopAllAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (quizAudioRef.current) { quizAudioRef.current.pause(); quizAudioRef.current = null; }
  }, []);

  useEffect(() => {
    return () => stopAllAudio();
  }, [stopAllAudio]);

  const dropBeat = async () => {
    stopAllAudio();
    if (!volumeSlider) setVolumeSlider(true);
    setTested(true);
    try {
      const res = await fetch('/api/onboarding/preview');
      const data = await res.json();
      if (data.url) {
        const audio = new Audio(data.url);
        audio.volume = settings.masterVolume;
        audio.loop = true;
        audio.play().then(() => { audioRef.current = audio; }).catch(() => {});
      }
    } catch {}
  };

  const handleVolume = (v: number) => {
    updateSettings({ masterVolume: v });
    if (audioRef.current) audioRef.current.volume = v;
  };

  const playQuiz = () => {
    stopAllAudio();
    if (!quizData?.previewUrl) return;
    const audio = new Audio(quizData.previewUrl);
    audio.volume = settings.masterVolume;
    audio.play().then(() => { quizAudioRef.current = audio; setQuizPlayed(true); }).catch(() => {});
  };

  const handleAnswer = (idx: number) => {
    if (correct) return;
    setSelectedAnswer(idx);
    if (shuffledOptions[idx]?.correct) {
      setCorrect(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
  };

  const complete = () => {
    stopAllAudio();
    localStorage.setItem(ONBOARDING_KEY, '1');
    setPhase('complete');
    setTimeout(() => setShow(false), 800);
  };

  const ThemeButton = ({ id, label, emoji }: { id: typeof ALL_THEMES[number]['id']; label: string; emoji: string }) => {
    const active = settings.theme === id;
    return (
      <button
        onClick={() => updateSettings({ theme: id })}
        className={`relative px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-500 cursor-pointer ${
          active ? 'text-foreground shadow-xl scale-105' : 'text-foreground/40 hover:text-foreground/70 border border-white/5'
        }`}
        style={{
          background: active
            ? id === 'noir' ? 'linear-gradient(135deg, #6c5ce7, #00cec9)'
            : id === 'synthwave' ? 'linear-gradient(135deg, #ff6b6b, #feca57)'
            : id === 'terminal' ? 'linear-gradient(135deg, #10b981, #34d399)'
            : id === 'light' ? 'linear-gradient(135deg, #6366f1, #a78bfa)'
            : 'linear-gradient(135deg, var(--primary), var(--accent))'
            : undefined,
          borderColor: active ? 'transparent' : undefined,
        }}
      >
        <span className="text-xl block mb-1">{emoji}</span>
        {label}
      </button>
    );
  };

  const LangButton = ({ l }: { l: typeof LANGUAGES[0] }) => {
    const active = settings.language === l.id;
    return (
      <button
        onClick={() => updateSettings({ language: l.id })}
        className={`flex flex-col items-center gap-1 px-4 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
          active
            ? 'text-foreground bg-primary/20 border border-primary/30 shadow-md scale-105'
            : 'text-foreground/40 hover:text-foreground/70 border border-white/5'
        }`}
      >
        <span className="text-2xl">{l.flag}</span>
        <span>{l.label}</span>
      </button>
    );
  };

  const slideVariants = {
    enter: { opacity: 0, x: 60 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 70%)' }} />

      <AnimatePresence mode="wait">
        {phase === 'enter' && (
          <motion.div
            key="enter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 relative"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl shadow-2xl shadow-primary/20">
                🎵
              </div>
            </motion.div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">
                <span className="text-primary">Blind</span>
                <span className="text-foreground">Test</span>
              </h1>
              <p className="text-foreground/40 text-sm font-semibold tracking-wide">Get ready to guess the song</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPhase('steps')}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-foreground font-black text-sm uppercase tracking-wider shadow-xl shadow-primary/20 cursor-pointer"
            >
              Start →
            </motion.button>
          </motion.div>
        )}

        {phase === 'steps' && (
          <motion.div
            key="steps"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-6 relative"
          >
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step0"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center gap-8 w-full max-w-md"
                >
                  <motion.div
                    animate={tested ? { scale: [1, 1.05, 1] } : { rotate: 360 }}
                    transition={tested ? { repeat: Infinity, duration: 2 } : { repeat: Infinity, duration: 8, ease: 'linear' }}
                    className="relative w-40 h-40"
                  >
                    <div className="absolute inset-0 rounded-full border-8 border-white/5" />
                    <div className="absolute inset-4 rounded-full border-4 border-white/5" />
                    <div className="absolute inset-8 rounded-full border-2 border-white/5" />
                    <div className="absolute inset-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl shadow-lg">
                      {tested ? '🔊' : '🎵'}
                    </div>
                  </motion.div>

                  <div className="text-center space-y-2">
                    <p className="text-2xl font-black tracking-tight">{t('onboarding_drop_title') || 'Drop the Beat'}</p>
                    <p className="text-sm text-foreground/50">{t('onboarding_drop_desc') || 'Test your audio before we begin'}</p>
                  </div>

                  <button
                    onClick={dropBeat}
                    className="px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-3"
                    style={{
                      backgroundColor: tested ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'color-mix(in srgb, var(--primary) 15%, transparent)',
                      color: tested ? 'var(--accent)' : 'var(--primary)',
                      border: `1px solid ${tested ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'color-mix(in srgb, var(--primary) 25%, transparent)'}`,
                    }}
                  >
                    <span className="text-lg">{tested ? '🔊' : '▶'}</span>
                    {tested ? (t('onboarding_playing') || 'Playing...') : (t('onboarding_drop_btn') || 'Drop the Beat')}
                  </button>

                  <AnimatePresence>
                    {volumeSlider && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-4"
                      >
                        <span className="text-xs text-foreground/40">🔈</span>
                        <input
                          type="range" min={0.05} max={1} step={0.05}
                          value={settings.masterVolume}
                          onChange={e => handleVolume(Number(e.target.value))}
                          className="w-48 accent-[var(--primary)] h-1.5 cursor-pointer"
                        />
                        <span className="text-xs text-foreground/40">🔊</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-[10px] text-foreground/30">{t('onboarding_volume_hint') || 'Adjust your volume. Can you hear the bass?'}</p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step1"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center gap-8 w-full max-w-md"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg">🎨</div>
                  <div className="text-center space-y-2">
                    <p className="text-2xl font-black tracking-tight">{t('onboarding_identity_title') || 'Your Identity'}</p>
                    <p className="text-sm text-foreground/50">{t('onboarding_identity_desc') || 'Language & look'}</p>
                  </div>

                  <div className="w-full space-y-6">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/30 mb-3 text-center">{t('language') || 'Language'}</p>
                      <div className="flex justify-center gap-2">
                        {LANGUAGES.map(l => <LangButton key={l.id} l={l} />)}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/30 mb-3 text-center">{t('theme') || 'Theme'}</p>
                      <div className="flex justify-center gap-3 flex-wrap">
                        {ALL_THEMES.map(th => (
                          <ThemeButton key={th.id} id={th.id} label={th.label} emoji={th.emoji} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center gap-6 w-full max-w-md"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-2xl shadow-lg">🎯</div>
                  <div className="text-center space-y-2">
                    <p className="text-2xl font-black tracking-tight">{t('onboarding_quiz_title') || 'Ready?'}</p>
                    <p className="text-sm text-foreground/50">{t('onboarding_quiz_desc') || 'Guess the artist from the snippet'}</p>
                  </div>

                  <button
                    onClick={playQuiz}
                    className="px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-3"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}
                  >
                    ▶ {t('onboarding_play_preview') || 'Play Preview'}
                  </button>

                  {quizData && (
                    <div className="grid grid-cols-2 gap-2.5 w-full">
                      {shuffledOptions.map((opt, idx) => {
                        const isSelected = selectedAnswer === idx;
                        const isCorrect = correct && opt.correct;
                        const isWrong = isSelected && !opt.correct && correct;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={correct}
                            className={`px-4 py-4 rounded-2xl text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer disabled:cursor-not-allowed text-left flex flex-col ${
                              isCorrect
                                ? 'bg-green-500/20 border-green-500/40 text-green-400 shadow-lg shadow-green-500/10'
                                : isWrong
                                  ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                  : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 text-foreground/80'
                            }`}
                          >
                            <span className="font-black text-sm">{opt.artist}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showConfetti && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-2"
                    >
                      <motion.p
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: 2, duration: 0.4 }}
                        className="text-2xl"
                      >
                        🎉
                      </motion.p>
                      <p className="text-lg font-black text-green-400">{t('onboarding_correct') || 'Correct!'}</p>
                      <p className="text-xs text-foreground/50">&ldquo;{quizData?.trackName}&rdquo;</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between w-full max-w-md mt-8 px-2">
              <button
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                className="text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-20 text-foreground/40 hover:text-foreground"
              >
                ← {t('back') || 'Back'}
              </button>

              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-primary' : i < step ? 'w-2 bg-foreground/30' : 'w-2 bg-foreground/10'}`}
                  />
                ))}
              </div>

              {correct ? (
                <button
                  onClick={complete}
                  className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-gradient-to-r from-green-500 to-emerald-500 text-foreground shadow-lg hover:brightness-110 flex items-center gap-2"
                >
                  {t('onboarding_enter') || 'ENTER THE ARENA'} 🎮
                </button>
              ) : step < 2 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 0 && !tested}
                  className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-20 bg-white/10 hover:bg-white/15 text-foreground"
                >
                  {t('next') || 'Next'} →
                </button>
              ) : (
                <div />
              )}
            </div>
          </motion.div>
        )}

        {phase === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center space-y-4">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6 }}
                className="text-6xl"
              >
                🎮
              </motion.div>
              <p className="text-2xl font-black tracking-tight text-foreground">{t('onboarding_entering') || 'Entering the Arena...'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
