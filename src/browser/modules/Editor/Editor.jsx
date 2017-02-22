import React from 'react'
import { connect } from 'react-redux'
import { withBus } from 'react-suber'
import * as commands from 'shared/modules/commands/commandsDuck'
import * as favorites from 'shared/modules/favorites/favoritesDuck'
import { SET_CONTENT } from 'shared/modules/editor/editorDuck'
import { getHistory } from 'shared/modules/history/historyDuck'
import { getSettings } from 'shared/modules/settings/settingsDuck'
import Codemirror from 'react-codemirror'
import 'codemirror/mode/cypher/cypher'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/monokai.css'
import { EditorButton } from 'nbnmui/buttons'

import styles from './style.css'

export class Editor extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      code: props.content || '',
      historyIndex: -1,
      buffer: null,
      mode: 'cypher'
    }
  }
  focusEditor () {
    const cm = this.codeMirror
    cm.focus()
    cm.setCursor(cm.lineCount(), 0)
  }
  clearEditor () {
    this.setEditorValue(this.codeMirror, '')
  }
  handleEnter (cm) {
    if (cm.lineCount() === 1) {
      return this.execCurrent(cm)
    }
    this.newlineAndIndent(cm)
  }
  newlineAndIndent (cm) {
    this.codeMirrorInstance.commands.newlineAndIndent(cm)
  }
  execCurrent () {
    this.props.onExecute(this.codeMirror.getValue())
    this.clearEditor()
    this.setState({historyIndex: -1, buffer: null})
  }
  historyPrev (cm) {
    if (!this.props.history.length) return
    if (this.state.historyIndex + 1 === this.props.history.length) return
    if (this.state.historyIndex === -1) { // Save what's currently in the editor
      this.setState({buffer: cm.getValue()})
    }
    this.setState({historyIndex: this.state.historyIndex + 1})
    this.setEditorValue(cm, this.props.history[this.state.historyIndex].cmd)
  }
  historyNext (cm) {
    if (!this.props.history.length) return
    if (this.state.historyIndex <= -1) return
    if (this.state.historyIndex === 0) { // Should read from buffer
      this.setState({historyIndex: -1})
      this.setEditorValue(cm, this.state.buffer)
      return
    }
    this.setState({historyIndex: this.state.historyIndex - 1})
    this.setEditorValue(cm, this.props.history[this.state.historyIndex].cmd)
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.content !== null && nextProps.content !== this.state.code) {
      this.setEditorValue(this.codeMirror, nextProps.content)
    }
  }
  componentDidMount () {
    this.codeMirror = this.refs.editor.getCodeMirror()
    this.codeMirrorInstance = this.refs.editor.getCodeMirrorInstance()
    this.codeMirrorInstance.keyMap['default']['Enter'] = this.handleEnter.bind(this)
    this.codeMirrorInstance.keyMap['default']['Shift-Enter'] = this.newlineAndIndent.bind(this)
    this.codeMirrorInstance.keyMap['default']['Cmd-Enter'] = this.execCurrent.bind(this)
    this.codeMirrorInstance.keyMap['default']['Ctrl-Enter'] = this.execCurrent.bind(this)
    this.codeMirrorInstance.keyMap['default']['Cmd-Up'] = this.historyPrev.bind(this)
    this.codeMirrorInstance.keyMap['default']['Ctrl-Up'] = this.historyPrev.bind(this)
    this.codeMirrorInstance.keyMap['default']['Cmd-Down'] = this.historyNext.bind(this)
    this.codeMirrorInstance.keyMap['default']['Ctrl-Down'] = this.historyNext.bind(this)
    if (this.props.bus) {
      this.props.bus.take(SET_CONTENT, (msg) => {
        this.setEditorValue(this.codeMirror, msg.message)
      })
    }
  }
  setEditorValue (cm, cmd) {
    this.codeMirror.setValue(cmd)
    this.updateCode(cmd, () => this.focusEditor())
  }
  updateCode (newCode, cb = () => {}) {
    const mode = this.props.cmdchar && newCode.indexOf(this.props.cmdchar) === 0
      ? 'text'
      : 'cypher'
    this.setState({
      code: newCode,
      mode
    }, cb)
  }
  render () {
    const options = {
      lineNumbers: true,
      mode: this.state.mode,
      theme: 'neo',
      gutters: ['cypher-hints'],
      lineWrapping: true,
      autofocus: true
    }
    const updateCode = (val) => this.updateCode(val)
    return (
      <div id='editor' className={styles.editorContainer}>
        <div className={styles['editor-wrapper']}>
          <Codemirror
            ref='editor'
            value={this.state.code}
            onChange={updateCode}
            options={options}
            className={styles.editor}
          />
        </div>
        <div className={styles.actionButtons}>
          <EditorButton
            secondary
            onClick={() => this.props.onFavortieClick(this.state.code)}
            label='&#9734;'
            className={styles.button}
            disabled={this.state.code.length < 1}
            tooltip='Add as favorite'
          />
          <EditorButton
            secondary
            onClick={() => this.clearEditor()}
            label='&times;'
            disabled={this.state.code.length < 1}
            className={styles.button}
            tooltip='Clear editor contents'
          />
          <EditorButton
            onClick={() => this.execCurrent()}
            primary
            label='&#9654;'
            disabled={this.state.code.length < 1}
            className={styles.button}
            tooltip='Execute command'
          />
        </div>
      </div>
    )
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    onFavortieClick: (cmd) => {
      dispatch(favorites.addFavorite(cmd))
    },
    onExecute: (cmd) => {
      const action = commands.executeCommand(cmd)
      ownProps.bus.send(action.type, action)
    }
  }
}

const mapStateToProps = (state) => {
  return {
    content: '',
    history: getHistory(state),
    cmdchar: getSettings(state).cmdchar
  }
}

export default withBus(connect(mapStateToProps, mapDispatchToProps)(Editor))
