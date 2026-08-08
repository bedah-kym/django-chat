import { useState } from 'react'
import styles from './OnboardingPage.module.css'

const steps = [
  { title: 'Welcome to Kazi', description: 'Your AI-powered business operating system. Let\'s get you set up.' },
  { title: 'Create Your First Room', description: 'Rooms are where conversations happen. Create one for a project, client, or team.' },
  { title: 'Meet Mathia', description: 'Mathia is your AI assistant. It can help with scheduling, invoicing, travel, and more.' },
  { title: 'Connect Your Tools', description: 'Link your calendar, email, and payment tools to unlock the full Kazi experience.' },
  { title: 'You\'re All Set!', description: 'Head to your dashboard to get started. Mathia will guide you from here.' },
]

export function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const step = steps[currentStep]!

  return (
    <div className={styles.onboarding}>
      {/* Progress */}
      <div className={styles.progress}>
        {steps.map((_, i) => (
          <div
            key={i}
            className={`${styles.progressDot} ${i <= currentStep ? styles.active : ''}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className={styles.card}>
        <div className={styles.stepIndicator}>Step {currentStep + 1} of {steps.length}</div>
        <h1 className={styles.title}>{step.title}</h1>
        <p className={styles.description}>{step.description}</p>

        {currentStep === 1 && (
          <div className={styles.formSection}>
            <input className={styles.input} placeholder="Room name (e.g. Client Project)" />
          </div>
        )}

        {currentStep === 3 && (
          <div className={styles.integrationList}>
            {['Calendly', 'Gmail', 'WhatsApp', 'IntaSend'].map(name => (
              <div key={name} className={styles.integrationRow}>
                <span>{name}</span>
                <button className={styles.connectBtn}>Connect</button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          {currentStep > 0 && (
            <button className={styles.btnBack} onClick={() => setCurrentStep(s => s - 1)}>
              Back
            </button>
          )}
          <button
            className={styles.btnNext}
            onClick={() => setCurrentStep(s => Math.min(s + 1, steps.length - 1))}
          >
            {currentStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
