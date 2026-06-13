import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles, Users, MapPin, Calendar, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createItinerary } from '@/api/travel'
import { useTravelStore } from '@/stores/travelStore'
import { todayISO, daysBetween } from './utils'
import './travel.tokens.css'
import styles from './TripPlannerPage.module.css'

type Step = 0 | 1 | 2

interface Form {
  destination: string
  startDate: string
  endDate: string
  travellers: number
  notes: string
}

export function TripPlannerPage() {
  const navigate = useNavigate()
  const refresh = useTravelStore((s) => s.fetchItineraries)

  const [step, setStep] = useState<Step>(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<Form>({
    destination: '',
    startDate: '',
    endDate: '',
    travellers: 1,
    notes: '',
  })

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const canAdvance: Record<Step, boolean> = {
    0: form.destination.trim().length >= 2,
    1: !!form.startDate && !!form.endDate && form.startDate <= form.endDate,
    2: form.travellers >= 1,
  }

  const goNext = () => {
    if (!canAdvance[step]) return
    if (step < 2) {
      setDirection(1)
      setStep((step + 1) as Step)
    }
  }
  const goPrev = () => {
    if (step > 0) {
      setDirection(-1)
      setStep((step - 1) as Step)
    }
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const created = await createItinerary({
        title: form.destination.trim(),
        region: form.destination.trim(),
        start_date: form.startDate,
        end_date: form.endDate,
        description: form.notes.trim() || undefined,
        travellers: form.travellers,
      })
      await refresh().catch(() => {})
      toast.success('Trip created — Mathia will start filling it in.')
      navigate(`/app/ops/travel/${created.id}`)
    } catch {
      toast.error('Could not create trip')
    } finally {
      setSubmitting(false)
    }
  }

  const days = form.startDate && form.endDate ? daysBetween(form.startDate, form.endDate) : 0
  const today = todayISO()

  return (
    <div className="tv">
      <div className={styles.page}>
        <Link to="/app/ops/travel/itineraries" className={styles.back}>
          <ChevronLeft size={16} />
          Trips
        </Link>

        <p className={styles.eyebrow}>Plan a trip</p>
        <h1 className={styles.title}>
          {step === 0 ? 'Where are you going?' :
            step === 1 ? 'When?' : 'Who and what?'}
        </h1>
        <p className={styles.subtitle}>
          {step === 0 ? 'A city, a country, or somewhere broader. Mathia handles the specifics.' :
            step === 1 ? 'Pick the dates and we\'ll build the day timeline.' :
              'How many travellers, and anything Mathia should know.'}
        </p>

        {/* Stepper */}
        <div className={styles.stepper}>
          {(['Destination', 'Dates', 'Details'] as const).map((label, i) => {
            const idx = i as Step
            const done = i < step
            const current = i === step
            return (
              <button
                type="button"
                key={label}
                className={`${styles.stepperItem} ${current ? styles.stepperActive : ''} ${done ? styles.stepperDone : ''}`}
                onClick={() => { if (i <= step || canAdvance[step]) { setDirection(i < step ? -1 : 1); setStep(idx) } }}
                disabled={i > step && !canAdvance[step]}
              >
                <span className={styles.stepperBubble}>
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className={styles.stepperLabel}>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Step body */}
        <div className={styles.stepShell}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={styles.stepBody}
            >
              {step === 0 && (
                <div className={styles.field}>
                  <div className={styles.fieldIcon}><MapPin size={20} /></div>
                  <input
                    autoFocus
                    className={styles.bigInput}
                    placeholder="e.g. Nairobi, Kenya"
                    value={form.destination}
                    onChange={(e) => set('destination', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && canAdvance[0]) goNext() }}
                  />
                </div>
              )}

              {step === 1 && (
                <div className={styles.dateGrid}>
                  <label className={styles.dateField}>
                    <span className={styles.dateLabel}>From</span>
                    <div className={styles.dateInputWrap}>
                      <Calendar size={16} className={styles.dateIcon} />
                      <input
                        type="date"
                        className={styles.dateInput}
                        min={today}
                        value={form.startDate}
                        onChange={(e) => set('startDate', e.target.value)}
                      />
                    </div>
                  </label>
                  <label className={styles.dateField}>
                    <span className={styles.dateLabel}>To</span>
                    <div className={styles.dateInputWrap}>
                      <Calendar size={16} className={styles.dateIcon} />
                      <input
                        type="date"
                        className={styles.dateInput}
                        min={form.startDate || today}
                        value={form.endDate}
                        onChange={(e) => set('endDate', e.target.value)}
                      />
                    </div>
                  </label>
                  {days > 0 ? (
                    <div className={styles.daysHint}>
                      {days} {days === 1 ? 'day' : 'days'} in {form.destination || 'destination'}
                    </div>
                  ) : null}
                </div>
              )}

              {step === 2 && (
                <div className={styles.detailsGrid}>
                  <div className={styles.travellersField}>
                    <div className={styles.fieldIconSmall}><Users size={16} /></div>
                    <span className={styles.travellersLabel}>Travellers</span>
                    <div className={styles.stepperCount}>
                      <button
                        type="button"
                        className={styles.stepperCountBtn}
                        onClick={() => set('travellers', Math.max(1, form.travellers - 1))}
                        aria-label="Fewer travellers"
                      >−</button>
                      <span className={styles.stepperCountValue}>{form.travellers}</span>
                      <button
                        type="button"
                        className={styles.stepperCountBtn}
                        onClick={() => set('travellers', form.travellers + 1)}
                        aria-label="More travellers"
                      >+</button>
                    </div>
                  </div>

                  <label className={styles.notesField}>
                    <span className={styles.dateLabel}>Anything Mathia should know?</span>
                    <textarea
                      className={styles.notesInput}
                      placeholder="Vegetarian meals, prefer mid-range stays, business class only…"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      rows={3}
                    />
                  </label>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav */}
        <div className={styles.nav}>
          <button type="button" className={styles.navBack} onClick={goPrev} disabled={step === 0}>
            <ChevronLeft size={16} /> Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              className={styles.navNext}
              onClick={goNext}
              disabled={!canAdvance[step]}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className={styles.navNext}
              onClick={handleSubmit}
              disabled={submitting || !canAdvance[2]}
            >
              {submitting ? 'Building…' : <>Build my trip <Sparkles size={15} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
