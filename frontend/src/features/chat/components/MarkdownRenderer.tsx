import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CodeBlock } from './CodeBlock'
import styles from './MarkdownRenderer.module.css'

interface Props {
  content: string
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const codeString = String(children).replace(/\n$/, '')

    // Block code (inside <pre>)
    if (match) {
      return <CodeBlock code={codeString} language={match[1]} />
    }

    // Inline code
    return (
      <code className={styles.inlineCode} {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    // Let the code component handle rendering
    return <>{children}</>
  },
  table({ children }) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>{children}</table>
      </div>
    )
  },
  th({ children }) {
    return <th className={styles.th}>{children}</th>
  },
  td({ children }) {
    return <td className={styles.td}>{children}</td>
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {children}
      </a>
    )
  },
  blockquote({ children }) {
    return <blockquote className={styles.blockquote}>{children}</blockquote>
  },
  ul({ children }) {
    return <ul className={styles.ul}>{children}</ul>
  },
  ol({ children }) {
    return <ol className={styles.ol}>{children}</ol>
  },
  li({ children }) {
    return <li className={styles.li}>{children}</li>
  },
  h1({ children }) {
    return <h1 className={styles.h1}>{children}</h1>
  },
  h2({ children }) {
    return <h2 className={styles.h2}>{children}</h2>
  },
  h3({ children }) {
    return <h3 className={styles.h3}>{children}</h3>
  },
  hr() {
    return <hr className={styles.hr} />
  },
  p({ children }) {
    return <p className={styles.p}>{children}</p>
  },
}

export function MarkdownRenderer({ content }: Props) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
