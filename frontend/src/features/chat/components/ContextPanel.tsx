import { useState } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { motion } from 'framer-motion'
import {
  X, ChevronDown, Users, StickyNote, Zap, Link2, Brain,
  Plus, Pin,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Room, Contact, Note, ActionReceipt } from '@/types/chat'
import { addNote, createContact } from '@/api/chat'
import { formatDate, formatDateTime } from '@/utils/format'
import styles from './ContextPanel.module.css'

interface Props {
  room: Room
  contacts: Contact[]
  notes: Note[]
  actionReceipts: ActionReceipt[]
  summary?: string
  linkedRooms?: { id: number; name: string }[]
  onClose: () => void
  onNotesChanged?: () => void
  onContactsChanged?: () => void
}

const NOTE_TYPES = ['written', 'decision', 'action_item', 'insight', 'reminder'] as const
const NOTE_PRIORITIES = ['low', 'medium', 'high'] as const

export function ContextPanel({ room, contacts, notes, actionReceipts, summary = '', linkedRooms = [], onClose, onNotesChanged, onContactsChanged }: Props) {
  const [composeNote, setComposeNote] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState<(typeof NOTE_TYPES)[number]>('written')
  const [notePriority, setNotePriority] = useState<(typeof NOTE_PRIORITIES)[number]>('medium')
  const [savingNote, setSavingNote] = useState(false)

  const [composeContact, setComposeContact] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  const submitNote = async () => {
    if (!noteContent.trim() || savingNote) return
    setSavingNote(true)
    try {
      await addNote(room.id, { note_type: noteType, content: noteContent.trim(), priority: notePriority })
      setNoteContent('')
      setComposeNote(false)
      toast.success('Note saved')
      onNotesChanged?.()
    } catch {
      toast.error('Could not save note')
    } finally {
      setSavingNote(false)
    }
  }

  const submitContact = async () => {
    if (!contactName.trim() || !contactEmail.trim() || savingContact) return
    setSavingContact(true)
    try {
      await createContact({ name: contactName.trim(), email: contactEmail.trim() })
      setContactName('')
      setContactEmail('')
      setComposeContact(false)
      toast.success('Contact saved')
      onContactsChanged?.()
    } catch {
      toast.error('Could not save contact')
    } finally {
      setSavingContact(false)
    }
  }
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
              {composeContact ? (
                <div className={styles.composeForm}>
                  <input
                    className={styles.composeInput}
                    placeholder="Name"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    autoFocus
                  />
                  <input
                    className={styles.composeInput}
                    placeholder="Email"
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                  />
                  <div className={styles.composeActions}>
                    <button className={styles.composeCancel} onClick={() => { setComposeContact(false); setContactName(''); setContactEmail('') }} disabled={savingContact}>
                      Cancel
                    </button>
                    <button className={styles.composeSave} onClick={submitContact} disabled={savingContact || !contactName.trim() || !contactEmail.trim()}>
                      {savingContact ? 'Saving…' : 'Save contact'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className={styles.addBtn} onClick={() => setComposeContact(true)}>
                  <Plus size={13} /> Add Contact
                </button>
              )}
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
              {composeNote ? (
                <div className={styles.composeForm}>
                  <div className={styles.composeRow}>
                    <select
                      className={styles.composeSelect}
                      value={noteType}
                      onChange={e => setNoteType(e.target.value as typeof noteType)}
                    >
                      {NOTE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                    <select
                      className={styles.composeSelect}
                      value={notePriority}
                      onChange={e => setNotePriority(e.target.value as typeof notePriority)}
                    >
                      {NOTE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <textarea
                    className={styles.composeText}
                    placeholder="Write a note…"
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.composeActions}>
                    <button className={styles.composeCancel} onClick={() => { setComposeNote(false); setNoteContent('') }} disabled={savingNote}>
                      Cancel
                    </button>
                    <button className={styles.composeSave} onClick={submitNote} disabled={savingNote || !noteContent.trim()}>
                      {savingNote ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className={styles.addBtn} onClick={() => setComposeNote(true)}>
                  <Plus size={13} /> Add Note
                </button>
              )}
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
              <span>Linked Rooms ({linkedRooms.length})</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              {linkedRooms.map((linkedRoom) => (
                <div key={linkedRoom.id} className={styles.linkedRoom}>
                  <Link2 size={13} />
                  <span>{linkedRoom.name}</span>
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
                {summary
                  ? <p>{summary}</p>
                  : <p className={styles.summaryEmpty}>No summary yet — Mathia builds one as the conversation grows.</p>}
              </div>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </aside>
  )
}
