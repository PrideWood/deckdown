import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onImageFiles: (files: File[]) => Promise<string>
  onCursorChange: (offset: number) => void
}

export interface MarkdownEditorHandle {
  insertText: (text: string) => void
  focus: () => void
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  { value, onChange, onImageFiles, onCursorChange },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const initialValue = useRef(value)
  const onChangeRef = useRef(onChange)
  const onImageFilesRef = useRef(onImageFiles)
  const onCursorChangeRef = useRef(onCursorChange)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onImageFilesRef.current = onImageFiles
  }, [onImageFiles])

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])

  const insertText = (text: string) => {
    const editor = view.current
    if (!editor || !text) return
    const selection = editor.state.selection.main
    editor.dispatch({
      changes: { from: selection.from, to: selection.to, insert: text },
      selection: { anchor: selection.from + text.length },
      scrollIntoView: true,
    })
    editor.focus()
  }

  useImperativeHandle(ref, () => ({
    insertText,
    focus: () => view.current?.focus(),
  }))

  useEffect(() => {
    if (!host.current) return

    const state = EditorState.create({
      doc: initialValue.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        markdown(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
          if (update.selectionSet || update.docChanged) {
            onCursorChangeRef.current(update.state.selection.main.head)
          }
        }),
        EditorView.domEventHandlers({
          paste(event) {
            const files = Array.from(event.clipboardData?.files || []).filter(
              (file) => file.type.startsWith('image/'),
            )
            if (!files.length) return false
            event.preventDefault()
            void onImageFilesRef.current(files).then(insertText)
            return true
          },
          drop(event) {
            const files = Array.from(event.dataTransfer?.files || []).filter(
              (file) => file.type.startsWith('image/'),
            )
            if (!files.length) return false
            event.preventDefault()
            setIsDragging(false)
            void onImageFilesRef.current(files).then(insertText)
            return true
          },
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            background: '#fbfaf7',
            color: '#292824',
            fontSize: '15px',
          },
          '.cm-scroller': {
            fontFamily:
              '"SFMono-Regular", "Cascadia Code", "Noto Sans Mono CJK SC", monospace',
            lineHeight: '1.72',
            padding: '18px 0 80px',
          },
          '.cm-content': {
            minHeight: '100%',
            padding: '0 22px',
            cursor: 'text',
          },
          '.cm-gutters': {
            background: '#fbfaf7',
            border: 'none',
            color: '#bbb6aa',
            paddingLeft: '8px',
          },
          '.cm-activeLine, .cm-activeLineGutter': {
            background: 'rgba(114, 91, 55, 0.055)',
          },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            background: '#e9dfcc',
          },
          '&.cm-focused': { outline: 'none' },
        }),
      ],
    })

    view.current = new EditorView({ state, parent: host.current })
    return () => view.current?.destroy()
  }, [])

  useEffect(() => {
    const editor = view.current
    if (!editor) return
    const current = editor.state.doc.toString()
    if (current === value) return

    let prefix = 0
    const prefixLimit = Math.min(current.length, value.length)
    while (prefix < prefixLimit && current[prefix] === value[prefix]) {
      prefix += 1
    }

    let suffix = 0
    const suffixLimit = Math.min(
      current.length - prefix,
      value.length - prefix,
    )
    while (
      suffix < suffixLimit &&
      current[current.length - 1 - suffix] === value[value.length - 1 - suffix]
    ) {
      suffix += 1
    }

    editor.dispatch({
      changes: {
        from: prefix,
        to: current.length - suffix,
        insert: value.slice(prefix, value.length - suffix),
      },
    })
  }, [value])

  const hasImageFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.items).some(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    )

  return (
    <div
      className={`markdown-editor ${isDragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => {
        if (hasImageFiles(event)) {
          event.preventDefault()
          setIsDragging(true)
        }
      }}
      onDragOver={(event) => {
        if (hasImageFiles(event)) event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragging(false)
        }
      }}
      onDrop={() => setIsDragging(false)}
      onClick={() => view.current?.focus()}
    >
      <div ref={host} className="editor-host" />
      {isDragging && (
        <div className="drop-overlay">
          <strong>放开以插入图片</strong>
          <span>图片将嵌入最终 HTML</span>
        </div>
      )}
    </div>
  )
})
