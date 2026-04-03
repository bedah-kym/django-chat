import * as Accordion from '@radix-ui/react-accordion'
import { motion } from 'framer-motion'
import {
  X, ChevronDown, Users, StickyNote, Zap, Link2, Brain,
  Plus, Pin,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Room, Contact, Note, ActionReceipt } from '@/types/chat'
import { mockLinkedRooms } from '@/mocks/chat'
import styles from './ContextPanel.module.css'

interface Props {
  room: Room
  contacts: Contact[]
  notes: Note[]
  actionReceipts: ActionReceipt[]
  onClose: () => void
}

export function ContextPanel({ room: _room, contacts, notes, actionReceipts, onClose }: Props) {
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Context</h3>
        <motion.button
          className={styles.closeBtn}
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X size={16} />
        </motion.button>
      </div>

      <Accordion.Root type="single" defaultValue="notes" collapsible className={styles.accordion}>
        {/* Contacts */}
        <Accordion.Item value="contacts" className={styles.section}>
          <Accordion.Trigger className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>
              <Users size={15} />
              <span>Contacts ({contacts.length})</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              {contacts.map((c, i) => (
                <motion.div
                  key={c.id}
                  className={styles.contactCard}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className={styles.contactAvatar}>{c.name[0]}</div>
                  <div>
                    <div className={styles.contactName}>{c.name}</div>
                    <div className={styles.contactDetail}>{c.email}</div>
                    {c.company && <div className={styles.contactDetail}>{c.company}</div>}
                  </div>
                </motion.div>
              ))}
              <button className={styles.addBtn} onClick={() => toast('Add contact form — coming soon')}>
                <Plus size={13} /> Add Contact
              </button>
            </div>
          </Accordion.Content>
        </Accordion.Item>

        {/* Notes */}
        <Accordion.Item value="notes" className={styles.section}>
          <Accordion.Trigger className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>
              <StickyNote size={15} />
              <span>Notes ({notes.length})</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              {notes.map((n, i) => (
                <motion.div
                  key={n.id}
                  className={styles.noteCard}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  {n.isPinned && (
                    <span className={styles.pinnedBadge}>
                      <Pin size={11} /> Pinned
                    </span>
                  )}
                  <p className={styles.noteText}>{n.content}</p>
                  <span className={styles.noteTime}>
                    {new Date(n.createdAt).toLocaleDateString()} by {n.author}
                  </span>
                </motion.div>
              ))}
              <button className={styles.addBtn} onClick={() => toast('Add note form — coming soon')}>
                <Plus size={13} /> Add Note
              </button>
            </div>
          </Accordion.Content>
        </Accordion.Item>

        {/* Action Receipts */}
        <Accordion.Item value="actions" className={styles.section}>
          <Accordion.Trigger className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>
              <Zap size={15} />
              <span>Actions ({actionReceipts.length})</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              {actionReceipts.map((a, i) => (
                <motion.div
                  key={a.id}
                  className={styles.actionCard}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className={styles.actionHeader}>
                    <span className={styles.actionName}>{a.action}</span>
                    <span className={`${styles.actionStatus} ${styles[a.status]}`}>
                      {a.status}
                    </span>
                  </div>
                  <p className={styles.actionDetail}>{a.details}</p>
                  <span className={styles.actionTime}>
                    {new Date(a.timestamp).toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>
          </Accordion.Content>
        </Accordion.Item>

        {/* Linked Rooms */}
        <Accordion.Item value="linked" className={styles.section}>
          <Accordion.Trigger className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>
              <Link2 size={15} />
              <span>Linked Rooms ({mockLinkedRooms.length})</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              {mockLinkedRooms.map(lr => (
                <div key={lr.id} className={styles.linkedRoom}>
                  <Link2 size={13} />
                  <span>{lr.displayName}</span>
                </div>
              ))}
              <button className={styles.addBtn} onClick={() => toast('Link room — coming soon')}>
                <Plus size={13} /> Link Room
              </button>
            </div>
          </Accordion.Content>
        </Accordion.Item>

        {/* AI Summary */}
        <Accordion.Item value="summary" className={styles.section}>
          <Accordion.Trigger className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>
              <Brain size={15} />
              <span>AI Summary</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              <div className={styles.summaryText}>
                <p>This room focuses on TechVentures Q2 strategy. Key topics include revenue growth (23% QoQ), churn reduction strategy, and NPS score improvements for the SMB segment.</p>
                <p>Active participants: Alex, Sarah, and Mathia AI. Last major decision: schedule Friday strategy meeting.</p>
              </div>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </aside>
  )
}
