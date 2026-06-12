import { useState } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { motion } from 'framer-motion'
import {
  X, ChevronDown, Users, StickyNote, Zap, Link2, Brain, Sparkles,
  Plus, Pin, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Room, Contact, Note, ActionReceipt } from '@/types/chat'
import type { MemoryFact, MemoryEpisode } from '@/api/chat'
import { addNote, createContact, linkRoom, unlinkRoom } from '@/api/chat'
import { formatDate, formatDateTime } from '@/utils/format'
import styles from './ContextPanel.module.css'

interface Props {
  room: Room
  contacts: Contact[]
  notes: Note[]
  actionReceipts: ActionReceipt[]
  summary?: string
  linkedRooms?: { id: number; name: string }[]
  linkableRooms?: { id: number; name: string }[]
  memoryFacts?: MemoryFact[]
  memoryPreferences?: MemoryFact[]
  memoryEpisodes?: MemoryEpisode[]
  onClose: () => void
  onNotesChanged?: () => void
  onContactsChanged?: () => void
  onLinksChanged?: () => void
}

const NOTE_TYPES = ['written', 'decision', 'action_item', 'insight', 'reminder'] as const
const NOTE_PRIORITIES = ['low', 'medium', 'high'] as const

export function ContextPanel({
  room, contacts, notes, actionReceipts, summary = '',
  linkedRooms = [], linkableRooms = [],
  memoryFacts = [], memoryPreferences = [], memoryEpisodes = [],
  onClose, onNotesChanged, onContactsChanged, onLinksChanged,
}: Props) {
  const [composeNote, setComposeNote] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState<(typeof NOTE_TYPES)[number]>('written')
  const [notePriority, setNotePriority] = useState<(typeof NOTE_PRIORITIES)[number]>('medium')
  const [savingNote, setSavingNote] = useState(false)

  const [composeContact, setComposeContact] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  const [linkPickerOpen, setLinkPickerOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<number | ''>('')
  const [linking, setLinking] = useState(false)

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

  const submitLink = async () => {
    if (!linkTarget || linking) return
    setLinking(true)
    try {
      await linkRoom(room.id, Number(linkTarget))
      setLinkTarget('')
      setLinkPickerOpen(false)
      toast.success('Room linked')
      onLinksChanged?.()
    } catch {
      toast.error('Could not link room')
    } finally {
      setLinking(false)
    }
  }

  const removeLink = async (targetRoomId: number) => {
    try {
      await unlinkRoom(room.id, targetRoomId)
      toast('Link removed')
      onLinksChanged?.()
    } catch {
      toast.error('Could not unlink')
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
                  <span style={{ flex: 1 }}>{linkedRoom.name}</span>
                  <button
                    className={styles.linkRemove}
                    onClick={() => removeLink(linkedRoom.id)}
                    aria-label={`Unlink ${linkedRoom.name}`}
                    title="Unlink"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {linkPickerOpen ? (
                <div className={styles.composeForm}>
                  <select
                    className={styles.composeSelect}
                    value={linkTarget}
                    onChange={e => setLinkTarget(e.target.value ? Number(e.target.value) : '')}
                    autoFocus
                  >
                    <option value="">Choose a room…</option>
                    {linkableRooms.length === 0 && <option disabled>No linkable rooms</option>}
                    {linkableRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className={styles.composeActions}>
                    <button className={styles.composeCancel} onClick={() => { setLinkPickerOpen(false); setLinkTarget('') }} disabled={linking}>
                      Cancel
                    </button>
                    <button className={styles.composeSave} onClick={submitLink} disabled={linking || !linkTarget}>
                      {linking ? 'Linking…' : 'Link'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.addBtn}
                  onClick={() => setLinkPickerOpen(true)}
                  disabled={linkableRooms.length === 0}
                  title={linkableRooms.length === 0 ? 'No other rooms to link' : 'Link a room'}
                >
                  <Plus size={13} /> Link Room
                </button>
              )}
            </div>
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="memory" className={styles.section}>
          <Accordion.Trigger className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>
              <Sparkles size={15} />
              <span>AI Memory ({memoryFacts.length + memoryPreferences.length + memoryEpisodes.length})</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} />
          </Accordion.Trigger>
          <Accordion.Content className={styles.sectionContent}>
            <div className={styles.sectionBody}>
              {(memoryFacts.length + memoryPreferences.length + memoryEpisodes.length) === 0 ? (
                <p className={styles.summaryEmpty}>Nothing memorised yet — Mathia learns durable facts and preferences from your conversations.</p>
              ) : (
                <>
                  {memoryFacts.length > 0 && (
                    <div>
                      <div className={styles.memoryHeading}>Facts</div>
                      {memoryFacts.map((f, i) => (
                        <div key={`fact-${i}`} className={styles.memoryItem}>
                          <span className={styles.memoryKey}>{f.key}</span>
                          <span className={styles.memoryValue}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {memoryPreferences.length > 0 && (
                    <div>
                      <div className={styles.memoryHeading}>Preferences</div>
                      {memoryPreferences.map((p, i) => (
                        <div key={`pref-${i}`} className={styles.memoryItem}>
                          <span className={styles.memoryKey}>{p.key}</span>
                          <span className={styles.memoryValue}>{p.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {memoryEpisodes.length > 0 && (
                    <div>
                      <div className={styles.memoryHeading}>Episodes</div>
                      {memoryEpisodes.map((e, i) => (
                        <div key={`ep-${i}`} className={styles.memoryItem}>
                          <span className={styles.memoryValue}>{e.summary}</span>
                          {e.date && <span className={styles.memoryDate}>{e.date}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
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
