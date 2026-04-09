import * as Accordion from '@radix-ui/react-accordion'
import { motion } from 'framer-motion'
import {
  X, ChevronDown, Users, StickyNote, Zap, Link2, Brain,
  Plus, Pin,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Room, Contact, Note, ActionReceipt } from '@/types/chat'
import { mockLinkedRooms } from '@/mocks/chat'
import { formatDate, formatDateTime } from '@/utils/format'
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
              {contacts.map((contact, index) => (
                <motion.div
                  key={contact.id}
                  className={styles.contactCard}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <div className={styles.contactAvatar}>{contact.name[0]}</div>
                  <div>
                    <div className={styles.contactName}>{contact.name}</div>
                    <div className={styles.contactDetail}>{contact.email}</div>
                    {contact.company ? <div className={styles.contactDetail}>{contact.company}</div> : null}
                  </div>
                </motion.div>
              ))}
              <button className={styles.addBtn} onClick={() => toast('Add contact form coming soon')}>
                <Plus size={13} /> Add Contact
              </button>
            </div>
          </Accordion.Content>
        </Accordion.Item>

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
              {notes.map((note, index) => (
                <motion.div
                  key={note.id}
                  className={styles.noteCard}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  {note.isPinned ? (
                    <span className={styles.pinnedBadge}>
                      <Pin size={11} /> Pinned
                    </span>
                  ) : null}
                  <p className={styles.noteText}>{note.content}</p>
                  <span className={styles.noteTime}>
                    {formatDate(note.createdAt, { dateStyle: 'medium' })} by {note.author}
                  </span>
                </motion.div>
              ))}
              <button className={styles.addBtn} onClick={() => toast('Add note form coming soon')}>
                <Plus size={13} /> Add Note
              </button>
            </div>
          </Accordion.Content>
        </Accordion.Item>

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
              {actionReceipts.map((action, index) => (
                <motion.div
                  key={action.id}
                  className={styles.actionCard}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <div className={styles.actionHeader}>
                    <span className={styles.actionName}>{action.action}</span>
                    <span className={`${styles.actionStatus} ${styles[action.status]}`}>
                      {action.status}
                    </span>
                  </div>
                  <p className={styles.actionDetail}>{action.details}</p>
                  <span className={styles.actionTime}>{formatDateTime(action.timestamp)}</span>
                </motion.div>
              ))}
            </div>
          </Accordion.Content>
        </Accordion.Item>

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
              {mockLinkedRooms.map((linkedRoom) => (
                <div key={linkedRoom.id} className={styles.linkedRoom}>
                  <Link2 size={13} />
                  <span>{linkedRoom.displayName}</span>
                </div>
              ))}
              <button className={styles.addBtn} onClick={() => toast('Link room coming soon')}>
                <Plus size={13} /> Link Room
              </button>
            </div>
          </Accordion.Content>
        </Accordion.Item>

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
                <p>This room focuses on TechVentures Q2 strategy. Key topics include revenue growth, churn reduction, and operator follow-through.</p>
                <p>Active participants remain visible in the room header, and the latest major decision is reflected in the message timeline.</p>
              </div>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </aside>
  )
}
